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

type Stream = { ax: number; ay: number; cxp: number; cyp: number; ty: number; speed: number; offset: number };
type Packet = { stream: number; t: number };
type Ring = { x: number; y: number; life: number; green: boolean };
type Exit = { t: number; dir: number; life: number };
type Frag = { x: number; y: number; vy: number; text: string; a: number };

/**
 * The ZeroPath settlement engine — About hero centerpiece. A luminous vertical
 * settlement core with elegant curved routes converging into it; value packets
 * stream in, get verified at the core (ring pulse), and settle out as green
 * particles. Drifting hash fragments, a faint depth horizon, soft bloom, mouse
 * parallax. Deliberately NOT a sphere/globe/cube-scatter. Canvas 2.5D.
 */
export function SettlementEngine({ intensity = 0.6 }: { intensity?: number }) {
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
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    let streams: Stream[] = [];
    let packets: Packet[] = [];
    let rings: Ring[] = [];
    let exits: Exit[] = [];
    let frags: Frag[] = [];

    function seed() {
      // Curved routes converging from the perimeter into the core.
      const N = 7;
      streams = Array.from({ length: N }, (_, i) => {
        // anchors spread around the left/right/top perimeter (not the very bottom)
        const side = i % 2 === 0 ? -1 : 1;
        const spread = (i / (N - 1)) * 2 - 1; // -1..1
        return {
          ax: 0.5 + side * (0.34 + Math.random() * 0.16),
          ay: 0.16 + Math.abs(spread) * 0.5 + Math.random() * 0.12,
          cxp: 0.5 + side * (0.14 + Math.random() * 0.1),
          cyp: 0.3 + Math.random() * 0.4,
          ty: 0.34 + Math.random() * 0.34, // where it meets the core (0..1 of core height)
          speed: 0.0035 + Math.random() * 0.0035,
          offset: Math.random(),
        };
      });
      packets = streams.flatMap((_, i) => [{ stream: i, t: Math.random() }, { stream: i, t: (Math.random() + 0.5) % 1 }]);
      rings = [];
      exits = [];
      frags = Array.from({ length: 10 }, () => ({
        x: Math.random(),
        y: Math.random(),
        vy: 0.0004 + Math.random() * 0.0006,
        text: randHash(4),
        a: 0.06 + Math.random() * 0.1,
      }));
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

    // quadratic bezier
    const qb = (p0: number, p1: number, p2: number, t: number) => {
      const mt = 1 - t;
      return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
    };

    let raf = 0;
    let t = 0;

    function frame() {
      t += 0.016;
      cur += (target.current - cur) * 0.05;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const parX = (mouse.x - 0.5) * 22;
      const parY = (mouse.y - 0.5) * 16;
      const cx = w / 2 + parX;
      const coreTop = h * 0.24 + parY;
      const coreBot = h * 0.78 + parY;
      const coreH = coreBot - coreTop;
      const coreW = Math.max(7, Math.min(w, h) * 0.02);
      const energy = 0.5 + cur * 0.5;

      // resolve a stream point in px
      const streamPt = (s: Stream, tt: number) => {
        const p0x = s.ax * w + parX;
        const p0y = s.ay * h + parY;
        const p2x = cx + (s.ax > 0.5 ? coreW : -coreW);
        const p2y = coreTop + s.ty * coreH;
        const p1x = s.cxp * w + parX;
        const p1y = s.cyp * h + parY;
        return { x: qb(p0x, p1x, p2x, tt), y: qb(p0y, p1y, p2y, tt), hx: p2x, hy: p2y };
      };

      ctx!.clearRect(0, 0, w, h);

      // ambient amber glow + soft vignette
      const glow = ctx!.createRadialGradient(cx, coreTop + coreH * 0.5, coreW, cx, coreTop + coreH * 0.5, Math.max(w, h) * 0.6);
      glow.addColorStop(0, `rgba(255,139,61,${0.1 + cur * 0.12})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);

      // faint depth horizon (perspective floor lines)
      ctx!.save();
      ctx!.strokeStyle = "rgba(255,139,61,0.06)";
      ctx!.lineWidth = 1;
      const hy = coreBot + h * 0.02;
      for (let i = 1; i <= 5; i++) {
        const yy = hy + i * i * 3.2;
        if (yy > h) break;
        ctx!.beginPath();
        ctx!.moveTo(0, yy);
        ctx!.lineTo(w, yy);
        ctx!.stroke();
      }
      for (let i = -4; i <= 4; i++) {
        ctx!.beginPath();
        ctx!.moveTo(cx + i * coreW * 2.2, hy);
        ctx!.lineTo(cx + i * 90, h);
        ctx!.stroke();
      }
      ctx!.restore();

      // drifting hash fragments (behind)
      ctx!.save();
      ctx!.font = "9px ui-monospace, monospace";
      for (const f of frags) {
        f.y -= f.vy;
        if (f.y < -0.05) {
          f.y = 1.05;
          f.x = Math.random();
          f.text = randHash(4);
        }
        ctx!.fillStyle = `rgba(150,170,200,${f.a})`;
        ctx!.fillText(`0x${f.text}`, f.x * w, f.y * h);
      }
      ctx!.restore();

      // converging route curves
      for (const s of streams) {
        ctx!.beginPath();
        const seg = 22;
        for (let i = 0; i <= seg; i++) {
          const p = streamPt(s, i / seg);
          if (i === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = `rgba(255,139,61,${0.14 + cur * 0.12})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // packets travelling the routes → verification pulse at the core
      for (const pk of packets) {
        pk.t += streams[pk.stream].speed * (reduced ? 0 : 1) * (0.7 + energy);
        if (pk.t >= 1) {
          const s = streams[pk.stream];
          const hit = streamPt(s, 1);
          rings.push({ x: hit.hx, y: hit.hy, life: 1, green: false });
          if (Math.random() < 0.5) exits.push({ t: 0, dir: s.ax > 0.5 ? 1 : -1, life: 1 });
          pk.t = 0;
        }
        const p = streamPt(streams[pk.stream], pk.t);
        ctx!.save();
        ctx!.shadowColor = "rgba(255,180,120,0.9)";
        ctx!.shadowBlur = 10;
        ctx!.fillStyle = "rgba(255,220,180,1)";
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // verification rings at the core
      rings = rings.filter((r) => r.life > 0);
      for (const r of rings) {
        r.life -= 0.03;
        const col = r.green ? "126,231,135" : "255,139,61";
        ctx!.strokeStyle = `rgba(${col},${r.life * 0.5})`;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, (1 - r.life) * 30 + 4, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // the settlement core (luminous vertical slab)
      const grad = ctx!.createLinearGradient(cx - coreW, 0, cx + coreW, 0);
      grad.addColorStop(0, "rgba(8,9,11,0.95)");
      grad.addColorStop(0.5, "rgba(60,64,72,0.95)");
      grad.addColorStop(1, "rgba(8,9,11,0.95)");
      ctx!.save();
      ctx!.shadowColor = "rgba(255,139,61,0.5)";
      ctx!.shadowBlur = 30 + cur * 30;
      roundRect(ctx!, cx - coreW, coreTop, coreW * 2, coreH, coreW);
      ctx!.fillStyle = grad;
      ctx!.fill();
      ctx!.restore();

      // bright animated seam of light down the core
      const seamPulse = (Math.sin(t * 1.5) * 0.5 + 0.5) * 0.4 + 0.5;
      const seam = ctx!.createLinearGradient(0, coreTop, 0, coreBot);
      seam.addColorStop(0, "rgba(255,180,120,0)");
      seam.addColorStop(0.5, `rgba(255,210,160,${(0.6 + cur * 0.4) * seamPulse})`);
      seam.addColorStop(1, "rgba(255,180,120,0)");
      ctx!.save();
      ctx!.shadowColor = "rgba(255,139,61,0.95)";
      ctx!.shadowBlur = 20;
      ctx!.strokeStyle = seam;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(cx, coreTop + 6);
      ctx!.lineTo(cx, coreBot - 6);
      ctx!.stroke();
      ctx!.restore();

      // a bright travelling node up the seam
      const np = (t * 0.18) % 1;
      const ny = coreTop + 6 + np * (coreH - 12);
      ctx!.save();
      ctx!.shadowColor = "rgba(255,220,180,1)";
      ctx!.shadowBlur = 16;
      ctx!.fillStyle = "#fff";
      ctx!.beginPath();
      ctx!.arc(cx, ny, 2.6, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // settled particles exiting the core (green)
      exits = exits.filter((e) => e.life > 0);
      for (const e of exits) {
        e.t += 0.02;
        e.life -= 0.012;
        const ex = cx + e.dir * (e.t * w * 0.32);
        const ey = coreBot - 20 + e.t * e.t * 70;
        ctx!.save();
        ctx!.shadowColor = "rgba(126,231,135,0.9)";
        ctx!.shadowBlur = 8;
        ctx!.fillStyle = `rgba(150,240,170,${e.life})`;
        ctx!.beginPath();
        ctx!.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      raf = requestAnimationFrame(frame);
    }

    function roundRect(c: CanvasRenderingContext2D, x: number, y: number, wd: number, ht: number, r: number) {
      const rr = Math.min(r, wd / 2, ht / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + wd, y, x + wd, y + ht, rr);
      c.arcTo(x + wd, y + ht, x, y + ht, rr);
      c.arcTo(x, y + ht, x, y, rr);
      c.arcTo(x, y, x + wd, y, rr);
      c.closePath();
    }

    seed();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);
    if (reduced) {
      cur = target.current;
      // advance packets to mid-flight for a rich static frame
      packets.forEach((p, i) => (p.t = (i * 0.13) % 1));
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

  return <canvas ref={ref} className="settlement-engine-canvas" aria-hidden="true" />;
}
