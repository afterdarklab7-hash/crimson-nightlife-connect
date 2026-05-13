import { Link, useRouterState } from "@tanstack/react-router";
import { Flame, MessageCircle, Hotel, User2, Sparkles } from "lucide-react";

const items = [
  { to: "/discover", label: "Discover", icon: Flame },
  { to: "/matches", label: "Matches", icon: Sparkles },
  { to: "/rooms", label: "Rooms", icon: Hotel },
  { to: "/messages", label: "Chat", icon: MessageCircle },
  { to: "/me", label: "Me", icon: User2 },
] as const;

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom border-t border-border/60 bg-coal/90 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors data-[active=true]:text-foreground"
                data-active={active}
              >
                <span className="relative">
                  <Icon className={`h-5 w-5 ${active ? "text-blood" : ""}`} strokeWidth={active ? 2.4 : 1.8} />
                  {active && <span className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blood glow-blood" />}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
