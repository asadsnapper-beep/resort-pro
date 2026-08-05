/**
 * Formats a Date selected in the browser as a calendar date, not a UTC instant.
 * `toISOString()` moves midnight in Asia/Dhaka (and other positive UTC offsets)
 * to the previous day, which would make availability and booking requests wrong.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
