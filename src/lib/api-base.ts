// When the static frontend is hosted off-platform (e.g. cPanel), all
// TanStack server-function RPCs and /api/* routes must be sent to the
// Lovable-hosted backend instead of the current origin.
//
// Set VITE_API_BASE at build time, e.g.:
//   VITE_API_BASE=https://crimson-nightlife-connect.lovable.app bun run build
//
// On Lovable-hosted previews/published, leave it unset — requests stay
// same-origin.

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

if (typeof window !== "undefined" && API_BASE) {
  const sameOrigin = API_BASE === window.location.origin;
  if (!sameOrigin) {
    const origFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      try {
        let url: string;
        let req: Request | null = null;
        if (typeof input === "string") url = input;
        else if (input instanceof URL) url = input.toString();
        else { req = input; url = input.url; }

        // Only rewrite same-origin server-fn / api calls
        const isRelative = url.startsWith("/");
        const isCurrentOrigin = url.startsWith(window.location.origin);
        const path = isRelative
          ? url
          : isCurrentOrigin
            ? url.slice(window.location.origin.length)
            : null;

        if (path && (path.startsWith("/_serverFn") || path.startsWith("/api/"))) {
          const target = API_BASE + path;
          if (req) {
            const cloned = new Request(target, req);
            return origFetch(cloned, { ...init, credentials: "include" });
          }
          return origFetch(target, { ...(init ?? {}), credentials: "include" });
        }
      } catch { /* fall through */ }
      return origFetch(input as RequestInfo, init);
    }) as typeof fetch;
  }
}

export {};
