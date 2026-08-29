import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_CHATFLOW_URL = "https://ai.insea.io/api/chatflows/24426/run";
const MAX_QUERY_LENGTH = 2_000;
const REQUEST_TIMEOUT_MS = 20_000;

type InseaEvent = {
  answer?: unknown;
  content?: unknown;
  conversation_id?: unknown;
  conversationId?: unknown;
  delta?: unknown;
  message?: unknown;
  text?: unknown;
};

function appendText(parts: string[], event: InseaEvent) {
  const candidate =
    event.answer ?? event.delta ?? event.text ?? event.content ?? event.message;
  if (typeof candidate === "string" && candidate.trim()) {
    parts.push(candidate);
  }
}

function parseInseaResponse(raw: string, contentType: string) {
  const parts: string[] = [];
  let conversationId: string | undefined;

  if (contentType.includes("text/event-stream") || raw.includes("\ndata:")) {
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as InseaEvent;
        appendText(parts, event);
        const nextId = event.conversation_id ?? event.conversationId;
        if (typeof nextId === "string") conversationId = nextId;
      } catch {
        // Ignore non-JSON SSE keepalive events.
      }
    }
  } else {
    try {
      const event = JSON.parse(raw) as InseaEvent;
      appendText(parts, event);
      const nextId = event.conversation_id ?? event.conversationId;
      if (typeof nextId === "string") conversationId = nextId;
    } catch {
      if (raw.trim()) parts.push(raw.trim());
    }
  }

  return { answer: parts.join("").trim(), conversationId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      service: "FCO Rookie Coach AI fallback",
      configured: Boolean(process.env.AI_INSEA_API_KEY),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "Query is required" });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(413).json({ error: "Query is too long" });
  }

  const apiKey = process.env.AI_INSEA_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI fallback is not configured",
      code: "AI_NOT_CONFIGURED",
    });
  }

  const configuredUrl = process.env.AI_INSEA_CHATFLOW_URL || DEFAULT_CHATFLOW_URL;
  const url = new URL(configuredUrl);
  url.searchParams.set("stream", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        conversation_id:
          typeof req.body?.conversationId === "string"
            ? req.body.conversationId
            : undefined,
        files: Array.isArray(req.body?.files) ? req.body.files : undefined,
      }),
      signal: controller.signal,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      return res.status(502).json({
        error: "AI-INsea request failed",
        upstreamStatus: upstream.status,
      });
    }

    const parsed = parseInseaResponse(
      raw,
      upstream.headers.get("content-type") || "",
    );
    if (!parsed.answer) {
      return res.status(502).json({ error: "AI-INsea returned an empty answer" });
    }

    return res.status(200).json({
      answer: parsed.answer,
      conversationId: parsed.conversationId,
      route: "ai_insea",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "AI-INsea request timed out" : "AI-INsea is unavailable",
    });
  } finally {
    clearTimeout(timeout);
  }
}
