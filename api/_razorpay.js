// Shared between the client-side verify endpoint and the webhook — both ultimately need to credit
// a user exactly once per real payment.
import { supabaseAdmin } from "./_supabase.js";

// Idempotent: the first caller to insert a given Razorpay payment id wins; a second attempt at the
// same payment id (client verify AND webhook both firing, or a retried webhook) is a no-op.
export async function creditForPayment({ paymentId, userId, credits }) {
  if (!supabaseAdmin) throw new Error("Supabase admin client not configured");
  if (!paymentId || !userId || !credits) return { credited: false, reason: "missing data" };
  const { error: dupeError } = await supabaseAdmin.from("processed_payment_events").insert({ event_id: paymentId });
  if (dupeError) return { credited: false, reason: "already processed" };
  const { error } = await supabaseAdmin.rpc("add_credits", { p_user_id: userId, p_amount: credits });
  if (error) throw error;
  return { credited: true };
}
