// Best-effort warm-instance guard for the small guest pilot, not a global quota.
const windows = new Map<string, { start: number; count: number }>();
export function takePilotSlot(key: string, limit: number, now = Date.now()) {
  for (const [id, value] of windows) if (now - value.start >= 60000) windows.delete(id);
  const value = windows.get(key) ?? { start: now, count: 0 };
  if (value.count >= limit || (!windows.has(key) && windows.size >= 5000)) return false;
  value.count++; windows.set(key, value); return true;
}
