/* js/parts.js
 * Page module for Parts Master.
 * Safe feature-detection. No build. Minimal assumptions.
 */

(function () {
  "use strict";

  const PAGE = "parts";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getMount() {
    return $("#app") || $("main") || document.body;
  }

  function showError(msg) {
    const mount = getMount();
    const el = document.createElement("div");
    el.className = "notice notice--error";
    el.textContent = msg;
    mount.prepend(el);
  }

  async function loadData() {
    if (window.AOps && typeof window.AOps.loadAll === "function") {
      return await window.AOps.loadAll();
    }
    if (typeof window.loadAllData === "function") {
      return await window.loadAllData();
    }

    const res = await fetch("../data/parts.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load parts.json");
    const parts = await res.json();
    return { parts };
  }

  function render(data) {
    if (window.AOps && typeof window.AOps.renderPartsPage === "function") {
      window.AOps.renderPartsPage(data);
      return;
    }
    if (typeof window.renderPartsPage === "function") {
      window.renderPartsPage(data);
      return;
    }

    // Fallback minimal view
    const mount = getMount();
    const box = document.createElement("section");
    box.className = "card";

    const items =
      (data && data.parts && Array.isArray(data.parts.items) && data.parts.items) ||
      (Array.isArray(data.parts) ? data.parts : []);

    const h = document.createElement("h2");
    h.textContent = `Parts Master (${items.length} items)`;
    box.appendChild(h);

    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Fallback renderer active. Add/verify renderPartsPage() in ui.js to enable the full table + drawer.";
    box.appendChild(p);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>SKU</th><th>Name</th><th>Rev</th><th>Status</th><th>Criticality</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    items.slice(0, 50).forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.sku || "")}</td>
        <td>${escapeHtml(it.name || it.title || "")}</td>
        <td>${escapeHtml(it.revision || it.rev || "")}</td>
        <td>${escapeHtml(it.status || "")}</td>
        <td>${escapeHtml(it.criticality || "")}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    box.appendChild(table);
    mount.appendChild(box);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function init() {
    try {
      if (window.AOps && typeof window.AOps.bootstrapPage === "function") {
        await window.AOps.bootstrapPage(PAGE);
      }
    } catch (e) {
      console.warn("bootstrapPage failed:", e);
    }

    try {
      const data = await loadData();

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
        "Unable to initialize Parts page. Check /data/parts.json and ensure the site is served via http/https (fetch limitation)."
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
