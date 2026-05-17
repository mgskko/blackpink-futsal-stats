import type { Player, Match, Team, Result, GoalEvent, MatchQuarter, Roster } from "./useFutsalData";
import { getPlayerName } from "./useFutsalData";

function isCustomLineup(lineup: any): boolean {
  return lineup && typeof lineup === "object" && !Array.isArray(lineup) && (lineup.teamA || lineup.teamB);
}

// Build a Set of currently-valid player IDs.
// Any lineup ID not in this set is treated as a deleted/inactive ghost
// and must be filtered out from all chemistry computations.
function buildValidIds(players: Player[]): Set<number> {
  return new Set(players.map(p => p.id));
}
function filterValid(ids: number[], valid: Set<number>): number[] {
  return ids.filter(id => valid.has(id));
}

// Parse a single flat lineup (no teamA/teamB nesting)
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

// For chemistry: return per-team field player groups
// For normal matches: returns one group; for custom: two groups (teamA & teamB)
function getFieldPlayerGroups(lineup: any): number[][] {
  if (!lineup || typeof lineup !== "object") return [];
  if (isCustomLineup(lineup)) {
    const groups: number[][] = [];
    if (lineup.teamA) groups.push(getFieldPlayersFlat(lineup.teamA));
    if (lineup.teamB) groups.push(getFieldPlayersFlat(lineup.teamB));
    return groups;
  }
  const flat = getFieldPlayersFlat(lineup);
  return flat.length > 0 ? [flat] : [];
}

// Legacy: get ALL field players merged (for backward compat)
function getFieldPlayers(lineup: any): number[] {
  return getFieldPlayerGroups(lineup).flat();
}

function getBenchPlayersFlat(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  if (!lineup.Bench) return [];
  return (Array.isArray(lineup.Bench) ? lineup.Bench : [lineup.Bench]).map(Number);
}

function getBenchPlayers(lineup: any): number[] {
  if (isCustomLineup(lineup)) {
    const a = lineup.teamA ? getBenchPlayersFlat(lineup.teamA) : [];
    const b = lineup.teamB ? getBenchPlayersFlat(lineup.teamB) : [];
    return [...a, ...b];
  }
  return getBenchPlayersFlat(lineup);
}

function getPositionPlayersFlat(lineup: any, pos: string): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  if (!lineup[pos]) return [];
  return (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).map(Number);
}

// For chemistry: returns position players per team group
function getPositionPlayerGroups(lineup: any, pos: string): number[][] {
  if (isCustomLineup(lineup)) {
    const groups: number[][] = [];
    if (lineup.teamA) groups.push(getPositionPlayersFlat(lineup.teamA, pos));
    if (lineup.teamB) groups.push(getPositionPlayersFlat(lineup.teamB, pos));
    return groups;
  }
  const flat = getPositionPlayersFlat(lineup, pos);
  return flat.length > 0 ? [flat] : [];
}

function getPositionPlayers(lineup: any, pos: string): number[] {
  return getPositionPlayerGroups(lineup, pos).flat();
}

// Helper: get margin from a player group's perspective
function getGroupMargin(q: MatchQuarter, groupIdx: number, isCustom: boolean): number {
  const sf = q.score_for || 0;
  const sa = q.score_against || 0;
  if (isCustom && groupIdx === 1) return sa - sf; // teamB: flipped
  return sf - sa;
}
function getGroupConceded(q: MatchQuarter, groupIdx: number, isCustom: boolean): number {
  if (isCustom && groupIdx === 1) return q.score_for || 0; // teamB: score_for is what they conceded
  return q.score_against || 0;
}
function getGroupScored(q: MatchQuarter, groupIdx: number, isCustom: boolean): number {
  if (isCustom && groupIdx === 1) return q.score_against || 0;
  return q.score_for || 0;
}

// ─── 1. Death Lineup: Best 5-player combo by margin ───
export interface DeathLineup {
  playerIds: number[];
  names: string[];
  margin: number;
  quarters: number;
  avgMargin: number;
}

