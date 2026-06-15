# Connecting Hume Health (band + scale) to Forge

**The honest situation:** Hume Health doesn't offer a public developer API, so Forge can't pull from
Hume's servers directly. But Hume **syncs to Apple Health** (and Google Fit / Samsung Health), and
that's the bridge. Forge stays local-first — your data never leaves your device — and reads the few
metrics that actually change training decisions: **bodyweight, body-fat %, resting HR, HRV, and sleep.**

You have three ways to get that data in, from least to most automatic.

## 1. Manual (10 seconds) — works today
On the **Today** screen, under **Body & recovery**, tap **Log today** and punch in whatever Hume showed
you this morning. Weight feeds your bodyweight trend and your "2× bodyweight" deadlift target; HRV and
sleep nudge your daily readiness (low HRV or <6 h sleep automatically eases the day's load).

## 2. CSV import — good for backfilling history
1. In the **Hume app**, make sure **Apple Health sync** is on (Profile → Connected Apps).
2. Export your health data to CSV. Easiest tool: **Health Auto Export** (App Store) — it can export
   Weight, HRV, Resting Heart Rate, and Sleep from Apple Health to a `.csv`.
3. In Forge: **Settings → Health data → Import weight / HRV / sleep (CSV)** and pick the file.
   Forge matches columns by name (date, weight, HRV, resting HR, sleep, body fat) — one entry per day.

## On Android (your phone) — the easy paths
You're on Android, so the iPhone Shortcut below doesn't apply. Use either:
- **Paste a line** — glance at the Hume app, then on Forge's Home screen tap *Body & recovery → Log
  today* and type the numbers, or paste a line like `weight:198,hrv:70,rhr:52,sleep:7.2` into the paste box.
- **Screenshot → Claude → paste** — screenshot the Hume app, send it to Claude, and Claude reads it and
  hands you back that exact paste line (and can fold the trend into plan tweaks). No setup, fully hands-off.
- **Advanced (Tasker / MacroDroid)** — Hume also syncs to Google Health Connect; a macro can read those
  values and open `…/?ingest=weight:..,hrv:..,sleep:..` to auto-fill Forge each morning.

## 3. Auto every morning (iPhone Shortcut) — set once, forget
This pushes today's numbers into Forge automatically.

1. Open the **Shortcuts** app → **+** → add actions:
   - **Find Health Samples** → *Weight* → most recent → set variable `W`
   - **Find Health Samples** → *Heart Rate Variability* → most recent → `HRV`
   - **Find Health Samples** → *Resting Heart Rate* → most recent → `RHR`
   - **Find Health Samples** → *Sleep* (hours) → `SLEEP`
   - **Text**: `https://<your-forge-url>/?ingest=weight:[W],hrv:[HRV],rhr:[RHR],sleep:[SLEEP]`
     (insert the variables where shown)
   - **Open URLs** → the Text above
2. (Optional) **Automation** → *Time of Day* 7:00 AM → Run this Shortcut → **Run Immediately**.

When the URL opens, Forge reads the values, saves today's Body & recovery entry, and cleans the URL.
Your `<your-forge-url>` is shown in **Settings → Health data** (the grey `?ingest=…` line) — copy it
from there so the path is exact.

> Tip: a quick "Add to Home Screen" install of Forge means the Shortcut opens it like a native app.

---

**What Forge does with it:** weight → bodyweight trend + bodyweight-relative targets and loads; HRV →
readiness refinement (a dip below your ~2-week baseline trims load ~5%); sleep <6 h → trims intensity
and pulls max-effort impact work; resting HR & body-fat → tracked on the Progress screen. Everything is
optional — log none, some, or all.
