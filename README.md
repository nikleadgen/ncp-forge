# ⚒︎ Forge — NCP Games Trainer

A local-first, installable phone app that delivers and **autoregulates** a 12-month, research-backed
training program to take you from detrained to the podium at the **New Christendom Press Games**
(~June 2027). Open it, do a 10-second readiness check, hit Start, log a number — that's the whole
interaction. The plan adjusts set-to-set, session-to-session, week-to-week, and cycle-to-cycle.

- **The plan:** [`docs/PROGRAM-OVERVIEW.md`](docs/PROGRAM-OVERVIEW.md) — the 52-week, 7-block campaign.
- **The why:** [`docs/PROGRAM-SCIENCE.md`](docs/PROGRAM-SCIENCE.md) — the evidence behind every choice
  (60+ peer-reviewed/authoritative sources), validated by an independent S&C red-team.

## What makes it smart
- **Set-to-set:** loads are prescribed in reps-in-reserve; report an RPE and the next set auto-adjusts.
- **Session:** a 5-tap readiness check (sleep/freshness/energy/calm/drive) scales today's load & volume.
- **Week:** an acute:chronic workload monitor flags when you're ramping too fast.
- **Cycle:** every logged top set updates your working maxes, so the plan gets heavier as you do.
- **Periodized for the real events:** max deadlift + "Cindy" for the qualifier; sandbag ladder, a fast
  mile, and the field metcon for the finals — with a dedicated bridge block between the two peaks.

## Run it
Zero dependencies, no build step. It just needs to be served over http (for ES modules + offline).

```bash
cd "Fitness Training"
python3 -m http.server 8731      # then open http://localhost:8731
```

Any static host works too (Cloudflare Pages, Netlify, GitHub Pages) — just upload the folder.

## Install on your phone
1. Serve the folder somewhere your phone can reach (a static host, or your computer on the same Wi-Fi).
2. Open the URL in **Safari (iPhone)** or **Chrome (Android)**.
3. **Share → Add to Home Screen.** It installs as a full-screen app and works **offline** after first load.

**Updates are automatic.** The service worker is network-first, so the installed app always loads the
latest version when you open it online, and auto-reloads if a new version went live while it was open.
The current version is shown at the bottom of Settings.

## Your data
- Everything lives in your browser on your device (`localStorage`). No accounts, no servers, no tracking.
- **Back up anytime:** Settings → Export (downloads a `.json`). Restore with Import.

## Tech
Vanilla JS (ES modules), HTML, CSS. PWA via `manifest.webmanifest` + `sw.js`. Hand-rolled SVG charts.
No frameworks, no bundler, no dependencies.

```
index.html · app.css · app.js · manifest.webmanifest · sw.js · icons/
js/  store.js · exercises.js · program.js · engine.js · charts.js · ui.js
docs/ PROGRAM-SCIENCE.md · PROGRAM-OVERVIEW.md
scripts/ gen-icons.mjs   # regenerates the app icons
```

*Not medical advice. Train smart, respect pain, fuel and sleep well. Come and conquer.*
