// Auth + credits gate. Replaces the old shared ACCESS_CODE gate — every generation now requires
// a signed-in Supabase user and, for the real generate call, an available credit.
import { getUserFromRequest, supabaseAdmin } from "./_supabase.js";

// Sign-in required, no credit cost (used for résumé auto-fill and the outline preview endpoint).
export async function requireAuth(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google to use this.", code: "AUTH_REQUIRED" });
    return null;
  }
  return user;
}

// Sign-in required AND atomically spends one credit. The spend happens server-side in Postgres
// (see spend_credit()) so two simultaneous requests can't both succeed on a user's last credit.
export async function requireCreditsAndSpend(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Credits backend not configured." });
    return null;
  }
  const { data: spent, error } = await supabaseAdmin.rpc("spend_credit", { p_user_id: user.id });
  if (error) {
    console.error("[gate] spend_credit failed:", error.message);
    res.status(500).json({ error: "Credit check failed — try again." });
    return null;
  }
  if (!spent) {
    res.status(402).json({ error: "Out of credits — buy more to keep generating.", code: "NO_CREDITS" });
    return null;
  }
  return user;
}

// Refund a credit — used when a "generation" actually fell back to the offline placeholder,
// so a Groq outage or rate limit doesn't cost the user a real credit.
export async function refundCredit(userId) {
  if (!supabaseAdmin || !userId) return;
  const { error } = await supabaseAdmin.rpc("add_credits", { p_user_id: userId, p_amount: 1 });
  if (error) console.error("[gate] refundCredit failed:", error.message);
}
