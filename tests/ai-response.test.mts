import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiResponse } from '../src/aiResponse.ts';

test('removes the screenshot regression from Thai and English replies', () => {
  for (const text of ['ผมชื่อ Rookie Coach ครับ', 'My name is Rookie Coach.']) {
    assert.deepEqual(normalizeAiResponse(`${text} {"actions":[]}`), { answer: text, actions: [] });
  }
});
test('preserves supported buttons, filters unknown actions and removes duplicates', () => {
  assert.deepEqual(normalizeAiResponse('Ask the community. {"actions":["discord","bad","discord"]}'), { answer: 'Ask the community.', actions: ['discord'] });
});
test('handles structured, fenced, and nested action metadata', () => {
  for (const raw of ['```json\n{"answer":"Hello","actions":["education_hub"]}\n```', 'Hello\n```json\n{"actions":["education_hub"]}\n```', JSON.stringify({ answer: 'Hello {"actions":["education_hub"]}', actions: [] })]) {
    assert.deepEqual(normalizeAiResponse(raw), { answer: 'Hello', actions: ['education_hub'] });
  }
});
test('keeps plain text and unrelated JSON intact; metadata alone is not an answer', () => {
  for (const text of ['Hello', 'Example: {"score":2}', 'Use {braces} in text.']) assert.equal(normalizeAiResponse(text).answer, text);
  assert.equal(normalizeAiResponse('{"actions":[]}').answer, '');
  assert.equal(normalizeAiResponse('{"answer":"","actions":[]}').answer, '');
});
