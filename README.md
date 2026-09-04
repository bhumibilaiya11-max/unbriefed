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
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add RAZORPAY_KEY_ID production
vercel env add RAZORPAY_KEY_SECRET production
vercel env add RAZORPAY_WEBHOOK_SECRET production
vercel --prod
```

### Auth + credits (protecting a public deploy)

The generation routes cost real Groq tokens on every call, so they sit behind Google sign-in
(Supabase Auth) and a per-user credit balance instead of a shared secret:

- New sign-ups get 3 free credits (`supabase_setup.sql` — a Postgres trigger on `auth.users`).
- `/api/generate` spends one credit atomically (`spend_credit()` in Postgres) and refunds it if
  the call falls back to the offline placeholder (Groq outage / rate limit).
- `/api/parse-resume` and `/api/outline` just require sign-in, no credit cost.
- More credits are bought via Razorpay (`api/checkout.js` creates the order, the browser opens
  Razorpay's checkout modal). Two paths credit the account, both funnelling through the same
  idempotent `creditForPayment()` so whichever fires first wins: `api/razorpay-verify.js` (fast —
  called by the browser the instant the modal reports success) and `api/razorpay-webhook.js`
  (reliable backstop on `payment.captured`, in case the browser call never fires).

Run `supabase_setup.sql` once in the Supabase project's SQL Editor before any of this works.
`SUPABASE_URL` / `SUPABASE_ANON_KEY` are also hardcoded in `app.js` — that's intentional, they're
public by design; Row Level Security on `profiles` is what actually protects data.

## Project layout

```
code.html            the app shell (design tokens, layout, styles)
app.js               browser logic — auth/credits, validation, orchestration, rendering, PDF export
render.js            slide → HTML (shared by the browser and _shots.mjs)
validate.js          shared input validation (gibberish / placeholder detection)
supabase_setup.sql   run once in Supabase SQL Editor — profiles/credits schema + RPCs
api/research.js      Stage 1 — multi-source company research
api/generate.js      Stage 2 — two-step outline + content generation
api/parse-resume.js  résumé → structured Brief fields
api/checkout.js        creates a Razorpay order for a credit pack
api/razorpay-verify.js verifies a payment client-side right after checkout (fast credit path)
api/razorpay-webhook.js verifies + credits on payment.captured (reliable backstop)
api/_razorpay.js        shared idempotent creditForPayment() used by both of the above
api/_supabase.js       server-side Supabase client + bearer-token auth helper
api/_gate.js           auth-required / credit-spend guards for the token-costing routes
server.js              local dev server (Express) — not used on Vercel
_shots.mjs             Node script that screenshots a deck via a local Chrome + puppeteer-core
```
