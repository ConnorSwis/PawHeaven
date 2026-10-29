// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Animal and match pages have addresses like /adopt/blizzard-4f2a91c3. In production a small Worker
 * (src/worker.ts) serves the one built page for any such address. This does the same in `astro dev`.
 */
const ANIMAL_TEMPLATE = '/adopt/pet/';
const RESERVED = new Set(['pet', 'match', 'process']);
/** @returns {import('astro').AstroIntegration} */
function animalRoutes() {
  return {
    name: 'animal-routes',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((request, _response, next) => {
          const url = new URL(request.url ?? '/', 'http://localhost');
          const match = url.pathname.match(/^\/adopt\/([a-z0-9-]+)\/?$/);
          if (match && !RESERVED.has(match[1])) request.url = `${ANIMAL_TEMPLATE}${url.search}`;
          next();
        });
      },
    },
  };
}

export default defineConfig({
  integrations: [react(), animalRoutes()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query', '@radix-ui/react-dialog'] },
  },
});
