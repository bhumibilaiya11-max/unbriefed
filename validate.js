/* Shared input validation — ES module, imported by app.js (browser) and _verify.mjs (Node).
 * Blocks generation before any AI call when the company looks like gibberish or the achievements
 * look like placeholders. */

const MASH = [
  "qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop",
  "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl",
  "zxcv", "xcvb", "cvbn", "vbnm", "poiu", "lkjh", "mnbv", "qazwsx",
];

export function validateCompany(raw) {
  const t = (raw || "").trim();
  if (t.length < 2) return "Enter the company you're targeting.";
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length < 2 && !/\d/.test(t)) return "That doesn't look like a real company name.";
  if (/^(.)\1+$/i.test(t.replace(/\s+/g, ""))) return "That doesn't look like a real company name.";
  if (/(.)\1{4,}/i.test(t)) return "That looks like keyboard noise, not a company.";
  const low = t.toLowerCase();
  if (MASH.some((m) => low.includes(m))) return "That looks like keyboard noise, not a company.";
  if (letters.length >= 4 && !/[aeiou]/i.test(letters)) return "That doesn't look like a real company name.";
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(letters)) return "That doesn't look like a real company name.";
  if (letters.length >= 6 && new Set(letters.toLowerCase()).size <= 2) return "That doesn't look like a real company name.";
  return "";
}

const PLACEHOLDER = /^(n\/?a|none|nil|null|tbd|todo|xxx+|test+|testing|asdf+|qwer+|lorem(\s+ipsum)?|placeholder|abc+|foo|bar|baz|\.+|-+|\d+)$/i;

export function validateAchievements(raw) {
  const lines = (raw || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return "Add at least one real achievement — one per line.";
  const meaningful = lines.filter(
    (l) => !PLACEHOLDER.test(l) && l.replace(/[^a-z0-9]/gi, "").length >= 8
  );
  if (!meaningful.length) return "These read as placeholders. Add specific proof points — numbers, outcomes, scope.";
  if (meaningful.join("").length < 24) return "Add more detail to your achievements so they can stand on a slide.";
  return "";
}
