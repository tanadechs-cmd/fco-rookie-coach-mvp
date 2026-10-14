import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/chat.ts";

test("403 diagnostics exclude credentials, response text and user content", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalKey = process.env.AI_INSEA_API_KEY;
  const captured: unknown[][] = [];
  process.env.AI_INSEA_API_KEY = "  test-secret-value  ";
  console.error = (...args: unknown[]) => { captured.push(args); };
  let upstreamCalls = 0;
  globalThis.fetch = async (_url, init) => {
    upstreamCalls++;
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-secret-value");
    return new Response(JSON.stringify({ code: "ACCESS_DENIED", message: "Forbidden: private user text test-secret-value" }), {
      status: 403,
      headers: { "content-type": "application/json", "x-request-id": "test-request-123" },
    });
  };
  let status: number | undefined;
  let body: unknown;
  const res = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; return this; } };
  try {
    await handler({ method: "POST", body: { query: "private user text" } } as never, res as never);
    assert.equal(status, 502);
    assert.equal(upstreamCalls, 1);
    assert.deepEqual(body, { error: "AI-INsea request failed", upstreamStatus: 403 });
    const logs = JSON.stringify(captured);
    assert.match(logs, /ACCESS_DENIED/);
    assert.match(logs, /test-request-123/);
    assert.doesNotMatch(logs, /test-secret-value|private user text|Authorization|Bearer/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalKey === undefined) delete process.env.AI_INSEA_API_KEY;
    else process.env.AI_INSEA_API_KEY = originalKey;
  }
});

test("valid structured streaming answers still pass through", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.AI_INSEA_API_KEY;
  process.env.AI_INSEA_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(`event: message\ndata: ${JSON.stringify({ conversation_id: "test-conversation", message: { type: "text", text: JSON.stringify({ answer: "คำตอบทดสอบ", actions: ["discord"] }) } })}\n\n`, { headers: { "content-type": "text/event-stream" } });
  let status: number | undefined;
  let body: unknown;
  const res = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; return this; } };
  try {
    await handler({ method: "POST", body: { query: "คำถามทดสอบ" } } as never, res as never);
    assert.equal(status, 200);
    assert.deepEqual(body, { answer: "คำตอบทดสอบ", actions: ["discord"], conversationId: "test-conversation", route: "ai_insea" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AI_INSEA_API_KEY;
    else process.env.AI_INSEA_API_KEY = originalKey;
  }
});
