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

  const playerScores = new Map<number, { attack: number; defense: number; clutch: number; penalty: number }>();
  const initScore = (pid: number) => {
    if (!playerScores.has(pid)) playerScores.set(pid, { attack: 0, defense: 0, clutch: 0, penalty: 0 });
    return playerScores.get(pid)!;
  };

  // Attack scoring
  matchGoals.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal) {
      const s = initScore(g.goal_player_id);
      s.attack += 3;
    }
    if (g.assist_player_id) {
      const s = initScore(g.assist_player_id);
      s.attack += 2.5;
    }
    if (g.is_own_goal && g.goal_player_id) {
      const s = initScore(g.goal_player_id);
      s.penalty -= 2;
    }
  });

  // Defense scoring from quarters
  matchQuarters.forEach(q => {
    if (!q.lineup) return;
    const isCustom = isCustomLineup(q.lineup);
    const fieldPlayers = getFieldPlayers(q.lineup);
    const baseDiff = (q.score_for || 0) - (q.score_against || 0);
    const baseConceded = q.score_against || 0;

    fieldPlayers.forEach(pid => {
      // If filtering by team, skip players not on that team
      if (filterTeam && isCustom) {
        const pTeam = getPlayerTeamInLineup(q.lineup, pid);
        if (pTeam !== filterTeam) return;
      }

      const s = initScore(pid);
      const pos = getPlayerPosition(q.lineup, pid);

      // For custom matches, flip margin/conceded for teamB
      let diff = baseDiff;
      let conceded = baseConceded;
      if (isCustom) {
        const pTeam = getPlayerTeamInLineup(q.lineup, pid);
        if (pTeam === "teamB") {
          diff = -baseDiff;
          conceded = q.score_for || 0;
        }
      }

      s.defense += 0.5;

      if (pos === "DF" || pos === "GK") {
        s.defense += diff * 2;
        if (conceded === 0) s.defense += 1;
      }
    });
  });

  // Penalty: Silent FW
  const fwQuarterCount = new Map<number, number>();
  matchQuarters.forEach(q => {
    if (!q.lineup) return;
    const fwPlayers = getFWPlayersFromLineup(q.lineup);
    fwPlayers.forEach((pid: number) => {
      if (filterTeam && isCustomLineup(q.lineup) && getPlayerTeamInLineup(q.lineup, pid) !== filterTeam) return;
      fwQuarterCount.set(pid, (fwQuarterCount.get(pid) || 0) + 1);
    });
  });
  fwQuarterCount.forEach((count, pid) => {
    if (count >= 3) {
      const goals = matchGoals.filter(g => g.goal_player_id === pid && !g.is_own_goal).length;
      const assists = matchGoals.filter(g => g.assist_player_id === pid).length;
      if (goals + assists === 0) {
        const s = initScore(pid);
        s.penalty -= 3;
      }
    }
  });

  // Penalty: Leaky DF/GK
  const dfGkConceded = new Map<number, number>();
  matchQuarters.forEach(q => {
    if (!q.lineup) return;
    const isCustom = isCustomLineup(q.lineup);
    const dfGkPlayers = getDFGKPlayersFromLineup(q.lineup);
    dfGkPlayers.forEach(pid => {
      if (filterTeam && isCustom && getPlayerTeamInLineup(q.lineup, pid) !== filterTeam) return;
      let conceded = q.score_against || 0;
      if (isCustom && getPlayerTeamInLineup(q.lineup, pid) === "teamB") {
        conceded = q.score_for || 0;
      }
      dfGkConceded.set(pid, (dfGkConceded.get(pid) || 0) + conceded);
    });
  });
  dfGkConceded.forEach((totalConceded, pid) => {
    if (totalConceded >= 5) {
      const s = initScore(pid);
      s.penalty -= 3;
    }
  });

  // Filter to only players on the specified team if applicable
  let scored = [...playerScores.entries()].map(([pid, s]) => ({
    playerId: pid,
    name: getPlayerName(players, pid),
    score: s.attack + s.defense + s.clutch + s.penalty,
    breakdown: s,
  })).sort((a, b) => b.score - a.score);

  if (filterTeam) {
    const teamPlayerIds = new Set<number>();
    matchQuarters.forEach(q => {
      if (!q.lineup || !isCustomLineup(q.lineup)) return;
      const teamLineup = q.lineup[filterTeam];
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

// ─── AI Match Comment Generator ───
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
  const ourTeamIds = new Set(matchTeams.filter(t => t.is_ours).map(t => t.id));

  if (matchGoals.length === 0 && matchQuarters.length === 0) return comments;

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
  if (topScorer && topScorer[1] >= 3) {
    comments.push(`⚡ ${getPlayerName(players, topScorer[0])} 선수가 ${topScorer[1]}골을 몰아치며 원맨쇼를 펼친 경기였습니다.`);
  } else if (topScorer && topScorer[1] >= 2) {
    comments.push(`⚽ ${getPlayerName(players, topScorer[0])} 선수가 멀티골(${topScorer[1]}골)을 기록하며 공격을 이끌었습니다.`);
  }

  const topAssister = [...playerAssists.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topAssister && topAssister[1] >= 2) {
    comments.push(`🎯 ${getPlayerName(players, topAssister[0])} 선수의 이타적인 연계(${topAssister[1]}어시)가 팀의 득점력을 끌어올렸습니다.`);
  }

  // FW performance
  if (hasLineupData(matchQuarters)) {
    const fwGoals = new Map<number, number>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const fwPlayers = getFWPlayersFromLineup(q.lineup);
      fwPlayers.forEach((pid: number) => {
        const goals = matchGoals.filter(g => g.quarter === q.quarter && g.goal_player_id === pid && !g.is_own_goal).length;
        if (goals > 0) fwGoals.set(pid, (fwGoals.get(pid) || 0) + goals);
      });
    });
    const topFW = [...fwGoals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topFW && topFW[1] >= 2 && (!topScorer || topFW[0] !== topScorer[0])) {
      comments.push(`🔥 ${getPlayerName(players, topFW[0])} 선수가 공격수(FW)로 출전하여 엄청난 득점력을 뽐낸 경기였습니다.`);
    }

    // DF stability
    const dfQuarterCleanSheets = new Map<number, { clean: number; total: number }>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const dfPlayers = getDFPlayersFromLineup(q.lineup);
      dfPlayers.forEach((pid: number) => {
        const cur = dfQuarterCleanSheets.get(pid) || { clean: 0, total: 0 };
        cur.total++;
        // For custom matches, check correct conceded side
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
      comments.push(`🛡️ ${getPlayerName(players, bestDF[0])} 선수가 수비 라인을 지킨 쿼터 동안 팀은 압도적인 안정감을 보여주었습니다.`);
    }
  }

  // Kill pass analysis
  const killPassAssists = matchGoals.filter(g => g.assist_type === "킬패스" && g.assist_player_id && ourTeamIds.has(g.team_id));
  if (killPassAssists.length >= 2) {
    const assisterId = killPassAssists[0].assist_player_id!;
    const allFromSame = killPassAssists.filter(g => g.assist_player_id === assisterId).length;
    if (allFromSame >= 2) {
      comments.push(`🎯 ${getPlayerName(players, assisterId)} 선수의 예리한 킬패스가 빛을 발하며 팀의 승리를 이끌었습니다.`);
    }
  }

  // Comeback or dominant win
  const ourResult = results.find(r => matchTeams.some(t => t.is_ours && t.id === r.team_id) && r.match_id === matchId);
  if (ourResult) {
    if (ourResult.score_for !== null && ourResult.score_against !== null) {
      const diff = (ourResult.score_for || 0) - (ourResult.score_against || 0);
      if (diff >= 5) comments.push(`💥 ${ourResult.score_for}:${ourResult.score_against}! 압도적인 대승을 거둔 경기입니다.`);
      else if (diff <= -5) comments.push(`😢 ${ourResult.score_for}:${ourResult.score_against}. 뼈아픈 대패를 당한 경기입니다.`);
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
