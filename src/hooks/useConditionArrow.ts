import type { Match, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";
import { computeMatchAP } from "./useFutsalData";
import { computeMatchCourtMargins } from "./useCourtStats";

export type ConditionLevel = "up" | "flat" | "down";

export interface ConditionInfo {
  level: ConditionLevel;
  emoji: string;
  colorClass: string;
}

export function getPlayerCondition(
  playerId: number,
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[]
): ConditionInfo {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sorted = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  const recent3 = sorted.slice(0, 3);

  if (recent3.length < 3) return { level: "flat", emoji: "➡️", colorClass: "text-yellow-400" };

  // Compute AP trend
  const aps = recent3.map(m => {
    const { goals, assists } = computeMatchAP(playerId, m, rosters, goalEvents);
    return goals + assists;
  });

  // Compute margin trend
  let totalMargin = 0;
  recent3.forEach(m => {
    const mq = allQuarters.filter(q => q.match_id === m.id).sort((a, b) => a.quarter - b.quarter);
    const me = goalEvents.filter(g => g.match_id === m.id);
    if (mq.length > 0) {
      const margins = computeMatchCourtMargins(mq, me, []);
      const pm = margins.get(playerId);
      if (pm) totalMargin += pm.margin;
    }
  });

  const totalAP = aps.reduce((s, a) => s + a, 0);
  const apTrend = aps[0] >= aps[2]; // most recent >= oldest
  const avgMargin = totalMargin / 3;

  // Scoring
  let score = 0;
  if (totalAP >= 6) score += 2;
  else if (totalAP >= 3) score += 1;
  else score -= 1;

  if (avgMargin > 0.5) score += 1;
  else if (avgMargin < -0.5) score -= 1;

  if (apTrend) score += 1;
  else score -= 1;

  if (score >= 2) return { level: "up", emoji: "↗️", colorClass: "text-red-400" };
  if (score <= -1) return { level: "down", emoji: "↘️", colorClass: "text-blue-400" };
  return { level: "flat", emoji: "➡️", colorClass: "text-yellow-400" };
}
