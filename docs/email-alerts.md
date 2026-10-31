# Email alerts, saved animals, and the newsletter

Part 2 of the feature completion plan (requirements 3 and 8 in `BRAINMAP.md`). Members can save
animals and searches and get a daily email when something fits; anyone can join the newsletter;
staff write and send issues from **Outreach**. Interface notes live in
[admin-portal.md](admin-portal.md) and [public-site.md](public-site.md).

## For staff

| Where | What you can do |
| --- | --- |
| **Outreach → Newsletter** | Write an issue (subject, a few paragraphs), tick the blocks that fill themselves in at send time (animals who need help, newest arrivals, upcoming events, open shifts), preview it, send yourself a test, then **Send**. A confirm step shows how many people it goes to. Sending queues one message per confirmed subscriber; the issue shows *Sending* and turns *Sent* when nothing is left to deliver. Drafts can be edited or deleted; sent issues are read-only. |
| **Outreach → Subscribers** | Counts of confirmed, waiting, and unsubscribed addresses, a searchable list, **Remove**, and **Export CSV**. |
| **Outreach → Alerts** | How many saved searches and saved animals exist and which species people are waiting for, plus email delivery: queued, sent in the last 7 days, and failed. |
| **Home → Needs attention** | "N emails could not be sent" appears when messages fail three times. |

## For visitors and members

- **Hearts follow the account.** Hearts still work with no account. After signing in, the browser's hearts are added to the account once, and from then on every device shows the same list.
- **Email me new matches** (Adopt page, with filters chosen) saves the filters as a search for signed-in members. Guests are asked to sign in rather than for an email address. Search words and sort order are not saved.
- **Daily emails at 8 am shelter time.** A new animal that fits a saved search, and changes to animals a member saved (available again, adoption pending, adopted), are grouped into one email per person per day.
- **Newsletter.** The footer form sends a confirmation link (double opt-in). Members can also switch it on under **My PawHeaven → Details → Email choices**; their account email is already verified, so no confirmation email is sent.
- **Email choices** (Details) switch the digest, saved-animal emails, newsletter, and foster alerts (approved fosters only) on or off. Reminders for visits and shifts and updates on applications are always sent.
- **Every optional email** carries a link to manage choices, a one-click-page unsubscribe (works without signing in; the page asks first because email scanners open links), and the shelter's mailing address.

## How it works

- Migration `20261101000000_email_alerts.sql` (expand-only):
  - `notification_outbox` holds queued optional email (`match`, `saved_change`, `newsletter`) with a `dedupe_key`, an attempt counter, and no access for guests or members.
  - A trigger on `pets` queues rows when an animal becomes Available (once per member and animal, for members whose saved search fits and whose digest is on) and when a saved animal changes status. `pet_matches_search()` is the single definition of "fits", mirroring the directory filters, with `age_band()` ported from the website.
  - `saved_pets`, `saved_searches` (up to 10 each member), `member_email_prefs`, `email_subscribers` (pending, confirmed, unsubscribed), and `newsletters` (drafts are editable; `queue_newsletter()` locks an issue and queues it for every confirmed subscriber).
  - Member functions are `list_saved_pets`, `merge_saved_pets`, `unsave_pet`, `list_my_searches`, `create_saved_search`, `delete_saved_search`, `get_my_email_prefs`, `set_my_email_prefs`. Guest functions (`subscribe_newsletter`, `confirm_newsletter`, `unsubscribe_email`) and the job functions (`claim_notifications`, `finish_notifications`) are callable only with the service role.
- API: `routes/alerts.ts` (member and guest calls), `routes/admin-outreach.ts` (staff), `lib/notifications.ts` (digest and newsletter emails, `runOutbox`), `lib/unsubscribe.ts` (signed links), `lib/outreach.ts` (validation). `sendEmail` now reports success, and `sendEmailBatch` sends up to 50 messages per request.
- The **hourly Worker job** now also runs `runOutbox`: it claims due rows, builds one digest per person and one issue per subscriber, sends them in batches, and records the result. A failed batch is retried on later runs, three tries in all. Pressing **Send** also triggers an immediate run so an issue does not wait for the next hour.
- Visit and shift reminders and foster-pool emails keep their existing paths.

## Settings

| Setting | Where | Purpose |
| --- | --- | --- |
| `SITE_URL` | `wrangler.jsonc` vars | Address used for links in email (`https://pawheaven.online` in production). |
| `ADMIN_SUPABASE_SERVICE_ROLE_KEY` | Worker secret (already needed for the hourly job) | Required for guest sign-up, unsubscribe, previews, and sending. Without it those calls report that email sign-up is unavailable. |
| `UNSUBSCRIBE_SECRET` | Worker secret, optional | Signs unsubscribe links. Defaults to the service-role key; set it only to rotate links independently. |
| `EMAIL_SAFE_MODE` | Worker variable, optional | Set to `true` to deliver only to `@resend.dev` addresses (Resend's test inboxes), so a demo can never email a real person. Off by default. |

Wrangler is not logged in on the development machine, so the secrets above have to be set by whoever deploys the Worker.

## Tests and demo data

- `supabase/tests/email_alerts_test.sql` (matching, digests, dedupe, preferences, guest subscription, unsubscribe, newsletter queueing, failure reporting, access control), `tests/email-alerts.test.mjs` (`npm run qa:alerts`), and a section in `scripts/verify-demo.mjs`.
- `supabase/seed-lively.sql` adds 13 subscribers (some waiting or unsubscribed), saved searches and animals for several members, one member with the digest off, a sent issue, and a draft.
