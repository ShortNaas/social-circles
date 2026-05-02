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

export function getTierLabel(tier: string) {
  switch (tier) {
    case "core":
      return "Core (3w)";
    case "monthly":
      return "Monthly (2m)";
    case "yearly":
      return "Yearly (6m)";
    default:
      return tier;
  }
}
