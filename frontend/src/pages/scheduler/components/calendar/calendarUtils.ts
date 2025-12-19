// frontend/src/pages/scheduler/components/calendar/calendarUtils.ts

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function getWeekdayMondayFirst(d: Date) {
  const js = d.getDay(); // 0 Sun .. 6 Sat
  return js === 0 ? 6 : js - 1;
}

export function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatMonthTitle(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function buildMonthGrid(monthCursor: Date) {
  const start = startOfMonth(monthCursor);
  const leading = getWeekdayMondayFirst(start);

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  const firstCellDate = new Date(start);
  firstCellDate.setDate(start.getDate() - leading);

  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCellDate);
    d.setDate(firstCellDate.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === monthCursor.getMonth(),
    });
  }

  return { cells };
}
