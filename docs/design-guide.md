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
- **Fields.** `Field` + `Input`/`Select`/`Textarea` from the kit: label above, help below, error in
  words under the field, `ErrorSummary` at the top of long forms. Prefer big tappable `Choice`
  options over a dropdown when there are five or fewer options.
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

## What is not built yet

Phase 1 delivered the tokens, the font, and the restyled kit and animal card. Still planned: the
photo hero and filter chips (Home, Adopt, profile), the shared stepper and confirmations, the staff
portal pass (rounded meters, thumbnails, chart colors), softer icons, shadcn registry components,
and a mascot with spot illustrations. When you build those, follow this guide and extend it.
