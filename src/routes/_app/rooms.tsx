import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hotel, MapPin, Users, Loader2, Calendar, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/layout/MobileNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rooms")({
  component: Rooms,
});

type Room = {
  id: string; name: string; description: string | null; city: string | null;
  address: string | null; price_kes: number; capacity: number; cover_url: string | null;
  amenities: string[] | null;
};

function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Room | null>(null);
  const [date, setDate] = useState("");
  const [hours, setHours] = useState(3);
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("rooms").select("*").eq("is_active", true).order("price_kes").then(({ data }) => {
      setRooms((data ?? []) as Room[]); setLoading(false);
    });
  }, []);

  const book = async () => {
    if (!user || !open || !date) return;
    setBusy(true);
    const starts = new Date(date);
    const ends = new Date(starts.getTime() + hours * 3600 * 1000);
    const total = Number(open.price_kes) * hours;
    const { data, error } = await supabase.from("room_bookings").insert({
      room_id: open.id, user_id: user.id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      guests, total_kes: total, status: "pending",
    }).select("confirmation_code").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setConfirmed(data.confirmation_code);
    toast.success("Booking received. Pay on arrival or via M-Pesa link.");
  };

  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <header className="px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Rooms</h1>
        <p className="mt-1 text-sm text-muted-foreground">Curated suites. Tap to book.</p>
      </header>

      <main className="px-5 pt-6">
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blood" /></div>
        ) : rooms.length === 0 ? (
          <div className="flex h-[40vh] flex-col items-center justify-center text-center">
            <Hotel className="h-7 w-7 text-blood" />
            <p className="mt-3 text-sm text-muted-foreground">No rooms available right now.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rooms.map((r) => (
              <li key={r.id} className="glass-card overflow-hidden rounded-3xl">
                <div className="relative aspect-[16/10] bg-onyx">
                  {r.cover_url && <img src={r.cover_url} alt={r.name} className="h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4">
                    <div>
                      <h3 className="font-display text-xl text-white">{r.name}</h3>
                      <p className="mt-1 flex items-center gap-3 text-[11px] text-white/70">
                        {r.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />Up to {r.capacity}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-white/60">From</p>
                      <p className="font-display text-lg text-blood">KES {Number(r.price_kes).toLocaleString()}<span className="text-xs text-white/60">/hr</span></p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  {r.amenities && r.amenities.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {r.amenities.map((a) => (
                        <li key={a} className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{a}</li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => { setOpen(r); setConfirmed(null); setDate(""); setHours(3); setGuests(2); }} className="mt-4 w-full rounded-full bg-blood-gradient py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood">
                    Book this room
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x-0 border-b-0 p-6 safe-bottom" onClick={(e) => e.stopPropagation()}>
            {confirmed ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/20"><Check className="h-7 w-7 text-success" /></div>
                <h3 className="mt-4 font-display text-xl">Booking confirmed</h3>
                <p className="mt-2 text-sm text-muted-foreground">Show this code at check-in.</p>
                <p className="mt-4 font-mono text-2xl tracking-widest text-blood">{confirmed}</p>
                <p className="mt-2 text-xs text-muted-foreground">M-Pesa STK push will be sent once payments are live.</p>
                <button onClick={() => { setOpen(null); }} className="mt-6 w-full rounded-full bg-blood-gradient py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood">Done</button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-2xl">{open.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{open.address ?? open.city}</p>

                <label className="mt-5 block text-[10px] uppercase tracking-wider text-muted-foreground">Date & time</label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-input px-3 py-3">
                  <Calendar className="h-4 w-4 text-blood" />
                  <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
                </div>

                <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-foreground">Hours</label>
                <input type="number" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:outline-none" />

                <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-foreground">Guests</label>
                <input type="number" min={1} max={open.capacity} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:outline-none" />

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-display text-2xl text-blood">KES {(Number(open.price_kes) * hours).toLocaleString()}</span>
                </div>

                <button onClick={book} disabled={!date || busy} className="mt-5 w-full rounded-full bg-blood-gradient py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood disabled:opacity-50">
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Confirm booking"}
                </button>
                <button onClick={() => setOpen(null)} className="mt-2 w-full py-3 text-xs uppercase tracking-wider text-muted-foreground">Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}
