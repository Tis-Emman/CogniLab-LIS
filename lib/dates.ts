/**
 * Calendar date (YYYY-MM-DD) in Philippine time.
 * `toISOString()` gives the UTC date, which is the PREVIOUS day for anything
 * recorded between 12:00 AM and 7:59 AM in the Philippines.
 */
export const toPHDate = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
