# PawHeaven frontend

This Astro, TypeScript, and Tailwind CSS frontend covers the first two PawHeaven use cases:

- Account registration, login, logout, session restoration, and user/admin role display.
- Alphabetical pet browsing, tag filtering, time in shelter, and pet detail pages.

Every route is a focused page with no shared navigation or footer. The screen-specific behavior lives in its own Astro component, while `PageShell.astro` only supplies the document structure and global design tokens.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open the local address printed by Astro. Create a production build with:

```sh
npm run build
```

## Deploy to Cloudflare Workers

This project is configured as a static-assets Cloudflare Worker. Its build output is deployed from `dist/`; no Worker script is needed while the app remains a static Astro site.

```sh
# Build and run the Cloudflare Worker locally.
npm run workers:dev

# Validate the deployment configuration without publishing.
npm run workers:deploy:dry-run

# Refresh generated Cloudflare binding types after wrangler.jsonc changes.
npm run workers:types

# Publish after logging in to the team's Cloudflare account.
npm run workers:deploy
```

The first production deployment will create or update the `pawheaven-frontend` Worker. Before publishing, a team member must run `npx wrangler login` with the group's Cloudflare account.

`PUBLIC_API_BASE_URL` is compiled into the browser bundle at build time. For local work, `.env` points to `http://localhost:3000/api`. For a production build, set it to the deployed API URL in the build environment. If the API is served by the same Worker or hostname, use `/api` instead. Never commit credentials; use `.dev.vars` for local Worker values and Cloudflare secrets for server-side secrets.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Log in form |
| `/sign-up` | New account form |
| `/account` | Current session, role display, and logout |
| `/pets` | Alphabetical available-pet directory and tag search |
| `/pets/details?id=maple` | Individual pet details |

## Backend contract

Set `PUBLIC_API_BASE_URL` to the backend API base URL. The default is `http://localhost:3000/api`.

| Request | Expected response |
| --- | --- |
| `POST /auth/register` | Creates an ordinary user and starts a session; responds with `{ user }`. |
| `POST /auth/login` | Starts a session; responds with `{ user }`. |
| `GET /auth/me` | Responds with `{ user }` or `401` when signed out. |
| `POST /auth/logout` | Ends the current session. |
| `GET /pets?sort=name_asc&search=&tag=` | Responds with `{ pets }` or a pet array. |
| `GET /pets/:id` | Responds with a pet object. |

A pet object needs `id`, `name`, `type`, `breed`, `age`, `daysInShelter`, `tags`, `status`, and `summary` for the detail page. The `pets` page contains clearly labeled sample listings only as a visual fallback before the API is running.

The backend must enforce roles and all protected access. The browser calls the API with `credentials: 'include'`, so session cookies work after a page refresh.
