import { useMemo } from "react";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";
import { computeMatchAP } from "./useFutsalData";
import { getPlayerPosition, getPlayerTeamInLineup } from "./useCourtStats";

export interface MarketValueInfo {
  currentValue: number; // in 만원
  previousValue: number;
  change: number;
  changePercent: number;
  history: { matchDate: string; value: number }[];
}

const BASE_VALUE = 1000; // 1000만원

function computeMatchRating(
  playerId: number,
  match: Match,
  rosters: Roster[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  worstVotes?: { match_id: number; voted_player_id: number }[]
): number {
  const { goals, assists } = computeMatchAP(playerId, match, rosters, goalEvents);
  let rating = 6.0; // base rating

  // Goals & assists
  rating += goals * 0.8;
  rating += assists * 0.5;

  // Position-based bonuses from quarters
  const mQuarters = quarters.filter(q => q.match_id === match.id && q.lineup);
  let cleanSheets = 0;
  let totalMargin = 0;
  let quartersPlayed = 0;

  mQuarters.forEach(q => {
    const pos = getPlayerPosition(q.lineup, playerId);
    if (!pos || pos === "Bench") return;
    quartersPlayed++;

    const isCustom = q.lineup && typeof q.lineup === "object" && !Array.isArray(q.lineup) && (q.lineup.teamA || q.lineup.teamB);
    let conceded = q.score_against || 0;
    let diff = (q.score_for || 0) - (q.score_against || 0);
    if (isCustom) {
      const team = getPlayerTeamInLineup(q.lineup, playerId);
      if (team === "teamB") {
        conceded = q.score_for || 0;
        diff = -diff;
      }
    }

    totalMargin += diff;
    if ((pos === "DF" || pos === "GK") && conceded === 0) {
      cleanSheets++;
    }
  });

  // Margin bonus
  if (quartersPlayed > 0) {
    const avgMargin = totalMargin / quartersPlayed;
    rating += avgMargin * 0.3;
  }

  // Clean sheet bonus for DF/GK
  rating += cleanSheets * 0.3;

  // Worst vote penalty
  if (worstVotes) {
    const isWorst = worstVotes.some(v => v.match_id === match.id && v.voted_player_id === playerId);
    if (isWorst) rating -= 2.0;
  }

  return Math.max(3.0, Math.min(10.0, rating));
}

export function computeMarketValue(
  playerId: number,
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[],
  worstVotes?: { match_id: number; voted_player_id: number }[]
): MarketValueInfo {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches
    .filter(m => playerMatchIds.includes(m.id))
    .sort((a, b) => a.date.localeCompare(b.date));

  let value = BASE_VALUE;
  const history: { matchDate: string; value: number }[] = [{ matchDate: "시작", value: BASE_VALUE }];

  sortedMatches.forEach(m => {
    const rating = computeMatchRating(playerId, m, rosters, goalEvents, allQuarters, worstVotes);

    // Value change based on rating
    let changePercent = 0;
    if (rating >= 8.5) changePercent = 15;
    else if (rating >= 7.5) changePercent = 8;
    else if (rating >= 7.0) changePercent = 4;
    else if (rating >= 6.5) changePercent = 1;
    else if (rating >= 6.0) changePercent = -1;
    else if (rating >= 5.5) changePercent = -4;
    else if (rating >= 5.0) changePercent = -8;
    else changePercent = -20; // worst performance = crash

    value = Math.round(value * (1 + changePercent / 100));
    value = Math.max(100, value); // minimum 100만원
    history.push({ matchDate: m.date, value });
  });

  const previousValue = history.length >= 3 ? history[history.length - 2].value : BASE_VALUE;
  const change = value - previousValue;
  const changePercent = previousValue > 0 ? Math.round((change / previousValue) * 100) : 0;

  return { currentValue: value, previousValue, change, changePercent, history };
}

export function useMarketValue(
  playerId: number,
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[],
  worstVotes?: { match_id: number; voted_player_id: number }[]
) {
  return useMemo(
    () => computeMarketValue(playerId, players, matches, rosters, goalEvents, allQuarters, worstVotes),
    [playerId, players, matches, rosters, goalEvents, allQuarters, worstVotes]
  );
}

// Find the biggest value crasher for "먹튀" title
export function getBiggestCrasher(
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[],
  worstVotes?: { match_id: number; voted_player_id: number }[]
): { playerId: number; name: string; crashPercent: number } | null {
  let worst: { playerId: number; name: string; crashPercent: number } | null = null;

  players.forEach(p => {
    if ((p as any).is_guest) return;
    const mv = computeMarketValue(p.id, players, matches, rosters, goalEvents, allQuarters, worstVotes);
    if (mv.history.length < 5) return;

    // Find biggest drop from peak
    let peak = BASE_VALUE;
    let maxCrash = 0;
    mv.history.forEach(h => {
      if (h.value > peak) peak = h.value;
      const crash = ((peak - h.value) / peak) * 100;
      if (crash > maxCrash) maxCrash = crash;
    });

    if (!worst || maxCrash > worst.crashPercent) {
      worst = { playerId: p.id, name: p.name, crashPercent: Math.round(maxCrash) };
    }
  });

  return worst;
}
