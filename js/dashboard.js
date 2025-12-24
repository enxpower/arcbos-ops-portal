/* dashboard.js
 * ARCBOS Ops Portal — Dashboard renderer (robust data shape support)
 */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function safeArray(x) { return Array.isArray(x) ? x : []; }

  function extractList(x) {
    // supports: [] | {items:[]} | {data:[]} | {list:[]} | {rows:[]} | {suppliers:[]} | {changes:[]}
    if (Array.isArray(x)) return x;
    if (!x || typeof x !== 'object') return [];
    const keys = ['items', 'data', 'list', 'rows', 'suppliers', 'changes', 'records'];
    for (const k of keys) {
      if (Array.isArray(x[k])) return x[k];
    }
    // dictionary object -> convert to values
    // e.g. { "SUP-001": {...}, "SUP-002": {...} }
    const vals = Object.values(x);
    if (vals.length && vals.every(v => v && typeof v === 'object')) return vals;
    return [];
  }

  function setTextIfExists(id, v) {
    const el = $(id);
    if (!el) return;
    el.textContent = String(v);
  }

  function clearEl(el) {
    if (!el) return;
    el.innerHTML = '';
  }

  function appendLine(el, text) {
    const div = document.createElement('div');
    div.textContent = text;
    el.appendChild(div);
  }

  function normalizeSupplier(s) {
    if (!s || typeof s !== 'object') return { name: '—', sku: '—', score: null };
    const name = s.name || s.displayName || s.supplierName || s.vendorName || '—';
    const sku = s.sku || s.id || s.supplierId || s.vendorId || '—';
    const score =
      (typeof s.score === 'number') ? s.score :
      (typeof s.weightedScore === 'number') ? s.weightedScore :
      (typeof s.weight === 'number') ? s.weight :
      null;
    return { name, sku, score };
  }

  function normalizeChange(c) {
    if (!c || typeof c !== 'object') return { id: '—', title: '—', status: '—' };
    const id = c.id || c.changeId || c.ecoId || c.ecrId || c.number || '—';
    const title = c.title || c.summary || c.description || c.subject || '—';
    const status = c.status || c.state || c.phase || c.type || '—';
    return { id, title, status };
  }

  function computeBomNodesCount(bom, parts) {
    if (!bom || typeof bom !== 'object') return safeArray(parts).length;
    if (typeof bom.nodeCount === 'number') return bom.nodeCount;
    if (typeof bom.count === 'number') return bom.count;
    const nodes = extractList(bom.nodes || bom.items || bom.tree || bom);
    if (nodes.length) return nodes.length;
    // fallback to parts length if bom doesn't exist
    return safeArray(parts).length;
  }

  function computeMissingSuppliers(parts) {
    const arr = safeArray(parts);
    let n = 0;
    for (const p of arr) {
      const supplier =
        p && (p.supplier || p.supplierId || p.supplierSKU || p.vendor || p.vendorId || p.mfg);
      if (!supplier) n++;
    }
    return n;
  }

  function computeHighCriticality(parts) {
    const arr = safeArray(parts);
    let n = 0;
    for (const p of arr) {
      const c = (p && (p.criticality || p.risk || p.priority || p.severity)) ?? '';
      const cs = String(c).toLowerCase();
      if (cs === 'high' || cs === 'critical' || cs === 'p0') n++;
      if (typeof c === 'number' && c <= 1) n++;
    }
    return n || '—';
  }

  function inferSuppliersFromParts(parts) {
    const arr = safeArray(parts);
    const map = new Map();
    for (const p of arr) {
      const raw =
        p && (p.supplier || p.supplierId || p.supplierSKU || p.vendor || p.vendorId || p.mfg);
      if (!raw) continue;
      const key = String(raw);
      map.set(key, (map.get(key) || 0) + 1);
    }
    // return pseudo-suppliers
    return Array.from(map.entries()).map(([k, cnt]) => ({
      name: k,
      sku: k,
      score: cnt // use count as score when real score absent
    }));
  }

  function renderDashboard() {
    const data = window.arcbosData;
    if (!data) return;

    const bomRaw = data.bom || data.bomTree || data.bom_tree || {};
    const partsRaw = data.parts || data.partList || [];
    const suppliersRaw = data.suppliers || data.supplierList || [];
    const changesRaw = data.changes || data.changeLog || [];

    const parts = extractList(partsRaw);
    let suppliers = extractList(suppliersRaw);
    const changes = extractList(changesRaw);

    // If suppliers file not available or empty, infer from parts so dashboard still shows reality.
    if (!suppliers.length && parts.length) {
      suppliers = inferSuppliersFromParts(parts);
    }

    // KPIs — IDs must match your HTML (same as之前那版)
    const nodesCount = computeBomNodesCount(bomRaw, parts);
    const highCrit = computeHighCriticality(parts);
    const missingSup = computeMissingSuppliers(parts);

    setTextIfExists('kpiBomNodes', nodesCount);
    setTextIfExists('kpiHighCriticality', highCrit);
    setTextIfExists('kpiMissingSuppliers', missingSup);

    // Top suppliers
    const topSupEl = $('topSuppliers');
    if (topSupEl) {
      clearEl(topSupEl);
      if (!suppliers.length) {
        appendLine(topSupEl, 'No suppliers data');
      } else {
        const normalized = suppliers.map(normalizeSupplier);
        normalized.sort((a, b) => {
          const as = (typeof a.score === 'number') ? a.score : -Infinity;
          const bs = (typeof b.score === 'number') ? b.score : -Infinity;
          return bs - as;
        });
        normalized.slice(0, 5).forEach(s => {
          const scoreText = (typeof s.score === 'number')
            ? `score ${Number.isFinite(s.score) ? s.score.toFixed(2) : s.score}`
            : 'score —';
          appendLine(topSupEl, `${s.name} (${s.sku}) — ${scoreText}`);
        });
      }
    }

    // Key risks — if explicit risks exist, render; else safe default
    const risksEl = $('keyRisks');
    if (risksEl) {
      clearEl(risksEl);
      const risks = extractList(data.risks || data.keyRisks || []);
      if (risks.length) {
        risks.slice(0, 5).forEach(r => {
          const t = (r && (r.title || r.name || r.summary)) || String(r);
          appendLine(risksEl, t);
        });
      } else {
        appendLine(risksEl, 'No high risks detected');
      }
    }

    // Recent changes
    const recentEl = $('recentChanges');
    if (recentEl) {
      clearEl(recentEl);
      if (!changes.length) {
        appendLine(recentEl, 'No recent changes');
      } else {
        changes.map(normalizeChange).slice(0, 5).forEach(c => {
          appendLine(recentEl, `${c.id} • ${c.status} — ${c.title}`);
        });
      }
    }

    // This week counters (optional IDs)
    // If you have actual week computations elsewhere, keep it; this is a safe fallback.
    const weekNew = changes.length;
    const weekEcoApproved = changes.filter(c => String(c.status || '').toLowerCase().includes('approved')).length;
    const weekOpenEcr = changes.filter(c => String(c.status || '').toLowerCase().includes('open')).length;

    setTextIfExists('kpiWeekNewChanges', weekNew);
    setTextIfExists('kpiWeekEcoApproved', weekEcoApproved);
    setTextIfExists('kpiWeekOpenEcr', weekOpenEcr);

    console.log('[dashboard] render OK');
  }

  window.ARCBOS = window.ARCBOS || {};
  window.ARCBOS.renderDashboard = renderDashboard;
})();
