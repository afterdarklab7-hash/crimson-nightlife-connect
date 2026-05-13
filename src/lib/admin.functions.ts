import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Bootstrap: if no admin exists yet, promote the caller. Otherwise no-op.
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false, reason: "Admin already exists" };
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      target_user_id: z.string().uuid(),
      role: z.enum(["user", "moderator", "admin"]),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    // Verify caller is admin
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.target_user_id, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), amount_kes: z.number().min(1).max(1000000) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!isAdmin) throw new Error("Forbidden");
    await supabaseAdmin.from("wallets").upsert({ user_id: data.user_id, balance_kes: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: w } = await supabaseAdmin.from("wallets").select("balance_kes").eq("user_id", data.user_id).single();
    const next = Number(w?.balance_kes ?? 0) + data.amount_kes;
    await supabaseAdmin.from("wallets").update({ balance_kes: next, updated_at: new Date().toISOString() }).eq("user_id", data.user_id);
    await supabaseAdmin.from("wallet_transactions").insert({ user_id: data.user_id, amount_kes: data.amount_kes, kind: "admin_credit" });
    return { ok: true, balance: next };
  });
