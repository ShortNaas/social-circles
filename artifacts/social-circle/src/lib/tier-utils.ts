export function getTierColor(tier: string) {
  switch (tier) {
    case "core":
      return "bg-primary/15 text-primary border-primary/20";
    case "monthly":
      return "bg-amber-500/15 text-amber-700 border-amber-500/20";
    case "yearly":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/20";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
}

export function defaultIntervalDays(tier: string): number {
  if (tier === "core") return 21;
  if (tier === "monthly") return 60;
  return 365;
}

export function intervalDaysToShortLabel(days: number): string {
  if (days === 7) return "1w";
  if (days === 14) return "2w";
  if (days === 21) return "3w";
  if (days === 30) return "1m";
  if (days === 60) return "2m";
  if (days === 90) return "3m";
  if (days === 120) return "4m";
  if (days === 150) return "5m";
  if (days === 183) return "6m";
  if (days === 365) return "1yr";
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}m`;
}

export function getTierLabel(tier: string, intervalDays?: number | null) {
  const days = intervalDays ?? defaultIntervalDays(tier);
  const freq = intervalDaysToShortLabel(days);
  switch (tier) {
    case "core":
      return `Core (${freq})`;
    case "monthly":
      return `Monthly (${freq})`;
    case "yearly":
      return `Yearly (${freq})`;
    default:
      return tier;
  }
}

export const TIER_INTERVALS: Record<string, { label: string; days: number }[]> = {
  core: [
    { label: "Every week", days: 7 },
    { label: "Every 2 weeks", days: 14 },
    { label: "Every 3 weeks", days: 21 },
  ],
  monthly: [
    { label: "Every month", days: 30 },
    { label: "Every 2 months", days: 60 },
    { label: "Every 3 months", days: 90 },
    { label: "Every 4 months", days: 120 },
    { label: "Every 5 months", days: 150 },
  ],
  yearly: [
    { label: "Every 6 months", days: 183 },
    { label: "Every year", days: 365 },
  ],
};
