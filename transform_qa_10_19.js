/**
 * Transform & QA — Woo/Custom → Shopify (demo)
 * - Honors per-product overrides: overrides.per_product[handle].chosen_options (≤3) + overflow_to
 * - Demotes overflow to Body(HTML) + Metafields when overflow_to === "append_to_body_html"
 * - Supports quick-fixes: strategy.fix_missing_price ("zero" | "copy_compare_at"), strategy.fix_missing_title {mode:"prefix", prefix:"Untitled"}
 * - Expands "simple" products with pipe-delimited values into cartesian combos for the chosen 3 options
 * - Suppresses EXCESS_OPTION_DIMENSIONS for overridden handles
 * - Emits preview_transformed, files.shopify_csv_base64, qa/gate, decision_log, handles_with_overflow
 */

const startedAt = new Date();

/* ---------------- helpers ---------------- */
const toStr = (v) => (v == null ? "" : String(v));
const truthy = (v) => v !== null && v !== undefined && v !== "";

const kebab = (s) =>
  toStr(s)
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const csvEscape = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // CSV injection hardening
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

const toNumber = (v) => {
  if (!truthy(v)) return null;
  const s = String(v).replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const firstImage = (v) => {
  if (!truthy(v)) return "";
  return String(v).split(",").map((x) => x.trim()).filter(Boolean)[0] || "";
};
const splitImages = (v) =>
  !truthy(v) ? [] : String(v).split(",").map((x) => x.trim()).filter(Boolean);

const pick = (row, names) => {
  for (const n of names) {
    if (truthy(row[n])) return row[n];
  }
  return "";
};

const titleCase = (s) =>
  toStr(s)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------------- inputs ---------------- */
const headers = Array.isArray($json.headers) ? $json.headers : [];
const rowsIn = Array.isArray($json.rows) ? $json.rows : [];
const mappingArr = Array.isArray($json.mapping) ? $json.mapping : [];

const strategy =
  $json.strategy && typeof $json.strategy === "object" ? $json.strategy : {};
const strict_mode = !!$json.strict_mode;

const overrides =
  $json.overrides && typeof $json.overrides === "object" ? $json.overrides : {};
const perProduct =
  overrides.per_product && typeof overrides.per_product === "object"
    ? overrides.per_product
    : {};

let source = $json.source || { type: "custom", confidence: 0.5 };

// policy defaults
const policy = Object.assign(
  { duplicate_handle: "flag_only", missing_sku: "default_auto_suffix" },
  $json.policy || {}
);

/* ---------------- attribute scanners ---------------- */
function scanAttributePairs(allHeaders) {
  const pairs = [];
  const nameRe = /^Attribute\s+(\d+)\s+name$/i;
  const valRe = /^Attribute\s+(\d+)\s+value\(s\)$/i;

  const names = {};
  const vals = {};
  for (const h of allHeaders) {
    const m1 = String(h).match(nameRe);
    const m2 = String(h).match(valRe);
    if (m1) names[m1[1]] = h;
    if (m2) vals[m2[1]] = h;
  }
  const idxs = new Set([...Object.keys(names), ...Object.keys(vals)]);
  for (const i of idxs) {
    pairs.push({ idx: i, nameKey: names[i] || null, valueKey: vals[i] || null });
  }
  pairs.sort((a, b) => +a.idx - +b.idx);
  return pairs;
}
const ATTR_PAIRS = scanAttributePairs(headers);
const OPTION_NAME_CANDIDATES = [
  "color",
  "size",
  "material",
  "style",
  "length",
  "width",
  "height",
  "flavor",
  "capacity",
  "gender",
  "age",
  "activity",
  "strap",
  "pattern",
];

function getRowAttributes(row) {
  const attrs = [];
  // Woo-style pairs
  for (const p of ATTR_PAIRS) {
    const rawName = toStr(row[p.nameKey]).trim();
    const rawVal = toStr(row[p.valueKey]).trim();
    if (!rawName && !rawVal) continue;
    const name = rawName
      ? titleCase(rawName)
      : p.nameKey
      ? titleCase(p.nameKey.replace(/^Attribute\s+\d+\s+name$/i, ""))
      : "";
    if (!name) continue;
    const vals = rawVal
      ? rawVal.split("|").map((s) => s.trim()).filter(Boolean)
      : [];
    const first = vals[0] || rawVal || "";
    attrs.push({ name, rawName, values: vals, value: first });
  }
  // Custom optionish columns
  const lowerRow = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  for (const cand of OPTION_NAME_CANDIDATES) {
    if (lowerRow[cand] != null) {
      const v = toStr(lowerRow[cand]).trim();
      if (v) attrs.push({ name: titleCase(cand), rawName: cand, values: [v], value: v });
    }
  }
  return attrs;
}

function analyzeVaryingAttributes(rows) {
  const map = new Map(); // name -> Set(values)
  for (const r of rows) {
    const attrs = getRowAttributes(r);
    for (const a of attrs) {
      if (!map.has(a.name)) map.set(a.name, new Set());
      const vals = (a.values && a.values.length ? a.values : a.value ? [a.value] : []).map(
        (v) => toStr(v)
      );
      if (vals.length) vals.forEach((v) => map.get(a.name).add(v));
      else map.get(a.name).add("");
    }
  }
  const arr = [...map.entries()].map(([name, set]) => ({
    name,
    distinctCount: [...set].filter((v) => v !== "").length,
    values: [...set],
  }));
  return arr;
}

const PRIORITY_ORDER = [
  "Color",
  "Size",
  "Material",
  "Style",
  "Length",
  "Width",
  "Height",
  "Flavor",
  "Capacity",
  "Gender",
  "Age",
  "Activity",
  "Strap",
  "Pattern",
];

function chooseOptions(varyingArr, limit = 3, forcedPriority = null) {
  const candidates = varyingArr.filter((a) => a.distinctCount > 1);
  const priorityIndex = (name) => {
    const idx = PRIORITY_ORDER.findIndex(
      (p) => p.toLowerCase() === String(name).toLowerCase()
    );
    return idx === -1 ? 999 : idx;
  };
  // primary: priority order; secondary: distinctness
  candidates.sort((a, b) => {
    const pa = priorityIndex(a.name),
      pb = priorityIndex(b.name);
    if (pa !== pb) return pa - pb;
    if (b.distinctCount !== a.distinctCount) return b.distinctCount - a.distinctCount;
    return a.name.localeCompare(b.name);
  });

  let chosen = candidates.slice(0, limit).map((c) => c.name);
  const overflow = candidates.slice(limit).map((c) => c.name);

  if (Array.isArray(forcedPriority) && forcedPriority.length) {
    const candNames = new Set(candidates.map((c) => c.name.toLowerCase()));
    const forced = forcedPriority
      .map((n) => String(n).trim())
      .filter((n) => candNames.has(n.toLowerCase()))
      .slice(0, limit);
    const rest = candidates
      .map((c) => c.name)
      .filter((n) => !forced.map((f) => f.toLowerCase()).includes(n.toLowerCase()));
    chosen = [...forced, ...rest].slice(0, limit);
  }
  return { chosen, overflow, candidates };
}

/* ---------------- grouping (Woo-aware light) ---------------- */
function groupRowsWooAware(rows) {
  // Heuristic:
  // - If Type === 'variation', group by Parent/Name root; else treat as single products
  const byKey = new Map();

  const typeOf = (r) => toStr(r["Type"] || r["type"]).toLowerCase();

  // First pass: register variable parents
  for (const r of rows) {
    const t = typeOf(r);
    if (t === "variable") {
      const key = toStr(r["SKU"] || r["ID"] || r["Name"]) || kebab(r["Name"] || "");
      if (!byKey.has(key))
        byKey.set(key, { key, parent: r, variants: [], singles: [], parentImages: [] });
    }
  }
  // Second pass: attach variations
  for (const r of rows) {
    const t = typeOf(r);
    if (t === "variation") {
      const pref = toStr(r["Parent"]);
      let g = null;
      if (pref && byKey.has(pref)) g = byKey.get(pref);
      if (!g) {
        // fallback: try name root
        const base = toStr(r["Name"]).replace(/(-[a-z0-9]+){1,3}$/i, "").trim().toLowerCase();
        for (const gr of byKey.values()) {
          const pn = toStr(gr.parent?.Name || "").toLowerCase();
          if (base && pn && base === pn) {
            g = gr;
            break;
          }
        }
      }
      if (g) g.variants.push(r);
      else {
        const key =
          toStr(r["SKU"] || r["ID"] || r["Name"]) || kebab(r["Name"] || "");
        if (!byKey.has(key))
          byKey.set(key, { key, parent: null, variants: [], singles: [], parentImages: [] });
        byKey.get(key).singles.push(r);
      }
    }
  }
  // Third pass: simples
  for (const r of rows) {
    const t = typeOf(r);
    if (t === "variable" || t === "variation") continue;
    const key = toStr(r["ID"] || r["SKU"] || r["Name"]) || kebab(r["Name"] || "");
    if (!byKey.has(key))
      byKey.set(key, { key, parent: null, variants: [], singles: [], parentImages: [] });
    byKey.get(key).singles.push(r);
  }
  return [...byKey.values()];
}

/* ---------------- expansion helpers (simple → variants) ---------------- */
function splitPipeValues(v) {
  if (!truthy(v)) return [];
  return String(v).split("|").map((s) => s.trim()).filter(Boolean);
}
function cartesian(arrs) {
  return arrs.reduce((acc, curr) => {
    if (!acc.length) return curr.map((x) => [x]);
    const out = [];
    for (const a of acc) for (const b of curr) out.push([...a, b]);
    return out;
  }, []);
}
function expandSimpleRowToVariants(r, chosen) {
  const attrs = getRowAttributes(r);
  const byName = Object.fromEntries(attrs.map((a) => [a.name, a]));
  const perOptValues = chosen.map((n) => {
    const a = byName[n];
    if (!a) return [""];
    const pipe = splitPipeValues(a.values?.length ? a.values.join("|") : a.value);
    return pipe.length ? pipe : [""];
  });
  const combos = cartesian(perOptValues); // [[opt1,opt2,opt3], ...]
  return combos.map((vals) => {
    const clone = { ...r };
    for (let i = 0; i < chosen.length; i++) {
      clone[`__synthetic_opt_${i + 1}_name`] = chosen[i];
      clone[`__synthetic_opt_${i + 1}_value`] = vals[i] || "";
    }
    return clone;
  });
}

/* ---------------- overflow → Body & Metafields helpers ---------------- */
function collectOverflowValues(rows, overflowNames) {
  const map = new Map(); // name -> Set(values)
  const namesLC = new Set(overflowNames.map((n) => String(n).toLowerCase()));
  for (const rr of rows) {
    const attrs = getRowAttributes(rr);
    for (const a of attrs) {
      if (!namesLC.has(String(a.name).toLowerCase())) continue;
      const vals = (a.values && a.values.length ? a.values : a.value ? [a.value] : [])
        .map((v) => toStr(v).trim())
        .filter(Boolean);
      if (!map.has(a.name)) map.set(a.name, new Set());
      vals.forEach((v) => map.get(a.name).add(v));
    }
  }
  const out = {};
  for (const [k, set] of map.entries()) out[k] = [...set];
  return out;
}
function buildOverflowHtmlLine(overflowMap) {
  const pairs = Object.entries(overflowMap);
  if (!pairs.length) return "";
  const chips = pairs.map(([k, arr]) => `${k}: ${arr.join(" | ")}`);
  return `\n<p><em>• ${chips.join(" • ")}</em></p>`;
}

/* ---------------- constants & accumulators ---------------- */
const SHOPIFY_STD_COLS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Tags",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Inventory Qty",
  "Variant Image",
  "Image Src",
  "Image Position",
  // "Metafields" is dynamic
];

