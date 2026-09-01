# asthikambalapadi.in — Asthik

A minimal Claude-backed chat UI (`index.html` / `style.css` / `app.js`), served
statically via GitHub Pages, backed by a Cloudflare Worker (`/worker`) that
holds the Anthropic API key server-side and proxies streaming responses.

Gated behind a simple access code (`x-access-code` header) so the endpoint
isn't wide open to anyone who finds the URL — this is not real
authentication, just a way to keep a public-repo deployment from being
casually abused.

## 1. Deploy the Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ACCESS_CODE
npm run deploy
```

`wrangler deploy` prints the Worker's URL, e.g.
`https://claude-proxy.<your-subdomain>.workers.dev`.

If you want it on a custom subdomain (e.g. `api.asthikambalapadi.in`)
instead of `workers.dev`, add a route in the Cloudflare dashboard once the
domain's nameservers point at Cloudflare — otherwise the `workers.dev` URL
works as-is with no extra DNS.

## 2. Point the frontend at it

Edit `config.js` at the repo root:

```js
window.CLAUDE_WORKER_URL = "https://claude-proxy.<your-subdomain>.workers.dev";
```

## 3. Publish

Push to `main` (GitHub Pages serves it at `asthikambalapadi.in` via the
existing `CNAME`). Open the site, enter the access code you set above, and
chat.

## Notes

- Conversation history is stored in the browser's `localStorage` only —
  nothing is persisted server-side.
- The Worker's `ALLOWED_ORIGIN` (in `wrangler.toml`) restricts CORS to
  `https://asthikambalapadi.in`. Update it if you serve the UI from
  elsewhere.
- Model is pinned to `claude-opus-5` in `worker/src/index.ts`.
