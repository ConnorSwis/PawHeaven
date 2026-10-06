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

The API allowlist in `apps/api/wrangler.jsonc` includes `https://pawheaven.online` and `https://www.pawheaven.online`. Keep it aligned with the deployed public origin. Set `PUBLIC_API_BASE_URL=https://api.pawheaven.online/api` in the Astro build environment, then build and deploy each Worker:

```sh
npm run workers:deploy -w @pawheaven/api
npm run workers:deploy -w @pawheaven/web
```

Attach each Worker to its custom domain in Cloudflare. The API's host-only `SameSite=Lax` cookies depend on the sites sharing a parent domain. Test login on the real domain; a `workers.dev` preview hostname can behave differently. Set the Supabase Auth site URL to the public domain and allow its confirmation redirects. After changing the API allowlist, redeploy `apps/api`; rebuilding the public site alone will not change its CORS response.

For Cloudflare Workers Builds, set each Worker's **root directory** to its app folder (`apps/web` or `apps/api`). Use `npm run build` as the build command and `npx wrangler deploy` as the deploy command. The API's build script generates Cloudflare binding types and checks TypeScript; Wrangler bundles the Worker during deployment.

## Working agreements

- Read `BRAINMAP.md` before implementing a feature and update it as requirements or decisions change.
- Keep Supabase queries and Auth operations in `apps/api`; use shared types from `packages/contracts` in the public app.
- Run `npm run check` before a merge. The root lockfile is the only lockfile to commit.
- If regenerating `package-lock.json`, do it from a clean checkout without `node_modules` so npm records native optional packages for both macOS and Linux. Cloudflare's Linux build needs the Linux entries.

The previous Sprint 2 draft names MySQL, while this implementation uses Supabase Postgres. The report needs to explain that decision. The PDFs one directory above this Git repository are historical project context.
