# MERN Habit Tracker with Streaks

MongoDB + Express + React + Node.

## Run
1. Start MongoDB (local or Atlas).
2. Backend: `cd server && cp .env.example .env && npm install && npm run seed && npm run dev`  -> http://localhost:5000
3. Frontend: `cd client && npm install && npm run dev` -> http://localhost:5173
4. Tests: `cd server && npm test`

## Features
- Schedules: every day, specific weekdays, N times per week
- Check off today, or backfill any of the last 7 days
- Current + best streak that respect the schedule (Mon/Wed/Fri habits aren't broken on Tuesday).
  Times-per-week habits count consecutive weeks (Mon-Sun) that hit the target.
- 6-month heatmap, 30-day stats page
- Edit, archive, restore, permanent delete
- Per-habit timezone (default Asia/Kolkata), server-side validation

## API
GET /api/habits[?archived=true] | POST /api/habits | PUT /api/habits/:id | DELETE /api/habits/:id (archive)
POST /api/habits/:id/restore | DELETE /api/habits/:id/permanent
POST /api/completions {habitId,date} | DELETE /api/completions?habitId=&date=
GET /api/completions/habit/:id/heatmap | GET /api/stats
