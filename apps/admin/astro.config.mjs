// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle the portal's client libraries so the dev server does not re-optimize mid-session.
    optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query', 'cmdk', '@radix-ui/react-dialog', 'chart.js', '@fullcalendar/core', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/list', '@fullcalendar/interaction'] },
  },
});
