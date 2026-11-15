# PawHeaven design guide ("Soft Clay")

Read this before adding or changing anything a person sees, in the public site (`apps/web`) or the
staff portal (`apps/admin`). It says what the product should look and feel like and which tokens and
components produce that. `docs/theming.md` explains how the theme file works; this guide explains
how to design with it.

## The look in one paragraph

Soft, rounded, warm, and photo-first. Cream page, white cards with gentle warm shadows, moss green
for actions, a peach accent used only as decoration, one rounded typeface. Animals are the largest
thing on a screen. The site is friendly and a little cute, and it never stops being clear,
trustworthy, and accessible. The staff portal uses the same tokens with a quieter hand.

## Rules that do not bend

1. **Colors, corners, shadows, fonts, and motion come from `--ph-*` variables** in
   `packages/contracts/src/theme.css`, or from Tailwind classes that are mapped to them (`bg-white`,
   `text-stone-700`, `border-stone-300`, `shadow-sm`, `rounded-[var(--ph-radius)]`). Never write a
   hex, `rgb()`, or an unmapped palette class in a component. `npm run qa:theme` enforces this.
2. **Every theme must keep working.** Seven themes share the markup, including dark and high
   contrast. If something only looks right in the default theme, it is wrong. Add a variable and
   set it per theme instead of special-casing a theme in a component.
3. **WCAG 2.2 AA.** Text contrast 4.5:1, form borders and icons 3:1, visible focus ring (never
   remove the outline), 44px tap targets on the public site, real labels, errors in words, nothing
   that relies on color alone.
4. **Motion is optional.** Use only the motion tokens. Everything must read correctly with
   `prefers-reduced-motion: reduce`, which the base styles switch off globally. Nothing loops.
5. **Use the kit.** Buttons, fields, badges, cards, notices, sheets, and steppers live in
   `apps/web/src/ui/index.tsx` and `apps/admin/src/portal/ui/index.tsx`. Change the kit rather
   than restyling one instance. A new pattern that will repeat goes into the kit.

## Tokens

| Purpose | Variable | Tailwind | Use it for |
| --- | --- | --- | --- |
| Card corner | `--ph-radius` (22px) | `rounded-[var(--ph-radius)]`, `rounded-lg` | Cards, panels, photos, large tiles |
| Field corner | `--ph-radius-sm` (12px at most) | `rounded-[var(--ph-radius-sm)]`, `rounded-md` | Inputs, selects, notices, menus, small boxes |
| Pill | `--ph-radius-pill` | `rounded-[var(--ph-radius-pill)]` | Buttons and chips. Follows `--ph-radius`, so a square theme gets square buttons |
| Resting depth | `--ph-shadow-sm` | `shadow-sm` | Cards at rest |
| Raised depth | `--ph-shadow` | `shadow-md` | Hovered cards, popovers |
| Floating depth | `--ph-shadow-lg` | `shadow-lg` | Dialogs, the hero photo |
| Button glow | `--ph-shadow-brand` | `shadow-[var(--ph-shadow-brand)]` | Primary buttons only |
| Decoration | `--ph-pop` | `bg-pop` | Blobs and highlight strokes. Never text, never the only signal |
| Motion | `--ph-ease`, `--ph-duration-fast` (150ms), `--ph-duration` (250ms), `--ph-lift` | `ease-out` | Hover, press, enter |
| Weight | `--ph-weight-semibold` (700), `--ph-weight-bold` (800) | `font-semibold`, `font-bold` | Labels and buttons; page headings |

Nested corners: a photo inside a padded card uses `rounded-[calc(var(--ph-radius)-0.5rem)]` so the
inner curve follows the outer one.

Do not use `rounded-full` for buttons (it ignores the theme); it is fine for avatars, dots, and the
round heart button. Do not add new shadow values; pick one of the three.

## Type

- One family: Nunito (variable, self-hosted through `@fontsource-variable/nunito`). Other themes may
  override `--ph-font-sans` and `--ph-font-heading`; never name a font in a component.
