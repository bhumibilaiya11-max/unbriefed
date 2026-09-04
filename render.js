/* Unbriefed — slide rendering (pure string builders, no DOM).
 * Shared by app.js (browser preview + PDF) and the verification/preview scripts in Node. */

// Slide types are now free-form (chosen per-request by the outline step), so map an icon by
// keyword rather than an exhaustive list.
const ICON_BY_KEYWORD = [
  [/hook|open|tension|stake|gap|problem|challenge|pain/, "bolt"],
  [/context|why.?now|situation|backdrop|market|macro|state/, "public"],
  [/insight|consumer|audience|user|persona|culture|behaviou?r|segment/, "lightbulb"],
  [/teardown|audit|diagnos|breakdown|dissect|deep.?dive|analy/, "troubleshoot"],
  [/reframe|shift|thesis|belief|pov|contrarian/, "swap_horiz"],
  [/opportunity|opening|unlock|upside|potential|whitespace|prize/, "trending_up"],
  [/solution|approach|idea|concept|plan|play|strategy|blueprint|proposal|move/, "architecture"],
  [/proof|evidence|track|credential|fit|why.?me|receipts/, "verified"],
  [/roadmap|timeline|phase|90|rollout|sequence|implementation|execution/, "map"],
  [/metric|kpi|number|impact|result|roi|economics|model/, "monitoring"],
  [/risk|mitigat|objection|threat|guardrail/, "shield"],
  [/team|org|people|hire|talent|culture.?add/, "groups"],
  [/vision|future|north.?star|ambition|where.?this.?goes/, "explore"],
  [/ask|close|next.?step|cta|commit|decision/, "handshake"],
  [/moodboard|creative.?territory|design|aesthetic|look.?and.?feel/, "palette"],
];
export function iconFor(type = "") {
  const t = String(type).toLowerCase();
  for (const [re, icon] of ICON_BY_KEYWORD) if (re.test(t)) return icon;
  return "chevron_right";
}

// Each tone owns a distinct accent — this is what makes two tones of the same brief look
// different, not just read differently.
export const TONE_ACCENT = {
  Bold: "#ff3b00",         // loud orange-red against black/white
  Strategic: "#630ed4",    // the signature electric purple
  Corporate: "#1e2a4a",    // restrained navy
  Creative: "#c2410c",     // warm burnt orange
  Playful: "#db2777",      // bright magenta
  Minimal: "#1c1b1b",      // near-black, the single accent used once
  Analytical: "#0f766e",   // cool teal
  Storytelling: "#4338ca", // narrative indigo
};
export function accentFor(tone) {
  return TONE_ACCENT[tone] || "#630ed4";
}

const STAT_ICONS = ["insights", "trending_up", "target", "paid", "schedule", "groups", "percent", "bar_chart", "speed", "pie_chart"];
// Material Symbols the model is allowed to name; anything else falls back to an indexed default
// so a wrong guess like "trend_up" never renders as raw text inside a badge.
const ICON_OK = new Set([
  "insights", "trending_up", "trending_down", "trending_flat", "target", "crisis_alert", "flag",
  "paid", "payments", "attach_money", "currency_rupee", "savings", "account_balance", "percent",
  "schedule", "timer", "calendar_month", "event", "hourglass_top", "update",
  "groups", "group", "people", "person", "diversity_3", "handshake", "campaign", "forum",
  "bar_chart", "pie_chart", "monitoring", "query_stats", "leaderboard", "analytics", "show_chart",
  "speed", "bolt", "rocket_launch", "trophy", "workspace_premium", "verified", "star_rate",
  "location_city", "public", "map", "store", "storefront", "apartment",
  "school", "menu_book", "videocam", "movie", "play_circle", "visibility", "thumb_up", "favorite",
  "layers", "view_timeline", "checklist", "task_alt", "route", "conversion_path", "hub", "lan",
  "shopping_cart", "sell", "local_offer", "inventory_2", "factory", "build", "settings",
]);
function pickIcon(name, i) {
  return name && ICON_OK.has(name) ? name : STAT_ICONS[i % STAT_ICONS.length];
}

