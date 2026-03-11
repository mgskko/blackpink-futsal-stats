import { useMemo } from "react";
import type { Player, Match, Team, Result, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerName } from "./useFutsalData";

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
function scorePlayersForMatch(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[],
  filterTeam?: "teamA" | "teamB"
): DataMOMResult[] {
  const matchGoals = goalEvents.filter(g => g.match_id === matchId);
  const matchQuarters = quarters.filter(q => q.match_id === matchId).sort((a, b) => a.quarter - b.quarter);

  if (!hasLineupData(matchQuarters)) return [];
  if (matchGoals.length === 0 && matchQuarters.length === 0) return [];

  // 1. 초기화
  const playerState = new Map<number, { attack: number; defense: number; penalty: number; marginSum: number; quartersPlayed: number; playedFW: boolean; apCount: number }>();
  const init = (pid: number) => {
    if (!playerState.has(pid)) playerState.set(pid, { attack: 0, defense: 0, penalty: 0, marginSum: 0, quartersPlayed: 0, playedFW: false, apCount: 0 });
    return playerState.get(pid)!;
  };

  // 쿼터 번호 → 라인업 맵 (공격 점수 계산 시 포지션 조회용)
  const quarterLineupMap = new Map<number, any>();
  matchQuarters.forEach(q => { if (q.lineup) quarterLineupMap.set(q.quarter, q.lineup); });

  // 2. 쿼터별 공통 & 수비 점수
  matchQuarters.forEach(q => {
    if (!q.lineup) return;
    const isCustom = isCustomLineup(q.lineup);
    const fieldPlayers = getFieldPlayers(q.lineup);
    const baseDiff = (q.score_for || 0) - (q.score_against || 0);
    const baseConceded = q.score_against || 0;

    fieldPlayers.forEach(pid => {
      if (filterTeam && isCustom) {
        const pTeam = getPlayerTeamInLineup(q.lineup, pid);
        if (pTeam !== filterTeam) return;
      }

      const s = init(pid);
      const pos = getPlayerPosition(q.lineup, pid);

      let diff = baseDiff;
      let conceded = baseConceded;
      if (isCustom) {
        const pTeam = getPlayerTeamInLineup(q.lineup, pid);
        if (pTeam === "teamB") {
          diff = -baseDiff;
          conceded = q.score_for || 0;
        }
      }

      s.quartersPlayed += 1;

      // ⚖️ 공통 코트 마진 → defense
      s.defense += diff;
      s.marginSum += diff;

      // 🛡️ DF/GK 점수
      if (pos === "DF" || pos === "GK") {
        if (conceded === 0) {
          s.defense += 3;
        } else {
          s.defense -= conceded * 0.2;
        }
      }

      // ⚔️ FW 체크
      if (pos === "FW") {
        s.playedFW = true;
      }
    });
  });

  // 3. 공격 점수 (DF/GK 수트라이커 보너스 적용)
  matchGoals.forEach(g => {
    const lineup = quarterLineupMap.get(g.quarter);

    if (g.goal_player_id && !g.is_own_goal) {
      const s = init(g.goal_player_id);
      const pos = lineup ? getPlayerPosition(lineup, g.goal_player_id) : null;
      if (pos === "DF" || pos === "GK") {
        s.attack += 5;
      } else {
        s.attack += 3;
      }
      s.apCount += 1;
    }
    if (g.assist_player_id) {
      const s = init(g.assist_player_id);
      const pos = lineup ? getPlayerPosition(lineup, g.assist_player_id) : null;
      if (pos === "DF" || pos === "GK") {
        s.attack += 3;
      } else {
        s.attack += 2;
      }
      s.apCount += 1;
    }
  });

  // 4. 무득점 공격수 페널티
  playerState.forEach(s => {
    if (s.playedFW && s.apCount === 0) {
      s.penalty -= 1;
    }
  });

  // 5. 정렬 및 필터링
  let scored = [...playerState.entries()].map(([pid, s]) => ({
    playerId: pid,
    name: getPlayerName(players, pid),
    score: s.attack + s.defense + s.penalty,
    breakdown: {
      attack: s.attack,
      defense: s.defense,
      clutch: 0,
      penalty: s.penalty,
    },
    marginSum: s.marginSum,
    quartersPlayed: s.quartersPlayed,
  })).sort((a, b) =>
    b.score - a.score ||
    b.marginSum - a.marginSum ||
    a.quartersPlayed - b.quartersPlayed
  );

  if (filterTeam) {
    const teamPlayerIds = new Set<number>();
    matchQuarters.forEach(q => {
      if (!q.lineup || !isCustomLineup(q.lineup)) return;
      const teamLineup = (q.lineup as any)[filterTeam];
      if (teamLineup) getFieldPlayersFlat(teamLineup).forEach(pid => teamPlayerIds.add(pid));
    });
    scored = scored.filter(s => teamPlayerIds.has(s.playerId));
  }

  return scored;
}

