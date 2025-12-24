// js/dashboard.js
(function () {
  const TAG = '[dashboard]';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function computeThisWeek(changes) {
    // If your changes.json already has recent items, we can compute
    // a simple summary. If not, show dashes gracefully.
    const out = { newChanges: 0, ecoApproved: 0, openEcr: 0 };

    const list = (changes && (changes.changes || changes.items || changes)) || [];
    if (!Array.isArray(list)) return out;

    // Treat "Implemented" as ECO implemented; "Approved" as ECR approved
    for (const c of list) {
      const type = (c.type || '').toUpperCase();
      const status = (c.status || '').toLowerCase();
      if (type === 'ECO') out.newChanges += 1;
      if (type === 'ECO' && status.includes('implemented')) out.ecoApproved += 1;
      if (type === 'ECR' && status.includes('open')) out.openEcr += 1;
    }
    return out;
  }

  function computeBomHealth(bom) {
    // bom.json schema may be {nodes:[...]} or {bom:{nodes:[...]}} etc.
    const nodes =
      (bom && (bom.nodes || (bom.bom && bom.bom.nodes) || bom.items || bom)) || [];
    const arr = Array.isArray(nodes) ? nodes : [];
    const nodeCount = arr.length;

    let highCriticality = 0;
    let missingSuppliers = 0;

    for (const n of arr) {
      const crit = String(n.criticality || n.crit || '').toLowerCase();
      if (crit === 'critical' || crit === 'high') highCriticality += 1;

      const sup = n.suppliers ?? n.supplierIds ?? n.supplierId ?? n.supplier;
      const hasSupplier =
        (Array.isArray(sup) && sup.length > 0) ||
        (typeof sup === 'string' && sup.trim() !== '') ||
        (typeof sup === 'number');
      if (!hasSupplier) missingSuppliers += 1;
    }

    return { nodeCount, highCriticality, missingSuppliers };
  }

  function scoreSupplier(s, rules) {
    // If suppliers already contain "score", use it. Else compute weighted score if possible.
    if (typeof s.score === 'number') return s.score;

    const weights = rules && rules.supplierScoring && rules.supplierScoring.weights;
    const range = rules && rules.supplierScoring && rules.supplierScoring.range;

    const scores = s.scores || {};
    if (!weights || !scores) return null;

    let total = 0;
    let hasAny = false;
    for (const [k, w] of Object.entries(weights)) {
      const v = scores[k];
      if (typeof v === 'number') {
        total += v * w;
        hasAny = true;
      }
    }
    if (!hasAny) return null;

    // Normalize if a range is provided (e.g. 1-5)
    // Here we keep it as-is; UI just prints number.
    return total;
  }

  function pickTopSuppliers(suppliers, rules, limit = 5) {
    const list =
      (suppliers && (suppliers.suppliers || suppliers.items || suppliers)) || [];
    if (!Array.isArray(list)) return [];

    const scored = list.map((s) => ({
      s,
      score: scoreSupplier(s, rules),
    }));

    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return scored.slice(0, limit);
  }

  function computeKeyRisks(suppliers, parts, rules) {
    // Keep simple and deterministic:
    // - If rules define risk tags, count occurrences from suppliers + parts.
    const riskSet = new Map();

    const addTags = (tags) => {
      if (!tags) return;
      const arr = Array.isArray(tags) ? tags : [tags];
      for (const t of arr) {
        const key = String(t || '').trim();
        if (!key) continue;
        riskSet.set(key, (riskSet.get(key) || 0) + 1);
      }
    };

    const supList =
      (suppliers && (suppliers.suppliers || suppliers.items || suppliers)) || [];
    if (Array.isArray(supList)) {
      for (const s of supList) addTags(s.risks || s.riskTags || s.tags);
    }

    const partList = (parts && (parts.parts || parts.items || parts)) || [];
    if (Array.isArray(partList)) {
      for (const p of partList) addTags(p.risks || p.riskTags || p.tags);
    }

    const out = Array.from(riskSet.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));
    out.sort((a, b) => b.count - a.count);
    return out.slice(0, 6);
  }

  function pickRecentChanges(changes, limit = 6) {
    const list = (changes && (changes.changes || changes.items || changes)) || [];
    if (!Array.isArray(list)) return [];

    // Prefer date desc
    const arr = [...list].sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      return db.localeCompare(da);
    });

    return arr.slice(0, limit);
  }

  function renderDashboard(data) {
    const { bom, parts, suppliers, changes, rules, meta } = data || {};

    // Fill top-left "This week"
    const w = computeThisWeek(changes);
    if ($('kpiNewChanges')) $('kpiNewChanges').textContent = String(w.newChanges);
    if ($('kpiEcoApproved')) $('kpiEcoApproved').textContent = String(w.ecoApproved);
    if ($('kpiOpenEcr')) $('kpiOpenEcr').textContent = String(w.openEcr);

    // Fill BOM health
    const h = computeBomHealth(bom);
    if ($('kpiNodes')) $('kpiNodes').textContent = String(h.nodeCount);
    if ($('kpiHighCrit')) $('kpiHighCrit').textContent = String(h.highCriticality);
    if ($('kpiMissingSuppliers')) $('kpiMissingSuppliers').textContent = String(h.missingSuppliers);
    if ($('bomHealthNote')) {
      $('bomHealthNote').textContent =
        h.missingSuppliers > 0 ? `${h.missingSuppliers} node(s) missing suppliers` : '—';
    }

    // Top suppliers
    const top = pickTopSuppliers(suppliers, rules, 5);
    const topEl = $('topSuppliersList');
    if (topEl) {
      if (top.length === 0) {
        topEl.innerHTML = '<div class="muted">No suppliers loaded</div>';
      } else {
        topEl.innerHTML = top
          .map(({ s, score }) => {
            const id = esc(s.supplierId || s.id || '—');
            const name = esc(s.name || '—');
            const sc = score == null ? '—' : Number(score).toFixed(1);
            return `<div class="listRow"><div class="rowTitle">${name} (${id})</div><div class="rowMeta">score ${sc}</div></div>`;
          })
          .join('');
      }
    }

    // Key risks
    const risks = computeKeyRisks(suppliers, parts, rules);
    const risksEl = $('keyRisksList');
    if (risksEl) {
      if (risks.length === 0) {
        risksEl.textContent = 'No high risks detected';
      } else {
        risksEl.innerHTML = risks
          .map((r) => `<div class="chipRow"><div class="chipTitle">${esc(r.tag)}</div><div class="chipMeta">Occurrences: ${r.count}</div></div>`)
          .join('');
      }
    }

    // Recent changes
    const recent = pickRecentChanges(changes, 6);
    const recentEl = $('recentChangesList');
    if (recentEl) {
      if (recent.length === 0) {
        recentEl.innerHTML = '<div class="muted">No changes loaded</div>';
      } else {
        recentEl.innerHTML = recent
          .map((c) => {
            const id = esc(c.changeId || c.id || '—');
            const type = esc(c.type || '—');
            const status = esc(c.status || '—');
            const title = esc(c.title || '');
            const date = esc(c.date || '');
            return `<div class="listRow"><div class="rowTitle">${id} • ${type} • ${status} — ${title}</div><div class="rowMeta">${date}</div></div>`;
          })
          .join('');
      }
    }

    // Meta: last updated on page header if present
    // (app.js should also set it globally; this is extra resilience)
    if (meta && meta.lastUpdated && $('lastUpdated')) {
      $('lastUpdated').textContent = String(meta.lastUpdated);
    }

    console.log(TAG, 'render OK');
  }

  // Professional: register renderer for app.js router
  window.renderDashboard = renderDashboard;

  // Support both timing orders:
  // 1) app.js loads data, then calls renderer
  // 2) dashboard.js loaded after data already present
  if (window.arcbosData) {
    try {
      renderDashboard(window.arcbosData);
    } catch (e) {
      console.error(TAG, 'render failed:', e);
    }
  } else {
    window.addEventListener('arcbos:dataReady', (ev) => {
      try {
        renderDashboard(ev.detail.arcbosData);
      } catch (e) {
        console.error(TAG, 'render failed:', e);
      }
    });
  }
})();