const REQUIRED_FIELDS = new Set(["Title", "Variant Price"]);

const groups = groupRowsWooAware(rowsIn);

const allOutRows = [];
const issues = [];
const suggestions = [];
const transforms = [];
let appliedSlugify = 0,
  appliedNumericPrice = 0,
  appliedNumericCompare = 0,
  appliedVarImg = 0,
  autoSkuAssigned = 0;

let decision_overrides_applied = [];

/* ---------------- per-group build ---------------- */
for (const g of groups) {
  const variantRows0 = g.variants.length ? g.variants : g.singles || [];
  if (!variantRows0.length) continue;

  const parentOrFirst = g.parent || variantRows0[0];

  const rawTitle = pick(parentOrFirst, ["Name", "Product Name", "Title"]);
  let canonicalTitle = rawTitle || "(Untitled)";

  // Handle and base product fields
  const handle = kebab(canonicalTitle);
  if (handle) appliedSlugify++;

  // Analyze varying attributes on original set for decisions/UI
  const varying0 = analyzeVaryingAttributes(variantRows0);
  const namesAll0 = varying0.filter((a) => a.distinctCount > 1).map((a) => a.name);
  const namesAll0LC = namesAll0.map((n) => n.toLowerCase());
  const inNames0 = (n) => namesAll0LC.includes(String(n).toLowerCase());

  // Decide chosen vs overflow (consider overrides)
  let chosenOptNames = [];
  let overflowOptNames = [];

  const per = perProduct[handle];
  if (per && Array.isArray(per.chosen_options) && per.chosen_options.length) {
    const capLC = per.chosen_options.map((s) => String(s).toLowerCase()).filter(inNames0).slice(0, 3);
    const priLC = Array.isArray(strategy.option_priority)
      ? strategy.option_priority.map((x) => String(x).toLowerCase())
      : [];
    capLC.sort((a, b) => {
      const ai = priLC.indexOf(a),
        bi = priLC.indexOf(b);
      const sa = ai === -1 ? 999 : ai,
        sb = bi === -1 ? 999 : bi;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
    const chosenLC = capLC.slice(0, 3);
    chosenOptNames = chosenLC.map((x) => namesAll0.find((n) => n.toLowerCase() === x));
    overflowOptNames = namesAll0.filter(
      (n) => !chosenOptNames.some((c) => c.toLowerCase() === n.toLowerCase())
    );
  } else {
    const picked = chooseOptions(varying0, 3, strategy.option_priority);
    chosenOptNames = picked.chosen;
    overflowOptNames = picked.overflow;
  }

  // Synthesize variants for "simple" with multi-value chosen attrs
  const parentType = toStr(parentOrFirst["Type"] || parentOrFirst["type"]).toLowerCase();
  let variantRows = variantRows0;
  if (parentType === "simple" && variantRows0.length === 1 && chosenOptNames.length) {
    // If any chosen attr has multiple values, expand cartesian
    const attrs = getRowAttributes(parentOrFirst);
    const byLC = Object.fromEntries(attrs.map((a) => [String(a.name).toLowerCase(), a]));
    const multi = chosenOptNames.some((n) => {
      const a = byLC[String(n).toLowerCase()];
      const pipeVals = splitPipeValues(a?.values?.length ? a.values.join("|") : a?.value);
      return pipeVals.length > 1;
    });
    if (multi) {
      variantRows = expandSimpleRowToVariants(parentOrFirst, chosenOptNames);
    }
  }

  // Product-level fields
  const productLevel = {
    Handle: handle,
    Title: canonicalTitle,
    "Body (HTML)": pick(parentOrFirst, [
      "description",
      "Description",
      "Body (HTML)",
      "Short description",
    ]),
    Vendor: pick(parentOrFirst, ["Vendor", "Brand", "vendor"]),
    Tags: pick(parentOrFirst, ["Tags", "Tag", "tags"]),
    "Option1 Name": chosenOptNames[0] || "",
    "Option2 Name": chosenOptNames[1] || "",
    "Option3 Name": chosenOptNames[2] || "",
  };

  // Build variant lines
  const seenCombos = new Set();
  const suppressDupIssue = overrides?.dedupe_handles === true;

  variantRows.forEach((r, idx) => {
    const attrs = getRowAttributes(r);
    const byName = Object.fromEntries(
      attrs.map((a) => [a.name, (a.values && a.values[0]) ? a.values[0] : (a.value || "")])
    );

    // Prefer synthetic picks for expanded simples
    const syn1 = r["__synthetic_opt_1_value"] || "";
    const syn2 = r["__synthetic_opt_2_value"] || "";
    const syn3 = r["__synthetic_opt_3_value"] || "";

    const ov1 = chosenOptNames[0] ? (syn1 || toStr(byName[chosenOptNames[0]] || "")) : "";
    const ov2 = chosenOptNames[1] ? (syn2 || toStr(byName[chosenOptNames[1]] || "")) : "";
    const ov3 = chosenOptNames[2] ? (syn3 || toStr(byName[chosenOptNames[2]] || "")) : "";

    const comboKey = [ov1, ov2, ov3].join("||");
    if (chosenOptNames.length && seenCombos.has(comboKey)) {
      if (!suppressDupIssue) {
        issues.push({ code: "DUP_VARIANT_COMBO", field: "Options", value: comboKey, handle });
      }
      return;
    }
    seenCombos.add(comboKey);

    // Prices (with agentic fixes)
    const reg = toNumber(pick(r, ["Regular price", "Price", "price", "Variant Price"]));
    const sale = toNumber(pick(r, ["Sale price", "Sale Price", "Variant Compare At Price"]));
    let variantPrice = reg;
    let variantCompare = null;
    if (sale && reg && sale < reg) {
      variantPrice = sale;
      variantCompare = reg;
    }
    // Apply strategy.fix_missing_price
    const fmp = (strategy && strategy.fix_missing_price) || null;
    if (variantPrice == null || variantPrice === "") {
      if (fmp === "zero" || (typeof fmp === "object" && String(fmp.mode).toLowerCase() === "zero")) {
        variantPrice = 0;
        decision_overrides_applied.push({ type: "fix_missing_price_zero", handle });
      } else if (
        fmp === "copy_compare_at" ||
        (typeof fmp === "object" && String(fmp.mode).toLowerCase() === "copy_compare_at")
      ) {
        if (variantCompare != null) {
          variantPrice = variantCompare;
          decision_overrides_applied.push({ type: "fix_missing_price_copy_compare_at", handle });
        } else {
          variantPrice = 0;
          decision_overrides_applied.push({ type: "fix_missing_price_fallback_zero", handle });
        }
      }
    }

    if (variantPrice != null) appliedNumericPrice++;
    if (variantCompare != null) appliedNumericCompare++;

    // SKU
    let sku = toStr(pick(r, ["SKU", "Sku", "sku", "Variant SKU"])).trim();
    if (!sku) {
      const n = idx + 1;
      sku = `${handle}-${String(n).padStart(3, "0")}`;
      autoSkuAssigned++;
      issues.push({ code: "AUTO_SKU_ASSIGNED", field: "Variant SKU", value: sku, handle });
    }

    const rowOut = Object.assign({}, idx === 0 ? productLevel : { Handle: handle }, {
      "Option1 Value": ov1,
      "Option2 Value": ov2,
      "Option3 Value": ov3,
      "Variant SKU": sku || "",
      "Variant Price": variantPrice != null ? variantPrice : "",
      "Variant Compare At Price": variantCompare != null ? variantCompare : "",
      "Variant Inventory Qty":
        toNumber(pick(r, ["Stock", "stock", "Stock Quantity", "Inventory"])) || "",
    });

    // fix_missing_title (first row only)
    const fmt = (strategy && strategy.fix_missing_title) || null;
    if (idx === 0 && (!rowOut["Title"] || String(rowOut["Title"]).trim() === "")) {
      if (fmt && typeof fmt === "object" && String(fmt.mode).toLowerCase() === "prefix") {
        const pfx = String(fmt.prefix ?? "Untitled").trim();
        rowOut["Title"] = pfx + (canonicalTitle ? ` — ${canonicalTitle}` : "");
        decision_overrides_applied.push({ type: "fix_missing_title_prefix", handle, prefix: pfx });
      }
    }

    // Variant image
    const varImg = firstImage(pick(r, ["Variant Image", "Images", "Image URL", "image"]));
    if (varImg) {
      rowOut["Variant Image"] = varImg;
      appliedVarImg++;
    }

    // QA required (blocking)
    if (!rowOut["Title"] && idx === 0) {
      issues.push({ code: "REQ_MISSING_TITLE", field: "Title", handle });
    }
    if (rowOut["Variant Price"] === "" || rowOut["Variant Price"] === null) {
      issues.push({
        code: "REQ_MISSING_PRICE",
        field: "Variant Price",
        handle,
        sku: rowOut["Variant SKU"],
      });
    }

    allOutRows.push(rowOut);
  });

  // Product images from parent (or first variant) as separate image-only rows
  const parentImages = splitImages(pick(parentOrFirst, ["Images", "Image URL", "image", "Image"]));
  parentImages.forEach((img, i) => {
    allOutRows.push({
      Handle: handle,
      "Image Src": img,
      "Image Position": i + 1,
    });
  });

  // Overflow suggestions (for UI) if any
  const varyingListAll = analyzeVaryingAttributes(variantRows)
    .filter((a) => a.distinctCount > 1)
    .map((a) => a.name);
  const chosenSetLC = new Set((chosenOptNames || []).map((n) => String(n).toLowerCase()));
  const overflowNow = varyingListAll.filter((n) => !chosenSetLC.has(String(n).toLowerCase()));
  const hasOverflow = overflowNow.length > 0;

  if (hasOverflow) {
    suggestions.push({
      type: "option_overflow",
      message: `Product "${canonicalTitle}" has more varying attributes than allowed: ${overflowNow.join(
        ", "
      )}.`,
      handle,
      propose: {
        chosen: chosenOptNames,
        overflow: overflowNow,
        store_overflow_as: ["metafields", "append_to_body_html"],
      },
    });
  }

  // Apply demotion if explicitly requested via per-product override
  const per2 = perProduct[handle];
  const overflowAction = per2?.overflow_to;

  if (per2 && Array.isArray(per2.chosen_options) && per2.chosen_options.length) {
    // Record applied override
    decision_overrides_applied.push({
      type: "cap_options",
      handle,
      chosen: chosenOptNames,
      overflow: overflowNow,
    });

    if (hasOverflow && overflowAction === "append_to_body_html") {
      const overflowMap = collectOverflowValues(variantRows, overflowNow);
      const htmlLine = buildOverflowHtmlLine(overflowMap);

      const pIdx = allOutRows.findIndex((r) => r.Handle === handle && r.Title);
      if (pIdx !== -1) {
        const cur = toStr(allOutRows[pIdx]["Body (HTML)"] || "");
        allOutRows[pIdx]["Body (HTML)"] = cur + htmlLine;
        const mf = { overflow: overflowMap };
        allOutRows[pIdx]["Metafields"] = JSON.stringify(mf);
      }
    }
  } else {
    // No override → keep QA issue so UI knows this handle is unresolved
    if (hasOverflow) {
      issues.push({
        code: "EXCESS_OPTION_DIMENSIONS",
        field: "Options",
        handle,
        attrs: varyingListAll,
      });
    }
  }
}

/* ---------------- QA roll-up ---------------- */
const blockingCodes = new Set(["REQ_MISSING_TITLE", "REQ_MISSING_PRICE"]);
const blocking = issues.filter((i) => blockingCodes.has(i.code)).length;
const warnings = issues.length - blocking;

/* ---------------- CSV build ---------------- */
function buildCsv(rows) {
  if (!rows.length) return "";
  const dyn = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter(
    (c) => !SHOPIFY_STD_COLS.includes(c)
  );
  const cols = [...SHOPIFY_STD_COLS, ...dyn];
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  return header + "\n" + body + "\n";
}
const csvStr = buildCsv(allOutRows);
const shopifyCsvBase64 = Buffer.from(csvStr, "utf8").toString("base64");

/* ---------------- handles_with_overflow (unresolved only) ---------------- */
const unresolvedHandles = new Set(
  issues.filter((i) => i.code === "EXCESS_OPTION_DIMENSIONS").map((i) => i.handle)
);
const handles_with_overflow = [];
for (const g of groups) {
  const parentOrFirst = g.parent || g.singles?.[0] || g.variants?.[0];
  if (!parentOrFirst) continue;
  const title = pick(parentOrFirst, ["Name", "Product Name", "Title"]) || "(Untitled)";
  const handle = kebab(title);
  if (!unresolvedHandles.has(handle)) continue;
  const variantRows = g.variants.length ? g.variants : g.singles || [];
  const varying = analyzeVaryingAttributes(variantRows);
  const attrs = varying.filter((a) => a.distinctCount > 1).map((a) => a.name);
  const picked = chooseOptions(varying, 3, strategy.option_priority);
  const suggested = picked.chosen.slice(0, 3);
  handles_with_overflow.push({
    handle,
    title,
    varying_attributes: attrs,
    suggested_three: suggested,
  });
}

/* ---------------- gate ---------------- */
const needsOverride = strict_mode
  ? blocking > 0 // strict blocks only on hard missing Title/Price
  : blocking > 0 || unresolvedHandles.size > 0;

const gateReasons = [];
if (blocking > 0) gateReasons.push("Missing required fields (Title or Variant Price).");
if (!strict_mode && unresolvedHandles.size > 0)
  gateReasons.push("More than 3 varying attributes — resolve per product.");

/* ---------------- decision log ---------------- */
const completedAt = new Date();
const decision_log = {
  meta: {
    started_at: startedAt.toISOString(),
    signature: headers.join("|"),
    header_count: headers.length,
    row_count: rowsIn.length,
    completed_at: completedAt.toISOString(),
  },
  transforms: [
    { rule: "slugify_handle", applied_to: appliedSlugify },
    { rule: "numeric_parse_price", applied_to: appliedNumericPrice },
    { rule: "numeric_parse_compare_at", applied_to: appliedNumericCompare },
    { rule: "variant_image_first", applied_to: appliedVarImg },
  ],
  qa: { blocking, warnings, issues },
  gate: { needs_override: needsOverride, reasons: gateReasons },
  policy,
  strategy_applied: {
    strict_mode,
    option_priority: Array.isArray(strategy.option_priority) ? strategy.option_priority : [],
    fix_missing_price: strategy.fix_missing_price ?? null,
    fix_missing_title: strategy.fix_missing_title ?? null,
  },
  overrides_applied: {
    count: decision_overrides_applied.length,
    list: decision_overrides_applied,
  },
};

/* ---------------- final response ---------------- */
return [
  {
    json: {
      source,
      strategy,
      strict_mode,
      preview_transformed: allOutRows.slice(0, 50),
      files: { shopify_csv_base64: shopifyCsvBase64 },
      qa: { blocking, warnings, issues },
      gate: { needs_override: needsOverride, reasons: gateReasons },
      decision_log,
      handles_with_overflow,
    },
  },
];
