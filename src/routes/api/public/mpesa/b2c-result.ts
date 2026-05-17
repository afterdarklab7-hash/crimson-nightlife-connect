import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Daraja B2C ResultURL callback.
// Body shape: { Result: { ResultCode, ResultDesc, ConversationID, OriginatorConversationID, ... } }
export const Route = createFileRoute("/api/public/mpesa/b2c-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { Result?: Record<string, unknown> } = {};
        try { payload = await request.json(); } catch { /* */ }
        const r = payload.Result ?? {};
        const conv = (r.ConversationID as string | undefined) ?? "";
        const orig = (r.OriginatorConversationID as string | undefined) ?? "";
        const code = r.ResultCode;
        const status = code === 0 || code === "0" ? "paid" : "failed";

        const filter = conv
          ? { col: "conversation_id", val: conv }
          : { col: "originator_conversation_id", val: orig };
        if (filter.val) {
          await supabaseAdmin.from("withdrawals").update({
            status, raw: payload as never, updated_at: new Date().toISOString(),
          }).eq(filter.col, filter.val);
        }
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "ok" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
