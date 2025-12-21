/* ARCBOS Ops Portal - Suppliers page logic
   - Weighted score computation from rules.json
   - Supplier -> Parts mapping via parts.preferredSuppliers and BOM node suppliers
   - Detail drawer includes scores, risks, supplied SKUs, BOM nodes, related changes
*/

(function () {
  "use strict";

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean)));
  }

  function safeStr(v) {
    return String(v == null ? "" : v);
  }

  function computeWeightedScore(scores, rules) {
    const range = rules?.supplierScoring?.range || { min: 1, max: 5 };
    const min = num(range.min, 1);
    const max = num(range.max, 5);
    const w = rules?.supplierScoring?.weights || {
      quality: 1, delivery: 1, cost: 1, engineeringSupport: 1, compliance: 1, risk: 1
    };

    const keys = Object.keys(w || {});
    let sumW = 0;
    let sum = 0;

    for (const k of keys) {
      const weight = num(w[k], 0);
      if (weight <= 0) continue;
      sumW += weight;

      const raw = num(scores && scores[k], min);
      const clamped = Math.max(min, Math.min(max, raw));

      sum += clamped * weight;
    }

    const avg = sumW > 0 ? (sum / sumW) : 0;

    // Normalize to 0..100 for display
    const pct = (max > min) ? ((avg - min) / (max - min)) * 100 : 0;
    const pctClamped = Math.max(0, Math.min(100, pct));

    return {
      avg: avg,
      pct: pctClamped,
      rangeMin: min,
      rangeMax: max,
      weights: w
    };
  }

  function renderScoreBars(scores, rules) {
    const wrap = arcbosEl("div", "scoreBars", "");
    const w = rules?.supplierScoring?.weights || {};
    const range = rules?.supplierScoring?.range || { min: 1, max: 5 };
    const min = num(range.min, 1);
    const max = num(range.max, 5);

    const keys = Object.keys(w || {});
    for (const k of keys) {
      const row = arcbosEl("div", "scoreRow", "");

      const label = arcbosEl("div", "scoreRow__label muted small", k);
      const val = num(scores && scores[k], min);
      const clamped = Math.max(min, Math.min(max, val));
      const pct = (max > min) ? ((clamped - min) / (max - min)) * 100 : 0;

      const bar = arcbosEl("div", "scoreRow__bar", "");
      const fill = arcbosEl("div", "scoreRow__fill", "");
      fill.style.width = String(Math.max(0, Math.min(100, pct))) + "%";
      bar.appendChild(fill);

      const meta = arcbosEl("div", "scoreRow__meta mono", String(clamped));

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(meta);

      wrap.appendChild(row);
    }

    return wrap;
  }

  function boot() {
    return (async function () {
      const ctx = { rules: null, bom: null, parts: null, suppliers: null, changes: null };

      try {
        const loaded = await arcbosDataLoadAll({ base: ".." });
        ctx.rules = loaded.rules;
        ctx.bom = loaded.bom;
        ctx.parts = loaded.parts;
        ctx.suppliers = loaded.suppliers;
        ctx.changes = loaded.changes;

        arcbosSetText("#lastUpdated", ctx.rules?.meta?.lastUpdated || "—");
        arcbosSetText("#buildStamp", "Build: static • Page: Suppliers");
      } catch (err) {
        arcbosSetText("#suppliersTable", "Data could not be loaded. See README (local server).");
        return;
      }

      const suppliers = Array.isArray(ctx.suppliers?.suppliers) ? ctx.suppliers.suppliers : [];
      const parts = Array.isArray(ctx.parts?.parts) ? ctx.parts.parts : [];
      const nodes = Array.isArray(ctx.bom?.nodes) ? ctx.bom.nodes : [];
      const changes = Array.isArray(ctx.changes?.changes) ? ctx.changes.changes : [];

      // Index: supplierId -> supplied SKUs
      const suppliedSkusBySupplier = new Map();
      function addSupply(supplierId, sku) {
        const sid = safeStr(supplierId);
        const k = safeStr(sku);
        if (!sid || !k) return;
        if (!suppliedSkusBySupplier.has(sid)) suppliedSkusBySupplier.set(sid, new Set());
        suppliedSkusBySupplier.get(sid).add(k);
      }

      // From parts.preferredSuppliers
      for (const p of parts) {
        const sku = p && p.sku;
        const pref = Array.isArray(p && p.preferredSuppliers) ? p.preferredSuppliers : [];
        for (const sid of pref) addSupply(sid, sku);
      }

      // From BOM node suppliers
      for (const n of nodes) {
        const sku = n && n.sku;
        const sup = Array.isArray(n && n.suppliers) ? n.suppliers : [];
        for (const sid of sup) addSupply(sid, sku);
      }

      // SKU -> BOM nodes for drawer
      const nodesBySku = new Map();
      for (const n of nodes) {
        const k = safeStr(n && n.sku);
        if (!k) continue;
        if (!nodesBySku.has(k)) nodesBySku.set(k, []);
        nodesBySku.get(k).push(n);
      }

      // SKU -> related changes
      function relatedChangesForSku(sku) {
        const k = safeStr(sku);
        if (!k) return [];
        return changes.filter(c => {
          const a = Array.isArray(c && c.affectedSkus) ? c.affectedSkus : [];
          return a.includes(k);
        }).sort((a, b) => safeStr(b.date).localeCompare(safeStr(a.date)));
      }

      // Populate filters
      const statusAllowed = ctx.rules?.suppliers?.status || ["Preferred", "Approved", "Conditional", "Blocked"];
      const selStatus = arcbos$("#status");
      for (const st of statusAllowed) {
        const o = document.createElement("option");
        o.value = st;
        o.textContent = st;
        selStatus.appendChild(o);
      }

      const regions = uniq(suppliers.map(s => s.region)).sort();
      const selRegion = arcbos$("#region");
      for (const r of regions) {
        const o = document.createElement("option");
        o.value = r;
        o.textContent = r;
        selRegion.appendChild(o);
      }

      const riskTags = uniq(suppliers.flatMap(s => Array.isArray(s.riskTags) ? s.riskTags : [])).sort();
      const selRisk = arcbos$("#risk");
      for (const t of riskTags) {
        const o = document.createElement("option");
        o.value = t;
        o.textContent = t;
        selRisk.appendChild(o);
      }

      const state = {
        q: "",
        status: "",
        region: "",
        risk: "",
        sort: "score_desc"
      };

      function matchSupplier(s) {
        if (state.status && safeStr(s.status) !== state.status) return false;
        if (state.region && safeStr(s.region) !== state.region) return false;
        if (state.risk) {
          const tags = Array.isArray(s.riskTags) ? s.riskTags : [];
          if (!tags.includes(state.risk)) return false;
        }

        const q = state.q.trim().toLowerCase();
        if (!q) return true;

        const hay = [
          s.supplierId, s.name, s.region, s.status,
          (Array.isArray(s.riskTags) ? s.riskTags.join(" ") : ""),
          s.notes
        ].join(" ").toLowerCase();

        return hay.includes(q);
      }

      function supplierEnriched(s) {
        const sid = safeStr(s.supplierId);
        const supplySet = suppliedSkusBySupplier.get(sid) || new Set();
        const suppliedSkus = Array.from(supplySet).sort();

        const score = computeWeightedScore(s.scores || {}, ctx.rules);
        return {
          ...s,
          _scoreAvg: score.avg,
          _scorePct: score.pct,
          _suppliedSkus: suppliedSkus,
          _suppliedCount: suppliedSkus.length
        };
      }

      function sortSuppliers(list) {
        const mode = state.sort;
        const arr = list.slice();

        if (mode === "name_asc") {
          arr.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));
          return arr;
        }

        if (mode === "parts_desc") {
          arr.sort((a, b) => (b._suppliedCount || 0) - (a._suppliedCount || 0));
          return arr;
        }

        if (mode === "score_asc") {
          arr.sort((a, b) => (a._scorePct || 0) - (b._scorePct || 0));
          return arr;
        }

        // Default: score_desc
        arr.sort((a, b) => (b._scorePct || 0) - (a._scorePct || 0));
        return arr;
      }

      function visibleSuppliers() {
        const base = suppliers.map(supplierEnriched).filter(matchSupplier);
        return sortSuppliers(base);
      }

      function supplierDetailNode(s) {
        const wrap = arcbosEl("div", "", "");

        const head = arcbosEl("div", "detailHead", "");
        const left = arcbosEl("div", "", "");
        left.appendChild(arcbosEl("div", "detailSku mono", s.supplierId || "—"));
        left.appendChild(arcbosEl("div", "detailName", s.name || "—"));

        const right = arcbosEl("div", "detailBadges", "");
        right.appendChild(arcbosBadge(s.status || "—", { kind: "status", level: s.status }));
        right.appendChild(arcbosBadge("Score " + String(Math.round(num(s._scorePct, 0))), { kind: "score" }));

        head.appendChild(left);
        head.appendChild(right);
        wrap.appendChild(head);

        const kv = arcbosKvList([
          { k: "Region", v: s.region || "—" },
          { k: "Contact", v: s.contact || "—" },
          { k: "Email", v: s.email || "—" },
          { k: "Website", v: s.website || "—" }
        ]);
        wrap.appendChild(kv);

        if (Array.isArray(s.riskTags) && s.riskTags.length) {
          const tags = arcbosEl("div", "tagRow", "");
          for (const t of s.riskTags) tags.appendChild(arcbosPill(t, { kind: "risk" }));
          wrap.appendChild(tags);
        }

        if (s.notes) {
          const notes = arcbosEl("div", "detailNotes", "");
          notes.appendChild(arcbosEl("div", "muted small", "Notes"));
          notes.appendChild(arcbosEl("div", "detailNotes__body", s.notes));
          wrap.appendChild(notes);
        }

        // Scores
        const scoreBlock = arcbosEl("div", "detailBlock", "");
        scoreBlock.appendChild(arcbosEl("div", "detailBlock__title", "Score breakdown"));
        scoreBlock.appendChild(renderScoreBars(s.scores || {}, ctx.rules));
        wrap.appendChild(scoreBlock);

        // Supplied parts + BOM nodes + changes
        const supBlock = arcbosEl("div", "detailBlock", "");
        supBlock.appendChild(arcbosEl("div", "detailBlock__title", "Supplied SKUs"));
        const skus = Array.isArray(s._suppliedSkus) ? s._suppliedSkus : [];
        if (skus.length === 0) {
          supBlock.appendChild(arcbosEl("div", "muted small", "No parts/BOM nodes mapped to this supplierId."));
        } else {
          const list = arcbosEl("div", "detailList", "");
          for (const sku of skus.slice(0, 60)) {
            const item = arcbosEl("div", "detailList__item", "");
            item.appendChild(arcbosEl("div", "mono", sku));

            // BOM node summary
            const bn = nodesBySku.get(sku) || [];
            const bnText = bn.length ? ("BOM nodes: " + bn.length) : "BOM nodes: 0";
            item.appendChild(arcbosEl("div", "muted small", bnText));

            // Related changes
            const rel = relatedChangesForSku(sku);
            const relText = rel.length ? ("Changes: " + rel.length) : "Changes: 0";
            item.appendChild(arcbosEl("div", "muted small", relText));

            list.appendChild(item);
          }
          if (skus.length > 60) {
            supBlock.appendChild(arcbosEl("div", "muted small", "Showing first 60 SKUs. Total: " + String(skus.length)));
          }
          supBlock.appendChild(list);
        }
        wrap.appendChild(supBlock);

        return wrap;
      }

      const columns = [
        { key: "supplierId", label: "Supplier ID", width: "150px", render: (s) => arcbosEl("span", "mono", s.supplierId || "") },
        { key: "name", label: "Name", render: (s) => s.name || "" },
        { key: "region", label: "Region", width: "130px", render: (s) => s.region || "" },
        { key: "status", label: "Status", width: "140px", render: (s) => arcbosBadge(s.status || "—", { kind: "status", level: s.status }) },
        { key: "_scorePct", label: "Score", width: "110px", render: (s) => arcbosEl("span", "mono", String(Math.round(num(s._scorePct, 0))) ) },
        { key: "_suppliedCount", label: "Parts", width: "90px", render: (s) => arcbosEl("span", "mono", String(num(s._suppliedCount, 0))) },
        { key: "riskTags", label: "Risks", width: "240px", render: (s) => {
          const tags = Array.isArray(s.riskTags) ? s.riskTags : [];
          const w = arcbosEl("div", "tagRow", "");
          for (const t of tags.slice(0, 3)) w.appendChild(arcbosPill(t, { kind: "risk" }));
          if (tags.length > 3) w.appendChild(arcbosPill("+" + (tags.length - 3), { kind: "more" }));
          return w;
        }}
      ];

      function render() {
        const rows = visibleSuppliers();
        arcbosSetText("#rowCount", String(rows.length));

        const q = state.q.trim();
        arcbosSetText(
          "#filterHint",
          `Filter: Status=${state.status || "All"} • Region=${state.region || "All"} • Risk=${state.risk || "All"} • Sort=${state.sort} • Search="${q || ""}"`
        );

        arcbosSetText("#tableMeta", `Total suppliers: ${suppliers.length} • Visible: ${rows.length}`);

        arcbosRenderTable("#suppliersTable", columns, rows, {
          onRowClick: function (s) {
            arcbosOpenDrawer(s.supplierId || "Supplier", supplierDetailNode(s));
          }
        });
      }

      function validateVisible() {
        const rows = visibleSuppliers();
        const issues = [];
        for (const s of rows) {
          const supIssues = arcbosValidateSupplier(s, ctx.rules);
          for (const it of supIssues) {
            issues.push({
              ...it,
              context: "Supplier " + (s.supplierId || "—")
            });
          }
        }
        const summary = arcbosSummarizeIssues(issues, { max: 10 });
        arcbosRenderList("#validationList", summary.length ? summary : [{
          title: "No blocking issues detected",
          meta: "Visible suppliers passed required fields + scoring range checks."
        }]);
      }

      function reset() {
        state.q = "";
        state.status = "";
        state.region = "";
        state.risk = "";
        state.sort = "score_desc";

        arcbos$("#q").value = "";
        arcbos$("#status").value = "";
        arcbos$("#region").value = "";
        arcbos$("#risk").value = "";
        arcbos$("#sort").value = "score_desc";

        arcbosRenderList("#validationList", [{ title: "Ready", meta: "Click 'Validate visible' to run rules." }]);
        render();
      }

      // Events
      arcbos$("#q").addEventListener("input", function (e) { state.q = e.target.value || ""; render(); });
      arcbos$("#status").addEventListener("change", function (e) { state.status = e.target.value || ""; render(); });
      arcbos$("#region").addEventListener("change", function (e) { state.region = e.target.value || ""; render(); });
      arcbos$("#risk").addEventListener("change", function (e) { state.risk = e.target.value || ""; render(); });
      arcbos$("#sort").addEventListener("change", function (e) { state.sort = e.target.value || "score_desc"; render(); });

      arcbos$("#btnReset").addEventListener("click", reset);
      arcbos$("#btnValidate").addEventListener("click", function () {
        validateVisible();
        arcbosToast("Validation complete", "info");
      });

      arcbos$("#btnExportCsv").addEventListener("click", function () {
        const rows = visibleSuppliers();
        const out = [];
        out.push(["supplierId","name","region","status","scorePct","partsCount","riskTags","email","website","notes"]);
        for (const s of rows) {
          out.push([
            s.supplierId || "",
            s.name || "",
            s.region || "",
            s.status || "",
            String(Math.round(num(s._scorePct, 0))),
            String(num(s._suppliedCount, 0)),
            Array.isArray(s.riskTags) ? s.riskTags.join("|") : "",
            s.email || "",
            s.website || "",
            (s.notes || "").replace(/\r?\n/g, " ")
          ]);
        }
        const csv = arcbosCsvEncode(out);
        arcbosDownloadText(csv, "arcbos_suppliers_view.csv", "text/csv");
      });

      // Initial
      reset();
    })();
  }

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
