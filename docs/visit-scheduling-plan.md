# Shelter visit scheduling implementation plan

Status: implemented in source on 2026-10-20, pending Docker-backed local
migration/test execution. This implementation does not change a hosted
environment. The Sprint 2 report's use case 8 requires
staff-published slots, a signed-in visitor's purpose, confirmation, a staff
schedule, rescheduling and cancellation, and a fresh availability check.

## Decisions and scope

- Model one shelter and one visitor per slot. Appointments are general visits,
  not dependent on an adoption application or a selected pet. This follows the
  report's visit-purpose flow and replaces the earlier application-only draft.
- Administrators and superusers publish future slots and see the schedule.
  Members can book, reschedule, and cancel their own future appointments.
  Use the existing immutable administrator roles; do not introduce `staff`.
- Each slot has a start and end and cannot overlap another published slot.
  Adjacent slots are allowed. No recurring schedules, capacity greater than one,
  staff overrides of booked slots, or automatic changes to adoption applications.
- Save timestamps as `timestamptz`. For the local demo use the configurable
  `America/New_York` shelter timezone and explicitly label it throughout the
  UI. This is a demo assumption, not a verified shelter location. Validate
  ambiguous or nonexistent local times at daylight-saving transitions rather
  than silently choosing an offset. Send unambiguous instants to the API.
- A successful operation shows an immediate confirmation and records an
  account-visible confirmation. Sprint 2 says confirmations are “sent” but
  does not identify a channel. This plan does not claim to send email: if the
  instructor requires outbound messages, email delivery and its configuration
  must be added and verified separately before claiming that requirement met.
- Keep canceled appointments and their confirmation history in the local
  database. User deletion cascades to their appointments and confirmation
  history; no automatic retention period is invented. The hosted retention
  policy must be decided before production use.

## Database

Create a timestamped migration through the Supabase CLI. The schema is a design
target, not a description of deployed tables:

| Table | Fields and relationships | Purpose |
| --- | --- | --- |
| `visit_slots` | UUID primary key; `starts_at`, `ends_at` timestamptz; `status` (`published`, `withdrawn`); creator FK to `auth.users`; creation time | Staff-published appointment times. Check end is after start. A PostgreSQL exclusion constraint on a half-open timestamp range prevents overlapping published slots. |
| `appointments` | UUID primary key; member FK to `auth.users`; slot FK; bounded nonempty visit purpose; `status` (`booked`, `canceled`); created/updated timestamps | Current booking, including cancellations. A partial unique index on slot ID where status is `booked` is the final one-booking-per-slot guard. Index member/status and slot foreign keys. |
| `appointment_events` | UUID primary key; appointment FK; member FK; event type (`booked`, `rescheduled`, `canceled`); slot-time snapshot; created timestamp | Account-visible confirmation/history that survives later rescheduling. Create each event in the same transaction as the change. |

Limit visit purpose to 1–500 trimmed characters and do not collect extra
personal or medical information. Use explicit grants and RLS for all exposed
tables. Members can read only their own appointments and events; admins can
read the schedule and booking details. Availability listing exposes only slot
times and availability, never another member's name, purpose, or identifier.
Members cannot directly write tables or events. Slot creation/withdrawal and
booking mutations use narrowly scoped database functions called by the API;
functions independently check `auth.uid()` and the admin claim. Revoke default
function execution from `PUBLIC`/`anon`, grant only to intended roles, fix the
search path, and use fully qualified references. Review any `SECURITY DEFINER`
function for privilege escalation and test direct Data API access as well as
the API route. The API keeps using caller tokens and the publishable key.

Booking locks the selected slot, checks it is published and future, and inserts
the booking and event in one transaction. Cancellation locks the owned booking
and slot, marks it canceled, and adds an event. Rescheduling locks the owned
booking and both slot rows in a deterministic order, verifies the destination,
updates the booking, and writes an event atomically. On failure, the original
booking remains intact. Slot withdrawal uses the same slot lock and rejects a
booked slot. All paths recheck state after locking. Map conflicts to HTTP 409,
and retain the partial unique index as defense in depth. Never treat the
availability displayed earlier as proof the slot is still free.

## API and interface

Extend `packages/contracts/src/index.ts` with slot, appointment, event, and
request/response types. Follow the existing API session and authorization
patterns in `apps/api`; use parameter validation and map safe, specific errors.
Proposed routes:

| Route | Behavior |
| --- | --- |
| `GET /api/visit-slots` | Authenticated list of future published slots and sanitized availability, including booked slots so the UI can disable them. |
| `GET /api/appointments` | Member's bookings and confirmation events. |
| `POST /api/appointments` | Book a slot and purpose. |
| `PUT /api/appointments/:id` | Reschedule the member's own booking to a slot. |
| `POST /api/appointments/:id/cancel` | Cancel the member's own booking. |
| `GET /api/admin/visit-slots` | Admin schedule including slots and booking details. |
| `POST /api/admin/visit-slots` | Publish a future slot. |
| `POST /api/admin/visit-slots/:id/withdraw` | Withdraw a future unbooked slot. |

Add a public `/visits` Astro page linked from navigation: explain sign-in,
show available and disabled booked times, collect visit purpose, and handle
loading, empty, validation, conflict, session-expired and retry states. After a
conflict reload availability and preserve the entered purpose. Add appointment
and confirmation history, reschedule and cancel controls to the account page.
Use existing admin dashboard patterns for creating slots and viewing the
schedule; do not expose booking data to ordinary users. Confirm actions with
clear screen messages and accessible status announcements.

## Implementation sequence and verification

1. Add migration, policies, and functions; update the model and plan status in
   `BRAINMAP.md`. Test locally with `npm run db:reset` and `npm run db:test`.
   Reset destroys existing local demo data: do it only on the intended local
   demo/test database. No linked or hosted database changes.
2. Add API and shared types; verify valid and invalid requests, authorization,
   and transaction error mapping. Keep the existing pet/application flows
   working.
3. Add public and admin screens; test keyboard use, labeled controls, loading,
   failure and mobile layouts. Complete a real browser journey end to end.
4. Extend local seed data with future relative-time slots, and extend the demo
   verifier and runbook. Run `npm run check`, database policy tests, and the
   local end-to-end verifier after starting the API. Document how to reset and
   restore the demo; do not use real visitor data.
5. Update Section 9 and the database/class diagrams: map use cases to real
   tables, show the PostgreSQL decision and command-line setup, and distinguish
   immediate/in-account confirmation from outbound email.

Required tests include: anonymous rejection; cross-user access denial; admin
and superuser access; member denial of admin writes and direct function/table
abuse; input validation; overlapping slots; two simultaneous bookings for one
slot with exactly one success; slot withdrawal racing with booking; reschedule
conflict preserving the original appointment; cancellation freeing the slot;
attempts to edit canceled or past bookings; disabled booked slots without PII;
event creation and rollback; and timezone/daylight-saving boundaries. Verify
the real GUI and API against the local Postgres database, not sample fallback
data. Confirm migration replay on a fresh local database and include a concise
five-minute demo script.

## Research

- [PostgreSQL range types](https://www.postgresql.org/docs/17/rangetypes.html)
  and [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html):
  overlapping ranges and partial unique indexes enforce scheduling invariants.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html):
  row locks coordinate conflicting changes within transactions.
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
  and [database functions](https://supabase.com/docs/guides/database/functions):
  configure explicit access policies and carefully restrict function privileges.
- [Astro routing](https://docs.astro.build/en/guides/routing/): the visit page
  fits the existing file-based frontend structure.
