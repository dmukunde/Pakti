// Calendar maths for Pakti. Dates are plain ISO strings (YYYY-MM-DD), which is
// how Postgres `date` columns arrive. Weeks run Monday to Sunday and are keyed
// by their Monday (week_start); quarters by their first day (quarter_start).

export type IsoDate = string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: IsoDate): Date {
  if (!ISO.test(date)) throw new Error(`Not an ISO date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** The member's local calendar date for an instant, in their IANA timezone. */
export function localDate(timezone: string, at: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Monday of the week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  const d = toUtc(date);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1 .. Sun=7
  return addDays(date, 1 - isoDay);
}

/** Sunday of the week starting on `start`. */
export function weekEnd(start: IsoDate): IsoDate {
  return addDays(start, 6);
}

export function isWeekStart(date: IsoDate): boolean {
  return weekStart(date) === date;
}

export function isInWeek(date: IsoDate, start: IsoDate): boolean {
  return date >= start && date <= weekEnd(start);
}

/** First day of the calendar quarter containing `date`. */
export function quarterStart(date: IsoDate): IsoDate {
  const d = toUtc(date);
  const month = Math.floor(d.getUTCMonth() / 3) * 3;
  return fromUtc(new Date(Date.UTC(d.getUTCFullYear(), month, 1)));
}

/** Last day of the quarter starting on `start`. */
export function quarterEnd(start: IsoDate): IsoDate {
  const d = toUtc(start);
  return fromUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 0)));
}

export function isQuarterStart(date: IsoDate): boolean {
  return quarterStart(date) === date;
}

/** "Q1 2027" */
export function quarterLabel(start: IsoDate): string {
  const d = toUtc(start);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
