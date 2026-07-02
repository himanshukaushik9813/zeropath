"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const HEX = "0123456789abcdef";
function randHash(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += HEX[(Math.random() * 16) | 0];
  return s;
}

/**
 * The Proof Core — the centerpiece of the Proof page. A black-titanium sphere
 * inside orange orbit rings, orbiting proof cubes, inward-falling hash particles,
 * a faint Merkle graph, volumetric fog and bloom. Mouse-reactive parallax.
 *
 * `intensity` (0..1) is the ambient energy. `burst` pulses when Generate Proof
 * is clicked (shockwave + particle acceleration). `verified` shifts the palette
 * from orange → green once BN254 verification lands.
 */
export function ProofEngine({
  intensity = 0.4,
  burst = 0,
  verified = false,
}: {
  intensity?: number;
  burst?: number;
  verified?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const targetIntensity = useRef(intensity);
  const targetBurst = useRef(burst);
  const verifiedRef = useRef(verified);
  targetIntensity.current = intensity;
  targetBurst.current = burst;
  verifiedRef.current = verified;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cur = targetIntensity.current;
    let burstCur = 0;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    type Particle = { a: number; r: number; speed: number; size: number; hash: string; life: number };
    let particles: Particle[] = [];
    type Node = { x: number; y: number };
    let nodes: Node[] = [];

    function seed() {
      particles = Array.from({ length: 46 }, () => ({
        a: Math.random() * Math.PI * 2,
        r: 0.6 + Math.random() * 1.5,
        speed: 0.002 + Math.random() * 0.004,
        size: Math.random() < 0.3 ? 2.2 : 1.2,
        hash: Math.random() < 0.16 ? randHash(2) : "",
        life: Math.random(),
      }));
      // Merkle graph: 4 rows (8→4→2→1) laid out as a faint pyramid
      nodes = [];
      const rows = [8, 4, 2, 1];
      rows.forEach((count, ri) => {
        for (let i = 0; i < count; i++) {
          nodes.push({ x: (i + 0.5) / count, y: 0.16 + ri * 0.1 });
        }
      });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMouse(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.tx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      mouse.ty = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    }

    let raf = 0;
    let t = 0;
    function frame() {
      t += 0.016;
      cur += (targetIntensity.current - cur) * 0.06;
      burstCur += (targetBurst.current - burstCur) * 0.12;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      const green = verifiedRef.current;
      const accent = green ? [126, 231, 135] : [255, 139, 61];
      const [ar, ag, ab] = accent;

      const parX = (mouse.x - 0.5) * 26;
      const parY = (mouse.y - 0.5) * 20;
      const cx = w / 2 + parX;
      const cy = h / 2 + parY;
      const base = Math.min(w, h) * 0.24;
      const energy = cur + burstCur * 0.6;
      const pulse = 1 + Math.sin(t * 2) * 0.03 * (0.5 + energy);

      ctx!.clearRect(0, 0, w, h);

      // volumetric fog
      const fog = ctx!.createRadialGradient(cx, cy, base * 0.3, cx, cy, base * 3);
      fog.addColorStop(0, `rgba(${ar},${ag},${ab},${0.1 + energy * 0.16})`);
      fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = fog;
      ctx!.fillRect(0, 0, w, h);

      // faint Merkle graph (behind)
      ctx!.save();
      ctx!.globalAlpha = 0.16 + energy * 0.14;
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.5)`;
      ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.7)`;
      ctx!.lineWidth = 1;
      const rowsCount = [8, 4, 2, 1];
      let idx = 0;
      const rowStart: number[] = [];
      rowsCount.forEach((c) => {
        rowStart.push(idx);
        idx += c;
      });
      for (let ri = 0; ri < rowsCount.length - 1; ri++) {
        const start = rowStart[ri];
        const nextStart = rowStart[ri + 1];
        for (let i = 0; i < rowsCount[ri]; i++) {
          const a = nodes[start + i];
          const b = nodes[nextStart + (i >> 1)];
          if (!a || !b) continue;
          ctx!.beginPath();
          ctx!.moveTo(a.x * w, a.y * h);
          ctx!.lineTo(b.x * w, b.y * h);
          ctx!.stroke();
        }
      }
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x * w, n.y * h, 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();

      // outer bloom
      const bloom = ctx!.createRadialGradient(cx, cy, base * 0.4, cx, cy, base * 2.4);
      bloom.addColorStop(0, `rgba(${ar},${ag},${ab},${0.12 + energy * 0.24})`);
      bloom.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
      ctx!.fillStyle = bloom;
      ctx!.fillRect(0, 0, w, h);

      // shockwave from a burst
      if (burstCur > 0.02) {
        const wave = (t * 1.6) % 1.4;
        ctx!.save();
        ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${burstCur * (1 - wave / 1.4) * 0.7})`;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(cx, cy, base * (0.8 + wave * 2), 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }

      // energy rings
      for (let i = 0; i < 3; i++) {
        const rr = base * (1.15 + i * 0.3) * pulse;
        const rot = t * (0.35 + i * 0.16) * (i % 2 === 0 ? 1 : -1);
        ctx!.save();
        ctx!.translate(cx, cy);
        ctx!.rotate(rot);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, rr, rr * 0.34, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${ar},${Math.min(255, ag + 20)},${ab + 30},${0.24 + energy * 0.45})`;
        ctx!.lineWidth = 1.4;
        ctx!.shadowColor = `rgba(${ar},${ag},${ab},0.85)`;
        ctx!.shadowBlur = 14 + energy * 24;
        ctx!.stroke();
        ctx!.restore();
      }

      // inward-falling hash particles + orbiting cubes
      for (const p of particles) {
        p.a += p.speed * (1 + burstCur * 2);
        p.r -= (0.0015 + burstCur * 0.006);
        if (p.r < 0.35) {
          p.r = 1.7 + Math.random() * 0.6;
          p.hash = Math.random() < 0.16 ? randHash(2) : "";
        }
        const rr = base * p.r * pulse;
        const px = cx + Math.cos(p.a) * rr;
        const py = cy + Math.sin(p.a) * rr * 0.42;
        ctx!.save();
        ctx!.shadowColor = `rgba(${ar},${ag},${ab},0.9)`;
        ctx!.shadowBlur = 8;
        if (p.hash) {
          ctx!.fillStyle = `rgba(${ar + 20},${ag + 40},${ab + 60},${0.6 + energy * 0.4})`;
          ctx!.font = "8px ui-monospace, monospace";
          ctx!.fillText(p.hash, px, py);
        } else {
          ctx!.fillStyle = `rgba(255,${180 + (green ? 40 : 0)},${green ? 200 : 120},${0.5 + energy * 0.4})`;
          ctx!.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
        }
        ctx!.restore();
      }

      // titanium sphere
      ctx!.save();
      ctx!.shadowColor = `rgba(${ar},${ag},${ab},0.5)`;
      ctx!.shadowBlur = 28 + energy * 34;
      const sphere = ctx!.createRadialGradient(cx - base * 0.32, cy - base * 0.36, base * 0.1, cx, cy, base * pulse);
      sphere.addColorStop(0, "#41444c");
      sphere.addColorStop(0.5, "#17181c");
      sphere.addColorStop(1, "#050506");
      ctx!.beginPath();
      ctx!.arc(cx, cy, base * pulse, 0, Math.PI * 2);
      ctx!.fillStyle = sphere;
      ctx!.fill();
      ctx!.restore();

      // core glow
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, base * 0.66);
      core.addColorStop(0, `rgba(${Math.min(255, ar + 20)},${Math.min(255, ag + 60)},${ab + 60},${0.32 + energy * 0.5})`);
      core.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(cx, cy, base * 0.66, 0, Math.PI * 2);
      ctx!.fill();

      // specular highlight
      ctx!.save();
      ctx!.globalAlpha = 0.5;
      const spec = ctx!.createRadialGradient(cx - base * 0.35, cy - base * 0.4, 0, cx - base * 0.35, cy - base * 0.4, base * 0.5);
      spec.addColorStop(0, "rgba(255,255,255,0.5)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = spec;
      ctx!.beginPath();
      ctx!.arc(cx - base * 0.3, cy - base * 0.34, base * 0.42, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      raf = requestAnimationFrame(frame);
    }

    seed();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);
    if (reduced) {
      cur = targetIntensity.current;
      frame();
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return <canvas ref={ref} className="proof-engine-canvas" aria-hidden="true" />;
}
