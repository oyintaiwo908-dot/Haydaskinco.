# HAYDA SKINCo.

Premium multi-brand skincare e-commerce for Nigeria — storefront, customer accounts, Paystack checkout, and an admin console.

**Tagline:** Hub for all your skin needs  
**Live:** [www.haydaskinco.com](https://www.haydaskinco.com)

---

## Stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database / Auth / Storage | [Supabase](https://supabase.com/) (Postgres, Auth, Storage, RLS) |
| Payments | [Paystack](https://paystack.com/) (live + test) |
| Email | [Resend](https://resend.com/) |
| Hosting | [Vercel](https://vercel.com/) |
| Package manager | [pnpm](https://pnpm.io/) |

---

## Features

### Storefront
- Shop with brands, categories, concerns, ingredients, and deals
- Product detail, related products, reviews
- Cart + favourites (guest + signed-in sync)
- Checkout with promo codes and rewards credits
- Journal, wholesale enquiry, contact, WhatsApp widget
- Account: orders, favourites, rewards, reviews, settings

### Commerce & security
- Server-side order re-pricing from DB (client prices are not trusted)
- Paystack initialize → verify + webhook with amount checks
- Stock decremented only on successful payment (fail-closed)
- Deal lines expand to component SKUs for stock
- Orders writes via service role; locked RLS on money fields
- Rewards catalog enforced in SQL (`redeem_reward(p_reward_id)`)
- Rate limits on public write APIs
- Dual cookie jars for customer vs admin sessions

### Admin
- Products, brands, deals, journals, orders, users, promos
- Role / suspension locks; admin register gated in production

---

## Getting started

### Prerequisites
- Node.js 20+
- pnpm 9+
- A Supabase project
- Paystack test keys (optional for mock checkout)
- Resend API key (optional for email)

### Install

```bash
pnpm install
cp .env.local.example .env
```

Fill in `.env` (see [Environment variables](#environment-variables)).

### Database

Apply SQL migrations in order under `supabase/migrations/` (through **032**):

1. Supabase Dashboard → SQL Editor, or  
2. Supabase CLI: `supabase db push` (if linked)

Critical hardening migrations: **026**, **027**, **029** (029 removes stock holds — decrement only on pay), **031** (closes anon RPCs, points farming, public promo listing; see [Security notes](#security-notes)), **032** (sub admins read only the last 7 days of orders; not yet run anywhere, test it on a local or staging project first). Test new migrations on a local Supabase before production.

### Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint (flat config, `eslint-config-next`) |
| `pnpm security:smoke` | HTTP security smoke tests against a running `next start` (see `scripts/security/smoke.mjs`) |

---

## Environment variables

Copy from `.env.local.example`. Never commit real secrets.

| Variable | Public? | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server only — bypasses RLS |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical origin (`http://localhost:3000` locally; live domain in prod) |
| `PAYSTACK_SECRET_KEY` | **No** | `sk_test_…` or `sk_live_…` |
| `RESEND_API_KEY` | **No** | Transactional email |
| `EMAIL_FROM` / `EMAIL_TO` | Mixed | Sender + notify inbox |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Yes | Floating chat |
| `ALLOW_ADMIN_REGISTER` | **No** | `true` only if you need `/admin/register` in prod |
| `ALLOW_MOCK_CHECKOUT` | **No** | Mock checkout only when Paystack secret is **unset**, never in production |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **No** | Shared rate-limit store. Without them limits are per server instance only |
| `NEXT_PUBLIC_SITE_HOLDING` | Yes | `1` = holding page on every storefront page until launch (build time: redeploy to change). Off when unset |
| `SITE_PREVIEW_KEY` | **No** | Team preview while holding is on: visit `/?preview=<key>` once (8+ characters) |

---

## Holding page (until launch)

Set `NEXT_PUBLIC_SITE_HOLDING=1` and redeploy. While it is on:

- every storefront page shows the holding page (logo, one line, email, WhatsApp, Instagram); the admin is unaffected
- `robots.txt` disallows everything, pages carry `noindex`, and the sitemap lists only the home page
- `/api/orders`, `/api/promo`, `/api/newsletter`, `/api/contact` and `/api/wholesale` answer `503` with a short message; the Paystack webhook and `/api/orders/verify` keep working for orders already in flight
- nothing becomes dynamic and `proxy.ts` stays admin-only: the switch is a build-time variable

**Team preview:** open any page with `?preview=<SITE_PREVIEW_KEY>`. The key is checked by `/api/preview` and the browser remembers preview mode until **Exit**. This is a convenience gate, not security: the pages are static, so the real page data is still inside each page's inline React Server Components payload (the visible HTML is the holding page), and someone who sets the browser flag by hand sees the site. Ordering stays blocked server-side either way. For a truly private preview, use a separate deploy (for example a branch deploy) built without the flag.

Turn it off by removing the variable (or setting it to `0`) and redeploying.

## Paystack (live)

Set live keys on Vercel and configure:

| Setting | Value |
|---------|--------|
| Callback (sent by app) | `https://www.haydaskinco.com/checkout/callback` |
| Webhook URL | `https://www.haydaskinco.com/api/webhooks/paystack` |

Also set:

```bash
NEXT_PUBLIC_SITE_URL=https://www.haydaskinco.com
PAYSTACK_SECRET_KEY=sk_live_…
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_…
```

Webhook signature verification uses the secret key. Keep `PAYSTACK_SECRET_KEY` server-only.

### Local mock checkout
Comment out / unset both Paystack keys in `.env`. Checkout skips Paystack and fulfills via the mock callback path (non-production only).

---

## Project structure

```
app/
  (storefront)/     # Shop, PDP, checkout, account, journal, …
  (admin)/          # Admin console
  (auth)/           # Admin login / register
  api/              # Orders, webhooks, promo, contact, newsletter, …
components/         # UI, cart, auth providers, admin editors
lib/
  supabase/         # Data access, orders, products, rewards
  email/            # Resend templates + send helpers
  paystack.ts       # Init, verify, signature helpers
  rate-limit.ts     # In-memory API rate limiting
supabase/migrations/  # Ordered SQL (001 → 030)
proxy.ts            # Auth cookie refresh + soft admin gate
```

---

## Orders & stock flow

1. Client posts cart to `POST /api/orders`
2. Server re-prices from products/deals, soft-checks stock, creates unpaid order
3. Paystack transaction is initialized (or mock redirect if keys absent)
4. Customer pays → `POST /api/orders/verify` and/or `POST /api/webhooks/paystack`
5. `complete_order_payment` marks paid, decrements stock (fail-closed), applies promos, awards points

Stock is **not** reserved at create — only validated soft at checkout and hard at payment.

---

## Deploy (Vercel)

1. Connect the GitHub repo
2. Set all production env vars (including `NEXT_PUBLIC_SITE_URL` to the live host)
3. Deploy
4. Apply any new Supabase migrations before relying on new RPCs
5. Point Paystack live webhook at `/api/webhooks/paystack`

Image Optimization is disabled (`images.unoptimized: true`) to stay within Vercel Hobby image quotas; `next/image` still renders with remote Supabase patterns.

---

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` to the client
- Production admin registration is off unless `ALLOW_ADMIN_REGISTER=true`
- Sub admins see only orders from the last 7 days (rolling window, migration 032 and `lib/order-window.ts`); full admins see everything. The status route refuses a sub admin on an older order.
- All order writes go through server routes with the service role. Since 031 the admin browser client can only read orders; status changes go through `POST /api/admin/orders/status`, which enforces this transition table (targets marked * also need `payment_status = 'paid'`):

  | From | Allowed to |
  |------|-----------|
  | pending | processing*, cancelled |
  | processing | shipped*, cancelled, refunded* |
  | shipped | fulfilled*, processing*, refunded* |
  | fulfilled | shipped*, refunded* |
  | cancelled | pending, refunded* |
  | refunded | (none) |

  Status changes do not move money or stock: refund in Paystack, and restock manually if needed.
- Checkout accepts at most **one promo code plus one rewards (`RWD-`) code** per order.
- Internal SQL functions (`decrement_product_stock`, `award_order_points`, `complete_order_payment`, …) are not callable with the anon/authenticated keys (031). Any new `security definer` function needs an explicit `revoke execute … from public, anon, authenticated` unless it is meant to be a public RPC.
- Security headers are set in `next.config.mjs`. The CSP ships as `Content-Security-Policy-Report-Only`; switch it to enforcing once production shows no violations.
- Local security checks: `supabase test db` runs `supabase/tests/*.sql` (pgTAP) and `scripts/security/supabase-probe.mjs` replays the anon-key attacks. Both must target a **local** Supabase only.

---

## Brand

| Token | Value |
|-------|--------|
| Primary | Dusty mauve `#C9B8D4` |
| Light | `#F0EBF5` |
| Text | Near black `#1A1A1A` |
| Market | Nigeria (Lagos + nationwide) |

---

## License

Private — All rights reserved. Not open source unless the owners state otherwise.
