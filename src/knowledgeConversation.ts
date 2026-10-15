import type { AnswerLanguage, BilingualAnswerConfig } from './knowledgeRouting';
import { englishStatus } from './knowledgeRouting.ts';

const OPENINGS: Record<string, [string, string]> = {
  shooting: ['ลองเริ่มจากจังหวะยิงกับทิศทางก่อนครับ ⚽', 'Let’s start with timing and aim ⚽'],
  passing: ['ลองดูทีละแบบครับ จะได้เลือกส่งให้เข้ากับจังหวะเล่น', 'Let’s go through the options so you can pick the right pass.'],
  defending: ['เกมรับค่อย ๆ จับจังหวะได้ครับ เริ่มจากตรงนี้ก่อน', 'Let’s take defending one step at a time.'],
  dribbling: ['ลองค่อย ๆ คุมบอลให้คุ้นมือก่อนครับ', 'Let’s get comfortable with the ball first.'],
  'welcome-pass': ['ถ้ากำลังหาของมาเริ่มทำทีม ลองดูตรงนี้ครับ', 'Looking for a starting point for your squad? Try this.'],
  'mission-hub': ['มาดูภารกิจที่ช่วยให้มีรางวัลไปต่อกันครับ', 'Let’s look at missions and the rewards you can work towards.'],
  controller: ['มาเช็กการควบคุมให้เล่นถนัดกันก่อนครับ', 'Let’s get your controls feeling comfortable first.'],
};

/** Undefined uses a starter; an intentionally empty field disables the line. */
export function conversationCopy(answer: BilingualAnswerConfig | undefined, language: AnswerLanguage, id = answer?.id ?? '') {
  if (language === 'en' && answer && englishStatus(answer) !== 'current') return { opening: '', clipIntro: '' };
  const fields = language === 'en' ? answer?.en : answer;
  return {
    opening: fields?.opening ?? OPENINGS[id]?.[language === 'en' ? 1 : 0] ?? (language === 'en' ? 'Let’s break this down.' : 'ลองดูทีละส่วนกันครับ'),
    clipIntro: fields?.clipIntro ?? (language === 'en' ? 'Want to see it in action? Here’s a video to follow along 👇' : 'ถ้าอยากเห็นภาพ ลองดูตัวอย่างในคลิปนี้ได้เลยครับ 👇'),
  };
}

export function withOpening(text: string, opening: string, include = true) {
  return include && opening.trim() ? `${opening.trim()}\n\n${text}` : text;
}
