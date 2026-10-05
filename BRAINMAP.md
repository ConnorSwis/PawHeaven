# PawHeaven project brain map

Use this file as shared context for people and coding agents working on PawHeaven. It records the decisions made during Sprint 2 planning, the frontend currently in the repository, and the work still needed for a complete system.

## 1. Product in one paragraph

PawHeaven is a web application that connects an animal shelter with its community. People can discover animals, find a suitable match, apply to adopt or foster, schedule visits, volunteer, and receive updates. Shelter staff and administrators manage animals, applications, appointments, users, capacity, and eventually shelter inventory.

The immediate goal is a believable, working adoption path:

```text
Browse available pets -> inspect a pet -> create an account or log in -> submit an adoption application -> staff review -> schedule visit -> update pet status
```

## 2. Users and roles

| Role | Intended access |
| --- | --- |
| Community user / adopter | Browse pets, save favorites, take the matching quiz, apply to adopt or foster, schedule visits, post lost-and-found reports, donate, and volunteer. |
| Shelter staff | Manage animal records, applications, appointments, supplies, and day-to-day shelter operations. |
| Administrator | Staff access plus user and role management, high-level shelter management, and reporting. |

### Authentication decisions

- Public sign-up creates only the ordinary `user` role. A visitor must never choose `admin` or `staff` during registration.
- The backend is the source of truth for roles and protected access. Hiding a frontend control does not secure a staff action.
- Use server-managed sessions. The browser should receive a secure, `HttpOnly` session cookie; it should not store an auth token in `localStorage`.
- The frontend restores the signed-in state with `GET /auth/me` after a refresh and sends requests with `credentials: 'include'`.
- Store passwords only as a modern one-way password hash, never as plaintext.

## 3. Requirements already gathered

### Group feature inventory

1. User management: account creation, login, profiles, and role-based services.
2. Staff and administrator portal.
3. Adoption and foster workflow, including favorites and availability notifications.
4. AI pet-matching quiz.
5. AI lost-pet image matching.
6. Events and appointment scheduling.
7. Donations and shelter wishlist.
8. Newsletter and notifications.
9. Lost-and-found community page.
10. At-risk animal prioritization.
11. Live shelter capacity and animal availability.
12. Volunteer management.

### Client requirements captured in the project materials

There are two sets of client requirements in the supplied materials. The group needs to reconcile them in the Sprint 2 report with the client or instructor; neither should be silently discarded.

| Source | Requirement |
| --- | --- |
| Client sticky note | List pet names alphabetically. |
| Client sticky note | Show how long each pet has been in the shelter. |
| Client sticky note | Use search tags such as `big dog`. |
| Sprint 1 report | Supply inventory management for incoming and outgoing food, medicine, cleaning products, and other supplies. |
| Sprint 1 report | Supply database with quantities, suppliers, and contact details. |
| Sprint 1 report | Expiration and spoilage tracking for food and medicine. |

The three sticky-note requirements are already represented in the frontend pet directory. The inventory requirements are planned but not implemented.

## 4. Sprint 2 scope and report commitments

Sprint 2 requires:

- Ten complete use cases and one requirement per use case.
- At least one user-management use case and corresponding diagram.
- Database design using MySQL, including table attributes, primary keys, foreign keys, and relationships.
- User registration, login, logout, session handling, and user/admin roles integrated with the database.
- Frontend and logic for two major use cases.
- Command-line run instructions, not instructions to use an IDE.
- Screenshots of the implemented pages and project-management task cards.

The Sprint 2 draft already selected MySQL and proposed these core tables: `users`, `pets`, `adoption_applications`, `quiz_responses`, and `appointments`.

### Recommended first ten use cases

1. Register a user account.
2. Log in and end a session.
3. Browse and filter available pets.
4. View a pet's details and time in shelter.
5. Submit an adoption application.
6. Staff reviews an adoption application.
7. Schedule an adoption visit.
8. Take the pet-matching quiz.
9. Record and search a lost-or-found report.
10. Staff manages shelter inventory and expiration dates.

