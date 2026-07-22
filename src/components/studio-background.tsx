export function StudioBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
      {/* Faint dot grid — the "studio" texture, restrained and static. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklch, var(--foreground), transparent 30%) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Glow sources — teal, amber and a center wash. Dark mode wants them bright
          enough to read through the frosted glass; light mode needs them much
          fainter or the tint looks garish against a bright canvas. */}
      <div
        className="absolute -left-1/4 -top-1/3 size-[48rem] rounded-full opacity-[0.12] blur-[130px] dark:opacity-[0.35]"
        style={{ background: "var(--primary)" }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 size-[44rem] rounded-full opacity-[0.09] blur-[140px] dark:opacity-[0.28]"
        style={{ background: "var(--accent)" }}
      />
      <div
        className="absolute left-1/2 top-1/2 size-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.05] blur-[160px] dark:opacity-[0.14]"
        style={{ background: "var(--chart-3)" }}
      />
      {/* Vignette to keep edges receding into the canvas — eased back so color still reaches center panels. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_65%,var(--background)_100%)]" />
    </div>
  );
}
