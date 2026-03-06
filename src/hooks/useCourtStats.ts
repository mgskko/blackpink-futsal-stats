import type { Player, Match, Team, Result, Roster, GoalEvent, MatchQuarter } from "./useFutsalData";

// ─── Court Margin (+/-) for a player across quarters ───
export interface PlayerCourtMargin {
  playerId: number;
  name: string;
  margin: number;
  quartersPlayed: number;
  ap: number;
  ppq: number;
}

function parseLineup(lineup: any): { GK: number[]; DF: number[]; MF: number[]; FW: number[]; Bench: number[] } {
  const result = { GK: [] as number[], DF: [] as number[], MF: [] as number[], FW: [] as number[], Bench: [] as number[] };
  if (!lineup) return result;
  if (Array.isArray(lineup)) {
    lineup.forEach((item: any) => {
      const pos = (item.position || item.pos || "").toUpperCase();
      const pid = item.playerId || item.player_id || item.id;
      if (!pid) return;
      if (pos === "GK") result.GK.push(pid);
      else if (pos === "DF") result.DF.push(pid);
      else if (pos === "MF") result.MF.push(pid);
      else if (pos === "FW") result.FW.push(pid);
      else if (pos === "BENCH") result.Bench.push(pid);
      else result.FW.push(pid);
    });
  } else if (typeof lineup === "object") {
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

export function getPlayerPosition(lineup: any, playerId: number): string | null {
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
    const prevQ = idx > 0 ? quarters[idx - 1] : null;
    const prevBench = prevQ?.lineup ? getBenchPlayers(prevQ.lineup) : [];

    fieldPlayers.forEach(pid => {
      const cur = result.get(pid) || { margin: 0, quartersPlayed: 0, ap: 0, isSuperSub: false };
      cur.margin += diff;
      cur.quartersPlayed++;
      const qGoals = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.goal_player_id === pid && !g.is_own_goal).length;
      const qAssists = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.assist_player_id === pid).length;
      cur.ap += qGoals + qAssists;
      if (prevBench.includes(pid) && (qGoals + qAssists) > 0) cur.isSuperSub = true;
      result.set(pid, cur);
    });

    benchPlayers.forEach(pid => {
      if (!result.has(pid)) result.set(pid, { margin: 0, quartersPlayed: 0, ap: 0, isSuperSub: false });
    });
  });

  return result;
}

// ─── Cumulative court margins ───
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

// ─── Position distribution ───
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

export function getKillerQuarter(playerId: number, goalEvents: GoalEvent[]): { quarter: number; ap: number } | null {
  const qMap = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.goal_player_id === playerId && !g.is_own_goal) qMap.set(g.quarter, (qMap.get(g.quarter) || 0) + 1);
    if (g.assist_player_id === playerId) qMap.set(g.quarter, (qMap.get(g.quarter) || 0) + 1);
  });
  if (qMap.size === 0) return null;
  const sorted = [...qMap.entries()].sort((a, b) => b[1] - a[1]);
  return { quarter: sorted[0][0], ap: sorted[0][1] };
}

export function getDefenseContribution(
  playerId: number,
  allQuarters: MatchQuarter[]
): { withPlayer: number; withoutPlayer: number; diff: number; quartersWithPlayer: number; quartersWithoutPlayer: number } {
  let withTotal = 0, withCount = 0, withoutTotal = 0, withoutCount = 0;
  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const fieldPlayers = getFieldPlayers(q.lineup);
    const conceded = q.score_against || 0;
    if (fieldPlayers.includes(playerId)) { withTotal += conceded; withCount++; }
    else { withoutTotal += conceded; withoutCount++; }
  });
  const withAvg = withCount > 0 ? withTotal / withCount : 0;
  const withoutAvg = withoutCount > 0 ? withoutTotal / withoutCount : 0;
  return { withPlayer: withAvg, withoutPlayer: withoutAvg, diff: withAvg - withoutAvg, quartersWithPlayer: withCount, quartersWithoutPlayer: withoutCount };
}

export function getOwnGoalInducerCount(playerId: number, goalEvents: GoalEvent[], allQuarters: MatchQuarter[]): number {
  let count = 0;
  goalEvents.filter(g => g.is_own_goal).forEach(g => {
    const q = allQuarters.find(q => q.match_id === g.match_id && q.quarter === g.quarter);
    if (q?.lineup && getFieldPlayers(q.lineup).includes(playerId)) count++;
  });
  return count;
}

