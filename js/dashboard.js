/* ARCBOS Ops Portal - Dashboard renderer
   - Renders KPI + lists on index.html
   - Registers renderer for page "dashboard"
   - Compatible with multiple app.js registry styles
*/

(function () {
  "use strict";

  const PAGE = "dashboard";

  function $(sel) {
    return (typeof window.arcbos$ === "function") ? window.arcbos$(sel) : document.querySelector(sel);
  }

  function setText(sel, text) {
    if (typeof window.arcbosSetText === "function") {
      window.arcbosSetText(sel, text);
      return;
    }
    const el = $(sel);
    if (el) el.textContent = String(text == null ? "—" : text);
  }

  function renderList(sel, items) {
    if (typeof window.arcbosRenderList === "function") {
      window.arcbosRenderList(sel, items);
      return;
    }

    // Minimal fallback list renderer (in case utils.js doesn't provide arcbosRenderList)
    const host = $(sel);
    if (!host) return;
    host.innerHTML = "";
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = '<div class="empty__title">No data</div><div class="empty__meta muted">Check JSON files.</div>';
      host.appendChild(empty);
      return;
    }
    for (const it of arr) {
      const row = document.createElement("div");
      row.className = "listRow";
      const t = document.createElement("div");
      t.className = "listRow__title";
      t.textContent = String(it && it.title ? it.title : "—");
      const m = document.createElement("div");
      m.className = "listRow__meta muted";
      m.textContent = String(it && it.meta ? it.meta : "");
      row.appendChild(t);
      row.appendChild(m);
      host.appendChild(row);
    }
  }

  function safeDate(s) {
    return (typeof window.arcbosSafeDate === "function") ? window.arcbosSafeDate(s) : (s ? new Date(s) : null);
  }

  function fmt1(n) {
    return (typeof window.arcbosFmt1 === "function") ? window.arcbosFmt1(n) : (Number.isFinite(+n) ? (+n).toFixed(1) : "—");
  }

  function countBy(list, keyFn) {
    if (typeof window.arcbosCountBy === "function") return window.arcbosCountBy(list, keyFn);
    const m = Object.create(null);
    for (const x of (list || [])) {
      const k = String(keyFn ? keyFn(x) : x);
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }

  function weightedSupplierScore(scores, weights) {
    if (typeof window.arcbosWeightedSupplierScore === "function") {
      return window.arcbosWeightedSupplierScore(scores, weights);
    }
    // Fallback weighted sum
    const s = scores || {};
    const w = weights || {};
    let sum = 0;
    let wsum = 0;
    for (const k of Object.keys(w)) {
      const wk = Number(w[k] || 0);
      const vk = Number(s[k]);
      if (!Number.isFinite(wk)) continue;
      if (!Number.isFinite(vk)) continue;
      sum += vk * wk;
      wsum += wk;
    }
    return wsum > 0 ? (sum / wsum) : 0;
  }

  function scoreBomHealth(input) {
    if (typeof window.arcbosScoreBomHealth === "function") return window.arcbosScoreBomHealth(input);

    // Simple fallback: penalize missing suppliers + high crit ratio
    const total = Math.max(1, Number(input.totalNodes || 0));
    const missingSup = Number(input.missingSup || 0);
    const highCrit = Number(input.highCrit || 0);

    const missRate = missingSup / total;
    const highRate = highCrit / total;

    // 0..100
    let score = 100;
    score -= missRate * 60;
    score -= highRate * 30;
    score = Math.max(0, Math.min(100, score));

    let label = "Good";
    let hint = "Looks healthy.";
    if (score < 70) { label = "Fair"; hint = "Some gaps: check missing suppliers and critical nodes."; }
    if (score < 45) { label = "Poor"; hint = "High risk: many missing suppliers or high criticality."; }

    return { score, label, hint };
  }

  function showLoadFailed(err) {
    setText("#dataStatus", "dashboard failed");
    // leave lastUpdated as-is (app.js likely set it)
    renderList("#topSuppliers", [{
      title: "Data could not be rendered.",
      meta: String((err && err.message) ? err.message : "Unknown error")
    }]);
    renderList("#keyRisks", [{ title: "No data", meta: "Fix dashboard renderer first." }]);
    renderList("#recentChanges", [{ title: "No data", meta: "Fix dashboard renderer first." }]);
  }

  function calcAndRender(state) {
    // Header meta (do not fight app.js, but keep correct)
    const lastUpdated =
      (state.rules && state.rules.meta && state.rules.meta.lastUpdated) ? state.rules.meta.lastUpdated : "—";

    // If app.js already set these, this will just keep them consistent
    setText("#lastUpdated", lastUpdated);
    setText("#dataStatus", state.mode || "ok");

    // ---- KPIs: This week ----
    const weekWindowDays = 7;
    const now = safeDate(lastUpdated) || new Date();
    const since = new Date(now.getTime() - weekWindowDays * 24 * 60 * 60 * 1000);

    const changesAll = Array.isArray(state.changes && state.changes.changes) ? state.changes.changes : [];
    const recent = changesAll
      .map(c => {
        const d = safeDate(c && c.date);
        return Object.assign({}, c || {}, { _d: d });
      })
      .filter(c => c._d && c._d >= since)
      .sort((a, b) => b._d - a._d);

    const newChanges = recent.length;
    const ecoApproved = recent.filter(c => (c.type === "ECO") && (c.status === "Approved")).length;
    const openEcr = changesAll.filter(c => (c.type === "ECR") && (c.status !== "Closed")).length;

    setText("#kpiNewChanges", String(newChanges));
    setText("#kpiEcoApproved", String(ecoApproved));
    setText("#kpiOpenEcr", String(openEcr));
    setText("#pillWeek", "Last 7 days");

    // ---- BOM health ----
    const nodes = Array.isArray(state.bom && state.bom.nodes) ? state.bom.nodes : [];
    const totalNodes = nodes.length;
    const highCrit = nodes.filter(n => String((n && n.criticality) || "").toLowerCase() === "high").length;
    const missingSup = nodes.filter(n => !Array.isArray(n && n.suppliers) || n.suppliers.length === 0).length;

    setText("#kpiBomNodes", String(totalNodes));
    setText("#kpiHighCrit", String(highCrit));
    setText("#kpiMissingSuppliers", String(missingSup));

    const health = scoreBomHealth({ totalNodes, highCrit, missingSup });
    setText("#badgeBomHealth", health.label || "—");
    setText("#bomHealthHint", health.hint || "—");

    // ---- Top suppliers ----
    const supplierList = Array.isArray(state.suppliers && state.suppliers.suppliers) ? state.suppliers.suppliers : [];
    const weights = (state.rules && state.rules.supplierScoring && state.rules.supplierScoring.weights) ? state.rules.supplierScoring.weights : {};

    const ranked = supplierList
      .map(s => {
        const score = weightedSupplierScore((s && s.scores) || {}, weights);
        return Object.assign({}, s || {}, { _score: score });
      })
      .sort((a, b) => (b._score || 0) - (a._score || 0))
      .slice(0, 5);

    renderList("#topSuppliers", ranked.map(s => ({
      title: `${s.name || "—"} (${s.supplierId || "—"})`,
      meta: `Score: ${fmt1(s._score)} • Region: ${s.region || "—"} • Tags: ${(s.riskTags || []).join(", ") || "—"}`
    })));

    // ---- Key risks (aggregate supplier+part riskTags) ----
    const risks = [];
    for (const s of supplierList) {
      for (const t of (s && s.riskTags) || []) risks.push({ kind: "Supplier", ref: s.supplierId, tag: t });
    }
    const parts = Array.isArray(state.parts && state.parts.parts) ? state.parts.parts : [];
    for (const p of parts) {
      for (const t of (p && p.riskTags) || []) risks.push({ kind: "Part", ref: p.sku, tag: t });
    }

    const grouped = countBy(risks, r => (r && r.tag) ? r.tag : "Unspecified");
    const topRisks = Object.entries(grouped)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));

    renderList("#keyRisks", topRisks.map(r => ({
      title: r.tag,
      meta: `Occurrences: ${r.count}`
    })));

    // ---- Recent changes list ----
    renderList("#recentChanges", recent.slice(0, 6).map(c => ({
      title: `${c.changeId || "—"} • ${c.type || "—"} • ${c.title || "—"}`,
      meta: `Status: ${c.status || "—"} • Date: ${c.date || "—"} • Approver: ${c.approver || "—"}`
    })));
  }

  async function renderDashboard(ctx) {
    // ctx may come from app.js, but we don't assume its shape.
    // If data is not provided, we load ourselves via arcbosDataLoadAll().

    try {
      const state = {
        mode: (ctx && ctx.mode) ? ctx.mode : (ctx && ctx.state && ctx.state.mode) ? ctx.state.mode : "ok",
        rules: (ctx && ctx.rules) || (ctx && ctx.data && ctx.data.rules) || (ctx && ctx.state && ctx.state.rules) || null,
        bom: (ctx && ctx.bom) || (ctx && ctx.data && ctx.data.bom) || (ctx && ctx.state && ctx.state.bom) || null,
        parts: (ctx && ctx.parts) || (ctx && ctx.data && ctx.data.parts) || (ctx && ctx.state && ctx.state.parts) || null,
        suppliers: (ctx && ctx.suppliers) || (ctx && ctx.data && ctx.data.suppliers) || (ctx && ctx.state && ctx.state.suppliers) || null,
        changes: (ctx && ctx.changes) || (ctx && ctx.data && ctx.data.changes) || (ctx && ctx.state && ctx.state.changes) || null
      };

      const hasAll =
        state.rules && state.bom && state.parts && state.suppliers && state.changes;

      if (!hasAll) {
        if (typeof window.arcbosDataLoadAll !== "function") {
          throw new Error("arcbosDataLoadAll is not defined. Ensure js/data.js is loaded before dashboard.js.");
        }
        const loaded = await window.arcbosDataLoadAll({ base: "." });
        state.rules = loaded.rules;
        state.bom = loaded.bom;
        state.parts = loaded.parts;
        state.suppliers = loaded.suppliers;
        state.changes = loaded.changes;
        state.mode = state.mode === "unknown" ? "fetch" : state.mode;
      }

      calcAndRender(state);
    } catch (err) {
      showLoadFailed(err);
      if (window && window.console && console.error) {
        console.error("[ARCBOS] dashboard render failed:", err);
      }
    }
  }

  // ---- Register renderer in a way that matches unknown app.js ----
  function register() {
    // 1) Preferred: window.arcbosRegisterRenderer(page, fn)
    if (typeof window.arcbosRegisterRenderer === "function") {
      window.arcbosRegisterRenderer(PAGE, renderDashboard);
      return;
    }

    // 2) Common: window.arcbosPageRenderers[page] = fn
    if (!window.arcbosPageRenderers) window.arcbosPageRenderers = {};
    window.arcbosPageRenderers[PAGE] = renderDashboard;

    // 3) Common: window.ARCBOS_RENDERERS[page] = fn
    if (!window.ARCBOS_RENDERERS) window.ARCBOS_RENDERERS = {};
    window.ARCBOS_RENDERERS[PAGE] = renderDashboard;

    // 4) Common: window.arcbosRenderers[page] = fn
    if (!window.arcbosRenderers) window.arcbosRenderers = {};
    window.arcbosRenderers[PAGE] = renderDashboard;

    // 5) Also expose as named function (some code does direct call)
    window.arcbosRenderDashboard = renderDashboard;
  }

  register();
})();
