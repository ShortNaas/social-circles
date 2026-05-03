import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CalendarDays, Users, ArrowRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <img src={`${basePath}/logo.svg`} alt="Social Circle" className="h-8 w-8 rounded-full" />
          <span className="font-serif text-xl font-bold text-primary tracking-tight">Social Circle</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="shadow-sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            Based on Derek Sivers'{" "}
            <a
              href="https://sive.rs/hundreds"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-primary/80"
            >
              "hundreds"
            </a>{" "}
            method
          </div>

          <h1 className="text-5xl sm:text-6xl font-serif font-bold text-foreground tracking-tight leading-tight">
            Stay close to the<br />
            <span className="text-primary">people who matter.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            A personal relationship manager that gently reminds you to reach out to your Core, Monthly, and Yearly circles — before the connection fades.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 shadow-sm px-8 text-base">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="px-8 text-base border-border/80">
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full px-4">
          {[
            {
              icon: Users,
              title: "Three tiers of connection",
              desc: "Core contacts every 1–3 weeks. Monthly contacts every 1–5 months. Yearly contacts every 6–12 months.",
            },
            {
              icon: CheckCircle2,
              title: "One-tap reach-out",
              desc: "Mark someone as reached out, add an optional note, and the next reminder auto-schedules itself.",
            },
            {
              icon: CalendarDays,
              title: "Calendar sync",
              desc: "Subscribe your reminders to Proton Calendar, Apple Calendar, or any ICS-compatible app.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border/60 rounded-xl p-6 text-left shadow-sm">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-base text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground border-t border-border/40">
        Social Circle — intentional relationships.
      </footer>
    </div>
  );
}