- Page title `text-3xl`/`text-4xl font-bold`; section title `text-2xl font-bold`; card title
  `text-xl font-semibold`; body `text-base`; help text `text-sm text-stone-700`. Headings get tight
  tracking and balanced wrapping from the base styles.
- At most one highlighted word per headline, with `.ph-highlight`.
- Body text is never lighter than `text-stone-700` on a card or the page.

## Components

- **Buttons.** One primary button per view (`variant="primary"`: moss, pill, soft glow). Everything
  else is `secondary` (outlined) or `ghost`. Destructive actions use `danger` and ask first. Labels
  are verbs that say what happens: "Book this visit", not "Submit". Buttons sink 1px when pressed
  (base style). A button that is really a big tile sets `rounded-[var(--ph-radius)]` itself.
- **Cards.** `Card` from the kit: white, 22px corners, hairline `border-stone-200`/`300`,
  `shadow-sm`. A card that is one big link adds `.ph-lift` so it rises on hover and keyboard focus.
  Do not nest cards inside cards; use a divider or `bg-stone-50` inset instead.
- **Animal card** (`apps/web/src/app/adopt/AnimalCard.tsx`). Photo first, inset with its own rounded
  corners, name, one line of facts, at most three badges (most urgent first), then how long they
  have waited. The whole card opens the profile; the heart sits on the photo. Reuse it wherever an
  animal appears in a grid; do not make a variant.
- **Badges and chips.** `Badge` with a tone: `good` (brand), `warn` (warm), `danger`, `neutral`.
  Always words, never an icon alone. Filters and quick choices are pill buttons.
- **Chips.** `ChipToggle` (a filter that switches on and off, `aria-pressed`, shows a check when on),
  `ChipLink` (a ready-made search), `chipClass()` for anything else shaped like one. 44px high, stone
  border so the edge is visible, brand fill when on. Active filters appear as removable chips (the
  whole chip is the remove button, labelled "Remove filter: ...").
- **Search pill.** `SearchPill`: rounded field with a search icon and an optional `action` (a submit
  button). The label is read aloud and visually hidden, so give it a placeholder that says what to type.
- **Note card.** `NoteCard`: a small white card with a warm round icon, for one line in an animal's
  voice ("Poppy says hi" / "Here 5 months"). Pass `href` to make it a link. Never tilt it, never use
  it for medical, money, or lost-pet content.
- **Sections.** `Section` (`tone="page"` or `"tint"`) with `SectionHeader`. A tint section is the
  rounded band (`.ph-band`, defined in `apps/web/src/styles/global.css`). Alternate page and tint down
  a page; the footer is a tint band too, so do not end a page with one.
- **Fields.** `Field` + `Input`/`Select`/`Textarea` from the kit: label above, help below, error in
  words under the field, `ErrorSummary` at the top of long forms. Prefer big tappable `Choice`
  options over a dropdown when there are five or fewer options.
- **Stepper.** `Stepper` (`steps`, `current`): numbered rounded dots joined by a line; the current dot is
  filled, finished steps show a check. Labels sit beside the dots from `sm` up; on phones they stay for
  screen readers and a line underneath says "Step 2 of 4: Animals". Pass `steps.length` as `current` on the
  confirmation so every step shows done. Used by visit, apply, and the volunteer sign-up sheet.
- **Choice cards.** `ChoiceCard` (radio or checkbox) is the big tappable option for five or fewer choices
  (visit purpose, party size). The real input is visually hidden but focusable; the card shows a check circle
  when chosen so color is not the only signal. `compact` makes a small centered tile for short values such as
  a number. Use it instead of a `Select` when it fits; keep the form value and payload the same.
- **Summary card.** `SummaryCard` (`title`, `rows`): the rounded "Your visit / shift / application" card.
  Sticky beside the steps on desktop (`hidden lg:block lg:sticky lg:top-24`), and a second copy with
  `lg:hidden` above the submit button on phones. A row with `onChange` gets a Change button.
