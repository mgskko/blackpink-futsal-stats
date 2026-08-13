import { motion } from "framer-motion";

type Dist = { GK: number; DF: number; MF: number; FW: number; total: number };

const ZONES: { key: keyof Omit<Dist, "total">; y: number }[] = [
  { key: "FW", y: 18 },
  { key: "MF", y: 42 },
  { key: "DF", y: 68 },
  { key: "GK", y: 90 },
];

export default function PitchHeatmap({ dist, isEn }: { dist: Dist; isEn: boolean }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  if (!dist || dist.total === 0) return null;
  const max = Math.max(dist.GK, dist.DF, dist.MF, dist.FW) || 1;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-lg text-primary">{L("히트맵", "Heatmap")}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {L(`출전 쿼터: ${dist.total}`, `Quarters played: ${dist.total}`)}
      </p>
      <div className="relative w-full overflow-hidden rounded-xl border border-green-900/60" style={{ aspectRatio: "3/4", backgroundColor: "#123c1b" }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />
          <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <div className="absolute left-1/2 top-0 h-[15%] w-1/2 -translate-x-1/2 border-b border-l border-r border-white/15" />
          <div className="absolute bottom-0 left-1/2 h-[15%] w-1/2 -translate-x-1/2 border-l border-r border-t border-white/15" />
        </div>
        {ZONES.map(z => {
          const v = dist[z.key];
          if (!v) return null;
          const intensity = v / max;
          return (
            <div
              key={z.key}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
              style={{
                top: `${z.y}%`,
                width: `${60 + intensity * 45}%`,
                height: `${22 + intensity * 20}%`,
                background: `radial-gradient(closest-side, rgba(239,68,68,${0.18 + intensity * 0.6}), rgba(250,204,21,${0.14 + intensity * 0.35}) 55%, rgba(34,197,94,${0.1 + intensity * 0.25}) 80%, transparent 100%)`,
              }}
            />
          );
        })}
        {ZONES.map(z => (
          dist[z.key] ? (
            <span key={`l-${z.key}`} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/50 px-1.5 py-px text-[10px] font-bold text-white" style={{ top: `${z.y}%` }}>
              {z.key} {dist[z.key]}Q
            </span>
          ) : null
        ))}
      </div>
    </motion.div>
  );
}