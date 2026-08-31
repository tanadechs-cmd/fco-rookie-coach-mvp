import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasValidAdminSession } from "../../lib/adminAuth.js";
import {
  readUnansweredQuestions,
  SupabaseConfigError,
  updateUnansweredQuestion,
} from "../../lib/supabaseRest.js";

const STATUSES = new Set(["new", "reviewing", "content-added", "ignored"]);

function authorize(req: VercelRequest) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  return Boolean(sessionSecret && hasValidAdminSession(req, sessionSecret));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorize(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const questions = await readUnansweredQuestions();
      return res.status(200).json({
        questions: questions.map((question) => ({
          id: question.id,
          question: question.question,
          onboardingDay: question.onboarding_day,
          relatedTopicId: question.related_topic_id ?? undefined,
          count: question.count,
          firstSeen: question.first_seen,
          lastSeen: question.last_seen,
          status: question.status,
          recentContext: question.recent_context,
        })),
      });
    }

    if (req.method === "PUT") {
      const id = req.body?.id;
      const status = req.body?.status;
      const relatedTopicId = req.body?.relatedTopicId;
      if (typeof id !== "string" || !STATUSES.has(status) || (relatedTopicId !== undefined && typeof relatedTopicId !== "string")) {
        return res.status(400).json({ error: "Invalid unanswered-question update" });
      }
      const saved = await updateUnansweredQuestion({ id, status, relatedTopicId });
      if (!saved) return res.status(404).json({ error: "Question not found" });
      return res.status(200).json({
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
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? error.status : 500;
    return res.status(status).json({ error: "Unable to manage unanswered questions" });
  }
}
