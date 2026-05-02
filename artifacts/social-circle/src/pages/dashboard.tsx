import { useState } from "react";
import { useGetContactStats, useGetDueContacts, useListContacts } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CalendarClock, AlertCircle, ArrowRight, CheckCircle2, User, Clock } from "lucide-react";
import { formatUrgency, formatRelativeDate } from "@/lib/date-utils";
import { getTierColor, getTierLabel } from "@/lib/tier-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TouchDialog } from "@/components/touch-dialog";

function getUpcomingBirthdays(contacts: Array<{ id: number; name: string; birthday: string | null; tier: string; relationshipType: string }>, withinDays = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();

  return contacts
    .filter((c) => c.birthday)
    .map((c) => {
      const [, mm, dd] = c.birthday!.split("-");
      let bday = new Date(year, parseInt(mm) - 1, parseInt(dd));
      if (bday < today) bday = new Date(year + 1, parseInt(mm) - 1, parseInt(dd));
      const daysUntil = Math.round((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...c, birthdayDate: bday, daysUntil };
    })
    .filter((c) => c.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

interface PendingTouch {
  id: number;
  name: string;
  notes: string | null;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetContactStats();
  const { data: dueContacts, isLoading: dueLoading } = useGetDueContacts();
  const { data: allContacts } = useListContacts({});
  const [pendingTouch, setPendingTouch] = useState<PendingTouch | null>(null);

  const upcomingBirthdays = allContacts ? getUpcomingBirthdays(allContacts) : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-lg">A gentle overview of your relationships.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : stats ? (
          <>
            <Card className="bg-card shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Total Contacts
                </CardDescription>
                <CardTitle className="text-3xl">{stats.total}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats.core} Core · {stats.monthly} Monthly · {stats.yearly} Yearly
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Overdue
                </CardDescription>
                <CardTitle className="text-3xl text-destructive">{stats.overdueCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                People waiting to hear from you
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-primary flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Due This Week
                </CardDescription>
                <CardTitle className="text-3xl">{stats.dueThisWeek}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Upcoming follow-ups
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/20 shadow-none flex flex-col justify-center items-center text-center p-6">
              <Link href="/contacts/new">
                <Button variant="outline" className="rounded-full bg-background/50 hover:bg-background border-primary/20 hover:border-primary/50 text-primary">
                  + New Contact
                </Button>
              </Link>
            </Card>
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold">Due for Follow-up</h2>
          <Link href="/contacts" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {dueLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : dueContacts && dueContacts.length > 0 ? (
          <div className="grid gap-3">
            {dueContacts.map((contact) => (
              <Card key={contact.id} className="overflow-hidden hover:shadow-md transition-shadow border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-5 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/contacts/${contact.id}`} className="text-lg font-medium hover:text-primary hover:underline truncate">
                        {contact.name}
                      </Link>
                      <Badge variant="outline" className={getTierColor(contact.tier)}>
                        {getTierLabel(contact.tier)}
                      </Badge>
                      {contact.daysOverdue > 0 && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-normal">
                          Overdue
                        </Badge>
                      )}
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
                      <span className={`flex items-center gap-1.5 font-medium ${contact.daysOverdue > 0 ? 'text-destructive' : 'text-primary'}`}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatUrgency(contact.daysOverdue)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:border-l sm:border-border sm:pl-4">
                    <Button
                      onClick={() => setPendingTouch({ id: contact.id, name: contact.name, notes: contact.notes })}
                      variant="default"
                      className="w-full sm:w-auto shadow-sm gap-2"
                      data-testid={`touch-contact-${contact.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Reached Out
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center bg-muted/30 border-dashed">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">You're all caught up!</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              You've reached out to everyone due for a follow-up. Take a breath and enjoy the peace.
            </p>
          </Card>
        )}
      </div>

      {upcomingBirthdays.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-semibold flex items-center gap-2">
            🎂 Upcoming Birthdays
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingBirthdays.map((c) => (
              <Link key={c.id} href={`/contacts/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow border-border/60 cursor-pointer">
                  <div className="flex items-center gap-4 p-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                      🎂
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.daysUntil === 0
                          ? "Today! 🎉"
                          : c.daysUntil === 1
                          ? "Tomorrow"
                          : `In ${c.daysUntil} days`}
                        {" · "}
                        {c.birthdayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`ml-auto shrink-0 ${getTierColor(c.tier as any)}`}>
                      {getTierLabel(c.tier)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendingTouch && (
        <TouchDialog
          contactId={pendingTouch.id}
          contactName={pendingTouch.name}
          existingNotes={pendingTouch.notes}
          open={!!pendingTouch}
          onOpenChange={(v) => { if (!v) setPendingTouch(null); }}
        />
      )}
    </div>
  );
}
