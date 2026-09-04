// Generation — a genuine two-step pipeline.
//   Step A (outline): the model reasons about THIS candidate/company/role/tone/pitch and decides
//                     the shape of the argument — how many slides, which slide purposes, in what
//                     order, which visual per slide, and the overall visual mood. 5–14 slides.
//   Step B (content): the model writes full copy for THAT outline, in THAT order.
// There is no fixed slide template. Tone is injected into the Step-B system prompt and shapes the
// actual sentence construction, not just the CSS.

import { requireAuth, requireCreditsAndSpend, refundCredit } from "./_gate.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Reference list only — shown to the model as "do NOT just default to these".
export const COMMON_SLIDE_TYPES = [
  "hook", "context", "insight", "diagnosis", "teardown", "reframe", "opportunity",
  "solution", "concept", "proof", "evidence", "roadmap", "risks", "vision", "ask",
];

export const VISUAL_KINDS = [
  "statement", "quote", "big_number", "moodboard", // text-forward / expressive / graphic
  "intensity_bars", "comparison_table", "matrix_2x2", "timeline", "step_flow", "donut_chart",
  "metric_callout", "mapping_table", "phase_plan", // structured / data
];

export const ROLES = {
  "Marketing & Brand": {
    lens: "consumer insight, category perception, brand positioning, and the acquisition funnel",
    vocabulary:
      "positioning, segment, occasion, salience, category entry points, share of voice, creative territory, funnel stage, CAC, consideration set",
    forbiddenFocus:
      "Do not write unit-economics or valuation slides — that is a finance lens, not this one.",
    visualLean:
      "leans visual and expressive — positioning maps, funnels, moodboard-style statement slides, campaign concepts. A creative/playful tone here can carry slides with almost no data.",
  },
  "Product Management": {
    lens: "user friction, product teardown, prioritization logic, the north-star metric, and MVP scoping",
    vocabulary:
      "activation, retention, friction, drop-off, north-star metric, jobs-to-be-done, wedge, scope cut, instrumentation, cohort",
    forbiddenFocus: "Do not lean on brand-campaign language or valuation math; stay in product and usage.",
    visualLean:
      "leans on walked user flows with drop-off, friction rankings, and a crisp north-star metric callout.",
  },
  "Consulting & Strategy": {
    lens: "structured problem diagnosis, hypothesis-driven reasoning, strategic trade-offs, and phased implementation",
    vocabulary:
      "driver, hypothesis, lever, trade-off, second-order effect, so-what, structural vs cyclical, no-regret move",
    forbiddenFocus: "Avoid campaign concepts and product-teardown detail unless they are the strategic crux.",
    visualLean:
      "leans dense and structured — driver breakdowns, 2x2s, comparison tables, phased plans. Named frameworks only when they genuinely fit.",
  },
  "Corporate Finance": {
    lens: "unit economics, margin structure, capital allocation, valuation drivers, and quantified upside",
    vocabulary:
      "contribution margin, unit economics, payback period, working capital, ROIC, cash conversion, sensitivity, capital allocation, valuation multiple",
    forbiddenFocus:
      "Never write marketing-style campaign slides or product-teardown slides. Every claim ties to money, timing, or risk.",
    visualLean:
      "leans quantitative — metric callouts, before/after economics tables, driver-sensitivity bars. Little to no imagery.",
  },
  "Sales & Business Development": {
    lens: "pipeline gaps, segment prioritization, deal motion, channel expansion, and win-rate levers",
    vocabulary:
      "pipeline coverage, ICP, sales motion, land-and-expand, cycle time, win rate, channel, quota capacity, deal desk",
    forbiddenFocus: "Not a brand slide, not a valuation slide — stay in pipeline, segments, and motion.",
    visualLean: "leans on deal-stage flows with stall points and segment-attractiveness tables.",
  },
  "People & HR": {
    lens: "talent funnel health, attrition drivers, capability gaps, org design, and hiring economics",
    vocabulary:
      "attrition, regretted loss, time-to-fill, capability gap, span of control, onboarding ramp, internal mobility, engagement driver",
    forbiddenFocus: "Not a product teardown, not a finance model — stay in people, capability, and structure.",
    visualLean: "leans on attrition/capability-gap rankings and hiring-funnel flows.",
  },
  "Data & Analytics": {
    lens: "decision gaps, data maturity, instrumentation quality, metric definitions, and modelling opportunity",
    vocabulary:
      "instrumentation, source of truth, metric definition, data latency, decision loop, baseline, model lift, feature, coverage",
    forbiddenFocus: "Not a brand slide, not an org slide — stay in decisions, data, and models.",
    visualLean: "leans on maturity 2x2s (coverage vs trust) and instrumentation timelines.",
  },
  "Product Design & UX": {
    lens: "usability friction, flow breakage, visual and interaction hierarchy, design debt, and coherence",
    vocabulary:
      "flow, affordance, hierarchy, first-run experience, design debt, coherence, cognitive load, empty state, error recovery",
    forbiddenFocus: "Not a valuation slide, not a pipeline slide — stay in the experience and the craft.",
    visualLean:
      "leans visual — annotated flow walk-throughs, severity rankings, and expressive statement slides about the felt experience.",
  },
};

