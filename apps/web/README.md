# Public site

This Astro site serves PawHeaven's public account and pet-browsing pages. It keeps the existing `pawheaven-frontend` Cloudflare Worker name and deploys static assets. Run it from the repository root with `npm run dev:web`.

The deployed public site calls `/api` on its own hostname. The frontend Worker proxies that path to the matching API Worker, so browser cookies remain first-party. Locally, copy `.env.example` to `.env`; Astro's development server calls the default `http://localhost:8787/api` directly. `PUBLIC_API_BASE_URL` is a local-development setting, not a deployed build setting.

The pet directory retains clearly labeled sample listings when the API cannot be reached. See the root `README.md` and `BRAINMAP.md` for setup, deployment, and current requirements.
