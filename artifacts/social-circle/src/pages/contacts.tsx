import { useState } from "react";
import {
  useListContacts,
  getListContactsQueryKey,
  getGetDueContactsQueryKey,
  getGetContactStatsQueryKey,
  ListContactsTier,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import {
  CalendarClock,
  CheckCircle2,
  User,
  Clock,
  Search,
  Filter,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/date-utils";
import { getTierColor, getTierLabel } from "@/lib/tier-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TouchDialog } from "@/components/touch-dialog";
import { SnoozePopover } from "@/components/snooze-popover";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PendingTouch {
  id: number;
  name: string;
  notes: string | null;
}

export default function Contacts() {
  const [filterTier, setFilterTier] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingTouch, setPendingTouch] = useState<PendingTouch | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tierParam = filterTier !== "all" ? (filterTier as ListContactsTier) : undefined;

  const { data: contacts, isLoading } = useListContacts(
    { tier: tierParam },
    { query: { queryKey: getListContactsQueryKey({ tier: tierParam }) } }
  );

  const filteredContacts = contacts?.filter((contact) => {
    const q = search.toLowerCase();
    return (
      contact.name.toLowerCase().includes(q) ||
      contact.relationshipType.toLowerCase().includes(q) ||
      (contact.notes ?? "").toLowerCase().includes(q)
    );
  });

  const allFilteredIds = filteredContacts?.map((c) => c.id) ?? [];
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await fetch("/api/contacts/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "social-circle-contacts.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Export failed",
        description: "Could not download contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleBulkReachedOut() {
    if (selectedIds.size === 0 || bulkLoading) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/contacts/${id}/touch`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
        )
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDueContactsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetContactStatsQueryKey() }),
      ]);
      toast({
        title: "All caught up!",
        description: `Marked ${ids.length} contact${ids.length === 1 ? "" : "s"} as reached out.`,
      });
      setSelectedIds(new Set());
    } catch {
      toast({
        title: "Something went wrong",
        description: "Some contacts may not have been updated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">All Contacts</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Your entire circle, categorized by intention.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="shadow-sm gap-2 border-border/80"
            onClick={handleExportCsv}
            disabled={exporting}
            data-testid="btn-export-csv"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Link href="/contacts/new">
            <Button className="shadow-sm gap-2" data-testid="btn-add-contact">
              Add Contact
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, relation, or notes..."
            className="pl-9 bg-card border-border shadow-sm focus-visible:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
        <Tabs
          value={filterTier}
          onValueChange={(v) => { setFilterTier(v); setSelectedIds(new Set()); }}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="all" data-testid="filter-tier-all">All</TabsTrigger>
            <TabsTrigger value="core" data-testid="filter-tier-core">Core</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="filter-tier-monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" data-testid="filter-tier-yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredContacts && filteredContacts.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all contacts"
            data-testid="checkbox-select-all"
          />
          <label htmlFor="select-all" className="cursor-pointer select-none">
            {allSelected ? "Deselect all" : `Select all (${filteredContacts.length})`}
          </label>
          {someSelected && !allSelected && (
            <span className="text-foreground font-medium">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array(5)
            .fill(0)
            .map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : filteredContacts && filteredContacts.length > 0 ? (
          filteredContacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            return (
              <Card
                key={contact.id}
                className={`overflow-hidden transition-all border-border/60 ${
                  isSelected
                    ? "ring-2 ring-primary/40 border-primary/30 shadow-sm"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-5 gap-4">
                  <div className="flex items-start sm:items-center gap-3 shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={`Select ${contact.name}`}
                      data-testid={`checkbox-contact-${contact.id}`}
                      className="mt-1 sm:mt-0"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-lg font-medium hover:text-primary hover:underline truncate"
                      >
                        {contact.name}
                      </Link>
                      <Badge variant="outline" className={getTierColor(contact.tier)}>
                        {getTierLabel(contact.tier, contact.intervalDays)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                        <User className="h-3.5 w-3.5" />
                        {contact.relationshipType}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Last: {formatRelativeDate(contact.lastContactDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Next:{" "}
                        {contact.nextContactDate
                          ? new Date(contact.nextContactDate).toLocaleDateString()
                          : "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:border-l sm:border-border sm:pl-4">
                    <Button
                      onClick={() =>
                        setPendingTouch({
                          id: contact.id,
                          name: contact.name,
                          notes: contact.notes,
                        })
                      }
                      variant="outline"
                      className="w-full sm:w-auto shadow-sm gap-2 border-border/80 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                      data-testid={`touch-contact-${contact.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Reached Out
                    </Button>
                    <SnoozePopover
                      contactId={contact.id}
                      contactName={contact.name}
                    />
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-12 text-center bg-muted/20 border-dashed">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No contacts found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              {search
                ? `No contacts match your search for "${search}".`
                : "You haven't added any contacts in this tier yet."}
            </p>
            {!search && filterTier === "all" && (
              <Link href="/contacts/new">
                <Button variant="default">Add your first contact</Button>
              </Link>
            )}
          </Card>
        )}
      </div>

      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-3 bg-foreground text-background rounded-2xl shadow-2xl px-5 py-3.5">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-5 bg-background/20" />
            <Button
              size="sm"
              onClick={handleBulkReachedOut}
              disabled={bulkLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 rounded-xl h-8 px-4"
              data-testid="btn-bulk-reached-out"
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {bulkLoading ? "Marking…" : "Mark Reached Out"}
            </Button>
            <button
              onClick={clearSelection}
              className="text-background/60 hover:text-background transition-colors ml-1"
              aria-label="Clear selection"
              data-testid="btn-clear-selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {pendingTouch && (
        <TouchDialog
          contactId={pendingTouch.id}
          contactName={pendingTouch.name}
          existingNotes={pendingTouch.notes}
          open={!!pendingTouch}
          onOpenChange={(v) => {
            if (!v) setPendingTouch(null);
          }}
        />
      )}
    </div>
  );
}
