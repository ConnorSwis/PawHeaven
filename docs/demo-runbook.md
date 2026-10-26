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

The reset loads eleven varied listings: eight available pets (including Baxter
with the `big-dog` tag and several open to foster), Rosie in `Pending`, Theo in
`Adopted`, Daisy `Fostered`, and Pearl `Unavailable`. Everything except the
available pets is visible to staff only and proves public availability
boundaries. Each listing carries a public medical summary. It
also loads three future America/New_York shelter visit times for scheduling and
four volunteer shifts: Kennel care (4 spots), Laundry and supplies (overlaps
Kennel care), Dog walking (18+), and an Adoption event greeter shift that is
already full (the demo superuser holds its only spot).

## Local-only demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Applicant | `demo.applicant@pawheaven.local` | `DemoApplicant-2026!` |
| Staff | `demo.staff@pawheaven.local` | `DemoStaff-2026!` |
| Superuser | `demo.superuser@pawheaven.local` | `DemoSuperuser-2026!` |

Staff manage pets, applications, the visit schedule, and member accounts.
The superuser can also manage staff accounts, invite staff, and assign the
staff role from the Users page.

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
staff scheduling, foster application validation and review, volunteer
registration rules (capacity, minimum age, overlap, duplicate, cancellation,
shift cancellation), quiz and lost-pet validation, limits, and (with a key) live matching, expired-session rejection, application review, outcome
visibility, and logout. It refuses non-loopback URLs.

For database policy coverage, also run:

```sh
npm run db:test
npm run qa:discovery
npm run qa:ai
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

7. **2:30 — foster:** On a pet badged "Open to foster" (Baxter, Arlo, Miso,
   and others), complete the foster form, including the dates you can provide
   care. Show the validation message when the end date precedes the start,
   then review the application in the administrator portal's Foster
   applications section.
8. **3:00 — volunteering:** Open `http://localhost:4321/volunteer`. Sign up
   for Kennel care, then try Laundry and supplies (time-conflict message),
   Dog walking with a minor's date of birth (age message), and the full
   Adoption event shift. In the administrator portal's Volunteer shifts
   section, show the participant list, then cancel the shift to cancel the
   registration and email the volunteer.

9. **3:30 — AI matching:** Open `http://localhost:4321/quiz` as the demo
   applicant, answer the questions, and show the recommended animals with
   their reasons. Change an answer and resubmit to show the update. This and
   the next step need `OPENROUTER_API_KEY` in `apps/api/.dev.vars`.
10. **4:15 — lost pet:** Give Baxter a shelter photo from the administrator
    portal (use `assets/demo-pets/baxter.jpg`), then open
    `http://localhost:4321/lost-pet`, upload the same photo as a Dog, and send
    staff an inquiry about the match. Show the inquiry, the member's photo,
    and the status control in the portal's Lost-pet inquiries section, then
    open `/lost-pet/flyer`, fill in the template, and print it.

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
7. `07-foster-application-form.png` — Baxter’s foster application form.
8. `08-public-volunteer-shifts.png` — `/volunteer` with open and full shifts.
9. `09-admin-volunteer-shifts.png` — the administrator's shift form and participant list.
10. `10-pet-quiz-results.png` — recommendations with reasons.
11. `11-lost-pet-matches.png` — possible matches with the ownership notice.
12. `12-lost-pet-flyer.png` — the printable flyer template.

Do not capture real applicant information or production URLs.
