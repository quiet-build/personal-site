# Deploying

This site deploys to **Cloudflare Workers** (static assets) via **GitHub Actions** —
never by manual `wrangler deploy`. Pushing to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it installs, runs
`pnpm build`, and deploys `./dist` with `cloudflare/wrangler-action`.

Config lives in [`wrangler.jsonc`](wrangler.jsonc) (Worker name `personal-site`,
assets from `./dist`). No custom domain yet — it serves from the account's
`*.workers.dev` subdomain.

## One-time setup (required before the first deploy succeeds)

The deploy step needs two **GitHub repository secrets**. Add them under
**Settings → Secrets and variables → Actions → New repository secret**, or with the CLI:

```sh
gh secret set CLOUDFLARE_API_TOKEN  --repo quiet-build/personal-site   # paste token when prompted
gh secret set CLOUDFLARE_ACCOUNT_ID --repo quiet-build/personal-site   # paste account id
```

- **CLOUDFLARE_API_TOKEN** — create at Cloudflare → My Profile → API Tokens, using the
  **"Edit Cloudflare Workers"** template (scoped to this account).
- **CLOUDFLARE_ACCOUNT_ID** — Cloudflare dashboard → Workers & Pages → Account ID (right sidebar).

Also make sure your account's **workers.dev subdomain is enabled** (Workers & Pages →
Subdomain) so the site gets a URL.

After adding the secrets, re-run the latest **Deploy** workflow (Actions tab → Deploy →
Run workflow), or push any commit to `main`. The site goes live at
`https://personal-site.<your-account>.workers.dev`.

## Attaching a custom domain later

1. Add the zone to Cloudflare.
2. In `wrangler.jsonc`, add:
   ```jsonc
   "routes": [{ "pattern": "ming.example.com", "custom_domain": true }]
   ```
3. Update `site` in `astro.config.mjs` to the same URL (for canonical/OG tags).
4. Push — the workflow provisions the custom domain on deploy.
