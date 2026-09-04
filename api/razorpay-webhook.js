// Razorpay calls this on payment.captured. Verifies the signature against the raw request body
// (Razorpay's requirement), then credits the buyer — the reliable backstop to api/razorpay-verify.js.
import crypto from "node:crypto";
import { creditForPayment } from "./_razorpay.js";

// Vercel Node functions parse JSON bodies automatically by default — this opts out so we get the
// exact raw bytes Razorpay signed. server.js mirrors this locally with express.raw() on this route.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).send("Webhook not configured.");
    return;
  }

  let rawBody;
  try {
    rawBody = Buffer.isBuffer(req.body) ? req.body : await readRawBody(req);
  } catch {
    res.status(400).send("Could not read request body.");
    return;
  }

  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!signature || expected !== signature) {
    console.error("[razorpay-webhook] signature verification failed");
    res.status(400).send("Invalid signature.");
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).send("Invalid JSON.");
    return;
  }

  try {
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const notes = payment?.notes || {};
      const userId = notes.user_id;
      const credits = parseInt(notes.credits || "0", 10);
      if (userId && credits > 0) {
        const result = await creditForPayment({ paymentId: payment.id, userId, credits });
        console.log(`[razorpay-webhook] payment ${payment.id} credited=${result.credited} (${result.reason || "ok"})`);
      } else {
        console.warn("[razorpay-webhook] payment.captured missing notes on", payment?.id);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[razorpay-webhook] handler error:", err.message);
    res.status(500).json({ error: "Webhook handler failed." });
  }
}
