import { useState, useRef, useEffect } from "react";
import { MessageCircle, LogOut, Send, Globe, Play, Calendar, BookOpen, GitBranch, Eye, Search, ExternalLink, Clock, LockKeyhole } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = "player";
type PlayerTab = "chat" | "notifications";
type ChipMode = "diagnose" | "deeper" | "post-video" | "want-tip";
type Day = 1 | 2 | 3;

interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  topicId?: string;
}

interface KnowledgeItem {
  id: string;
  topicId: string;
  title: string;
  category: string;
  audience: string;
  durationSec: number;
  shortSummary: string;
  keywords: string[];
  youtubeUrl: string;
  thumbnailUrl?: string;
  qaStatus: "needs_review" | "transcript_pending" | "approved";
  sourceUpdatedAt: string;
  source: string;
  timeSensitive?: boolean;
  sourceDateLabel?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "separator";
  text: string;
  steps?: string[];
  knowledgeId?: string;
  aiSource?: "AI-INsea" | "mock";
  relatedIds?: string[];
  showDiscord?: boolean;
  reportQuestion?: string;
}


interface ContentFlow {
  id: string;
  topicId: string;
  entryQuestion: string;
  branches: ContentBranch[];
}

interface ContentBranch {
  id: string;
  flowId: string;
  trigger: "choice" | "keyword" | "free_text" | "fallback";
  triggerValue?: string;
  action: "ask_followup" | "send_content" | "send_related" | "ai_fallback" | "escalate";
  message?: string;
  nextQuestion?: string;
  targetTopicId?: string;
  escalationLabel?: string;
}

type DeliveryDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type DeliveryChannel = "notification" | "chat";

interface DailyDeliveryPlan {
  id: string;
  day: DeliveryDay;
  channel: DeliveryChannel;
  availableTime: string;
  message: string;
  contentId?: string;
  status: "active" | "draft";
}

type AdminTab = "daily-delivery" | "content-library" | "content-flows" | "unanswered" | "preview";

interface ReportedQuestion {
  id: string;
  question: string;
  onboardingDay: DeliveryDay;
  relatedTopicId?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: "new" | "reviewing" | "content-added" | "ignored";
  recentContext: string;
}

// ── Metadata constants ─────────────────────────────────────────────────────────

export const KNOWLEDGE_SOURCE_TITLE = "[FCO] Educational hub knowledge";
export const KNOWLEDGE_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1tEPi1p5VZ5qkm2I6FKthm2TJ4i-uAFPDNpW5fzLb5YA/edit?gid=0#gid=0";
export const KNOWLEDGE_SYNC_RUN = "RUN-20260828-01";
export const KNOWLEDGE_SYNCED_AT = "2026-08-28T10:50:26.777Z";
export const KNOWLEDGE_SOURCE_TOPIC_COUNT = 48;
export const KNOWLEDGE_TOPIC_COUNT = 48;

// ── Knowledge items ────────────────────────────────────────────────────────────

