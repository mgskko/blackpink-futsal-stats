import { useMemo } from "react";
import type { Player, Match, Team, Result, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerName } from "./useFutsalData";
import { computeMatchRatings } from "@/lib/matchRating";

// ─── Data MOM Scoring System ───
export interface DataMOMResult {
  playerId: number;
  name: string;
  score: number;
  breakdown: {
    attack: number;
    defense: number;
    clutch: number;
    penalty: number;
  };
  team?: "teamA" | "teamB";
}

// ─── Lineup helpers that support teamA/teamB format ───

function isCustomLineup(lineup: any): boolean {
  return lineup && typeof lineup === "object" && !Array.isArray(lineup) && (lineup.teamA || lineup.teamB);
}

function getPlayerPositionFlat(lineup: any, playerId: number): string | null {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return null;
  if (lineup.GK && (Array.isArray(lineup.GK) ? lineup.GK : [lineup.GK]).map(Number).includes(playerId)) return "GK";
  if (lineup.DF && (Array.isArray(lineup.DF) ? lineup.DF : [lineup.DF]).map(Number).includes(playerId)) return "DF";
  if (lineup.MF && (Array.isArray(lineup.MF) ? lineup.MF : [lineup.MF]).map(Number).includes(playerId)) return "MF";
  if (lineup.FW && (Array.isArray(lineup.FW) ? lineup.FW : [lineup.FW]).map(Number).includes(playerId)) return "FW";
  if (lineup.Bench && (Array.isArray(lineup.Bench) ? lineup.Bench : [lineup.Bench]).map(Number).includes(playerId)) return "Bench";
  return null;
}

function getPlayerPosition(lineup: any, playerId: number): string | null {
  if (!lineup) return null;
  if (isCustomLineup(lineup)) {
    return getPlayerPositionFlat(lineup.teamA, playerId) || getPlayerPositionFlat(lineup.teamB, playerId);
  }
  return getPlayerPositionFlat(lineup, playerId);
}

function getPlayerTeamInLineup(lineup: any, playerId: number): "teamA" | "teamB" | null {
  if (!isCustomLineup(lineup)) return null;
  if (getPlayerPositionFlat(lineup.teamA, playerId)) return "teamA";
  if (getPlayerPositionFlat(lineup.teamB, playerId)) return "teamB";
  return null;
}

function getFieldPlayersFlat(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  const result: number[] = [];
  ["GK", "DF", "MF", "FW"].forEach(pos => {
    if (lineup[pos]) {
      (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).forEach((id: any) => result.push(Number(id)));
    }
  });
  return result;
}

function getFieldPlayers(lineup: any): number[] {
  if (!lineup) return [];
  if (isCustomLineup(lineup)) {
    return [...getFieldPlayersFlat(lineup.teamA), ...getFieldPlayersFlat(lineup.teamB)];
  }
  return getFieldPlayersFlat(lineup);
}

function hasLineupData(quarters: MatchQuarter[]): boolean {
  return quarters.some(q => {
    if (!q.lineup || typeof q.lineup !== "object" || Array.isArray(q.lineup)) return false;
    const l = q.lineup as any;
    if (l.GK) return true;
    if (l.teamA?.GK || l.teamB?.GK) return true;
    return false;
  });
}

function getFWPlayersFromLineup(lineup: any): number[] {
  if (!lineup) return [];
  if (isCustomLineup(lineup)) {
    const a = lineup.teamA?.FW ? (Array.isArray(lineup.teamA.FW) ? lineup.teamA.FW : [lineup.teamA.FW]).map(Number) : [];
    const b = lineup.teamB?.FW ? (Array.isArray(lineup.teamB.FW) ? lineup.teamB.FW : [lineup.teamB.FW]).map(Number) : [];
    return [...a, ...b];
  }
  return (typeof lineup === "object" && !Array.isArray(lineup) && lineup.FW)
    ? (Array.isArray(lineup.FW) ? lineup.FW : [lineup.FW]).map(Number) : [];
}

function getDFGKPlayersFromLineup(lineup: any): number[] {
  if (!lineup) return [];
  const extract = (l: any) => {
    const result: number[] = [];
    if (l?.GK) (Array.isArray(l.GK) ? l.GK : [l.GK]).forEach((id: any) => result.push(Number(id)));
    if (l?.DF) (Array.isArray(l.DF) ? l.DF : [l.DF]).forEach((id: any) => result.push(Number(id)));
    return result;
  };
  if (isCustomLineup(lineup)) {
    return [...extract(lineup.teamA), ...extract(lineup.teamB)];
  }
  return extract(lineup);
}

