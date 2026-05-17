import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, Crown, Power, ArrowLeft, Plus, Wallet, Trash2, Eye, EyeOff, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { adminB2CWithdraw } from "@/lib/payments.functions";

export const Route = createFileRoute("/_app/admin")({
  component: Admin,
});

function Admin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hasAnyAdmin, setHasAnyAdmin] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [freeChat, setFreeChat] = useState(true);
  const [cost, setCost] = useState(0.25);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; username: string | null; is_vip: boolean; is_banned: boolean }>>([]);
  const [stats, setStats] = useState({ users: 0, matches: 0, messages: 0, bookings: 0 });
  const [adminRooms, setAdminRooms] = useState<Array<{ id: string; name: string; city: string | null; price_kes: number; is_active: boolean; capacity: number }>>([]);
  const [newRoom, setNewRoom] = useState({ name: "", city: "", price_kes: 3500, capacity: 2, cover_url: "", description: "" });
  const [wd, setWd] = useState({ phone: "", amount_kes: 1000, remarks: "Payout" });
  const [wdBusy, setWdBusy] = useState(false);
  const [wdHistory, setWdHistory] = useState<Array<{ id: string; phone: string; amount_kes: number; status: string; created_at: string }>>([]);
  const b2cFn = useServerFn(adminB2CWithdraw);

  const refresh = async () => {
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("*").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    setIsAdmin(!!roles);
    const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    setHasAnyAdmin((count ?? 0) > 0);

    const { data: cfg } = await supabase.from("chat_settings").select("*").eq("id", 1).maybeSingle();
    if (cfg) { setFreeChat(cfg.free_chat_enabled); setCost(Number(cfg.message_cost_kes)); }

    if (roles) {
      const [{ data: us }, uc, mc, msgc, bc, { data: rms }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, is_vip, is_banned").order("created_at", { ascending: false }).limit(50),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("room_bookings").select("*", { count: "exact", head: true }),
        supabase.from("rooms").select("id, name, city, price_kes, is_active, capacity").order("created_at", { ascending: false }),
      ]);
      setUsers((us ?? []) as never);
      setStats({ users: uc.count ?? 0, matches: mc.count ?? 0, messages: msgc.count ?? 0, bookings: bc.count ?? 0 });
      setAdminRooms((rms ?? []) as never);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const onClaim = async () => {
    try {
      const { data, error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string };
      if (r.ok) { toast.success("You are now admin · VIP"); await refresh(); }
      else toast.error(r.reason ?? "Failed");
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleFree = async () => {
    const next = !freeChat;
    const { error } = await supabase.from("chat_settings").update({ free_chat_enabled: next, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { setFreeChat(next); toast.success(next ? "Free chat enabled" : "Paid chat enabled"); }
  };

  const updateCost = async (v: number) => {
    const { error } = await supabase.from("chat_settings").update({ message_cost_kes: v, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { setCost(v); toast.success("Cost updated"); }
  };

  const promote = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { toast.success("Promoted to admin"); refresh(); }
  };

  const giveCredit = async (uid: string) => {
    const v = prompt("Credit how many KES?"); if (!v) return;
    const amount = Number(v);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    try {
      await supabase.from("wallets").upsert({ user_id: uid, balance_kes: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: w, error: wErr } = await supabase.from("wallets").select("balance_kes").eq("user_id", uid).single();
      if (wErr) throw wErr;
      const next = Number(w?.balance_kes ?? 0) + amount;
      const { error: uErr } = await supabase.from("wallets").update({ balance_kes: next, updated_at: new Date().toISOString() }).eq("user_id", uid);
      if (uErr) throw uErr;
      await supabase.from("wallet_transactions").insert({ user_id: uid, amount_kes: amount, kind: "admin_credit" });
      toast.success("Balance now KES " + next);
    } catch (e) { toast.error((e as Error).message); }
  };

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("rooms").insert(newRoom);
    if (error) toast.error(error.message);
    else { toast.success("Room added"); setNewRoom({ name: "", city: "", price_kes: 3500, capacity: 2, cover_url: "", description: "" }); refresh(); }
  };

  const toggleRoom = async (id: string, next: boolean) => {
    const { error } = await supabase.from("rooms").update({ is_active: next }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(next ? "Room activated" : "Room hidden"); refresh(); }
  };
  const removeRoom = async (id: string) => {
    if (!confirm("Delete this room? Existing bookings will keep their reference.")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Room deleted"); refresh(); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-blood" /></div>;

  if (!isAdmin) {
    return (
      <div className="relative min-h-screen bg-background noise-overlay">
        <header className="px-5 pt-6 safe-top"><Link to="/me" className="text-sm text-muted-foreground"><ArrowLeft className="inline h-4 w-4" /> Back</Link></header>
        <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blood/15"><Shield className="h-7 w-7 text-blood" /></div>
          <h1 className="mt-5 font-display text-2xl">Admin only</h1>
          {!hasAnyAdmin ? (
            <>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">No admin exists yet. Claim ownership of After Dark.</p>
              <button onClick={onClaim} className="mt-6 rounded-full bg-blood-gradient px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white glow-blood">Claim admin · VIP</button>
            </>
          ) : (
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Ask an existing admin to promote you.</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-12 noise-overlay">
      <header className="flex items-center gap-3 px-5 pt-6 safe-top">
        <Link to="/me" className="rounded-full p-2 hover:bg-card/60"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="font-display text-2xl tracking-tight">Admin</h1>
          <p className="text-[10px] uppercase tracking-wider text-blood flex items-center gap-1"><Crown className="h-3 w-3" /> Owner</p>
        </div>
      </header>

      <main className="px-5 pt-6 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          {[
            ["Users", stats.users], ["Matches", stats.matches], ["Messages", stats.messages], ["Bookings", stats.bookings],
          ].map(([l, v]) => (
            <div key={l as string} className="glass-card rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
              <p className="mt-1 font-display text-2xl">{v}</p>
            </div>
          ))}
        </section>

        {/* Chat settings */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-display text-lg">Chat billing</h2>
          <p className="mt-1 text-xs text-muted-foreground">Free chat is ON until M-Pesa & Paystack are wired.</p>
          <button onClick={toggleFree} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
            <span className="flex items-center gap-2 text-sm"><Power className={`h-4 w-4 ${freeChat ? "text-success" : "text-blood"}`} /> Free chat</span>
            <span className={`text-xs font-bold uppercase ${freeChat ? "text-success" : "text-blood"}`}>{freeChat ? "ON" : "OFF"}</span>
          </button>
          <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-foreground">Cost per message (KES)</label>
          <input type="number" step="0.05" min="0" value={cost} onChange={(e) => setCost(Number(e.target.value))} onBlur={(e) => updateCost(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:outline-none" />
        </section>

        {/* Add room */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-display text-lg">Add room</h2>
          <form onSubmit={addRoom} className="mt-3 space-y-2">
            <input required placeholder="Name" value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
            <input placeholder="City" value={newRoom.city} onChange={(e) => setNewRoom({ ...newRoom, city: e.target.value })} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Price/hr KES" value={newRoom.price_kes} onChange={(e) => setNewRoom({ ...newRoom, price_kes: Number(e.target.value) })} className="rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
              <input type="number" placeholder="Capacity" value={newRoom.capacity} onChange={(e) => setNewRoom({ ...newRoom, capacity: Number(e.target.value) })} className="rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
            </div>
            <input placeholder="Cover image URL" value={newRoom.cover_url} onChange={(e) => setNewRoom({ ...newRoom, cover_url: e.target.value })} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
            <textarea placeholder="Description" value={newRoom.description} onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm" />
            <button className="flex w-full items-center justify-center gap-2 rounded-full bg-blood-gradient py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood"><Plus className="h-4 w-4" /> Create room</button>
          </form>
        </section>

        {/* Manage rooms */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-display text-lg">Manage rooms ({adminRooms.length})</h2>
          <ul className="mt-3 divide-y divide-border/60">
            {adminRooms.length === 0 && <li className="py-3 text-xs text-muted-foreground">No rooms yet. Add one above.</li>}
            {adminRooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.city ?? "—"} · KES {Number(r.price_kes).toLocaleString()}/hr · cap {r.capacity} · {r.is_active ? <span className="text-success">live</span> : <span className="text-muted-foreground">hidden</span>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleRoom(r.id, !r.is_active)} className="rounded-full border border-border/60 px-3 py-1.5 text-[10px] uppercase tracking-wider hover:border-blood/40">
                    {r.is_active ? <><EyeOff className="inline h-3 w-3" /> Hide</> : <><Eye className="inline h-3 w-3" /> Show</>}
                  </button>
                  <button onClick={() => removeRoom(r.id)} className="rounded-full border border-blood/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-blood hover:bg-blood/10"><Trash2 className="inline h-3 w-3" /> Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Users */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-display text-lg">Members ({users.length})</h2>
          <ul className="mt-3 divide-y divide-border/60">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm">{u.full_name ?? u.username ?? u.id.slice(0, 8)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {u.is_vip && <span className="text-blood">VIP · </span>}{u.is_banned ? "Banned" : "Active"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => giveCredit(u.id)} className="rounded-full border border-border/60 px-3 py-1.5 text-[10px] uppercase tracking-wider hover:border-blood/40"><Wallet className="inline h-3 w-3" /> Credit</button>
                  <button onClick={() => promote(u.id)} className="rounded-full border border-border/60 px-3 py-1.5 text-[10px] uppercase tracking-wider hover:border-blood/40">Make admin</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
