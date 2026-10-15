export type AnswerLanguage = "th" | "en";

export type LocalizedAnswer = {
  opening?: string;
  clipIntro?: string;
  title: string;
  text: string;
  keywords: string[];
  keyboardSteps: string[];
  xboxSteps: string[];
  playstationSteps: string[];
  sourceSignature?: string;
};

export type BilingualAnswerConfig = {
  opening?: string;
  clipIntro?: string;
  id: string;
  title: string;
  text: string;
  keywords: string[];
  keyboardSteps: string[];
  xboxSteps: string[];
  playstationSteps: string[];
  source?: string;
  isManual?: boolean;
  en?: LocalizedAnswer;
};

/** Keywords and provenance do not change the meaning of an approved translation. */
export function sourceSignature(answer: BilingualAnswerConfig): string {
  return JSON.stringify({
    title: answer.title,
    text: answer.text,
    keyboardSteps: answer.keyboardSteps,
    xboxSteps: answer.xboxSteps,
    playstationSteps: answer.playstationSteps,
    ...(answer.opening !== undefined ? { opening: answer.opening } : {}),
    ...(answer.clipIntro !== undefined ? { clipIntro: answer.clipIntro } : {}),
  });
}

export function englishStatus(answer: BilingualAnswerConfig): "missing" | "current" | "stale" {
  if (!answer.en?.text.trim()) return "missing";
  return answer.en.sourceSignature === sourceSignature(answer) ? "current" : "stale";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

const NEUTRAL_WORDS = new Set([
  "bp", "cp", "sc", "sp", "tc", "fp", "qss", "ps", "ps4", "ps5", "xbox",
  "playstation", "fco", "fc", "online", "abxy", "xyab", "a", "b", "x", "y",
  "lb", "lt", "rb", "rt", "l1", "l2", "r1", "r2", "ovr", "fps", "ping",
]);

/** The actual question controls the reply language, independently of UI language. */
export function selectAnswerLanguage(query: string, previousLanguage: AnswerLanguage = "th"): AnswerLanguage {
  const q = normalize(query);
  const requests: { at: number; language: AnswerLanguage }[] = [];
  const explicit = [
    { language: "en" as const, pattern: /\b(?:reply|respond|answer|explain|speak|write|continue)(?:\s+(?:to me|it|this))?\s+in\s+english\b|\benglish\s+please\b|^(?:in\s+)?english[.!?]*$|(?:ตอบ|อธิบาย|ขอ|ใช้|เปลี่ยนเป็น)(?:เป็น)?(?:ภาษา)?\s*(?:อังกฤษ|english)/g },
    { language: "th" as const, pattern: /\b(?:reply|respond|answer|explain|speak|write|continue)(?:\s+(?:to me|it|this))?\s+in\s+thai\b|\bthai\s+please\b|^(?:in\s+)?thai[.!?]*$|(?:ตอบ|อธิบาย|ขอ|ใช้|เปลี่ยนเป็น)(?:เป็น)?(?:ภาษา)?\s*(?:ไทย|thai)/g },
  ];
  for (const rule of explicit) {
    for (const match of q.matchAll(rule.pattern)) requests.push({ at: match.index, language: rule.language });
  }
  if (requests.length) return requests.sort((a, b) => b.at - a.at)[0].language;
  if (/[\u0e00-\u0e7f]/.test(q)) return "th";
  const words = q.match(/[a-z]+[a-z0-9]*/g) ?? [];
  if (words.some((word) => !NEUTRAL_WORDS.has(word))) return "en";
  return previousLanguage;
}

function keywordMatches(keyword: string, question: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^[a-z0-9]/.test(keyword) ? "(?:^|[^a-z0-9])" : "";
  const right = /[a-z0-9]$/.test(keyword) ? "(?=$|[^a-z0-9])" : "";
  return new RegExp(`${left}${escaped}${right}`).test(question);
}

/** Search only the editable keyword lists; removing a keyword removes its route. */
export function rankConfiguredAnswer<T extends BilingualAnswerConfig>(query: string, answers: readonly T[]): T | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  let best: { answer: T; longest: number; exact: number; count: number } | undefined;
  for (const answer of answers) {
    const keywords = [...new Set([...answer.keywords, ...(answer.en?.keywords ?? [])].map(normalize).filter(Boolean))];
    // Old Welcome Pass records included the ambiguous word "pass". It must not
    // capture ball-passing questions even before an admin cleans up those records.
    const welcomePass = /welcome[\s_-]*pass/.test(normalize(`${answer.id} ${answer.title} ${answer.en?.title ?? ""}`)) || keywords.includes("welcome pass");
    const matched = keywords.filter((keyword) => !(welcomePass && keyword === "pass") && keywordMatches(keyword, q));
    if (!matched.length) continue;
    const candidate = {
      answer,
      longest: Math.max(...matched.map((keyword) => keyword.length)),
      exact: matched.some((keyword) => keyword === q) ? 1 : 0,
      count: matched.length,
    };
    if (!best || candidate.exact > best.exact ||
      (candidate.exact === best.exact && candidate.longest > best.longest) ||
      (candidate.exact === best.exact && candidate.longest === best.longest && candidate.count > best.count)) {
      best = candidate;
    }
  }
  return best?.answer;
}

/** Onboarding rewards, never real-money/account/payment troubleshooting. */
export function isMoneyQuestion(query: string): boolean {
  const q = normalize(query);
  if (/\b(?:real[ -]?money|cash[ -]?out|salary|dollars?|usd|baht|refunds?|payments?|paid|charged|billing|credit card|top[ -]?up|stolen|missing|disappeared|login|log in|banned|account)\b/.test(q) ||
    /เงินจริง|ถอนเงิน|เงินเดือน|คืนเงิน|เติมเงิน|ชำระเงิน|หักเงิน|เงินหาย|ของหาย|รางวัลหาย|ไม่ได้รับรางวัล|รางวัลไม่เข้า|บัญชี|ล็อกอิน|แบน/.test(q)) return false;
  const compact = q.replace(/\s+/g, "");
  if (/หาเงิน|หาbp|เงินมาจากไหน|ได้เงินยังไง|เงินไม่พอ|รับรางวัลยังไง|รางวัลจากไหน|หาเหรียญ/.test(compact)) return true;
  const hasCurrency = /\b(?:bp|money|coins?|currency|rewards?)\b/.test(q);
  const hasAcquisition = /\b(?:earn|earning|make|making|get|getting|farm|farming|collect|collecting|obtain|receive|claim|gain)\b/.test(q);
  return hasCurrency && (hasAcquisition || /\b(?:not enough|more|where from|run out|ran out|short of)\b/.test(q));
}
