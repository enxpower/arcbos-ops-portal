/* ARCBOS Ops Portal - App bootstrap
   Responsibilities:
   - Detect current page
   - Load JSON via arcbosDataLoadAll()
   - Hand off to page-specific renderer if present
*/

(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function setTopStatus(text) {
    const el = $("#dataStatus");
    if (el) el.textContent = text || "—";
  }

  function setLastUpdated(text) {
    const el = $("#lastUpdated");
    if (el) el.textContent = text || "—";
  }

  function currentPageKey() {
    // Determine page by pathname
    try {
      const p = (location && location.pathname) ? location.pathname : "";
      if (p.indexOf("/pages/bom.html") >= 0) return "bom";
      if (p.indexOf("/pages/parts.html") >= 0) return "parts";
      if (p.indexOf("/pages/suppliers.html") >= 0) return "suppliers";
      if (p.indexOf("/pages/changes.html") >= 0) return "changes";
      if (p.indexOf("/pages/rules.html") >= 0) return "rules";
      if (p.indexOf("/pages/templates.html") >= 0) return "templates";
      return "dashboard";
    } catch (_) {
      return "dashboard";
    }
  }

  function getRenderer(pageKey) {
    // Page renderers (if you already have them)
    // If not present, app.js will only load data + show status.
    const map = {
      dashboard: window.arcbosRenderDashboard,
      bom: window.arcbosRenderBOM,
      parts: window.arcbosRenderParts,
      suppliers: window.arcbosRenderSuppliers,
      changes: window.arcbosRenderChanges,
      rules: window.arcbosRenderRules,
      templates: window.arcbosRenderTemplates
    };
    return map[pageKey] || null;
  }

  async function init() {
    const pageKey = currentPageKey();

    if (typeof window.arcbosDataLoadAll !== "function") {
      console.error("[ARCBOS] arcbosDataLoadAll() not found. Ensure js/data.js is loaded before js/app.js.");
      setTopStatus("data loader missing");
      return;
    }

    setTopStatus("loading…");

    try {
      const data = await window.arcbosDataLoadAll(); // auto-detect base in data.js
      setTopStatus("ok");

      // last updated: prefer rules.meta.lastUpdated, else fallback to loadedAtIso
      const last =
        (data && data.rules && data.rules.meta && data.rules.meta.lastUpdated) ||
        (data && data.__meta && data.__meta.loadedAtIso) ||
        "—";
      setLastUpdated(last);

      // hand off to renderer if exists
      const render = getRenderer(pageKey);
      if (typeof render === "function") {
        render(data);
      } else {
        // No renderer wired yet — that's fine. At least we proved data load works.
        console.warn("[ARCBOS] No renderer found for page:", pageKey);
      }
    } catch (e) {
      console.error("[ARCBOS] Data load failed:", e);
      setTopStatus("fetch failed");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
