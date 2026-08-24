-- 027: Orders RLS lock, server-side rewards catalog, deal component stock
-- Apply after 026_payment_auth_hardening.sql

-- ── 1. Orders: no public insert; no client unpaid mutation of money fields ────
drop policy if exists "orders: insert checkout" on public.orders;
-- Inserts go through /api/orders with the service-role client (bypasses RLS).

drop policy if exists "orders: owner update unpaid" on public.orders;
-- Payment/status updates are service-role only via complete_order_payment / admin APIs.

-- Keep owner/admin read + admin all (unchanged).

-- ── 2. redeem_reward: ignore client amounts; catalog is authoritative ─────────
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

-- Drop old 4-arg signature if present
drop function if exists public.redeem_reward(text, integer, integer, text);

grant execute on function public.redeem_reward(text) to authenticated;
revoke execute on function public.redeem_reward(text) from anon;
revoke execute on function public.redeem_reward(text) from public;

-- ── 3. Decrement stock for deal components (deal__*) ─────────────────────────
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
      bare := substr(pid, 7); -- strip deal__
      select coalesce(items, '[]'::jsonb) into deal_items
      from public.deals where id = bare;
      if deal_items is null then
        continue;
      end if;

      for component in select * from jsonb_array_elements(deal_items)
      loop
        cid := component->>'productId';
        cqty := coalesce(nullif(component->>'qty', '')::integer, 1) * qty;
        if cid is null or cqty <= 0 then
          continue;
        end if;

        update public.products
        set stock = stock - cqty,
            updated_at = now()
        where id = cid
          and stock >= cqty;

        get diagnostics updated = row_count;
        if updated = 0 and exists (select 1 from public.products where id = cid) then
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
