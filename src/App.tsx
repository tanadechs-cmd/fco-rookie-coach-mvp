import { useState, useRef, useEffect, useContext } from "react";
import { AccountGate, AccountContext, AdminAccess, LiveOverview, Rating, Nps, NpsSettings, request } from './Review';
import { canRateMessage, isPromptText } from './answerFeedback';
import { CoachMascot, COACH_MASCOT, LanguageSwitcher, PlayerLanguageProvider, usePlayerLanguage } from './PlayerUI';
import { ENGLISH_KNOWLEDGE, FAQ_ENGLISH_BY_QUESTION } from './knowledgeEnglish';
import { englishStatus, sourceSignature, selectAnswerLanguage, rankConfiguredAnswer, isMoneyQuestion, type AnswerLanguage, type BilingualAnswerConfig, type LocalizedAnswer } from './knowledgeRouting';
import BilingualAnswerEditor from './BilingualAnswerEditor';
import { PUBLIC_TRIAL, trialRequest } from './publicTrial';
import { normalizeAiResponse } from './aiResponse';
import { conversationCopy, withOpening } from './knowledgeConversation';
import { MessageCircle, LogOut, Send, Globe, Play, BookOpen, GitBranch, Eye, Search, ExternalLink, Clock, LockKeyhole, Keyboard, Gamepad2, History, Bell, Trash2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type PlayerTab = "chat" | "notifications";
type PlayerSegment = "new-under-month" | "returning-under-month" | "experienced";
type ChipMode = "activation" | "competence" | "next-goal" | "post-content";
type Day = 1 | 2 | 3;
type JourneyStageId = "activation" | "competence" | "next-goal";
type ResponseActionId = "education_hub" | "discord" | "customer_support" | "report_question";
type ControlScheme = "keyboard" | "xbox" | "playstation";

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
  language?: AnswerLanguage;
  feedbackEligible?: boolean;
  id: string;
  role: "user" | "assistant" | "separator";
  text: string;
  steps?: string[];
  knowledgeId?: string;
  aiSource?: "AI-INsea" | "mock";
  relatedIds?: string[];
  showDiscord?: boolean;
  reportQuestion?: string;
  actions?: ResponseActionId[];
}

interface ChatAnswerConfig extends BilingualAnswerConfig {
  source: string;
}

interface FaqConfigItem {
  id: string;
  question: string;
  questionEn?: string;
  questionEnSource?: string;
  stageId: JourneyStageId;
  topicId: string;
  secondaryTopicId?: string;
  trigger: string;
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

type DeliveryDay = Day;
type DeliveryChannel = "notification" | "chat";
type ConfigSection = "faq_content" | "proactive_messages";
type SharedConfigStatus = "loading" | "ready" | "local-fallback";
type SaveState = "idle" | "saving" | "saved" | "error";

interface ProactiveBranch {
  id: string;
  kind: "if" | "elseif";
  choice: string;
  action: "reply" | "next_question";
  reply: string;
  nextPlanId?: string;
  contentId?: string;
}

interface DailyDeliveryPlan {
  id: string;
  day: DeliveryDay;
  stageId: JourneyStageId;
  name: string;
  channel: DeliveryChannel;
  isStart: boolean;
  dailyEntry?: boolean;
  message: string;
  branches: ProactiveBranch[];
  elseAction: "reply" | "next_question" | "ai_fallback";
  elseReply: string;
  elseNextPlanId?: string;
  notificationTime?: string;
  notificationContentId?: string;
  notificationUnread?: boolean;
  notificationManaged?: boolean;
  notificationHidden?: boolean;
  status: "active" | "draft";
}

type AdminTab = "overview" | "proactive-messages" | "notifications" | "faq-content" | "unanswered" | "preview" | "history" | "access";

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

interface ConfigVersion {
  id: string;
  revision: number;
  changedSection: string;
  createdAt: string;
  createdBy: string;
}

function parseReportedQuestion(raw: unknown): ReportedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const question = raw as Record<string, unknown>;
  const status = question.status;
  if (
    typeof question.id !== "string" ||
    typeof question.question !== "string" ||
    ![1, 2, 3].includes(question.onboardingDay as number) ||
    !Number.isInteger(question.count) ||
    typeof question.firstSeen !== "string" ||
    typeof question.lastSeen !== "string" ||
    typeof question.recentContext !== "string" ||
    !["new", "reviewing", "content-added", "ignored"].includes(status as string)
  ) return null;
  return {
    id: question.id,
    question: question.question,
    onboardingDay: question.onboardingDay as DeliveryDay,
    relatedTopicId: typeof question.relatedTopicId === "string" ? question.relatedTopicId : undefined,
    count: question.count as number,
    firstSeen: question.firstSeen,
    lastSeen: question.lastSeen,
    status: status as ReportedQuestion["status"],
    recentContext: question.recentContext,
  };
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

function matchKnowledge(text: string, answers: ChatAnswerConfig[]): KnowledgeItem | undefined {
  const match = rankConfiguredAnswer(text, answers.filter(answer => !answer.isManual));
  return match ? findKnowledge(match.id) : undefined;
}

function formatDuration(sec: number): string {
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} น.`;
  }
  return `${sec} วิ`;
}

// ── Canned answers ─────────────────────────────────────────────────────────────

type CannedAnswer = { text: string; keyboardSteps?: string[]; xboxSteps?: string[]; playstationSteps?: string[]; source?: string };

const CANNED: Record<string, CannedAnswer> = {
  controller: {
    text: "ตั้งค่าอุปกรณ์ควบคุมก่อนลงสนาม จะช่วยให้จำปุ่มได้เร็วขึ้น",
    keyboardSteps: ["เข้า Settings > Control", "เลือก Keyboard และเช็กปุ่มที่ถนัด", "ทดลองในสนามฝึกก่อนลงแข่ง"],
    xboxSteps: ["เสียบ USB หรือเชื่อม Bluetooth", "เข้า Settings > Control แล้วเลือก Xbox Controller", "ทดลองปุ่ม XYAB ในสนามฝึก"],
    playstationSteps: ["เสียบ USB หรือเชื่อม Bluetooth", "เข้า Settings > Control แล้วเลือก PlayStation Controller", "ทดลองปุ่ม □ △ ○ ✕ ในสนามฝึก"],
    source: "FC Online Education Hub",
  },
  "welcome-pass": {
    text: "ใช้ 1 BP รับทีมเริ่มต้นพร้อมเดินหน้าได้เลย",
    keyboardSteps: ["เข้าเมนู Welcome Pass", "จ่าย 1 BP", "รับทีมและไอเทมเริ่มต้น"],
    xboxSteps: ["เข้าเมนู Welcome Pass", "จ่าย 1 BP", "รับทีมและไอเทมเริ่มต้น"],
    playstationSteps: ["เข้าเมนู Welcome Pass", "จ่าย 1 BP", "รับทีมและไอเทมเริ่มต้น"],
    source: "FC Online Education Hub",
  },
  "mode-start": {
    text: "มือใหม่แนะนำ Kick-Off หรือ Season Mode ก่อน",
    keyboardSteps: [
      "เลือก Kick-Off สำหรับเกมด่วน",
      "ลอง Season Mode เพื่อความต่อเนื่อง",
      "หลีกเลี่ยง Rivals จนกว่าจะชำนาญ",
    ],
    xboxSteps: [
      "เลือก Kick-Off สำหรับเกมด่วน",
      "ลอง Season Mode เพื่อความต่อเนื่อง",
      "หลีกเลี่ยง Rivals จนกว่าจะชำนาญ",
    ],
    playstationSteps: [
      "เลือก Kick-Off สำหรับเกมด่วน",
      "ลอง Season Mode เพื่อความต่อเนื่อง",
      "หลีกเลี่ยง Rivals จนกว่าจะชำนาญ",
    ],
    source: "FC Online Education Hub",
  },
  passing: {
    text: "มี 3 วิธีส่งบอลหลัก ใช้ให้ถูกสถานการณ์",
    keyboardSteps: ["กด S ส่งบอลสั้น", "กด A เปิดบอล", "กด W แทงทะลุช่อง"],
    xboxSteps: ["กด A ส่งบอลสั้น", "กด X เปิดบอล", "กด Y แทงทะลุช่อง"],
    playstationSteps: ["กด ✕ ส่งบอลสั้น", "กด □ เปิดบอล", "กด △ แทงทะลุช่อง"],
    source: "FC Online Education Hub",
  },
  dribbling: {
    text: "เลี้ยงบอลพื้นฐานให้หลุดคู่แข่งตั้งแต่แรก",
    keyboardSteps: ["ใช้ปุ่มทิศทางเพื่อเลี้ยงบอล", "กด C เพื่อบังบอล", "กด E ค้างเพื่อ Sprint"],
    xboxSteps: ["ใช้อนาล็อกซ้ายเพื่อเลี้ยงบอล", "กด LT เพื่อบังบอล", "กด RT ค้างเพื่อ Sprint"],
    playstationSteps: ["ใช้อนาล็อกซ้ายเพื่อเลี้ยงบอล", "กด L2 เพื่อบังบอล", "กด R2 ค้างเพื่อ Sprint"],
    source: "FC Online Education Hub",
  },
  shooting: {
    text: "จบสกอร์ง่ายขึ้นด้วยจังหวะและทิศทาง",
    keyboardSteps: ["กด D เพื่อยิง", "กดปุ่มทิศทางเพื่อเล็ง", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
    xboxSteps: ["กด B เพื่อยิง", "เล็งด้วยอนาล็อกซ้าย", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
    playstationSteps: ["กด ○ เพื่อยิง", "เล็งด้วยอนาล็อกซ้าย", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
    source: "FC Online Education Hub",
  },
  defending: {
    text: "รับให้แน่นด้วย Jockey และเวลาสกัดที่ถูกต้อง",
    keyboardSteps: ["กด C ค้างเพื่อ Jockey", "กด D เพื่อเข้าสกัด", "กด A เพื่อ Slide Tackle"],
    xboxSteps: ["กด LT ค้างเพื่อ Jockey", "กด B เพื่อเข้าสกัด", "กด X เพื่อ Slide Tackle"],
    playstationSteps: ["กด L2 ค้างเพื่อ Jockey", "กด ○ เพื่อเข้าสกัด", "กด □ เพื่อ Slide Tackle"],
    source: "FC Online Education Hub",
  },
  qss: {
    text: "QSS คือทีมพร้อมใช้ฟรี ไม่ต้องสร้างเอง",
    keyboardSteps: ["เข้าเมนู Quick Squad Select", "เลือกทีมที่ชื่นชอบ", "ลงสนามได้ทันที"],
    xboxSteps: ["เข้าเมนู Quick Squad Select", "เลือกทีมที่ชื่นชอบ", "ลงสนามได้ทันที"],
    playstationSteps: ["เข้าเมนู Quick Squad Select", "เลือกทีมที่ชื่นชอบ", "ลงสนามได้ทันที"],
    source: "FC Online Education Hub",
  },
  ranking: {
    text: "แนะนำฝึกขั้นพื้นฐานให้ครบก่อน แล้วค่อยลง Ranking",
    keyboardSteps: ["ฝึกจนชนะ Kick-Off ได้บ้าง", "ทำความเข้าใจระบบ BP", "เริ่ม Division Rivals เมื่อพร้อม"],
    xboxSteps: ["ฝึกจนชนะ Kick-Off ได้บ้าง", "ทำความเข้าใจระบบ BP", "เริ่ม Division Rivals เมื่อพร้อม"],
    playstationSteps: ["ฝึกจนชนะ Kick-Off ได้บ้าง", "ทำความเข้าใจระบบ BP", "เริ่ม Division Rivals เมื่อพร้อม"],
    source: "FC Online Education Hub",
  },
};

const FALLBACK: CannedAnswer = {
  text: "ลองบอกให้ชัดขึ้นได้เลยครับ เช่น ตั้งค่าจอย หรือ ส่งบอล",
  source: "FC Online Education Hub",
};

function createDefaultChatAnswers(): ChatAnswerConfig[] {
  return KNOWLEDGE.map((item) => {
    const direct = CANNED[item.id];
    const answer: ChatAnswerConfig = {
      id: item.id,
      title: item.title,
      text: direct?.text ?? item.shortSummary,
      keywords: item.keywords,
      keyboardSteps: direct?.keyboardSteps ?? [],
      xboxSteps: direct?.xboxSteps ?? [],
      playstationSteps: direct?.playstationSteps ?? [],
      source: direct?.source ?? item.source,
    };
    const english = ENGLISH_KNOWLEDGE[item.id];
    if (english) answer.en = {
      title: english.title, text: english.text, keywords: english.keywords,
      keyboardSteps: english.keyboardSteps, xboxSteps: english.xboxSteps, playstationSteps: english.playstationSteps,
      sourceSignature: sourceSignature({ ...answer, text: english.sourceText, keyboardSteps: english.sourceKeyboardSteps, xboxSteps: english.sourceXboxSteps, playstationSteps: english.sourcePlaystationSteps }),
    };
    return answer;
  });
}

function normalizeEnglish(raw: unknown): LocalizedAnswer | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const list = (field: unknown) => Array.isArray(field) ? field.filter((v): v is string => typeof v === 'string') : [];
  return {
    title: typeof value.title === 'string' ? value.title : '',
    text: typeof value.text === 'string' ? value.text : '',
    opening: typeof value.opening === 'string' ? value.opening : undefined,
    clipIntro: typeof value.clipIntro === 'string' ? value.clipIntro : undefined,
    keywords: list(value.keywords), keyboardSteps: list(value.keyboardSteps),
    xboxSteps: list(value.xboxSteps), playstationSteps: list(value.playstationSteps),
    sourceSignature: typeof value.sourceSignature === 'string' ? value.sourceSignature : undefined,
  };
}

function mergeChatAnswers(raw: unknown): ChatAnswerConfig[] {
  const defaults = createDefaultChatAnswers();
  if (!Array.isArray(raw)) return defaults;
  const mergedDefaults = defaults.map((fallback) => {
    const candidate = raw.find((answer): answer is Record<string, unknown> =>
      Boolean(answer) && typeof answer === "object" && (answer as Record<string, unknown>).id === fallback.id,
    );
    if (!candidate || typeof candidate.text !== "string") return fallback;
    const stringList = (value: unknown, fallbackValue: string[]) =>
      Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallbackValue;
    return {
      ...fallback,
      title: typeof candidate.title === "string" ? candidate.title : fallback.title,
      text: candidate.text,
      opening: typeof candidate.opening === 'string' ? candidate.opening : undefined,
      clipIntro: typeof candidate.clipIntro === 'string' ? candidate.clipIntro : undefined,
      keywords: stringList(candidate.keywords, fallback.keywords),
      keyboardSteps: stringList(candidate.keyboardSteps, fallback.keyboardSteps),
      xboxSteps: stringList(candidate.xboxSteps, fallback.xboxSteps),
      playstationSteps: stringList(candidate.playstationSteps, fallback.playstationSteps),
      source: typeof candidate.source === "string" ? candidate.source : fallback.source,
      en: 'en' in candidate ? normalizeEnglish(candidate.en) : fallback.en,
    };
  });

  const defaultIds = new Set(defaults.map((answer) => answer.id));
  const manualAnswers = raw.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const candidate = answer as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      defaultIds.has(candidate.id) ||
      typeof candidate.title !== "string" ||
      typeof candidate.text !== "string"
    ) return [];
    const stringList = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return [{
      id: candidate.id,
      title: candidate.title,
      text: candidate.text,
      opening: typeof candidate.opening === 'string' ? candidate.opening : undefined,
      clipIntro: typeof candidate.clipIntro === 'string' ? candidate.clipIntro : undefined,
      keywords: stringList(candidate.keywords),
      keyboardSteps: stringList(candidate.keyboardSteps),
      xboxSteps: stringList(candidate.xboxSteps),
      playstationSteps: stringList(candidate.playstationSteps),
      source: typeof candidate.source === "string" ? candidate.source : "Manual content",
      isManual: true,
      en: normalizeEnglish(candidate.en),
    }];
  });

  return [...mergedDefaults, ...manualAnswers];
}

function matchManualAnswer(text: string, answerConfigs: ChatAnswerConfig[]): ChatAnswerConfig | undefined {
  return rankConfiguredAnswer(text, answerConfigs.filter(answer => answer.isManual)) as ChatAnswerConfig | undefined;
}

function loadChatAnswers(): ChatAnswerConfig[] {
  try {
    const raw = window.localStorage.getItem(CHAT_ANSWERS_STORAGE_KEY);
    return raw ? mergeChatAnswers(JSON.parse(raw)) : createDefaultChatAnswers();
  } catch {
    return createDefaultChatAnswers();
  }
}

const CHAT_ANSWERS_STORAGE_KEY = "fco-chat-answers-v2";
const CONTROL_SCHEME_STORAGE_KEY = "fco-control-scheme-v1";

function adaptButtonLabels(value: string, controlScheme: ControlScheme): string {
  if (controlScheme === "keyboard") return value;

  const replacements: Array<[RegExp, string]> = controlScheme === "xbox"
    ? [
        [/\bA\s*\/\s*(?:X|✕)/gi, "A"],
        [/\bB\s*\/\s*○/gi, "B"],
        [/\bX\s*\/\s*□/gi, "X"],
        [/\bY\s*\/\s*△/gi, "Y"],
        [/\bLT\s*\/\s*L2\b/gi, "LT"],
        [/\bRT\s*\/\s*R2\b/gi, "RT"],
        [/\bLB\s*\/\s*L1\b/gi, "LB"],
        [/\bRB\s*\/\s*R1\b/gi, "RB"],
      ]
    : [
        [/\bA\s*\/\s*(?:X|✕)/gi, "✕"],
        [/\bB\s*\/\s*○/gi, "○"],
        [/\bX\s*\/\s*□/gi, "□"],
        [/\bY\s*\/\s*△/gi, "△"],
        [/\bLT\s*\/\s*L2\b/gi, "L2"],
        [/\bRT\s*\/\s*R2\b/gi, "R2"],
        [/\bLB\s*\/\s*L1\b/gi, "L1"],
        [/\bRB\s*\/\s*R1\b/gi, "R1"],
      ];

  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
}

function getCannedAnswer(
  cannedKey: string,
  knowledge: KnowledgeItem | undefined,
  controlScheme: ControlScheme,
  answerConfigs: ChatAnswerConfig[],
  language: AnswerLanguage = 'th',
  includeOpening = true,
): { text: string; steps?: string[]; source?: string } {
  const configured = answerConfigs.find((answer) => answer.id === cannedKey);
  const copy = conversationCopy(configured, language, cannedKey);
  if (language === 'en') {
    const english = configured && englishStatus(configured) === 'current' ? configured.en : undefined;
    const englishSteps = english?.[controlScheme === 'keyboard' ? 'keyboardSteps' : controlScheme === 'xbox' ? 'xboxSteps' : 'playstationSteps'];
    return {
      text: withOpening(adaptButtonLabels(english?.text || 'The English version of this guide is being updated. You can check the original learning resource or tell me which part you need help with.', controlScheme), copy.opening, includeOpening)
        + (knowledge?.timeSensitive ? '\n\nTime-sensitive information — check the latest version before using it.' : ''),
      steps: englishSteps?.some(step => step.trim()) ? englishSteps.filter(step => step.trim()).map(step => adaptButtonLabels(step, controlScheme)) : undefined,
      source: configured?.source ?? knowledge?.source,
    };
  }
  const direct = CANNED[cannedKey];
  const base: CannedAnswer = direct
    ? direct
    : knowledge
      ? { text: knowledge.shortSummary, source: knowledge.source }
      : FALLBACK;
  const steps = configured
    ? controlScheme === "keyboard"
      ? configured.keyboardSteps
      : controlScheme === "xbox"
        ? configured.xboxSteps
        : configured.playstationSteps
    : controlScheme === "keyboard"
      ? base.keyboardSteps
      : controlScheme === "xbox"
        ? base.xboxSteps
        : base.playstationSteps;
  const safeSteps = (steps ?? []).filter(step => step.trim());
  const answer = {
    text: withOpening(adaptButtonLabels(configured?.text ?? base.text, controlScheme), copy.opening, includeOpening),
    steps: safeSteps.length > 0 ? safeSteps.map((step) => adaptButtonLabels(step, controlScheme)) : undefined,
    source: configured?.source ?? base.source,
  };
  if (knowledge?.timeSensitive) {
    return {
      ...answer,
      text: answer.text + "\n\nข้อมูลตามช่วงเวลา • ตรวจสอบเวอร์ชันล่าสุดก่อนใช้งาน",
    };
  }
  return answer;
}

// ── Player journey configuration ───────────────────────────────────────────────

const MASCOT = COACH_MASCOT;

const EDUCATION_HUB_URL = "https://educationhub.fconline.garena.in.th/";
const DISCORD_URL = "https://discord.gg/gv4H2ty9Z";
const CUSTOMER_SUPPORT_URL = "https://cs.agentic.garena.in.th/service/fc-online";

interface JourneyStageDefinition {
  id: JourneyStageId;
  day: Day;
  title: string;
  businessOutcome: string;
  playerNeed: string;
  researchSignal: string;
  successEvent: string;
}

const JOURNEY_STAGES: JourneyStageDefinition[] = [
  {
    id: "activation",
    day: 1,
    title: "Activation",
    businessOutcome: "ผู้เล่นเริ่มเล่นได้และระบุจุดที่ติดได้",
    playerNeed: "เข้าใจปุ่ม เมนู และวิธีเริ่มแมตช์แรก",
    researchSignal: "Day 1 onsite: ผู้เล่นต้องการคำแนะนำที่พาไปทำได้ทันที",
    successEvent: "เลือก blocker หรือเปิดคอนเทนต์พื้นฐานครั้งแรก",
  },
  {
    id: "competence",
    day: 2,
    title: "Competence",
    businessOutcome: "ผู้เล่นรู้สึกว่าตัวเองเล่นและพัฒนาทีมได้ดีขึ้น",
    playerNeed: "เรียนรู้ตามจุดอ่อน ไม่ถูกบังคับดูคลิปเดิม",
    researchSignal: "Days 2–3: ความสนุกเพิ่มเมื่อเกิด mastery แต่ลดลงเมื่อการแข่งขันรู้สึกไม่แฟร์",
    successEvent: "เลือกหนึ่งทักษะหรือเป้าหมายทีมและตอบ follow-up",
  },
  {
    id: "next-goal",
    day: 3,
    title: "Next goal",
    businessOutcome: "ผู้เล่นมีเหตุผลกลับมาและรู้ช่องทางช่วยเหลือต่อ",
    playerNeed: "เลือกเป้าหมายเรื่องทีม เศรษฐกิจ หรือการเล่นร่วมกับคนอื่น",
    researchSignal: "Days 4–5 directional: team identity, economy และ social play ขยายแรงจูงใจ",
    successEvent: "เลือก next goal หรือไป Educational Hub / Discord ตามความต้องการ",
  },
];


let _uidSeq = 0;
function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${++_uidSeq}-${Math.random().toString(36).slice(2)}`;
}

