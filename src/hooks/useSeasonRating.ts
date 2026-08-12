import { computeMatchAP } from "./useFutsalData";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerPosition, getPlayerTeamInLineup } from "./useCourtStats";

// ─── Season Rating v2 ───
// base 6.0 + goals*0.4 + assists*0.3
// + clean-sheet quarters as DF/GK * 0.4
// + concession-suppression bonus (DF/GK) up to +0.3
// + GK devotion bonus up to +0.3
// + avg quarter margin * 0.15
// - fines * 0.2
export const RATING_V2 = {
  base: 6.0,
  goal: 0.4,
  assist: 0.3,
  cleanSheet: 0.4,
  suppression: 0.3,
  gkBonus: 0.3,
  margin: 0.15,
  finePenalty: 0.2,
};

export interface RatingBreakdown {
  playerId: number;
  appearances: number;
  goals: number;
  assists: number;
  quarters: number;
  defQuarters: number;
  gkQuarters: number;
  cleanSheets: number;
  avgConceded: number;
  avgMargin: number;
  fines: number;
  attackScore: number;
  defenseScore: number;
  marginScore: number;
  penalty: number;
  rating: number;
}

export function computeSeasonRatings(
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  fineCountByPlayer: Map<number, number> = new Map(),
): RatingBreakdown[] {
  const today = new Date().toISOString().slice(0, 10);
  const played = matches.filter(m => m.date <= today);
  const playedIds = new Set(played.map(m => m.id));

  return players.map(p => {
    const myRosters = rosters.filter(r => r.player_id === p.id && playedIds.has(r.match_id));
    const matchIds = [...new Set(myRosters.map(r => r.match_id))];
    let goals = 0, assists = 0;
    matchIds.forEach(mid => {
      const m = played.find(x => x.id === mid);
      if (!m) return;
      const ap = computeMatchAP(p.id, m, rosters, goalEvents);
      goals += ap.goals;
      assists += ap.assists;
    });

    let qCount = 0, defQ = 0, gkQ = 0, cleanSheets = 0, conceded = 0, marginSum = 0;
    quarters.filter(q => playedIds.has(q.match_id)).forEach(q => {
      const pos = getPlayerPosition(q.lineup, p.id);
      if (!pos || pos === "BENCH") return;
      const team = getPlayerTeamInLineup(q.lineup, p.id);
      const forGoals = team === "teamB" ? (q.score_against || 0) : (q.score_for || 0);
      const agGoals = team === "teamB" ? (q.score_for || 0) : (q.score_against || 0);
      qCount++;
      marginSum += forGoals - agGoals;
      if (pos === "GK" || pos === "DF") {
        defQ++;
        conceded += agGoals;
        if (agGoals === 0) cleanSheets++;
        if (pos === "GK") gkQ++;
      }
    });

    const avgConceded = defQ > 0 ? conceded / defQ : 0;
    const avgMargin = qCount > 0 ? marginSum / qCount : 0;
    const fines = fineCountByPlayer.get(p.id) ?? 0;

    const attackScore = goals * RATING_V2.goal + assists * RATING_V2.assist;
    const csScore = cleanSheets * RATING_V2.cleanSheet;
    const suppression = defQ > 0 ? Math.max(0, Math.min(1, (1.5 - avgConceded) / 1.5)) * RATING_V2.suppression : 0;
    const gkScore = qCount > 0 ? (gkQ / qCount) * RATING_V2.gkBonus : 0;
    const defenseScore = csScore + suppression + gkScore;
    const marginScore = avgMargin * RATING_V2.margin;
    const penalty = fines * RATING_V2.finePenalty;

    const raw = matchIds.length === 0
      ? 0
      : RATING_V2.base + attackScore + defenseScore + marginScore - penalty;
    const rating = matchIds.length === 0 ? 0 : Math.max(5, Math.min(10, Math.round(raw * 100) / 100));

    return {
      playerId: p.id,
      appearances: matchIds.length,
      goals, assists,
      quarters: qCount,
      defQuarters: defQ,
      gkQuarters: gkQ,
      cleanSheets,
      avgConceded: Math.round(avgConceded * 100) / 100,
      avgMargin: Math.round(avgMargin * 100) / 100,
      fines,
      attackScore: Math.round(attackScore * 100) / 100,
      defenseScore: Math.round(defenseScore * 100) / 100,
      marginScore: Math.round(marginScore * 100) / 100,
      penalty: Math.round(penalty * 100) / 100,
      rating,
    };
  }).filter(r => r.appearances > 0).sort((a, b) => b.rating - a.rating);
}
