// Stripe calls this after a checkout completes. Verifies the signature against the raw request
// body (Stripe's requirement), then credits the buyer's account. Idempotent: each Stripe event id
// is recorded once in processed_stripe_events, so a retried webhook delivery never double-credits.
import Stripe from "stripe";
import { supabaseAdmin } from "./_supabase.js";

// Vercel Node functions parse JSON bodies automatically by default — this opts out so we get the
// exact raw bytes Stripe signed. server.js mirrors this locally with express.raw() on this route.
export const config = { api: { bodyParser: false } };

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const stripe = stripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret || !supabaseAdmin) {
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

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers["stripe-signature"], webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    // Record the event id first — if this insert fails on the primary-key conflict, we've
    // already processed it (a Stripe retry), so skip crediting again but still return 200.
    const { error: dupeError } = await supabaseAdmin
      .from("processed_stripe_events")
      .insert({ event_id: event.id });
    if (dupeError) {
      console.log(`[stripe-webhook] event ${event.id} already processed — skipping`);
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);
      if (userId && credits > 0) {
        const { error } = await supabaseAdmin.rpc("add_credits", { p_user_id: userId, p_amount: credits });
        if (error) throw error;
        console.log(`[stripe-webhook] credited ${credits} credits to user ${userId} (session ${session.id})`);
      } else {
        console.warn(`[stripe-webhook] checkout.session.completed missing metadata`, session.id);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err.message);
    res.status(500).json({ error: "Webhook handler failed." });
  }
}
