import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks } from '../lib/streak.js';

// 2026-10-28 is a Wednesday
const daily = { scheduleType: 'daily', weekdays: [] };
const mwf = { scheduleType: 'weekdays', weekdays: [1, 3, 5] };
const tpw = { scheduleType: 'times_per_week', timesPerWeek: 2, weekdays: [] };

test('no completions gives zero', () => assert.deepEqual(computeStreaks(daily, [], '2026-10-28'), { current: 0, best: 0, unit: 'day' }));
test('daily: consecutive days count', () => assert.equal(computeStreaks(daily, ['2026-10-26', '2026-10-27', '2026-10-28'], '2026-10-28').current, 3));
test('daily: today not yet done does not break streak', () => assert.equal(computeStreaks(daily, ['2026-10-26', '2026-10-27'], '2026-10-28').current, 2));
test('daily: a missed day breaks the streak but best is kept', () => {
  const r = computeStreaks(daily, ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-27', '2026-10-28'], '2026-10-28');
  assert.equal(r.current, 2); assert.equal(r.best, 3);
});
test('weekdays: Tuesday does not break a Mon/Wed/Fri streak', () => assert.equal(computeStreaks(mwf, ['2026-10-26', '2026-10-28'], '2026-10-28').current, 2));
test('weekdays: missing a scheduled day breaks it', () => assert.equal(computeStreaks(mwf, ['2026-10-23', '2026-10-28'], '2026-10-28').current, 1));
test('times per week: counts consecutive weeks that hit the target', () => {
  const r = computeStreaks(tpw, ['2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21'], '2026-10-28');
  assert.deepEqual(r, { current: 2, best: 2, unit: 'week' });
});
test('times per week: current week below target does not break it', () => assert.equal(computeStreaks(tpw, ['2026-10-19', '2026-10-21', '2026-10-27'], '2026-10-28').current, 1));
test('times per week: a missed week resets', () => assert.equal(computeStreaks(tpw, ['2026-10-05', '2026-10-06', '2026-10-27', '2026-10-28'], '2026-10-28').current, 1));