// Tone drives the ACTUAL WRITING. Each block is injected into the Step-B system prompt with a
// concrete voice instruction plus a worked headline/body exemplar the model can aim at.
export const TONES = {
  Bold: {
    temperature: 0.7,
    voice:
      "Write like a founder pitching on stage with sixty seconds. Every sentence is a hammer. Cut all hedges, qualifiers and setup clauses. Verbs lead. Sentence fragments are fine. Never make the same point twice.",
    headline: "ALL CAPS, under 7 words. A claim or a dare. No colon, no subtitle.",
    sampleHeadline: "GEN Z FORGETS YOU BY TUESDAY",
    sampleBody:
      "Nike shows up for a festival. Then it vanishes. Students move on. The brand restarts from zero every single quarter.",
  },
  Strategic: {
    temperature: 0.55,
    voice:
      "Write like a strategy consultant walking a partner through the logic. State a claim, then its consequence — 'because X, Y follows'. Mostly medium-length sentences. End on an explicit implication.",
    headline: "Sentence case, ~8–12 words. A claim plus its implication.",
    sampleHeadline: "Episodic activation caps Nike's share of the daily consideration set",
    sampleBody:
      "Because campus attention resets after each festival, Nike keeps re-acquiring the same students. A continuous presence would turn that spend into compounding recall. The implication is a budget shift from spikes to an always-on layer.",
  },
  Corporate: {
    temperature: 0.42,
    voice:
      "Write like an internal board paper. Neutral register, precise nouns, no adjectives of enthusiasm, no contractions, no rhetorical questions. State the position plainly and support it with one fact.",
    headline: "A measured noun phrase, like a board-paper section title. No wordplay.",
    sampleHeadline: "Campus engagement lacks continuity between seasonal activations",
    sampleBody:
      "Current programmes concentrate spend around festivals and product launches. Engagement declines materially in the intervening periods. A sustained model would maintain brand consideration across the academic year.",
  },
  Creative: {
    temperature: 0.75,
    voice:
      "Write like an agency strategy deck. Open on one specific, sensory observation, then turn it into the point. Fragments for rhythm. Concrete nouns over abstractions. One vivid image per slide.",
    headline: "A noticed detail turned into a claim. An image, not a summary.",
    sampleHeadline: "The jersey comes out twice a year, then goes back in the drawer",
    sampleBody:
      "Diwali. A big drop. The campus lights up in swooshes for one weekend. Then Monday comes and the drawer closes. Nike lives in students' calendars, not their mornings.",
  },
  Playful: {
    temperature: 0.72,
    voice:
      "Write like a sharp friend who has done this and is a little cocky about it. Contractions, one wry aside per slide, the occasional rhetorical question. Confident, never zany. The joke always carries a point.",
    headline: "A sharp line with a wink. The joke has to land a point.",
    sampleHeadline: "Nike's great at the party, terrible at the group chat",
    sampleBody:
      "Festivals? Nailed. The other 350 days? Radio silence. Gen Z doesn't build habits around a brand that only texts back twice a year.",
  },
  Minimal: {
    temperature: 0.4,
    voice:
      "Write the fewest words that still make the argument. Rarely more than twelve words a sentence. No adjective unless it is load-bearing. Let the white space carry weight.",
    headline: "3–6 words. A flat statement of fact.",
    sampleHeadline: "Nike goes quiet between drops",
    sampleBody: "Festivals spike. Then nothing. Habits need daily contact. Nike has none.",
  },
  Analytical: {
    temperature: 0.4,
    voice:
      "Write like a data memo. Every sentence carries a number, a ratio, or a stated hypothesis. Define terms. Label assumptions as assumptions. No adjective stands alone without a figure behind it.",
    headline: "A quantified statement or a testable hypothesis, with the figure in it.",
    sampleHeadline: "Campus touch frequency: ~2/yr vs ~12/yr for habit formation (est.)",
    sampleBody:
      "Assume habit formation needs roughly one brand touch per month. Current campus cadence is about two events per year, an ~83% gap. Closing it is the largest single lever on unaided recall.",
  },
  Storytelling: {
    temperature: 0.68,
    voice:
      "Write one continuous story across the deck. Each slide opens by picking up the previous beat ('That is the gap. Here is what created it…'). Build tension through the middle; release it at the ask. Past tense for backstory, present tense for the turn.",
    headline: "A beat in the narrative — it should only fully land in sequence.",
    sampleHeadline: "It starts with a jersey nobody wears on a Wednesday",
    sampleBody:
      "Every year the same thing happens. The festival hits, the campus goes full swoosh, and for seventy-two hours Nike owns the conversation. Then the term grinds on and the brand slips out of frame. That slip is where this pitch begins.",
  },
};

const MOODS = `MOOD — pick the one that genuinely fits this role + tone + pitch. Lean into it; do not hedge to "balanced" out of caution.
- "editorial": think a beautifully art-directed Instagram carousel or a brand manifesto. Big type, one idea per slide, expressive asymmetry, lots of "statement" / "quote" / "big_number" slides, almost no tables. This is the RIGHT call for Creative / Playful / Bold tones on Marketing & Brand or Product Design pitches — a creative marketing pitch should feel designed, not analysed.
- "infographic": think a McKinsey / BCG case deck. Dense, structured, many labelled parts — comparison_table, matrix_2x2, phase_plan, metric_callout, intensity_bars on most slides. This is the RIGHT call for Consulting, Corporate Finance, Analytical, Data & Analytics pitches, and for Corporate tone anywhere — a serious strategy pitch should look rigorous.
- "balanced": only when the role/tone genuinely sit between the two (e.g. Strategic tone on a Product pitch).`;

const WRITING_RULES = `WRITING RULES — NON-NEGOTIABLE:
- Never use "X isn't just Y, it's Z" or any close variant.
- Do not open with "Here's the thing", "Let's be honest", "The truth is", "Make no mistake".
- Do not put a rule-of-three list in every sentence.
- Vary sentence length on purpose within a slide.
- Banned words/phrases (no synonym-swapping the same filler): spearhead, testament, delve, leverage, synergy, paradigm, holistic, foster, streamline, beacon, pivotal, game-changer, meticulous, unlock (as buzzword), tapestry, landscape (as metaphor), "relevant experience", "proven track record", "fast learner", "passionate", "dynamic professional", "cutting-edge", "seamless experience", "results-driven", "detail-oriented".
- Every argument-bearing slide states one plain point of view in "pov" — a sentence that takes a side.
- At most one parenthetical aside per slide.
- Write like a specific person who has done the work, not a consultancy brochure.`;

