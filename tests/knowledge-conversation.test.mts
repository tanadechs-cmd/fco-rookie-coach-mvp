import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationCopy, withOpening } from '../src/knowledgeConversation.ts';
import { sourceSignature, englishStatus } from '../src/knowledgeRouting.ts';
import type { BilingualAnswerConfig } from '../src/knowledgeRouting.ts';

test('legacy answers get bilingual casual defaults without changing source validity', () => {
  assert.match(conversationCopy(undefined, 'th', 'shooting').opening, /จังหวะยิง/);
  assert.match(conversationCopy(undefined, 'en', 'shooting').opening, /timing/);
  assert.equal(withOpening('Press B', 'Let’s try this.'), 'Let’s try this.\n\nPress B');
  assert.equal(withOpening('Press B', 'Let’s try this.', false), 'Press B');
});

test('custom copy, intentional blank and translation staleness are respected', () => {
  const answer: BilingualAnswerConfig = { id: 'shooting', title: 'ยิง', text: 'ยิง', keywords: [], keyboardSteps: [], xboxSteps: [], playstationSteps: [], opening: '', clipIntro: 'ลองดูครับ', en: { title: 'Shoot', text: 'Shoot', keywords: [], keyboardSteps: [], xboxSteps: [], playstationSteps: [], opening: 'Try this', clipIntro: '' } };
  answer.en!.sourceSignature = sourceSignature(answer);
  assert.equal(conversationCopy(answer, 'th').opening, '');
  assert.equal(conversationCopy(answer, 'th').clipIntro, 'ลองดูครับ');
  assert.equal(conversationCopy(answer, 'en').opening, 'Try this');
  assert.equal(conversationCopy(answer, 'en').clipIntro, '');
  answer.opening = 'ข้อความใหม่';
  assert.equal(englishStatus(answer), 'stale');
  assert.deepEqual(conversationCopy(answer, 'en'), { opening: '', clipIntro: '' });
});
