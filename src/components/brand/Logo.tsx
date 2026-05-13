export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 rounded-full bg-neon animate-pulse-blood" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-blood-gradient" />
      </span>
      <span className="font-display text-xl tracking-[0.18em] text-foreground">
        AFTER<span className="text-blood">DARK</span>
      </span>
    </div>
  );
}