export function computeDeathLineup(
  players: Player[],
  allQuarters: MatchQuarter[]
): DeathLineup | null {
  const valid = buildValidIds(players);
  // Generate all 5-player subsets from field players per quarter
  const comboMap = new Map<string, { playerIds: number[]; margin: number; quarters: number }>();

  function getCombinations(arr: number[], size: number): number[][] {
    if (size === arr.length) return [arr];
    if (size === 1) return arr.map(x => [x]);
    const result: number[][] = [];
    for (let i = 0; i <= arr.length - size; i++) {
      const rest = getCombinations(arr.slice(i + 1), size - 1);
      rest.forEach(combo => result.push([arr[i], ...combo]));
    }
    return result;
  }

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const groups = getFieldPlayerGroups(q.lineup);
    groups.forEach((field, gi) => {
      field = filterValid(field, valid);
      field.sort((a, b) => a - b);
      if (field.length < 5) return;
      const diff = getGroupMargin(q, gi, custom);
      const combos5 = field.length === 5 ? [field] : getCombinations(field, 5);
      combos5.forEach(combo => {
        const key = combo.join(",");
        const cur = comboMap.get(key) || { playerIds: combo, margin: 0, quarters: 0 };
        cur.margin += diff;
        cur.quarters++;
        comboMap.set(key, cur);
      });
    });
  });

  const combos = [...comboMap.values()]
    .filter(c => c.quarters >= 5)
    .sort((a, b) => (b.margin / b.quarters) - (a.margin / a.quarters));

  if (combos.length === 0) return null;
  const best = combos[0];
  return {
    playerIds: best.playerIds,
    names: best.playerIds.map(pid => getPlayerName(players, pid)),
    margin: best.margin,
    quarters: best.quarters,
    avgMargin: best.margin / best.quarters,
  };
}

// ─── 2. Pass Network (Telepathic Duo) ───
export interface PassNetworkEntry {
  assisterId: number;
  assisterName: string;
  scorerId: number;
  scorerName: string;
  count: number;
}

export function computePassNetwork(
  players: Player[],
  goalEvents: GoalEvent[],
  rosters: Roster[],
  topN: number = 10
): PassNetworkEntry[] {
  const valid = buildValidIds(players);
  // First compute co-appearance counts per duo (min 8 matches together)
  const coAppearanceMap = new Map<string, number>();
  const matchPlayerMap = new Map<number, Set<number>>();
  rosters.forEach(r => {
    if (!valid.has(r.player_id)) return;
    if (!matchPlayerMap.has(r.match_id)) matchPlayerMap.set(r.match_id, new Set());
    matchPlayerMap.get(r.match_id)!.add(r.player_id);
  });
  matchPlayerMap.forEach((playerSet) => {
    const pids = [...playerSet];
    for (let i = 0; i < pids.length; i++) {
      for (let j = i + 1; j < pids.length; j++) {
        const key = `${Math.min(pids[i], pids[j])}-${Math.max(pids[i], pids[j])}`;
        coAppearanceMap.set(key, (coAppearanceMap.get(key) || 0) + 1);
      }
    }
  });

  const map = new Map<string, PassNetworkEntry>();
  goalEvents.forEach(g => {
    if (!g.assist_player_id || !g.goal_player_id || g.is_own_goal) return;
    if (!valid.has(g.assist_player_id) || !valid.has(g.goal_player_id)) return;
    const duoKey = `${Math.min(g.assist_player_id, g.goal_player_id)}-${Math.max(g.assist_player_id, g.goal_player_id)}`;
    const coCount = coAppearanceMap.get(duoKey) || 0;
    if (coCount < 10) return; // Must have played together in 10+ matches
    const key = `${g.assist_player_id}->${g.goal_player_id}`;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, {
      assisterId: g.assist_player_id,
      assisterName: getPlayerName(players, g.assist_player_id),
      scorerId: g.goal_player_id,
      scorerName: getPlayerName(players, g.goal_player_id),
      count: 1,
    });
  });
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, topN);
}

// ─── 3. Toxic Duo: Worst 2-player combo by conceded rate ───
export interface ToxicDuo {
  p1: number; name1: string;
  p2: number; name2: string;
  concededPerQ: number;
  quarters: number;
  totalConceded: number;
}

export function computeToxicDuos(
  players: Player[],
  allQuarters: MatchQuarter[],
  rosters: Roster[],
  topN: number = 5
): ToxicDuo[] {
  const valid = buildValidIds(players);
  // Build all-time match count per player
  const playerMatchCount = new Map<number, Set<number>>();
  rosters.forEach(r => {
    if (!valid.has(r.player_id)) return;
    if (!playerMatchCount.has(r.player_id)) playerMatchCount.set(r.player_id, new Set());
    playerMatchCount.get(r.player_id)!.add(r.match_id);
  });
  const has10Matches = (pid: number) => (playerMatchCount.get(pid)?.size || 0) >= 10;

  const duoMap = new Map<string, { p1: number; p2: number; conceded: number; quarters: number }>();

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const groups = getFieldPlayerGroups(q.lineup);
    groups.forEach((field, gi) => {
      field = filterValid(field, valid);
      const conceded = getGroupConceded(q, gi, custom);
      for (let i = 0; i < field.length; i++) {
        if (!has10Matches(field[i])) continue;
        for (let j = i + 1; j < field.length; j++) {
          if (!has10Matches(field[j])) continue;
          const key = `${Math.min(field[i], field[j])}-${Math.max(field[i], field[j])}`;
          const cur = duoMap.get(key) || { p1: Math.min(field[i], field[j]), p2: Math.max(field[i], field[j]), conceded: 0, quarters: 0 };
          cur.conceded += conceded;
          cur.quarters++;
          duoMap.set(key, cur);
        }
      }
    });
  });

  return [...duoMap.values()]
    .filter(d => d.quarters >= 10)
    .map(d => ({
      p1: d.p1, name1: getPlayerName(players, d.p1),
      p2: d.p2, name2: getPlayerName(players, d.p2),
      concededPerQ: d.conceded / d.quarters,
      quarters: d.quarters,
      totalConceded: d.conceded,
    }))
    .sort((a, b) => b.concededPerQ - a.concededPerQ)
    .slice(0, topN);
}

