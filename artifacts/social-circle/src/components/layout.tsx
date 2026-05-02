import { Link, useLocation } from "wouter";
import { Users, LayoutDashboard, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contacts", label: "All Contacts", icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-primary">
            Social Circle
          </Link>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Intentional relationships.</p>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
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
        </nav>
        
        <div className="p-4 border-t border-border">
          <Link href="/contacts/new" className="block">
            <Button className="w-full justify-start gap-2 shadow-none" variant="default" data-testid="nav-add-contact">
              <PlusCircle className="h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        </div>
      </aside>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
