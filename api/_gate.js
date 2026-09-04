// Shared access gate for the token-costing routes (outline / generate / parse-resume).
// Works identically whether invoked through Express (server.js, local dev) or as a bare Vercel
// serverless function (req/res have the same shape in both).
//
// If ACCESS_CODE is unset (local dev, .env has none), the gate is a no-op — zero friction.
// If it's set (the hosted deploy), callers must send it back as the "x-access-code" header.
export function checkAccess(req, res) {
  const required = process.env.ACCESS_CODE || "";
  if (!required) return true;
  const got = (req.headers && req.headers["x-access-code"]) || "";
  if (got && got === required) return true;
  res.status(401).json({ error: "Access code required — ask the deck owner for the code, then enter it above." });
  return false;
}