// ─── 4. Best Defensive Line ───
export interface DefenseLine {
  playerIds: number[];
  names: string[];
  concededPerQ: number;
  quarters: number;
}

export function computeBestDefenseLine(
  players: Player[],
  allQuarters: MatchQuarter[],
  rosters: Roster[],
  topN: number = 5
): DefenseLine[] {
  const valid = buildValidIds(players);
  // Build all-time match count per player
  const playerMatchCount = new Map<number, Set<number>>();
  rosters.forEach(r => {
    if (!valid.has(r.player_id)) return;
    if (!playerMatchCount.has(r.player_id)) playerMatchCount.set(r.player_id, new Set());
    playerMatchCount.get(r.player_id)!.add(r.match_id);
  });
  const has10Matches = (pid: number) => (playerMatchCount.get(pid)?.size || 0) >= 10;

  const comboMap = new Map<string, { playerIds: number[]; conceded: number; quarters: number }>();

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const groups = getPositionPlayerGroups(q.lineup, "DF");
    groups.forEach((dfs, gi) => {
      dfs = filterValid(dfs, valid);
      dfs.sort((a, b) => a - b);
      if (dfs.length < 2) return;
      if (!dfs.every(has10Matches)) return;
      const key = dfs.join(",");
      const conceded = getGroupConceded(q, gi, custom);
      const cur = comboMap.get(key) || { playerIds: dfs, conceded: 0, quarters: 0 };
      cur.conceded += conceded;
      cur.quarters++;
      comboMap.set(key, cur);
    });
  });

  return [...comboMap.values()]
    .filter(c => c.quarters >= 5)
    .map(c => ({
      playerIds: c.playerIds,
      names: c.playerIds.map(pid => getPlayerName(players, pid)),
      concededPerQ: c.conceded / c.quarters,
      quarters: c.quarters,
    }))
    .sort((a, b) => a.concededPerQ - b.concededPerQ)
    .slice(0, topN);
}

// ─── 5. Synergy Margin ───
export interface SynergyMargin {
  p1: number; name1: string;
  p2: number; name2: string;
  togetherMarginPerQ: number;
  apartMarginPerQ: number;
  synergy: number;
  togetherQ: number;
}

export function computeSynergyMargin(
  players: Player[],
  allQuarters: MatchQuarter[],
  rosters: Roster[],
  topN: number = 5
): SynergyMargin[] {
  const valid = buildValidIds(players);
  // Build all-time match count per player
  const playerMatchCount = new Map<number, Set<number>>();
  rosters.forEach(r => {
    if (!valid.has(r.player_id)) return;
    if (!playerMatchCount.has(r.player_id)) playerMatchCount.set(r.player_id, new Set());
    playerMatchCount.get(r.player_id)!.add(r.match_id);
  });
  const has10Matches = (pid: number) => (playerMatchCount.get(pid)?.size || 0) >= 10;

  const duoMap = new Map<string, { p1: number; p2: number; togetherMargin: number; togetherQ: number; apartMargin: number; apartQ: number }>();

  // Get all player pairs who have played together (with 10+ all-time matches)
  const allFieldPlayerIds = new Set<number>();
  allQuarters.forEach(q => { if (q.lineup) getFieldPlayers(q.lineup).forEach(pid => { if (valid.has(pid)) allFieldPlayerIds.add(pid); }); });
  const playerIds = [...allFieldPlayerIds].filter(has10Matches);

  // For each pair, compute together vs apart margin
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i], p2 = playerIds[j];
      let togetherMargin = 0, togetherQ = 0, apartMargin = 0, apartQ = 0;
      allQuarters.forEach(q => {
        if (!q.lineup) return;
        const custom = isCustomLineup(q.lineup);
        const groups = getFieldPlayerGroups(q.lineup);
        // Check if both players are on the same team group
        groups.forEach((field, gi) => {
          const diff = getGroupMargin(q, gi, custom);
          const has1 = field.includes(p1), has2 = field.includes(p2);
          if (has1 && has2) { togetherMargin += diff; togetherQ++; }
          else if (has1 || has2) { apartMargin += diff; apartQ++; }
        });
      });
      if (togetherQ >= 10 && apartQ >= 10) {
        const key = `${Math.min(p1, p2)}-${Math.max(p1, p2)}`;
        duoMap.set(key, { p1: Math.min(p1, p2), p2: Math.max(p1, p2), togetherMargin, togetherQ, apartMargin, apartQ });
      }
    }
  }

  return [...duoMap.values()]
    .map(d => ({
      p1: d.p1, name1: getPlayerName(players, d.p1),
      p2: d.p2, name2: getPlayerName(players, d.p2),
      togetherMarginPerQ: d.togetherMargin / d.togetherQ,
      apartMarginPerQ: d.apartMargin / d.apartQ,
      synergy: (d.togetherMargin / d.togetherQ) - (d.apartMargin / d.apartQ),
      togetherQ: d.togetherQ,
    }))
    .sort((a, b) => b.synergy - a.synergy)
    .slice(0, topN);
}

