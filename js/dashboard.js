// js/dashboard.js
// Robust, data-waiting dashboard renderer for ARCBOS Ops Portal
(function () {
  const LOG = '[dashboard]';

  // ----- tiny DOM helpers -----
  const $id = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const el = $id(id);
    if (!el) return;
    el.textContent = value;
  };

  const setHTML = (id, html) => {
    const el = $id(id);
    if (!el) return;
    el.innerHTML = html;
  };

  // ----- normalize helpers -----
  const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.changes)) return v.changes;
    if (Array.isArray(v.rows)) return v.rows;
    if (Array.isArray(v.parts)) return v.parts;
    if (Array.isArray(v.suppliers)) return v.suppliers;
    if (Array.isArray(v.nodes)) return v.nodes;
    return [];
  };

  const safeDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // ----- renderers -----
  function renderDashboard(arcbosData) {
    const data = arcbosData || {};

    // IMPORTANT:
    // Your arcbosData might be either:
    // - { changes: [...] } or { changes: { items: [...] } } etc.
    // - or { datasets: { changes: ... } }
    // We accept either.
    const changesRaw = data.changes ?? data.datasets?.changes ?? data.data?.changes;
    const partsRaw = data.parts ?? data.datasets?.parts ?? data.data?.parts;
    const suppliersRaw = data.suppliers ?? data.datasets?.suppliers ?? data.data?.suppliers;
    const bomRaw = data.bom ?? data.datasets?.bom ?? data.data?.bom;

    const changes = asArray(changesRaw);
    const parts = asArray(partsRaw);
    const suppliers = asArray(suppliersRaw);
    const bom = asArray(bomRaw);

    // ---- This week (7d) ----
    (function renderThisWeek() {
      const now = new Date();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      const recent = changes.filter((c) => {
        const d = safeDate(c.date || c.createdAt || c.updatedAt);
        if (!d) return false;
        return now.getTime() - d.getTime() <= sevenDays;
      });

      const ecoApproved = recent.filter((c) => (c.type || '').toUpperCase() === 'ECO' && (c.status || '').toLowerCase() === 'approved');
      const openEcr = changes.filter((c) => (c.type || '').toUpperCase() === 'ECR' && (c.status || '').toLowerCase() !== 'closed');

      setText('kpiNewChanges', recent.length);
      setText('kpiEcoApproved', ecoApproved.length);
      setText('kpiOpenEcr', openEcr.length);

      // optional pill
      setText('pillWeek', '7d');
    })();

    // ---- BOM health ----
    (function renderBomHealth() {
      setText('kpiBomNodes', bom.length);

      const highCrit = bom.filter((n) => (n.criticality || '').toLowerCase() === 'critical');
      setText('kpiHighCrit', highCrit.length);

      const missingSup = bom.filter((n) => {
        const s = n.suppliers ?? n.supplierIds ?? n.supplier ?? [];
        const arr = asArray(s);
        return arr.length === 0;
      });
      setText('kpiMissingSuppliers', missingSup.length);

      setText('badgeBomHealth', missingSup.length === 0 ? 'OK' : 'Attention');
      setText('bomHealthHint', missingSup.length === 0 ? 'All nodes have suppliers' : `${missingSup.length} node(s) missing suppliers`);
    })();

    // ---- Top suppliers ----
    (function renderTopSuppliers() {
      const el = $id('topSuppliers');
      if (!el) return;

      el.innerHTML = '';

      if (!suppliers.length) {
        el.textContent = 'No supplier data';
        return;
      }

      // Sort: higher score first (if score exists)
      const sorted = [...suppliers].sort((a, b) => {
        const sa = Number(a.score ?? a.weightedScore ?? a.totalScore ?? 0);
        const sb = Number(b.score ?? b.weightedScore ?? b.totalScore ?? 0);
        return sb - sa;
      });

      sorted.slice(0, 5).forEach((s) => {
        const name = s.name || s.supplierName || s.id || s.supplierId || 'Supplier';
        const id = s.id || s.supplierId || '';
        const score = s.score ?? s.weightedScore ?? s.totalScore ?? '—';

        const row = document.createElement('div');
        row.className = 'list__row';
        row.textContent = `${name}${id ? ` (${id})` : ''} — score ${score}`;
        el.appendChild(row);
      });
    })();

    // ---- Key risks ----
    (function renderKeyRisks() {
      const el = $id('keyRisks');
      if (!el) return;

      el.innerHTML = '';

      // interpret risk tags flexibly
      const risky = parts.filter((p) => {
        const r = (p.risk || p.riskTag || p.riskLevel || '').toString().toLowerCase();
        return r === 'high' || r === 'critical' || r.includes('lead-time') || r.includes('single-source');
      });

      if (!risky.length) {
        el.textContent = 'No high risks detected';
        return;
      }

      risky.slice(0, 6).forEach((p) => {
        const sku = p.sku || p.partSku || p.id || '—';
        const r = p.risk || p.riskTag || p.riskLevel || 'Risk';
        const row = document.createElement('div');
        row.className = 'list__row';
        row.textContent = `${sku} — ${r}`;
        el.appendChild(row);
      });
    })();

    // ---- Recent changes ----
    (function renderRecentChanges() {
      const el = $id('recentChanges');
      if (!el) return;

      el.innerHTML = '';

      if (!changes.length) {
        el.textContent = 'No changes';
        return;
      }

      // Sort by date desc if possible
      const sorted = [...changes].sort((a, b) => {
        const da = safeDate(a.date || a.createdAt || a.updatedAt);
        const db = safeDate(b.date || b.createdAt || b.updatedAt);
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return tb - ta;
      });

      sorted.slice(0, 5).forEach((c) => {
        const id = c.changeId || c.id || '';
        const type = (c.type || '').toUpperCase();
        const status = c.status || '';
        const title = c.title || c.summary || '';
        const row = document.createElement('div');
        row.className = 'list__row';
        row.textContent = `${id ? id + ' · ' : ''}${type ? type + ' · ' : ''}${status}${title ? ` — ${title}` : ''}`;
        el.appendChild(row);
      });
    })();

    console.log(LOG, 'render OK');
  }

  // ----- wait for data once, then render -----
  function waitForArcbosDataAndRender() {
    const MAX_MS = 8000;     // 8s timeout (GitHub Pages JSON fetch can be slow first time)
    const STEP_MS = 120;     // poll interval
    const started = Date.now();

    const tick = () => {
      // arcbosData might be set by app.js after it fetches /data/*.json
      const ready = window.arcbosData && (window.arcbosData.changes || window.arcbosData.datasets || window.arcbosData.data);

      if (ready) {
        renderDashboard(window.arcbosData);
        return;
      }

      if (Date.now() - started > MAX_MS) {
        console.warn(LOG, 'arcbosData not ready after timeout. Check /data/*.json fetch or app.js load order.');
        // Keep page graceful: replace Loading... with friendly placeholders if elements exist
        setText('topSuppliers', 'No data (check /data)');
        setText('keyRisks', 'No data (check /data)');
        setText('recentChanges', 'No data (check /data)');
        return;
      }

      setTimeout(tick, STEP_MS);
    };

    tick();
  }

  // Run after DOM is ready (but still wait for data)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForArcbosDataAndRender);
  } else {
    waitForArcbosDataAndRender();
  }
})();
