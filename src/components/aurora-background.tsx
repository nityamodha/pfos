export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
      <div
        className="aurora-blob -left-32 -top-32 size-[34rem] bg-indigo-400 opacity-70"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="aurora-blob -right-24 top-1/4 size-[28rem] bg-cyan-300 opacity-65"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="aurora-blob bottom-[-8rem] left-1/4 size-[32rem] bg-fuchsia-400 opacity-65"
        style={{ animationDelay: "-16s" }}
      />
      <div
        className="aurora-blob right-1/4 bottom-0 size-[24rem] bg-amber-300 opacity-55"
        style={{ animationDelay: "-22s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_68%)]" />
    </div>
  );
}
