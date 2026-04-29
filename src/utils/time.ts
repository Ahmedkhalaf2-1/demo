/**
 * Unified Time Utility — single source of truth for all date/time operations.
 *
 * CRITICAL: All date-based filtering must use getLocalDateKey(), never
 * new Date().toISOString().split('T')[0] which returns UTC and breaks
 * for users in UTC+ timezones after midnight.
 */

/**
 * Returns current timestamp in milliseconds.
 * Use this instead of Date.now() so it's mockable in tests.
 */
export function getNowTimestamp(): number {
  return Date.now();
}

/**
 * Returns current ISO timestamp string (for storage / audit logs).
 * Example: "2024-04-27T01:15:00.000Z"
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Returns today's date key in LOCAL timezone as YYYY-MM-DD.
 *
 * WHY NOT toISOString(): toISOString() returns UTC. In UTC+3, at 01:00 AM
 * local time it is still 22:00 the PREVIOUS UTC day — sales would be
 * attributed to yesterday. This function uses local time correctly.
 */
export function getLocalDateKey(date?: Date | number | string): string {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the local dateKey for N days ago.
 * @param daysAgo — 0 = today, 1 = yesterday, …
 */
export function getDateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalDateKey(d);
}

/**
 * Detects whether the calendar day has changed between two dateKeys.
 * Used by the midnight-transition watcher.
 */
export function isNewDay(previousKey: string, currentKey: string): boolean {
  return previousKey !== currentKey;
}

/**
 * Normalize any date input (ISO string, timestamp, Date) → local dateKey.
 * Safe to call on existing ISO-string `createdAt` fields from IndexedDB.
 *
 * NOTE: If the stored value is an ISO string like "2024-04-27T22:00:00.000Z"
 * and the user is in UTC+3, this correctly resolves to "2024-04-28"
 * (the local date the sale actually happened).
 */
export function normalizeDateKey(dateInput: string | number | Date): string {
  return getLocalDateKey(new Date(dateInput));
}

/**
 * Build the full timestamp metadata for a new financial record.
 * Call this once at creation time; store the result alongside the record.
 */
export function buildTimestamps(): { createdAt: string; dateKey: string } {
  return {
    createdAt: getNowISO(),   // full ISO for audit / debugging
    dateKey:   getLocalDateKey(),  // local YYYY-MM-DD for all filtering
  };
}
