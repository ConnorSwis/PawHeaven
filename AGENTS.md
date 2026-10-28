# PawHeaven contributor guidance

Read `BRAINMAP.md` and root `README.md` before changing this repo. `BRAINMAP.md` contains the AI-agent operating manual and is the implementation-context source of truth. Update the brain map when a conversation adds a requirement or an implementation changes an architecture decision or feature status.

Use the root npm workspaces and one root lockfile. Keep each app focused: `apps/web` for public Astro pages, `apps/admin` for the internal Astro portal, `apps/api` for Supabase access, and `packages/contracts` for shared API shapes. Extract shared UI code only after there is a real repeated responsibility.

Supabase Auth owns passwords. The API normally uses the publishable key. Never add a service-role or secret key to client code, static Worker vars, or source control. The documented `ADMIN_SUPABASE_SERVICE_ROLE_KEY` exception is an API-Worker secret used for server-side Supabase Auth administration, including invitations, immutable role assignment, and authorized account management, and for one more narrow purpose: the signature-verified Stripe webhook (`/webhooks/stripe`) calls the service-role-only `record_donation()` function to record confirmed donations. Nothing else may use it.

Run `npm run check` for repository changes. Follow `apps/web/AGENTS.md` when working in the public site.
