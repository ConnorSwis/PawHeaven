# Staff portal

The staff portal (`apps/admin`) is one React app, mounted by Astro at `/`. Eight pages share three layouts, so learning one page teaches the rest.

| Page | Layout | What it covers |
| --- | --- | --- |
| Home | Overview | Needs-you queue, shelter capacity, today's visits and shifts, a few numbers, quick actions |
| Animals | List + side panel | Search, filters, bulk actions (foster, visits, walkers, status, needs help), capacity meters, editor panel with photo upload |
| Requests | List + side panel | Adoption applications, foster applications, lost-pet inquiries; review in the panel |
| Schedule | Calendar + side panel | Visits, shifts, events; drag to add; open hours, closed days, copy week; bookings and sign-ups in the panel |
| Fostering | List + side panel | Active placements, ask the foster pool, volunteers to invite |
<<<<<<< HEAD
| Donations | List + chart | Totals, donations over time, gift table, CSV export, and review/publish/hide opted-in supporter-wall submissions |
=======
| Donations | List + chart | Totals, donations over time, gift table, CSV export |
| Outreach | Tabs + side panel | Newsletter issues, subscribers, what members are waiting for, email delivery health |
>>>>>>> origin/main
| People | List + side panel | Accounts, password reset, block, delete; staff invitations and roles (superuser) |

**Search everything:** press ⌘K (or Ctrl+K) to jump to a page, an animal, a person, or an action. **State lives in the address** (`#/animals?status=Available&id=<pet>`), so back, refresh and shared links work. The account menu (top right) holds the theme picker, the compact-table setting, and sign out.

## Capacity and the needs-help flag

**Capacity.** On Animals (the **Capacity…** button) and Home (**Edit capacity**), staff enter how many kennels the shelter has for Dogs, Cats and Other animals, and how many are **held back** (quarantine or repairs; they do not count as space). The meters show animals in a kennel out of usable kennels, for example "Dogs 17 of 19", with the percent and a level word: Roomy, Getting full (85% or more), Full, or Over capacity. A group with 0 kennels shows "Not set" and no public banner. Animals count while they are Available or Pending and are not in a foster home. Each meter is a labelled `role="meter"`, so the level never depends on color alone.

**Needs help.** A flag on an individual animal, set three ways: the **Needs help** select in the animal editor (Basics tab), the **Needs help…** menu in the bulk bar on Animals (or **Clear flag**), or **Mark needs help** on a Home item. Filter with the **Needs help** chip (`#/animals?help=1`); flagged animals carry a badge in the list. In the editor, choosing *Needs a foster* also offers **Also ask the foster pool for a foster home**, which sends the usual foster request after saving.

| Reason | Use it when |
| --- | --- |
| Needs a home soon | Space is tight and a quick adoption would help |
| Needs a foster | A foster home would get the animal out of a kennel |
| Here a long time | The animal has waited longer than most |
| Needs medical care | A quiet home would help with ongoing care |

**What the public sees.** Only the reason label (for example "Needs a foster") on the animal's page and in listings, the kennel level banner, and flagged animals listed first. Staff notes, medical history and anything else about the flag are never shown.

**Home prompts.** The Needs you list can say kennels are nearly full (opens Animals), that flagged animals have gone a week without applications (opens the flagged list), or that animals here over 90 days could be marked as needing help.

## Outreach

`#/outreach` has three tabs (`?tab=newsletter|subscribers|alerts`). Home shows a small Outreach card (confirmed subscribers and failed messages), and a "Needs you" item that says emails are failing opens the Alerts tab.

- **Newsletter.** The list shows each issue's subject, status (Draft, Sending, Sent), recipients and date. **New issue** opens a side panel with Subject, Message (separate paragraphs with a blank line) and four sections that fill in automatically when the issue is sent: animals who need help, newest arrivals, upcoming events, open volunteer shifts. **Preview** saves the draft and shows the real email in a sandboxed frame (links are inert); **Send me a test** emails a "[Test]" copy to the signed-in staff member only. Drafts can be edited and deleted; sent and sending issues open read-only.
- **What Send really does.** **Send to N people** asks for a confirmation that names the audience (everyone who has *confirmed* their subscription) and says it cannot be undone. Sending queues one email per person; it does not deliver them on the spot. The queue is delivered by the hourly job plus an immediate run right after you press Send, so the issue shows **Sending** and then **Sent** within seconds to a few minutes (the list checks every two seconds while any issue is Sending).
- **Subscribers.** Counts for Confirmed, Waiting for confirmation (signed up but has not clicked the email link; these are never emailed an issue) and Unsubscribed. Click a count or use the filter to narrow the list; search by email. **Remove** unsubscribes an address (it can sign up again on the public site). **Export CSV** downloads the rows currently shown as `email,status,signed up`. The list holds the newest 1000 addresses.
- **Alerts.** What members are waiting for: saved searches, members with alerts, saved animals, and which animals the searches look for (Dogs, Cats, Other animals, Any animal). **Email delivery** shows messages queued, sent in the last 7 days, and failed.
- **Reading failures.** A message is retried until it has failed three times, then it stays *failed* and is counted here and on Home. Nothing is sent again automatically. Check the email service settings (sending domain, API key), then ask engineering to retry the failed messages.

## How it is built

- `src/portal/App.tsx` loads the signed-in staff user and renders the shell; `Shell.tsx` is the sidebar, top bar, and command palette; `routes.tsx` lists the pages.
- `src/portal/ui/` is the shared kit: button, badge, form fields, data table (search results, sort, paging, bulk select), side panel (`Sheet`), confirm dialog, tabs, stat cards, toasts. Radix Dialog provides focus handling; `cmdk` the palette; TanStack Query the cached data.
- `src/portal/lib/api.ts` wraps the API (a 401 sends you to the login page). Pages call `useApi('/admin/...')` and `useRefresh('/admin/...')` after a change.
- Colors come only from the `--ph-*` theme variables, so every theme works, and `npm run qa:theme` rejects hardcoded colors.
- Login and accept-invite remain separate Astro pages.
