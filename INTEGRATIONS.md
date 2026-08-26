# HAYDA SKINCo. — Backend Integration Checklist

> **Status — Updated Jul 2026:**
>
> - Priority 1 (Auth + DB foundation): **COMPLETE**
> - Priority 2 (Checkout & Payments): **COMPLETE** — See `PRIORITY_2.md`
> - Priority 3 (Customer Features): **COMPLETE** — See `PRIORITY_3.md`
> - Priority 4 (Admin CRUD + dashboard): **COMPLETE** — See `PRIORITY_4.md`. Live dashboard + users/roles; products/journals/deals/orders were already wired.
> - Priority 5 (Communication): **COMPLETE** — See `PRIORITY_5.md`. Resend email, Supabase newsletter/contact/wholesale, WhatsApp env. Image storage was already done.
> - Priority 6 (Loyalty polish & ship): **COMPLETE** — See `PRIORITY_6.md`. Profile +100 bonus, password reset UX, catalog surfaces on Supabase; core rewards were already in P3.

---

## Priority 1 — Auth & Database foundation

Everything else depends on these two being in place first.

---

### 1.1 Authentication — Supabase Auth

**Current:** `lib/auth.ts` writes plain JSON to `localStorage`. Any email/password is accepted for customers; admin is hardcoded to `admin@haydaskinco.com / password`. Sessions are cleared on a different device or browser.

**Replace with:** Supabase Auth (email + password, magic link optional).

**Files to update:**

| File                                         | Change                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth.ts`                                | Remove localStorage helpers; export Supabase client session helpers                                                                                                         |
| `components/user-auth-provider.tsx`          | `signIn` → `supabase.auth.signInWithPassword()`, `signUp` → `supabase.auth.signUp()`, `signOut` → `supabase.auth.signOut()`, read session from `supabase.auth.getSession()` |
| `components/admin-auth-provider.tsx`         | Same pattern; add role check — only users with `role = 'admin'` in `profiles` table may proceed                                                                             |
| `app/(storefront)/login/page.tsx`            | Remove demo note                                                                                                                                                            |
| `app/(auth)/admin/login/page.tsx`            | Remove hardcoded credential fallback                                                                                                                                        |
| `app/(storefront)/account/settings/page.tsx` | Wire "Change password" to `supabase.auth.updateUser()`                                                                                                                      |

**Database tables needed:**

```sql
-- Extended profile (Supabase Auth creates auth.users automatically)
create table profiles (
  id          uuid references auth.users primary key,
  full_name   text,
  first_name  text,
  role        text default 'customer',   -- 'customer' | 'admin'
  phone       text,
  created_at  timestamptz default now()
);

