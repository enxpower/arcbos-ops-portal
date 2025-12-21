/* js/changes.js
 * Page module for ECR/ECO Change Log.
 * Safe feature-detection. No build. Minimal assumptions.
 */

(function () {
  "use strict";

  const PAGE = "changes";

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

    const res = await fetch("../data/changes.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load changes.json");
    const changes = await res.json();
    return { changes };
  }

  function render(data) {
    if (window.AOps && typeof window.AOps.renderChangesPage === "function") {
      window.AOps.renderChangesPage(data);
      return;
    }
    if (typeof window.renderChangesPage === "function") {
      window.renderChangesPage(data);
      return;
    }

    // Fallback minimal view
    const mount = getMount();
    const box = document.createElement("section");
    box.className = "card";

    const items =
      (data && data.changes && Array.isArray(data.changes.items) && data.changes.items) ||
      (Array.isArray(data.changes) ? data.changes : []);

    const h = document.createElement("h2");
    h.textContent = `Change Log (${items.length} records)`;
    box.appendChild(h);

    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Fallback renderer active. Add/verify renderChangesPage() in ui.js to enable the full ECR/ECO UI.";
    box.appendChild(p);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>ID</th><th>Type</th><th>Title</th><th>Status</th><th>Date</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    items.slice(0, 50).forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.changeId || it.id || "")}</td>
        <td>${escapeHtml(it.type || "")}</td>
        <td>${escapeHtml(it.title || "")}</td>
        <td>${escapeHtml(it.status || "")}</td>
        <td>${escapeHtml(it.date || "")}</td>
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
        "Unable to initialize Changes page. Check /data/changes.json and ensure the site is served via http/https (fetch limitation)."
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
