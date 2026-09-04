// Creates a Stripe Checkout Session for one of the three credit packs. Requires a signed-in
// Supabase user — the pack size and the buyer's user id ride along as session metadata so the
// webhook (api/stripe-webhook.js) knows exactly who to credit once payment succeeds.
import Stripe from "stripe";
import { getUserFromRequest } from "./_supabase.js";

export const PACKS = {
  small: { credits: 3, amountCents: 299, label: "Small — 3 credits" },
  medium: { credits: 10, amountCents: 799, label: "Medium — 10 credits" },
  large: { credits: 20, amountCents: 1299, label: "Large — 20 credits" },
};

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google first." });
    return;
  }
  const stripe = stripeClient();
  if (!stripe) {
    res.status(500).json({ error: "Payments are not configured yet." });
    return;
  }
  const packKey = (req.body?.pack || "").toString();
  const pack = PACKS[packKey];
  if (!pack) {
    res.status(400).json({ error: "Unknown credit pack." });
    return;
  }
  const origin =
    req.headers.origin ||
    (req.headers.host ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}` : "https://unbriefed-app.vercel.app");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.amountCents,
            product_data: { name: `Unbriefed — ${pack.label}` },
          },
          quantity: 1,
        },
      ],
      metadata: { user_id: user.id, credits: String(pack.credits), pack: packKey },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[/api/checkout]", err.message);
    res.status(500).json({ error: "Could not start checkout." });
  }
}