// ── KnowledgeCard ──────────────────────────────────────────────────────────────

function KnowledgeCard({ item, answer, language: messageLanguage }: { item: KnowledgeItem; answer?: ChatAnswerConfig; language?: AnswerLanguage }) {
  const { language: uiLanguage } = usePlayerLanguage();
  const cardLanguage = messageLanguage ?? uiLanguage;
  const t = (thai: string, english: string) => cardLanguage === 'en' ? english : thai;
  const english = answer ? (englishStatus(answer) === 'current' ? answer.en : undefined) : ENGLISH_KNOWLEDGE[item.id];
  const title = cardLanguage === 'en' ? english?.title || 'FC Online learning guide' : answer?.title || item.title;
  const summary = cardLanguage === 'en' ? english?.text || 'The English summary is being updated.' : answer?.text || item.shortSummary;
  const [playing, setPlaying] = useState(false);
  let videoId = '';
  try { const url = new URL(item.youtubeUrl); videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || ''; } catch { /* External content stays a link. */ }
  const canEmbed = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  const thumbnail = item.thumbnailUrl || (canEmbed ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);
  function play(event: React.MouseEvent) {
    if (!canEmbed) return;
    event.preventDefault(); event.stopPropagation(); setPlaying(true);
    void request('/api/events', { type: 'content_open', text: item.id }).catch(() => {});
  }
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {playing && canEmbed ? <div className="aspect-video"><iframe className="w-full h-full" title={title} src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : thumbnail ? (
        <a
          href={item.youtubeUrl}
          onClick={play}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative"
          style={{ aspectRatio: "16/9", backgroundColor: "var(--muted)", display: "block" }}
          aria-label={`${t('ดูวิดีโอ', 'Watch video')}: ${title}`}
        >
          <img
            src={thumbnail}
            alt={title}
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
          {title}
        </p>
        {item.thumbnailUrl ? (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {summary}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {cardLanguage === 'en' ? `${item.durationSec} sec` : formatDuration(item.durationSec)}
          </p>
        )}
        {item.timeSensitive && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {t('ข้อมูลตามช่วงเวลา • ตรวจสอบเวอร์ชันล่าสุดก่อนใช้งาน', 'Time-sensitive information — check the latest version.')}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('วิดีโอภาษาไทย', 'Thai-language video')}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {item.source}
            {item.sourceDateLabel ? ` • ${item.sourceDateLabel}` : ""}
          </p>
          <a
            href={item.youtubeUrl}
            onClick={playing ? undefined : play}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--primary)" }}
          >
            {playing ? t('เปิด YouTube', 'Open YouTube') : t('ดูวิดีโอ', 'Watch video')}
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
  large = false,
  disabled = false,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  large?: boolean;
  disabled?: boolean;
}) {
  const { t } = usePlayerLanguage();
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.currentTarget;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !disabled) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div
      className={`coach-composer rounded-2xl overflow-hidden ${large ? 'coach-composer--hero' : ''}`}
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
          placeholder={t('ติดปัญหาอะไร ถามผมได้เลยครับ', 'Ask me anything about FC Online…')}
          aria-label={t('ข้อความถึงโค้ช', 'Message your coach')}
          rows={large ? 3 : 1}
          className="flex-1 resize-none text-sm bg-transparent py-1"
          style={{ color: "var(--foreground)", outline: "none", maxHeight: "120px", lineHeight: "1.6" }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || disabled}
          aria-label={t('ส่งข้อความ', 'Send message')}
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


function PlayerSegmentScreen({ onSelect, onSignIn, busy = false, status = '' }: { onSelect: (segment: PlayerSegment) => void; onSignIn?: () => void; busy?: boolean; status?: string }) {
  const { t } = usePlayerLanguage();
  const options: { id: PlayerSegment; title: string; description: string }[] = [
    {
      id: "new-under-month",
      title: t('เพิ่งเริ่มเล่น', 'Just starting'),
      description: t('เล่น FC Online มาไม่ถึง 1 เดือน', 'Playing FC Online for less than a month'),
    },
    {
      id: "returning-under-month",
      title: t('เพิ่งกลับมาเล่น', 'Coming back'),
      description: t('กลับมาเล่นอีกครั้งไม่ถึง 1 เดือน', 'Returned to FC Online within the past month'),
    },
    {
      id: "experienced",
      title: t('เล่นอยู่แล้ว', 'Already playing'),
      description: t('เล่นเกิน 1 เดือนและเข้าใจระบบหลักแล้ว', 'Playing for over a month and know the basics'),
    },
  ];

  return (
    <div className="rookie-landing" style={{ backgroundColor: "var(--background)" }}>
      <header className="landing-header"><span className="rookie-wordmark">FCO <span>Rookie Coach</span></span><LanguageSwitcher /></header>
      <main className="landing-content">
        <CoachMascot className="landing-mascot" />
        <h1>{t('ตอนนี้คุณอยู่ช่วงไหนของการเล่น?', 'Where are you in your FC Online journey?')}</h1>

        <div className="grid gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              disabled={busy}
              className="segment-option w-full rounded-xl border px-5 py-4 text-left flex items-center justify-between gap-4 transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--card)")}
            >
              <span>
                <span className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>{option.title}</span>
                <span className="block text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{option.description}</span>
              </span>
              <span className="text-lg" aria-hidden style={{ color: "var(--muted-foreground)" }}>›</span>
            </button>
          ))}
        </div>

        <p className="text-xs mt-4 text-center" style={{ color: "var(--muted-foreground)" }}>
          {busy ? t('กำลังเตรียมโค้ชให้คุณ…', 'Getting your coach ready…') : t('เลือกคำแนะนำที่เหมาะกับคุณ', 'A little guidance, tailored to you')}
        </p>
        {status && <p role="alert" className="text-sm text-red-700 mt-3 text-center">{status}</p>}
        {onSignIn && <button className="landing-signin disabled:opacity-40 disabled:cursor-not-allowed" disabled={busy || PUBLIC_TRIAL} onClick={onSignIn}>{PUBLIC_TRIAL ? t('เข้าสู่ระบบ · ยังไม่เปิดใช้งาน', 'Sign in · Coming soon') : t('มีบัญชีทดสอบแล้ว? เข้าสู่ระบบ', 'Already a tester? Sign in')}</button>}
        {PUBLIC_TRIAL && <p className="text-xs text-center mt-2 text-stone-500">{t('ทดลองแบบไม่ล็อกอิน · ประวัติเก็บในเบราว์เซอร์นี้เท่านั้น', 'Guest trial · History stays in this browser only')}</p>}
      </main>
    </div>
  );
}

function ExperiencedPlayerScreen({ onBack }: { onBack: () => void }) {
  const { t } = usePlayerLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ backgroundColor: "var(--background)" }}>
      <div className="absolute right-5 top-5"><LanguageSwitcher /></div>
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "var(--muted)" }}>
            <img src={MASCOT} alt="FCO Rookie Coach mascot" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--primary)" }}>FCO Rookie Coach</p>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: "var(--foreground)" }}>{t('เลือกพื้นที่ที่เหมาะกับคุณ', 'Find your next advantage')}</h1>
          </div>
        </div>

        <div className="grid gap-3">
          <a
            href={EDUCATION_HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border px-5 py-4 flex items-center gap-4 transition-colors"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
          >
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>
              <BookOpen size={18} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Educational Hub</span>
              <span className="block text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t('ดูคลังวิดีโอ เทคนิค และข้อมูลเกมทั้งหมด', 'Explore videos, tips and game guides')}</span>
            </span>
            <ExternalLink size={15} style={{ color: "var(--muted-foreground)" }} aria-hidden />
          </a>

          <div className="rounded-xl border px-5 py-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                <MessageCircle size={18} aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('เข้า Discord FC Online แล้วหรือยัง?', 'Have you joined FC Online Discord?')}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{t('ถามผู้เล่นคนอื่น หาเพื่อน และติดตามกิจกรรมจากชุมชน', 'Ask other players, find teammates and follow community events')}</p>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 h-9 px-4 rounded-lg inline-flex items-center gap-2 text-xs font-semibold"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {t('เข้า Discord FC Online', 'Join FC Online Discord')}
                  <ExternalLink size={13} aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onBack} className="mt-5 text-xs w-full text-center hover:underline" style={{ color: "var(--muted-foreground)" }}>
          {t('กลับไปเลือกประเภทผู้เล่น', 'Back to player selection')}
        </button>
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

// ── Notification projection ────────────────────────────────────────────────────

function buildPlayerNotifications(plans: DailyDeliveryPlan[]): AppNotification[] {
  return plans
    .filter((plan) => plan.channel === "notification" && !plan.notificationHidden && plan.status === "active")
    .map((plan) => ({
      id: plan.id,
      title: plan.name,
      body: plan.message,
      time: plan.notificationTime?.trim() || "ข้อความใหม่",
      read: !(plan.notificationUnread ?? true),
      topicId: plan.notificationContentId,
    }));
}

// ── CoachScreen ────────────────────────────────────────────────────────────────

