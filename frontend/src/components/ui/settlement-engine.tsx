"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type P3 = { x: number; y: number; z: number };
type P2 = { sx: number; sy: number; s: number; z: number };

/**
 * The ZeroPath settlement engine — the About hero centerpiece. A black monolith
 * rising through floating transparent data-planes, orbited by wireframe
 * verification cubes wired by cryptographic routes with traveling orange pulses,
 * in volumetric fog with soft light rays. Slow, ambient, mouse-parallax.
 * Deliberately NOT a sphere/globe. Canvas 2.5D (perspective-projected).
 */
export function SettlementEngine({ intensity = 0.55 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const targetIntensity = useRef(intensity);
  targetIntensity.current = intensity;

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
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

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
      cur += (targetIntensity.current - cur) * 0.05;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const cx = w / 2;
      const cy = h / 2 + h * 0.04;
      const scale = Math.min(w, h) * 0.5;
      const f = 3.2;
      const rotY = t * 0.12 + (mouse.x - 0.5) * 0.6;
      const tiltX = 0.42 + (mouse.y - 0.5) * 0.28;

      const project = (p: P3): P2 => {
        // rotate Y
        const cy_ = Math.cos(rotY);
        const sy_ = Math.sin(rotY);
        let x = p.x * cy_ + p.z * sy_;
        let z = -p.x * sy_ + p.z * cy_;
        const y = p.y;
        // tilt X
        const cx_ = Math.cos(tiltX);
        const sx_ = Math.sin(tiltX);
        const y2 = y * cx_ - z * sx_;
        const z2 = y * sx_ + z * cx_;
        const s = f / (f + z2);
        return { sx: cx + x * s * scale, sy: cy - y2 * s * scale, s, z: z2 };
      };

      ctx!.clearRect(0, 0, w, h);

      // volumetric fog + ambient amber glow (low, behind the engine)
      const fog = ctx!.createRadialGradient(cx, cy + h * 0.14, scale * 0.15, cx, cy + h * 0.1, scale * 1.5);
      fog.addColorStop(0, `rgba(255,139,61,${0.1 + cur * 0.12})`);
      fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = fog;
      ctx!.fillRect(0, 0, w, h);

      // soft light rays from top
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const rx = cx + (i === 0 ? -scale * 0.22 : scale * 0.26);
        const ray = ctx!.createLinearGradient(rx, 0, rx, h);
        ray.addColorStop(0, `rgba(255,180,120,${0.05 + cur * 0.05})`);
        ray.addColorStop(0.6, "rgba(255,180,120,0)");
        ray.addColorStop(1, "rgba(255,180,120,0)");
        ctx!.fillStyle = ray;
        ctx!.beginPath();
        ctx!.moveTo(rx - 8, 0);
        ctx!.lineTo(rx + 8, 0);
        ctx!.lineTo(rx + 70, h);
        ctx!.lineTo(rx - 70, h);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.restore();

      // ---- floating transparent data planes (drawn back-to-front by height) ----
      const planeYs = [-0.62, -0.12, 0.4];
      const planeHalf = 1.15;
      const drawPlane = (yBase: number, idx: number) => {
        const breathe = Math.sin(t * 0.6 + idx) * 0.05;
        const y = yBase + breathe;
        const corners = [
          project({ x: -planeHalf, y, z: -planeHalf }),
          project({ x: planeHalf, y, z: -planeHalf }),
          project({ x: planeHalf, y, z: planeHalf }),
          project({ x: -planeHalf, y, z: planeHalf }),
        ];
        ctx!.beginPath();
        ctx!.moveTo(corners[0].sx, corners[0].sy);
        for (let i = 1; i < 4; i++) ctx!.lineTo(corners[i].sx, corners[i].sy);
        ctx!.closePath();
        const g = ctx!.createLinearGradient(0, corners[0].sy, 0, corners[2].sy);
        g.addColorStop(0, "rgba(120,140,170,0.05)");
        g.addColorStop(1, "rgba(255,139,61,0.05)");
        ctx!.fillStyle = g;
        ctx!.fill();
        ctx!.strokeStyle = `rgba(255,139,61,${0.22 + cur * 0.2})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
        // faint grid on the plane
        ctx!.strokeStyle = "rgba(150,170,200,0.09)";
        for (let g2 = 1; g2 < 4; g2++) {
          const tt = g2 / 4;
          const a = project({ x: -planeHalf + tt * 2 * planeHalf, y, z: -planeHalf });
          const b = project({ x: -planeHalf + tt * 2 * planeHalf, y, z: planeHalf });
          const c = project({ x: -planeHalf, y, z: -planeHalf + tt * 2 * planeHalf });
          const d = project({ x: planeHalf, y, z: -planeHalf + tt * 2 * planeHalf });
          ctx!.beginPath();
          ctx!.moveTo(a.sx, a.sy);
          ctx!.lineTo(b.sx, b.sy);
          ctx!.moveTo(c.sx, c.sy);
          ctx!.lineTo(d.sx, d.sy);
          ctx!.stroke();
        }
      };
      drawPlane(planeYs[2], 2); // bottom first

      // ---- central monolith (tall glass slab) ----
      const mw = 0.34;
      const md = 0.34;
      const mh = 1.15;
      const V = [
        { x: -mw, y: -mh, z: -md }, { x: mw, y: -mh, z: -md }, { x: mw, y: -mh, z: md }, { x: -mw, y: -mh, z: md },
        { x: -mw, y: mh, z: -md }, { x: mw, y: mh, z: -md }, { x: mw, y: mh, z: md }, { x: -mw, y: mh, z: md },
      ].map(project);
      const faces = [
        [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
      ];
      faces
        .map((face) => ({ face, z: (V[face[0]].z + V[face[1]].z + V[face[2]].z + V[face[3]].z) / 4 }))
        .sort((a, b) => b.z - a.z)
        .forEach(({ face }) => {
          ctx!.beginPath();
          ctx!.moveTo(V[face[0]].sx, V[face[0]].sy);
          for (let i = 1; i < 4; i++) ctx!.lineTo(V[face[i]].sx, V[face[i]].sy);
          ctx!.closePath();
          const top = Math.min(V[face[0]].sy, V[face[2]].sy);
          const bot = Math.max(V[face[0]].sy, V[face[2]].sy);
          const g = ctx!.createLinearGradient(0, top, 0, bot);
          g.addColorStop(0, "rgba(46,49,56,0.96)");
          g.addColorStop(0.5, "rgba(20,21,25,0.96)");
          g.addColorStop(1, "rgba(6,6,8,0.98)");
          ctx!.fillStyle = g;
          ctx!.fill();
          ctx!.strokeStyle = `rgba(255,139,61,${0.35 + cur * 0.4})`;
          ctx!.lineWidth = 1;
          ctx!.shadowColor = "rgba(255,139,61,0.6)";
          ctx!.shadowBlur = 12 + cur * 16;
          ctx!.stroke();
          ctx!.shadowBlur = 0;
        });
      // monolith inner core glow (a bright seam)
      const seamTop = project({ x: 0, y: -mh * 0.6, z: md });
      const seamBot = project({ x: 0, y: mh * 0.6, z: md });
      const seam = ctx!.createLinearGradient(seamTop.sx, seamTop.sy, seamBot.sx, seamBot.sy);
      seam.addColorStop(0, "rgba(255,180,120,0)");
      seam.addColorStop(0.5, `rgba(255,190,130,${0.5 + cur * 0.4})`);
      seam.addColorStop(1, "rgba(255,180,120,0)");
      ctx!.strokeStyle = seam;
      ctx!.lineWidth = 2;
      ctx!.shadowColor = "rgba(255,139,61,0.9)";
      ctx!.shadowBlur = 18;
      ctx!.beginPath();
      ctx!.moveTo(seamTop.sx, seamTop.sy);
      ctx!.lineTo(seamBot.sx, seamBot.sy);
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      drawPlane(planeYs[1], 1);
      drawPlane(planeYs[0], 0); // top last (front)

      // ---- orbiting wireframe verification cubes + routes with pulses ----
      const cubeCount = 5;
      const cubeEdges = [
        [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      for (let i = 0; i < cubeCount; i++) {
        const ang = t * 0.25 + (i / cubeCount) * Math.PI * 2;
        const rad = 1.05;
        const ox = Math.cos(ang) * rad;
        const oz = Math.sin(ang) * rad;
        const oy = -0.5 + (i % 3) * 0.42 + Math.sin(t * 0.7 + i) * 0.05;
        const cs = 0.09;
        const cubeV = [
          { x: -cs, y: -cs, z: -cs }, { x: cs, y: -cs, z: -cs }, { x: cs, y: -cs, z: cs }, { x: -cs, y: -cs, z: cs },
          { x: -cs, y: cs, z: -cs }, { x: cs, y: cs, z: -cs }, { x: cs, y: cs, z: cs }, { x: -cs, y: cs, z: cs },
        ].map((p) => project({ x: p.x + ox, y: p.y + oy, z: p.z + oz }));
        // route from cube to monolith center
        const cubeCenter = project({ x: ox, y: oy, z: oz });
        const anchor = project({ x: 0, y: oy, z: 0 });
        ctx!.strokeStyle = `rgba(255,139,61,${0.12 + cur * 0.12})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(cubeCenter.sx, cubeCenter.sy);
        ctx!.lineTo(anchor.sx, anchor.sy);
        ctx!.stroke();
        // pulse traveling the route
        const pt = (t * 0.4 + i * 0.2) % 1;
        const px = cubeCenter.sx + (anchor.sx - cubeCenter.sx) * pt;
        const py = cubeCenter.sy + (anchor.sy - cubeCenter.sy) * pt;
        ctx!.save();
        ctx!.shadowColor = "rgba(255,139,61,0.9)";
        ctx!.shadowBlur = 10;
        ctx!.fillStyle = "rgba(255,200,150,1)";
        ctx!.beginPath();
        ctx!.arc(px, py, 2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
        // cube wireframe
        ctx!.strokeStyle = `rgba(210,220,235,${0.4 + cur * 0.3})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        for (const [a, b] of cubeEdges) {
          ctx!.moveTo(cubeV[a].sx, cubeV[a].sy);
          ctx!.lineTo(cubeV[b].sx, cubeV[b].sy);
        }
        ctx!.stroke();
      }

      raf = requestAnimationFrame(frame);
    }

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

  return <canvas ref={ref} className="settlement-engine-canvas" aria-hidden="true" />;
}
