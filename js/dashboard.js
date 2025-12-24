/* ARCBOS Ops Portal - Dashboard renderer
   Renders KPI blocks using loaded state.
*/

(function () {
  "use strict";

  // 注册到全局页面渲染器
  window.ARCBOS_PAGES = window.ARCBOS_PAGES || {};

  window.ARCBOS_PAGES.dashboard = function renderDashboard(state) {
    if (!state) return;

    console.info("[ARCBOS] Rendering dashboard");

    /* -----------------------------
       This week (last 7 days)
    ------------------------------*/
    const lastUpdated = state.rules?.meta?.lastUpdated;
    const now = arcbosSafeDate(lastUpdated) || new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const changes = Array.isArray(state.changes?.changes)
      ? state.changes.changes
      : [];

    const recent = changes
      .map(c => ({ ...c, _d: arcbosSafeDate(c.date) }))
      .filter(c => c._d && c._d >= since);

    arcbosSetText("#kpiNewChanges", recent.length);
    arcbosSetText(
      "#kpiEcoApproved",
      recent.filter(c => c.type === "ECO" && c.status === "Approved").length
    );
    arcbosSetText(
      "#kpiOpenEcr",
      changes.filter(c => c.type === "ECR" && c.status !== "Closed").length
    );
    arcbosSetText("#pillWeek", "Last 7 days");

    /* -----------------------------
       BOM health
    ------------------------------*/
    const nodes = Array.isArray(state.bom?.nodes) ? state.bom.nodes : [];

    const totalNodes = nodes.length;
    const highCrit = nodes.filter(
      n => String(n.criticality).toLowerCase() === "high"
    ).length;
    const missingSup = nodes.filter(
      n => !Array.isArray(n.suppliers) || n.suppliers.length === 0
    ).length;

    arcbosSetText("#kpiBomNodes", totalNodes);
    arcbosSetText("#kpiHighCrit", highCrit);
    arcbosSetText("#kpiMissingSuppliers", missingSup);

    const health = arcbosScoreBomHealth({
      totalNodes,
      highCrit,
      missingSup
    });

    arcbosSetText("#badgeBomHealth", health.label);
    arcbosSetText("#bomHealthHint", health.hint);

    /* -----------------------------
       Top suppliers
    ------------------------------*/
    const suppliers = Array.isArray(state.suppliers?.suppliers)
      ? state.suppliers.suppliers
      : [];

    const weights = state.rules?.supplierScoring?.weights || {};

    const ranked = suppliers
      .map(s => ({
        ...s,
        _score: arcbosWeightedSupplierScore(s.scores || {}, weights)
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);

    arcbosRenderList(
      "#topSuppliers",
      ranked.map(s => ({
        title: `${s.name} (${s.supplierId})`,
        meta: `Score: ${arcbosFmt1(s._score)} • Region: ${
          s.region || "—"
        } • Tags: ${(s.riskTags || []).join(", ") || "—"}`
      }))
    );

    /* -----------------------------
       Key risks
    ------------------------------*/
    const risks = [];

    suppliers.forEach(s => {
      (s.riskTags || []).forEach(t =>
        risks.push({ kind: "Supplier", tag: t })
      );
    });

    const parts = Array.isArray(state.parts?.parts)
      ? state.parts.parts
      : [];

    parts.forEach(p => {
      (p.riskTags || []).forEach(t =>
        risks.push({ kind: "Part", tag: t })
      );
    });

    const grouped = arcbosCountBy(risks, r => r.tag || "Unspecified");

    const topRisks = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({
        title: tag,
        meta: `Occurrences: ${count}`
      }));

    arcbosRenderList("#keyRisks", topRisks);

    /* -----------------------------
       Recent changes
    ------------------------------*/
    const recentSorted = recent
      .sort((a, b) => b._d - a._d)
      .slice(0, 6);

    arcbosRenderList(
      "#recentChanges",
      recentSorted.map(c => ({
        title: `${c.changeId} • ${c.type} • ${c.title}`,
        meta: `Status: ${c.status} • Date: ${c.date} • Approver: ${
          c.approver || "—"
        }`
      }))
    );
  };
})();
