const JSON_HEADERS = { "Content-Type": "application/json" };

export class SupabaseConfigError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SupabaseConfigError";
    this.status = status;
  }
}

function getCredentials() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new SupabaseConfigError("Supabase is not configured", 503);
  }
  return { url, serviceRoleKey };
}

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = getCredentials();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.headers || {}),
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = `Supabase request failed (${response.status})`;
    try {
      const body = JSON.parse(raw) as { message?: unknown; hint?: unknown };
      if (typeof body.message === "string") message = body.message;
    } catch {
      // Keep the safe generic message when Supabase returns a non-JSON response.
    }
    throw new SupabaseConfigError(message, response.status);
  }

  if (!raw) return undefined as T;
  return JSON.parse(raw) as T;
}

export type StoredAppConfig = {
  id: string;
  revision: number;
  faq_config: unknown[];
  chat_answers: unknown[];
  delivery_plans: unknown[];
  published_sections: unknown[];
  updated_at: string;
};

export type StoredConfigVersion = {
  id: string;
  revision: number;
  changed_section: string;
  created_at: string;
  created_by: string;
};

export type StoredUnansweredQuestion = {
  id: string;
  question: string;
  onboarding_day: number;
  related_topic_id: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  status: "new" | "reviewing" | "content-added" | "ignored";
  recent_context: string;
};

export async function readAppConfig(): Promise<StoredAppConfig | null> {
  const rows = await supabaseRest<StoredAppConfig[]>(
    "/rest/v1/fco_app_config?id=eq.production&select=id,revision,faq_config,chat_answers,delivery_plans,published_sections,updated_at&limit=1",
    { method: "GET" },
  );
  return rows[0] ?? null;
}

export async function saveAppConfigSection(args: {
  section: "faq_content" | "proactive_messages";
  payload: unknown;
  expectedRevision: number;
}) {
  const rows = await supabaseRest<StoredAppConfig[]>("/rest/v1/rpc/save_fco_config_section", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_section: args.section,
      p_payload: args.payload,
      p_expected_revision: args.expectedRevision,
      p_updated_by: "admin",
    }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function readConfigVersions(limit = 20): Promise<StoredConfigVersion[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  return supabaseRest<StoredConfigVersion[]>(
    `/rest/v1/fco_config_versions?config_id=eq.production&select=id,revision,changed_section,created_at,created_by&order=revision.desc&limit=${safeLimit}`,
    { method: "GET" },
  );
}

export async function restoreAppConfigVersion(args: {
  revision: number;
  expectedRevision: number;
}) {
  const rows = await supabaseRest<StoredAppConfig[]>("/rest/v1/rpc/restore_fco_config_version", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_revision: args.revision,
      p_expected_revision: args.expectedRevision,
      p_updated_by: "admin",
    }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function reportUnansweredQuestion(args: {
  question: string;
  onboardingDay: number;
  recentContext: string;
}) {
  const rows = await supabaseRest<StoredUnansweredQuestion[]>("/rest/v1/rpc/report_fco_unanswered_question", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_question: args.question,
      p_onboarding_day: args.onboardingDay,
      p_recent_context: args.recentContext,
    }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function readUnansweredQuestions(): Promise<StoredUnansweredQuestion[]> {
  return supabaseRest<StoredUnansweredQuestion[]>(
    "/rest/v1/fco_unanswered_questions?select=id,question,onboarding_day,related_topic_id,count,first_seen,last_seen,status,recent_context&order=last_seen.desc,count.desc&limit=250",
    { method: "GET" },
  );
}

export async function updateUnansweredQuestion(args: {
  id: string;
  status: StoredUnansweredQuestion["status"];
  relatedTopicId?: string;
}) {
  const rows = await supabaseRest<StoredUnansweredQuestion[]>(
    `/rest/v1/fco_unanswered_questions?id=eq.${encodeURIComponent(args.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: args.status,
        related_topic_id: args.relatedTopicId || null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return Array.isArray(rows) ? rows[0] : rows;
}