export const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
export const escLines = (s) => esc(s).replace(/\n+/g, "<br>");
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const DONUT_COLORS = ["var(--accent)", "#1c1b1b", "#9d4300", "#4a4455", "#7b7487"];
const SWATCH_GRADIENTS = [
  "linear-gradient(135deg, var(--accent), #1c1b1b)",
  "radial-gradient(circle at 30% 25%, var(--accent), #1c1b1b 130%)",
  "linear-gradient(150deg, #1c1b1b 0%, var(--accent) 100%)",
  "linear-gradient(200deg, var(--accent) 0%, #1c1b1b 75%)",
];

function statCard(s, i) {
  const icon = pickIcon(s.icon, i);
  let value = String(s.value || "").trim();
  let label = String(s.label || "").trim();
  // guard: model sometimes puts a whole sentence in "value" — keep the figure, demote the rest
  if (value.split(/\s+/).length > 5 || value.length > 32) {
    const m = value.match(/^[~≈<>]?\s*[\d.,]+\s*(%|x|k|m|bn?|cr|l|\/\w+)?/i);
    if (m) {
      const rest = value.slice(m[0].length).replace(/^[\s—–-]+/, "");
      value = m[0].trim();
      if (rest && !label) label = rest;
    } else {
      value = value.split(/\s+/).slice(0, 4).join(" ");
    }
  }
  const isEst =
    s.basis === "estimate" ||
    /\b(est\.?|estimate[d]?|modell?ed|approx|assumed)\b/i.test(`${s.value} ${label} ${s.note || ""}`);
  return `<div class="s-stat">
    <div class="s-stat-top">
      <span class="s-stat-badge material-symbols-outlined">${esc(icon)}</span>
      <span class="v">${esc(value)}</span>
    </div>
    <div class="l">${esc(label)}${isEst ? `<span class="s-est">est.</span>` : ""}</div>
  </div>`;
}

// index/total (both 0-based-safe, optional) draw the "03/08" page mark on the banner.
export function slideTemplate(slide, index, total) {
  const icon = iconFor(slide.type);
  const beat = slide.purpose || slide.type || "";
  const statsHTML = (slide.stats || []).slice(0, 2).map(statCard).join("");
  const visual = renderVisual(slide.visual || {});
  const pageNum =
    Number.isInteger(index) && total
      ? `<span class="s-num">${String(index + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}</span>`
      : "";
  return `
    <div class="deco deco-a"></div><div class="deco deco-b"></div><div class="deco deco-c"></div>
    <div class="s-root${visual ? "" : " no-visual"}" data-type="${esc(slide.type)}">
      <div class="s-banner"><span class="material-symbols-outlined">${icon}</span>${esc(slide.banner || slide.type)}${pageNum}</div>
      <div class="s-lower">
        <div class="s-content" data-beat="${esc(beat)}">
          <div class="s-headline">${escLines(slide.headline)}</div>
          <div class="s-body">${escLines(slide.body)}</div>
          ${slide.pov ? `<div class="s-pov">${escLines(slide.pov)}</div>` : ""}
          ${statsHTML ? `<div class="s-stats">${statsHTML}</div>` : ""}
        </div>
        ${visual ? `<div class="s-visual">${visual}</div>` : ""}
      </div>
    </div>`;
}

function cap(v, fallback) {
  const c = v && v.caption ? v.caption : fallback;
  return c ? `<div class="s-vcap">${esc(c)}</div>` : "";
}

export function renderVisual(v) {
  switch (v && v.kind) {
    case "statement": return visStatement(v);
    case "quote": return visQuote(v);
    case "big_number": return visBigNumber(v);
    case "intensity_bars": return visIntensity(v);
    case "comparison_table": return visTable(v);
    case "matrix_2x2": return visMatrix(v);
    case "timeline": return visTimeline(v);
    case "step_flow": return visSteps(v);
    case "metric_callout": return visMetrics(v);
    case "mapping_table": return visMapping(v);
    case "phase_plan": return visPhasePlan(v);
    case "donut_chart": return visDonut(v);
    case "moodboard": return visMoodboard(v);
    default:
      return ""; // text-forward slide — no visual chrome
  }
}

