# PawHeaven project brain map

Read this before changing the project. Update it when the team states a new requirement, makes an architecture decision, or completes a meaningful feature. Keep historical report requirements distinct from the current implementation.

## Product and near-term path

PawHeaven connects a shelter with its community. The first full path is: browse available pets, inspect a pet, sign up or log in, apply to adopt, staff review, schedule a visit, and update pet status. Adoption applications and scheduling are future work; this repository currently covers accounts and pet management.

The public site uses a shared default page shell with navigation and a footer. The root route is its public landing page. The pet directory uses the live API when it contains listings; an empty or unavailable development database leaves clearly labeled sample listings usable for browsing and filtering.

Public users may eventually save favorites, take a matching quiz, apply to adopt or foster, schedule visits, post lost-and-found reports, donate, and volunteer. Staff manage animals, applications, appointments, capacity, inventory, and operations. Administrators also manage staff and users.

## Requirements captured from the team

- There must be a public user-facing website, a separate staff website, and a backend API. The public and staff sites should deploy as distinct Cloudflare Workers on distinct subdomains. The API should also deploy as its own Worker.
- The public site may have an adoption service later, but adoption flows are not part of this architecture setup.
- The public and staff sites use Astro, TypeScript, basic HTML/CSS/JavaScript, and mostly static pages. This keeps the code approachable for the team and coding agents.
- Both client apps call the API. The API communicates with Supabase for Postgres data, Auth, and image Storage. Clients do not receive a service-role or secret key.
- Similar code should be shared when there is a real repeated responsibility. Start with shared API types in `packages/contracts`; extract shared UI or client helpers when both apps actually need the same implementation.
- The project is small and team-maintained. Prefer clear app ownership, few dependencies, and one root install and lockfile.
- Keep this brain map current as new requirements appear in conversation.

## Current architecture (decided 2026-10-05)

| Path | Responsibility | Cloudflare Worker |
| --- | --- | --- |
| `apps/web` | Public Astro site; accounts and pet browsing | `pawheaven-frontend` |
| `apps/staff` | Staff Astro site; sign-in and pet CRUD/photo upload | `pawheaven-staff` |
| `apps/api` | TypeScript API; Supabase Auth, Postgres, and Storage | `pawheaven-api` |
| `packages/contracts` | Shared TypeScript API shapes | Not deployed |
| `supabase/migrations` | Versioned schema and access policies | Applied to Supabase |

npm workspaces and the root `package-lock.json` are the single dependency boundary. The public and staff Workers serve static Astro output. The API Worker uses `@supabase/supabase-js` with the supplied Supabase URL and publishable key. It makes authenticated queries with the user's access token, so Row Level Security still applies. No privileged Supabase key is used in the deployed API.

The root lockfile is generated from a clean checkout so native optional dependencies for both macOS and Linux are present. This fixed the public Cloudflare build failure on 2026-10-05 where the Tailwind Linux binding was missing from a macOS-generated lockfile.

For Cloudflare Workers Builds, each app uses its own folder as the root directory. All three apps expose `npm run build`; the API build generates Cloudflare binding types and type-checks, while its deploy command `npx wrangler deploy` performs bundling. This resolves the API build failure reported on 2026-10-05 when Cloudflare ran `npm run build` in `apps/api` before that script existed.

Use same-site custom domains in production: `pawheaven.online` or `www.pawheaven.online` for the public site, `staff.pawheaven.online` for staff, and `api.pawheaven.online` for the API. The API sets host-only `HttpOnly`, `SameSite=Lax`, secure cookies on its own hostname. Browser requests use `credentials: 'include'`; the API allows only configured origins and checks the Origin on writes. Worker `workers.dev` preview hostnames may not share this cookie behavior. The API allowlist was updated on 2026-10-05 after the deployed staff site received a CORS error; the API Worker must be redeployed for the fix to take effect.

## Accounts and access

