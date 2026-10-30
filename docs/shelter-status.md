# Shelter status and "needs help" animals

Part 1 of the feature completion plan (requirements 10 and 11 in `BRAINMAP.md`). Staff say how many kennels the
shelter has and which animals need help; the public site shows how full each species group is and
puts the flagged animals first. Interface notes live in [admin-portal.md](admin-portal.md) and
[public-site.md](public-site.md).

## For staff

| Where | What you can do |
| --- | --- |
| **Animals → Capacity…** | Enter the number of kennels for Dogs, Cats, and Other, and how many are held back for quarantine or medical use. Held-back kennels are not counted as available. A group left at 0 kennels shows "Not set" and never produces a banner. |
| **Animals and Home meters** | Used kennels out of usable kennels for each group. Counted: animals that are Available or Pending and not living in a foster home. Not counted: Adopted, Fostered, Unavailable, or housed in a foster home. |
| **Animals → Needs help** | Flag an animal (editor, or the bulk **Needs help** menu) with one of four reasons: *Needs a home soon*, *Needs a foster*, *Here a long time*, *Needs medical care*. Clear the flag any time. The flag clears by itself when the animal is no longer Available or Pending. |
| **Home → Needs attention** | Three new suggestions: kennels 90 percent full or more; animals flagged for over a week with no applications; animals here over 90 days with no application (with a one-click **Mark needs help**). Nothing is flagged automatically. |

## What visitors see

- A banner on Home, Adopt, Foster, and Volunteer once a group reaches 85 percent ("nearly full"), 100 percent ("full"), or goes over. Below 85 percent it is replaced by a quiet line in the footer.
- A **Needs help most** row on Home and Adopt, a **Needs help first** sort, a badge on each flagged animal's card, and a short callout on the animal page. Shared animal links carry the reason in the description.
- Only the reason label is public. There are no notes, dates, or deadlines.

## How it works

- Migration `20261031000000_shelter_status.sql` (expand-only):
  - `pets.help_reason` (`''`, `home_soon`, `foster`, `long_stay`, `medical`) and `pets.help_since`, kept in step by the `pets_keep_help_state` trigger (it stamps the date on the first flag, keeps it when the reason changes, and clears both when the animal leaves Available/Pending).
  - `shelter_capacity` (one row per group; staff can read it, only `set_shelter_capacity` writes it).
  - `get_shelter_status()` is callable by guests and returns percent, level (`unset`, `ok`, `busy` from 85 percent, `full` at 100, `over`), and counts per group, plus the number of animals who need help. Nothing about individual animals.
  - `set_shelter_capacity(group, kennels, held_back)` and `set_pet_help(pet_ids, reason)` (staff only), and `staff_attention()` gains the three items above.
- API: `GET /public/shelter-status` (cached 60 seconds), `GET /admin/capacity`, `PUT /admin/capacity/<Dog|Cat|Other>`, `POST /admin/pets/help`; pets carry `helpReason` and `helpSince`; the pet editor accepts `helpReason`. Validation is in `apps/api/src/lib/shelter.ts`.
- Shared labels and wording (`HELP_REASON_LABELS`, `HELP_REASON_DETAILS`) live in `packages/contracts/src/index.ts` so staff and visitors see the same words.
- Tests: `supabase/tests/shelter_status_test.sql` (levels, access, trigger, attention items), `tests/shelter-status.test.mjs` (`npm run qa:status`), and a section in `scripts/verify-demo.mjs`.

## Demo data

`supabase/seed-lively.sql` sizes the kennels from today's animals (dogs about 90 percent full, cats and others roomy) and flags four dogs with different reasons. The same statements work on the hosted demo.
