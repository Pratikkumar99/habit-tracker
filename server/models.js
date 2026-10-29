import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  scheduleType: { type: String, enum: ['daily', 'weekdays', 'times_per_week'], required: true },
  weekdays: { type: [Number], default: [] },
  timesPerWeek: Number,
  timezone: { type: String, default: 'Asia/Kolkata' },
  archivedAt: Date,
}, { timestamps: true });

const completionSchema = new mongoose.Schema({
  habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
  date: { type: String, required: true },
}, { timestamps: true });
completionSchema.index({ habit: 1, date: 1 }, { unique: true });

export const Habit = mongoose.model('Habit', habitSchema);
export const Completion = mongoose.model('Completion', completionSchema);
