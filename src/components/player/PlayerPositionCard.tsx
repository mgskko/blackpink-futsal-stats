import { motion } from "framer-motion";
import { getSlot, slotLabel, roleLabel, isSlotForSport } from "@/lib/positions";

type Dist = {
  GK: number; DF: number; MF: number; FW: number; total: number;
  slots?: Record<string, number>;
  crossSportExcluded?: number;
  unassigned?: number;
};

const POS_Y: Record<string, number> = { FW: 16, MF: 42, DF: 68, GK: 89 };


type Node = { key: string; label: string; abbr: string; count: number; x: number; y: number };

/** Nudge apart nodes that would render on top of each other on the mini map. */
function spread(nodes: Node[]): Node[] {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  for (let pass = 0; pass < 5; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (Math.abs(a.y - b.y) >= 13) continue;
        const dx = b.x - a.x;
        const overlap = 30 - Math.abs(dx);
        if (overlap <= 0) continue;
        const dir = dx === 0 ? 1 : Math.sign(dx);
        a.x = clamp(a.x - dir * (overlap / 2 + 1), 14, 86);
        b.x = clamp(b.x + dir * (overlap / 2 + 1), 14, 86);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return nodes;
}

export default function PlayerPositionCard({
  dist, isEn, formatCode,
}: { dist: Dist; isEn: boolean; formatCode?: string | null }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  if (!dist || dist.total === 0) return null;

  const slotEntries = Object.entries(dist.slots ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const useSlots = slotEntries.length > 0;

  const nodes: Node[] = useSlots
    ? spread(
        slotEntries.slice(0, 6).map(([code, count]) => {
          const sl = getSlot(code, formatCode);
          return {
            key: code,
            label: slotLabel(code, isEn, formatCode),
            abbr: code,
            count,
            x: sl?.x ?? 50,
            y: sl?.y ?? 50,
          };
        })
      )
    : (["FW", "MF", "DF", "GK"] as const)
        .filter(k => dist[k] > 0)
        .sort((a, b) => dist[b] - dist[a])
        .map(k => ({
          key: k,
          label: L(POS_LABEL[k].ko, POS_LABEL[k].en),
          abbr: POS_LABEL[k].abbr,
          count: dist[k],
          x: 50,
          y: POS_LABEL[k].y,
        }));

  if (nodes.length === 0) return null;

  const ranked = [...nodes].sort((a, b) => b.count - a.count);
  const main = ranked[0];
  const others = ranked.slice(1);
  const denom = useSlots ? slotEntries.reduce((s, [, n]) => s + n, 0) || dist.total : dist.total;
  const pct = (n: number) => Math.round((n / denom) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">{L("포지션", "Position")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-bold text-yellow-500">{L("기본", "Primary")}</div>
            <div className="text-base font-bold leading-tight text-foreground">{main.label}</div>
            <div className="text-[11px] text-muted-foreground">{pct(main.count)}% · {main.count}Q</div>
          </div>
          {others.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold text-muted-foreground">{L("기타", "Others")}</div>
              <div className="space-y-0.5">
                {others.map(o => (
                  <div key={o.key} className="flex items-baseline gap-1.5 text-sm text-foreground">
                    <span className="truncate">{o.label}</span>
                    <span className="text-[11px] text-muted-foreground">{pct(o.count)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-secondary/40" style={{ aspectRatio: "3/4" }}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-foreground/15" />
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/15" />
            <div className="absolute left-1/2 top-0 h-[16%] w-1/2 -translate-x-1/2 border-b border-l border-r border-foreground/15" />
            <div className="absolute bottom-0 left-1/2 h-[16%] w-1/2 -translate-x-1/2 border-l border-r border-t border-foreground/15" />
          </div>
          {nodes.map(n => (
            <span
              key={n.key}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                n.key === main.key ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground"
              }`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.abbr}
            </span>
          ))}
        </div>
      </div>

      {useSlots && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[11px] font-bold text-muted-foreground">{L("세부 포지션", "Detailed roles")}</div>
          <div className="flex flex-wrap gap-1.5">
            {slotEntries.slice(0, 8).map(([code, n]) => (
              <span key={code} className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-foreground">
                {slotLabel(code, isEn, formatCode)} <span className="text-muted-foreground">{n}Q · {pct(n)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
