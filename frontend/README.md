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
