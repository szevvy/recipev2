# scripts/

Standalone Node scripts meant to run outside Vercel. They talk to the
same Supabase instance via its REST API with the service_role key.

## Why they exist

Woolworths' product-detail API (`/apis/ui/product/detail/<id>`) is
behind Akamai bot protection that **403s any request from Vercel's
datacenter IP range** (and from other datacenter IPs generally). It
accepts requests from a residential connection, so we run the weight
scrape on a Linux box at home instead of shoehorning it into Vercel.

## `refresh-weights.mjs`

One-shot script:

1. Pulls every ingredient with `auto_fetch_weight=true` from Supabase.
2. Looks up each one's Woolworths stock codes.
3. Primes a Woolies session (walks redirects collecting cookies).
4. Fetches `UnitWeightInGrams` per code from the product-detail endpoint.
5. Upserts into `ingredient_retailer_weights(ingredient_id, retailer='woolworths', unit_weight_g, updated_at)`.

Required env vars:

```
SUPABASE_URL=https://xyzabc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from Supabase settings>
```

Run once:

```bash
node /opt/recipe-weights/refresh-weights.mjs
```

Returns JSON totals on stdout and exits non-zero on failure.

## `weights-server.mjs`

Thin HTTP wrapper so you can:

- Trigger a refresh from a browser / `curl` on the LAN
  (`curl http://192.168.1.80:3100/refresh`).
- Point a cron job (or `systemd` timer) at `GET /refresh` and let it run weekly.

Optional env:

```
PORT=3100                 # default 3100
REFRESH_TOKEN=some-string # when set, /refresh requires ?token=some-string
```

Routes:

- `GET /health` — always returns `{ok: true}`.
- `GET /refresh` — runs the fetch + upsert, returns the JSON result from
  `refresh-weights.mjs`. Add `?token=…` if `REFRESH_TOKEN` is set.

## Deployment on a home Linux box

The scripts have **no dependencies**. Just copy the two `.mjs` files and
set env vars. Node 20+ required.

### Recommended layout

```
/opt/recipe-weights/
  refresh-weights.mjs
  weights-server.mjs
  .env                 # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REFRESH_TOKEN
```

### systemd unit (recommended)

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

### Scheduled refresh (crontab)

Weekly, Wednesday 7am local — half an hour after Vercel's price refresh
lands:

```cron
0 7 * * 3  curl -fsS "http://127.0.0.1:3100/refresh?token=$REFRESH_TOKEN" -o /tmp/weights.log
```

Or with `systemd`'s own timer, `/etc/systemd/system/weights-server-refresh.service` + `.timer` that calls `curl` the same way.

### Manual trigger from your phone / another machine

```
http://192.168.1.80:3100/refresh?token=…
```

(Only accessible from your LAN unless you forward the port, which you
probably shouldn't.)
