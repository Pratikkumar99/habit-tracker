// All dates are 'YYYY-MM-DD' strings in the habit's own timezone.
export const todayIn = (tz) => new Date().toLocaleDateString('en-CA', { timeZone: tz });
export const addDays = (d, n) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
export const weekStart = (d) => addDays(d, -((weekday(d) + 6) % 7)); // Monday
