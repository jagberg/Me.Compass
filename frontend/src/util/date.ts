/**
 * Today's date as a local `YYYY-MM-DD`. `toISOString()` is UTC, so before ~10-11:00 in Sydney it
 * reads yesterday, making a due-today action look future and a yesterday action not overdue. Shift
 * by the local timezone offset before slicing so badges and ordering match the user's calendar day.
 */
export function localTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