export function computeDataMOM(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[]
): DataMOMResult | null {
  const scored = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results);
  return scored.length > 0 ? scored[0] : null;
}

/** For custom matches: returns one MOM per team */
export function computeDualDataMOM(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[]
): { teamA: DataMOMResult | null; teamB: DataMOMResult | null } {
  const matchQuarters = quarters.filter(q => q.match_id === matchId);
  const isCustom = matchQuarters.some(q => q.lineup && isCustomLineup(q.lineup));
  if (!isCustom) {
    const single = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results);
    return { teamA: single.length > 0 ? { ...single[0], team: "teamA" } : null, teamB: null };
  }

  const teamAScored = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, "teamA");
  const teamBScored = scorePlayersForMatch(matchId, players, teams, goalEvents, quarters, results, "teamB");

  return {
    teamA: teamAScored.length > 0 ? { ...teamAScored[0], team: "teamA" } : null,
    teamB: teamBScored.length > 0 ? { ...teamBScored[0], team: "teamB" } : null,
  };
}

// ─── AI Match Comment Generator (Fake News Style) ───
export function generateMatchComment(
  matchId: number,
  players: Player[],
  teams: Team[],
  results: Result[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[]
): string[] {
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
  const oppName = oppTeam?.name || "상대팀";
  const ourName = ourTeam?.name || "버니즈";

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
      comments.push(`📰 [속보] ${ourName}, ${oppName}을 ${scoreFor}-${scoreAgainst}로 영혼까지 털어버리다! ${topScorer ? `(${getPlayerName(players, topScorer[0])} ${topScorer[1]}골 하드캐리)` : ""}`);
    } else if (diff >= 3) {
      comments.push(`📰 [속보] ${ourName}, ${oppName} 상대 ${scoreFor}-${scoreAgainst} 완승! ${topScorer ? `${getPlayerName(players, topScorer[0])} 선수의 활약이 빛났다.` : ""}`);
    } else if (diff === 1 || diff === 2) {
      comments.push(`📰 [긴급] ${ourName}, 치열한 접전 끝에 ${scoreFor}-${scoreAgainst} 짜릿한 승리! 끝까지 포기하지 않았다.`);
    } else if (diff === 0) {
      comments.push(`📰 [단독] ${scoreFor}-${scoreAgainst}, 양 팀 모두 한 치의 양보 없는 격전... 승자 없는 무승부.`);
    } else if (diff >= -2) {
      if (ownGoals.length > 0) {
        const ogPlayer = ownGoals[0].goal_player_id;
        comments.push(`📰 [단독] 충격의 패배... ${ogPlayer ? `${getPlayerName(players, ogPlayer)} 선수의 치명적 자책골로 분위기 박살!` : "자책골이 승부를 갈랐다."} (${scoreFor}-${scoreAgainst})`);
      } else {
        comments.push(`📰 [속보] ${ourName}, ${oppName}에 ${scoreFor}-${scoreAgainst} 아쉬운 역전패. 재정비가 필요한 시점.`);
      }
    } else {
      comments.push(`📰 [비보] ${ourName}, ${oppName}에 ${scoreFor}-${scoreAgainst} 충격의 대패! 긴급 전술 회의 소집됐다.`);
    }
  }

  // Sub-headlines
  if (topScorer && topScorer[1] >= 3) {
    comments.push(`⚡ ${getPlayerName(players, topScorer[0])} 선수 ${topScorer[1]}골 원맨쇼! 상대 수비진은 속수무책이었다.`);
  } else if (topScorer && topScorer[1] >= 2) {
    comments.push(`⚽ ${getPlayerName(players, topScorer[0])} 선수 멀티골(${topScorer[1]}골)! 결정적 순간마다 등장한 에이스.`);
  }

  if (topAssister && topAssister[1] >= 2) {
    comments.push(`🎯 ${getPlayerName(players, topAssister[0])} 선수 ${topAssister[1]}어시스트! 팀의 공격을 설계한 컨트롤 타워.`);
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
      comments.push(`🛡️ ${getPlayerName(players, bestDF[0])} 선수가 수비진을 이끌며 ${bestDF[1].clean}쿼터 무실점의 철벽을 완성했다.`);
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
  quarters: MatchQuarter[]
) {
  const dataMOM = useMemo(() => computeDataMOM(matchId, players, teams, goalEvents, quarters, results), [matchId, players, teams, goalEvents, quarters, results]);
  const dualDataMOM = useMemo(() => computeDualDataMOM(matchId, players, teams, goalEvents, quarters, results), [matchId, players, teams, goalEvents, quarters, results]);
  const aiComments = useMemo(() => generateMatchComment(matchId, players, teams, results, goalEvents, quarters), [matchId, players, teams, results, goalEvents, quarters]);
  return { dataMOM, dualDataMOM, aiComments };
}
