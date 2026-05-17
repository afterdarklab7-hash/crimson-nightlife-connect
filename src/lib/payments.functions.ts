import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Normalize Kenyan MSISDN to 254XXXXXXXXX
function normPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return "254" + d.slice(1);
  if (d.startsWith("7") || d.startsWith("1")) return "254" + d;
  return d;
}

// ---------- IntaSend STK Push (deposits) ----------

export const initiateStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      amount_kes: z.number().int().min(10).max(150000),
      phone: z.string().min(7).max(15),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const env = (process.env.INTASEND_ENVIRONMENT ?? "live").toLowerCase();
    const base = env === "sandbox" || env === "test"
      ? "https://sandbox.intasend.com"
      : "https://payment.intasend.com";
    const secret = process.env.INTASEND_SECRET_KEY;
    const pub = process.env.INTASEND_PUBLISHABLE_KEY;
    if (!secret || !pub) throw new Error("IntaSend not configured");

    const phone = normPhone(data.phone);
    const api_ref = `ad_${context.userId}_${Date.now()}`;

    // Record intent first
    await supabaseAdmin.from("topup_intents").insert({
      user_id: context.userId,
      amount_kes: data.amount_kes,
      phone,
      api_ref,
      status: "pending",
    });

    const res = await fetch(`${base}/api/v1/payment/mpesa-stk-push/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: pub,
        amount: data.amount_kes,
        phone_number: phone,
        api_ref,
        narrative: "After Dark wallet top-up",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      await supabaseAdmin.from("topup_intents").update({
        status: "failed", raw: body, updated_at: new Date().toISOString(),
      }).eq("api_ref", api_ref);
      throw new Error(body?.detail || body?.message || `STK push failed (${res.status})`);
    }

    const invoice_id = body?.invoice?.invoice_id ?? body?.invoice_id ?? null;
    await supabaseAdmin.from("topup_intents").update({
      invoice_id, raw: body, updated_at: new Date().toISOString(),
    }).eq("api_ref", api_ref);

    return { ok: true, api_ref, invoice_id };
  });

// Polling fallback (in case webhook is delayed)
export const checkTopupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ api_ref: z.string().min(1) }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: intent } = await supabaseAdmin
      .from("topup_intents").select("*").eq("api_ref", data.api_ref).maybeSingle();
    if (!intent || intent.user_id !== context.userId) throw new Error("Not found");
    if (intent.status === "paid") return { status: "paid" };

    const env = (process.env.INTASEND_ENVIRONMENT ?? "live").toLowerCase();
    const base = env === "sandbox" || env === "test"
      ? "https://sandbox.intasend.com" : "https://payment.intasend.com";
    const secret = process.env.INTASEND_SECRET_KEY!;
    if (!intent.invoice_id) return { status: intent.status };

    const res = await fetch(`${base}/api/v1/payment/status/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: intent.invoice_id }),
    });
    const body = await res.json().catch(() => ({}));
    const state = (body?.invoice?.state ?? body?.state ?? "").toString().toUpperCase();
    if (state === "COMPLETE" || state === "PAID") {
      // Credit once (idempotent via api_ref)
      const { data: existing } = await supabaseAdmin
        .from("wallet_transactions").select("id").eq("ref", data.api_ref).maybeSingle();
      if (!existing) {
        await supabaseAdmin.rpc("credit_wallet", {
          _user_id: intent.user_id,
          _amount: Number(intent.amount_kes),
          _kind: "topup_intasend",
          _ref: data.api_ref,
        });
      }
      await supabaseAdmin.from("topup_intents").update({
        status: "paid", raw: body, updated_at: new Date().toISOString(),
      }).eq("api_ref", data.api_ref);
      return { status: "paid" };
    }
    if (state === "FAILED" || state === "CANCELLED") {
      await supabaseAdmin.from("topup_intents").update({
        status: "failed", raw: body, updated_at: new Date().toISOString(),
      }).eq("api_ref", data.api_ref);
      return { status: "failed" };
    }
    return { status: "pending" };
  });

// ---------- Daraja B2C (admin withdrawals) ----------

async function darajaAccessToken(): Promise<string> {
  const env = (process.env.DARAJA_ENV ?? "live").toLowerCase();
  const base = env === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("Daraja consumer credentials missing");
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) throw new Error(`Daraja auth failed: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

export const adminB2CWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      phone: z.string().min(7).max(15),
      amount_kes: z.number().int().min(10).max(150000),
      target_user_id: z.string().uuid().optional(),
      remarks: z.string().max(100).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    // Verify admin
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles").select("id")
      .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!isAdmin) throw new Error("Forbidden");

    const env = (process.env.DARAJA_ENV ?? "live").toLowerCase();
    const base = env === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";

    const shortcode = process.env.DARAJA_B2C_SHORTCODE;
    const initiator = process.env.DARAJA_B2C_INTIATOR_NAME;
    const credential = process.env.DARAJA_B2C_SECURITY_CREDENTIAL;
    if (!shortcode || !initiator || !credential) throw new Error("Daraja B2C credentials missing");

    const phone = normPhone(data.phone);
    const originator_conversation_id = `AD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Record intent
    const { data: row } = await supabaseAdmin.from("withdrawals").insert({
      initiated_by: context.userId,
      target_user_id: data.target_user_id ?? null,
      phone, amount_kes: data.amount_kes,
      originator_conversation_id,
      status: "pending",
    }).select("id").single();

    const token = await darajaAccessToken();
    const origin = process.env.PUBLIC_BASE_URL || "https://crimson-nightlife-connect.lovable.app";
    const res = await fetch(`${base}/mpesa/b2c/v3/paymentrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        OriginatorConversationID: originator_conversation_id,
        InitiatorName: initiator,
        SecurityCredential: credential,
        CommandID: "BusinessPayment",
        Amount: data.amount_kes,
        PartyA: shortcode,
        PartyB: phone,
        Remarks: data.remarks ?? "After Dark withdrawal",
        QueueTimeOutURL: `${origin}/api/public/mpesa/b2c-timeout`,
        ResultURL: `${origin}/api/public/mpesa/b2c-result`,
        Occasion: "Withdrawal",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ResponseCode !== "0") {
      await supabaseAdmin.from("withdrawals").update({
        status: "failed", raw: body, updated_at: new Date().toISOString(),
      }).eq("id", row!.id);
      throw new Error(body?.errorMessage || body?.ResponseDescription || `B2C failed (${res.status})`);
    }
    await supabaseAdmin.from("withdrawals").update({
      conversation_id: body.ConversationID, raw: body, updated_at: new Date().toISOString(),
    }).eq("id", row!.id);
    return { ok: true, id: row!.id, conversation_id: body.ConversationID };
  });
