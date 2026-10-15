// Best-effort warm-instance guard, not a global spending quota.
const windows = new Map();
export function takePilotSlot(key, limit, now = Date.now()) {
  for (const [id, value] of windows) if (now - value.start >= 60000) windows.delete(id);
  const value = windows.get(key) ?? { start: now, count: 0 };
  if (value.count >= limit || (!windows.has(key) && windows.size >= 5000)) return false;
  value.count++; windows.set(key, value); return true;
}
