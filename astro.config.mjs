// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Live URL — used for absolute canonical/OG/JSON-LD tags.
  // Update this if you attach a custom domain in wrangler.jsonc.
  site: 'https://personal-site.matwming114.workers.dev',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