const KNOWLEDGE: KnowledgeItem[] = [
  // ── Preferred (thumbnail, dedup-priority) ──────────────────────────────────
  {
    id: "passing",
    topicId: "FCO-EDU-043",
    title: "ส่งบอลมีกี่วิธี",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 75,
    shortSummary: "สรุปวิธีจ่ายบอลพื้นฐาน 3 รูปแบบและสถานการณ์ใช้งาน",
    keywords: ["ส่งบอล", "จ่ายบอล", "แทง", "เปิดบอล", "passing"],
    youtubeUrl: "https://youtu.be/MfXuFcwWMW0",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/7cdb63cf-88dd-4155-ba99-bea523061e7d.png",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-15T11:36:21.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "defending",
    topicId: "FCO-EDU-044",
    title: "เกมรับ สไลด์/จ๊อกกี้/เข้าสกัด",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 56,
    shortSummary: "สรุปพื้นฐานเกมรับ ได้แก่ สไลด์ จ๊อกกี้ และการเข้าสกัด",
    keywords: ["เกมรับ", "สไลด์", "จ๊อกกี้", "เข้าสกัด", "defending"],
    youtubeUrl: "https://youtu.be/uJV8WoUvDCo",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/f6517347-0455-4489-a9f5-23891fe32c81.png",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-16T12:04:18.643Z",
    source: "FC Online Education Hub",
  },
  {
    id: "dribbling",
    topicId: "FCO-EDU-045",
    title: "วิธีเลี้ยงบอล",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 35,
    shortSummary: "สอนพื้นฐานการเลี้ยงบอลและการควบคุมทิศทาง",
    keywords: ["เลี้ยงบอล", "ควบคุมทิศทาง", "dribbling"],
    youtubeUrl: "https://youtu.be/pSGV7mzMCWs",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/8786a984-fb8f-4ddd-b82a-ab38c35d11fb.png",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-16T04:34:16.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "shooting",
    topicId: "FCO-EDU-001",
    title: "วิธียิงคม",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 29,
    shortSummary: "สอนแนวทางจบสกอร์ให้คมขึ้น ทั้งการยิงปกติและการยิงปั่นตามสถานการณ์",
    keywords: ["ยิง", "ยิงคม", "จบสกอร์", "shooting"],
    youtubeUrl: "https://youtu.be/k1Xk7uOGu7M",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/72deee3a-2232-4780-80ce-74cf755735e8.jpg",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-08T03:00:24.071Z",
    source: "FC Online Education Hub",
  },
  {
    id: "welcome-pass",
    topicId: "FCO-EDU-007",
    title: "Welcome To FCO Pass",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 25,
    shortSummary: "แนะนำ Welcome Pass และรางวัลสำหรับผู้เล่นใหม่",
    keywords: ["welcome pass", "pass", "รางวัล", "1 bp"],
    youtubeUrl: "https://youtu.be/Af0rdn_1aQk",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/2b80806a-716a-46de-858d-9c998eb2e377.jpg",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T11:27:32.464Z",
    source: "FC Online Education Hub",
  },
  {
    id: "controller",
    topicId: "FCO-EDU-030",
    title: "เชื่อมจอยเล่นบนคอม",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 17,
    shortSummary: "แนะนำวิธีเชื่อมต่อจอยเพื่อเล่น FC Online บนคอมพิวเตอร์",
    keywords: ["จอย", "controller", "เชื่อมจอย", "ตั้งค่าจอย"],
    youtubeUrl: "https://youtu.be/nDZtAeDBdMw",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/e49ad109-0b77-4a24-ae93-d7dd8dd344b1.jpg",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:36:16.706Z",
    source: "FC Online Education Hub",
  },
  {
    id: "qss",
    topicId: "FCO-EDU-041",
    title: "ทีมฟรีจาก QSS",
    category: "เล่นด่วน",
    audience: "general",
    durationSec: 34,
    shortSummary: "แนะนำการจัดทีมฟรีจาก QSS สำหรับผู้เล่นที่เพิ่งเริ่มต้น",
    keywords: ["qss", "ทีมฟรี", "ทีมเริ่มต้น"],
    youtubeUrl: "https://youtu.be/umx4PwXwAkI",
    thumbnailUrl:
      "https://cdn-webth.garenanow.com/webth/cdn/fco/educationhub-live/video-thumbnail/0b6a72d6-b330-46af-a5f0-c99abb354f81.png",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-16T12:07:02.431Z",
    source: "FC Online Education Hub",
  },
  // ── Text-only (no thumbnail) ───────────────────────────────────────────────
  {
    id: "passing-basic",
    topicId: "FCO-EDU-002",
    title: "วิธีการส่ง",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 37,
    shortSummary: "อธิบายหลักการจ่ายบอลให้ปลอดภัย ลดการส่งเสีย และเลือกพื้นที่จ่ายที่เหมาะสม",
    keywords: ["ส่ง", "จ่ายบอล"],
    youtubeUrl: "https://youtu.be/Shsd0jh_VRQ",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-07T11:48:24.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "dribbling-basic",
    topicId: "FCO-EDU-003",
    title: "วิธีการเลี้ยง",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 26,
    shortSummary: "แนะนำการควบคุมและเลี้ยงบอลเพื่อเปลี่ยนทิศทางได้ลื่นไหลขึ้น",
    keywords: ["เลี้ยง", "dribble"],
    youtubeUrl: "https://youtu.be/gtJzPt0jIlE",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-03T04:02:20.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "attack",
    topicId: "FCO-EDU-004",
    title: "3 ขั้นตอนเกมรุก",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 20,
    shortSummary: "สรุปแนวคิดเกมรุก 3 ขั้นตอนสำหรับสร้างโอกาสทำประตู",
    keywords: ["เกมรุก", "สร้างโอกาส", "attack"],
    youtubeUrl: "https://youtu.be/2DWufwK3Lzs",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T12:27:17.871Z",
    source: "FC Online Education Hub",
  },
  {
    id: "defending-basic",
    topicId: "FCO-EDU-005",
    title: "วิธีเล่นเกมรับ",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 54,
    shortSummary: "แนะนำทริคเกมรับพื้นฐานเพื่อชะลอเกม ตัดบอล และลดการเสียประตู",
    keywords: ["ป้องกัน", "ตัดบอล", "defend"],
    youtubeUrl: "https://youtu.be/6S441RBaYF4",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T11:37:13.118Z",
    source: "FC Online Education Hub",
  },
  {
    id: "goalkeeper",
    topicId: "FCO-EDU-006",
    title: "ขยับบังโกล",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 34,
    shortSummary: "อธิบายการขยับผู้รักษาประตูเพื่อปิดมุมยิงในจังหวะสำคัญ",
    keywords: ["โกล", "ผู้รักษาประตู", "ขยับโกล", "goalkeeper"],
    youtubeUrl: "https://youtu.be/SsSsCjoPF44",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T11:35:43.612Z",
    source: "FC Online Education Hub",
  },
  {
    id: "forwards",
    topicId: "FCO-EDU-008",
    title: "3 กองหน้าราคาถูก",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 36,
    shortSummary: "แนะนำกองหน้าราคาประหยัด 3 ตัวสำหรับเริ่มจัดทีม",
    keywords: ["กองหน้า", "นักเตะราคาถูก", "จัดทีม"],
    youtubeUrl: "https://youtu.be/QYnj7Y3aB3k",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T11:39:56.549Z",
    source: "FC Online Education Hub",
  },
  {
    id: "untrade",
    topicId: "FCO-EDU-009",
    title: "Untrade คืออะไร",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 19,
    shortSummary: "อธิบายความหมายของนักเตะหรือไอเทม Untrade และข้อจำกัดในการซื้อขาย",
    keywords: ["untrade", "ขายไม่ได้", "ไอเทม"],
    youtubeUrl: "https://youtu.be/z63PZoSi9DE",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T12:04:55.152Z",
    source: "FC Online Education Hub",
  },
  {
    id: "transfer-market",
    topicId: "FCO-EDU-010",
    title: "Transfer Market",
    category: "แนะนำผู้เล่นใหม่",
    audience: "beginner",
    durationSec: 45,
    shortSummary: "แนะนำการใช้งาน Transfer Market เพื่อค้นหา ซื้อ และขายนักเตะ",
    keywords: ["transfer market", "ตลาดนักเตะ", "ซื้อ", "ขาย"],
    youtubeUrl: "https://youtu.be/i9dTl9JIcVw",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-05T12:22:24.919Z",
    source: "FC Online Education Hub",
  },
  {
    id: "ranking",
    topicId: "FCO-EDU-016",
    title: "Ranking 1v1",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 27,
    shortSummary: "แนะนำโหมด Ranking 1v1 และภาพรวมการไต่ระดับ",
    keywords: ["ranking", "rank", "1v1", "จัดอันดับ"],
    youtubeUrl: "https://youtu.be/VTaEY9nbqM8",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:38:38.434Z",
    source: "FC Online Education Hub",
  },
  {
    id: "mission-hub",
    topicId: "FCO-EDU-018",
    title: "Mission Hub",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 22,
    shortSummary: "แนะนำ Mission Hub สำหรับตรวจภารกิจและรับรางวัล",
    keywords: ["mission hub", "ภารกิจ", "รับรางวัล"],
    youtubeUrl: "https://youtu.be/vEae-Lg2XEg",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:38:15.298Z",
    source: "FC Online Education Hub",
  },
  {
    id: "camera",
    topicId: "FCO-EDU-029",
    title: "มุมกล้องทั้งหมดใน FC Online",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 40,
    shortSummary: "อธิบายตัวเลือกมุมกล้องใน FC Online เพื่อเลือกมุมที่เหมาะกับการเล่น",
    keywords: ["กล้อง", "มุมกล้อง", "camera"],
    youtubeUrl: "https://youtu.be/L8Eyy8dbooM",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T12:04:50.111Z",
    source: "FC Online Education Hub",
  },
  // ── 30 additional topics (FCO-EDU-011–048, excluding existing 18) ─────────
  {
    id: "locker-room",
    topicId: "FCO-EDU-011",
    title: "Locker Room",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 53,
    shortSummary: "อธิบายเมนู Locker Room สำหรับปรับแต่งรูปลักษณ์และอุปกรณ์",
    keywords: ["Locker Room", "ล็อกเกอร์", "ชุด", "รูปลักษณ์"],
    youtubeUrl: "https://youtu.be/5Xs7xJ7WcNc",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-03T03:56:13.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "player-role",
    topicId: "FCO-EDU-012",
    title: "บทบาทนักเตะ",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 41,
    shortSummary: "อธิบายบทบาทนักเตะและผลต่อพฤติกรรมในสนาม",
    keywords: ["บทบาทนักเตะ", "player role", "บทบาท"],
    youtubeUrl: "https://youtu.be/FaObv0IhaUM",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-03T03:45:47.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "fp",
    topicId: "FCO-EDU-013",
    title: "FP คืออะไร?",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 34,
    shortSummary: "อธิบาย FP หรือ Fantasy Point และการใช้งานภายในเกม",
    keywords: ["FP", "Fantasy Point"],
    youtubeUrl: "https://youtu.be/z8r7wow-p0k",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:28:40.023Z",
    source: "FC Online Education Hub",
  },
  {
    id: "protection-card",
    topicId: "FCO-EDU-014",
    title: "การ์ดกันแตก",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 23,
    shortSummary: "อธิบายการ์ดกันแตกและการใช้เพื่อลดความเสี่ยงในการเสริมพลัง",
    keywords: ["การ์ดกันแตก", "กันแตก", "เสริมพลัง"],
    youtubeUrl: "https://youtu.be/A4Y2LuHcF5I",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:42:46.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "tax-coupon",
    topicId: "FCO-EDU-015",
    title: "คูปองลดภาษี",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 25,
    shortSummary: "อธิบายคูปองลดภาษีและการใช้เพื่อลดค่าธรรมเนียมจากการขาย",
    keywords: ["คูปองลดภาษี", "ภาษี", "ค่าธรรมเนียม"],
    youtubeUrl: "https://youtu.be/swRvNKmgMcg",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:29:35.265Z",
    source: "FC Online Education Hub",
  },
  {
    id: "trend-center",
    topicId: "FCO-EDU-017",
    title: "Trend Center",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 22,
    shortSummary: "อธิบาย Trend Center สำหรับดูแนวโน้มและข้อมูลนักเตะ",
    keywords: ["Trend Center", "trend", "แนวโน้มนักเตะ"],
    youtubeUrl: "https://youtu.be/s1pNVqIVG-s",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:30:15.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "lucky-wheel",
    topicId: "FCO-EDU-019",
    title: "Lucky Wheel",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 20,
    shortSummary: "แนะนำ Lucky Wheel และขั้นตอนเข้าร่วมกิจกรรมหมุนวงล้อ",
    keywords: ["Lucky Wheel", "วงล้อ", "หมุนวงล้อ"],
    youtubeUrl: "https://youtu.be/Hol-TMGa9MI",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:37:55.823Z",
    source: "FC Online Education Hub",
  },
  {
    id: "acrobatic-finisher",
    topicId: "FCO-EDU-020",
    title: "นิสัยทอง Acrobatic Finisher",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 26,
    shortSummary: "อธิบายคุณสมบัติ Acrobatic Finisher และสถานการณ์ที่มีผล",
    keywords: ["Acrobatic Finisher", "นิสัยทอง", "finisher"],
    youtubeUrl: "https://youtu.be/891dHsHJ8vg",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:35:18.752Z",
    source: "FC Online Education Hub",
  },
  {
    id: "commander",
    topicId: "FCO-EDU-021",
    title: "นิสัยทอง Commander",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 29,
    shortSummary: "อธิบายคุณสมบัติ Commander และบทบาทที่เกี่ยวข้องในทีม",
    keywords: ["Commander", "นิสัยทอง", "ผู้บัญชาการ"],
    youtubeUrl: "https://youtu.be/g6CsqVnTbIc",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:36:03.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "plus8-trait",
    topicId: "FCO-EDU-022",
    title: "นิสัยพิเศษนักเตะ +8",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 30,
    shortSummary: "อธิบายคุณสมบัติพิเศษของนักเตะระดับเสริมพลัง +8",
    keywords: ["นิสัยพิเศษ", "+8", "นักเตะ +8"],
    youtubeUrl: "https://youtu.be/XCZhrx0JUl0",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T12:34:43.235Z",
    source: "FC Online Education Hub",
  },
  {
    id: "bp",
    topicId: "FCO-EDU-023",
    title: "BP",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 20,
    shortSummary: "อธิบาย BP ซึ่งเป็นสกุลเงินหลักสำหรับซื้อขายและใช้งานในเกม",
    keywords: ["BP", "เหรียญ BP", "เงินในเกม"],
    youtubeUrl: "https://youtu.be/IE0atM9QxSs",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:16:35.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "cp",
    topicId: "FCO-EDU-024",
    title: "CP",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 23,
    shortSummary: "อธิบาย CP และช่องทางใช้งานที่เกี่ยวข้อง",
    keywords: ["CP", "เหรียญ CP"],
    youtubeUrl: "https://youtu.be/5uvyeRMtWFM",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:41:24.086Z",
    source: "FC Online Education Hub",
  },
  {
    id: "sc",
    topicId: "FCO-EDU-025",
    title: "SC",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 22,
    shortSummary: "อธิบาย SC และช่องทางใช้งานที่เกี่ยวข้อง",
    keywords: ["SC", "เหรียญ SC"],
    youtubeUrl: "https://youtu.be/71UYLnHCzTs",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-03T04:09:26.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "sp",
    topicId: "FCO-EDU-026",
    title: "SP",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 44,
    shortSummary: "อธิบาย SP หรือ Star Point และช่องทางใช้งานที่เกี่ยวข้อง",
    keywords: ["SP", "Star Point"],
    youtubeUrl: "https://youtu.be/bDKC4mlNEHY",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-03T03:35:54.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "tc",
    topicId: "FCO-EDU-027",
    title: "TC",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 20,
    shortSummary: "อธิบาย TC และช่องทางใช้งานที่เกี่ยวข้อง",
    keywords: ["TC", "เหรียญ TC"],
    youtubeUrl: "https://youtu.be/5yRlgibdrbc",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:44:44.248Z",
    source: "FC Online Education Hub",
  },
  {
    id: "shop",
    topicId: "FCO-EDU-028",
    title: "Shop",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 24,
    shortSummary: "แนะนำเมนู Shop และแนวทางเลือกซื้อไอเทม",
    keywords: ["Shop", "ร้านค้า", "ซื้อไอเทม"],
    youtubeUrl: "https://youtu.be/-Z0NEJENB8I",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:38:59.630Z",
    source: "FC Online Education Hub",
  },
  {
    id: "redeem-code",
    topicId: "FCO-EDU-031",
    title: "กรอกโค้ด FC Online",
    category: "ข้อมูลพิ้นฐาน",
    audience: "general",
    durationSec: 18,
    shortSummary: "แนะนำขั้นตอนกรอก Redeem Code ของ FC Online",
    keywords: ["กรอกโค้ด", "redeem code", "code"],
    youtubeUrl: "https://youtu.be/NLJKZL2xl0E",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:45:35.051Z",
    source: "FC Online Education Hub",
  },
  {
    id: "tactic-training",
    topicId: "FCO-EDU-032",
    title: "การฝึกแทคติก",
    category: "จัดทีมแบบโปร",
    audience: "general",
    durationSec: 21,
    shortSummary: "อธิบายระบบฝึกแทคติกเพื่อปรับแนวทางการเล่นของทีม",
    keywords: ["ฝึกแทคติก", "แทคติก", "tactic training"],
    youtubeUrl: "https://youtu.be/KEql_FTSwJg",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T12:35:46.759Z",
    source: "FC Online Education Hub",
  },
  {
    id: "special-training",
    topicId: "FCO-EDU-033",
    title: "การฝึกพิเศษ",
    category: "จัดทีมแบบโปร",
    audience: "general",
    durationSec: 34,
    shortSummary: "อธิบายระบบฝึกพิเศษเพื่อพัฒนาความสามารถนักเตะ",
    keywords: ["ฝึกพิเศษ", "special training"],
    youtubeUrl: "https://youtu.be/iinXyVKX42A",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:26:22.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "training-coach",
    topicId: "FCO-EDU-034",
    title: "โค้ชฝึกฝน",
    category: "จัดทีมแบบโปร",
    audience: "general",
    durationSec: 31,
    shortSummary: "อธิบายโค้ชฝึกฝนและวิธีนำมาใช้กับทีม",
    keywords: ["โค้ชฝึกฝน", "training coach", "โค้ช"],
    youtubeUrl: "https://youtu.be/zuZNz3h6kew",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T12:04:33.706Z",
    source: "FC Online Education Hub",
  },
  {
    id: "cheap-french-defenders",
    topicId: "FCO-EDU-035",
    title: "3กองหลังฝรั่งเศษ ราคาถูก",
    category: "จัดทีมแบบโปร",
    audience: "general",
    durationSec: 37,
    shortSummary: "แนะนำกองหลังฝรั่งเศสราคาประหยัด 3 ตัวสำหรับจัดทีม",
    keywords: ["กองหลังฝรั่งเศส", "กองหลังราคาถูก", "จัดทีม"],
    youtubeUrl: "https://youtu.be/CZAaO0imS7M",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:21:57.667Z",
    source: "FC Online Education Hub",
  },
  {
    id: "pro-turn",
    topicId: "FCO-EDU-036",
    title: "Pro กลับตัวหลอกหลังหัก Attaclex",
    category: "เล่นแบบโปร",
    audience: "general",
    durationSec: 61,
    shortSummary: "สอนเทคนิคกลับตัวหลอกคู่แข่งเพื่อสร้างพื้นที่ในเกมรุก",
    keywords: ["กลับตัวหลอก", "Attaclex", "หลอกหลังหัก"],
    youtubeUrl: "https://youtu.be/hL1tf9M3LpM",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:26:26.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "creative-run",
    topicId: "FCO-EDU-037",
    title: "Pro Creative Run Attaclex",
    category: "เล่นแบบโปร",
    audience: "general",
    durationSec: 66,
    shortSummary: "สอน Creative Run เพื่อสั่งการวิ่งและเพิ่มทางเลือกในเกมรุก",
    keywords: ["Creative Run", "Attaclex", "สั่งวิ่ง"],
    youtubeUrl: "https://youtu.be/tAG1ZjqgSg8",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:20:30.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "ball-roll",
    topicId: "FCO-EDU-038",
    title: "Pro Ball Roll JubJub",
    category: "เล่นแบบโปร",
    audience: "general",
    durationSec: 61,
    shortSummary: "สอนทักษะ Ball Roll เพื่อหลบคู่แข่งและรักษาการครองบอล",
    keywords: ["Ball Roll", "JubJub", "สกิลเลี้ยง"],
    youtubeUrl: "https://youtu.be/32rp7VMkEX8",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T11:39:23.736Z",
    source: "FC Online Education Hub",
  },
  {
    id: "shield-ball",
    topicId: "FCO-EDU-039",
    title: "เทคนิคบังบอล",
    category: "เล่นแบบโปร",
    audience: "general",
    durationSec: 22,
    shortSummary: "สอนเทคนิคบังบอลเพื่อรักษาการครองบอลเมื่อถูกกดดัน",
    keywords: ["บังบอล", "shield ball", "ครองบอล"],
    youtubeUrl: "https://youtu.be/Spw-gtiKb9k",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-07-05T12:04:23.841Z",
    source: "FC Online Education Hub",
  },
  {
    id: "july-update",
    topicId: "FCO-EDU-040",
    title: "อัปเดตเดือนกรกฎาคม By Mr. John",
    category: "คอนเทนต์อัปเดต",
    audience: "general",
    durationSec: 193,
    shortSummary: "สรุปอัปเดตเดือนกรกฎาคมโดย Mr. John — ข้อมูลตามแพตช์ช่วงเวลาที่เผยแพร่",
    keywords: ["อัปเดตเดือนกรกฎาคม", "แพตช์กรกฎาคม", "Mr. John", "แพตช์ 26.06"],
    youtubeUrl: "https://youtu.be/ZejPiAR25oQ",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-08-28T10:50:26.777Z",
    source: "FC Online Education Hub",
    timeSensitive: true,
    sourceDateLabel: "อัปเดตเดือนกรกฎาคม 2569",
  },
  {
    id: "two-button-dribble",
    topicId: "FCO-EDU-042",
    title: "Pro เลี้ยง 2 ปุ่ม TD Keane",
    category: "เล่นแบบโปร",
    audience: "general",
    durationSec: 75,
    shortSummary: "สอนการเลี้ยงบอลแบบสองปุ่มโดย TD Keane",
    keywords: ["เลี้ยง 2 ปุ่ม", "TD Keane", "dribble"],
    youtubeUrl: "https://youtu.be/hLr201Nxbt0",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-16T11:52:33.000Z",
    source: "FC Online Education Hub",
  },
  {
    id: "august-update",
    topicId: "FCO-EDU-046",
    title: "อัปเดตเดือนสิงหามีอะไรบ้างมาดู!",
    category: "คอนเทนต์อัปเดต",
    audience: "general",
    durationSec: 156,
    shortSummary: "สรุปอัปเดตเดือนสิงหาคม 2569 — FP เพิ่มเป็น 310, Spartans, Ranking Master, ตลาดนักเตะ",
    keywords: ["อัปเดตเดือนสิงหาคม", "อัปเดตสิงหาคม", "สิงหาคม 2569", "อัปเดตสิงหาคม 2569", "FP 310", "Spartans", "Ranking Master", "ตลาดนักเตะ"],
    youtubeUrl: "https://youtu.be/_Tl_MH-yUow",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-07-31T05:33:34-07:00",
    source: "FC Online Education Hub",
    timeSensitive: true,
    sourceDateLabel: "อัปเดตเดือนสิงหาคม 2569",
  },
  {
    id: "weekly-update-10-aug",
    topicId: "FCO-EDU-047",
    title: "อัปเดตรายสัปดาห์ที่ 10 สิงหามีอะไรบ้าง!",
    category: "คอนเทนต์อัปเดต",
    audience: "general",
    durationSec: 118,
    shortSummary: "รวมกิจกรรม ข่าวสาร และอัปเดต FC Online ประจำสัปดาห์ 10–16 สิงหาคม 2569",
    keywords: ["อัปเดตรายสัปดาห์ 10 สิงหาคม", "อัปเดต 10 สิงหาคม", "ข่าว 10-16 สิงหาคม", "อัปเดตรายสัปดาห์", "10 สิงหาคม 2569", "10-16 สิงหาคม", "กิจกรรม", "ข่าวสาร FC Online"],
    youtubeUrl: "https://youtu.be/5okNEGdnStM",
    qaStatus: "transcript_pending",
    sourceUpdatedAt: "2026-08-10T02:04:56-07:00",
    source: "FC Online Education Hub",
    timeSensitive: true,
    sourceDateLabel: "10–16 สิงหาคม 2569",
  },
  {
    id: "september-update",
    topicId: "FCO-EDU-048",
    title: "อัปเดตแพตช์ใหม่ ประจำเดือนกันยายน",
    category: "คอนเทนต์อัปเดต",
    audience: "general",
    durationSec: 289,
    shortSummary: "สรุปแพตช์ 24 สิงหาคม 2569 — BP, Team Color, เสื้อคู่แข่ง, Challenger, Discord, QSS, Pro League Summer 2026",
    keywords: ["อัปเดตเดือนกันยายน", "แพตช์เดือนกันยายน", "อัปเดต 24 สิงหาคม", "แพตช์ 24 สิงหาคม", "อัปเดตแพตช์ 24 สิงหาคม 2569", "กันยายน", "Team Color", "เสื้อคู่แข่ง", "Challenger", "Discord", "Pro League Summer 2026"],
    youtubeUrl: "https://youtu.be/saEaZRVXyA8",
    qaStatus: "needs_review",
    sourceUpdatedAt: "2026-08-23T00:00:01-07:00",
    source: "FC Online Education Hub",
    timeSensitive: true,
    sourceDateLabel: "แพตช์ 24 สิงหาคม 2569",
  },
];

