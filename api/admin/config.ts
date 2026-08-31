import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasValidAdminSession } from "../../lib/adminAuth.js";
import {
  readAppConfig,
  saveAppConfigSection,
  SupabaseConfigError,
} from "../../lib/supabaseRest.js";

const MAX_PAYLOAD_BYTES = 1_000_000;

function authorize(req: VercelRequest) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  return Boolean(sessionSecret && hasValidAdminSession(req, sessionSecret));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorize(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const config = await readAppConfig();
      if (!config) return res.status(404).json({ error: "Configuration not found" });
      return res.status(200).json(config);
    }

    if (req.method === "PUT") {
      const section = req.body?.section;
      const expectedRevision = req.body?.expectedRevision;
      const payload = req.body?.payload;
      if (section !== "faq_content" && section !== "proactive_messages") {
        return res.status(400).json({ error: "Invalid configuration section" });
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        return res.status(400).json({ error: "Invalid expected revision" });
      }
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Configuration payload is required" });
      }
      const encoded = JSON.stringify(payload);
      if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: "Configuration payload is too large" });
      }
      if (
        (section === "faq_content" && (!Array.isArray(payload.faqConfigs) || !Array.isArray(payload.answerConfigs))) ||
        (section === "proactive_messages" && !Array.isArray(payload.deliveryPlans))
      ) {
        return res.status(400).json({ error: "Configuration payload has an invalid shape" });
      }

      const saved = await saveAppConfigSection({ section, payload, expectedRevision });
      if (!saved) return res.status(500).json({ error: "Supabase returned no saved configuration" });
      return res.status(200).json({
        revision: saved.revision,
        updatedAt: saved.updated_at,
      });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const conflict = error instanceof SupabaseConfigError && /revision conflict/i.test(error.message);
    const status = conflict ? 409 : error instanceof SupabaseConfigError ? error.status : 500;
    return res.status(status).json({
      error: conflict ? "Configuration changed in another admin session. Reload before saving." : "Unable to save configuration",
      code: conflict ? "REVISION_CONFLICT" : "CONFIG_SAVE_FAILED",
    });
  }
}
