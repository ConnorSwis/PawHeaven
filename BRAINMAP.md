# PawHeaven project brain map

Read this before changing the project. Update it when the team states a new requirement, makes an architecture decision, or completes a meaningful feature. Keep historical report requirements distinct from the current implementation.

## Product and near-term path

PawHeaven connects a shelter with its community. The first full paths are: administrators manage pet records; visitors browse available pets and inspect a pet, create an account or log in, submit a minimal adoption application, and receive an administrator-recorded outcome; and administrators publish general shelter visit times that signed-in visitors can book, reschedule, or cancel.

The public site uses a shared default page shell with navigation and a footer. The root route is its public landing page. The pet directory uses the live API when it contains listings; an empty or unavailable development database leaves clearly labeled sample listings usable for browsing and filtering.

Public users may eventually save favorites, take a matching quiz, apply to adopt or foster, schedule visits, post lost-and-found reports, donate, and volunteer.

## Requirements captured from the team

- There must be a public user-facing website, an internal administrator website, and a backend API. They deploy as distinct Cloudflare Workers but live in this monorepo under `apps/web`, `apps/admin`, and `apps/api`.
- The public site may have an adoption service later, but adoption flows are not part of this architecture setup.
- The public site uses Astro, TypeScript, basic HTML/CSS/JavaScript, and mostly static pages. This keeps the code approachable for the team and coding agents.
- The public client calls the API. The API communicates with Supabase for Postgres data, Auth, and image Storage. Clients do not receive a service-role or secret key.
- Similar code should be shared when there is a real repeated responsibility. Start with shared API types in `packages/contracts`; extract shared UI or client helpers when both apps actually need the same implementation.
- The project is small and team-maintained. Prefer clear app ownership, few dependencies, and one root install and lockfile.
- Keep this brain map current as new requirements appear in conversation.
- Administrators and superusers must be able to view and manage ordinary user accounts, including profile information, adoption applications, password-reset email, sign-in blocking, and permanent deletion. Superusers can perform the same actions on administrator accounts. The portal protects the active account and every superuser account from these actions.

## AI-agent operating manual

This repository is designed to be worked on by coding agents as well as people. This section is the operational contract for an agent making a change. Treat it as current implementation context; use the historical-report sections below only when the task concerns the report.

### Handing a task to an agent

Give an agent the repository plus a focused request, for example: `Read AGENTS.md, BRAINMAP.md, and README.md. Follow the AI-agent operating manual. Implement <feature or fix>, validate it, and report the files changed and any remaining decision.` The agent should use this brain map as context, inspect the existing pattern before designing a new one, and ask only when the requested change would require a product, security, or production decision that is not already recorded here.

### Start every task this way

1. Read this file, the root `README.md`, and the root `AGENTS.md` before editing. If the task touches `apps/web`, also read `apps/web/AGENTS.md`.
2. Inspect the relevant code and `git status` before changing files. Preserve unrelated working-tree changes.
3. Identify the owning area from the table below. Keep the work there unless there is a real shared responsibility.
4. Use the local development environment. Never assume a task authorizes production access, deployment, or changes in external dashboards.
5. Implement the smallest complete change, validate it, and update this brain map when the task changes a requirement, architecture decision, API contract, database model, or feature status.

| Change needed | Owner and expected location |
| --- | --- |
| Public page, component, client interaction, or styling | `apps/web` |
| HTTP route, cookies, Supabase query, Auth, or Storage access | `apps/api` |
| Type shared by web and API | `packages/contracts/src/index.ts` |
| Database table, policy, index, Storage policy, or database function | A new migration in `supabase/migrations` |
| Local database configuration | `supabase/config.toml` and documented root scripts |
| Contributor/deployment workflow | Root docs, `AGENTS.md`, and `.github/workflows` |

### Local development contract

Prerequisites are Node.js 22.12+ and a running Docker-compatible container runtime. From the repository root, install once with `npm install`. Database-backed work uses these commands:

```sh
npm run db:start
npm run db:reset
npm run db:configure-api
npm run dev:api
npm run dev:web
```

The database commands target a contributor's local Supabase stack. `db:reset` explicitly runs `supabase db reset --local` and rebuilds that local database from committed migrations. `db:configure-api` creates the ignored `apps/api/.dev.vars` using the local API URL and publishable key. It must be regenerated by each contributor; never share or commit it. `npm run dev:api` also runs that setup and fails closed if the local stack is unavailable or the API is not configured for a loopback Supabase URL.

The web app is at `http://localhost:4321`; the API is at `http://localhost:8787/api`. The public web app intentionally has clearly labeled sample pet data when the local API or database is unavailable.

### Database and production safety: non-negotiable rules

- This project uses imperative, timestamped SQL migrations. Create a schema migration with `npx supabase migration new descriptive_change`, edit the generated file, and run `npm run db:reset` before requesting review.
- Schema changes include tables, indexes, grants, RLS policies, Storage policies, functions, and triggers. Do not hide schema changes in application code or dashboard-only changes.
- Do **not** run `supabase link`, `supabase db push`, `supabase db reset --linked`, `supabase db pull`, or `supabase migration repair` against production from a contributor checkout. Do not use the hosted SQL Editor or Table Editor to change production schema.
- Do not place Supabase access tokens, database passwords, service-role/secret keys, production `.env` files, or `supabase/.temp/` metadata in Git. The public and admin sites use no secret key. The only deliberate exception is the `ADMIN_SUPABASE_SERVICE_ROLE_KEY` Cloudflare secret on `apps/api`; it is used only for server-side Supabase Auth administration, including invitations, immutable `app_metadata` role assignment, and authorized user-management actions.
- New or changed tables in `public` need deliberate grants, RLS enabled, and policies matching the actual actor and row ownership. Never use editable `user_metadata` for authorization. Treat `SECURITY DEFINER`, views, triggers, and Storage rules as security-sensitive and document/verify them.
- Do not give contributors access to the production Supabase project, its dashboard, database password, access token, or production environment files. The project owner alone applies reviewed migrations to production outside this repository.

Before declaring a database change complete, run `npm run db:reset`. For a migration involving policies, Auth, Storage, functions, or views, also verify the intended allowed and denied paths locally. Read `supabase/README.md` for the full contributor and administrator flow.

### Application boundaries and invariants

- `apps/web` is a public Astro site. It talks to the API, not directly to Supabase. Keep it mostly static and approachable; use shared UI only after a second genuine use appears.
- `apps/api` is the sole owner of Supabase Auth, Postgres, and Storage calls. It accepts the caller's token and uses API-host `HttpOnly`, `SameSite=Lax` cookies. Do not move privileged database logic into the web app.
- `packages/contracts` is the shared API-shape boundary. Update it when a response or request shared by both applications changes.
- Supabase Auth owns credentials, hashes, and sessions. Public registration creates ordinary users only; it must never accept a role from the client. Authorization roles belong in immutable `app_metadata`, not user-editable metadata.
- Public animal images are in the public `pet-images` bucket. Never store adoption documents, personal data, or other private files there.
- Production uses the same-site domains `pawheaven.online`/`www.pawheaven.online` and `api.pawheaven.online`. Keep API CORS origins and Supabase Auth redirect URLs aligned when a domain changes.

