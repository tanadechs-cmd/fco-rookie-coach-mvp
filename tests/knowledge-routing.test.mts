import assert from "node:assert/strict";
import test from "node:test";
import { englishStatus, isMoneyQuestion, rankConfiguredAnswer, selectAnswerLanguage, sourceSignature } from "../src/knowledgeRouting.ts";
import type { BilingualAnswerConfig } from "../src/knowledgeRouting.ts";

function answer(id: string, keywords: string[], title = id): BilingualAnswerConfig {
  return { id, title, text: "คำตอบ", keywords, keyboardSteps: [], xboxSteps: [], playstationSteps: [] };
}

test("configured Thai and English keyword edits apply without hidden static routes", () => {
  const passing = answer("passing", ["ส่งบอล"]);
  assert.equal(rankConfiguredAnswer("ส่งบอลยังไง", [passing]), passing);
  assert.equal(rankConfiguredAnswer("passing", [passing]), undefined, "title and ID are not hidden keywords");
  passing.en = { title: "Passing", text: "Pass the ball.", keywords: ["pass the ball"], keyboardSteps: [], xboxSteps: [], playstationSteps: [] };
  assert.equal(rankConfiguredAnswer("How do I pass the ball?", [passing]), passing);
  passing.en.keywords = ["short pass"];
  assert.equal(rankConfiguredAnswer("How do I pass the ball?", [passing]), undefined);
  assert.equal(rankConfiguredAnswer("How do I make a short pass?", [passing]), passing);
  passing.keywords = [];
  assert.equal(rankConfiguredAnswer("ส่งบอลยังไง", [passing]), undefined);
});

test("Welcome Pass cannot capture lone pass or ball-passing questions", () => {
  const welcome = answer("welcome-pass", ["welcome pass", "pass", "รางวัล"], "Welcome Pass");
  const passing = answer("passing", ["pass", "passing", "pass the ball"]);
  assert.equal(rankConfiguredAnswer("How do I pass the ball?", [welcome, passing]), passing);
  assert.equal(rankConfiguredAnswer("pass", [welcome, passing]), passing);
  assert.equal(rankConfiguredAnswer("passing", [welcome, passing]), passing);
  assert.equal(rankConfiguredAnswer("What is Welcome Pass?", [passing, welcome]), welcome);
  assert.equal(rankConfiguredAnswer("pass", [welcome]), undefined);
});

test("all ASCII keywords require boundaries and currency abbreviations never match substrings", () => {
  const currency = ["bp", "cp", "sc", "sp", "tc", "fp"].map((id) => answer(id, [id]));
  for (const question of ["pass", "special", "screenshot", "watch", "backpack", "scenery", "fprofiler"]) {
    assert.equal(rankConfiguredAnswer(question, currency), undefined, question);
  }
  assert.equal(rankConfiguredAnswer("What is BP?", currency)?.id, "bp");
  assert.equal(rankConfiguredAnswer("เหรียญ BP คืออะไร", currency)?.id, "bp");
  const shot = answer("shot", ["shot"]);
  assert.equal(rankConfiguredAnswer("take a screenshot", [shot]), undefined);
  assert.equal(rankConfiguredAnswer("How to take a shot?", [shot]), shot);
});

test("specific configured phrases win over broad overlapping terms", () => {
  const shot = answer("shot", ["shot", "shooting", "how"]);
  const low = answer("manual-low-shot", ["low shot"]);
  assert.equal(rankConfiguredAnswer("How does a low shot work?", [shot, low]), low);
  assert.equal(rankConfiguredAnswer("   ", [shot, low]), undefined);
});

test("language follows latest clear question and explicit language instructions", () => {
  assert.equal(selectAnswerLanguage("How do I earn BP?", "th"), "en");
  assert.equal(selectAnswerLanguage("ยังงงเรื่อง BP", "en"), "th");
  assert.equal(selectAnswerLanguage("Can you explain that again?", "th"), "en");
  assert.equal(selectAnswerLanguage("ส่งบอลยังไง Reply in English please", "th"), "en");
  assert.equal(selectAnswerLanguage("Please answer in Thai: how can I pass?", "en"), "th");
  assert.equal(selectAnswerLanguage("ขอภาษาอังกฤษ เรื่องยิงบอล", "th"), "en");
  assert.equal(selectAnswerLanguage("How do I pass ตอบไทย", "en"), "th");
  assert.equal(selectAnswerLanguage("English please", "th"), "en");
  assert.equal(selectAnswerLanguage("ภาษา English หมายถึงอะไร", "en"), "th");
});

test("neutral game labels and controller symbols preserve conversation language", () => {
  for (const question of ["BP", "PS", "Xbox", "QSS", "FC Online", "PS5", "LT + B", "□ △ ○ ✕", "123", "?"]) {
    assert.equal(selectAnswerLanguage(question, "en"), "en", question);
    assert.equal(selectAnswerLanguage(question, "th"), "th", question);
  }
});

test("money routing covers common Thai and English onboarding reward questions", () => {
  for (const question of ["หาเงินจากไหน", "หา BP ยังไง", "เงินไม่พอ", "เงินมาจากไหน", "รับรางวัลยังไง", "How do I earn BP?", "Where can I make money?", "How do I get rewards?", "How to farm BP", "Where can I collect coins?", "I need more BP", "I ran out of BP"]) {
    assert.equal(isMoneyQuestion(question), true, question);
  }
  for (const question of ["pass the ball", "What does BP mean?", "special training", "How to make real money", "Can I cash out BP?", "I paid but cannot get rewards", "How can I get a refund?", "Money disappeared from my account", "เติมเงินแล้วไม่ได้รางวัล", "หาเงินจริง", "รางวัลไม่เข้า", "หา BP บัญชีโดนแบน"]) {
    assert.equal(isMoneyQuestion(question), false, question);
  }
});

test("translation status tracks Thai meaning and device steps, not keyword or source edits", () => {
  const item = answer("passing", ["ส่งบอล"]);
  assert.equal(englishStatus(item), "missing");
  item.en = { title: "Passing", text: "Pass the ball.", keywords: ["pass"], keyboardSteps: ["Press S"], xboxSteps: ["Press A"], playstationSteps: ["Press ✕"] };
  assert.equal(englishStatus(item), "stale", "an unreviewed translation has no source signature");
  item.en.sourceSignature = sourceSignature(item);
  assert.equal(englishStatus(item), "current");
  item.keywords = ["จ่ายบอล"];
  item.source = "Updated source label";
  assert.equal(englishStatus(item), "current");
  item.keyboardSteps = ["กด S"];
  assert.equal(englishStatus(item), "stale");
  item.en.sourceSignature = sourceSignature(item);
  assert.equal(englishStatus(item), "current");
  item.text = "คำตอบใหม่";
  assert.equal(englishStatus(item), "stale");
  item.en.text = "  ";
  assert.equal(englishStatus(item), "missing");
});
