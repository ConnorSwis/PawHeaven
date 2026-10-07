# Public site

This Astro site serves PawHeaven's public account and pet-browsing pages. It keeps the existing `pawheaven-frontend` Cloudflare Worker name and deploys static assets. Run it from the repository root with `npm run dev:web`.

On `workers.dev`, the deployed public site derives and calls the matching API Worker URL directly. Locally, copy `.env.example` to `.env`; Astro's development server calls the default `http://localhost:8787/api`. For a custom-domain deployment, set `PUBLIC_API_BASE_URL` to the API's `/api` URL during the build.

The pet directory retains clearly labeled sample listings when the API cannot be reached. See the root `README.md` and `BRAINMAP.md` for setup, deployment, and current requirements.