// A real proportional donut, drawn with conic-gradient — not a placeholder.
function visDonut(v) {
  const segs = (v.segments || []).filter((s) => s && s.label).slice(0, 5);
  if (!segs.length) return "";
  const num = (s) => parseFloat(String(s.pct ?? s.value ?? 0).replace(/[^0-9.\-]/g, "")) || 0;
  const total = segs.reduce((a, s) => a + num(s), 0) || 1;
  let acc = 0;
  const stops = segs
    .map((s, i) => {
      const pct = (num(s) / total) * 100;
      const from = acc;
      acc += pct;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
    })
    .join(", ");
  const fmt = (s) => {
    const raw = String(s.pct ?? s.value ?? "").trim();
    return /%$/.test(raw) || !raw ? raw || `${Math.round((num(s) / total) * 100)}%` : `${raw}%`;
  };
  const lead = segs[0];
  const legend = segs
    .map(
      (s, i) =>
        `<div class="row"><span class="sw" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>${esc(
          s.label
        )} — ${esc(fmt(s))}</div>`
    )
    .join("");
  return (
    cap(v, "Share breakdown") +
    `<div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})">
        <div class="donut-hole"><div class="v">${esc(fmt(lead))}</div><div class="l">${esc(
      (lead.label || "").slice(0, 16)
    )}</div></div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>`
  );
}

// Gradient "photo" swatches standing in for imagery on a moodboard-style editorial slide.
function visMoodboard(v) {
  const items = (v.swatches || []).filter(Boolean).slice(0, 4);
  if (!items.length) return "";
  const tiles = items
    .map(
      (s, i) => `<div class="mb-tile" style="background:${SWATCH_GRADIENTS[i % SWATCH_GRADIENTS.length]}">
        <span class="material-symbols-outlined">${esc(pickIcon(s.icon, i))}</span>
        <div class="mb-l">${esc(s.label || "")}</div>
      </div>`
    )
    .join("");
  return `<div class="mb-grid n${items.length}">${tiles}</div>`;
}

function visStatement(v) {
  const lines = (Array.isArray(v.lines) ? v.lines : v.text ? [v.text] : []).filter(Boolean).slice(0, 5);
  if (!lines.length) return "";
  return `<div class="stmt">${lines.map((l) => `<div class="stmt-l">${esc(l)}</div>`).join("")}</div>`;
}
function visQuote(v) {
  if (!v.text) return "";
  return `<div class="quote"><div class="quote-mark">&ldquo;</div><div class="quote-t">${esc(v.text)}</div>${
    v.attribution ? `<div class="quote-a">— ${esc(v.attribution)}</div>` : ""
  }</div>`;
}
function visBigNumber(v) {
  if (!v.value) return "";
  return `<div class="bignum"><div class="bignum-v">${esc(v.value)}</div>${
    v.label ? `<div class="bignum-l">${esc(v.label)}</div>` : ""
  }${v.sub ? `<div class="bignum-s">${esc(v.sub)}</div>` : ""}</div>`;
}

function visIntensity(v) {
  const rows = (v.items || []).slice(0, 5).map((it) => {
    const lvl = clamp(Math.round(+it.level || 0), 0, 5);
    const segs = Array.from({ length: 5 }, (_, i) => `<div class="ib-seg${i < lvl ? " on" : ""}"></div>`).join("");
    // a bar value must carry a number — if the model gave an adjective, show the 1-5 level instead
    const raw = it.value != null ? String(it.value).trim() : "";
    const val = /\d/.test(raw) ? esc(raw) : `${lvl}/5`;
    return `<div class="ib-row">
      <div class="ib-label">${esc(it.label)}</div>
      <div class="ib-track">${segs}</div>
      <div class="ib-val">${val}</div>
      <div class="ib-note">${esc(it.note || "")}</div>
    </div>`;
  }).join("");
  return cap(v, "Intensity") + `<div class="ib">${rows}</div>`;
}

