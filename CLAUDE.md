# Desert Drive — Airport Transfer Booking Platform

**Desert Drive Rent a Car** · desertdrive.qa · Doha, Qatar
*Explore with ease* — car rentals, chauffeur service, airport pickups, day tours.

A booking platform for airport transfers in Qatar. Built on Medusa v2, deployed across Railway (backend), Supabase (database) and Cloudflare Workers (storefront), with SkipCash as the payment gateway.

The customer flow is: pick a destination → see a fixed fare per vehicle class → enter flight and contact details → pay by card or choose cash to the driver → get a confirmed booking. **No account, no login, ever.**

> ## ⛔ Hard constraint: no Medusa Cloud
>
> This project is **fully self-hosted**. Do not use, suggest, install, or configure **Medusa Cloud** in any form — no `cloud.medusajs.com`, no `mcloud-*` tooling, no Cloud-only modules or env vars. Do not install the Medusa Cloud agent skills.
>
> Everything runs on Railway, Supabase and Cloudflare. If a Medusa doc page recommends Cloud, use the self-hosted path instead.

> ## 📱 Hard constraint: mobile-first
>
> **Every page must be mobile friendly.** The primary user is standing in an airport, or sitting in a hotel abroad the night before a flight, booking on a phone over roaming or hotel wifi. This is more phone-dominated than a normal ecommerce site, not less.
>
> Design and build at the small breakpoint first, then scale up — never desktop-down.
>
> Non-negotiables: no horizontal body scroll at any width, touch targets ≥44px, the entire booking form completable one-thumbed, a sticky primary action on the results and details steps, images sized for mobile bandwidth. **Check every change at 375px before calling it done.**

