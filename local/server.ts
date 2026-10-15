import { DatabaseSync } from "node:sqlite"
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto"
import type { Plugin } from "vite"
import { join } from "node:path"
import chatHandler from "../api/chat.ts"

// Deliberately local-only: this adapter is never included in the production build.
export function localPrototype(directory = ".local"): Plugin {
  mkdirSync(directory, { recursive: true })
  const db = new DatabaseSync(join(directory, "prototype.sqlite"))
  db.exec(
    `CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY(kind,id));`,
  )
  const get = (kind: string, id: string): any => {
    const row = db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id)
    return row ? JSON.parse(String(row.data)) : null
  }
  const all = (kind: string): any[] =>
    db.prepare("SELECT data FROM records WHERE kind=?")
      .all(kind)
      .map((r) => JSON.parse(String(r.data)))
  const put = (kind: string, id: string, data: any) =>
    db.prepare(
      "INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
    ).run(kind, id, JSON.stringify(data))
  const drop = (kind: string, id: string) =>
    db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id)
  const hash = (s: string) => createHash("sha256").update(s).digest("hex")
  const now = () => new Date().toISOString()
  const settings = () => get("settings", "access")
  const feedbackSettings = () => get("settings", "feedback") || { revision: 0, npsAfterMessages: 2 }
  const feedbackStatus = (userId: string) => {
    const events = all("events").filter(e => e.userId === userId)
    return {
      npsAfterMessages: feedbackSettings().npsAfterMessages,
      questionCount: events.filter(e => e.type === "question").length,
      npsCompleted: events.some(e => e.type === "nps"),
      ratedMessageIds: events.filter(e => e.type === "rating").map(e => e.messageId),
    }
  }
  if (!settings())
    put("settings", "access", {
      revision: 0,
      whitelistOnly: true,
      guestEnabled: false,
      emails: [],
    })
  if (!get("config", "current"))
    put("config", "current", {
      revision: 0,
      publishedSections: [],
      faqConfigs: [],
      answerConfigs: [],
      deliveryPlans: [],
    })
  const passwordPath = join(directory, "admin-password.txt")
  if (!existsSync(passwordPath))
    writeFileSync(passwordPath, randomBytes(18).toString("base64url"))
  const adminPassword = readFileSync(passwordPath, "utf8").trim()
  const day = (created: string) => {
    const midnight = (s: string) =>
      Date.parse(
        new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) +
          "T00:00:00Z",
      )
    return Math.max(
      1,
      Math.min(
        3,
        Math.floor((midnight(now()) - midnight(created)) / 86400000) + 1,
      ),
    )
  }
  const rate = new Map<string, number[]>()
  return {
    name: "local-prototype-api",
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next) => {
        const url = new URL(req.url || "/", "http://localhost:4173")
        if (!url.pathname.startsWith("/api/")) return next()
        const send = (status: number, data: any) => {
          res.statusCode = status
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(data))
        }
        res.setHeader("Cache-Control", "no-store")
        if (
          !["localhost:4173", "127.0.0.1:4173"].includes(req.headers.host || "")
        )
          return send(403, { error: "Local host required" })
        if (
          req.headers.origin &&
          !["http://localhost:4173", "http://127.0.0.1:4173"].includes(
            req.headers.origin,
          )
        )
          return send(403, { error: "Invalid origin" })
        if (req.headers["sec-fetch-site"] === "cross-site")
          return send(403, { error: "Invalid origin" })
        const cookie = (name: string) =>
          (req.headers.cookie || "")
            .split(";")
            .map((s: string) => s.trim())
            .find((s: string) => s.startsWith(name + "="))
            ?.slice(name.length + 1)
        const session = (name: string) => {
          const token = cookie(name)
          const s = token ? get("sessions", hash(token)) : null
          return s && s.expires > Date.now() ? s : null
        }
        const issue = (name: string, data: any) => {
          const token = randomBytes(32).toString("base64url")
          put("sessions", hash(token), {
            ...data,
            expires: Date.now() + 7 * 86400000,
          })
          res.setHeader(
            "Set-Cookie",
            `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
          )
        }
        const admin = session("rookie_admin")?.admin
        let body: any = {}
        try {
          if (["POST", "PUT", "PATCH"].includes(req.method)) {
            let text = ""
            for await (const part of req) {
              text += part
              if (Buffer.byteLength(text) > 1000000)
                return send(413, { error: "Payload too large" })
            }
            body = text ? JSON.parse(text) : {}
          }
          const route = url.pathname
          if (route === "/api/admin/login" && req.method === "POST") {
            const attempts = (rate.get("admin") || []).filter(
              (t) => t > Date.now() - 60000,
            )
            if (attempts.length >= 10)
              return send(429, { error: "กรุณารอหนึ่งนาที" })
            rate.set("admin", [...attempts, Date.now()])
            if (
              !timingSafeEqual(
                Buffer.from(hash(String(body.password))),
                Buffer.from(hash(adminPassword)),
              )
            )
              return send(401, { error: "รหัสผ่านไม่ถูกต้อง" })
            issue("rookie_admin", { admin: true })
            return send(200, { authenticated: true })
          }
          if (route === "/api/admin/logout") {
            const token = cookie("rookie_admin")
            if (token) drop("sessions", hash(token))
            res.setHeader(
              "Set-Cookie",
              "rookie_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
            )
            return send(200, {})
          }
          if (route.startsWith("/api/admin/") && !admin)
            return send(401, { error: "Unauthorized" })
          if (route === "/api/admin/session")
            return send(200, { authenticated: true })
          if (route === "/api/access" && req.method === "GET") {
            const s = settings()
            return send(200, {
              guestEnabled: s.guestEnabled,
              whitelistOnly: s.whitelistOnly,
              localMailbox: false,
              loginMethod: "access-code",
            })
          }
          if (route === "/api/admin/access") {
            if (req.method === "PUT") {
              const s = settings()
              if (body.revision !== s.revision)
                return send(409, { error: "มีการแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่" })
              if (
                typeof body.guestEnabled !== "boolean" ||
                typeof body.whitelistOnly !== "boolean" ||
                !Array.isArray(body.emails) ||
                body.emails.some(
                  (e: any) =>
                    typeof e !== "string" ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
                )
              )
                return send(400, { error: "กรุณาตรวจรูปแบบ email" })
              put("settings", "access", {
                revision: s.revision + 1,
                whitelistOnly: body.whitelistOnly,
                guestEnabled: body.guestEnabled,
                emails: [
                  ...new Set(
                    body.emails.map((e: string) => e.trim().toLowerCase()),
                  ),
                ],
              })
            } else if (req.method !== "GET") return send(405, {})
            return send(200, {
              ...settings(),
              users: all("users")
                .filter((u) => u.email)
                .map((u) => ({
                  email: u.email,
                  firstSeen: u.firstSeen,
                  lastSeen: u.lastSeen,
                })),
            })
          }
          if (route === "/api/admin/access-code" && req.method === "POST") {
            const email = String(body.email || "").trim().toLowerCase()
            if (!settings().emails.includes(email)) return send(400, { error: "บันทึก email ใน whitelist ก่อนสร้างรหัส" })
            const code = randomBytes(16).toString("base64url")
            put("access_codes", email, { digest: hash(code), updatedAt: now() })
            const existing = all("users").find(u => u.email === email)
            // Session records are keyed by token digest, not a public user ID.
            if (existing) db.prepare("DELETE FROM records WHERE kind='sessions' AND json_extract(data, '$.userId')=?").run(existing.id)
            for (const token of db.prepare("SELECT id FROM records WHERE kind='tokens' AND json_extract(data, '$.email')=?").all(email)) drop("tokens", String(token.id))
            return send(200, { email, code })
          }
          if (route === "/api/auth/code" && req.method === "POST") {
            const email = String(body.email || "").trim().toLowerCase()
            const key = `code:${email}`
            const attempts = (rate.get(key) || []).filter(t => t > Date.now() - 15 * 60000)
            if (attempts.length >= 5) return send(429, { error: "ลองเกินจำนวนครั้ง กรุณารอ 15 นาที" })
            rate.set(key, [...attempts, Date.now()])
            const credential = get("access_codes", email)
            const candidate = hash(String(body.code || ""))
            if (!settings().emails.includes(email) || !credential || !timingSafeEqual(Buffer.from(candidate), Buffer.from(credential.digest)))
              return send(401, { error: "email หรือรหัสเข้าใช้งานไม่ถูกต้อง" })
            rate.delete(key)
            let user = all("users").find(u => u.email === email)
            if (!user) user = { id: randomUUID(), email, firstSeen: now(), lastSeen: now(), state: {} }
            user.lastSeen = now()
            put("users", user.id, user)
            issue("rookie_player", { userId: user.id })
            return send(200, { ...user, day: day(user.firstSeen), ...feedbackStatus(user.id) })
          }
          if (route === "/api/admin/mailbox" && req.method === "GET")
            return send(200, {
              messages: all("mail")
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 20),
            })
          if (route === "/api/auth/email" && req.method === "POST") {
            const email = String(body.email || "")
              .trim()
              .toLowerCase()
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
              return send(400, { error: "กรุณากรอก email ให้ถูกต้อง" })
            const times = (rate.get(email) || []).filter(
              (t) => t > Date.now() - 60000,
            )
            if (times.length >= 3)
              return send(429, { error: "กรุณารอหนึ่งนาทีก่อนขอใหม่" })
            rate.set(email, [...times, Date.now()])
            const s = settings()
            if (!s.whitelistOnly || s.emails.includes(email)) {
              const token = randomBytes(32).toString("base64url")
              put("tokens", hash(token), {
                email,
                expires: Date.now() + 15 * 60000,
              })
              const id = randomUUID()
              put("mail", id, {
                id,
                email,
                createdAt: now(),
                link: `http://${req.headers.host}/?login_token=${token}`,
              })
            }
            return send(200, {
              message:
                "หาก email ได้รับสิทธิ์ ลิงก์จะอยู่ในกล่องอีเมลทดสอบของ Admin (local เท่านั้น)",
            })
          }
          if (route === "/api/auth/verify" && req.method === "POST") {
            const tokenHash = hash(String(body.token))
            const token = get("tokens", tokenHash)
            const s = settings()
            if (
              !token ||
              token.expires < Date.now() ||
              (s.whitelistOnly && !s.emails.includes(token.email))
            )
              return send(401, {
                error: "ลิงก์หมดอายุ ถูกใช้แล้ว หรือ email ไม่ได้รับสิทธิ์",
              })
            drop("tokens", tokenHash)
            let user = all("users").find((u) => u.email === token.email)
            if (!user) {
              user = {
                id: randomUUID(),
                email: token.email,
                firstSeen: now(),
                lastSeen: now(),
                state: {},
              }
            }
            user.lastSeen = now()
            put("users", user.id, user)
            issue("rookie_player", { userId: user.id })
            return send(200, { ...user, day: day(user.firstSeen), ...feedbackStatus(user.id) })
          }
          if (route === "/api/auth/guest" && req.method === "POST") {
            if (!settings().guestEnabled)
              return send(403, { error: "กรุณาเข้าสู่ระบบด้วย email" })
            const prior = session("rookie_player")
            let user = prior ? get("users", prior.userId) : null
            if (!user || user.email)
              user = {
                id: randomUUID(),
                email: null,
                firstSeen: now(),
                lastSeen: now(),
                state: {},
              }
            put("users", user.id, user)
            issue("rookie_player", { userId: user.id })
            return send(200, { ...user, day: day(user.firstSeen), ...feedbackStatus(user.id) })
          }
          if (route === "/api/auth/logout") {
            const token = cookie("rookie_player")
            if (token) drop("sessions", hash(token))
            res.setHeader(
              "Set-Cookie",
              "rookie_player=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
            )
            return send(200, {})
          }
          const ps = session("rookie_player")
          const user = ps ? get("users", ps.userId) : null
          const access = settings()
          const allowed =
            user &&
            (user.email
              ? !access.whitelistOnly || access.emails.includes(user.email)
              : access.guestEnabled)
          if (!admin && !allowed)
            return send(401, { error: "กรุณาเข้าสู่ระบบด้วย email ที่ได้รับสิทธิ์" })
          if (route === "/api/auth/session" && req.method === "GET") {
            if (!allowed) return send(401, {})
            user.lastSeen = now()
            put("users", user.id, user)
            return send(200, { ...user, day: day(user.firstSeen), ...feedbackStatus(user.id) })
          }
          if (route === "/api/admin/feedback-settings" && req.method === "GET")
            return send(200, feedbackSettings())
          if (route === "/api/admin/feedback-settings" && req.method === "PUT") {
            if (body.revision !== feedbackSettings().revision) return send(409, { error: "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่" })
            if (!Number.isInteger(body.npsAfterMessages) || body.npsAfterMessages < 1 || body.npsAfterMessages > 1000)
              return send(400, { error: "กรุณาระบุจำนวนข้อความ 1–1000" })
            const next = { revision: body.revision + 1, npsAfterMessages: body.npsAfterMessages }
            put("settings", "feedback", next)
            return send(200, next)
          }
          if (
            route === "/api/player/state" &&
            ["PUT", "POST"].includes(req.method) &&
            allowed
          ) {
            if (
              !body.state ||
              typeof body.state !== "object" ||
              Array.isArray(body.state)
            )
              return send(400, {})
            user.state = body.state
            put("users", user.id, user)
            return send(200, {})
          }
          if (route === "/api/config" && req.method === "GET")
            return send(200, get("config", "current"))
          if (route === "/api/admin/config" && req.method === "PUT") {
            const config = get("config", "current")
            if (config.revision !== body.expectedRevision)
              return send(409, { code: "REVISION_CONFLICT" })
            if (!["faq_content", "proactive_messages"].includes(body.section))
              return send(400, {})
            const p = body.payload
            if (
              !p ||
              (body.section === "faq_content"
                ? !Array.isArray(p.faqConfigs) ||
                  !Array.isArray(p.answerConfigs)
                : !Array.isArray(p.deliveryPlans))
            )
              return send(400, {})
            if (body.section === "faq_content") {
              config.faqConfigs = p.faqConfigs
              config.answerConfigs = p.answerConfigs
            } else config.deliveryPlans = p.deliveryPlans
            config.revision++
            config.updatedAt = now()
            config.publishedSections = [
              ...new Set([...config.publishedSections, body.section]),
            ]
            put("config", "current", config)
            put("versions", String(config.revision), {
              ...config,
              changedSection: body.section,
              createdAt: now(),
              createdBy: "local-admin",
              id: String(config.revision),
            })
            return send(200, config)
          }
          if (route === "/api/admin/config/versions") {
            if (req.method === "GET")
              return send(200, {
                versions: all("versions").sort(
                  (a, b) => b.revision - a.revision,
                ),
              })
            if (req.method !== "POST") return send(405, {})
            const current = get("config", "current")
            const selected = get("versions", String(body.revision))
            if (body.expectedRevision !== current.revision)
              return send(409, { code: "REVISION_CONFLICT" })
            if (!selected) return send(404, {})
            const saved = {
              ...selected,
              revision: current.revision + 1,
              updatedAt: now(),
              createdAt: now(),
              changedSection: "rollback",
              id: String(current.revision + 1),
            }
            put("config", "current", saved)
            put("versions", saved.id, saved)
            return send(200, saved)
          }
          if (route === "/api/events" && req.method === "POST" && allowed) {
            if (
              ![
                "question",
                "content_open",
                "rating",
                "nps",
                "system_error",
                "ai_unanswered",
                "knowledge",
                "ai",
              ].includes(body.type)
            )
              return send(400, {})
            if (
              body.type === "nps" &&
              (!Number.isInteger(body.value) ||
                body.value < 0 ||
                body.value > 10)
            )
              return send(400, {})
            if (
              body.type === "rating" &&
              !["like", "dislike"].includes(body.value)
            )
              return send(400, {})
            const id =
              body.type === "rating"
                ? `${user.id}:${String(body.messageId).slice(0, 80)}`
                : body.type === "nps"
                  ? `${user.id}:nps`
                  : randomUUID()
            put("events", id, {
              id,
              userId: user.id,
              createdAt: now(),
              type: body.type,
              value: body.value,
              text: String(body.text || "").slice(0, 2000),
              question: String(body.question || "").slice(0, 2000),
              messageId: body.messageId,
              conversationId: String(body.conversationId || "").slice(0, 80),
            })
            return send(201, {})
          }
          if (route === "/api/unanswered" && req.method === "POST" && allowed) {
            const q = String(body.question || "")
              .trim()
              .slice(0, 500)
            if (q.length < 2) return send(400, {})
            const normalized = q
              .normalize("NFKC")
              .toLowerCase()
              .replace(/[\s?!？！]+/g, "")
            const id = hash(normalized)
            const previous = get("questions", id)
            const saved = {
              id,
              question: q,
              onboardingDay: day(user.firstSeen),
              count: (previous?.count || 0) + 1,
              firstSeen: previous?.firstSeen || now(),
              lastSeen: now(),
              status: previous?.status || "new",
              relatedTopicId: previous?.relatedTopicId,
              recentContext: String(body.recentContext || "").slice(0, 1000),
            }
            put("questions", id, saved)
            const reportId = randomUUID()
            put("reports", reportId, {
              id: reportId,
              userId: user.id,
              question: q,
              questionId: id,
              createdAt: now(),
              reason: [
                "knowledge_gap",
                "ai_unanswered",
                "system_error",
              ].includes(body.reason)
                ? body.reason
                : "knowledge_gap",
            })
            return send(201, saved)
          }
          if (route === "/api/admin/unanswered") {
            if (req.method === "GET")
              return send(200, {
                questions: all("questions").sort((a, b) => b.count - a.count),
              })
            if (req.method === "PUT") {
              const q = get("questions", body.id)
              if (!q) return send(404, {})
              if (
                !["new", "reviewing", "content-added", "ignored"].includes(
                  body.status,
                )
              )
                return send(400, {})
              const saved = {
                ...q,
                status: body.status,
                relatedTopicId: body.relatedTopicId,
              }
              put("questions", body.id, saved)
              return send(200, saved)
            }
          }
          if (route === '/api/admin/feedback' && req.method === 'GET') {
            const days = [7, 30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 0;
            const since = days ? new Date(Date.now() - days * 86400000).toISOString() : '';
            const users = new Map(all('users').map(u => [u.id, u]));
            const rows = all('events').filter(e => ['rating', 'nps'].includes(e.type) && e.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(e => {
              const u = users.get(e.userId);
              const messages = u?.state?.messages || [];
              const index = messages.findIndex((m: any) => m.id === e.messageId);
              const question = e.question || (index >= 0 ? messages.slice(0, index).reverse().find((m: any) => m.role === 'user')?.text : '') || '';
              return { id: e.id, userId: e.userId, email: u?.email || '', type: e.type, value: e.value, question, text: e.text, createdAt: e.createdAt };
            });
            if (url.searchParams.get('format') === 'csv') {
              const cell = (v: unknown) => {
                let s = String(v ?? '');
                if (/^[\s\u0000-\u001f]*[=+@-]/u.test(s)) s = "'" + s;
                return '"' + s.replace(/"/g, '""') + '"';
              };
              const headers = ['date_utc', 'email', 'user_id', 'type', 'score', 'question', 'answer_or_note'];
              const csv = [headers, ...rows.map(r => [r.createdAt, r.email, r.userId, r.type, r.value, r.question, r.text])].map(r => r.map(cell).join(',')).join('\r\n');
              res.statusCode = 200; res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="rookie-feedback.csv"');
              return res.end('\uFEFF' + csv);
            }
            return send(200, { rows });
          }
          if (route === "/api/admin/analytics" && req.method === "GET") {
            const days = [7, 30].includes(Number(url.searchParams.get("days")))
              ? Number(url.searchParams.get("days"))
              : 0
            const since = days
              ? new Date(Date.now() - days * 86400000).toISOString()
              : ""
            const users = all("users").filter((u) => u.lastSeen >= since)
            const events = all("events").filter((e) => e.createdAt >= since)
            const reports = all("reports").filter((r) => r.createdAt >= since)
            const nps = events.filter((e) => e.type === "nps")
            const count = (type: string) =>
              events.filter((e) => e.type === type).length
            return send(200, {
              source: "Local SQLite — ข้อมูลการใช้งานจริงบนเครื่องนี้",
              users: users.filter((u) => u.email).length,
              guests: users.filter((u) => !u.email).length,
              conversations: new Set(
                events
                  .filter((e) => e.type === "question")
                  .map((e) => `${e.userId}:${e.conversationId}`),
              ).size,
              questions: count("question"),
              reports: reports.length,
              likes: events.filter(
                (e) => e.type === "rating" && e.value === "like",
              ).length,
              dislikes: events.filter(
                (e) => e.type === "rating" && e.value === "dislike",
              ).length,
              content: count("content_open"),
              knowledge: count("knowledge"),
              ai: count("ai"),
              errors: count("system_error"),
              npsCount: nps.length,
              nps: nps.length
                ? Math.round(
                    (100 *
                      (nps.filter((e) => e.value >= 9).length -
                        nps.filter((e) => e.value <= 6).length)) /
                      nps.length,
                  )
                : null,
            })
          }
          if (route === "/api/admin/insights" && req.method === "GET") {
            const groups = new Map<string, any>()
            const reports = all("reports")
            for (const q of all("questions")) {
              const key = q.relatedTopicId || q.id
              const group = groups.get(key) || {
                key,
                topicId: q.relatedTopicId,
                count: 0,
                questions: [],
                reasons: [],
              }
              group.count += q.count
              group.questions.push(q.question)
              group.reasons = [
                ...new Set([
                  ...group.reasons,
                  ...reports
                    .filter((r) => r.questionId === q.id)
                    .map((r) => r.reason),
                ]),
              ]
              groups.set(key, group)
            }
            return send(200, {
              groups: [...groups.values()].sort((a, b) => b.count - a.count),
              feedback: all("events")
                .filter((e) => ["rating", "nps"].includes(e.type))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 50),
            })
          }
          if (route === "/api/chat") {
            // Reuse the production protocol only after local host/origin/session checks.
            // Credentials remain in the server process, never in the browser response.
            const response = {
              setHeader: (name: string, value: string) => res.setHeader(name, value),
              status(code: number) { res.statusCode = code; return this },
              json(data: unknown) { send(res.statusCode || 200, data); return this },
            }
            await chatHandler(
              { method: req.method, body } as Parameters<typeof chatHandler>[0],
              response as unknown as Parameters<typeof chatHandler>[1],
            )
            return
          }
          return send(404, { error: "Endpoint not found" })
        } catch {
          return send(500, { error: "ไม่สามารถบันทึกหรืออ่านข้อมูลได้ กรุณาลองใหม่" })
        }
      })
    },
  }
}