- **Confirmation.** `Confirmation` is the success screen after booking, signing up, or applying: celebrating
  mascot, one warm sentence, the details (usually a `TicketCard`), "What happens next", and the links
  (add to calendar, My PawHeaven). The heading takes focus through `headingRef`. Success only, never errors.
  Applications stay calm: no confetti, no motion beyond the soft entrance.
- **Ticket card.** `TicketCard` (`children`, `stub`): main details on top, a dashed tear line, then a stub
  for small print or controls. Used for the next visit or shift on My PawHeaven and for booked visits.
- **Switch.** `Switch` is an on/off setting: a real checkbox (announced as a switch) drawn as a track and
  thumb, with "On" or "Off" in words beside it. Controlled (`checked`, `onChange`). Used for email choices.
- **Empty states.** `EmptyState` takes an optional `pose` (`sleeping` or `searching`) and `species`: the
  mascot, one sentence, one action. Never use `celebrating` outside `Confirmation`.
- **Notices.** `Notice` for inline messages; toasts for results of an action. Errors say what
  happened and what to do next.
- **Photos.** `object-cover`, a fixed aspect ratio (4:3 in cards), `bg-stone-200` behind while
  loading, meaningful alt text. Hero photos may use `.ph-photo-blob` on the image and `.ph-blob` on
  its wrapper for the peach circle behind it.
- **Empty, loading, and success states.** Every list has an empty state with one sentence and one
  action. Loading uses `Skeleton` blocks shaped like the final layout. Success says what happens
  next.

## Layout and spacing

- Page width `max-w-6xl`, reading width `max-w-2xl`. Sections alternate page background and a
  tinted band (`bg-stone-50` or the page color) rather than drawing boxes around everything.
- Space generously: `gap-4`–`gap-6` inside cards, `py-12`–`py-16` between sections on the public
  site. The staff portal is denser: `gap-3`–`gap-4`, `p-4`–`p-5`.
- Mobile first. Everything works at 320px wide with no sideways scroll; grids drop to one or two
  columns.

## Motion

- Lists that change (filtering results) enter with `.ph-enter`: fade and rise 8px, staggered by at most
  30ms per card for the first eight. Keep the grid keyed by id so cards that stay do not replay it.
- Hover: cards lift (`.ph-lift`), buttons darken. Press: sink 1px. Enter: fade or slide up to 8px
  over `--ph-duration`. Use `--ph-ease` for everything.
- Give feedback where a person acts (heart, save, submit). Do not animate things that are just
  sitting there.
- No parallax, no auto-playing carousels, no confetti on serious pages (applications, donations,
  lost pets).

## Voice

- Plain, kind, short. "Adopt", "foster", "visit", "volunteer". Use the animal's name instead of
  "listing" or "record".
- Cute lives in small moments: a note in the animal's voice ("Blizzard says hi"), a warm
  confirmation. Never baby talk, never jokes in errors, forms, or anything about money, medical
  needs, or lost pets.
- Say what happens next after every action.

## Public site and staff portal

| | Public site | Staff portal |
| --- | --- | --- |
| Goal | Feel welcome, find an animal, act | Scan, decide, do it fast |
| Photos | Large, everywhere | Small thumbnails for recognition |
| Decoration | Blobs, highlights, notes, sparingly | None |
| Density | Roomy, 44px targets | Compact; respects the density setting |
| Color | Brand and warm accents | Mostly neutral; color means status |
| Corners | Cards 22px, photos inset | Same tokens: cards and tables `--ph-radius`, fields and menus `--ph-radius-sm`, chips, nav items, and search `--ph-radius-pill` |
| Depth | Cards lift on hover | Resting `shadow-sm`; only tiles that go somewhere lift (`.ph-lift`); the sheet, dialogs, palette, and floating bulk bar use `shadow-lg` |

Staff kit pieces in `apps/admin/src/portal/ui/index.tsx` (use these, do not restyle one instance):

