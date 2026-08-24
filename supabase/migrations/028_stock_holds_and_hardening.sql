-- 028: Stock holds, fail-closed deals, atomic redeem, stale-hold release
-- Apply after 027

-- ── Stock reservation flag on orders ──────────────────────────────────────────
alter table public.orders
  add column if not exists stock_reserved boolean not null default false;

-- ── Increment stock (release holds) — mirrors decrement including deal__* ─────
create or replace function public.increment_product_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid text;
  qty integer;
  component jsonb;
  cid text;
  cqty integer;
  bare text;
  deal_items jsonb;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    pid := item->>'productId';
    qty := coalesce((item->>'quantity')::integer, 0);
    if pid is null or qty <= 0 then
      continue;
    end if;

    if pid like 'deal__%' then
      bare := substr(pid, 7);
      select coalesce(items, '[]'::jsonb) into deal_items
      from public.deals where id = bare;
      if deal_items is null or jsonb_typeof(deal_items) <> 'array' or jsonb_array_length(deal_items) = 0 then
        continue; -- release is best-effort if deal was deleted
      end if;
      for component in select * from jsonb_array_elements(deal_items)
      loop
        cid := component->>'productId';
        cqty := coalesce(nullif(component->>'qty', '')::integer, 1) * qty;
        if cid is null or cqty <= 0 then
          continue;
        end if;
        update public.products
        set stock = stock + cqty,
            updated_at = now()
        where id = cid;
      end loop;
      continue;
    end if;

    update public.products
    set stock = stock + qty,
        updated_at = now()
    where id = pid;
  end loop;
end;
$$;

-- ── Fail-closed decrement (missing/empty deal raises) ─────────────────────────
create or replace function public.decrement_product_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid text;
  qty integer;
  updated integer;
  component jsonb;
  cid text;
  cqty integer;
  bare text;
  deal_items jsonb;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    pid := item->>'productId';
    qty := coalesce((item->>'quantity')::integer, 0);
    if pid is null or qty <= 0 then
      continue;
    end if;

    if pid like 'deal__%' then
      bare := substr(pid, 7);
      select items into deal_items from public.deals where id = bare;
      if deal_items is null or jsonb_typeof(deal_items) <> 'array' or jsonb_array_length(deal_items) = 0 then
        raise exception 'Deal % not found or has no components', bare
          using errcode = 'P0001';
      end if;

      for component in select * from jsonb_array_elements(deal_items)
      loop
        cid := component->>'productId';
        cqty := coalesce(nullif(component->>'qty', '')::integer, 1) * qty;
        if cid is null or cqty <= 0 then
          raise exception 'Deal % has invalid component', bare
            using errcode = 'P0001';
        end if;

        update public.products
        set stock = stock - cqty,
            updated_at = now()
        where id = cid
          and stock >= cqty;

        get diagnostics updated = row_count;
        if updated = 0 then
          raise exception 'Insufficient stock for product % (deal %)', cid, bare
            using errcode = 'P0001';
        end if;
      end loop;
      continue;
    end if;

    update public.products
    set stock = stock - qty,
        updated_at = now()
    where id = pid
      and stock >= qty;

    get diagnostics updated = row_count;
    if updated = 0 then
      if exists (select 1 from public.products where id = pid) then
        raise exception 'Insufficient stock for product %', pid
          using errcode = 'P0001';
      end if;
    end if;
  end loop;
end;
$$;

-- ── Reserve stock at checkout (holds inventory until pay / release) ───────────
create or replace function public.reserve_order_stock(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Order not found');
  end if;
  if o.stock_reserved then
    return jsonb_build_object('ok', true, 'message', 'Already reserved');
  end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'message', 'Already paid');
  end if;

  perform public.decrement_product_stock(o.items);

  update public.orders
  set stock_reserved = true,
      updated_at = now()
  where reference = p_reference;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Release hold (failed pay, cancel, stale unpaid) ───────────────────────────