- Supabase Auth owns passwords, password hashes, and user sessions. The API handles registration, login, session refresh, current-user lookup, and logout, and sets the cookies.
- Public sign-up can only create an ordinary user. The sign-up request accepts a display name, email, and password; it does not accept a role. If Supabase email confirmation is enabled, the page tells the user to confirm and then log in.
- Public login and sign-up validate and explain each field error before sending credentials. They also prevent duplicate submits and distinguish safe account-service messages for timeouts, connectivity failures, rate limits, and temporary outages. Login failures remain non-enumerating; confirmation-required registration uses neutral wording because Supabase may intentionally obscure whether an email is already registered.
- The hosted Supabase Auth Site URL was changed from `http://localhost:3000` to `https://pawheaven.online` on 2026-10-05 so new confirmation emails return to the deployed public site. Previously sent links keep their embedded redirect. Local `supabase/config.toml` retains its localhost Site URL for local development.
- Roles are `user`, `staff`, and `admin`. Authorization reads Supabase `app_metadata.role`, which users cannot edit. Never authorize from `user_metadata` or a frontend control.
- Staff endpoints check the authenticated user's current role, and the database and Storage policies enforce staff access again. A public account receives `403` on staff endpoints.
- A trusted administrator assigns staff/admin roles through Supabase's Admin API. The local `apps/api/scripts/set-role.mjs` script requires a secret key supplied only in the local environment; the secret must never go in the repo or a client app.
- A confirmed demo staff account exists in the hosted Supabase project as of 2026-10-05. Its trusted `app_metadata.role` is `staff`, and password sign-in was verified. The password is not stored in this repo; remove or rotate the account after the demo.
- A Supabase access token may remain valid until its expiry after logout or role revocation. Keep JWT expiry short enough for the shelter's security needs; the current local Supabase config uses one hour.

## API contract now implemented

The API base path is `/api`. Local URL: `http://localhost:8787/api`.

| Request | Response or behavior |
| --- | --- |
| `GET /health` | API process health; does not test database connectivity |
| `POST /auth/register` | Creates an ordinary user; returns `{ user }` or `202` with an email-confirmation message |
| `POST /auth/login` | Sets session cookies and returns `{ user }` |
| `GET /auth/me` | Returns `{ user }`, refreshes cookies when needed, or `401` |
| `POST /auth/logout` | Revokes the current refresh token and clears cookies |
| `GET /pets?search=&tag=` | Available pets in name order; currently limited to 200 rows before text filtering |
| `GET /pets/:id` | One available pet or `404`; IDs are UUIDs |
| `GET /staff/pets` | All pets for staff/admin, limited to 200 rows |
| `POST /staff/pets` | Add pet record |
| `PUT /staff/pets/:id` | Replace editable pet fields |
| `DELETE /staff/pets/:id` | Delete pet and its photo |
| `POST /staff/pets/:id/image` | Upload/replace JPEG, PNG, or WebP image, up to 5 MB |

The pet API returns `id`, `name`, `type`, `breed`, `age`, `intakeDate`, `daysInShelter`, `tags`, `status`, `summary`, and `imageUrl`. `daysInShelter` is calculated from the stored `intake_date`. Uploaded pet images live in a public `pet-images` Storage bucket; upload/delete policies require staff or admin. The bucket is only for public animal photos, never sensitive documents.

The public site still has clearly labeled sample pet listings when the API or database is unavailable. Remove that fallback after real pet data, migration, and end-to-end testing are in place.

## Database model for the report

The implemented DBMS is Supabase-hosted PostgreSQL. The only PawHeaven-owned table currently deployed is `public.pets`; `auth.users`, `storage.buckets`, and `storage.objects` are managed by Supabase. Do not describe the following proposed tables as already deployed.

| Table | Key columns and types | Relationships |
| --- | --- | --- |
| `public.pets` (implemented) | `id uuid` PK; `name`, `species`, `breed`, `age_label`, `status`, `summary`, `image_path` as `text`; `intake_date date`; `tags text[]`; `created_at timestamptz` | `image_path` is a Storage object path, not a SQL foreign key. |
| `auth.users` (Supabase-managed) | `id uuid` PK; `email varchar`; `encrypted_password varchar`; `raw_user_meta_data jsonb` for display name; `raw_app_meta_data jsonb` for trusted role; `created_at timestamptz` | Future user-owned rows reference `auth.users.id`. |
| `public.adoption_applications` (proposed) | `id uuid` PK; `applicant_id uuid` FK; `pet_id uuid` FK; `status text`; `answers jsonb`; `submitted_at timestamptz`; `reviewed_by uuid` nullable FK; `reviewed_at timestamptz` nullable | Many applications per user and per pet; reviewer points to a staff user. |
| `public.appointments` (proposed) | `id uuid` PK; `application_id uuid` FK; `scheduled_at timestamptz`; `status text`; `notes text` nullable | One application may have multiple proposed/rescheduled visits. |
| `public.quiz_responses` (proposed) | `id uuid` PK; `user_id uuid` FK; `answers jsonb`; `completed_at timestamptz` | A user may submit multiple matching quizzes. |
| `public.suppliers` (proposed inventory) | `id uuid` PK; `name text`; `email text` nullable; `phone text` nullable | One supplier may provide many inventory items. |
| `public.inventory_items` (proposed inventory) | `id uuid` PK; `supplier_id uuid` nullable FK; `name text`; `category text`; `unit text`; `quantity_on_hand numeric`; `expires_on date` nullable | Each item may have a supplier and many transactions. |
| `public.inventory_transactions` (proposed inventory) | `id uuid` PK; `item_id uuid` FK; `staff_user_id uuid` FK; `quantity_change numeric`; `recorded_at timestamptz`; `note text` nullable | Records who changed an item's stock and by how much. |

