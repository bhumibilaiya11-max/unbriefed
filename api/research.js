// Stage 1 — Research.
// Multi-source, free, no API key: Wikipedia REST + Google News RSS + DuckDuckGo Instant Answer.
// Cross-references the three, scores confidence, and returns a grounding dossier that Stage 2
// (generation) receives verbatim as the ONLY source of company-specific fact.

const CACHE = new Map(); // company(lower) -> { at, data }
const CACHE_TTL_MS = 60 * 60 * 1000;

const UA =
  "UnbriefedResearchBot/1.0 (github.com/unbriefed; educational pitch-deck generator)";

function timeoutSignal(ms) {
  // Node 18+/22 has AbortSignal.timeout, but guard anyway.
  try {
    return AbortSignal.timeout(ms);
  } catch {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), ms);
    return ac.signal;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, retries = 1) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: timeoutSignal(9000),
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(450 * (attempt + 1));
      continue;
    }
    throw new Error(`${url} -> ${res.status}`);
  }
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: timeoutSignal(9000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function decodeEntities(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// ---------- Source 1: Wikipedia ----------
// Two calls total: one search, then one batched extract for the top candidate titles.
function usableExtract(p) {
  if (!p || p.missing !== undefined) return false;
  if (p.pageprops && p.pageprops.disambiguation !== undefined) return false;
  if (!p.extract || p.extract.length < 120) return false;
  if (/\bmay refer to:|\bcommonly refers to\b/i.test(p.extract)) return false;
  return true;
}

async function wikipedia(company) {
  const out = { extract: "", title: "", url: "", ok: false };
  const first = company.split(/\s+/)[0].toLowerCase();

  let searchTitles = [];
  try {
    const search = await getJSON(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
        company
      )}&limit=6`
    );
    searchTitles = (search?.pages || [])
      .map((p) => p.title)
      .filter((t) => !/disambiguation/i.test(t));
  } catch {
    /* fall through to guessed titles */
  }

  const candidates = [];
  const seen = new Set();
  for (const t of [company, `${company} (company)`, ...searchTitles]) {
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      candidates.push(t);
    }
  }
  const top = candidates
    .sort((a, b) => {
      const am = a.toLowerCase().includes(first) ? 0 : 1;
      const bm = b.toLowerCase().includes(first) ? 0 : 1;
      return am - bm;
    })
    .slice(0, 4);
  if (!top.length) return out;

  let pages = {};
  try {
    const data = await getJSON(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info|pageprops&inprop=url&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(
        top.join("|")
      )}`
    );
    pages = data?.query?.pages || {};
  } catch {
    return out;
  }

  // Preserve the ranked order of `top` when choosing among returned pages.
  const byTitle = new Map(
    Object.values(pages).map((p) => [(p.title || "").toLowerCase(), p])
  );
  const ranked = [
    ...top.map((t) => byTitle.get(t.toLowerCase())).filter(Boolean),
    ...Object.values(pages),
  ];
  for (const p of ranked) {
    if (usableExtract(p)) {
      out.extract = p.extract.replace(/\s+\n/g, "\n").trim().slice(0, 2200);
      out.title = p.title;
      out.url =
        p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`;
      out.ok = true;
      break;
    }
  }
  return out;
}

// ---------- Source 2: Google News RSS ----------
async function googleNews(company) {
  const xml = await getText(
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      `"${company}"`
    )}%20when:270d&hl=en-US&gl=US&ceid=US:en`
  );
  const items = [];
  const blocks = xml.split(/<item>/).slice(1);
  for (const b of blocks.slice(0, 12)) {
    const title = decodeEntities((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = decodeEntities((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pub = decodeEntities((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    const source = decodeEntities((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "");
    if (!title) continue;
    let date = "";
    const d = new Date(pub);
    if (!isNaN(d)) date = d.toISOString().slice(0, 10);
    items.push({ title, link, date, source });
  }
  return items;
}

// ---------- Source 3: DuckDuckGo Instant Answer ----------
async function duckduckgo(company) {
  const data = await getJSON(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(
      company
    )}&format=json&no_html=1&skip_disambig=1&t=unbriefed`
  );
  const abstract = (data.AbstractText || "").trim();
  const related = (data.RelatedTopics || [])
    .map((t) => (t && t.Text ? t.Text.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
  return {
    abstract,
    url: data.AbstractURL || "",
    heading: data.Heading || "",
    related,
    ok: !!(abstract || related.length),
  };
}

function scoreConfidence({ wiki, news, ddg }) {
  let score = 0;
  if (wiki.ok && wiki.extract.length > 400) score += 3;
  else if (wiki.ok) score += 2;
  if (news.length >= 4) score += 2;
  else if (news.length >= 1) score += 1;
  if (ddg.ok && ddg.abstract.length > 120) score += 2;
  else if (ddg.ok) score += 1;

  let level = "low";
  if (score >= 5) level = "high";
  else if (score >= 3) level = "medium";
  return { score, level, found: score >= 3 };
}

function buildDossier(company, { wiki, news, ddg }, conf) {
  // Full version — shown in the UI's research panel (with source links).
  const L = [];
  L.push(`=== RESEARCH DOSSIER: ${company} ===`);
  L.push(`RETRIEVED: ${new Date().toISOString()}`);
  L.push(`CONFIDENCE: ${conf.level.toUpperCase()} (source score ${conf.score}/7)`);
  L.push("");
  L.push("[ENCYCLOPEDIC — Wikipedia]");
  L.push(wiki.ok ? `${wiki.title}: ${wiki.extract}` : "No usable encyclopedic entry found.");
  L.push("");
  L.push("[RECENT NEWS — Google News, rolling ~9 months]");
  if (news.length) for (const n of news) L.push(`- ${n.date || "undated"} — ${n.title}${n.source ? ` (${n.source})` : ""}`);
  else L.push("No recent news items retrieved.");
  L.push("");
  L.push("[WEB SUMMARY — DuckDuckGo]");
  L.push(ddg.abstract || "No web abstract available.");
  if (ddg.related.length) { L.push("Related:"); for (const r of ddg.related) L.push(`- ${r}`); }
  L.push("");

  const sources = [];
  if (wiki.url) sources.push({ type: "wikipedia", title: wiki.title, url: wiki.url });
  if (ddg.url) sources.push({ type: "web", title: ddg.heading || "DuckDuckGo", url: ddg.url });
  for (const n of news.slice(0, 6)) if (n.link) sources.push({ type: "news", title: n.title, url: n.link });
  L.push("[SOURCES]");
  if (sources.length) for (const s of sources) L.push(`- (${s.type}) ${s.url}`);
  else L.push("None resolved.");

  // Compact version — this is what the generation model actually receives (no URLs, capped).
  const P = [];
  P.push(`RESEARCH DOSSIER: ${company} — confidence ${conf.level.toUpperCase()} (${conf.score}/7)`);
  P.push(`WHAT IT IS: ${wiki.ok ? wiki.extract.slice(0, 1100) : "no encyclopedic entry found"}`);
  if (news.length) {
    P.push("RECENT DEVELOPMENTS:");
    for (const n of news.slice(0, 6)) P.push(`- ${n.date || "recent"}: ${n.title}${n.source ? ` [${n.source}]` : ""}`);
  }
  if (ddg.abstract && ddg.abstract.slice(0, 40) !== (wiki.extract || "").slice(0, 40)) {
    P.push(`WEB SUMMARY: ${ddg.abstract.slice(0, 500)}`);
  }
  if (ddg.related.length) P.push(`ADJACENT / COMPETITORS: ${ddg.related.slice(0, 3).join(" · ").slice(0, 400)}`);

  return { text: L.join("\n"), promptText: P.join("\n"), sources };
}

export async function research(company) {
  const key = company.trim().toLowerCase();
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [wRes, nRes, dRes] = await Promise.allSettled([
    wikipedia(company),
    googleNews(company),
    duckduckgo(company),
  ]);

  const wiki = wRes.status === "fulfilled" ? wRes.value : { ok: false, extract: "", title: "", url: "" };
  const news = nRes.status === "fulfilled" ? nRes.value : [];
  const ddg = dRes.status === "fulfilled" ? dRes.value : { ok: false, abstract: "", related: [], url: "", heading: "" };

  const sourceStatus = {
    wikipedia: wRes.status === "fulfilled" ? (wiki.ok ? "hit" : "empty") : "error",
    googleNews: nRes.status === "fulfilled" ? (news.length ? "hit" : "empty") : "error",
    duckduckgo: dRes.status === "fulfilled" ? (ddg.ok ? "hit" : "empty") : "error",
  };

  const conf = scoreConfidence({ wiki, news, ddg });
  const { text, promptText, sources } = buildDossier(company, { wiki, news, ddg }, conf);

  const data = {
    company,
    found: conf.found,
    confidence: conf.level,
    score: conf.score,
    sourceStatus,
    newsCount: news.length,
    news: news.slice(0, 8),
    sources,
    text,
    promptText,
  };

  CACHE.set(key, { at: Date.now(), data });
  return data;
}

export default async function handler(req, res) {
  try {
    const company = (req.body?.company || "").toString().trim();
    if (company.length < 2) {
      return res.status(400).json({ error: "Company name too short to research." });
    }
    const t0 = Date.now();
    const data = await research(company);
    const ms = Date.now() - t0;

    // Server-side log so it's visibly running.
    console.log(
      `\n[RESEARCH] "${company}" -> confidence=${data.confidence} score=${data.score}/7 ` +
        `sources[wiki:${data.sourceStatus.wikipedia} news:${data.sourceStatus.googleNews}(${data.newsCount}) ` +
        `ddg:${data.sourceStatus.duckduckgo}] in ${ms}ms`
    );
    console.log(data.text);

    res.status(200).json({ ...data, elapsedMs: ms });
  } catch (err) {
    console.error("[/api/research]", err);
    res.status(500).json({ error: err.message || "Research failed" });
  }
}
