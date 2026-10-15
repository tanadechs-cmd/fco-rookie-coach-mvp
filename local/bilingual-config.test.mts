import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { localPrototype } from "./server.ts"
import { englishStatus, sourceSignature } from "../src/knowledgeRouting.ts"
import type { BilingualAnswerConfig } from "../src/knowledgeRouting.ts"

function bilingualAnswer(id: string, isManual: boolean): BilingualAnswerConfig {
  const answer: BilingualAnswerConfig = {
    id,
    title: isManual ? "คำตอบที่ทีมสร้าง" : "การส่งบอล",
    text: "คำตอบภาษาไทยสำหรับทดสอบการบันทึก",
    opening: "ลองดูทีละส่วนกันครับ",
    clipIntro: "ดูตัวอย่างในคลิปครับ",
    keywords: ["คำค้นไทย", isManual ? "หัวข้อทีม" : "ส่งบอล"],
    keyboardSteps: ["ขั้นตอนคีย์บอร์ด"],
    xboxSteps: ["ขั้นตอน Xbox"],
    playstationSteps: ["ขั้นตอน PlayStation"],
    source: isManual ? "Manual content" : "FC Online Education Hub",
    isManual,
    en: {
      title: isManual ? "Team-authored answer" : "Passing guide",
      text: "An English answer used only to test persistence.",
      opening: "Let’s take it step by step.",
      clipIntro: "Here’s a video to follow along.",
      keywords: ["saved keyword", isManual ? "team answer" : "pass the ball"],
      keyboardSteps: ["Keyboard instruction"],
      xboxSteps: ["Xbox instruction"],
      playstationSteps: ["PlayStation instruction"],
    },
  }
  answer.en!.sourceSignature = sourceSignature(answer)
  return answer
}

