import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Daraja B2C QueueTimeoutURL — mark request as timed out.
export const Route = createFileRoute("/api/public/mpesa/b2c-timeout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown> = {};
        try { payload = await request.json(); } catch { /* */ }
        const r = (payload.Result ?? {}) as Record<string, unknown>;
        const conv = (r.ConversationID as string | undefined) ?? "";
        const orig = (r.OriginatorConversationID as string | undefined) ?? "";
        const filter = conv ? { col: "conversation_id", val: conv } : { col: "originator_conversation_id", val: orig };
        if (filter.val) {
          await supabaseAdmin.from("withdrawals").update({
            status: "timeout", raw: payload as never, updated_at: new Date().toISOString(),
          }).eq(filter.col, filter.val);
        }
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "ok" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
