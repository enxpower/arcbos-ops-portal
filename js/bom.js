/* js/bom.js
 * Page module for BOM Tree.
 * No build tools. Safe feature-detection. Minimal assumptions.
 */

(function () {
  "use strict";

  const PAGE = "bom";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getMount() {
    // Prefer explicit mount; fallback to body.
    return $("#app") || $("main") || document.body;
  }

  function showInfo(msg) {
    const mount = getMount();
    const el = document.createElement("div");
    el.className = "notice notice--info";
    el.textContent = msg;
    mount.prepend(el);
  }

  function showError(msg) {
    const mount = getMount();
    const el = document.createElement("div");
    el.className = "notice notice--error";
    el.textContent = msg;
    mount.prepend(el);
  }

  async function loadData() {
    // Prefer your data loader if present
    if (window.AOps && typeof window.AOps.loadAll === "function") {
      return await window.AOps.loadAll();
    }
    if (typeof window.loadAllData === "function") {
      return await window.loadAllData();
    }

    // Fallback: try to fetch only bom.json
    const res = await fetch("../data/bom.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load bom.json");
    const bom = await res.json();
    return { bom };
  }

  function render(data) {
    // Prefer your existing renderer if present
    if (window.AOps && typeof window.AOps.renderBOMPage === "function") {
      window.AOps.renderBOMPage(data);
      return;
    }
    if (typeof window.renderBOMPage === "function") {
      window.renderBOMPage(data);
      return;
    }

    // Minimal fallback renderer: show node count and a simple list
    const mount = getMount();
    const box = document.createElement("section");
    box.className = "card";

    const nodes =
      (data && data.bom && Array.isArray(data.bom.nodes) && data.bom.nodes) || [];

    const h = document.createElement("h2");
    h.textContent = `BOM Tree (${nodes.length} nodes)`;
    box.appendChild(h);

    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Fallback renderer active. Add/verify renderBOMPage() in ui.js to enable full tree UI.";
    box.appendChild(p);

    const ul = document.createElement("ul");
    ul.className = "list";
    nodes.slice(0, 50).forEach((n) => {
      const li = document.createElement("li");
      li.textContent = `${n.nodeId || ""} • ${n.sku || ""} • qty ${n.qty || ""} • rev ${n.revision || ""}`;
      ul.appendChild(li);
    });

    box.appendChild(ul);
    mount.appendChild(box);

    if (nodes.length > 50) {
      showInfo("Showing first 50 nodes in fallback mode.");
    }
  }

  async function init() {
    try {
      // Prefer a shared bootstrap if you have one
      if (window.AOps && typeof window.AOps.bootstrapPage === "function") {
        await window.AOps.bootstrapPage(PAGE);
      }
    } catch (e) {
      // ignore bootstrap issues to avoid breaking page
      console.warn("bootstrapPage failed:", e);
    }

    try {
      const data = await loadData();

      // Optional validation hook
      try {
        if (window.AOps && typeof window.AOps.validateAll === "function") {
          window.AOps.validateAll(data);
        } else if (typeof window.validateAllData === "function") {
          window.validateAllData(data);
        }
      } catch (e) {
        console.warn("Validation warning:", e);
      }

      render(data);
    } catch (e) {
      console.error(e);
      showError(
        "Unable to initialize BOM page. Check /data/bom.json and ensure the site is served via GitHub Pages (fetch requires http/https)."
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