test("bilingual admin configuration survives save, player GET, version history and rollback", async (t) => {
  // Isolated storage only: never read the app's .local database or any .env file.
  const directory = mkdtempSync(join(tmpdir(), "rookie-bilingual-config-test-"))
  let middleware: any
  const openAdapter = () => {
    const configure: any = localPrototype(directory).configureServer
    configure({ middlewares: { use: (fn: any) => { middleware = fn } } })
  }
  openAdapter()
  const server = createServer((req, res) => {
    // Production's local adapter requires port 4173; this test owns an ephemeral
    // loopback listener and injects only that expected Host, never a session.
    req.headers.host = "localhost:4173"
    void middleware(req, res, () => { res.statusCode = 404; res.end() })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port
  const localOrigin = `http://127.0.0.1:${port}`
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    assert.equal(url.origin, localOrigin, "This test must never contact an external service")
    return originalFetch(input, init)
  }

  const call = async (path: string, data?: unknown, cookie = "", method?: string) => {
    const response = await fetch(`${localOrigin}${path}`, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    })
    return {
      status: response.status,
      body: await response.json() as any,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    }
  }

  const firstPayload = {
    answerConfigs: [bilingualAnswer("passing", false), bilingualAnswer("manual-test-answer", true)],
    faqConfigs: [
      {
        id: "faq-passing-test", question: "ส่งบอลอย่างไร", questionEn: "How do I pass?",
        questionEnSource: "ส่งบอลอย่างไร", stageId: "activation", topicId: "FCO-EDU-043",
        trigger: "ส่งบอล, pass the ball",
      },
      {
        id: "faq-manual-test", question: "ถามเรื่องที่ทีมสร้าง", questionEn: "Show the team-authored answer",
        questionEnSource: "ถามเรื่องที่ทีมสร้าง", stageId: "competence", topicId: "manual-test-answer",
        trigger: "หัวข้อทีม, team answer",
      },
    ],
  }
  const secondPayload = structuredClone(firstPayload)
  for (const answer of secondPayload.answerConfigs) {
    answer.title += " ฉบับแก้ไข"
    answer.text = "คำตอบไทยแก้ไขแล้ว"
    answer.keywords = ["คำค้นไทยใหม่", `${answer.id} คำค้นใหม่`]
    answer.keyboardSteps = ["ขั้นตอนคีย์บอร์ดแก้ไข"]
    answer.xboxSteps = ["ขั้นตอน Xbox แก้ไข"]
    answer.playstationSteps = ["ขั้นตอน PlayStation แก้ไข"]
    answer.en!.title += " — revised"
    answer.en!.text = "The edited English answer."
    answer.en!.keywords = ["new English keyword", `${answer.id} revised keyword`]
    answer.en!.keyboardSteps = ["Edited keyboard instruction"]
    answer.en!.xboxSteps = ["Edited Xbox instruction"]
    answer.en!.playstationSteps = ["Edited PlayStation instruction"]
    answer.en!.sourceSignature = sourceSignature(answer)
  }
  for (const faq of secondPayload.faqConfigs) {
    faq.question += "เพิ่มเติม"
    faq.questionEn += " — revised"
    faq.questionEnSource = faq.question
    faq.trigger = "คำค้นแก้ไข, revised question"
  }

  const assertPayload = (config: any, payload: typeof firstPayload, revision: number) => {
    assert.equal(config.revision, revision)
    assert.deepEqual(config.publishedSections, ["faq_content"])
    assert.deepEqual(config.answerConfigs, payload.answerConfigs)
    assert.deepEqual(config.faqConfigs, payload.faqConfigs)
    assert.deepEqual(config.deliveryPlans, [], "FAQ saves must not alter another section")
    for (const answer of config.answerConfigs) assert.equal(englishStatus(answer), "current")
    for (const faq of config.faqConfigs) assert.equal(faq.questionEnSource, faq.question)
  }

  try {
    assert.equal((await call("/api/config")).status, 401)
    const login = await call("/api/admin/login", {
      password: readFileSync(join(directory, "admin-password.txt"), "utf8"),
    })
    assert.equal(login.status, 200)
    assert.ok(login.cookie)
    const admin = login.cookie
    const access = await call("/api/admin/access", undefined, admin)
    assert.equal((await call("/api/admin/access", { ...access.body, guestEnabled: true }, admin, "PUT")).status, 200)
    const playerLogin = await call("/api/auth/guest", {})
    assert.equal(playerLogin.status, 200)
    const player = playerLogin.cookie
    assert.ok(player)
    assert.equal((await call("/api/config", undefined, player)).body.revision, 0)
    assert.equal((await call("/api/admin/config/versions", undefined, admin)).body.versions.length, 0)

    await t.test("only an admin can publish bilingual configuration", async () => {
      const body = { expectedRevision: 0, section: "faq_content", payload: firstPayload }
      assert.equal((await call("/api/admin/config", body, "", "PUT")).status, 401)
      assert.equal((await call("/api/admin/config", body, player, "PUT")).status, 401)
      assert.equal((await call("/api/admin/config/versions", undefined, player)).status, 401)
      assert.equal((await call("/api/config", undefined, player)).body.revision, 0)
    })

    await t.test("save and player GET retain both languages, device steps, signatures and FAQ sources", async () => {
      const saved = await call("/api/admin/config", {
        expectedRevision: 0, section: "faq_content", payload: firstPayload,
      }, admin, "PUT")
      assert.equal(saved.status, 200)
      assertPayload(saved.body, firstPayload, 1)
      const reloaded = await call("/api/config", undefined, player)
      assert.equal(reloaded.status, 200)
      assertPayload(reloaded.body, firstPayload, 1)
      const versions = (await call("/api/admin/config/versions", undefined, admin)).body.versions
      assert.equal(versions.length, 1)
      assert.equal(versions[0].changedSection, "faq_content")
      assertPayload(versions[0], firstPayload, 1)
    })

    await t.test("edited TH and EN keywords and answers persist without restoring removed values", async () => {
      const saved = await call("/api/admin/config", {
        expectedRevision: 1, section: "faq_content", payload: secondPayload,
      }, admin, "PUT")
      assert.equal(saved.status, 200)
      assertPayload(saved.body, secondPayload, 2)
      assertPayload((await call("/api/config", undefined, player)).body, secondPayload, 2)
      const versions = (await call("/api/admin/config/versions", undefined, admin)).body.versions
      assert.deepEqual(versions.map((version: any) => version.revision), [2, 1])
      assertPayload(versions[0], secondPayload, 2)
      assertPayload(versions[1], firstPayload, 1)
    })

    await t.test("stale saves and stale rollback attempts cannot overwrite newer translations", async () => {
      const conflictingSave = await call("/api/admin/config", {
        expectedRevision: 1, section: "faq_content", payload: firstPayload,
      }, admin, "PUT")
      assert.equal(conflictingSave.status, 409)
      assert.equal(conflictingSave.body.code, "REVISION_CONFLICT")
      const conflictingRollback = await call("/api/admin/config/versions", {
        expectedRevision: 1, revision: 1,
      }, admin)
      assert.equal(conflictingRollback.status, 409)
      assert.equal(conflictingRollback.body.code, "REVISION_CONFLICT")
      assertPayload((await call("/api/config", undefined, player)).body, secondPayload, 2)
      assert.equal((await call("/api/admin/config/versions", undefined, admin)).body.versions.length, 2)
    })

    await t.test("rollback restores all bilingual fields and adds a revision without destroying history", async () => {
      const rollback = await call("/api/admin/config/versions", { expectedRevision: 2, revision: 1 }, admin)
      assert.equal(rollback.status, 200)
      assertPayload(rollback.body, firstPayload, 3)
      assert.equal(rollback.body.changedSection, "rollback")
      assertPayload((await call("/api/config", undefined, player)).body, firstPayload, 3)
      const versions = (await call("/api/admin/config/versions", undefined, admin)).body.versions
      assert.deepEqual(versions.map((version: any) => version.revision), [3, 2, 1])
      assertPayload(versions[0], firstPayload, 3)
      assertPayload(versions[1], secondPayload, 2)
      assertPayload(versions[2], firstPayload, 1)
    })

    await t.test("a new adapter reads the persisted bilingual rollback after a simulated restart", async () => {
      openAdapter()
      assertPayload((await call("/api/config", undefined, player)).body, firstPayload, 3)
      const versions = (await call("/api/admin/config/versions", undefined, admin)).body.versions
      assert.equal(versions.length, 3)
      assertPayload(versions[1], secondPayload, 2)
    })
  } finally {
    globalThis.fetch = originalFetch
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
