-- 032_sub_admin_orders_window.sql
-- Sub admins read only the last 7 days of orders; full admins keep the full history.
--
-- UNTESTED: written without a local Supabase (Docker was not running), so this SQL has not
-- been executed anywhere. Apply it to a local or staging project first and run the checks at
-- the bottom before production.
--
-- Safe to run more than once: functions use create or replace, the policy is dropped if it
-- exists before being created. Works whether or not 030/031 were applied (the role helpers
-- are restated with the same bodies as 031).
--
-- "Weekly" is a ROLLING window: orders created in the last 7 days, by database server time
-- (now()). To switch to a calendar week, change the body of sub_admin_order_window_start()
-- to `select date_trunc('week', now())` (weeks start on Monday) and change
-- lib/order-window.ts to match. Nothing else needs to change.
--
-- ROLLBACK (manual, in the SQL editor): re-create the 031 policy:
--   drop policy if exists "orders: store manager read" on public.orders;
--   create policy "orders: store manager read" on public.orders for select
--     using (public.is_store_manager());
-- The helper functions can stay (nothing else depends on them) or be dropped:
--   drop function if exists public.can_read_order(timestamptz);
--   drop function if exists public.is_sub_admin();
--   drop function if exists public.sub_admin_order_window_start();
-- No data is changed by this migration.
--
-- WHAT ELSE A SUB ADMIN COULD READ ORDERS THROUGH (checked against migrations 001-031):
--   * public.orders policies: "orders: owner read" (007/008/016) lets any signed-in user read
--     their OWN orders (user_id or guest email). A sub admin who is also a customer still sees
--     their own older orders; that is their own data, so it stays.
--   * Order lines: there is no order_items table; lines live in orders.items (jsonb), so the
--     policy below covers them.
--   * Admin dashboard and users page (lib/supabase/admin-dashboard.ts, lib/supabase/users.ts):
--     they query public.orders with the signed-in browser client, so RLS applies. Both pages
--     are also full-admin only (requireFullAdmin in their layouts).
--   * SECURITY DEFINER functions that read orders:
--       complete_order_payment, reserve_order_stock, release_order_stock,
--       release_stale_stock_holds, award_order_points, decrement_product_stock:
--         EXECUTE revoked from anon/authenticated in 031 (service role only).
--       submit_review: reads only the caller's own orders (user_id = auth.uid()).
--       claim_guest_orders: attaches the caller's own guest orders (by their email).
--       admin_customer_counts: counts customer profiles only, no order data.
--   * Server routes using the service role (bypass RLS): /api/orders, /api/orders/verify,
--     the Paystack webhook (no admin reads), and /api/admin/orders/status, which now refuses
--     a sub admin on an order outside the window (app/api/admin/orders/status/route.ts).
--   * Realtime: none of the admin pages subscribe to orders.

-- ── 0. Role helpers (same bodies as 031) ─────────────────────────────────────
alter table public.profiles add column if not exists is_suspended boolean not null default false;

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

create or replace function public.is_sub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'sub_admin'
      and coalesce(is_suspended, false) = false
  );
$$;

-- ── 1. The window, in one place ──────────────────────────────────────────────
create or replace function public.sub_admin_order_window_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select now() - interval '7 days';
$$;

-- True when the signed-in user may read an order created at `p_created_at` as staff.
create or replace function public.can_read_order(p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or (public.is_sub_admin() and p_created_at >= public.sub_admin_order_window_start());
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_store_manager() to anon, authenticated, service_role;
grant execute on function public.is_sub_admin() to anon, authenticated, service_role;
grant execute on function public.sub_admin_order_window_start() to anon, authenticated, service_role;
grant execute on function public.can_read_order(timestamptz) to anon, authenticated, service_role;

-- ── 2. Orders: admins read all, sub admins read the last 7 days ──────────────
-- Replaces 031's "orders: store manager read" (which let sub admins read every order).
-- Writes still go only through the server routes (031 removed client write policies).
drop policy if exists "orders: store manager read" on public.orders;
create policy "orders: store manager read"
  on public.orders for select
  using (public.can_read_order(created_at));

-- ── Checks to run after applying (as each role, e.g. via the app or `set role`) ──
--   * Full admin:  select count(*) from public.orders;                -- every order
--   * Sub admin:   select min(created_at) from public.orders;         -- >= now() - 7 days
--                  (plus their own customer orders, if they have any)
--   * Customer:    select count(*) from public.orders;                -- only their own
--   * Suspended sub admin: sees no staff rows.
