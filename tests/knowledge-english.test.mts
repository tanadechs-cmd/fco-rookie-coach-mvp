import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ENGLISH_KNOWLEDGE, FAQ_ENGLISH_BY_QUESTION } from "../src/knowledgeEnglish.ts";
import { isMoneyQuestion, rankConfiguredAnswer, selectAnswerLanguage } from "../src/knowledgeRouting.ts";
import type { BilingualAnswerConfig } from "../src/knowledgeRouting.ts";

const answers: BilingualAnswerConfig[] = Object.entries(ENGLISH_KNOWLEDGE).map(([id, entry]) => ({
  id,
  title: entry.title,
  text: entry.sourceText,
  keywords: [],
  keyboardSteps: entry.sourceKeyboardSteps,
  xboxSteps: entry.sourceXboxSteps,
  playstationSteps: entry.sourcePlaystationSteps,
  en: {
    title: entry.title,
    text: entry.text,
    keywords: entry.keywords,
    keyboardSteps: entry.keyboardSteps,
    xboxSteps: entry.xboxSteps,
    playstationSteps: entry.playstationSteps,
  },
}));

// Read only static literals from the repository source; never execute App.tsx.
function literalValue(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalValue(element));
  }
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      assert.ok(ts.isPropertyAssignment(property), "expected a static property assignment");
      assert.ok(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name), "expected a static property name");
      return [property.name.text, literalValue(property.initializer)];
    }));
  }
  throw new Error(`Expected a static literal, received ${ts.SyntaxKind[node.kind]}`);
}

function appLiteral(name: string): unknown {
  const path = new URL("../src/App.tsx", import.meta.url);
  const source = ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find((item) => ts.isIdentifier(item.name) && item.name.text === name);
    if (declaration?.initializer) return literalValue(declaration.initializer);
  }
  throw new Error(`Missing ${name} declaration in App.tsx`);
}

type ThaiDefault = {
  id: string;
  shortSummary: string;
};
type ThaiCanned = {
  text: string;
  keyboardSteps?: string[];
  xboxSteps?: string[];
  playstationSteps?: string[];
};

test("real English beginner questions resolve through the seeded keywords without an AI call", () => {
  const cases: [string, string][] = [
    ["How do I pass?", "passing"],
    ["How do I pass the ball?", "passing"],
    ["Can you teach me to pass?", "passing"],
    ["How do I shoot?", "shooting"],
    ["How can I shoot accurately?", "shooting"],
    ["How do I defend?", "defending"],
    ["Help me with defense", "defending"],
    ["How do I dribble?", "dribbling"],
    ["How can I connect my controller?", "controller"],
    ["What is Welcome Pass?", "welcome-pass"],
    ["How do I earn BP?", "welcome-pass"],
    ["Where can I make money?", "welcome-pass"],
  ];
  for (const [question, id] of cases) {
    assert.equal(rankConfiguredAnswer(question, answers)?.id, id, question);
    assert.equal(selectAnswerLanguage(question, "th"), "en", question);
  }
});

test("earning questions use the money route but ball passing and account issues do not", () => {
  for (const question of ["How do I earn BP?", "Where can I make money?", "How do I get rewards?", "Where can I farm BP?"]) {
    assert.equal(isMoneyQuestion(question), true, question);
  }
  for (const question of ["How do I pass?", "What is BP?", "My BP disappeared from my account", "How do I get a refund?"]) {
    assert.equal(isMoneyQuestion(question), false, question);
  }
  for (const question of ["surpass", "screenshot", "shootout", "defenderless", "dribbledown"]) {
    assert.equal(rankConfiguredAnswer(question, answers), undefined, `${question}: do not match a base verb inside another word`);
  }
});

