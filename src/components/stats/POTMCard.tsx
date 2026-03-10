import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { User, Download } from "lucide-react";
import html2canvas from "html2canvas";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { computeNonDuplicatedAP } from "@/hooks/useFutsalData";
import { computeDataMOM } from "@/hooks/useMatchAnalysis";
import type { Team, Result } from "@/hooks/useFutsalData";

interface Props {
  players: Player[];
  matches: Match[];
  teams: Team[];
  results: Result[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
}

export default function POTMCard({ players, matches, teams, results, rosters, goalEvents, allQuarters }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const potm = useMemo(() => {
    const now = new Date();
    // Check previous month
    const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;

    const monthMatches = matches.filter(m => m.date.startsWith(prefix) && m.date <= now.toISOString().slice(0, 10));
    if (monthMatches.length < 2) return null;

    const monthMatchIds = new Set(monthMatches.map(m => m.id));
    const monthRosters = rosters.filter(r => monthMatchIds.has(r.match_id));
    const monthGoalEvents = goalEvents.filter(g => monthMatchIds.has(g.match_id));
    const monthQuarters = allQuarters.filter(q => monthMatchIds.has(q.match_id));

    // Compute AP + Data MOM counts per player
    const memberPlayers = players.filter(p => !(p as any).is_guest);
    const playerScores = memberPlayers.map(p => {
      const { goals, assists } = computeNonDuplicatedAP(p.id, monthMatches, monthRosters, monthGoalEvents);
      const appearances = [...new Set(monthRosters.filter(r => r.player_id === p.id).map(r => r.match_id))].length;
      
      // Count Data MOM
      let momCount = 0;
      const matchIdsWithQ = [...new Set(monthQuarters.map(q => q.match_id))];
      matchIdsWithQ.forEach(mid => {
        const mom = computeDataMOM(mid, players, teams, goalEvents, allQuarters, results);
        if (mom && mom.playerId === p.id) momCount++;
      });

      return { player: p, goals, assists, ap: goals + assists, appearances, momCount, score: (goals + assists) * 2 + momCount * 5 };
    }).filter(p => p.appearances >= 1);

    if (playerScores.length === 0) return null;

    const best = playerScores.sort((a, b) => b.score - a.score)[0];
    return { ...best, year, month };
  }, [players, matches, teams, results, rosters, goalEvents, allQuarters]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
    const link = document.createElement("a");
    link.download = `POTM_${potm?.year}_${potm?.month}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  if (!potm) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <h3 className="mb-3 font-display text-xl tracking-wider text-primary flex items-center gap-2">🏆 PLAYER OF THE MONTH</h3>
      <div ref={cardRef} className="relative rounded-xl border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 via-amber-900/20 to-orange-900/30 p-5 overflow-hidden">
        {/* Gold shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent animate-pulse pointer-events-none" />
        
        <div className="relative z-10">
          <div className="text-center mb-1">
            <span className="text-[10px] font-bold tracking-widest text-yellow-400/70">{potm.year}년 {potm.month}월</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border-2 border-yellow-500/50 bg-secondary overflow-hidden shadow-lg shadow-yellow-500/10 flex-shrink-0">
              {potm.player.profile_image_url ? (
                <img src={potm.player.profile_image_url} alt={potm.player.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><User size={32} className="text-yellow-500/50" /></div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-display text-2xl text-yellow-400 tracking-wide">{potm.player.name}</div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="text-center">
                  <div className="font-display text-lg text-yellow-300">{potm.goals}</div>
                  <div className="text-[8px] text-yellow-500/60">골</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-lg text-yellow-300">{potm.assists}</div>
                  <div className="text-[8px] text-yellow-500/60">도움</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-lg text-yellow-300">{potm.appearances}</div>
                  <div className="text-[8px] text-yellow-500/60">출전</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-lg text-yellow-300">{potm.momCount}</div>
                  <div className="text-[8px] text-yellow-500/60">MOM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button onClick={handleDownload} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 py-2 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-500/10">
        <Download size={14} /> 카드 이미지 저장
      </button>
    </motion.div>
  );
}
