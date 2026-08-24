-- 026: Payment/auth hardening
-- 1) complete_order_payment: service_role only (revoke anon/authenticated)
-- 2) Fail stock decrement when insufficient (rolls back paid update in same txn)
-- 3) Prevent self-escalation of profiles.role / is_suspended

-- ── 1. Revoke public execute on fulfillment RPC ───────────────────────────────
revoke execute on function public.complete_order_payment(text) from public;
revoke execute on function public.complete_order_payment(text) from anon;
revoke execute on function public.complete_order_payment(text) from authenticated;
grant execute on function public.complete_order_payment(text) to service_role;

-- ── 2. Hard-fail stock decrement on oversell ──────────────────────────────────
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
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    pid := item->>'productId';
    qty := coalesce((item->>'quantity')::integer, 0);
    if pid is null or qty <= 0 then
      continue;
    end if;
    -- Skip deal bundle ids (stock lives on component products)
    if pid like 'deal__%' then
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
      -- Unknown product id: skip (legacy/orphaned line)
    end if;
  end loop;
end;
$$;

-- Re-assert current complete_order_payment body (019) so stock failure rolls back paid status.
-- Body unchanged from 019 aside from relying on the new decrement behavior.
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
begin
  select * into o from public.orders where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Order not found');
  end if;
  if o.payment_status = 'paid' then
    perform public.award_order_points(o);
    return jsonb_build_object('ok', true, 'message', 'Already paid');
  end if;

  -- Decrement first so insufficient stock aborts before marking paid
  perform public.decrement_product_stock(o.items);

  update public.orders
  set payment_status = 'paid',
      status = 'processing',
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
      where code = c;

      delete from public.reward_redemptions
      where promo_code = c;
    end loop;
  end if;

  perform public.award_order_points(o);

  return jsonb_build_object('ok', true);
end;
$$;

-- Grants again after replace (Postgres may reset)
revoke execute on function public.complete_order_payment(text) from public;
revoke execute on function public.complete_order_payment(text) from anon;
revoke execute on function public.complete_order_payment(text) from authenticated;
grant execute on function public.complete_order_payment(text) to service_role;

-- ── 3. Lock privileged profile columns for non-admins ─────────────────────────
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.role := old.role;
    if new.is_suspended is distinct from old.is_suspended then
      new.is_suspended := old.is_suspended;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row
  execute procedure public.protect_profile_privileges();
