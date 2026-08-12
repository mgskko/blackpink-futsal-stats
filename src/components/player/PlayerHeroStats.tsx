import { motion } from "framer-motion";

interface Props {
  isEn: boolean;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  winRate: number;
  margin?: number | null;
  ppq?: number | null;
  goalsPerGame: string;
}

/** FotMob-style key metric summary card. */
export default function PlayerHeroStats({ isEn, rating, appearances, goals, assists, winRate, margin, ppq, goalsPerGame }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const ratingColor = rating >= 7.5 ? "bg-green-500/20 text-green-400 border-green-500/40"
    : rating >= 6.8 ? "bg-primary/20 text-primary border-primary/40"
    : "bg-muted text-muted-foreground border-border";

  const main = [
    { label: L("출전", "Matches"), value: appearances },
    { label: L("골", "Goals"), value: goals },
    { label: L("도움", "Assists"), value: assists },
  ];
  const sub = [
    { label: L("공격포인트", "G+A"), value: goals + assists },
    { label: L("경기당 골", "Goals / match"), value: goalsPerGame },
    { label: L("승률", "Win rate"), value: `${winRate}%` },
    { label: "+/-", value: margin === null || margin === undefined ? "-" : margin > 0 ? `+${margin}` : `${margin}` },
    { label: "PPQ", value: ppq === null || ppq === undefined ? "-" : ppq.toFixed(2) },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {L("핵심 지표", "Key stats")}
        </span>
        <span className={`rounded-lg border px-2.5 py-1 font-display text-lg leading-none ${ratingColor}`}>
          {rating.toFixed(2)}
          <span className="ml-1 align-middle text-[9px] font-bold uppercase tracking-wider opacity-70">
            {L("평점", "Rating")}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border">
        {main.map(s => (
          <div key={s.label} className="px-2 py-4 text-center">
            <div className="font-display text-3xl text-primary text-glow">{s.value}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-px border-t border-border bg-border">
        {sub.map(s => (
          <div key={s.label} className="bg-card px-1 py-2.5 text-center">
            <div className="font-display text-base text-foreground">{s.value}</div>
            <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
