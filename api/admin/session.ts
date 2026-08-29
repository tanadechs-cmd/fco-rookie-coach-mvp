import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasValidAdminSession } from "../../lib/adminAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!process.env.ADMIN_PASSWORD || !sessionSecret) {
    return res.status(503).json({ authenticated: false, code: "ADMIN_NOT_CONFIGURED" });
  }

  if (!hasValidAdminSession(req, sessionSecret)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({ authenticated: true });
}

