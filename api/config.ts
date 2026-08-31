import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readAppConfig, SupabaseConfigError } from "../lib/supabaseRest.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Player content should reflect a published admin change on the next page load.
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const config = await readAppConfig();
    if (!config) return res.status(404).json({ error: "Configuration not found", code: "CONFIG_NOT_FOUND" });
    return res.status(200).json({
      revision: config.revision,
      faqConfigs: config.faq_config,
      answerConfigs: config.chat_answers,
      deliveryPlans: config.delivery_plans,
      publishedSections: config.published_sections,
      updatedAt: config.updated_at,
    });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? error.status : 500;
    return res.status(status).json({
      error: status === 503 ? "Shared configuration is not configured" : "Unable to load shared configuration",
      code: status === 503 ? "SUPABASE_NOT_CONFIGURED" : "CONFIG_READ_FAILED",
    });
  }
}
