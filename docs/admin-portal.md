# Staff portal

The staff portal (`apps/admin`) is one React app, mounted by Astro at `/`. Seven pages share three layouts, so learning one page teaches the rest.

| Page | Layout | What it covers |
| --- | --- | --- |
| Home | Overview | Needs-you queue, today's visits and shifts, a few numbers, quick actions |
| Animals | List + side panel | Search, filters, bulk actions (foster, visits, walkers, status), editor panel with photo upload |
| Requests | List + side panel | Adoption applications, foster applications, lost-pet inquiries; review in the panel |
| Schedule | Calendar + side panel | Visits, shifts, events; drag to add; open hours, closed days, copy week; bookings and sign-ups in the panel |
| Fostering | List + side panel | Active placements, ask the foster pool, volunteers to invite |
| Donations | List + chart | Totals, donations over time, gift table, CSV export |
| People | List + side panel | Accounts, password reset, block, delete; staff invitations and roles (superuser) |

**Search everything:** press ⌘K (or Ctrl+K) to jump to a page, an animal, a person, or an action. **State lives in the address** (`#/animals?status=Available&id=<pet>`), so back, refresh and shared links work. The account menu (top right) holds the theme picker, the compact-table setting, and sign out.

## How it is built

- `src/portal/App.tsx` loads the signed-in staff user and renders the shell; `Shell.tsx` is the sidebar, top bar, and command palette; `routes.tsx` lists the pages.
- `src/portal/ui/` is the shared kit: button, badge, form fields, data table (search results, sort, paging, bulk select), side panel (`Sheet`), confirm dialog, tabs, stat cards, toasts. Radix Dialog provides focus handling; `cmdk` the palette; TanStack Query the cached data.
- `src/portal/lib/api.ts` wraps the API (a 401 sends you to the login page). Pages call `useApi('/admin/...')` and `useRefresh('/admin/...')` after a change.
- Colors come only from the `--ph-*` theme variables, so every theme works, and `npm run qa:theme` rejects hardcoded colors.
- Login and accept-invite remain separate Astro pages.
