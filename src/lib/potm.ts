import type { Player, Match, Roster, GoalEvent, MatchQuarter, Team, Result } from "@/hooks/useFutsalData";
import { computeNonDuplicatedAP } from "@/hooks/useFutsalData";
import { computeDataMOM, computeDualDataMOM } from "@/hooks/useMatchAnalysis";

export interface POTMWinner {
  player: Player;
  goals: number;
  assists: number;
  appearances: number;
  momCount: number;
  score: number;
  prefix: string;
  year: number;
  month: number;
  matchCount: number;
}

/** Player of the Month winners, newest first. Shared by the Statistics archive and player trophies. */
export function computePOTMWinners(
  players: Player[] = [],
  matches: Match[] = [],
  teams: Team[] = [],
  results: Result[] = [],
  rosters: Roster[] = [],
  goalEvents: GoalEvent[] = [],
  allQuarters: MatchQuarter[] = [],
): POTMWinner[] {
  const today = new Date().toISOString().slice(0, 10);
  const memberPlayers = (players ?? []).filter(p => p && !(p as any).is_guest);
  const played = (matches ?? []).filter(m => m?.date && m.date <= today);
  const months = [...new Set(played.map(m => m.date.slice(0, 7)))].sort().reverse();

  return months.map(prefix => {
    const monthMatches = played.filter(m => m.date.startsWith(prefix));
    if (monthMatches.length < 2) return null;
    const ids = new Set(monthMatches.map(m => m.id));
    const monthRosters = (rosters ?? []).filter(r => ids.has(r?.match_id));
    const monthGoalEvents = (goalEvents ?? []).filter(g => ids.has(g?.match_id));
    const monthQuarters = (allQuarters ?? []).filter(q => ids.has(q?.match_id));

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
  }).filter(Boolean) as POTMWinner[];
}
