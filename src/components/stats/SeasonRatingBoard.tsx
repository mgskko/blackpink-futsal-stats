import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Star, ChevronDown, Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

type SortKey = "name" | "appearances" | "goals" | "assists" | "cleanSheets" | "rating";

function SortHead({ label, k, align = "center", sortKey, sortDir, onSort }: {
  label: string; k: SortKey; align?: "left" | "center" | "right";
  sortKey: SortKey; sortDir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button onClick={() => onSort(k)}
      className={`flex items-center gap-0.5 uppercase transition-colors hover:text-primary ${active ? "text-primary" : ""} ${
        align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center"
      }`}>
      {label}<Icon size={9} className={active ? "opacity-100" : "opacity-40"} />
    </button>
  );
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
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const fineCounts = useMemo(() => {
    const m = new Map<number, number>();
    (fines ?? []).forEach(f => { if (!f.is_waived) m.set(f.player_id, (m.get(f.player_id) ?? 0) + 1); });
    return m;
  }, [fines]);

  const baseRows = useMemo(
    () => computeSeasonRatings(players ?? [], matches ?? [], rosters ?? [], goalEvents ?? [], quarters ?? [], fineCounts)
      .filter(r => r.appearances >= 2),
    [players, matches, rosters, goalEvents, quarters, fineCounts]
  );

  const rows = useMemo(() => {
    const sorted = [...baseRows];
    sorted.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") {
        cmp = String(getPlayerName(players ?? [], a.playerId, lang) ?? "")
          .localeCompare(String(getPlayerName(players ?? [], b.playerId, lang) ?? ""));
      } else {
        cmp = ((a[sortKey] as number) ?? 0) - ((b[sortKey] as number) ?? 0);
        if (cmp === 0) cmp = a.rating - b.rating;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [baseRows, sortKey, sortDir, players, lang]);

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
            {seasonLabel} · {L("쿼터당 기여도로 정규화한 v2 퍼포먼스 점수", "Performance Score v2 — per-quarter normalized")}
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
            <li>• {L("쿼터당 공격 기여: (골×0.4 + 도움×0.3) ÷ 출전 쿼터", "Attack per quarter: (G×0.4 + A×0.3) ÷ quarters")}</li>
            <li>• {L("쿼터당 수비 기여: (무실점×0.4 + 실점 억제 + GK 헌신) ÷ 출전 쿼터", "Defense per quarter: (CS×0.4 + suppression + GK devotion) ÷ quarters")}</li>
            <li>• {L("쿼터 평균 마진 × 0.15", "Avg quarter margin × 0.15")}</li>
            <li>• {L("벌금 1회당 -0.2", "-0.2 per fine")}</li>
            <li className="pb-3">• {L("1.0 ~ 10.0점으로 정규화 (2경기 이상 출전자)", "Normalized to 1.0 – 10.0 · min 2 appearances")}</li>
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3.2rem] gap-1 border-b border-border px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <SortHead label={L("선수", "Player")} k="name" align="left" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <SortHead label={L("경기", "MP")} k="appearances" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <SortHead label="G" k="goals" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <SortHead label="A" k="assists" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <SortHead label="CS" k="cleanSheets" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <SortHead label={L("평점", "Rating")} k="rating" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
