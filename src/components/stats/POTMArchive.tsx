import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Trophy, ChevronDown } from "lucide-react";
import type { Player, Match, Roster, GoalEvent, MatchQuarter, Team, Result } from "@/hooks/useFutsalData";
import { computeNonDuplicatedAP, getPlayerName } from "@/hooks/useFutsalData";
import { computeDataMOM, computeDualDataMOM } from "@/hooks/useMatchAnalysis";
import { useTranslation } from "react-i18next";

interface Props {
  players: Player[];
  matches: Match[];
  teams: Team[];
  results: Result[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
}

export default function POTMArchive({ players, matches, teams, results, rosters, goalEvents, allQuarters }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const [expanded, setExpanded] = useState(false);

  const winners = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const memberPlayers = players.filter(p => !(p as any).is_guest);
    const months = [...new Set(matches.filter(m => m.date <= today).map(m => m.date.slice(0, 7)))].sort().reverse();

    return months.map(prefix => {
      const monthMatches = matches.filter(m => m.date.startsWith(prefix) && m.date <= today);
      if (monthMatches.length < 2) return null;
      const ids = new Set(monthMatches.map(m => m.id));
      const monthRosters = rosters.filter(r => ids.has(r.match_id));
      const monthGoalEvents = goalEvents.filter(g => ids.has(g.match_id));
      const monthQuarters = allQuarters.filter(q => ids.has(q.match_id));

      const scored = memberPlayers.map(p => {
        const { goals, assists } = computeNonDuplicatedAP(p.id, monthMatches, monthRosters, monthGoalEvents);
        const appearances = [...new Set(monthRosters.filter(r => r.player_id === p.id).map(r => r.match_id))].length;
        let momCount = 0;
        [...new Set(monthQuarters.map(q => q.match_id))].forEach(mid => {
          const match = monthMatches.find(m => m.id === mid);
          if (match?.is_custom) {
            const dual = computeDualDataMOM(mid, players, teams, goalEvents, allQuarters, results);
            if ((dual.teamA && dual.teamA.playerId === p.id) || (dual.teamB && dual.teamB.playerId === p.id)) momCount++;
          } else {
            const mom = computeDataMOM(mid, players, teams, goalEvents, allQuarters, results);
            if (mom && mom.playerId === p.id) momCount++;
          }
        });
        return { player: p, goals, assists, appearances, momCount, score: (goals + assists) * 2 + momCount * 5 };
      }).filter(s => s.appearances >= 1 && s.score > 0);

      if (scored.length === 0) return null;
      const best = scored.sort((a, b) => b.score - a.score)[0];
      const [y, mo] = prefix.split("-");
      return { ...best, prefix, year: Number(y), month: Number(mo), matchCount: monthMatches.length };
    }).filter(Boolean) as Array<{ player: Player; goals: number; assists: number; appearances: number; momCount: number; score: number; prefix: string; year: number; month: number; matchCount: number }>;
  }, [players, matches, teams, results, rosters, goalEvents, allQuarters]);

  if (winners.length === 0) return null;
  const visible = expanded ? winners : winners.slice(0, 4);

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl tracking-wider text-primary flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" /> {L("이달의 선수 아카이브", "POTM ARCHIVE")}
        </h3>
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
          {L(`역대 ${winners.length}회`, `${winners.length} WINNERS`)}
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        {L("월간 공격포인트와 Data MOM 선정 횟수를 합산해 매달 최고의 선수를 선정합니다. (월 2경기 이상)", "Each month's best performer, ranked by attack points and Data MOM awards. (2+ matches per month)")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((w, i) => (
          <motion.div
            key={w.prefix}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/20 via-background/40 to-orange-900/10 p-4 backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 text-7xl opacity-10">🏆</div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 border-yellow-500/50 bg-secondary">
                {w.player.profile_image_url ? (
                  <img src={w.player.profile_image_url} alt={getPlayerName(players, w.player.id, lang)} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><User size={22} className="text-yellow-500/50" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold tracking-widest text-yellow-400/70">
                  {isEn ? `${w.year}.${String(w.month).padStart(2, "0")}` : `${w.year}년 ${w.month}월`}
                </div>
                <div className="truncate font-display text-lg tracking-wide text-yellow-300">{getPlayerName(players, w.player.id, lang)}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-bold">
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-300">{L("골", "G")} {w.goals}</span>
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-300">{L("도움", "A")} {w.assists}</span>
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-300">{L("출전", "GP")} {w.appearances}</span>
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-300">MOM {w.momCount}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {winners.length > 4 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 py-2 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-500/10"
        >
          {expanded ? L("접기", "Show less") : L(`전체 수상자 보기 (${winners.length})`, `Show all winners (${winners.length})`)}
          <ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      )}
    </motion.section>
  );
}
