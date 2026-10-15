export function normalizeAiResponse(raw: string, actions?: unknown): { answer: string; actions: ('education_hub' | 'discord' | 'customer_support' | 'report_question')[] };
