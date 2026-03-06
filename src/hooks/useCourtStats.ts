import { useMemo } from "react";
import type { Player, Match, Team, Result, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";

// ─── Court Margin (+/-) for a player across quarters ───
export interface PlayerCourtMargin {
  playerId: number;
  name: string;
  margin: number;
  quartersPlayed: number;
  ap: number;
  ppq: number; // AP per quarter
}

function parseLineup(lineup: any): { GK: number[]; DF: number[]; MF: number[]; FW: number[]; Bench: number[] } {
  const result = { GK: [] as number[], DF: [] as number[], MF: [] as number[], FW: [] as number[], Bench: [] as number[] };
  if (!lineup) return result;
  if (Array.isArray(lineup)) {
    // Array of { position, playerId } or { pos, id }
    lineup.forEach((item: any) => {
      const pos = (item.position || item.pos || "").toUpperCase();
      const pid = item.playerId || item.player_id || item.id;
      if (!pid) return;
      if (pos === "GK") result.GK.push(pid);
      else if (pos === "DF") result.DF.push(pid);
      else if (pos === "MF") result.MF.push(pid);
      else if (pos === "FW") result.FW.push(pid);
      else if (pos === "BENCH") result.Bench.push(pid);
      else result.FW.push(pid); // fallback
    });
  } else if (typeof lineup === "object") {
    // Object format { GK: [...], DF: [...], ... }
    if (lineup.GK) result.GK = (Array.isArray(lineup.GK) ? lineup.GK : [lineup.GK]).map(Number);
    if (lineup.DF) result.DF = (Array.isArray(lineup.DF) ? lineup.DF : [lineup.DF]).map(Number);
    if (lineup.MF) result.MF = (Array.isArray(lineup.MF) ? lineup.MF : [lineup.MF]).map(Number);
    if (lineup.FW) result.FW = (Array.isArray(lineup.FW) ? lineup.FW : [lineup.FW]).map(Number);
    if (lineup.Bench) result.Bench = (Array.isArray(lineup.Bench) ? lineup.Bench : [lineup.Bench]).map(Number);
  }
  return result;
}

function getFieldPlayers(lineup: any): number[] {
  const parsed = parseLineup(lineup);
  return [...parsed.GK, ...parsed.DF, ...parsed.MF, ...parsed.FW];
}

function getBenchPlayers(lineup: any): number[] {
  return parseLineup(lineup).Bench;
}

function getPlayerPosition(lineup: any, playerId: number): string | null {
  const parsed = parseLineup(lineup);
  if (parsed.GK.includes(playerId)) return "GK";
  if (parsed.DF.includes(playerId)) return "DF";
  if (parsed.MF.includes(playerId)) return "MF";
  if (parsed.FW.includes(playerId)) return "FW";
  if (parsed.Bench.includes(playerId)) return "Bench";
  return null;
}

// ─── Compute court margin for a single match ───
export function computeMatchCourtMargins(
  quarters: MatchQuarter[],
  goalEvents: GoalEvent[],
  players: Player[]
): Map<number, { margin: number; quartersPlayed: number; ap: number; isSuperSub: boolean }> {
  const result = new Map<number, { margin: number; quartersPlayed: number; ap: number; isSuperSub: boolean }>();

  quarters.forEach((q, idx) => {
    if (!q.lineup) return;
    const fieldPlayers = getFieldPlayers(q.lineup);
    const benchPlayers = getBenchPlayers(q.lineup);
    const diff = (q.score_for || 0) - (q.score_against || 0);

    // Check who was on bench in previous quarter and now on field
    const prevQ = idx > 0 ? quarters[idx - 1] : null;
    const prevBench = prevQ?.lineup ? getBenchPlayers(prevQ.lineup) : [];

    fieldPlayers.forEach(pid => {
      const cur = result.get(pid) || { margin: 0, quartersPlayed: 0, ap: 0, isSuperSub: false };
      cur.margin += diff;
      cur.quartersPlayed++;

      // AP in this quarter
      const qGoals = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.goal_player_id === pid && !g.is_own_goal).length;
      const qAssists = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.assist_player_id === pid).length;
      cur.ap += qGoals + qAssists;

      // Super sub: was on bench last quarter, now on field with AP
      if (prevBench.includes(pid) && (qGoals + qAssists) > 0) {
        cur.isSuperSub = true;
      }

      result.set(pid, cur);
    });

    // Track bench players too (no margin change)
    benchPlayers.forEach(pid => {
      if (!result.has(pid)) result.set(pid, { margin: 0, quartersPlayed: 0, ap: 0, isSuperSub: false });
    });
  });

  return result;
}

