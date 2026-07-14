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
      {/* Two quiet glow sources — primary teal upper-left, amber lower-right — well below saturation of a hero element. */}
      <div
        className="absolute -left-1/4 -top-1/3 size-[42rem] rounded-full opacity-[0.16] blur-[140px]"
        style={{ background: "var(--primary)" }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 size-[38rem] rounded-full opacity-[0.1] blur-[150px]"
        style={{ background: "var(--accent)" }}
      />
      {/* Vignette to keep edges receding into the canvas. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,var(--background)_100%)]" />
    </div>
  );
}
