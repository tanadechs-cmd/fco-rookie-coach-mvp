import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminCookie, createAdminSession, passwordsMatch } from "../../lib/adminAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!expectedPassword || !sessionSecret) {
    return res.status(503).json({ error: "Admin access is not configured", code: "ADMIN_NOT_CONFIGURED" });
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || !passwordsMatch(password, expectedPassword)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.setHeader("Set-Cookie", adminCookie(createAdminSession(sessionSecret)));
  return res.status(200).json({ authenticated: true });
}

