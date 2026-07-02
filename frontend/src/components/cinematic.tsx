"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";

const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// TiltCard — glass object with mouse tilt + ambient light that follows cursor
// ---------------------------------------------------------------------------

export function TiltCard({
  children,
  className,
  intensity = 8,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 140, damping: 16 });
  const sry = useSpring(ry, { stiffness: 140, damping: 16 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgba(255,139,61,0.12), transparent 55%)`;

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
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

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className ? `tilt-card ${className}` : "tilt-card"}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000 }}
    >
      <motion.span className="tilt-glow" style={{ background: glow }} aria-hidden="true" />
      <div className="tilt-inner">{children}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MagneticButton — spring physics + magnetic hover + soft glow
// ---------------------------------------------------------------------------

export function MagneticButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 13 });
  const sy = useSpring(y, { stiffness: 220, damping: 13 });

  function onMove(event: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * 0.28);
    y.set((event.clientY - (rect.top + rect.height / 2)) * 0.35);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Live data — count-up numbers + self-typing hashes
// ---------------------------------------------------------------------------

export function CountUp({
  value,
  format,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(() => (format ? format(value) : String(Math.round(value))));
  const prev = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(format ? format(value) : String(Math.round(value)));
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: APPLE_EASE,
      onUpdate: (v) => setDisplay(format ? format(v) : String(Math.round(v))),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format, duration]);

  return <>{display}</>;
}

export function TypingHash({ text, speed = 14 }: { text: string; speed?: number }) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (prefersReducedMotion()) {
      setOut(text);
      return;
    }
    let i = 0;
    setOut("");
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return <span className="typing">{out}</span>;
}

// ---------------------------------------------------------------------------
// Atmosphere — ambient particle / fog field (canvas, lightweight)
// ---------------------------------------------------------------------------

export function Atmosphere({ density = 46 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = prefersReducedMotion();

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: 0.5, y: 0.4 };

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    let parts: P[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: density }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: Math.random() * 1.6 + 0.4,
        a: Math.random() * 0.4 + 0.1,
      }));
    }

    function onMouse(e: MouseEvent) {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    }

    let raf = 0;
    function frame() {
      ctx!.clearRect(0, 0, w, h);
      // mouse-reactive ambient bloom
      const bx = mouse.x * w;
      const by = mouse.y * h;
      const grd = ctx!.createRadialGradient(bx, by, 0, bx, by, Math.max(w, h) * 0.5);
      grd.addColorStop(0, "rgba(255,139,61,0.05)");
      grd.addColorStop(1, "rgba(255,139,61,0)");
      ctx!.fillStyle = grd;
      ctx!.fillRect(0, 0, w, h);

      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(247,248,248,${p.a})`;
        ctx!.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);
    if (!reduced) {
      raf = requestAnimationFrame(frame);
    } else {
      frame(); // one static frame
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [density]);

  return <canvas ref={ref} className="atmosphere" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// ProofCore — arc-reactor proof visualization (canvas): titanium sphere,
// orange energy rings, orbiting proof cubes, particles, pulse.
// `intensity` ramps 0 -> 1 while a settlement is executing.
// ---------------------------------------------------------------------------

export function ProofCore({ intensity = 0.35 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(intensity);
  target.current = intensity;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cur = target.current;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let raf = 0;
    let t = 0;
    function frame() {
      t += 0.016;
      cur += (target.current - cur) * 0.05;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.28;
      const pulse = 1 + Math.sin(t * 2) * 0.03 * (0.4 + cur);

      ctx!.clearRect(0, 0, w, h);

      // outer bloom
      const bloom = ctx!.createRadialGradient(cx, cy, base * 0.4, cx, cy, base * 2.4);
      bloom.addColorStop(0, `rgba(255,139,61,${0.14 + cur * 0.22})`);
      bloom.addColorStop(1, "rgba(255,139,61,0)");
      ctx!.fillStyle = bloom;
      ctx!.fillRect(0, 0, w, h);

      // energy rings (elliptical, rotating)
      const rings = 3;
      for (let i = 0; i < rings; i++) {
        const rr = base * (1.15 + i * 0.28) * pulse;
        const rot = t * (0.35 + i * 0.15) * (i % 2 === 0 ? 1 : -1);
        ctx!.save();
        ctx!.translate(cx, cy);
        ctx!.rotate(rot);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, rr, rr * 0.34, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(255,${150 + i * 20},80,${0.22 + cur * 0.4})`;
        ctx!.lineWidth = 1.4;
        ctx!.shadowColor = "rgba(255,139,61,0.8)";
        ctx!.shadowBlur = 12 + cur * 20;
        ctx!.stroke();
        ctx!.restore();
      }

      // orbiting proof cubes + hash particles
      const orbCount = 8;
      for (let i = 0; i < orbCount; i++) {
        const ang = t * 0.8 + (i / orbCount) * Math.PI * 2;
        const rr = base * 1.5 * pulse;
        const ox = cx + Math.cos(ang) * rr;
        const oy = cy + Math.sin(ang) * rr * 0.36;
        const s = 3 + (i % 3);
        ctx!.save();
        ctx!.translate(ox, oy);
        ctx!.rotate(ang * 2);
        ctx!.fillStyle = `rgba(255,180,120,${0.5 + cur * 0.4})`;
        ctx!.shadowColor = "rgba(255,139,61,0.9)";
        ctx!.shadowBlur = 10;
        ctx!.fillRect(-s / 2, -s / 2, s, s);
        ctx!.restore();
      }

      // titanium sphere
      ctx!.save();
      ctx!.shadowColor = "rgba(255,139,61,0.5)";
      ctx!.shadowBlur = 26 + cur * 30;
      const sphere = ctx!.createRadialGradient(
        cx - base * 0.3,
        cy - base * 0.35,
        base * 0.1,
        cx,
        cy,
        base * pulse
      );
      sphere.addColorStop(0, "#3a3d44");
      sphere.addColorStop(0.5, "#17181c");
      sphere.addColorStop(1, "#050506");
      ctx!.beginPath();
      ctx!.arc(cx, cy, base * pulse, 0, Math.PI * 2);
      ctx!.fillStyle = sphere;
      ctx!.fill();
      ctx!.restore();

      // core glow
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, base * 0.6);
      core.addColorStop(0, `rgba(255,180,120,${0.35 + cur * 0.5})`);
      core.addColorStop(1, "rgba(255,139,61,0)");
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(cx, cy, base * 0.6, 0, Math.PI * 2);
      ctx!.fill();

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      cur = target.current;
      frame();
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="proof-core-canvas" aria-hidden="true" />;
}
