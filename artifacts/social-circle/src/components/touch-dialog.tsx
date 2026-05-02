import { useState } from "react";
import {
  useTouchContact,
  useUpdateContact,
  getGetDueContactsQueryKey,
  getGetContactStatsQueryKey,
  getListContactsQueryKey,
  getGetContactQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TouchDialogProps {
  contactId: number;
  contactName: string;
  existingNotes: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TouchDialog({
  contactId,
  contactName,
  existingNotes,
  open,
  onOpenChange,
  onSuccess,
}: TouchDialogProps) {
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const touchMutation = useTouchContact();
  const updateMutation = useUpdateContact();

  const isPending = touchMutation.isPending || updateMutation.isPending;

  const handleConfirm = () => {
    touchMutation.mutate(
      { id: contactId },
      {
        onSuccess: (updatedContact) => {
          const trimmed = note.trim();

          const finish = () => {
            queryClient.setQueryData(getGetContactQueryKey(contactId), updatedContact);
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
            toast({
              title: "Connection noted",
              description: trimmed
                ? `Reached out to ${contactName} and added a note.`
                : `Marked as reached out to ${contactName}.`,
            });
            setNote("");
            onOpenChange(false);
            onSuccess?.();
          };

          if (!trimmed) {
            finish();
            return;
          }

          const today = new Date().toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const entry = `[${today}] ${trimmed}`;
          const newNotes = existingNotes
            ? `${entry}\n\n${existingNotes}`
            : entry;

          updateMutation.mutate(
            { id: contactId, data: { notes: newNotes } },
            {
              onSuccess: (finalContact) => {
                queryClient.setQueryData(getGetContactQueryKey(contactId), finalContact);
                finish();
              },
              onError: () => {
                // Still mark as touched, just skip note
                finish();
              },
            }
          );
        },
      }
    );
  };

  const handleCancel = () => {
    if (isPending) return;
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" data-testid="touch-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Reached out to {contactName}
          </DialogTitle>
          <DialogDescription>
            Add a quick note about this interaction — what you talked about, how they're doing, anything worth remembering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="touch-note" className="text-sm font-medium text-foreground">
            Note <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="touch-note"
            placeholder="e.g. Caught up over coffee. They're moving to Austin next month."
            className="min-h-[110px] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            autoFocus
            data-testid="touch-note-input"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isPending}
            data-testid="touch-dialog-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-2"
            data-testid="touch-dialog-confirm"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {note.trim() ? "Save & Mark Reached Out" : "Mark Reached Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
