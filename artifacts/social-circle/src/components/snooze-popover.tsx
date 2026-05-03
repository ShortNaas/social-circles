import { useState } from "react";
import { useUpdateContact, getListContactsQueryKey, getGetDueContactsQueryKey, getGetContactStatsQueryKey, getGetContactQueryKey } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { BellOff, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SnoozePopoverProps {
  contactId: number;
  contactName: string;
  snoozedUntil?: string | null;
}

const QUICK_OPTIONS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SnoozePopover({ contactId, contactName, snoozedUntil }: SnoozePopoverProps) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateContact();

  const isPending = updateMutation.isPending;
  const isCurrentlySnoozed = snoozedUntil && snoozedUntil >= new Date().toISOString().slice(0, 10);

  function snoozeUntil(nextContactDate: string, label: string) {
    updateMutation.mutate(
      { id: contactId, data: { nextContactDate, snoozedUntil: nextContactDate } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContactQueryKey(contactId), updated);
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
          toast({
            title: "Snoozed",
            description: `${contactName} moved to ${label}.`,
          });
          setOpen(false);
          setCustomDate("");
        },
        onError: () => {
          toast({
            title: "Snooze failed",
            description: "Could not update the contact. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleUnsnooze() {
    updateMutation.mutate(
      { id: contactId, data: { snoozedUntil: null } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContactQueryKey(contactId), updated);
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
          toast({ title: "Snooze cleared", description: `${contactName} is back in your circle.` });
          setOpen(false);
        },
      }
    );
  }

  function handleCustomDate() {
    if (!customDate) return;
    const d = new Date(customDate);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    snoozeUntil(customDate, label);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${isCurrentlySnoozed ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
          aria-label={`Snooze ${contactName}`}
          data-testid={`snooze-contact-${contactId}`}
        >
          <BellOff className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        {isCurrentlySnoozed && (
          <div className="mb-2.5 pb-2.5 border-b border-border">
            <p className="text-xs text-amber-600 font-medium mb-1.5">
              Snoozed until {new Date(snoozedUntil! + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleUnsnooze}
              disabled={isPending}
            >
              Clear snooze
            </Button>
          </div>
        )}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
          Snooze until…
        </p>
        <div className="flex flex-col gap-1.5">
          {QUICK_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              variant="ghost"
              size="sm"
              className="justify-start h-8 text-sm font-normal"
              disabled={isPending}
              onClick={() => snoozeUntil(addDays(opt.days), opt.label)}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="border-t border-border my-2.5" />

        <p className="text-xs text-muted-foreground mb-1.5">Custom date</p>
        <div className="flex gap-1.5">
          <input
            type="date"
            min={today}
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 text-sm rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <Button
            size="sm"
            onClick={handleCustomDate}
            disabled={!customDate || isPending}
            className="px-3 h-8"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