function visTable(v) {
  const cols = v.columns || [];
  const head = `<tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const body = (v.rows || []).map((r) => {
    const cells = (Array.isArray(r) ? r : [r]).slice(0, cols.length || 8);
    return `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
  }).join("");
  return cap(v, "Comparison") + `<div style="overflow:auto;flex:1"><table class="ct"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

function visMatrix(v) {
  const q = (v.quadrants || []).slice(0, 4);
  while (q.length < 4) q.push({ label: "", note: "", items: [] });
  const cell = (x) => {
    const label = x.label || x.name || "";
    const note = x.note || x.tag || "";
    const items = (x.items || []).filter((i) => i != null && String(i).trim());
    if (!items.length && !note) items.push("(open)");
    return `<div class="mx-q">
      <div class="n">${esc(label)}</div>
      ${note ? `<div class="t">${esc(note)}</div>` : ""}
      ${items.length ? `<ul>${items.slice(0, 3).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    </div>`;
  };
  return cap(v, "Positioning map") + `
    <div class="mx-axes">
      <span><b class="ax">&#8597;</b>${esc(v.yLabel || "Vertical axis")}</span>
      <span><b class="ax">&#8596;</b>${esc(v.xLabel || "Horizontal axis")}</span>
    </div>
    <div class="mx">${cell(q[0])}${cell(q[1])}${cell(q[2])}${cell(q[3])}</div>`;
}

function visTimeline(v) {
  const nodes = (v.phases || []).slice(0, 4).map((p) => `
    <div class="tl-node">
      <div class="tl-dot">${esc(p.marker || "•")}</div>
      <div class="tt">${esc(p.title)}</div>
      <ul>${(p.points || []).slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>`).join("");
  return cap(v, "Timeline") + `<div class="tl">${nodes}</div>`;
}

function visSteps(v) {
  const steps = (v.steps || []).slice(0, 5);
  const html = steps.map((s, i) => `
    ${i ? `<div class="sf-arrow"><span class="material-symbols-outlined">arrow_forward</span></div>` : ""}
    <div class="sf-step"><div class="sl">${esc(s.label || "Step " + (i + 1))}</div><div class="st">${esc(s.text)}</div></div>
  `).join("");
  return cap(v, "Flow") + `<div class="sf">${html}</div>`;
}

function visMetrics(v) {
  const items = (v.metrics || []).slice(0, 4);
  const m = items.map((x) => {
    const delta = (x.delta || "").toString().trim();
    return `<div class="mc-m"><div class="v">${esc(x.value)}</div><div class="l">${esc(x.label)}</div>${
      delta.length > 1 ? `<div class="d">${esc(delta)}</div>` : ""
    }</div>`;
  }).join("");
  return cap(v, "Key figures") + `<div class="mc n${items.length}">${m}</div>`;
}

function visMapping(v) {
  const rows = (v.rows || []).slice(0, 4).map((r) => `
    <div class="mp-row">
      <div class="mp-cell"><div class="h">Company problem</div>${esc(r.problem)}</div>
      <div class="mp-cell ach"><div class="h">Track record (verbatim)</div>${esc(r.achievement)}</div>
      <div class="mp-cell"><div class="h">Day-1 deliverable</div>${esc(r.deliverable)}</div>
    </div>`).join("");
  return cap(v, "Problem → proof → first deliverable") + `<div class="mp">${rows}</div>`;
}

function visPhasePlan(v) {
  const cols = (v.phases || []).slice(0, 3).map((p) => `
    <div class="pp-col">
      <div class="w">${esc(p.window)}</div>
      <div class="f">${esc(p.focus)}</div>
      <ul>${(p.actions || []).slice(0, 5).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>`).join("");
  return cap(v, "First 90 days") + `<div class="pp">${cols}</div>`;
}
