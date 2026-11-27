import { motion } from "framer-motion";
import { ratingColor } from "@/components/player/RatingBadge";

export interface RecentRatingItem {
  matchId: number;
  date: string;
  opponent: string;
  rating: number;
  result: string | null;
}

/** FotMob-style recent form: one bar per match, height = rating, colour = rating band. */
export default function RecentRatings({ items, isEn, onOpen }: { items: RecentRatingItem[]; isEn: boolean; onOpen: (id: number) => void }) {
  if (items.length === 0) return null;
  const avg = items.reduce((s, i) => s + i.rating, 0) / items.length;
  return (
    <section className="surface mt-4 rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">{isEn ? "Recent form" : "최근 폼"}</h3>
        <span className="text-xs text-muted-foreground">
          {isEn ? `Avg. ${avg.toFixed(2)} · last ${items.length}` : `최근 ${items.length}경기 평균 ${avg.toFixed(2)}`}
        </span>
      </div>
      <div className="flex h-36 items-end gap-1.5">
        {items.map((it, i) => {
          const h = Math.max(12, ((it.rating - 4) / 6) * 100);
          return (
            <button key={it.matchId} onClick={() => onOpen(it.matchId)} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="font-num text-[10px] font-bold">{it.rating.toFixed(1)}</span>
              <motion.span
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 160, damping: 20 }}
                className={`w-full max-w-[22px] rounded-md ${ratingColor(it.rating)} opacity-90 group-hover:opacity-100`}
              />
              <span className="w-full truncate text-center text-[9px] text-muted-foreground">{it.opponent.slice(0, 3)}</span>
              <span className={`text-[9px] font-black ${it.result === "승" ? "text-win" : it.result === "패" ? "text-loss" : "text-muted-foreground"}`}>
                {it.result ? (isEn ? (it.result === "승" ? "W" : it.result === "패" ? "L" : "D") : it.result) : ""}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
