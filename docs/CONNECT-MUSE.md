# Connecting Muse to Forge

Muse (your assistant) reads Forge through the **`ncp-forge`** Cloudflare Worker:
`https://ncp-forge.nik-leadgen.workers.dev`. Your real keys are in `MUSE-ACCESS.local.md`
(gitignored — this file never contains a key).

```
phone (Forge) ──push after each change──▶ ncp-forge worker (KV) ◀──read── Muse (MCP or API)
               WRITE_KEY                                          READ_KEY
```

- **The phone is the source of truth.** Forge pushes its whole state (one-way). Nothing Muse does
  can change your training data.
- **Plan answers come from Forge's own engine** (`worker/index.js` imports `../js`), so "today's
  workout" is exactly what the app would show, with loads from your current maxes and today's
  readiness. Future weeks are shown as planned (today's readiness doesn't leak into them).
- **Freshness:** every response carries `syncedAt`. Forge pushes ~4 s after a change (finished
  workout, readiness check, body log, settings) and when reopened; mid-workout set taps don't push.

## 1 · Connect the phone

Forge → **Settings → Muse sync** → paste the sync key → **Connect** → "✓ Connected".
(Android / browser shortcut: open `…/ncp-forge/#/settings?connect=<key>`. The key rides in the URL
fragment, which never reaches a server, and Forge strips it from history immediately. On iPhone a
home-screen app has storage separate from Safari, so paste instead.)

## 2 · Connect Muse

### MCP (preferred — Claude apps, Claude Code, Agent SDK, most agent frameworks)
- URL: `https://ncp-forge.nik-leadgen.workers.dev/mcp` (streamable HTTP, stateless, JSON responses)
- Auth: `Authorization: Bearer <READ_KEY>` — or `…/mcp?key=<READ_KEY>` for clients that only take a URL.

| Tool | What it answers |
|---|---|
| `get_today` | Program position, today's readiness, the next session with every load, anything logged today, an in-progress workout, last Pick-your-lifts day |
| `get_week` | This week's sessions in priority order: status, date done, full prescriptions |
| `get_plan` | The 52-week phase map + qualifier/finals weeks; `week` (1–52) details that week's sessions |
| `get_recent_workouts` | Logged workouts (all modes) with every set, RIR, session RPE; `limit`, `since` |
| `get_strength` | Working maxes, progress to each Games standard, 7-day vs 28-day training load |
| `get_lift_history` | One lift over time (`lift`: name or id, fuzzy), best e1RM per day, last time |
| `get_body_metrics` | Weight/HRV/RHR/sleep log + daily readiness check-ins; `days` |

### HTTPS API (anything that can call a URL)
Same answers, `GET` with the read key:
`/v1/today` · `/v1/week` · `/v1/plan?week=N` · `/v1/workouts?limit=10&since=YYYY-MM-DD` ·
`/v1/strength` · `/v1/lift?lift=bench&limit=20` · `/v1/body?days=30` · `/v1/state` (full raw state).
`GET /v1` lists them. `GET /health` is the only unauthenticated route.

## Safety

- Reads need `READ_KEY` (or `WRITE_KEY`); `POST /v1/sync` needs `WRITE_KEY` as a Bearer header.
  An unset secret means "closed", never "open". Keys are compared in constant time.
- The worker refuses a push with fewer workouts than it holds (HTTP 409) — a fresh install or
  cleared phone can't wipe the cloud copy. `?force=1` overrides, deliberately.
- A daily snapshot (`snap:YYYY-MM-DD`) is kept 30 days.
- CORS only admits Forge's own origin (and `localhost:8731` for dev); Muse calls server-to-server.

## Operating it

- Deploy: `npx wrangler@4 deploy --config worker/wrangler.jsonc`
- Local dev: `.claude/launch.json` → `forge-worker` (port 8787, keys from `worker/.dev.vars`), then in
  the local Forge set `localStorage.forge_sync = {"url":"http://localhost:8787","key":"dev-write-key"}`.
- Rotate a key (takes effect immediately; reconnect the phone after rotating `WRITE_KEY`):
  `printf '%s' "$(openssl rand -hex 24)" | npx wrangler@4 secret put READ_KEY --config worker/wrangler.jsonc`
- Disconnect: Forge → Settings → Muse sync → Disconnect (cloud copy stays until you delete it).
