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

  // Offline support — only works over http(s)/localhost, silently skipped on file://
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline still works once cached */ });
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
