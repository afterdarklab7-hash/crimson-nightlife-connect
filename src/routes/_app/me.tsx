import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, Crown, MapPin, Edit3, EyeOff, Eye, Shield, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/layout/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/me")({
  component: Me,
});

function Me() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("photos").select("url").eq("user_id", user.id).eq("is_primary", true).maybeSingle().then(({ data }) => setPhoto(data?.url ?? null));
    supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => setIsAdmin(!!data));
    supabase.from("wallets").select("balance_kes").eq("user_id", user.id).maybeSingle().then(({ data }) => setBalance(Number(data?.balance_kes ?? 0)));
  }, [user]);

  const toggleHidden = async () => {
    if (!user || !profile) return;
    const next = !(profile as unknown as { is_hidden?: boolean }).is_hidden;
    const { error } = await supabase.from("profiles").update({ is_hidden: next }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? "Hidden mode on" : "Hidden mode off");
      await refreshProfile();
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-24 noise-overlay">
      <div className="pointer-events-none absolute -top-40 right-0 h-[300px] w-[300px] rounded-full bg-blood/15 blur-[120px]" />

      <header className="relative px-5 pt-6 safe-top">
        <h1 className="font-display text-3xl tracking-tight">Profile</h1>
      </header>

      <main className="relative px-5 pt-8">
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="relative aspect-[3/2] bg-onyx">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">No photo</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="font-display text-2xl text-white">
                {profile?.full_name ?? profile?.username ?? "Member"}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/75">
                {profile?.username && <span>@{profile.username}</span>}
                {profile?.city && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.city}</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile?.is_vip && (
                  <span className="flex items-center gap-1 rounded-full bg-blood px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
                    <Crown className="h-3 w-3" /> VIP
                  </span>
                )}
                {profile?.is_verified ? (
                  <span className="flex items-center gap-1 rounded-full bg-coal/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">
                    <ShieldCheck className="h-3 w-3 text-blood" /> Verified
                  </span>
                ) : (
                  <span className="rounded-full border border-border/60 bg-card/40 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    Unverified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 glass-card flex items-center justify-between rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/60"><Wallet className="h-4 w-4 text-blood" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</p>
              <p className="font-display text-xl">KES {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <span className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">M-Pesa soon</span>
        </div>

        <ul className="mt-4 space-y-2">
          <Row icon={<Edit3 className="h-4 w-4" />} label="Edit profile" sub="Bio, photos, preferences" onClick={() => navigate({ to: "/onboarding" })} />
          <Row
            icon={(profile as unknown as { is_hidden?: boolean })?.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            label="Hidden mode"
            sub={(profile as unknown as { is_hidden?: boolean })?.is_hidden ? "Your profile is hidden" : "Browse without being seen"}
            onClick={toggleHidden}
          />
          <Row icon={<Shield className="h-4 w-4 text-blood" />} label={isAdmin ? "Admin console" : "Become admin"} sub={isAdmin ? "Manage everything" : "Claim ownership"} onClick={() => navigate({ to: "/admin" })} />
          <Row icon={<LogOut className="h-4 w-4 text-blood" />} label="Sign out" sub="See you tonight" onClick={async () => { await signOut(); navigate({ to: "/" }); }} />
        </ul>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          AFTER DARK · 18+
        </p>
      </main>
      <MobileNav />
    </div>
  );
}

function Row({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="glass-card flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left transition-colors hover:border-blood/40">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/60">{icon}</div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </button>
    </li>
  );
}
