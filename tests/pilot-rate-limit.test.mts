import test from 'node:test';
import assert from 'node:assert/strict';
import { takePilotSlot } from '../lib/pilotRateLimit.ts';
test('pilot rate guard enforces and resets a per-instance minute budget', () => {
  for (let i = 0; i < 10; i++) assert.equal(takePilotSlot('test', 10, 1000), true);
  assert.equal(takePilotSlot('test', 10, 1001), false);
  assert.equal(takePilotSlot('other', 10, 1001), true);
  assert.equal(takePilotSlot('test', 10, 61000), true);
});
