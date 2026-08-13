import { useMemo } from "react";
import { motion } from "framer-motion";
import { User, Trophy } from "lucide-react";
import type { Player, Match, Roster, GoalEvent, MatchQuarter, Team, Result } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";
import { computePOTMWinners } from "@/lib/potm";
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
  const winners = useMemo(
    () => computePOTMWinners(players, matches, teams, results, rosters, goalEvents, allQuarters),
    [players, matches, teams, results, rosters, goalEvents, allQuarters]
  );

  if (winners.length === 0) return null;
  const visible = winners;

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

      <div className="grid max-h-[36rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
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
    </motion.section>
  );
}