Proposed foreign keys point to `auth.users(id)`, `public.pets(id)`, `public.adoption_applications(id)`, `public.suppliers(id)`, or `public.inventory_items(id)` as appropriate. Adoption, appointment, quiz, and inventory fields are a draft to discuss with the team before creating migrations. The current pet tags are a `text[]` column, not a separate tags table. Days in shelter is calculated from `intake_date` rather than stored.

## Product requirements inventory

1. Accounts, login, profiles, and role-based services.
2. Staff and administrator portal.
3. Adoption and foster workflow, favorites, and availability notifications.
4. AI pet-matching quiz.
5. AI lost-pet image matching.
6. Events and appointment scheduling.
7. Donations and shelter wishlist.
8. Newsletter and notifications.
9. Lost-and-found community page.
10. At-risk animal prioritization.
11. Live shelter capacity and animal availability.
12. Volunteer management.

Client sticky notes request alphabetical pet names, days in shelter, and tags such as `big dog`; the public pet directory addresses these. The Sprint 1 report also requests supply inventory for food, medicine, cleaning products, quantities, suppliers and contacts, and expiration/spoilage tracking. Those inventory requirements remain planned. Both sources must be reconciled with the client or instructor in the report.

## Historical Sprint 2 report commitments

The earlier Sprint 2 draft selected MySQL and proposed `users`, `pets`, `adoption_applications`, `quiz_responses`, and `appointments`. The team has since chosen Supabase Postgres and Supabase Auth for the implementation. The report still needs an explicit explanation of that change; do not silently claim that MySQL remains the implementation. The supplied PDFs one directory above this repo are report context.

The report also calls for ten use cases with one requirement each, a user-management diagram, database attributes/keys/relationships, registration/login/logout/session and roles, two major use cases with frontend and logic, command-line instructions, screenshots, and task-board status. Proposed use cases: register, log in/out, browse/filter pets, view details, apply to adopt, staff review, schedule visit, matching quiz, lost-and-found, and inventory tracking.

## Next work

- The first migration was applied to Supabase project `zzcbjfgyibhuhlylsvhs` on 2026-10-05. Remote checks confirmed the `pets` table has RLS and five policies, the `pet-images` bucket is public, and Supabase security advisors report no warnings. On 2026-10-06, four available dog listings (Maple, Milo, Nala, and Pepper) were seeded and paired with public `pet-images/seed/` JPEGs; the browser fallback data mirrors those listings. The project currently has no Auth users, so verify ordinary-user and staff policies with real accounts when the team creates them.
- Configure the team's actual three custom domains, exact API allowed origins, Astro build-time API URLs, and Supabase Auth redirect URL. Deploy each Worker independently.
- Use the verified demo staff account for the initial portal walkthrough; create individual staff accounts for ongoing use.
- Add adoption applications and appointment tables/API/UI after the team confirms the data fields and workflow.
- Add pagination beyond 200 pets, image optimization, request rate limiting, and a stronger session strategy if traffic or security needs grow.
- Complete the report's database and screenshot requirements with the updated Postgres decision.

## Team commands

From the Git repository root: `npm install`, then run `npm run dev:api`, `npm run dev:web`, and `npm run dev:staff` in separate terminals. Open the public app on `http://localhost:4321` and the staff app on `http://localhost:4322`. Run `npm run check` before merging. See `README.md` for Supabase migration and deployment steps.
