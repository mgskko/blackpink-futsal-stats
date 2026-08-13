import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Player, Match, Roster, GoalEvent, Team, Result, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";
import { computeBallonDor } from "@/lib/awards";

interface Props {
  players: Player[];
  matches: Match[];
  teams: Team[];
  results: Result[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
  isEn: boolean;
  lang?: string;
}

export default function BallonDorArchive({ players, matches, teams, results, rosters, goalEvents, allQuarters, isEn, lang }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const navigate = useNavigate();
  const seasons = useMemo(
    () => computeBallonDor(players, matches, teams, results, rosters, goalEvents, allQuarters),
    [players, matches, teams, results, rosters, goalEvents, allQuarters]
  );
  const [year, setYear] = useState<number | null>(null);
  const active = seasons.find(s => s.year === (year ?? seasons[0]?.year));

  if (!active) return null;
  const [winner, ...rest] = active.entries;
  const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `${r}`);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 overflow-hidden rounded-2xl border border-amber-400/40 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <h3 className="font-display text-base text-foreground">🏆 {L("발롱도르 (시즌 MVP)", "Ballon d'Or (Season MVP)")}</h3>
        <div className="flex gap-1 overflow-x-auto">
          {seasons.map(s => (
            <button key={s.year} onClick={() => setYear(s.year)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${active.year === s.year ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground"}`}>
              {s.year}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => navigate(`/player/${winner.playerId}`)} className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left">
        <span className="text-3xl">🥇</span>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{active.year} {L("발롱도르 위너", "Ballon d'Or Winner")}</div>
          <div className="font-display text-xl text-foreground">{getPlayerName(players, winner.playerId, lang)}</div>
          <div className="text-[11px] text-muted-foreground">
            {winner.goals}{L("골", "G")} · {winner.assists}{L("도움", "A")} · {winner.apps}{L("경기", "MP")} · POTM {winner.potm} · CS {winner.cleanSheets}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-primary">{winner.score}</div>
          <div className="text-[10px] text-muted-foreground">{L("포인트", "Pts")}</div>
        </div>
      </button>

      <div>
        {rest.slice(0, 9).map(e => (
          <button key={e.playerId} onClick={() => navigate(`/player/${e.playerId}`)}
            className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-2 text-left last:border-0 hover:bg-secondary/30">
            <span className="w-6 text-center text-xs font-bold text-muted-foreground">{medal(e.rank)}</span>
            <span className="flex-1 text-sm text-foreground">{getPlayerName(players, e.playerId, lang)}</span>
            <span className="text-[10px] text-muted-foreground">{e.goals}G · {e.assists}A · {e.apps}MP · {e.cleanSheets}CS</span>
            <span className="w-10 text-right text-sm font-bold text-foreground">{e.score}</span>
          </button>
        ))}
      </div>

      <div className="px-4 py-2 text-[10px] text-muted-foreground">
        {L("산정식: 골×3 + 도움×2 + 출전×1 + POTM×5 + 무실점(DF/GK)×2", "Formula: Goals×3 + Assists×2 + Apps×1 + POTM×5 + Clean sheets (DF/GK)×2")}
      </div>
    </motion.div>
  );
}