// ─── Cumulative court margins for all players across all matches ───
export function computeAllCourtMargins(
  players: Player[],
  matches: Match[],
  allQuarters: MatchQuarter[],
  goalEvents: GoalEvent[]
): PlayerCourtMargin[] {
  const cumulative = new Map<number, { margin: number; quartersPlayed: number; ap: number }>();

  const matchIds = [...new Set(allQuarters.map(q => q.match_id))];
  matchIds.forEach(mid => {
    const mq = allQuarters.filter(q => q.match_id === mid).sort((a, b) => a.quarter - b.quarter);
    const me = goalEvents.filter(g => g.match_id === mid);
    const margins = computeMatchCourtMargins(mq, me, players);
    margins.forEach((val, pid) => {
      const cur = cumulative.get(pid) || { margin: 0, quartersPlayed: 0, ap: 0 };
      cur.margin += val.margin;
      cur.quartersPlayed += val.quartersPlayed;
      cur.ap += val.ap;
      cumulative.set(pid, cur);
    });
  });

  return [...cumulative.entries()]
    .map(([pid, val]) => ({
      playerId: pid,
      name: players.find(p => p.id === pid)?.name || `#${pid}`,
      margin: val.margin,
      quartersPlayed: val.quartersPlayed,
      ap: val.ap,
      ppq: val.quartersPlayed > 0 ? val.ap / val.quartersPlayed : 0,
    }))
    .filter(p => p.quartersPlayed > 0);
}

// ─── Position distribution for a player ───
export interface PositionDistribution {
  GK: number;
  DF: number;
  MF: number;
  FW: number;
  total: number;
}

export function getPlayerPositionDistribution(
  playerId: number,
  allQuarters: MatchQuarter[]
): PositionDistribution {
  const dist: PositionDistribution = { GK: 0, DF: 0, MF: 0, FW: 0, total: 0 };
  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const pos = getPlayerPosition(q.lineup, playerId);
    if (pos && pos !== "Bench") {
      dist.total++;
      if (pos === "GK") dist.GK++;
      else if (pos === "DF") dist.DF++;
      else if (pos === "MF") dist.MF++;
      else if (pos === "FW") dist.FW++;
    }
  });
  return dist;
}

// ─── Killer Quarter: quarter with most AP ───
export function getKillerQuarter(
  playerId: number,
  goalEvents: GoalEvent[]
): { quarter: number; ap: number } | null {
  const qMap = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.goal_player_id === playerId && !g.is_own_goal) {
      qMap.set(g.quarter, (qMap.get(g.quarter) || 0) + 1);
    }
    if (g.assist_player_id === playerId) {
      qMap.set(g.quarter, (qMap.get(g.quarter) || 0) + 1);
    }
  });
  if (qMap.size === 0) return null;
  const sorted = [...qMap.entries()].sort((a, b) => b[1] - a[1]);
  return { quarter: sorted[0][0], ap: sorted[0][1] };
}

