-- pgTAP checks for 031_security_hardening.sql.
-- Run against a LOCAL Supabase only:  supabase start && supabase db reset && supabase test db
-- Everything runs inside one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

-- ── Fixtures (as postgres) ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-000000000001', 'customer@example.test', '{"full_name":"Test Customer"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test',    '{"full_name":"Test Admin"}',    'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'suspended@example.test','{"full_name":"Old Admin"}',     'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000004', 'manager@example.test',  '{"full_name":"Sub Admin"}',     'authenticated', 'authenticated');

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin', is_suspended = true where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set role = 'sub_admin' where id = '00000000-0000-4000-8000-000000000004';

select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'admin',
  'SQL editor (postgres) can still grant the admin role'
);

insert into public.products (id, name, price, stock, is_published)
values ('sec-test-product', 'Security Test Product', 1000, 10, true);
insert into public.promo_codes (code, discount_pct, max_uses, used_count, is_active)
values ('SEC-PRIVATE-50', 50, null, 0, true);
insert into public.contact_submissions (name, email, message)
values ('Visitor', 'visitor@example.test', 'hello');
insert into public.orders (reference, user_id, guest_email, items, total, status, payment_status)
values ('SEC-ORDER-1', '00000000-0000-4000-8000-000000000001', 'customer@example.test',
        '[{"productId":"sec-test-product","quantity":1,"price":1000}]', 1075, 'pending', 'unpaid');

-- ── Function privileges ───────────────────────────────────────────────────────
select ok(to_regprocedure('public.increment_product_stock(jsonb)') is null,
  'increment_product_stock is dropped');
select ok(not has_function_privilege('anon', 'public.decrement_product_stock(jsonb)', 'execute'),
  'anon cannot call decrement_product_stock');
select ok(not has_function_privilege('authenticated', 'public.decrement_product_stock(jsonb)', 'execute'),
  'authenticated cannot call decrement_product_stock');
select ok(not has_function_privilege('anon', 'public.award_order_points(public.orders)', 'execute'),
  'anon cannot call award_order_points');
select ok(not has_function_privilege('authenticated', 'public.award_order_points(public.orders)', 'execute'),
  'authenticated cannot call award_order_points');
select ok(not has_function_privilege('anon', 'public.complete_order_payment(text)', 'execute'),
  'anon cannot call complete_order_payment');
select ok(not has_function_privilege('authenticated', 'public.complete_order_payment(text)', 'execute'),
  'authenticated cannot call complete_order_payment');
select ok(has_function_privilege('service_role', 'public.complete_order_payment(text)', 'execute'),
  'service_role can still complete payments');

-- ── Customer session ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"customer@example.test","role":"authenticated"}', true);

select throws_ok(
  $$ select public.award_order_points(null::public.orders) $$,
  '42501', null, 'customer RPC to award_order_points is denied');
select throws_ok(
  $$ select public.decrement_product_stock('[{"productId":"sec-test-product","quantity":10}]'::jsonb) $$,
  '42501', null, 'customer RPC to decrement_product_stock is denied');

-- Profile bonus farming
update public.profiles set full_name = 'Test Customer', phone = '08000000000'
  where id = auth.uid();
select is((public.claim_profile_bonus() ->> 'claimed')::boolean, true, 'first profile bonus is granted');
update public.profiles
  set profile_bonus_claimed = false, role = 'admin', is_suspended = false, email = 'spoof@example.test'
  where id = auth.uid();
select is((select profile_bonus_claimed from public.profiles where id = auth.uid()), true,
  'customer cannot reset profile_bonus_claimed');
select is((select role from public.profiles where id = auth.uid()), 'customer',
  'customer cannot promote themselves');
select is((select email from public.profiles where id = auth.uid()), 'customer@example.test',
  'customer cannot change their profile email');
select is((public.claim_profile_bonus() ->> 'claimed')::boolean, false,
  'second profile bonus claim grants nothing');

-- Review farming
select is((public.submit_review('sec-test-product', 5, 'Great', 'Body', '') ->> 'ok')::boolean, true,
  'review on a real product is accepted');
delete from public.reviews where user_id = auth.uid() and product_id = 'sec-test-product';
select public.submit_review('sec-test-product', 4, 'Again', 'Body', '');
select is(
  (select count(*)::int from public.points_ledger where user_id = auth.uid() and label = 'Product review'),
  1,
  'delete + re-post earns review points only once');
select is((public.submit_review('no-such-product-123', 5, 'x', 'y', '') ->> 'ok')::boolean, false,
  'review on a non-existent product is rejected');
update public.reviews set verified = true, helpful_count = 999
  where user_id = auth.uid() and product_id = 'sec-test-product';
select is((select verified from public.reviews
           where user_id = auth.uid() and product_id = 'sec-test-product'), false,
  'customer cannot set verified on their review');
select is((select helpful_count from public.reviews
           where user_id = auth.uid() and product_id = 'sec-test-product'), 0,
  'customer cannot set helpful_count');
select throws_ok(
  $$ insert into public.reviews (product_id, user_id, author_name, rating, verified)
     values ('sec-test-product-2', '00000000-0000-4000-8000-000000000001', 'x', 5, true) $$,
  '42501', null, 'direct review insert is denied (submit_review only)');

-- Promo codes
select is((select count(*)::int from public.promo_codes where code = 'SEC-PRIVATE-50'), 0,
  'customers cannot list promo codes');

-- Orders
select is((select count(*)::int from public.orders where reference = 'SEC-ORDER-1'), 1,
  'customer can read their own order');

-- ── Anonymous ─────────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.promo_codes), 0, 'anon cannot list promo codes');

-- ── Suspended admin ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","email":"suspended@example.test","role":"authenticated"}', true);
select is((select count(*)::int from public.contact_submissions), 0,
  'suspended admin cannot read the contact inbox');

-- ── Active admin ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","email":"admin@example.test","role":"authenticated"}', true);
select ok((select count(*)::int from public.contact_submissions) >= 1,
  'active admin can read the contact inbox');
update public.orders set status = 'shipped' where reference = 'SEC-ORDER-1';
select is((select status from public.orders where reference = 'SEC-ORDER-1'), 'pending',
  'admin browser client cannot write orders directly (must use the status API)');

-- ── Sub admin ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","email":"manager@example.test","role":"authenticated"}', true);
select is((select count(*)::int from public.orders where reference = 'SEC-ORDER-1'), 1,
  'sub admin can read orders');
select is((select count(*)::int from public.contact_submissions), 0,
  'sub admin cannot read the inbox');

reset role;
select * from finish();
rollback;
