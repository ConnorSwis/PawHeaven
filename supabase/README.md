# Supabase contributor guide

## Contributor workflow: local database only

The `supabase/` directory is committed so every contributor can create the same local database. It is not a connection to production. The ignored `supabase/.temp/` directory may contain machine-local CLI metadata; never commit it.

```sh
npm install
npm run db:start
npm run db:reset
npm run db:configure-api
```

`db:reset` runs `supabase db reset --local`. It destroys and rebuilds **only the local Docker database** from committed migrations. Docker (or a Docker-compatible container runtime) must be running first.

`db:configure-api` derives the local API URL and publishable key from the running local stack and writes them to the ignored `apps/api/.dev.vars` file. Do not send or reuse someone else's file: every contributor generates their own local values. `npm run dev:api` runs this setup automatically and refuses to start if the local stack is unavailable.

For a schema change:

```sh
npx supabase migration new add_pet_medical_notes
# edit the generated file in supabase/migrations/
npm run db:reset
git add supabase/migrations
```

Open a pull request with the migration and the code that uses it. Do not run any of these commands from a contributor checkout:

```sh
supabase link
supabase db push
supabase db reset --linked
```

Do not change schemas through the hosted Supabase SQL Editor or Table Editor. If a local experiment needs to become permanent, capture it in a new migration before opening the PR.

## The one rule that protects production

Contributors use the local database only. Do not give contributors access to the production Supabase project, its dashboard, database password, personal access token, or a production environment file.

The repository's `Verify Supabase migrations` pull-request check starts an isolated local Supabase stack and resets it from the committed migrations. It has no production credentials and cannot contact production.

When a reviewed migration needs to reach production, the project owner handles it separately. It is deliberately not automated from this repository. Keep a backup and follow Supabase's production-change procedure before applying it.

If a production migration fails, stop and fix it through a new reviewed migration. Do not give contributors production access to patch it directly.
