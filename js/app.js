// js/app.js
// ARCBOS Ops Portal bootstrap: load JSON datasets -> expose globals -> handoff to page renderer

(function () {
  const LOG = '[ARCBOS]';

  // ---------- base path (GitHub Pages safe) ----------
  // Examples:
  //  - /arcbos-ops-portal/index.html  -> base = /arcbos-ops-portal/
  //  - /arcbos-ops-portal/pages/bom.html -> base = /arcbos-ops-portal/
  function getBasePath() {
    let p = location.pathname || '/';
    // strip filename
    p = p.replace(/\/[^/]*$/, '/');            // remove last segment
    // if we're in /pages/, go up one level
    p = p.replace(/\/pages\/$/, '/');
    // keep leading slash
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  }

  const BASE = getBasePath(); // ends with "/"
  const DATA_DIR = BASE + 'data/';

  // ---------- UI hooks (optional, safe no-op) ----------
  function setTopStatus(text) {
    const el = document.getElementById('topStatus');
    if (el) el.textContent = text;
  }

  function setLastUpdated(text) {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = text;
  }

  // ---------- fetch helpers ----------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  }

  async function loadAll() {
    // If you later add more datasets, just extend here.
    const urls = {
      bom: DATA_DIR + 'bom.json',
      parts: DATA_DIR + 'parts.json',
      suppliers: DATA_DIR + 'suppliers.json',
      changes: DATA_DIR + 'changes.json',
      rules: DATA_DIR + 'rules.json',
      // optional meta.json (if exists)
      meta: DATA_DIR + 'meta.json',
    };

    const out = { datasets: {}, rules: null, meta: null };

    // Load datasets (non-rules)
    const [bom, parts, suppliers, changes] = await Promise.all([
      fetchJson(urls.bom),
      fetchJson(urls.parts),
      fetchJson(urls.suppliers),
      fetchJson(urls.changes),
    ]);

    out.datasets.bom = bom;
    out.datasets.parts = parts;
    out.datasets.suppliers = suppliers;
    out.datasets.changes = changes;

    // rules
    out.rules = await fetchJson(urls.rules).catch((e) => {
      console.warn(LOG, 'rules.json not loaded:', e);
      return null;
    });

    // meta (optional)
    out.meta = await fetchJson(urls.meta).catch(() => null);

    return out;
  }

  // ---------- page key + renderer ----------
  function getPageKey() {
    // index.html -> dashboard
    triggeringPath = (location.pathname || '').toLowerCase();
    const file = triggeringPath.split('/').pop() || '';
    if (!file || file === 'index.html') return 'dashboard';
    if (file.endsWith('.html')) return file.replace('.html', '');
    return 'dashboard';
  }

  function callRenderer(pageKey, arcbosData) {
    // Prefer explicit function name like renderDashboard/renderBom/renderSuppliers...
    const fnName = 'render' + pageKey.charAt(0).toUpperCase() + pageKey.slice(1);
    const fn = window[fnName];

    if (typeof fn === 'function') {
      try {
        fn(arcbosData);
        console.log(LOG, `renderer ok: ${fnName}`);
        return true;
      } catch (e) {
        console.error(LOG, `renderer error: ${fnName}`, e);
        return false;
      }
    }

    // Backward compatible: some pages might register a generic renderer
    if (typeof window.renderPage === 'function') {
      try {
        window.renderPage(pageKey, arcbosData);
        console.log(LOG, 'renderer ok: renderPage');
        return true;
      } catch (e) {
        console.error(LOG, 'renderer error: renderPage', e);
        return false;
      }
    }

    console.warn(LOG, `No renderer found for page: ${pageKey}`);
    return false;
  }

  // ---------- init ----------
  async function init() {
    try {
      setTopStatus('Loading data...');
      const loaded = await loadAll();

      // Build unified arcbosData object (what all pages can rely on)
      const arcbosData = {
        // common shortcut fields
        bom: loaded.datasets.bom,
        parts: loaded.datasets.parts,
        suppliers: loaded.datasets.suppliers,
        changes: loaded.datasets.changes,

        // also keep the "datasets" container
        datasets: loaded.datasets,

        // optional meta
        meta: loaded.meta || null,
      };

      // ✅ THE CRITICAL FIX: expose globals for page scripts (dashboard.js etc.)
      window.arcbosData = arcbosData;
      window.arcbosRules = loaded.rules || null;

      // last updated display
      const last =
        (loaded.meta && (loaded.meta.lastUpdated || loaded.meta.updatedAt || loaded.meta.date)) ||
        (loaded.rules && (loaded.rules.lastUpdated || loaded.rules.updatedAt)) ||
        null;

      if (last) setLastUpdated(String(last));

      setTopStatus('Data ok');

      // Broadcast a data-ready event (nice for any page)
      window.dispatchEvent(new CustomEvent('arcbos:dataReady', { detail: { arcbosData } }));

      // Handoff to current page renderer
      const pageKey = getPageKey();
      callRenderer(pageKey, arcbosData);
    } catch (e) {
      console.error(LOG, 'Data load failed:', e);
      setTopStatus('fetch failed');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
