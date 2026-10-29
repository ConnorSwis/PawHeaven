# Get Involved: visits, volunteering, and fostering together

Visits, volunteer shifts, and foster homes share one schedule, one set of pet quick actions, and one
"needs attention" list. This page is the staff how-to and the map of what was built.

## For staff (portal sidebar)

| Where | What you can do |
| --- | --- |
| **Inbox → Needs attention** | A short list of gaps with a one-click fix: no open visit times in the next 7 days (fill them in), shifts with nobody signed up, pets here more than 45 days that are not open to foster (open them all), foster windows ending within a week, foster requests with no takers after 48 hours, and volunteers who could be invited to foster. |
| **Schedule** | One week calendar of visit times (green), volunteer shifts (amber), and open houses (outlined). Drag across empty space, or press **Add…**, to create visit times, a shift, or an open house. Click an item to see who booked it, change a visit time's capacity, or withdraw it. **Copy this week to the next** repeats the week. |
| **Schedule → Open hours** | Weekly patterns ("Tuesdays 4 to 7 pm, two groups per half hour") that fill in the next 6 weeks automatically, every hour. **Days closed** removes unused generated times for a holiday and keeps anything already booked. Tick **Repeat every week** when you add a visit time or shift to turn it into a pattern. Edited or withdrawn generated items are never overwritten. |
| **Schedule → Add… → Open house** | One form creates the visit capacity, the volunteer roles ("Greeters x 3"), and the featured animals together. Unbooked visit times it overlaps are replaced. |
| **Pets** | The one pet list has the quick actions built in: per-pet buttons and bulk buttons (tick several pets) to open or close foster, open or hide for visits, and mark needs walkers or covered. |
| **Foster pool** | Ask the pool for a foster: the pet is opened to foster, marked "Foster needed now", and every approved foster who opted in is emailed. Members accept in one step and you approve the application they file. The same view lists volunteers with five or more finished shifts who never applied, with an **Invite to foster** button. |
| **Visit and shift lists** | Read-and-manage lists, not creation: upcoming visit bookings (who, party size, which animals) and volunteer shifts with sign-ups, where you edit a shift's duties or times or cancel it. New visit times and shifts are added on **Schedule**. |
| **Donations** | Totals, a chart of donations over time (daily or weekly, with a running total and a live-only filter), and every gift. |

## For visitors and members

- **`/get-involved`** shows what is open now: upcoming events with featured pets, open visit times, volunteer shifts with spots left, and how many animals are open to foster (plus any needed now).
- **`/visits`** now lets a visitor pick the animals they want to meet (up to five, or arrive from a pet page with one ticked) and the party size (1 to 6). A visit time can hold several groups; the page shows places left.
- **Pet pages** show "Foster needed now" and "Needs walkers" notes and link to the right place. A pet staff hide from visits no longer shows the visit button.
- **My PawHeaven** gets a **My schedule** card (visits, shifts, and approved foster placements together) with **Add to calendar (.ics)**, **Foster requests** cards with one-click Accept or Not now, and a **Your involvement** card with volunteer hours, the foster-alert opt-in (approved fosters only), and an invitation to foster after several shifts.
- Reminder emails go out about 24 hours before a visit or shift.

## How it works

- Migration `20261029000000_get_involved_suite.sql` (expand-only; the visit RPCs keep their names and gain defaulted parameters). It adds `availability_rules`, `availability_exceptions`, `events`, `appointment_pets`, `foster_pool_optins`, `foster_requests`, `foster_request_responses`, `foster_invitations`, capacity and party size, the pet flags, and the RPCs the API calls. Recurring times are generated in America/New_York, so daylight saving is handled.
- The hourly Worker cron (`triggers.crons` in `apps/api/wrangler.jsonc`) calls `generate_availability()` and `claim_due_reminders()` with the service-role secret `ADMIN_SUPABASE_SERVICE_ROLE_KEY`. It starts only after the API Worker is redeployed. Without the secret it logs and does nothing.
- API: `routes/admin-schedule.ts` (staff), `routes/get-involved.ts` (public feed and member endpoints), `lib/schedule.ts` (validation and the `.ics` builder), `scheduled.ts` (cron).
- Tests: `supabase/tests/get_involved_suite_test.sql` (capacity, generation and daylight saving, exceptions, events, bulk flags, foster pool, reminders, access control), `tests/get-involved.test.mjs` (`npm run qa:involved`), and a new section in `scripts/verify-demo.mjs`.

## Demo data

`supabase/seed-lively.sql` adds five open-hours patterns (generated six weeks ahead), a "Staff training day", a Fall Open House with three roles and four featured pets, pets that need walkers, visits that name animals, an approved foster in the pool, an open foster request, and a volunteer invitation.