function researchFacts(research) {
  if (!research || !research.text) {
    return {
      confidence: "none",
      block: `No verified data was retrievable for this company. Do NOT invent statistics, funding, headcounts, customers or dates. Reason from general industry patterns and keep every company-specific claim qualitative. The deck will be labelled to the reader as built from general patterns.`,
    };
  }
  const conf = (research.confidence || "low").toLowerCase();
  const guide =
    conf === "high"
      ? "Confidence HIGH — ground every company-specific claim in these facts; add no statistics not present here."
      : conf === "medium"
      ? "Confidence MEDIUM — use these facts for anything company-specific; stay qualitative where they are silent."
      : "Confidence LOW — treat any specific claim as provisional; invent no fake-precise numbers; use qualitative framing.";
  return { confidence: conf, block: `${guide}\n\n${research.promptText || research.text}` };
}

// ---------------------------------------------------------------- Step A: outline
export function buildOutlinePrompt({ company, context, role, tone, profile = {}, research = null }) {
  const r = ROLES[role] || ROLES["Consulting & Strategy"];
  const t = TONES[tone] || TONES.Strategic;
  const { block: facts } = researchFacts(research);
  const ach = (profile.achievements || []).map((s) => (s || "").trim()).filter(Boolean);

  return `You are a deck strategist. Before a single slide is written, decide the RIGHT SHAPE for THIS pitch.

A candidate wants ${company} to hire them for a ${role} role. They are not sending a résumé — they are sending a slide argument built around a specific gap they see at the company, backed by their own achievements.

# THE CANDIDATE
${profile.name || "(no name)"} — ${profile.education || "background n/a"}
Experience: ${profile.experience || "n/a"}
Skills: ${profile.skills || "n/a"}
Achievements (must appear verbatim later, on one proof slide):
${ach.map((a, i) => `  ${i + 1}. ${a}`).join("\n") || "  (none given)"}

# THE PITCH
Company: ${company}
Role lens: ${r.lens}
Their stated gap / argument: ${context || "(not stated — infer a specific, credible gap from the facts)"}

# VERIFIED FACTS ABOUT ${company}
${facts}

# TONE: ${tone}
${t.voice}

# YOUR JOB
Think about what THIS argument actually needs to land. What is the through-line? What has to be proven, and in what order, to move THIS company to hire THIS person? Then output an outline.

Rules:
- Between 5 and 14 slides. Pick the count the argument needs — a tight ${tone} pitch might be 6; a dense case might be 12. Do not pad.
- You are NOT filling a template. Do NOT default to the sequence "hook, context, diagnosis, opportunity, solution, evidence, roadmap, ask". Only include a slide if THIS pitch needs it. You may repeat a purpose (e.g. two consumer-insight slides), drop common ones, reorder freely, or invent a slide purpose.
- ${role} work ${r.visualLean}
- For each slide choose a "visual" from: ${VISUAL_KINDS.join(", ")}. Match it to the slide's job AND the tone. Push for visual variety across the deck — do not reuse the same kind on more than two slides unless the argument genuinely repeats a shape.
- If mood is "editorial": use ONLY "statement", "quote", "big_number", "moodboard", "step_flow", "intensity_bars", "donut_chart". Use "moodboard" at least once — it is a grid of graphic tiles that reads like an Instagram-carousel or brand-deck visual, exactly the feel a creative pitch needs. Do NOT use "matrix_2x2", "comparison_table", "phase_plan" or a slide literally titled "framework" — 2x2s and quadrant frameworks read as a consulting deck, which is exactly what a creative pitch must not be.
- If mood is "infographic": most slides should carry a structured visual ("comparison_table", "matrix_2x2", "phase_plan", "metric_callout", "intensity_bars", "timeline", "donut_chart"). Use "donut_chart" wherever the point is a share/percentage breakdown (market share, budget split, funnel composition) — a real chart lands harder than a table.
- Never put a data table on a slide making a purely emotional or narrative point.
- Exactly ONE slide is the proof slide and it MUST use visual "mapping_table" (candidate achievement -> company problem -> day-1 deliverable). Give it a purpose/type of your choosing.
- ${MOODS}

# OUTPUT — ONE JSON OBJECT, NOTHING ELSE
{
  "mood": "editorial" | "infographic" | "balanced",
  "argument": "1-2 sentences: the through-line this deck proves",
  "keyFacts": ["3-5 short verified facts from above that this deck will actually use"],
  "slides": [
    { "purpose": "<=8 words, what this slide does", "type": "<one-word slug>", "visual": "<one kind from the list>", "why": "<=14 words: why this slide, here, in this shape" }
  ]
}`;
}

