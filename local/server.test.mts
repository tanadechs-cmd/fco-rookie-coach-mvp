import { localPrototype } from "./server.ts"
import { createServer } from "node:http"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import { test } from "node:test"

test("local access, persistent identity, revocation, reports, analytics and config versions", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rookie-api-test-"))
  let middleware: any
  const plugin = localPrototype(directory)
  const configure: any = plugin.configureServer
  configure({
    middlewares: {
      use: (fn: any) => {
        middleware = fn
      },
    },
  })
  const server = createServer((req, res) => {
    req.headers.host = "localhost:4173"
    middleware(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as any).port
  const call = async (
    path: string,
    data?: any,
    cookie = "",
    method?: string,
  ) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: {
        Host: "localhost:4173",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    })
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    }
  }
  try {
    assert.equal((await call("/api/admin/access")).status, 401)
    assert.equal((await call("/api/auth/guest", {})).status, 403)
    const admin = (
      await call("/api/admin/login", {
        password: readFileSync(join(directory, "admin-password.txt"), "utf8"),
      })
    ).cookie
    assert.ok(admin)
    assert.equal((await call('/api/admin/feedback-settings')).status, 401)
    assert.equal((await call('/api/admin/feedback-settings', undefined, admin)).body.npsAfterMessages, 2)
    assert.equal((await call('/api/admin/feedback-settings', {revision: 0, npsAfterMessages: 0}, admin, 'PUT')).status, 400)
    assert.equal((await call('/api/admin/feedback-settings', {revision: 0, npsAfterMessages: 5}, admin, 'PUT')).status, 200)
    assert.equal((await call('/api/admin/feedback-settings', {revision: 0, npsAfterMessages: 3}, admin, 'PUT')).status, 409)
    let access = (await call("/api/admin/access", undefined, admin)).body
    assert.equal(
      (
        await call(
          "/api/admin/access",
          { ...access, emails: ["tester@example.com"] },
          admin,
          "PUT",
        )
      ).status,
      200,
    )
    assert.equal(
      (await call("/api/admin/access", access, admin, "PUT")).status,
      409,
    )
    await call("/api/auth/email", { email: "outsider@example.com" })
    assert.equal(
      (await call("/api/admin/mailbox", undefined, admin)).body.messages.length,
      0,
    )
    await call("/api/auth/email", { email: "tester@example.com" })
    let mail = (await call("/api/admin/mailbox", undefined, admin)).body
      .messages
    const token = new URL(mail[0].link).searchParams.get("login_token")
    const verified = await call("/api/auth/verify", { token })
    assert.equal(verified.status, 200)
    const player = verified.cookie
    assert.equal(verified.body.day, 1)
    assert.equal((await call("/api/auth/verify", { token })).status, 401)
    assert.equal(
      (
        await call(
          "/api/player/state",
          {
            state: {
              messages: [{ text: "saved" }],
              segment: "new-under-month",
            },
          },
          player,
          "PUT",
        )
      ).status,
      200,
    )
    await call("/api/auth/email", { email: "tester@example.com" })
    mail = (await call("/api/admin/mailbox", undefined, admin)).body.messages
    const second = await call("/api/auth/verify", {
      token: new URL(mail[0].link).searchParams.get("login_token"),
    })
    assert.equal(second.body.id, verified.body.id)
    assert.equal(second.body.state.messages[0].text, "saved")
    const report = await call(
      "/api/unanswered",
      { question: "ทดสอบคำถาม", reason: "knowledge_gap" },
      player,
    )
    assert.equal(report.status, 201)
    await call("/api/unanswered", { question: "ทดสอบคำถาม ?" }, player)
    assert.equal(
      (await call("/api/admin/unanswered", undefined, admin)).body.questions[0]
        .count,
      2,
    )
    await call(
      "/api/events",
      { type: "rating", messageId: "m1", value: "like" },
      player,
    )
    await call(
      "/api/events",
      { type: "rating", messageId: "m1", value: "dislike" },
      player,
    )
    await call("/api/events", { type: "nps", value: 10 }, player)
    const priorCount = (await call('/api/auth/session', undefined, player)).body.questionCount
    await call('/api/events', {type: 'question', text: 'test counter'}, player)
    const assessment = (await call('/api/auth/session', undefined, player)).body
    assert.equal(assessment.questionCount, priorCount + 1)
    assert.equal(assessment.npsAfterMessages, 5)
    assert.equal(assessment.npsCompleted, true)
    assert.deepEqual(assessment.ratedMessageIds, ['m1'])
    const stats = (await call("/api/admin/analytics", undefined, admin)).body
    assert.equal(stats.users, 1)
    assert.equal(stats.likes, 0)
    assert.equal(stats.dislikes, 1)
    assert.equal(stats.nps, 100)
    assert.equal((await call('/api/admin/feedback')).status, 401)
    for (let i = 0; i < 51; i++) await call('/api/events', { type: 'rating', messageId: `export-${i}`, value: 'like', question: 'ยิงยังไง', text: i === 0 ? '=HYPERLINK("test")' : 'กด B เพื่อยิง' }, player)
    const feedback = (await call('/api/admin/feedback?days=0', undefined, admin)).body.rows
    assert.equal(feedback.length, 53)
    assert.ok(feedback.every((row: any) => row.email === 'tester@example.com'))
    assert.ok(feedback.some((row: any) => row.question === 'ยิงยังไง'))
    const csvResponse = await fetch(`http://127.0.0.1:${port}/api/admin/feedback?days=0&format=csv`, { headers: { Cookie: admin } })
    assert.equal(csvResponse.status, 200)
    assert.match(csvResponse.headers.get('content-type') || '', /text\/csv/)
    const csv = await csvResponse.text()
    assert.equal(csv.split('\r\n').length, 54)
    assert.ok(csv.includes("'=HYPERLINK"))
    assert.ok(csv.includes('tester@example.com'))
    assert.equal(
      (await call("/api/events", { type: "nps", value: 20 }, player)).status,
      400,
    )
    const config = await call(
      "/api/admin/config",
      {
        expectedRevision: 0,
        section: "faq_content",
        payload: { faqConfigs: [{ question: "test" }], answerConfigs: [] },
      },
      admin,
      "PUT",
    )
    assert.equal(config.body.revision, 1)
    assert.equal(
      (
        await call(
          "/api/admin/config/versions",
          { expectedRevision: 1, revision: 1 },
          admin,
        )
      ).body.revision,
      2,
    )
    assert.equal((await call('/api/admin/access-code', {email: 'tester@example.com'}, player)).status, 401)
    assert.equal((await call('/api/admin/access-code', {email: 'outsider@example.com'}, admin)).status, 400)
    const issued = await call('/api/admin/access-code', {email: 'tester@example.com'}, admin)
    assert.equal(issued.status, 200)
    assert.ok(issued.body.code.length >= 20)
    assert.equal((await call('/api/auth/session', undefined, player)).status, 401)
    assert.equal((await call('/api/auth/code', {email: 'tester@example.com', code: 'wrong'})).status, 401)
    const byCode = await call('/api/auth/code', {email: ' TESTER@example.com ', code: issued.body.code})
    assert.equal(byCode.status, 200)
    assert.equal(byCode.body.id, verified.body.id)
    assert.equal(byCode.body.state.messages[0].text, 'saved')
    const rotated = await call('/api/admin/access-code', {email: 'tester@example.com'}, admin)
    assert.notEqual(rotated.body.code, issued.body.code)
    assert.equal((await call('/api/auth/session', undefined, byCode.cookie)).status, 401)
    assert.equal((await call('/api/auth/code', {email: 'tester@example.com', code: issued.body.code})).status, 401)
    assert.equal((await call('/api/auth/code', {email: 'tester@example.com', code: rotated.body.code})).status, 200)
    for (let i = 0; i < 5; i++) assert.equal((await call('/api/auth/code', {email: 'tester@example.com', code: 'bad'})).status, 401)
    assert.equal((await call('/api/auth/code', {email: 'tester@example.com', code: rotated.body.code})).status, 429)
    access = (await call("/api/admin/access", undefined, admin)).body
    await call(
      "/api/admin/access",
      { ...access, guestEnabled: true },
      admin,
      "PUT",
    )
    const guest = await call("/api/auth/guest", {})
    assert.equal(guest.status, 200)
    assert.equal(
      (
        await call(
          "/api/unanswered",
          { question: "anonymous question" },
          guest.cookie,
        )
      ).status,
      201,
    )
    access = (await call("/api/admin/access", undefined, admin)).body
    await call(
      "/api/admin/access",
      { ...access, guestEnabled: false, emails: [] },
      admin,
      "PUT",
    )
    assert.equal(
      (await call("/api/events", { type: "question" }, guest.cookie)).status,
      401,
    )
    assert.equal(
      (await call("/api/events", { type: "question" }, player)).status,
      401,
    )
    assert.equal(
      (await call("/api/admin/access", undefined, player)).status,
      401,
    )
    const rejected = await fetch(`http://127.0.0.1:${port}/api/admin/access`, {
      headers: {
        Host: "localhost:4173",
        Origin: "https://example.com",
        Cookie: admin,
      },
    })
    assert.equal(rejected.status, 403)
    // Re-open persisted storage with a new adapter, simulating a server restart.
    const reopened: any = localPrototype(directory).configureServer
    reopened({
      middlewares: {
        use: (fn: any) => {
          middleware = fn
        },
      },
    })
    assert.equal(
      (await call("/api/admin/unanswered", undefined, admin)).body.questions
        .length,
      2,
    )
    assert.equal((await call("/api/config", undefined, admin)).body.revision, 2)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
