/** Returns a Date representing `milliseconds` ms in the past. */
export function msAgo(milliseconds: number): Date {
  return new Date(Date.now() - milliseconds);
}

/** Returns a Date representing `hours` hours ago. */
export function hoursAgo(hours: number): Date {
  return msAgo(hours * 3_600_000);
}

/** Returns a Date representing `days` days ago. */
export function daysAgo(days: number): Date {
  return msAgo(days * 86_400_000);
}

/** Returns a Date set to midnight (00:00:00.000) of the current day in local time. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a Date set to the start of the current calendar hour (minutes/seconds zeroed). */
export function startOfCurrentHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}

/** Returns a Date set to the start of the previous calendar hour. */
export function startOfPreviousHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() - 1, 0, 0, 0);
  return d;
}
