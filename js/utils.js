/* ARCBOS Ops Portal - Utilities
   Design goals:
   - Minimal dependencies
   - Readable, audit-friendly code
   - Safe fallbacks and clear error surfaces
*/

(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setText(sel, text) {
    const el = $(sel);
    if (!el) return;
    el.textContent = String(text == null ? "" : text);
  }

  function fmt1(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(1);
  }

  function safeDate(input) {
    if (!input) return null;
    const d = new Date(String(input));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  async function loadJson(url) {
    // Use fetch to load repo JSON files (works on GitHub Pages).
    // Note: file:// may block fetch in some browsers. README will document local server usage.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Failed to load: " + url + " (" + res.status + ")");
    }
    return await res.json();
  }

  function weightedSupplierScore(scores, weights) {
    // scores: { quality, delivery, cost, engineeringSupport, compliance, risk }
    // weights: { quality, delivery, cost, engineeringSupport, compliance, risk }
    const keys = Object.keys(weights || {});
    if (keys.length === 0) return 0;

    let wsum = 0;
    let sum = 0;

    for (const k of keys) {
      const w = Number(weights[k]);
      const v = Number(scores && scores[k]);
      if (!Number.isFinite(w) || w <= 0) continue;
      if (!Number.isFinite(v)) continue;
      wsum += w;
      sum += v * w;
    }
    if (wsum <= 0) return 0;
    return sum / wsum;
  }

  function countBy(arr, keyFn) {
    const map = Object.create(null);
    for (const item of (arr || [])) {
      const k = String(keyFn(item));
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }

  function renderList(sel, items) {
    const root = $(sel);
    if (!root) return;

    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      root.innerHTML = '<div class="skeleton">No items</div>';
      return;
    }

    root.innerHTML = "";
    for (const it of list) {
      const card = document.createElement("div");
      card.className = "listItem";

      const t = document.createElement("p");
      t.className = "listItem__title";
      t.textContent = it.title || "—";

      const m = document.createElement("p");
      m.className = "listItem__meta";
      m.textContent = it.meta || "";

      card.appendChild(t);
      card.appendChild(m);
      root.appendChild(card);
    }
  }

  function scoreBomHealth(kpi) {
    // Simple, deterministic heuristic. We will refine later.
    // Lower missing suppliers is best. High criticality is not "bad" but increases the need for coverage.
    const total = Math.max(0, Number(kpi.totalNodes || 0));
    const missing = Math.max(0, Number(kpi.missingSup || 0));
    const high = Math.max(0, Number(kpi.highCrit || 0));

    if (total === 0) {
      return { label: "No data", hint: "BOM nodes are empty." };
    }

    const missingRate = missing / total;
    const highRate = high / total;

    if (missingRate <= 0.05) {
      return { label: "Healthy", hint: "Supplier coverage looks strong for the current BOM snapshot." };
    }
    if (missingRate <= 0.15) {
      return { label: "Attention", hint: "Some nodes have no supplier assigned. Close gaps before Beta builds." };
    }
    return { label: "At risk", hint: "Too many nodes lack supplier coverage. Expect schedule slips and cost surprises." };
  }

  // Expose globals in a controlled way (no modules/bundlers).
  window.arcbos$ = $;
  window.arcbosSetText = setText;
  window.arcbosFmt1 = fmt1;
  window.arcbosSafeDate = safeDate;
  window.arcbosLoadJson = loadJson;
  window.arcbosWeightedSupplierScore = weightedSupplierScore;
  window.arcbosCountBy = countBy;
  window.arcbosRenderList = renderList;
  window.arcbosScoreBomHealth = scoreBomHealth;
})();
