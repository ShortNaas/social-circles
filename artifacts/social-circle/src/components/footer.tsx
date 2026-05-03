export function Footer() {
  return (
    <footer className="text-center py-4 text-xs border-t border-border/40 text-foreground/50">
      Made by{" "}
      <a
        href="https://naas.work"
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors"
      >
        naas.work
      </a>{" "}
      with{" "}
      <a
        href="https://replit.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors"
      >
        replit.com
      </a>
    </footer>
  );
}
