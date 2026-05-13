import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/layout/MobileNav";

export const Route = createFileRoute("/_app/matches")({
  component: Matches,
});

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  other: { id: string; full_name: string | null; username: string | null; photo: string | null };
};

function Matches() {
  const { user } = useAuth();
  const [items, setItems] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const otherIds = (matches ?? []).map((m) => (m.user_a === user.id ? m.user_b : m.user_a));
      const { data: profs } = otherIds.length
        ? await supabase.from("profiles").select("id, full_name, username").in("id", otherIds)
        : { data: [] };
      const { data: pics } = otherIds.length
        ? await supabase.from("photos").select("user_id, url").in("user_id", otherIds).eq("is_primary", true)
        : { data: [] };

      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const picMap = new Map((pics ?? []).map((p) => [p.user_id, p.url]));

      setItems(
        (matches ?? []).map((m) => {
          const otherId = m.user_a === user.id ? m.user_b : m.user_a;
          const p = profMap.get(otherId);
          return {
            id: m.id,
            user_a: m.user_a,
            user_b: m.user_b,
            created_at: m.created_at,
            other: {
              id: otherId,
              full_name: p?.full_name ?? null,
              username: p?.username ?? null,
              photo: picMap.get(otherId) ?? null,
            },
          };
        }),
      );
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <header className="px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Matches</h1>
        <p className="mt-1 text-sm text-muted-foreground">People who liked you back.</p>
      </header>

      <main className="px-5 pt-8">
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blood" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blood/15">
              <Sparkles className="h-6 w-6 text-blood" />
            </div>
            <h3 className="mt-5 font-display text-xl">No matches yet</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Keep swiping. Tonight is young.</p>
            <Link to="/discover" className="mt-6 rounded-full bg-blood-gradient px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood">
              Discover
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {items.map((m) => (
              <li key={m.id}>
                <Link to="/messages/$matchId" params={{ matchId: m.id }} className="group glass-card block overflow-hidden rounded-2xl">
                  <div className="relative aspect-[3/4] bg-onyx">
                    {m.other.photo ? (
                      <img src={m.other.photo} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-semibold text-white">{m.other.full_name ?? m.other.username ?? "Member"}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-blood">
                        <MessageCircle className="h-3 w-3" /> Say hi
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
