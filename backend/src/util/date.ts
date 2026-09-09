/**
 * Today's date as a local `YYYY-MM-DD`. `toISOString()` is UTC, so before ~10-11:00 in
 * Sydney it still reads yesterday, mis-bucketing due-today/overdue actions. Shift by the
 * local timezone offset before slicing so due-state matches the user's calendar day.
 */
export function localTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
