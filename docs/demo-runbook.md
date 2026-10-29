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
npm run db:images   # optional: fetches the imported shelter photos into local Storage
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

11. **5:00 — one home for members:** Sign in as the demo applicant and open
    **My PawHeaven** from the header menu. Add contact details once, then open
    any available pet: the adoption and foster forms are prefilled. Show the
    single action panel on the pet page, and the dashboard's applications,
    visits, shifts, and matches in one place.
12. **5:45 — one inbox for staff:** Sign in at `http://localhost:4322` and show
    the sidebar and Inbox. Approve a foster application with "Also mark ...
    Fostered" ticked to show the opt-in shortcut, and search `black dog` on the
    public site to show attribute search.

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
13. `13-my-pawheaven.png` — the member dashboard.
14. `14-pet-page-hub.png` — the pet page action panel and attributes.
15. `15-staff-inbox.png` — the staff sidebar and inbox.

Do not capture real applicant information or production URLs.

## Lively demo data and imported animals

`db:reset` also loads `supabase/seed-lively.sql` (12 demo members with
password `DemoMember-2026!`, visit slots, ~95 volunteer shifts with signups,
adoption/foster applications, lost-pet searches, quiz results, test donations)
and `supabase/seed-dekalb.sql` (31 animals from DeKalb County Animal Services,
shown with credit and a link back). Run `npm run db:images` after every reset
to download their photos into local Storage; photos are never committed
(`.cache/` is ignored). Imported animals are browse-only and are excluded from
lost-pet photo matching. This data is local only; do not push it to production
without the shelter's say-so. Regenerate the seed from a listing-saver export
with `node scripts/build-dekalb-seed.mjs path/to/animals.json`.

## Get Involved demo path

Sign in as `demo.staff@pawheaven.local`: **Inbox** shows Needs attention; **Schedule** shows the week (drag to add, copy the week, edit open hours, close a day); **Pets → Quick actions** opens several pets to foster at once; **Foster pool** asks approved fosters for help. As a member, open `/get-involved`, book a visit that names a pet and a party size, then open **My PawHeaven** to see the schedule, download the calendar, and answer a foster request. See [get-involved.md](get-involved.md).

## Making the site look used

`npm run db:reset` seeds roughly two months of future activity (open hours generated nine weeks ahead, four events, bookings, and volunteer sign-ups spread through December). To add live-looking traffic on top, run `npm run demo:activity -- --accounts=8`: it creates new members through the real API (password `DemoMember-2026!`), and each one saves a profile, books a visit that names animals, signs up for shifts, applies to adopt and foster, and sometimes reschedules or cancels. Staff then review applications, approved fosters join the alert pool, and the shelter asks the pool for a foster. Add `--ai` to include the AI quiz, and set `DEMO_STRIPE_WEBHOOK_SECRET` to record test donations. It refuses to run against anything but a local API.
