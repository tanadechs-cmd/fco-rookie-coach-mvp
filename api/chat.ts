import type { VercelRequest, VercelResponse } from "@vercel/node";
import { normalizeAiResponse } from '../src/aiResponse.ts';
import { takePilotSlot } from '../lib/pilotRateLimit.ts';

const DEFAULT_CHATFLOW_URL = "https://ai.insea.io/api/chatflows/24426/run";
const MAX_QUERY_LENGTH = 2_000;
const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_LENGTH = 3_000;
const REQUEST_TIMEOUT_MS = 20_000;
type ContextMessage = { role: "user" | "assistant"; text: string };

// Log only bounded identifiers and classifications. Never log the response body,
// request headers, API key, user query, or conversation contents.
function upstreamFailureDetails(response: Response, raw: string) {
  const safeIdentifier = (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_.:/-]{1,120}$/.test(value)
      ? value
      : undefined;
  let errorCode: string | undefined;
  try {
    const payload = JSON.parse(raw);
    errorCode = safeIdentifier(payload?.code ?? payload?.error?.code ?? payload?.error_code);
  } catch { /* Gateways can return HTML instead of the API's JSON response. */ }
  const text = raw.toLowerCase();
  const reason = /cloudflare|cf-ray|cloudfront|request blocked|web application firewall/.test(text)
    ? "gateway_block"
    : /expired|invalid.{0,40}(key|token)|(key|token).{0,40}invalid/.test(text)
      ? "credential_rejected"
      : /quota|budget|credit|balance/.test(text)
        ? "quota_or_budget"
        : /not published|unpublished/.test(text)
          ? "not_published"
          : /permission|forbidden|access denied|not authorized|not allowed/.test(text)
            ? "access_denied"
            : "unclassified";
  return {
    upstreamStatus: response.status,
    contentType: response.headers.get("content-type")?.split(";")[0],
    server: safeIdentifier(response.headers.get("server")),
    upstreamRequestId: safeIdentifier(response.headers.get("x-request-id") ?? response.headers.get("cf-ray")),
    errorCode,
    reason,
    responseBytes: Buffer.byteLength(raw, "utf8"),
  };
}

type InseaEvent = {
  answer?: unknown;
  content?: unknown;
  conversation_id?: unknown;
  conversationId?: unknown;
  data?: {
    conversation_id?: unknown;
    message?: { text?: unknown; type?: unknown };
    outputs?: { answer?: unknown; conversation_id?: unknown };
  };
  delta?: unknown;
  message?: unknown | { text?: unknown; type?: unknown };
  text?: unknown;
};

function appendText(parts: string[], event: InseaEvent) {
  const nestedMessage =
    event.message && typeof event.message === "object"
      ? (event.message as { text?: unknown; type?: unknown })
      : undefined;
  const dataMessage = event.data?.message;
  const candidate =
    event.answer ??
    event.delta ??
    event.text ??
    event.content ??
    (nestedMessage?.type === "text" ? nestedMessage.text : undefined) ??
    (dataMessage?.type === "text" ? dataMessage.text : undefined) ??
    event.data?.outputs?.answer ??
    (typeof event.message === "string" ? event.message : undefined);
  if (typeof candidate === "string" && candidate.trim()) {
    parts.push(candidate);
  }
}

function readConversationId(event: InseaEvent) {
  const candidate =
    event.conversation_id ??
    event.conversationId ??
    event.data?.conversation_id ??
    event.data?.outputs?.conversation_id;
  return typeof candidate === "string" ? candidate : undefined;
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
        conversationId = readConversationId(event) ?? conversationId;
      } catch {
        // Ignore non-JSON SSE keepalive events.
      }
    }
  } else {
    try {
      const event = JSON.parse(raw) as InseaEvent;
      appendText(parts, event);
      conversationId = readConversationId(event) ?? conversationId;
    } catch {
      if (raw.trim()) parts.push(raw.trim());
    }
  }

  return { answer: parts.join("").trim(), conversationId };
}


function readContext(value: unknown): ContextMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ContextMessage => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { role?: unknown; text?: unknown };
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.text === "string" &&
        candidate.text.trim().length > 0
      );
    })
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((item) => ({ role: item.role, text: item.text.trim().slice(0, 500) }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      service: "FCO Rookie Coach AI fallback",
      configured: Boolean(process.env.AI_INSEA_API_KEY?.trim()),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.VERCEL) {
    const origin = req.headers.origin;
    if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== `https://${req.headers.host}`)) return res.status(403).json({ error: 'Invalid origin' });
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    if (!takePilotSlot(`ip:${ip}`, 10) || !takePilotSlot('all', 60)) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
  }

  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "Query is required" });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(413).json({ error: "Query is too long" });
  }

  const apiKey = process.env.AI_INSEA_API_KEY?.trim();
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
    const context = readContext(req.body?.context);
    const inputMethod = req.body?.inputMethod === "keyboard"
      ? "คีย์บอร์ด"
      : req.body?.inputMethod === "playstation"
        ? "จอย PlayStation (ปุ่ม □ △ ○ ✕)"
        : "จอย Xbox (ปุ่ม XYAB)";
    const contextText = context
      .map((message) => `${message.role === "user" ? "ผู้เล่น" : "โค้ช"}: ${message.text}`)
      .join("\n")
      .slice(-MAX_CONTEXT_LENGTH);
    const contextualQuery = contextText
      ? `บริบทล่าสุด (ใช้เพื่อเข้าใจคำถามต่อเนื่อง ห้ามทวนคำตอบเดิม):\n${contextText}\n\nอุปกรณ์ควบคุมที่ผู้เล่นเลือก: ${inputMethod}\nคำถามล่าสุด: ${query}`
      : `อุปกรณ์ควบคุมที่ผู้เล่นเลือก: ${inputMethod}\nคำถามล่าสุด: ${query}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: contextualQuery,
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
      console.error("ai_insea_upstream_failure", upstreamFailureDetails(upstream, raw));
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

    const structured = normalizeAiResponse(parsed.answer);
    if (!structured.answer) return res.status(502).json({ error: "AI-INsea returned an empty answer" });

    return res.status(200).json({
      answer: structured.answer,
      actions: structured.actions,
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
