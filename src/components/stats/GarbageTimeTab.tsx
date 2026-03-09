import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Player, Match, Result, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerName, computeNonDuplicatedAP } from "@/hooks/useFutsalData";

interface Props {
  players: Player[];
  matches: Match[];
  results: Result[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
}

function getFieldPlayers(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  const result: number[] = [];
  ["GK", "DF", "MF", "FW"].forEach(pos => {
    if (lineup[pos]) (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).forEach((id: any) => result.push(Number(id)));
  });
  return result;
}

const GarbageTimeTab = ({ players, matches, results, rosters, goalEvents, allQuarters }: Props) => {
  const navigate = useNavigate();

  const ranking = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pastMatches = matches.filter(m => m.date <= today);

    // Per player: count appearances
    const playerAppearances = new Map<number, number>();
    rosters.forEach(r => {
      if (!pastMatches.some(m => m.id === r.match_id)) return;
      playerAppearances.set(r.player_id, (playerAppearances.get(r.player_id) || 0) + 1);
    });

    // Get total AP per player (min 10 AP)
    const playerTotalAP = new Map<number, number>();
    const playerMatchIds = new Map<number, Set<number>>();
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      [g.goal_player_id, g.assist_player_id].forEach(pid => {
        if (!pid) return;
        playerTotalAP.set(pid, (playerTotalAP.get(pid) || 0) + 1);
        if (!playerMatchIds.has(pid)) playerMatchIds.set(pid, new Set());
        playerMatchIds.get(pid)!.add(g.match_id);
      });
    });

    // Identify blowout matches: our team won by 2+ final margin
    const blowoutMatchIds = new Set<number>();
    pastMatches.forEach(m => {
      const mResults = results.filter(r => r.match_id === m.id);
      const ourResult = mResults.find(r => {
        const teams = rosters.filter(ro => ro.match_id === m.id && ro.team_id === r.team_id);
        return teams.length > 0;
      });
      // Check if final margin >= 2
      if (ourResult && ourResult.score_for != null && ourResult.score_against != null) {
        if ((ourResult.score_for - ourResult.score_against) >= 2) {
          blowoutMatchIds.add(m.id);
        }
      }
    });

    // 1st filter: AP in blowout matches (margin 2+)
    const blowoutAP = new Map<number, number>();
    goalEvents.forEach(g => {
      if (g.is_own_goal || !blowoutMatchIds.has(g.match_id)) return;
      [g.goal_player_id, g.assist_player_id].forEach(pid => {
        if (!pid) return;
        blowoutAP.set(pid, (blowoutAP.get(pid) || 0) + 1);
      });
    });

    // 2nd filter: AP in garbage time quarters (quarter margin already +2)
    const garbageAP = new Map<number, number>();
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q || !q.lineup) return;
      // Check if the cumulative margin before this quarter was already +2
      const matchQs = allQuarters.filter(mq => mq.match_id === g.match_id).sort((a, b) => a.quarter - b.quarter);
      let cumMargin = 0;
      for (const mq of matchQs) {
        if (mq.quarter >= g.quarter) break;
        cumMargin += (mq.score_for || 0) - (mq.score_against || 0);
      }
      if (cumMargin >= 2) {
        [g.goal_player_id, g.assist_player_id].forEach(pid => {
          if (!pid) return;
          garbageAP.set(pid, (garbageAP.get(pid) || 0) + 1);
        });
      }
    });

    // Combine and rank
    const eligible = players.filter(p => {
      const apps = playerAppearances.get(p.id) || 0;
      const totalAP = playerTotalAP.get(p.id) || 0;
      return apps >= 10 && totalAP >= 10;
    });

    return eligible.map(p => {
      const totalAP = playerTotalAP.get(p.id) || 1;
      const blowout = blowoutAP.get(p.id) || 0;
      const garbage = garbageAP.get(p.id) || 0;
      const blowoutRate = Math.round((blowout / totalAP) * 100);
      return {
        id: p.id,
        name: p.name,
        blowoutRate,
        garbageAP: garbage,
        totalAP,
        blowoutAP: blowout,
        score: blowoutRate + garbage,
      };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [players, matches, results, rosters, goalEvents, allQuarters]);

  if (ranking.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider text-primary">💸 민생지원금 수령자</h3>
      <p className="mb-2 text-[10px] text-muted-foreground">
        팀이 위기일 땐 안 보이지만, 2점 차 이상 대승 경기나 이미 이기고 있는 가비지 타임에 귀신같이 나타나 스탯을 세탁하는 진정한 자본주의 에이스입니다.
      </p>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {ranking.map((d, i) => (
          <div key={d.id} onClick={() => navigate(`/player/${d.id}`)}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < ranking.length - 1 ? "border-b border-border" : ""}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
              <div>
                <span className="text-sm font-medium text-foreground">{d.name}</span>
                <div className="text-[10px] text-muted-foreground">대승경기 AP {d.blowoutAP}개({d.blowoutRate}%) | 가비지타임 {d.garbageAP}AP</div>
              </div>
            </div>
            <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.score}pt</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GarbageTimeTab;