- **`StatCard`** is the stat tile: a small `IconChip` tinted by tone, a label, a big tabular number, and one line of context. Give it `onClick` when it leads somewhere (it lifts). Use `tone="warn"` only when the number means something needs doing. `flat` makes an inset tile for use inside a card, since cards do not nest.
- **`Meter`** is the rounded meter: pill track and fill, fill colored by level (`ok` brand, `busy` warning, `full` danger), `role="meter"` with `aria-valuetext`. The level word and numbers always sit beside it. `decorative` is for a bar that repeats a number printed next to it.
- **`AnimalThumb`** is the staff animal image: a small rounded photo (lazy, sized), or a soft tinted tile with the first initial when there is no photo or it fails to load. Lists that only know an animal's id get the photo from `usePetPhotos()` (`lib/pets.ts`, the cached animals list).
- **`BulkBar`** is the floating rounded action bar for ticked rows (sticks under the top bar, `shadow-lg`, "Clear" last).
- **Charts and canvas** cannot read `var(...)`: use `resolveVar()` and `useThemeVersion()` from `lib/theme.ts` so a chart reads the live theme and redraws when the theme changes. Turn animation off for reduced motion.
- **Sheet and dialog footers** are right-aligned with the primary action last; destructive actions sit at the left.

## Icons

