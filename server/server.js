import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Habit, Completion } from './models.js';
import { todayIn, addDays, weekStart } from './lib/dates.js';
import { computeStreaks, isScheduled } from './lib/streak.js';

const app = express();
app.use(cors());
app.use(express.json());
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const bad = (res, errors, status = 400) => res.status(status).json({ errors: [].concat(errors) });
const validId = (id) => mongoose.isValidObjectId(id);

function validate(b) {
  const errors = [];
  const name = String(b.name || '').trim();
  if (!name) errors.push('Habit name is required.');
  else if (name.length > 80) errors.push('Habit name must be 80 characters or fewer.');
  if (!['daily', 'weekdays', 'times_per_week'].includes(b.scheduleType)) errors.push('Choose a schedule type.');
  let weekdays = [];
  if (b.scheduleType === 'weekdays') {
    weekdays = [...new Set(b.weekdays || [])].filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (!weekdays.length) errors.push('Select at least one weekday.');
  }
  const t = Number(b.timesPerWeek);
  if (b.scheduleType === 'times_per_week' && !(Number.isInteger(t) && t >= 1 && t <= 7))
    errors.push('Times per week must be a whole number from 1 to 7.');
  const timezone = b.timezone || 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { errors.push('Unknown timezone.'); }
  return { errors, data: { name, scheduleType: b.scheduleType, weekdays, timesPerWeek: b.scheduleType === 'times_per_week' ? t : undefined, timezone } };
}

function present(h, dates) {
  const today = todayIn(h.timezone);
  const set = new Set(dates);
  const recent = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, done: set.has(date), scheduled: isScheduled(h, date) };
  });
  return {
    _id: h._id, name: h.name, scheduleType: h.scheduleType, weekdays: h.weekdays,
    timesPerWeek: h.timesPerWeek, timezone: h.timezone, archivedAt: h.archivedAt,
    today, doneToday: set.has(today), recent,
    weekCount: dates.filter((d) => weekStart(d) === weekStart(today)).length,
    streak: computeStreaks(h, dates, today),
  };
}

async function datesByHabit(habits) {
  const rows = await Completion.find({ habit: { $in: habits.map((h) => h._id) } }).select('habit date');
  const map = new Map();
  for (const r of rows) (map.get(String(r.habit)) || map.set(String(r.habit), []).get(String(r.habit))).push(r.date);
  return map;
}

app.get('/api/habits', wrap(async (req, res) => {
  const archived = req.query.archived === 'true';
  const habits = await Habit.find({ archivedAt: archived ? { $ne: null } : null }).sort({ createdAt: 1 });
  const map = await datesByHabit(habits);
  res.json(habits.map((h) => present(h, map.get(String(h._id)) || [])));
}));

app.post('/api/habits', wrap(async (req, res) => {
  const { errors, data } = validate(req.body);
  if (errors.length) return bad(res, errors);
  res.status(201).json(present(await Habit.create(data), []));
}));

app.put('/api/habits/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return bad(res, 'Habit not found.', 404);
  const { errors, data } = validate(req.body);
  if (errors.length) return bad(res, errors);
  const h = await Habit.findByIdAndUpdate(req.params.id, { ...data, $unset: data.timesPerWeek ? {} : { timesPerWeek: 1 } }, { new: true });
  if (!h) return bad(res, 'Habit not found.', 404);
  res.json(present(h, (await Completion.find({ habit: h._id })).map((c) => c.date)));
}));

app.delete('/api/habits/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return bad(res, 'Habit not found.', 404);
  const h = await Habit.findByIdAndUpdate(req.params.id, { archivedAt: new Date() });
  return h ? res.status(204).end() : bad(res, 'Habit not found.', 404);
}));

app.post('/api/habits/:id/restore', wrap(async (req, res) => {
  if (!validId(req.params.id)) return bad(res, 'Habit not found.', 404);
  const h = await Habit.findByIdAndUpdate(req.params.id, { $unset: { archivedAt: 1 } }, { new: true });
  if (!h) return bad(res, 'Habit not found.', 404);
  res.json(present(h, (await Completion.find({ habit: h._id })).map((c) => c.date)));
}));

app.delete('/api/habits/:id/permanent', wrap(async (req, res) => {
  if (!validId(req.params.id)) return bad(res, 'Habit not found.', 404);
  await Completion.deleteMany({ habit: req.params.id });
  await Habit.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));

async function activeHabit(id) { return validId(id) ? Habit.findOne({ _id: id, archivedAt: null }) : null; }

app.post('/api/completions', wrap(async (req, res) => {
  const { habitId, date } = req.body;
  const h = await activeHabit(habitId);
  if (!h) return bad(res, 'Habit not found.', 404);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return bad(res, 'Date must be YYYY-MM-DD.');
  const today = todayIn(h.timezone);
  if (date > today) return bad(res, 'You can\'t check off a future day.');
  if (date < addDays(today, -6)) return bad(res, 'You can only check off the last 7 days.');
  await Completion.updateOne({ habit: h._id, date }, { $setOnInsert: { habit: h._id, date } }, { upsert: true });
  res.status(201).json({ habitId, date });
}));

app.delete('/api/completions', wrap(async (req, res) => {
  const { habitId, date } = req.query;
  const h = await activeHabit(habitId);
  if (!h) return bad(res, 'Habit not found.', 404);
  if (date < addDays(todayIn(h.timezone), -6)) return bad(res, 'You can only change the last 7 days.');
  await Completion.deleteOne({ habit: h._id, date });
  res.status(204).end();
}));

app.get('/api/completions/habit/:id/heatmap', wrap(async (req, res) => {
  if (!validId(req.params.id)) return bad(res, 'Habit not found.', 404);
  const h = await Habit.findById(req.params.id);
  if (!h) return bad(res, 'Habit not found.', 404);
  const end = todayIn(h.timezone), start = addDays(end, -181);
  const rows = await Completion.find({ habit: h._id, date: { $gte: start, $lte: end } });
  res.json({ start, end, dates: rows.map((r) => r.date) });
}));

app.get('/api/stats', wrap(async (_req, res) => {
  const habits = await Habit.find({ archivedAt: null }).sort({ createdAt: 1 });
  const map = await datesByHabit(habits);
  res.json(habits.map((h) => {
    const all = map.get(String(h._id)) || [];
    const today = todayIn(h.timezone);
    const created = h.createdAt.toLocaleDateString('en-CA', { timeZone: h.timezone });
    const from = [addDays(today, -29), created].sort().pop();
    const inWindow = all.filter((d) => d >= from && d <= today);
    let days = 0, expected, done;
    for (let d = from; d <= today; d = addDays(d, 1)) { days++; }
    if (h.scheduleType === 'times_per_week') { expected = Math.ceil((h.timesPerWeek * days) / 7); done = inWindow.length; }
    else {
      expected = 0;
      for (let d = from; d <= today; d = addDays(d, 1)) if (isScheduled(h, d)) expected++;
      done = inWindow.filter((d) => isScheduled(h, d)).length;
    }
    return { _id: h._id, name: h.name, scheduleType: h.scheduleType, done, expected, total: all.length,
      rate: expected ? Math.min(100, Math.round((done / expected) * 100)) : 0 };
  }));
}));

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ errors: ['Something went wrong on the server.'] }); });

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