function getDFPlayersFromLineup(lineup: any): number[] {
  if (!lineup) return [];
  const extract = (l: any) => {
    if (!l?.DF) return [];
    return (Array.isArray(l.DF) ? l.DF : [l.DF]).map(Number);
  };
  if (isCustomLineup(lineup)) {
    return [...extract(lineup.teamA), ...extract(lineup.teamB)];
  }
  return extract(lineup);
}

// ─── Core scoring logic ───
/**
 * Data MOM v2 = FotMob "Player of the Match": the highest match rating from the
 * unified rating engine (src/lib/matchRating.ts), so MOM, the lineup badges and
 * the player profile can never disagree.
 * Ties → more goals+assists → more quarters played → better on-pitch margin.
 * breakdown: attack = goals/assists term, defense = defensive + on-pitch impact,
 * clutch = team-result term, penalty = discipline/own goals.
 */
export function scorePlayersForMatch(
  matchId: number,
  players: Player[],
  _teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  _results: Result[],
  filterTeam?: "teamA" | "teamB",
  match?: Match | null,
  overrides?: Map<number, number>
): DataMOMResult[] {
  const matchQuarters = quarters.filter(q => q.match_id === matchId).sort((a, b) => a.quarter - b.quarter);
  if (!hasLineupData(matchQuarters)) return [];

  const m: Match = match ?? ({ id: matchId, date: "", venue_id: 0, match_type: "", is_custom: false, has_detail_log: true, youtube_link: null } as Match);
  const ratings = computeMatchRatings({
    match: m,
    quarters: matchQuarters,
    goalEvents: goalEvents.filter(g => g.match_id === matchId),
    overrides,
  });

  let teamIds: Set<number> | null = null;
  if (filterTeam) {
    teamIds = new Set<number>();
    matchQuarters.forEach(q => {
      if (!q.lineup || !isCustomLineup(q.lineup)) return;
      const unit = (q.lineup as any)[filterTeam];
      if (unit) getFieldPlayersFlat(unit).forEach(pid => teamIds!.add(pid));
    });
  }

  return [...ratings.values()]
    .filter(r => r.quartersPlayed > 0 && (!teamIds || teamIds.has(r.playerId)))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.goals + b.assists - (a.goals + a.assists) ||
        b.quartersPlayed - a.quartersPlayed ||
        b.impact - a.impact
    )
    .map(r => ({
      playerId: r.playerId,
      name: getPlayerName(players, r.playerId),
      score: r.rating,
      breakdown: {
        attack: r.attack,
        defense: Math.round((r.defense + r.impact) * 100) / 100,
        clutch: r.teamMod,
        penalty: r.discipline + r.ownGoals * -0.8,
      },
    }));
}

export function computeDataMOM(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[],
  match?: Match | null,
  overrides?: Map<number, number>
): DataMOMResult | null {
  const scored = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, undefined, match, overrides);
  return scored.length > 0 ? scored[0] : null;
}

/** For custom matches: returns one MOM per team */
export function computeDualDataMOM(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[],
  match?: Match | null,
  overrides?: Map<number, number>
): { teamA: DataMOMResult | null; teamB: DataMOMResult | null } {
  const matchQuarters = quarters.filter(q => q.match_id === matchId);
  const isCustom = matchQuarters.some(q => q.lineup && isCustomLineup(q.lineup));
  if (!isCustom) {
    const single = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, undefined, match, overrides);
    return { teamA: single.length > 0 ? { ...single[0], team: "teamA" } : null, teamB: null };
  }
  const a = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, "teamA", match, overrides);
  const b = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, "teamB", match, overrides);
  return {
    teamA: a.length > 0 ? { ...a[0], team: "teamA" } : null,
    teamB: b.length > 0 ? { ...b[0], team: "teamB" } : null,
  };
}

