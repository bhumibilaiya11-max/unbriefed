// Resume parsing. The browser extracts raw text (pdf.js for PDF, plain read for txt/md) and
// posts it here; Groq structures it into the Brief's fields. Achievements are pulled out as
// discrete lines so they can later be reproduced verbatim on the evidence slide.

import { requireAuth } from "./_gate.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM = `You extract structured fields from a résumé. Return ONLY JSON:
{
  "name": string,
  "education": string,          // degrees, institutions, years — one or two lines
  "experience": string,         // roles + what they actually did, with real detail; 3-6 lines
  "achievements": [string],     // concrete, quantified accomplishments, ONE per array item, copied close to verbatim from the résumé wording — not summarised
  "skills": string              // comma-separated
}
Rules: do not invent anything not in the text. Keep achievement lines specific (numbers, systems, outcomes). If a field is absent, use "" (or [] for achievements).`;

export async function parseResume(text) {
  const apiKey = process.env.GROQ_API_KEY;
  const clean = (text || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 14000);
  if (!clean) {
    const e = new Error("No text supplied");
    e.status = 400;
    throw e;
  }
  if (!apiKey) {
    const e = new Error("GROQ_API_KEY not set — resume auto-fill needs the model. Paste details manually.");
    e.status = 503;
    throw e;
  }

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 12000,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: clean },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const e = new Error(`Groq request failed (${res.status}): ${detail}`);
    e.status = res.status === 401 ? 401 : 502;
    throw e;
  }
  const payload = await res.json();
  let parsed;
  try {
    let c = (payload?.choices?.[0]?.message?.content ?? "{}").trim();
    c = c.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const a = c.indexOf("{"), b = c.lastIndexOf("}");
    parsed = JSON.parse(a !== -1 && b > a ? c.slice(a, b + 1) : c);
  } catch {
    const e = new Error("Model returned non-JSON");
    e.status = 502;
    throw e;
  }
  return {
    name: (parsed.name || "").toString(),
    education: (parsed.education || "").toString(),
    experience: (parsed.experience || "").toString(),
    achievements: Array.isArray(parsed.achievements)
      ? parsed.achievements.map((s) => (s || "").toString().trim()).filter(Boolean)
      : [],
    skills: (parsed.skills || "").toString(),
  };
}

export default async function handler(req, res) {
  if (!(await requireAuth(req, res))) return;
  try {
    const data = await parseResume(req.body?.text || "");
    console.log(
      `[parse-resume] extracted name="${data.name}" achievements=${data.achievements.length}`
    );
    res.status(200).json(data);
  } catch (err) {
    console.error("[/api/parse-resume]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
