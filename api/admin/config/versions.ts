import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasValidAdminSession } from "../../../lib/adminAuth.js";
import {
  readConfigVersions,
  restoreAppConfigVersion,
  SupabaseConfigError,
} from "../../../lib/supabaseRest.js";

function authorize(req: VercelRequest) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  return Boolean(sessionSecret && hasValidAdminSession(req, sessionSecret));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorize(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const versions = await readConfigVersions();
      return res.status(200).json({ versions });
    }

    if (req.method === "POST") {
      const revision = req.body?.revision;
      const expectedRevision = req.body?.expectedRevision;
      if (!Number.isInteger(revision) || revision < 0 || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
        return res.status(400).json({ error: "Invalid revision" });
      }
      const saved = await restoreAppConfigVersion({ revision, expectedRevision });
      if (!saved) return res.status(500).json({ error: "Supabase returned no restored configuration" });
      return res.status(200).json({
        revision: saved.revision,
        faqConfigs: saved.faq_config,
        answerConfigs: saved.chat_answers,
        deliveryPlans: saved.delivery_plans,
        publishedSections: saved.published_sections,
        updatedAt: saved.updated_at,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const conflict = error instanceof SupabaseConfigError && /revision conflict/i.test(error.message);
    const status = conflict ? 409 : error instanceof SupabaseConfigError ? error.status : 500;
    return res.status(status).json({
      error: conflict ? "Configuration changed in another admin session. Reload before restoring." : "Unable to manage configuration history",
      code: conflict ? "REVISION_CONFLICT" : "CONFIG_HISTORY_FAILED",
    });
  }
}
