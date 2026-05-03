import { formatDistanceToNow, addDays, isPast, isToday } from "date-fns";

/** Safely parse a YYYY-MM-DD date string as local time. Returns null if invalid. */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const ymd = dateStr.slice(0, 10).split("-");
  if (ymd.length !== 3) return null;
  const [y, m, d] = ymd.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Format a YYYY-MM-DD string to "Jun 14" style. Returns "" if invalid. */
export function formatShortDate(dateStr: string | null | undefined): string {
  const d = parseDateSafe(dateStr);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "Never";
  
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatUrgency(daysOverdue: number): string {
  if (daysOverdue > 0) {
    return `${daysOverdue} days overdue`;
  } else if (daysOverdue === 0) {
    return "Due today";
  } else {
    return `Due in ${Math.abs(daysOverdue)} days`;
  }
}