function findKnowledge(id: string): KnowledgeItem | undefined {
  return KNOWLEDGE.find((k) => k.id === id);
}

// Short pure-ASCII keywords (≤3 chars: BP, CP, SC, SP, TC, FP) require a
// complete token match so "pass" or "special" don't accidentally match "sp".
function kwMatches(kw: string, q: string): boolean {
  const lower = kw.toLowerCase();
  if (lower.length <= 3 && /^[a-z0-9]+$/.test(lower)) {
    return new RegExp(`(?:^|[^a-z0-9])${lower}(?=$|[^a-z0-9])`, "i").test(q);
  }
  return q.includes(lower);
}

function matchKnowledge(text: string): KnowledgeItem | undefined {
  const q = text.toLowerCase();
  type Candidate = { item: KnowledgeItem; exact: number; count: number; maxLen: number };
  let best: Candidate | null = null;

  KNOWLEDGE.forEach((item) => {
    const exact =
      q.includes(item.title.toLowerCase()) || kwMatches(item.id, q) ? 1 : 0;
    const matched = item.keywords.filter((kw) => kwMatches(kw, q));
    if (!exact && matched.length === 0) return;
    const count = matched.length;
    const maxLen = count > 0 ? Math.max(...matched.map((kw) => kw.length)) : 0;
    if (
      !best ||
      exact > best.exact ||
      (exact === best.exact && count > best.count) ||
      (exact === best.exact && count === best.count && maxLen > best.maxLen)
    ) {
      best = { item, exact, count, maxLen };
    }
  });

  return best ? (best as Candidate).item : undefined;
}

function formatDuration(sec: number): string {
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} น.`;
  }
  return `${sec} วิ`;
}

// ── Canned answers ─────────────────────────────────────────────────────────────

type CannedAnswer = { text: string; steps?: string[]; source?: string };

const CANNED: Record<string, CannedAnswer> = {
  controller: {
    text: "ต่อจอยกับคอมแล้วเข้าเมนู ควบคุม เพื่อตั้งค่า",
    steps: ["เสียบจอย USB หรือเชื่อม Bluetooth", "เลือกแผนปุ่ม Classic", "ทดลองในสนามฝึก"],
    source: "FC Online Education Hub",
  },
  "welcome-pass": {
    text: "ใช้ 1 BP รับทีมเริ่มต้นพร้อมเดินหน้าได้เลย",
    steps: ["เข้าเมนู Welcome Pass", "จ่าย 1 BP", "รับทีมและไอเทมเริ่มต้น"],
    source: "FC Online Education Hub",
  },
  "mode-start": {
    text: "มือใหม่แนะนำ Kick-Off หรือ Season Mode ก่อน",
    steps: [
      "เลือก Kick-Off สำหรับเกมด่วน",
      "ลอง Season Mode เพื่อความต่อเนื่อง",
      "หลีกเลี่ยง Rivals จนกว่าจะชำนาญ",
    ],
    source: "FC Online Education Hub",
  },
  passing: {
    text: "มี 3 วิธีส่งบอลหลัก ใช้ให้ถูกสถานการณ์",
    steps: ["กด A/X ส่งพื้น", "กด Y/△ เปิดสูง", "กด LB/L1 ส่งทะลุช่อง"],
    source: "FC Online Education Hub",
  },
  dribbling: {
    text: "เลี้ยงบอลพื้นฐานให้หลุดคูตั้งแต่แรก",
    steps: ["กด LT/L2 ค้างปกป้องบอล", "เขย่าอนาล็อกซ้ายเพื่อเลี้ยง", "กด B/○ ค้างสำหรับ Sprint"],
    source: "FC Online Education Hub",
  },
  shooting: {
    text: "จบสกอร์ง่ายขึ้นด้วยจังหวะและทิศทาง",
    steps: ["กด B/○ เพื่อยิง", "เล็งด้วยอนาล็อกซ้าย", "ยิงในระยะ 16 หลาเพื่อโอกาสสูงสุด"],
    source: "FC Online Education Hub",
  },
  defending: {
    text: "รับให้แน่นด้วย Jockey และเวลาสกัดที่ถูกต้อง",
    steps: ["กด LT/L2 ค้างเพื่อ Jockey", "กด B/○ เพื่อเข้าสกัด", "กด X/□ เพื่อ Slide Tackle"],
    source: "FC Online Education Hub",
  },
  qss: {
    text: "QSS คือทีมพร้อมใช้ฟรี ไม่ต้องสร้างเอง",
    steps: ["เข้าเมนู Quick Squad Select", "เลือกทีมที่ชื่นชอบ", "ลงสนามได้ทันที"],
    source: "FC Online Education Hub",
  },
  ranking: {
    text: "แนะนำฝึกขั้นพื้นฐานให้ครบก่อน แล้วค่อยลง Ranking",
    steps: ["ฝึกจนชนะ Kick-Off ได้บ้าง", "ทำความเข้าใจระบบ BP", "เริ่ม Division Rivals เมื่อพร้อม"],
    source: "FC Online Education Hub",
  },
};

const FALLBACK: CannedAnswer = {
  text: "ลองบอกให้ชัดขึ้นได้เลยครับ เช่น ตั้งค่าจอย หรือ ส่งบอล",
  source: "FC Online Education Hub",
};

function getCannedAnswer(cannedKey: string, knowledge?: KnowledgeItem): CannedAnswer {
  const direct = CANNED[cannedKey];
  const base: CannedAnswer = direct
    ? direct
    : knowledge
      ? { text: knowledge.shortSummary, source: knowledge.source }
      : FALLBACK;
  if (knowledge?.timeSensitive) {
    return {
      ...base,
      text: base.text + "\n\nข้อมูลตามช่วงเวลา • ตรวจสอบเวอร์ชันล่าสุดก่อนใช้งาน",
    };
  }
  return base;
}

// ── Day plan configuration ─────────────────────────────────────────────────────

const MASCOT =
  "https://images.unsplash.com/photo-1740252117044-2af197eea287?w=120&h=120&fit=crop&auto=format";

const CURRENT_DAY: Day = 2;


const DAY_DIAGNOSTIC: Record<Day, string> = {
  1: "วันนี้คุณตั้งค่าเกมเสร็จแล้วหรือยัง?",
  2: "วันนี้คุณส่งบอลเป็นหรือยัง?",
  3: "วันนี้เริ่มทำภารกิจรับ BP แล้วหรือยัง?",
};

const FALLBACK_RELATED_IDS = ["dribbling", "shooting", "defending", "qss", "controller"];

let _uidSeq = 0;
function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${++_uidSeq}-${Math.random().toString(36).slice(2)}`;
}

// ── KnowledgeCard ──────────────────────────────────────────────────────────────

