/* ARCBOS Ops Portal - Validators
   Purpose: apply rules.json to data objects, return actionable issues.
   This is intentionally deterministic and "audit-friendly".
*/

(function () {
  "use strict";

  function isNonEmptyStr(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function inList(v, list) {
    return Array.isArray(list) && list.includes(v);
  }

  function validateRequired(obj, fields, ctx) {
    const issues = [];
    for (const f of (fields || [])) {
      if (!isNonEmptyStr(String(obj && obj[f] != null ? obj[f] : "").trim())) {
        issues.push({
          level: "error",
          code: "REQUIRED_MISSING",
          message: "Missing required field",
          field: f,
          context: ctx || ""
        });
      }
    }
    return issues;
  }

  function validateSkuLayer(sku, rules) {
    // By convention, layer is the second token: SB1-<LAYER>-...
    // rules.skuLayers.allowed: ["PLT","SUB","ASM","PRT","CON","TOL", ...]
    const allowed = rules?.skuLayers?.allowed || [];
    const s = String(sku || "");
    const parts = s.split("-");
    const layer = parts.length >= 2 ? parts[1] : "";
    const issues = [];

    if (!isNonEmptyStr(s)) {
      issues.push({
        level: "error",
        code: "SKU_EMPTY",
        message: "SKU is empty"
      });
      return issues;
    }

    if (!isNonEmptyStr(layer)) {
      issues.push({
        level: "error",
        code: "SKU_LAYER_MISSING",
        message: "SKU layer token is missing (expected SB1-<LAYER>-...)"
      });
      return issues;
    }

    if (allowed.length > 0 && !allowed.includes(layer)) {
      issues.push({
        level: "error",
        code: "SKU_LAYER_INVALID",
        message: "SKU layer is not allowed by rules.json",
        details: "layer=" + layer + " allowed=" + allowed.join("|")
      });
    }

    return issues;
  }

  function validateRevision(rev, rules) {
    // rules.revision.pattern is a simple regex string, default: "^[A-Z]$"
    const pat = rules?.revision?.pattern || "^[A-Z]$";
    const issues = [];
    const s = String(rev || "").trim();

    if (!isNonEmptyStr(s)) {
      issues.push({
        level: "error",
        code: "REV_EMPTY",
        message: "Revision is empty"
      });
      return issues;
    }

    let re = null;
    try {
      re = new RegExp(pat);
    } catch (e) {
      issues.push({
        level: "error",
        code: "REV_RULE_INVALID",
        message: "Revision rule regex is invalid in rules.json",
        details: String(e && e.message ? e.message : e)
      });
      return issues;
    }

    if (!re.test(s)) {
      issues.push({
        level: "error",
        code: "REV_FORMAT",
        message: "Revision does not match rules.json pattern",
        details: "rev=" + s + " pattern=" + pat
      });
    }

    return issues;
  }

  function validateStatus(status, rules) {
    const allowed = rules?.statusMachine?.states || [];
    const s = String(status || "").trim();
    const issues = [];

    if (!isNonEmptyStr(s)) {
      issues.push({ level: "error", code: "STATUS_EMPTY", message: "Status is empty" });
      return issues;
    }
    if (allowed.length > 0 && !allowed.includes(s)) {
      issues.push({
        level: "error",
        code: "STATUS_INVALID",
        message: "Status is not a valid state per rules.json",
        details: "status=" + s + " allowed=" + allowed.join("|")
      });
    }
    return issues;
  }

  function validateAlternates(part, rules) {
    // Approved alternates structure:
    // part.alternates: [{ sku, interchangeability: "Drop-in"|"Requires ECO"|"Not Compatible", notes }]
    const issues = [];
    const allowed = rules?.alternates?.interchangeability || ["Drop-in", "Requires ECO", "Not Compatible"];
    const alts = Array.isArray(part && part.alternates) ? part.alternates : [];

    for (let i = 0; i < alts.length; i++) {
      const a = alts[i] || {};
      if (!isNonEmptyStr(a.sku)) {
        issues.push({
          level: "error",
          code: "ALT_SKU_EMPTY",
          message: "Alternate SKU is empty",
          details: "index=" + i
        });
      }
      if (!inList(a.interchangeability, allowed)) {
        issues.push({
          level: "error",
          code: "ALT_INTERCHANGE_INVALID",
          message: "Alternate interchangeability is invalid",
          details: "index=" + i + " value=" + String(a.interchangeability)
        });
      }
    }
    return issues;
  }

  function validatePart(part, rules) {
    const issues = [];
    const required = rules?.parts?.requiredFields || ["sku", "revision", "status", "owner", "date"];

    issues.push(...validateRequired(part, required, "Part"));
    issues.push(...validateSkuLayer(part && part.sku, rules));
    issues.push(...validateRevision(part && part.revision, rules));
    issues.push(...validateStatus(part && part.status, rules));
    issues.push(...validateAlternates(part, rules));

    return issues;
  }

  function validateBomNode(node, rules) {
    const issues = [];
    const required = rules?.bom?.requiredFields || [
      "nodeId", "sku", "qty", "unit", "revision", "criticality"
    ];

    issues.push(...validateRequired(node, required, "BOM Node"));

    // Qty
    const q = Number(node && node.qty);
    if (!Number.isFinite(q) || q <= 0) {
      issues.push({
        level: "error",
        code: "BOM_QTY_INVALID",
        message: "BOM qty must be a positive number",
        details: "qty=" + String(node && node.qty)
      });
    }

    // Criticality
    const allowedCrit = rules?.bom?.criticality || ["High", "Medium", "Low"];
    if (node && node.criticality && allowedCrit.length > 0 && !allowedCrit.includes(node.criticality)) {
      issues.push({
        level: "error",
        code: "BOM_CRIT_INVALID",
        message: "Criticality is not allowed by rules.json",
        details: "criticality=" + String(node.criticality)
      });
    }

    // SKU/Rev
    issues.push(...validateSkuLayer(node && node.sku, rules));
    issues.push(...validateRevision(node && node.revision, rules));

    return issues;
  }

  function validateSupplier(supplier, rules) {
    const issues = [];
    const required = rules?.suppliers?.requiredFields || ["supplierId", "name", "region", "status"];

    issues.push(...validateRequired(supplier, required, "Supplier"));

    const statusAllowed = rules?.suppliers?.status || ["Preferred", "Approved", "Conditional", "Blocked"];
    const st = String(supplier && supplier.status || "").trim();
    if (isNonEmptyStr(st) && statusAllowed.length > 0 && !statusAllowed.includes(st)) {
      issues.push({
        level: "error",
        code: "SUPPLIER_STATUS_INVALID",
        message: "Supplier status is not allowed by rules.json",
        details: "status=" + st
      });
    }

    // Scores range
    const range = rules?.supplierScoring?.range || { min: 1, max: 5 };
    const min = Number(range.min);
    const max = Number(range.max);
    const scores = supplier && supplier.scores ? supplier.scores : {};
    for (const k of Object.keys(scores || {})) {
      const v = Number(scores[k]);
      if (!Number.isFinite(v) || v < min || v > max) {
        issues.push({
          level: "error",
          code: "SUPPLIER_SCORE_RANGE",
          message: "Supplier score out of range",
          details: "key=" + k + " value=" + String(scores[k]) + " range=" + String(min) + ".." + String(max)
        });
      }
    }

    return issues;
  }

  function summarizeIssues(issues, opts) {
    const list = Array.isArray(issues) ? issues : [];
    const max = opts && Number.isFinite(opts.max) ? opts.max : 8;

    const rank = { error: 3, warn: 2, info: 1 };
    const sorted = list.slice().sort(function (a, b) {
      return (rank[b.level] || 0) - (rank[a.level] || 0);
    });

    return sorted.slice(0, max).map(function (it) {
      return {
        title: (it.level || "info").toUpperCase() + " • " + (it.code || "ISSUE") + " • " + (it.message || ""),
        meta: [it.context, it.field ? ("field=" + it.field) : "", it.details || ""].filter(Boolean).join(" • ")
      };
    });
  }

  // Expose
  window.arcbosValidatePart = validatePart;
  window.arcbosValidateBomNode = validateBomNode;
  window.arcbosValidateSupplier = validateSupplier;
  window.arcbosSummarizeIssues = summarizeIssues;
})();
