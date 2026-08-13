import { motion } from "framer-motion";

type Dist = { GK: number; DF: number; MF: number; FW: number; total: number };

const POS_LABEL: Record<string, { ko: string; en: string; abbr: string; y: number }> = {
  FW: { ko: "스트라이커", en: "Striker", abbr: "FW", y: 16 },
  MF: { ko: "미드필더", en: "Midfielder", abbr: "MF", y: 42 },
  DF: { ko: "수비수", en: "Defender", abbr: "DF", y: 68 },
  GK: { ko: "골키퍼", en: "Goalkeeper", abbr: "GK", y: 89 },
};

export default function PlayerPositionCard({ dist, isEn }: { dist: Dist; isEn: boolean }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  if (!dist || dist.total === 0) return null;

  const ranked = (["FW", "MF", "DF", "GK"] as const)
    .map(k => ({ key: k, count: dist[k] }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);
  if (ranked.length === 0) return null;

  const main = ranked[0];
  const others = ranked.slice(1);
  const pct = (n: number) => Math.round((n / dist.total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">{L("포지션", "Position")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-bold text-yellow-500">{L("기본", "Main")}</div>
            <div className="text-base font-bold text-foreground">{L(POS_LABEL[main.key].ko, POS_LABEL[main.key].en)}</div>
            <div className="text-[11px] text-muted-foreground">{pct(main.count)}% · {main.count}Q</div>
          </div>
          {others.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground">{L("기타", "Other")}</div>
              {others.map(o => (
                <div key={o.key} className="text-sm text-foreground">
                  {L(POS_LABEL[o.key].ko, POS_LABEL[o.key].en)}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">{pct(o.count)}%</span>
                </div>
              ))}
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
          {ranked.map(r => (
            <span
              key={r.key}
              className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] font-bold ${
                r.key === main.key ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground"
              }`}
              style={{ top: `${POS_LABEL[r.key].y}%` }}
            >
              {POS_LABEL[r.key].abbr}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}