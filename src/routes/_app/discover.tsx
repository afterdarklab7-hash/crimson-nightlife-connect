import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, X, Star, MapPin, Loader2, Filter, Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/layout/MobileNav";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/discover")({
  component: Discover,
});

type Candidate = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  dob: string | null;
  city: string | null;
  hosting: string | null;
  is_verified: boolean;
  is_vip: boolean;
  lat: number | null;
  lng: number | null;
  photos: { url: string; position: number; is_primary: boolean }[];
};

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(x)));
}

function Discover() {
  const { user, profile } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadCandidates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // exclude self + already-swiped
      const { data: swipes } = await supabase.from("swipes").select("target_id").eq("swiper_id", user.id);
      const excluded = new Set([user.id, ...(swipes ?? []).map((s) => s.target_id)]);

      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, dob, city, hosting, is_verified, is_vip, lat, lng")
        .eq("onboarded", true)
        .eq("is_hidden", false)
        .eq("is_banned", false)
        .limit(50);
      if (error) throw error;

      const filtered = (profs ?? []).filter((p) => !excluded.has(p.id));
      const ids = filtered.map((p) => p.id);
      const photoMap = new Map<string, Candidate["photos"]>();
      if (ids.length) {
        const { data: photos } = await supabase
          .from("photos")
          .select("user_id, url, position, is_primary")
          .in("user_id", ids)
          .order("position");
        for (const ph of photos ?? []) {
          const arr = photoMap.get(ph.user_id) ?? [];
          arr.push({ url: ph.url, position: ph.position, is_primary: ph.is_primary });
          photoMap.set(ph.user_id, arr);
        }
      }
      setCandidates(
        filtered.map((p) => ({ ...p, photos: photoMap.get(p.id) ?? [] })),
      );
      setIdx(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load profiles";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const swipe = async (action: "like" | "super_like" | "pass") => {
    if (!user || swiping || idx >= candidates.length) return;
    const target = candidates[idx];
    setSwiping(true);
    try {
      const { error } = await supabase.from("swipes").insert({ swiper_id: user.id, target_id: target.id, action });
      if (error) throw error;
      if (action !== "pass") {
        // Check for new match
        const { data: match } = await supabase
          .from("matches")
          .select("id")
          .or(`and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`)
          .maybeSingle();
        if (match) toast.success("It's a match", { description: target.full_name ?? target.username ?? "Say hi soon." });
      }
      setIdx((i) => i + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't swipe";
      toast.error(msg);
    } finally {
      setSwiping(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-24 noise-overlay">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-blood/15 blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-6 safe-top">
        <Logo />
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/40 backdrop-blur">
          <Filter className="h-4 w-4" />
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-md px-5 pt-6">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blood" />
          </div>
        ) : idx >= candidates.length ? (
          <EmptyState onRefresh={loadCandidates} />
        ) : (
          <Card
            c={candidates[idx]}
            me={profile?.lat && profile?.lng ? { lat: profile.lat, lng: profile.lng } : null}
          />
        )}

        {idx < candidates.length && !loading && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <ActionButton label="Pass" onClick={() => swipe("pass")} disabled={swiping} variant="ghost">
              <X className="h-6 w-6" />
            </ActionButton>
            <ActionButton label="Super" onClick={() => swipe("super_like")} disabled={swiping} variant="super">
              <Star className="h-5 w-5 fill-current" />
            </ActionButton>
            <ActionButton label="Like" onClick={() => swipe("like")} disabled={swiping} variant="primary">
              <Heart className="h-7 w-7 fill-current" />
            </ActionButton>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}

function Card({ c, me }: { c: Candidate; me: { lat: number; lng: number } | null }) {
  const age = calcAge(c.dob);
  const km = me && c.lat && c.lng ? distKm(me, { lat: c.lat, lng: c.lng }) : null;
  const photo = c.photos.find((p) => p.is_primary)?.url ?? c.photos[0]?.url;

  return (
    <article className="glass-card relative overflow-hidden rounded-3xl">
      <div className="relative aspect-[3/4] w-full bg-onyx">
        {photo ? (
          <img src={photo} alt={c.full_name ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">No photo</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />

        {/* badges */}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          {c.is_vip && (
            <span className="rounded-full bg-blood px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white glow-blood">VIP</span>
          )}
          {c.is_verified && (
            <span className="flex items-center gap-1 rounded-full bg-coal/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <ShieldCheck className="h-3 w-3 text-blood" /> Verified
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl leading-tight tracking-tight text-white">
                {c.full_name ?? c.username ?? "Anonymous"}
                {age !== null && <span className="ml-2 text-2xl font-normal text-white/80">{age}</span>}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/75">
                {c.city && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>
                )}
                {km !== null && <span>· {km} km away</span>}
              </div>
            </div>
          </div>

          {c.hosting && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blood/15 border border-blood/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-blood backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {c.hosting === "hosting" ? "Hosting" : c.hosting === "to_be_hosted" ? "To be hosted" : "Let's get a room"}
            </span>
          )}

          {c.bio && <p className="mt-3 text-sm leading-snug text-white/85 line-clamp-3">{c.bio}</p>}
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  label,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  variant: "ghost" | "primary" | "super";
}) {
  const cls =
    variant === "primary"
      ? "h-16 w-16 bg-blood-gradient text-white glow-blood"
      : variant === "super"
      ? "h-12 w-12 bg-card border border-blood/60 text-blood"
      : "h-12 w-12 bg-card border border-border text-muted-foreground";
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blood/15">
        <Sparkles className="h-7 w-7 text-blood" />
      </div>
      <h3 className="mt-6 font-display text-2xl">You've seen everyone nearby</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Check back tonight — new members join after dark. Or expand your radius.
      </p>
      <button onClick={onRefresh} className="mt-6 rounded-full bg-blood-gradient px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white glow-blood">
        Refresh
      </button>
      <Link to="/me" className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        Edit preferences
      </Link>
    </div>
  );
}
