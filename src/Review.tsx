import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { CoachMascot, LanguageSwitcher, usePlayerLanguage } from './PlayerUI';
import { PUBLIC_TRIAL, trialRequest } from './publicTrial';

export async function request(path: string, body?: unknown, method?: string) {
  if (PUBLIC_TRIAL) {
    const local = trialRequest(path, body);
    if (local !== undefined) return local;
    if (path === '/api/unanswered') body = { ...(body as object), onboardingDay: (body as any)?.onboardingDay ?? trialRequest('/api/auth/session').day };
  }
  const response = await fetch(path, {
    method: method || (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (
      response.status === 401 &&
      !path.startsWith("/api/admin/") &&
      !path.startsWith("/api/auth/")
    )
      window.dispatchEvent(new Event("rookie-access-expired"))
    throw new Error(data.error || "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่")
  }
  if (path === "/api/events") window.dispatchEvent(new Event("rookie-feedback-updated"))
  return data
}

type Account = {
  id: string
  email: string | null
  firstSeen: string
  day: 1 | 2 | 3
  state: Record<string, any>
  questionCount?: number
  npsAfterMessages?: number
  npsCompleted?: boolean
  ratedMessageIds?: string[]
}
export const AccountContext = createContext<Account | null>(null)
const button =
  "rounded-lg border px-4 py-2 bg-white disabled:opacity-50 hover:bg-stone-100"
const field = "rounded-lg border p-3 bg-white w-full"
let accountBoot: Promise<{
  access: any
  account: Account | null
  error: string
}> | undefined

function initializeAccount() {
  if (!accountBoot)
    accountBoot = (async () => {
      const access = await request("/api/access")
      const url = new URL(window.location.href)
      const token = url.searchParams.get("login_token")
      if (token) {
        url.searchParams.delete("login_token")
        window.history.replaceState({}, "", url)
      }
      try {
        return {
          access,
          account: token
            ? await request("/api/auth/verify", { token })
            : await request("/api/auth/session"),
          error: "",
        }
      } catch (e) {
        return {
          access,
          account: null,
          error: token ? (e as Error).message : "",
        }
      }
    })()
  return accountBoot
}

export function AccountGate({ children, renderWelcome }: {
  children: ReactNode
  renderWelcome: (props: { onContinue: (segment: string) => void; onSignIn: () => void; busy: boolean; status: string }) => ReactNode
}) {
  const { t } = usePlayerLanguage()
  const [showLogin, setShowLogin] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [access, setAccess] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const expired = () => {
      setAccount(null)
      setShowLogin(true)
      setStatus("กรุณาเข้าสู่ระบบอีกครั้ง")
    }
    window.addEventListener("rookie-access-expired", expired)
    ;(async () => {
      try {
        const result = await initializeAccount()
        if (active) {
          setAccess(result.access)
          setAccount(result.account)
          setStatus(result.error)
        }
      } catch (e) {
        if (active) setStatus((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    const refreshAccount = () => {
      void request("/api/auth/session").then(u => {
        if (active) setAccount(prev => prev ? { ...prev, day: u.day, questionCount: u.questionCount, npsAfterMessages: u.npsAfterMessages, npsCompleted: u.npsCompleted, ratedMessageIds: u.ratedMessageIds } : prev)
      }).catch(() => {})
    }
    window.addEventListener("rookie-feedback-updated", refreshAccount)
    refreshAccount()
    const timer = window.setInterval(() => {
      void request("/api/access")
        .then((a) => {
          if (active) setAccess(a)
        })
        .catch(() => {})
      void request("/api/auth/session")
        .then((u) => {
          if (active)
            setAccount((prev) => (prev ? { ...prev, day: u.day, questionCount: u.questionCount, npsAfterMessages: u.npsAfterMessages, npsCompleted: u.npsCompleted, ratedMessageIds: u.ratedMessageIds } : prev))
        })
        .catch(() => {
          if (active) setAccount(null)
        })
    }, 15000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("rookie-feedback-updated", refreshAccount)
      window.removeEventListener("rookie-access-expired", expired)
    }
  }, [])
  async function finishAccess(user: Account, segment = selectedSegment) {
    const state = segment ? { ...user.state, segment } : user.state
    if (segment) await request('/api/player/state', { state }, 'PUT')
    const nextAccount = { ...user, state }
    accountBoot = Promise.resolve({ access, account: nextAccount, error: '' })
    setAccount(nextAccount)
  }
  async function continueFromWelcome(segment: string) {
    if (busy) return
    setSelectedSegment(segment)
    setStatus('')
    if (!access?.guestEnabled) { setShowLogin(true); return }
    setBusy(true)
    try { await finishAccess(await request('/api/auth/guest', {}), segment) }
    catch (e) { setStatus((e as Error).message) }
    finally { setBusy(false) }
  }
  if (account)
    return (
      <AccountContext.Provider value={account}>
        {children}
      </AccountContext.Provider>
    )
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        {t('กำลังตรวจสอบสิทธิ์…', 'Getting ready…')}
      </div>
    )
  if (!showLogin) return renderWelcome({ onContinue: continueFromWelcome, onSignIn: () => { setStatus(''); setShowLogin(true) }, busy, status })
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute top-5 right-5"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <CoachMascot className="w-24 h-24 mx-auto mb-4" />
          <p className="text-red-700 text-sm font-semibold">FCO Rookie Coach</p>
          <h1 className="text-2xl font-bold mt-2">{t('เข้าสู่ระบบเพื่อเริ่มคุย', 'Sign in to start chatting')}</h1>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setStatus("")
            try {
              const result = await request("/api/auth/code", { email, code })
              setCode("")
              await finishAccess(result)
            } catch (err) {
              setStatus((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <label className="block">
            {t('อีเมล', 'Email')}
            <input
              aria-label={t('อีเมล', 'Email')}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field + " mt-2"}
              placeholder="you@example.com"
            />
          </label>
          <label className="block">{t('รหัสเข้าใช้งาน', 'Access code')}<input aria-label={t('รหัสเข้าใช้งาน', 'Access code')} type="password" required autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} className={field + " mt-2"} placeholder={t('รหัสที่ได้รับจากทีมงาน', 'Code provided by the team')} /></label>
          <button
            disabled={busy || !access}
            className="rounded-lg bg-red-700 text-white p-3 w-full"
          >
            {busy ? t('กำลังเข้าสู่ระบบ…', 'Signing in…') : t('เข้าสู่ระบบ', 'Sign in')}
          </button>
        </form>
        {access?.guestEnabled && (
          <button
            className={button + " w-full"}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await finishAccess(await request("/api/auth/guest", {}))
              } catch (e) {
                setStatus((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('เข้าใช้งานโดยไม่ล็อกอิน', 'Continue as a guest')}
          </button>
        )}
        {access?.whitelistOnly && (
          <p className="text-sm text-stone-500 text-center">
            {t('สำหรับผู้ที่ได้รับเชิญเข้าทดสอบ', 'For invited testers')}
          </p>
        )}
        {status && (
          <p role="status" className="text-sm bg-white rounded-lg p-3 border">
            {status}
          </p>
        )}
        <button type="button" disabled={busy} className="w-full text-sm text-stone-500 hover:underline" onClick={() => setShowLogin(false)}>{t('กลับไปเลือกประเภทผู้เล่น', 'Back to player selection')}</button>
        {access?.localMailbox && (
          <p className="text-xs text-stone-500">
            Local test: รับลิงก์ที่ Admin → การเข้าถึง → กล่องอีเมลทดสอบ ยังไม่ส่งอีเมลภายนอก
          </p>
        )}
      </div>
    </div>
  )
}

export function AdminAccess() {
  const [config, setConfig] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [mail, setMail] = useState<any[]>([])
  const [issuedCode, setIssuedCode] = useState<{email: string; code: string} | null>(null)
  useEffect(() => {
    request("/api/admin/access")
      .then(setConfig)
      .catch((e) => setStatus(e.message))
  }, [])
  if (!config) return <div className="p-6">{status || "กำลังโหลด…"}</div>
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">การเข้าถึงเว็บไซต์</h2>
        <p className="text-sm text-stone-500 mt-1">
          กำหนดผู้เข้าทดสอบและการใช้งานแบบ guest
        </p>
      </div>
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <p className="text-sm text-stone-500">บันทึก whitelist แล้วสร้างรหัสเฉพาะคนเพื่อส่งส่วนตัว ไม่ต้องส่งอีเมลจากระบบ การรีเซ็ตจะยกเลิกรหัสและการเข้าสู่ระบบเดิมของคนนั้น</p>
        {issuedCode && <div className="border rounded-lg p-3 space-y-2"><p>รหัสสำหรับ {issuedCode.email} · แสดงครั้งนี้เท่านั้น</p><code className="break-all select-all">{issuedCode.code}</code><div className="flex gap-2"><button className={button} onClick={async () => { try { await navigator.clipboard.writeText(`Email: ${issuedCode.email}\nรหัสเข้าใช้งาน: ${issuedCode.code}`); setStatus('คัดลอกแล้ว กรุณาส่งส่วนตัว'); } catch { setStatus('กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง') } }}>คัดลอก</button><button className={button} onClick={() => setIssuedCode(null)}>ซ่อนรหัส</button></div></div>}
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={config.whitelistOnly}
            onChange={(e) =>
              setConfig({ ...config, whitelistOnly: e.target.checked })
            }
          />
          จำกัดเฉพาะ email ใน whitelist
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={config.guestEnabled}
            onChange={(e) =>
              setConfig({ ...config, guestEnabled: e.target.checked })
            }
          />
          เปิดปุ่ม “เริ่มใช้งาน” แบบไม่ล็อกอิน
        </label>
        {config.guestEnabled && config.whitelistOnly && (
          <p className="text-sm text-amber-700">
            Guest เปิดอยู่ ผู้ไม่มี email ใน whitelist ยังเข้าแบบ guest ได้
            หากต้องการเฉพาะผู้ได้รับเชิญ ให้ปิด guest
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const normalized = email.trim().toLowerCase()
            if (!config.emails.includes(normalized))
              setConfig({ ...config, emails: [...config.emails, normalized] })
            setEmail("")
            setStatus("มีการแก้ไขที่ยังไม่ได้บันทึก")
          }}
        >
          <input
            type="email"
            aria-label="เพิ่ม email ใน whitelist"
            placeholder="เพิ่ม email ผู้ทดสอบ"
            required
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={button}>เพิ่ม</button>
        </form>
        {config.emails.length === 0 && (
          <p className="text-stone-500">ยังไม่มี email ใน whitelist</p>
        )}
        {config.emails.map((e: string) => {
          const user = config.users?.find((u: any) => u.email === e)
          return (
            <div className="flex items-center gap-3 border-b py-3" key={e}>
              <span className="flex-1 break-all">{e}</span>
              <span className="text-sm text-stone-500">
                {user
                  ? `เข้าแล้ว ${new Date(user.lastSeen).toLocaleDateString("th-TH")}`
                  : "ยังไม่เข้าใช้งาน"}
              </span>
              <button
                aria-label={`ลบ ${e}`}
                className={button}
                onClick={() =>
                  setConfig({
                    ...config,
                    emails: config.emails.filter((x: string) => x !== e),
                  })
                }
              >
                ลบ
              </button>
              <button className={button} disabled={busy} onClick={async () => { if (!window.confirm(`สร้างรหัสใหม่สำหรับ ${e}? รหัสและ session เดิมจะใช้ไม่ได้`)) return; setBusy(true); setIssuedCode(null); try { setIssuedCode(await request('/api/admin/access-code', {email: e})); setStatus('สร้างรหัสแล้ว ส่งให้ผู้ทดสอบเป็นการส่วนตัว'); } catch(error) { setStatus((error as Error).message); } finally { setBusy(false) } }}>สร้าง / รีเซ็ตรหัส</button>
            </div>
          )
        })}
        <button
          className={button}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              setConfig(await request("/api/admin/access", config, "PUT"))
              setStatus("บันทึกแล้ว การตั้งค่ามีผลกับการเข้าใช้งานทันที")
            } catch (e) {
              setStatus((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? "กำลังบันทึก…" : "Save changes"}
        </button>
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
      </div>
      {false && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold">กล่องอีเมลทดสอบ · Local เท่านั้น</h3>
          <p className="text-sm text-stone-500">
            ใช้ทดสอบลิงก์ครั้งเดียวและการหมดอายุแทนการส่งอีเมลจริง ห้ามใช้กล่องนี้กับผู้ใช้ภายนอก
          </p>
          <button
            className={button}
            onClick={() =>
              request("/api/admin/mailbox")
                .then((d) => setMail(d.messages))
                .catch((e) => setStatus(e.message))
            }
          >
            โหลดอีเมลทดสอบ
          </button>
          {mail.map((m) => (
            <div key={m.id} className="border-t py-3">
              <p>{m.email}</p>
              <p className="text-xs text-stone-500">
                {new Date(m.createdAt).toLocaleString("th-TH")}
              </p>
              <a
                className="text-red-700 underline"
                href={m.link}
                target="_blank"
                rel="noreferrer"
              >
                เปิดลิงก์เข้าสู่ระบบ
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LiveOverview() {
  const [days, setDays] = useState("7")
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const load = () => {
    setRefresh(n => n + 1)
    setError("")
    request(`/api/admin/analytics?days=${days}`)
      .then(setStats)
      .catch((e) => {
        setStats(null)
        setError(e.message)
      })
  }
  useEffect(load, [days])
  const metrics = stats
    ? [
        ["บัญชีที่ยืนยันแล้ว", stats.users],
        ["Guest IDs", stats.guests],
        ["บทสนทนา", stats.conversations],
        ["คำถาม", stats.questions],
        ["ตอบจากฐานความรู้", stats.knowledge],
        ["ตอบด้วย AI", stats.ai],
        ["รายงานคำถาม", stats.reports],
        ["เปิดคอนเทนต์", stats.content],
        ["ชอบ", stats.likes],
        ["ไม่ชอบ", stats.dislikes],
        ["ระบบขัดข้อง", stats.errors],
        [`NPS · ${stats.npsCount} คนตอบ`, stats.nps ?? "ยังไม่มีข้อมูล"],
      ]
    : []
  return (
    <div className="p-6 overflow-y-auto flex-1 max-w-6xl">
      <div className="flex flex-wrap justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold">วัดผลการใช้งาน</h2>
          <p className="text-sm text-stone-500 mt-1">
            {stats?.source || "กำลังโหลดข้อมูลจริง"}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="ช่วงเวลา"
            className={button}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">7 วันล่าสุด</option>
            <option value="30">30 วันล่าสุด</option>
            <option value="0">ทั้งหมด</option>
          </select>
          <button className={button} onClick={load}>
            รีเฟรช
          </button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.filter(([label]) => label === 'ชอบ' || label === 'ไม่ชอบ' || String(label).startsWith('NPS')).map(([label, value]) => (
          <div className="border rounded-xl bg-white p-3" key={label}>
            <p className="text-sm text-stone-500">{label}</p>
            <p className="text-2xl font-semibold mt-3">{value}</p>
          </div>
        ))}
      </div>
      <FeedbackTable days={days} refresh={refresh} />
      <details className="mt-6 border rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold">สถิติการใช้งานเพิ่มเติม</summary><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{metrics.filter(([label]) => label !== 'ชอบ' && label !== 'ไม่ชอบ' && !String(label).startsWith('NPS')).map(([label, value]) => <div className="p-3" key={label}><p className="text-sm text-stone-500">{label}</p><p className="text-xl font-semibold mt-1">{value}</p></div>)}</div></details>
      <p className="text-sm text-stone-500 mt-5">
        จำนวนผู้ใช้ตามบัญชีหรือ guest ID ที่เข้ามาในช่วงที่เลือก • Guest ID
        ไม่เท่ากับจำนวนคนยืนยันตัวตน
      </p>
    </div>
  )
}

export function Rating({
  messageId,
  text,
  question,
  language = 'th',
}: {
  messageId: string
  text: string
  question: string
  language?: 'th' | 'en'
}) {
  const account = useContext(AccountContext)
  const [vote, setVote] = useState<string>("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  if (!account || vote || account.ratedMessageIds?.includes(messageId)) return null
  return (
    <div className="flex gap-2 items-center text-xs">
      <span className="text-stone-500">{language === 'en' ? 'Was this helpful?' : 'ช่วยได้ไหม?'}</span>
      {[
        ["like", language === 'en' ? 'Yes' : 'ชอบ'],
        ["dislike", language === 'en' ? 'No' : 'ไม่ชอบ'],
      ].map(([value, label]) => (
        <button
          key={value}
          disabled={busy}
          aria-pressed={vote === value}
          className={
            "rounded-full border px-3 py-1 " +
            (vote === value ? "bg-green-100" : "bg-white")
          }
          onClick={async () => {
            setBusy(true)
            try {
              await request("/api/events", {
                type: "rating",
                messageId,
                value,
                text,
                question,
              })
              setVote(value)
              setError("")
            } catch (e) {
              setError((e as Error).message)
            } finally { setBusy(false) }
          }}
        >
          {label}
        </button>
      ))}
      {error && <span role="alert">{error}</span>}
    </div>
  )
}


function FeedbackTable({ days, refresh }: { days: string; refresh: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    request(`/api/admin/feedback?days=${days}`).then(data => { if (active) { setRows(data.rows); setPage(0); } }).catch(e => { if (active) { setError(e.message); setRows([]); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, refresh]);
  async function download() {
    setDownloading(true);
    try {
      const response = await fetch(`/api/admin/feedback?days=${days}&format=csv`, { cache: 'no-store' });
      if (!response.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `rookie-feedback-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); } finally { setDownloading(false); }
  }
  return <section className="mt-8 border rounded-xl bg-white overflow-hidden"><div className="p-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">คะแนนจากผู้ใช้ทุกคน</h3><p className="text-sm text-stone-500">{rows.length} รายการในช่วงที่เลือก · คะแนนล่าสุดต่อคำตอบ / NPS ต่อบัญชี</p></div><button className={button} disabled={loading || downloading || !rows.length} onClick={download}>{downloading ? 'กำลังดาวน์โหลด…' : 'ดาวน์โหลด CSV'}</button></div>{error && <p role="alert" className="p-4 text-red-700">{error}</p>}{loading ? <p className="p-4">กำลังโหลดคะแนน…</p> : !rows.length ? <p className="p-4 text-stone-500">ยังไม่มีการให้คะแนนในช่วงนี้</p> : <><div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[900px]"><thead className="bg-stone-100"><tr>{['เวลา', 'ผู้ให้คะแนน', 'ประเภท / คะแนน', 'คำถาม', 'คำตอบที่ประเมิน / เหตุผล'].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(page*20, page*20+20).map(r => <tr className="border-t align-top" key={r.id}><td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('th-TH')}</td><td className="p-3"><p>{r.email || 'Guest'}</p><p className="text-xs text-stone-500 break-all">{r.userId}</p></td><td className="p-3 whitespace-nowrap">{r.type === 'nps' ? `NPS · ${r.value}/10` : r.value === 'like' ? '👍 ชอบ' : '👎 ไม่ชอบ'}</td><td className="p-3 min-w-44 whitespace-pre-wrap">{r.question || '—'}</td><td className="p-3 min-w-64 whitespace-pre-wrap">{r.text || '—'}</td></tr>)}</tbody></table></div><div className="p-4 flex items-center gap-3"><button className={button} disabled={page === 0} onClick={() => setPage(p => p-1)}>ก่อนหน้า</button><span>{page+1} / {Math.ceil(rows.length/20)}</span><button className={button} disabled={(page+1)*20 >= rows.length} onClick={() => setPage(p => p+1)}>ถัดไป</button><span className="text-xs text-stone-500">ดาวน์โหลดครบทุกรายการในช่วงวันที่เลือก</span></div></>}</section>;
}

export function Nps({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [score, setScore] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ประเมินการใช้งาน"
      className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4"
    >
      <div className="bg-white rounded-2xl p-6 max-w-lg space-y-4">
        <h2 className="font-semibold">
          คุณมีแนวโน้มจะแนะนำ Rookie Coach ให้เพื่อนมากแค่ไหน?
        </h2>
        <p className="text-sm text-stone-500">
          0 = ไม่แนะนำเลย · 10 = แนะนำแน่นอน
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              className={button + (score === n ? " !bg-green-100" : "")}
              aria-pressed={score === n}
              onClick={() => setScore(n)}
              key={n}
            >
              {n}
            </button>
          ))}
        </div>
        <textarea
          className={field}
          aria-label="เหตุผลการประเมิน"
          placeholder="เพราะอะไร? (ไม่จำเป็น)"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            disabled={score === null}
            className={button}
            onClick={async () => {
              try {
                await request("/api/events", {
                  type: "nps",
                  value: score,
                  text: note,
                })
                onDone()
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          >
            ส่งคะแนน
          </button>
          <button className={button} onClick={onClose}>
            ข้าม
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  )
}

export function NpsSettings() {
  const [settings, setSettings] = useState<{revision: number; npsAfterMessages: number} | null>(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { request('/api/admin/feedback-settings').then(setSettings).catch(e => setStatus(e.message)) }, [])
  return <section className="border rounded-xl bg-white p-4 space-y-3"><h3 className="font-semibold">แจ้งเตือนประเมิน NPS</h3><p className="text-sm text-stone-500">นับข้อความที่ผู้ใช้ส่งสะสม รวมการกดตัวเลือก ไม่รวมข้อความบอท · ประเมินหนึ่งครั้งต่อผู้ใช้</p>{settings && <><label className="flex items-center gap-3 text-sm">แสดงหลังผู้ใช้ส่งข้อความครบ<input aria-label="จำนวนข้อความก่อนแสดง NPS" className="border rounded-lg p-2 w-24" type="number" min={1} max={1000} value={settings.npsAfterMessages} onChange={e => { setSettings({...settings, npsAfterMessages: Number(e.target.value)}); setStatus('') }} />ข้อความ</label><button className={button} disabled={busy || !Number.isInteger(settings.npsAfterMessages) || settings.npsAfterMessages < 1 || settings.npsAfterMessages > 1000} onClick={async () => { setBusy(true); try { setSettings(await request('/api/admin/feedback-settings', settings, 'PUT')); setStatus('บันทึกแล้ว'); } catch(e) { setStatus((e as Error).message) } finally { setBusy(false) } }}>{busy ? 'กำลังบันทึก…' : 'Save changes'}</button></>}{status && <p role="status" className="text-sm">{status}</p>}</section>
}