function KnowledgeCard({ item }: { item: KnowledgeItem }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {item.thumbnailUrl ? (
        <a
          href={item.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative"
          style={{ aspectRatio: "16/9", backgroundColor: "var(--muted)", display: "block" }}
          aria-label={`ดูวิดีโอ: ${item.title}`}
        >
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            style={{ display: "block" }}
          />
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            >
              <Play size={16} style={{ color: "#fff", marginLeft: "2px" }} aria-hidden />
            </div>
          </div>
        </a>
      ) : null}

      <div className="px-3 py-2.5 flex flex-col gap-1">
        <p className="text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>
          {item.title}
        </p>
        {item.thumbnailUrl ? (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {item.shortSummary}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {formatDuration(item.durationSec)}
          </p>
        )}
        {item.timeSensitive && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            ข้อมูลตามช่วงเวลา • ตรวจสอบเวอร์ชันล่าสุดก่อนใช้งาน
          </p>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {item.source}
            {item.sourceDateLabel ? ` • ${item.sourceDateLabel}` : ""}
          </p>
          <a
            href={item.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--primary)" }}
          >
            ดูวิดีโอ
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Composer ───────────────────────────────────────────────────────────────────

function Composer({
  input,
  setInput,
  onSend,
  textareaRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.currentTarget;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-end gap-2 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="ติดปัญหาอะไร ถามผมได้เลยครับ"
          rows={1}
          className="flex-1 resize-none text-sm bg-transparent py-1"
          style={{ color: "var(--foreground)", outline: "none", maxHeight: "120px", lineHeight: "1.6" }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim()}
          aria-label="ส่งข้อความ"
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30 hover:opacity-80"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Send size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ── LoginScreen ────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);

  function simulate() {
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 700);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="w-full max-w-xs flex flex-col items-center gap-7">
        <div
          className="w-20 h-20 rounded-full overflow-hidden shrink-0"
          style={{ backgroundColor: "var(--muted)" }}
        >
          <img
            src={MASCOT}
            alt="FCO Rookie Coach mascot"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        <div className="text-center space-y-1">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--primary)" }}
          >
            FCO Rookie Coach
          </p>
          <h1 className="text-2xl font-bold leading-snug" style={{ color: "var(--foreground)" }}>
            เริ่มเล่นให้มั่นใจขึ้น
          </h1>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={simulate}
            className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Globe size={16} aria-hidden />
            เข้าสู่ระบบด้วย Google
          </button>

          <button
            onClick={simulate}
            disabled={loading}
            className="w-full h-11 rounded-lg flex items-center justify-center text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "ทดลองใช้งาน"}
          </button>

        </div>
      </div>
    </div>
  );
}

// ── Admin gateway ─────────────────────────────────────────────────────────────

type AdminSessionState = "checking" | "signed-out" | "authenticated" | "unconfigured";

function AdminLoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.code === "ADMIN_NOT_CONFIGURED" ? "ระบบหลังบ้านยังไม่ได้ตั้งค่า" : "รหัสผ่านไม่ถูกต้อง");
        return;
      }

      setPassword("");
      onAuthenticated();
    } catch {
      setError("เชื่อมต่อระบบหลังบ้านไม่ได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-7" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>
          <LockKeyhole size={20} aria-hidden />
        </div>
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--primary)" }}>FCO Rookie Coach</p>
        <h1 className="text-xl font-bold mt-1" style={{ color: "var(--foreground)" }}>เข้าสู่ระบบหลังบ้าน</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>สำหรับทีมงานที่ได้รับอนุญาตเท่านั้น</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-xs font-medium" htmlFor="admin-password" style={{ color: "var(--foreground)" }}>รหัสผ่าน Admin</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full h-11 rounded-lg border px-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
            placeholder="กรอกรหัสผ่าน"
          />
          {error ? <p role="alert" className="text-xs" style={{ color: "var(--primary)" }}>{error}</p> : null}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full h-11 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบหลังบ้าน"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Notification mock data ─────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    title: "ยินดีต้อนรับสู่ FCO Rookie Coach!",
    body: "เริ่มต้นด้วยการเรียนรู้พื้นฐานการส่งบอล แค่ 5 นาทีก็เล่นได้มั่นใจขึ้นแล้ว",
    time: "วันนี้ 09:00",
    read: true,
    topicId: "passing",
  },
  {
    id: "notif-2",
    title: "เคล็ดลับ: ควบคุมปุ่มให้คล่อง",
    body: "รู้จักปุ่มพื้นฐานทั้งหมดก่อนลงสนาม จะช่วยให้คุณตัดสินใจได้เร็วขึ้นมากในเกม",
    time: "เมื่อวาน 10:30",
    read: false,
    topicId: "controller",
  },
  {
    id: "notif-3",
    title: "ภารกิจสะสม BP พร้อมแล้ว!",
    body: "ทำ Squad Battle และ Rivals เพื่อรับ BP สะสมเสริมความแข็งแกร่งให้ทีมได้เลย",
    time: "เมื่อวาน 18:00",
    read: false,
  },
];

// ── CoachScreen ────────────────────────────────────────────────────────────────

