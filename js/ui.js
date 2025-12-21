/* ARCBOS Ops Portal - UI helpers
   Purpose: small reusable renderers and UI primitives.
   Constraints: no frameworks, no build step, minimal DOM ops.
*/

(function () {
  "use strict";

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function badge(text, opts) {
    const b = el("span", "badge", text == null ? "—" : text);
    if (opts && opts.level) b.dataset.level = String(opts.level);
    if (opts && opts.kind) b.dataset.kind = String(opts.kind);
    return b;
  }

  function pill(text, opts) {
    const p = el("span", "pill", text == null ? "—" : text);
    if (opts && opts.kind) p.dataset.kind = String(opts.kind);
    return p;
  }

  function iconDot(level) {
    const d = el("span", "dot", "");
    d.dataset.level = String(level || "");
    return d;
  }

  function emptyState(title, meta) {
    const w = el("div", "empty", "");
    const t = el("div", "empty__title", title || "No data");
    const m = el("div", "empty__meta muted", meta || "");
    w.appendChild(t);
    w.appendChild(m);
    return w;
  }

  function renderTable(rootSel, columns, rows, opts) {
    const root = window.arcbos$(rootSel);
    if (!root) return;

    const cols = Array.isArray(columns) ? columns : [];
    const data = Array.isArray(rows) ? rows : [];

    root.innerHTML = "";

    if (data.length === 0) {
      root.appendChild(emptyState("No rows", "Adjust filters or check JSON data."));
      return;
    }

    const wrap = el("div", "tableWrap", "");
    const table = el("table", "table", "");
    const thead = el("thead", "", "");
    const trh = el("tr", "", "");
    for (const c of cols) {
      const th = el("th", "", c.label || c.key || "");
      if (c.width) th.style.width = c.width;
      trh.appendChild(th);
    }
    thead.appendChild(trh);

    const tbody = el("tbody", "", "");
    for (const r of data) {
      const tr = el("tr", "", "");
      if (opts && typeof opts.onRowClick === "function") {
        tr.classList.add("rowClickable");
        tr.addEventListener("click", function () {
          opts.onRowClick(r);
        });
      }

      for (const c of cols) {
        const td = el("td", "", "");
        const v = (typeof c.render === "function") ? c.render(r) : (r ? r[c.key] : "");
        if (v instanceof Node) td.appendChild(v);
        else td.textContent = String(v == null ? "" : v);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    root.appendChild(wrap);
  }

  function toast(msg, level) {
    const hostId = "toastHost";
    let host = document.getElementById(hostId);
    if (!host) {
      host = el("div", "toastHost", "");
      host.id = hostId;
      document.body.appendChild(host);
    }

    const t = el("div", "toast", "");
    t.dataset.level = String(level || "info");
    t.textContent = String(msg || "");

    host.appendChild(t);

    setTimeout(function () {
      t.classList.add("toast--hide");
      setTimeout(function () {
        t.remove();
      }, 220);
    }, 2200);
  }

  function ensureDrawer() {
    const id = "drawer";
    let d = document.getElementById(id);
    if (d) return d;

    d = el("div", "drawer", "");
    d.id = id;

    const backdrop = el("div", "drawer__backdrop", "");
    const panel = el("div", "drawer__panel", "");

    const head = el("div", "drawer__head", "");
    const title = el("div", "drawer__title", "Details");
    const close = el("button", "drawer__close", "Close");
    close.type = "button";

    const body = el("div", "drawer__body", "");

    close.addEventListener("click", function () {
      closeDrawer();
    });
    backdrop.addEventListener("click", function () {
      closeDrawer();
    });

    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);
    panel.appendChild(body);

    d.appendChild(backdrop);
    d.appendChild(panel);
    document.body.appendChild(d);

    return d;
  }

  function openDrawer(titleText, bodyNode) {
    const d = ensureDrawer();
    const title = d.querySelector(".drawer__title");
    const body = d.querySelector(".drawer__body");
    if (title) title.textContent = String(titleText || "Details");
    if (body) {
      body.innerHTML = "";
      if (bodyNode instanceof Node) body.appendChild(bodyNode);
      else body.textContent = String(bodyNode == null ? "" : bodyNode);
    }
    d.classList.add("drawer--open");
    document.documentElement.classList.add("noScroll");
  }

  function closeDrawer() {
    const d = document.getElementById("drawer");
    if (!d) return;
    d.classList.remove("drawer--open");
    document.documentElement.classList.remove("noScroll");
  }

  function kvList(items) {
    // items: [{k, v}]
    const wrap = el("div", "kv2", "");
    for (const it of (items || [])) {
      const row = el("div", "kv2__row", "");
      const k = el("div", "kv2__k muted", it.k || "");
      const v = el("div", "kv2__v mono", it.v == null ? "—" : it.v);
      row.appendChild(k);
      row.appendChild(v);
      wrap.appendChild(row);
    }
    return wrap;
  }

  // Expose
  window.arcbosEl = el;
  window.arcbosBadge = badge;
  window.arcbosPill = pill;
  window.arcbosIconDot = iconDot;
  window.arcbosEmptyState = emptyState;
  window.arcbosRenderTable = renderTable;
  window.arcbosToast = toast;
  window.arcbosOpenDrawer = openDrawer;
  window.arcbosCloseDrawer = closeDrawer;
  window.arcbosKvList = kvList;
})();
