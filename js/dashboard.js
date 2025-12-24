// dashboard.js
// Safe, defensive dashboard renderer for ARCBOS Ops Portal

(function () {
  if (!window.arcbosData) {
    console.warn('[dashboard] arcbosData not ready');
    return;
  }

  const data = window.arcbosData;

  // ---------- helpers ----------
  const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.changes)) return v.changes;
    if (Array.isArray(v.rows)) return v.rows;
    return [];
  };

  const byId = (id) => document.getElementById(id);

  // ---------- extract datasets safely ----------
  const changes = asArray(data.changes);
  const parts = asArray(data.parts);
  const suppliers = asArray(data.suppliers);
  const bom = asArray(data.bom);

  // ---------- This week ----------
  function renderThisWeek() {
    const now = new Date();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const recent = changes.filter(c => {
      if (!c.date) return false;
      return now - new Date(c.date) <= sevenDays;
    });

    const ecoApproved = recent.filter(c => c.type === 'ECO' && c.status === 'approved');
    const openEcr = changes.filter(c => c.type === 'ECR' && c.status !== 'closed');

    byId('kpiNewChanges').textContent = recent.length;
    byId('kpiEcoApproved').textContent = ecoApproved.length;
    byId('kpiOpenEcr').textContent = openEcr.length;
    byId('pillWeek').textContent = '7d';
  }

  // ---------- BOM health ----------
  function renderBomHealth() {
    byId('kpiBomNodes').textContent = bom.length;

    const highCrit = bom.filter(n => n.criticality === 'Critical');
    byId('kpiHighCrit').textContent = highCrit.length;

    const missingSup = bom.filter(n => !n.suppliers || n.suppliers.length === 0);
    byId('kpiMissingSuppliers').textContent = missingSup.length;

    byId('badgeBomHealth').textContent =
      missingSup.length === 0 ? 'OK' : 'Attention';

    byId('bomHealthHint').textContent =
      missingSup.length === 0
        ? 'All nodes have suppliers'
        : `${missingSup.length} node(s) missing suppliers`;
  }

  // ---------- Top suppliers ----------
  function renderTopSuppliers() {
    const el = byId('topSuppliers');
    el.innerHTML = '';

    if (!suppliers.length) {
      el.textContent = 'No supplier data';
      return;
    }

    suppliers
      .slice(0, 5)
      .forEach(s => {
        const row = document.createElement('div');
        row.className = 'list__row';
        row.textContent = `${s.name || s.id || 'Supplier'} — score ${s.score ?? '—'}`;
        el.appendChild(row);
      });
  }

  // ---------- Key risks ----------
  function renderKeyRisks() {
    const el = byId('keyRisks');
    el.innerHTML = '';

    const riskyParts = parts.filter(p => p.risk === 'High');

    if (!riskyParts.length) {
      el.textContent = 'No high risks detected';
      return;
    }

    riskyParts.slice(0, 5).forEach(p => {
      const row = document.createElement('div');
      row.className = 'list__row';
      row.textContent = `${p.sku || p.id} — High risk`;
      el.appendChild(row);
    });
  }

  // ---------- Recent changes ----------
  function renderRecentChanges() {
    const el = byId('recentChanges');
    el.innerHTML = '';

    if (!changes.length) {
      el.textContent = 'No changes';
      return;
    }

    changes
      .slice(0, 5)
      .forEach(c => {
        const row = document.createElement('div');
        row.className = 'list__row';
        row.textContent = `${c.id || ''} ${c.type || ''} — ${c.status || ''}`;
        el.appendChild(row);
      });
  }

  // ---------- init ----------
  function initDashboard() {
    try {
      renderThisWeek();
      renderBomHealth();
      renderTopSuppliers();
      renderKeyRisks();
      renderRecentChanges();
      console.log('[dashboard] render OK');
    } catch (e) {
      console.error('[dashboard] render failed', e);
    }
  }

  document.addEventListener('DOMContentLoaded', initDashboard);
})();
