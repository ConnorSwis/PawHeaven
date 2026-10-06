# PawHeaven contributor guidance

Read `BRAINMAP.md` and root `README.md` before changing this repo. Update the brain map when a conversation adds a requirement or an implementation changes an architecture decision or feature status.

Use the root npm workspaces and one root lockfile. Keep each app focused: `apps/web` for public Astro pages, `apps/api` for Supabase access, and `packages/contracts` for shared API shapes. Extract shared UI code only after there is a real repeated responsibility.

Supabase Auth owns passwords. The API uses the publishable key. Never add a service-role or secret key to client or Worker code.

Run `npm run check` for repository changes. Follow `apps/web/AGENTS.md` when working in the public site.
