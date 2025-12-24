/* app.js
 * ARCBOS Ops Portal — minimal loader/router
 * - Robust base path for GitHub Pages repo sites
 * - Graceful if /data/meta.json missing
 */

(function () {
  'use strict';

  function getBasePath() {
    // Example:
    // - https://enxpower.github.io/arcbos-ops-portal/pages/dashboard.html
    // - base should be /arcbos-ops-portal
    const p = window.location.pathname;
    // remove trailing file
    const parts = p.split('/').filter(Boolean);

    // If hosted on GitHub Pages repo site, first segment is repo name
    // e.g. /arcbos-ops-portal/...
    if (parts.length > 0) return '/' + parts[0];
    return '';
  }

  const BASE = getBasePath();

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  }

  function setHeaderStatus(lastUpdated, dataStatus) {
    // These IDs should exist in your header. If not, adjust here.
    const lu = document.getElementById('lastUpdated');
    const ds = document.getElementById('dataStatus');

    if (lu) lu.textContent = lastUpdated || '—';
    if (ds) ds.textContent = dataStatus || '—';
  }

  async function loadAll() {
    // Load datasets. Adjust if your filenames differ.
    // Keep them independent: one missing file shouldn't kill the whole dashboard.
    const data = {};

    const targets = [
      { key: 'bom', url: `${BASE}/data/bom.json` },
      { key: 'parts', url: `${BASE}/data/parts.json` },
      { key: 'suppliers', url: `${BASE}/data/suppliers.json` },
      { key: 'changes', url: `${BASE}/data/changes.json` }
    ];

    for (const t of targets) {
      try {
        data[t.key] = await fetchJson(t.url);
      } catch (e) {
        console.warn('[ARCBOS] Data load warning:', t.key, e.message);
        // fallback to safe shapes
        data[t.key] = (t.key === 'bom') ? {} : [];
      }
    }

    // Normalize bom if it contains nodes under a property
    // If your bom.json is already an object with nodes, leave as is.
    if (Array.isArray(data.bom)) {
      data.bom = { nodes: data.bom };
    }

    // meta.json is optional
    let lastUpdated = '—';
    let dataStatus = 'ok';

    try {
      const meta = await fetchJson(`${BASE}/data/meta.json`);
      if (meta && typeof meta === 'object') {
        lastUpdated = meta.lastUpdated || meta.updated || meta.date || lastUpdated;
        dataStatus = meta.status || dataStatus;
      }
    } catch (e) {
      // Not fatal — your site can run without meta.json
      console.warn('[ARCBOS] meta.json missing (non-blocking):', e.message);
      // Provide a reasonable fallback: build date from document
      const build = document.querySelector('meta[name="build-date"]')?.getAttribute('content');
      if (build) lastUpdated = build;
    }

    setHeaderStatus(lastUpdated, dataStatus);

    // Expose to renderers
    window.arcbosData = data;
    return data;
  }

  function getPageName() {
    // You can set <body data-page="dashboard"> or derive from path.
    const bodyPage = document.body && document.body.getAttribute('data-page');
    if (bodyPage) return bodyPage;

    const p = window.location.pathname.toLowerCase();
    if (p.includes('dashboard')) return 'dashboard';
    if (p.includes('bom')) return 'bom';
    if (p.includes('parts')) return 'parts';
    if (p.includes('suppliers')) return 'suppliers';
    if (p.includes('changes')) return 'changes';
    if (p.includes('rules')) return 'rules';
    if (p.includes('templates')) return 'templates';
    return 'dashboard';
  }

  function callRenderer(page) {
    window.ARCBOS = window.ARCBOS || {};

    // For your current issue: dashboard renderer
    if (page === 'dashboard' && typeof window.ARCBOS.renderDashboard === 'function') {
      window.ARCBOS.renderDashboard();
      return;
    }

    // fallback: if you have other renderers, call them
    const key = 'render' + page.charAt(0).toUpperCase() + page.slice(1);
    if (typeof window.ARCBOS[key] === 'function') {
      window.ARCBOS[key]();
      return;
    }

    console.warn('[ARCBOS] No renderer found for page:', page);
  }

  async function init() {
    try {
      await loadAll();
    } catch (e) {
      console.error('[ARCBOS] Data load failed:', e);
      setHeaderStatus('—', 'fetch failed');
      // still try to render; renderers will handle missing data
    }

    const page = getPageName();
    callRenderer(page);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
