# Unbriefed

An AI strategic pitch-deck generator: turn a candidate, a target company, a role, a tone and a
stated gap into a research-grounded, argument-driven slide deck — not a résumé.

## How it works

1. **Research** (`api/research.js`) — free, no API key. Cross-references Wikipedia, Google News
   RSS and DuckDuckGo Instant Answer for the target company and scores confidence 0–7.
2. **Outline** (`api/generate.js`, Step A) — an LLM call decides the *shape* of the deck for this
   specific pitch: 5–14 slides, each with its own purpose, type and visual, plus an overall mood
   (`editorial` for expressive/creative pitches, `infographic` for dense/analytical ones). There
   is no fixed slide template.
3. **Content** (`api/generate.js`, Step B) — a second LLM call writes full copy to that outline.
   Tone (Bold / Strategic / Corporate / Creative / Playful / Minimal / Analytical / Storytelling)
   is injected as a concrete voice instruction, so word choice and sentence rhythm actually change,
   not just the color palette.
4. **Render** (`render.js`) — pure string builders shared by the browser and the Node preview
   script. Real visuals: proportional donut charts, gradient "moodboard" tiles, 2×2 matrices,
   phased plans, mapping tables — plus tone-specific decorative graphics.

LLM: [Groq](https://console.groq.com) (`GROQ_API_KEY` / `GROQ_MODEL` in `.env`).

## Local development

```powershell
npm install
copy .env.example .env    # then fill in GROQ_API_KEY
npm run dev                # http://localhost:5173
```

No key set → the app still runs and shows a clearly labelled offline placeholder deck.

## Deploying

The `api/*.js` files are plain Node request handlers (`export default (req, res) => {}`), which
Vercel picks up as serverless functions with zero config. `vercel.json` just routes `/` to
`code.html`.

```powershell
vercel          # first deploy, follow the prompts
vercel env add GROQ_API_KEY production
vercel env add GROQ_MODEL production
vercel env add ACCESS_CODE production   # optional but recommended — see below
vercel --prod
```

### Protecting a public deploy

The generation routes cost real Groq tokens on every call. Set `ACCESS_CODE` in the deploy's
environment variables and the app requires that code (entered in the "Access Code" field, which
appears automatically once a request is gated) before it will generate anything. Leave it unset
for a fully open demo, or unset entirely for local dev.

## Project layout

```
code.html          the app shell (design tokens, layout, styles)
app.js             browser logic — validation, orchestration, rendering, PDF export
render.js          slide → HTML (shared by the browser and _shots.mjs)
validate.js        shared input validation (gibberish / placeholder detection)
api/research.js    Stage 1 — multi-source company research
api/generate.js    Stage 2 — two-step outline + content generation
api/parse-resume.js  résumé → structured Brief fields
api/_gate.js        shared access-code check for the token-costing routes
server.js           local dev server (Express) — not used on Vercel
_shots.mjs           Node script that screenshots a deck via a local Chrome + puppeteer-core
```
