import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Send, Loader2, Sparkles, Wand2, Mic, X,
  Reply, CheckCheck, Play, Pause, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/messages/$matchId")({
  component: Thread,
});

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  reply_to_id: string | null;
  voice_url: string | null;
  voice_duration_ms: number | null;
};

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

const PICKUP_LINES = [
  "Tell me one thing about tonight that I'd never guess.",
  "If we skipped small talk, what would you ask me first?",
  "What's a song that always works on you?",
  "Hosting, hosted, or somewhere in between tonight?",
  "Be honest — what made you swipe?",
  "Coffee at sunrise or cocktails at midnight?",
];

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "😮", "😍", "🙏"];

function fmtDur(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Thread() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [other, setOther] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [freeChat, setFreeChat] = useState(true);
  const [cost, setCost] = useState(0.25);
  const [balance, setBalance] = useState<number | null>(null);
  const [quota, setQuota] = useState(20);
  const [sentCount, setSentCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const recTimerRef = useRef<number | null>(null);
  const recCancelRef = useRef(false);

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (!m) { toast.error("Conversation not found"); navigate({ to: "/messages" }); return; }
      const otherId = m.user_a === user.id ? m.user_b : m.user_a;
      const [{ data: p }, { data: pic }, { data: cfg }, { data: w }, { count: sc }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username").eq("id", otherId).maybeSingle(),
        supabase.from("photos").select("url").eq("user_id", otherId).eq("is_primary", true).maybeSingle(),
        supabase.from("chat_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("wallets").select("balance_kes").eq("user_id", user.id).maybeSingle(),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("sender_id", user.id),
      ]);
      setOther({ id: otherId, name: p?.full_name ?? p?.username ?? "Member", photo: pic?.url ?? null });
      if (cfg) {
        setFreeChat(cfg.free_chat_enabled);
        setCost(Number(cfg.message_cost_kes));
        setQuota(Number((cfg as { free_message_quota?: number }).free_message_quota ?? 20));
      }
      setBalance(Number(w?.balance_kes ?? 0));
      setSentCount(sc ?? 0);

      const { data: list } = await supabase.from("messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
      setMsgs((list ?? []) as Msg[]);
      const ids = (list ?? []).map((x) => x.id);
      if (ids.length) {
        const { data: rx } = await supabase.from("message_reactions").select("*").in("message_id", ids);
        setReactions((rx ?? []) as Reaction[]);
      }
      // mark as read
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("match_id", matchId).eq("recipient_id", user.id).is("read_at", null);
    })();
  }, [user, matchId, navigate]);

  // Realtime: messages, reads, reactions
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("thread-" + matchId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.recipient_id === user.id) {
          supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => prev.map((x) => x.id === m.id ? { ...x, read_at: m.read_at } : x));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (p) => {
        const r = p.new as Reaction;
        setReactions((prev) => prev.some((x) => x.id === r.id) ? prev : [...prev, r]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (p) => {
        const r = p.old as Reaction;
        setReactions((prev) => prev.filter((x) => x.id !== r.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length]);

  const msgById = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const reactionsByMsg = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.message_id) ?? [];
      arr.push(r); map.set(r.message_id, arr);
    }
    return map;
  }, [reactions]);

  const sendText = async () => {
    if (!body.trim() || !user || !other || sending) return;
    setSending(true);
    const text = body.trim();
    const replyId = replyTo?.id ?? null;
    setBody(""); setReplyTo(null);
    const { error, data } = await supabase.from("messages").insert({
      match_id: matchId, sender_id: user.id, recipient_id: other.id, body: text, reply_to_id: replyId,
    }).select("*").single();
    if (error) { toast.error(error.message); setBody(text); }
    else if (data) {
      setMsgs((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]);
      const nextSent = sentCount + 1;
      setSentCount(nextSent);
      if (!freeChat && nextSent > quota) setBalance((b) => (b ?? 0) - cost);
    }
    setSending(false);
  };

  const startRecording = async () => {
    if (recording || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recChunksRef.current = [];
      recCancelRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
        const elapsed = Date.now() - recStartRef.current;
        setRecording(false); setRecElapsed(0);
        if (recCancelRef.current || elapsed < 600) return;
        const blob = new Blob(recChunksRef.current, { type: mime });
        await uploadVoice(blob, elapsed);
      };
      recRef.current = mr;
      recStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      recTimerRef.current = window.setInterval(() => setRecElapsed(Date.now() - recStartRef.current), 100);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = (cancel = false) => {
    recCancelRef.current = cancel;
    recRef.current?.stop();
  };

  const uploadVoice = async (blob: Blob, durationMs: number) => {
    if (!user || !other) return;
    setSending(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("voice-notes").upload(path, blob, { contentType: blob.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("voice-notes").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error, data } = await supabase.from("messages").insert({
        match_id: matchId, sender_id: user.id, recipient_id: other.id, body: null,
        reply_to_id: replyTo?.id ?? null,
        voice_url: signed?.signedUrl ?? null,
        voice_duration_ms: durationMs,
      }).select("*").single();
      if (error) throw error;
      if (data) setMsgs((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]);
      setReplyTo(null);
      const nextSent = sentCount + 1;
      setSentCount(nextSent);
      if (!freeChat && nextSent > quota) setBalance((b) => (b ?? 0) - cost);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send voice note";
      toast.error(msg);
    } finally { setSending(false); }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      const { data } = await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji }).select("*").single();
      if (data) setReactions((prev) => [...prev, data as Reaction]);
    }
    setReactPickerFor(null);
  };

  const playVoice = (id: string, url: string) => {
    if (audioRef.current && playingId === id) {
      audioRef.current.pause(); audioRef.current = null; setPlayingId(null); return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const a = new Audio(url);
    audioRef.current = a; setPlayingId(id);
    a.onended = () => { setPlayingId(null); audioRef.current = null; };
    a.play().catch(() => { setPlayingId(null); audioRef.current = null; });
  };

  const freeLeft = Math.max(0, quota - sentCount);

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <header className="safe-top relative z-10 flex items-center gap-3 border-b border-border/60 bg-coal/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate({ to: "/messages" })} className="rounded-full p-2 hover:bg-card/60"><ArrowLeft className="h-5 w-5" /></button>
        <Link to="/me" className="flex flex-1 items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-onyx ring-1 ring-border/60">
            {other?.photo && <img src={other.photo} alt="" className="h-full w-full object-cover" />}
          </div>
          <div>
            <p className="font-display text-base leading-tight tracking-tight">{other?.name ?? "…"}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {freeChat ? "Free chat · live" : freeLeft > 0 ? `${freeLeft} free left` : `KES ${cost.toFixed(2)}/msg`}
            </p>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4" onClick={() => setReactPickerFor(null)}>
        {msgs.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <Sparkles className="h-6 w-6 text-blood" />
            <p className="mt-3 text-sm text-muted-foreground">Say something irresistible.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {msgs.map((m) => {
              const mine = m.sender_id === user?.id;
              const reply = m.reply_to_id ? msgById.get(m.reply_to_id) : null;
              const myReactions = reactionsByMsg.get(m.id) ?? [];
              return (
                <Bubble
                  key={m.id}
                  msg={m}
                  mine={mine}
                  replyMsg={reply ?? null}
                  reactions={myReactions}
                  reactPickerOpen={reactPickerFor === m.id}
                  onOpenReactPicker={(open) => setReactPickerFor(open ? m.id : null)}
                  onReact={(emoji) => toggleReaction(m.id, emoji)}
                  onSwipeReply={() => setReplyTo(m)}
                  onPlayVoice={(url) => playVoice(m.id, url)}
                  isPlaying={playingId === m.id}
                  myUserId={user?.id ?? ""}
                />
              );
            })}
          </ul>
        )}
      </div>

      <div className="safe-bottom border-t border-border/60 bg-coal/95 px-3 pt-2 pb-3 backdrop-blur-xl">
        {msgs.length === 0 && !replyTo && (
          <div className="mb-2 -mx-1 flex gap-2 overflow-x-auto pb-1">
            {PICKUP_LINES.map((line) => (
              <button key={line} type="button" onClick={() => setBody(line)}
                className="shrink-0 rounded-full border border-blood/40 bg-blood/10 px-3 py-1.5 text-[11px] text-foreground/90 hover:bg-blood/20">
                {line}
              </button>
            ))}
          </div>
        )}

        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-blood bg-card/60 px-3 py-2">
            <Reply className="mt-0.5 h-3.5 w-3.5 text-blood" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-blood">
                Reply to {replyTo.sender_id === user?.id ? "yourself" : other?.name ?? "them"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{replyTo.body ?? "🎙️ Voice note"}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="rounded-full p-1 text-muted-foreground hover:bg-card">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!freeChat && !recording && (
          freeLeft > 0 ? (
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="text-blood">{freeLeft}</span> free left · then KES {cost.toFixed(2)}/msg
            </p>
          ) : balance !== null ? (
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              Balance: <span className="text-blood">KES {balance.toFixed(2)}</span>
            </p>
          ) : null
        )}

        {recording ? (
          <div className="flex items-center gap-3 rounded-2xl border border-blood/40 bg-card/60 px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blood" />
            <span className="font-mono text-sm tabular-nums">{fmtDur(recElapsed)}</span>
            <span className="flex-1 text-xs text-muted-foreground">Recording…</span>
            <button type="button" onClick={() => stopRecording(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => stopRecording(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blood-gradient text-white glow-blood">
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); sendText(); }} className="flex items-end gap-2">
            <button type="button" aria-label="Pickup line"
              onClick={() => setBody(PICKUP_LINES[Math.floor(Math.random() * PICKUP_LINES.length)])}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/60 text-blood">
              <Wand2 className="h-4 w-4" />
            </button>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              rows={1}
              placeholder="Message…"
              className="flex-1 resize-none rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-blood focus:outline-none"
              maxLength={2000}
            />
            {body.trim() ? (
              <button type="submit" disabled={sending}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blood-gradient text-white glow-blood disabled:opacity-50">
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            ) : (
              <button type="button" aria-label="Hold to record" onClick={startRecording}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blood-gradient text-white glow-blood">
                <Mic className="h-5 w-5" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function Bubble({
  msg, mine, replyMsg, reactions, reactPickerOpen, onOpenReactPicker, onReact, onSwipeReply, onPlayVoice, isPlaying, myUserId,
}: {
  msg: Msg;
  mine: boolean;
  replyMsg: Msg | null;
  reactions: Reaction[];
  reactPickerOpen: boolean;
  onOpenReactPicker: (open: boolean) => void;
  onReact: (emoji: string) => void;
  onSwipeReply: () => void;
  onPlayVoice: (url: string) => void;
  isPlaying: boolean;
  myUserId: string;
}) {
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    longPressRef.current = window.setTimeout(() => onOpenReactPicker(true), 450);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 8 && longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
    // Allow swipe right (any side) up to 80px to reveal reply
    const clamped = Math.max(-10, Math.min(80, dx));
    setDragX(clamped);
  };
  const onTouchEnd = () => {
    if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
    if (dragX > 50) onSwipeReply();
    setDragX(0);
    startXRef.current = null;
  };

  // group reactions
  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    acc[r.emoji] = acc[r.emoji] ?? { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.user_id === myUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[78%]" style={{ transform: `translateX(${dragX}px)`, transition: dragX === 0 ? "transform 0.2s" : "none" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={(e) => { e.stopPropagation(); onOpenReactPicker(true); }}>
        {dragX > 10 && !mine && (
          <div className="absolute -left-9 top-1/2 -translate-y-1/2 rounded-full bg-blood/20 p-2"><Reply className="h-3.5 w-3.5 text-blood" /></div>
        )}
        {dragX > 10 && mine && (
          <div className="absolute -right-9 top-1/2 -translate-y-1/2 rounded-full bg-blood/20 p-2"><Reply className="h-3.5 w-3.5 text-blood" /></div>
        )}

        <div className={`relative rounded-2xl border px-3 py-2 backdrop-blur-xl ${
          mine
            ? "rounded-br-md border-blood/40 bg-coal/95"
            : "rounded-bl-md border-border/60 bg-card/80"
        }`}>
          {replyMsg && (
            <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 ${mine ? "border-blood bg-onyx/60" : "border-blood bg-onyx/40"}`}>
              <p className="text-[9px] uppercase tracking-wider text-blood">Reply</p>
              <p className="truncate text-[11px] text-muted-foreground">{replyMsg.body ?? "🎙️ Voice note"}</p>
            </div>
          )}

          {msg.voice_url ? (
            <button type="button" onClick={() => onPlayVoice(msg.voice_url!)}
              className="flex items-center gap-3 py-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blood-gradient text-white">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
              </span>
              <span className="flex h-1 w-32 items-center">
                <span className="h-1 w-full rounded-full bg-border/80">
                  <span className={`block h-1 rounded-full bg-blood ${isPlaying ? "w-1/2" : "w-0"} transition-all`} />
                </span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {fmtDur(msg.voice_duration_ms ?? 0)}
              </span>
            </button>
          ) : (
            <p className="whitespace-pre-wrap break-words font-sans text-[15px] leading-snug text-foreground">
              {msg.body}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {mine && (
              msg.read_at ? (
                <CheckCheck className="h-3.5 w-3.5 text-sky-400" aria-label="Read" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/70" aria-label="Delivered" />
              )
            )}
            {/* Single grey check for never-truly-saved is rare; we always have an id at render so use double-check above */}
          </div>

          {Object.keys(grouped).length > 0 && (
            <div className={`absolute -bottom-3 ${mine ? "right-2" : "left-2"} flex gap-1`}>
              {Object.entries(grouped).map(([e, info]) => (
                <button key={e} onClick={() => onReact(e)}
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] backdrop-blur ${
                    info.mine ? "border-blood/60 bg-blood/20" : "border-border/60 bg-coal/90"
                  }`}>
                  <span>{e}</span>
                  {info.count > 1 && <span className="font-mono text-[9px] text-muted-foreground">{info.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {reactPickerOpen && (
          <div className={`absolute z-30 ${mine ? "right-0" : "left-0"} -top-11 flex gap-1 rounded-full border border-border/60 bg-coal/95 px-2 py-1.5 shadow-xl`}
            onClick={(e) => e.stopPropagation()}>
            {QUICK_EMOJIS.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="text-lg leading-none transition-transform hover:scale-125">
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Tiny inline action: tap reply button on desktop */}
        <button type="button" onClick={onSwipeReply}
          className={`absolute top-1 ${mine ? "-left-7" : "-right-7"} hidden h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-coal/80 text-muted-foreground hover:text-blood md:flex`}
          aria-label="Reply">
          <Reply className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}

