import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generateHandler, { outlineHandler } from "./api/generate.js";
import researchHandler from "./api/research.js";
import parseResumeHandler from "./api/parse-resume.js";
import checkoutHandler from "./api/checkout.js";
import razorpayVerifyHandler from "./api/razorpay-verify.js";
import razorpayWebhookHandler from "./api/razorpay-webhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

// Razorpay needs the exact raw request bytes to verify its signature — mount this BEFORE the
// global JSON body parser below, so it never gets JSON-parsed first.
app.post("/api/razorpay-webhook", express.raw({ type: "*/*" }), razorpayWebhookHandler);

app.use(express.json({ limit: "2mb" }));

// Never let the browser serve a stale UI — this app's HTML/JS/CSS change often during dev.
app.use((req, res, next) => {
  if (req.path === "/" || /\.(html|js|mjs|css)$/i.test(req.path)) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});

// Stage 1 — research the target company from multiple free sources
app.post("/api/research", researchHandler);
// Step A only — the deck outline the model decides for this specific pitch
app.post("/api/outline", outlineHandler);
// Two-step generation — outline, then content written to it
app.post("/api/generate", generateHandler);
// Resume auto-fill for The Brief
app.post("/api/parse-resume", parseResumeHandler);
// Start a Razorpay order for a credit pack (webhook route is mounted above)
app.post("/api/checkout", checkoutHandler);
// Client-side payment verification — fast credit path right after the Razorpay modal succeeds
app.post("/api/razorpay-verify", razorpayVerifyHandler);

// Serve the static UI (code.html is the entry point)
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "code.html"));
});
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Unbriefed running at http://localhost:${PORT}`);
  const key = process.env.GROQ_API_KEY;
  if (key) {
    console.log(
      `GROQ_API_KEY detected (…${key.slice(-4)}) — model: ${process.env.GROQ_MODEL || "openai/gpt-oss-120b"}. Live generation is ON.`
    );
  } else {
    console.warn(
      "GROQ_API_KEY is NOT set — add it to .env (GROQ_API_KEY=gsk_...) and restart. Until then /api/generate returns a labelled placeholder and /api/parse-resume is disabled."
    );
  }
});