// ─── 6. Without You: bench impact ───
export interface WithoutYouEntry {
  playerId: number;
  name: string;
  onFieldMarginPerQ: number;
  benchMarginPerQ: number;
  impact: number;
  onFieldQ: number;
  benchQ: number;
}

export function computeWithoutYou(
  players: Player[],
  allQuarters: MatchQuarter[],
  topN: number = 7
): WithoutYouEntry[] {
  const valid = buildValidIds(players);
  const playerMap = new Map<number, { onMargin: number; onQ: number; offMargin: number; offQ: number }>();

  const allPlayerIds = new Set<number>();
  allQuarters.forEach(q => {
    if (!q.lineup) return;
    getFieldPlayers(q.lineup).forEach(pid => { if (valid.has(pid)) allPlayerIds.add(pid); });
    getBenchPlayers(q.lineup).forEach(pid => { if (valid.has(pid)) allPlayerIds.add(pid); });
  });

  allPlayerIds.forEach(pid => {
    let onMargin = 0, onQ = 0, offMargin = 0, offQ = 0;
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const custom = isCustomLineup(q.lineup);
      const groups = getFieldPlayerGroups(q.lineup);
      const bench = getBenchPlayers(q.lineup);
      let onField = false;
      groups.forEach((field, gi) => {
        if (field.includes(pid)) {
          const diff = getGroupMargin(q, gi, custom);
          onMargin += diff; onQ++;
          onField = true;
        }
      });
      if (!onField && bench.includes(pid)) {
        // Use generic margin for bench (doesn't matter which team perspective)
        const diff = (q.score_for || 0) - (q.score_against || 0);
        offMargin += diff; offQ++;
      }
    });
    if (onQ >= 5 && offQ >= 2) {
      playerMap.set(pid, { onMargin, onQ, offMargin, offQ });
    }
  });

  return [...playerMap.entries()]
    .map(([pid, d]) => ({
      playerId: pid,
      name: getPlayerName(players, pid),
      onFieldMarginPerQ: d.onMargin / d.onQ,
      benchMarginPerQ: d.offMargin / d.offQ,
      impact: (d.onMargin / d.onQ) - (d.offMargin / d.offQ),
      onFieldQ: d.onQ,
      benchQ: d.offQ,
    }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, topN);
}

// ─── 7. Position Duo FW: Best FW pair ───
export interface FWDuo {
  p1: number; name1: string;
  p2: number; name2: string;
  marginPerQ: number;
  goalsPerQ: number;
  quarters: number;
  totalGoals: number;
}

