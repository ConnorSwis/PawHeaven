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

The first migration was applied to project `zzcbjfgyibhuhlylsvhs` on 2026-10-05. For a fresh project or later migrations, a team member with access should run:

```sh
npx supabase login
npx supabase link --project-ref zzcbjfgyibhuhlylsvhs
npx supabase db push
```

Review `supabase/migrations/` before pushing. The initial schema creates `public.pets` and a public `pet-images` Storage bucket. This retirement does not change the hosted Supabase project or its migration history. If another Supabase project's Data API does not expose the `public` schema, enable it in the Supabase dashboard. Public photo URLs are intentionally viewable by anyone who has the URL; do not use this bucket for private documents.

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

For both Workers Builds projects, set the **root directory** to its app folder (`apps/web` or `apps/api`). The production trigger should use `npm run build` and `npx wrangler deploy`. The non-production branch/PR trigger should use `npm run build` and `npx wrangler preview`. Cloudflare uses the Git branch as the default Preview name, so builds of the same branch create matching stable URLs:

```text
feature-login-pawheaven-frontend.group-3-paw-heaven.workers.dev
feature-login-pawheaven-api.group-3-paw-heaven.workers.dev
```

The public site derives the API hostname from that shared Preview name, so it always calls the API Preview from the same branch with no preview-specific `PUBLIC_API_BASE_URL` to maintain. The API Preview currently uses the configured Supabase project; create Preview-specific Supabase resources before testing data-changing work that must be isolated.

For a manual Preview, run `npm run workers:preview -w @pawheaven/api` and `npm run workers:preview -w @pawheaven/web` from the same Git branch. Pass the same `--name` to both commands when overriding the default branch name.

## Working agreements

- Read `BRAINMAP.md` before implementing a feature and update it as requirements or decisions change.
- Keep Supabase queries and Auth operations in `apps/api`; use shared types from `packages/contracts` in the public app.
- Run `npm run check` before a merge. The root lockfile is the only lockfile to commit.
- If regenerating `package-lock.json`, do it from a clean checkout without `node_modules` so npm records native optional packages for both macOS and Linux. Cloudflare's Linux build needs the Linux entries.

The previous Sprint 2 draft names MySQL, while this implementation uses Supabase Postgres. The report needs to explain that decision. The PDFs one directory above this Git repository are historical project context.
