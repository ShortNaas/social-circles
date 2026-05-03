import { useState } from "react";
import { useGetCalendarToken } from "@workspace/api-client-react";
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
import { CalendarDays, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";

interface CalendarSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    num: 1,
    title: "Open Proton Calendar",
    body: 'Go to calendar.proton.me and click the "+" icon next to "Other calendars" in the left sidebar.',
  },
  {
    num: 2,
    title: 'Select "Add calendar from URL"',
    body: 'Choose "Add calendar from URL" (or "Subscribe to calendar" depending on your version).',
  },
  {
    num: 3,
    title: "Paste the subscription URL below",
    body: 'Copy the URL above and paste it into the field. Give it a name like "Social Circle".',
  },
  {
    num: 4,
    title: "Done — it auto-refreshes",
    body: "Proton Calendar will fetch your reminders once a day. Whenever you mark a contact as reached out, the dates update automatically.",
  },
];

export function CalendarSyncDialog({ open, onOpenChange }: CalendarSyncDialogProps) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useGetCalendarToken({
    query: { enabled: open, staleTime: Infinity, queryKey: ["calendar-token"] as const },
  });

  const handleCopy = () => {
    if (!data?.feedUrl) return;
    navigator.clipboard.writeText(data.feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendar Subscription
          </DialogTitle>
          <DialogDescription>
            Subscribe to your Social Circle reminders in Proton Calendar, Apple Calendar, Google Calendar, or any app that supports ICS feeds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
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

          <div className="border-t border-border/60 pt-4">
            <p className="text-sm font-medium mb-3">How to add to Proton Calendar</p>
            <ol className="space-y-3">
              {STEPS.map((step) => (
                <li key={step.num} className="flex gap-3">
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {step.num}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-snug">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Works with Apple Calendar, Outlook, Thunderbird, and any CalDAV-compatible app too.
            </p>
            <a
              href="https://proton.me/support/calendar-subscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Proton help <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
