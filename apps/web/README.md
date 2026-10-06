# Public site

This Astro site serves PawHeaven's public account and pet-browsing pages. It keeps the existing `pawheaven-frontend` Cloudflare Worker name and deploys static assets. Run it from the repository root with `npm run dev:web`.

Set `PUBLIC_API_BASE_URL` at build time to the API's `/api` URL. Locally, copy `.env.example` to `.env`; the default API URL is `http://localhost:8787/api`. Public browser code calls the API with cookies. The API owns Supabase access.

The pet directory retains clearly labeled sample listings when the API cannot be reached. See the root `README.md` and `BRAINMAP.md` for setup, deployment, and current requirements.
