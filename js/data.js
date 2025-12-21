/* ARCBOS Ops Portal - Data loading + small helpers
   No build system. No external services. JSON files in /data are the only source of truth.
*/

(function () {
  "use strict";

  function normalizeBase(base) {
    if (!base) return ".";
    return String(base).replace(/\/+$/g, "");
  }

  function detectBase() {
    // If the current URL path includes "/pages/", we need to go up one level.
    // Works for GitHub Pages project sites too.
    try {
      var p = (location && location.pathname) ? location.pathname : "";
      return p.indexOf("/pages/") >= 0 ? ".." : ".";
    } catch (_) {
      return ".";
    }
  }

  async function loadJson(url) {
    // Robust JSON loader with clearer error messages.
    var res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (e) {
      throw new Error("Fetch failed for " + url + " (" + (e && e.message ? e.message : "network error") + ")");
    }

    if (!res.ok) {
      throw new Error("HTTP " + res.status + " for " + url);
    }

    try {
      return await res.json();
    } catch (e) {
      throw new Error("Invalid JSON in " + url);
    }
  }

  async function loadAll(opts) {
    var base = normalizeBase((opts && opts.base) || detectBase());

    // IMPORTANT:
    // Use relative paths so it works on GitHub Pages project site:
    // https://<user>.github.io/<repo>/
    // Never use "/data/xxx.json" here.
    var paths = {
      rules: base + "/data/rules.json",
      bom: base + "/data/bom.json",
      parts: base + "/data/parts.json",
      suppliers: base + "/data/suppliers.json",
      changes: base + "/data/changes.json"
    };

    // Load in parallel
    var out;
    try {
      var arr = await Promise.all([
        loadJson(paths.rules),
        loadJson(paths.bom),
        loadJson(paths.parts),
        loadJson(paths.suppliers),
        loadJson(paths.changes)
      ]);

      out = {
        rules: arr[0],
        bom: arr[1],
        parts: arr[2],
        suppliers: arr[3],
        changes: arr[4]
      };
    } catch (e) {
      // Expose a helpful debug payload for quick diagnosis
      try {
        console.error("[ARCBOS] Data load failed:", e);
        console.error("[ARCBOS] Paths used:", paths);
        console.error("[ARCBOS] Location:", (location && location.href) ? location.href : "unknown");
      } catch (_) {}
      throw e;
    }

    // Attach meta for UI "Last updated" if you want
    out.__meta = {
      base: base,
      paths: paths,
      loadedAtIso: new Date().toISOString()
    };

    return out;
  }

  function csvEncode(rows) {
    function esc(v) {
      var s = String(v == null ? "" : v);
      var needs = /[",\r\n]/.test(s);
      if (!needs) return s;
      return '"' + s.replace(/"/g, '""') + '"';
    }

    var lines = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i] || [];
      var cols = [];
      for (var j = 0; j < r.length; j++) cols.push(esc(r[j]));
      lines.push(cols.join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }

  function downloadText(text, filename, mime) {
    var blob = new Blob([String(text || "")], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
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
  window.arcbosLoadJson = loadJson; // keep compatibility if other scripts expect it
  window.arcbosCsvEncode = csvEncode;
  window.arcbosDownloadText = downloadText;
  window.arcbosDetectBase = detectBase;
})();