// ─── Defense contribution: conceded per quarter with/without player ───
export function getDefenseContribution(
  playerId: number,
  allQuarters: MatchQuarter[]
): { withPlayer: number; withoutPlayer: number; diff: number; quartersWithPlayer: number; quartersWithoutPlayer: number } {
  let withTotal = 0, withCount = 0, withoutTotal = 0, withoutCount = 0;
  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const fieldPlayers = getFieldPlayers(q.lineup);
    const conceded = q.score_against || 0;
    if (fieldPlayers.includes(playerId)) {
      withTotal += conceded;
      withCount++;
    } else {
      withoutTotal += conceded;
      withoutCount++;
    }
  });
  const withAvg = withCount > 0 ? withTotal / withCount : 0;
  const withoutAvg = withoutCount > 0 ? withoutTotal / withoutCount : 0;
  return { withPlayer: withAvg, withoutPlayer: withoutAvg, diff: withAvg - withoutAvg, quartersWithPlayer: withCount, quartersWithoutPlayer: withoutCount };
}

// ─── Own goal inducer (pressure contribution) ───
export function getOwnGoalInducerCount(
  playerId: number,
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[]
): number {
  let count = 0;
  goalEvents.filter(g => g.is_own_goal).forEach(g => {
    const q = allQuarters.find(q => q.match_id === g.match_id && q.quarter === g.quarter);
    if (q?.lineup) {
      const field = getFieldPlayers(q.lineup);
      if (field.includes(playerId)) count++;
    }
  });
  return count;
}

// ─── Solo vs Team goals ───
export function getSoloVsTeamGoals(
  playerId: number,
  goalEvents: GoalEvent[]
): { solo: number; team: number; total: number } {
  let solo = 0, team = 0;
  goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).forEach(g => {
    if (g.assist_player_id) team++;
    else solo++;
  });
  return { solo, team, total: solo + team };
}

// ─── FC Online Traits System ───
export interface PlayerTrait {
  name: string;
  emoji: string;
  description: string;
  category: "attack" | "pass" | "physical" | "defense" | "clutch";
  color: string; // green, yellow, red
}

