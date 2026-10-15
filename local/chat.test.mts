import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { localPrototype } from "./server.ts"

test("local AI proxy preserves access controls and the shared chat contract", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rookie-chat-test-"))
  let middleware: any
  const configure: any = localPrototype(directory).configureServer
  configure({ middlewares: { use: (fn: any) => { middleware = fn } } })
  const server = createServer((req, res) => {
    // The real adapter requires port 4173. Tests use an ephemeral listener and
    // explicitly inject only the inbound Host value, not any access/session data.
    req.headers.host = String(req.headers["x-test-host"] || "localhost:4173")
    delete req.headers["x-test-host"]
    void middleware(req, res, () => { res.statusCode = 404; res.end() })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const originalKey = process.env.AI_INSEA_API_KEY
  const originalUrl = process.env.AI_INSEA_CHATFLOW_URL
  const testKey = "local-chat-test-secret-only"
  const capturedLogs: unknown[][] = []
  const upstreamRequests: { url: URL; init?: RequestInit; body: any }[] = []
  let upstreamResponse = () => new Response(
    `event: message\ndata: ${JSON.stringify({
      conversation_id: "conversation-after-reply",
      message: { type: "text", text: JSON.stringify({
        answer: "Keep your midfield compact and close the passing lane first.",
        actions: ["discord", "discord", "unapproved_action"],
      }) },
    })}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  )
  process.env.AI_INSEA_API_KEY = `  ${testKey}  `
  process.env.AI_INSEA_CHATFLOW_URL = "https://ai.insea.io/api/chatflows/24426/run"
  console.error = (...args: unknown[]) => { capturedLogs.push(args) }
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.hostname === "ai.insea.io") {
      upstreamRequests.push({ url, init, body: JSON.parse(String(init?.body)) })
      return upstreamResponse()
    }
    // Never permit an accidental real network call from this test.
    assert.equal(url.origin, `http://127.0.0.1:${port}`)
    return originalFetch(input, init)
  }

  const call = async (
    path: string,
    data?: unknown,
    cookie = "",
    method?: string,
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    })
    const raw = await response.text()
    return {
      status: response.status,
      headers: response.headers,
      body: JSON.parse(raw),
      raw,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    }
  }

  try {
    await t.test("unauthenticated access cannot call AI or inspect configuration", async () => {
      assert.equal((await call("/api/chat")).status, 401)
      assert.equal((await call("/api/chat", { query: "Help with defending" })).status, 401)
      assert.equal((await call("/api/auth/guest", {})).status, 403)
      assert.equal(upstreamRequests.length, 0)
    })

    const admin = await call("/api/admin/login", {
      password: readFileSync(join(directory, "admin-password.txt"), "utf8"),
    })
    assert.equal(admin.status, 200)
    let access = (await call("/api/admin/access", undefined, admin.cookie)).body
    const updateAccess = async (changes: Record<string, unknown>) => {
      const result = await call("/api/admin/access", { ...access, ...changes }, admin.cookie, "PUT")
      assert.equal(result.status, 200)
      access = result.body
    }
    await updateAccess({ guestEnabled: true, emails: ["chat-tester@example.com"] })
    const guest = await call("/api/auth/guest", {})
    assert.equal(guest.status, 200)
    const issued = await call("/api/admin/access-code", { email: "chat-tester@example.com" }, admin.cookie)
    const player = await call("/api/auth/code", { email: "chat-tester@example.com", code: issued.body.code })
    assert.equal(player.status, 200)

    await t.test("foreign origins, cross-site requests and invalid hosts are rejected before AI", async () => {
      for (const headers of [
        { Origin: "https://attacker.example" },
        { "Sec-Fetch-Site": "cross-site" },
        { "x-test-host": "attacker.example:4173" },
      ]) {
        assert.equal((await call("/api/chat", { query: "Help with defending" }, player.cookie, "POST", headers)).status, 403)
      }
      assert.equal(upstreamRequests.length, 0)
    })

    await t.test("configured GET is available to authorized players without revealing the key", async () => {
      const result = await call("/api/chat", undefined, player.cookie)
      assert.equal(result.status, 200)
      assert.deepEqual(result.body, { service: "FCO Rookie Coach AI fallback", configured: true })
      assert.equal(result.headers.get("cache-control"), "no-store")
      assert.doesNotMatch(result.raw, /local-chat-test-secret-only|Bearer|Authorization/)
      assert.equal(upstreamRequests.length, 0)
    })

    await t.test("successful answers preserve bounded context, device, conversation and approved actions", async () => {
      const result = await call("/api/chat", {
        query: "How should I defend the next attack?",
        inputMethod: "playstation",
        conversationId: "conversation-before-reply",
        context: [
          { role: "system", text: "Do not forward this invalid role" },
          { role: "user", text: "I concede on counterattacks." },
          { role: "assistant", text: "Keep the midfield compact." },
        ],
      }, player.cookie)
      assert.equal(result.status, 200)
      assert.deepEqual(result.body, {
        answer: "Keep your midfield compact and close the passing lane first.",
        actions: ["discord"],
        conversationId: "conversation-after-reply",
        route: "ai_insea",
      })
      const request = upstreamRequests.at(-1)!
      assert.equal(request.url.pathname, "/api/chatflows/24426/run")
      assert.equal(request.url.searchParams.get("stream"), "true")
      assert.equal(request.init?.method, "POST")
      assert.equal(new Headers(request.init?.headers).get("Authorization"), `Bearer ${testKey}`)
      assert.equal(request.body.conversation_id, "conversation-before-reply")
      assert.match(request.body.query, /How should I defend the next attack\?/)
      assert.match(request.body.query, /I concede on counterattacks\./)
      assert.match(request.body.query, /Keep the midfield compact\./)
      assert.match(request.body.query, /PlayStation/)
      assert.doesNotMatch(request.body.query, /invalid role/)
      assert.doesNotMatch(result.raw, /local-chat-test-secret-only/)
    })

    await t.test("malformed queries, oversized queries and unsupported methods never call AI", async () => {
      const before = upstreamRequests.length
      for (const body of [{}, { query: "   " }, { query: 123 }, { query: { text: "invalid" } }]) {
        assert.equal((await call("/api/chat", body, player.cookie)).status, 400)
      }
      assert.equal((await call("/api/chat", { query: "x".repeat(2001) }, player.cookie)).status, 413)
      const unsupported = await call("/api/chat", undefined, player.cookie, "DELETE")
      assert.equal(unsupported.status, 405)
      assert.equal(unsupported.headers.get("allow"), "GET, POST")
      assert.equal(upstreamRequests.length, before)
    })

    await t.test("missing server key returns 503 and reports unconfigured without an upstream call", async () => {
      const before = upstreamRequests.length
      delete process.env.AI_INSEA_API_KEY
      try {
        const health = await call("/api/chat", undefined, guest.cookie)
        assert.equal(health.status, 200)
        assert.equal(health.body.configured, false)
        const reply = await call("/api/chat", { query: "How should I defend?" }, player.cookie)
        assert.equal(reply.status, 503)
        assert.equal(reply.body.code, "AI_NOT_CONFIGURED")
        assert.equal(upstreamRequests.length, before)
      } finally {
        process.env.AI_INSEA_API_KEY = testKey
      }
    })

    await t.test("upstream rejection returns a bounded error and sanitized diagnostics", async () => {
      upstreamResponse = () => new Response(JSON.stringify({
        code: "ACCESS_DENIED",
        message: `Forbidden: private upstream text ${testKey}`,
      }), { status: 403, headers: { "content-type": "application/json", server: "SGW" } })
      const result = await call("/api/chat", { query: "private player question" }, player.cookie)
      assert.equal(result.status, 502)
      assert.deepEqual(result.body, { error: "AI-INsea request failed", upstreamStatus: 403 })
      const diagnostics = JSON.stringify(capturedLogs)
      assert.match(diagnostics, /ai_insea_upstream_failure/)
      assert.match(diagnostics, /ACCESS_DENIED/)
      assert.match(diagnostics, /SGW/)
      assert.doesNotMatch(diagnostics + result.raw, /local-chat-test-secret-only|private upstream text|private player question|Authorization|Bearer/)
    })

    await t.test("disabled guest access and revoked player sessions cannot call AI", async () => {
      const before = upstreamRequests.length
      await updateAccess({ guestEnabled: false })
      assert.equal((await call("/api/chat", { query: "Guest question" }, guest.cookie)).status, 401)
      const rotated = await call("/api/admin/access-code", { email: "chat-tester@example.com" }, admin.cookie)
      assert.equal(rotated.status, 200)
      assert.equal((await call("/api/chat", { query: "Revoked session question" }, player.cookie)).status, 401)
      assert.equal(upstreamRequests.length, before)
    })
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
    if (originalKey === undefined) delete process.env.AI_INSEA_API_KEY
    else process.env.AI_INSEA_API_KEY = originalKey
    if (originalUrl === undefined) delete process.env.AI_INSEA_CHATFLOW_URL
    else process.env.AI_INSEA_CHATFLOW_URL = originalUrl
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