Icons are [Phosphor](https://phosphoricons.com) (MIT), wrapped in `apps/web/src/ui/icons.tsx` and
`apps/admin/src/portal/ui/icons.tsx`. Import from those files (`import { PawIcon } from '../../ui/icons'`),
never from `@phosphor-icons/react` directly, so a glyph can be swapped in one place.

- Every icon takes normal SVG props (`width`, `height`, `className`), defaults to 20px (public) or
  18px (staff), uses `currentColor`, and is `aria-hidden` by default. Put the meaning in nearby words.
- Utility glyphs (search, close, check, chevrons, plus, menu, sort, external, arrow, heart) are
  `bold` so they hold up at 12-16px. Decorative glyphs are `duotone` (a 20% tint behind the line),
  and switch to `bold` automatically at 20px or smaller. Use duotone sizes of 24px and up for spot
  icons such as a paw on an empty state, and for the "good to know" rows.
- For a glyph that is missing, add one line to both files (import it from
  `@phosphor-icons/react/dist/ssr/<Name>` and call `icon(Glyph, 'duotone', 'NameIcon')`). Always use
  the per-icon `/dist/ssr/` path: it renders on the server and in the browser, and only the icons you
  import reach the bundle (each one carries all six weights, about 2-3 kB raw).
- Available beyond the basics: `HouseIcon`, `MapPinIcon`, `PhoneIcon`, `MailIcon`, `RulerIcon` (size),
  `SexIcon`, `LightningIcon` (energy), `BabyIcon` and `UsersIcon` (good with kids), `DogIcon`,
  `CatIcon`, `ShieldCheckIcon` (vaccinated, neutered), `SparkleIcon`, `ShareIcon`, `InfoIcon`,
  `WarningIcon`, `ArrowRightIcon`.

## Do not

- Emoji as icons, gradients on text, glass or blur panels, glowing borders, purple-to-blue
  gradients, grain over text.
- Thick outlines with hard offset shadows as a general style. That "sticker" treatment is reserved
  for small accents such as a tilted note.
- A second accent color, a second typeface, or a new shadow invented for one page.
- Shadows as the only way to tell things apart: the high-contrast theme has none, so borders must
  still carry the structure.
- Hiding focus rings, or using placeholder text as a label.

## How to iterate on the look

- `/theme` on the public site is a live playground: change colors, fonts, radius, and spacing with
  pickers and sliders, then copy the CSS into `theme.css`. The corner slider drives all three radius
  sizes.
- Set `PUBLIC_THEME_SWITCHER=true` to switch themes in the header while you look around.
- To try a different feel without touching components, change tokens in the `:root` block of
  `theme.css`: `--ph-radius` (22 is soft, 12 is tidy, 0 is square), the three `--ph-shadow*` values,
  `--ph-pop`, `--ph-font-sans`, `--ph-weight-bold`, `--ph-lift`.

## Checklist before you finish a UI change

1. Looked at it at 375px and at desktop width.
2. Looked at it in the default, dark, and high-contrast themes.
3. Tabbed through it: focus is visible and in order; everything works without a mouse.
4. Turned on reduced motion: nothing is missing.
5. `npm run qa:theme` and `npm run check` pass.
6. Loading, empty, and error states exist and read well.

- **Page hero.** `PageHero` (kit): eyebrow pill, h1, one sentence, actions, and an optional `aside`. Astro pages cannot pass JSX in props, so give `title` as a string with `highlight` (the one word to mark) and put the buttons in `children`. No highlight word on lost-pet, donation, medical, or application pages. Content pages get the same look from `ContentPage.astro` (`eyebrow`, `heading`, `highlight`, an `actions` slot, and `bare` for pages that lay out their own sections, such as About).
- **Accordion.** `Accordion` and `AccordionItem` (kit): rounded real `<details>` items with a chevron that turns; keyboard and no-script friendly. Raw `<details>` inside a `ContentPage` get the same look from its CSS (the FAQ page).
- **Icon tile.** `IconTile` (kit): the round warm tile that holds a decorative icon at the top of a card.
- **Content pages.** `ContentPage` has a soft rounded header band, a reading column (`max-w-3xl`), spaced headings, tables in a rounded frame, `.callout` (a plain note) and `.panel` (a card for fees, hours, and requirements), and accordion `<details>`.
- **Status banner** (`app/status`): a rounded warm callout with an icon tile, a pill meter (`role="meter"` plus the numbers in words), and pill actions. Same logic and copy as before.
- **Events.** Each event is a card with a month/day date tile (decorative; the full date is in the text), time, place (the shelter address), featured animals as small round photo chips that link to the animal, and "Plan a visit". Photos come from the cached animals list. The empty state uses the sleeping mascot.
- **Lost a pet.** Calm only: no highlight word, no celebratory mascot. The phone number and hours sit in one prominent panel; three large choices link to the three sections; the photo picker is a rounded dashed drop target (drag and drop or "Choose photos") that lists each file name with its size and a Remove button; matches are cards; the `searching` mascot appears only in the "no match" state.
- **Donate.** Amount choices are big pill radios with a check when chosen; the wishlist items are cards without meters because `SHELTER.wishlist` has no stock or goal numbers (add a meter only when real numbers exist, using `role="meter"` with `aria-valuetext`). The supporter wall is a set of warm cards. The thank-you page uses the `celebrating` mascot.

## What is not built yet

Phase 1 delivered the tokens, the font, and the restyled kit and animal card. Phase 2 delivered the
public site pages: Home (photo hero with the live count, search pill and chips, a featured animal in a
blob with a note card, tinted bands), Adopt (search, sort and quick chips above the grid, "More filters"
sheet, removable active filters, same URL parameters as before), the animal profile (framed gallery,
note in the animal's voice from real data, icon rows, sticky action card with Share, similar animals),
and a pill header and soft footer. Phase 3 delivered the flows and account area: the shared stepper,
choice cards, summary card, confirmation, ticket card, switch, and mascot empty states in the kit; visit,
apply, and the volunteer sign-up (stepper, sticky summary, celebratory confirmation with add to calendar);
a split login and sign-up with the welcome mascot; My PawHeaven (greeting, pill tabs, next visit and shift
as tickets, saved animals as a photo strip, switches for email choices); the newsletter pages; and a
friendly 404 ("This page wandered off", built from `src/pages/404.astro`, served with a 404 status by
`not_found_handling` in `apps/web/wrangler.jsonc`).

Still planned: the staff portal pass (rounded meters, thumbnails, chart colors), softer icons for the
remaining thin line glyphs, shadcn registry components, and more spot illustrations beyond the four mascot
poses. The "Pick a time" day tiles and the animal picker on the visit page are still custom tiles rather
than `ChoiceCard`s because they hold many options. Candidates to move into `theme.css` as tokens:
`.ph-band` (a `--ph-band` color), `.ph-enter` and its keyframes. When you build more, follow this guide
and extend it.
