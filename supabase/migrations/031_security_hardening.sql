-- 031_security_hardening.sql
-- Closes the points-farming, anon RPC and policy gaps found in the security review.
--
-- Safe to run more than once, and safe whether or not 026–030 were applied:
-- every function is (re)created with create or replace, policies and triggers
-- are dropped-if-exists before being created, columns use add column if not
-- exists, and grants/revokes skip functions that do not exist.
--
-- ROLLBACK (manual, run in the SQL editor if something breaks):
--   * Function privileges: `grant execute on function public.decrement_product_stock(jsonb)
--     to authenticated;` (etc.). increment_product_stock is dropped; recreate it from
--     028_stock_holds_and_hardening.sql if a caller still needs it (none in the app).
--   * Profiles trigger: re-run section 3 of 026_payment_auth_hardening.sql.
--   * Reviews: `drop trigger if exists reviews_protect_fields on public.reviews;` and
--     re-run the "reviews: auth insert" policy + submit_review from 009_customer_features.sql.
--   * Review points: `drop index if exists public.points_ledger_review_product_earn;`
--     (the points_ledger.product_id column can stay; it is nullable and unused elsewhere).
--   * promo_codes: re-create "promo_codes: public read active" from 007_orders.sql and
--     `drop policy "promo_codes: own reward read" on public.promo_codes;`.
--   * Inbox: re-run the three "admin read" policies from 014_comms.sql.
--   * Orders: re-create "orders: admin all" from 030_archive_and_sub_admin.sql and
--     `drop policy "orders: store manager read" on public.orders;`.
-- No data is deleted by this migration.

-- ── 0. Role helpers (same bodies as 030, so this file stands alone) ───────────
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists profile_bonus_claimed boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(is_suspended, false) = false
  );
$$;

create or replace function public.is_store_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'sub_admin')
      and coalesce(is_suspended, false) = false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_store_manager() to anon, authenticated, service_role;

-- ── 1. Internal SECURITY DEFINER functions are not public RPCs ───────────────
-- Postgres grants EXECUTE to PUBLIC by default and Supabase also grants it to
-- anon/authenticated, which exposes these at /rest/v1/rpc/<name>.
drop function if exists public.increment_product_stock(jsonb);

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.decrement_product_stock(jsonb)',
    'public.award_order_points(public.orders)',
    'public.refresh_product_rating(text)',
    'public.complete_order_payment(text)',
    'public.reserve_order_stock(text)',
    'public.release_order_stock(text)',
    'public.release_stale_stock_holds(interval)'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end;
$$;

alter function public.handle_new_user() set search_path = public;

-- ── 2. Profiles: clients cannot change privileged or reward columns ──────────
-- SECURITY INVOKER on purpose: current_user is 'authenticated'/'anon' only for
-- direct client writes. SECURITY DEFINER RPCs (claim_profile_bonus) and the SQL
-- editor run as the owner and are not restricted.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.id := old.id;
    new.created_at := old.created_at;
    new.profile_bonus_claimed := old.profile_bonus_claimed;
    if not public.is_admin() then
      new.role := old.role;
      new.is_suspended := old.is_suspended;
      new.email := old.email;
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

-- ── 3. Reviews: no client-set verified badge / helpful count / direct insert ──
-- Inserts go through submit_review() (SECURITY DEFINER), which the app already uses.
drop policy if exists "reviews: auth insert" on public.reviews;

create or replace function public.protect_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.helpful_count := 0;
    else
      new.verified := old.verified;
      new.helpful_count := old.helpful_count;
      new.user_id := old.user_id;
      new.product_id := old.product_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_protect_fields on public.reviews;
create trigger reviews_protect_fields
  before insert or update on public.reviews
  for each row
  execute procedure public.protect_review_fields();

-- ── 4. Review points: once per (user, product), ever ─────────────────────────
alter table public.points_ledger add column if not exists product_id text;

-- Backfill from live reviews. If a user already has several positive review
-- entries for the same product (possible only through earlier farming), only the
-- earliest one is tagged; the others keep product_id = null so the unique index
-- below can be created. No ledger rows are deleted or changed in value.
with ranked as (
  select
    pl.id,
    r.product_id,
    row_number() over (
      partition by pl.user_id, r.product_id
      order by pl.created_at, pl.id
    ) as rn
  from public.points_ledger pl
  join public.reviews r on r.id = pl.review_id
  where pl.delta > 0
    and pl.product_id is null
    and not exists (
      select 1 from public.points_ledger x
      where x.user_id = pl.user_id
        and x.product_id = r.product_id
        and x.delta > 0
    )
)
update public.points_ledger pl
set product_id = ranked.product_id
from ranked
where pl.id = ranked.id
  and ranked.rn = 1;

