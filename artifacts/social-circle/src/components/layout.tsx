import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Users, LayoutDashboard, PlusCircle, CalendarDays, LogOut, ChevronDown } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarSyncDialog } from "@/components/calendar-sync-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contacts", label: "All Contacts", icon: Users },
  ];

  const handleSignOut = () => {
    signOut({ redirectUrl: `${window.location.origin}${basePath}/` });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-primary">
            Social Circle
          </Link>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Intentional relationships.</p>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={() => setCalendarOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="nav-calendar-sync"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar Sync
          </button>
        </nav>

        <div className="p-4 space-y-3 border-t border-border">
          <Link href="/contacts/new" className="block">
            <Button className="w-full justify-start gap-2 shadow-none" variant="default" data-testid="nav-add-contact">
              <PlusCircle className="h-4 w-4" />
              Add Contact
            </Button>
          </Link>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted transition-colors group">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                    {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="flex-1 text-left truncate text-muted-foreground group-hover:text-foreground text-xs">
                    {user.firstName ?? user.emailAddresses[0]?.emailAddress}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Your account"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.emailAddresses[0]?.emailAddress}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto">
        {children}
      </main>

      <CalendarSyncDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
    </div>
  );
}
