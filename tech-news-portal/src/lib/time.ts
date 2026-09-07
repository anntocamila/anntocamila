const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function timeAgo(isoDate: string): string {
  const seconds = Math.round((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "ahora";

  for (const [unit, secondsInUnit] of UNITS) {
    if (seconds >= secondsInUnit) {
      const value = Math.floor(seconds / secondsInUnit);
      return rtf.format(-value, unit);
    }
  }
  return "ahora";
}
