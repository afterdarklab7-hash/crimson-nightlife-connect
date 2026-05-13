import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Calendar, Camera, Check, Loader2, MapPin, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = 0 | 1 | 2 | 3 | 4;

function Onboarding() {
  const { user, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string>("");
  const [hosting, setHosting] = useState<string>("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" as const } });
  }, [loading, user, navigate]);

  // Prefill from existing profile so re-edits don't wipe data
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!data) return;
      if (data.full_name) setFullName(data.full_name);
      if (data.username) setUsername(data.username);
      if (data.dob) setDob(data.dob);
      if (data.gender) setGender(data.gender);
      if (data.hosting) setHosting(data.hosting);
      if (data.bio) setBio(data.bio);
      if (data.city) setCity(data.city);
      if (data.lat && data.lng) setCoords({ lat: data.lat, lng: data.lng });
    })();
  }, [user]);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next = files.slice(0, 6 - photos.length).map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next]);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location captured");
      },
      () => toast.error("Permission denied — you can add it later"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const ageOk = (() => {
    if (!dob) return false;
    const d = new Date(dob);
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    return d <= eighteen;
  })();

  const [hasExistingPhotos, setHasExistingPhotos] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => setHasExistingPhotos((count ?? 0) > 0));
  }, [user]);

  const canNext = (): boolean => {
    if (step === 0) return fullName.trim().length >= 2 && /^[a-z0-9_]{3,20}$/i.test(username);
    if (step === 1) return ageOk && !!gender;
    if (step === 2) return !!hosting;
    if (step === 3) return photos.length >= 1 || hasExistingPhotos;
    return true;
  };

  const finish = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload photos (replace any existing set so re-edits don't pile up)
      const uploaded: { url: string; position: number; is_primary: boolean }[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("profile-photos").upload(path, p.file, { upsert: false, contentType: p.file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, position: i, is_primary: i === 0 });
      }
      if (uploaded.length) {
        // Wipe previous photos so the new set is the source of truth
        await supabase.from("photos").delete().eq("user_id", user.id);
        const { error: phErr } = await supabase
          .from("photos")
          .insert(uploaded.map((u) => ({ ...u, user_id: user.id })));
        if (phErr) throw phErr;
      }

      // Update profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          username: username.toLowerCase(),
          dob,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gender: gender as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hosting: hosting as any,
          bio,
          city: city || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          onboarded: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // assign default role (idempotent)
      await supabase.from("user_roles").upsert({ user_id: user.id, role: "user" }, { onConflict: "user_id,role", ignoreDuplicates: true });

      // log location once
      if (coords) {
        await supabase.from("location_logs").insert({ user_id: user.id, lat: coords.lat, lng: coords.lng });
      }

      await refreshProfile();
      toast.success("Welcome inside.");
      navigate({ to: "/discover" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save profile";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-blood" />
      </div>
    );
  }

  const totalSteps = 5;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground noise-overlay">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-blood/20 blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8 safe-top">
        <Logo />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Step {step + 1}/{totalSteps}
        </span>
      </header>

      {/* progress */}
      <div className="relative z-10 mx-auto mt-6 flex max-w-md gap-1.5 px-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-blood" : "bg-border/60"}`} />
        ))}
      </div>

      <main className="relative z-10 mx-auto max-w-md px-6 pt-10 pb-32">
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Who are you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Members see your name & handle.</p>
            <div className="mt-8 space-y-4">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Asha K." className="input-base" maxLength={60} />
              </Field>
              <Field label="Username">
                <div className="flex items-center">
                  <span className="pl-1 text-sm text-muted-foreground">@</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="ashak" className="input-base ml-1 flex-1" maxLength={20} />
                </div>
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Some basics.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Adults only — 18+ required.</p>
            <div className="mt-8 space-y-4">
              <Field label="Date of birth">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-base" />
                </div>
                {dob && !ageOk && <p className="mt-2 text-xs text-destructive">Must be 18 or older.</p>}
              </Field>
              <div>
                <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gender</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "female", l: "Woman" },
                    { v: "male", l: "Man" },
                    { v: "non_binary", l: "Non-binary" },
                    { v: "other", l: "Other" },
                  ].map((o) => (
                    <Chip key={o.v} active={gender === o.v} onClick={() => setGender(o.v)}>
                      {o.l}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Tonight,<br />you're…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Pick what fits. You can change it anytime.</p>
            <div className="mt-8 grid gap-3">
              {[
                { v: "hosting", l: "Hosting", s: "I have a place" },
                { v: "to_be_hosted", l: "To be hosted", s: "Looking for a place" },
                { v: "lets_get_a_room", l: "Let's get a room", s: "Browse curated rooms" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setHosting(o.v)}
                  className={`glass-card flex items-center justify-between rounded-2xl px-5 py-4 text-left transition-all ${
                    hosting === o.v ? "ring-blood border-blood/60" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{o.l}</p>
                    <p className="text-xs text-muted-foreground">{o.s}</p>
                  </div>
                  {hosting === o.v && <Check className="h-4 w-4 text-blood" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Show yourself.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Add 1–6 photos. First is your primary.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-blood px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">Primary</span>}
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, ix) => ix !== i))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-coal/80 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="glass-card flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl text-muted-foreground transition-colors hover:text-foreground">
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] uppercase tracking-wider">Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoPick} />
                </label>
              )}
            </div>
            <div className="mt-6">
              <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Bio (optional)</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} placeholder="A little about your night…" className="input-base resize-none" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-display text-3xl tracking-tight">Where are you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">We use this to show people near you. Approximate only.</p>
            <div className="mt-8 space-y-4">
              <button
                type="button"
                onClick={requestLocation}
                className={`glass-card flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left ${coords ? "ring-blood" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blood-gradient glow-blood">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{coords ? "Location captured" : "Use my current location"}</p>
                    <p className="text-xs text-muted-foreground">{coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "Tap to share"}</p>
                  </div>
                </div>
                {coords ? <Check className="h-4 w-4 text-blood" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Field label="City (optional)">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Nairobi" className="input-base" maxLength={60} />
              </Field>
            </div>
          </div>
        )}
      </main>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 safe-bottom border-t border-border/60 bg-coal/95 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="h-12 flex-1 rounded-2xl border border-border bg-card/40 text-sm uppercase tracking-[0.18em] text-muted-foreground"
            >
              Back
            </button>
          )}
          <button
            type="button"
            disabled={!canNext() || submitting}
            onClick={() => {
              if (step === 4) finish();
              else setStep((s) => (s + 1) as Step);
            }}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-blood-gradient text-sm font-semibold uppercase tracking-[0.18em] text-white glow-blood transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                {step === 4 ? "Enter After Dark" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          background: oklch(0.07 0.005 20 / 0.6);
          border: 1px solid oklch(0.18 0.01 20 / 0.6);
          border-radius: 0.875rem;
          padding: 0.875rem 1rem;
          font-size: 0.95rem;
          color: var(--foreground);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-base:focus {
          border-color: var(--blood);
          box-shadow: 0 0 0 3px oklch(0.52 0.22 22 / 0.18);
        }
        .input-base::placeholder { color: oklch(0.50 0.01 20); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm transition-all ${
        active ? "border-blood/60 bg-blood/10 text-foreground ring-blood" : "border-border bg-card/40 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