-- Saved addresses
create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  label       text,
  line1       text,
  line2       text,
  city        text,
  state       text,
  country     text default 'Nigeria',
  is_default  bool default false
);
```

**Row-Level Security:** Enable RLS on both tables; users may only read/write their own rows.

---

### 1.2 Products — Supabase Database

**Current:** `lib/products.ts` — static array of 12 products exported at build time.

**Replace with:** Supabase Postgres + server-side data fetching.

**Database table:**

```sql
create table products (
  id           text primary key,           -- slug, e.g. 'cerave-hydrating-cleanser'
  name         text not null,
  brand        text references brands(name),
  tagline      text,
  description  text,
  price        integer not null,           -- in kobo (₦5500 = 550000) or NGN integer
  image        text,                       -- primary image URL (Supabase Storage)
  images       text[],                     -- gallery URLs
  category     text,
  tag          text,                       -- 'Bestseller' | 'New' | 'Sale' | 'Low Stock'
  benefits     text[],
  ingredients  text[],
  concerns     text[],
  stock        integer default 0,
  rating       numeric(2,1) default 0,
  review_count integer default 0,
  size         text,
  how_to_use   text,
  variants     jsonb,                      -- [{label, price}]
  published    bool default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table brands (
  id       text primary key,
  name     text unique not null,
  tagline  text,
  logo_url text
);
```

**Admin product form (`components/admin-product-form.tsx`):** On submit, call `supabase.from('products').insert()` or `.update()`. Remove the 700 ms fake delay.

**Storefront queries:** Use `supabase.from('products').select()` with `.eq()`, `.in()`, `.gte()`, `.order()` filters to replace the `useMemo` filter logic in `components/shop-grid.tsx`.

**Image uploads:** See §4.1 (Supabase Storage).

---

### 1.3 Journals / Skin Blog — Supabase Database

**Current:** `lib/journals.ts` — static array.

**Database table:**

```sql
create table journals (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  content      text,                  -- Markdown
  category     text,
  author       text,
  author_id    uuid references profiles(id),
  image        text,
  read_time    integer,
  status       text default 'draft',  -- 'published' | 'draft'
  tags         text[],
  published_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

**Admin journal editor (`components/admin-journal-editor.tsx`):** Save/update via Supabase. Publish action sets `status = 'published'` and `published_at = now()`.

**Storefront:** `generateStaticParams` → query published slugs; article page → query by slug (ISR with `revalidate`).

---

### 1.4 Deals / Bundles — Supabase Database

**Current:** `lib/deals.ts` — static array.

**Database table:**

```sql
create table deals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  subtitle       text,
  brand          text,
  badge          text,
  concern        text,
  original_price integer,
  sale_price     integer,
  items          jsonb,              -- [{name, size, price}]
  status         text default 'draft',
  highlight      bool default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
```

---

## Priority 2 — Checkout & Payments

---

### 2.1 Paystack Checkout

> **Implementation guide:** [`PRIORITY_2.md`](./PRIORITY_2.md)

**Current:** Wired — `POST /api/orders` creates a pending order and redirects to Paystack (or mock callback when keys are missing).

**Integration steps:**

1. **Install SDK:** `pnpm add @paystack/inline-js` (or use the popup script).
2. **Create an order API route** (`app/api/orders/route.ts`):
   - Validate cart items and stock
   - Create an `orders` row with `status = 'pending'`
   - Initialise a Paystack transaction via `POST https://api.paystack.co/transaction/initialize`
   - Return the `authorization_url` / `access_code`
3. **Launch Paystack popup** in the browser using the access code.
4. **Webhook handler** (`app/api/webhooks/paystack/route.ts`):
   - Verify `x-paystack-signature` with `PAYSTACK_SECRET_KEY`
   - On `charge.success`: update order `status = 'paid'`, decrement product stock, send confirmation email
5. **Flutterwave** (alternative): identical flow using `flw-node-sdk`; swap the initialize/verify endpoints.

**Environment variables needed:**

```
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
```

**Promo codes:** Move `PROMO_CODES` object to a `promo_codes` table with `code`, `discount_pct`, `max_uses`, `used_count`, `expires_at`.

---

### 2.2 Orders — Database

**Current:** `lib/orders.ts` — static mock array. Admin status changes are `useState`-only.

**Database table:**

```sql
create table orders (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique,              -- Paystack reference
  user_id          uuid references profiles(id),
  guest_email      text,                     -- for guest checkout
  items            jsonb not null,           -- [{id, name, price, qty, image}]
  shipping_address jsonb,
  shipping_method  text,
  shipping_cost    integer,
  subtotal         integer,
  tax              integer,
  discount         integer default 0,
  total            integer,
  status           text default 'pending',   -- pending | processing | shipped | fulfilled | cancelled
  payment_status   text default 'unpaid',   -- unpaid | paid | refunded
  payment_method   text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
```

**Admin orders page (`app/(admin)/admin/orders/page.tsx`):** Replace mock array with `supabase.from('orders').select(*, profiles(*))`. Status change button → `.update({ status })`.

**Customer orders page (`app/(storefront)/account/orders/page.tsx`):** Query `orders` filtered by `user_id = auth.uid()`.

---

## Priority 3 — Customer Features

---

### 3.1 Product Reviews

**Current:** `components/product-reviews.tsx` — `SEED_REVIEWS` + local React state. Reviews are lost on refresh.

**Database table:**

```sql
create table reviews (
  id              uuid primary key default gen_random_uuid(),
  product_id      text references products(id),
  user_id         uuid references profiles(id),
  author_name     text,
  rating          integer check (rating between 1 and 5),
  title           text,
  body            text,
  verified        bool default false,      -- true if user has a fulfilled order for this product
  helpful_count   integer default 0,
  created_at      timestamptz default now()
);

create table review_helpful (
  review_id  uuid references reviews(id),
  user_id    uuid references profiles(id),
  primary key (review_id, user_id)
);
```

**On submit:** `supabase.from('reviews').insert()`. After insert, update `products.rating` and `products.review_count` via a Postgres function/trigger.

**Verified purchase check:** On load, query whether `auth.uid()` has a `fulfilled` order containing this `product_id`.

---

### 3.2 Cart Persistence

**Current:** `components/cart-provider.tsx` — React state only; cleared on page refresh.

**Options (choose one):**

- **localStorage sync (quick win):** On every `addItem`/`removeItem`/`clearCart`, write to `localStorage`. On mount, hydrate from `localStorage`. No server needed.
- **Server-side cart (robust):** Store `cart_items` table linked to `user_id` (or anonymous session ID). Merge guest cart on sign-in.

**Recommended for MVP:** localStorage sync for guests; merge to DB on sign-in.

---

### 3.3 Wishlist / Favorites

**Current:** `components/favorites-provider.tsx` — React state, cleared on reload.

**Database table:**

```sql
create table wishlist (
  user_id    uuid references profiles(id),
  product_id text references products(id),
  added_at   timestamptz default now(),
  primary key (user_id, product_id)
);
```

On mount, fetch user's wishlist. `toggleFavorite` → upsert/delete row.

---

### 3.4 Loyalty / Rewards Points

**Status:** Live (Priority 3 + Priority 6 polish). See `PRIORITY_3.md` / `PRIORITY_6.md`.  
~~**Current:** `app/(storefront)/account/rewards/page.tsx` — hardcoded `POINTS_BALANCE = 1250`, static history, redeem buttons do nothing.~~

**Database tables:**

```sql
create table points_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  delta       integer not null,             -- positive = earn, negative = redeem
  label       text,
  order_id    uuid references orders(id),
  created_at  timestamptz default now()
);

create table reward_redemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  reward_id   text,
  promo_code  text,                         -- generated on redeem
  redeemed_at timestamptz default now()
);
```

**Earn triggers (Postgres functions):**

- Order `fulfilled` → `+1 pt per ₦100` spent
- Review submitted → `+50 pts`
- Profile completed → `+100 pts` (one-time)

**Redeem flow:** Validate points balance → insert `reward_redemptions` row → generate a single-use promo code → deduct points via `points_ledger`.

---

### 3.5 Account Settings (Profile & Password)

**Current:** `app/(storefront)/account/settings/page.tsx` — save buttons are fake.

- **Profile save:** `supabase.from('profiles').update({ full_name, phone })` + `supabase.from('addresses').upsert()`
- **Password change:** `supabase.auth.updateUser({ password: newPassword })`
- **Newsletter preference:** `supabase.from('profiles').update({ newsletter_opted_in: bool })`

---

## Priority 4 — Admin CRUD

Every admin form currently simulates a 700 ms delay and redirects. Replace each with real API calls.

| Page                       | Action             | API call                                                           |
| -------------------------- | ------------------ | ------------------------------------------------------------------ |
| `admin/products/new`       | Create             | `supabase.from('products').insert(data)`                           |
| `admin/products/[id]/edit` | Update             | `supabase.from('products').update(data).eq('id', id)`              |
| `admin/products/page.tsx`  | Delete             | `supabase.from('products').delete().eq('id', id)`                  |
| `admin/journals/new`       | Create             | `supabase.from('journals').insert(data)`                           |
| `admin/journals/[id]/edit` | Update             | `supabase.from('journals').update(data).eq('id', id)`              |
| `admin/deals/new`          | Create             | `supabase.from('deals').insert(data)`                              |
| `admin/deals/[id]/edit`    | Update             | `supabase.from('deals').update(data).eq('id', id)`                 |
| `admin/orders/page.tsx`    | Status update      | `supabase.from('orders').update({ status }).eq('id', id)`          |
| `admin/users/page.tsx`     | Role/status toggle | `supabase.from('profiles').update({ role / status }).eq('id', id)` |

**Admin dashboard (`admin/dashboard/page.tsx`):** Replace all mock KPI numbers with aggregation queries:

```sql
select count(*) from orders where status = 'pending';
select sum(total) from orders where payment_status = 'paid' and created_at > now() - interval '30 days';
select count(*) from profiles where role = 'customer';
```

---

## Priority 5 — Communication & Third-Party Services

---

### 5.1 Transactional Email

Trigger emails for:

| Event              | Email                                                        |
| ------------------ | ------------------------------------------------------------ |
| Order placed       | Order confirmation with items, total, and estimated delivery |
| Order shipped      | Shipping confirmation with tracking number                   |
| Order fulfilled    | Delivery confirmation                                        |
| Account registered | Welcome email + loyalty points balance                       |
| Reward redeemed    | Promo code delivery                                          |
| Password reset     | Supabase Auth handles this natively                          |

**Recommended service:** Resend (`resend.com`) or SendGrid.  
**Setup:** `pnpm add resend` → create `app/api/email/route.ts` → call from Paystack webhook and order status update handlers.

**Environment variables:**

```
RESEND_API_KEY=re_...
EMAIL_FROM=hello@haydaskinco.com
```

---

### 5.2 Newsletter Signup

**Current:** `components/newsletter-popup.tsx`, `newsletter.tsx`, `site-footer.tsx` — `handleSubmit` shows success UI only, no API call.

**Integration:** Mailchimp or Brevo (formerly Sendinblue).

```ts
// app/api/newsletter/route.ts
POST /api/newsletter  { email: string }
→ Add to Mailchimp audience list
→ Trigger welcome email with 10% discount code
```

**Environment variables:**

```
MAILCHIMP_API_KEY=...
MAILCHIMP_AUDIENCE_ID=...
MAILCHIMP_SERVER_PREFIX=us1
```

---

### 5.3 Contact & Wholesale Forms

**Current:** `components/contact-form.tsx` and `app/(storefront)/wholesale/page.tsx` — `preventDefault()` → success state only.

**Integration options:**

- Send via Resend/SendGrid to `hello@haydaskinco.com`
- OR insert into a `contact_submissions` / `wholesale_enquiries` Supabase table for admin review

---

### 5.4 WhatsApp Business

**Current:** All WhatsApp links use placeholder `+234 800 000 0000`.

**Files to update:**

- `components/whatsapp-widget.tsx` — `href`
- `app/(storefront)/contact/page.tsx` — CTA link
- `components/announcement-bar.tsx` — phone display
- `components/site-footer.tsx` — phone number

Move the number to an environment variable:

```
NEXT_PUBLIC_WHATSAPP_NUMBER=2348XXXXXXXXX
```

**Optional upgrade:** WhatsApp Business API (via Twilio or 360dialog) for automated order status messages.

---

### 5.5 Product Image Storage

**Current:** Admin product form generates `URL.createObjectURL()` blobs — these are temporary and not persisted.

**Integration:** Supabase Storage (or Cloudinary for transforms).

```ts
// In AdminProductForm handleImageUpload:
const { data } = await supabase.storage
  .from("product-images")
  .upload(`${productId}/${file.name}`, file);

const publicUrl = supabase.storage
  .from("product-images")
  .getPublicUrl(data.path).data.publicUrl;
```

**Storage bucket:** `product-images` (public read, authenticated write).

---

## Environment Variables — Full Reference

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # server-side only

# Payments
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
# NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_...  (if using Flutterwave)
# FLUTTERWAVE_SECRET_KEY=FLWSECK_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=hello@haydaskinco.com

# Newsletter
MAILCHIMP_API_KEY=...
MAILCHIMP_AUDIENCE_ID=...
MAILCHIMP_SERVER_PREFIX=us1

# WhatsApp
NEXT_PUBLIC_WHATSAPP_NUMBER=2348XXXXXXXXX

# App
NEXT_PUBLIC_SITE_URL=https://haydaskinco.com
```

---

## Suggested Implementation Order

```
Week 1  ── Supabase project setup
            ├── Auth (signUp / signIn / roles)
            ├── Products + Brands tables + seed data
            └── Replace lib/products.ts with DB queries

Week 2  ── Checkout & Orders
            ├── Paystack initialise + popup
            ├── Webhook handler (charge.success)
            ├── Orders table
            └── Transactional email (order confirmation)

Week 3  ── Customer features
            ├── Reviews (submit + display from DB)
            ├── Cart persistence (localStorage sync)
            ├── Wishlist / Favorites (DB)
            └── Account settings save

Week 4  ── Admin CRUD
            ├── Product create/update/delete
            ├── Journal create/update/delete
            ├── Deals create/update/delete
            ├── Orders status management
            └── Dashboard KPI queries

Week 5  ── Communication & content
            ├── Journals + Deals DB
            ├── Newsletter (Mailchimp)
            ├── Contact / wholesale form emails
            ├── Real WhatsApp number
            └── Image uploads (Supabase Storage)

Week 6  ── Loyalty & polish
            ├── Points ledger + earn triggers
            ├── Redeem flow + promo code generation
            ├── Rewards page live data
            └── Final QA + production deploy
```

---

_Last updated: July 2026. All UI is complete — this document tracks backend wiring only._
