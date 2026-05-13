import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ad_install_dismissed_at";
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export function InstallBanner() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't show inside lovable preview iframe
    try { if (window.self !== window.top) return; } catch { return; }
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < SNOOZE_MS) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari: no beforeinstallprompt — show manual hint
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIOS) { setIosHint(true); setVisible(true); }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blood/40 bg-coal/95 p-3 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] backdrop-blur-xl mx-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blood-gradient glow-blood">
        <Download className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Install After Dark</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {iosHint ? "Tap Share → Add to Home Screen" : "One tap. Full-screen. Always close."}
        </p>
      </div>
      {!iosHint && evt && (
        <button onClick={install} className="rounded-full bg-blood-gradient px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white glow-blood">
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
