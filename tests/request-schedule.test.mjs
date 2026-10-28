import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const api = {};
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/lib/request-schedule.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
const now = new Date(2026, 9, 28, 10);

test('the reported afternoon window is rejected with an actionable AM/PM explanation', () => {
  assert.match(api.requestScheduleError('2026-10-29', '15:47', '13:47', now), /Latest time must be after earliest time.*AM and PM/);
  assert.equal(api.requestScheduleError('2026-10-29', '13:47', '15:47', now), null);
});
test('optional timing permits any time but rejects partial, equal, overnight and malformed windows', () => {
  assert.equal(api.requestScheduleError('', '', '', now), null);
  for (const pair of [['09:00',''],['','17:00']]) assert.match(api.requestScheduleError('', ...pair, now), /both/);
  for (const pair of [['09:00','09:00'],['23:00','01:00']]) assert.match(api.requestScheduleError('', ...pair, now), /same day/);
  for (const pair of [['9:00','17:00'],['12:60','17:00'],['24:00','25:00']]) assert.match(api.requestScheduleError('', ...pair, now), /valid earliest/);
});
test('dates reject past days and impossible calendar dates and retain the selected local day', () => {
  assert.match(api.requestScheduleError('2026-10-27', '', '', now), /future date/);
  assert.match(api.requestScheduleError('2026-02-30', '', '', now), /valid date/);
  assert.equal(api.requestScheduleError('2026-10-28', '', '', now), null);
  const original = process.env.TZ;
  try {
    for (const zone of ['Pacific/Auckland','America/Los_Angeles']) {
      process.env.TZ = zone;
      assert.equal(api.localRequestDate(new Date(2026,9,29,23,45)), '2026-10-29');
      assert.equal(api.localRequestDate(new Date(2026,9,29,0,15)), '2026-10-29');
      assert.equal(api.requestCalendarDate('2026-10-29T00:00:00.000Z').getDate(),29);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
