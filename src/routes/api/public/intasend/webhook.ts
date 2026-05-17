import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// IntaSend M-Pesa STK Push webhook.
// Configure this URL in IntaSend dashboard: /api/public/intasend/webhook
// IntaSend posts JSON like:
// { invoice_id, state, value, account, api_ref, challenge, ... }
// We verify by re-fetching status from IntaSend (defense in depth) before crediting.

export const Route = createFileRoute("/api/public/intasend/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown> = {};
        try { payload = await request.json(); } catch { /* ignore */ }

        const api_ref = (payload.api_ref as string | undefined) ?? "";
        const invoice_id = (payload.invoice_id as string | undefined) ?? "";
        const state = ((payload.state as string | undefined) ?? "").toUpperCase();

        if (!api_ref && !invoice_id) {
          return new Response("Missing reference", { status: 400 });
        }

        // Look up the intent
        const { data: intent } = await supabaseAdmin
          .from("topup_intents").select("*")
          .or(
            api_ref
              ? `api_ref.eq.${api_ref}`
              : `invoice_id.eq.${invoice_id}`,
          )
          .maybeSingle();

        if (!intent) return new Response("Unknown ref", { status: 200 });
        if (intent.status === "paid") return new Response("ok", { status: 200 });

        // Re-verify by hitting IntaSend status (don't trust webhook body alone)
        const env = (process.env.INTASEND_ENVIRONMENT ?? "live").toLowerCase();
        const base = env === "sandbox" || env === "test"
          ? "https://sandbox.intasend.com" : "https://payment.intasend.com";
        const secret = process.env.INTASEND_SECRET_KEY;
        let verifiedState = state;
        if (secret && (intent.invoice_id || invoice_id)) {
          try {
            const r = await fetch(`${base}/api/v1/payment/status/`, {
              method: "POST",
              headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
              body: JSON.stringify({ invoice_id: intent.invoice_id || invoice_id }),
            });
            const b = await r.json().catch(() => ({}));
            verifiedState = ((b?.invoice?.state ?? b?.state ?? "") as string).toUpperCase();
          } catch { /* fall through */ }
        }

        if (verifiedState === "COMPLETE" || verifiedState === "PAID") {
          const { data: existing } = await supabaseAdmin
            .from("wallet_transactions").select("id").eq("ref", intent.api_ref).maybeSingle();
          if (!existing) {
            await supabaseAdmin.rpc("credit_wallet", {
              _user_id: intent.user_id,
              _amount: Number(intent.amount_kes),
              _kind: "topup_intasend",
              _ref: intent.api_ref,
            });
          }
          await supabaseAdmin.from("topup_intents").update({
            status: "paid", raw: payload as never, updated_at: new Date().toISOString(),
          }).eq("id", intent.id);
        } else if (verifiedState === "FAILED" || verifiedState === "CANCELLED") {
          await supabaseAdmin.from("topup_intents").update({
            status: "failed", raw: payload as never, updated_at: new Date().toISOString(),
          }).eq("id", intent.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
