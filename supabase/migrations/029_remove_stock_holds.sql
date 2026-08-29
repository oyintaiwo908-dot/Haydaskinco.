-- 029: Remove stock holds — decrement only on successful payment
-- Apply after 028. Soft stock check at order create remains in /api/orders.

-- Release any open unpaid holds so inventory is not stuck
do $$
declare
  r record;
  res jsonb;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'stock_reserved'
  ) then
    for r in
      select reference
      from public.orders
      where stock_reserved = true
        and payment_status is distinct from 'paid'
    loop
      if to_regprocedure('public.release_order_stock(text)') is not null then
        res := public.release_order_stock(r.reference);
      end if;
    end loop;
  end if;
end;
$$;

-- complete_order_payment: always decrement at pay (fail-closed)
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
      where code = c
        and (max_uses is null or used_count < max_uses);

      get diagnostics promo_updated = row_count;

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

-- Drop hold RPCs (default arg creates a distinct signature)
drop function if exists public.release_stale_stock_holds(interval);
drop function if exists public.release_order_stock(text);
drop function if exists public.reserve_order_stock(text);

alter table public.orders drop column if exists stock_reserved;