test("all 48 Hub topics have English text and exact Thai source snapshots", () => {
  const knowledge = appLiteral("KNOWLEDGE") as ThaiDefault[];
  const canned = appLiteral("CANNED") as Record<string, ThaiCanned>;
  assert.equal(knowledge.length, 48);
  for (const item of knowledge) {
    const entry = ENGLISH_KNOWLEDGE[item.id];
    assert.ok(entry, `${item.id}: missing English seed`);
    assert.ok(entry.title.trim(), `${item.id}: empty English title`);
    assert.ok(entry.text.trim(), `${item.id}: empty English answer`);
    assert.ok(entry.keywords.length, `${item.id}: missing English keywords`);
    for (const value of [entry.title, entry.text, ...entry.keywords, ...entry.keyboardSteps, ...entry.xboxSteps, ...entry.playstationSteps]) {
      assert.doesNotMatch(value, /[\u0e00-\u0e7f]/, `${item.id}: unexpected Thai in English copy`);
    }
    const original = canned[item.id];
    assert.equal(entry.sourceText, original?.text ?? item.shortSummary, `${item.id}: Thai text snapshot changed`);
    assert.deepEqual(entry.sourceKeyboardSteps, original?.keyboardSteps ?? [], `${item.id}: keyboard snapshot changed`);
    assert.deepEqual(entry.sourceXboxSteps, original?.xboxSteps ?? [], `${item.id}: Xbox snapshot changed`);
    assert.deepEqual(entry.sourcePlaystationSteps, original?.playstationSteps ?? [], `${item.id}: PlayStation snapshot changed`);
    assert.equal(entry.keyboardSteps.length, entry.sourceKeyboardSteps.length, `${item.id}: keyboard step count changed`);
    assert.equal(entry.xboxSteps.length, entry.sourceXboxSteps.length, `${item.id}: Xbox step count changed`);
    assert.equal(entry.playstationSteps.length, entry.sourcePlaystationSteps.length, `${item.id}: PlayStation step count changed`);
  }
  assert.equal(Object.keys(ENGLISH_KNOWLEDGE).length, 49, "48 Hub topics plus the existing mode-start canned response");
});

test("translated controls preserve the existing keyboard, Xbox and PlayStation mappings", () => {
  assert.deepEqual(ENGLISH_KNOWLEDGE.passing.keyboardSteps, ["Press S for a short pass", "Press A to cross", "Press W for a through ball"]);
  assert.deepEqual(ENGLISH_KNOWLEDGE.passing.xboxSteps, ["Press A for a short pass", "Press X to cross", "Press Y for a through ball"]);
  assert.deepEqual(ENGLISH_KNOWLEDGE.passing.playstationSteps, ["Press ✕ for a short pass", "Press □ to cross", "Press △ for a through ball"]);
  assert.equal(ENGLISH_KNOWLEDGE.shooting.keyboardSteps[0], "Press D to shoot");
  assert.equal(ENGLISH_KNOWLEDGE.shooting.xboxSteps[0], "Press B to shoot");
  assert.equal(ENGLISH_KNOWLEDGE.shooting.playstationSteps[0], "Press ○ to shoot");
  assert.equal(ENGLISH_KNOWLEDGE.defending.xboxSteps[1], "Press B to tackle");
  assert.equal(ENGLISH_KNOWLEDGE.defending.playstationSteps[1], "Press ○ to tackle");
  assert.equal(ENGLISH_KNOWLEDGE.dribbling.xboxSteps[2], "Hold RT to sprint");
  assert.equal(ENGLISH_KNOWLEDGE.dribbling.playstationSteps[2], "Hold R2 to sprint");
});

test("all default FAQ labels have English translations whose questions route correctly", () => {
  const faqs = appLiteral("FAQ_CONFIG") as { question: string }[];
  for (const faq of faqs) {
    const question = FAQ_ENGLISH_BY_QUESTION[faq.question];
    assert.ok(question, `${faq.question}: missing English FAQ`);
    assert.doesNotMatch(question, /[\u0e00-\u0e7f]/);
    assert.ok(isMoneyQuestion(question) || rankConfiguredAnswer(question, answers), question);
  }
  assert.equal(Object.keys(FAQ_ENGLISH_BY_QUESTION).length, 6);
});
