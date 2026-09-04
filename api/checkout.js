// Creates a Razorpay Order for one of the three credit packs. Requires a signed-in Supabase user
// — the pack size and buyer's user id ride along as the order's "notes" so both the client-side
// verify step (api/razorpay-verify.js) and the webhook (api/razorpay-webhook.js) know who to
// credit once payment succeeds.
import Razorpay from "razorpay";
import { getUserFromRequest } from "./_supabase.js";

// Priced in INR — student-friendly, with a clear per-credit discount as the pack size grows.
// amountPaise is the smallest currency unit Razorpay expects for INR (paise, 100 = ₹1).
export const PACKS = {
  small: { credits: 3, amountPaise: 9900, label: "Small — 3 credits" },
  medium: { credits: 10, amountPaise: 24900, label: "Medium — 10 credits" },
  large: { credits: 20, amountPaise: 44900, label: "Large — 20 credits" },
};

function razorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google first." });
    return;
  }
  const razorpay = razorpayClient();
  if (!razorpay) {
    res.status(500).json({ error: "Payments are not configured yet." });
    return;
  }
  const packKey = (req.body?.pack || "").toString();
  const pack = PACKS[packKey];
  if (!pack) {
    res.status(400).json({ error: "Unknown credit pack." });
    return;
  }
  try {
    const order = await razorpay.orders.create({
      amount: pack.amountPaise,
      currency: "INR",
      receipt: `unbriefed_${packKey}_${Date.now()}`,
      notes: { user_id: user.id, credits: String(pack.credits), pack: packKey },
    });
    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      label: pack.label,
      email: user.email || "",
    });
  } catch (err) {
    console.error("[/api/checkout]", err.message || err);
    res.status(500).json({ error: "Could not start checkout." });
  }
}
