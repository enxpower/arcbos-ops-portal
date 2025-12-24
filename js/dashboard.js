/* dashboard.js
 * ARCBOS Ops Portal — Dashboard renderer
 * Goal: NEVER leave "Loading..." on screen once data is available.
 * - Loading: only when data not loaded yet.
 * - Empty: show "No data" / "No recent changes" etc.
 * - Ready: render lists and KPIs.
 */

(function () {
  'use strict';

  // ---------- helpers ----------
  function $(id) {
    return document.getElementById(id);
  }

  function safeArray(x) {
    return Array.isArray(x) ? x : [];
  }

  function setText(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = String(text);
  }

  function setHTML(id, html) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = html;
  }

  function clearAndSetEmpty(el, msg) {
    if (!el) return;
    el.innerHTML = '';
    el.textContent = msg;
  }

  function clearEl(el) {
    if (!el) return;
    el.innerHTML = '';
  }

  function li(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div;
  }

  function normalizeSupplier(s) {
    if (!s || typeof s !== 'object') return { name: '—', sku: '—', score: null };
    const name = s.name || s.displayName || s.supplierName || '—';
    const sku = s.sku || s.id || s.supplierId || '—';
    const score =
      typeof s.score === 'number'
        ? s.score
        : (typeof s.weightedScore === 'number' ? s.weightedScore : null);
    return { name, sku, score };
  }

  function normalizeChange(c) {
    if (!c || typeof c !== 'object') return { id: '—', title: '—', status: '—' };
    const id = c.id || c.changeId || c.ecoId || c.ecrId || '—';
    const title = c.title || c.summary || c.description || '—';
    const status = c.status || c.state || c.type || '—';
    return { id, title, status };
  }

  function computeBomNodesCount(bom) {
    // try multiple shapes
    if (!bom || typeof bom !== 'object') return 0;
    if (Array.isArray(bom.nodes)) return bom.nodes.length;
    if (Array.isArray(bom.items)) return bom.items.length;
    if (Array.isArray(bom.tree)) return bom.tree.length;
    if (typeof bom.nodeCount === 'number') return bom.nodeCount;
    if (typeof bom.count === 'number') return bom.count;
    return 0;
  }

  function computeHighCriticalityCount(bom, parts) {
    // If you have explicit KPI already, use it. Otherwise infer.
    if (bom && typeof bom.highCriticality === 'number') return bom.highCriticality;
    if (bom && typeof bom.highCriticalityCount === 'number') return bom.highCriticalityCount;

    const arr = safeArray(parts);
    // infer by fields like criticality: 'High'/'Critical' or numeric ranks
    let n = 0;
    for (const p of arr) {
      const c = (p && (p.criticality || p.risk || p.priority)) ?? '';
      const cs = String(c).toLowerCase();
      if (cs === 'high' || cs === 'critical' || cs === 'p0') n++;
      // numeric conventions: 1 highest
      if (typeof c === 'number' && c <= 1) n++;
    }
    return n;
  }

  function computeMissingSuppliersCount(parts) {
    const arr = safeArray(parts);
    let n = 0;
    for (const p of arr) {
      const supplier =
        p && (p.supplier || p.supplierId || p.supplierSKU || p.vendor || p.vendorId);
      if (!supplier) n++;
    }
    return n;
  }

  function computeRecentWeekCounts(changes) {
    // If your changes already include week buckets, great; otherwise just count.
    const arr = safeArray(changes);
    // Basic: show totals for "This week"
    return {
      newChanges: arr.length,
      ecoApproved: arr.filter(c => String(c.status || c.state || '').toLowerCase().includes('approved')).length,
      openEcr: arr.filter(c => String(c.status || c.state || '').toLowerCase().includes('open')).length
    };
  }

  // ---------- main render ----------
  function renderDashboard() {
    // Data must be placed on window.arcbosData by app.js
    const data = window.arcbosData;

    // 1) data not ready => do nothing, leave initial "Loading..."
    if (!data) {
      // keep existing placeholders
      return;
    }

    const bom = (data && data.bom) || (data && data.bomTree) || (data && data.bom_tree) || {};
    const parts = safeArray(data && (data.parts || data.partList));
    const suppliers = safeArray(data && (data.suppliers || data.supplierList));
    const changes = safeArray(data && (data.changes || data.changeLog));

    // 2) BOM health KPIs — ALWAYS set them (never leave blank)
    const nodesCount = computeBomNodesCount(bom);
    const highCrit = computeHighCriticalityCount(bom, parts);
    const missingSup = computeMissingSuppliersCount(parts);

    // These IDs should match your HTML. If your IDs differ, map them here.
    // BOM health card
    if ($('kpiBomNodes')) setText('kpiBomNodes', nodesCount);
    if ($('kpiHighCriticality')) setText('kpiHighCriticality', highCrit);
    if ($('kpiMissingSuppliers')) setText('kpiMissingSuppliers', missingSup);

    // 3) Top suppliers — MUST clear Loading
    const topSupEl = $('topSuppliers');
    if (topSupEl) {
      clearEl(topSupEl);

      if (!suppliers.length) {
        topSupEl.appendChild(li('No suppliers data'));
      } else {
        // rank by score if present; otherwise keep order
        const normalized = suppliers.map(normalizeSupplier);
        normalized.sort((a, b) => {
          const as = (typeof a.score === 'number') ? a.score : -Infinity;
          const bs = (typeof b.score === 'number') ? b.score : -Infinity;
          return bs - as;
        });

        normalized.slice(0, 5).forEach(s => {
          const scoreText = (typeof s.score === 'number') ? `score ${s.score.toFixed(2)}` : 'score —';
          topSupEl.appendChild(li(`${s.name} (${s.sku}) — ${scoreText}`));
        });
      }
    }

    // 4) Key risks — MUST clear Loading
    const risksEl = $('keyRisks');
    if (risksEl) {
      clearEl(risksEl);

      // very conservative: if you have explicit risks list, use it
      const risks = safeArray(data && (data.risks || data.keyRisks));
      if (risks.length) {
        risks.slice(0, 5).forEach(r => {
          const title = (r && (r.title || r.name || r.summary)) || String(r);
          risksEl.appendChild(li(title));
        });
      } else {
        // fallback
        risksEl.appendChild(li('No high risks detected'));
      }
    }

    // 5) Recent changes — MUST clear Loading
    const recentEl = $('recentChanges');
    if (recentEl) {
      clearEl(recentEl);

      if (!changes.length) {
        recentEl.appendChild(li('No recent changes'));
      } else {
        changes
          .map(normalizeChange)
          .slice(0, 5)
          .forEach(c => {
            recentEl.appendChild(li(`${c.id} • ${c.status} — ${c.title}`));
          });
      }
    }

    // 6) This week — if you have IDs for these
    const weekCounts = computeRecentWeekCounts(changes);
    if ($('kpiWeekNewChanges')) setText('kpiWeekNewChanges', weekCounts.newChanges);
    if ($('kpiWeekEcoApproved')) setText('kpiWeekEcoApproved', weekCounts.ecoApproved);
    if ($('kpiWeekOpenEcr')) setText('kpiWeekOpenEcr', weekCounts.openEcr);

    // Debug log (kept minimal)
    console.log('[dashboard] render OK');
  }

  // Export renderer for app.js router
  window.ARCBOS = window.ARCBOS || {};
  window.ARCBOS.renderDashboard = renderDashboard;
})();