### Change and verification protocol

1. Work on a branch. Make narrowly scoped edits; do not reformat or rewrite unrelated code.
2. Use the root npm workspace. Do not create nested lockfiles. If dependencies change, update the root `package-lock.json` from a clean checkout as described in `README.md`.
3. Run the validation that matches the change, then run `npm run check` for repository changes before proposing a merge. Database changes additionally require `npm run db:reset`.
4. Review the diff for secrets, accidental production configuration, and changes outside the task. Explain any deliberate trade-off or unverified prerequisite in the handoff.
5. A pull request is the unit of review. The CI migration check must pass. Do not push migrations to production manually; the protected workflow handles it after merge and approval.

### When to ask instead of guessing

Ask for direction before making a decision that changes the product scope, database data-retention/access model, Auth/role model, public domain, third-party account configuration, production infrastructure, or visual direction without an existing pattern. Report a blocker rather than inventing credentials, staff permissions, production data, or a report requirement.

### Keep this context useful

When completing a feature, update the relevant existing section of this brain map: mark delivered capabilities as implemented, retain drafts as drafts, and add new route/schema details. Do not claim proposed report tables or features are deployed. Prefer precise, dated decisions over generic project summaries.

## Current architecture (decided 2026-10-05)

| Path | Responsibility | Cloudflare Worker |
| --- | --- | --- |
| `apps/web` | Public Astro site; accounts and pet browsing | `pawheaven-frontend` |
| `apps/admin` | Internal Astro admin portal; admin sign-in and invitation UI | `pawheaven-admin` |
| `apps/api` | TypeScript API; Supabase Auth, Postgres, and Storage | `pawheaven-api` |
| `packages/contracts` | Shared TypeScript API shapes | Not deployed |
| `supabase/migrations` | Versioned schema and access policies | Applied to Supabase |