create unique index if not exists points_ledger_review_product_earn
  on public.points_ledger (user_id, product_id)
  where product_id is not null and delta > 0;

create or replace function public.submit_review(
  p_product_id text,
  p_rating integer,
  p_title text,
  p_body text,
  p_author_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_verified boolean := false;
  new_id uuid;
  name text;
  is_new boolean := false;
  product_ok boolean := false;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'Sign in required');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'message', 'Invalid rating');
  end if;
  if p_product_id is null or length(p_product_id) > 160 then
    return jsonb_build_object('ok', false, 'message', 'Product not found');
  end if;
  if length(coalesce(p_title, '')) > 200
     or length(coalesce(p_body, '')) > 5000
     or length(coalesce(p_author_name, '')) > 80 then
    return jsonb_build_object('ok', false, 'message', 'Review is too long');
  end if;

  -- Only real, live products or deals can be reviewed. to_jsonb() keeps this
  -- working whether or not the is_archived column (030) exists.
  if p_product_id like 'deal\_\_%' then
    select exists (
      select 1 from public.deals d
      where d.id = substr(p_product_id, 7) and d.is_active = true
    ) into product_ok;
  else
    select exists (
      select 1 from public.products p
      where p.id = p_product_id
        and p.is_published = true
        and coalesce((to_jsonb(p) ->> 'is_archived')::boolean, false) = false
    ) into product_ok;
  end if;
  if not product_ok then
    return jsonb_build_object('ok', false, 'message', 'Product not found');
  end if;

  select exists (
    select 1 from public.orders o
    where o.user_id = uid
      and o.payment_status = 'paid'
      and exists (
        select 1 from jsonb_array_elements(o.items) item
        where item->>'productId' = p_product_id
      )
  ) into is_verified;

  select coalesce(
    nullif(trim(p_author_name), ''),
    (select coalesce(nullif(full_name, ''), nullif(first_name, ''), split_part(email, '@', 1))
     from public.profiles where id = uid),
    'Customer'
  ) into name;

  if exists (select 1 from public.reviews where user_id = uid and product_id = p_product_id) then
    update public.reviews
    set rating = p_rating,
        title = coalesce(p_title, ''),
        body = coalesce(p_body, ''),
        author_name = name,
        verified = is_verified,
        updated_at = now()
    where user_id = uid and product_id = p_product_id
    returning id into new_id;
  else
    insert into public.reviews (product_id, user_id, author_name, rating, title, body, verified)
    values (p_product_id, uid, name, p_rating, coalesce(p_title, ''), coalesce(p_body, ''), is_verified)
    returning id into new_id;
    is_new := true;
  end if;

  -- +50 once per (user, product): deleting and re-posting a review earns nothing.
  if is_new then
    insert into public.points_ledger (user_id, delta, label, review_id, product_id)
    values (uid, 50, 'Product review', new_id, p_product_id)
    on conflict (user_id, product_id) where product_id is not null and delta > 0
    do nothing;
  end if;

  return jsonb_build_object('ok', true, 'id', new_id, 'verified', is_verified);
end;
$$;

revoke execute on function public.submit_review(text, integer, text, text, text) from public, anon;
grant execute on function public.submit_review(text, integer, text, text, text) to authenticated;

-- ── 5. promo_codes: no public listing; customers see only their reward codes ─
drop policy if exists "promo_codes: public read active" on public.promo_codes;
drop policy if exists "promo_codes: own reward read" on public.promo_codes;
create policy "promo_codes: own reward read"
  on public.promo_codes for select
  to authenticated
  using (
    exists (
      select 1 from public.reward_redemptions rr
      where rr.promo_code = promo_codes.code
        and rr.user_id = auth.uid()
    )
  );

-- ── 6. Inbox tables: full admins only, and suspension-aware ──────────────────
drop policy if exists "newsletter: admin read" on public.newsletter_subscribers;
create policy "newsletter: admin read"
  on public.newsletter_subscribers for select
  using (public.is_admin());

drop policy if exists "contact: admin read" on public.contact_submissions;
create policy "contact: admin read"
  on public.contact_submissions for select
  using (public.is_admin());

drop policy if exists "wholesale: admin read" on public.wholesale_enquiries;
create policy "wholesale: admin read"
  on public.wholesale_enquiries for select
  using (public.is_admin());

-- ── 7. Orders: store managers read; all writes go through server routes ──────
-- /api/orders, /api/orders/verify, the Paystack webhook and
-- /api/admin/orders/status use the service role and enforce pricing and the
-- status transition rules, so the browser admin client no longer writes orders.
drop policy if exists "orders: admin all" on public.orders;
drop policy if exists "orders: store manager read" on public.orders;
create policy "orders: store manager read"
  on public.orders for select
  using (public.is_store_manager());