export function computeFWDuos(
  players: Player[],
  allQuarters: MatchQuarter[],
  goalEvents: GoalEvent[],
  topN: number = 5
): FWDuo[] {
  const valid = buildValidIds(players);
  const duoMap = new Map<string, { p1: number; p2: number; margin: number; quarters: number; goals: number }>();

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const fwGroups = getPositionPlayerGroups(q.lineup, "FW");
    fwGroups.forEach((fws, gi) => {
      fws = filterValid(fws, valid);
      fws.sort((a, b) => a - b);
      if (fws.length < 2) return;
      const diff = getGroupMargin(q, gi, custom);
      for (let i = 0; i < fws.length; i++) {
        for (let j = i + 1; j < fws.length; j++) {
          const key = `${fws[i]}-${fws[j]}`;
          const qGoals = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && !g.is_own_goal && (g.goal_player_id === fws[i] || g.goal_player_id === fws[j])).length;
          const cur = duoMap.get(key) || { p1: fws[i], p2: fws[j], margin: 0, quarters: 0, goals: 0 };
          cur.margin += diff;
          cur.quarters++;
          cur.goals += qGoals;
          duoMap.set(key, cur);
        }
      }
    });
  });

  return [...duoMap.values()]
    .filter(d => d.quarters >= 5)
    .map(d => ({
      p1: d.p1, name1: getPlayerName(players, d.p1),
      p2: d.p2, name2: getPlayerName(players, d.p2),
      marginPerQ: d.margin / d.quarters,
      goalsPerQ: d.goals / d.quarters,
      quarters: d.quarters,
      totalGoals: d.goals,
    }))
    .sort((a, b) => b.marginPerQ - a.marginPerQ)
    .slice(0, topN);
}

// ─── 8. Position Duo by Win Rate (FW/DF) ───
export interface PositionDuoWinRate {
  p1: number; name1: string;
  p2: number; name2: string;
  winRate: number;
  wins: number;
  quarters: number;
  marginPerQ: number;
  combinedGoals: number;
  cleanSheetQuarters: number;
}

export function computePositionDuosByWinRate(
  players: Player[],
  allQuarters: MatchQuarter[],
  position: "FW" | "DF",
  rosters: Roster[],
  topN: number = 5,
  worst: boolean = false,
  goalEvents?: GoalEvent[]
): PositionDuoWinRate[] {
  const valid = buildValidIds(players);
  // Build all-time match count per player
  const playerMatchCount = new Map<number, Set<number>>();
  rosters.forEach(r => {
    if (!valid.has(r.player_id)) return;
    if (!playerMatchCount.has(r.player_id)) playerMatchCount.set(r.player_id, new Set());
    playerMatchCount.get(r.player_id)!.add(r.match_id);
  });
  const has10Matches = (pid: number) => (playerMatchCount.get(pid)?.size || 0) >= 10;

  const duoMap = new Map<string, { p1: number; p2: number; wins: number; quarters: number; margin: number; combinedGoals: number; cleanSheetQuarters: number }>();

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const posGroups = getPositionPlayerGroups(q.lineup, position);
    posGroups.forEach((posPlayers, gi) => {
      posPlayers = filterValid(posPlayers, valid);
      posPlayers.sort((a, b) => a - b);
      if (posPlayers.length < 2) return;
      const diff = getGroupMargin(q, gi, custom);
      const won = diff > 0 ? 1 : 0;
      const conceded = getGroupConceded(q, gi, custom);
      const isCleanSheet = conceded === 0 ? 1 : 0;
      for (let i = 0; i < posPlayers.length; i++) {
        if (!has10Matches(posPlayers[i])) continue;
        for (let j = i + 1; j < posPlayers.length; j++) {
          if (!has10Matches(posPlayers[j])) continue;
          const key = `${posPlayers[i]}-${posPlayers[j]}`;
          const cur = duoMap.get(key) || { p1: posPlayers[i], p2: posPlayers[j], wins: 0, quarters: 0, margin: 0, combinedGoals: 0, cleanSheetQuarters: 0 };
          cur.wins += won;
          cur.quarters++;
          cur.margin += diff;
          cur.cleanSheetQuarters += isCleanSheet;
          if (goalEvents) {
            const qGoals = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && !g.is_own_goal && (g.goal_player_id === posPlayers[i] || g.goal_player_id === posPlayers[j])).length;
            cur.combinedGoals += qGoals;
          }
          duoMap.set(key, cur);
        }
      }
    });
  });

  return [...duoMap.values()]
    .filter(d => d.quarters >= (position === "DF" ? 5 : 10))
    .map(d => ({
      p1: d.p1, name1: getPlayerName(players, d.p1),
      p2: d.p2, name2: getPlayerName(players, d.p2),
      winRate: Math.round((d.wins / d.quarters) * 100),
      wins: d.wins,
      quarters: d.quarters,
      marginPerQ: d.margin / d.quarters,
      combinedGoals: d.combinedGoals,
      cleanSheetQuarters: d.cleanSheetQuarters,
    }))
    .sort((a, b) => worst ? a.winRate - b.winRate : b.winRate - a.winRate)
    .slice(0, topN);
}

