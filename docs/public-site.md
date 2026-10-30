# Public site redesign (working spec)

Plan: https://claude.ai/artifact/4UtckZsihLsmTnPL4RFukz. This file is the build spec; keep it current.

## Site map

| Page | Address | Notes |
| --- | --- | --- |
| Home | `/` | Search-first hero with featured animals, ways to help with live counts, how adoption works, hours |
| Adopt | `/adopt` | Photo grid, real filters in the address, sort by longest waiting or who needs help first, quiz banner, saved animals |
| Animal | `/adopt/<name>-<8 hex id>` | One built page `/adopt/pet/` (the Worker serves it for every animal and inlines the data) |
| Match quiz | `/adopt/match` | Public; results, then optional save |
| How adoption works | `/adopt/process` | Done (content page) |
| Apply | `/apply?type=adopt\|foster&pet=<uuid>` | Stepper, prefilled from saved details |
| Foster | `/foster` | What it is, animals needing a home, apply |
| Volunteer | `/volunteer` | Roles, open shifts by week, sign up |
| Visit | `/visit` | Hours/location, times without login, choose animals, sign in only to confirm |
| Lost a pet? | `/lost-pet`, `/lost-pet/flyer` | Check by photo (no login to look), flyer, report |
| Donate | `/donate`, `/donate/thanks` | |
| Auth | `/login`, `/sign-up` | Honor `?next=` |
| My PawHeaven | `/me?tab=overview\|visits\|applications\|saved\|details` | One tabbed page |
| Content | `/about`, `/contact`, `/faq`, `/privacy`, `/terms` | Done; facts come from `SHELTER` in `packages/contracts/src/site.ts` (placeholders) |

Old addresses redirect through `apps/web/public/_redirects`. `astro dev` serves `/adopt/<slug>` through the `animalRoutes` integration in `astro.config.mjs`; production uses `worker/index.ts`.

## Foundation (already built, do not edit unless asked)

- `src/layouts/PageShell.astro`: skip link, header (Adopt, Foster, Volunteer, Visit, Lost a pet?, Donate, account), footer with shelter facts. Props: `title`, `description`, `image`, `noindex`, `showNavigation`, `showFooter`.
- `src/layouts/ContentPage.astro`: prose pages.
- `src/ui/index.tsx` (+ `icons.tsx`, `toast.tsx`): Button, ButtonLink, TextLink, Badge, Notice, Card, Skeleton, Input, Textarea, Select, Field, Fieldset, Choice, ErrorSummary, Stepper, Sheet, EmptyState, PageHeading, `cx`. All colors come from `--ph-*` theme variables (use theme-mapped Tailwind classes such as `text-stone-950`, `bg-white`, `border-stone-300`, `bg-[var(--ph-brand)]`; never hardcode hex or rgb; a test fails on that).
- `src/lib/fetch.ts`: `api`, `errorMessage`, `useApi`, `useMe`, `inlineData`, `loginUrl`. `src/lib/providers.tsx`: wrap every React island in `<Providers>`. `src/lib/api.ts` has `apiBase`.
- Worker (`worker/index.ts`): for `/`, `/adopt`, `/adopt/<slug>` it inlines `<script id="ph-data" type="application/json">`: `{ pets: Pet[] }` on `/` and `/adopt`; `{ pet: Pet }` or `{ missing: true }` on an animal page. Read it with `inlineData()` and fall back to fetching (dev has no Worker). Animal API: `GET /pets/s/<8 hex>`.

## Rules for every page

