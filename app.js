// app.js — bootstrap: load state, mount UI, route, register the service worker.
import * as store from './js/store.js';
import * as ui from './js/ui.js';

function boot() {
  store.load();
  // Health bridge: an iPhone Shortcut can open ...?ingest=weight:200,hrv:65,sleep:7.4 to push Hume data in.
  const ingest = new URLSearchParams(location.search).get('ingest');
  if (ingest) { try { ui.ingestFromURL(ingest); } catch (e) { /* ignore malformed */ } history.replaceState(null, '', location.pathname + location.hash); }
  ui.init(document.getElementById('app'));
  if (!location.hash) location.hash = '#/today';
  ui.render();
  window.addEventListener('hashchange', ui.render);

  // Live updates + offline. Network-first SW (see sw.js); auto-reload when a new version activates.
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return; refreshing = true; location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.update();
        // check for a new version whenever the app is reopened/refocused, and hourly while open
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
        setInterval(() => reg.update(), 60 * 60 * 1000);
      }).catch(() => { /* offline still works once cached */ });
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
