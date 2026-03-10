import { useMemo } from "react";
import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerPosition, getPlayerTeamInLineup } from "./useCourtStats";

export interface MarketValueInfo {
  currentValue: number; // in 만원
  previousValue: number;
  change: number;
  changePercent: number;
  history: { matchDate: string; value: number }[];
}

const BASE_VALUE = 1000; // 1000만원 = 10,000,000원
const MIN_VALUE = 100; // 100만원 하한선

/**
 * Position-based market value algorithm
 * Iterates every quarter the player appeared in, chronologically,
 * accumulating value based on position-specific rules.
 */
export function computeMarketValue(
  playerId: number,
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[],
  worstVotes?: { match_id: number; voted_player_id: number }[],
  dataMomMap?: Map<number, number[]> // matchId -> [playerIds who are data MOM]
): MarketValueInfo {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches
    .filter(m => playerMatchIds.includes(m.id))
    .sort((a, b) => a.date.localeCompare(b.date));

  let value = BASE_VALUE;
  const history: { matchDate: string; value: number }[] = [{ matchDate: "시작", value: BASE_VALUE }];

  sortedMatches.forEach(m => {
    const mQuarters = allQuarters
      .filter(q => q.match_id === m.id && q.lineup)
      .sort((a, b) => a.quarter - b.quarter);

    let matchDelta = 0;

    // --- Per-quarter position-based logic ---
    mQuarters.forEach(q => {
      const pos = getPlayerPosition(q.lineup, playerId);
      if (!pos || pos === "Bench") return;

      const isCustom = q.lineup && typeof q.lineup === "object" && !Array.isArray(q.lineup) && (q.lineup.teamA || q.lineup.teamB);
      const pTeam = isCustom ? getPlayerTeamInLineup(q.lineup, playerId) : null;

      // Calculate conceded and margin for this player's team perspective
      let conceded = q.score_against || 0;
      let scored = q.score_for || 0;
      if (pTeam === "teamB") {
        conceded = q.score_for || 0;
        scored = q.score_against || 0;
      }
      const margin = scored - conceded;

      // Player's goals & assists in this quarter
      const qGoals = goalEvents.filter(g =>
        g.match_id === q.match_id && g.quarter === q.quarter &&
        g.goal_player_id === playerId && !g.is_own_goal
      ).length;
      const qAssists = goalEvents.filter(g =>
        g.match_id === q.match_id && g.quarter === q.quarter &&
        g.assist_player_id === playerId
      ).length;
      const qAP = qGoals + qAssists;

      // ⚔️ FW logic
      if (pos === "FW") {
        matchDelta += qGoals * 50;   // +50만원 per goal
        matchDelta += qAssists * 30; // +30만원 per assist
        if (qAP === 0) matchDelta -= 20; // -20만원 penalty for no contribution
      }

      // 🛡️ DF / GK logic
      if (pos === "DF" || pos === "GK") {
        if (conceded === 0) {
          matchDelta += 50; // +50만원 clean sheet bonus
        } else {
          matchDelta -= conceded * 10; // -10만원 per goal conceded
        }
      }

      // ⚖️ Common margin bonus (all positions)
      matchDelta += margin * 10; // +10만원 per margin point
    });

    // --- Per-match special events ---

    // 👑 Data MOM: find if this player had highest AP on their team
    const playerRoster = rosters.find(r => r.match_id === m.id && r.player_id === playerId);
    if (playerRoster) {
      const myTeamId = playerRoster.team_id;
      const teammates = rosters.filter(r => r.match_id === m.id && r.team_id === myTeamId);
      const teammateAPs = teammates.map(r => {
        const g = goalEvents.filter(g2 => g2.match_id === m.id && g2.goal_player_id === r.player_id && !g2.is_own_goal).length;
        const a = goalEvents.filter(g2 => g2.match_id === m.id && g2.assist_player_id === r.player_id).length;
        return { pid: r.player_id, ap: g + a };
      });
      const maxAP = Math.max(...teammateAPs.map(t => t.ap), 0);
      const myAP = teammateAPs.find(t => t.pid === playerId)?.ap || 0;
      if (myAP > 0 && myAP >= maxAP) {
        matchDelta += 200; // +200만원 Data MOM
      }
    }

    // 🤦‍♂️ Own goals
    const ownGoals = goalEvents.filter(g =>
      g.match_id === m.id && g.is_own_goal && g.goal_player_id === playerId
    ).length;
    matchDelta -= ownGoals * 100; // -100만원 per own goal

    // Apply match delta
    value += matchDelta;
    value = Math.max(MIN_VALUE, value);

    // 🚨 Worst vote: -20% of current total (applied AFTER delta)
    if (worstVotes) {
      const isWorst = worstVotes.some(v => v.match_id === m.id && v.voted_player_id === playerId);
      if (isWorst) {
        value = Math.round(value * 0.8);
        value = Math.max(MIN_VALUE, value);
      }
    }

    history.push({ matchDate: m.date, value });
  });

  // Calculate change from 5 matches ago
  const recentIdx = Math.max(0, history.length - 6);
  const previousValue = history[recentIdx]?.value || BASE_VALUE;
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
