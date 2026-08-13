import { computeMatchAP } from "./useFutsalData";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerPosition, getPlayerTeamInLineup } from "./useCourtStats";

// ─── Season Rating v2.1 (per-match normalized, lineup-optional) ───
// base 6.0
// + attack   : (goals*0.4 + assists*0.3) / appearances * gain
// + defense  : (cleanSheetRate*0.4 + suppressionRate*0.3 + gkRate*0.3) * gain   (only when lineup data exists)
// + avg quarter margin * 0.15 (clamped ±1.5)
// - fines * 0.2
// clamped to 1.0 ~ 10.0
// NOTE: older seasons often have no per-quarter lineup logs. Normalizing by the
// (very small) number of logged quarters used to inflate ratings to the 10.0 cap
// and zero out seasons with no lineup data at all — both are fixed here.
export const RATING_V2 = {
  base: 6.0,
  goal: 0.4,
  assist: 0.3,
  cleanSheet: 0.4,
  suppression: 0.3,
  gkBonus: 0.3,
  margin: 0.15,
  finePenalty: 0.2,
  gain: 2, // per-match normalization gain so values spread naturally
  min: 1,
  max: 10,
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
  playersInput: Player[] = [],
  matchesInput: Match[] = [],
  rostersInput: Roster[] = [],
  goalEventsInput: GoalEvent[] = [],
  quartersInput: MatchQuarter[] = [],
  fineCountByPlayer: Map<number, number> = new Map(),
): RatingBreakdown[] {
  const players = Array.isArray(playersInput) ? playersInput.filter(Boolean) : [];
  const matches = Array.isArray(matchesInput) ? matchesInput.filter(m => m?.date) : [];
  const rosters = Array.isArray(rostersInput) ? rostersInput.filter(Boolean) : [];
  const goalEvents = Array.isArray(goalEventsInput) ? goalEventsInput.filter(Boolean) : [];
  const quarters = Array.isArray(quartersInput) ? quartersInput.filter(Boolean) : [];
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
    const apps = matchIds.length;
    const div = apps > 0 ? apps : 1;

    // per-match normalized attack contribution (independent of lineup logging)
    const attackScore = ((goals * RATING_V2.goal + assists * RATING_V2.assist) / div) * RATING_V2.gain;

    // defense uses rates, so partial lineup logs can't inflate the score
    const csRate = defQ > 0 ? cleanSheets / defQ : 0;
    const suppressionRate = defQ > 0 ? Math.max(0, Math.min(1, (1.5 - avgConceded) / 1.5)) : 0;
    const gkRate = defQ > 0 ? gkQ / defQ : 0;
    const defenseScore = defQ > 0
      ? (csRate * RATING_V2.cleanSheet + suppressionRate * RATING_V2.suppression + gkRate * RATING_V2.gkBonus) * RATING_V2.gain
      : 0;
    const marginScore = Math.max(-1.5, Math.min(1.5, avgMargin * RATING_V2.margin));
    const penalty = fines * RATING_V2.finePenalty;

    const hasData = apps > 0;
    const rawUnsafe = RATING_V2.base + attackScore + defenseScore + marginScore - penalty;
    const raw = Number.isFinite(rawUnsafe) ? rawUnsafe : RATING_V2.base;
    const rating = hasData
      ? Math.max(RATING_V2.min, Math.min(RATING_V2.max, Math.round(raw * 100) / 100))
      : 0;

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