// ---------------------------------------------------------------- Step B: content
export function buildContentPrompt({ company, context, role, tone, profile = {}, research = null, outline }) {
  const r = ROLES[role] || ROLES["Consulting & Strategy"];
  const t = TONES[tone] || TONES.Strategic;
  const ach = (profile.achievements || []).map((s) => (s || "").trim()).filter(Boolean);
  const keyFacts = Array.isArray(outline?.keyFacts) && outline.keyFacts.length
    ? outline.keyFacts.map((f) => `- ${f}`).join("\n")
    : researchFacts(research).block;
  const n = outline.slides.length;
  const outlineList = outline.slides
    .map((s, i) => `${i + 1}. [${s.type}] ${s.purpose} — visual: ${s.visual}${s.why ? `  (${s.why})` : ""}`)
    .join("\n");

  return `You are ghost-writing a job-pitch deck for ${company}. The SHAPE of this deck was already decided for this specific pitch (below). Write the full content for it — this exact outline, this exact order, ${n} slides, no more, no less.

# THE CANDIDATE
Name: ${profile.name || "(not given)"}
Education / background: ${profile.education || "(not given)"}
Experience: ${profile.experience || "(not given)"}
Core skills: ${profile.skills || "(not given)"}

# THE TARGET
Company: ${company}
Role: ${role} — analyse through ${r.lens}. Vocabulary to work in: ${r.vocabulary}. ${r.forbiddenFocus}
The candidate's stated gap: ${context || "(inferred from the facts)"}

# VERIFIED FACTS — the only company-specific facts you may state as fact
${keyFacts}
If you need a specific number that is not here, mark it as an estimate ("~", basis:"estimate"). Never state an invented fact as certain.

# TONE: ${tone} — this governs the ACTUAL SENTENCES, not just styling
${t.voice}
Headline style: ${t.headline}
Aim for this register — sample headline: "${t.sampleHeadline}"
Sample body in this voice: "${t.sampleBody}"
Every headline and every body paragraph in your output must sound like that sample, not like a neutral business memo (unless the tone IS Corporate).

# DECK MOOD: ${outline.mood || "balanced"} — ${outline.mood === "editorial" ? "big type, sparse copy, expressive; most slides carry little or no data" : outline.mood === "infographic" ? "dense, structured, many labelled parts; most slides carry a data visual" : "a deliberate mix of expressive and structured slides"}

# THE OUTLINE FOR THIS DECK (follow exactly)
${outlineList}

# ACHIEVEMENTS — REPRODUCE VERBATIM on the mapping_table slide
${ach.map((a, i) => `  ${i + 1}. ${a}`).join("\n") || "  (none supplied)"}
On the slide whose visual is "mapping_table", each row's "achievement" field MUST be one of these lines copied word for word (you may drop a trailing period only). Map each to a real ${company} problem and a specific day-1 deliverable for THAT pairing. Never paraphrase an achievement anywhere in the deck.

# ${WRITING_RULES}

# NUMBERS RULE — every "stats" value and every intensity_bars / metric_callout "value"
A concrete figure only: a %, a count, a currency amount, a ratio, a multiple, or a time period ("~38% YoY", "12 of 40 cities", "₹1.3L/mo", "3.1x", "90 days"). 1–4 words. NEVER a bare adjective ("Rising", "High", "Strong"). If not from the verified facts: estimate it, round with "~", set basis:"estimate".

# VISUAL FIELD SHAPES (build the kind the outline assigned; fill it, don't leave it half-empty)
- statement: { "lines": ["3-8 word line", ...] }  (2-4 lines, for a pull-quote / manifesto slide)
- quote: { "text": "the line", "attribution": "who or what" }
- big_number: { "value": "<figure>", "label": "<=6 words", "sub": "<=10 words" }
- moodboard: { "swatches":[{ "icon"(Material Symbol name), "label"(<=4 words) }] }  (3-4 tiles — graphic, colour-block "photo" tiles; label each with the mood/theme it captures, not a data point)
- donut_chart: { "caption", "segments":[{ "label", "pct"(a number 0-100, all segments should sum to ~100) }] }  (2-4 segments, first segment is the headline share)
- intensity_bars: { "caption", "items":[{ "label", "level":1-5, "value(has a digit)", "note" }] }  (3-4 items, same unit)
- comparison_table: { "caption", "columns":[..≤3..], "rows":[[..]] }  (3-4 rows, row length == columns)
- matrix_2x2: { "xLabel"(2-3 words), "yLabel"(2-3 words), "quadrants":[{ "label"(what sits here, not "top-left"), "note", "items":[≤2] }] }  (exactly 4, reading order; every quadrant gets an item — a real competitor or "(open)")
- timeline: { "caption", "phases":[{ "marker", "title", "points":[≤2] }] }  (3 phases)
- step_flow: { "caption", "steps":[{ "label", "text" }] }  (3-4 steps)
- metric_callout: { "caption", "metrics":[{ "value", "label", "delta" }] }  (2-3)
- mapping_table: { "rows":[{ "problem", "achievement", "deliverable" }] }  (3 rows)
- phase_plan: { "phases":[{ "window", "focus", "actions":[≤3] }] }  (3 phases)

# OUTPUT — ONE JSON OBJECT, NOTHING ELSE, well under 3800 tokens
{
  "meta": { "company", "role", "tone", "mood", "thesis": "<the through-line>" },
  "slides": [   // exactly ${n}, matching the outline order
    {
      "type": "<the outline slug>",
      "purpose": "<the outline purpose>",
      "banner": "<=5 words, UPPERCASE strip label",
      "headline": "<in the ${tone} voice, per headline style>",
      "body": "<2-3 sentences in the ${tone} voice>",
      "pov": "<one point-of-view sentence; may be '' on a pure-narrative slide>",
      "stats": [ { "value", "label"(<=5 words, no '|'), "icon"(Material Symbol name), "basis"("research"|"estimate") } ],
        // 0 to 2 stats. Use 0 on editorial / narrative / statement slides. NUMBERS RULE applies.
      "visual": { "kind": "<the outline's visual>", ...fields for that kind... }
    }
  ]
}`;
}

