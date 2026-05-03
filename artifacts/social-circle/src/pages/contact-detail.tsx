import { useState, useRef, useEffect, Fragment } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetContact,
  useUpdateContact,
  useDeleteContact,
  useArchiveContact,
  useUnarchiveContact,
  getGetContactQueryKey,
  getListContactsQueryKey,
  getGetContactStatsQueryKey,
  getGetDueContactsQueryKey,
  UpdateContactBodyTier,
} from "@workspace/api-client-react";
import { TouchDialog } from "@/components/touch-dialog";
import { SnoozePopover } from "@/components/snooze-popover";
import { InteractionLog } from "@/components/interaction-log";
import { TagEditor } from "@/components/tag-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, Clock, CalendarDays, Loader2, Save, Download,
  User, Trash2, Flame, Archive, ArchiveRestore, MessageSquare, Tag,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/date-utils";
import { getTierColor, getTierLabel, TIER_INTERVALS, defaultIntervalDays } from "@/lib/tier-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContactDetail() {
  const { id: idStr } = useParams();
  const id = parseInt(idStr || "0", 10);
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRelation, setEditRelation] = useState("");
  const [touchDialogOpen, setTouchDialogOpen] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [bdayValue, setBdayValue] = useState("");
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);

  const { data: contact, isLoading, error } = useGetContact(id, {
    query: { enabled: !!id, queryKey: getGetContactQueryKey(id) },
  });

  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();
  const archiveMutation = useArchiveContact();
  const unarchiveMutation = useUnarchiveContact();

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (contact && initializedForId.current !== id) {
      initializedForId.current = id;
      setNotes(contact.notes || "");
      setEditName(contact.name);
      setEditRelation(contact.relationshipType);
      setBdayValue(contact.birthday ?? "");
      setTagsDraft(contact.tags ?? []);
    }
  }, [contact, id]);

  const handleNotesSave = () => {
    updateMutation.mutate({ id, data: { notes } }, {
      onSuccess: (data) => {
        setIsEditingNotes(false);
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        toast({ title: "Notes saved" });
      },
    });
  };

  const handleDetailsSave = () => {
    if (!editName.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id, data: { name: editName, relationshipType: editRelation } }, {
      onSuccess: (data) => {
        setIsEditingDetails(false);
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        toast({ title: "Details updated" });
      },
    });
  };

  const handleTierChange = (tier: string) => {
    const newInterval = defaultIntervalDays(tier);
    updateMutation.mutate({ id, data: { tier: tier as UpdateContactBodyTier, intervalDays: newInterval } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
        toast({ title: `Moved to ${getTierLabel(tier, newInterval)}` });
      },
    });
  };

  const handleIntervalChange = (days: number) => {
    if (!contact) return;
    updateMutation.mutate({ id, data: { intervalDays: days } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
        toast({ title: "Frequency updated" });
      },
    });
  };

  const handleTagsSave = () => {
    updateMutation.mutate({ id, data: { tags: tagsDraft } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        setEditingTags(false);
        toast({ title: "Tags saved" });
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() });
        toast({ title: "Contact deleted" });
        setLocation("/contacts");
      },
    });
  };

  const handleArchive = () => {
    archiveMutation.mutate({ id }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
        toast({ title: `${contact?.name} archived` });
      },
    });
  };

  const handleUnarchive = () => {
    unarchiveMutation.mutate({ id }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
        toast({ title: `${contact?.name} restored` });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6"><Skeleton className="h-64 w-full rounded-xl" /></div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-2">Contact not found</h2>
        <p className="text-muted-foreground mb-6">This contact may have been deleted.</p>
        <Link href="/contacts"><Button>Return to Contacts</Button></Link>
      </div>
    );
  }

  const isArchived = !!contact.archivedAt;
  const streak = contact.streak ?? 0;

  return (
    <Fragment>
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" />Back to contacts
        </Link>

        {isArchived && (
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Archive className="h-4 w-4 shrink-0" />
            <span className="flex-1">This contact is archived and won't appear in your active circle.</span>
            <Button size="sm" variant="outline" onClick={handleUnarchive} disabled={unarchiveMutation.isPending} className="h-7 gap-1.5 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900">
              {unarchiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
              Restore
            </Button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-4 flex-1">
            {isEditingDetails ? (
              <div className="flex gap-2 max-w-md items-center">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-2xl font-serif font-bold h-12" />
                <Button onClick={handleDetailsSave} size="icon" disabled={updateMutation.isPending} data-testid="btn-save-name">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setIsEditingDetails(false); setEditName(contact.name); }}>✕</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-4xl font-serif font-bold text-foreground tracking-tight" onDoubleClick={() => setIsEditingDetails(true)}>
                  {contact.name}
                </h1>
                {streak >= 2 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                    <Flame className="h-4 w-4" />{streak} streak
                  </span>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setIsEditingDetails(true)} data-testid="btn-edit-details">
                  Edit
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Select value={contact.tier} onValueChange={handleTierChange} disabled={updateMutation.isPending}>
                <SelectTrigger className={`w-auto h-8 text-xs font-medium border-0 shadow-none ${getTierColor(contact.tier)}`} data-testid="select-tier">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-1.5" data-testid="interval-picker-detail">
                {(TIER_INTERVALS[contact.tier] ?? []).map((opt) => {
                  const currentInterval = contact.intervalDays ?? defaultIntervalDays(contact.tier);
                  const isActive = currentInterval === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => handleIntervalChange(opt.days)}
                      disabled={updateMutation.isPending}
                      data-testid={`interval-chip-${opt.days}`}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-all ${isActive ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {isEditingDetails ? (
                <Input value={editRelation} onChange={(e) => setEditRelation(e.target.value)} className="h-8 max-w-[150px] text-sm" placeholder="Relationship" />
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal rounded-md px-2.5 py-1 flex items-center gap-1.5 h-8">
                  <User className="h-3 w-3" />{contact.relationshipType}
                </Badge>
              )}
            </div>
          </div>

          {!isArchived && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                onClick={() => setTouchDialogOpen(true)}
                className="gap-2 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
                data-testid="btn-touch-detail"
              >
                <CheckCircle2 className="h-5 w-5" />Mark Reached Out
              </Button>
              <SnoozePopover contactId={contact.id} contactName={contact.name} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Interactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <InteractionLog contactId={id} />
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="bg-muted/10 border-b border-border/40 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-serif font-medium">Notes</CardTitle>
                {!isEditingNotes && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(true)} data-testid="btn-edit-notes">
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                {isEditingNotes ? (
                  <div className="space-y-4">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[160px] resize-y font-mono text-sm"
                      placeholder="Add context about this person, what you usually talk about, key details to remember…"
                      data-testid="textarea-notes"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => { setIsEditingNotes(false); setNotes(contact.notes || ""); }}>Cancel</Button>
                      <Button onClick={handleNotesSave} disabled={updateMutation.isPending} data-testid="btn-save-notes">
                        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
                      </Button>
                    </div>
                  </div>
                ) : contact.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border border-border/40 leading-relaxed">
                    {contact.notes}
                  </p>
                ) : (
                  <button onClick={() => setIsEditingNotes(true)} className="w-full flex flex-col items-center justify-center py-8 text-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <p className="text-sm">No notes yet. Click to add some context about {contact.name}.</p>
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-serif font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Clock className="h-4 w-4" />Last Connected
                  </p>
                  <p className="text-base font-medium">
                    {contact.lastContactDate
                      ? new Date(contact.lastContactDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })
                      : "Never"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{formatRelativeDate(contact.lastContactDate)}</p>
                </div>

                {!isArchived && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                      <CalendarDays className="h-4 w-4" />Next Follow-up
                    </p>
                    <p className="text-base font-medium">
                      {contact.nextContactDate
                        ? new Date(contact.nextContactDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })
                        : "Unknown"}
                    </p>
                    {contact.nextContactDate && (
                      <div className="mt-2">
                        <a href={`/api/contacts/${contact.id}/calendar.ics`} download
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          data-testid="link-download-ical">
                          <Download className="h-3.5 w-3.5" />Download iCal Reminder
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {streak >= 2 && (
                  <div className="pt-4 border-t border-border flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                      <Flame className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{streak}× streak</p>
                      <p className="text-xs text-muted-foreground">Reached out on time</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">🎂 Birthday</p>
                  {editingBirthday ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={bdayValue}
                        onChange={(e) => setBdayValue(e.target.value)}
                        className="text-sm rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <Button size="sm"
                        onClick={() => {
                          updateMutation.mutate({ id, data: { birthday: bdayValue || null } }, {
                            onSuccess: (data) => {
                              queryClient.setQueryData(getGetContactQueryKey(id), data);
                              setEditingBirthday(false);
                              toast({ title: "Birthday saved" });
                            },
                          });
                        }}
                        disabled={updateMutation.isPending} className="h-7 px-3">
                        {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setBdayValue(contact.birthday ?? ""); setEditingBirthday(false); }} className="h-7">Cancel</Button>
                    </div>
                  ) : contact.birthday ? (
                    <div className="flex items-center gap-2">
                      <p className="text-base font-medium">
                        {new Date(`2000-${contact.birthday.slice(5)}`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setBdayValue(contact.birthday ?? ""); setEditingBirthday(true); }}>Edit</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-0 hover:text-foreground" onClick={() => setEditingBirthday(true)}>
                      + Add birthday
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />Tags
                </p>
                {editingTags ? (
                  <div className="space-y-2">
                    <TagEditor tags={tagsDraft} onChange={setTagsDraft} placeholder="e.g. work, mentor, college…" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setTagsDraft(contact.tags ?? []); setEditingTags(false); }}>Cancel</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleTagsSave} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 cursor-pointer" onClick={() => { setTagsDraft(contact.tags ?? []); setEditingTags(true); }}>
                    {(contact.tags ?? []).length > 0 ? (
                      (contact.tags ?? []).map((tag) => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-0 hover:text-foreground" onClick={(e) => { e.stopPropagation(); setTagsDraft([]); setEditingTags(true); }}>
                        + Add tags
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 border-destructive/10">
              <CardContent className="p-5 space-y-3">
                {!isArchived ? (
                  <Button variant="outline" className="w-full gap-2 text-muted-foreground border-border/60 hover:bg-muted/50 hover:text-foreground" onClick={handleArchive} disabled={archiveMutation.isPending} data-testid="btn-archive-contact">
                    {archiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Archive Contact
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full gap-2 text-muted-foreground border-border/60 hover:bg-muted/50 hover:text-foreground" onClick={handleUnarchive} disabled={unarchiveMutation.isPending} data-testid="btn-unarchive-contact">
                    {unarchiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                    Restore Contact
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-2" data-testid="btn-delete-contact">
                      <Trash2 className="h-4 w-4" />Delete Contact
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove {contact.name} from your Social Circle. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <TouchDialog
        contactId={contact.id}
        contactName={contact.name}
        existingNotes={contact.notes}
        open={touchDialogOpen}
        onOpenChange={setTouchDialogOpen}
        onSuccess={() => { initializedForId.current = null; }}
      />
    </Fragment>
  );
}
