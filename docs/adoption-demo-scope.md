# Adoption demo scope

This document locks the scope for the first end-to-end PawHeaven demo. It is
the delivery boundary for the next implementation phases, not a claim that
every listed use case is already implemented.

## Demo journey

1. An administrator creates or updates a pet record.
2. A visitor searches the available-pet directory and opens the pet's details.
3. The visitor creates an account or logs in.
4. The signed-in user submits an adoption application.
5. An administrator reviews the application and changes its status.

## In scope

- User registration, login, logout, and session handling.
- Public alphabetical pet browsing, text/tag search, pet details, and
  length-of-stay display.
- Administrator pet management, including the public pet image bucket.
- A later, minimal adoption application and administrator review flow.

## Explicitly out of scope for this demo

- Foster applications, matching quiz, lost-pet image matching, appointments,
  donations, volunteering, favorites, notifications, and inventory.
- Payment processing or collecting payment information.
- Collecting driver's-license information or other identity documents.
- A new `staff` authorization role. The implemented roles are `admin` and
  `superuser`, both stored in immutable Supabase `app_metadata`.

## Data and authorization guardrails

- Public users may browse only pets whose status is `Available`.
- Only `admin` and `superuser` may manage pet records and pet images.
- An adoption application must not reserve a pet or approve an adoption when
  submitted; it begins in a pending state for administrator review.
- The Phase 2 application is deliberately limited to the account’s verified
  email, a household/care summary, and an optional note. Do not collect
  identity documents or financial data. Retention and any additional fields
  need a separate design decision.

## Phase 0 verification checklist

- A signed-out visitor can list, search, filter, and open available pets.
- A new public user can register, log in, see their account state, and log out.
- An ordinary user receives no administrator access.
- An `admin` and a `superuser` are both permitted by database policy to manage
  pet records and pet images.

## Phase 2 verification checklist

- A signed-in user can submit one application for an available pet and see its
  pending status on their account page.
- A user cannot submit an application for a non-available pet or view another
  user’s application.
- An administrator can read applications and record an outcome without
  automatically changing the pet’s availability.