## 5. Technology choices

| Area | Decision |
| --- | --- |
| Frontend | Astro 7, Vite, TypeScript, Tailwind CSS 4. |
| Database | MySQL. |
| Backend | Still to be chosen or implemented; it must expose the REST contract below. Node.js + Express is compatible with the selected frontend and team skills. |
| Session model | Server-managed session with cookie credentials. |
| Frontend hosting | Cloudflare Workers static assets. `frontend/wrangler.jsonc` deploys Astro's `dist/` directory as the `pawheaven-frontend` Worker. |

## 6. Current frontend

The frontend is in [`frontend/`](./frontend), which is intentionally separate from the repository root documentation and future backend.

### Routes

| Route | Current behavior |
| --- | --- |
| `/` | Small page linking to the available first-sprint screens. |
| `/login` | Email/password form that calls the login endpoint. |
| `/sign-up` | Name, email, password, and password confirmation form that calls the registration endpoint. |
| `/account` | Calls the current-session endpoint, shows the role, and logs out. |
| `/pets` | Alphabetical pet directory with text search, tag filter, status, and days in shelter. |
| `/pets/details?id=maple` | Pet information, tags, and days in shelter. |

### Component boundaries

Each screen-specific behavior is self-contained on purpose. Do not introduce a site-wide navigation bar or footer unless the group later decides it is needed.

| File | Responsibility |
| --- | --- |
| `frontend/src/layouts/PageShell.astro` | HTML document shell and global stylesheet import only. |
| `frontend/src/components/LoginForm.astro` | Login form, validation, request, errors, and redirect. |
| `frontend/src/components/SignUpForm.astro` | Registration form, password match check, request, errors, and redirect. |
| `frontend/src/components/AccountPanel.astro` | Session lookup, role display, and logout. |
| `frontend/src/components/PetDirectory.astro` | Pet directory layout, tag filtering, API request, local visual fallback. |
| `frontend/src/components/PetDetails.astro` | Detail view, API request, local visual fallback, and not-found state. |
| `frontend/src/styles/global.css` | Global typeface, color tokens, and focus styling. |

### Design decisions

- Pages use a warm paper background, dark text, white content surfaces, moss-green primary actions, and orange keyboard-focus outlines.
- Keep forms and content panels simple: clear labels above inputs, 1px borders, restrained rounding, no gradients, no decorative dashboards, no global sidebars, and no floating visual effects.
- Retain the small, focused page pattern. A login page should contain the login form; it does not need a navigation bar, footer, or unrelated product content.
- The shared design tokens live in `frontend/src/styles/global.css`. Change those tokens before scattering custom colors through components.

## 7. Frontend-to-backend API contract

Set `PUBLIC_API_BASE_URL` in `frontend/.env`. It defaults locally to `http://localhost:3000/api`; use the production API URL as a build-time environment variable when deploying, or `/api` when the API shares the deployed hostname.

| Request | Required behavior |
| --- | --- |
| `POST /auth/register` | Accept `{ name, email, password }`; create a `user` account; start a session; return `{ user }`. Return useful validation or duplicate-email errors. |
| `POST /auth/login` | Accept `{ email, password }`; start a session; return `{ user }`; respond with `401` for bad credentials. |
| `GET /auth/me` | Return `{ user }` for the current session or `401` when no session exists. |
| `POST /auth/logout` | Destroy the current session and clear its cookie. |
| `GET /pets?sort=name_asc&search=&tag=` | Return `{ pets }` or an array of pets. Support alphabetical sorting, text search, and a tag filter. |
| `GET /pets/:id` | Return a pet or `404`. |

The pet directory currently expects each pet to include:

```ts
type Pet = {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  daysInShelter: number;
  tags: string[];
  status: string;
  summary: string; // required by the detail view
};
```

Prefer storing `intake_date` in the database and calculating `daysInShelter` in the backend response. A value stored permanently as a number becomes stale every day.

The frontend intentionally includes sample pet data only when the pet API cannot be reached. Remove that fallback after the database-backed API is available and tested.

## 8. Database direction

