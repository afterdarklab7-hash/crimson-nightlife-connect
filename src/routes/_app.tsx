import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MessageNotifier } from "@/components/messaging/MessageNotifier";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { mode: "signin" as const } });
    }
    // If onboarding incomplete, force-redirect (except when already on it)
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!prof?.onboarded && location.pathname !== "/onboarding") {
        throw redirect({ to: "/onboarding" });
      }
    }
  },
  component: () => (
    <>
      <MessageNotifier />
      <Outlet />
    </>
  ),
});
