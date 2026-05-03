import { useState } from "react";
import { useGetCalendarToken, getGetCalendarTokenQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Copy, Check, RefreshCw } from "lucide-react";

interface CalendarSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CalendarApp = "google" | "apple" | "outlook" | "proton" | "other";

const CALENDARS: { id: CalendarApp; label: string }[] = [
  { id: "google",  label: "Google"  },
  { id: "apple",   label: "Apple"   },
  { id: "outlook", label: "Outlook" },
  { id: "proton",  label: "Proton"  },
  { id: "other",   label: "Other"   },
];

const STEPS: Record<CalendarApp, { title: string; body: string }[]> = {
  google: [
    {
      title: "Open Google Calendar on the web",
      body: 'Go to calendar.google.com. In the left sidebar, click the "+" next to "Other calendars" and choose "From URL".',
    },
    {
      title: "Paste your feed URL",
      body: 'Copy the URL above and paste it into the "URL of calendar" field. Click "Add calendar".',
    },
    {
      title: "Done — it syncs automatically",
      body: "Google Calendar checks for updates roughly every 12–24 hours. Your follow-up reminders will appear on your calendar.",
    },
  ],
  apple: [
    {
      title: "Open Calendar on Mac or go to iCloud.com",
      body: 'On Mac: open the Calendar app and choose File → New Calendar Subscription. On iCloud.com: click the share icon next to a calendar and choose "Add ICS".',
    },
    {
      title: "Paste your feed URL",
      body: 'Paste the URL above into the subscription field. Give it a name like "Social Circle" and pick a refresh interval (daily recommended).',
    },
    {
      title: "Done — it syncs automatically",
      body: "The calendar will refresh on the interval you chose. On iPhone/iPad, enable the subscription under Settings → Calendar → Accounts.",
    },
  ],
  outlook: [
    {
      title: "Open Outlook Calendar on the web",
      body: 'Go to outlook.com or outlook.office.com. In the left panel, click "Add calendar" → "Subscribe from web".',
    },
    {
      title: "Paste your feed URL",
      body: 'Copy the URL above, paste it into the "Link to the calendar" field. Give it a name, then click Import.',
    },
    {
      title: "Done — it syncs automatically",
      body: "Outlook checks for updates every few hours. Your Social Circle follow-up dates will show as calendar events.",
    },
  ],
  proton: [
    {
      title: "Open Proton Calendar",
      body: 'Go to calendar.proton.me and click the "+" icon next to "Other calendars" in the left sidebar.',
    },
    {
      title: 'Select "Add calendar from URL"',
      body: 'Choose "Add calendar from URL" (or "Subscribe to calendar" depending on your version).',
    },
    {
      title: "Paste your feed URL",
      body: 'Copy the URL above and paste it into the field. Give it a name like "Social Circle" and click Save.',
    },
    {
      title: "Done — it auto-refreshes",
      body: "Proton Calendar fetches your reminders once a day. Whenever you mark a contact as reached out, the dates update automatically.",
    },
  ],
  other: [
    {
      title: "Find the ICS / calendar subscription option",
      body: 'Look for settings labelled "Subscribe", "Add from URL", "ICS feed", or "CalDAV". Most calendar apps support this.',
    },
    {
      title: "Paste your feed URL",
      body: "Copy the URL above and paste it into the subscription field. Set the refresh interval to daily if asked.",
    },
    {
      title: "Done — it syncs automatically",
      body: "The app will periodically fetch updated follow-up dates from your Social Circle feed.",
    },
  ],
};

export function CalendarSyncDialog({ open, onOpenChange }: CalendarSyncDialogProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<CalendarApp>("google");

  const { data, isLoading, isError, refetch, isFetching } = useGetCalendarToken({
    query: { queryKey: getGetCalendarTokenQueryKey(), enabled: open, staleTime: Infinity },
  });

  const handleCopy = () => {
    if (!data?.feedUrl) return;
    navigator.clipboard.writeText(data.feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const steps = STEPS[activeTab];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendar Subscription
          </DialogTitle>
          <DialogDescription>
            Subscribe to your Social Circle reminders in any calendar app that supports ICS feeds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Feed URL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your personal feed URL</p>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border">
                Updates daily
              </Badge>
            </div>

            {isLoading || isFetching ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : isError ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive">Failed to load feed URL.</p>
                <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={data?.feedUrl ?? ""}
                  className="font-mono text-xs bg-muted/50 border-border/70 text-muted-foreground"
                  data-testid="calendar-feed-url"
                />
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="shrink-0 gap-2 border-border/80"
                  data-testid="copy-feed-url"
                >
                  {copied ? (
                    <><Check className="h-4 w-4 text-primary" /> Copied</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Copy</>
                  )}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Keep this URL private — it gives read access to all your follow-up dates.
            </p>
          </div>

          {/* Calendar tabs */}
          <div className="border-t border-border/60 pt-4">
            <p className="text-sm font-medium mb-3">How to add to your calendar</p>

            {/* Tab bar */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {CALENDARS.map((cal) => (
                <button
                  key={cal.id}
                  onClick={() => setActiveTab(cal.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    activeTab === cal.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {cal.label}
                </button>
              ))}
            </div>

            {/* Steps */}
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-snug">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