export function computePlayerTraits(
  playerId: number,
  players: Player[],
  matches: Match[],
  teams: Team[],
  results: Result[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  allQuarters: MatchQuarter[]
): PlayerTrait[] {
  const traits: PlayerTrait[] = [];
  
  const playerGoals = goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal);
  const playerAssists = goalEvents.filter(g => g.assist_player_id === playerId);
  const totalGoalsFromEvents = playerGoals.length;
  const totalAssistsFromEvents = playerAssists.length;
  
  const rosterGoals = rosters.filter(r => r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
  const rosterAssists = rosters.filter(r => r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
  const totalGoals = totalGoalsFromEvents + rosterGoals;
  const totalAssists = totalAssistsFromEvents + rosterAssists;
  const totalAP = totalGoals + totalAssists;
  
  if (totalGoals === 0 && totalAssists === 0) return traits;

  const goalTypeCounts = new Map<string, number>();
  playerGoals.forEach(g => { if (g.goal_type) goalTypeCounts.set(g.goal_type, (goalTypeCounts.get(g.goal_type) || 0) + 1); });
  
  const assistTypeCounts = new Map<string, number>();
  playerAssists.forEach(g => { if (g.assist_type) assistTypeCounts.set(g.assist_type, (assistTypeCounts.get(g.assist_type) || 0) + 1); });

  // ⚽ 1. Attack traits
  // Poacher (lowered from 20% to 10%)
  const pocherGoals = (goalTypeCounts.get("주워먹기") || 0) + (goalTypeCounts.get("골문 앞 혼전골") || 0) + (goalTypeCounts.get("인자기골") || 0);
  if (totalGoalsFromEvents > 0 && pocherGoals / totalGoalsFromEvents >= 0.10) {
    traits.push({ name: "위치 선정의 달인", emoji: "🟢", description: "주워먹기/혼전골 비율 10%+", category: "attack", color: "green" });
  }
  
  // Long Shot (lowered from 10% to 5%)
  const longShots = goalTypeCounts.get("중거리골") || 0;
  if (totalGoalsFromEvents > 0 && longShots / totalGoalsFromEvents >= 0.05) {
    traits.push({ name: "중거리 난사", emoji: "🟢", description: "중거리골 비율 5%+", category: "attack", color: "green" });
  }
  
  // Acrobatic (lowered from 2 to 1)
  const acroTypes = ["발리골", "터닝골", "칩슛", "헤딩골", "파포스트골", "엉덩이골", "가슴골"];
  const acroCount = acroTypes.reduce((s, t) => s + (goalTypeCounts.get(t) || 0), 0);
  if (acroCount >= 1) {
    traits.push({ name: "아크로바틱", emoji: "🟢", description: "고난도 골 1+", category: "attack", color: "green" });
  }
  
  // Speed Dribbler (lowered from 3 to 2)
  const counterGoals = playerGoals.filter(g => g.build_up_process === "역습" || g.goal_type === "솔로 치달골" || g.goal_type === "드리블골").length;
  if (counterGoals >= 2) {
    traits.push({ name: "치달 장인", emoji: "🟢", description: "역습/솔로 치달 2+", category: "attack", color: "green" });
  }
  
  // Infiltrator (lowered from 2 to 1)
  const infiltGoals = goalTypeCounts.get("침투골") || 0;
  if (infiltGoals >= 1) {
    traits.push({ name: "침투의 귀재", emoji: "🟢", description: "침투골 1+", category: "attack", color: "green" });
  }
  
  // Clinical Finisher (lowered from 10Q to 5Q)
  const posDist = getPlayerPositionDistribution(playerId, allQuarters);
  if (posDist.total >= 5) {
    const allMargins = computeAllCourtMargins(players, matches, allQuarters, goalEvents);
    const sorted = allMargins.filter(p => p.quartersPlayed >= 5).sort((a, b) => b.ppq - a.ppq);
    if (sorted.length > 0 && sorted[0].playerId === playerId) {
      traits.push({ name: "원샷 원킬", emoji: "🟡", description: "PPQ 1위 (5Q+)", category: "attack", color: "yellow" });
    }
  }
  
  // 🎯 2. Pass traits
  // Playmaker (lowered from 40%/5A to 20%/3A)
  const killPasses = assistTypeCounts.get("킬패스") || 0;
  if (totalAssistsFromEvents >= 3 && totalAssistsFromEvents > 0 && killPasses / totalAssistsFromEvents >= 0.20) {
    traits.push({ name: "대지를 가르는 패스", emoji: "🟢", description: "킬패스 20%+ (3A+)", category: "pass", color: "green" });
  }
  
  // Cut-back Specialist (lowered from 40% to 20%)
  const cutbacks = assistTypeCounts.get("컷백") || 0;
  if (totalAssistsFromEvents > 0 && cutbacks / totalAssistsFromEvents >= 0.20) {
    traits.push({ name: "컷백 마스터", emoji: "🟢", description: "컷백 비율 20%+", category: "pass", color: "green" });
  }
  
  // Assist King (lowered from 40%/8A to 30%/5A)
  if (totalAssists >= 5 && totalAP > 0 && totalAssists / totalAP >= 0.30) {
    traits.push({ name: "어시스트 머신", emoji: "🟢", description: "어시스트 비율 30%+ (5A+)", category: "pass", color: "green" });
  }
  
  // Selfish (lowered from 30%/10AP to 20%/5AP)
  if (totalAP >= 5 && totalAP > 0 && totalAssists / totalAP < 0.20) {
    traits.push({ name: "탐욕왕", emoji: "🟢", description: "어시스트 비율 20% 미만", category: "pass", color: "green" });
  }
  
  // 💪 3. Physical traits (lowered from 20Q to 10Q)
  const earlyQAP = goalEvents.filter(g => (g.quarter <= 2) && ((g.goal_player_id === playerId && !g.is_own_goal) || g.assist_player_id === playerId)).length;
  const lateQAP = goalEvents.filter(g => (g.quarter >= 7) && ((g.goal_player_id === playerId && !g.is_own_goal) || g.assist_player_id === playerId)).length;
  const firstHalfAP = goalEvents.filter(g => (g.quarter <= 4) && ((g.goal_player_id === playerId && !g.is_own_goal) || g.assist_player_id === playerId)).length;
  const secondHalfAP = goalEvents.filter(g => (g.quarter >= 5) && ((g.goal_player_id === playerId && !g.is_own_goal) || g.assist_player_id === playerId)).length;
  
  if (posDist.total >= 10) {
    // Iron Lungs (lowered to 20% diff)
    if (earlyQAP > 0 && lateQAP > 0) {
      const diff = Math.abs(earlyQAP - lateQAP) / Math.max(earlyQAP, lateQAP);
      if (diff <= 0.20) {
        traits.push({ name: "강철 체력", emoji: "🟡", description: "전후반 AP 차이 20% 이내", category: "physical", color: "yellow" });
      }
    }
    // Early Fader
    if (firstHalfAP > 0 && secondHalfAP / firstHalfAP <= 0.5) {
      traits.push({ name: "조루 체력", emoji: "🟡", description: "후반 AP 50% 이하 급감", category: "physical", color: "yellow" });
    }
  }
  
  // 🛡️ 4. Defense traits (lowered thresholds)
  // The Wall (lowered from 5DF to 3DF, from 0.5 to 0.3)
  if (posDist.DF >= 3) {
    const dfQuarters = allQuarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "DF");
    const avgConcededDF = dfQuarters.length > 0 ? dfQuarters.reduce((s, q) => s + (q.score_against || 0), 0) / dfQuarters.length : 999;
    const avgConcededAll = allQuarters.length > 0 ? allQuarters.reduce((s, q) => s + (q.score_against || 0), 0) / allQuarters.length : 0;
    if (avgConcededDF < avgConcededAll - 0.3) {
      traits.push({ name: "통곡의 벽", emoji: "🟡", description: "DF 시 실점 평균 0.3↓", category: "defense", color: "yellow" });
    }
  }
  
  // Victory Totem (lowered from 15Q to 8Q)
  if (posDist.total >= 8) {
    const allMargins = computeAllCourtMargins(players, matches, allQuarters, goalEvents);
    const sorted = allMargins.filter(p => p.quartersPlayed >= 8).sort((a, b) => b.margin - a.margin);
    if (sorted.length > 0 && sorted[0].playerId === playerId) {
      traits.push({ name: "승리 부적", emoji: "🟡", description: "코트 마진 1위 (8Q+)", category: "defense", color: "yellow" });
    }
  }
  
  // High Motor (lowered from 3 to 2)
  const pressureGoals = playerGoals.filter(g => g.build_up_process === "압박" || g.goal_type === "압박").length;
  if (pressureGoals > 0) {
    const allPlayerPressure = new Map<number, { pressure: number; total: number }>();
    goalEvents.filter(g => g.goal_player_id && !g.is_own_goal).forEach(g => {
      const cur = allPlayerPressure.get(g.goal_player_id!) || { pressure: 0, total: 0 };
      cur.total++;
      if (g.build_up_process === "압박" || g.goal_type === "압박") cur.pressure++;
      allPlayerPressure.set(g.goal_player_id!, cur);
    });
    const sorted = [...allPlayerPressure.entries()]
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => (b[1].pressure / b[1].total) - (a[1].pressure / a[1].total));
    if (sorted.length > 0 && sorted[0][0] === playerId) {
      traits.push({ name: "미친 개", emoji: "🟢", description: "압박 기반 득점 비율 1위", category: "defense", color: "green" });
    }
  }
  
  // GK Master (lowered from 5GK/50% to 3GK/40%)
  if (posDist.GK >= 3) {
    const gkQuarters = allQuarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "GK");
    const cleanSheets = gkQuarters.filter(q => (q.score_against || 0) === 0).length;
    if (cleanSheets / gkQuarters.length >= 0.4) {
      traits.push({ name: "클린시트 수호자", emoji: "🔴", description: "GK 무실점 40%+ (3Q+)", category: "defense", color: "red" });
    }
  }
  
  // 👑 5. Clutch traits
  // First Blood
  const firstBloodCounts = new Map<number, number>();
  const matchIdSet = [...new Set(goalEvents.map(g => g.match_id))];
  matchIdSet.forEach(mid => {
    const matchEvents = goalEvents.filter(g => g.match_id === mid && !g.is_own_goal).sort((a, b) => a.quarter - b.quarter || a.id - b.id);
    if (matchEvents.length > 0 && matchEvents[0].goal_player_id) {
      firstBloodCounts.set(matchEvents[0].goal_player_id, (firstBloodCounts.get(matchEvents[0].goal_player_id) || 0) + 1);
    }
  });
  const fbSorted = [...firstBloodCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (fbSorted.length > 0 && fbSorted[0][0] === playerId) {
    traits.push({ name: "퍼스트 블러드", emoji: "🟢", description: `팀 첫 골 ${fbSorted[0][1]}회 (1위)`, category: "clutch", color: "green" });
  }
  
  // Buzzer Beater (lowered from 35% to 25%)
  const lateGoals = playerGoals.filter(g => g.quarter >= 7).length;
  if (totalGoalsFromEvents > 0 && lateGoals / totalGoalsFromEvents >= 0.25) {
    traits.push({ name: "버저비터", emoji: "🟢", description: "7-8Q 골 비율 25%+", category: "clutch", color: "green" });
  }
  
  // Stat Padder (TIGHTENED to 55% — includes assists in padding count)
  let paddingAP = 0;
  playerGoals.forEach(g => {
    const mTeams = teams.filter(t => t.match_id === g.match_id);
    const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
    const priorEvents = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
    let ourScore = 0, oppScore = 0;
    priorEvents.forEach(e => {
      if (e.is_own_goal) oppScore++;
      else if (ourTeamIds.has(e.team_id)) ourScore++;
      else oppScore++;
    });
    if (ourScore - oppScore >= 3) paddingAP++;
  });
  playerAssists.forEach(g => {
    const mTeams = teams.filter(t => t.match_id === g.match_id);
    const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
    const priorEvents = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
    let ourScore = 0, oppScore = 0;
    priorEvents.forEach(e => {
      if (e.is_own_goal) oppScore++;
      else if (ourTeamIds.has(e.team_id)) ourScore++;
      else oppScore++;
    });
    if (ourScore - oppScore >= 3) paddingAP++;
  });
  const totalScoredWithAssists = totalGoalsFromEvents + totalAssistsFromEvents;
  if (totalScoredWithAssists >= 5 && paddingAP / totalScoredWithAssists >= 0.55) {
    traits.push({ name: "스탯 세탁기", emoji: "🟢", description: "3점차+ 리드 시 기록 55%+", category: "clutch", color: "green" });
  }
  
  return traits;
}

// ─── Assist Connection Map Data ───
export interface AssistConnection {
  from: number;
  fromName: string;
  to: number;
  toName: string;
  count: number;
}

export function getAssistConnectionMap(
  players: Player[],
  goalEvents: GoalEvent[],
  topN: number = 15
): AssistConnection[] {
  const map = new Map<string, AssistConnection>();
  goalEvents.forEach(g => {
    if (g.assist_player_id && g.goal_player_id && !g.is_own_goal) {
      const key = `${g.assist_player_id}->${g.goal_player_id}`;
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, {
        from: g.assist_player_id,
        fromName: players.find(p => p.id === g.assist_player_id)?.name || `#${g.assist_player_id}`,
        to: g.goal_player_id,
        toName: players.find(p => p.id === g.goal_player_id)?.name || `#${g.goal_player_id}`,
        count: 1,
      });
    }
  });
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, topN);
}
