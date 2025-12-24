/* app.js
 * ARCBOS Ops Portal — robust loader/router for GitHub Pages
 * Fixes:
 * - Robust base path for repo pages
 * - Dataset loader with multiple candidate URLs per dataset
 * - meta.json optional
 */

(function () {
  'use strict';

  function getBasePath() {
    // GitHub Pages repo site: /<repo>/...
    const p = window.location.pathname;
    const parts = p.split('/').filter(Boolean);
    if (parts.length > 0) return '/' + parts[0];
    return '';
  }

  const BASE = getBasePath();

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  }

  async function firstOkJson(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        return { ok: true, url, json: await fetchJson(url) };
      } catch (e) {
        lastErr = e;
      }
    }
    return { ok: false, url: urls[urls.length - 1], json: null, err: lastErr };
  }

  function setHeaderStatus(lastUpdated, dataStatus) {
    const lu = document.getElementById('lastUpdated');
    const ds = document.getElementById('dataStatus');
    if (lu) lu.textContent = lastUpdated || '—';
    if (ds) ds.textContent = dataStatus || '—';
  }

  function normalizeBaseCandidates(rel) {
    // Accept either absolute (/repo/data/...) or relative (/data/...) conventions
    // We prefer BASE first.
    const withBase = `${BASE}${rel}`;
    const withoutBase = rel; // if site deployed at root
    // de-dup
    return Array.from(new Set([withBase, withoutBase]));
  }

  async function loadMeta() {
    const candidates = normalizeBaseCandidates('/data/meta.json');
    const r = await firstOkJson(candidates);
    if (!r.ok) return null;
    return r.json;
  }

  async function loadAll() {
    // IMPORTANT: these are *candidate* filenames/paths (your repo may differ)
    const datasets = [
      {
        key: 'bom',
        candidates: [
          ...normalizeBaseCandidates('/data/bom.json'),
          ...normalizeBaseCandidates('/data/bom_tree.json'),
          ...normalizeBaseCandidates('/data/bomTree.json'),
          ...normalizeBaseCandidates('/data/bom.nodes.json'),
          ...normalizeBaseCandidates('/data/bom/index.json')
        ]
      },
      {
        key: 'parts',
        candidates: [
          ...normalizeBaseCandidates('/data/parts.json'),
          ...normalizeBaseCandidates('/data/part.json'),
          ...normalizeBaseCandidates('/data/parts/index.json'),
          ...normalizeBaseCandidates('/data/part_list.json')
        ]
      },
      {
        key: 'suppliers',
        candidates: [
          ...normalizeBaseCandidates('/data/suppliers.json'),
          ...normalizeBaseCandidates('/data/supplier.json'),
          ...normalizeBaseCandidates('/data/suppliers/index.json'),
          ...normalizeBaseCandidates('/data/supplier_list.json'),
          ...normalizeBaseCandidates('/data/vendors.json')
        ]
      },
      {
        key: 'changes',
        candidates: [
          ...normalizeBaseCandidates('/data/changes.json'),
          ...normalizeBaseCandidates('/data/change.json'),
          ...normalizeBaseCandidates('/data/changes/index.json'),
          ...normalizeBaseCandidates('/data/change_log.json'),
          ...normalizeBaseCandidates('/data/ecr_eco.json')
        ]
      }
    ];

    const data = {};
    const loadReport = [];

    for (const ds of datasets) {
      const r = await firstOkJson(ds.candidates);
      if (r.ok) {
        data[ds.key] = r.json;
        loadReport.push(`${ds.key}: OK (${r.url.replace(BASE, '') || r.url})`);
      } else {
        // Non-blocking: keep sane default
        data[ds.key] = (ds.key === 'bom') ? {} : [];
        loadReport.push(`${ds.key}: MISS`);
        console.warn('[ARCBOS] Dataset load failed:', ds.key, r.err ? r.err.message : '');
      }
    }

    // meta optional
    let lastUpdated = '—';
    let dataStatus = 'ok';
    const meta = await loadMeta();
    if (meta && typeof meta === 'object') {
      lastUpdated = meta.lastUpdated || meta.updated || meta.date || lastUpdated;
      dataStatus = meta.status || dataStatus;
    }

    // show something even without meta
    setHeaderStatus(lastUpdated, dataStatus);

    // expose
    window.arcbosData = data;

    // concise loader report for debugging (no noise)
    console.log('[ARCBOS] data load:', loadReport.join(' | '));

    return data;
  }

  function getPageName() {
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

    const map = {
      dashboard: 'renderDashboard',
      bom: 'renderBom',
      parts: 'renderParts',
      suppliers: 'renderSuppliers',
      changes: 'renderChanges',
      rules: 'renderRules',
      templates: 'renderTemplates'
    };

    const fn = map[page] || 'renderDashboard';
    if (typeof window.ARCBOS[fn] === 'function') {
      window.ARCBOS[fn]();
      return;
    }

    console.warn('[ARCBOS] No renderer found for page:', page, '(expected', fn, ')');
  }

  async function init() {
    try {
      await loadAll();
    } catch (e) {
      console.error('[ARCBOS] init/loadAll failed:', e);
      setHeaderStatus('—', 'fetch failed');
    }

    callRenderer(getPageName());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