> ## 🎨 Branding
>
> The logo is supplied (`apps/storefront/public/brand/`) and is **monochrome**: ink `#111518`, a cool grey `#727c7e`, white. Text and surfaces come from it. The **one accent** is the owner's call (Sept 2026): **blue, `#0a4fb3`**, in the register of the reference but deliberately not Blacklane's `#0f63bd`. White text on it clears 7.55:1, so primary buttons are white-on-blue. Navy `#0b1f3a` is the dark hero surface. Keep the accent to primary actions, selected states and small highlights.
>
> Every colour, font and spacing token lives in **one file** — `apps/storefront/src/styles/brand.css` — with Tailwind reading them as CSS variables (`dd-*` classes), so a rebrand touches one file. Never hard-code a hex value in a component. Contrast ratios are computed and recorded in that file: the logo grey is **4.29:1 on white and fails AA for body text** — use `--dd-text-muted` for running text, `--dd-grey` for icons, large text and borders only. Ink, accent and navy are declared as `rgb(var(--x-rgb) / <alpha-value>)` so Tailwind opacity modifiers (`bg-dd-navy/70`) work — against a plain hex variable they silently do nothing.
>
> Fonts (owner's choice): **Geist** for body, **Google Sans Flex** for headings — the latter self-hosted from `src/fonts/` via `next/font/local` because it is newer than `next/font/google`'s list. **IBM Plex Sans Arabic** for both roles in Arabic; switched by `:lang(ar)`.
>
> Hero photo: daytime West Bay skyline from Wikimedia Commons, CC BY 4.0, credited in the footer and `public/images/CREDITS.md`. Replace with the owner's own photography when supplied; keep the credit line only as long as the CC image is used.

> ## ⚖️ Blacklane is a reference, not a target
>
> The design reference is [Blacklane's Doha airport transfer page](https://www.blacklane.com/en/countries/qatar/doha/airport-transfer/) (owner's choice, Sept 2026 — it replaced Booking.com). Take the **structure**: booking widget in the hero, USP strip, vehicle-class cards with seats and bags, service copy, how-it-works, footer. And take the register: black/white, restrained, professional.
>
> Two deliberate departures: their "By the hour" tab is out (hourly is v2) and replaced by the **From / To airport** toggle; and we show the **fixed price** once a destination is chosen, which they don't — that is our pitch.
>
> Do **not** take their logotype, name, copy, or photography. Cloned output is a scaffold for measurement, not a site to ship. The cloner template's own README prohibits impersonation, and so does this project.

---

## Stack & hosting topology

| Concern | Technology | Hosted on | Why |
|---|---|---|---|
| Booking engine + Admin | Medusa v2.18 (Node 20+) | Railway | Long-running Node process; Railway handles build, health checks, rollback |
| Database | PostgreSQL | Supabase (Singapore, `ap-southeast-1`) | Managed Postgres with a dashboard and backups |
| Cache / events / workflows / locks | Redis | Railway | Private-network Redis beside the backend; no public egress |
| Storefront | **Next.js 15** (App Router) | Cloudflare Workers via `@opennextjs/cloudflare` | Edge delivery, cheap, global |
| Destination lookup | Google Maps Platform — Places Autocomplete (New) | — | Address entry only. **Never** used to calculate a fare |
| Payments | SkipCash | — | Qatar Central Bank licensed; required for QAR card payments |
| Email | Resend, via Medusa's notification module | — | Booking confirmations and the signed lookup link |

**Request path:** Browser → Cloudflare Worker (storefront) → Railway (Medusa Store API) → Supabase (Postgres) + Railway Redis.

**Regions.** Railway has no Middle East region. Singapore (`asia-southeast1-eqsg3a`) is its closest Asia-Pacific option, and the Supabase project must sit in the matching region so the backend is not crossing an ocean to reach its own database. This pairing is proven — it is what the sibling Flowershop project runs on after a latency migration.

**This project shares nothing with Flowershop.** Its own GitHub repo, its own Railway project, its own Supabase project, its own Cloudflare Worker and R2 bucket. Different business, different data, independently handover-able.

---

## Repo layout

Turborepo monorepo with npm workspaces (`apps/**`).

```
desertdrive/
├── apps/
│   ├── backend/          @dd/backend  — Medusa API + Admin dashboard  → Railway
│   │   ├── src/
│   │   │   ├── api/          File-based HTTP routes (admin/, store/)
│   │   │   ├── modules/      Custom modules (data models + CRUD)
│   │   │   ├── workflows/    Business logic; all mutations go here
│   │   │   ├── links/        Cross-module links
│   │   │   ├── subscribers/  Event handlers
│   │   │   ├── jobs/         Scheduled jobs
│   │   │   ├── scripts/      seed-qatar.ts, seed-fleet.ts
│   │   │   └── admin/        Admin dashboard widgets & UI routes
│   │   └── medusa-config.ts
│   └── storefront/       @dd/storefront — Next.js (Medusa starter)  → Cloudflare
├── .agents/skills/       Medusa official agent skills (no Cloud skills)
├── .claude/skills/       Symlinks into .agents/skills
├── .github/workflows/    CI + storefront deploy
├── .mcp.json             Medusa docs MCP server
├── railway.json          MUST live at the repo root — see Deploys
└── turbo.json
```

---

## Commands

Run from the repo root unless noted.

```bash
npm install                     # install all workspaces
npm run dev                     # backend :9000, admin :9000/app, storefront :8000
npm run build                   # build both apps
npm run lint
npm run test

npm run backend:dev             # backend only
npm run storefront:dev          # storefront only
```

Backend-specific (from `apps/backend/`):

```bash
npx medusa db:migrate                        # run migrations
npx medusa db:generate <ModuleName>          # generate migration after a data-model change
npx medusa user -e <email> -p <password>     # create an admin user
npm run test:unit
npm run test:integration:http

npx medusa exec ./src/scripts/seed-qatar.ts  # region, currency, tax, shipping option
npx medusa exec ./src/scripts/seed-fleet.ts  # fare bands, vehicle products, add-ons
```

**Always run `npm run build` after backend changes** — it is the fastest way to catch type errors and bad workflow composition.

---

## Medusa v2 architecture rules

These are the rules that get violated most often. The full guidance lives in `.agents/skills/building-with-medusa/` — **load that skill before writing any backend code**, and load the matching `reference/*.md` for what you're building.

**Never bypass a layer:**

```
Module (data models + CRUD only)
  ↓
Workflow (business logic, validation, rollback)
  ↓
API Route (HTTP + Zod validation, no logic)
  ↓
Frontend (via Medusa JS SDK only)
```

- **All mutations go through workflows.** Never call a module service directly from an API route.
- **Only GET, POST, DELETE.** Medusa does not use PUT or PATCH.
- **Module names are camelCase.** Dashes cause runtime errors. (This is why the fare-band module is `fareBand`, not `fare-band`.)
- **No foreign keys across modules.** Use module links in `src/links/`, then run `db:migrate`.
- **Prices are stored as-is.** A 40 QAR fare is stored as `40`, not `4000`. Never multiply or divide by 100.
- **Workflow bodies are sync, non-arrow, and branch-free.** No `async`, no `await`, no arrow functions, no conditionals — use `when()` for branching and `transform()` for any data manipulation.
- **Query with `query.graph()`** for cross-module retrieval; use `query.index()` when you need to *filter* by a linked module's fields. Never filter linked data with JavaScript `.filter()`.
- **Frontends must use the Medusa JS SDK,** never bare `fetch()` — the SDK attaches the publishable key and auth headers that the API requires.

---

## The booking domain model

This is the part with no ecommerce equivalent. Read it before touching the backend.

### Vehicle classes are products; distance bands are variants

Three products, each with a single product option named **`Distance band`**:

The real fleet (owner's WhatsApp Business catalogue, Sept 2026). Capacities are sensible defaults **to be confirmed by the owner**:

| Product | Passengers | Bags | Band A |
|---|---|---|---|
| Toyota Rush | 4 | 3 | 100 |
| Family MPV *(model tbc)* | 6 | 4 | 120 |
| Hyundai H1 | 7 | 6 | 200 |
| Toyota Hiace | 12 | 12 | 180 |
| Tesla Model 3 | 3 | 2 | 300 |

Each product has one **variant per band**. Four bands × five vehicles = 20 variants, each carrying a real QAR price. Photos live in `apps/storefront/public/fleet/<handle>.jpg`, mapped in `src/lib/data/fleet-images.ts`.

**This is the whole point of the design.** The owner changes a fare in the Medusa admin and it is live within the cache window — no code, no deploy, no migration. Do not replace this with hard-coded prices, a config file, or a custom pricing engine.

Passenger and luggage capacity live on **product metadata** and drive the results page (a booking for 5 passengers hides the Sedan).

### Distance bands are data, in a `fareBand` module

A small custom module — `fareBand` — with one model:

```
FareBand {
  code       // "A" | "B" | "C" | "D" — matches the variant's `Distance band` option value
  name_en    // "Doha & central"
  name_ar    // "الدوحة والمناطق المركزية"
  max_km     // upper bound, straight-line, from Hamad International
  rank       // evaluation order
}
```

Because `code` maps 1:1 onto the option value, resolving km → band → variant is an ordinary product query. No bespoke pricing code, no custom line-item prices.

**Starting values. Prices marked `tbc` are not yet supplied by the owner — ask before seeding.**

| Band | Straight-line km from DOH | Prices |
|---|---|---|
| A | ≤ 18.5 | the catalogue prices above |
| B | ≤ 40 | tbc |
| C | ≤ 75 | tbc |
| D | > 75 | tbc |

> The original brief's band A (Sedan 40 · SUV 65 · Minivan 80) is superseded by the catalogue. **Open question for the owner:** is the catalogue price flat regardless of destination? If so, set B–D equal to A in `seed-fleet.ts` and the band machinery simply never changes the price.

> **Band A is 18.5 km, not 20.** At 20 km, Lusail Marina (19.3 straight-line) fell
> inside band A while northern Lusail fell outside it, so two addresses a customer
> would both call "Lusail" priced differently. The owner's call was to price all of
> Lusail as band B. 18.5 rather than 18 or 19 because Education City (17.8) and
> Lusail Marina (19.3) are only 1.5 km apart — any boundary between them is tight,
> and 18.5 leaves the most room either side. Pinned in `geo.unit.spec.ts`.

> **⚠️ Haversine is straight-line distance and runs roughly 20–30% short of road distance.**
>
> The band boundaries above are expressed in **straight-line** km precisely because of this — a 25 km road trip is about 20 km as the crow flies. Before launch, calibrate every boundary against real routes: Lusail, Al Wakrah, Education City, Al Khor, Mesaieed, Dukhan, Al Zubarah. Get this wrong in the optimistic direction and every long fare is undercharged, permanently and silently.

### Availability: one car, one moment

A vehicle is not stock on a shelf — the same Rush is sellable at 06:00 and again at 14:00, but not twice at 06:00 — so Medusa's inventory module is the wrong shape. The `bookingSlot` module holds one row per vehicle per pickup, written **during checkout** (before the cart completes, and before the customer leaves for SkipCash), under a Redis lock keyed per vehicle so two simultaneous payments cannot both take the last car.

- `units` on a vehicle's product metadata says how many of that car exist. Seeded at **1**; the owner edits it in the admin.
- `BOOKING_SLOT_MINUTES` (default **120**) is how long one transfer ties a car up, either side of the pickup. `BOOKING_HOLD_MINUTES` (default **30**) is how long an unpaid hold survives.
- A hold carries `expires_at` and stops counting the moment it lapses, so an abandoned checkout frees the car immediately; `order.placed` stamps `order_id` and clears the expiry (the slot id rides on `cart.metadata.booking_slot_id`, which Medusa copies onto the order — an order has no `cart_id` column). `order.canceled` deletes the row, which is what puts the car back on sale.
- `POST /store/quotes` takes an optional `pickup_at` and returns `available` per vehicle. Unavailable cars are shown greyed out rather than hidden — a card that vanishes reads as a bug, "booked at this time" reads as a fact.

> **Both numbers above are assumptions, not the owner's stated rules.** Confirm the slot length and the real unit count per vehicle before launch.

### Add-ons

Separate single-variant products, added to the same cart: child seat, extra waiting hour, meet & greet sign, extra luggage.

### Booking details ride on metadata

There is no `Booking` table in v1. A booking **is** a Medusa order, with the trip on `cart.metadata` (carried onto the order) and anything per-vehicle on line-item metadata.

Fix these key names now, because the storefront, the confirmation email and the admin Bookings screen all have to agree:

```
cart.metadata = {
  direction,             // "arrival" | "departure"
  pickup_at,             // ISO 8601, with an explicit +03:00 offset — Qatar does not observe DST
  flight_number,         // required on arrivals, optional on departures
  passengers,
  luggage,
  place_id,              // Google Places id for the non-airport end of the trip
  address,               // formatted address as shown to the customer
  lat, lng,
  band_code,             // resolved SERVER-SIDE
  distance_km,           // resolved SERVER-SIDE
  contact_name,
  contact_phone,         // E.164
  contact_email,
  notes
}
```

### Two rules in bold

**The fare is resolved server-side, always.** A `POST /store/quotes` route takes `{ lat, lng, passengers, luggage }` and returns the resolved band plus the priced variants. The client never tells the backend which band applies, which variant to use, or what it costs — that is a price field in devtools. The client sends coordinates; the server decides everything else and re-validates on add-to-cart.

```ts
// Haversine, in the backend. R = 6371 km.
// Hamad International ≈ 25.273 N, 51.608 E — VERIFY before committing;
// every fare in the system keys off this single point.
const R = 6371
const toRad = (d: number) => (d * Math.PI) / 180
const a =
  Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
const km = 2 * R * Math.asin(Math.sqrt(a))
```

**Medusa's checkout expects a shipping method.** Nothing is being shipped, but `completeCart` will not proceed without one. Create a **zero-cost `No delivery` shipping option** on a Qatar service zone in `seed-qatar.ts` and select it silently during checkout. This is deliberate, it is load-bearing, and it must not be "cleaned up" by a later refactor. (If the vehicle products end up configured as non-shippable, verify whether it is still required before removing it — do not assume.)

---

## Store configuration

Seeded by two **idempotent** scripts in `apps/backend/src/scripts/`. Both are safe to re-run.

`seed-qatar.ts`:
- **Region:** Qatar · country code `qa` · currency **QAR** (store default)
- **Delete the starter's Europe/EUR region** — `qa` must be the only region
- **Tax region:** `qa` at 0%. Qatar has no VAT on most goods, but the region must exist or checkout cannot calculate totals
- **Fulfillment:** a Qatar service zone with the zero-cost `No delivery` shipping option
- **Sales channel + publishable API key**, linked

`seed-fleet.ts`:
- Fare bands, the three vehicle products with their band variants and prices, the add-on products

> **⛔ Never create a `src/migration-scripts/` seed.**
>
> The Medusa starter ships `initial-data-seed.ts`, which builds a European store. **Delete it.** Medusa records executed migration scripts **by filename**, and local dev runs the `.ts` while a production build runs the compiled `.js` — different names, so it re-runs on every single deploy and keeps resurrecting the Europe region. Everything goes in `src/scripts/`, invoked explicitly with `medusa exec`.

---

## The booking funnel

Five steps. Build them in this order.

**1 · Home** — the search widget is *in* the hero, not below it:
- Direction toggle: **From the airport** / **To the airport**
- The non-airport end: a **type-to-search combobox** over the curated areas (type the name in either language, or open it and browse). Google Places layers on top of this later; it never replaces it. Free text that matches nothing offers WhatsApp with what they typed rather than an error.
- Date, time, passengers — bounded by the **lead time**: a pickup must be at least `NEXT_PUBLIC_MIN_LEAD_MINUTES` (default **180**) away. Checked in the widget, again on the results page (a page can sit open for an hour), and finally server-side before a cart is created. A time in the past and a time inside the window get different words: one is a mistake, the other is a booking we would still like by phone.
- Trust strip (licensed drivers, flight tracking, free waiting, fixed price)
- Service cards, how-it-works, fleet, FAQ

**2 · Results** — the three vehicle classes valid for the resolved band and passenger count. Price, capacity, bags, what's included. Cheapest first. The fare shown here is the fare charged — say so explicitly on the page.

**3 · Details** — flight number (required on arrivals, optional on departures), contact name / phone / email, pickup notes, add-ons.

**4 · Payment** — the customer chooses:
- **Card now**, via SkipCash
- **Cash to the driver** — creates a confirmed order with a pending payment

Both paths confirm **instantly**. There is no ops-accept step; the owner manages capacity by hand and commits to every booking taken.

**5 · Confirmed** — full booking summary, reference `DD-{display_id}`, add-to-calendar, WhatsApp contact.

### Booking lookup without an account

The confirmation email carries a **signed link** back to the confirmation page: an HMAC of the order id using `BOOKING_TOKEN_SECRET`. Unguessable, no password, no account.

This matters more than it looks. A booking holds a phone number, a flight number and a home address. A short reference like `DD-4821` plus a phone number would be brute-forceable; a signed token is not.

### Pages that are launch blockers, not filler

**Terms & Conditions · Cancellation & Refund policy · Privacy policy · Contact.**

SkipCash merchant onboarding and the card schemes expect a publicly visible refund policy. Treat these as part of shipping, not as content to add later.

---

## Google Maps integration

Places Autocomplete (New) on the destination field, restricted to `country: 'qa'`. Address entry only — **it never calculates a fare**.

**Session tokens are a billing mechanism, not an optimisation.** One token per autocomplete-then-select cycle:

- Autocomplete requests within a session that ends in a Place Details call are billed as one session rather than per keystroke.
- **Reusing a token across multiple Place Details calls invalidates the session** and reverts every autocomplete request in it to per-request billing.
- Ending a session with a **Place Details Essentials (IDs only)** call has the same effect — because that request isn't charged, all the autocompletes fall back to per-request pricing. Request the fields you actually need (`location`, `formattedAddress`, `id`).

See [Autocomplete and session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing).

**Restrict the key.** The browser key is public by necessity. Restrict it by **HTTP referrer** and to the **Places API only**. If server-side Google calls are ever added, issue a separate IP-restricted key — never reuse the browser one.

**The funnel must survive Google failing to load.** A blocked, throttled or slow Maps script must not take down the only revenue path on the site. Fall back to a curated `<select>` of Qatar areas, each pre-tagged with a band code, and keep it in the codebase as a first-class path — not a stub. Test it by blocking `maps.googleapis.com` in devtools.

---

## Localization (English + Arabic)

**Locale lives in the URL,** as the first path segment carrying language *and* country: `/en-qa/...`, `/ar-qa/...`. Not a cookie — prerendered pages cannot read one during static generation, so every cached page would ship the default language. In the URL each locale gets its own prerendered variant and the cache still works. A bare country (`/qa/...`) redirects to the default locale rather than 404ing.

Put parsing in one module (`src/lib/util/locale.ts`): `parseSegment`, `buildSegment`, `countryOf`, `localeOf`, `isRtl`, `segmentsFor`, `alternatesFor`. **Anything talking to the Store API wants `countryOf(segment)`, never the raw segment.**

**Strings** live in `src/lib/i18n/dictionary.ts`, keyed by a flat dot-namespaced string. Server components call `getTranslations(segment)` with the segment passed down from the locale layout; client components call `useTranslations()`, which reads the segment from `useParams`. No provider, no context — the segment is already in the URL that rendered the page. Missing keys fall back to English rather than rendering a raw key.

**Translate the catalogue too.** Three vehicle names, four band names and a handful of area names is a short fixed list — translate it properly, in `name_ar` fields on the models. Interface copy and content copy are both in scope.

Exception: **form values the driver reads off the booking stay English** — area names on the printed job sheet, time windows. The driver reads them aloud at 4am.

### Four things that will bite

- **`lang` and `dir` must be set twice, on purpose.** An inline script in the root layout sets them before first paint (the root layout gets no route params, and an effect would flash the wrong direction). A `DirectionSync` component in the locale layout then keeps them in step on client-side navigation — the inline script runs once per document load, so without it a language switch re-renders in Arabic while the page stays `dir="ltr"`. Browser back/forward hits the same path, so a hard-navigating switcher would not cover it either.
- **Tailwind's logical properties (`ps/pe`, `ms/me`, `start/end`) mirror off `dir` automatically. Its transform utilities do not.** `-translate-x-full` is physical — a side menu will sit correctly on the right in Arabic and still fly in from the left until you flip the sign explicitly.
- **Arabic wording should follow conventional Gulf usage**, not literal translation of the English. Look at how [Floward](https://floward.com/ar-qa) and local transport sites phrase things.
- **Arabic numerals:** use Western digits (`40 ر.ق`) for prices and times. Eastern Arabic numerals are correct but unconventional in Qatari e-commerce and read as unfamiliar.

> Any Arabic copy written without a native reviewer must be checked before launch. Say so, don't quietly ship it.

---

## Caching & performance

Three layers, all configured in `apps/storefront/open-next.config.ts`:

| Layer | What it does |
|---|---|
| R2 incremental cache | Persistent store for prerendered pages and fetch results. Without it every Worker isolate re-renders from scratch |
| `withRegionalCache` | Cloudflare Cache API in front of R2, per datacentre. R2 is a network round trip |
| `enableCacheInterception` | Serves a prerendered page without booting the full Next.js server. Safe only because the site does not use PPR |
| `doShardedTagCache` | Sharded Durable Objects, SQLite-backed. **This is what makes `revalidateTag` do anything** |

Baseline configuration:

```ts
incrementalCache: withRegionalCache(r2IncrementalCache, {
  mode: "long-lived",
  bypassTagCacheOnCacheHit: true,
}),
tagCache: doShardedTagCache({
  baseShardSize: 4,
  regionalCache: true,
  regionalCacheTtlSec: 30,
}),
enableCacheInterception: true,
```

**The tag cache is not optional and it is not free.** OpenNext's `tagCache` defaults to `"dummy"`, which silently discards every tag — you can post to a revalidation endpoint forever and invalidate nothing. But adding a real one puts a Durable Object round trip on every request.

The resolution is `bypassTagCacheOnCacheHit: true`. A regionally cached page is served without asking whether it is still valid; when the entry expires, the next request goes to R2, and *that* path consults the tag cache. The guarantee is **"an admin fare change is live within the cache window"**, not "on the next request". Cloudflare's tag-based purge would give both, but it needs a zone on an Enterprise plan.

Two settings that look harmless and are not:
- `regionalCacheTtlSec` on the tag cache defaults to **5s**. At this site's traffic most requests arrive further apart than that, so the lookup expires before it is ever reused and every request pays the round trip anyway. 30s is the trade.
- **`bypassTagCacheOnCacheHit` must stay `false` on Next 16+,** where `revalidateTag` is stale-while-revalidate by default. It is only safe here because the storefront is on **Next 15** — which is exactly why the cloner template's Next 16 output must not become the app.

> ## 🚫 Never cache a quote or a cart.
>
> The `/store/quotes` response, `retrieveCart` and `listCartShippingMethods` must be **`no-store`**. A fare quote is tied to one person's coordinates and one person's passenger count; a cart belongs to one visitor and changes on every interaction. There is nothing to win and correctness — and privacy — to lose.
>
> Do not "optimise" this later with a per-visitor cache tag. That pattern breaks silently the moment `bypassTagCacheOnCacheHit` is set, because a regional hit no longer consults the tag cache at all.

**Don't read cookies in cached code paths.** Reading them during render forces the route out of static rendering, which stops the incremental cache serving the page at all. Keep two helpers — `getCacheOptions` (per-visitor tag, for cart and order) and `getPublicCacheOptions` (no cookie read, for marketing pages and the fleet). Marketing pages cache hard; the funnel does not cache at all.

---

## Using the AI website cloner

[`ai-website-cloner-template`](https://github.com/JCodesMore/ai-website-cloner-template) is a design-extraction tool for this project, and **nothing else**.

- **Run it in a throwaway sibling directory.** Never inside this repo, never as a workspace.
- **It emits Next.js 16 + Tailwind v4 + shadcn/ui.** This storefront is **Next 15 + Tailwind 3** on the Medusa starter. Do not merge its app skeleton — see the `bypassTagCacheOnCacheHit` note above for why the Next version is not negotiable, and note that adopting its skeleton means rewriting the cart, checkout and order plumbing the Medusa starter provides.
- **Harvest `docs/research/`** — extracted design tokens, measured CSS values, layout and component specs — and hand-build those components into the starter with Desert Drive's own tokens.
- Reference target is the Booking.com airport-taxi funnel. **Take structure, not identity.**

---

## Accessibility & web standards

Target: **WCAG 2.1 level AA**, plus valid markup, a custom 404, working redirects and basic SEO hygiene.

Audit with axe-core across home, results, details, payment and confirmation × both locales × 375px and 1280px. Aim for **zero violations** and re-run after any significant UI change.

Traps worth not walking into:

- **Verify every text-carrying token's contrast ratio and record the numbers in `brand.css`.** Mid-tones that look best usually fail AA. On a sand/desert palette this is a live risk — light warm tones on white are frequently around 3:1. Nothing under 4.5:1 may carry body text.
- **A `role` on a `<ul>` replaces its implicit `list` role,** orphaning every `<li>` inside it. `role="list"` is the one you want when adding `tabindex` to a scrolling rail.
- **Radix renders `Accordion.Header` as `h3`.** Under an `h1` that skips a level; pass `asChild` and supply your own `h2`.
- **Cards take their heading level from context** — `h2` under a page heading, `h3` under a rail. Don't hardcode it.
- The skip link is `sr-only` until focused, so automated tap-target checks flag it at 1px. That is correct — exclude visually-hidden controls from those checks.
- **The date/time picker and the Places autocomplete listbox are where booking funnels fail audits.** They must be fully keyboard-operable, expose `role="combobox"` / `aria-expanded` / `aria-activedescendant` correctly, and announce the result count. Google's `PlaceAutocompleteElement` handles much of this; a hand-rolled dropdown around the suggestions API does not. Test both with a screen reader, not just axe.

**Payment and confirmation pages are `noindex`** — no canonical, no hreflang. The confirmation page holds personal data behind a signed token and must never be indexed.

**Catch unmatched paths inside the locale** with `[countryCode]/(main)/[...notFound]` calling `notFound()`. Without it they fall through to the root not-found, which renders outside `[countryCode]` — so an Arabic visitor gets an English 404 on a bare page with no way back.

---

## Environment & secrets

`.env` files are **never committed**. `.env.template` documents every variable and is committed.

### Backend (`apps/backend/.env` locally · Railway variables in production)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres — **session pooler**, see gotchas |
| `REDIS_URL` | Railway Redis private URL; drives cache, events, workflows, locks |
| `JWT_SECRET` / `COOKIE_SECRET` | Generate real secrets. Never ship the starter defaults |
| `STORE_CORS` | Storefront origins allowed to call the Store API |
| `ADMIN_CORS` | Admin dashboard origins |
| `AUTH_CORS` | Origins allowed to hit auth endpoints |
| `MEDUSA_BACKEND_URL` | Public backend URL; used by the admin build |
| `MEDUSA_WORKER_MODE` | `shared` for now; split to `server` + `worker` when traffic warrants |
| `RESEND_API_KEY` | Confirmation email |
| `RESEND_FROM_EMAIL` | Verified sender |
| `BOOKING_TOKEN_SECRET` | HMAC secret for the signed booking-lookup link. **Set the same value on the storefront** — the backend signs the email link, the storefront verifies it |
| `BOOKING_SLOT_MINUTES` | How long one transfer occupies a vehicle, either side of the pickup. Default 120 |
| `BOOKING_HOLD_MINUTES` | How long an unpaid checkout holds a car. Default 30 |
| `BUSINESS_ADDRESS` / `BUSINESS_CR` | Trader identity printed in the confirmation email |
| `AIRPORT_LAT` / `AIRPORT_LNG` | Hamad International origin point for the distance calculation |
| `SKIPCASH_CLIENT_ID` · `SKIPCASH_KEY_ID` · `SKIPCASH_KEY_SECRET` · `SKIPCASH_WEBHOOK_KEY` · `SKIPCASH_BASE_URL` | Payment gateway |

### Storefront (`apps/storefront/.env.local` · Cloudflare Worker vars in production)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Railway backend URL |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | From Admin → Settings → API Key Management. **Store API requests fail without it** |
| `NEXT_PUBLIC_BASE_URL` | Storefront's own public URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Places Autocomplete. Referrer-restricted, Places API only |
| `BOOKING_TOKEN_SECRET` | Same value as the backend's. Server-side only, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_MIN_LEAD_MINUTES` | Minimum notice for a pickup. Default 180 |

### GitHub Actions secrets

`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## Git & CI workflow

`main` is always deployable. All work happens on short-lived branches merged through PRs.

```
feat/…    new functionality
fix/…     bug fixes
chore/…   tooling, deps, config
docs/…    documentation
```

**Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

**Commit early and often.** Land a commit before starting any significant phase of work, so there is always a clean point to roll back to. Push to `origin` at those boundaries rather than batching a week of work into one commit.

**CI** (`.github/workflows/ci.yml`) runs on every PR and push to `main`, as three parallel jobs:

| Job | What it does |
|---|---|
| Lint & typecheck | `npm run lint`, then `tsc --noEmit` on both apps |
| Build backend | `medusa build` with placeholder env vars |
| Backend tests | unit + HTTP integration against throwaway Postgres and Redis containers |

CI never touches Supabase. **CI deliberately does not build the storefront** — see the gotcha about `next build` needing a live backend. It lints and typechecks it instead.

> GitHub gates branch protection and rulesets behind Pro for private repos. If this repo is private on the Free plan, `main` is protected by convention only. Upgrade to Pro (~$4/mo) or make the repo public if mechanical protection is wanted.

**Deploys:**
- Backend → Railway, watching `apps/backend/**` on `main`. **Railway has deprecated `railway.json` config-as-code** (Sept 2026, in favour of `.railway/railway.ts`); the API refuses to set `railwayConfigFile`. The settings are therefore stored **on the service itself** (Settings → Build/Deploy), set via the API on 2026-09-19: root directory `/`, build `npm run build --workspace=@dd/backend`, start `cd apps/backend/.medusa/server && npm run start`, pre-deploy `cd apps/backend/.medusa/server && npx medusa db:migrate`, health `/health`, region `sin`, `PORT=9000`. The `railway.json` in the repo documents the intended shape but is not read.
- Storefront → `.github/workflows/deploy-storefront.yml`, watching `apps/storefront/**` on `main`. It also pushes `BOOKING_TOKEN_SECRET` to the Worker, so the GitHub secret is the source of truth for the storefront side.

**Deploying the storefront from Windows.** wrangler ≥4.12 auto-delegates `wrangler deploy` to `opennextjs-cloudflare deploy`, whose "populate remote R2 cache" step starts a local proxy Worker that fails on Windows (`Failed to send request to R2 worker: fetch failed`, retried forever). Set `OPEN_NEXT_DEPLOY=true` to skip the delegation and do a plain upload; the R2 cache then fills on first request. CI runs on Linux where the populate step works, so prefer CI for real deploys.

`railway.json` shape:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build --workspace=@dd/backend",
    "watchPatterns": ["apps/backend/**", "package.json", "package-lock.json", "railway.json"]
  },
  "deploy": {
    "region": "asia-southeast1-eqsg3a",
    "startCommand": "cd apps/backend/.medusa/server && npm run start",
    "preDeployCommand": "cd apps/backend/.medusa/server && npx medusa db:migrate",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Set `region` **in this file**, not the dashboard: `railway.json` is authoritative once `railwayConfigFile` is set, so a dashboard region is reset to the default on the next deploy.

### Live environment

Fill in as each piece goes live. **Ship on `workers.dev` first** — nothing in the build depends on the custom domain except CORS and canonical URLs, both single-variable changes.

| | |
|---|---|
| Backend API | `https://ddbackend-production-e9d1.up.railway.app` ✅ live |
| Admin | `https://ddbackend-production-e9d1.up.railway.app/app` ✅ live |
| Storefront | `https://desertdrive.officialyuvraj24.workers.dev` ✅ live (deployed 2026-09-20) → later `https://desertdriverental.com` |
| Railway project | `trustworthy-miracle`, Singapore — services `@dd/backend` (+ Redis with a `/data` volume, `redis.railway.internal`) |
| Cloudflare | account `officialyuvraj24@gmail.com`; R2 bucket `desertdrive-cache` ✅; Worker `desertdrive` ✅ |
| Database | Supabase `desertdrive` (`nlkicwkeqadkooumeavr`), **session pooler**, Singapore ✅ migrated + seeded |

Adding a new storefront origin means updating **`STORE_CORS` and `AUTH_CORS` on Railway**, not just Cloudflare.

---

## Gotchas

Every one of these was paid for once already on a sibling project. None are hypothetical.

**Supabase connection string — this one bites silently.** Supabase offers three connection strings. Use the **session pooler on port 5432**:

- ❌ *Direct* (5432) — IPv6-only, may be unreachable from Railway
- ✅ **Session pooler (5432)** — IPv4, holds a session, prepared statements work
- ❌ *Transaction pooler (6543)* — breaks MikroORM. Prepared statements don't survive connection swaps, and migrations fail

A wrong port does not fail at boot. It surfaces later as intermittent `prepared statement "s1" does not exist` errors under load.

**Don't put `?sslmode=require` in `DATABASE_URL`.** node-postgres treats it as `verify-full` and rejects Supabase's certificate chain with `SELF_SIGNED_CERT_IN_CHAIN`. Configure TLS via `databaseDriverOptions` in `medusa-config.ts` instead.

**Railway does not shell-expand `$VAR` in a start command.** `redis-server --requirepass $REDIS_PASSWORD` sets the password to that literal string and the backend fails with `WRONGPASS invalid username-password pair`. Write the password out literally. `${{service.VAR}}` references *between* services do resolve — that syntax is Railway's own, evaluated before the container starts.

**Redis must be wired into all four modules** — cache, event bus, workflow engine, and locking. Miss one and Medusa silently falls back to in-memory, which breaks scheduled jobs, subscribers, and long-running workflows across restarts.

**An admin password cannot be reset by email until email is configured.** Medusa's reset route emails a signed token, which is useless on a system with no mail provider — and that is exactly when you are locked out. `npx medusa exec ./src/scripts/set-admin-password.ts <email> <password>` goes at the emailpass provider directly. Against production, run it with the production `DATABASE_URL` and `ALLOW_INMEMORY_INFRA=true`.

**The publishable API key is not optional.** Store API requests without `x-publishable-api-key` are rejected. The key must also be linked to a sales channel.

**CORS is three separate variables.** `STORE_CORS`, `ADMIN_CORS` and `AUTH_CORS` are distinct. Adding a new storefront origin usually means updating `STORE_CORS` *and* `AUTH_CORS`.

**Backend test scripts use POSIX env-prefix syntax** (`TEST_TYPE=… jest`). They work in Git Bash and CI, but **not in PowerShell or cmd** — relevant, since this is a Windows machine.

**The storefront cannot build without a running backend.** `next build` statically generates pages that fetch the Store API and dies with `ECONNREFUSED` otherwise. Consequences: `npm run build` at the repo root fails unless the backend is up (use `npm run build --workspace=@dd/backend` when you only need the backend), and CI lints and typechecks the storefront instead of building it. The real build happens in the deploy workflow, pointed at the live Railway backend.

**`SKIP_ENV_VALIDATION=true` bypasses the storefront's env check.** `next.config.js` demands a publishable key, and it is loaded by `next lint` too — not just `dev`/`build`. Lint sets this flag; nothing else should.

**Turbo runs in strict env mode.** Environment variables are not passed through to tasks unless declared in `turbo.json` (`globalPassThroughEnv`, or a task's `env` array). A var that works in your shell but is empty inside a turbo task is a missing declaration, not a shell problem.

**`medusa build` emits a standalone app into `.medusa/server`** — with its own `package.json`. That directory is what runs in production. Starting from `apps/backend` fails with `Could not find index.html in the admin build directory`.

**`medusa start` forces `NODE_ENV=production`,** even locally. If `medusa-config.ts` guards against a missing Redis in production, running a production build on a dev machine needs `ALLOW_INMEMORY_INFRA=true`. **Never set that on Railway** — it disables the guard that stops a Redis-less deploy.

**`next build` skips type and lint checks** (`ignoreBuildErrors` / `ignoreDuringBuilds` in `next.config.js`). A green build proves nothing about types. `npx tsc --noEmit` is what gates storefront type safety.

**The reverse is also true: `tsc` does not gate the build.** Next has rules TypeScript knows nothing about:
- Every export from a `"use server"` module is a Server Action and must be `async`. A synchronous helper next to a fetch fails with *"Server Actions must be async functions"*. Keep pure helpers in a separate module.
- `useSearchParams()` opts a component out of static rendering unless it is under a `<Suspense>` boundary. In a nav component, that silently stops every page prerendering.

Run `npm run build` in `apps/storefront`, not just `tsc`, before pushing anything touching a server module or a nav component.

**Railway's `railwayConfigFile` is a stored per-service path.** Moving `railway.json` in the repo does **not** update it — the deploy fails at *Snapshot code* with `service config at '<old path>' not found`. Update the service setting too.

**Google Places session tokens are billing-critical** — see the Google Maps section. Reusing a token, or closing a session with an Essentials/IDs-only Place Details call, silently reverts every autocomplete keystroke to per-request pricing.

**The `No delivery` shipping option is load-bearing.** It exists because Medusa's checkout will not complete without a shipping method. It is not dead code.

---

## Roadmap

| # | Phase | Status |
|---|---|---|
| 0 | Repo scaffold — Turborepo, both apps, Medusa agent skills, docs MCP | ✅ Done |
| 1 | Supabase + Railway + Redis; backend live | ✅ Done — live, migrated, seeded |
| 2 | Cloudflare Worker + R2; storefront live on `workers.dev` | ✅ Done — live on `workers.dev`; CI deploys on push once `CLOUDFLARE_API_TOKEN` is in GitHub secrets |
| 3 | Branding — palette from the logo, fonts, vehicle photography | 🟡 Palette, fonts, brand.css done; photography pending |
| 4 | Fare bands + fleet products + seed scripts | 🟡 Built; blocked on band B/C/D prices |
| 5 | Booking funnel — search widget, results, details | ✅ Done — all five steps, both languages |
| 6 | Google Places + server-side band resolution | 🟡 Band resolution done (`POST /store/quotes`); Places pending |
| 7 | Checkout — SkipCash card + cash-to-driver | ✅ Done — both paths verified against the SkipCash sandbox incl. 3DS |
| 8 | Confirmation email + signed-token lookup | ✅ Done — SMTP provider (works with the Outlook mailbox), EN + AR templates, verified with a local mail catcher |
| 9 | Admin Bookings screen | ✅ Done — `Bookings` page (job sheet by pickup time) + Booking card on every order with *Mark cash collected* |
| 10 | Arabic / RTL | 🟡 Locale routing, dictionary, RTL, fonts done; native review pending |
| 11 | Accessibility audit — target zero axe violations | ✅ 0 violations (axe-core, 7 pages × en/ar × 375/1280, 2026-09-21); re-run after UI changes |
| 12 | Legal pages, SEO, custom domain | 🟡 Pages exist (privacy written; terms + cancellation are structural drafts awaiting the owner's terms); consent + trader identity done (see *Legal compliance*); domain pending |
| 13 | Later: hourly chauffeur, day tours, self-drive rental | 🔒 Later |

### Legal compliance (Qatar)

What the site does to meet the laws that actually apply to it — Qatar has no COPPA, CAN-SPAM, auto-renewal or DMCA equivalents, and the site has no accounts, analytics, marketing email or subscriptions, so those checklists do not apply. What does:

| Law | Requirement | Where it is met |
|---|---|---|
| E-Commerce Law No. 16 of 2010 | Terms available and accepted before the contract; trader name, registration and address shown before contracting and on the confirmation | Consent checkbox on `/payment` (`payment-chooser`), recorded as `terms_accepted_at` + `terms_version` on the order; footer, `/contact` and the email footer print name · CR · address from `CONTACT` / `BUSINESS_*` |
| Personal Data Privacy Protection Law No. 13 of 2016 | Consent to processing; purpose, recipients and retention disclosed; access/erasure route | Same checkbox covers the privacy policy; `/privacy` is written from what the system actually does; erasure by email |
| Civil Code (capacity at 18) | Contract with an adult | The consent line includes "I confirm I am 18 or older" |
| Consumer Protection Law No. 8 of 2008 | Price shown is the price charged; no hidden fees | Results page says so explicitly; tax region is 0% |
| Copyright Law No. 7 of 2002 | Licensed imagery | CC-licensed photos credited on `/credits` until the owner's own photography replaces them |

Fonts are self-hosted by `next/font` (no request to Google at runtime — verified: the live page references only its own origin and `wa.me`). No analytics, session replay or tracking cookies exist; the one cookie is the two-hour booking cart. Bump `TERMS_VERSION` in `src/lib/data/booking.ts` when the legal pages change materially.

### SkipCash notes

Custom payment provider at `apps/backend/src/modules/skipcash/`, extending `AbstractPaymentProvider`, registered under the `@medusajs/medusa/payment` module's `providers` array in `medusa-config.ts`.

Methods to implement: `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `cancelPayment`, `getPaymentStatus`, `getWebhookActionAndData`.

API surface, **verified against the sandbox** (a real payment was created, paid through 3-D Secure, and confirmed) and taken from SkipCash's own first-party Magento module, not third-party packages:

- Sandbox `https://skipcashtest.azurewebsites.net` · Production `https://api.skipcash.app`
- `POST /api/v1/payments` — `Authorization: base64(HMAC-SHA256(plaintext, KeySecret))` where plaintext is `Uid=…,KeyId=…,Amount=…,FirstName=…,LastName=…,Phone=…,Email=…,[Street,City,State,Country,PostalCode,]TransactionId=…,Custom1=…` — non-empty fields only, in that order; `returnUrl`/`webhookUrl` go in the body but are **not** signed. Amount is `"40.00"`.
- `GET /api/v1/payments/{id}` — `Authorization: <ClientId>` (the client id, not a signature — a different scheme, returns a bare 403 if wrong).
- Status ids: 0 new · 1 pending · **2 paid** · 3 cancelled · 4 failed · 5 rejected · 6–8 refund states.
- Webhook → `/hooks/payment/skipcash_skipcash`, signed with the Webhook Key over `PaymentId,Amount,StatusId,TransactionId,Custom1,VisaId`. Our provider verifies it (SkipCash's own Magento module does not) **and still asks SkipCash's API before marking anything paid** — a forged-but-signed webhook cannot mark a failed payment as paid.
- The Medusa payment session id rides on `Custom1`; that is how the webhook finds its session.
- Refunds: not implemented against the API (endpoint unverified). Issued from the merchant portal.

Sandbox test cards are at https://dev.skipcash.app/doc/test-cases/ — the 3DS challenge prints its OTP on the page.

**Portal settings still to make once the backend is on Railway:** Webhook URL = `<MEDUSA_BACKEND_URL>/hooks/payment/skipcash_skipcash`. The Return URL is set per payment by the storefront.

The cash-to-driver path is not a payment provider. It is the manual provider (`pp_system_default`) with the order marked as awaiting cash, and a way for the owner to mark it collected in the admin.

---

## Deliberately out of scope for v1

Do not build these without asking. Each was considered and cut:

- **Customer accounts / login** — the whole point is booking an airport pickup in ninety seconds on a phone
- **Self-drive car rental** — a different product entirely: per-unit availability calendar, driving licence and passport upload, security deposit hold, insurance tiers, mileage limits, damage terms
- **Hourly / daily chauffeur booking** — priced on duration, not distance; a second pricing axis
- **Day tour booking** — marketing page only in v1
- **WhatsApp or SMS dispatch** — WhatsApp Business API needs Meta approval; admin dashboard only for now
- **Live fare calculation, Distance Matrix, surge, or traffic-aware pricing** — fares are fixed per band, full stop
- **Multi-stop trips, return legs as a single booking, recurring transfers**
- **Loyalty or a promotions engine** beyond what Medusa provides for free

---

## Needs input before you get far

Ask the owner. Several of these block real work:

1. **Band prices for B, C and D** — or confirmation that the catalogue price is flat. Band A is the catalogue (Rush 100 · MPV 120 · Hiace 180 · H1 200 · Tesla 300). Until these land, **15 of the 38 listed destinations cannot be booked online** — all of Lusail, Al Rayyan, Al Khor and Dukhan among them. They fall back to a WhatsApp quote, which is honest but is not a booking.
2. **Hamad International coordinates** — approximately `25.273 N, 51.608 E`. **Verify precisely before committing.** Every fare in the system keys off this one point.
3. **Fleet detail** — the 120 QAR vehicle's make/model, real passenger and luggage capacities for all five, and photography (`public/fleet/<handle>.jpg`). Also **how many of each vehicle exist** (`units` on product metadata, seeded at 1): it is what the availability guard counts, so too low turns customers away and too high double-books a driver.
4. ~~Logo and brand colours~~ — supplied and sampled. Still wanted: an SVG or transparent original, and a mark-only version.
5. **Contact details** — phone/WhatsApp `+974 5151 4161` ✅ (2026-09-21). Still needed: the commercial registration number and the registered address (`CONTACT.cr`, `CONTACT.address` in `src/lib/data/contact.ts`; `BUSINESS_CR`, `BUSINESS_ADDRESS` on Railway).
6. **Domain** — the live domain is `desertdriverental.com` (Namecheap, DNS on Cloudflare in the `officialyuvraj24@gmail.com` account). `desertdrive.qa` is unregistered and still an option: a plain `.qa` needs **no** Qatari commercial registration (only `.com.qa` does), but must be bought through a Qatar-accredited registrar or reseller.
7. ~~SkipCash credentials~~ — sandbox supplied and working. Production keys go straight into Railway variables when the owner is ready.
8. **Cancellation and refund policy** — the actual terms, from the owner. Required for SkipCash onboarding, and it cannot be invented. The terms and cancellation pages currently show six bracketed `[Owner: …]` gaps each, live, while customers are asked to tick "I have read and agree".
9. **Minimum notice for a booking** — currently defaulted to **3 hours** (`NEXT_PUBLIC_MIN_LEAD_MINUTES`). Anything sooner is sent to WhatsApp.
10. **How long one transfer occupies a vehicle** — defaulted to **120 minutes** either side of the pickup (`BOOKING_SLOT_MINUTES`). It decides when the same car can be sold again.
11. **Production SkipCash keys and an SMTP sender.** Until both land the site cannot take real money and sends no confirmation email — see the launch-readiness audit.
