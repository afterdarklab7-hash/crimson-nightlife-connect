import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

/** Subscribes to new messages addressed to the current user.
 *  - Asks for browser Notification permission once.
 *  - When a new message arrives and the tab/app is hidden (or it's not the active thread),
 *    pops a system notification. Click navigates to the thread. */
export function MessageNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const askedRef = useRef(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!askedRef.current && Notification.permission === "default") {
      askedRef.current = true;
      // Request lazily once user is authenticated
      Notification.requestPermission().catch(() => {});
    }

    const ch = supabase
      .channel("notify-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const msg = payload.new as { sender_id: string; body: string; match_id: string };
          // Skip if the user is currently looking at this thread
          if (typeof document !== "undefined" && !document.hidden && window.location.pathname.includes(msg.match_id)) {
            return;
          }
          if (Notification.permission !== "granted") return;
          let name = "Someone";
          try {
            const { data } = await supabase.from("profiles").select("full_name, username").eq("id", msg.sender_id).maybeSingle();
            name = data?.full_name ?? data?.username ?? "Someone";
          } catch { /* noop */ }
          try {
            const n = new Notification(`${name} sent you a message`, {
              body: msg.body.slice(0, 140),
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: "msg-" + msg.match_id,
            });
            n.onclick = () => {
              window.focus();
              navigate({ to: "/messages/$matchId", params: { matchId: msg.match_id } });
              n.close();
            };
          } catch { /* noop */ }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, navigate]);

  return null;
}
