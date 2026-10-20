# PawHeaven deadline-day presentation flow

This is a five-minute live demonstration for five group members. Each person
owns one visible moment, but the story is a single journey: discover a pet,
apply, book a visit, then let staff see and update the new data.

## Before the group is called

1. From the repository root, run `npm run demo:reset`.
2. Start the API, public site, and admin portal with the three commands in
   [the demo runbook](demo-runbook.md#reset-and-start).
3. Run `npm run qa:demo`. If it passes, leave every server running; do not run
   it again after presenters begin because it deliberately changes local data.
4. Use two cookie-isolated browser sessions (for example, Chrome plus Firefox,
   or a normal window plus an incognito window). The local API session cookie
   is shared across tabs in one browser profile, so a public applicant and
   administrator cannot stay signed in together in ordinary windows of the
   same profile.
5. Open these tabs before screen sharing:
   - optional signed-out public tab: `http://localhost:4321/pets?tag=big-dog`
   - public session, signed in as `demo.applicant@pawheaven.local`: Baxter’s
     detail page, `/visits`, and `/account`
   - separate admin session, signed in as `demo.admin@pawheaven.local`:
     `http://localhost:4322`
6. Hide the password-manager pop-up and stop screen sharing while entering
   local demo credentials. Keep the administrator tab separate from the public
   member tab.

## Speaker script and handoffs

| Speaker | Time | Say | Do | Handoff |
| --- | --- | --- | --- | --- |
| 1 — Product and architecture | 0:00–0:35 | “PawHeaven helps a shelter publish adoptable pets, collect adoption interest, and organize shelter visits. The public and staff sites call one API, which stores the shared data in PostgreSQL through Supabase.” | Point to the public pet directory. Keep any architecture slide to one simple diagram: Public/Admin UI → API → Postgres. | “First, here is what a visitor sees.” |
| 2 — Discovery | 0:35–1:15 | “The directory is backed by live pet rows. Search and filters run on available records, so pets in Pending or Adopted status stay hidden publicly.” | Show `big-dog`, Baxter, then click the Baxter detail page. If needed, clear the filter to reveal the varied catalog. | “Once a visitor finds a pet, they can submit a signed-in application.” |
| 3 — Adoption application | 1:15–2:05 | “This form requires a household/care answer and an experience/preparedness answer. Submit validates the browser input, then creates one application tied to this account and pet.” | In the signed-in Baxter tab, complete both required answers with this short text and submit: “We have a calm household, a fenced exercise area, and time for daily walks.” / “We have cared for dogs before and will follow the shelter’s transition guidance.” | “The same database also protects a visit booking from double booking.” |
| 4 — Visit appointment | 2:05–3:00 | “The visitor selects an open time and provides a purpose. The database checks that it is still future and available, records the booking, and adds an in-app confirmation history item.” | In `/visits`, select the first open time, type “We would like to meet the animals and learn about adoption,” and book. Open `/account` to show the appointment and confirmation. | “Staff now see exactly that new booking and application.” |
| 5 — Staff review | 3:00–4:30 | “The administrator dashboard reads the same records but exposes staff-only information. It includes a pre-seeded pending Poppy application and our just-submitted Baxter application.” | Refresh the admin tab. Scroll to Adoption applications and change the new Baxter application to `In review`; then show Shelter visit schedule with its visitor contact/purpose. Point out a booked time cannot be withdrawn and the withdrawn seeded time stays off the public list. | “That closes the round trip from public input to secure staff workflow.” |
| 1 — Close | 4:30–5:00 | “Our five completed use cases are browsing pets, account access, adoption applications, visit scheduling, and staff management. Database policies keep staff data private, prevent duplicate booking, and make the same update visible across both interfaces.” | Return to the simple architecture slide or pause on the admin update confirmation. | “Thank you.” |

## Recovery plan

- **A presenter lands on an unexpected state:** move to the next seeded
  screen; the staff portal already contains a pending application and booked
  visit to show the database relationship.
- **An action fails or time is low:** say what the server-side rule rejected
  (for example, a slot was already booked), show the visible error, and move
  to the existing staff record. This still demonstrates database validation.
- **Anything becomes messy:** stop the demo, run `npm run demo:reset`, restart
  the three dev servers, and sign in again. Never use a hosted account or
  production data for the classroom demo.

## What to emphasize if asked

- PostgreSQL tables are created reproducibly by the committed Supabase
  migrations, and `npm run demo:reset` rebuilds the local database from them.
- The UI never calls the database directly: both frontends call the API.
- Row-level policies and database functions enforce public availability,
  member ownership, administrator roles, and one active booking per visit
  slot.
- Application outcomes do not automatically change a pet’s availability; that
  is a deliberate staff decision.
