import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ALL_SLOTS } from "@/lib/positions";

type Dist = { GK: number; DF: number; MF: number; FW: number; total: number; slots?: Record<string, number>; unassigned?: number };

/** Fallback spots when a quarter only has a role (no slot): spread across the width. */
const ROLE_SPOTS: Record<"GK" | "DF" | "MF" | "FW", { x: number; y: number }[]> = {
  GK: [{ x: 50, y: 92 }],
  DF: [{ x: 32, y: 72 }, { x: 50, y: 70 }, { x: 68, y: 72 }],
  MF: [{ x: 25, y: 48 }, { x: 50, y: 46 }, { x: 75, y: 48 }],
  FW: [{ x: 35, y: 22 }, { x: 50, y: 18 }, { x: 65, y: 22 }],
};

// SofaScore-like ramp: transparent → green → yellow → orange → red
const RAMP: [number, [number, number, number, number]][] = [
  [0.0, [0, 0, 0, 0]],
  [0.15, [34, 197, 94, 0.35]],
  [0.4, [163, 230, 53, 0.6]],
  [0.6, [250, 204, 21, 0.75]],
  [0.8, [249, 115, 22, 0.85]],
  [1.0, [239, 68, 68, 0.92]],
];
function rampAt(t: number) {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, k) => v + (c1[k] - v) * f) as [number, number, number, number];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/**
 * Landscape heatmap (attacking → right) built from every lineup slot the player
 * occupied, weighted by quarters. Gaussian density on a canvas + pitch overlay,
 * with third / channel splits underneath.
 */
export default function PitchHeatmap({ dist, isEn }: { dist: Dist; isEn: boolean }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // points in landscape space: X = 0 (own goal) → 100 (attack), Y = 0 (left) → 100 (right)
  const points = useMemo(() => {
    const pts: { X: number; Y: number; w: number; s: number }[] = [];
    if (!dist) return pts;
    let slotQ = 0;
    Object.entries(dist.slots ?? {}).forEach(([code, n]) => {
      const sl = ALL_SLOTS[code];
      if (!sl || !n) return;
      slotQ += n;
      pts.push({ X: 100 - sl.y, Y: sl.x, w: n, s: 9 });
    });
    // quarters with only a role: distribute the remainder per role
    (["GK", "DF", "MF", "FW"] as const).forEach(role => {
      const slotted = Object.entries(dist.slots ?? {}).filter(([c]) => ALL_SLOTS[c]?.role === role).reduce((a, [, n]) => a + n, 0);
      const rest = Math.max(0, dist[role] - slotted);
      if (!rest) return;
      ROLE_SPOTS[role].forEach(p => pts.push({ X: 100 - p.y, Y: p.x, w: rest / ROLE_SPOTS[role].length, s: 13 }));
    });
    return slotQ || pts.length ? pts : [];
  }, [dist]);

  const split = useMemo(() => {
    const tot = points.reduce((a, p) => a + p.w, 0) || 1;
    const sum = (f: (p: (typeof points)[number]) => boolean) => Math.round((points.filter(f).reduce((a, p) => a + p.w, 0) / tot) * 100);
    return {
      def: sum(p => p.X < 34), mid: sum(p => p.X >= 34 && p.X < 67), att: sum(p => p.X >= 67),
      left: sum(p => p.Y < 34), center: sum(p => p.Y >= 34 && p.Y < 67), right: sum(p => p.Y >= 67),
    };
  }, [points]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || points.length === 0) return;
    const draw = () => {
      const rect = cv.getBoundingClientRect();
      const W = 160, H = Math.round((160 * rect.height) / Math.max(1, rect.width)) || 104;
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const grid = new Float32Array(W * H);
      points.forEach(p => {
        const cx = (p.X / 100) * W, cy = (p.Y / 100) * H;
        const sx = (p.s / 100) * W, sy = (p.s / 100) * H * 1.3;
        const x0 = Math.max(0, Math.floor(cx - 3 * sx)), x1 = Math.min(W - 1, Math.ceil(cx + 3 * sx));
        const y0 = Math.max(0, Math.floor(cy - 3 * sy)), y1 = Math.min(H - 1, Math.ceil(cy + 3 * sy));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const dx = (x - cx) / sx, dy = (y - cy) / sy;
            grid[y * W + x] += p.w * Math.exp(-0.5 * (dx * dx + dy * dy));
          }
      });
      let max = 0;
      for (const v of grid) if (v > max) max = v;
      const img = ctx.createImageData(W, H);
      for (let i = 0; i < grid.length; i++) {
        const [r, g, b, a] = rampAt(Math.min(1, grid[i] / (max || 1)));
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = a * 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [points]);

  if (!dist || dist.total === 0) return null;

  const Bar = ({ a, b, c, labels }: { a: number; b: number; c: number; labels: [string, string, string] }) => (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-sky-500" style={{ width: `${a}%` }} />
        <div className="bg-lime-400" style={{ width: `${b}%` }} />
        <div className="bg-orange-500" style={{ width: `${c}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-num text-[10px] text-muted-foreground">
        <span>{labels[0]} {a}%</span>
        <span>{labels[1]} {b}%</span>
        <span>{labels[2]} {c}%</span>
      </div>
    </div>
  );

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface mt-4 rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold" style={{ fontFamily: "inherit" }}>{L("히트맵", "Heatmap")}</h3>
        <span className="font-num text-[11px] text-muted-foreground">{L(`출전 ${dist.total}쿼터 · 공격 방향 →`, `${dist.total} quarters · attacking →`)}</span>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "105 / 68", background: "linear-gradient(90deg, #14361f, #18402a 50%, #14361f)" }}>
        {/* mowing stripes */}
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 9.09%, transparent 9.09% 18.18%)" }} />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ filter: "blur(6px) saturate(1.2)", imageRendering: "auto" }} aria-hidden />
        <svg viewBox="0 0 105 68" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.35">
          <rect x="1" y="1" width="103" height="66" rx="0.5" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.6)" />
          <rect x="1" y="13.85" width="16.5" height="40.3" />
          <rect x="1" y="24.85" width="5.5" height="18.3" />
          <rect x="87.5" y="13.85" width="16.5" height="40.3" />
          <rect x="98.5" y="24.85" width="5.5" height="18.3" />
          <path d="M17.5 26.7 A9.15 9.15 0 0 1 17.5 41.3" />
          <path d="M87.5 26.7 A9.15 9.15 0 0 0 87.5 41.3" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Bar a={split.def} b={split.mid} c={split.att} labels={[L("수비", "Def"), L("중원", "Mid"), L("공격", "Att")]} />
        <Bar a={split.left} b={split.center} c={split.right} labels={[L("왼쪽", "Left"), L("중앙", "Centre"), L("오른쪽", "Right")]} />
      </div>
    </motion.section>
  );
}
