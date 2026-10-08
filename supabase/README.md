# Supabase contributor and production workflow

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

## Production deployment: administrators only

The repository has two workflows:

- `Verify Supabase migrations` runs for pull requests and starts an isolated local Supabase stack. It has no production credentials.
- `Deploy Supabase migrations` runs only when a migration/configuration change reaches `main`. It references GitHub's `production` environment, so its credentials are unavailable until a designated reviewer approves that deployment.

One repository administrator must configure the `production` environment once:

1. In GitHub **Settings → Environments**, create `production`.
2. Restrict deployments to protected branches, add the project owner as a required reviewer, and enable **Prevent self-review** when an independent reviewer is available. Do not allow bypassing protection rules.
3. Add the `SUPABASE_DB_URL` environment secret, never a repository-level secret. In the Supabase dashboard, select **Connect** and copy the production **Session Pooler** URL (the host ends in `pooler.supabase.com` and the port is `5432`). Insert the URL-encoded database password if the dashboard does not already include it. This IPv4-compatible URL lets GitHub-hosted runners apply migrations without the paid IPv4 add-on.
4. Protect `main` in GitHub: require pull requests, at least one approval, the `Reset local database from migrations` status check, and no force pushes.
5. In Supabase, remove contributor roles that can manage database content or retrieve database credentials. Keep the production project accessible only to the deployment owner (or use a read-only/no-access role where the plan supports it).

Production changes now have two separate approvals: the normal pull-request review before code reaches `main`, and the protected-environment approval before the workflow receives the production connection string. The workflow is deliberately the only repository location that runs `supabase db push` against production, using the IPv4-compatible Session Pooler rather than linking contributors' checkouts to production.

If a production migration fails, do not use the dashboard to patch around it. Stop, diagnose the migration history, and deliver the corrective change through a reviewed migration.
