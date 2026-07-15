// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: after the first deploy, set this to the live URL so canonical/OG tags are
  // absolute — your workers.dev subdomain (personal-site.<your-account>.workers.dev)
  // or a custom domain once attached in wrangler.jsonc.
  site: 'https://personal-site.workers.dev',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
