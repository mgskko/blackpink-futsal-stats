import { useMemo } from "react";
import type { Player, Match, Team, Result, GoalEvent, MatchQuarter } from "./useFutsalData";
import { getPlayerName } from "./useFutsalData";
import { computeMatchCourtMargins } from "./useCourtStats";

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
}

function getPlayerPosition(lineup: any, playerId: number): string | null {
  if (!lineup) return null;
  if (typeof lineup === "object" && !Array.isArray(lineup)) {
    if (lineup.GK && (Array.isArray(lineup.GK) ? lineup.GK : [lineup.GK]).map(Number).includes(playerId)) return "GK";
    if (lineup.DF && (Array.isArray(lineup.DF) ? lineup.DF : [lineup.DF]).map(Number).includes(playerId)) return "DF";
    if (lineup.MF && (Array.isArray(lineup.MF) ? lineup.MF : [lineup.MF]).map(Number).includes(playerId)) return "MF";
    if (lineup.FW && (Array.isArray(lineup.FW) ? lineup.FW : [lineup.FW]).map(Number).includes(playerId)) return "FW";
    if (lineup.Bench && (Array.isArray(lineup.Bench) ? lineup.Bench : [lineup.Bench]).map(Number).includes(playerId)) return "Bench";
  }
  return null;
}

function getFieldPlayers(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  const result: number[] = [];
  ["GK", "DF", "MF", "FW"].forEach(pos => {
    if (lineup[pos]) {
      (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).forEach((id: any) => result.push(Number(id)));
    }
  });
  return result;
}

export function computeDataMOM(
  matchId: number,
  players: Player[],
  teams: Team[],
  goalEvents: GoalEvent[],
  quarters: MatchQuarter[],
  results: Result[]
): DataMOMResult | null {
  const matchGoals = goalEvents.filter(g => g.match_id === matchId);
  const matchQuarters = quarters.filter(q => q.match_id === matchId).sort((a, b) => a.quarter - b.quarter);
  const matchTeams = teams.filter(t => t.match_id === matchId);
  const ourTeamIds = new Set(matchTeams.filter(t => t.is_ours).map(t => t.id));

  if (matchGoals.length === 0 && matchQuarters.length === 0) return null;

  const playerScores = new Map<number, { attack: number; defense: number; clutch: number; penalty: number }>();

  const initScore = (pid: number) => {
    if (!playerScores.has(pid)) playerScores.set(pid, { attack: 0, defense: 0, clutch: 0, penalty: 0 });
    return playerScores.get(pid)!;
  };

  // Attack scoring: Goal * 3, Assist * 2.5
  matchGoals.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal) {
      const s = initScore(g.goal_player_id);
      s.attack += 3;
    }
    if (g.assist_player_id) {
      const s = initScore(g.assist_player_id);
      s.attack += 2.5;
    }
    // Own goal penalty
    if (g.is_own_goal && g.goal_player_id) {
      const s = initScore(g.goal_player_id);
      s.penalty -= 2;
    }
  });

  // Defense scoring from quarters
  matchQuarters.forEach(q => {
    if (!q.lineup) return;
    const fieldPlayers = getFieldPlayers(q.lineup);
    const diff = (q.score_for || 0) - (q.score_against || 0);
    const conceded = q.score_against || 0;

    fieldPlayers.forEach(pid => {
      const s = initScore(pid);
      const pos = getPlayerPosition(q.lineup, pid);

      // Quarter attendance: +0.5
      s.defense += 0.5;

      // DF/GK court margin bonus: margin * 2
      if (pos === "DF" || pos === "GK") {
        s.defense += diff * 2;
        // Clean sheet bonus: +1 per quarter
        if (conceded === 0) s.defense += 1;
      }
    });
  });

  // Clutch scoring: decisive goals/assists
  // Find equalizers and go-ahead goals
  matchGoals.forEach((g, idx) => {
    if (g.is_own_goal) return;
    // Calculate score before this goal
    const priorEvents = matchGoals.filter(e => e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id));
    let ourScore = 0, oppScore = 0;
    priorEvents.forEach(e => {
      if (e.is_own_goal) oppScore++;
      else if (ourTeamIds.has(e.team_id)) ourScore++;
      else oppScore++;
    });

    const isOurGoal = ourTeamIds.has(g.team_id);
    if (isOurGoal) {
      // Equalizer (was behind, now tied) or go-ahead goal
      if (ourScore <= oppScore) {
        if (g.goal_player_id) initScore(g.goal_player_id).clutch += 2;
        if (g.assist_player_id) initScore(g.assist_player_id).clutch += 2;
      }
    }
  });

  // Calculate totals and find MOM
  const scored = [...playerScores.entries()].map(([pid, s]) => ({
    playerId: pid,
    name: getPlayerName(players, pid),
    score: s.attack + s.defense + s.clutch + s.penalty,
    breakdown: s,
  })).sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0] : null;
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

  // Goal/assist leader
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

  // Top scorer comment
  const topScorer = [...playerGoals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topScorer && topScorer[1] >= 3) {
    comments.push(`⚡ ${getPlayerName(players, topScorer[0])} 선수가 ${topScorer[1]}골을 몰아치며 원맨쇼를 펼친 경기였습니다.`);
  } else if (topScorer && topScorer[1] >= 2) {
    comments.push(`⚽ ${getPlayerName(players, topScorer[0])} 선수가 멀티골(${topScorer[1]}골)을 기록하며 공격을 이끌었습니다.`);
  }

  // Top assister comment
  const topAssister = [...playerAssists.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topAssister && topAssister[1] >= 2) {
    comments.push(`🎯 ${getPlayerName(players, topAssister[0])} 선수의 이타적인 연계(${topAssister[1]}어시)가 팀의 득점력을 끌어올렸습니다.`);
  }

  // FW performance
  if (matchQuarters.length > 0) {
    const fwGoals = new Map<number, number>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const fwPlayers = (typeof q.lineup === "object" && !Array.isArray(q.lineup) && q.lineup.FW)
        ? (Array.isArray(q.lineup.FW) ? q.lineup.FW : [q.lineup.FW]).map(Number) : [];
      fwPlayers.forEach(pid => {
        const goals = matchGoals.filter(g => g.quarter === q.quarter && g.goal_player_id === pid && !g.is_own_goal).length;
        if (goals > 0) fwGoals.set(pid, (fwGoals.get(pid) || 0) + goals);
      });
    });
    const topFW = [...fwGoals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topFW && topFW[1] >= 2 && (!topScorer || topFW[0] !== topScorer[0])) {
      comments.push(`🔥 ${getPlayerName(players, topFW[0])} 선수가 공격수(FW)로 출전하여 엄청난 득점력을 뽐낸 경기였습니다.`);
    }
  }

  // DF stability
  if (matchQuarters.length > 0) {
    const dfQuarterCleanSheets = new Map<number, { clean: number; total: number }>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const dfPlayers = (typeof q.lineup === "object" && !Array.isArray(q.lineup) && q.lineup.DF)
        ? (Array.isArray(q.lineup.DF) ? q.lineup.DF : [q.lineup.DF]).map(Number) : [];
      dfPlayers.forEach(pid => {
        const cur = dfQuarterCleanSheets.get(pid) || { clean: 0, total: 0 };
        cur.total++;
        if ((q.score_against || 0) === 0) cur.clean++;
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

  // Limit to 3 comments max
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
  const aiComments = useMemo(() => generateMatchComment(matchId, players, teams, results, goalEvents, quarters), [matchId, players, teams, results, goalEvents, quarters]);
  return { dataMOM, aiComments };
}
