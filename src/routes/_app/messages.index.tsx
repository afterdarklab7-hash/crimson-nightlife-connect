import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/layout/MobileNav";

export const Route = createFileRoute("/_app/messages/")({
  component: Threads,
});

type Thread = {
  match_id: string;
  other_id: string;
  other_name: string;
  other_photo: string | null;
  last_body: string | null;
  last_at: string | null;
  unread: number;
};

function Threads() {
  const { user } = useAuth();
  const [items, setItems] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: matches } = await supabase
      .from("matches").select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const ms = matches ?? [];
    const otherIds = ms.map((m) => (m.user_a === user.id ? m.user_b : m.user_a));
    const matchIds = ms.map((m) => m.id);
    const [{ data: profs }, { data: pics }, { data: msgs }] = await Promise.all([
      otherIds.length ? supabase.from("profiles").select("id, full_name, username").in("id", otherIds) : Promise.resolve({ data: [] }),
      otherIds.length ? supabase.from("photos").select("user_id, url").in("user_id", otherIds).eq("is_primary", true) : Promise.resolve({ data: [] }),
      matchIds.length ? supabase.from("messages").select("match_id, sender_id, recipient_id, body, created_at, read_at").in("match_id", matchIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const picMap = new Map((pics ?? []).map((p) => [p.user_id, p.url]));
    const lastMap = new Map<string, { body: string; created_at: string }>();
    const unreadMap = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (!lastMap.has(m.match_id)) lastMap.set(m.match_id, { body: m.body ?? "🎙️ Voice note", created_at: m.created_at });
      if (m.recipient_id === user.id && !m.read_at) unreadMap.set(m.match_id, (unreadMap.get(m.match_id) ?? 0) + 1);
    }
    setItems(ms.map((m) => {
      const otherId = m.user_a === user.id ? m.user_b : m.user_a;
      const p = profMap.get(otherId);
      const last = lastMap.get(m.id);
      return {
        match_id: m.id,
        other_id: otherId,
        other_name: p?.full_name ?? p?.username ?? "Member",
        other_photo: picMap.get(otherId) ?? null,
        last_body: last?.body ?? null,
        last_at: last?.created_at ?? null,
        unread: unreadMap.get(m.id) ?? 0,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("threads-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <header className="px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Chats</h1>
        <p className="mt-1 text-sm text-muted-foreground">Whisper into the night.</p>
      </header>
      <main className="px-5 pt-6">
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blood" /></div>
        ) : items.length === 0 ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blood/15"><MessageCircle className="h-6 w-6 text-blood" /></div>
            <h3 className="mt-5 font-display text-xl">No conversations yet</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Match with someone to start chatting.</p>
            <Link to="/discover" className="mt-6 rounded-full bg-blood-gradient px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood">Discover</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => (
              <li key={t.match_id}>
                <Link to="/messages/$matchId" params={{ matchId: t.match_id }} className="glass-card flex items-center gap-3 rounded-2xl p-3 transition-colors hover:border-blood/40">
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-onyx">
                    {t.other_photo ? <img src={t.other_photo} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold">{t.other_name}</p>
                      {t.last_at && <span className="text-[10px] text-muted-foreground">{new Date(t.last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs text-muted-foreground">{t.last_body ?? "Say hi"}</p>
                      {t.unread > 0 && <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blood px-1.5 text-[10px] font-bold text-white">{t.unread}</span>}
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
