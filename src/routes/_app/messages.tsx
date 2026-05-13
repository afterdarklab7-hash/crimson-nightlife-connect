import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";

export const Route = createFileRoute("/_app/messages")({
  component: Messages,
});

function Messages() {
  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <header className="px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Chats</h1>
        <p className="mt-1 text-sm text-muted-foreground">Realtime messaging — coming next.</p>
      </header>
      <main className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blood/15">
          <MessageCircle className="h-7 w-7 text-blood" />
        </div>
        <h2 className="mt-6 font-display text-2xl">Chat unlocks at v2</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          WhatsApp-grade realtime chat with KES 0.25/msg billing, voice notes, and reactions. Up next.
        </p>
      </main>
      <MobileNav />
    </div>
  );
}
