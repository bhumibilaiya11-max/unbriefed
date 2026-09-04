// Called by the browser right after Razorpay's checkout modal reports success. This is the FAST
// path (credits the account in the same request, no waiting on a webhook) — the webhook
// (api/razorpay-webhook.js) is the reliable backstop in case this call never fires (tab closed
// right after paying, network blip, etc). Both funnel through creditForPayment(), which is
// idempotent per payment id, so whichever fires first wins and the second is a safe no-op.
import crypto from "node:crypto";
import { getUserFromRequest } from "./_supabase.js";
import { creditForPayment } from "./_razorpay.js";

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google first." });
    return;
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits } = req.body || {};
  const creditsNum = parseInt(credits, 10);
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !creditsNum) {
    res.status(400).json({ error: "Missing payment details." });
    return;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Payments are not configured yet." });
    return;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    console.error("[/api/razorpay-verify] signature mismatch for", razorpay_payment_id);
    res.status(400).json({ error: "Payment signature verification failed." });
    return;
  }
  try {
    const result = await creditForPayment({ paymentId: razorpay_payment_id, userId: user.id, credits: creditsNum });
    res.status(200).json({ credited: result.credited });
  } catch (err) {
    console.error("[/api/razorpay-verify]", err.message);
    res.status(500).json({ error: "Payment verified but crediting failed — the webhook will retry shortly." });
  }
}