export function getSoloVsTeamGoals(playerId: number, goalEvents: GoalEvent[]): { solo: number; team: number; total: number } {
  let solo = 0, team = 0;
  goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).forEach(g => {
    if (g.assist_player_id) team++; else solo++;
  });
  return { solo, team, total: solo + team };
}

// ═══════════════════════════════════════════════════
// ─── NEW: Ranking-Based Traits System (상대 평가) ───
// ═══════════════════════════════════════════════════

export interface PlayerTrait {
  name: string;
  emoji: string;
  description: string;
  category: "attack" | "pass" | "physical" | "defense" | "clutch";
  color: string;
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
  
  // Only consider players with meaningful data
  const allPlayerIds = [...new Set(rosters.map(r => r.player_id))];
  
  // Pre-compute per-player stats from goal_events
  const playerGoalTypeCounts = new Map<number, Map<string, number>>();
  const playerAssistTypeCounts = new Map<number, Map<string, number>>();
  const playerTotalGoals = new Map<number, number>();
  const playerTotalAssists = new Map<number, number>();
  const playerTotalAP = new Map<number, number>();
  
  goalEvents.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal) {
      playerTotalGoals.set(g.goal_player_id, (playerTotalGoals.get(g.goal_player_id) || 0) + 1);
      playerTotalAP.set(g.goal_player_id, (playerTotalAP.get(g.goal_player_id) || 0) + 1);
      if (g.goal_type) {
        if (!playerGoalTypeCounts.has(g.goal_player_id)) playerGoalTypeCounts.set(g.goal_player_id, new Map());
        const m = playerGoalTypeCounts.get(g.goal_player_id)!;
        m.set(g.goal_type, (m.get(g.goal_type) || 0) + 1);
      }
    }
    if (g.assist_player_id) {
      playerTotalAssists.set(g.assist_player_id, (playerTotalAssists.get(g.assist_player_id) || 0) + 1);
      playerTotalAP.set(g.assist_player_id, (playerTotalAP.get(g.assist_player_id) || 0) + 1);
      if (g.assist_type) {
        if (!playerAssistTypeCounts.has(g.assist_player_id)) playerAssistTypeCounts.set(g.assist_player_id, new Map());
        const m = playerAssistTypeCounts.get(g.assist_player_id)!;
        m.set(g.assist_type, (m.get(g.assist_type) || 0) + 1);
      }
    }
  });

  // Helper: get goal type count for a player
  const gtc = (pid: number, ...types: string[]) => {
    const m = playerGoalTypeCounts.get(pid);
    if (!m) return 0;
    return types.reduce((s, t) => s + (m.get(t) || 0), 0);
  };
  const atc = (pid: number, ...types: string[]) => {
    const m = playerAssistTypeCounts.get(pid);
    if (!m) return 0;
    return types.reduce((s, t) => s + (m.get(t) || 0), 0);
  };

  // Helper: check if playerId is in top N for a metric (returns true if top 1-2)
  const isTopN = (pid: number, ranking: { id: number; value: number }[], topN: number = 2, minValue: number = 1): boolean => {
    const filtered = ranking.filter(r => r.value >= minValue);
    if (filtered.length === 0) return false;
    const idx = filtered.findIndex(r => r.id === pid);
    return idx >= 0 && idx < topN;
  };

  // ⚽ 1. Attack Traits (top 1-2)

  // 제라드의 재림: 중거리골 count
  const longShotRanking = allPlayerIds.map(pid => ({ id: pid, value: gtc(pid, "중거리골") })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, longShotRanking, 2, 2)) {
    traits.push({ name: "제라드의 강림", emoji: "⚽", description: `중거리골 팀 내 1~2위 (${gtc(playerId, "중거리골")}골)`, category: "attack", color: "green" });
  }

  // 위치 선정의 달인: 주워먹기+혼전골+인자기골
  const pocherRanking = allPlayerIds.map(pid => ({ id: pid, value: gtc(pid, "주워먹기", "골문 앞 혼전골", "인자기골") })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, pocherRanking, 2, 1)) {
    traits.push({ name: "인자기의 환생", emoji: "🎯", description: `주워먹기/혼전골 팀 내 1~2위`, category: "attack", color: "green" });
  }

  // 아크로바틱: 발리+터닝+칩슛+헤딩 등
  const acroTypes = ["발리골", "터닝골", "칩슛", "헤딩골", "파포스트골", "엉덩이골", "가슴골"];
  const acroRanking = allPlayerIds.map(pid => ({ id: pid, value: gtc(pid, ...acroTypes) })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, acroRanking, 2, 1)) {
    traits.push({ name: "즐라탄 빙의", emoji: "⚽", description: `고난도 골 팀 내 1~2위`, category: "attack", color: "green" });
  }

  // 스피드 레이서: 솔로 치달골+역습 득점+어시 (골/어시 모두 카운트)
  const speedRanking = allPlayerIds.map(pid => {
    const soloGoals = gtc(pid, "솔로 치달골", "드리블골");
    const counterGoals = goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal && g.build_up_process === "역습").length;
    const counterAssists = goalEvents.filter(g => g.assist_player_id === pid && (g.build_up_process === "역습" || g.goal_type === "솔로 치달골" || g.goal_type === "드리블골")).length;
    return { id: pid, value: soloGoals + counterGoals + counterAssists };
  }).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, speedRanking, 2, 1)) {
    traits.push({ name: "스피드 레이서", emoji: "🟢", description: `치달/역습 득점+어시 팀 내 1~2위`, category: "attack", color: "green" });
  }

  // 침투의 귀재: 침투골+킬패스 받아 득점
  const infiltRanking = allPlayerIds.map(pid => {
    const infilt = gtc(pid, "침투골");
    const killPassReceived = goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal && g.assist_type === "킬패스").length;
    return { id: pid, value: infilt + killPassReceived };
  }).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, infiltRanking, 2, 1)) {
    traits.push({ name: "침투의 귀재", emoji: "🟢", description: `침투/킬패스 연계 팀 내 1~2위`, category: "attack", color: "green" });
  }

  // 🎯 2. Pass Traits (top 1-2)

  // 대지를 가르는 패스: 킬패스 어시스트
  const killPassRanking = allPlayerIds.map(pid => ({ id: pid, value: atc(pid, "킬패스") })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, killPassRanking, 2, 1)) {
    traits.push({ name: "대지를 가르는 패스", emoji: "🟢", description: `킬패스 어시스트 팀 내 1~2위`, category: "pass", color: "green" });
  }

  // 컷백 마스터
  const cutbackRanking = allPlayerIds.map(pid => ({ id: pid, value: atc(pid, "컷백") })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, cutbackRanking, 2, 1)) {
    traits.push({ name: "컷백 마스터", emoji: "🟢", description: `컷백 어시스트 팀 내 1~2위`, category: "pass", color: "green" });
  }

  // 최고의 도우미: 어시스트 비율 최고 1-2위
  const assistRatioRanking = allPlayerIds.map(pid => {
    const ap = playerTotalAP.get(pid) || 0;
    const assists = playerTotalAssists.get(pid) || 0;
    return { id: pid, value: ap >= 5 ? assists / ap : 0 };
  }).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, assistRatioRanking, 2, 0.01)) {
    traits.push({ name: "최고의 도우미", emoji: "🟢", description: `어시스트 비율 팀 내 1~2위`, category: "pass", color: "green" });
  }

  // 🛡️ 3. Defense/Other Traits (top 1-2)

  // 통곡의 벽: DF 실점률 최소 1-2위 (min 10Q)
  const dfConcededRanking = allPlayerIds.map(pid => {
    const dfQ = allQuarters.filter(q => q.lineup && getPlayerPosition(q.lineup, pid) === "DF");
    if (dfQ.length < 10) return { id: pid, value: 999 };
    const avg = dfQ.reduce((s, q) => s + (q.score_against || 0), 0) / dfQ.length;
    return { id: pid, value: avg };
  }).filter(r => r.value < 999).sort((a, b) => a.value - b.value); // lower is better
  if (dfConcededRanking.length > 0) {
    const idx = dfConcededRanking.findIndex(r => r.id === playerId);
    if (idx >= 0 && idx < 2) {
      traits.push({ name: "통곡의 벽", emoji: "🟡", description: `DF 출전 시 최소 실점 팀 내 1~2위`, category: "defense", color: "yellow" });
    }
  }

  // 미친 개: 압박/패스차단 득점+어시스트 횟수 (골/어시 모두 카운트)
  const pressureRanking = allPlayerIds.map(pid => {
    const goalCount = goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal && (g.build_up_process === "압박" || g.build_up_process === "패스 차단" || g.goal_type === "압박")).length;
    const assistCount = goalEvents.filter(g => g.assist_player_id === pid && (g.build_up_process === "압박" || g.build_up_process === "패스 차단" || g.goal_type === "압박")).length;
    return { id: pid, value: goalCount + assistCount };
  }).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, pressureRanking, 2, 1)) {
    traits.push({ name: "미친 개", emoji: "🟢", description: `압박/차단 기반 득점+어시 팀 내 1~2위`, category: "defense", color: "green" });
  }

  // 퍼스트 블러드: 선제골 횟수
  const firstBloodMap = new Map<number, number>();
  const matchIdSet = [...new Set(goalEvents.map(g => g.match_id))];
  matchIdSet.forEach(mid => {
    const events = goalEvents.filter(g => g.match_id === mid && !g.is_own_goal).sort((a, b) => a.quarter - b.quarter || a.id - b.id);
    if (events.length > 0 && events[0].goal_player_id) {
      firstBloodMap.set(events[0].goal_player_id, (firstBloodMap.get(events[0].goal_player_id) || 0) + 1);
    }
  });
  const firstBloodRanking = allPlayerIds.map(pid => ({ id: pid, value: firstBloodMap.get(pid) || 0 })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, firstBloodRanking, 2, 1)) {
    traits.push({ name: "퍼스트 블러드", emoji: "🟢", description: `선제골 팀 내 1~2위 (${firstBloodMap.get(playerId) || 0}회)`, category: "clutch", color: "green" });
  }

  // 극장골 장인: 7-8Q 득점
  const lateGoalRanking = allPlayerIds.map(pid => ({
    id: pid,
    value: goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal && g.quarter >= 7).length
  })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, lateGoalRanking, 2, 1)) {
    traits.push({ name: "극장골 장인", emoji: "🟢", description: `7-8Q 득점 팀 내 1~2위`, category: "clutch", color: "green" });
  }

  // 위기의 남자: 동점/지고있을 때 득점
  const clutchGoalMap = new Map<number, number>();
  goalEvents.filter(g => g.goal_player_id && !g.is_own_goal).forEach(g => {
    const mTeams = teams.filter(t => t.match_id === g.match_id);
    const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
    if (!ourTeamIds.has(g.team_id)) return;
    const prior = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
    let ourScore = 0, oppScore = 0;
    prior.forEach(e => {
      if (e.is_own_goal) oppScore++;
      else if (ourTeamIds.has(e.team_id)) ourScore++;
      else oppScore++;
    });
    if (ourScore <= oppScore) {
      clutchGoalMap.set(g.goal_player_id!, (clutchGoalMap.get(g.goal_player_id!) || 0) + 1);
    }
  });
  const clutchRanking = allPlayerIds.map(pid => ({ id: pid, value: clutchGoalMap.get(pid) || 0 })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, clutchRanking, 2, 1)) {
    traits.push({ name: "위기의 남자", emoji: "🟢", description: `클러치 득점 팀 내 1~2위`, category: "clutch", color: "green" });
  }

  // 🧤 GK Wall: GK 무실점 쿼터 최다 1~2위
  const gkCleanSheetMap = new Map<number, number>();
  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const gks = parseLineup(q.lineup).GK;
    if ((q.score_against || 0) === 0) {
      gks.forEach(pid => gkCleanSheetMap.set(pid, (gkCleanSheetMap.get(pid) || 0) + 1));
    }
  });
  const gkWallRanking = allPlayerIds.map(pid => ({ id: pid, value: gkCleanSheetMap.get(pid) || 0 })).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, gkWallRanking, 2, 2)) {
    traits.push({ name: "최고의 야신", emoji: "🧤", description: `GK 무실점 쿼터 팀 내 1~2위 (${gkCleanSheetMap.get(playerId) || 0}회)`, category: "defense", color: "yellow" });
  }

  // 🎯 Tap-in Master (인자기 헌정상): 주워먹기/엉덩이골/혼전골 비율 최고 1~2위
  const tapInTypes = ["주워먹기", "엉덩이골", "골문 앞 혼전골", "인자기골"];
  const tapInRatioRanking = allPlayerIds.map(pid => {
    const totalGoals = playerTotalGoals.get(pid) || 0;
    if (totalGoals < 3) return { id: pid, value: -1 };
    const tapIns = gtc(pid, ...tapInTypes);
    return { id: pid, value: tapIns / totalGoals };
  }).filter(r => r.value >= 0).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, tapInRatioRanking, 2, 0.01)) {
    const tapIns = gtc(playerId, ...tapInTypes);
    const total = playerTotalGoals.get(playerId) || 0;
    traits.push({ name: "인자기 헌정상", emoji: "🎯", description: `주워먹기/혼전골 비율 팀 내 1~2위 (${tapIns}/${total})`, category: "attack", color: "green" });
  }

  // 🤡 4. Dishonor Traits (top 1 ONLY)

  // 스탯 세탁기: 3점차+ 리드 시 기록 비율 팀 내 1위 (min 10 AP)
  const paddingRatioMap = new Map<number, { padding: number; total: number }>();
  goalEvents.forEach(g => {
    if (g.is_own_goal) return;
    const mTeams = teams.filter(t => t.match_id === g.match_id);
    const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
    const prior = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
    let ourScore = 0, oppScore = 0;
    prior.forEach(e => {
      if (e.is_own_goal) oppScore++;
      else if (ourTeamIds.has(e.team_id)) ourScore++;
      else oppScore++;
    });
    const leadBy3 = ourScore - oppScore >= 3;

    // Goal scorer
    if (g.goal_player_id && ourTeamIds.has(g.team_id)) {
      const cur = paddingRatioMap.get(g.goal_player_id) || { padding: 0, total: 0 };
      cur.total++;
      if (leadBy3) cur.padding++;
      paddingRatioMap.set(g.goal_player_id, cur);
    }
    // Assister
    if (g.assist_player_id && ourTeamIds.has(g.team_id)) {
      const cur = paddingRatioMap.get(g.assist_player_id) || { padding: 0, total: 0 };
      cur.total++;
      if (leadBy3) cur.padding++;
      paddingRatioMap.set(g.assist_player_id, cur);
    }
  });
  const paddingRanking = allPlayerIds
    .map(pid => {
      const d = paddingRatioMap.get(pid);
      return { id: pid, value: d && d.total >= 10 ? d.padding / d.total : -1 };
    })
    .filter(r => r.value >= 0)
    .sort((a, b) => b.value - a.value);
  if (paddingRanking.length > 0 && paddingRanking[0].id === playerId && paddingRanking[0].value >= 0.55) {
    traits.push({ name: "공식 스탯 세탁기", emoji: "🤡", description: `3점차+ 리드 시 기록 비율 팀 내 1위`, category: "clutch", color: "red" });
  }

  // 탐욕왕: 어시스트 비율 최저 1~2위 (min 10 AP)
  const greedRanking = allPlayerIds
    .map(pid => {
      const ap = playerTotalAP.get(pid) || 0;
      const assists = playerTotalAssists.get(pid) || 0;
      return { id: pid, value: ap >= 10 ? assists / ap : 999 };
    })
    .filter(r => r.value < 999)
    .sort((a, b) => a.value - b.value); // lower = greedier
  if (greedRanking.length > 0) {
    const greedIdx = greedRanking.findIndex(r => r.id === playerId);
    if (greedIdx >= 0 && greedIdx < 2) {
      traits.push({ name: "탐욕왕", emoji: "🤡", description: `어시스트 비율 최저 팀 내 1~2위`, category: "pass", color: "red" });
    }
  }

  // 🟢 세트피스 장인: 코너킥 등 세트피스 골+어시 합산 1~2위
  const setPieceRanking = allPlayerIds.map(pid => {
    const spGoals = goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal && (g.goal_type === "코너킥골" || g.build_up_process?.includes("세트피스") || g.build_up_process?.includes("코너킥"))).length;
    const spAssists = goalEvents.filter(g => g.assist_player_id === pid && (g.assist_type === "코너킥패스" || g.assist_type === "코너킥" || g.goal_type === "코너킥골" || g.build_up_process?.includes("세트피스") || g.build_up_process?.includes("코너킥"))).length;
    return { id: pid, value: spGoals + spAssists };
  }).sort((a, b) => b.value - a.value);
  if (isTopN(playerId, setPieceRanking, 2, 2)) {
    traits.push({ name: "세트피스 장인", emoji: "⚽", description: `세트피스 골+어시 팀 내 1~2위 (${setPieceRanking.find(r => r.id === playerId)?.value || 0}회)`, category: "attack", color: "green" });
  }

  return traits;
}

// ─── Assist Connection Map ───
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
