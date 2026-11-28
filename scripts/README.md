# scripts/

Standalone Node scripts meant to run outside Vercel. They talk to the
deployed app via a shared-secret API — no Supabase creds on the box.

## Why they exist

Woolworths' product-detail API (`/apis/ui/product/detail/<id>`) is
behind Akamai bot protection that **403s any request from Vercel's
datacenter IP range** (and from other datacenter IPs generally). It
accepts requests from a residential connection, so we run the weight
scrape on a Linux box at home instead of shoehorning it into Vercel.

## How it works

```
┌─────────────┐  GET /api/weights/pending   ┌───────────────┐
│             │ ───────────────────────────▶│               │
│   Vercel    │  returns (ingredient_id,    │  Home Linux   │
│  (Supabase  │           stock_code)[]      │     box       │
│   behind)   │                              │               │
│             │ ◀─ hits Woolies product API ◀┤               │
│             │                              │               │
│             │  POST /api/weights/submit    │               │
│             │ ◀────────────────────────────┤               │
│             │  body: {ingredient_id,       │               │
│             │         unit_weight_g}[]     │               │
│             │  Vercel upserts to Supabase  │               │
└─────────────┘                              └───────────────┘
```

Both endpoints are gated by a bearer token (`WEIGHTS_API_TOKEN`) that's
set in both Vercel's env and the box's env.

## `refresh-weights.mjs`

One-shot script:

1. `GET /api/weights/pending` from Vercel — gets the opt-in list.
2. Primes a Woolies session (walks redirects collecting cookies).
3. `GET https://www.woolworths.com.au/apis/ui/product/detail/<code>`
   per code, extracts `UnitWeightInGrams`.
4. `POST /api/weights/submit` to Vercel with the collected weights.

Required env vars on the box:

```
VERCEL_API_URL=https://homerecipebook.vercel.app
WEIGHTS_API_TOKEN=<the shared secret, also set in Vercel>
```

Run once:

```bash
node /opt/recipe-weights/refresh-weights.mjs
```

Returns JSON totals on stdout, exits non-zero on failure.

## `weights-server.mjs`

Thin HTTP wrapper so you can:

- Trigger a refresh ad-hoc:
  `curl http://192.168.1.80:3100/refresh`.
- Point `systemd`'s timer at `GET /refresh` on a weekly schedule.

Optional env:

```
PORT=3100                 # default 3100
REFRESH_TOKEN=some-string # when set, /refresh requires ?token=some-string
```

Routes:

- `GET /health` — always returns `{ok: true}`.
- `GET /refresh` — runs the fetch + submit, returns the result JSON.

## Deployment on a home Linux box

Zero dependencies. Copy the two `.mjs` files and set env vars.
Requires Node 20+.

### Recommended layout

```
/opt/recipe-weights/
  refresh-weights.mjs
  weights-server.mjs
  .env                  # VERCEL_API_URL, WEIGHTS_API_TOKEN, REFRESH_TOKEN
```

### systemd service — HTTP server

`/etc/systemd/system/weights-server.service`:

```ini
[Unit]
Description=Woolies weights server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/recipe-weights
EnvironmentFile=/opt/recipe-weights/.env
ExecStart=/usr/bin/node /opt/recipe-weights/weights-server.mjs
Restart=on-failure
User=weights

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now weights-server
```

### systemd timer — weekly refresh

`/etc/systemd/system/weights-refresh.service`:

```ini
[Unit]
Description=Trigger weekly Woolies weight refresh
After=weights-server.service
Requires=weights-server.service

[Service]
Type=oneshot
EnvironmentFile=/opt/recipe-weights/.env
ExecStart=/usr/bin/curl -fsS "http://127.0.0.1:3100/refresh?token=${REFRESH_TOKEN}" -o /tmp/weights.log
```

`/etc/systemd/system/weights-refresh.timer`:

```ini
[Unit]
Description=Weekly Woolies weight refresh (Wed 7am local)

[Timer]
OnCalendar=Wed 07:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now weights-refresh.timer
```

Check it:

```bash
systemctl list-timers weights-refresh.timer
journalctl -u weights-refresh.service -e
```

### Manual trigger from your phone / another machine

```
http://192.168.1.80:3100/refresh?token=…
```

(Only accessible from your LAN unless you forward the port, which you
probably shouldn't.)
