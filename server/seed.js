import 'dotenv/config';
import mongoose from 'mongoose';
import { Habit, Completion } from './models.js';
import { todayIn, addDays, weekday } from './lib/dates.js';

const TZ = 'Asia/Kolkata';
const today = todayIn(TZ);
const back = (n) => Array.from({ length: n }, (_, i) => addDays(today, -i));
const last14 = back(14);

const seeds = [
  { h: { name: 'Morning Exercise', scheduleType: 'daily' }, dates: last14 },
  { h: { name: 'Read for 30 minutes', scheduleType: 'weekdays', weekdays: [1, 2, 3, 4, 5] }, dates: last14.filter((d) => [1, 2, 3, 4, 5].includes(weekday(d))) },
  { h: { name: 'Meditation', scheduleType: 'times_per_week', timesPerWeek: 3 }, dates: last14.filter((d) => [1, 3, 5].includes(weekday(d))) },
  { h: { name: 'Drink 8 glasses of water', scheduleType: 'daily' }, dates: back(7) },
  { h: { name: 'Weekly Review', scheduleType: 'weekdays', weekdays: [0] }, dates: back(21).filter((d) => weekday(d) === 0) },
];

await mongoose.connect(process.env.MONGO_URI);
await Completion.deleteMany({}); await Habit.deleteMany({});
for (const { h, dates } of seeds) {
  const habit = await Habit.create({ timezone: TZ, ...h });
  await Completion.insertMany(dates.map((date) => ({ habit: habit._id, date })));
}
console.log(`Seeded ${seeds.length} habits.`);
await mongoose.disconnect();
