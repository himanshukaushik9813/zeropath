"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Vec = { x: number; y: number; z: number };

// A global settlement network — real-ish financial hubs as nodes on the globe.
const HUBS: Array<{ lat: number; lon: number }> = [
  { lat: 40.7, lon: -74 },   // New York
  { lat: 51.5, lon: -0.1 },  // London
  { lat: 1.35, lon: 103.8 }, // Singapore
  { lat: 35.7, lon: 139.7 }, // Tokyo
  { lat: -23.5, lon: -46.6 },// São Paulo
  { lat: 50.1, lon: 8.7 },   // Frankfurt
  { lat: 25.2, lon: 55.3 },  // Dubai
  { lat: 37.8, lon: -122.4 },// San Francisco
  { lat: -33.9, lon: 151.2 },// Sydney
  { lat: 19.1, lon: 72.9 },  // Mumbai
];

function toVec(latDeg: number, lonDeg: number): Vec {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}
function rotY(v: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}
function slerp(a: Vec, b: Vec, t: number): Vec {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z;
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  const so = Math.sin(omega);
  if (so < 1e-4) return a;
  const wa = Math.sin((1 - t) * omega) / so;
  const wb = Math.sin(t * omega) / so;
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb };
}

/**
 * Holographic settlement globe: a rotating wireframe sphere with financial-hub
 * nodes, great-circle settlement arcs, and traveling packets. Autonomously alive;
 * `active` boosts packet spawn rate and node glow while a transfer executes.
 */
export function SettlementGlobe({ active = false }: { active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const base = HUBS.map((hub) => toVec(hub.lat, hub.lon));
    // grid: latitude rings + longitude meridians sampled as points
    const latRings: number[] = [-60, -30, 0, 30, 60];
    const lonMeridians: number[] = [0, 45, 90, 135, 180, 225, 270, 315];

    type Flight = { from: number; to: number; t: number; speed: number; hue: number };
    let flights: Flight[] = [];
    type Pulse = { node: number; life: number };
    let pulses: Pulse[] = [];

    function spawnFlight() {
      const from = (Math.random() * HUBS.length) | 0;
      let to = (Math.random() * HUBS.length) | 0;
      if (to === from) to = (to + 1) % HUBS.length;
      flights.push({ from, to, t: 0, speed: 0.004 + Math.random() * 0.004, hue: Math.random() < 0.2 ? 130 : 26 });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let raf = 0;
    let rot = 0;
    let t = 0;
    let spawnTimer = 0;

    function frame() {
      t += 0.016;
      rot += 0.0016;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const hot = activeRef.current;

      ctx!.clearRect(0, 0, w, h);

      // atmospheric glow behind the globe
      const glow = ctx!.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.7);
      glow.addColorStop(0, `rgba(255,139,61,${hot ? 0.16 : 0.1})`);
      glow.addColorStop(1, "rgba(255,139,61,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);

      // sphere body (subtle dark fill with rim)
      const body = ctx!.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
      body.addColorStop(0, "rgba(20,22,28,0.55)");
      body.addColorStop(1, "rgba(6,7,9,0.9)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = body;
      ctx!.fill();

      const project = (v: Vec) => ({ sx: cx + v.x * R, sy: cy - v.y * R, z: v.z });

      // grid points (holographic wireframe)
      ctx!.fillStyle = "rgba(150,180,225,0.7)";
      const drawGridPoint = (v: Vec) => {
        const r = rotY(v, rot);
        const p = project(r);
        const depth = (p.z + 1) / 2;
        ctx!.globalAlpha = depth * 0.72 * (p.z > 0 ? 1 : 0.4);
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, 1, 0, Math.PI * 2);
        ctx!.fill();
      };
      for (const latD of latRings) {
        for (let lon = 0; lon < 360; lon += 7.5) drawGridPoint(toVec(latD, lon));
      }
      for (const lonD of lonMeridians) {
        for (let lat = -80; lat <= 80; lat += 7.5) drawGridPoint(toVec(lat, lonD));
      }
      ctx!.globalAlpha = 1;

      // settlement arcs + packets
      if (!reduced) {
        spawnTimer -= 1;
        const cap = hot ? 9 : 5;
        const rate = hot ? 14 : 26;
        if (spawnTimer <= 0 && flights.length < cap) {
          spawnFlight();
          spawnTimer = rate;
        }
      } else if (flights.length === 0) {
        spawnFlight();
      }

      flights = flights.filter((f) => f.t <= 1);
      for (const f of flights) {
        f.t += reduced ? 0 : f.speed;
        const a = rotY(base[f.from], rot);
        const b = rotY(base[f.to], rot);
        const col = f.hue === 130 ? "126,231,135" : "255,139,61";
        // draw arc (lifted great circle)
        ctx!.beginPath();
        const SEG = 40;
        let started = false;
        for (let i = 0; i <= SEG; i++) {
          const tt = i / SEG;
          const m = slerp(a, b, tt);
          const lift = 1 + 0.22 * Math.sin(Math.PI * tt);
          const p = project({ x: m.x * lift, y: m.y * lift, z: m.z * lift });
          if (m.z < -0.2) {
            started = false;
            continue;
          }
          if (!started) {
            ctx!.moveTo(p.sx, p.sy);
            started = true;
          } else {
            ctx!.lineTo(p.sx, p.sy);
          }
        }
        ctx!.strokeStyle = `rgba(${col},0.28)`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // packet
        const m = slerp(a, b, f.t);
        const lift = 1 + 0.22 * Math.sin(Math.PI * f.t);
        const p = project({ x: m.x * lift, y: m.y * lift, z: m.z * lift });
        if (m.z > -0.1) {
          ctx!.save();
          ctx!.shadowColor = `rgba(${col},0.9)`;
          ctx!.shadowBlur = 10;
          ctx!.fillStyle = `rgba(${col},1)`;
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, 2.6, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        }
        if (f.t >= 1) pulses.push({ node: f.to, life: 1 });
      }

      // node pulses (settlement completion)
      pulses = pulses.filter((pp) => pp.life > 0);
      for (const pp of pulses) {
        pp.life -= 0.03;
        const r = rotY(base[pp.node], rot);
        const p = project(r);
        if (p.z > -0.1) {
          ctx!.strokeStyle = `rgba(255,139,61,${pp.life * 0.6})`;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, (1 - pp.life) * 22 + 4, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // hub nodes
      for (const bv of base) {
        const r = rotY(bv, rot);
        const p = project(r);
        const front = p.z > 0;
        const depth = (p.z + 1) / 2;
        const twinkle = 0.6 + 0.4 * Math.sin(t * 2 + bv.x * 8);
        ctx!.save();
        ctx!.globalAlpha = front ? 1 : 0.32;
        ctx!.shadowColor = "rgba(255,139,61,0.9)";
        ctx!.shadowBlur = front ? 12 * twinkle * (hot ? 1.4 : 1) : 0;
        ctx!.fillStyle = `rgba(255,${170 + depth * 40},${110 + depth * 40},1)`;
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, front ? 2.6 : 1.6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // rim light
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255,139,61,0.28)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      for (let i = 0; i < 4; i++) spawnFlight();
      frame();
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="settlement-globe-canvas" aria-hidden="true" />;
}
