// Explicit answer metadata is authoritative; legacy records require content proof.
export function isPromptText(text: string) {
  return /[?？]|(?:หรือยัง|ตรงไหน|เรื่องไหน|โหมดไหน|อย่างไรบ้าง|ยังงง|อยากรู้|บอกผม|พิมพ์คำถาม|ช่วยบอก|ขอทราบ)/u.test(text.trim());
}

export function canRateMessage(message: { role: string; text: string; feedbackEligible?: boolean; steps?: string[]; knowledgeId?: string; relatedIds?: string[]; reportQuestion?: string }) {
  if (message.role !== 'assistant') return false;
  if (typeof message.feedbackEligible === 'boolean') return message.feedbackEligible;
  return !message.reportQuestion && !isPromptText(message.text) && Boolean(message.steps?.length || message.knowledgeId || message.relatedIds?.length);
}