npm workspaces and the root `package-lock.json` are the single dependency boundary. The public and admin Workers serve static Astro output. The API Worker normally uses `@supabase/supabase-js` with the supplied Supabase URL and publishable key. Privileged Auth administration is the narrow server-side exception: the API receives `ADMIN_SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare secret, never as a source-controlled binding, static Worker var, or browser value.

The root lockfile is generated from a clean checkout so native optional dependencies for both macOS and Linux are present. This fixed the public Cloudflare build failure on 2026-10-05 where the Tailwind Linux binding was missing from a macOS-generated lockfile.

Database development is local-only for contributors. Each schema change is a timestamped migration under `supabase/migrations`, tested by a local `supabase db reset --local` and by a pull-request CI workflow. The production project is not linked in source control and contributors have no production credentials or dashboard access. The project owner alone applies reviewed migrations to production outside this repository.

For Cloudflare Workers Builds, each app uses its own folder as the root directory. Every app exposes `npm run build`; the API build generates Cloudflare binding types and type-checks, while its deploy command `npx wrangler deploy` performs bundling. This resolves the API build failure reported on 2026-10-05 when Cloudflare ran `npm run build` in `apps/api` before that script existed.

Use same-site custom domains in production: `pawheaven.online` or `www.pawheaven.online` for the public site, `admin.pawheaven.online` for the administrator portal, and `api.pawheaven.online` for the API. On `workers.dev`, browser code derives the matching API Worker hostname and makes direct CORS requests. The API accepts direct requests only from configured custom origins and from this Cloudflare account's production/Preview frontend and admin `workers.dev` hosts. CORS allows public API calls there, but use custom domains for account flows because browser third-party-cookie policies can prevent reliable cross-host `workers.dev` sessions.

Branch and PR deployments use Cloudflare Worker Previews, not unpaired Version URLs. The public and admin clients map `<preview>-pawheaven-frontend.<account>.workers.dev` and `<preview>-pawheaven-admin.<account>.workers.dev` to `<preview>-pawheaven-api.<account>.workers.dev`. A generic Version URL cannot make this guarantee because its Worker-specific version prefix is unrelated to the API's prefix. Preview builds share the current Supabase project unless separate Preview bindings are configured. Use custom domains for all account flows because cross-host `workers.dev` cookies are not reliable.

## Accounts and access

- Supabase Auth owns passwords, password hashes, and user sessions. The API handles registration, login, session refresh, current-user lookup, and logout, and sets the cookies.
- Public sign-up can only create an ordinary user. The sign-up request accepts a display name, email, and password; it does not accept a role. Passwords must be at least 8 characters with an uppercase letter, lowercase letter, number, and special character (`passwordProblem` in `packages/contracts`, enforced by the API for registration, invitation/recovery password setup, and password change, and mirrored in local `supabase/config.toml`). Hosted Supabase Auth password requirements must be set to the same policy in the dashboard because the publishable key is public. If Supabase email confirmation is enabled, the page tells the user to confirm and then log in.
- Public login and sign-up validate and explain each field error before sending credentials. They also prevent duplicate submits and distinguish safe account-service messages for timeouts, connectivity failures, rate limits, and temporary outages. Login failures remain non-enumerating; confirmation-required registration uses neutral wording because Supabase may intentionally obscure whether an email is already registered.
- The hosted Supabase Auth Site URL was changed from `http://localhost:3000` to `https://pawheaven.online` on 2026-10-05 so new confirmation emails return to the deployed public site. Previously sent links keep their embedded redirect. Local `supabase/config.toml` retains its localhost Site URL for local development.
- The public account response contains only a member's identity and does not expose an authorization role.
- Members can update their display name from the account page, change their email (`PUT /auth/email`, requires the current password; Supabase emails both addresses and the change applies only after confirmation), and change their password (`POST /auth/change-password`, requires the current password and the password policy).
- A Supabase access token may remain valid until its expiry after logout. Keep JWT expiry short enough for the shelter's security needs; the current local Supabase config uses one hour.
- The shared header checks the current session on page load: its action is “Log in” when signed out and becomes “Log out” when signed in. Logging out from either the header or account page synchronizes that action without requiring a page refresh.
- The internal `apps/admin` portal is a separate app folder and Worker, not a separate repository. Administrators and superusers can list, create, update, and remove pet records; upload public pet photos; review adoption applications; and manage ordinary user accounts. Both roles may view user information and applications, edit name/email, send a recovery email, block or unblock sign-in, and permanently delete the account. Only a superuser may perform those actions on an `admin`; the active account and all `superuser` accounts are protected from management and deletion in the portal. A pet with linked applications cannot be removed while its foreign-key history is retained.
- A signed-in member can submit one application for an available pet. It stores the account email for shelter follow-up, a required household/care summary, a required pet-care experience/preparedness answer, and an optional note. No identity documents, payment data, or foster-specific responses are collected. The application starts `Pending`; an administrator may set `In review`, `Approved`, or `Declined`. This records a review outcome only and never changes pet availability automatically.
- On 2026-10-20, visit scheduling was implemented in source: administrators and superusers publish non-overlapping future slots and can withdraw open slots; signed-in members view sanitized availability, book a general visit with a 1–500 character purpose, reschedule, or cancel future bookings. Booking, cancellation, rescheduling, and slot withdrawal use locked database RPCs plus a partial unique booking index. Account history records in-app confirmation events; no email delivery is claimed. All times are stored as `timestamptz` and presented in the configurable `America/New_York` shelter timezone; the administrator UI rejects ambiguous/nonexistent daylight-saving civil times. The administrator schedule shows active booking contact and purpose; public availability never reveals them. User deletion cascades to appointments and confirmations. This still needs Docker-backed migration and RLS test execution locally before any deployment.
- Volunteer shifts (Phase 2, 2026-10-26): staff publish shifts with a title, duties, optional requirements, a minimum age (0 = none), a start/end up to 24 hours apart (entered and shown in America/New_York with the same DST-ambiguity guard as visit times), and a capacity of 1–500. Signed-in members see upcoming published shifts with remaining spots (never other volunteers' details), register with a phone number and date of birth, and cancel any time before the shift starts. Registration runs in a locked RPC (`register_for_volunteer_shift`) that serializes per member with an advisory lock and per shift with a row lock, and returns a specific reason when it refuses: shift full, already registered, below the minimum age, overlapping another of the member's registered shifts, or shift no longer available. Staff edit a shift (the time and minimum age lock once anyone has registered; capacity cannot drop below the head count), view the participant list with contact details, and cancel a shift, which cancels every registration (`canceled_reason = 'shift_canceled'`) and emails each volunteer. Date of birth is stored on the registration only to check the age requirement. All writes go through RPCs; tables are read-only for clients under RLS.
- In-progress adoption answers are saved to browser `sessionStorage` for the current signed-in user and pet, then removed after successful submission. They are not sent to the API until submission.
- The public pet directory supports name/description/tag search and filters by species and broad age group (under 1, 1–7, and 8+ years). Age groups rely on numeric age labels; age labels that cannot be parsed remain available in the unfiltered directory.
- There are exactly three roles: member (no stored role), `staff`, and `superuser`. Staff and superuser are stored in immutable `auth.users.raw_app_meta_data.role`; public registration cannot create either. `staff` is the shelter staff/administrator role from the Sprint 3 report: it manages pets, adoption applications, the visit schedule, and member accounts. `superuser` additionally manages staff accounts, invites staff by email, and promotes or demotes accounts between member and staff (`PUT /admin/users/:id/role`). The earlier separate `admin` tier was merged into `staff` on 2026-10-26; existing accounts that still carry the legacy `admin` value are treated as `staff` by the API and `public.is_staff()` until a cleanup migration converts them. Database policies call `public.is_staff()`; the API reads the role from the verified user record and refreshes the session when the token's role claim is stale after a promotion or demotion. The API sends the Supabase invitation, sets the invited user’s immutable app-metadata role before they can use the portal, and records an audit event.
- Invitations use Supabase’s email invitation flow and password-based login. An invitee follows the email link to `apps/admin`’s `/accept-invite`, where the API exchanges the short-lived Supabase session into its secure API cookies and the invitee chooses their password. The same page accepts recovery links for staff-triggered password resets and returns ordinary users to the public account page. This deliberately reuses the existing password login path instead of introducing an OTP-only system.
- The invitation template sends a one-time token hash to the admin page, which waits for an explicit Continue click before verification; this reduces accidental consumption by email link scanners. Existing session-fragment invitation and recovery links remain supported. Expired or already-used invitations must be resent. Production Auth must allow the exact admin callback URL; on 2026-10-19 the previously empty allowlist was corrected. Deploy both Workers before applying the updated Supabase invitation template; see `docs/admin-invitations.md`.
- Superusers can review administrator invitations that need password setup and send a fresh setup email. Supabase cannot issue a second invitation for an already-created user, so the resend uses its password-recovery flow, which the shared acceptance page supports. The portal records completed setup only after `/auth/password` saves the administrator's password; a temporary Supabase session created by opening an email link is not treated as completion. Existing invitation records with no setup timestamp deliberately remain resendable. Email OTP expiration is a project-wide Supabase Auth setting that applies to invitations and recovery links; one day is the recommended maximum for this shelter workflow.
- A blocked account is represented by Supabase Auth's `banned_until`. The API rejects a blocked identity on every authenticated request instead of waiting for an already-issued access token to expire. Staff must unblock an account before sending its password-reset email.
- Permanent user deletion uses Supabase Auth's hard-delete operation. Deleting an ordinary user cascades to that user's adoption applications. Deleting an administrator also removes the invitation audit entry for that account, while reviewed applications preserve their review timestamp/outcome and the `reviewed_by` foreign key becomes null.
- On 2026-10-19, production's already-present adoption application schema was reconciled with migration history; the missing pet-role, experience-field, and deleted-reviewer migrations were applied and the remote migration history verified up to date.
- The deployment owner configures one `BOOTSTRAP_SUPERUSER_EMAIL` outside source control. On that address’s first successful administrator request, the API assigns immutable `superuser` app metadata with its server-side secret; the matching account may be an ordinary user or an existing administrator. Remove the setting after bootstrap so it cannot be reused. Configure `ADMIN_SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare secret, production SMTP, and the exact `https://admin.pawheaven.online/accept-invite` Supabase redirect URL before enabling invitations in production.
- The first request after bootstrap refreshes the session before it uses the new superuser claim for a database operation. This keeps the API’s authorization check and RLS claim in sync.

## API contract now implemented

The API base path is `/api`. Local URL: `http://localhost:8787/api`.

| Request | Response or behavior |
| --- | --- |
| `GET /health` | API process health; does not test database connectivity |
| `POST /auth/register` | Creates an ordinary user; returns `{ user }` or `202` with an email-confirmation message |
| `POST /auth/login` | Sets session cookies and returns `{ user }` |
| `POST /auth/exchange` | Exchanges the Supabase invitation or recovery session returned to the admin app for API-host session cookies |
| `POST /auth/password` | Authenticated invitation or recovery recipient sets a new password and records administrator password setup |
| `GET /auth/me` | Returns `{ user }`, refreshes cookies when needed, or `401` |
| `POST /auth/logout` | Revokes the current refresh token and clears cookies |
| `PUT /auth/email` | Signed-in member starts an email change; requires `currentPassword`. Returns `202` with instructions to confirm in both inboxes. |
| `POST /auth/change-password` | Signed-in member changes password; requires `currentPassword` and a policy-compliant `newPassword`. |
| `GET /admin/me` | Returns the signed-in staff member plus immutable `staff`, `admin`, or `superuser` role; ordinary users receive `403` |
| `GET /admin/invitations` | Superuser-only. Lists invited administrators and whether the portal has recorded password setup. |
| `POST /admin/invitations` | Superuser-only. Sends a Supabase invitation, assigns the invited account the `admin` app-metadata role, and writes an audit record |
| `POST /admin/invitations/:id/resend` | Superuser-only. Sends a replacement password-setup link to an administrator whose setup is incomplete. |
| `GET /admin/users` | Staff-level. Lists Supabase Auth accounts with role, confirmation, sign-in, and blocked status. |
| `PUT /admin/users/:id/role` | Superuser-only. Sets a member or staff account to `member` or `staff`. Superusers cannot be changed here. |
| `GET /admin/users/:id` | Administrator-only. Returns one account plus its adoption applications. |
| `PUT /admin/users/:id` | Updates an authorized target's display name and email. Admin targets require a superuser. |
| `PUT /admin/users/:id/access` | Blocks or restores sign-in for an authorized target. Admin targets require a superuser. |
| `POST /admin/users/:id/password-reset` | Sends an authorized, unblocked target a Supabase recovery email. |
| `DELETE /admin/users/:id` | Hard-deletes an authorized target. Admin targets require a superuser; self and superuser deletion are refused. |
| `GET /admin/pets` | Staff-level. Returns all pet records, including non-public statuses, in name order. |
| `POST /admin/pets` | Staff-level. Creates a validated pet record. Validation failures return `400` with a `fieldErrors` map naming every incorrect field. |
| `PUT /admin/pets/:id` | Administrator-only. Updates a validated pet record. |
| `POST /admin/pets/:id/image` | Administrator-only. Uploads a JPEG, PNG, or WebP image up to 5 MB, updates the pet image path, and removes the replaced image. |
| `GET /admin/applications` | Administrator-only. Returns all adoption applications, including the submitted contact email and review outcome. |
| `PUT /admin/applications/:id` | Administrator-only. Records `In review`, `Approved`, or `Declined` with the reviewing administrator and time. |
| `GET /applications` | Signed-in member only. Returns that member’s adoption applications. |
| `POST /applications/pets/:id` | Signed-in member only. Submits one minimal application for an available pet; duplicate and unavailable-pet submissions are rejected. |
| `GET /foster-applications` | Signed-in member only. Returns that member's foster applications. |
| `POST /foster-applications/pets/:id` | Signed-in member only. Submits a foster application with contact details, household, experience, and a care window for an Available pet with `fosterAvailable`; validation returns `fieldErrors`; duplicates and ineligible pets return `409`. |
| `GET /admin/foster-applications` | Staff-level. Returns all foster applications. |
| `PUT /admin/foster-applications/:id` | Staff-level. Records `In review`, `Approved`, or `Declined` with the reviewer and time; emails the applicant when the status changes. |
| `GET /volunteer/shifts` | Signed-in member only. Upcoming published shifts with `spotsRemaining` and whether the caller is `registered`. |
| `POST /volunteer/shifts/:id/register` | Signed-in member only. Body `{ phone, dateOfBirth }`. `409` with a specific message when the shift is full, duplicated, under the minimum age, overlapping, or unavailable. |
| `GET /volunteer/registrations` | Signed-in member only. The caller's registrations, including shelter-canceled ones. |
| `POST /volunteer/registrations/:id/cancel` | Signed-in member only. Cancels a registration for a shift that has not started. |
| `GET /admin/volunteer-shifts` | Staff-level. All shifts with active participants and contact details. |
| `POST /admin/volunteer-shifts` | Staff-level. Publishes a shift; validation returns `fieldErrors`. |
| `PUT /admin/volunteer-shifts/:id` | Staff-level. Edits an upcoming shift (time and minimum age lock once volunteers register). |
| `POST /admin/volunteer-shifts/:id/cancel` | Staff-level. Cancels the shift and its registrations and emails each volunteer. |
| `POST /quiz` | Signed-in member only. Body is the nine quiz answers plus one to three `traits` and optional `notes`; every unanswered or invalid question returns `fieldErrors`. Compares the answers with up to 60 Available pets through OpenRouter and returns up to five `recommendations` (`pet`, `score` 0–100, `reason`) and saves them. At most 10 runs per member per day (`429`); `503` when AI matching is not configured; `502` when the model fails (nothing is saved, retry is safe). |
| `GET /quiz/latest` | Signed-in member only. The member's latest saved result, re-checked so animals that are no longer Available are dropped, or `{ "result": null }`. |
| `POST /lost-pet/searches` | Signed-in member only, `multipart/form-data` with `species` (Dog, Cat, Other), optional `description` (≤300), and 1–3 `photos` (JPEG/PNG/WebP, ≤5 MB each, checked by file signature). Compares them with up to 24 shelter animals of that species that are not Adopted and have photos, and returns `matches` (limited `pet` view, `confidence`, `reason`) plus a `searchId` when there is something to ask about. At most 5 searches per member per day. A search with no possible match keeps no photos and returns `searchId: null` with a notice. |
| `POST /lost-pet/inquiries` | Signed-in member only. `{ searchId, petId, phone, message }`: asks staff about one of that search's matches. One per search and animal, 10 per member per day. Emails the member and, when `SHELTER_NOTIFICATION_EMAIL` is set, the shelter. |
| `GET /lost-pet/inquiries` | Signed-in member only. The member's inquiries with status (never the staff note). |
| `GET /admin/lost-pet-inquiries` | Staff-level. Inquiries with member contact details, the shelter animal's photo, and 15-minute signed links to the member's uploaded photos. |
| `PUT /admin/lost-pet-inquiries/:id` | Staff-level. Sets `New`, `In progress`, or `Resolved` and a staff note. |
| `POST /admin/lost-pet/purge-expired` | Staff-level. Deletes every expired search, its photos, and its inquiries and returns `{ removed }`. |
| `POST /webhooks/stripe` | Stripe only. Verifies `Stripe-Signature`, then records the donation through `record_donation()`. `400` for a bad or stale signature, `503` when `STRIPE_WEBHOOK_SECRET` is missing, `500` on a database failure so Stripe retries. Unrelated events return `200` with `recorded: false`. |
| `GET /public/donations` | Public. The six newest staff-approved, opted-in, successful live gifts. Returns only a display name, optional message, amount, currency, and time; never donor contact details or Stripe ids. |
| `GET /admin/donations` | Staff-level. Succeeded totals (test and live apart) and the 200 most recent donations. |
| `PUT /admin/donations/:id/publication` | Staff-level. Body `{ publicStatus: "published" | "hidden" }`. Publishes or hides an opted-in successful live gift with a display name. |
| `GET /profile` | Signed-in member only. The member's saved phone, address, and date of birth (each null when not saved). |
| `PUT /profile` | Signed-in member only. Saves those details (any may be empty to clear it); returns `fieldErrors` for an invalid phone, address, or date of birth. Used only to prefill forms. |
| `GET /pets?search=&tag=` | Available pets in name order; universal text search across public pet details plus an optional exact shelter-tag filter; currently limited to 200 rows before text filtering |
| `GET /pets/:id` | One available pet or `404`; IDs are UUIDs |

Staff-facing sections on the admin dashboard: pets, staff invitations (superuser), adoption applications, foster applications, the visit schedule, and volunteer shifts.

The pet API returns `id`, `name`, `type`, `breed`, `age`, `intakeDate`, `daysInShelter`, `tags`, `status`, `summary`, `medicalHistory`, `fosterAvailable`, and `imageUrl`. Its search matches normalized words in a pet's name, description, breed, type, age, tags, status, intake date, and days in shelter. `daysInShelter` is calculated from the stored `intake_date`. Existing pet images live in a public `pet-images` Storage bucket. The bucket is only for public animal photos, never sensitive documents.

The public site still has clearly labeled sample pet listings when the API or database is unavailable. Remove that fallback after real pet data, migration, and end-to-end testing are in place.

## Database model for the report

The implemented DBMS is Supabase-hosted PostgreSQL. The PawHeaven-owned tables currently deployed are `public.pets` and `public.admin_invitation_audit`; `auth.users`, `storage.buckets`, and `storage.objects` are managed by Supabase. Do not describe the following proposed tables as already deployed.

| Table | Key columns and types | Relationships |
| --- | --- | --- |
| `public.pets` (implemented) | `id uuid` PK; `name`, `species`, `breed`, `age_label`, `status`, `summary`, `image_path` as `text`; `medical_history text` (public, default empty); `foster_available boolean`; recorded attributes `sex`, `size`, `color`, `weight_lbs`, `spayed_neutered`, `good_with_kids`, `good_with_dogs`, `good_with_cats`, `energy_level` (all defaulted to "not recorded"); `intake_date date`; `tags text[]`; `created_at timestamptz`. `status` is `Available`, `Pending`, `Adopted`, `Fostered`, or `Unavailable`; only `Available` is public. | `image_path` is a Storage object path, not a SQL foreign key. |
| `public.admin_invitation_audit` (implemented) | `id uuid` PK; `invited_email text`; `invited_user_id uuid` nullable FK; `invited_by uuid` nullable FK; `invited_at timestamptz`; `password_set_at timestamptz` nullable | Server-side invitation audit only. `password_set_at` is written only after the API saves an invited administrator's password. RLS is enabled and neither `anon` nor `authenticated` receives table access. |
| `public.adoption_applications` (implemented) | `id uuid` PK; `applicant_id uuid` FK; `applicant_name`, `applicant_email`, `applicant_phone`, `applicant_address`, `pet_name`, `household_summary`, `adoption_experience`, `note`, `status` as `text`; `applicant_date_of_birth date` (must be 18+ by policy; the contact columns are nullable only so pre-Sprint-4 rows stay valid and the API requires them); `pet_id uuid` FK; `submitted_at`, `reviewed_at` timestamptz; `reviewed_by uuid` nullable FK | A member can read and submit only their own application for an available pet. Administrators can read all applications and update only review fields. One member may submit one application per pet. Deleting the applicant cascades to their applications; deleting a reviewer sets `reviewed_by` null without erasing the recorded outcome or review time. |
| `public.foster_applications` (implemented) | `id uuid` PK; `applicant_id uuid` FK; `applicant_name`, `applicant_email`, `applicant_phone`, `applicant_address`, `pet_name`, `household_summary`, `foster_experience`, `note`, `status` as `text`; `applicant_date_of_birth`, `available_from`, `available_until` as `date`; `pet_id uuid` FK; `submitted_at`, `reviewed_at` timestamptz; `reviewed_by uuid` nullable FK | Same ownership and review rules as adoption applications; inserts require an `Available`, `foster_available` pet, an adult applicant, and a window of at most one year that does not start in the past. One application per member per pet. |
| `public.volunteer_shifts` (implemented) | `id uuid` PK; `title`, `description`, `requirements`, `status` (`published`/`canceled`) as `text`; `min_age`, `capacity` as `integer`; `starts_at`, `ends_at`, `created_at`, `updated_at` timestamptz; `created_by uuid` nullable FK | Staff read all rows; members use `list_volunteer_shifts()` for sanitized availability. Writes only through staff RPCs. |
| `public.volunteer_registrations` (implemented) | `id uuid` PK; `shift_id uuid` FK; `member_id uuid` FK; `member_name`, `member_email`, `member_phone`, `status` (`registered`/`canceled`), `canceled_reason` (`member`/`shift_canceled`) as `text`; `member_date_of_birth date`; timestamps | A member holds one `registered` row per shift (partial unique index). Members read only their own; staff read all; writes only through RPCs. Deleting a member cascades. |
| `auth.users` (Supabase-managed) | `id uuid` PK; `email varchar`; `encrypted_password varchar`; `raw_user_meta_data jsonb` for display name; `created_at timestamptz` | Future user-owned rows reference `auth.users.id`. |
| `public.visit_slots`, `public.appointments`, `public.appointment_events` (planned) | See [visit scheduling plan](docs/visit-scheduling-plan.md). | General shelter visits, independent of adoption applications; not yet implemented. |
| `public.donations` (implemented) | `id uuid` PK; `stripe_session_id text` unique; `stripe_payment_intent`, `currency`, `status`, `donor_name`, `donor_email`, `public_display_name`, `public_message`, `public_status` as `text`; `amount_cents integer`; `livemode`, `public_opt_in` boolean; `stripe_created_at`, `recorded_at`, `updated_at` timestamptz | Written only by `record_donation()` (service role). Staff read the full record; members and visitors cannot read the table. `latest_public_donations()` is the only public projection. |
| `public.member_profiles` (implemented) | `user_id uuid` PK/FK; `phone`, `address` as `text`; `date_of_birth date`; `updated_at timestamptz` | Saved contact details that prefill forms. Only the member can read or change their row (even staff cannot). Applications and registrations still snapshot what was submitted. |
| `public.quiz_responses` (implemented) | `id uuid` PK; `user_id uuid` FK; `answers jsonb` (object); `recommendations jsonb` (array of `petId`, `score`, `reason`); `created_at timestamptz` | A member may take the quiz many times; they read, add, and delete only their own rows. Recommendations never reserve a pet. |
| `public.lost_pet_searches` (implemented) | `id uuid` PK; `member_id uuid` FK; `species`, `description` as `text`; `photo_paths text[]` (0–3 objects in the private `lost-pet-uploads` bucket); `result jsonb`; `created_at`, `expires_at` timestamptz (default 30 days) | Members read and delete their own; staff read and delete all. `expires_at` cannot be set by clients. A search with no match keeps an empty `photo_paths` row only so the daily limit counts it. |
| `public.lost_pet_inquiries` (implemented) | `id uuid` PK; `search_id uuid` FK (cascade); `member_id uuid` FK; `member_name`, `member_email`, `member_phone`, `pet_name`, `message`, `status`, `staff_note` as `text`; `pet_id uuid` nullable FK; `handled_by uuid`, `handled_at`, `created_at` | Created only by `submit_lost_pet_inquiry`, which requires the animal to be one of the caller's unexpired search results and extends retention to 30 days from the inquiry. Staff update status and note through `update_lost_pet_inquiry`. |
| `public.suppliers` (proposed inventory) | `id uuid` PK; `name text`; `email text` nullable; `phone text` nullable | One supplier may provide many inventory items. |
| `public.inventory_items` (proposed inventory) | `id uuid` PK; `supplier_id uuid` nullable FK; `name text`; `category text`; `unit text`; `quantity_on_hand numeric`; `expires_on date` nullable | Each item may have a supplier and many transactions. |
| `public.inventory_transactions` (proposed inventory) | `id uuid` PK; `item_id uuid` FK; `recorded_by uuid` FK; `quantity_change numeric`; `recorded_at timestamptz`; `note text` nullable | Records who changed an item's stock and by how much. |

Proposed foreign keys point to `auth.users(id)`, `public.pets(id)`, `public.adoption_applications(id)`, `public.suppliers(id)`, or `public.inventory_items(id)` as appropriate. The scheduling model is planned in the linked document; quiz and inventory fields remain drafts. The current pet tags are a `text[]` column, not a separate tags table. Days in shelter is calculated from `intake_date` rather than stored.

## Product requirements inventory

1. Accounts, login, and profiles.
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

The report also calls for ten use cases with one requirement each, a user-management diagram, database attributes/keys/relationships, registration/login/logout/session, two major use cases with frontend and logic, command-line instructions, screenshots, and task-board status. Proposed use cases: register, log in/out, browse/filter pets, view details, apply to adopt, schedule visit, matching quiz, lost-and-found, and inventory tracking.

### Sprint 2 feature acceptance notes (report scope, not current implementation)

The report's use-case narratives add the following future-work constraints. They are useful input when the team turns a report feature into a product decision, but they do not authorize a migration or feature by themselves.

- **Animal management:** administrators and superusers can now add and update pet records, including public availability status, descriptive tags, intake date, summaries, and photos. The implementation supports `Available`, `Pending`, `Adopted`, `Fostered`, and `Unavailable` statuses plus a `foster_available` flag and a public `medical_history` text field (added 2026-10-26). The report's generic “staff” actor maps to the implemented administrator roles; there is no third `staff` role.
- **Adoption and foster applications:** a signed-in applicant can now select an available pet, submit validated household/care and pet-care experience/preparedness answers with an optional note, and see their pending confirmation. The account email is the only contact detail copied to the application. The database rejects applications for a pet that is not available or duplicates from the same member. A submission does not reserve a pet or approve a placement; an administrator may record an outcome later without changing pet availability. Since 2026-10-26 the application also collects phone, mailing address, and date of birth (applicants must be 18+). Driver's-license and payment information are deliberately never collected, a documented deviation from the Sprint 3 report for security reasons. Browser `sessionStorage` auto-save covers all fields. Retention/access rules remain undecided. Foster applications (implemented 2026-10-26, Phase 2) are a separate `foster_applications` table: pets open to foster (`status = 'Available'` and `foster_available`) accept one application per member with the same contact fields, a household summary, a foster-experience answer, a required care window (`available_from` not in the shelter-local past, `available_until` on or after it and within one year), and an optional note. The API validates every field and returns `fieldErrors`; the database independently enforces the 18+ rule, the window, eligibility, and one application per member per pet. Staff record In review, Approved, or Declined with the reviewer and time; like adoption, an outcome never changes pet availability, so staff mark the pet Fostered separately. The member sees a pending screen and gets received and outcome emails.
- **Matching and lost-pet flows (implemented 2026-10-26, Phase 3):** see the AI matching section below. The quiz asks nine required questions plus one to three traits and optional notes, recommends at most five currently Available animals with a score and a short reason, saves the latest result, and refreshes it when answers change. Lost-pet matching requires login, validates type, size, and file signature, shows possible matches with a clear "a visual match does not establish ownership" statement, and lets the member send staff an inquiry; staff see inquiries in the portal. Members can also fill out a template and print a lost-pet flyer (`/lost-pet/flyer`); the flyer is built entirely in the browser and nothing is uploaded or saved.
- **Appointments, donations, and volunteers:** scheduling requires published slots, an availability check at confirmation time, reschedule/cancel behavior, and staff visibility of the calendar. Donations require a third-party payment provider and may be recorded only after verified success, with receipt, declined, and pending outcomes. Volunteer shifts (implemented 2026-10-26, Phase 2) provide published duties/requirements and capacity, eligibility and duplicate/conflicting-shift checks, staff participant visibility, and cancellation: see the volunteer entry under Accounts and access. Donations (Phase 4, 2026-10-27) use a Stripe Payment Link: see Donations below.
- **Pet browsing:** the report's visitor-facing acceptance behavior is alphabetical available-pet listings; photos, basic details, length of stay, tag/broad text search, detail views; and an explicit no-results/retry state. The current public directory implements and regression-checks the core browse, alphabetical ordering, length-of-stay, tag/text search, detail, missing-image, and no-results behavior; it also defensively excludes non-available records before rendering. Species/age-specific filters and a real-time update guarantee remain future decisions.

The report's diagram shows `public.pets` linked to public `pet-images` Storage by `image_path`, with `auth.users`, `storage.buckets`, and `storage.objects` managed by Supabase. The current migration enforces a 5 MB upload limit and JPEG, PNG, or WebP MIME types for that public bucket. Its pet status values are `Available`, `Pending`, `Adopted`, `Fostered`, and `Unavailable` (extended 2026-10-26 to match the Sprint 3 report).

## Member and staff experience (2026-10-28)

**Navigation.** The public header is Find a pet (browse, quiz, foster), Get involved (visit, volunteer), Lost a pet?, a Donate button, and one account entry: "Log in" when signed out, or a **My PawHeaven** menu (dashboard, profile and sign-in details, log out) when signed in.

**My PawHeaven (`/me`).** One dashboard gathers everything a member has done: a needs-attention strip (a visit or shift within a day, or an adoption or foster outcome in the last week), upcoming visits and shifts with reschedule and cancel, adoption and foster applications in one list with one status vocabulary, the latest quiz matches (Strong, Likely, Possible bands), lost-pet inquiries, saved contact details, and history. Each section loads independently, so one failing request never blanks the page. `/account` now holds only name, email, and password.

**Saved contact details.** `member_profiles` and `GET`/`PUT /profile` store phone, address, and date of birth once. The adoption, foster, and volunteer forms prefill empty fields from it (a restored draft wins), and a checked-by-default box saves what was typed back, merging so the volunteer form can never erase a saved address. The profile is a convenience only: forms work without it, and submissions snapshot their own values.

**Pet page as the hub.** One panel offers apply to adopt, apply to foster, and schedule a visit (the visit page pre-writes "I would like to meet <name>..."). The forms open in place. A member whose quiz recommended the pet sees why; one without a result sees a prompt to take the quiz. Recorded attributes (sex, size and weight, color, spayed or neutered, good with kids/dogs/cats, energy) are shown only when known, and they are searchable ("black dog") and passed to the matching model. Staff edit them on the pet form; an update that omits them never wipes them.

**Staff portal.** A sidebar (Inbox, Pets, Applications, Visits and volunteers, Lost-pet inquiries, Donations, People) selects a view by URL hash. The Inbox lists what is waiting on staff, oldest first (pending adoption and foster applications, new lost-pet inquiries, shifts starting within three days with nobody signed up), with filters, plus today's visits and shifts, donation totals, and pet counts. Approving an adoption or foster application can also move the pet to Pending or Fostered through an unticked-by-default checkbox (`markPetStatus` on the review request). Outcomes alone still never change a pet, only an Approved review with the box ticked does, and Available is never a valid shortcut.

**Shared code.** Browser helpers (element builder, API client with field errors, status pills, shelter-time formatting) live in `@pawheaven/contracts/ui` and use the `ph-*` classes in each app's `global.css`. API route modules share `rpcErrorResponse` for the Postgres error codes their locked RPCs raise.

## Get Involved suite (2026-10-29)

Visits, volunteer shifts, and fostering are tied together by recurring open hours (weekly patterns generated six weeks ahead by an hourly Worker cron, in America/New_York), a single staff Schedule calendar with drag-to-create and copy-week, visit capacity (several groups per slot) with party size and the animals a visitor wants to meet, open-house events that create visits, volunteer roles, and featured pets together, pet quick actions with bulk edit (`set_pet_flags`: foster, visits, walkers), a foster pool that staff can email for a pet that needs a home (one-click accept files a pre-filled application), volunteer-to-foster invitations, a public `/get-involved` feed, a member schedule with `.ics` export, 24-hour reminder emails, and a staff "needs attention" report. Everything staff-side is gated by `is_staff()`; the cron uses the service role. Details, the staff how-to, and file map: [docs/get-involved.md](docs/get-involved.md).

Shelter status (requirements 10 and 11): staff set kennels per species group (Dog, Cat, Other, with held-back kennels) and flag animals as needing help with one of four public reasons (`pets.help_reason`, `set_pet_help`). Guests read only counts and levels through `get_shelter_status()` (`GET /public/shelter-status`), which drive a banner at 85 percent and above, a "Needs help most" row, a "Needs help first" sort, and card badges. Nothing is flagged automatically; `staff_attention()` suggests candidates. Details: [docs/shelter-status.md](docs/shelter-status.md).

Email alerts and newsletter (requirements 3 and 8): members sync saved animals across devices (`saved_pets`), save directory filters as searches (`saved_searches`), and choose which optional email they get (`member_email_prefs`, `email_subscribers`, foster alerts). A trigger on `pets` queues new-match and saved-animal-change rows in `notification_outbox`; staff write newsletters in the portal's Outreach page. The hourly Worker job drains the queue in batches (`runOutbox`), one digest per person per day at 8 am shelter time. Every optional email has a signed one-click-page unsubscribe. Details: [docs/email-alerts.md](docs/email-alerts.md).

## Theming (2026-10-28)

One file, `packages/contracts/src/theme.css`, restyles the public site and the staff portal. Plain `--ph-*` variables define brand and status colors, surfaces, text and line colors, fonts, root text size, the spacing unit, corner radius, shadow, focus ring, and page and reading widths. Its `@theme` block points Tailwind's own variables (the neutral `stone` scale, `white`, `red`, `amber`, `green`, `moss`, `--font-sans`, `--spacing`, container widths, `--shadow-md`) at those variables, so every existing utility class follows the theme without being rewritten. `bg-white` means "surface" and `text-on-brand` means "text on a brand color". A `[data-theme="name"]` block overrides only the variables that differ; seven themes ship (default Moss, Ocean, Sunset, Lavender, Dark, Midnight, High contrast), listed in `THEMES` in `site.ts`. `PUBLIC_THEME` selects one at build time, and `PUBLIC_THEME_SWITCHER=true` adds a demo picker (site footer, portal header) that remembers the choice in the browser. `/theme` is a `noindex` playground that edits the variables live and generates the CSS to paste back. Site name and footer tagline are in `packages/contracts/src/site.ts`. The lost-pet flyer pins black-on-white so a printout is always legible. `npm run qa:theme` (in `npm run check`) fails on a hardcoded color, an unmapped Tailwind color, an undefined `--ph-*` variable, or an alternate theme that overrides an unknown one, if `THEMES` and the CSS disagree, or if any theme's text, button, link, and status-box colors fall below WCAG AA contrast (form field borders must reach 3:1). Full guide: `docs/theming.md`.

## AI matching

Both AI features call OpenRouter through one module (`apps/api/src/lib/openrouter.ts`); route code never talks to a provider directly. Requests ask for strict JSON-schema output, send `provider.data_collection: "deny"` so providers that retain or train on data are excluded, and require providers that honor structured output. The default model is `anthropic/claude-haiku-5.5` (about $0.10 per million input tokens) with `google/gemini-2.5-flash-lite` as the OpenRouter fallback; override with `OPENROUTER_QUIZ_MODEL` and `OPENROUTER_VISION_MODEL` (the vision model must accept images). The key is the `OPENROUTER_API_KEY` Worker secret, never in source control. Without it both features answer `503` "not available" and the rest of the site is unaffected.

The `confidence` and quiz `score` numbers are the model's own estimates, not measurements (an identical photo can come back anywhere from about 88 to 98), so the lost-pet UI shows a band (Strong 85+, Likely 65–84, Possible below) and the model's reason, never a percentage. The photo comparison is a vision-language model judging visible features, not pixel or hash comparison, which would miss almost every genuine owner photo.

Safety rules: models see short refs (`P1`, `C3`), never database ids, and any ref the model returns that was not offered is discarded, so a model cannot recommend an unavailable or invented animal. Member notes, descriptions, and pet text are treated as untrusted data in the prompt. Scores are clamped, reasons capped at 240 characters and rendered as text. Daily limits (quiz 10, photo searches 5, inquiries 10) are enforced from database rows so they hold across Worker instances. A failed model call returns `502` and is safe to retry.

Lost-pet privacy: uploaded photos are personal data and live only in the private `lost-pet-uploads` bucket, in a per-member folder. When a search finds nothing (or the model fails) the photos are deleted immediately. When it finds possible matches they are kept so staff can verify an inquiry, and expire 30 days after the search or its last inquiry. Candidate animals are every non-Adopted shelter animal with a photo, read through the narrow `lost_pet_candidates` function, so a member never gains read access to non-public pet rows or their medical notes. Because the API deliberately holds no service-role key for this feature, expiry is enforced by the API deleting a member's own expired data whenever they search and by a staff "Delete expired photos and inquiries" button; a scheduled sweep would need a privileged key and is a deliberate follow-up decision for the project owner.

## Donations

`/donate` explains the gift and sends the visitor to a Stripe-hosted Payment Link (`apps/web/src/lib/donate.ts`; a `/test_` link shows a test-mode notice with Stripe's test card and moves no real money). Stripe handles the amount, contact and card details, takes the payment, and emails the receipt, so PawHeaven never sees card data and has no PCI scope. In Stripe, the Payment Link's "After payment" setting must redirect to `https://pawheaven.online/donate/thanks` (and `http://localhost:4321/donate/thanks` for local testing).

`/donate/thanks` is a static thank-you page, marked `noindex`. Anyone can open that URL, so it cannot prove a payment happened: it never shows an amount or claims a receipt was issued to a specific person.

**Recording (implemented 2026-10-27):** Stripe sends `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed` to `POST /api/webhooks/stripe`. The API trusts a request only after its `Stripe-Signature` verifies (HMAC-SHA256 over `<t>.<raw body>` with the `STRIPE_WEBHOOK_SECRET` Worker secret, constant-time compare, 5-minute timestamp tolerance, 256 KB body cap). Only one-time `payment` Checkout Sessions are recorded; other events are acknowledged and ignored. The route is the single exception to the "browser writes need an Origin" rule because Stripe's server sends none. A verified event calls `record_donation()` with the service-role key (the second documented use of `ADMIN_SUPABASE_SERVICE_ROLE_KEY`; see `AGENTS.md`). That function is executable only by `service_role`, is idempotent per Checkout Session, and never moves a donation backwards, so Stripe's retries, replays, and out-of-order events are safe: pending becomes succeeded or failed, and succeeded is final. A database failure returns `500`, which makes Stripe retry, so a confirmed gift is not lost.

`public.donations` stores the Stripe session and payment-intent ids, amount in cents, currency, status (`pending`, `succeeded`, `failed`), donor name and email as given at checkout, `livemode`, and timestamps. No card data ever reaches PawHeaven. Staff alone can read it (`GET /admin/donations` and the portal's Donations section, which totals succeeded gifts and keeps test-mode and live money apart); nobody can write it from the browser. Donor emails are personal data; a retention rule for them is still to be decided.

**Supporter wall (implemented 2026-10-31):** After the API and database deployment, the Payment Link must include these three custom fields: required dropdown `supporter_opt_in` with values `yes` and `no`; optional text `supporter_display_name` (80 characters); optional text `supporter_message` (240 characters). The labels must explain that a name, amount, and optional message may be shown publicly only if the donor chooses `yes`, and should not contain personal information. The verified webhook recognizes only those stable keys. An opt-in starts as `pending`; staff review the exact submitted text in Donations and choose Published or Hidden. Only successful **live** gifts with an opt-in and display name can be published. `/donate` shows at most the six newest published gifts through the narrow `latest_public_donations()` projection, which excludes billing names, email, Stripe identifiers, and test-mode gifts. Never configure the Payment Link fields before this code is deployed, or early submissions will not be captured.

Still open: a wishlist, a PawHeaven-sent thank-you email (Stripe's own receipt is the confirmation today), and offering more than one payment service (Sprint 3 requirement 9 mentions "different third-party payment services").

## Transactional email

The API sends transactional email through Resend (`apps/api/src/lib/email.ts`, templates in `email-templates.ts`) from `PawHeaven <notifications@pawheaven.online>`; `pawheaven.online` is verified in Resend. Email is best-effort and runs after the response (`ctx.waitUntil`), so a mail outage never undoes a booking or review. Implemented messages: visit booked/rescheduled/canceled, adoption application received and outcome recorded, foster application received and outcome recorded, volunteer shift registered/canceled, volunteer shift canceled by the shelter, and lost-pet inquiry received (member, plus the optional shelter address). Supabase Auth emails (confirmation, recovery, invitations) are separate and use the SMTP integration configured in Supabase.

Secrets and configuration: `RESEND_API_KEY` is a Cloudflare Worker secret (never in source control); `EMAIL_FROM` optionally overrides the sender. Without a key, or in local development, messages are logged instead of sent, because seeded addresses are unreachable. Set `EMAIL_LOCAL_DELIVERY="true"` in the ignored `apps/api/.dev.vars` to exercise real delivery locally, preferably to Resend's `delivered@resend.dev` test recipient.

## Sprint 4 phased delivery (decided 2026-10-26)

One pull request per phase. Phase 1 (foundation): API split into route modules, Resend email, `staff` role, password policy and self-service email/password change, pet medical history/statuses/foster flag with field-level validation, adoption contact fields. Phase 2 (implemented 2026-10-26): foster applications and volunteer shifts, including their staff review screens. Phase 3 (implemented 2026-10-26): AI pet-matching quiz and lost-pet photo matching through OpenRouter, staff inquiry review, and a printable lost-pet flyer. Phase 4 (in progress, 2026-10-27): donations through a Stripe Payment Link (test mode) with `/donate`, `/donate-success`, and webhook-verified recording into `public.donations`, plus the first hardening step (response security headers). Remaining hardening is listed under Next work. Each phase's migrations are expand-only so the previously deployed API keeps working until the new API deploys.

## Demo readiness

- `supabase/seed.sql` creates eleven local-only varied pet records (with medical history, foster flags, and Fostered/Unavailable examples) and three local-only demo accounts (applicant, staff, superuser) whenever `npm run db:reset` runs. Baxter is an available `big-dog` listing; Rosie (`Pending`) and Theo (`Adopted`) verify that public browse results exclude non-available animals. The accounts are intentionally documented only in `docs/demo-runbook.md` and must never be used outside the local Docker stack. It also seeds four relative-date volunteer shifts (a kennel shift and a laundry shift that overlap for the time-conflict message, a dog-walking shift with an 18+ minimum age, and an adoption-event shift that is already full) so the Phase 2 volunteer flows work immediately after reset.
- On 2026-10-20, the production owner verified the deployed Supabase tables, Auth URL configuration, email confirmation, and `pet-images` bucket in the dashboard. The owner then seeded ten non-sensitive animal records and four relative future visit slots (three published, one withdrawn) through the production SQL Editor. No production Auth user, password, application, or booking was created for the demo; see `docs/production-demo-runbook.md`.
- `npm run qa:demo` is an API-level local verification run. It creates a disposable local applicant and covers discovery, authorization boundaries, invalid/missing answers, duplicate and unavailable-pet rejection, expired-session rejection, staff review, outcome visibility, and logout. It refuses non-loopback API URLs.
- `docs/demo-runbook.md` provides the two-to-three-minute presentation flow and a screenshot checklist. It explicitly calls out that a review outcome does not alter pet availability; staff make that separate decision.

## Next work

- Hardening still open: rate limiting for login and sign-up (best done as a Cloudflare rate-limiting rule), pagination and SQL-side search for pets (the API caps listings at 200 before text filtering), image optimization, a scheduled lost-pet expiry sweep (needs a privileged key decision), an application-record retention rule, and a cleanup migration for legacy `admin` accounts. The static Workers send `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS through `public/_headers`; a Content-Security-Policy is deliberately not set yet because the Astro pages use inline scripts.

- On 2026-10-06, four available dog listings (Maple, Milo, Nala, and Pepper) were seeded and paired with public `pet-images/seed/` JPEGs; the browser fallback data mirrors those listings.
- Configure the team's public and API custom domains, exact API allowed origins, matching Worker Preview triggers, and Supabase Auth redirect URL. Deploy each Worker independently.
- Add an administrator-facing applicant communication process and a retention decision for application records. Run the newly implemented appointment migration, RLS tests, and browser journey against the local Docker database before deployment; the plan is in [the visit scheduling plan](docs/visit-scheduling-plan.md).
- Add pagination beyond 200 pets, image optimization, request rate limiting, and a stronger session strategy if traffic or security needs grow.
- Complete the report's database and screenshot requirements with the updated Postgres decision.

## Team commands

From the Git repository root: `npm install`, then run `npm run db:start`, `npm run db:reset`, `npm run db:configure-api`, `npm run dev:api`, and `npm run dev:web` in separate terminals. Open the public app on `http://localhost:4321`. Run `npm run check` before merging. See `README.md` for the local-only Supabase workflow.
