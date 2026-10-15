import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRateMessage, isPromptText } from '../src/answerFeedback.ts';
test('only substantive assistant answers are rated, including legacy messages', () => {
  assert.equal(canRateMessage({ role: 'assistant', text: 'เล่นเกมแรกไปแล้วหรือยัง?' }), false);
  assert.equal(canRateMessage({ role: 'assistant', text: 'ดูแล้วเป็นอย่างไรบ้าง?' }), false);
  assert.equal(canRateMessage({ role: 'assistant', text: 'บอกผมว่าติดตรงไหน', feedbackEligible: false }), false);
  assert.equal(canRateMessage({ role: 'assistant', text: 'กด B เพื่อยิง', feedbackEligible: true }), true);
  assert.equal(canRateMessage({ role: 'assistant', text: 'ใช้ Welcome Pass', relatedIds: ['welcome-pass'] }), true);
  assert.equal(canRateMessage({ role: 'assistant', text: 'ระบบไม่พร้อม', reportQuestion: 'test', relatedIds: ['video'] }), false);
  assert.equal(canRateMessage({ role: 'user', text: 'คำตอบ', feedbackEligible: true }), false);
  assert.equal(isPromptText('ใช้จอยหรือคีย์บอร์ด?'), true);
});
