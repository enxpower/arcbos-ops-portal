/* ARCBOS Ops Portal - Data loading + small helpers
   No build system. No external services. JSON files in /data are the only source of truth.
*/

(function () {
  "use strict";

  function normalizeBase(base) {
    if (!base) return ".";
    // base should be like ".." for pages/*, or "." for root pages.
    return String(base).replace(/\/+$/g, "");
  }

  async function loadAll(opts) {
    const base = normalizeBase(opts && opts.base);

    const paths = {
      rules: base + "/data/rules.json",
      bom: base + "/data/bom.json",
      parts: base + "/data/parts.json",
      suppliers: base + "/data/suppliers.json",
      changes: base + "/data/changes.json"
    };

    const [rules, bom, parts, suppliers, changes] = await Promise.all([
      window.arcbosLoadJson(paths.rules),
      window.arcbosLoadJson(paths.bom),
      window.arcbosLoadJson(paths.parts),
      window.arcbosLoadJson(paths.suppliers),
      window.arcbosLoadJson(paths.changes)
    ]);

    return { rules, bom, parts, suppliers, changes };
  }

  function csvEncode(rows) {
    // rows: array of array of string-like
    function esc(v) {
      const s = String(v == null ? "" : v);
      const needs = /[",\r\n]/.test(s);
      if (!needs) return s;
      return '"' + s.replace(/"/g, '""') + '"';
    }

    const lines = [];
    for (const r of (rows || [])) {
      lines.push((r || []).map(esc).join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }

  function downloadText(text, filename, mime) {
    const blob = new Blob([String(text || "")], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  // Expose
  window.arcbosDataLoadAll = loadAll;
  window.arcbosCsvEncode = csvEncode;
  window.arcbosDownloadText = downloadText;
})();
