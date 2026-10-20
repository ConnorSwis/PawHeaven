# PawHeaven production demo runbook

This runbook is for the deployed classroom demonstration at
`https://pawheaven.online`. It intentionally differs from the local Docker
demo: do not run `npm run demo:reset` on presentation day and do not create
predictable production passwords or fake Auth accounts.

## Current production demo state

The production Supabase project has the required tables, RLS-backed workflows,
the `pet-images` bucket, email confirmation, and the correct production Auth
URLs already configured. Its non-sensitive demo inventory includes:

- 12 publicly available animals, including Baxter (`big-dog`) and the existing
  Maple, Milo, Nala, and Pepper listings.
- Rosie (`Pending`) and Theo (`Adopted`), which staff can see but visitors
  cannot browse or apply for.
- Three published visit times in America/New_York and one withdrawn time in the
  staff portal. The visit times were created relative to October 20, 2026; if
  they have passed before the demo, an administrator should publish three new,
  non-overlapping future times in the portal.

No public demo applicant, password, booking, or new application was seeded in
production. Use existing verified accounts so that no account credentials or
personal data are invented for a public system.

## Before presenting

1. Confirm the public demo applicant can sign in and has a verified email.
   Because production email confirmation is enabled, create and verify that
   account beforehand if one is not already available.
2. Confirm one presenter can sign in to `https://admin.pawheaven.online` with
   an existing administrator or superuser account.
3. Use separate browser profiles or browsers for the public applicant and the
   administrator. Both apps use the same API session cookie, so two ordinary
   windows in one profile will replace each other's login.
4. Open these pages before screen sharing:
   - `https://pawheaven.online/pets?tag=big-dog`
   - Baxter’s details, the visit page, and the public account page in the
     applicant session
   - `https://admin.pawheaven.online` in the staff session
5. Refresh the staff portal just before the handoff so it shows the newly
   submitted application and booking.

## Five-minute live sequence

Follow the roles and timing in [presentation-flow.md](presentation-flow.md).
For production, replace the local-demo credential references with the verified
public applicant and existing staff account chosen by the group. The strongest
database round trip remains: submit Baxter’s application, book one open visit,
then refresh the administrator dashboard to show the same records.

## After the demo

The application and appointment are real production records. Do not delete or
alter them unless the team explicitly decides their exact cleanup scope and
owner. A future seed should use new IDs and `ON CONFLICT DO NOTHING` so it
does not overwrite staff edits.
