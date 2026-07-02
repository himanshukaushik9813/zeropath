"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import heroSettlementCore from "@/assets/visuals/hero-settlement-core.png";

/**
 * About-hero engine: a cinematic pre-rendered settlement core (black titanium
 * monolith + orbiting light rings) presented with a slow ken-burns drift,
 * mouse parallax, and a soft brand glow. Reliable and premium — a real render,
 * not hand-drawn geometry.
 */
export function EngineRender() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 20 });
  const sy = useSpring(y, { stiffness: 120, damping: 20 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * -22);
    y.set(((e.clientY - r.top) / r.height - 0.5) * -14);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div className="engine-render" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      <motion.div className="engine-render-img" style={reduced ? undefined : { x: sx, y: sy }}>
        <Image src={heroSettlementCore} alt="" fill priority sizes="(max-width: 1000px) 100vw, 50vw" className="engine-render-photo" />
      </motion.div>
      <span className="engine-render-glow" aria-hidden="true" />
      <span className="engine-render-scrim" aria-hidden="true" />
    </div>
  );
}
