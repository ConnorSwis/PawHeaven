# Theming

One file controls how the whole site looks: [`packages/contracts/src/theme.css`](../packages/contracts/src/theme.css).
The public site and the staff portal both import it, so a change there restyles every page,
the header and footer, forms, badges, the staff portal, and the lost-pet flyer preview.

## The quick way

1. Run the public site (`npm run dev:web`) and open `http://localhost:4321/theme`.
2. Change colors, fonts, text size, spacing, corner radius, and page widths. The page follows live.
3. Press **Copy CSS** and paste the result over the matching lines in the `:root { ... }` block of
   `theme.css`. Rebuild or restart the dev server.

Nothing on `/theme` is saved. It is a `noindex` page that is not linked from the site menus.

## What you can set

Every variable starting with `--ph-` is meant to be edited.

| Group | Variables | Controls |
| --- | --- | --- |
| Brand | `--ph-brand`, `--ph-brand-strong`, `--ph-brand-soft`, `--ph-on-brand`, `--ph-accent` | Primary buttons and links, their hover color, the light tint behind selected or positive items, text drawn on brand backgrounds, and the keyboard focus ring |
| Surfaces | `--ph-page`, `--ph-surface`, `--ph-surface-alt`, `--ph-hover` | Page background, cards, forms, header, menus, and hover backgrounds |
| Text | `--ph-ink-strong`, `--ph-ink`, `--ph-ink-soft`, `--ph-ink-muted`, `--ph-ink-faint` | Headings, body text, secondary text, captions, and the faintest text |
| Lines | `--ph-border`, `--ph-border-strong`, `--ph-divider` | Card borders, form field borders, and hairlines |
| Status | `--ph-danger`, `--ph-warning`, `--ph-success` (each with `-strong` and `-soft`) | Errors, warnings and "in review", and confirmations |
| Fonts | `--ph-font-sans`, `--ph-font-heading` | Body and heading typefaces |
| Size | `--ph-font-size` | Root text size. Everything is sized in `rem`, so type and spacing scale together |
| Space | `--ph-spacing` | The base spacing unit (default `0.25rem`). Raise it for a roomier site, lower it for a denser one |
| Shape | `--ph-radius`, `--ph-shadow`, `--ph-focus-width` | Corner rounding for buttons, fields, cards and images, menu shadow, focus ring width |
| Layout | `--ph-content-width`, `--ph-content-width-medium`, `--ph-reading-width` | Widest page content, mid-width pages, and paragraph width |
| Native controls | `--ph-color-scheme` | `light` or `dark`, so scrollbars and native controls match |

Site identity (the name in the header and page titles, and the footer tagline) is in
[`packages/contracts/src/site.ts`](../packages/contracts/src/site.ts).

## Fonts

Name the family in `--ph-font-sans` (body) or `--ph-font-heading` (headings). To load a web font, add
an `@import url(...)` as the **first** rule of `theme.css` (an example is in the file's comments), or an
`@font-face` rule pointing at a font file you host.

## Ready-made themes

Seven themes ship in `theme.css`, so you can show different looks without editing anything:

| Theme | `PUBLIC_THEME` | Look |
| --- | --- | --- |
| Moss | (empty) | The default: warm cream, moss green, square corners |
| Ocean | `ocean` | Cool light blues and teal, system font, 10px corners |
| Sunset | `sunset` | Cream and terracotta, serif headings, 4px corners |
| Lavender | `lavender` | Soft purples, rounded font, very round 16px corners |
| Dark | `dark` | Warm charcoal with soft green |
| Midnight | `midnight` | Dark navy with sky blue |
| High contrast | `contrast` | Black on white, deep blue, larger text, thick focus ring |

**Show them off live.** Set `PUBLIC_THEME_SWITCHER=true` for the web and admin builds (it is on in your local
`apps/web/.env`) and a **Theme** picker appears in the site footer and the staff portal header. The choice is
remembered in that browser and applies to the next page, so you can flip through the whole site. Leave it unset
on the real site, where visitors should not see it. The `/theme` playground has the same picker plus sliders.

Every theme is checked by `npm run qa:theme` for readable contrast: body, secondary, muted, and link text,
button text, and the text inside error, warning, and confirmation boxes must meet WCAG AA (4.5:1), and form
field borders must reach 3:1 against cards. A new theme that fails is rejected with the exact pair and ratio.

## A whole alternate look

A theme is a `[data-theme="name"]` block that overrides only the variables that differ. Switch the site to a theme by setting `PUBLIC_THEME=dark` in the environment
of the web and admin builds (see `apps/web/.env.example` and `apps/admin/.env.example`) and rebuilding.
Leave it empty for the default. To add another theme, copy an existing block, rename it, change the values, and add it to `THEMES` in
`packages/contracts/src/site.ts` (a test fails if the list and the CSS disagree).

## How it works (so you can trust it)

Tailwind v4 reads every color, font, spacing step, shadow, and container width from CSS variables. The
`@theme` block in `theme.css` points Tailwind's own variables at the `--ph-*` ones: for example
`--color-stone-300` is `var(--ph-border)` and `--color-moss` is `var(--ph-brand)`. Every existing class
such as `border-stone-300`, `bg-white`, `text-red-800` or `max-w-6xl` therefore follows the theme without
being rewritten. `bg-white` means "surface" and `text-on-brand` means "text on a brand color", so a dark
theme can make cards dark and keep button text readable.

## Rules for new code

- Use the themed classes (`bg-white`, `text-stone-700`, `border-stone-300`, `text-red-800`,
  `bg-[var(--color-moss)]`, `text-on-brand`) or the `ph-*` building blocks. Do not write hex or `rgb()`
  colors, and do not use Tailwind color families the theme does not map (blue, purple, gray, and so on).
- In plain CSS or inline styles use `var(--ph-...)`, not `var(--color-...)`: Tailwind only emits its own
  variables that a class uses.
- `npm run qa:theme` (part of `npm run check`) fails if a component hardcodes a color, uses an unmapped
  color, references an undefined `--ph-*` variable, or an alternate theme overrides an unknown one.

## One deliberate exception

The lost-pet flyer pins its own black-on-white colors, because it is meant to be printed and posted and
must stay legible whatever the site theme is. Its preview on screen follows the same rule.