create or replace function public.release_order_stock(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Order not found');
  end if;
  if not o.stock_reserved then
    return jsonb_build_object('ok', true, 'message', 'Nothing to release');
  end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('ok', false, 'message', 'Cannot release paid order stock');
  end if;

  perform public.increment_product_stock(o.items);

  update public.orders
  set stock_reserved = false,
      updated_at = now()
  where reference = p_reference;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.reserve_order_stock(text) from public, anon, authenticated;
revoke execute on function public.release_order_stock(text) from public, anon, authenticated;
grant execute on function public.reserve_order_stock(text) to service_role;
grant execute on function public.release_order_stock(text) to service_role;

-- ── complete_order_payment: skip decrement when already reserved ──────────────
create or replace function public.complete_order_payment(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  codes text[];
  c text;
  promo_updated integer;
begin
  select * into o from public.orders where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Order not found');
  end if;
  if o.payment_status = 'paid' then
    perform public.award_order_points(o);
    return jsonb_build_object('ok', true, 'message', 'Already paid');
  end if;

  if not o.stock_reserved then
    perform public.decrement_product_stock(o.items);
  end if;

  update public.orders
  set payment_status = 'paid',
      status = 'processing',
      stock_reserved = true,
      updated_at = now()
  where reference = p_reference
  returning * into o;

  codes := coalesce(o.applied_promo_codes, '{}');
  if cardinality(codes) = 0 and o.promo_code is not null then
    codes := array[o.promo_code];
  end if;

  if cardinality(codes) > 0 then
    foreach c in array codes loop
      update public.promo_codes
      set used_count = used_count + 1,
          is_active = case
            when max_uses is not null and used_count + 1 >= max_uses then false
            when code like 'RWD-%' then false
            else is_active
          end
      where code = c
        and (max_uses is null or used_count < max_uses);

      get diagnostics promo_updated = row_count;
      -- Soft: if promo already exhausted, still complete payment (amount already charged)

      delete from public.reward_redemptions
      where promo_code = c;
    end loop;
  end if;

  perform public.award_order_points(o);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.complete_order_payment(text) from public, anon, authenticated;
grant execute on function public.complete_order_payment(text) to service_role;

-- ── redeem_reward: advisory lock against concurrent overspend ─────────────────
create or replace function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal integer;
  code text;
  cost integer;
  discount integer;
  lbl text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'Sign in required');
  end if;

  perform pg_advisory_xact_lock(hashtext('rewards:' || uid::text));

  case p_reward_id
    when 'r1' then cost := 500;  discount := 500;  lbl := '₦500 off your next order';
    when 'r2' then cost := 1000; discount := 1000; lbl := '₦1,000 off your next order';
    when 'r3' then cost := 250;  discount := 250;  lbl := '₦250 off (free delivery credit)';
    when 'r4' then cost := 2000; discount := 2000; lbl := '₦2,000 off your next order';
    when 'r5' then cost := 800;  discount := 800;  lbl := '₦800 off your next order';
    when 'r6' then cost := 1500; discount := 1500; lbl := '₦1,500 off your next order';
    else
      return jsonb_build_object('ok', false, 'message', 'Unknown reward');
  end case;

  select coalesce(sum(delta), 0)::integer into bal
  from public.points_ledger where user_id = uid;

  if bal < cost then
    return jsonb_build_object('ok', false, 'message', 'Not enough points');
  end if;

  code := 'RWD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.promo_codes (code, discount_pct, discount_ngn, max_uses, used_count, is_active)
  values (code, null, discount, 1, 0, true);

  insert into public.points_ledger (user_id, delta, label)
  values (uid, -cost, 'Redeemed: ' || lbl);

  insert into public.reward_redemptions (user_id, reward_id, promo_code, points_spent)
  values (uid, p_reward_id, code, cost);

  return jsonb_build_object('ok', true, 'promo_code', code, 'discount_ngn', discount);
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;

-- ── Release abandoned unpaid holds older than 2 hours ─────────────────────────
create or replace function public.release_stale_stock_holds(p_max_age interval default interval '2 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  res jsonb;
begin
  for r in
    select reference
    from public.orders
    where stock_reserved = true
      and payment_status = 'unpaid'
      and created_at < now() - p_max_age
    for update skip locked
  loop
    res := public.release_order_stock(r.reference);
    if (res->>'ok')::boolean then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.release_stale_stock_holds(interval) from public, anon, authenticated;
grant execute on function public.release_stale_stock_holds(interval) to service_role;
