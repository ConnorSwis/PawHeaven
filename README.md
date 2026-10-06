# PawHeaven

PawHeaven is an Astro and Cloudflare Workers monorepo for a public shelter site, a staff portal, and an API backed by Supabase. The current connected feature is pet browsing and staff pet management. Adoption applications are planned for a later phase.

| Workspace | Purpose | Local URL |
| --- | --- | --- |
| `apps/web` | Public Astro site | `http://localhost:4321` |
| `apps/staff` | Staff Astro site | `http://localhost:4322` |
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

Review `supabase/migrations/` before pushing. The first migration creates `public.pets`, role-based RLS policies, and the public `pet-images` Storage bucket with staff-only upload/delete policies. If another Supabase project's Data API does not expose the `public` schema, enable it in the Supabase dashboard. Public photo URLs are intentionally viewable by anyone who has the URL; do not use this bucket for private documents.

Start these in separate terminals:

```sh
npm run dev:api
npm run dev:web
npm run dev:staff
```

The public app already has an ignored local `.env` pointing at port 8787. For a fresh checkout, copy `apps/web/.env.example` to `apps/web/.env` and `apps/staff/.env.example` to `apps/staff/.env`. The staff app also defaults to the local API URL without that file.

The public site retains clearly labeled sample pets if the API is unavailable. With an empty real `pets` table, the API returns an empty list. Add pets through the staff portal after assigning a staff role.

## Staff role setup

Create a normal account through the public site or Supabase Auth first. Find its UUID under **Authentication → Users** in the Supabase dashboard. A project administrator can then assign the role with the trusted local script:

```sh
# Set SUPABASE_SECRET_KEY in your terminal from the Supabase dashboard first.
npm run staff:role -w @pawheaven/api -- USER_UUID staff
```

The script reads the secret from the environment, preserves other app metadata, and never writes it to a file. Use `admin` instead of `staff` only for a trusted administrator. Have the user log in again so their JWT contains the new role. Public registration never accepts a role.

If **Confirm Email** is enabled in Supabase Auth, new users receive a confirmation email and then log in; configure the project's Auth site URL/redirect URL to the public site. If it is disabled, registration starts a session immediately.

## Deploying the three Workers

Build and check locally:

```sh
npm run check
npm run workers:deploy:dry-run -w @pawheaven/web
npm run workers:deploy:dry-run -w @pawheaven/staff
```

The API allowlist in `apps/api/wrangler.jsonc` includes `https://staff.pawheaven.online`, `https://pawheaven.online`, and `https://www.pawheaven.online`. Keep it aligned with the exact deployed public and staff origins. Set `PUBLIC_API_BASE_URL=https://api.pawheaven.online/api` in each Astro app's build environment, then build and deploy each Worker:

```sh
npm run workers:deploy -w @pawheaven/api
npm run workers:deploy -w @pawheaven/web
npm run workers:deploy -w @pawheaven/staff
```

Attach each Worker to its custom domain in Cloudflare. The API's host-only `SameSite=Lax` cookies depend on the sites sharing a parent domain. Test login and staff access on those real domains; separate `workers.dev` preview hostnames can behave differently. Set the Supabase Auth site URL to the public domain and allow its confirmation redirects. After changing the API allowlist, redeploy `apps/api`; rebuilding either Astro site alone will not change its CORS response.

For Cloudflare Workers Builds, set each Worker's **root directory** to its app folder (`apps/web`, `apps/staff`, or `apps/api`). Use `npm run build` as the build command and `npx wrangler deploy` as the deploy command. The API's build script generates Cloudflare binding types and checks TypeScript; Wrangler bundles the Worker during deployment.

## Working agreements

- Read `BRAINMAP.md` before implementing a feature and update it as requirements or decisions change.
- Keep Supabase queries, Auth, and Storage operations in `apps/api`; use shared types from `packages/contracts` in both client apps.
- Protect staff actions in both the API and Supabase RLS. A hidden button is never authorization.
- Run `npm run check` before a merge. The root lockfile is the only lockfile to commit.
- If regenerating `package-lock.json`, do it from a clean checkout without `node_modules` so npm records native optional packages for both macOS and Linux. Cloudflare's Linux build needs the Linux entries.

The previous Sprint 2 draft names MySQL, while this implementation uses Supabase Postgres. The report needs to explain that decision. The PDFs one directory above this Git repository are historical project context.
