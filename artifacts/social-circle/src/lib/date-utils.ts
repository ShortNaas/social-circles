import { formatDistanceToNow, addDays, isPast, isToday } from "date-fns";

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
