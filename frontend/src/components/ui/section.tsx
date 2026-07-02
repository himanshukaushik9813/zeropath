"use client";

/**
 * Section-identity shell. Each `variant` swaps the ambient background treatment
 * and layout rhythm so no two sections look alike. The heavy/animated visuals
 * are passed in per section; this provides the consistent frame + CSS ambience.
 */
export type SectionVariant =
  | "hero"
  | "explorer"
  | "proof"
  | "operate"
  | "architecture"
  | "compliance"
  | "marketplace"
  | "analytics"
  | "plain";

export function Section({
  children,
  variant = "plain",
  className,
  id,
  bleed = false,
}: {
  children: React.ReactNode;
  variant?: SectionVariant;
  className?: string;
  id?: string;
  /** full-bleed sections skip the inner max-width container */
  bleed?: boolean;
}) {
  return (
    <section id={id} className={`zp-section${className ? ` ${className}` : ""}`} data-variant={variant}>
      <span className="zp-section-bg" aria-hidden="true" />
      <div className={bleed ? "zp-section-inner bleed" : "zp-section-inner"}>{children}</div>
    </section>
  );
}

/** Eyebrow → title → body header with consistent type hierarchy. */
export function SectionHead({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <header className={`zp-head${align === "center" ? " center" : ""}`}>
      {eyebrow ? <p className="zp-eyebrow">{eyebrow}</p> : null}
      <h2 className="zp-title">{title}</h2>
      {body ? <p className="zp-body">{body}</p> : null}
    </header>
  );
}