- Astro page wraps `PageShell` around one React island (`client:load`) wrapped in `Providers`. Components live in `src/app/<area>/`.
- No page renders only "Loading…". Use a skeleton shaped like the content, or inlined data.
- Guests can look at everything. Ask for sign-in only at the moment of an action: send people to `loginUrl()` (`/login?next=...`) and make the page resume afterwards.
- Forms: one idea per step, `Stepper`, saved details prefilled (`GET /profile`), `ErrorSummary` plus per-field errors, correct `autocomplete`, a review step, a confirmation page or state, and an email already sent by the API. Same wording across adopt, foster, volunteer, and visit.
- Accessibility (WCAG 2.2 AA): real labels, targets at least 44px high on touch, visible focus, one `h1` per page and ordered headings, async changes announced (`role="status"`), alt text for animal photos ("Cadillac, a Labrador mix"), no color-only meaning, keyboard-complete, works at 320px wide.
- Words: Adopt, Foster, Volunteer, Visit. "Animal" or the animal's name, not "listing". Shelter times are America/New_York.
- Use `SHELTER` for hours, address, fees; never retype them.
- Pet shape: `Pet` in `@pawheaven/contracts` (name, type, breed, age, sex, size, color, weightLbs, energyLevel, goodWithKids/Dogs/Cats, tags, summary, medicalHistory, fosterAvailable, fosterUrgent, needsWalkers, visitsOpen, housing, imageUrl, galleryUrls, sourceName/sourceUrl, daysInShelter).

## Shelter status and animals who need help

Staff control both from the staff portal; the public site only reads them.

- **Status banner** (`src/app/status/`: `useShelterStatus()`, `<StatusBanner />`). Reads `GET /public/shelter-status` (cached 60 s). Shown on Home, Adopt (above the grid), Foster and Volunteer only when a kennel group is `busy` (works as "nearly full"), `full` or `over` ("full"). It picks the most pressed group, and the first listed when equal. Text: heading, a `role="meter"` bar with "89% full" in words, one sentence, and two links (Foster a dog; See dogs who can go home today, `/adopt?species=dog`, or cat / other). It renders nothing while loading, on error, and when every group is `ok` or `unset`. Staff change it by editing kennel counts and held-back kennels in the staff portal; nothing else switches it on.
- **Footer line.** When the banner is not showing, `PageShell` fills a quiet "28 dogs and 6 cats ready to meet" line (links to `/adopt`) from the same endpoint. `src/lib/shelter-status.ts` caches one fetch per page load on `window`, shared by the banner and the footer script; the line stays hidden if the fetch fails. Pages that show the banner pass `statusBanner` to `PageShell` so the footer skips the line while the banner is up.
- **Needs help most.** Staff flag an animal with a reason (`home_soon`, `foster`, `long_stay`, `medical`) in the staff portal; the wording comes from `HELP_REASON_LABELS` and `HELP_REASON_DETAILS` in `@pawheaven/contracts`. Public surfaces: a "Needs help most" section on Home (up to 4, oldest flag first, "See all" goes to `/adopt?sort=help`, hidden when no one is flagged); the same row on Adopt when no search or filter is active (and the sort is not already "Needs help first"); a badge on every animal card; the sort option "Needs help first" (`sort=help`: flagged first, oldest flag first, then waiting longest); a callout on the animal page with Adopt, Foster and Share (the share sheet where the browser has one, otherwise the address is copied and a toast confirms); and the page description the Worker inlines for link previews ("Needs a home soon. Meet Rocco, a ...").

## Status and deployment notes

All pages above are built. Checked: `npm run check`, `npm run qa:demo`, `npm run db:test`, axe (WCAG 2.2 AA rules) on Home, Adopt, an animal, Visit, Volunteer, Foster and Lost a pet in the default theme, and color contrast in the dark, midnight, contrast, ocean, sunset and lavender themes. The Worker was tested locally with `wrangler dev --var API_BASE:http://localhost:8787/api` (title, description, share image, inlined data, 404 for an unknown animal, redirects).

To go live: push the new migration (`20261030000000_public_availability.sql`), redeploy the API Worker (new routes `/pets/s/<id>` and `/public/availability`), then the web Worker (its `wrangler.jsonc` now has a `main` and runs the Worker first for `/`, `/adopt` and `/adopt/*`). In Stripe, change the donation link's "After payment" redirect to `/donate/thanks`. Replace the placeholder contact details in `SHELTER`.
