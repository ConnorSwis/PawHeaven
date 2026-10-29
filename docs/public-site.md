# Public site redesign (working spec)

Plan: https://claude.ai/artifact/4UtckZsihLsmTnPL4RFukz. This file is the build spec; keep it current.

## Site map

| Page | Address | Notes |
| --- | --- | --- |
| Home | `/` | Search-first hero with featured animals, ways to help with live counts, how adoption works, hours |
| Adopt | `/adopt` | Photo grid, real filters in the address, sort by longest waiting, quiz banner, saved animals |
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

## Status and deployment notes

All pages above are built. Checked: `npm run check`, `npm run qa:demo`, `npm run db:test`, axe (WCAG 2.2 AA rules) on Home, Adopt, an animal, Visit, Volunteer, Foster and Lost a pet in the default theme, and color contrast in the dark, midnight, contrast, ocean, sunset and lavender themes. The Worker was tested locally with `wrangler dev --var API_BASE:http://localhost:8787/api` (title, description, share image, inlined data, 404 for an unknown animal, redirects).

To go live: push the new migration (`20261030000000_public_availability.sql`), redeploy the API Worker (new routes `/pets/s/<id>` and `/public/availability`), then the web Worker (its `wrangler.jsonc` now has a `main` and runs the Worker first for `/`, `/adopt` and `/adopt/*`). In Stripe, change the donation link's "After payment" redirect to `/donate/thanks`. Replace the placeholder contact details in `SHELTER`.
