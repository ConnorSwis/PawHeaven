# PawHeaven demo runbook

This kit is for the local Docker-backed demo only. It never creates hosted
accounts, changes production data, or supplies production credentials.

For the live hosted deployment, use [production-demo-runbook.md](production-demo-runbook.md)
instead. Do not run the local reset command against, or expect it to update,
the production project.

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
visible to the administrator only and prove public availability boundaries. It
also loads three future America/New_York shelter visit times for scheduling.

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
duplicate rejection, visit booking/rescheduling/cancellation confirmations,
staff scheduling, expired-session rejection, application review, outcome
visibility, and logout. It refuses non-loopback URLs.

For database policy coverage, also run:

```sh
npm run db:test
npm run qa:discovery
```

## Two-to-three-minute presentation

1. **0:00 — staff schedule:** Sign in at `http://localhost:4322` as the demo
   administrator. Show the seeded future visit times and publish one new
   non-overlapping time in the America/New_York form.
2. **0:25 — discovery:** Open `http://localhost:4321/pets?tag=big-dog` in a
   separate browser profile. Show Baxter, then open the detail page.
3. **0:45 — booking:** Sign in at the public site as the demo applicant, open
   `http://localhost:4321/visits`, choose a time and enter a visit purpose.
4. **1:10 — confirmation:** Open the public account page. Show the confirmed
   time, then reschedule or cancel it to demonstrate immediate confirmation
   history and fresh availability.
5. **1:35 — staff schedule:** Return to the administrator portal and refresh
   the schedule to show an active booking's visitor contact and purpose. A
   booked time cannot be withdrawn.
6. **2:00 — adoption path:** Return to Baxter. Complete both required answers
   and optionally add a note. An administrator can record an outcome without
   changing pet availability.

Reset the local database before another presentation so the application starts
in the expected pending state.

## Screenshot checklist

Capture these local pages after reset for a report or slide deck:

1. `01-admin-visit-schedule.png` — published and open visit times in the
   administrator portal.
2. `02-public-visit-booking.png` — `/visits` with available times and purpose.
3. `03-account-visit-confirmation.png` — the member's appointment and history.
4. `04-admin-booked-visit.png` — an administrator's booked visit details.
5. `05-public-big-dog-search.png` — `/pets?tag=big-dog` with Baxter visible.
6. `06-application-form.png` — Baxter’s signed-in application form.

Do not capture real applicant information or production URLs.