// ─── 10. Interactive Chemistry Analyzer (2~3 players) ───
export interface ChemistryAnalysis {
  selectedIds: number[];
  selectedNames: string[];
  togetherQuarters: number;
  togetherMatches: number;
  combinedGoals: number; // 합작 골 (assist+scorer 모두 선택자)
  silentQuarterRate: number; // 동시출전 쿼터 중 0득점 비율 (%)
  goalsConcededPerQ: number;
  defenseCollapseRate: number; // 2실점 이상 쿼터 비율 (%)
  marginPerQ: number;
  winRate: number; // 동시출전 승률(%)
  apartWinRate: number; // 한 명만 출전했을 때 평균 승률(%)
  apartQuarters: number;
  benchSyncQuarters: number;
  reliable: boolean; // 10경기 이상 함께
  badge: { emoji: string; title: string; tone: "good" | "bad" | "neutral" };
  // ── extended detail ──
  goalSplit: { scorerId: number; scorerName: string; goals: number }[]; // selected scorers
  assistSplit: { assisterId: number; assisterName: string; assists: number }[]; // selected assisters
  comboBreakdown: { assisterId: number; assisterName: string; scorerId: number; scorerName: string; count: number }[];
  comboTimeline: { matchId: number; quarter: number; assisterName: string; scorerName: string }[];
  // 동시출전 종합 승무패
  wins: number; draws: number; losses: number;
  cleanSheetQuarters: number; // 합작 무실점 쿼터
  cleanSheetRate: number; // %
  // DF/GK 분리
  dfQuarters: number; dfCleanSheets: number; dfConcededPerQ: number;
  // 솔로 마진
  soloMargins: { id: number; name: string; quarters: number; marginPerQ: number }[];
  // 벤치 다운 마진
  benchDownMarginPerQ: number;
}