// ---------------------------------------------------------------- JSON hygiene
function repairTruncatedJson(s) {
  let str = s;
  const lastQuote = str.lastIndexOf('"');
  if ((str.match(/"/g) || []).length % 2 === 1) str = str.slice(0, lastQuote);
  str = str.replace(/,\s*$/, "");
  const stack = [];
  let inStr = false, esc = false;
  for (const ch of str) {
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    else if (!inStr && (ch === "{" || ch === "[")) stack.push(ch);
    else if (!inStr && (ch === "}" || ch === "]")) stack.pop();
  }
  while (stack.length) str += stack.pop() === "{" ? "}" : "]";
  return str;
}
function safeJsonParse(raw) {
  if (!raw) throw new Error("empty model response");
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  for (const cand of [s, a !== -1 && b > a ? s.slice(a, b + 1) : s]) {
    try { return JSON.parse(cand); } catch { /* next */ }
  }
  if (a !== -1) {
    try { return JSON.parse(repairTruncatedJson(s.slice(a))); } catch { /* give up */ }
  }
  throw new Error("could not parse JSON from model response");
}

function cleanText(s) {
  return String(s == null ? "" : s)
    .replace(/[‐‑]/g, "-")
    .replace(/[    ]/g, " ")
    .replace(/\s+\|\s+/g, " — ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
function deepClean(node) {
  if (typeof node === "string") return cleanText(node);
  if (Array.isArray(node)) return node.map(deepClean);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = deepClean(node[k]);
    return out;
  }
  return node;
}

// ---------------------------------------------------------------- coerce (order-agnostic)
function coerceDeck(parsed, outline) {
  let slides = Array.isArray(parsed) ? parsed : parsed.slides || [];
  // drop empty shells (no headline and no body)
  slides = slides.filter((s) => s && (String(s.headline || "").trim() || String(s.body || "").trim()));
  if (slides.length < 5) throw new Error(`content step produced only ${slides.length} usable slides`);
  const target = Math.min(Math.max(outline?.slides?.length || slides.length, 5), 14);
  slides = slides.slice(0, target);

  const ordered = slides.map((s, i) => {
    const plan = outline?.slides?.[i] || {};
    return {
      type: cleanText(s.type || plan.type || `slide-${i + 1}`),
      purpose: cleanText(s.purpose || plan.purpose || ""),
      banner: cleanText(s.banner || plan.purpose || s.type || `Slide ${i + 1}`),
      headline: cleanText(s.headline || ""),
      body: cleanText(s.body || ""),
      pov: cleanText(s.pov || ""),
      stats: (Array.isArray(s.stats) ? s.stats.slice(0, 2) : []).map((st) => ({
        value: cleanText(st && st.value != null ? st.value : ""),
        label: cleanText(st && st.label != null ? st.label : "").replace(/\s*—\s*/g, " "),
        icon: st && st.icon ? st.icon.toString().trim() : "",
        basis: st && st.basis ? st.basis.toString() : "",
      })).filter((st) => st.value),
      visual:
        s.visual && s.visual.kind
          ? deepClean(s.visual)
          : plan.visual
          ? { kind: plan.visual }
          : { kind: "statement", lines: [] },
    };
  });
  const meta = deepClean(parsed.meta || {});
  // the outline's mood is the source of truth (already validated + lowercased)
  meta.mood = (outline?.mood || meta.mood || "balanced").toString().toLowerCase();
  if (!["editorial", "infographic", "balanced"].includes(meta.mood)) meta.mood = "balanced";
  return { meta, slides: ordered };
}

// ---------------------------------------------------------------- verbatim + stats checks
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[‘’']/g, "'")
    .replace(/[‐-―−]/g, "-")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function evidenceSlide(deck) {
  return (
    deck.slides.find((s) => s.visual && s.visual.kind === "mapping_table") ||
    deck.slides.find((s) => /evidence|proof|fit|why.?me|track/i.test(s.type + " " + s.purpose))
  );
}
function snapAchievementsVerbatim(deck, achievements) {
  const rows = evidenceSlide(deck)?.visual?.rows;
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const a = norm(row.achievement);
    const exact = achievements.find((p) => norm(p) === a);
    if (exact && exact !== row.achievement) row.achievement = exact;
  }
}
function checkVerbatim(deck, achievements) {
  const w = [];
  const provided = achievements.map(norm).filter(Boolean);
  if (!provided.length) return w;
  const rows = evidenceSlide(deck)?.visual?.rows || [];
  if (!rows.length) return ["no mapping_table / proof slide with rows was produced"];
  rows.forEach((row, i) => {
    const a = norm(row.achievement);
    if (!provided.some((p) => p === a || p.includes(a) || a.includes(p)))
      w.push(`proof row ${i + 1} achievement is not verbatim: "${row.achievement}"`);
  });
  return w;
}
const ADJECTIVE_STAT =
  /^(rising|falling|growing|declining|shrinking|high|higher|low|lower|strong|stronger|weak|weaker|moderate|significant|substantial|major|minor|scalable|proven|validated|verified|untapped|stable|steady|emerging|limited|robust|solid|healthy|poor|mixed|positive|negative|good|bad|yes|no|n\/?a|tbd|unknown|various|multiple|several|many|few)$/i;
function checkStats(deck) {
  const w = [];
  for (const s of deck.slides) {
    for (const st of s.stats || []) {
      const val = (st.value || "").trim();
      if (!val) continue;
      if (!/\d|%|₹|\$|x\b/i.test(val) && (ADJECTIVE_STAT.test(val) || val.split(/\s+/).length <= 2))
        w.push(`slide "${s.type}" stat "${val}" is not a concrete figure`);
    }
    if (s.visual?.kind === "intensity_bars")
      for (const it of s.visual.items || []) {
        const v = (it.value || "").toString().trim();
        if (v && !/\d/.test(v)) w.push(`slide "${s.type}" bar "${it.label}" value "${v}" has no number`);
      }
  }
  return w;
}

// ---------------------------------------------------------------- Groq call w/ retry
async function groqJSON({ apiKey, model, system, user, temperature, maxTokens, label }) {
  const body = JSON.stringify({
    model,
    temperature,
    max_tokens: maxTokens,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
    });
    if (res.ok) {
      const payload = await res.json();
      return safeJsonParse(payload?.choices?.[0]?.message?.content ?? "");
    }
    const detail = await res.text().catch(() => "");
    // tokens-per-DAY cap won't clear for hours — fail fast to the offline placeholder
    if (res.status === 429 && /per day|\bTPD\b/i.test(detail)) {
      throw new Error(`Groq ${label} failed (429, daily token limit reached — resets in ~24h)`);
    }
    if (res.status === 429 && attempt < 2) {
      const m = detail.match(/try again in ([\d.]+)s/i);
      const wait = Math.min(m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : 12000, 30000);
      console.warn(`[${label}] 429 — waiting ${wait}ms then retry ${attempt + 1}/2`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 400 && /json_validate_failed/.test(detail)) {
      // only accept a salvaged partial if it is actually substantial
      try {
        const failed = JSON.parse(detail)?.error?.failed_generation || "";
        const recovered = safeJsonParse(failed);
        const enough =
          recovered &&
          ((Array.isArray(recovered.slides) && recovered.slides.filter((s) => s && (s.headline || s.body)).length >= 5) ||
            (Array.isArray(recovered.slides) && recovered.slides.length >= 5 && label === "outline"));
        if (enough) {
          console.warn(`[${label}] recovered a usable partial from failed_generation`);
          return recovered;
        }
      } catch { /* not salvageable */ }
      if (attempt < 2) {
        console.warn(`[${label}] json_validate_failed — retry ${attempt + 1}/2`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
    }
    throw new Error(`Groq ${label} failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  throw new Error(`Groq ${label} failed after retries`);
}

function normalizeOutline(o) {
  let slides = Array.isArray(o?.slides) ? o.slides : [];
  slides = slides
    .filter((s) => s && (s.purpose || s.type))
    .slice(0, 14)
    .map((s, i) => ({
      purpose: cleanText(s.purpose || s.type || `Slide ${i + 1}`),
      type: cleanText((s.type || s.purpose || `slide-${i + 1}`).toString().toLowerCase().split(/\s+/)[0]),
      visual: VISUAL_KINDS.includes(s.visual) ? s.visual : "statement",
      why: cleanText(s.why || ""),
    }));
  if (slides.length < 5) throw new Error(`outline too short (${slides.length} slides)`);
  // guarantee exactly one mapping_table (proof) slide
  let proofIdx = slides.findIndex((s) => s.visual === "mapping_table");
  if (proofIdx === -1) {
    const guess = slides.findIndex((s) => /proof|evidence|fit|why|track/i.test(s.type + s.purpose));
    proofIdx = guess !== -1 ? guess : Math.max(0, slides.length - 2);
    slides[proofIdx].visual = "mapping_table";
  } else {
    slides.forEach((s, i) => { if (i !== proofIdx && s.visual === "mapping_table") s.visual = "comparison_table"; });
  }

  const mood = ["editorial", "infographic", "balanced"].includes(String(o?.mood || "").toLowerCase())
    ? String(o.mood).toLowerCase()
    : "balanced";

  // Editorial decks must not read like a consulting case — swap business-school visuals for
  // expressive ones on every slide except the mandatory proof slide.
  if (mood === "editorial") {
    const consulting = new Set(["matrix_2x2", "comparison_table", "phase_plan", "metric_callout"]);
    const swap = ["statement", "moodboard", "step_flow", "big_number", "quote", "donut_chart"];
    slides.forEach((s, i) => {
      if (i !== proofIdx && consulting.has(s.visual)) s.visual = swap[i % swap.length];
    });
  }

  return { mood, argument: cleanText(o?.argument || ""), keyFacts: (o?.keyFacts || []).map(cleanText).filter(Boolean), slides };
}

// Step A only — exported for previews / verification.
export async function outlineOnly(input) {
  const { company, context, role, tone, profile = {}, research = null } = input;
  const apiKey = process.env.GROQ_API_KEY;
  const prompt = buildOutlinePrompt({ company, context, role, tone, profile, research });
  if (!apiKey) return { ...offlineOutline(role, tone), offline: true };
  const raw = await groqJSON({
    apiKey, model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    system: prompt, user: `Outline only for this ${tone} ${role} pitch to ${company}. JSON.`,
    temperature: 0.6, maxTokens: 2200, label: "outline",
  });
  return normalizeOutline(raw);
}

// ---------------------------------------------------------------- main
export async function generateDeck(input) {
  const { company, context, role, tone, profile = {}, research = null } = input;
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const t = TONES[tone] || TONES.Strategic;
  const achievements = (profile.achievements || []).map((s) => (s || "").trim()).filter(Boolean);

  const outlinePrompt = buildOutlinePrompt({ company, context, role, tone, profile, research });

  if (!apiKey) {
    const { outline, deck } = offlineDeck(input);
    return { ...deck, outline, outlinePrompt, contentPrompt: buildContentPrompt({ ...input, outline }),
      model: "offline-mock", offline: true, offlineReason: "no_api_key",
      researchConfidence: research?.confidence || "none", achievementsProvided: achievements,
      warnings: ["GROQ_API_KEY is not set — this is a locally assembled placeholder, not model-written copy."] };
  }

  try {
    // ---- Step A: outline
    console.log("\n================ STEP A — OUTLINE PROMPT ================\n" + outlinePrompt + "\n");
    const rawOutline = await groqJSON({
      apiKey, model, system: outlinePrompt,
      user: `Decide the outline for this ${tone} ${role} pitch to ${company}. JSON only.`,
      temperature: 0.6, maxTokens: 2200, label: "outline",
    });
    const outline = normalizeOutline(rawOutline);
    console.log(`[outline] ${outline.slides.length} slides, mood=${outline.mood}`);
    outline.slides.forEach((s, i) => console.log(`  ${i + 1}. [${s.type}] ${s.purpose} — ${s.visual}`));

    // ---- Step B: content for THAT outline (retry once if it comes back short/broken)
    const contentPrompt = buildContentPrompt({ company, context, role, tone, profile, research, outline });
    console.log("\n================ STEP B — CONTENT PROMPT ================\n" + contentPrompt + "\n");
    let deck;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const rawDeck = await groqJSON({
        apiKey, model, system: contentPrompt,
        user: `Write all ${outline.slides.length} slides for the outline above, in the ${tone} voice. Every slide needs a headline and a body. JSON only.`,
        temperature: t.temperature, maxTokens: 20000, label: "content",
      });
      try {
        deck = coerceDeck(rawDeck, outline);
        break;
      } catch (e) {
        console.warn(`[content] ${e.message} — ${attempt < 2 ? "retrying" : "giving up"}`);
        if (attempt >= 2) throw e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    snapAchievementsVerbatim(deck, achievements);
    const warnings = [...checkVerbatim(deck, achievements), ...checkStats(deck)];
    if (warnings.length) console.warn("[generate] warnings:", warnings);

    return {
      ...deck, outline, outlinePrompt, contentPrompt,
      model, offline: false, offlineReason: null,
      researchConfidence: research?.confidence || "none",
      achievementsProvided: achievements, warnings,
    };
  } catch (err) {
    console.error("[generate] falling back to offline deck:", err.message);
    const { outline, deck } = offlineDeck(input);
    return { ...deck, outline, outlinePrompt, contentPrompt: buildContentPrompt({ ...input, outline }),
      model: "offline-mock", offline: true, offlineReason: "api_error",
      researchConfidence: research?.confidence || "none", achievementsProvided: achievements,
      warnings: [`AI request failed (${err.message}). Showing a local placeholder — try again in a minute.`] };
  }
}

// ---------------------------------------------------------------- offline (no key / api error)
// Still varies its shape by role + tone so the "dynamic outline" behaviour is visible offline.
function offlineOutline(role, tone) {
  const editorial = ["Creative", "Playful", "Bold"].includes(tone) &&
    ["Marketing & Brand", "Product Design & UX"].includes(role);
  const mood = editorial ? "editorial" : ["Analytical", "Corporate"].includes(tone) ? "infographic" : "balanced";
  const base = editorial
    ? [
        ["open on the tension", "hook", "statement"],
        ["the cultural read", "insight", "quote"],
        ["what the brand is missing", "insight", "statement"],
        ["the idea", "concept", "big_number"],
        ["why me — proof", "proof", "mapping_table"],
        ["make it real in 90 days", "roadmap", "phase_plan"],
        ["the ask", "ask", "statement"],
      ]
    : mood === "infographic"
    ? [
        ["frame the gap", "hook", "big_number"],
        ["situation, in numbers", "context", "metric_callout"],
        ["diagnosis", "diagnosis", "matrix_2x2"],
        ["what it costs / unlocks", "opportunity", "comparison_table"],
        ["the approach", "solution", "step_flow"],
        ["driver sensitivity", "analysis", "intensity_bars"],
        ["why me — proof", "proof", "mapping_table"],
        ["90-day plan", "roadmap", "phase_plan"],
        ["the ask", "ask", "metric_callout"],
      ]
    : [
        ["the gap", "hook", "intensity_bars"],
        ["why now", "context", "comparison_table"],
        ["diagnosis", "diagnosis", "matrix_2x2"],
        ["the opening", "opportunity", "step_flow"],
        ["the plan", "solution", "timeline"],
        ["why me — proof", "proof", "mapping_table"],
        ["first 90 days", "roadmap", "phase_plan"],
        ["the ask", "ask", "step_flow"],
      ];
  return {
    mood,
    argument: `Close the ${role.toLowerCase()} gap the candidate identified, and prove they are the one to do it.`,
    keyFacts: [],
    slides: base.map(([purpose, type, visual]) => ({ purpose, type, visual, why: "" })),
  };
}

function offlineDeck(input) {
  const { company, context, role, tone, profile = {}, research = null } = input;
  const outline = offlineOutline(role, tone);
  const ach = (profile.achievements || []).map((s) => (s || "").trim()).filter(Boolean);
  const gap = context || `an unaddressed ${role.toLowerCase()} gap`;
  const first = (profile.name || "the candidate").split(" ")[0];
  const src = research ? research.promptText || research.text || "" : "";
  let fact = (src.split("\n").find((l) => /^WHAT IT IS:/i.test(l)) || "").replace(/^WHAT IT IS:\s*/i, "").trim();
  if (fact.length > 160) fact = fact.slice(0, 160).replace(/\s+\S*$/, "") + "…";
  const S = (value, label, basis = "estimate") => ({ value, label, basis });

  const byVisual = {
    statement: (p) => ({ kind: "statement", lines: [p.purpose.replace(/^\w/, (c) => c.toUpperCase()), `at ${company}.`, "This deck makes the case."] }),
    quote: () => ({ kind: "quote", text: gap, attribution: `${first}, on ${company}` }),
    big_number: () => ({ kind: "big_number", value: `${ach.length || 3}`, label: "proof points on the table", sub: "each mapped to a company problem" }),
    intensity_bars: () => ({ kind: "intensity_bars", caption: "Where the gap bites", items: [
      { label: "Cost of inaction", level: 4, value: "~4/5", note: "compounds each quarter" },
      { label: "Ease of first fix", level: 3, value: "~3/5", note: "scoped for 30 days" },
      { label: "Owned internally today", level: 2, value: "~2/5", note: "under-owned" }] }),
    comparison_table: () => ({ kind: "comparison_table", caption: "Now vs. the gap", columns: ["Area", "Today", "This gap"],
      rows: [["Ownership", "Clear", "Unclear"], ["Measurement", "Tracked", "Not instrumented"], ["Urgency", "Assumed stable", "Degrading"]] }),
    matrix_2x2: () => ({ kind: "matrix_2x2", xLabel: "Effort to fix", yLabel: "Impact if fixed", quadrants: [
      { label: "Do first", note: "high impact / low effort", items: ["The primary lever"] },
      { label: "Plan for", note: "high impact / high effort", items: ["Structural change"] },
      { label: "Automate", note: "low impact / low effort", items: ["Housekeeping"] },
      { label: "Ignore", note: "low impact / high effort", items: ["(open)"] }] }),
    timeline: () => ({ kind: "timeline", caption: "How it rolls out", phases: [
      { marker: "A", title: "Scope", points: ["Pick the narrow first fix", "Agree one metric"] },
      { marker: "B", title: "Prove", points: ["Ship it", "Show the metric move"] },
      { marker: "C", title: "Widen", points: ["Extend to adjacent areas", "Hand off"] }] }),
    step_flow: () => ({ kind: "step_flow", caption: "The sequence", steps: [
      { label: "Step 1", text: "Close the primary gap" },
      { label: "Step 2", text: "Instrument it so it stays closed" },
      { label: "Step 3", text: "Redeploy the freed capacity" }] }),
    metric_callout: () => ({ kind: "metric_callout", caption: "The shape of the prize", metrics: [
      { value: "~30 days", label: "to first signal", delta: "" },
      { value: "1", label: "metric that proves it", delta: "" },
      { value: "90 days", label: "to a decision", delta: "" }] }),
    mapping_table: () => ({ kind: "mapping_table", rows: (ach.length ? ach : ["(add achievements in The Brief)"]).slice(0, 3).map((a, i) => ({
      problem: [`${company} has no clear owner for this gap`, `The gap is not measured`, `Past attempts stalled after launch`][i] || `Open problem ${i + 1}`,
      achievement: a,
      deliverable: [`A one-page owner + metric definition, circulated day 1`, `A live dashboard for the proof metric by end of week 1`, `A post-launch adoption plan so the fix sticks`][i] || `A scoped first deliverable tied to: ${a}` })) }),
    phase_plan: () => ({ kind: "phase_plan", phases: [
      { window: "Days 0-30", focus: "Baseline the gap", actions: ["Confirm the driver", "Define one metric", "Line up owners"] },
      { window: "Days 31-60", focus: "Ship the first fix", actions: ["Deliver the narrow fix", "Stand up measurement"] },
      { window: "Days 61-90", focus: "Widen & hand off", actions: ["Extend to adjacent area", "Transfer ownership"] }] }),
  };

  const slides = outline.slides.map((p, i) => {
    const isProof = p.visual === "mapping_table";
    return {
      type: p.type,
      purpose: p.purpose,
      banner: p.purpose.slice(0, 40).toUpperCase(),
      headline: isProof
        ? `Why ${first} specifically`
        : i === 0
        ? `${company} is leaving ${role.split(" ")[0].toLowerCase()} value on the table`
        : `${p.purpose.replace(/^\w/, (c) => c.toUpperCase())}`,
      body: i === 0
        ? `${profile.name || "The candidate"} sees a specific opening at ${company}: ${gap}.${fact ? ` Current read: ${fact}.` : ""}`
        : isProof
        ? `Each ${company} problem below is matched to something ${first} has actually done, and to a week-one deliverable.`
        : `This slide (${p.purpose}) is placeholder copy — a real key would have the model write it in the ${tone} voice.`,
      pov: isProof ? `The match between the problem and the track record is the pitch.` : `This is a now problem, not a someday problem.`,
      stats: outline.mood === "editorial" && !isProof
        ? []
        : [S(`${ach.length || 3}`, "proof points on the table"), S(`${research?.newsCount ?? 0}`, "sources cross-checked", "research")],
      visual: (byVisual[p.visual] || byVisual.statement)(p),
    };
  });

  return { outline, deck: { meta: { company, role, tone, mood: outline.mood, thesis: `Close ${gap} at ${company}.` }, slides } };
}

// ---------------------------------------------------------------- HTTP
export default async function handler(req, res) {
  const user = await requireCreditsAndSpend(req, res);
  if (!user) return;
  try {
    const { company, context, role, tone, profile, research } = req.body || {};
    if (!company || company.toString().trim().length < 2)
      return res.status(400).json({ error: "Missing or invalid company." });
    const deck = await generateDeck({
      company: company.toString(),
      context: (context || "").toString(),
      role: role || "Consulting & Strategy",
      tone: tone || "Strategic",
      profile: profile || {},
      research: research || null,
    });
    // A Groq outage/rate-limit falls back to an offline placeholder rather than throwing —
    // don't charge a real credit for that.
    if (deck.offline) await refundCredit(user.id);
    res.status(200).json(deck);
  } catch (err) {
    console.error("[/api/generate]", err);
    await refundCredit(user.id);
    res.status(err.status || 500).json({ error: err.message || "Generation failed" });
  }
}

// Optional standalone outline endpoint (Step A only) — handy for previewing deck shape.
export async function outlineHandler(req, res) {
  if (!(await requireAuth(req, res))) return;
  try {
    const { company, context, role, tone, profile, research } = req.body || {};
    if (!company || company.toString().trim().length < 2)
      return res.status(400).json({ error: "Missing or invalid company." });
    const apiKey = process.env.GROQ_API_KEY;
    const prompt = buildOutlinePrompt({ company, context: context || "", role: role || "Consulting & Strategy", tone: tone || "Strategic", profile: profile || {}, research: research || null });
    if (!apiKey) return res.status(200).json({ ...offlineOutline(role || "Consulting & Strategy", tone || "Strategic"), offline: true });
    const raw = await groqJSON({
      apiKey, model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      system: prompt, user: `Outline only. JSON.`, temperature: 0.6, maxTokens: 2200, label: "outline",
    });
    res.status(200).json(normalizeOutline(raw));
  } catch (err) {
    console.error("[/api/outline]", err);
    res.status(500).json({ error: err.message });
  }
}
