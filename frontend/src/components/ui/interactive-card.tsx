"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The canonical interactive surface for the ZeroPath OS. One component, reused
 * everywhere, so every card behaves identically:
 *   hover → 3D tilt → cursor light → glass reflection → depth shift →
 *   ambient shadow → orange edge highlight → subtle spark release.
 *
 * Purely transform/opacity driven (GPU) and reduced-motion aware.
 */
export function InteractiveCard({
  children,
  className,
  intensity = 7,
  glow = "orange",
  as = "div",
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glow?: "orange" | "green" | "none";
  as?: "div" | "a" | "button";
  href?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 17 });
  const sry = useSpring(ry, { stiffness: 150, damping: 17 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const glowColor =
    glow === "green" ? "rgba(126,231,135,0.16)" : glow === "none" ? "rgba(255,255,255,0.06)" : "rgba(255,139,61,0.16)";
  const light = useMotionTemplate`radial-gradient(460px circle at ${gx}% ${gy}%, ${glowColor}, transparent 60%)`;
  const sheen = useMotionTemplate`linear-gradient(${gx}deg, transparent 38%, rgba(255,255,255,0.07) 50%, transparent 62%)`;

  function onMove(event: React.MouseEvent<HTMLElement>) {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * intensity);
    rx.set(-(py - 0.5) * intensity);
    gx.set(px * 100);
    gy.set(py * 100);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
    gx.set(50);
    gy.set(50);
  }

  const MotionTag = as === "a" ? motion.a : as === "button" ? motion.button : motion.div;

  return (
    <MotionTag
      ref={ref as never}
      href={href}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className ? `ic ${className}` : "ic"}
      data-glow={glow}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1100 }}
      whileHover={{ scale: 1.014 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <motion.span className="ic-light" style={{ background: light }} aria-hidden="true" />
      <motion.span className="ic-sheen" style={{ background: sheen }} aria-hidden="true" />
      <span className="ic-sparks" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="ic-body">{children}</span>
    </MotionTag>
  );
}