// ─── AI Match Comment Generator (Fake News Style) ───
export function generateMatchComment(
  matchId: number,
  players: Player[],
  teams: Team[],
  results: Result[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  lang: string = "ko"
): string[] {
  const isEn = (lang || "ko").startsWith("en");
  const pn = (id: number) => getPlayerName(players, id, lang);
  const teamName = (name: string | undefined, fallback: string) => {
    const n = name || fallback;
    if (!isEn) return n;
    if (n === "버니즈") return "Bunnies FC";
    if (n === "상대팀") return "Opponent";
    return n;
  };
  const comments: string[] = [];
  const matchGoals = goalEvents.filter(g => g.match_id === matchId);
  const matchQuarters = quarters.filter(q => q.match_id === matchId).sort((a, b) => a.quarter - b.quarter);
  const matchTeams = teams.filter(t => t.match_id === matchId);
  const ourTeam = matchTeams.find(t => t.is_ours);
  const oppTeam = matchTeams.find(t => !t.is_ours);
  const ourTeamIds = new Set(matchTeams.filter(t => t.is_ours).map(t => t.id));

  if (matchGoals.length === 0 && matchQuarters.length === 0) return comments;

  const ourResult = results.find(r => matchTeams.some(t => t.is_ours && t.id === r.team_id) && r.match_id === matchId);
  const scoreFor = ourResult?.score_for ?? 0;
  const scoreAgainst = ourResult?.score_against ?? 0;
  const diff = scoreFor - scoreAgainst;
  const oppName = teamName(oppTeam?.name, "상대팀");
  const ourName = teamName(ourTeam?.name, "버니즈");

  // Own goal check
  const ownGoals = matchGoals.filter(g => g.is_own_goal && ourTeamIds.has(g.team_id));

  // Top scorer
  const playerGoals = new Map<number, number>();
  const playerAssists = new Map<number, number>();
  matchGoals.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal && ourTeamIds.has(g.team_id)) {
      playerGoals.set(g.goal_player_id, (playerGoals.get(g.goal_player_id) || 0) + 1);
    }
    if (g.assist_player_id && ourTeamIds.has(g.team_id)) {
      playerAssists.set(g.assist_player_id, (playerAssists.get(g.assist_player_id) || 0) + 1);
    }
  });
  const topScorer = [...playerGoals.entries()].sort((a, b) => b[1] - a[1])[0];
  const topAssister = [...playerAssists.entries()].sort((a, b) => b[1] - a[1])[0];

  // Fake News headline
  if (ourResult) {
    if (diff >= 5) {
      comments.push(isEn
        ? `📰 [BREAKING] ${ourName} demolish ${oppName} ${scoreFor}-${scoreAgainst}! ${topScorer ? `(${pn(topScorer[0])} hard-carried with ${topScorer[1]}G)` : ""}`
        : `📰 [속보] ${ourName}, ${oppName}을 ${scoreFor}-${scoreAgainst}로 영혼까지 털어버리다! ${topScorer ? `(${pn(topScorer[0])} ${topScorer[1]}골 하드캐리)` : ""}`);
    } else if (diff >= 3) {
      comments.push(isEn
        ? `📰 [BREAKING] ${ourName} beat ${oppName} ${scoreFor}-${scoreAgainst} in style! ${topScorer ? `${pn(topScorer[0])} was the standout.` : ""}`
        : `📰 [속보] ${ourName}, ${oppName} 상대 ${scoreFor}-${scoreAgainst} 완승! ${topScorer ? `${pn(topScorer[0])} 선수의 활약이 빛났다.` : ""}`);
    } else if (diff === 1 || diff === 2) {
      comments.push(isEn
        ? `📰 [URGENT] ${ourName} edge a thriller ${scoreFor}-${scoreAgainst} — never gave up till the whistle.`
        : `📰 [긴급] ${ourName}, 치열한 접전 끝에 ${scoreFor}-${scoreAgainst} 짜릿한 승리! 끝까지 포기하지 않았다.`);
    } else if (diff === 0) {
      comments.push(isEn
        ? `📰 [EXCLUSIVE] ${scoreFor}-${scoreAgainst} deadlock — no winners, no losers, just a battle royale.`
        : `📰 [단독] ${scoreFor}-${scoreAgainst}, 양 팀 모두 한 치의 양보 없는 격전... 승자 없는 무승부.`);
    } else if (diff >= -2) {
      if (ownGoals.length > 0) {
        const ogPlayer = ownGoals[0].goal_player_id;
        comments.push(isEn
          ? `📰 [EXCLUSIVE] Shock defeat... ${ogPlayer ? `${pn(ogPlayer)}'s brutal own goal killed the vibe!` : "an own goal decided it."} (${scoreFor}-${scoreAgainst})`
          : `📰 [단독] 충격의 패배... ${ogPlayer ? `${pn(ogPlayer)} 선수의 치명적 자책골로 분위기 박살!` : "자책골이 승부를 갈랐다."} (${scoreFor}-${scoreAgainst})`);
      } else {
        comments.push(isEn
          ? `📰 [BREAKING] ${ourName} slip to a painful ${scoreFor}-${scoreAgainst} loss vs ${oppName}. Time to regroup.`
          : `📰 [속보] ${ourName}, ${oppName}에 ${scoreFor}-${scoreAgainst} 아쉬운 역전패. 재정비가 필요한 시점.`);
      }
    } else {
      comments.push(isEn
        ? `📰 [SHOCK] ${ourName} thumped ${scoreFor}-${scoreAgainst} by ${oppName}! Emergency tactical meeting called.`
        : `📰 [비보] ${ourName}, ${oppName}에 ${scoreFor}-${scoreAgainst} 충격의 대패! 긴급 전술 회의 소집됐다.`);
    }
  }

  // Sub-headlines
  if (topScorer && topScorer[1] >= 3) {
    comments.push(isEn
      ? `⚡ ${pn(topScorer[0])}'s ${topScorer[1]}-goal one-man show! The defence had no answer.`
      : `⚡ ${pn(topScorer[0])} 선수 ${topScorer[1]}골 원맨쇼! 상대 수비진은 속수무책이었다.`);
  } else if (topScorer && topScorer[1] >= 2) {
    comments.push(isEn
      ? `⚽ ${pn(topScorer[0])} bags a brace (${topScorer[1]}G)! Ace of the decisive moments.`
      : `⚽ ${pn(topScorer[0])} 선수 멀티골(${topScorer[1]}골)! 결정적 순간마다 등장한 에이스.`);
  }

  if (topAssister && topAssister[1] >= 2) {
    comments.push(isEn
      ? `🎯 ${pn(topAssister[0])} racks up ${topAssister[1]} assists — the control tower behind the attack.`
      : `🎯 ${pn(topAssister[0])} 선수 ${topAssister[1]}어시스트! 팀의 공격을 설계한 컨트롤 타워.`);
  }

  // DF/GK analysis
  if (hasLineupData(matchQuarters)) {
    const dfQuarterCleanSheets = new Map<number, { clean: number; total: number }>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const dfPlayers = getDFGKPlayersFromLineup(q.lineup);
      dfPlayers.forEach((pid: number) => {
        const cur = dfQuarterCleanSheets.get(pid) || { clean: 0, total: 0 };
        cur.total++;
        let conceded = q.score_against || 0;
        if (isCustomLineup(q.lineup) && getPlayerTeamInLineup(q.lineup, pid) === "teamB") {
          conceded = q.score_for || 0;
        }
        if (conceded === 0) cur.clean++;
        dfQuarterCleanSheets.set(pid, cur);
      });
    });
    const bestDF = [...dfQuarterCleanSheets.entries()]
      .filter(([, v]) => v.total >= 2 && v.clean / v.total >= 0.7)
      .sort((a, b) => b[1].clean - a[1].clean)[0];
    if (bestDF) {
      comments.push(isEn
        ? `🛡️ ${pn(bestDF[0])} marshalled the back-line with ${bestDF[1].clean} clean-sheet quarter${bestDF[1].clean > 1 ? "s" : ""}.`
        : `🛡️ ${pn(bestDF[0])} 선수가 수비진을 이끌며 ${bestDF[1].clean}쿼터 무실점의 철벽을 완성했다.`);
    }
  }

  return comments.slice(0, 3);
}

// ─── Hook for match analysis ───
export function useMatchAnalysis(
  matchId: number,
  players: Player[],
  teams: Team[],
  results: Result[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  lang: string = "ko",
  match?: Match | null,
  overrides?: Map<number, number>
) {
  const dataMOM = useMemo(() => computeDataMOM(matchId, players, teams, goalEvents, quarters, results, match, overrides), [matchId, players, teams, goalEvents, quarters, results, match, overrides]);
  const dualDataMOM = useMemo(() => computeDualDataMOM(matchId, players, teams, goalEvents, quarters, results, match, overrides), [matchId, players, teams, goalEvents, quarters, results, match, overrides]);
  const aiComments = useMemo(() => generateMatchComment(matchId, players, teams, results, goalEvents, quarters, lang), [matchId, players, teams, results, goalEvents, quarters, lang]);
  return { dataMOM, dualDataMOM, aiComments };
}