### Core Sprint 2 tables

| Table | Purpose | Important fields / relationships |
| --- | --- | --- |
| `users` | Accounts and roles. | `user_id` PK, `name`, unique `email`, `password_hash`, `role`, timestamps. |
| `pets` | Animals and adoption availability. | `pet_id` PK, `name`, species/type, breed, age or birth date, `intake_date`, `status`, description. |
| `adoption_applications` | Adoption requests. | PK, `user_id` FK, `pet_id` FK, application status, submitted/reviewed timestamps. |
| `quiz_responses` | Pet-matching quiz answers. | PK, `user_id` FK, response data, completed timestamp. |
| `appointments` | Scheduled shelter visits. | PK, `user_id` FK, `pet_id` FK, date/time, status. |

### Required additions for current client-facing browse features

| Table | Purpose |
| --- | --- |
| `tags` | Canonical tags such as `big-dog`, `good-with-kids`, and `indoor`. |
| `pet_tags` | Many-to-many relationship between pets and tags. |

### Planned inventory tables

| Table | Purpose |
| --- | --- |
| `suppliers` | Supplier names and contact details. |
| `inventory_items` | Item name, category, quantity, unit, supplier, received date, and expiration date. |
| `inventory_transactions` | Incoming, outgoing, and adjustment history. |

Use migration or SQL setup scripts that create tables in dependency order. Seed an administrator account through a controlled script, never through public registration.

## 9. What remains to be implemented

### Backend and database

- Create the MySQL schema and portable SQL setup/seed scripts.
- Implement all endpoints in the API contract.
- Add password hashing, validation, error handling, session storage, CORS, cookie configuration, and role middleware.
- Write database-backed pet sorting, text search, tag filtering, and length-of-stay calculation.
- Add role-protected staff endpoints and verify that ordinary users receive `403`.
- Implement adoption applications and appointment scheduling as the next connected workflow.

### Frontend

- Replace sample pet fallbacks with live API data after the API is complete.
- Add adoption application and appointment screens after their endpoints exist.
- Add client-side loading, empty, and error states to each future data screen.
- Add a staff/admin screen only when corresponding protected endpoints are ready.
- Add form-level validation that mirrors backend validation without relying on it for security.
- Add image handling for pets when image storage and API fields are agreed upon.

### Project and report work

- Complete the ten use cases, requirements, and diagrams in the Sprint 2 report.
- Reconcile the sticky-note pet-listing requirements with the supply-inventory requirements in writing.
- Add screenshots of each implemented page and GitHub task-board status.
- Add the repository URL and exact build/run instructions to the report.
- Decide deployment host and document non-secret setup steps.

## 10. Verification checklist

Run these checks before calling the user-management feature complete:

1. Register a new user and confirm the database contains only a password hash.
2. Log out, then verify protected API routes reject the user.
3. Log in, refresh `/account`, and verify the session and role remain available.
4. Confirm a standard user cannot reach a staff endpoint even by entering its URL directly.
5. Confirm sign-up cannot create an administrator or staff account.
6. Add several pets and verify `/pets` sorts them A-Z by name.
7. Confirm tag filtering returns the expected pets, including `big-dog`.
8. Confirm days in shelter changes correctly from `intake_date`.
9. Run `npm run build` inside `frontend/`.

## 11. Commands for contributors

```sh
cd frontend
npm install
cp .env.example .env
npm run dev
npm run build
```

### Cloudflare Workers

```sh
cd frontend
npm run workers:dev
npm run workers:deploy:dry-run
npm run workers:types
npm run workers:deploy
```

The static frontend is ready for Cloudflare Workers. A team member must authenticate Wrangler with the group's Cloudflare account before the first actual deployment. If the future backend runs on Workers and connects to the planned MySQL database, use Cloudflare Hyperdrive rather than a direct database connection. Keep secrets in Cloudflare's secret store and local development values in `.dev.vars`.

The frontend needs Node.js 22.12 or newer. Keep credentials and database passwords out of the repository; use `.env` files and provide only `.env.example` as a template.
