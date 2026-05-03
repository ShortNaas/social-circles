import { useState } from "react";
import { format } from "date-fns";
import {
  Phone, Mail, Coffee, MessageSquare, Video, MoreHorizontal, Plus, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useListInteractions, useCreateInteraction, useDeleteInteraction,
  getListInteractionsQueryKey,
} from "@workspace/api-client-react";
import type { CreateInteractionBodyType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  call:       { label: "Phone call",   icon: Phone,         color: "text-blue-500" },
  email:      { label: "Email",        icon: Mail,          color: "text-amber-500" },
  coffee:     { label: "Coffee / met", icon: Coffee,        color: "text-orange-500" },
  message:    { label: "Message",      icon: MessageSquare, color: "text-green-500" },
  video_call: { label: "Video call",   icon: Video,         color: "text-purple-500" },
  other:      { label: "Other",        icon: MoreHorizontal,color: "text-muted-foreground" },
};

interface InteractionLogProps {
  contactId: number;
}

export function InteractionLog({ contactId }: InteractionLogProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newType, setNewType] = useState<CreateInteractionBodyType>("other");
  const [newNotes, setNewNotes] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: interactions, isLoading } = useListInteractions(contactId, {
    query: { queryKey: getListInteractionsQueryKey(contactId) },
  });

  const createMutation = useCreateInteraction();
  const deleteMutation = useDeleteInteraction();

  const handleAdd = () => {
    createMutation.mutate(
      { id: contactId, data: { date: newDate, type: newType, notes: newNotes.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInteractionsQueryKey(contactId) });
          toast({ title: "Interaction logged" });
          setAddOpen(false);
          setNewNotes("");
          setNewDate(format(new Date(), "yyyy-MM-dd"));
          setNewType("other");
        },
      }
    );
  };

  const handleDelete = (interactionId: number) => {
    deleteMutation.mutate(
      { id: contactId, interactionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInteractionsQueryKey(contactId) });
          toast({ title: "Interaction removed" });
        },
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Log interaction
        </Button>
      </div>

      {!interactions || interactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm max-w-xs">
            No interactions logged yet. Use "Mark Reached Out" or log one manually.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
          <div className="space-y-5">
            {interactions.map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.other;
              const Icon = meta.icon;
              return (
                <div key={item.id} className="flex gap-4 relative group">
                  <div className="mt-1 shrink-0 w-3.5 h-3.5 rounded-full bg-card border-2 border-border z-10 flex items-center justify-center" />
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.date), "MMM d, yyyy")}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        aria-label="Delete interaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Log an Interaction</DialogTitle>
            <DialogDescription>Record how and when you connected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as CreateInteractionBodyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([val, { label }]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="What did you talk about? Anything worth remembering?"
                className="min-h-[90px] resize-none"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