function CoachScreen({
  onLogout,
  onReportQuestion,
}: {
  onLogout: () => void;
  onReportQuestion: (question: string, recentContext: string) => void;
}) {
  const day = CURRENT_DAY;

  const [activeTab, setActiveTab] = useState<PlayerTab>("chat");
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chipMode, setChipMode] = useState<ChipMode | null>("diagnose");
  const [shownTopicIds, setShownTopicIds] = useState<Set<string>>(new Set<string>());
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [reportedQueries, setReportedQueries] = useState<Set<string>>(new Set<string>());

  const hasUnread = notifications.some((n) => !n.read);

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setExpandedNotifId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    setMessages([
      { id: uid(), role: "assistant", text: DAY_DIAGNOSTIC[day] },
    ]);
    setChipMode("diagnose");
    setShownTopicIds(new Set<string>());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function append(msgs: Omit<Message, "id">[]) {
    setMessages((prev) => [...prev, ...msgs.map((m) => ({ ...m, id: uid() }))]);
  }

  function botDelay(fn: () => void, ms = 800) {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); fn(); }, ms);
  }

  function showTopic(id: string) {
    setShownTopicIds((prev) => new Set([...prev, id]));
  }

  // ─ Diagnose chips ─────────────────────────────────────────────────────────

  function handleCanDo() {
    setChipMode(null);
    append([{ role: "user", text: "ทำได้แล้ว" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "เก่งมากเลยครับ!\nเวลาโดนบีบ คุณเลือกส่งแบบไหน?" }]);
      setChipMode("deeper");
    });
  }

  function handleWantMore() {
    setChipMode(null);
    append([{ role: "user", text: "อยากรู้เพิ่ม" }]);
    sendPassingContent();
  }

  function handleNotSure() {
    setChipMode(null);
    append([{ role: "user", text: "ยังไม่แน่ใจ" }]);
    sendPassingContent();
  }

  function sendPassingContent() {
    const topic = findKnowledge("passing");
    botDelay(() => {
      showTopic("passing");
      append([
        { role: "assistant", text: topic?.shortSummary ?? "", knowledgeId: "passing" },
        { role: "assistant", text: "หลังดูแล้ว ยังติดตรงไหนไหม?" },
      ]);
      setChipMode("post-video");
    });
  }

  // ─ Deeper passing chips ───────────────────────────────────────────────────

  function handlePassShort() {
    setChipMode(null);
    append([{ role: "user", text: "ส่งสั้น" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "ส่งสั้นถูกต้องเลยครับ กด A/X แล้วกดเบา ๆ ผู้รับจะวิ่งมารับเอง อยากรู้เพิ่มอีกไหม?" }]);
      setChipMode("want-tip");
    }, 600);
  }

  function handleThroughBall() {
    setChipMode(null);
    append([{ role: "user", text: "แทงทะลุช่อง" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "ถูกต้องเลยครับ LB/L1 + A/X เล็งที่ช่องว่าง ไม่ใช่ตัวผู้รับ รอผู้รับเริ่มวิ่งก่อนค่อยกด อยากรู้เพิ่มอีกไหม?" }]);
      setChipMode("want-tip");
    }, 600);
  }

  function handleCantChoose() {
    setChipMode(null);
    append([{ role: "user", text: "ยังเลือกไม่ถูก" }]);
    const alreadyShown = shownTopicIds.has("passing");
    botDelay(() => {
      if (!alreadyShown) showTopic("passing");
      append([
        { role: "assistant", text: "กฎง่าย ๆ ครับ: ผู้รับอยู่ใกล้ → กด A/X, อยู่ไกล → กด Y/△, มีช่องว่าง → LB/L1 + A/X แค่นี้พอสำหรับมือใหม่" },
        ...(!alreadyShown ? [{ role: "assistant" as const, text: "", knowledgeId: "passing" }] : []),
      ]);
    });
  }

  function handleWantTip() {
    setChipMode(null);
    append([{ role: "user", text: "ได้เลย" }]);
    const alreadyShown = shownTopicIds.has("passing");
    botDelay(() => {
      if (!alreadyShown) showTopic("passing");
      append([
        { role: "assistant", text: "กดปุ่มค้างนานขึ้นจะส่งแรงขึ้น กดสั้น ๆ จะส่งเบา ฝึกกะแรงในสนามฝึกก่อนใช้จริงครับ" },
        ...(!alreadyShown ? [{ role: "assistant" as const, text: "", knowledgeId: "passing" }] : []),
      ]);
    }, 600);
  }

  function handleNoTip() {
    setChipMode(null);
    append([{ role: "user", text: "ไม่เป็นไร" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "โอเคครับ ลองไปฝึกในเกมได้เลย มีอะไรสงสัยพิมพ์ถามได้ตลอดนะ" }]);
    }, 500);
  }

  // ─ Post-video chips ───────────────────────────────────────────────────────

  function handleUnderstood() {
    setChipMode(null);
    append([{ role: "user", text: "เข้าใจแล้ว" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "เยี่ยมเลยครับ ลองนำไปใช้ในเกมได้เลย มีอะไรสงสัยพิมพ์ถามได้ตลอดนะ" }]);
    }, 500);
  }

  function handleConfusedButton() {
    setChipMode(null);
    append([{ role: "user", text: "งงเรื่องปุ่ม" }]);
    const relatedId = shownTopicIds.has("controller") ? undefined : "controller";
    botDelay(() => {
      if (relatedId) showTopic(relatedId);
      append([{
        role: "assistant",
        text: "ปุ่มหลัก: A/X ส่งพื้น • Y/△ เปิดสูง • LB/L1 ส่งทะลุช่อง\nลองกดทีละอันในสนามฝึกก่อนนะครับ",
        knowledgeId: relatedId,
      }]);
    }, 600);
  }

  function handleConfusedTiming() {
    setChipMode(null);
    append([{ role: "user", text: "งงเรื่องจังหวะ" }]);
    const relatedId = shownTopicIds.has("dribbling") ? undefined : "dribbling";
    botDelay(() => {
      if (relatedId) showTopic(relatedId);
      append([{
        role: "assistant",
        text: "จังหวะดี: รอผู้รับวิ่งเปิดตัวก่อน ดูทิศทาง แล้วค่อยกด อย่าส่งทันทีที่ถือบอล\nคลิปนี้ช่วยเรื่อง spacing ด้วยครับ",
        knowledgeId: relatedId,
      }]);
    }, 600);
  }

  function handleAskMore() {
    setChipMode(null);
    append([{ role: "user", text: "ถามเพิ่ม" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "ลองบอกผมหน่อยว่างงตรงไหนครับ" }]);
      setTimeout(() => composerRef.current?.focus(), 200);
    }, 500);
  }

  // ─ Free-text send ─────────────────────────────────────────────────────────

  async function answerQuestion(question: string) {
    const matched = matchKnowledge(question);
    if (matched) {
      const knowledge = findKnowledge(matched.id);
      const answer = getCannedAnswer(matched.id, knowledge);
      const alreadyShown = shownTopicIds.has(matched.id);
      if (!alreadyShown) showTopic(matched.id);
      setTimeout(() => {
        setIsTyping(false);
        append([{
          role: "assistant",
          text: answer.text,
          steps: answer.steps,
          knowledgeId: alreadyShown ? undefined : matched.id,
        }]);
      }, 550);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, conversationId }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.answer !== "string" || !result.answer.trim()) {
        throw new Error("AI fallback unavailable");
      }

      if (typeof result.conversationId === "string") {
        setConversationId(result.conversationId);
      }
      setIsTyping(false);
      append([{ role: "assistant", text: result.answer.trim(), aiSource: "AI-INsea" }]);
    } catch {
      const relatedIds = FALLBACK_RELATED_IDS.filter((id) => !shownTopicIds.has(id)).slice(0, 2);
      relatedIds.forEach((id) => showTopic(id));
      setIsTyping(false);
      append([{
        role: "assistant",
        text: "ค้นจากฐานความรู้ 48 หัวข้อแล้ว ยังไม่เจอคำตอบตรง ๆ\nลองดูคลิปที่เกี่ยวข้อง หรือส่งคำถามนี้ให้ทีมเพิ่มข้อมูลได้ครับ",
        aiSource: "mock",
        relatedIds: relatedIds.length > 0 ? relatedIds : undefined,
        showDiscord: true,
        reportQuestion: question,
      }]);
    }
  }

  function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setChipMode(null);
    append([{ role: "user", text }]);
    setIsTyping(true);
    void answerQuestion(text);
  }

  function sendFaq(question: string) {
    setActiveTab("chat");
    setInput("");
    setChipMode(null);
    append([{ role: "user", text: question }]);
    setIsTyping(true);
    void answerQuestion(question);
  }

  const FAQ_CHIPS = [
    "ส่งบอลยังไง",
    "เล่นเกมรับยังไง",
    "ยิงยังไงให้คม",
    "เชื่อมจอยยังไง",
  ];

  const chipSets: Record<NonNullable<ChipMode>, { label: string; action: () => void }[]> = {
    diagnose: [
      { label: "ทำได้แล้ว", action: handleCanDo },
      { label: "อยากรู้เพิ่ม", action: handleWantMore },
      { label: "ยังไม่แน่ใจ", action: handleNotSure },
    ],
    deeper: [
      { label: "ส่งสั้น", action: handlePassShort },
      { label: "แทงทะลุช่อง", action: handleThroughBall },
      { label: "ยังเลือกไม่ถูก", action: handleCantChoose },
    ],
    "post-video": [
      { label: "เข้าใจแล้ว", action: handleUnderstood },
      { label: "งงเรื่องปุ่ม", action: handleConfusedButton },
      { label: "งงเรื่องจังหวะ", action: handleConfusedTiming },
      { label: "ถามเพิ่ม", action: handleAskMore },
    ],
    "want-tip": [
      { label: "ได้เลย", action: handleWantTip },
      { label: "ไม่เป็นไร", action: handleNoTip },
    ],
  };

  const activeChips = chipMode ? chipSets[chipMode] : [];

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      {/* Desktop left nav */}
      <nav
        aria-label="เมนูหลัก"
        className="hidden md:flex flex-col w-48 shrink-0 border-r py-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
      >
        <div className="px-5 mb-6">
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "var(--primary)" }}>
            FCO Rookie
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-0.5 px-2">
          <button
            onClick={() => setActiveTab("chat")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium min-h-[44px] w-full transition-colors"
            style={{
              color: activeTab === "chat" ? "var(--primary)" : "var(--foreground)",
              backgroundColor: activeTab === "chat" ? "rgba(196,30,30,0.07)" : "transparent",
            }}
            onMouseEnter={(e) => { if (activeTab !== "chat") e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { if (activeTab !== "chat") e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <MessageCircle size={18} aria-hidden />
            โค้ช
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium min-h-[44px] w-full transition-colors"
            style={{
              color: activeTab === "notifications" ? "var(--primary)" : "var(--foreground)",
              backgroundColor: activeTab === "notifications" ? "rgba(196,30,30,0.07)" : "transparent",
            }}
            onMouseEnter={(e) => { if (activeTab !== "notifications") e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { if (activeTab !== "notifications") e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <span className="relative flex-shrink-0">
              <Clock size={18} aria-hidden />
              {hasUnread && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
              )}
            </span>
            แจ้งเตือน
          </button>
        </div>

        <div className="px-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm w-full min-h-[44px] transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <LogOut size={16} aria-hidden />
            ออกจากระบบ
          </button>
        </div>
      </nav>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center px-4 md:px-6 py-3 shrink-0 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
              โค้ชมือใหม่
            </span>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              ถามเรื่องเกม ทีม และรางวัลได้เลย
            </span>
          </div>
        </header>

        {/* ── Notification inbox ───────────────────────────────────────────── */}
        {activeTab === "notifications" && (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 pb-[calc(1.25rem+56px)] md:pb-5">
            <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>แจ้งเตือน</h2>
            <div className="flex flex-col gap-2 max-w-lg">
              {notifications.map((notif) => {
                const isExpanded = expandedNotifId === notif.id;
                const linkedTopic = notif.topicId ? findKnowledge(notif.topicId) : undefined;
                return (
                  <button
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    className="w-full text-left rounded-xl px-4 py-3 transition-colors"
                    style={{
                      backgroundColor: notif.read ? "var(--card)" : "rgba(196,30,30,0.05)",
                      border: `1px solid ${notif.read ? "var(--border)" : "rgba(196,30,30,0.2)"}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="relative mt-0.5 flex-shrink-0">
                        <Clock size={16} style={{ color: notif.read ? "var(--muted-foreground)" : "var(--primary)" }} aria-hidden />
                        {!notif.read && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-sm font-medium leading-snug"
                            style={{ color: notif.read ? "var(--foreground)" : "var(--foreground)", fontWeight: notif.read ? 400 : 600 }}
                          >
                            {notif.title}
                          </span>
                          <span className="text-[11px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{notif.time}</span>
                        </div>
                        {isExpanded ? (
                          <div className="mt-2 flex flex-col gap-3">
                            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{notif.body}</p>
                            {linkedTopic && <KnowledgeCard item={linkedTopic} />}
                          </div>
                        ) : (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{notif.body}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chat view ───────────────────────────────────────────────────── */}
        {activeTab === "chat" && (
          <>
            {/* Message timeline */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 flex flex-col gap-3">
              {messages.map((msg) => {
                if (msg.role === "separator") {
                  return (
                    <div key={msg.id} className="flex items-center justify-center my-2">
                      <span
                        className="text-xs px-3 py-1 rounded-full"
                        style={{ color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}
                      >
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div
                        className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm"
                        style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                // assistant
                const topic = msg.knowledgeId ? findKnowledge(msg.knowledgeId) : undefined;
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[85%] md:max-w-lg flex flex-col gap-2">
                      {msg.aiSource && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit"
                          style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
                        >
                          {msg.aiSource === "AI-INsea" ? "AI แนะนำ • AI-INsea" : "AI แนะนำ • ยังไม่ได้เชื่อมต่อ"}
                        </span>
                      )}
                      {msg.text ? (
                        <div
                          className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm"
                          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                        >
                          <p style={{ whiteSpace: "pre-line" }}>{msg.text}</p>
                          {msg.steps && (
                            <ol className="flex flex-col gap-1.5 mt-2.5">
                              {msg.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                                  >
                                    {i + 1}
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ) : null}
                      {topic ? <KnowledgeCard item={topic} /> : null}
                      {msg.relatedIds?.map((rid) => {
                        const relTopic = findKnowledge(rid);
                        return relTopic ? <KnowledgeCard key={rid} item={relTopic} /> : null;
                      })}
                      {msg.showDiscord && (
                        <a
                          href="#"
                          className="text-xs transition-opacity hover:opacity-60"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          ยังไม่ตรง? ถามชุมชน FC Online Discord →
                        </a>
                      )}
                      {msg.reportQuestion && (() => {
                        const q = msg.reportQuestion!;
                        const alreadyReported = reportedQueries.has(q);
                        return (
                          <button
                            disabled={alreadyReported}
                            onClick={() => {
                              if (alreadyReported) return;
                              setReportedQueries((prev) => new Set([...prev, q]));
                              const ctx = messages
                                .filter((m) => m.role === "user")
                                .slice(-3)
                                .map((m) => m.text)
                                .join(" → ");
                              onReportQuestion(q, ctx);
                              append([{ role: "assistant", text: "ส่งคำถามให้ทีมแล้ว ขอบคุณครับ" }]);
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border transition-colors w-fit"
                            style={{
                              borderColor: alreadyReported ? "var(--border)" : "var(--border)",
                              color: alreadyReported ? "var(--muted-foreground)" : "var(--foreground)",
                              backgroundColor: "transparent",
                              cursor: alreadyReported ? "default" : "pointer",
                              opacity: alreadyReported ? 0.6 : 1,
                            }}
                          >
                            {alreadyReported ? "ส่งคำถามให้ทีมแล้ว" : "รายงานคำถามนี้ให้ทีม"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex gap-1 items-center h-6 px-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: "var(--muted-foreground)", animationDelay: `${i * 140}ms`, display: "inline-block" }}
                    />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Chips + Composer footer */}
            <div
              className="px-4 md:px-6 pt-3 pb-[calc(0.75rem+56px)] md:pb-5 flex flex-col gap-2 shrink-0"
              style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}
            >
              <div className="max-w-2xl mx-auto w-full flex flex-col gap-2">
                {/* FAQ strip — always visible */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)" }}>
                    คำถามที่พบบ่อย
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FAQ_CHIPS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendFaq(q)}
                        className="h-7 px-3 rounded-full text-xs border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context chips */}
                {activeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={chip.action}
                        className="h-9 px-4 rounded-full text-sm font-medium border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
                <Composer input={input} setInput={setInput} onSend={handleSend} textareaRef={composerRef} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="เมนูหลัก"
        className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-30"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
      >
        <button
          onClick={() => setActiveTab("chat")}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-xs font-medium transition-colors"
          style={{ color: activeTab === "chat" ? "var(--primary)" : "var(--muted-foreground)" }}
        >
          <MessageCircle size={18} aria-hidden />
          โค้ช
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-xs font-medium transition-colors"
          style={{ color: activeTab === "notifications" ? "var(--primary)" : "var(--muted-foreground)" }}
        >
          <span className="relative">
            <Clock size={18} aria-hidden />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
            )}
          </span>
          แจ้งเตือน
        </button>
        <button
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-xs transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="ออกจากระบบ"
        >
          <LogOut size={16} aria-hidden />
          ออก
        </button>
      </nav>
    </div>
  );
}

// ── Admin mock data ─────────────────────────────────────────────────────────────

const QA_STATUS_LABELS: Record<string, string> = {
  needs_review: "Needs Review",
  transcript_pending: "Transcript Pending",
  approved: "Approved",
};

const INITIAL_FLOWS: ContentFlow[] = [
  {
    id: "flow-passing",
    topicId: "FCO-EDU-043",
    entryQuestion: "วันนี้คุณส่งบอลเป็นหรือยัง?",
    branches: [
      { id: "bp-candoo",    flowId: "flow-passing", trigger: "choice",   triggerValue: "ทำได้แล้ว",    action: "ask_followup", nextQuestion: "เวลาโดนบีบ คุณเลือกส่งแบบไหน?" },
      { id: "bp-wantmore",  flowId: "flow-passing", trigger: "choice",   triggerValue: "อยากรู้เพิ่ม", action: "send_content", targetTopicId: "FCO-EDU-043" },
      { id: "bp-notsure",   flowId: "flow-passing", trigger: "choice",   triggerValue: "ยังไม่แน่ใจ",  action: "send_content", targetTopicId: "FCO-EDU-043" },
      { id: "bp-button",    flowId: "flow-passing", trigger: "choice",   triggerValue: "งงเรื่องปุ่ม",  action: "send_related", message: "ปุ่มหลัก: A/X ส่งพื้น • Y/△ เปิดสูง • LB/L1 ส่งทะลุช่อง ลองฝึกในสนามฝึกก่อนครับ", targetTopicId: "FCO-EDU-030" },
      { id: "bp-timing",    flowId: "flow-passing", trigger: "choice",   triggerValue: "งงเรื่องจังหวะ", action: "send_related", message: "รอผู้รับวิ่งเปิดตัวก่อน ดูทิศทาง แล้วค่อยกด อย่าส่งทันทีที่ถือบอล", targetTopicId: "FCO-EDU-045" },
      { id: "bp-fallback1", flowId: "flow-passing", trigger: "fallback", action: "ai_fallback", message: "ค้นจากฐานความรู้แล้ว ยังไม่เจอคำตอบตรง ๆ นี่คือคลิปที่น่าจะเกี่ยวข้อง" },
      { id: "bp-fallback2", flowId: "flow-passing", trigger: "fallback", action: "escalate", escalationLabel: "ถามชุมชน FC Online Discord" },
    ],
  },
];

const INITIAL_DAILY_DELIVERY_PLANS: DailyDeliveryPlan[] = [
  { id: "ddp-1", day: 1, channel: "chat",         availableTime: "10:00", message: "ยินดีต้อนรับสู่ FCO Rookie Coach! มาเริ่มต้นด้วยการเรียนรู้ปุ่มพื้นฐานกันก่อนเลย ใช้เวลาแค่ 5 นาที", contentId: "FCO-EDU-030", status: "active" },
  { id: "ddp-2", day: 2, channel: "notification", availableTime: "10:00", message: "วันนี้ฝึกส่งบอลให้ถูกจังหวะ เพียงแค่นี้ก็เล่นได้มั่นใจขึ้นทันที", contentId: "FCO-EDU-043", status: "active" },
  { id: "ddp-3", day: 3, channel: "chat",         availableTime: "10:00", message: "ลองฝึกดริบบอลผ่านคู่ต่อสู้ เพิ่มโอกาสสร้างโอกาสทำประตูได้มากขึ้น", contentId: "FCO-EDU-045", status: "active" },
  { id: "ddp-4", day: 4, channel: "notification", availableTime: "10:00", message: "วันนี้เรียนรู้การป้องกันที่แน่น ไม่เสียประตูโดยง่าย ทีมแข็งแกร่งกว่าเดิม", contentId: "FCO-EDU-044", status: "active" },
  { id: "ddp-5", day: 5, channel: "chat",         availableTime: "10:00", message: "ถึงเวลายิงประตูแล้ว! มาดูเทคนิคการยิงที่ได้ผลจริงในเกม", contentId: "FCO-EDU-001", status: "active" },
  { id: "ddp-6", day: 6, channel: "notification", availableTime: "10:00", message: "มาทบทวนการส่งบอลระดับสูงเพื่อเปิดเกมรับให้แม่นขึ้นกัน", contentId: "FCO-EDU-007", status: "draft" },
  { id: "ddp-7", day: 7, channel: "chat",         availableTime: "10:00", message: "พร้อมลงสนามแล้ว มาฝึก Quick Shot ให้ชำนาญยิ่งขึ้นกัน", contentId: "FCO-EDU-041", status: "draft" },
];

const INITIAL_REPORTED_QUESTIONS: ReportedQuestion[] = [
  {
    id: "rq-1",
    question: "วิธีเพิ่มพลังยิงทำยังไง",
    onboardingDay: 5,
    relatedTopicId: "FCO-EDU-001",
    count: 4,
    firstSeen: "2026-08-25",
    lastSeen: "2026-08-28",
    status: "reviewing",
    recentContext: "ผู้ใช้ถามหลังจากดูคลิปการยิงประตู",
  },
  {
    id: "rq-2",
    question: "สแตมิน่าหมดเร็วมากต้องทำยังไง",
    onboardingDay: 3,
    count: 2,
    firstSeen: "2026-08-26",
    lastSeen: "2026-08-27",
    status: "new",
    recentContext: "ผู้ใช้ถามระหว่างฝึกดริบบอล",
  },
  {
    id: "rq-3",
    question: "ซื้อผู้เล่นจาก Transfer Market ยังไง",
    onboardingDay: 6,
    count: 7,
    firstSeen: "2026-08-20",
    lastSeen: "2026-08-28",
    status: "new",
    recentContext: "ผู้ใช้ถามหลังจากเข้าเมนู Squad",
  },
];

// ── AdminDailyDeliveryPlan ─────────────────────────────────────────────────────

function AdminDailyDeliveryPlan({
  plans,
  setPlans,
}: {
  plans: DailyDeliveryPlan[];
  setPlans: (fn: (prev: DailyDeliveryPlan[]) => DailyDeliveryPlan[]) => void;
}) {
  const [editingDay, setEditingDay] = useState<DeliveryDay | null>(null);

  function patch(day: DeliveryDay, update: Partial<DailyDeliveryPlan>) {
    setPlans((prev) => prev.map((p) => (p.day === day ? { ...p, ...update } : p)));
  }

  const inputCls = "h-9 px-3 rounded-md text-sm w-full";
  const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", outline: "none" as const };

  const CHANNEL_LABELS: Record<DeliveryChannel, string> = { notification: "Notification", chat: "Chat" };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Daily Delivery Plan</h2>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium w-fit"
          style={{ backgroundColor: "rgba(196,30,30,0.07)", color: "var(--primary)" }}
        >
          <span>⏱</span>
          ส่งครั้งแรกเมื่อผู้ใช้เปิดแอปหลังเวลาที่กำหนด
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {plans.map((plan) => {
          const isEditing = editingDay === plan.day;
          const linkedTopic = plan.contentId ? KNOWLEDGE.find((k) => k.topicId === plan.contentId) : undefined;

          return (
            <div
              key={plan.day}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isEditing ? "var(--primary)" : "var(--border)"}` }}
            >
              {/* Summary row */}
              <button
                onClick={() => setEditingDay(isEditing ? null : plan.day)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ backgroundColor: isEditing ? "rgba(196,30,30,0.04)" : "var(--card)" }}
                onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = "var(--card)"; }}
              >
                <span
                  className="text-xs font-bold w-14 shrink-0"
                  style={{ color: "var(--primary)" }}
                >
                  Day {plan.day}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{
                    backgroundColor: plan.channel === "notification" ? "rgba(43,108,58,0.12)" : "rgba(196,30,30,0.08)",
                    color: plan.channel === "notification" ? "var(--accent)" : "var(--primary)",
                  }}
                >
                  {CHANNEL_LABELS[plan.channel]}
                </span>
                <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>{plan.availableTime}</span>
                <span className="text-xs flex-1 truncate" style={{ color: "var(--foreground)" }}>{plan.message}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{
                    backgroundColor: plan.status === "active" ? "rgba(43,108,58,0.12)" : "var(--muted)",
                    color: plan.status === "active" ? "var(--accent)" : "var(--muted-foreground)",
                  }}
                >
                  {plan.status === "active" ? "Active" : "Draft"}
                </span>
              </button>

              {/* Edit panel */}
              {isEditing && (
                <div
                  className="flex flex-col gap-4 px-4 py-4"
                  style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}
                >
                  <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Channel</label>
                      <select
                        value={plan.channel}
                        onChange={(e) => patch(plan.day, { channel: e.target.value as DeliveryChannel })}
                        className={inputCls}
                        style={inputStyle}
                      >
                        <option value="notification">Notification</option>
                        <option value="chat">Chat</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Available time</label>
                      <input
                        type="time"
                        value={plan.availableTime}
                        onChange={(e) => patch(plan.day, { availableTime: e.target.value })}
                        className="h-9 px-3 rounded-md text-sm"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Message</label>
                    <textarea
                      value={plan.message}
                      onChange={(e) => patch(plan.day, { message: e.target.value })}
                      rows={2}
                      className="px-3 py-2 rounded-md text-sm resize-none"
                      style={{ ...inputStyle, lineHeight: "1.6" }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Linked content</label>
                    <select
                      value={plan.contentId ?? ""}
                      onChange={(e) => patch(plan.day, { contentId: e.target.value || undefined })}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="">— none —</option>
                      {KNOWLEDGE.map((k) => (
                        <option key={k.id} value={k.topicId}>{k.topicId} • {k.title}</option>
                      ))}
                    </select>
                    {linkedTopic && (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{linkedTopic.shortSummary}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => patch(plan.day, { status: "draft" })}
                        className="h-8 px-3 rounded-lg text-xs font-medium border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        บันทึกแบบร่าง
                      </button>
                      <button
                        onClick={() => { patch(plan.day, { status: "active" }); setEditingDay(null); }}
                        className="h-8 px-3 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        เปิดใช้งาน
                      </button>
                    </div>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="text-xs transition-opacity hover:opacity-60"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        Prototype ใช้ local mock · production เชื่อม DailyDeliveryPlan + KnowledgeItem ผ่าน contentId
      </p>
    </div>
  );
}

// ── AdminContentLibrary ────────────────────────────────────────────────────────

function AdminContentLibrary() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = KNOWLEDGE.filter(
    (k) =>
      k.title.toLowerCase().includes(search.toLowerCase()) ||
      k.topicId.toLowerCase().includes(search.toLowerCase()) ||
      k.category.toLowerCase().includes(search.toLowerCase())
  );

  const selected = selectedId ? KNOWLEDGE.find((k) => k.id === selectedId) : null;

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Table pane */}
      <div className="flex flex-col overflow-hidden" style={{ width: selected ? "55%" : "100%" }}>
        {/* Search */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา Topic ID, ชื่อ หรือหมวด..."
              className="h-9 pl-8 pr-3 rounded-md text-sm w-full"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", outline: "none" }}
            />
          </div>
        </div>

        {/* Column header */}
        <div
          className="grid text-[11px] font-semibold px-5 py-2 shrink-0"
          style={{ gridTemplateColumns: "112px 1fr 110px 110px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}
        >
          <span>Topic ID</span>
          <span>Title</span>
          <span>Category</span>
          <span>Source status</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((k) => {
            const active = selectedId === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setSelectedId(active ? null : k.id)}
                className="grid w-full px-5 py-2.5 text-left text-xs transition-colors"
                style={{
                  gridTemplateColumns: "112px 1fr 110px 110px",
                  backgroundColor: active ? "rgba(196,30,30,0.05)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? "rgba(196,30,30,0.05)" : "transparent"; }}
              >
                <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>{k.topicId}</span>
                <span className="font-medium pr-3 truncate">{k.title}</span>
                <span style={{ color: "var(--muted-foreground)" }} className="truncate">{k.category}</span>
                <span style={{ color: k.qaStatus === "approved" ? "var(--accent)" : "var(--muted-foreground)" }}>
                  {QA_STATUS_LABELS[k.qaStatus]}
                  {k.timeSensitive ? " ⏱" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-5 py-2 text-xs shrink-0" style={{ color: "var(--muted-foreground)", borderTop: "1px solid var(--border)" }}>
          {filtered.length} / {KNOWLEDGE.length} หัวข้อ
        </p>
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          className="flex flex-col overflow-y-auto p-5 gap-4 shrink-0"
          style={{ width: "45%", borderLeft: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>{selected.topicId}</p>
              <h3 className="text-sm font-semibold mt-0.5 leading-snug" style={{ color: "var(--foreground)" }}>{selected.title}</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{selected.category}</p>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-xs shrink-0 transition-opacity hover:opacity-60 mt-0.5"
              style={{ color: "var(--muted-foreground)" }}>
              ✕
            </button>
          </div>

          {selected.thumbnailUrl && (
            <img src={selected.thumbnailUrl} alt={selected.title} className="rounded-md w-full object-cover"
              style={{ aspectRatio: "16/9" }} />
          )}

          <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
            {selected.shortSummary}
          </p>

          {selected.timeSensitive && (
            <p className="text-xs px-2.5 py-1.5 rounded-md"
              style={{ backgroundColor: "rgba(196,30,30,0.07)", color: "var(--primary)" }}>
              ข้อมูลตามช่วงเวลา • ตรวจสอบเวอร์ชันล่าสุดก่อนใช้งาน
              {selected.sourceDateLabel ? ` (${selected.sourceDateLabel})` : ""}
            </p>
          )}

          <div className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <p><span className="font-medium">Source:</span> {selected.source}</p>
            <p><span className="font-medium">Updated:</span> {new Date(selected.sourceUpdatedAt).toLocaleDateString("th-TH")}</p>
            <p>
              <span className="font-medium">QA Status:</span>{" "}
              <span style={{ color: selected.qaStatus === "approved" ? "var(--accent)" : "var(--muted-foreground)" }}>
                {QA_STATUS_LABELS[selected.qaStatus]}
              </span>
            </p>
          </div>

          <a
            href={selected.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium w-fit transition-opacity hover:opacity-70"
            style={{ color: "var(--primary)" }}
          >
            <ExternalLink size={12} aria-hidden />
            ดูวิดีโอ YouTube
          </a>
        </div>
      )}
    </div>
  );
}

// ── AdminContentFlows ──────────────────────────────────────────────────────────

function AdminContentFlows({
  flows,
  setFlows,
}: {
  flows: ContentFlow[];
  setFlows: (fn: (prev: ContentFlow[]) => ContentFlow[]) => void;
}) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(KNOWLEDGE[0].topicId);

  const flow = flows.find((f) => f.topicId === selectedTopicId) ?? null;

  function patchFlow(update: Partial<ContentFlow>) {
    if (!flow) return;
    setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, ...update } : f)));
  }

  function patchBranch(branchId: string, update: Partial<ContentBranch>) {
    if (!flow) return;
    setFlows((prev) =>
      prev.map((f) =>
        f.id === flow.id
          ? { ...f, branches: f.branches.map((b) => (b.id === branchId ? { ...b, ...update } : b)) }
          : f
      )
    );
  }

  const TRIGGER_LABELS: Record<string, string> = {
    choice: "Choice",
    keyword: "Keyword",
    free_text: "Free text",
    fallback: "Fallback",
  };

  const cellStyle = {
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    outline: "none",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Content Flows</h2>
        <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted-foreground)" }}>
          Content branch → Knowledge base → AI fallback → Discord/CS
        </p>
      </div>

      {/* Content selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Content</label>
        <select
          value={selectedTopicId}
          onChange={(e) => setSelectedTopicId(e.target.value)}
          className="h-9 px-3 rounded-md text-sm"
          style={cellStyle}
        >
          {KNOWLEDGE.map((k) => (
            <option key={k.id} value={k.topicId}>{k.topicId} • {k.title}</option>
          ))}
        </select>
      </div>

      {flow ? (
        <>
          {/* Entry question */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Entry question</label>
            <input
              value={flow.entryQuestion}
              onChange={(e) => patchFlow({ entryQuestion: e.target.value })}
              className="h-9 px-3 rounded-md text-sm w-full"
              style={cellStyle}
            />
          </div>

          {/* Branch table */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Branches ({flow.branches.length})
            </label>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div
                className="grid text-[11px] font-semibold px-4 py-2.5"
                style={{ gridTemplateColumns: "120px 140px 1fr 150px", backgroundColor: "var(--muted)", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}
              >
                <span>Trigger</span>
                <span>Action</span>
                <span>Message / Next question</span>
                <span>Target content</span>
              </div>

              {flow.branches.map((branch, idx) => (
                <div
                  key={branch.id}
                  className="grid px-4 py-2.5 items-center gap-3"
                  style={{ gridTemplateColumns: "120px 140px 1fr 150px", borderTop: idx === 0 ? undefined : "1px solid var(--border)" }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit"
                      style={{
                        backgroundColor: branch.trigger === "fallback" ? "rgba(196,30,30,0.08)" : "var(--muted)",
                        color: branch.trigger === "fallback" ? "var(--primary)" : "var(--muted-foreground)",
                      }}
                    >
                      {TRIGGER_LABELS[branch.trigger]}
                    </span>
                    {branch.triggerValue && (
                      <span className="text-xs" style={{ color: "var(--foreground)" }}>{branch.triggerValue}</span>
                    )}
                  </div>

                  <select
                    value={branch.action}
                    onChange={(e) => patchBranch(branch.id, { action: e.target.value as ContentBranch["action"] })}
                    className="h-8 px-2 rounded-md text-xs"
                    style={cellStyle}
                  >
                    <option value="ask_followup">ถามต่อ</option>
                    <option value="send_content">ส่ง content</option>
                    <option value="send_related">ส่งที่เกี่ยวข้อง</option>
                    <option value="ai_fallback">AI Fallback</option>
                    <option value="escalate">Escalate</option>
                  </select>

                  <div>
                    {branch.action === "ask_followup" && (
                      <input
                        value={branch.nextQuestion ?? ""}
                        onChange={(e) => patchBranch(branch.id, { nextQuestion: e.target.value })}
                        placeholder="คำถามต่อไป..."
                        className="h-8 px-2 rounded-md text-xs w-full"
                        style={cellStyle}
                      />
                    )}
                    {(branch.action === "send_related" || branch.action === "ai_fallback") && (
                      <input
                        value={branch.message ?? ""}
                        onChange={(e) => patchBranch(branch.id, { message: e.target.value })}
                        placeholder="ข้อความ..."
                        className="h-8 px-2 rounded-md text-xs w-full"
                        style={cellStyle}
                      />
                    )}
                    {branch.action === "escalate" && (
                      <input
                        value={branch.escalationLabel ?? ""}
                        onChange={(e) => patchBranch(branch.id, { escalationLabel: e.target.value })}
                        placeholder="ป้ายกำกับ escalation..."
                        className="h-8 px-2 rounded-md text-xs w-full"
                        style={cellStyle}
                      />
                    )}
                    {branch.action === "send_content" && (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>(ส่ง content ที่เลือก)</span>
                    )}
                  </div>

                  <div>
                    {(branch.action === "send_content" || branch.action === "send_related") ? (
                      <select
                        value={branch.targetTopicId ?? ""}
                        onChange={(e) => patchBranch(branch.id, { targetTopicId: e.target.value })}
                        className="h-8 px-2 rounded-md text-xs w-full"
                        style={cellStyle}
                      >
                        <option value="">— เลือก —</option>
                        {KNOWLEDGE.map((k) => (
                          <option key={k.id} value={k.topicId}>{k.topicId}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg p-4 text-sm"
            style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            ยังไม่มี content flow สำหรับหัวข้อนี้
          </div>
          <button
            onClick={() => {
              const newFlow: ContentFlow = {
                id: uid(),
                topicId: selectedTopicId,
                entryQuestion: "",
                branches: [],
              };
              setFlows((prev) => [...prev, newFlow]);
            }}
            className="h-9 px-4 rounded-lg text-sm font-medium border transition-colors w-fit"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            + สร้าง flow สำหรับหัวข้อนี้
          </button>
        </div>
      )}

      {/* AI & Integration disclosure */}
      <details>
        <summary
          className="text-xs cursor-pointer select-none font-medium py-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          AI &amp; Integration
        </summary>
        <div
          className="mt-2 rounded-md p-3 text-xs flex flex-col gap-2"
          style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
        >
          <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: "160px 1fr" }}>
            <span style={{ color: "var(--muted-foreground)" }}>Chatflow API status</span>
            <span className="font-semibold" style={{ color: "var(--accent)" }}>Connected (mock)</span>
            <span style={{ color: "var(--muted-foreground)" }}>Endpoint</span>
            <span className="font-mono">/api/chatflows/24426/run</span>
            <span style={{ color: "var(--muted-foreground)" }}>Conversation memory</span>
            <span>Our database</span>
            <span style={{ color: "var(--muted-foreground)" }}>API key</span>
            <span>Server-side only</span>
            <span style={{ color: "var(--muted-foreground)" }}>Sheet source</span>
            <span>synced snapshot</span>
          </div>
          <p
            className="mt-1 text-[10px] px-2 py-1 rounded font-medium"
            style={{ backgroundColor: "rgba(196,30,30,0.07)", color: "var(--primary)" }}
          >
            never call Chatflow directly from browser
          </p>
        </div>
      </details>
    </div>
  );
}

// ── AdminPreview ───────────────────────────────────────────────────────────────

const PREVIEW_FAQ = ["ส่งบอลยังไง", "เล่นเกมรับยังไง", "ยิงยังไงให้คม", "เชื่อมจอยยังไง"];

function AdminPreview({ deliveryPlans }: { deliveryPlans: DailyDeliveryPlan[] }) {
  const [previewDay, setPreviewDay] = useState<DeliveryDay>(1);
  const [previewChannel, setPreviewChannel] = useState<DeliveryChannel>("notification");

  const plan = deliveryPlans.find((p) => p.day === previewDay) ?? deliveryPlans[0];
  const linkedTopic = plan.contentId ? KNOWLEDGE.find((k) => k.topicId === plan.contentId) : undefined;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Admin controls header */}
      <div
        className="px-6 py-3 flex flex-wrap items-center gap-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mr-2" style={{ color: "var(--foreground)" }}>Preview</h2>

        {/* Day selector */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([1, 2, 3, 4, 5, 6, 7] as DeliveryDay[]).map((d) => {
            const active = d === previewDay;
            return (
              <button
                key={d}
                onClick={() => setPreviewDay(d)}
                className="h-7 px-2.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--background)" : "var(--muted-foreground)",
                  borderRight: d < 7 ? "1px solid var(--border)" : undefined,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Day {d}
              </button>
            );
          })}
        </div>

        {/* Channel selector */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["notification", "chat"] as DeliveryChannel[]).map((ch) => {
            const active = previewChannel === ch;
            return (
              <button
                key={ch}
                onClick={() => setPreviewChannel(ch)}
                className="h-7 px-3 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--background)" : "var(--muted-foreground)",
                  borderRight: ch === "notification" ? "1px solid var(--border)" : undefined,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {ch === "notification" ? "Notification" : "Chat"}
              </button>
            );
          })}
        </div>

        <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
          ส่งครั้งแรกเมื่อผู้ใช้เปิดแอปหลังเวลาที่กำหนด
        </span>
      </div>

      {/* Split body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: delivery plan config */}
        <div
          className="w-56 shrink-0 overflow-y-auto p-5 flex flex-col gap-3"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Plan Config
          </p>
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Day</p>
              <p className="mt-0.5 font-semibold" style={{ color: "var(--primary)" }}>Day {plan.day}</p>
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Channel</p>
              <p className="mt-0.5 capitalize" style={{ color: "var(--foreground)" }}>{plan.channel}</p>
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Available time</p>
              <p className="mt-0.5" style={{ color: "var(--foreground)" }}>{plan.availableTime}</p>
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Message</p>
              <p className="mt-0.5 leading-relaxed" style={{ color: "var(--foreground)" }}>{plan.message}</p>
            </div>
            {linkedTopic && (
              <div>
                <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Linked content</p>
                <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--muted-foreground)" }}>{linkedTopic.topicId}</p>
                <p className="mt-0.5" style={{ color: "var(--foreground)" }}>{linkedTopic.title}</p>
              </div>
            )}
            <div>
              <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Status</p>
              <span
                className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: plan.status === "active" ? "rgba(43,108,58,0.12)" : "var(--muted)",
                  color: plan.status === "active" ? "var(--accent)" : "var(--muted-foreground)",
                }}
              >
                {plan.status === "active" ? "Active" : "Draft"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: player preview — NO day label inside */}
        <div className="flex-1 overflow-y-auto flex flex-col" style={{ backgroundColor: "var(--background)" }}>
          <p className="px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--muted-foreground)" }}>
            Player Preview · {previewChannel === "notification" ? "Notification" : "Chat"}
          </p>

          {previewChannel === "notification" ? (
            /* ── Notification card preview ── */
            <div className="px-5 flex flex-col gap-3 max-w-sm">
              <div
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: "rgba(196,30,30,0.05)", border: "1px solid rgba(196,30,30,0.2)" }}
              >
                <div className="flex items-start gap-3">
                  <span className="relative mt-0.5 shrink-0">
                    <Clock size={16} style={{ color: "var(--primary)" }} aria-hidden />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                        FCO Rookie Coach
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {plan.availableTime}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{plan.message}</p>
                    {linkedTopic && (
                      <div className="mt-3">
                        <KnowledgeCard item={linkedTopic} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Chat preview ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
                <div className="flex justify-start">
                  <div
                    className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm"
                    style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {plan.message}
                  </div>
                </div>
                {linkedTopic && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%]">
                      <KnowledgeCard item={linkedTopic} />
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky footer — FAQ + composer (static) */}
              <div
                className="px-4 pt-3 pb-4 flex flex-col gap-2 shrink-0"
                style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)" }}>
                    คำถามที่พบบ่อย
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PREVIEW_FAQ.map((q) => (
                      <span
                        key={q}
                        className="h-7 px-3 rounded-full text-xs flex items-center border"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="h-10 px-3 rounded-lg flex items-center text-xs"
                  style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", backgroundColor: "var(--card)" }}
                >
                  พิมพ์คำถามของคุณ...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AdminUnansweredQuestions ───────────────────────────────────────────────────

const STATUS_LABELS: Record<ReportedQuestion["status"], string> = {
  new: "New",
  reviewing: "Reviewing",
  "content-added": "Content added",
  ignored: "Ignored",
};

const STATUS_COLORS: Record<ReportedQuestion["status"], { bg: string; color: string }> = {
  new: { bg: "rgba(196,30,30,0.08)", color: "var(--primary)" },
  reviewing: { bg: "rgba(196,150,0,0.12)", color: "#B45309" },
  "content-added": { bg: "rgba(43,108,58,0.12)", color: "var(--accent)" },
  ignored: { bg: "var(--muted)", color: "var(--muted-foreground)" },
};

function AdminUnansweredQuestions({
  questions,
  setQuestions,
}: {
  questions: ReportedQuestion[];
  setQuestions: (fn: (prev: ReportedQuestion[]) => ReportedQuestion[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? questions.find((q) => q.id === selectedId) ?? null : null;

  function patchQuestion(id: string, update: Partial<ReportedQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...update } : q)));
  }

  const inputStyle = {
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    outline: "none" as const,
  };

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Table pane */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: selected ? "55%" : "100%" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Unanswered Questions</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              คำถามที่ยังไม่มีในฐานความรู้ · จาก player report
            </p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>
            {questions.filter((q) => q.status === "new").length} new
          </span>
        </div>

        {/* Column headers */}
        <div
          className="grid text-[11px] font-semibold px-5 py-2 shrink-0"
          style={{
            gridTemplateColumns: "1fr 90px 110px 52px 88px 88px 100px",
            borderBottom: "1px solid var(--border)",
            borderTop: "1px solid var(--border)",
            color: "var(--muted-foreground)",
            backgroundColor: "var(--muted)",
          }}
        >
          <span>Question</span>
          <span>Day</span>
          <span>Related topic</span>
          <span>Count</span>
          <span>First seen</span>
          <span>Last seen</span>
          <span>Status</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {questions.length === 0 && (
            <p className="px-5 py-6 text-sm" style={{ color: "var(--muted-foreground)" }}>ยังไม่มีคำถาม</p>
          )}
          {questions.map((q) => {
            const active = selectedId === q.id;
            const sc = STATUS_COLORS[q.status];
            const topic = q.relatedTopicId ? KNOWLEDGE.find((k) => k.topicId === q.relatedTopicId) : undefined;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedId(active ? null : q.id)}
                className="grid w-full px-5 py-2.5 text-left text-xs transition-colors"
                style={{
                  gridTemplateColumns: "1fr 90px 110px 52px 88px 88px 100px",
                  backgroundColor: active ? "rgba(196,30,30,0.05)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? "rgba(196,30,30,0.05)" : "transparent"; }}
              >
                <span className="pr-3 truncate font-medium">{q.question}</span>
                <span style={{ color: "var(--muted-foreground)" }}>Day {q.onboardingDay}</span>
                <span className="truncate" style={{ color: "var(--muted-foreground)" }}>
                  {topic ? topic.title : <span style={{ opacity: 0.4 }}>—</span>}
                </span>
                <span className="font-semibold" style={{ color: q.count >= 5 ? "var(--primary)" : "var(--foreground)" }}>
                  {q.count}
                </span>
                <span style={{ color: "var(--muted-foreground)" }}>{q.firstSeen}</span>
                <span style={{ color: "var(--muted-foreground)" }}>{q.lastSeen}</span>
                <span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: sc.bg, color: sc.color }}
                  >
                    {STATUS_LABELS[q.status]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-5 py-2 text-xs shrink-0" style={{ color: "var(--muted-foreground)", borderTop: "1px solid var(--border)" }}>
          {questions.length} รายการ · {questions.filter((q) => q.status === "new").length} รายการใหม่
        </p>
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          className="flex flex-col overflow-y-auto shrink-0"
          style={{ width: "45%", borderLeft: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Question detail
              </p>
              <h3 className="text-sm font-semibold mt-1 leading-snug" style={{ color: "var(--foreground)" }}>
                {selected.question}
              </h3>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-xs shrink-0 transition-opacity hover:opacity-60 mt-0.5"
              style={{ color: "var(--muted-foreground)" }}>✕</button>
          </div>

          <div className="flex flex-col gap-5 p-5">
            {/* Meta */}
            <div className="grid gap-x-4 gap-y-1.5 text-xs" style={{ gridTemplateColumns: "100px 1fr" }}>
              <span style={{ color: "var(--muted-foreground)" }}>Onboarding day</span>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>Day {selected.onboardingDay}</span>
              <span style={{ color: "var(--muted-foreground)" }}>Count</span>
              <span className="font-semibold" style={{ color: selected.count >= 5 ? "var(--primary)" : "var(--foreground)" }}>
                {selected.count}×
              </span>
              <span style={{ color: "var(--muted-foreground)" }}>First seen</span>
              <span style={{ color: "var(--foreground)" }}>{selected.firstSeen}</span>
              <span style={{ color: "var(--muted-foreground)" }}>Last seen</span>
              <span style={{ color: "var(--foreground)" }}>{selected.lastSeen}</span>
            </div>

            {/* Recent context */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Recent context</p>
              <p className="text-xs leading-relaxed px-3 py-2 rounded-md"
                style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                {selected.recentContext || "—"}
              </p>
            </div>

            {/* Link to content */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Suggested / linked content</p>
              <select
                value={selected.relatedTopicId ?? ""}
                onChange={(e) => {
                  const topicId = e.target.value || undefined;
                  patchQuestion(selected.id, {
                    relatedTopicId: topicId,
                    status: topicId ? "content-added" : selected.status,
                  });
                }}
                className="h-9 px-3 rounded-md text-xs w-full"
                style={inputStyle}
              >
                <option value="">— เลือก content ที่เกี่ยวข้อง —</option>
                {KNOWLEDGE.map((k) => (
                  <option key={k.id} value={k.topicId}>{k.topicId} • {k.title}</option>
                ))}
              </select>
              {selected.relatedTopicId && (() => {
                const t = KNOWLEDGE.find((k) => k.topicId === selected.relatedTopicId);
                return t ? (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t.shortSummary}</p>
                ) : null;
              })()}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Status</p>
              <div className="flex flex-wrap gap-2">
                {(["new", "reviewing", "content-added", "ignored"] as ReportedQuestion["status"][]).map((s) => {
                  const active = selected.status === s;
                  const sc = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => patchQuestion(selected.id, { status: s })}
                      className="text-[11px] px-2.5 py-1 rounded-full font-semibold transition-opacity"
                      style={{
                        backgroundColor: active ? sc.bg : "var(--muted)",
                        color: active ? sc.color : "var(--muted-foreground)",
                        outline: active ? `1.5px solid ${sc.color}` : "none",
                        opacity: active ? 1 : 0.7,
                      }}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-medium pt-1" style={{ color: "var(--muted-foreground)" }}>Actions</p>
              <button
                onClick={() => patchQuestion(selected.id, { status: "reviewing" })}
                className="h-9 px-4 rounded-lg text-sm font-medium border transition-colors w-full text-left"
                style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                สร้าง content ใหม่
              </button>
              <button
                onClick={() => patchQuestion(selected.id, { status: selected.relatedTopicId ? "content-added" : "reviewing" })}
                className="h-9 px-4 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 w-full text-left"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                ลิงก์กับ content ที่มี
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminView ──────────────────────────────────────────────────────────────────

function AdminView({
  onLogout,
  reportedQuestions,
  setReportedQuestions,
}: {
  onLogout: () => void;
  reportedQuestions: ReportedQuestion[];
  setReportedQuestions: (fn: (prev: ReportedQuestion[]) => ReportedQuestion[]) => void;
}) {
  const [tab, setTab] = useState<AdminTab>("daily-delivery");
  const [deliveryPlans, setDeliveryPlans] = useState<DailyDeliveryPlan[]>(INITIAL_DAILY_DELIVERY_PLANS);
  const [flows, setFlows] = useState<ContentFlow[]>(INITIAL_FLOWS);

  const newCount = reportedQuestions.filter((q) => q.status === "new").length;

  const navItems: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "daily-delivery", label: "Daily Delivery Plan", icon: <Calendar size={15} aria-hidden /> },
    { key: "content-library", label: "Content Library", icon: <BookOpen size={15} aria-hidden /> },
    { key: "content-flows", label: "Content Flows", icon: <GitBranch size={15} aria-hidden /> },
    { key: "unanswered", label: "Unanswered Questions", icon: <Search size={15} aria-hidden />, badge: newCount },
    { key: "preview", label: "Preview", icon: <Eye size={15} aria-hidden /> },
  ];

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      {/* Left nav */}
      <nav
        className="flex flex-col w-52 shrink-0 border-r py-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        aria-label="Admin navigation"
      >
        <button
          onClick={onLogout}
          className="mx-2 mb-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors text-left"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <LogOut size={13} aria-hidden />
          ออกจากระบบหลังบ้าน
        </button>

        <div className="px-4 mb-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>Admin</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: "var(--primary)" }}>FCO Rookie Coach</p>
        </div>

        <div className="flex-1 flex flex-col gap-0.5 px-2">
          {navItems.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors text-left w-full min-h-[40px]"
                style={{
                  color: active ? "var(--primary)" : "var(--foreground)",
                  backgroundColor: active ? "rgba(196,30,30,0.07)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto"
                    style={{ backgroundColor: "rgba(196,30,30,0.1)", color: "var(--primary)" }}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content area */}
      <main className="flex-1 overflow-hidden flex">
        {tab === "daily-delivery" && <AdminDailyDeliveryPlan plans={deliveryPlans} setPlans={setDeliveryPlans} />}
        {tab === "content-library" && <AdminContentLibrary />}
        {tab === "content-flows" && <AdminContentFlows flows={flows} setFlows={setFlows} />}
        {tab === "unanswered" && <AdminUnansweredQuestions questions={reportedQuestions} setQuestions={setReportedQuestions} />}
        {tab === "preview" && <AdminPreview deliveryPlans={deliveryPlans} />}
      </main>
    </div>
  );
}

function AdminRoute() {
  const [session, setSession] = useState<AdminSessionState>("checking");
  const [reportedQuestions, setReportedQuestions] = useState<ReportedQuestion[]>(INITIAL_REPORTED_QUESTIONS);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) setSession("authenticated");
        else {
          const body = await response.json().catch(() => ({}));
          setSession(body.code === "ADMIN_NOT_CONFIGURED" ? "unconfigured" : "signed-out");
        }
      })
      .catch(() => {
        if (active) setSession("signed-out");
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setSession("signed-out");
  }

  if (session === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm" style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)" }}>
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (session === "unconfigured") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-sm rounded-xl border p-6 text-center" style={{ borderColor: "var(--border)" }}>
          <LockKeyhole className="mx-auto mb-3" size={22} style={{ color: "var(--primary)" }} aria-hidden />
          <h1 className="font-bold" style={{ color: "var(--foreground)" }}>ระบบหลังบ้านยังไม่พร้อม</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>กรุณาตั้งค่า Admin credentials ฝั่งเซิร์ฟเวอร์ก่อนใช้งาน</p>
        </div>
      </div>
    );
  }

  if (session !== "authenticated") {
    return <AdminLoginScreen onAuthenticated={() => setSession("authenticated")} />;
  }

  return (
    <AdminView
      onLogout={logout}
      reportedQuestions={reportedQuestions}
      setReportedQuestions={setReportedQuestions}
    />
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [reportedQuestions, setReportedQuestions] = useState<ReportedQuestion[]>(INITIAL_REPORTED_QUESTIONS);

  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

  function handleReportQuestion(question: string, recentContext: string) {
    const normalized = question.trim().toLowerCase();
    setReportedQuestions((prev) => {
      const existing = prev.find((q) => q.question.trim().toLowerCase() === normalized);
      if (existing) {
        return prev.map((q) =>
          q.id === existing.id
            ? { ...q, count: q.count + 1, lastSeen: new Date().toISOString().slice(0, 10), recentContext }
            : q
        );
      }
      const newEntry: ReportedQuestion = {
        id: uid(),
        question: question.trim(),
        onboardingDay: 2,
        count: 1,
        firstSeen: new Date().toISOString().slice(0, 10),
        lastSeen: new Date().toISOString().slice(0, 10),
        status: "new",
        recentContext,
      };
      return [...prev, newEntry];
    });
  }

  if (isAdminRoute) return <AdminRoute />;

  if (role === null) return <LoginScreen onLogin={() => setRole("player")} />;

  return <CoachScreen onLogout={() => setRole(null)} onReportQuestion={handleReportQuestion} />;
}
