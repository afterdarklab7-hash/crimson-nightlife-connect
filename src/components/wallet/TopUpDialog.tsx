import { useState, useEffect, useRef } from "react";
import { X, Loader2, Smartphone, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { initiateStkPush, checkTopupStatus } from "@/lib/payments.functions";
import { toast } from "sonner";

const PACKAGES = [
  { kes: 100, label: "Starter", perk: "~400 messages" },
  { kes: 250, label: "Casual", perk: "~1,000 messages" },
  { kes: 500, label: "Regular", perk: "~2,000 messages + 1 boost" },
  { kes: 1000, label: "Heavy", perk: "~4,000 messages + 3 boosts" },
  { kes: 2500, label: "VIP", perk: "Unlimited weekend + boosts" },
  { kes: 5000, label: "Elite", perk: "Unlimited month + boosts" },
];

export function TopUpDialog({ open, onClose, defaultPhone, onPaid }: {
  open: boolean; onClose: () => void; defaultPhone?: string; onPaid?: () => void;
}) {
  const [amount, setAmount] = useState<number>(250);
  const [phone, setPhone] = useState<string>(defaultPhone ?? "");
  const [step, setStep] = useState<"choose" | "pending" | "paid" | "failed">("choose");
  const [apiRef, setApiRef] = useState<string | null>(null);
  const stkFn = useServerFn(initiateStkPush);
  const checkFn = useServerFn(checkTopupStatus);
  const pollRef = useRef<number | null>(null);

  useEffect(() => { if (defaultPhone) setPhone(defaultPhone); }, [defaultPhone]);

  useEffect(() => {
    if (step !== "pending" || !apiRef) return;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const r = await checkFn({ data: { api_ref: apiRef } });
        if (r.status === "paid") { setStep("paid"); onPaid?.(); return; }
        if (r.status === "failed") { setStep("failed"); return; }
      } catch { /* keep polling */ }
      if (attempts < 30) pollRef.current = window.setTimeout(tick, 4000);
      else setStep("failed");
    };
    pollRef.current = window.setTimeout(tick, 5000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [step, apiRef, checkFn, onPaid]);

  const submit = async () => {
    if (!/^(?:0|254|\+254)?[71]\d{8}$/.test(phone.replace(/\s/g, ""))) {
      toast.error("Enter a valid Kenyan phone (e.g. 0712345678)"); return;
    }
    setStep("pending");
    try {
      const r = await stkFn({ data: { amount_kes: amount, phone } });
      setApiRef(r.api_ref);
      toast.success("STK push sent. Enter your M-Pesa PIN on your phone.");
    } catch (e) {
      setStep("failed");
      toast.error((e as Error).message || "Failed to send STK push");
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl noise-overlay" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-card/60"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-2xl">Top up wallet</h2>
        <p className="text-xs text-muted-foreground">M-Pesa STK Push · instant</p>

        {step === "choose" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {PACKAGES.map((p) => (
                <button key={p.kes} onClick={() => setAmount(p.kes)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${amount === p.kes ? "border-blood bg-blood/10" : "border-border/60 bg-card/40 hover:border-blood/40"}`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</p>
                  <p className="font-display text-lg">KES {p.kes.toLocaleString()}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{p.perk}</p>
                </button>
              ))}
            </div>

            <label className="mt-4 block text-[10px] uppercase tracking-wider text-muted-foreground">M-Pesa phone</label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678"
                className="flex-1 bg-transparent text-sm focus:outline-none" inputMode="tel" />
            </div>

            <button onClick={submit}
              className="mt-5 w-full rounded-full bg-blood-gradient py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white glow-blood">
              Pay KES {amount.toLocaleString()}
            </button>
          </>
        )}

        {step === "pending" && (
          <div className="mt-8 flex flex-col items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blood" />
            <p className="mt-4 font-display text-lg">Check your phone</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Enter your M-Pesa PIN to complete the KES {amount} top-up. We're listening for confirmation.</p>
            <button onClick={onClose} className="mt-6 text-xs text-muted-foreground underline">Close (we'll credit when paid)</button>
          </div>
        )}

        {step === "paid" && (
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15"><Check className="h-7 w-7 text-success" /></div>
            <p className="mt-4 font-display text-lg">KES {amount} credited</p>
            <button onClick={onClose} className="mt-6 rounded-full bg-blood-gradient px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white">Done</button>
          </div>
        )}

        {step === "failed" && (
          <div className="mt-8 flex flex-col items-center text-center">
            <p className="font-display text-lg text-blood">Payment didn't go through</p>
            <p className="mt-1 text-xs text-muted-foreground">It may have been cancelled or timed out.</p>
            <button onClick={() => setStep("choose")} className="mt-6 rounded-full border border-border px-6 py-2 text-xs uppercase tracking-wider">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
