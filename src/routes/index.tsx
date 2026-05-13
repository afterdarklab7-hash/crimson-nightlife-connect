import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, MapPin, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/discover" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground noise-overlay">
      {/* Ambient red glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blood/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full bg-neon/15 blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8 safe-top">
        <Logo />
        <Link
          to="/auth"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-between px-6 pt-16 pb-10">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse-blood" />
            18+ Members only
          </div>

          <h1 className="mt-6 font-display text-[44px] leading-[0.95] tracking-tight">
            Where the city
            <br />
            <span className="italic text-blood">comes alive</span>
            <br />
            after dark.
          </h1>

          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
            A private members club for adults. Meet, match, and arrange the night —
            all on your terms.
          </p>

          <div className="mt-10 grid gap-3">
            {[
              { icon: MapPin, t: "Discover nearby", s: "Verified people in your radius" },
              { icon: ShieldCheck, t: "Privacy first", s: "Hidden mode, blocked screenshots" },
              { icon: Sparkles, t: "Curated rooms", s: "Vetted hotels, instant booking" },
            ].map(({ icon: Icon, t, s }) => (
              <div key={t} className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blood-gradient glow-blood">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 space-y-4">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blood-gradient text-sm font-semibold uppercase tracking-[0.18em] text-white glow-blood transition-transform active:scale-[0.98]"
          >
            Step inside
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you confirm you are 18+ and agree to our{" "}
            <span className="underline">Terms</span> &{" "}
            <span className="underline">Privacy</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
