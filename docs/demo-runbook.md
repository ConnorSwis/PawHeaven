# PawHeaven demo runbook

This kit is for the local Docker-backed demo only. It never creates hosted
accounts, changes production data, or supplies production credentials.

## Reset and start

From the repository root, reset the local data. This is safe to repeat before
the group is called; it restores every scripted demo state and never changes
the hosted project.

```sh
npm run demo:reset
```

Then start the three apps in separate terminals:

```sh
npm run dev:api
npm run dev:web
npm run dev:admin
```

The reset loads 14 varied listings: 12 available pets across dogs, cats,
rabbits, and a guinea pig; Baxter has the `big-dog` tag. Rosie (`Pending`) and
Theo (`Adopted`) are visible only to administrators and prove the public
availability boundary. It also loads three open future America/New_York visit
times, one booked time with no private details exposed publicly, and one
withdrawn time visible only on the staff schedule. A separate, pending Poppy
application makes the administrator review panel useful before a live
application is submitted.

## Local-only demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Applicant | `demo.applicant@pawheaven.local` | `DemoApplicant-2026!` |
| Administrator | `demo.admin@pawheaven.local` | `DemoAdmin-2026!` |

The reset also creates `demo.review@pawheaven.local` and
`demo.visitor@pawheaven.local` solely as reference data for the pre-seeded
pending application and booked visit. The presenters do not need to sign in as
either account. All four accounts exist only in the local Docker database.

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

## Five-minute, five-presenter live flow

Use two separate browser profiles or browsers before the group is called: one
public-site session signed in as the demo applicant, and one administrator
session signed in as the demo administrator. The API cookie is shared by tabs
in one browser profile, so two ordinary windows in the same profile are not
enough. Keep an optional signed-out public `/pets?tag=big-dog` tab in an
incognito or third profile. Do not share the screen while typing a password.
The complete handoff script is in [presentation-flow.md](presentation-flow.md).

| Time | Presenter | Live action | What it proves |
| --- | --- | --- | --- |
| 0:00–0:35 | 1 | Introduce PawHeaven and the public site, API, and Postgres/Supabase database. | Product purpose and connected architecture. |
| 0:35–1:15 | 2 | Show the `big-dog` search, Baxter’s detail page, and the broader directory. | Public browse/filter/detail data is read from the database. |
| 1:15–2:05 | 3 | On Baxter, submit the required adoption answers as the demo applicant. | A validated form writes an application row. |
| 2:05–3:00 | 4 | Book an open visit, then show its confirmation on Account. | Transactional booking and account-visible history. |
| 3:00–4:30 | 5 | Refresh the admin dashboard; show the new application and booked visit, set the application to `In review`, and point out the seeded records. | Administrator-only reads/writes and the same data appearing across front end and tables. |
| 4:30–5:00 | 1 | State the database safeguards: public users see available pets only; bookings prevent double booking; roles protect staff data. | Clear close tied to database functionality. |

If time becomes tight, skip rescheduling/cancellation and publishing a new
slot. A single successful application plus a single booking and staff refresh
is the strongest database round trip for a five-minute slot.

Reset the local database before another presentation so the application starts
in the expected pending state.

## Screenshot checklist

Capture these local pages after reset for a report or slide deck:

1. `01-public-big-dog-search.png` — `/pets?tag=big-dog` with Baxter visible.
2. `02-application-form.png` — Baxter’s signed-in application form.
3. `03-public-visit-booking.png` — `/visits` with available times and purpose.
4. `04-account-visit-confirmation.png` — the member’s appointment and history.
5. `05-admin-application-review.png` — pending Poppy application in the portal.
6. `06-admin-booked-visit.png` — a booked visit’s staff-only details.

Do not capture real applicant information or production URLs.
