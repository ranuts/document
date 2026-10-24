/** A short "5 minutes ago", for the history list's timestamps. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((timestamp - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 5],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [name, size] of units) {
    unit = name;
    if (Math.abs(value) < size) break;
    value = Math.round(value / size);
  }
  try {
    return new Intl.RelativeTimeFormat(document.documentElement.lang || undefined, { numeric: 'auto' }).format(
      value,
      unit,
    );
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}
