import { useState, useRef, useEffect, Fragment } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetContact, 
  useUpdateContact, 
  useDeleteContact,
  useGetContactInfoHistory,
  getGetContactQueryKey,
  getGetContactInfoHistoryQueryKey,
  getListContactsQueryKey,
  getGetContactStatsQueryKey,
  getGetDueContactsQueryKey,
  UpdateContactBodyTier
} from "@workspace/api-client-react";
import { TouchDialog } from "@/components/touch-dialog";
import { SnoozePopover } from "@/components/snooze-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, Clock, CalendarDays, Loader2, Save, Download, User, Trash2, BellOff, MessageSquare, Archive, ArchiveRestore, Phone, Mail, Linkedin, Twitter, Instagram, MapPin, Copy, Check, Tag, Plus, X as XIcon, History } from "lucide-react";
import { formatRelativeDate } from "@/lib/date-utils";
import { getTierColor, getTierLabel, TIER_INTERVALS, defaultIntervalDays } from "@/lib/tier-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface NoteEntry {
  date: string;
  content: string;
}

interface ParsedNotes {
  entries: NoteEntry[];
  freeText: string;
}

const DATED_ENTRY_RE = /^\[([^\]]+)\]\s*([\s\S]*)$/;

function parseNotes(raw: string | null | undefined): ParsedNotes {
  if (!raw?.trim()) return { entries: [], freeText: "" };
  const chunks = raw.split(/\n\n+/);
  const entries: NoteEntry[] = [];
  const free: string[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const m = trimmed.match(DATED_ENTRY_RE);
    if (m) {
      entries.push({ date: m[1], content: m[2].trim() });
    } else {
      free.push(trimmed);
    }
  }
  return { entries, freeText: free.join("\n\n") };
}

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
  const [archiving, setArchiving] = useState(false);

  // Contact info fields
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editTwitter, setEditTwitter] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Tags
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  const { data: contact, isLoading, error } = useGetContact(id, { 
    query: { 
      enabled: !!id, 
      queryKey: getGetContactQueryKey(id) 
    } 
  });
  const { data: infoHistory } = useGetContactInfoHistory(id, {
    query: { enabled: !!id, queryKey: getGetContactInfoHistoryQueryKey(id) }
  });

  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (contact && initializedForId.current !== id) {
      initializedForId.current = id;
      setNotes(contact.notes || "");
      setEditName(contact.name);
      setEditRelation(contact.relationshipType);
      setBdayValue(contact.birthday ?? "");
      setEditEmail(contact.email ?? "");
      setEditPhone(contact.phone ?? "");
      setEditLinkedin(contact.linkedin ?? "");
      setEditTwitter(contact.twitter ?? "");
      setEditInstagram(contact.instagram ?? "");
      setEditAddress(contact.address ?? "");
      setEditTags(contact.tags ?? []);
    }
  }, [contact, id]);

  const handleNotesSave = () => {
    updateMutation.mutate({ id, data: { notes } }, {
      onSuccess: (data) => {
        setIsEditingNotes(false);
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        toast({ title: "Notes saved" });
      }
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
      }
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
      }
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
      }
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
      }
    });
  };

  const handleContactInfoSave = () => {
    updateMutation.mutate({
      id,
      data: {
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        linkedin: editLinkedin.trim() || null,
        twitter: editTwitter.trim() || null,
        instagram: editInstagram.trim() || null,
        address: editAddress.trim() || null,
      },
    }, {
      onSuccess: (data) => {
        setIsEditingContactInfo(false);
        queryClient.setQueryData(getGetContactQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getGetContactInfoHistoryQueryKey(id) });
        toast({ title: "Contact info updated" });
      },
    });
  };

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim().toLowerCase();
    if (!tag || editTags.includes(tag)) { setNewTagInput(""); return; }
    const newTags = [...editTags, tag];
    setEditTags(newTags);
    setNewTagInput("");
    updateMutation.mutate({ id, data: { tags: newTags } }, {
      onSuccess: (data) => { queryClient.setQueryData(getGetContactQueryKey(id), data); },
    });
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = editTags.filter((t) => t !== tag);
    setEditTags(newTags);
    updateMutation.mutate({ id, data: { tags: newTags } }, {
      onSuccess: (data) => { queryClient.setQueryData(getGetContactQueryKey(id), data); },
    });
  };

  const handleArchiveToggle = async () => {
    if (!contact || archiving) return;
    setArchiving(true);
    const action = contact.archivedAt ? "unarchive" : "archive";
    try {
      const res = await fetch(`/api/contacts/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Request failed");
      const updated = await res.json();
      queryClient.setQueryData(getGetContactQueryKey(id), updated);
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() });
      toast({ title: contact.archivedAt ? "Contact restored" : "Contact archived" });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
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
        <Link href="/contacts">
          <Button>Return to Contacts</Button>
        </Link>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-4 flex-1">
            {isEditingDetails ? (
              <div className="flex gap-2 max-w-md items-center">
                <Input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-serif font-bold h-12"
                />
                <Button onClick={handleDetailsSave} size="icon" disabled={updateMutation.isPending} data-testid="btn-save-name">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setIsEditingDetails(false); setEditName(contact.name); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-serif font-bold text-foreground tracking-tight" onDoubleClick={() => setIsEditingDetails(true)}>
                  {contact.name}
                </h1>
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
                      className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {isEditingDetails ? (
                <Input 
                  value={editRelation} 
                  onChange={(e) => setEditRelation(e.target.value)}
                  className="h-8 max-w-[150px] text-sm"
                  placeholder="Relationship"
                />
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal rounded-md px-2.5 py-1 flex items-center gap-1.5 h-8">
                  <User className="h-3 w-3" />
                  {contact.relationshipType}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button 
              onClick={() => setTouchDialogOpen(true)}
              className="gap-2 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
              data-testid="btn-touch-detail"
            >
              <CheckCircle2 className="h-5 w-5" />
              Mark Reached Out
            </Button>
            <SnoozePopover contactId={contact.id} contactName={contact.name} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="bg-muted/10 border-b border-border/40 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Interaction History
                </CardTitle>
                {!isEditingNotes && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(true)} data-testid="btn-edit-notes">
                    Edit raw
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                {isEditingNotes ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Each entry starting with <code className="bg-muted px-1 rounded">[Date]</code> will appear as a timeline item. Separate entries with a blank line.
                    </p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[200px] resize-y font-mono text-sm"
                      placeholder="Write down important details, kids' names, what you talked about last time..."
                      data-testid="textarea-notes"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => { setIsEditingNotes(false); setNotes(contact.notes || ""); }}>
                        Cancel
                      </Button>
                      <Button onClick={handleNotesSave} disabled={updateMutation.isPending} data-testid="btn-save-notes">
                        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (() => {
                  const { entries, freeText } = parseNotes(contact.notes);
                  const hasContent = entries.length > 0 || freeText;
                  if (!hasContent) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-sm max-w-xs">
                          No interactions yet. Use "Mark Reached Out" to log your first one.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-6">
                      {freeText && (
                        <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border border-border/40">
                          {freeText}
                        </div>
                      )}
                      {entries.length > 0 && (
                        <div className="relative">
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
                          <div className="space-y-6">
                            {entries.map((entry, i) => (
                              <div key={i} className="flex gap-4 relative">
                                <div className="mt-1 shrink-0 w-3.5 h-3.5 rounded-full bg-primary/20 border-2 border-primary/50 z-10" />
                                <div className="flex-1 min-w-0 pb-1">
                                  <p className="text-xs font-medium text-primary/80 mb-1.5">{entry.date}</p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* ── Contact Info card ── */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="bg-muted/10 border-b border-border/40 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Contact Info
              </CardTitle>
              {!isEditingContactInfo ? (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingContactInfo(true)}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setIsEditingContactInfo(false);
                    setEditEmail(contact.email ?? "");
                    setEditPhone(contact.phone ?? "");
                    setEditLinkedin(contact.linkedin ?? "");
                    setEditTwitter(contact.twitter ?? "");
                    setEditInstagram(contact.instagram ?? "");
                    setEditAddress(contact.address ?? "");
                  }}>Cancel</Button>
                  <Button size="sm" onClick={handleContactInfoSave} disabled={updateMutation.isPending} className="gap-1">
                    {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {isEditingContactInfo ? (
                <div className="space-y-3">
                  {[
                    { label: "Email", value: editEmail, set: setEditEmail, placeholder: "name@example.com", icon: <Mail className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Phone", value: editPhone, set: setEditPhone, placeholder: "+1 555 000 0000", icon: <Phone className="h-4 w-4 text-muted-foreground" /> },
                    { label: "LinkedIn", value: editLinkedin, set: setEditLinkedin, placeholder: "linkedin.com/in/username", icon: <Linkedin className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Twitter / X", value: editTwitter, set: setEditTwitter, placeholder: "@username", icon: <Twitter className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Instagram", value: editInstagram, set: setEditInstagram, placeholder: "@username", icon: <Instagram className="h-4 w-4 text-muted-foreground" /> },
                    { label: "Address", value: editAddress, set: setEditAddress, placeholder: "City, Country", icon: <MapPin className="h-4 w-4 text-muted-foreground" /> },
                  ].map(({ label, value, set, placeholder, icon }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="shrink-0">{icon}</div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
                        <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                const fields = [
                  { label: "Email", value: contact.email, icon: <Mail className="h-4 w-4 text-muted-foreground shrink-0" />, key: "email" },
                  { label: "Phone", value: contact.phone, icon: <Phone className="h-4 w-4 text-muted-foreground shrink-0" />, key: "phone" },
                  { label: "LinkedIn", value: contact.linkedin, icon: <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />, key: "linkedin" },
                  { label: "Twitter / X", value: contact.twitter, icon: <Twitter className="h-4 w-4 text-muted-foreground shrink-0" />, key: "twitter" },
                  { label: "Instagram", value: contact.instagram, icon: <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />, key: "instagram" },
                  { label: "Address", value: contact.address, icon: <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />, key: "address" },
                ];
                const filled = fields.filter((f) => f.value);
                if (filled.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-sm">No contact info yet.</p>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground px-0" onClick={() => setIsEditingContactInfo(true)}>
                        + Add email, phone, or social
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {filled.map(({ label, value, icon, key }) => (
                      <div key={key} className="flex items-start gap-3 group">
                        <div className="mt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium truncate">{value}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title={`Copy ${label}`}
                          onClick={() => handleCopy(value!, key)}
                        >
                          {copiedField === key ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* ── Info change history ── */}
          {infoHistory && infoHistory.length > 0 && (
            <Card className="shadow-sm border-border/60">
              <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
                <CardTitle className="text-base font-serif font-medium flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Contact Info History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {infoHistory.map((entry) => {
                    const fieldLabel: Record<string, string> = { email: "Email", phone: "Phone", linkedin: "LinkedIn", twitter: "Twitter", instagram: "Instagram", address: "Address" };
                    return (
                      <div key={entry.id} className="flex gap-3 text-sm">
                        <div className="shrink-0 w-2 h-2 rounded-full bg-muted-foreground/40 mt-2" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {new Date(entry.changedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-foreground">
                            <span className="font-medium">{fieldLabel[entry.field] ?? entry.field}</span>
                            {entry.oldValue && entry.newValue ? (
                              <> changed from <span className="text-muted-foreground line-through">{entry.oldValue}</span> to <span>{entry.newValue}</span></>
                            ) : entry.newValue ? (
                              <> set to <span>{entry.newValue}</span></>
                            ) : (
                              <> removed</>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-serif font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Clock className="h-4 w-4" /> Last Connected
                  </p>
                  <p className="text-lg">
                    {contact.lastContactDate
                      ? new Date(contact.lastContactDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Never'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatRelativeDate(contact.lastContactDate)}
                  </p>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CalendarDays className="h-4 w-4" /> Next Follow-up
                  </p>
                  <p className="text-lg">
                    {contact.nextContactDate
                      ? new Date(contact.nextContactDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Unknown'}
                  </p>
                  {contact.nextContactDate && (
                    <div className="mt-3">
                      <a 
                        href={`/api/contacts/${contact.id}/calendar.ics`} 
                        download
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        data-testid="link-download-ical"
                      >
                        <Download className="h-3.5 w-3.5" /> Download iCal Reminder
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Tag className="h-4 w-4" /> Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/15 font-medium">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-0.5 hover:text-destructive transition-colors"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                      placeholder="Add a tag…"
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleAddTag} disabled={!newTagInput.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    🎂 Birthday
                  </p>
                  {editingBirthday ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={bdayValue}
                        onChange={(e) => setBdayValue(e.target.value)}
                        className="text-sm rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          updateMutation.mutate(
                            { id, data: { birthday: bdayValue || null } },
                            {
                              onSuccess: (data) => {
                                queryClient.setQueryData(getGetContactQueryKey(id), data);
                                setEditingBirthday(false);
                                toast({ title: "Birthday saved" });
                              },
                            }
                          );
                        }}
                        disabled={updateMutation.isPending}
                        className="h-7 px-3"
                      >
                        {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setBdayValue(contact.birthday ?? ""); setEditingBirthday(false); }} className="h-7">
                        Cancel
                      </Button>
                    </div>
                  ) : contact.birthday ? (
                    <div className="flex items-center gap-2">
                      <p className="text-lg">
                        {new Date(`2000-${contact.birthday.slice(5)}`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setBdayValue(contact.birthday ?? ""); setEditingBirthday(true); }}>
                        Edit
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-0 hover:text-foreground" onClick={() => setEditingBirthday(true)}>
                      + Add birthday
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 border-destructive/20">
              <CardContent className="p-6 space-y-3">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleArchiveToggle}
                  disabled={archiving}
                  data-testid="btn-archive-contact"
                >
                  {archiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : contact.archivedAt ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {contact.archivedAt ? "Restore from Archive" : "Archive Contact"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-2" data-testid="btn-delete-contact">
                      <Trash2 className="h-4 w-4" />
                      Delete Contact
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
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
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
        onSuccess={() => {
          initializedForId.current = null;
        }}
      />
    </Fragment>
  );
}
