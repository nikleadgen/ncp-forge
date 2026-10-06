// sync.js — sends Forge's state to the ncp-forge worker so Muse (the operator's assistant) can read
// it. Off until a sync key is set (Settings → Muse sync). One-way: this phone is the source of
// truth; the cloud copy is what Muse reads, and doubles as a backup. Offline-first: a push that
// can't go out just waits for the next change, the app coming back to the foreground, or the
// network returning. The worker refuses a push with fewer workouts than it already holds.

import * as store from './store.js';

export const DEFAULT_URL = 'https://ncp-forge.nik-leadgen.workers.dev';
let timer = null;
let inFlight = false;

// Cheap change detector. The in-progress workout is left out, so tapping through sets doesn't
// re-send everything every few seconds — the finished session does.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
function fingerprint(s) { const { active, ...rest } = s; return hash(JSON.stringify(rest)); }

export function init() {
  store.subscribe(() => schedule(4000));
  window.addEventListener('online', () => schedule(0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(500); });
  schedule(1500);
}
function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => { push(); }, ms); }

// → { ok, message }. `force` re-sends even when nothing changed (Connect / Sync now).
export async function push(force = false) {
  const cfg = store.getSync();
  const s = store.get();
  if (!cfg.key || !s.profile) return { ok: false, message: 'Not connected.' };
  if (inFlight) { schedule(3000); return { ok: false, message: 'Already syncing — try again in a moment.' }; }
  const fp = fingerprint(s);
  if (!force && fp === cfg.lastHash) return { ok: true, message: 'Already up to date.' };
  if (navigator.onLine === false) {
    store.setSync({ lastError: "Offline — will sync when you're back online." });
    return { ok: false, message: "You're offline — it'll sync when you're back." };
  }
  inFlight = true;
  try {
    const r = await fetch((cfg.url || DEFAULT_URL) + '/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify(s),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      store.setSync({ lastHash: fp, lastSyncISO: j.syncedAt || new Date().toISOString(), lastError: null });
      return { ok: true, message: 'Synced to Muse.' };
    }
    const msg = r.status === 401 ? 'Sync key rejected — check it and reconnect.' : (j.error || `Sync failed (HTTP ${r.status}).`);
    store.setSync({ lastError: msg });
    return { ok: false, message: msg };
  } catch (e) {
    store.setSync({ lastError: "Couldn't reach the sync server — will retry." });
    return { ok: false, message: "Couldn't reach the sync server — will retry." };
  } finally {
    inFlight = false;
  }
}