export function analyzeChemistry(
  players: Player[],
  allQuarters: MatchQuarter[],
  goalEvents: GoalEvent[],
  selectedIds: number[]
): ChemistryAnalysis | null {
  if (selectedIds.length < 2 || selectedIds.length > 3) return null;

  let togetherQ = 0;
  let scored = 0, conceded = 0, marginSum = 0;
  let silentQ = 0, collapseQ = 0;
  let wins = 0;
  let draws = 0, losses = 0;
  let cleanSheetQ = 0;
  let apartQ = 0, apartWins = 0;
  let benchSyncQ = 0;
  let benchDownMargin = 0, benchDownQ = 0;
  let dfQ = 0, dfConceded = 0, dfCleanSheet = 0;
  // solo (this player is in field, none of the others)
  const soloMap = new Map<number, { margin: number; q: number }>();
  selectedIds.forEach(id => soloMap.set(id, { margin: 0, q: 0 }));
  const togetherMatchIds = new Set<number>();
  const togetherQKeys = new Set<string>(); // matchId-quarter for goal counting

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const groups = getFieldPlayerGroups(q.lineup);
    let foundTogether = false;
    let foundAloneAny = false;
    groups.forEach((field, gi) => {
      const presence = selectedIds.map(id => field.includes(id));
      const allIn = presence.every(Boolean);
      const anyIn = presence.some(Boolean);
      if (allIn) {
        foundTogether = true;
        const diff = getGroupMargin(q, gi, custom);
        const sf = getGroupScored(q, gi, custom);
        const sa = getGroupConceded(q, gi, custom);
        togetherQ++;
        scored += sf; conceded += sa; marginSum += diff;
        if (sf === 0) silentQ++;
        if (sa >= 2) collapseQ++;
        if (sa === 0) cleanSheetQ++;
        if (diff > 0) wins++; else if (diff === 0) draws++; else losses++;
        // DF/GK lineup check: ALL selected are DF or GK in this quarter's lineup
        const lineupForGroup = isCustomLineup(q.lineup) ? (gi === 0 ? (q.lineup as any).teamA : (q.lineup as any).teamB) : q.lineup;
        const dfgkAll = selectedIds.every(id => {
          const dfs = getPositionPlayersFlat(lineupForGroup, "DF");
          const gks = getPositionPlayersFlat(lineupForGroup, "GK");
          return dfs.includes(id) || gks.includes(id);
        });
        if (dfgkAll) {
          dfQ++;
          dfConceded += sa;
          if (sa === 0) dfCleanSheet++;
        }
        togetherMatchIds.add(q.match_id);
        togetherQKeys.add(`${q.match_id}-${q.quarter}`);
      } else if (anyIn) {
        foundAloneAny = true;
        const diff = getGroupMargin(q, gi, custom);
        apartQ++;
        if (diff > 0) apartWins++;
        // Per-player solo: this group has exactly one of the selected (the only one present)
        const inThisGroup = selectedIds.filter(id => field.includes(id));
        if (inThisGroup.length === 1) {
          // and no other selected is in the OTHER group of this quarter
          const otherSelected = selectedIds.filter(id => id !== inThisGroup[0]);
          const anyOtherInQuarter = otherSelected.some(oid => groups.some((f2, gi2) => gi2 !== gi && f2.includes(oid)));
          if (!anyOtherInQuarter) {
            const cur = soloMap.get(inThisGroup[0])!;
            cur.margin += diff; cur.q++;
          }
        }
      }
    });
    // bench sync: all selected are on bench (and none on field)
    if (!foundTogether) {
      const benches: number[][] = [];
      if (isCustomLineup(q.lineup)) {
        if (q.lineup.teamA?.Bench) benches.push((Array.isArray(q.lineup.teamA.Bench) ? q.lineup.teamA.Bench : [q.lineup.teamA.Bench]).map(Number));
        if (q.lineup.teamB?.Bench) benches.push((Array.isArray(q.lineup.teamB.Bench) ? q.lineup.teamB.Bench : [q.lineup.teamB.Bench]).map(Number));
      } else if (q.lineup.Bench) {
        benches.push((Array.isArray(q.lineup.Bench) ? q.lineup.Bench : [q.lineup.Bench]).map(Number));
      }
      const allOnBench = selectedIds.every(id => benches.some(b => b.includes(id)));
      if (allOnBench) {
        benchSyncQ++;
        const diff = (q.score_for || 0) - (q.score_against || 0);
        benchDownMargin += diff; benchDownQ++;
      }
    }
  });

  // Combined goals + breakdown
  const selectedSet = new Set(selectedIds);
  let combinedGoals = 0;
  const goalSplitMap = new Map<number, number>();
  const assistSplitMap = new Map<number, number>();
  const comboMap = new Map<string, { assisterId: number; scorerId: number; count: number }>();
  const comboTimeline: { matchId: number; quarter: number; assisterName: string; scorerName: string }[] = [];
  goalEvents.forEach(g => {
    if (g.is_own_goal) return;
    if (!togetherQKeys.has(`${g.match_id}-${g.quarter}`)) return;
    // Track individual selected scorers/assisters during together quarters
    if (g.goal_player_id && selectedSet.has(g.goal_player_id)) {
      goalSplitMap.set(g.goal_player_id, (goalSplitMap.get(g.goal_player_id) || 0) + 1);
    }
    if (g.assist_player_id && selectedSet.has(g.assist_player_id)) {
      assistSplitMap.set(g.assist_player_id, (assistSplitMap.get(g.assist_player_id) || 0) + 1);
    }
    if (g.goal_player_id && g.assist_player_id && selectedSet.has(g.goal_player_id) && selectedSet.has(g.assist_player_id)) {
      combinedGoals++;
      const key = `${g.assist_player_id}->${g.goal_player_id}`;
      const cur = comboMap.get(key) || { assisterId: g.assist_player_id, scorerId: g.goal_player_id, count: 0 };
      cur.count++;
      comboMap.set(key, cur);
      comboTimeline.push({
        matchId: g.match_id,
        quarter: g.quarter,
        assisterName: getPlayerName(players, g.assist_player_id),
        scorerName: getPlayerName(players, g.goal_player_id),
      });
    }
  });

  if (togetherQ === 0) return null;

  const winRate = Math.round((wins / togetherQ) * 100);
  const apartWinRate = apartQ > 0 ? Math.round((apartWins / apartQ) * 100) : 0;
  const goalsConcededPerQ = conceded / togetherQ;
  const marginPerQ = marginSum / togetherQ;
  const silentQuarterRate = Math.round((silentQ / togetherQ) * 100);
  const defenseCollapseRate = Math.round((collapseQ / togetherQ) * 100);
  const reliable = togetherMatchIds.size >= 10;
  const cleanSheetRate = Math.round((cleanSheetQ / togetherQ) * 100);
  const dfConcededPerQ = dfQ > 0 ? dfConceded / dfQ : 0;
  const benchDownMarginPerQ = benchDownQ > 0 ? benchDownMargin / benchDownQ : 0;

  const goalSplit = selectedIds
    .map(id => ({ scorerId: id, scorerName: getPlayerName(players, id), goals: goalSplitMap.get(id) || 0 }))
    .filter(d => d.goals > 0)
    .sort((a, b) => b.goals - a.goals);
  const assistSplit = selectedIds
    .map(id => ({ assisterId: id, assisterName: getPlayerName(players, id), assists: assistSplitMap.get(id) || 0 }))
    .filter(d => d.assists > 0)
    .sort((a, b) => b.assists - a.assists);
  const comboBreakdown = [...comboMap.values()]
    .map(c => ({
      assisterId: c.assisterId,
      assisterName: getPlayerName(players, c.assisterId),
      scorerId: c.scorerId,
      scorerName: getPlayerName(players, c.scorerId),
      count: c.count,
    }))
    .sort((a, b) => b.count - a.count);
  const soloMargins = selectedIds.map(id => {
    const cur = soloMap.get(id)!;
    return {
      id,
      name: getPlayerName(players, id),
      quarters: cur.q,
      marginPerQ: cur.q > 0 ? cur.margin / cur.q : 0,
    };
  });

  // Badge classification
  let badge: ChemistryAnalysis["badge"] = { emoji: "🤝", title: "평범한 동료", tone: "neutral" };
  const scoredPerQ = scored / togetherQ;
  if (apartQ >= 5 && winRate < apartWinRate - 10) {
    badge = { emoji: "💥", title: "파멸의 듀오", tone: "bad" };
  } else if (winRate >= 65 && goalsConcededPerQ <= 1.0) {
    badge = { emoji: "✨", title: "환상의 짝꿍", tone: "good" };
  } else if (goalsConcededPerQ <= 0.7) {
    badge = { emoji: "🛡️", title: "철벽 듀오", tone: "good" };
  } else if (scoredPerQ >= 1.5 && goalsConcededPerQ >= 1.5) {
    badge = { emoji: "🔫", title: "유리 대포", tone: "neutral" };
  } else if (winRate >= 55) {
    badge = { emoji: "🤝", title: "믿음직한 콤비", tone: "good" };
  } else if (winRate < 35) {
    badge = { emoji: "⚠️", title: "삐그덕 콤비", tone: "bad" };
  }

  return {
    selectedIds,
    selectedNames: selectedIds.map(id => getPlayerName(players, id)),
    togetherQuarters: togetherQ,
    togetherMatches: togetherMatchIds.size,
    combinedGoals,
    silentQuarterRate,
    goalsConcededPerQ,
    defenseCollapseRate,
    marginPerQ,
    winRate,
    apartWinRate,
    apartQuarters: apartQ,
    benchSyncQuarters: benchSyncQ,
    reliable,
    badge,
    goalSplit,
    assistSplit,
    comboBreakdown,
    comboTimeline,
    wins, draws, losses,
    cleanSheetQuarters: cleanSheetQ,
    cleanSheetRate,
    dfQuarters: dfQ,
    dfCleanSheets: dfCleanSheet,
    dfConcededPerQ,
    soloMargins,
    benchDownMarginPerQ,
  };
}

