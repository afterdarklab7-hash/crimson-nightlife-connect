import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/messages/$matchId")({
  component: Thread,
});

type Msg = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null };

function Thread() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [other, setOther] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [freeChat, setFreeChat] = useState(true);
  const [cost, setCost] = useState(0.25);
  const [balance, setBalance] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (!m) { toast.error("Conversation not found"); navigate({ to: "/messages" }); return; }
      const otherId = m.user_a === user.id ? m.user_b : m.user_a;
      const [{ data: p }, { data: pic }, { data: cfg }, { data: w }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username").eq("id", otherId).maybeSingle(),
        supabase.from("photos").select("url").eq("user_id", otherId).eq("is_primary", true).maybeSingle(),
        supabase.from("chat_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("wallets").select("balance_kes").eq("user_id", user.id).maybeSingle(),
      ]);
      setOther({ id: otherId, name: p?.full_name ?? p?.username ?? "Member", photo: pic?.url ?? null });
      if (cfg) { setFreeChat(cfg.free_chat_enabled); setCost(Number(cfg.message_cost_kes)); }
      setBalance(Number(w?.balance_kes ?? 0));

      const { data: list } = await supabase.from("messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
      setMsgs((list ?? []) as Msg[]);
      // mark as read
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("match_id", matchId).eq("recipient_id", user.id).is("read_at", null);
    })();
  }, [user, matchId, navigate]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("thread-" + matchId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (p) => {
        setMsgs((prev) => prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!body.trim() || !user || !other || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error, data } = await supabase.from("messages").insert({
      match_id: matchId, sender_id: user.id, recipient_id: other.id, body: text,
    }).select("*").single();
    if (error) {
      toast.error(error.message);
      setBody(text);
    } else if (data) {
      setMsgs((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]);
      if (!freeChat) setBalance((b) => (b ?? 0) - cost);
    }
    setSending(false);
  };

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <header className="safe-top relative z-10 flex items-center gap-3 border-b border-border/60 bg-coal/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate({ to: "/messages" })} className="rounded-full p-2 hover:bg-card/60"><ArrowLeft className="h-5 w-5" /></button>
        <Link to="/me" className="flex flex-1 items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-onyx">
            {other?.photo && <img src={other.photo} alt="" className="h-full w-full object-cover" />}
          </div>
          <div>
            <p className="text-sm font-semibold">{other?.name ?? "…"}</p>
            <p className="text-[10px] uppercase tracking-wider text-blood">{freeChat ? "Free chat · live" : `KES ${cost.toFixed(2)}/msg`}</p>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {msgs.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <Sparkles className="h-6 w-6 text-blood" />
            <p className="mt-3 text-sm text-muted-foreground">Say something irresistible.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-blood-gradient text-white" : "glass-card"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[9px] uppercase tracking-wider ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="safe-bottom border-t border-border/60 bg-coal/90 p-3 backdrop-blur-xl">
        {!freeChat && balance !== null && (
          <p className="mb-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Balance: <span className="text-blood">KES {balance.toFixed(2)}</span></p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-blood focus:outline-none"
            maxLength={2000}
          />
          <button type="submit" disabled={!body.trim() || sending} className="flex h-12 w-12 items-center justify-center rounded-full bg-blood-gradient text-white glow-blood disabled:opacity-50">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
