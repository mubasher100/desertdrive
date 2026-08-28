# Desert Drive

Airport transfer booking for Qatar. Pick a destination, see a fixed fare per
vehicle class, enter flight and contact details, pay by card or cash to the
driver, get a confirmed booking. **No account, no login, ever.**

Built on Medusa v2, self-hosted across Railway, Supabase and Cloudflare.
See [CLAUDE.md](CLAUDE.md) for the full architecture, domain model and the list
of gotchas that have already been paid for once.

---

## Layout

```
desertdrive/
├── apps/
│   ├── backend/      @dd/backend    — Medusa API + Admin      → Railway
│   └── storefront/   @dd/storefront — Next.js 15 booking funnel → Cloudflare Workers
├── .agents/skills/   Vendored Medusa agent skills (no Medusa Cloud)
├── .github/workflows/
└── railway.json      MUST stay at the repo root
```

## Getting started

```bash
npm install          # installs all workspaces, links .claude/skills
```

Start a local database (production uses Supabase and Railway; this is for
development only):

```bash
docker compose up -d
```

Then configure each app:

```bash
cp apps/backend/.env.template     apps/backend/.env
cp apps/storefront/.env.template  apps/storefront/.env.local
```

Both templates document every variable, including which ones will fail silently
if you get them wrong. Read the `DATABASE_URL` block in particular — Supabase
offers three connection strings and only one of them works.

With a database reachable:

```bash
cd apps/backend
npx medusa db:migrate
npx medusa exec ./src/scripts/seed-qatar.ts   # region, currency, tax, shipping
npx medusa exec ./src/scripts/seed-fleet.ts   # fare bands, vehicles, add-ons
npx medusa user -e you@example.com -p yourpassword
```

After changing any data model, generate its migration before migrating —
skipping this does not fail the build, it fails at runtime with
`relation "..." does not exist`:

```bash
npx medusa db:generate fareBand   # module NAME, camelCase, not the directory
npx medusa db:migrate
```

`seed-qatar.ts` prints the publishable API key. Put it in
`apps/storefront/.env.local` as `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — every
Store API request is rejected without it.

Then, from the repo root:

```bash
npm run dev          # backend :9000, admin :9000/app, storefront :8000
```

## Commands

```bash
npm run dev                          # both apps
npm run backend:dev                  # backend only
npm run storefront:dev               # storefront only

npm run typecheck                    # tsc --noEmit, both apps
npm run lint
npm run test                         # backend unit tests

npm run build --workspace=@dd/backend
```

**`npm run build` at the root will fail unless the backend is running.**
`next build` statically generates pages that fetch the Store API and dies with
`ECONNREFUSED` otherwise. Use the workspace-scoped build when you only need the
backend. This is also why CI lints and typechecks the storefront rather than
building it — the real storefront build happens in the deploy workflow, pointed
at the live Railway backend.

## Two things that are not what they look like

**`next build` proves nothing about types.** `next.config.js` sets
`ignoreBuildErrors` and `ignoreDuringBuilds`, inherited from the Medusa starter.
`npm run typecheck` is what gates type safety.

**`tsc` does not gate the build either.** Next has rules TypeScript knows
nothing about — every export from a `"use server"` module must be `async`, and
`useSearchParams()` silently opts a component out of static rendering unless it
sits under a `<Suspense>`. Run the storefront build too before pushing anything
that touches a server module or a nav component.

## Deploys

`main` is always deployable. Work happens on short-lived branches merged
through PRs, with conventional commit messages.

| Target | Trigger | Config |
|---|---|---|
| Backend → Railway | `apps/backend/**` on `main` | `railway.json` **at the repo root** |
| Storefront → Cloudflare | `apps/storefront/**` on `main` | `.github/workflows/deploy-storefront.yml` |

`railway.json` lives at the root because the build must run from there for npm
workspaces to resolve. Railway stores the config path per service, so moving the
file also means updating that service setting — otherwise the deploy fails at
*Snapshot code* with a path that no longer exists.

## Contributing notes

`.agents/skills/` holds the official Medusa agent skills, with the Medusa Cloud
plugin deliberately excluded — this project is fully self-hosted. Load
`building-with-medusa` before writing backend code; the layering rules there
(module → workflow → API route → frontend) are not optional in Medusa v2.
