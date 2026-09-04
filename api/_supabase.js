// Server-side Supabase access. Uses the service_role key, which bypasses Row Level Security —
// never expose this key to the browser. The browser only ever sees SUPABASE_URL + the anon key.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

// Verifies the "Authorization: Bearer <access_token>" header the browser sends (the user's
// Supabase session token) and returns the authenticated user, or null if missing/invalid.
export async function getUserFromRequest(req) {
  if (!supabaseAdmin) return null;
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
