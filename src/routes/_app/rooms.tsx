import { createFileRoute } from "@tanstack/react-router";
import { Hotel, Lock } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";

export const Route = createFileRoute("/_app/rooms")({
  component: Rooms,
});

function Rooms() {
  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <header className="px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Rooms</h1>
        <p className="mt-1 text-sm text-muted-foreground">Curated suites near you.</p>
      </header>
      <main className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blood/15">
          <Hotel className="h-7 w-7 text-blood" />
        </div>
        <h2 className="mt-6 font-display text-2xl">Opening soon</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Curated VIP rooms, instant booking, and M-Pesa checkout. Coming in the next drop.
        </p>
        <span className="mt-5 inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Lock className="h-3 w-3" /> Members preview
        </span>
      </main>
      <MobileNav />
    </div>
  );
}
