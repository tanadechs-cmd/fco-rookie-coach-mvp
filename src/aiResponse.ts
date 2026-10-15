const ACTION_IDS = ['education_hub', 'discord', 'customer_support', 'report_question'] as const;
type ActionId = (typeof ACTION_IDS)[number];

function safeActions(value: unknown): ActionId[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is ActionId => ACTION_IDS.includes(item)))].slice(0, 2) : [];
}

/** Accept the workflow envelope or prose followed by a separate actions envelope. */
export function normalizeAiResponse(raw: string, actions: unknown = []): { answer: string; actions: ActionId[] } {
  let answer = raw.trim();
  let collected = safeActions(actions);
  const unfenced = (value: string) => value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(unfenced(answer));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (typeof parsed.answer === 'string') {
        answer = parsed.answer.trim();
        collected = safeActions([...collected, ...safeActions(parsed.actions)]);
      } else if (Object.keys(parsed).length === 1 && Array.isArray(parsed.actions)) {
        return { answer: '', actions: safeActions([...collected, ...safeActions(parsed.actions)]) };
      }
    }
  } catch { /* Plain conversation is also a valid answer. */ }

  // Match only a complete, trailing actions-only object; preserve unrelated JSON.
  const suffix = answer.match(/(?:```(?:json)?\s*)?\{\s*"actions"\s*:\s*\[[^\]]*\]\s*\}(?:\s*```)?\s*$/i);
  if (suffix) {
    try {
      const parsed = JSON.parse(unfenced(suffix[0]));
      if (Array.isArray(parsed.actions)) {
        answer = answer.slice(0, suffix.index).trim();
        collected = safeActions([...collected, ...safeActions(parsed.actions)]);
      }
    } catch { /* Do not discard malformed or unrelated text. */ }
  }
  return { answer, actions: collected };
}
