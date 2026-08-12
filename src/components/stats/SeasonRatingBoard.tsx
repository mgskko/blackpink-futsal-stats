import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Star, ChevronDown, Info } from "lucide-react";
import { computeSeasonRatings, RATING_V2 } from "@/hooks/useSeasonRating";
import { useFines } from "@/hooks/useFines";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";

interface Props {
  isEn: boolean;
  lang: string;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  quarters: MatchQuarter[];
  seasonLabel: string;
}

const ratingTone = (r: number) =>
  r >= 8 ? "bg-green-500/15 text-green-400 border-green-500/30"
  : r >= 7 ? "bg-primary/15 text-primary border-primary/30"
  : r >= 6.3 ? "bg-secondary/60 text-foreground border-border"
  : "bg-muted/40 text-muted-foreground border-border";

export default function SeasonRatingBoard({ isEn, lang, players, matches, rosters, goalEvents, quarters, seasonLabel }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const navigate = useNavigate();
  const { data: fines } = useFines();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const fineCounts = useMemo(() => {
    const m = new Map<number, number>();
    (fines ?? []).forEach(f => { if (!f.is_waived) m.set(f.player_id, (m.get(f.player_id) ?? 0) + 1); });
    return m;
  }, [fines]);

  const rows = useMemo(
    () => computeSeasonRatings(players, matches, rosters, goalEvents, quarters, fineCounts).filter(r => r.appearances >= 2),
    [players, matches, rosters, goalEvents, quarters, fineCounts]
  );

  if (rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-lg text-primary">
            <Star size={16} className="fill-primary" /> {L("시즌 평점 랭킹", "Season Ratings")}
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {seasonLabel} · {L("수비수/키퍼 기여도가 반영된 v2 퍼포먼스 점수", "Performance Score v2 — defender & keeper friendly")}
          </p>
        </div>
        <button onClick={() => setShowFormula(v => !v)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:border-primary/50 hover:text-primary">
          <Info size={11} /> {L("산정 기준", "Rating System")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showFormula && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-secondary/30 px-4 text-[10px] leading-relaxed text-muted-foreground">
            <li className="pt-3">• {L(`기본 평점 ${RATING_V2.base.toFixed(1)}점`, `Base ${RATING_V2.base.toFixed(1)}`)}</li>
            <li>• {L("득점 +0.4 / 도움 +0.3", "Goal +0.4 / Assist +0.3")}</li>
            <li>• {L("DF·GK 무실점 쿼터 +0.4, 실점 억제 최대 +0.3, GK 헌신 최대 +0.3", "DF/GK clean-sheet quarter +0.4, concession suppression up to +0.3, GK devotion up to +0.3")}</li>
            <li>• {L("쿼터 평균 마진 × 0.15", "Avg quarter margin × 0.15")}</li>
            <li className="pb-3">• {L("벌금 1회당 -0.2 (2경기 이상 출전자 대상, 10점 만점)", "-0.2 per fine · min 2 appearances · out of 10")}</li>
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="hidden grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3.2rem] gap-1 border-b border-border px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground sm:grid">
        <span>#</span><span>{L("선수", "Player")}</span>
        <span className="text-center">{L("경기", "MP")}</span>
        <span className="text-center">G</span>
        <span className="text-center">A</span>
        <span className="text-center">CS</span>
        <span className="text-right">{L("평점", "Rating")}</span>
      </div>

      <div>
        {visible.map((r, i) => {
          const open = expanded === r.playerId;
          return (
            <div key={r.playerId} className="border-b border-border/60 last:border-0">
              <button onClick={() => setExpanded(open ? null : r.playerId)}
                className="grid w-full grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3.2rem] items-center gap-1 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40">
                <span className={`font-display text-sm ${i === 0 ? "text-yellow-400" : i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                <span className="flex items-center gap-1 truncate text-xs font-bold text-foreground">
                  {getPlayerName(players, r.playerId, lang)}
                  <ChevronDown size={12} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
                <span className="text-center text-[11px] text-muted-foreground">{r.appearances}</span>
                <span className="text-center text-[11px] text-foreground">{r.goals}</span>
                <span className="text-center text-[11px] text-foreground">{r.assists}</span>
                <span className="text-center text-[11px] text-foreground">{r.cleanSheets}</span>
                <span className={`ml-auto rounded-md border px-1.5 py-0.5 text-right font-display text-xs ${ratingTone(r.rating)}`}>
                  {r.rating.toFixed(2)}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-secondary/25">
                    <div className="grid grid-cols-2 gap-2 px-4 py-3 text-[10px] sm:grid-cols-4">
                      {[
                        [L("공격 기여", "Attack"), `+${r.attackScore.toFixed(2)}`],
                        [L("수비/키퍼", "Defense/GK"), `+${r.defenseScore.toFixed(2)}`],
                        [L("팀 마진", "Team margin"), `${r.marginScore >= 0 ? "+" : ""}${r.marginScore.toFixed(2)}`],
                        [L("벌금 감점", "Fine penalty"), `-${r.penalty.toFixed(2)}`],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-border bg-card/60 px-2 py-1.5">
                          <div className="text-muted-foreground">{k}</div>
                          <div className="font-display text-sm text-foreground">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 px-4 pb-3 text-[10px] text-muted-foreground">
                      <span>{L("출전 쿼터", "Quarters")} {r.quarters}</span>
                      <span>{L("수비 쿼터", "DF/GK quarters")} {r.defQuarters}</span>
                      <span>{L("쿼터 평균 실점", "Conceded/Q")} {r.avgConceded.toFixed(2)}</span>
                      <span>{L("쿼터 평균 마진", "Margin/Q")} {r.avgMargin > 0 ? "+" : ""}{r.avgMargin.toFixed(2)}</span>
                      <button onClick={() => navigate(`/player/${r.playerId}`)} className="ml-auto font-bold text-primary hover:underline">
                        {L("프로필 보기", "View profile")} →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {rows.length > 10 && (
        <button onClick={() => setShowAll(v => !v)}
          className="w-full border-t border-border py-2.5 text-[11px] font-bold text-muted-foreground hover:text-primary">
          {showAll ? L("접기", "Show less") : L(`전체 ${rows.length}명 보기`, `Show all ${rows.length} players`)}
        </button>
      )}
    </motion.div>
  );
}