// ─── 9. Trios by Win Rate ───
export interface TrioWinRate {
  ids: number[];
  names: string[];
  winRate: number;
  wins: number;
  quarters: number;
  totalScored: number;
  totalConceded: number;
  margin: number;
}

export function computeTriosByWinRate(
  players: Player[],
  allQuarters: MatchQuarter[],
  topN: number = 5,
  worst: boolean = false
): TrioWinRate[] {
  const valid = buildValidIds(players);
  const trioMap = new Map<string, { ids: number[]; wins: number; quarters: number; scored: number; conceded: number; margin: number }>();

  allQuarters.forEach(q => {
    if (!q.lineup) return;
    const custom = isCustomLineup(q.lineup);
    const groups = getFieldPlayerGroups(q.lineup);
    groups.forEach((field, gi) => {
      field = filterValid(field, valid);
      field.sort((a, b) => a - b);
      if (field.length < 3) return;
      const diff = getGroupMargin(q, gi, custom);
      const won = diff > 0 ? 1 : 0;
      const scored = getGroupScored(q, gi, custom);
      const conceded = getGroupConceded(q, gi, custom);
      for (let i = 0; i < field.length; i++) {
        for (let j = i + 1; j < field.length; j++) {
          for (let k = j + 1; k < field.length; k++) {
            const ids = [field[i], field[j], field[k]];
            const key = ids.join(",");
            const cur = trioMap.get(key) || { ids, wins: 0, quarters: 0, scored: 0, conceded: 0, margin: 0 };
            cur.wins += won;
            cur.quarters++;
            cur.scored += scored;
            cur.conceded += conceded;
            cur.margin += diff;
            trioMap.set(key, cur);
          }
        }
      }
    });
  });

  return [...trioMap.values()]
    .filter(d => d.quarters >= 10)
    .map(d => ({
      ids: d.ids,
      names: d.ids.map(pid => getPlayerName(players, pid)),
      winRate: Math.round((d.wins / d.quarters) * 100),
      wins: d.wins,
      quarters: d.quarters,
      totalScored: d.scored,
      totalConceded: d.conceded,
      margin: d.margin,
    }))
    .sort((a, b) => worst ? a.winRate - b.winRate : b.winRate - a.winRate)
    .slice(0, topN);
}
