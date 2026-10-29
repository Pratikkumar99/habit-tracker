import { addDays, weekday, weekStart } from './dates.js';

export const isScheduled = (h, d) => h.scheduleType !== 'weekdays' || h.weekdays.includes(weekday(d));

// Walk forward from the first completion to today. Today never breaks a streak
// (you still have time); a missed scheduled day (or missed week) resets it.
export function computeStreaks(h, dates, today) {
  const weekly = h.scheduleType === 'times_per_week';
  const unit = weekly ? 'week' : 'day';
  const set = new Set(dates);
  if (!set.size) return { current: 0, best: 0, unit };
  const first = [...set].sort()[0];
  let best = 0, run = 0;

  if (weekly) {
    const counts = {};
    for (const d of set) counts[weekStart(d)] = (counts[weekStart(d)] || 0) + 1;
    const thisWeek = weekStart(today);
    for (let w = weekStart(first); w <= thisWeek; w = addDays(w, 7)) {
      if ((counts[w] || 0) >= h.timesPerWeek) { run++; best = Math.max(best, run); }
      else if (w !== thisWeek) run = 0;
    }
  } else {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (!isScheduled(h, d)) continue;
      if (set.has(d)) { run++; best = Math.max(best, run); }
      else if (d !== today) run = 0;
    }
  }
  return { current: run, best, unit };
}
