import { useCallback, useEffect, useState } from "react";

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body.errors || ["Request failed."]).join(" "));
  return body;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayOf = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const addDays = (d, n) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const scheduleLabel = (h) =>
  h.scheduleType === "daily"
    ? "Every day"
    : h.scheduleType === "weekdays"
      ? h.weekdays.map((n) => DAYS[n]).join(", ")
      : `${h.timesPerWeek}× per week`;
const zones =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "UTC"];

function HabitForm({ habit, onSaved, onCancel }) {
  const [f, setF] = useState(
    habit || {
      name: "",
      scheduleType: "daily",
      weekdays: [1, 2, 3, 4, 5],
      timesPerWeek: 3,
      timezone: "Asia/Kolkata",
    },
  );
  const [error, setError] = useState("");
  const set = (patch) => setF({ ...f, ...patch });
  const toggleDay = (n) =>
    set({
      weekdays: f.weekdays.includes(n)
        ? f.weekdays.filter((x) => x !== n)
        : [...f.weekdays, n],
    });
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api(habit ? `/api/habits/${habit._id}` : "/api/habits", {
        method: habit ? "PUT" : "POST",
        body: JSON.stringify(f),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>{habit ? "Edit habit" : "New habit"}</h2>
      <label>
        Habit name
        <input
          value={f.name}
          maxLength={80}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Read 30 minutes"
        />
      </label>
      <label>
        Schedule
        <select
          value={f.scheduleType}
          onChange={(e) => set({ scheduleType: e.target.value })}
        >
          <option value="daily">Every day</option>
          <option value="weekdays">Specific weekdays</option>
          <option value="times_per_week">Times per week</option>
        </select>
      </label>
      {f.scheduleType === "weekdays" && (
        <div className="chips" role="group" aria-label="Weekdays">
          {DAYS.map((d, n) => (
            <button
              type="button"
              key={d}
              className={f.weekdays.includes(n) ? "chip on" : "chip"}
              aria-pressed={f.weekdays.includes(n)}
              onClick={() => toggleDay(n)}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {f.scheduleType === "times_per_week" && (
        <label>
          Times per week
          <input
            type="number"
            min="1"
            max="7"
            value={f.timesPerWeek}
            onChange={(e) => set({ timesPerWeek: e.target.value })}
          />
        </label>
      )}
      <label>
        Timezone
        <input
          list="timezones"
          value={f.timezone}
          onChange={(e) => set({ timezone: e.target.value })}
          onFocus={(e) => e.target.select()}
          placeholder="Search, e.g. Kolkata or New_York"
          autoComplete="off"
        />
        <datalist id="timezones">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="primary">
          {habit ? "Update habit" : "Create habit"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Heatmap({ habitId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/api/completions/habit/${habitId}/heatmap`)
      .then(setData)
      .catch(() => setData({ dates: [], start: "", end: "" }));
  }, [habitId]);
  if (!data) return <p className="sub">Loading heatmap…</p>;
  if (!data.start) return <p className="error">Couldn't load the heatmap.</p>;
  const done = new Set(data.dates);
  const cells = [];
  for (
    let d = addDays(data.start, -((dayOf(data.start) + 6) % 7));
    d <= data.end;
    d = addDays(d, 1)
  )
    cells.push(
      <span
        key={d}
        title={d}
        className={
          done.has(d) ? "cell on" : d < data.start ? "cell pad" : "cell"
        }
      />,
    );
  return (
    <div className="heat" aria-label="Completions in the last 6 months">
      {cells}
    </div>
  );
}

function HabitCard({ habit: h, reload, onEdit, setError }) {
  const [heat, setHeat] = useState(false);
  const run = async (fn) => {
    try {
      setError("");
      await fn();
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const toggle = (date, done) =>
    run(() =>
      done
        ? api(`/api/completions?habitId=${h._id}&date=${date}`, {
            method: "DELETE",
          })
        : api("/api/completions", {
            method: "POST",
            body: JSON.stringify({ habitId: h._id, date }),
          }),
    );
  const archive = () =>
    confirm(`Archive "${h.name}"? Your history is kept.`) &&
    run(() => api(`/api/habits/${h._id}`, { method: "DELETE" }));
  return (
    <li className={h.doneToday ? "card done" : "card"}>
      <div className="top">
        <div>
          <h3>{h.name}</h3>
          <p className="sub">
            {scheduleLabel(h)}
            {h.scheduleType === "times_per_week" &&
              ` · ${h.weekCount}/${h.timesPerWeek} this week`}
          </p>
        </div>
        <div className="streaks">
          <span className="streak" title="Current streak">
            {h.streak.current}
            <small>
              {" "}
              {h.streak.unit}
              {h.streak.current === 1 ? "" : "s"}
            </small>
          </span>
          <span className="best">best {h.streak.best}</span>
        </div>
      </div>
      <div className="week">
        {h.recent.map((r) => (
          <button
            key={r.date}
            className={`day ${r.done ? "on" : ""} ${r.scheduled ? "" : "off"}`}
            onClick={() => toggle(r.date, r.done)}
            aria-pressed={r.done}
            aria-label={`${r.date}: ${r.done ? "completed, click to undo" : "not completed, click to complete"}`}
          >
            <small>{DAYS[dayOf(r.date)][0]}</small>
            {r.done ? "✓" : ""}
          </button>
        ))}
      </div>
      <div className="row">
        <button
          className="primary"
          onClick={() => toggle(h.today, h.doneToday)}
        >
          {h.doneToday ? "Uncheck today" : "Check off today"}
        </button>
        <button className="ghost" onClick={() => setHeat(!heat)}>
          {heat ? "Hide heatmap" : "View heatmap"}
        </button>
        <button className="ghost" onClick={() => onEdit(h)}>
          Edit
        </button>
        <button className="ghost" onClick={archive}>
          Archive
        </button>
      </div>
      {heat && <Heatmap habitId={h._id} />}
    </li>
  );
}

function Stats() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api("/api/stats")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <p className="sub">Loading…</p>;
  if (!rows.length)
    return (
      <p className="sub">No habits yet. Create one to see your 30-day stats.</p>
    );
  return (
    <ul className="list">
      {rows.map((r) => (
        <li key={r._id} className="card">
          <div className="top">
            <h3>{r.name}</h3>
            <span className="streak">{r.rate}%</span>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-valuenow={r.rate}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span style={{ width: `${r.rate}%` }} />
          </div>
          <p className="sub">
            {r.done} of {r.expected} in the last 30 days · {r.total} total
            completions · {r.scheduleType.replace(/_/g, " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Archived({ setError }) {
  const [habits, setHabits] = useState(null);
  const load = useCallback(
    () =>
      api("/api/habits?archived=true")
        .then(setHabits)
        .catch((e) => setError(e.message)),
    [setError],
  );
  useEffect(() => {
    load();
  }, [load]);
  const act = async (fn) => {
    try {
      setError("");
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  if (!habits) return <p className="sub">Loading…</p>;
  if (!habits.length)
    return (
      <p className="sub">
        Nothing archived. Archived habits keep their history and show up here.
      </p>
    );
  return (
    <ul className="list">
      {habits.map((h) => (
        <li key={h._id} className="card">
          <div className="top">
            <div>
              <h3>{h.name}</h3>
              <p className="sub">
                {scheduleLabel(h)} · best {h.streak.best} {h.streak.unit}s
              </p>
            </div>
          </div>
          <div className="row">
            <button
              className="primary"
              onClick={() =>
                act(() =>
                  api(`/api/habits/${h._id}/restore`, { method: "POST" }),
                )
              }
            >
              Restore
            </button>
            <button
              className="danger"
              onClick={() =>
                confirm(
                  `Permanently delete "${h.name}" and all its history? This can't be undone.`,
                ) &&
                act(() =>
                  api(`/api/habits/${h._id}/permanent`, { method: "DELETE" }),
                )
              }
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [view, setView] = useState("habits");
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | habit
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setHabits(await api("/api/habits"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const go = (v) => {
    setView(v);
    setError("");
    setEditing(null);
    if (v === "habits") load();
  };
  const done = habits.filter((h) => h.doneToday).length;

  return (
    <main>
      <header>
        <h1>
          {view === "habits"
            ? "Today"
            : view === "stats"
              ? "Stats"
              : "Archived"}
        </h1>
        {view === "habits" && habits.length > 0 && (
          <p className="sub">
            {done} of {habits.length} done today
          </p>
        )}
        <nav>
          {["habits", "stats", "archived"].map((v) => (
            <button
              key={v}
              className={view === v ? "tab on" : "tab"}
              onClick={() => go(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view === "habits" &&
        (editing ? (
          <HabitForm
            habit={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        ) : (
          <>
            <button className="primary add" onClick={() => setEditing("new")}>
              New habit
            </button>
            {loading && <p className="sub">Loading…</p>}
            {!loading && !habits.length && (
              <p className="sub">
                No habits yet. Create one to start your first streak.
              </p>
            )}
            <ul className="list">
              {habits.map((h) => (
                <HabitCard
                  key={h._id}
                  habit={h}
                  reload={load}
                  onEdit={setEditing}
                  setError={setError}
                />
              ))}
            </ul>
          </>
        ))}
      {view === "stats" && <Stats />}
      {view === "archived" && <Archived setError={setError} />}
    </main>
  );
}
