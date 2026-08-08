// Weekday convention matches JS Date.getDay(): 0=Sunday..6=Saturday.
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<WeekdayIndex, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export const WEEKDAY_ORDER: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];

// The user's standing "normal training week" -- which weekdays they
// typically train, absent any one-off exception. A plain array of weekday
// indices (order/duplicates don't matter, checked via `includes`).
export type NormalTrainingWeek = number[];

// Every day except Sunday, matching this app's own stated default.
export const DEFAULT_NORMAL_TRAINING_WEEK: NormalTrainingWeek = [1, 2, 3, 4, 5, 6];

// A one-off date-range override (holiday, travel, injury, etc.) that marks
// those dates unavailable regardless of the normal training week pattern.
// Dates are inclusive "YYYY-MM-DD" strings, compared lexically (safe since
// that format sorts identically to chronological order).
export type ScheduleException = {
  id: string;
  startDate: string;
  endDate: string;
  note: string;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DayAvailability = {
  date: string;
  weekday: WeekdayIndex;
  available: boolean;
  reason: string;
};

// Resolves the concrete 7-day (Mon-Sun) availability for one week, starting
// at `weekStart` (expected to already be a Monday, e.g. from
// lib/workoutStats.ts's startOfWeek), by combining the standing weekly
// pattern with any schedule exceptions overlapping that day.
export function resolveWeekAvailability(
  weekStart: Date,
  normalWeek: NormalTrainingWeek,
  exceptions: ScheduleException[]
): DayAvailability[] {
  const days: DayAvailability[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const dateKey = toDateKey(d);
    const weekday = d.getDay() as WeekdayIndex;

    const exception = exceptions.find((e) => dateKey >= e.startDate && dateKey <= e.endDate);
    if (exception) {
      days.push({ date: dateKey, weekday, available: false, reason: exception.note || "Marked unavailable" });
      continue;
    }

    const normallyTrains = normalWeek.includes(weekday);
    days.push({
      date: dateKey,
      weekday,
      available: normallyTrains,
      reason: normallyTrains ? "Normal training day" : "Normally a rest day",
    });
  }

  return days;
}
