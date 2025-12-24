/* =========================================================
 * ARCBOS Ops Portal — Dashboard Renderer
 * Page: index.html
 * Depends on:
 *   - utils.js
 *   - data.js (arcbosDataLoadAll)
 *   - app.js (header meta already handled)
 * ========================================================= */

(function () {
  "use strict";

  if (!window.arcbosDataLoadAll) {
    console.warn("[ARCBOS] arcbosDataLoadAll not found.");
    return;
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  async function initDashboard() {
    let state;
    try {
      state = await window.arcbosDataLoadAll();
    } catch (err) {
      console.error("[ARCBOS] Dashboard load failed:", err);
      return;
    }

    renderThisWeek(state);
    renderBomHealth(state);
    renderTopSuppliers(state);
    renderKeyRisks(state);
    renderRecentChanges(state);
  }

  /* =========================
   * This Week KPIs
   * ========================= */
  function renderThisWeek(state) {
    const changes = state.changes || [];
    const lastUpdated = arcbosSafeDate(state.meta?.lastUpdated) || new Date();
    const since = new Date(lastUpdated.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent = changes.filter(c => {
      const d = arcbosSafeDate(c.date);
      return d && d >= since;
    });

    const newChanges = recent.length;
    const ecoApproved = recent.filter(c => c.type === "ECO" && c.status === "Implemented").length;
    const openEcr = changes.filter(c => c.type === "ECR" && c.status !== "Closed").length;

    arcbosSetText("#kpiNewChanges", newChanges);
    arcbosSetText("#kpiEcoApproved", ecoApproved);
    arcbosSetText("#kpiOpenEcr", openEcr);
    arcbosSetText("#pillWeek", "Last 7 days");
  }

  /* =========================
   * BOM Health
   * ========================= */
  function renderBomHealth(state) {
    const nodes = state.bom?.nodes || [];

    const total = nodes.length;
    const highCrit = nodes.filter(n =>
      String(n.criticality).toLowerCase() === "high" ||
      String(n.criticality).toLowerCase() === "critical"
    ).length;
    const missingSup = nodes.filter(n =>
      !Array.isArray(n.suppliers) || n.suppliers.length === 0
    ).length;

    arcbosSetText("#kpiBomNodes", total);
    arcbosSetText("#kpiHighCrit", highCrit);
    arcbosSetText("#kpiMissingSuppliers", missingSup);

    let label = "Good";
    let hint = "No structural issues detected.";

    if (missingSup > 0 || highCrit > total * 0.3) {
      label = "Attention";
      hint = "Some nodes have no supplier assigned. Close gaps before Beta builds.";
    }

    arcbosSetText("#badgeBomHealth", label);
    arcbosSetText("#bomHealthHint", hint);
  }

  /* =========================
   * Top Suppliers
   * ========================= */
  function renderTopSuppliers(state) {
    const suppliers = state.suppliers || [];
    const weights = state.rules?.supplierScoring?.weights || {};

    const ranked = suppliers
      .map(s => {
        const score = arcbosWeightedSupplierScore(s.scores || {}, weights);
        return { ...s, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);

    const items = ranked.map(s => ({
      title: `${s.name} (${s.supplierId})`,
      meta: `Score: ${arcbosFmt1(s._score)} • Region: ${s.region || "—"} • Tags: ${(s.riskTags || []).join(", ") || "—"}`
    }));

    arcbosRenderList("#topSuppliers", items);
  }

  /* =========================
   * Key Risks
   * ========================= */
  function renderKeyRisks(state) {
    const risks = [];

    (state.suppliers || []).forEach(s => {
      (s.riskTags || []).forEach(tag => {
        risks.push(tag);
      });
    });

    (state.parts || []).forEach(p => {
      (p.riskTags || []).forEach(tag => {
        risks.push(tag);
      });
    });

    const grouped = arcbosCountBy(risks, r => r || "Unspecified");

    const top = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({
        title: tag,
        meta: `Occurrences: ${count}`
      }));

    arcbosRenderList("#keyRisks", top);
  }

  /* =========================
   * Recent Changes
   * ========================= */
  function renderRecentChanges(state) {
    const changes = (state.changes || [])
      .map(c => ({ ...c, _d: arcbosSafeDate(c.date) }))
      .filter(c => c._d)
      .sort((a, b) => b._d - a._d)
      .slice(0, 6);

    const items = changes.map(c => ({
      title: `${c.changeId} • ${c.type} • ${c.title}`,
      meta: `Status: ${c.status} • Date: ${c.date} • Approver: ${c.approver || "—"}`
    }));

    arcbosRenderList("#recentChanges", items);
  }

})();
