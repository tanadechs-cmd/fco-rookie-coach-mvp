// Temporary guest-only hosted pilot. Local review keeps its SQLite account flow.
export const PUBLIC_TRIAL = import.meta.env.PROD;
const KEY = 'rookie-public-trial-v1';
let memory: any = null;

function read() {
  try { memory = JSON.parse(localStorage.getItem(KEY) || 'null') || memory; } catch { /* Session-only when storage is unavailable. */ }
  if (!memory) return null;
  const date = (value: string) => Date.parse(new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) + 'T00:00:00Z');
  return { ...memory, day: Math.max(1, Math.min(3, 1 + Math.floor((date(new Date().toISOString()) - date(memory.firstSeen)) / 86400000))) };
}
function save(value: any) {
  memory = value;
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Keep session state; never claim server persistence. */ }
  return value;
}
export function trialRequest(path: string, body?: any): any {
  if (path === '/api/access') return { guestEnabled: true, whitelistOnly: false, loginEnabled: false };
  if (path === '/api/auth/logout') { memory = null; try { localStorage.removeItem(KEY); } catch {} return { ok: true }; }
  if (path === '/api/auth/guest') return read() || save({ id: crypto.randomUUID(), email: null, firstSeen: new Date().toISOString(), day: 1, state: {}, npsCompleted: true, questionCount: 0, ratedMessageIds: [] });
  if (path === '/api/auth/session') { const user = read(); if (!user) throw new Error('Start as a guest first'); return user; }
  if (path === '/api/player/state') { const user = read(); if (!user) throw new Error('Start as a guest first'); save({ ...user, state: body?.state ?? user.state }); return { ok: true, storage: 'browser' }; }
  if (path === '/api/events') return { recorded: false, reason: 'Pilot analytics not enabled' };
  return undefined;
}
