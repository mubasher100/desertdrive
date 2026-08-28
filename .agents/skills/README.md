# Vendored Medusa agent skills

Copied from [medusajs/medusa-agent-skills](https://github.com/medusajs/medusa-agent-skills)
at commit `42da91a4b6e0b0133929a372b3a8ce6f1bbc879c` (vendored 2026-08-28).

Vendored, not installed as a plugin, so the exclusion below is enforced by what is
on disk rather than by remembering a flag.

## What is here

| Skill | From plugin |
|---|---|
| `building-with-medusa` | medusa-dev |
| `building-storefronts` | medusa-dev |
| `building-admin-dashboard-customizations` | medusa-dev |
| `creating-internal-agents` | medusa-dev |
| `db-generate`, `db-migrate`, `new-user` | medusa-dev |
| `storefront-best-practices` | ecommerce-storefront |
| `learning-medusa` | learn-medusa |

## What is deliberately NOT here

The upstream repo's **`medusa-cloud`** plugin — `using-medusa-cloud`, `mcloud-auth`,
`mcloud-deployments`, `mcloud-environments`, `mcloud-local`, `mcloud-logs`,
`mcloud-organizations`, `mcloud-projects`, `mcloud-variables`.

Desert Drive is fully self-hosted on Railway, Supabase and Cloudflare. See the
"no Medusa Cloud" hard constraint in the root `CLAUDE.md`. **Do not add these back.**

One upstream "next steps" line in `learning-medusa/lessons/lesson-3-admin-dashboard.md`
recommended deploying to Medusa Cloud; it has been rewritten to say Railway.

## Refreshing

Re-copy the three non-cloud plugins' `skills/` directories, then re-apply the
Cloud scrub above and update the commit SHA in this file.

`.claude/skills` is a Windows directory junction pointing here so Claude Code
discovers them; it is gitignored so the files are stored exactly once. Recreate it
with `npm run setup:skills`.