function CoachScreen({
  segment,
  onLogout,
  onReportQuestion,
  answerConfigs,
  faqConfigs,
  deliveryPlans,
}: {
  segment: Exclude<PlayerSegment, "experienced">;
  onLogout: () => void;
  onReportQuestion: (question: string, recentContext: string) => void;
  answerConfigs: ChatAnswerConfig[];
  faqConfigs: FaqConfigItem[];
  deliveryPlans: DailyDeliveryPlan[];
}) {
  const [activeTab, setActiveTab] = useState<PlayerTab>("chat");
  const { language, t } = usePlayerLanguage();
  const account = useContext(AccountContext);
  const saved = account?.state || {};
  const [saveError, setSaveError] = useState('');
  const [npsOpen, setNpsOpen] = useState(false);
  const [npsDone, setNpsDone] = useState(false);
  const [npsRead, setNpsRead] = useState(Boolean(saved.npsRead));
  const [lastProactiveDay, setLastProactiveDay] = useState<number>(saved.lastProactiveDay || 0);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [localConversationId] = useState(() => saved.localConversationId || uid());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => buildPlayerNotifications(deliveryPlans));

  const [messages, setMessages] = useState<Message[]>(saved.messages || []);
  const isFirstChat = !messages.some(message => message.role === 'user');
  const [isTyping, setIsTyping] = useState(false);
  const [chipMode, setChipMode] = useState<ChipMode | null>(saved.chipMode === undefined ? "activation" : saved.chipMode);
  const [activeProactivePlanId, setActiveProactivePlanId] = useState<string | null>(saved.activeProactivePlanId || null);
  const [journeyStage, setJourneyStage] = useState<JourneyStageId>(saved.journeyStage || "activation");
  const [shownTopicIds, setShownTopicIds] = useState<Set<string>>(new Set<string>(saved.shownTopicIds || []));
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [controlScheme, setControlScheme] = useState<ControlScheme>(() => {
    if (account?.state.controlScheme) return account.state.controlScheme;
    const saved = window.localStorage.getItem(CONTROL_SCHEME_STORAGE_KEY);
    if (saved === "keyboard" || saved === "playstation" || saved === "xbox") return saved;
    return "xbox";
  });
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  const [reportedQueries, setReportedQueries] = useState<Set<string>>(new Set<string>(saved.reportedQueries || []));

  const npsEligible = !PUBLIC_TRIAL && !npsDone && !account?.npsCompleted && (account?.questionCount ?? 0) >= (account?.npsAfterMessages ?? 2);
  const hasUnread = notifications.some((n) => !n.read) || (npsEligible && !npsRead);
  const activeChatPlans = deliveryPlans.filter((plan) => plan.status === "active" && plan.channel === "chat");
  const activeProactivePlan = activeProactivePlanId
    ? activeChatPlans.find((plan) => plan.id === activeProactivePlanId) ?? null
    : null;

  function markRead(id: string) {
    setNotifications((prev) => prev.some(n => n.id === id && !n.read)
      ? prev.map(n => n.id === id ? { ...n, read: true } : n) : prev);
  }

  useEffect(() => {
    setNotifications(buildPlayerNotifications(deliveryPlans.filter(p => p.day <= (account?.day || 1))).map(n => ({ ...n, read: saved.readNotifications?.includes(n.id) || n.read })));
  }, [deliveryPlans, account?.day]);

  useEffect(() => {
    if (!account || messages.length === 0) return;
    const state = { segment, messages: messages.slice(-100), chipMode, activeProactivePlanId, journeyStage, shownTopicIds: [...shownTopicIds], controlScheme, readNotifications: notifications.filter(n => n.read).map(n => n.id), npsDone, npsRead, localConversationId, lastProactiveDay, reportedQueries: [...reportedQueries] };
    const flush = () => { if (PUBLIC_TRIAL) trialRequest('/api/player/state', { state }); else navigator.sendBeacon('/api/player/state', new Blob([JSON.stringify({ state })], { type: 'application/json' })); };
    window.addEventListener('pagehide', flush);
    const timer = setTimeout(() => {
      void request('/api/player/state', { state }, 'PUT').then(() => setSaveError('')).catch(e => setSaveError(e.message));
    }, 250);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', flush); };
  }, [messages, chipMode, activeProactivePlanId, journeyStage, shownTopicIds, controlScheme, notifications, npsDone, npsRead, lastProactiveDay, reportedQueries]);

  useEffect(() => {
    const firstPlan = deliveryPlans.find((plan) => plan.status === "active" && plan.channel === "chat" && plan.isStart)
      ?? deliveryPlans.find((plan) => plan.status === "active" && plan.channel === "chat");
    if (saved.messages?.length) {
      // Preserve an unfinished branch. A later-day check-in starts only on a fresh visit.
      const next = deliveryPlans.find(p => p.status === 'active' && p.channel === 'chat' && p.dailyEntry && p.day === account?.day);
      if (!saved.activeProactivePlanId && (saved.lastProactiveDay || 1) < (account?.day || 1) && next) {
        setMessages(prev => [...prev, { id: uid(), role: 'assistant', text: next.message }]);
        setActiveProactivePlanId(next.id); setChipMode(null); setJourneyStage(next.stageId); setLastProactiveDay(account?.day || 1);
      }
      return;
    }
    setLastProactiveDay(account?.day || 1);
    setMessages([
      {
        id: uid(),
        role: "assistant",
        text: firstPlan?.message || (segment === "returning-under-month"
          ? "ยินดีต้อนรับกลับมาครับ ตอนนี้ส่วนไหนของเกมที่ยังไม่คุ้นที่สุด?"
          : "ยินดีต้อนรับครับ ตอนนี้ส่วนไหนของเกมที่ยังติดอยู่?"),
      },
    ]);
    setActiveProactivePlanId(firstPlan?.id ?? null);
    setJourneyStage("activation");
    setChipMode(firstPlan ? null : "activation");
    setShownTopicIds(new Set<string>());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const previousCount = previousMessageCount.current;
    previousMessageCount.current = messages.length;
    const pane = chatScrollRef.current;
    if (!pane || !messages.length || messages.length === previousCount) return;
    // Start at the first reply in a new batch, not its final card or video.
    const newReply = messages.findIndex((message, index) => index >= previousCount && message.role === 'assistant');
    const index = newReply >= 0 ? newReply : messages.length - 1;
    const target = pane.querySelector<HTMLElement>(`[data-chat-index="${index}"]`);
    if (target) {
      const padding = parseFloat(getComputedStyle(pane).paddingTop) || 0;
      pane.scrollTo({ top: pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - padding, behavior: 'instant' });
    }
    // Typing, thumbnail loads and feedback updates must not pull readers down.
  }, [messages]);

  function append(msgs: Omit<Message, "id">[]) {
    for (const m of msgs.filter(m => m.role === 'user')) void request('/api/events', { type: 'question', text: m.text, conversationId: localConversationId }).catch(e => setSaveError(e.message));
    setMessages((prev) => [...prev, ...msgs.map((m) => ({ ...m, id: uid() }))]);
  }

  function botDelay(fn: () => void, ms = 800) {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); fn(); }, ms);
  }

  function showTopic(id: string) {
    setShownTopicIds((prev) => new Set([...prev, id]));
  }

  function chooseControlScheme(nextScheme: ControlScheme) {
    setControlScheme(nextScheme);
    window.localStorage.setItem(CONTROL_SCHEME_STORAGE_KEY, nextScheme);
  }

  function openCompetencePrompt() {
    setActiveProactivePlanId(null);
    setJourneyStage("competence");
    append([{ role: "assistant", text: "ตอนนี้อยากพัฒนาเรื่องไหนให้เล่นได้มั่นใจขึ้น?" }]);
    setChipMode("competence");
  }

  function openNextGoalPrompt() {
    setActiveProactivePlanId(null);
    setJourneyStage("next-goal");
    append([{ role: "assistant", text: "ต่อจากนี้อยากตั้งเป้าหมายเรื่องไหนก่อน?" }]);
    setChipMode("next-goal");
  }

  function presentJourneyContent(label: string, topicId: string) {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: label }]);
    const topic = findKnowledge(topicId);
    const answer = getCannedAnswer(topicId, topic, controlScheme, answerConfigs, language);
    const alreadyShown = shownTopicIds.has(topicId);
    botDelay(() => {
      if (!alreadyShown) showTopic(topicId);
      append([
        {
          role: "assistant",
          language,
          text: alreadyShown
            ? t(`เราเคยเปิดเรื่อง ${topic?.title ?? label} แล้วครับ ตอนนี้ติดขั้นตอนไหนเป็นพิเศษ?`, 'Which part of that guide would you like help with?')
            : answer.text,
          feedbackEligible: !alreadyShown,
          steps: alreadyShown ? undefined : answer.steps,
          knowledgeId: alreadyShown ? undefined : topicId,
        },
        { role: "assistant", text: t("ดูแล้วเป็นอย่างไรบ้าง?", 'How did it go?'), language },
      ]);
      setChipMode("post-content");
    });
  }

  function handleActivationReady() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "เริ่มเล่นได้แล้ว" }]);
    botDelay(openCompetencePrompt, 550);
  }

  function handleContentUnderstood() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "เข้าใจแล้ว" }]);
    botDelay(() => {
      if (journeyStage === "activation") openCompetencePrompt();
      else if (journeyStage === "competence") openNextGoalPrompt();
      else append([{ role: "assistant", text: "ดีมากครับ เป้าหมายต่อไปชัดแล้ว ถ้ามีอะไรติดขัดกลับมาถามผมได้เสมอ" }]);
    }, 550);
  }

  function handleStillStuck() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "ยังติดอยู่" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "บอกผมสั้น ๆ ได้เลยครับว่าติดตรงปุ่ม เมนู จังหวะเล่น หรือการจัดทีม" }]);
      setTimeout(() => composerRef.current?.focus(), 200);
    }, 450);
  }

  function handleChooseAnother() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "เลือกเรื่องอื่น" }]);
    botDelay(() => {
      if (journeyStage === "activation") openCompetencePrompt();
      else if (journeyStage === "competence") openCompetencePrompt();
      else openNextGoalPrompt();
    }, 450);
  }

  function handleSocialGoal() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "เล่นกับเพื่อน" }]);
    botDelay(() => {
      append([{
        role: "assistant",
        text: "ถ้าอยากหาเพื่อนหรือถามผู้เล่นคนอื่น ผมพาไปชุมชนได้ครับ แต่ไม่จำเป็นต้องเข้า Discord ถ้ายังไม่พร้อม",
        showDiscord: true,
      }]);
    }, 550);
  }

  function handleOpenQuestion() {
    setActiveProactivePlanId(null);
    setChipMode(null);
    append([{ role: "user", text: "ยังมีคำถาม" }]);
    botDelay(() => {
      append([{ role: "assistant", text: "พิมพ์คำถามได้เลยครับ ถ้าฐานข้อมูลยังไม่มี ผมจะลองถาม AI-INsea หรือส่งให้ทีมเพิ่มข้อมูล" }]);
      setTimeout(() => composerRef.current?.focus(), 200);
    }, 450);
  }

  async function handleProactiveChoice(branch: ProactiveBranch) {
    try { await request('/api/auth/session'); } catch (e) { setSaveError((e as Error).message); window.dispatchEvent(new Event('rookie-access-expired')); return; }
    setChipMode(null);
    append([{ role: "user", text: branch.choice }]);

    botDelay(() => {
      if (branch.action === "next_question") {
        const nextPlan = activeChatPlans.find((candidate) => candidate.id === branch.nextPlanId);
        if (nextPlan) {
          append([{ role: "assistant", text: nextPlan.message.trim() || "คำถามนี้ยังไม่มีข้อความ" }]);
          setActiveProactivePlanId(nextPlan.id);
        } else {
          append([{ role: "assistant", text: "คำตอบนี้ยังไม่ได้ลิงก์ไปยังคำถามถัดไป กรุณาพิมพ์สิ่งที่อยากรู้ได้เลยครับ" }]);
          setActiveProactivePlanId(null);
        }
        return;
      }

      const replies: Omit<Message, "id">[] = [];
      if (branch.reply.trim()) replies.push({ role: "assistant", text: branch.reply.trim(), feedbackEligible: !isPromptText(branch.reply) });

      if (branch.contentId) {
        const topic = KNOWLEDGE.find((knowledge) => knowledge.topicId === branch.contentId);
        if (topic) {
          const answer = getCannedAnswer(topic.id, topic, controlScheme, answerConfigs, language);
          showTopic(topic.id);
          replies.push({
            role: "assistant",
            text: answer.text,
            language,
            feedbackEligible: true,
            steps: answer.steps,
            knowledgeId: topic.id,
          });
        }
      }

      if (replies.length > 0) append(replies);
      setActiveProactivePlanId(null);
    }, 450);
  }

  // ─ Free-text send ─────────────────────────────────────────────────────────

  async function answerQuestion(question: string) {
    const recentLanguage = messages.filter(message => message.role === 'user').reduce<AnswerLanguage>((previous, message) => selectAnswerLanguage(message.text, previous), language);
    const replyLanguage = selectAnswerLanguage(question, recentLanguage);
    try { await request('/api/auth/session'); } catch (e) { setSaveError((e as Error).message); setIsTyping(false); window.dispatchEvent(new Event('rookie-access-expired')); return; }
    if (/^(ยังงง|งง|ไม่เข้าใจ|ยังไม่เข้าใจ|confused|still confused|i(?:'m| am) confused|i don'?t understand)[.!?\s]*$/i.test(question.trim())) {
      const previous = [...messages].reverse().find(message => message.role === 'assistant' && message.feedbackEligible);
      if (previous) {
        setIsTyping(false);
        append([{ role: 'assistant', language: replyLanguage, feedbackEligible: false,
          text: replyLanguage === 'en'
            ? 'Which part of that answer is unclear? Tell me the step or what happens when you try, and we can work through it.'
            : 'ติดตรงไหนของคำตอบเมื่อกี้ครับ? บอกขั้นตอนที่งง หรือว่าเวลาลองแล้วเกิดอะไรขึ้น เดี๋ยวค่อย ๆ ดูกันครับ' }]);
        return;
      }
    }
    if (isMoneyQuestion(question)) {
      void request('/api/events', { type: 'knowledge' }).catch(() => {});
      const moneyTopics = ["welcome-pass", "mission-hub"];
      moneyTopics.forEach(showTopic);
      setTimeout(() => {
        setIsTyping(false);
        append([{
          role: "assistant",
          language: replyLanguage,
          text: replyLanguage === 'en'
            ? 'Looking for rewards to get your squad going? Let’s start here.\n\nStart with Welcome Pass for starter rewards, then visit Mission Hub to complete missions and claim more rewards.'
            : "กำลังหาของมาเริ่มทำทีมใช่ไหมครับ ลองเริ่มตรงนี้ได้เลย\n\nเริ่มจาก Welcome Pass เพื่อรับของเริ่มต้น แล้วเข้า Mission Hub ทำภารกิจและรับรางวัลต่อครับ",
          feedbackEligible: true,
          relatedIds: moneyTopics,
        }]);
      }, 450);
      return;
    }

    const manualAnswer = matchManualAnswer(question, answerConfigs);
    if (manualAnswer) {
      void request('/api/events', { type: 'knowledge' }).catch(() => {});
      const answer = getCannedAnswer(manualAnswer.id, undefined, controlScheme, answerConfigs, replyLanguage, !shownTopicIds.has(manualAnswer.id));
      const alreadyShown = shownTopicIds.has(manualAnswer.id);
      if (!alreadyShown) showTopic(manualAnswer.id);
      setTimeout(() => {
        setIsTyping(false);
        append([{
          role: "assistant",
          language: replyLanguage,
          text: answer.text,
          feedbackEligible: true,
          steps: answer.steps,
        }]);
      }, 450);
      return;
    }

    const matched = matchKnowledge(question, answerConfigs);
    if (matched) {
      void request('/api/events', { type: 'knowledge' }).catch(() => {});
      const knowledge = findKnowledge(matched.id);
      const answer = getCannedAnswer(matched.id, knowledge, controlScheme, answerConfigs, replyLanguage, !shownTopicIds.has(matched.id));
      const alreadyShown = shownTopicIds.has(matched.id);
      if (!alreadyShown) showTopic(matched.id);
      setTimeout(() => {
        setIsTyping(false);
        append([{
          role: "assistant",
          language: replyLanguage,
          text: answer.text,
          feedbackEligible: true,
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
        body: JSON.stringify({
          query: question,
          conversationId,
          inputMethod: controlScheme,
          context: messages
            .filter((message) => message.role === "user" || message.role === "assistant")
            .slice(-6)
            .map((message) => ({ role: message.role, text: [message.text, ...(message.steps || [])].join('\n') })),
        }),
      });
      const result = await response.json();
      if (response.status === 429) {
        setIsTyping(false);
        append([{ role: 'assistant', language: replyLanguage, text: replyLanguage === 'en' ? 'A few too many questions at once — please try again in a minute.' : 'ตอนนี้มีคำถามเข้ามาค่อนข้างเยอะครับ รอสักหนึ่งนาทีแล้วลองใหม่ได้เลย', feedbackEligible: false }]);
        return;
      }
      if (!response.ok || typeof result.answer !== "string" || !result.answer.trim()) {
        throw new Error("AI fallback unavailable");
      }
      const cleaned = normalizeAiResponse(result.answer, result.actions);
      if (!cleaned.answer) throw new Error('AI fallback returned an empty answer');
      result.answer = cleaned.answer;
      result.actions = cleaned.actions;

      if (typeof result.conversationId === "string") {
        setConversationId(result.conversationId);
      }
      setIsTyping(false);
      const actions = Array.isArray(result.actions)
        ? result.actions.filter((action: unknown): action is ResponseActionId =>
            action === "education_hub" ||
            action === "discord" ||
            action === "customer_support" ||
            action === "report_question",
          )
        : [];
      append([{
        role: "assistant",
        text: adaptButtonLabels(result.answer.trim(), controlScheme),
        language: replyLanguage,
        feedbackEligible: !actions.includes('report_question') && !isPromptText(result.answer),
        aiSource: "AI-INsea",
        actions,
        reportQuestion: actions.includes("report_question") ? question : undefined,
      }]);
      void request('/api/events', { type: 'ai' }).catch(() => {});
      if (actions.includes('report_question')) {
        try { await request('/api/unanswered', { question, reason: 'ai_unanswered' }); setReportedQueries(prev => new Set([...prev, question])); } catch (e) { setSaveError((e as Error).message); }
      }
    } catch {
      void request('/api/events', { type: 'system_error', text: question }).catch(() => {});
      try { await request('/api/unanswered', { question, reason: 'system_error' }); setReportedQueries(prev => new Set([...prev, question])); } catch (e) { setSaveError((e as Error).message); }
      setIsTyping(false);
      append([{
        role: "assistant",
        language: replyLanguage,
        text: replyLanguage === 'en'
          ? "I couldn’t connect to the assistant just now. Please try again shortly, or ask the FC Online community."
          : "ตอนนี้เชื่อมต่อผู้ช่วย AI ไม่สำเร็จครับ ลองอีกครั้งสักครู่ หรือสอบถามชุมชน FC Online ต่อได้เลย",
        aiSource: "mock",
        showDiscord: true,
        reportQuestion: question,
      }]);
    }
  }

  function handleSend() {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    const currentProactivePlan = activeProactivePlan;
    setInput("");
    setChipMode(null);
    setActiveProactivePlanId(null);
    append([{ role: "user", text }]);
    setIsTyping(true);
    if (currentProactivePlan?.elseAction === "next_question") {
      const nextPlan = activeChatPlans.find((candidate) => candidate.id === currentProactivePlan.elseNextPlanId);
      setTimeout(() => {
        setIsTyping(false);
        if (nextPlan) {
          append([{ role: "assistant", text: nextPlan.message.trim() || "คำถามนี้ยังไม่มีข้อความ" }]);
          setActiveProactivePlanId(nextPlan.id);
        } else {
          append([{ role: "assistant", text: "ELSE ยังไม่ได้ลิงก์ไปยังคำถามถัดไป กรุณาพิมพ์สิ่งที่อยากรู้ได้เลยครับ" }]);
        }
      }, 450);
      return;
    }
    if (currentProactivePlan?.elseAction === "reply" && currentProactivePlan.elseReply.trim()) {
      setTimeout(() => {
        setIsTyping(false);
        append([{ role: "assistant", text: currentProactivePlan.elseReply.trim(), feedbackEligible: !isPromptText(currentProactivePlan.elseReply) }]);
      }, 450);
      return;
    }
    void answerQuestion(text);
  }

  function sendFaq(faq: FaqConfigItem) {
    if (isTyping) return;
    setActiveTab("chat");
    setInput("");
    setChipMode(null);
    setActiveProactivePlanId(null);
    const question = language === 'en' ? englishFaqQuestion(faq) || faq.question : faq.question;
    append([{ role: "user", text: question, language }]);
    setIsTyping(true);
    if (isMoneyQuestion(question)) {
      void answerQuestion(question);
      return;
    }

    const primary = KNOWLEDGE.find((item) => item.topicId === faq.topicId);
    const manualPrimary = answerConfigs.find((answer) => answer.isManual && answer.id === faq.topicId);
    const secondary = faq.secondaryTopicId
      ? KNOWLEDGE.find((item) => item.topicId === faq.secondaryTopicId)
      : undefined;
    const manualSecondary = faq.secondaryTopicId
      ? answerConfigs.find((answer) => answer.isManual && answer.id === faq.secondaryTopicId)
      : undefined;
    if (manualPrimary) {
      void request('/api/events', { type: 'knowledge' }).catch(() => {});
      const answer = getCannedAnswer(manualPrimary.id, undefined, controlScheme, answerConfigs, language, !shownTopicIds.has(manualPrimary.id));
      showTopic(manualPrimary.id);
      if (manualSecondary) showTopic(manualSecondary.id);
      setTimeout(() => {
        setIsTyping(false);
        append([{
          role: "assistant",
          text: answer.text,
          language,
          feedbackEligible: true,
          steps: answer.steps,
        }]);
      }, 450);
      return;
    }
    if (!primary) {
      void answerQuestion(question);
      return;
    }

    const answer = getCannedAnswer(primary.id, primary, controlScheme, answerConfigs, language, !shownTopicIds.has(primary.id));
    void request('/api/events', { type: 'knowledge' }).catch(() => {});
    showTopic(primary.id);
    if (secondary) showTopic(secondary.id);
    setTimeout(() => {
      setIsTyping(false);
      append([{
        role: "assistant",
        text: answer.text,
        language,
        feedbackEligible: true,
        steps: answer.steps,
        knowledgeId: secondary ? undefined : primary.id,
        relatedIds: secondary ? [primary.id, secondary.id] : undefined,
      }]);
    }, 450);
  }

  const FAQ_CHIPS = faqConfigs.filter((faq) => faq.question.trim().length > 0 && (language === 'th' || Boolean(englishFaqQuestion(faq))));

  const chipSets: Record<NonNullable<ChipMode>, { label: string; action: () => void }[]> = {
    activation: [
      { label: "ยังไม่คุ้นปุ่ม", action: () => presentJourneyContent("ยังไม่คุ้นปุ่ม", "controller") },
      { label: "ไม่รู้จะเริ่มตรงไหน", action: () => presentJourneyContent("ไม่รู้จะเริ่มตรงไหน", "qss") },
      { label: "ติดระหว่างแข่ง", action: () => presentJourneyContent("ติดระหว่างแข่ง", "passing") },
      { label: "เริ่มเล่นได้แล้ว", action: handleActivationReady },
    ],
    competence: [
      { label: "เล่นให้คล่อง", action: () => presentJourneyContent("เล่นให้คล่อง", "passing") },
      { label: "จัดทีม", action: () => presentJourneyContent("จัดทีม", "qss") },
      { label: "รางวัลและภารกิจ", action: () => presentJourneyContent("รางวัลและภารกิจ", "mission-hub") },
      { label: "ยังไม่แน่ใจ", action: handleOpenQuestion },
    ],
    "next-goal": [
      { label: "สร้างทีมให้ดีขึ้น", action: () => presentJourneyContent("สร้างทีมให้ดีขึ้น", "transfer-market") },
      { label: "หา BP และรางวัล", action: () => presentJourneyContent("หา BP และรางวัล", "mission-hub") },
      { label: "เล่นกับเพื่อน", action: handleSocialGoal },
      { label: "ยังมีคำถาม", action: handleOpenQuestion },
    ],
    "post-content": [
      { label: "เข้าใจแล้ว", action: handleContentUnderstood },
      { label: "ยังติดอยู่", action: handleStillStuck },
      { label: "เลือกเรื่องอื่น", action: handleChooseAnother },
    ],
  };

  const activeChips = activeProactivePlan
    ? activeProactivePlan.branches
        .filter((branch) => branch.choice.trim())
        .map((branch) => ({ label: branch.choice, action: () => handleProactiveChoice(branch) }))
    : chipMode ? chipSets[chipMode] : [];

  return (
    <div className="h-dvh flex overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
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
            {t('โค้ช', 'Coach')}
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
            {t('แจ้งเตือน', 'Notifications')}
          </button>

          <div className="mt-4 mx-1 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              {t('วิธีควบคุม', 'Controls')}
            </p>
            {([
              { id: "keyboard" as ControlScheme, label: t('คีย์บอร์ด', 'Keyboard'), icon: <Keyboard size={15} aria-hidden /> },
              { id: "xbox" as ControlScheme, label: "Xbox · XYAB", icon: <Gamepad2 size={15} aria-hidden /> },
              { id: "playstation" as ControlScheme, label: "PS · □ △ ○ ✕", icon: <Gamepad2 size={15} aria-hidden /> },
            ]).map((option) => {
              const selected = controlScheme === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => chooseControlScheme(option.id)}
                  className="w-full min-h-9 px-2 rounded-md flex items-center gap-2 text-xs font-medium text-left transition-colors"
                  style={{
                    color: selected ? "var(--primary)" : "var(--foreground)",
                    backgroundColor: selected ? "rgba(196,30,30,0.07)" : "transparent",
                  }}
                  aria-pressed={selected}
                >
                  <span style={{ color: selected ? "var(--primary)" : "var(--muted-foreground)" }}>{option.icon}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
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
            {t('ออกจากระบบ', 'Sign out')}
          </button>
        </div>
      </nav>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center gap-3 flex-wrap px-4 md:px-6 py-3 shrink-0 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <CoachMascot className="w-10 h-10 shrink-0" />
          <div className="flex flex-col gap-0.5 mr-auto">
            <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
              {t('โค้ชมือใหม่', 'Rookie Coach')}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t('ถามเรื่องเกม ทีม และรางวัลได้เลย', 'Gameplay, squads and rewards')}
            </span>
          </div>
          <LanguageSwitcher />
          <label className="md:hidden">
            <span className="sr-only">{t('วิธีควบคุม', 'Controls')}</span>
            <select
              value={controlScheme}
              onChange={(event) => chooseControlScheme(event.target.value as ControlScheme)}
              className="h-8 px-2 rounded-md text-xs outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
            >
              <option value="keyboard">{t('คีย์บอร์ด', 'Keyboard')}</option>
              <option value="xbox">Xbox · XYAB</option>
              <option value="playstation">PS · □ △ ○ ✕</option>
            </select>
          </label>
        </header>

        {/* ── Notification inbox ───────────────────────────────────────────── */}
        {saveError && <p role="alert" className="px-4 py-2 bg-amber-50 text-sm">ยังบันทึกประวัติไม่สำเร็จ: {saveError}</p>}
        {hasUnread && !toastDismissed && !isFirstChat && activeTab === 'chat' && <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-b"><button className="text-sm flex-1 text-left" onClick={() => { setActiveTab('notifications'); setToastDismissed(true); }}>{t('🔔 มีคำแนะนำใหม่สำหรับคุณ · ดูแจ้งเตือน', '🔔 New tips for you · View notifications')}</button><button aria-label={t('ปิดแจ้งเตือน', 'Dismiss notification')} onClick={() => setToastDismissed(true)}>✕</button></div>}
        {npsOpen && <Nps onClose={() => setNpsOpen(false)} onDone={() => { setNpsOpen(false); setNpsDone(true); }} />}
        {activeTab === "notifications" && (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 pb-[calc(1.25rem+56px)] md:pb-5">
            <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t('แจ้งเตือน', 'Notifications')}</h2>
            <div className="flex flex-col gap-2 max-w-lg">
              {npsEligible && <button className="text-left rounded-xl border p-4 bg-white" onClick={() => { setNpsRead(true); setNpsOpen(true); }}><span className="flex items-center gap-2 font-medium text-sm"><Clock size={16} />{!npsRead && <span className="w-2 h-2 rounded-full bg-red-600" />}ประเมิน Rookie Coach</span><span className="block text-sm text-stone-500 mt-1">อยากแนะนำให้เพื่อนแค่ไหน? ให้คะแนน 0–10</span></button>}
              {notifications.map((notif) => {
                const linkedTopic = notif.topicId ? findKnowledge(notif.topicId) : undefined;
                return (
                  <div
                    key={notif.id}
                    onClickCapture={() => markRead(notif.id)}
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
                          <button onClick={() => markRead(notif.id)}
                            className="text-sm font-medium leading-snug"
                            style={{ color: notif.read ? "var(--foreground)" : "var(--foreground)", fontWeight: notif.read ? 400 : 600 }}
                          >
                            {notif.title}
                          </button>
                          <span className="text-[11px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{notif.time}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-3">
                          {notif.body && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{notif.body}</p>}
                          {linkedTopic && <KnowledgeCard item={linkedTopic} answer={answerConfigs.find(answer => answer.id === linkedTopic.id)} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {notifications.length === 0 && !npsEligible && <p className="text-sm text-stone-500">{t('ยังไม่มีแจ้งเตือนใหม่ครับ', 'No new notifications yet.')}</p>}
            </div>
          </div>
        )}

        {/* ── Chat view ───────────────────────────────────────────────────── */}
        {activeTab === "chat" && (
          <>
            {/* Message timeline */}
            {!isFirstChat && <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-5 flex flex-col gap-3" style={{ overflowAnchor: 'none' }}>
              {messages.map((storedMessage, messageIndex) => {
                const cleaned = storedMessage.role === 'assistant' && storedMessage.aiSource === 'AI-INsea'
                  ? normalizeAiResponse(storedMessage.text, storedMessage.actions) : undefined;
                const msg = cleaned ? { ...storedMessage, text: cleaned.answer, actions: cleaned.actions } : storedMessage;
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
                    <div key={msg.id} data-chat-index={messageIndex} className="flex justify-end shrink-0">
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
                const clipTopicId = topic?.id ?? msg.relatedIds?.[0];
                const clipIntro = clipTopicId ? conversationCopy(answerConfigs.find(answer => answer.id === clipTopicId), msg.language ?? language, clipTopicId).clipIntro : '';
                return (
                  <div key={msg.id} data-chat-index={messageIndex} className="flex justify-start gap-2 shrink-0">
                    <CoachMascot className="w-9 h-9 shrink-0" />
                    <div className="max-w-[85%] md:max-w-lg flex flex-col gap-2">
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
                      {clipIntro && <p className="text-sm px-4 py-2" style={{ color: 'var(--foreground)' }}>{adaptButtonLabels(clipIntro, controlScheme)}</p>}
                      {topic ? <KnowledgeCard item={topic} answer={answerConfigs.find(answer => answer.id === topic.id)} language={msg.language} /> : null}
                      {!PUBLIC_TRIAL && canRateMessage(msg) && <Rating language={msg.language ?? language} messageId={msg.id} text={msg.text} question={messages.slice(0, messageIndex).reverse().find(m => m.role === 'user')?.text || ''} />}
                      {msg.relatedIds?.map((rid) => {
                        const relTopic = findKnowledge(rid);
                        return relTopic ? <KnowledgeCard key={rid} item={relTopic} answer={answerConfigs.find(answer => answer.id === rid)} language={msg.language} /> : null;
                      })}
                      {msg.showDiscord && (
                        <a
                          href={DISCORD_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs transition-opacity hover:opacity-60"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          ยังไม่ตรง? ถามชุมชน FC Online Discord →
                        </a>
                      )}
                      {msg.actions?.some((action) => action !== "report_question") && (
                        <div className="flex flex-wrap gap-2">
                          {msg.actions.includes("education_hub") && (
                            <a
                              href={EDUCATION_HUB_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                            >
                              ไป Educational Hub <ExternalLink size={12} aria-hidden />
                            </a>
                          )}
                          {msg.actions.includes("discord") && (
                            <a
                              href={DISCORD_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                            >
                              เข้า Discord FC Online <ExternalLink size={12} aria-hidden />
                            </a>
                          )}
                          {msg.actions.includes("customer_support") && (
                            <a
                              href={CUSTOMER_SUPPORT_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                            >
                              ติดต่อ Customer Service <ExternalLink size={12} aria-hidden />
                            </a>
                          )}
                        </div>
                      )}
                      {msg.reportQuestion && (() => {
                        const q = msg.reportQuestion!;
                        const alreadyReported = reportedQueries.has(q);
                        return (
                          <button
                            disabled={alreadyReported}
                            onClick={async () => {
                              if (alreadyReported) return;
                              setReportedQueries((prev) => new Set([...prev, q]));
                              const ctx = messages
                                .filter((m) => m.role === "user")
                                .slice(-3)
                                .map((m) => m.text)
                                .join(" → ");
                              try {
                                await onReportQuestion(q, ctx);
                                append([{ role: "assistant", text: "ส่งคำถามให้ทีมแล้ว ขอบคุณครับ" }]);
                              } catch {
                                setReportedQueries(prev => { const next = new Set(prev); next.delete(q); return next; });
                                append([{ role: "assistant", text: "ยังส่งคำถามไม่สำเร็จ กรุณาลองอีกครั้งครับ" }]);
                              }
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
            </div>}

            {/* Chips + Composer footer */}
            <div
              className={isFirstChat ? 'chat-launch px-4 md:px-6' : 'px-4 md:px-6 pt-3 pb-[calc(0.75rem+56px)] md:pb-5 flex flex-col gap-2 shrink-0'}
              style={{ borderTop: isFirstChat ? undefined : "1px solid var(--border)", backgroundColor: "var(--background)" }}
            >
              <div className="chat-input-content mx-auto w-full flex flex-col gap-3">
                {isFirstChat && <div className="chat-launch-intro">
                  <CoachMascot className="chat-launch-mascot" />
                  <h1>{t('ให้ผมช่วยอะไรดีครับ?', 'How can I help you?')}</h1>
                  {messages[0]?.text && <p className="welcome-question">{messages[0].text}</p>}
                  {activeChips.length > 0 && <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {activeChips.map(chip => <button disabled={isTyping} key={chip.label} onClick={chip.action} className="welcome-choice">{chip.label}</button>)}
                  </div>}
                </div>}
                {/* FAQ strip — always visible */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)" }}>
                    {t('คำถามที่พบบ่อย', 'Frequently asked questions')}
                  </span>
                  <div className="faq-strip flex flex-wrap gap-1.5">
                    {FAQ_CHIPS.map((faq) => (
                      <button
                        key={faq.id}
                        onClick={() => sendFaq(faq)}
                        disabled={isTyping}
                        className="min-h-9 py-1.5 px-3 rounded-full text-xs border transition-colors disabled:opacity-50"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {language === 'en' ? englishFaqQuestion(faq) : faq.question}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context chips */}
                {!isFirstChat && activeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={chip.action}
                        disabled={isTyping}
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
                <Composer input={input} setInput={setInput} onSend={handleSend} textareaRef={composerRef} large={isFirstChat} disabled={isTyping} />
                {language === 'en' && <p className="text-[11px] text-stone-500 text-center">Videos and team-written proactive messages may be in Thai.</p>}
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
          {t('โค้ช', 'Coach')}
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
          {t('แจ้งเตือน', 'Notifications')}
        </button>
        <button
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-xs transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="ออกจากระบบ"
        >
          <LogOut size={16} aria-hidden />
          {t('ออก', 'Sign out')}
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
  {
    id: "pm-1", day: 1, stageId: "activation", name: "เช็กว่าเล่นเกมแรกหรือยัง", channel: "chat", isStart: true,
    message: "เล่นเกมแรกไปแล้วหรือยัง?",
    branches: [
      { id: "pm-1-if", kind: "if", choice: "ยังไม่ได้เล่น", action: "next_question", reply: "", nextPlanId: "pm-2-start" },
      { id: "pm-1-elseif", kind: "elseif", choice: "เล่นแล้ว", action: "next_question", reply: "", nextPlanId: "pm-2" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-2-start", day: 1, stageId: "activation", name: "ถามโหมดที่อยากเริ่ม", channel: "chat", isStart: false,
    message: "อยากเริ่มเล่นโหมดไหน?",
    branches: [
      { id: "pm-2-start-if", kind: "if", choice: "ฝึกกับคอม", action: "reply", reply: "เริ่มจากโหมดฝึกกับคอมเพื่อทำความคุ้นเคยกับปุ่มและจังหวะเกมได้เลยครับ" },
      { id: "pm-2-start-elseif-1", kind: "elseif", choice: "แข่งกับผู้เล่นอื่น", action: "reply", reply: "ลองฝึกพื้นฐานสั้น ๆ ก่อน แล้วค่อยเข้าโหมดแข่งกับผู้เล่นอื่นครับ" },
      { id: "pm-2-start-elseif-2", kind: "elseif", choice: "ยังไม่แน่ใจ", action: "reply", reply: "เริ่มจากโหมดฝึกกับคอมก่อน เหมาะที่สุดสำหรับทำความคุ้นเคยกับเกมครับ" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-2", day: 1, stageId: "activation", name: "ถามโหมดที่เพิ่งเล่น", channel: "chat", isStart: false,
    message: "เกมแรกที่เล่นเป็นโหมดไหน?",
    branches: [
      { id: "pm-2-if", kind: "if", choice: "ฝึกกับคอม", action: "next_question", reply: "", nextPlanId: "pm-3" },
      { id: "pm-2-elseif-1", kind: "elseif", choice: "แข่งกับผู้เล่นอื่น", action: "next_question", reply: "", nextPlanId: "pm-3" },
      { id: "pm-2-elseif-2", kind: "elseif", choice: "โหมดอื่น", action: "next_question", reply: "", nextPlanId: "pm-3" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-3", day: 1, stageId: "activation", name: "หาสิ่งที่ติดหลังเกมแรก", channel: "chat", isStart: false,
    message: "แล้วตอนเล่น ติดตรงไหนมากที่สุด?",
    branches: [
      { id: "pm-3-if", kind: "if", choice: "กดปุ่มยังไม่คล่อง", action: "reply", reply: "ใช้คีย์บอร์ด Xbox หรือ PlayStation?", contentId: "FCO-EDU-030" },
      { id: "pm-3-elseif-1", kind: "elseif", choice: "บุกไม่ออก / ยิงไม่เข้า", action: "reply", reply: "ติดที่ส่งบอล หาช่องยิง หรือยิงแล้วไม่เข้ามากกว่ากัน?", contentId: "FCO-EDU-001" },
      { id: "pm-3-elseif-2", kind: "elseif", choice: "รับไม่ทัน / โดนแย่งบอล", action: "reply", reply: "ติดที่ตามคู่แข่งไม่ทัน หรือแย่งบอลแล้วฟาวล์?", contentId: "FCO-EDU-044" },
      { id: "pm-3-elseif-3", kind: "elseif", choice: "คู่แข่งยากเกินไป", action: "reply", reply: "อยากฝึกเรื่องบุกหรือรับก่อน?" },
      { id: "pm-3-elseif-4", kind: "elseif", choice: "ยังไม่ติดอะไร", action: "next_question", reply: "", nextPlanId: "pm-5" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-4", day: 2, stageId: "competence", name: "ถามต่อหลังส่งคำตอบ", channel: "chat", isStart: false, dailyEntry: true,
    message: "ลองแล้วเป็นอย่างไรบ้าง?",
    branches: [
      { id: "pm-4-if", kind: "if", choice: "เข้าใจแล้ว", action: "next_question", reply: "", nextPlanId: "pm-5" },
      { id: "pm-4-elseif-1", kind: "elseif", choice: "ยังติดอยู่", action: "reply", reply: "บอกผมสั้น ๆ ได้เลยว่าติดตรงปุ่มหรือจังหวะไหน" },
      { id: "pm-4-elseif-2", kind: "elseif", choice: "เลือกเรื่องอื่น", action: "reply", reply: "อยากถามเรื่องไหนต่อ?" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-5", day: 3, stageId: "next-goal", name: "เลือกเป้าหมายถัดไป", channel: "chat", isStart: false, dailyEntry: true,
    message: "ต่อไปอยากทำอะไรใน FC Online?",
    branches: [
      { id: "pm-5-if", kind: "if", choice: "สร้างทีมให้ดีขึ้น", action: "reply", reply: "เริ่มจากทีมที่มี แล้วค่อยเติมตำแหน่งที่ขาดครับ", contentId: "FCO-EDU-041" },
      { id: "pm-5-elseif-1", kind: "elseif", choice: "หา BP และรางวัล", action: "reply", reply: "เริ่มจาก Welcome Pass และ Mission Hub ก่อนครับ", contentId: "FCO-EDU-018" },
      { id: "pm-5-elseif-2", kind: "elseif", choice: "เล่นกับเพื่อน", action: "reply", reply: "ไปต่อที่ชุมชน FC Online Discord ได้เลยครับ" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "active",
  },
  {
    id: "pm-6", day: 3, stageId: "next-goal", name: "ส่งต่อเมื่อยังไม่มีคำตอบ", channel: "chat", isStart: false,
    message: "อยากไปต่อทางไหน?",
    branches: [
      { id: "pm-6-if", kind: "if", choice: "Education Hub", action: "reply", reply: "เปิด Education Hub ให้แล้วครับ" },
      { id: "pm-6-elseif-1", kind: "elseif", choice: "Discord", action: "reply", reply: "เข้า Discord FC Online ได้เลยครับ" },
      { id: "pm-6-elseif-2", kind: "elseif", choice: "ส่งคำถามให้ทีม", action: "reply", reply: "รับเรื่องแล้วครับ ทีมจะใช้คำถามนี้เพิ่มฐานความรู้" },
    ],
    elseAction: "ai_fallback", elseReply: "",
    status: "draft",
  },
  {
    id: "notif-1", day: 1, stageId: "activation", name: "มีอะไรติดก่อนลงสนามไหม?", channel: "notification", isStart: false,
    message: "บอกโค้ชได้เลยว่าติดเรื่องปุ่ม เมนู หรือการเริ่มแมตช์ แล้วค่อยเปิดเนื้อหาที่ตรงกับคุณ",
    branches: [], elseAction: "reply", elseReply: "", notificationTime: "วันนี้ 09:00",
    notificationContentId: "passing", notificationUnread: false, notificationManaged: true, status: "active",
  },
  {
    id: "notif-2", day: 2, stageId: "competence", name: "เลือกหนึ่งเรื่องที่อยากเล่นให้ดีขึ้น", channel: "notification", isStart: false,
    message: "จะฝึกส่งบอล เกมรับ หรือจัดทีมก่อนก็ได้ โค้ชจะไม่ส่งคลิปเดิมซ้ำถ้าคุณเคยดูแล้ว",
    branches: [], elseAction: "reply", elseReply: "", notificationTime: "เมื่อวาน 10:30",
    notificationContentId: "controller", notificationUnread: true, notificationManaged: true, status: "active",
  },
  {
    id: "notif-3", day: 3, stageId: "next-goal", name: "เป้าหมายต่อไปของคุณคืออะไร?", channel: "notification", isStart: false,
    message: "เลือกเรื่องสร้างทีม หา BP หรือเล่นกับเพื่อน เพื่อรับคำแนะนำและช่องทางต่อที่เหมาะกับคุณ",
    branches: [], elseAction: "reply", elseReply: "", notificationTime: "เมื่อวาน 18:00",
    notificationUnread: true, notificationManaged: true, status: "active",
  },
];


const FAQ_CONFIG: FaqConfigItem[] = [
  { id: "faq-money", question: "หาเงินจากไหน", stageId: "next-goal", topicId: "FCO-EDU-007", secondaryTopicId: "FCO-EDU-018", trigger: "หาเงิน, หา BP, เงินไม่พอ, รางวัล" },
  { id: "faq-passing", question: "ส่งบอลยังไง", stageId: "activation", topicId: "FCO-EDU-043", trigger: "ส่งบอล, จ่ายบอล, passing" },
  { id: "faq-defending", question: "เล่นเกมรับยังไง", stageId: "competence", topicId: "FCO-EDU-044", trigger: "เกมรับ, ป้องกัน, เข้าสกัด" },
  { id: "faq-shooting", question: "ยิงยังไงให้คม", stageId: "competence", topicId: "FCO-EDU-001", trigger: "ยิง, จบสกอร์, shooting" },
  { id: "faq-controller", question: "เชื่อมจอยยังไง", stageId: "activation", topicId: "FCO-EDU-030", trigger: "จอย, controller, ตั้งค่าจอย" },
  { id: "faq-rewards", question: "หา BP และรางวัลยังไง", stageId: "next-goal", topicId: "FCO-EDU-018", trigger: "BP, เงิน, รางวัล, ภารกิจ" },
];

const FAQ_CONFIG_STORAGE_KEY = "fco-faq-config-v1";

function englishFaqQuestion(faq: FaqConfigItem): string | undefined {
  if (faq.questionEn !== undefined) {
    return faq.questionEnSource === faq.question && faq.questionEn.trim() ? faq.questionEn.trim() : undefined;
  }
  return FAQ_ENGLISH_BY_QUESTION[faq.question];
}

function normalizeFaqConfigs(raw: unknown): FaqConfigItem[] {
  if (!Array.isArray(raw)) return FAQ_CONFIG;
  const stageIds = new Set<JourneyStageId>(["activation", "competence", "next-goal"]);
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.question !== "string" ||
      typeof candidate.trigger !== "string" ||
      typeof candidate.topicId !== "string" ||
      candidate.topicId.trim().length === 0 ||
      !stageIds.has(candidate.stageId as JourneyStageId)
    ) return [];
    const secondaryTopicId =
      typeof candidate.secondaryTopicId === "string" && candidate.secondaryTopicId.trim().length > 0
        ? candidate.secondaryTopicId
        : undefined;
    return [{
      id: candidate.id,
      question: candidate.question,
      questionEn: typeof candidate.questionEn === 'string' ? candidate.questionEn : FAQ_ENGLISH_BY_QUESTION[candidate.question],
      questionEnSource: typeof candidate.questionEnSource === 'string' ? candidate.questionEnSource
        : candidate.questionEn === undefined && FAQ_ENGLISH_BY_QUESTION[candidate.question] ? candidate.question : undefined,
      stageId: candidate.stageId as JourneyStageId,
      topicId: candidate.topicId,
      secondaryTopicId,
      trigger: candidate.trigger,
    }];
  });
}

function normalizeDeliveryPlans(raw: unknown): DailyDeliveryPlan[] {
  if (!Array.isArray(raw)) return INITIAL_DAILY_DELIVERY_PLANS;
  const stageIds = new Set<JourneyStageId>(["activation", "competence", "next-goal"]);
  const channels = new Set<DeliveryChannel>(["notification", "chat"]);
  const statuses = new Set<DailyDeliveryPlan["status"]>(["active", "draft"]);
  const normalized = raw.flatMap((item, planIndex): DailyDeliveryPlan[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const textFields = ["id", "name", "message"];
    if (
      !textFields.every((field) => typeof candidate[field] === "string") ||
      ![1, 2, 3].includes(candidate.day as number) ||
      !stageIds.has(candidate.stageId as JourneyStageId) ||
      !channels.has(candidate.channel as DeliveryChannel) ||
      !statuses.has(candidate.status as DailyDeliveryPlan["status"])
    ) return [];

    const rawBranches = Array.isArray(candidate.branches)
      ? candidate.branches
      : Array.isArray(candidate.responseOptions)
        ? candidate.responseOptions.map((choice, index) => ({
            id: `${candidate.id}-legacy-${index}`,
            kind: index === 0 ? "if" : "elseif",
            choice,
            reply: "",
          }))
        : [];
    const branches = rawBranches.flatMap((branch, index) => {
      if (!branch || typeof branch !== "object") return [];
      const value = branch as Record<string, unknown>;
      if (typeof value.choice !== "string" || typeof value.reply !== "string") return [];
      return [{
        id: typeof value.id === "string" ? value.id : `${candidate.id}-branch-${index}`,
        kind: index === 0 ? "if" as const : "elseif" as const,
        choice: value.choice,
        action: value.action === "next_question" ? "next_question" as const : "reply" as const,
        reply: value.reply,
        nextPlanId: typeof value.nextPlanId === "string" && value.nextPlanId.trim() ? value.nextPlanId : undefined,
        contentId: typeof value.contentId === "string" && value.contentId.trim() ? value.contentId : undefined,
      }];
    });

    const legacyFallback = typeof candidate.fallback === "string" ? candidate.fallback : "";
    return [{
      id: candidate.id as string,
      day: candidate.day as DeliveryDay,
      stageId: candidate.stageId as JourneyStageId,
      name: candidate.name as string,
      channel: candidate.channel as DeliveryChannel,
      isStart: typeof candidate.isStart === "boolean" ? candidate.isStart : planIndex === 0,
      dailyEntry: candidate.dailyEntry === true,
      message: candidate.message as string,
      branches,
      elseAction: candidate.elseAction === "reply" || candidate.elseAction === "next_question" || candidate.elseAction === "ai_fallback"
        ? candidate.elseAction
        : legacyFallback.toLowerCase().includes("ai") ? "ai_fallback" : "reply",
      elseReply: typeof candidate.elseReply === "string" ? candidate.elseReply : legacyFallback,
      elseNextPlanId: typeof candidate.elseNextPlanId === "string" && candidate.elseNextPlanId.trim()
        ? candidate.elseNextPlanId
        : undefined,
      notificationTime: typeof candidate.notificationTime === "string" ? candidate.notificationTime : undefined,
      notificationContentId: typeof candidate.notificationContentId === "string" && candidate.notificationContentId.trim()
        ? candidate.notificationContentId
        : undefined,
      notificationUnread: typeof candidate.notificationUnread === "boolean" ? candidate.notificationUnread : undefined,
      notificationManaged: candidate.notificationManaged === true,
      notificationHidden: candidate.notificationHidden === true,
      status: candidate.status as DailyDeliveryPlan["status"],
    }];
  });

  const hasManagedNotificationConfig = normalized.some((plan) => plan.channel === "notification" && plan.notificationManaged);
  if (hasManagedNotificationConfig) return normalized;

  const defaultNotifications = INITIAL_DAILY_DELIVERY_PLANS
    .filter((plan) => plan.channel === "notification")
    .map((plan) => ({ ...plan }));
  return [...normalized.filter((plan) => plan.channel === "chat"), ...defaultNotifications];
}

function parsePublishedSections(raw: unknown): ConfigSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is ConfigSection => value === "faq_content" || value === "proactive_messages");
}

function loadFaqConfigs(): FaqConfigItem[] {
  try {
    const raw = window.localStorage.getItem(FAQ_CONFIG_STORAGE_KEY);
    if (!raw) return FAQ_CONFIG;
    return normalizeFaqConfigs(JSON.parse(raw));
  } catch {
    return FAQ_CONFIG;
  }
}


// ── AdminProactiveMessages ─────────────────────────────────────────────────────

function SaveChangesButton({
  state,
  onClick,
  disabled,
}: {
  state: SaveState;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = state === "saving" ? "กำลังบันทึก..." : state === "saved" ? "บันทึกแล้ว" : "Save changes";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "saving"}
      className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0 transition-opacity disabled:opacity-45"
      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      {label}
    </button>
  );
}

function AdminProactiveMessages({
  plans,
  setPlans,
  onSave,
  configStatus,
}: {
  plans: DailyDeliveryPlan[];
  setPlans: (fn: (prev: DailyDeliveryPlan[]) => DailyDeliveryPlan[]) => void;
  onSave: (plans: DailyDeliveryPlan[]) => Promise<void>;
  configStatus: SharedConfigStatus;
}) {
  const [stageFilter, setStageFilter] = useState<JourneyStageId | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  function patch(id: string, update: Partial<DailyDeliveryPlan>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...update } : p)));
    setSaveState("idle");
  }

  function patchBranch(planId: string, branchId: string, update: Partial<ProactiveBranch>) {
    setPlans((prev) => prev.map((plan) => plan.id === planId
      ? { ...plan, branches: plan.branches.map((branch) => branch.id === branchId ? { ...branch, ...update } : branch) }
      : plan));
    setSaveState("idle");
  }

  function addElseIf(planId: string) {
    setPlans((prev) => prev.map((plan) => plan.id === planId
      ? {
          ...plan,
          branches: [...plan.branches, {
            id: uid(),
            kind: plan.branches.length === 0 ? "if" : "elseif",
            choice: "",
            action: "reply",
            reply: "",
          }],
        }
      : plan));
    setSaveState("idle");
  }

  function removeBranch(planId: string, branchId: string) {
    setPlans((prev) => prev.map((plan) => {
      if (plan.id !== planId) return plan;
      const branches = plan.branches.filter((branch) => branch.id !== branchId)
        .map((branch, index) => ({ ...branch, kind: index === 0 ? "if" as const : "elseif" as const }));
      return { ...plan, branches };
    }));
    setSaveState("idle");
  }

  function setStartPlan(planId: string) {
    setPlans((prev) => prev.map((plan) => ({ ...plan, isStart: plan.id === planId })));
    setSaveState("idle");
  }

  function removePlan(planId: string) {
    const target = plans.find((plan) => plan.id === planId);
    if (!target) return;
    const inboundLinks = plans.reduce((count, plan) => (
      count
      + plan.branches.filter((branch) => branch.nextPlanId === planId).length
      + (plan.elseNextPlanId === planId ? 1 : 0)
    ), 0);
    const linkWarning = inboundLinks > 0 ? ` มี ${inboundLinks} กิ่งที่ลิงก์มาคำถามนี้และจะถูกล้างปลายทาง` : "";
    if (!window.confirm(`ลบ Proactive Message “${target.name}”?${linkWarning} การลบจะมีผลหลังจากกด Save changes`)) return;

    setPlans((prev) => {
      const remaining = prev.filter((plan) => plan.id !== planId);
      const replacementStart = target.isStart
        ? remaining.find((plan) => plan.channel === "chat" && plan.status === "active")
          ?? remaining.find((plan) => plan.channel === "chat")
        : undefined;
      return remaining.map((plan) => ({
        ...plan,
        isStart: target.isStart && plan.channel === "chat" ? plan.id === replacementStart?.id : plan.isStart,
        branches: plan.branches.map((branch) => branch.nextPlanId === planId ? { ...branch, nextPlanId: undefined } : branch),
        elseNextPlanId: plan.elseNextPlanId === planId ? undefined : plan.elseNextPlanId,
      }));
    });
    setEditingId(null);
    setSaveState("idle");
  }

  const chatPlans = plans.filter((plan) => plan.channel === "chat");
  const visiblePlans = stageFilter === "all" ? chatPlans : chatPlans.filter((p) => p.stageId === stageFilter);
  const inputCls = "h-9 px-3 rounded-md text-sm w-full";
  const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", outline: "none" as const };
  const CHANNEL_LABELS: Record<DeliveryChannel, string> = { notification: "Notification", chat: "Chat" };

  async function saveChanges() {
    setSaveState("saving");
    setSaveError("");
    try {
      await onSave(plans);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกการเปลี่ยนแปลงได้");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Proactive Messages</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {([2, 3] as const).map(day => <label key={day} className="flex flex-col gap-1">ข้อความเช็กอิน Day {day}<select aria-label={`ข้อความเช็กอิน Day ${day}`} className="border rounded-lg p-2 bg-white" value={plans.find(p => p.day === day && p.dailyEntry)?.id || ''} onChange={event => setPlans(prev => prev.map(p => p.day === day ? { ...p, dailyEntry: p.id === event.target.value } : p))}><option value="">ไม่ส่งเช็กอิน</option>{plans.filter(p => p.channel === 'chat' && p.day === day && p.status === 'active').map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>)}
          </div>
          <p className="text-xs mt-2 text-stone-500">Day 1 ใช้ Welcome message • Day 2–3 ส่งเมื่อกลับมาและไม่มีคำถามเดิมค้างอยู่ • บันทึกด้วย Save changes</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            เลือก Welcome message หลัก 1 ข้อ แล้วให้ทุก IF / ELSE IF / ELSE ตอบเป็นข้อความหรือไปยังคำถามอื่น
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveChangesButton state={saveState} onClick={saveChanges} disabled={configStatus !== "ready"} />
          <button
            className="h-9 px-4 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
            onClick={() => {
              const stage = stageFilter === "all" ? "activation" : stageFilter;
              const day = JOURNEY_STAGES.find((s) => s.id === stage)?.day ?? 1;
              const id = uid();
              setPlans((prev) => [...prev, {
                id, day, stageId: stage, name: "New proactive message", channel: "chat", isStart: false,
                message: "", branches: [{ id: uid(), kind: "if", choice: "", action: "reply", reply: "" }],
                elseAction: "ai_fallback", elseReply: "", status: "draft",
              }]);
              setEditingId(id);
              setSaveState("idle");
            }}
          >
            + เพิ่มข้อความ
          </button>
        </div>
      </div>

      {configStatus !== "ready" && (
        <p className="text-xs" style={{ color: "var(--primary)" }}>
          {configStatus === "loading" ? "กำลังเชื่อม shared storage..." : "ยังไม่ได้เชื่อม shared storage · การแก้ไขจะอยู่ใน browser นี้เท่านั้น"}
        </p>
      )}
      {saveError && <p className="text-xs" style={{ color: "var(--primary)" }}>{saveError}</p>}

      <div className="flex flex-wrap gap-2">
        {(["all", "activation", "competence", "next-goal"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setStageFilter(value)}
            className="h-8 px-3 rounded-full text-xs font-medium border"
            style={{
              borderColor: stageFilter === value ? "var(--primary)" : "var(--border)",
              color: stageFilter === value ? "var(--primary)" : "var(--muted-foreground)",
              backgroundColor: stageFilter === value ? "rgba(196,30,30,0.05)" : "transparent",
            }}
          >
            {value === "all" ? "All stages" : JOURNEY_STAGES.find((s) => s.id === value)?.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {visiblePlans.map((plan) => {
          const isEditing = editingId === plan.id;
          const stage = JOURNEY_STAGES.find((s) => s.id === plan.stageId);

          return (
            <div
              key={plan.id}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isEditing ? "var(--primary)" : "var(--border)"}` }}
            >
              <button
                onClick={() => setEditingId(isEditing ? null : plan.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ backgroundColor: isEditing ? "rgba(196,30,30,0.04)" : "var(--card)" }}
              >
                <span className="text-xs font-bold w-24 shrink-0" style={{ color: "var(--primary)" }}>{stage?.title}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{
                    backgroundColor: plan.channel === "notification" ? "rgba(43,108,58,0.12)" : "rgba(196,30,30,0.08)",
                    color: plan.channel === "notification" ? "var(--accent)" : "var(--primary)",
                  }}
                >
                  {CHANNEL_LABELS[plan.channel]}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
                  IF + {Math.max(plan.branches.length - 1, 0)} ELSE IF
                </span>
                {plan.isStart && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>
                    WELCOME
                  </span>
                )}
                <span className="text-xs flex-1 min-w-0">
                  <span className="block font-semibold truncate" style={{ color: "var(--foreground)" }}>{plan.name}</span>
                  <span className="block truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{plan.message || "ยังไม่มีข้อความ"}</span>
                </span>
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

              {isEditing && (
                <div
                  className="flex flex-col gap-4 px-4 py-4"
                  style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Research stage (หลังบ้านเท่านั้น)</label>
                      <select value={plan.stageId} onChange={(e) => {
                        const nextStage = e.target.value as JourneyStageId;
                        patch(plan.id, { stageId: nextStage, day: JOURNEY_STAGES.find((s) => s.id === nextStage)?.day ?? 1 });
                      }} className={inputCls} style={inputStyle}>
                        {JOURNEY_STAGES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Channel</label>
                      <div className={`${inputCls} flex items-center`} style={{ ...inputStyle, backgroundColor: "var(--muted)" }}>
                        Chat · Interactive IF / ELSE flow
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Message name</label>
                    <input value={plan.name} onChange={(e) => patch(plan.id, { name: e.target.value })} className={inputCls} style={inputStyle} />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                        {plan.isStart ? "Welcome message หลัก" : "คำถามต่อเนื่อง"}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {plan.isStart ? "ผู้เล่นจะเห็นคำถามนี้เป็นข้อความแรก" : "จะแสดงเฉพาะเมื่อ IF / ELSE ลิงก์มาถึง"}
                      </p>
                    </div>
                    {!plan.isStart && plan.channel === "chat" && (
                      <button
                        type="button"
                        onClick={() => setStartPlan(plan.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "transparent" }}
                      >
                        ตั้งเป็น Welcome
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      {plan.isStart ? "Welcome message" : "Question / Bot message"}
                    </label>
                    <textarea
                      value={plan.message}
                      onChange={(e) => patch(plan.id, { message: e.target.value })}
                      rows={2}
                      className="px-3 py-2 rounded-md text-sm resize-none"
                      style={{ ...inputStyle, lineHeight: "1.6" }}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Multiple-choice replies</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>คำตอบแต่ละข้อจะเป็นปุ่มให้ผู้เล่นเลือก</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addElseIf(plan.id)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                      >
                        + เพิ่ม ELSE IF
                      </button>
                    </div>

                    {plan.branches.map((branch, index) => (
                      <div key={branch.id} className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: index === 0 ? "rgba(196,30,30,0.08)" : "var(--muted)", color: index === 0 ? "var(--primary)" : "var(--muted-foreground)" }}>
                            {index === 0 ? "IF" : "ELSE IF"}
                          </span>
                          {plan.branches.length > 1 && (
                            <button type="button" onClick={() => removeBranch(plan.id, branch.id)} className="text-[10px]" style={{ color: "var(--primary)" }}>ลบตัวเลือก</button>
                          )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                            ถ้าผู้เล่นเลือก
                            <input
                              value={branch.choice}
                              onChange={(event) => patchBranch(plan.id, branch.id, { choice: event.target.value })}
                              placeholder="เช่น เล่นแล้ว"
                              className={inputCls}
                              style={inputStyle}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                            จากนั้น
                            <select
                              value={branch.action}
                              onChange={(event) => patchBranch(plan.id, branch.id, { action: event.target.value as ProactiveBranch["action"] })}
                              className={inputCls}
                              style={inputStyle}
                            >
                              <option value="reply">ตอบเป็นข้อความ</option>
                              <option value="next_question">ไปยังคำถามอื่น</option>
                            </select>
                          </label>
                        </div>
                        {branch.action === "next_question" ? (
                          <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                            ไปยังคำถาม
                            <select
                              value={branch.nextPlanId ?? ""}
                              onChange={(event) => patchBranch(plan.id, branch.id, { nextPlanId: event.target.value || undefined })}
                              className={inputCls}
                              style={inputStyle}
                            >
                              <option value="">— เลือกคำถามถัดไป —</option>
                              {plans.filter((target) => target.id !== plan.id && target.channel === "chat").map((target) => (
                                <option key={target.id} value={target.id}>
                                  {target.name} · {target.message || "ยังไม่มีข้อความ"}{target.status === "draft" ? " (Draft)" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <>
                            <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                              ให้ Bot ตอบ
                              <textarea
                                value={branch.reply}
                                onChange={(event) => patchBranch(plan.id, branch.id, { reply: event.target.value })}
                                placeholder="ข้อความตอบกลับ"
                                rows={2}
                                className="px-3 py-2 rounded-md text-sm resize-none"
                                style={{ ...inputStyle, lineHeight: "1.6" }}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                              ส่ง Content เพิ่มเติม (ไม่บังคับ)
                              <select
                                value={branch.contentId ?? ""}
                                onChange={(event) => patchBranch(plan.id, branch.id, { contentId: event.target.value || undefined })}
                                className={inputCls}
                                style={inputStyle}
                              >
                                <option value="">— ไม่ส่ง content —</option>
                                {KNOWLEDGE.map((knowledge) => (
                                  <option key={knowledge.topicId} value={knowledge.topicId}>{knowledge.topicId} · {knowledge.title}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold w-fit" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>ELSE</span>
                    <label className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>เมื่อไม่ตรงกับตัวเลือกด้านบน</label>
                    <select
                      value={plan.elseAction}
                      onChange={(event) => patch(plan.id, { elseAction: event.target.value as DailyDeliveryPlan["elseAction"] })}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="ai_fallback">ใช้ AI fallback</option>
                      <option value="reply">ตอบด้วยข้อความที่กำหนด</option>
                      <option value="next_question">ไปยังคำถามอื่น</option>
                    </select>
                    {plan.elseAction === "reply" ? (
                      <textarea
                        value={plan.elseReply}
                        onChange={(event) => patch(plan.id, { elseReply: event.target.value })}
                        rows={2}
                        placeholder="ข้อความตอบกลับเมื่อไม่ตรงกับตัวเลือก"
                        className="px-3 py-2 rounded-md text-sm resize-none"
                        style={{ ...inputStyle, lineHeight: "1.6" }}
                      />
                    ) : plan.elseAction === "next_question" ? (
                      <select
                        value={plan.elseNextPlanId ?? ""}
                        onChange={(event) => patch(plan.id, { elseNextPlanId: event.target.value || undefined })}
                        className={inputCls}
                        style={inputStyle}
                      >
                        <option value="">— เลือกคำถามถัดไป —</option>
                        {plans.filter((target) => target.id !== plan.id && target.channel === "chat").map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name} · {target.message || "ยังไม่มีข้อความ"}{target.status === "draft" ? " (Draft)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        ระบบจะค้น Manual Content และฐานความรู้ก่อน แล้วจึงเรียก AI-INsea
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => patch(plan.id, { status: "draft" })}
                        className="h-8 px-3 rounded-lg text-xs font-medium border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        ตั้งเป็น Draft
                      </button>
                      <button
                        onClick={() => { patch(plan.id, { status: "active" }); setEditingId(null); }}
                        className="h-8 px-3 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        เปิดใช้งาน
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => removePlan(plan.id)}
                        className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-60"
                        style={{ color: "var(--primary)" }}
                      >
                        <Trash2 size={13} aria-hidden />
                        ลบข้อความนี้
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs transition-opacity hover:opacity-60"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        กด Save changes เพื่อเผยแพร่ข้อความให้ผู้เล่นเห็นหลังโหลดหน้าใหม่
      </p>
    </div>
  );
}

// ── AdminNotifications ─────────────────────────────────────────────────────────

function AdminNotifications({
  plans,
  setPlans,
  onSave,
  configStatus,
}: {
  plans: DailyDeliveryPlan[];
  setPlans: React.Dispatch<React.SetStateAction<DailyDeliveryPlan[]>>;
  onSave: (plans: DailyDeliveryPlan[]) => Promise<void>;
  configStatus: SharedConfigStatus;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const notificationPlans = plans.filter((plan) => plan.channel === "notification" && !plan.notificationHidden);
  const inputCls = "h-9 px-3 rounded-md text-sm w-full";
  const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", outline: "none" as const };

  function patchNotification(id: string, update: Partial<DailyDeliveryPlan>) {
    setPlans((prev) => prev.map((plan) => plan.id === id ? { ...plan, ...update } : plan));
    setSaveState("idle");
  }

  function addNotification() {
    const id = uid();
    setPlans((prev) => [...prev, {
      id,
      day: 1,
      stageId: "activation",
      name: "Notification ใหม่",
      channel: "notification",
      isStart: false,
      message: "",
      branches: [],
      elseAction: "reply",
      elseReply: "",
      notificationTime: "วันนี้ 09:00",
      notificationUnread: true,
      notificationManaged: true,
      status: "draft",
    }]);
    setSaveState("idle");
  }

  function removeNotification(id: string) {
    if (!window.confirm("ลบ Notification นี้? การลบจะมีผลหลังจากกด Save changes")) return;
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
    setSaveState("idle");
  }

  async function saveChanges() {
    setSaveState("saving");
    setSaveError("");
    try {
      const visibleNotifications = plans.filter((plan) => plan.channel === "notification" && !plan.notificationHidden);
      const withoutNotificationPlaceholders = plans.filter((plan) => !(plan.channel === "notification" && plan.notificationHidden));
      const payloadPlans = visibleNotifications.length > 0
        ? withoutNotificationPlaceholders.map((plan) => plan.channel === "notification" ? { ...plan, notificationManaged: true } : plan)
        : [...withoutNotificationPlaceholders, {
            id: "notifications-empty",
            day: 1 as DeliveryDay,
            stageId: "activation" as JourneyStageId,
            name: "",
            channel: "notification" as DeliveryChannel,
            isStart: false,
            message: "",
            branches: [],
            elseAction: "reply" as const,
            elseReply: "",
            notificationManaged: true,
            notificationHidden: true,
            status: "draft" as const,
          }];
      setPlans(() => payloadPlans);
      await onSave(payloadPlans);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึก Notification ได้");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Notifications</h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            จัดการข้อความในกล่องแจ้งเตือน แยกจาก Proactive Chat flow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveChangesButton state={saveState} onClick={saveChanges} disabled={configStatus !== "ready"} />
          <button
            type="button"
            onClick={addNotification}
            className="h-9 px-4 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
          >
            + เพิ่ม Notification
          </button>
        </div>
      </div>

      {configStatus !== "ready" && (
        <p className="text-xs" style={{ color: "var(--primary)" }}>
          {configStatus === "loading" ? "กำลังเชื่อม shared storage..." : "ยังไม่ได้เชื่อม shared storage · การแก้ไขจะอยู่ใน browser นี้เท่านั้น"}
        </p>
      )}
      {saveError && <p className="text-xs" style={{ color: "var(--primary)" }}>{saveError}</p>}

      <div className="rounded-lg border px-4 py-3 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
        Day เป็นข้อมูลหลังบ้านเท่านั้น ส่วนข้อความเวลาเป็นสิ่งที่ผู้เล่นเห็น เช่น “วันนี้ 09:00” ระบบ MVP จะแสดง Notification ที่ Active เมื่อผู้เล่นโหลดหน้าใหม่
      </div>

      {!PUBLIC_TRIAL && <NpsSettings />}
      {notificationPlans.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <Bell className="mx-auto mb-3" size={22} style={{ color: "var(--muted-foreground)" }} aria-hidden />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>ยังไม่มี Notification</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>เพิ่มรายการแรก แล้วกด Save changes เพื่อเผยแพร่</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notificationPlans.map((plan) => (
            <div key={plan.id} className="rounded-xl border p-4 flex flex-col gap-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              <div className="flex items-center gap-2">
                <Bell size={15} style={{ color: "var(--primary)" }} aria-hidden />
                <span className="text-xs font-semibold flex-1 truncate" style={{ color: "var(--foreground)" }}>{plan.name || "Notification ไม่มีชื่อ"}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>Day {plan.day}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: plan.status === "active" ? "rgba(43,108,58,0.12)" : "var(--muted)", color: plan.status === "active" ? "var(--accent)" : "var(--muted-foreground)" }}>
                  {plan.status === "active" ? "Active" : "Draft"}
                </span>
                <button type="button" onClick={() => removeNotification(plan.id)} aria-label={`ลบ ${plan.name}`} className="p-1.5 rounded-md" style={{ color: "var(--primary)" }}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Journey day (หลังบ้าน)
                  <select
                    value={plan.day}
                    onChange={(event) => {
                      const day = Number(event.target.value) as DeliveryDay;
                      const stageId: JourneyStageId = day === 1 ? "activation" : day === 2 ? "competence" : "next-goal";
                      patchNotification(plan.id, { day, stageId });
                    }}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value={1}>Day 1</option>
                    <option value={2}>Day 2</option>
                    <option value={3}>Day 3</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  เวลาที่ผู้เล่นเห็น
                  <input
                    value={plan.notificationTime ?? ""}
                    onChange={(event) => patchNotification(plan.id, { notificationTime: event.target.value })}
                    placeholder="เช่น วันนี้ 09:00"
                    className={inputCls}
                    style={inputStyle}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  สถานะ
                  <select value={plan.status} onChange={(event) => patchNotification(plan.id, { status: event.target.value as DailyDeliveryPlan["status"] })} className={inputCls} style={inputStyle}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                หัวข้อแจ้งเตือน
                <input value={plan.name} onChange={(event) => patchNotification(plan.id, { name: event.target.value })} className={inputCls} style={inputStyle} />
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                รายละเอียด
                <textarea
                  value={plan.message}
                  onChange={(event) => patchNotification(plan.id, { message: event.target.value })}
                  rows={3}
                  className="px-3 py-2 rounded-md text-sm resize-none"
                  style={{ ...inputStyle, lineHeight: "1.6" }}
                />
              </label>

              <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
                <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Content เมื่อผู้เล่นเปิด Notification (ไม่บังคับ)
                  <select
                    value={plan.notificationContentId ?? ""}
                    onChange={(event) => patchNotification(plan.id, { notificationContentId: event.target.value || undefined })}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="">— ไม่แนบ Content —</option>
                    {KNOWLEDGE.map((item) => <option key={item.id} value={item.id}>{item.topicId} · {item.title}</option>)}
                  </select>
                </label>
                <label className="h-9 px-3 rounded-md border flex items-center gap-2 text-xs cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}>
                  <input
                    type="checkbox"
                    checked={plan.notificationUnread ?? true}
                    onChange={(event) => patchNotification(plan.id, { notificationUnread: event.target.checked })}
                  />
                  แสดงจุดข้อความใหม่
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        กด Save changes เพื่อเผยแพร่ Notification ให้ผู้เล่นเห็นหลังโหลดหน้าใหม่
      </p>
    </div>
  );
}

// ── AdminContentLibrary ────────────────────────────────────────────────────────

function AdminContentLibrary({
  answerConfigs,
  setAnswerConfigs,
  faqConfigs,
  setFaqConfigs,
  onSave,
  configStatus,
}: {
  answerConfigs: ChatAnswerConfig[];
  setAnswerConfigs: React.Dispatch<React.SetStateAction<ChatAnswerConfig[]>>;
  faqConfigs: FaqConfigItem[];
  setFaqConfigs: React.Dispatch<React.SetStateAction<FaqConfigItem[]>>;
  onSave: (payload: { faqConfigs: FaqConfigItem[]; answerConfigs: ChatAnswerConfig[] }) => Promise<void>;
  configStatus: SharedConfigStatus;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const manualAnswers = answerConfigs.filter((answer) => answer.isManual);
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = KNOWLEDGE.filter(
    (k) =>
      k.title.toLowerCase().includes(normalizedSearch) ||
      answerConfigs.find(answer => answer.id === k.id)?.en?.title.toLowerCase().includes(normalizedSearch) ||
      k.topicId.toLowerCase().includes(normalizedSearch) ||
      k.category.toLowerCase().includes(normalizedSearch)
  );
  const filteredManualAnswers = manualAnswers.filter((answer) =>
    answer.title.toLowerCase().includes(normalizedSearch) ||
    answer.en?.title.toLowerCase().includes(normalizedSearch) ||
    [...answer.keywords, ...(answer.en?.keywords || [])].some((keyword) => keyword.toLowerCase().includes(normalizedSearch))
  );

  const selected = selectedId ? KNOWLEDGE.find((k) => k.id === selectedId) : null;
  const selectedAnswer = selected ? answerConfigs.find((answer) => answer.id === selected.id) : null;

  function patchAnswer(id: string, update: Partial<ChatAnswerConfig>) {
    setAnswerConfigs((prev) => prev.map((answer) => answer.id === id ? { ...answer, ...update } : answer));
    setSaveState("idle");
  }

  function addManualContent() {
    const id = `manual-${uid()}`;
    setAnswerConfigs((prev) => [...prev, {
      id,
      title: "หัวข้อใหม่",
      text: "",
      keywords: [],
      keyboardSteps: [],
      xboxSteps: [],
      playstationSteps: [],
      source: "Manual content",
      isManual: true,
    }]);
    setSelectedManualId(id);
    setSelectedId(null);
    setSaveState("idle");
  }

  function removeManualContent(id: string) {
    setAnswerConfigs((prev) => prev.filter((answer) => answer.id !== id));
    setFaqConfigs((prev) => prev.filter((faq) => faq.topicId !== id && faq.secondaryTopicId !== id));
    setSelectedManualId((current) => current === id ? null : current);
    setSaveState("idle");
  }

  function patchFaq(id: string, update: Partial<FaqConfigItem>) {
    setFaqConfigs((prev) => prev.map((faq) => faq.id === id ? { ...faq, ...update } : faq));
    setSaveState("idle");
  }

  async function saveChanges() {
    setSaveState("saving");
    setSaveError("");
    try {
      await onSave({ faqConfigs, answerConfigs });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกการเปลี่ยนแปลงได้");
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Table pane */}
      <div className="flex flex-col overflow-y-auto" style={{ width: selected ? "55%" : "100%" }}>
        <div className="px-5 pt-5 pb-3 shrink-0 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>FAQ &amp; Content</h2>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>คลังเดียว TH / EN · Keywords ที่บันทึกใช้ค้นหาจริง · พบคำตอบแล้วไม่เรียก AI</p>
            </div>
            <div className="flex items-center gap-2">
              <SaveChangesButton state={saveState} onClick={saveChanges} disabled={configStatus !== "ready"} />
              <button
                onClick={addManualContent}
                className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                + เพิ่ม Content
              </button>
              <button
                onClick={() => {
                  setFaqConfigs((prev) => [...prev, {
                    id: `faq-${uid()}`,
                    question: "คำถามใหม่",
                    stageId: "activation",
                    topicId: KNOWLEDGE[0].topicId,
                    trigger: "",
                  }]);
                  setSaveState("idle");
                }}
                className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0"
                style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
              >
                + เพิ่ม FAQ
              </button>
            </div>
          </div>

          {configStatus !== "ready" && (
            <p className="text-xs" style={{ color: "var(--primary)" }}>
              {configStatus === "loading" ? "กำลังเชื่อม shared storage..." : "ยังไม่ได้เชื่อม shared storage · การแก้ไขจะอยู่ใน browser นี้เท่านั้น"}
            </p>
          )}
          {saveError && <p className="text-xs" style={{ color: "var(--primary)" }}>{saveError}</p>}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Manual Content</h3>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>หัวข้อ + keywords + คำตอบที่ทีมกำหนดเอง</p>
              </div>
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{manualAnswers.length} หัวข้อ</span>
            </div>

            {manualAnswers.length === 0 && (
              <div className="rounded-lg border border-dashed px-4 py-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                ยังไม่มี Manual Content · กด “+ เพิ่ม Content” เพื่อสร้างคำตอบ เช่น “ยิง Low Shot ทำยังไง”
              </div>
            )}

            {filteredManualAnswers.map((answer) => {
              const expanded = selectedManualId === answer.id;
              return (
                <div key={answer.id} className="rounded-lg border overflow-hidden" style={{ borderColor: expanded ? "var(--primary)" : "var(--border)", backgroundColor: "var(--card)" }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedManualId(expanded ? null : answer.id); setSelectedId(null); }}
                    className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                  >
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0" style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>MANUAL</span>
                    <span className="text-xs font-semibold flex-1 truncate" style={{ color: "var(--foreground)" }}>{answer.title || "ยังไม่มีชื่อหัวข้อ"}</span>
                    <span className="text-[10px] truncate max-w-56" style={{ color: "var(--muted-foreground)" }}>{answer.keywords.join(", ") || "ยังไม่มี keywords"}</span>
                  </button>
                  {expanded && (
                    <div className="p-3 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}>
                      <div className="grid md:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                          ชื่อหัวข้อ
                          <input
                            value={answer.title}
                            onChange={(event) => patchAnswer(answer.id, { title: event.target.value })}
                            placeholder="เช่น ยิง Low Shot ทำยังไง"
                            className="h-9 px-3 rounded-md text-sm outline-none"
                            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                          Keywords · คั่นด้วย comma
                          <input
                            value={answer.keywords.join(", ")}
                            onChange={(event) => patchAnswer(answer.id, { keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                            placeholder="low shot, ยิงเรียด, ยิงต่ำ"
                            className="h-9 px-3 rounded-md text-sm outline-none"
                            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                        คำตอบของ Bot
                        <textarea
                          value={answer.text}
                          onChange={(event) => patchAnswer(answer.id, { text: event.target.value })}
                          rows={3}
                          placeholder="ใส่คำตอบที่ต้องการให้ Bot ส่ง โดยไม่ต้องเรียก AI"
                          className="rounded-md px-3 py-2 text-sm resize-y outline-none"
                          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                        />
                      </label>
                      <BilingualAnswerEditor answer={answer} onChange={update => patchAnswer(answer.id, update)} />
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeManualContent(answer.id)} className="text-xs" style={{ color: "var(--primary)" }}>ลบ Content นี้</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <div>
            <h3 className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>FAQ buttons</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>คำถามลัดที่แสดงเหนือช่องแชท</p>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            {faqConfigs.map((faq) => {
              const topic = KNOWLEDGE.find((k) => k.topicId === faq.topicId);
              const manualTopic = manualAnswers.find((answer) => answer.id === faq.topicId);
              const secondaryTopic = faq.secondaryTopicId ? KNOWLEDGE.find((k) => k.topicId === faq.secondaryTopicId) : undefined;
              const manualSecondaryTopic = faq.secondaryTopicId ? manualAnswers.find((answer) => answer.id === faq.secondaryTopicId) : undefined;
              return (
                <div key={faq.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <div className="flex items-start gap-2">
                    <input
                      value={faq.question}
                      onChange={(e) => patchFaq(faq.id, { question: e.target.value })}
                      aria-label="คำถาม FAQ"
                      className="flex-1 bg-transparent text-xs font-semibold outline-none min-w-0"
                      style={{ color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => { setFaqConfigs((prev) => prev.filter((item) => item.id !== faq.id)); setSaveState("idle"); }}
                      className="text-[11px] px-2 py-0.5 rounded-md shrink-0 transition-opacity hover:opacity-60"
                      style={{ color: "var(--primary)", backgroundColor: "rgba(196,30,30,0.06)" }}
                      aria-label={`ลบ FAQ ${faq.question}`}
                    >
                      ลบ
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    <select
                      value={faq.stageId}
                      onChange={(e) => patchFaq(faq.id, { stageId: e.target.value as JourneyStageId })}
                      aria-label={`${faq.question} Journey stage`}
                      className="h-8 px-2 rounded-md text-[11px]"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                    >
                      {JOURNEY_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.title}</option>)}
                    </select>
                    <input
                      value={faq.trigger}
                      onChange={(e) => patchFaq(faq.id, { trigger: e.target.value })}
                      aria-label={`${faq.question} keywords`}
                      placeholder="keywords คั่นด้วย ,"
                      className="h-8 px-2 rounded-md text-[11px] outline-none"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                    />
                  </div>
                  <label className="flex flex-col gap-1 mt-2 text-xs">
                    คำถาม FAQ · English
                    <input aria-label={`English FAQ — ${faq.id}`} value={faq.questionEn ?? FAQ_ENGLISH_BY_QUESTION[faq.question] ?? ''}
                      onChange={event => patchFaq(faq.id, { questionEn: event.target.value, questionEnSource: undefined })}
                      className="w-full rounded-md border px-2 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                    <span>{englishFaqQuestion(faq) ? 'ตรงกับคำถามไทย' : 'คำแปลต้องอัปเดต / ยืนยัน · ยังไม่แสดงปุ่มใน EN'}</span>
                    <button type="button" disabled={!(faq.questionEn ?? FAQ_ENGLISH_BY_QUESTION[faq.question])?.trim()}
                      onClick={() => patchFaq(faq.id, { questionEn: faq.questionEn ?? FAQ_ENGLISH_BY_QUESTION[faq.question], questionEnSource: faq.question })}
                      className="underline disabled:opacity-40">ยืนยันคำแปล FAQ</button>
                  </div>
                  <select
                    value={faq.topicId}
                    onChange={(e) => patchFaq(faq.id, { topicId: e.target.value })}
                    aria-label={`${faq.question} เนื้อหาหลัก`}
                    className="w-full mt-1.5 h-8 px-2 rounded-md text-[11px]"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                  >
                    {manualAnswers.length > 0 && <option disabled>— Manual Content —</option>}
                    {manualAnswers.map((answer) => <option key={answer.id} value={answer.id}>MANUAL · {answer.title}</option>)}
                    <option disabled>— Education Hub —</option>
                    {KNOWLEDGE.map((k) => <option key={k.topicId} value={k.topicId}>{k.topicId} · {k.title}</option>)}
                  </select>
                  {faq.secondaryTopicId !== undefined && (
                    <select
                      value={faq.secondaryTopicId}
                      onChange={(e) => patchFaq(faq.id, { secondaryTopicId: e.target.value })}
                      aria-label={`${faq.question} เนื้อหาที่สอง`}
                      className="w-full mt-1.5 h-8 px-2 rounded-md text-[11px]"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                    >
                      {manualAnswers.length > 0 && <option disabled>— Manual Content —</option>}
                      {manualAnswers.map((answer) => <option key={answer.id} value={answer.id}>MANUAL · {answer.title}</option>)}
                      <option disabled>— Education Hub —</option>
                      {KNOWLEDGE.map((k) => <option key={k.topicId} value={k.topicId}>{k.topicId} · {k.title}</option>)}
                    </select>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    {faq.secondaryTopicId === undefined ? (
                      <button
                        onClick={() => patchFaq(faq.id, { secondaryTopicId: KNOWLEDGE[1]?.topicId ?? KNOWLEDGE[0].topicId })}
                        className="text-[10px] transition-opacity hover:opacity-60"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        + เพิ่ม content ที่สอง
                      </button>
                    ) : (
                      <button
                        onClick={() => patchFaq(faq.id, { secondaryTopicId: undefined })}
                        className="text-[10px] transition-opacity hover:opacity-60"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        เอา content ที่สองออก
                      </button>
                    )}
                  </div>
                  {topic || manualTopic ? <p className="text-[10px] mt-1 truncate" style={{ color: "var(--primary)" }}>
                    {topic?.title ?? manualTopic?.title}
                    {secondaryTopic || manualSecondaryTopic ? ` + ${secondaryTopic?.title ?? manualSecondaryTopic?.title}` : ""}
                  </p> : null}
                </div>
              );
            })}
          </div>

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

        {/* Rows share the pane's scroll so bilingual FAQ fields cannot hide the catalog. */}
        <div className="shrink-0">
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
          {filtered.length + filteredManualAnswers.length} หัวข้อ · Manual {manualAnswers.length} · Education Hub {KNOWLEDGE.length}
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

          {selectedAnswer && (
            <section className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              <div>
                <h4 className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>คำตอบในแชท</h4>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  กด Save changes เพื่อเผยแพร่คำตอบนี้ให้ผู้เล่นเห็น
                </p>
              </div>
              <label className="flex flex-col gap-1 text-xs">
                ชื่อหัวข้อ · TH
                <input aria-label={`Thai title — ${selectedAnswer.id}`} value={selectedAnswer.title} onChange={event => patchAnswer(selectedAnswer.id, { title: event.target.value })}
                  className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Keywords · TH / คำเดิม (คั่นด้วย comma)
                <input aria-label={`Thai keywords — ${selectedAnswer.id}`} value={selectedAnswer.keywords.join(', ')} onChange={event => patchAnswer(selectedAnswer.id, { keywords: event.target.value.split(',').map(value => value.trim()) })}
                  className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                ข้อความนำ
                <textarea
                  value={selectedAnswer.text}
                  onChange={(event) => { patchAnswer(selectedAnswer.id, { text: event.target.value }); setSaveState("idle"); }}
                  rows={3}
                  className="rounded-md px-3 py-2 text-xs font-normal resize-y outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                ขั้นตอนสำหรับคีย์บอร์ด · 1 บรรทัดต่อ 1 ข้อ
                <textarea
                  value={selectedAnswer.keyboardSteps.join("\n")}
                  onChange={(event) => { patchAnswer(selectedAnswer.id, { keyboardSteps: event.target.value.split("\n").filter(Boolean) }); setSaveState("idle"); }}
                  rows={3}
                  placeholder="เช่น กด S เพื่อส่งบอลสั้น"
                  className="rounded-md px-3 py-2 text-xs font-normal resize-y outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                ขั้นตอนสำหรับ Xbox · ใช้ XYAB
                <textarea
                  value={selectedAnswer.xboxSteps.join("\n")}
                  onChange={(event) => { patchAnswer(selectedAnswer.id, { xboxSteps: event.target.value.split("\n").filter(Boolean) }); setSaveState("idle"); }}
                  rows={3}
                  placeholder="เช่น กด A เพื่อส่งบอลสั้น"
                  className="rounded-md px-3 py-2 text-xs font-normal resize-y outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                ขั้นตอนสำหรับ PlayStation · ใช้ □ △ ○ ✕
                <textarea
                  value={selectedAnswer.playstationSteps.join("\n")}
                  onChange={(event) => { patchAnswer(selectedAnswer.id, { playstationSteps: event.target.value.split("\n").filter(Boolean) }); setSaveState("idle"); }}
                  rows={3}
                  placeholder="เช่น กด ✕ เพื่อส่งบอลสั้น"
                  className="rounded-md px-3 py-2 text-xs font-normal resize-y outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)" }}
                />
              </label>
            </section>
          )}

          {selectedAnswer && <BilingualAnswerEditor answer={selectedAnswer} onChange={update => patchAnswer(selectedAnswer.id, update)} />}
          <div className="sticky bottom-0 py-2 flex justify-end" style={{ backgroundColor: 'var(--card)' }}>
            <SaveChangesButton state={saveState} onClick={saveChanges} disabled={configStatus !== 'ready'} />
          </div>

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

const PREVIEW_FAQ = ["หาเงินจากไหน", "ส่งบอลยังไง", "เล่นเกมรับยังไง", "ยิงยังไงให้คม", "เชื่อมจอยยังไง"];

function AdminPreview({ deliveryPlans }: { deliveryPlans: DailyDeliveryPlan[] }) {
  const [previewDay, setPreviewDay] = useState<DeliveryDay>(1);
  const [previewChannel, setPreviewChannel] = useState<DeliveryChannel>("notification");

  const plan = deliveryPlans.find((p) => p.day === previewDay && p.channel === previewChannel)
    ?? deliveryPlans.find((p) => p.channel === previewChannel)
    ?? deliveryPlans[0];

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
          {([1, 2, 3] as DeliveryDay[]).map((d) => {
            const active = d === previewDay;
            return (
              <button
                key={d}
                onClick={() => setPreviewDay(d)}
                className="h-7 px-2.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--background)" : "var(--muted-foreground)",
                  borderRight: d < 3 ? "1px solid var(--border)" : undefined,
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
          Internal preview only · ผู้เล่นไม่เห็น Day
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
            Conversation logic
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
            {previewChannel === "notification" ? (
              <>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Title</p>
                  <p className="mt-0.5 leading-relaxed" style={{ color: "var(--foreground)" }}>{plan.name}</p>
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Body</p>
                  <p className="mt-0.5 leading-relaxed" style={{ color: "var(--foreground)" }}>{plan.message}</p>
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Visible time</p>
                  <p className="mt-0.5" style={{ color: "var(--foreground)" }}>{plan.notificationTime || "ข้อความใหม่"}</p>
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Attached content</p>
                  <p className="mt-0.5" style={{ color: "var(--foreground)" }}>
                    {findKnowledge(plan.notificationContentId ?? "")?.title ?? "ไม่แนบ Content"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>{plan.isStart ? "Welcome message" : "Question / Bot message"}</p>
                  <p className="mt-0.5 leading-relaxed" style={{ color: "var(--foreground)" }}>{plan.message}</p>
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--muted-foreground)" }}>Choices</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {plan.branches.map((branch, index) => (
                      <p key={branch.id} className="text-[10px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                        {index === 0 ? "IF" : "ELSE IF"} · {branch.choice || "ยังไม่มีตัวเลือก"} → {branch.action === "next_question"
                          ? `คำถาม: ${deliveryPlans.find((target) => target.id === branch.nextPlanId)?.name ?? "ยังไม่ได้เลือก"}`
                          : branch.reply || "ยังไม่มีข้อความ"}
                      </p>
                    ))}
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                      ELSE · {plan.elseAction === "ai_fallback"
                        ? "AI fallback"
                        : plan.elseAction === "next_question"
                          ? `คำถาม: ${deliveryPlans.find((target) => target.id === plan.elseNextPlanId)?.name ?? "ยังไม่ได้เลือก"}`
                          : plan.elseReply || "ยังไม่มีข้อความ"}
                    </p>
                  </div>
                </div>
              </>
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
                      <Clock size={16} style={{ color: plan.notificationUnread === false ? "var(--muted-foreground)" : "var(--primary)" }} aria-hidden />
                      {plan.notificationUnread !== false && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                    </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                        {plan.name}
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{plan.notificationTime || "ข้อความใหม่"}</span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{plan.message}</p>
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
                <div className="flex flex-wrap gap-2 pl-1">
                  {plan.branches.filter((branch) => branch.choice.trim()).map((branch) => (
                    <span key={branch.id} className="h-8 px-3 rounded-full text-xs flex items-center border" style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}>
                      {branch.choice}
                    </span>
                  ))}
                </div>
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
  onSave,
  configStatus,
}: {
  questions: ReportedQuestion[];
  setQuestions: (fn: (prev: ReportedQuestion[]) => ReportedQuestion[]) => void;
  onSave: (question: ReportedQuestion) => Promise<ReportedQuestion>;
  configStatus: SharedConfigStatus;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const selected = selectedId ? questions.find((q) => q.id === selectedId) ?? null : null;

  function patchQuestion(id: string, update: Partial<ReportedQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...update } : q)));
    setSaveState("idle");
  }

  async function saveChanges() {
    if (!selected) return;
    setSaveState("saving");
    setSaveError("");
    try {
      const saved = await onSave(selected);
      setQuestions((prev) => prev.map((question) => question.id === saved.id ? saved : question));
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกการเปลี่ยนแปลงได้");
    }
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
        <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Unanswered Questions</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              คำถามที่บันทึกจริง · ดูสาเหตุและกลุ่มคำถามในคำถามยอดนิยม
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaveChangesButton state={saveState} onClick={saveChanges} disabled={configStatus !== "ready" || !selected} />
            <button className="text-sm border rounded-lg px-3 py-2" onClick={() => request('/api/admin/unanswered').then(data => setQuestions(data.questions.flatMap((q: unknown) => { const parsed = parseReportedQuestion(q); return parsed ? [parsed] : []; }))).catch(e => setSaveError(e.message))}>รีเฟรช</button>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: "rgba(196,30,30,0.08)", color: "var(--primary)" }}>
              {questions.filter((q) => q.status === "new").length} new
            </span>
          </div>
        </div>

        {configStatus !== "ready" && (
          <p className="px-5 pb-3 text-xs" style={{ color: "var(--primary)" }}>
            {configStatus === "loading" ? "กำลังเชื่อม shared storage..." : "ยังไม่ได้เชื่อม shared storage · การแก้ไขจะอยู่ใน browser นี้เท่านั้น"}
          </p>
        )}
        {saveError && <p className="px-5 pb-3 text-xs" style={{ color: "var(--primary)" }}>{saveError}</p>}

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

// ── AdminVersionHistory ───────────────────────────────────────────────────────

function AdminVersionHistory({
  configRevision,
  configStatus,
  onRestore,
}: {
  configRevision: number;
  configStatus: SharedConfigStatus;
  onRestore: (revision: number) => Promise<void>;
}) {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [restoreState, setRestoreState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  async function loadVersions() {
    if (configStatus !== "ready") return;
    setLoadState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/admin/config/versions", { cache: "no-store" });
      const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || !Array.isArray(raw.versions)) throw new Error(typeof raw.error === "string" ? raw.error : "ไม่สามารถโหลดประวัติเวอร์ชันได้");
      const parsed = raw.versions.flatMap((item): ConfigVersion[] => {
        if (!item || typeof item !== "object") return [];
        const version = item as Record<string, unknown>;
        if (
          typeof version.id !== "string" ||
          !Number.isInteger(version.revision) ||
          typeof version.changed_section !== "string" ||
          typeof version.created_at !== "string" ||
          typeof version.created_by !== "string"
        ) return [];
        return [{
          id: version.id,
          revision: version.revision as number,
          changedSection: version.changed_section,
          createdAt: version.created_at,
          createdBy: version.created_by,
        }];
      });
      setVersions(parsed);
      setLoadState("idle");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดประวัติเวอร์ชันได้");
    }
  }

  useEffect(() => { void loadVersions(); }, [configStatus]);

  async function restoreVersion(version: ConfigVersion) {
    if (!window.confirm(`ย้อนกลับไป Version ${version.revision}? การเปลี่ยนแปลงปัจจุบันจะถูกเก็บเป็น version ใหม่`)) return;
    setRestoreState("saving");
    setMessage("");
    try {
      await onRestore(version.revision);
      setRestoreState("saved");
      setMessage(`คืนค่า Version ${version.revision} แล้ว`);
      await loadVersions();
    } catch (error) {
      setRestoreState("error");
      setMessage(error instanceof Error ? error.message : "ไม่สามารถคืนค่า version ได้");
    }
  }

  const sectionLabel = (value: string) => {
    if (value === "faq_content") return "FAQ & Content";
    if (value === "proactive_messages") return "Proactive Messages & Notifications";
    if (value === "initial") return "Initial configuration";
    if (value.startsWith("rollback:")) return `Rollback from Version ${value.replace("rollback:", "")}`;
    return value;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Version History</h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>เผยแพร่แต่ละครั้งจะเก็บ snapshot และคืนค่าได้</p>
        </div>
        <button
          onClick={() => void loadVersions()}
          disabled={configStatus !== "ready" || loadState === "loading"}
          className="h-9 px-3 rounded-lg text-xs font-semibold border disabled:opacity-45"
          style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
        >
          {loadState === "loading" ? "กำลังโหลด..." : "รีเฟรช"}
        </button>
      </div>

      {configStatus !== "ready" ? (
        <p className="text-sm" style={{ color: "var(--primary)" }}>
          {configStatus === "loading" ? "กำลังเชื่อม shared storage..." : "Version history จะพร้อมหลังตั้งค่า Supabase บน deployment"}
        </p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 text-xs" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
            Current version: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{configRevision}</span>
          </div>
          {versions.length === 0 && loadState !== "loading" && (
            <p className="px-4 py-5 text-sm" style={{ color: "var(--muted-foreground)" }}>ยังไม่มีประวัติการเผยแพร่</p>
          )}
          {versions.map((version) => (
            <div key={version.id} className="flex items-center gap-4 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs font-bold shrink-0" style={{ color: version.revision === configRevision ? "var(--primary)" : "var(--foreground)" }}>v{version.revision}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{sectionLabel(version.changedSection)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(version.createdAt).toLocaleString("th-TH")} · {version.createdBy}
                </p>
              </div>
              <button
                onClick={() => void restoreVersion(version)}
                disabled={version.revision === configRevision || restoreState === "saving"}
                className="h-8 px-3 rounded-lg text-xs font-semibold border disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
              >
                คืนค่านี้
              </button>
            </div>
          ))}
        </div>
      )}
      {message && <p className="mt-3 text-xs" style={{ color: restoreState === "error" || loadState === "error" ? "var(--primary)" : "var(--accent)" }}>{message}</p>}
    </div>
  );
}

// ── AdminView ──────────────────────────────────────────────────────────────────

function AdminView({
  onLogout,
  reportedQuestions,
  setReportedQuestions,
  answerConfigs,
  setAnswerConfigs,
  faqConfigs,
  setFaqConfigs,
  deliveryPlans,
  setDeliveryPlans,
  onSaveFaqContent,
  onSaveProactiveMessages,
  onSaveUnansweredQuestion,
  onRestoreConfigVersion,
  configRevision,
  configStatus,
}: {
  onLogout: () => void;
  reportedQuestions: ReportedQuestion[];
  setReportedQuestions: (fn: (prev: ReportedQuestion[]) => ReportedQuestion[]) => void;
  answerConfigs: ChatAnswerConfig[];
  setAnswerConfigs: React.Dispatch<React.SetStateAction<ChatAnswerConfig[]>>;
  faqConfigs: FaqConfigItem[];
  setFaqConfigs: React.Dispatch<React.SetStateAction<FaqConfigItem[]>>;
  deliveryPlans: DailyDeliveryPlan[];
  setDeliveryPlans: React.Dispatch<React.SetStateAction<DailyDeliveryPlan[]>>;
  onSaveFaqContent: (payload: { faqConfigs: FaqConfigItem[]; answerConfigs: ChatAnswerConfig[] }) => Promise<void>;
  onSaveProactiveMessages: (plans: DailyDeliveryPlan[]) => Promise<void>;
  onSaveUnansweredQuestion: (question: ReportedQuestion) => Promise<ReportedQuestion>;
  onRestoreConfigVersion: (revision: number) => Promise<void>;
  configRevision: number;
  configStatus: SharedConfigStatus;
}) {
  const [tab, setTab] = useState<AdminTab>("overview");

  const newCount = reportedQuestions.filter((q) => q.status === "new").length;

  const navItems: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "overview", label: "วัดผล", icon: <Eye size={15} aria-hidden /> },
    { key: "access", label: "การเข้าถึง", icon: <LockKeyhole size={15} aria-hidden /> },
    { key: "proactive-messages", label: "Proactive Messages", icon: <MessageCircle size={15} aria-hidden /> },
    { key: "notifications", label: "Notifications", icon: <Bell size={15} aria-hidden /> },
    { key: "faq-content", label: "FAQ & Content", icon: <BookOpen size={15} aria-hidden /> },
    { key: "unanswered", label: "Unanswered Questions", icon: <Search size={15} aria-hidden />, badge: newCount },
    { key: "preview", label: "Preview", icon: <GitBranch size={15} aria-hidden /> },
    { key: "history", label: "Version History", icon: <History size={15} aria-hidden /> },
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
        {PUBLIC_TRIAL && (tab === 'overview' || tab === 'access') && <div className="p-6 space-y-3"><h2 className="text-xl font-semibold">Guest pilot</h2><p>เปิดทดลองแบบไม่ล็อกอิน · ประวัติอยู่ในเบราว์เซอร์ผู้เล่น</p><p>Login / whitelist, สถิติรวม, การให้คะแนน และ NPS ยังไม่เปิดใช้งานใน production รอบนี้</p><p>FAQ & Content, Proactive Messages, Notifications, Unanswered Questions และ Version History ยังใช้ระบบ Supabase เดิม</p></div>}
        {!PUBLIC_TRIAL && tab === "overview" && <LiveOverview />}
        {!PUBLIC_TRIAL && tab === "access" && <AdminAccess />}
        {tab === "proactive-messages" && (
          <AdminProactiveMessages
            plans={deliveryPlans}
            setPlans={setDeliveryPlans}
            onSave={onSaveProactiveMessages}
            configStatus={configStatus}
          />
        )}
        {tab === "notifications" && (
          <AdminNotifications
            plans={deliveryPlans}
            setPlans={setDeliveryPlans}
            onSave={onSaveProactiveMessages}
            configStatus={configStatus}
          />
        )}
        {tab === "faq-content" && (
          <AdminContentLibrary
            answerConfigs={answerConfigs}
            setAnswerConfigs={setAnswerConfigs}
            faqConfigs={faqConfigs}
            setFaqConfigs={setFaqConfigs}
            onSave={onSaveFaqContent}
            configStatus={configStatus}
          />
        )}
        {tab === "unanswered" && (
          <AdminUnansweredQuestions
            questions={reportedQuestions}
            setQuestions={setReportedQuestions}
            onSave={onSaveUnansweredQuestion}
            configStatus={configStatus}
          />
        )}
        {tab === "preview" && <AdminPreview deliveryPlans={deliveryPlans} />}
        {tab === "history" && <AdminVersionHistory configRevision={configRevision} configStatus={configStatus} onRestore={onRestoreConfigVersion} />}
      </main>
    </div>
  );
}

function AdminRoute({
  answerConfigs,
  setAnswerConfigs,
  faqConfigs,
  setFaqConfigs,
  deliveryPlans,
  setDeliveryPlans,
  reportedQuestions,
  setReportedQuestions,
  onSaveFaqContent,
  onSaveProactiveMessages,
  onSaveUnansweredQuestion,
  onRestoreConfigVersion,
  configRevision,
  configStatus,
}: {
  answerConfigs: ChatAnswerConfig[];
  setAnswerConfigs: React.Dispatch<React.SetStateAction<ChatAnswerConfig[]>>;
  faqConfigs: FaqConfigItem[];
  setFaqConfigs: React.Dispatch<React.SetStateAction<FaqConfigItem[]>>;
  deliveryPlans: DailyDeliveryPlan[];
  setDeliveryPlans: React.Dispatch<React.SetStateAction<DailyDeliveryPlan[]>>;
  reportedQuestions: ReportedQuestion[];
  setReportedQuestions: React.Dispatch<React.SetStateAction<ReportedQuestion[]>>;
  onSaveFaqContent: (payload: { faqConfigs: FaqConfigItem[]; answerConfigs: ChatAnswerConfig[] }) => Promise<void>;
  onSaveProactiveMessages: (plans: DailyDeliveryPlan[]) => Promise<void>;
  onSaveUnansweredQuestion: (question: ReportedQuestion) => Promise<ReportedQuestion>;
  onRestoreConfigVersion: (revision: number) => Promise<void>;
  configRevision: number;
  configStatus: SharedConfigStatus;
}) {
  const devPreview = false;
  const [session, setSession] = useState<AdminSessionState>(devPreview ? "authenticated" : "checking");

  useEffect(() => {
    if (devPreview) return;
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
  }, [devPreview]);

  useEffect(() => {
    if (session !== "authenticated") return;
    let active = true;
    fetch("/api/admin/unanswered", { cache: "no-store" })
      .then(async (response) => {
        const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok || !Array.isArray(raw.questions) || !active) return;
        setReportedQuestions(raw.questions.flatMap((question) => {
          const parsed = parseReportedQuestion(question);
          return parsed ? [parsed] : [];
        }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session, setReportedQuestions]);

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
    return <AdminLoginScreen onAuthenticated={() => window.location.reload()} />;
  }

  return (
    <AdminView
      onLogout={logout}
      reportedQuestions={reportedQuestions}
      setReportedQuestions={setReportedQuestions}
      answerConfigs={answerConfigs}
      setAnswerConfigs={setAnswerConfigs}
      faqConfigs={faqConfigs}
      setFaqConfigs={setFaqConfigs}
      deliveryPlans={deliveryPlans}
      setDeliveryPlans={setDeliveryPlans}
      onSaveFaqContent={onSaveFaqContent}
      onSaveProactiveMessages={onSaveProactiveMessages}
      onSaveUnansweredQuestion={onSaveUnansweredQuestion}
      onRestoreConfigVersion={onRestoreConfigVersion}
      configRevision={configRevision}
      configStatus={configStatus}
    />
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
  const [experienced, setExperienced] = useState(false);
  return <PlayerLanguageProvider>{isAdmin ? <AppContent /> : <AccountGate renderWelcome={({ onContinue, onSignIn, busy, status }) => experienced
    ? <ExperiencedPlayerScreen onBack={() => setExperienced(false)} />
    : <PlayerSegmentScreen busy={busy} status={status} onSignIn={onSignIn} onSelect={segment => segment === 'experienced' ? setExperienced(true) : onContinue(segment)} />
  }><AppContent /></AccountGate>}</PlayerLanguageProvider>;
}

function AppContent() {
  const account = useContext(AccountContext);
  const [segment, setSegment] = useState<PlayerSegment | null>(account?.state.segment || null);
  const [reportedQuestions, setReportedQuestions] = useState<ReportedQuestion[]>([]);
  const [answerConfigs, setAnswerConfigs] = useState<ChatAnswerConfig[]>(loadChatAnswers);
  const [faqConfigs, setFaqConfigs] = useState<FaqConfigItem[]>(loadFaqConfigs);
  const [deliveryPlans, setDeliveryPlans] = useState<DailyDeliveryPlan[]>(INITIAL_DAILY_DELIVERY_PLANS);
  const [configRevision, setConfigRevision] = useState(0);
  const [configStatus, setConfigStatus] = useState<SharedConfigStatus>("loading");

  useEffect(() => {
    window.localStorage.setItem(CHAT_ANSWERS_STORAGE_KEY, JSON.stringify(answerConfigs));
  }, [answerConfigs]);

  useEffect(() => {
    window.localStorage.setItem(FAQ_CONFIG_STORAGE_KEY, JSON.stringify(faqConfigs));
  }, [faqConfigs]);

  useEffect(() => {
    let active = true;

    async function loadSharedConfig() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) throw new Error("Shared configuration is unavailable");
        const raw = await response.json() as unknown;
        if (!raw || typeof raw !== "object") throw new Error("Shared configuration is invalid");
        const config = raw as Record<string, unknown>;
        if (!Number.isInteger(config.revision) || (config.revision as number) < 0) {
          throw new Error("Shared configuration has an invalid revision");
        }
        if (!active) return;

        const publishedSections = parsePublishedSections(config.publishedSections);
        if (publishedSections.includes("faq_content")) {
          setFaqConfigs(normalizeFaqConfigs(config.faqConfigs));
          setAnswerConfigs(mergeChatAnswers(config.answerConfigs));
        }
        if (publishedSections.includes("proactive_messages")) {
          setDeliveryPlans(normalizeDeliveryPlans(config.deliveryPlans));
        }
        setConfigRevision(config.revision as number);
        setConfigStatus("ready");
      } catch {
        if (active) setConfigStatus("local-fallback");
      }
    }

    void loadSharedConfig();
    return () => { active = false; };
  }, []);

  async function saveSharedConfig(section: ConfigSection, payload: unknown) {
    if (configStatus !== "ready") {
      throw new Error("Shared storage ยังไม่พร้อมใช้งาน กรุณาเปิดผ่าน deployment ที่ตั้งค่า Supabase แล้ว");
    }
    const response = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, expectedRevision: configRevision, payload }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      if (body.code === "REVISION_CONFLICT") {
        throw new Error("มีการแก้ไขจาก Admin อีกหน้าต่างหนึ่ง กรุณาโหลดหน้านี้ใหม่ก่อนบันทึก");
      }
      throw new Error(typeof body.error === "string" ? body.error : "ไม่สามารถบันทึกการเปลี่ยนแปลงได้");
    }
    if (!Number.isInteger(body.revision)) {
      throw new Error("ระบบบันทึกข้อมูลไม่สมบูรณ์ กรุณาลองใหม่");
    }
    setConfigRevision(body.revision as number);
  }

  function saveFaqContent(payload: { faqConfigs: FaqConfigItem[]; answerConfigs: ChatAnswerConfig[] }) {
    return saveSharedConfig("faq_content", payload);
  }

  function saveProactiveMessages(plans: DailyDeliveryPlan[]) {
    return saveSharedConfig("proactive_messages", { deliveryPlans: plans });
  }

  async function restoreConfigVersion(revision: number) {
    if (configStatus !== "ready") {
      throw new Error("Shared storage ยังไม่พร้อมใช้งาน กรุณาเปิดผ่าน deployment ที่ตั้งค่า Supabase แล้ว");
    }
    const response = await fetch("/api/admin/config/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, expectedRevision: configRevision }),
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      if (raw.code === "REVISION_CONFLICT") {
        throw new Error("มีการแก้ไขจาก Admin อีกหน้าต่างหนึ่ง กรุณาโหลดหน้านี้ใหม่ก่อนคืนค่า");
      }
      throw new Error(typeof raw.error === "string" ? raw.error : "ไม่สามารถคืนค่า version ได้");
    }
    if (!Number.isInteger(raw.revision)) throw new Error("ระบบคืนค่าข้อมูลไม่สมบูรณ์ กรุณาลองใหม่");
    const publishedSections = parsePublishedSections(raw.publishedSections);
    if (publishedSections.includes("faq_content")) {
      setFaqConfigs(normalizeFaqConfigs(raw.faqConfigs));
      setAnswerConfigs(mergeChatAnswers(raw.answerConfigs));
    }
    if (publishedSections.includes("proactive_messages")) {
      setDeliveryPlans(normalizeDeliveryPlans(raw.deliveryPlans));
    }
    setConfigRevision(raw.revision as number);
  }

  async function saveUnansweredQuestion(question: ReportedQuestion): Promise<ReportedQuestion> {
    if (configStatus !== "ready") {
      throw new Error("Shared storage ยังไม่พร้อมใช้งาน กรุณาเปิดผ่าน deployment ที่ตั้งค่า Supabase แล้ว");
    }
    const response = await fetch("/api/admin/unanswered", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: question.id,
        status: question.status,
        relatedTopicId: question.relatedTopicId,
      }),
    });
    const raw = await response.json().catch(() => ({})) as unknown;
    if (!response.ok) {
      const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      throw new Error(typeof body.error === "string" ? body.error : "ไม่สามารถบันทึกคำถามได้");
    }
    const saved = parseReportedQuestion(raw);
    if (!saved) throw new Error("ระบบบันทึกคำถามไม่สมบูรณ์ กรุณาลองใหม่");
    return saved;
  }

  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

  async function handleReportQuestion(question: string, recentContext: string) {
    const saved = parseReportedQuestion(await request('/api/unanswered', { question, recentContext, onboardingDay: account?.day || 1 }));
    if (!saved) throw new Error('ไม่สามารถบันทึกคำถามได้');
    setReportedQuestions(prev => [...prev.filter(q => q.id !== saved.id), saved]);
    return;
  }

  if (isAdminRoute) return (
    <AdminRoute
      answerConfigs={answerConfigs}
      setAnswerConfigs={setAnswerConfigs}
      faqConfigs={faqConfigs}
      setFaqConfigs={setFaqConfigs}
      deliveryPlans={deliveryPlans}
      setDeliveryPlans={setDeliveryPlans}
      reportedQuestions={reportedQuestions}
      setReportedQuestions={setReportedQuestions}
      onSaveFaqContent={saveFaqContent}
      onSaveProactiveMessages={saveProactiveMessages}
      onSaveUnansweredQuestion={saveUnansweredQuestion}
      onRestoreConfigVersion={restoreConfigVersion}
      configRevision={configRevision}
      configStatus={configStatus}
    />
  );

  if (configStatus === 'loading') return <div className="min-h-screen grid place-items-center">กำลังโหลดเนื้อหา…</div>;

  if (segment === null) {
    return <PlayerSegmentScreen onSelect={next => { void request('/api/player/state', { state: { ...account?.state, segment: next } }, 'PUT').then(() => setSegment(next)).catch(() => window.dispatchEvent(new Event('rookie-access-expired'))); }} />;
  }

  if (segment === "experienced") {
    return <ExperiencedPlayerScreen onBack={() => setSegment(null)} />;
  }

  return (
    <CoachScreen
      segment={segment}
      onLogout={() => {
        void request('/api/auth/logout', {}).then(() => window.location.reload());
      }}
      onReportQuestion={handleReportQuestion}
      answerConfigs={answerConfigs}
      faqConfigs={faqConfigs}
      deliveryPlans={deliveryPlans}
    />
  );
}
