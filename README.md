# PawHeaven

PawHeaven is an Astro and Cloudflare Workers monorepo for a public shelter site and an API backed by Supabase. The current connected feature is pet browsing. Adoption applications are planned for a later phase.

| Workspace | Purpose | Local URL |
| --- | --- | --- |
| `apps/web` | Public Astro site | `http://localhost:4321` |
| `apps/api` | API Worker | `http://localhost:8787/api` |
| `packages/contracts` | Shared API types | — |
| `supabase` | Database migration and local Supabase config | — |

The API uses the provided Supabase project URL and **publishable** key in `apps/api/wrangler.jsonc`. Those values are safe for client use but grant only what database and Storage policies allow. No secret or service-role key belongs in the Worker or either Astro site. User sessions are kept in API-host `HttpOnly` cookies; the API uses each user's token when querying Supabase.

## First-time setup

Use Node.js 22.12 or newer. From this repository root:

```sh
npm install
```

The application database is local by default. Start it before the API when working on database-backed features:

```sh
npm run db:start
npm run db:reset
npm run db:configure-api
```

The `db:reset` command explicitly targets the local database and replays every committed migration. Do not run `supabase link`, `supabase db push`, `supabase db reset --linked`, or use the hosted SQL/Table Editor for schema changes on a contributor checkout. The initial schema creates `public.pets` and a public `pet-images` Storage bucket. Public photo URLs are intentionally viewable by anyone who has the URL; do not use this bucket for private documents.

Start these in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

The public app already has an ignored local `.env` pointing at port 8787. For a fresh checkout, copy `apps/web/.env.example` to `apps/web/.env`.

The public site retains clearly labeled sample pets if the API is unavailable. With an empty real `pets` table, the API returns an empty list.

If **Confirm Email** is enabled in Supabase Auth, new users receive a confirmation email and then log in. The hosted project's Auth **Site URL** is `https://pawheaven.online` (set on 2026-10-05); this controls the default destination in new confirmation emails. Keep it set under Authentication → URL Configuration when changing domains. The local `supabase/config.toml` uses a localhost URL for local Supabase development and does not set the hosted project's URL. If confirmation is disabled, registration starts a session immediately.

## Deploying the Workers

Build and check locally:

```sh
npm run check
npm run workers:deploy:dry-run -w @pawheaven/web
```

On `workers.dev`, the deployed public site derives and calls the matching API Worker URL directly. For a custom-domain deployment, set `PUBLIC_API_BASE_URL=https://api.pawheaven.online/api` in the Astro build environment. Astro's local development server uses `PUBLIC_API_BASE_URL` from `apps/web/.env` (normally `http://localhost:8787/api`).

The API allowlist includes the two public custom-domain origins and the production/Preview `pawheaven-frontend` hosts under the configured `WORKERS_DEV_SUBDOMAIN`. Keep the custom origins and Workers subdomain in `apps/api/wrangler.jsonc` aligned with the domains in the Cloudflare dashboard. Then build and deploy each Worker:

```sh
npm run workers:deploy -w @pawheaven/api
npm run workers:deploy -w @pawheaven/web
```

Attach each Worker to its custom domain in Cloudflare. The API remains available directly to its allowlisted origins. Use the custom domains for account flows: browser third-party-cookie rules can prevent reliable session cookies between two separate `workers.dev` hostnames, even though CORS and public API calls work. Set the Supabase Auth site URL to the public domain and allow its confirmation redirects. After changing the API allowlist, redeploy `apps/api`; after changing the public API URL, rebuild and deploy `apps/web`.

## Branch and pull-request previews

Use **Worker Previews**, not generic Version URLs, for a branch or pull request. A generic URL such as `abc123-pawheaven-frontend...workers.dev` cannot be paired with an API Version URL because each Worker gets its own unrelated version prefix.

For both Workers Builds projects, set the **root directory** to its app folder (`apps/web` or `apps/api`). This is required: otherwise `npx wrangler preview` runs from the repository root, does not find either `wrangler.jsonc`, and fails with a missing `previews` block error.

| Worker | Root directory | Build command | Production deploy command | Preview command |
| --- | --- | --- | --- | --- |
| API | `apps/api` | `npm run build` | `npx wrangler deploy --env production` | `npx wrangler preview` |
| Public site | `apps/web` | `npm run build` | `npx wrangler deploy` | `npx wrangler preview` |

Cloudflare uses the Git branch as the default Preview name, so builds of the same branch create matching stable URLs:

```text
feature-login-pawheaven-frontend.group-3-paw-heaven.workers.dev
feature-login-pawheaven-api.group-3-paw-heaven.workers.dev
```

The public site derives the API hostname from that shared Preview name, so it always calls the API Preview from the same branch with no preview-specific `PUBLIC_API_BASE_URL` to maintain. The API Preview deliberately returns `503` until a separate preview Supabase project is configured; it never falls back to the production project. To enable a functional API Preview, replace the two placeholder values in `apps/api/wrangler.jsonc` under `previews.vars` with that preview project's URL and **publishable** key. Never use production values there.

For a manual Preview, run `npm run workers:preview -w @pawheaven/api` and `npm run workers:preview -w @pawheaven/web` from the same Git branch. Pass the same `--name` to both commands when overriding the default branch name.

## Working agreements

- Read `BRAINMAP.md` before implementing a feature and update it as requirements or decisions change.
- Keep Supabase queries and Auth operations in `apps/api`; use shared types from `packages/contracts` in the public app.
- Run `npm run check` before a merge. The root lockfile is the only lockfile to commit.
- If regenerating `package-lock.json`, do it from a clean checkout without `node_modules` so npm records native optional packages for both macOS and Linux. Cloudflare's Linux build needs the Linux entries.

## Database change workflow

Schema changes are reviewed code, never ad-hoc edits to the hosted database.

1. Create a branch and run `npm run db:start`, `npm run db:reset`, and `npm run db:configure-api`.
2. Generate a migration with `npx supabase migration new short_change_description`, then edit the generated file in `supabase/migrations/`.
3. Run `npm run db:reset` to prove the whole migration history works on a local database.
4. Commit the migration with the application changes and open a pull request. The `Verify Supabase migrations` workflow repeats the local reset in CI.
5. After review and merge to `main`, the production workflow awaits the protected GitHub `production` environment's approval, then applies migrations. Contributors never receive its credentials.

Do not put a Supabase personal access token, database password, secret key, or a linked-project file in the repository. The CLI's local link metadata is already ignored at `supabase/.temp/`.

Repository administrators must complete the one-time setup in [supabase/README.md](supabase/README.md) before relying on production deployments. In particular, remove contributor access that can modify the production database; code and CI cannot prevent a person with direct dashboard or database credentials from bypassing this workflow.

The previous Sprint 2 draft names MySQL, while this implementation uses Supabase Postgres. The report needs to explain that decision. The PDFs one directory above this Git repository are historical project context.
