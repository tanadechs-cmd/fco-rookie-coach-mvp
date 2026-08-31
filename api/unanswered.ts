import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reportUnansweredQuestion, SupabaseConfigError } from "../lib/supabaseRest.js";

const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const recentContext = typeof req.body?.recentContext === "string" ? req.body.recentContext.trim() : "";
  const onboardingDay = req.body?.onboardingDay;
  if (question.length < 2 || question.length > MAX_QUESTION_LENGTH || recentContext.length > MAX_CONTEXT_LENGTH) {
    return res.status(400).json({ error: "Invalid question report" });
  }
  if (!Number.isInteger(onboardingDay) || onboardingDay < 1 || onboardingDay > 3) {
    return res.status(400).json({ error: "Invalid onboarding day" });
  }

  try {
    const saved = await reportUnansweredQuestion({ question, onboardingDay, recentContext });
    if (!saved) return res.status(500).json({ error: "Unable to store question report" });
    return res.status(201).json({
      id: saved.id,
      question: saved.question,
      onboardingDay: saved.onboarding_day,
      relatedTopicId: saved.related_topic_id ?? undefined,
      count: saved.count,
      firstSeen: saved.first_seen,
      lastSeen: saved.last_seen,
      status: saved.status,
      recentContext: saved.recent_context,
    });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? error.status : 500;
    return res.status(status).json({ error: status === 503 ? "Question reporting is not configured" : "Unable to store question report" });
  }
}
