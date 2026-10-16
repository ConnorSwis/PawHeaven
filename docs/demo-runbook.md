# PawHeaven demo runbook

This kit is for the local Docker-backed demo only. It never creates hosted
accounts, changes production data, or supplies production credentials.

## Reset and start

From the repository root, reset local data and start the three apps in separate
terminals:

```sh
npm run db:start
npm run db:reset
npm run db:configure-api
npm run dev:api
npm run dev:web
npm run dev:admin
```

The reset loads six varied listings: four available pets, Baxter with the
`big-dog` tag, Rosie in `Pending`, and Theo in `Adopted`. The latter two are
visible to the administrator only and prove public availability boundaries.

## Local-only demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Applicant | `demo.applicant@pawheaven.local` | `DemoApplicant-2026!` |
| Administrator | `demo.admin@pawheaven.local` | `DemoAdmin-2026!` |

These accounts exist only in the local database created by `npm run db:reset`.
Do not reuse the email addresses or passwords outside this demo.

## Verification

Once the local API is running, execute:

```sh
npm run qa:demo
```

The verifier creates a disposable local applicant, then confirms public
discovery, unavailable-pet hiding, member/admin boundaries, required answers,
duplicate rejection, expired-session rejection, application review, outcome
visibility, and logout. It refuses non-loopback URLs.

For database policy coverage, also run:

```sh
npm run db:test
npm run qa:discovery
```

## Two-to-three-minute presentation

1. **0:00 — staff record:** Sign in at `http://localhost:4322` as the demo
   administrator. Open Baxter and make a small, reversible summary edit; save
   it to show the protected staff workflow.
2. **0:25 — discovery:** Open `http://localhost:4321/pets?tag=big-dog` in a
   separate browser profile. Show Baxter, then open the detail page.
3. **0:45 — sign-in prompt:** While signed out, point out the clear “Log in to
   apply” action. Sign in at the public site as the demo applicant.
4. **1:05 — application:** Return to Baxter. Complete both required answers
   and optionally add a note. Submit and show the pending confirmation.
5. **1:35 — review:** Return to the admin portal, open the application queue,
   and choose `In review`, `Approved`, or `Declined`. The applicant’s account
   page reflects the recorded outcome.
6. **2:05 — visibility effect:** In the admin portal, update Baxter to
   `Pending`, then refresh the public directory to show it disappear. Explain
   that review outcomes intentionally do *not* change pet availability; staff
   make that separate shelter decision.

Reset the local database before another presentation so the application starts
in the expected pending state.

## Screenshot checklist

Capture these local pages after reset for a report or slide deck:

1. `01-admin-pet-record.png` — Baxter’s editable staff record.
2. `02-public-big-dog-search.png` — `/pets?tag=big-dog` with Baxter visible.
3. `03-application-form.png` — Baxter’s signed-in application form.
4. `04-pending-confirmation.png` — confirmation immediately after submit.
5. `05-admin-review.png` — administrator application queue and status control.
6. `06-public-availability-change.png` — refreshed public directory after
   Baxter is set to `Pending`.

Do not capture real applicant information or production URLs.
