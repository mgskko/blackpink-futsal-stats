import type { Player, Match, Team, Result, Roster, GoalEvent, Venue } from "./useFutsalData";

// ─── Opponent Record ───
export interface OpponentRecord {
  name: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  matches: number;
  winRate: number;
}

export function getOpponentRecords(matches: Match[], teams: Team[], results: Result[]): OpponentRecord[] {
  const map = new Map<string, OpponentRecord>();
  matches.filter(m => !m.is_custom).forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    const oppTeam = mTeams.find(t => !t.is_ours);
    if (!ourTeam || !oppTeam) return;
    const ourResult = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (!ourResult) return;
    const rec = map.get(oppTeam.name) || { name: oppTeam.name, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matches: 0, winRate: 0 };
    rec.matches++;
    if (ourResult.result === "승") rec.wins++;
    else if (ourResult.result === "패") rec.losses++;
    else rec.draws++;
    rec.goalsFor += ourResult.score_for || 0;
    rec.goalsAgainst += ourResult.score_against || 0;
    map.set(oppTeam.name, rec);
  });
  const arr = [...map.values()];
  arr.forEach(r => { r.winRate = r.matches > 0 ? Math.round((r.wins / r.matches) * 100) : 0; });
  return arr.sort((a, b) => b.matches - a.matches);
}

// ─── Venue Record ───
export interface VenueRecord {
  venueId: number;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  winRate: number;
}

export function getVenueRecords(matches: Match[], teams: Team[], results: Result[], venues: Venue[]): VenueRecord[] {
  const map = new Map<number, VenueRecord>();
  matches.filter(m => !m.is_custom && m.venue_id).forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const ourResult = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (!ourResult) return;
    const v = venues.find(v => v.id === m.venue_id);
    if (!v) return;
    const rec = map.get(v.id) || { venueId: v.id, name: v.name, wins: 0, draws: 0, losses: 0, matches: 0, winRate: 0 };
    rec.matches++;
    if (ourResult.result === "승") rec.wins++;
    else if (ourResult.result === "패") rec.losses++;
    else rec.draws++;
    map.set(v.id, rec);
  });
  const arr = [...map.values()];
  arr.forEach(r => { r.winRate = r.matches > 0 ? Math.round((r.wins / r.matches) * 100) : 0; });
  return arr.sort((a, b) => b.matches - a.matches);
}

// ─── Age Category Win Rate ───
export interface AgeCategoryRecord {
  category: string;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  winRate: number;
}

export function getAgeCategoryRecords(matches: Match[], teams: Team[], results: Result[]): AgeCategoryRecord[] {
  const map = new Map<string, AgeCategoryRecord>();
  matches.filter(m => !m.is_custom).forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    const oppTeam = mTeams.find(t => !t.is_ours);
    if (!ourTeam || !oppTeam || !oppTeam.age_category) return;
    const ourResult = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (!ourResult) return;
    const cat = oppTeam.age_category;
    const rec = map.get(cat) || { category: cat, wins: 0, draws: 0, losses: 0, matches: 0, winRate: 0 };
    rec.matches++;
    if (ourResult.result === "승") rec.wins++;
    else if (ourResult.result === "패") rec.losses++;
    else rec.draws++;
    map.set(cat, rec);
  });
  const arr = [...map.values()];
  arr.forEach(r => { r.winRate = r.matches > 0 ? Math.round((r.wins / r.matches) * 100) : 0; });
  return arr.sort((a, b) => b.winRate - a.winRate);
}

// ─── Win Fairy (출석시 팀 승률) ───
export interface WinFairyData {
  playerId: number;
  name: string;
  presentWinRate: number;
  absentWinRate: number;
  diff: number;
  presentMatches: number;
  absentMatches: number;
}

export function getWinFairyData(players: Player[], matches: Match[], teams: Team[], results: Result[], rosters: Roster[]): WinFairyData[] {
  const nonCustom = matches.filter(m => !m.is_custom);
  const matchResults = new Map<number, string>();
  nonCustom.forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const r = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (r) matchResults.set(m.id, r.result);
  });
  const allMatchIds = new Set(matchResults.keys());
  return players.filter(p => p.is_active).map(p => {
    const presentMatchIds = new Set(rosters.filter(r => r.player_id === p.id && allMatchIds.has(r.match_id)).map(r => r.match_id));
    let pWins = 0, pTotal = 0, aWins = 0, aTotal = 0;
    allMatchIds.forEach(mid => {
      const res = matchResults.get(mid);
      if (presentMatchIds.has(mid)) { pTotal++; if (res === "승") pWins++; }
      else { aTotal++; if (res === "승") aWins++; }
    });
    const presentWinRate = pTotal > 0 ? Math.round((pWins / pTotal) * 100) : 0;
    const absentWinRate = aTotal > 0 ? Math.round((aWins / aTotal) * 100) : 0;
    return { playerId: p.id, name: p.name, presentWinRate, absentWinRate, diff: presentWinRate - absentWinRate, presentMatches: pTotal, absentMatches: aTotal };
  }).filter(d => d.presentMatches >= 3).sort((a, b) => b.diff - a.diff);
}

// ─── Last Quarter Specialist ───
export interface LastQuarterData { playerId: number; name: string; lastQGoals: number; }

export function getLastQuarterSpecialists(players: Player[], matches: Match[], goalEvents: GoalEvent[]): LastQuarterData[] {
  const matchMaxQ = new Map<number, number>();
  goalEvents.forEach(g => { const cur = matchMaxQ.get(g.match_id) || 0; if (g.quarter > cur) matchMaxQ.set(g.match_id, g.quarter); });
  const playerGoals = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal) {
      const maxQ = matchMaxQ.get(g.match_id);
      if (maxQ && g.quarter === maxQ) playerGoals.set(g.goal_player_id, (playerGoals.get(g.goal_player_id) || 0) + 1);
    }
  });
  return [...playerGoals.entries()].map(([pid, count]) => ({ playerId: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, lastQGoals: count })).sort((a, b) => b.lastQGoals - a.lastQGoals).slice(0, 10);
}

// ─── Duo Synergy Win Rate ───
export interface DuoSynergy { p1: number; p2: number; name1: string; name2: string; together: number; wins: number; winRate: number; }

export function getDuoSynergyWinRate(players: Player[], matches: Match[], teams: Team[], results: Result[], rosters: Roster[]): { best: DuoSynergy[]; worst: DuoSynergy[] } {
  const nonCustom = matches.filter(m => !m.is_custom);
  const matchResults = new Map<number, string>();
  nonCustom.forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const r = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (r) matchResults.set(m.id, r.result);
  });
  const duoMap = new Map<string, DuoSynergy>();
  [...matchResults.keys()].forEach(mid => {
    const matchPlayers = [...new Set(rosters.filter(r => r.match_id === mid).map(r => r.player_id))];
    const res = matchResults.get(mid)!;
    for (let i = 0; i < matchPlayers.length; i++) {
      for (let j = i + 1; j < matchPlayers.length; j++) {
        const [a, b] = [Math.min(matchPlayers[i], matchPlayers[j]), Math.max(matchPlayers[i], matchPlayers[j])];
        const key = `${a}-${b}`;
        const duo = duoMap.get(key) || { p1: a, p2: b, name1: players.find(p => p.id === a)?.name || `#${a}`, name2: players.find(p => p.id === b)?.name || `#${b}`, together: 0, wins: 0, winRate: 0 };
        duo.together++;
        if (res === "승") duo.wins++;
        duoMap.set(key, duo);
      }
    }
  });
  const all = [...duoMap.values()].filter(d => d.together >= 5);
  all.forEach(d => { d.winRate = Math.round((d.wins / d.together) * 100); });
  const sorted = [...all].sort((a, b) => b.winRate - a.winRate);
  return { best: sorted.slice(0, 3), worst: [...all].sort((a, b) => a.winRate - b.winRate).slice(0, 3) };
}

// ─── Own Goal Ranking ───
export interface OwnGoalData { playerId: number; name: string; count: number; }

export function getOwnGoalRanking(players: Player[], goalEvents: GoalEvent[]): OwnGoalData[] {
  const map = new Map<number, number>();
  goalEvents.forEach(g => { if (g.is_own_goal && g.goal_player_id) map.set(g.goal_player_id, (map.get(g.goal_player_id) || 0) + 1); });
  return [...map.entries()].map(([pid, count]) => ({ playerId: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, count })).sort((a, b) => b.count - a.count);
}

// ─── Player Badges ───
export interface PlayerBadge { label: string; emoji: string; year?: string; }

export function getPlayerBadges(
  playerId: number, players: Player[], matches: Match[], teams: Team[], results: Result[], rosters: Roster[], goalEvents: GoalEvent[], momVotes?: { match_id: number; voted_player_id: number }[]
): PlayerBadge[] {
  const badges: PlayerBadge[] = [];
  const years = [...new Set(matches.map(m => m.date.slice(0, 4)))].sort();

  const allTimeStats = new Map<number, { goals: number; assists: number; ap: number; appearances: number }>();
  players.forEach(p => {
    const pRosters = rosters.filter(r => r.player_id === p.id);
    const rosterGoals = pRosters.reduce((s, r) => s + (r.goals || 0), 0);
    const rosterAssists = pRosters.reduce((s, r) => s + (r.assists || 0), 0);
    const eventGoals = goalEvents.filter(g => g.goal_player_id === p.id && !g.is_own_goal).length;
    const eventAssists = goalEvents.filter(g => g.assist_player_id === p.id).length;
    const goals = rosterGoals + eventGoals;
    const assists = rosterAssists + eventAssists;
    const appearances = [...new Set(pRosters.map(r => r.match_id))].length;
    allTimeStats.set(p.id, { goals, assists, ap: goals + assists, appearances });
  });

  const allStatsArr = [...allTimeStats.entries()].map(([id, s]) => ({ id, ...s }));
  const topAllGoal = allStatsArr.filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const topAllAssist = allStatsArr.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)[0];
  const topAllAP = allStatsArr.filter(s => s.ap > 0).sort((a, b) => b.ap - a.ap)[0];
  if (topAllGoal && topAllGoal.id === playerId) badges.push({ label: "종합 득점왕", emoji: "👑" });
  if (topAllAssist && topAllAssist.id === playerId) badges.push({ label: "종합 도움왕", emoji: "🏅" });
  if (topAllAP && topAllAP.id === playerId) badges.push({ label: "종합 공포왕", emoji: "💎" });

  if (momVotes && momVotes.length > 0) {
    const momCounts = new Map<number, number>();
    momVotes.forEach(v => momCounts.set(v.voted_player_id, (momCounts.get(v.voted_player_id) || 0) + 1));
    const topMOM = [...momCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topMOM && topMOM[0] === playerId) badges.push({ label: "누적 MOM 1위", emoji: "🌟" });
  }

  for (const year of years) {
    const yearMatches = matches.filter(m => m.date.startsWith(year));
    const yearMatchIds = new Set(yearMatches.map(m => m.id));
    const yearEvents = goalEvents.filter(g => yearMatchIds.has(g.match_id));
    const yearRosters = rosters.filter(r => yearMatchIds.has(r.match_id));

    const playerStats = new Map<number, { goals: number; assists: number; ap: number; appearances: number }>();
    players.forEach(p => {
      const pRosters = yearRosters.filter(r => r.player_id === p.id);
      const rosterGoals = pRosters.reduce((s, r) => s + (r.goals || 0), 0);
      const rosterAssists = pRosters.reduce((s, r) => s + (r.assists || 0), 0);
      const eventGoals = yearEvents.filter(g => g.goal_player_id === p.id && !g.is_own_goal).length;
      const eventAssists = yearEvents.filter(g => g.assist_player_id === p.id).length;
      const goals = rosterGoals + eventGoals;
      const assists = rosterAssists + eventAssists;
      const appearances = [...new Set(pRosters.map(r => r.match_id))].length;
      playerStats.set(p.id, { goals, assists, ap: goals + assists, appearances });
    });

    const allStats = [...playerStats.entries()].map(([id, s]) => ({ id, ...s }));
    const topGoal = allStats.filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)[0];
    const topAssist = allStats.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)[0];
    const topAP = allStats.filter(s => s.ap > 0).sort((a, b) => b.ap - a.ap)[0];
    const topApp = allStats.filter(s => s.appearances > 0).sort((a, b) => b.appearances - a.appearances)[0];

    if (topGoal && topGoal.id === playerId) badges.push({ label: `${year} 득점왕`, emoji: "⚽", year });
    if (topAssist && topAssist.id === playerId) badges.push({ label: `${year} 도움왕`, emoji: "🅰️", year });
    if (topAP && topAP.id === playerId) badges.push({ label: `${year} 공포왕`, emoji: "💥", year });
    if (topApp && topApp.id === playerId) badges.push({ label: `${year} 출석왕`, emoji: "🏟️", year });

    const customMatches = yearMatches.filter(m => m.is_custom);
    const customMatchIds = new Set(customMatches.map(m => m.id));
    const customEvents = goalEvents.filter(g => customMatchIds.has(g.match_id));
    const customRosters = rosters.filter(r => customMatchIds.has(r.match_id));
    const customGoals = new Map<number, number>();
    const customAP = new Map<number, number>();
    customEvents.forEach(g => { if (g.goal_player_id && !g.is_own_goal) customGoals.set(g.goal_player_id, (customGoals.get(g.goal_player_id) || 0) + 1); });
    customRosters.forEach(r => { if (r.goals) customGoals.set(r.player_id, (customGoals.get(r.player_id) || 0) + r.goals); });
    customEvents.forEach(g => {
      if (g.goal_player_id && !g.is_own_goal) customAP.set(g.goal_player_id, (customAP.get(g.goal_player_id) || 0) + 1);
      if (g.assist_player_id) customAP.set(g.assist_player_id, (customAP.get(g.assist_player_id) || 0) + 1);
    });
    customRosters.forEach(r => {
      if (r.goals) customAP.set(r.player_id, (customAP.get(r.player_id) || 0) + r.goals);
      if (r.assists) customAP.set(r.player_id, (customAP.get(r.player_id) || 0) + r.assists);
    });
    const topCustomGoal = [...customGoals.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCustomAP = [...customAP.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCustomGoal && topCustomGoal[0] === playerId && topCustomGoal[1] > 0) badges.push({ label: `${year} 자체전 득점왕`, emoji: "🔥", year });
    if (topCustomAP && topCustomAP[0] === playerId && topCustomAP[1] > 2) badges.push({ label: `${year} 자체전 여포`, emoji: "⚔️", year });
  }

  // Win Fairy / Doom badge
  const nonCustom = matches.filter(m => !m.is_custom);
  const matchResultsMap = new Map<number, string>();
  nonCustom.forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const r = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (r) matchResultsMap.set(m.id, r.result);
  });
  const presentIds = new Set(rosters.filter(r => r.player_id === playerId && matchResultsMap.has(r.match_id)).map(r => r.match_id));
  let pWins = 0, pTotal = presentIds.size;
  presentIds.forEach(mid => { if (matchResultsMap.get(mid) === "승") pWins++; });
  let aWins = 0, aTotal = 0;
  [...matchResultsMap.keys()].forEach(mid => { if (!presentIds.has(mid)) { aTotal++; if (matchResultsMap.get(mid) === "승") aWins++; } });
  const presentWR = pTotal > 0 ? (pWins / pTotal) * 100 : 0;
  const absentWR = aTotal > 0 ? (aWins / aTotal) * 100 : 0;
  if (pTotal >= 5 && presentWR - absentWR >= 15) badges.push({ label: "승리의 부적", emoji: "🧚" });
  if (pTotal >= 5 && absentWR - presentWR >= 15) badges.push({ label: "패배 요정", emoji: "👻" });

  return badges;
}

// ─── Form Guide (최근 5경기 폼) ───
export function getPlayerFormGuide(playerId: number, matches: Match[], rosters: Roster[], goalEvents: GoalEvent[]): { form: "hot" | "cold" | "normal"; recentAP: number; recentGames: number } {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  const recent5 = sortedMatches.slice(0, 5);
  if (recent5.length === 0) return { form: "normal", recentAP: 0, recentGames: 0 };
  const r5Ids = new Set(recent5.map(m => m.id));
  const goals = goalEvents.filter(g => r5Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal).length;
  const assists = goalEvents.filter(g => r5Ids.has(g.match_id) && g.assist_player_id === playerId).length;
  const rGoals = rosters.filter(r => r5Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
  const rAssists = rosters.filter(r => r5Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
  const ap = goals + assists + rGoals + rAssists;
  const avgAP = ap / recent5.length;
  return { form: avgAP >= 2 ? "hot" : avgAP <= 0.4 ? "cold" : "normal", recentAP: ap, recentGames: recent5.length };
}

// ─── Deep Scouting Report (16 Patterns — Weighted Scoring) ───
export interface ScoutingReport {
  trend: "up" | "down" | "stable" | "special";
  comment: string;
  emoji: string;
  label: string;
}

interface PatternDef {
  key: string;
  trend: ScoutingReport["trend"];
  emoji: string;
  label: string;
  comment: string;
}

const PATTERNS: PatternDef[] = [
  { key: "rookie",      trend: "special", emoji: "🐣", label: "특급 루키",       comment: "이제 막 팀에 합류한 신입입니다. 앞으로의 활약을 기대합니다!" },
  { key: "bomber",      trend: "up",      emoji: "🔥", label: "골 폭격기",       comment: "발끝이 아주 뜨겁습니다! 발만 갖다 대도 들어가는 득점 감각." },
  { key: "playmaker",   trend: "up",      emoji: "🎯", label: "플레이메이커",    comment: "팀의 더 브라위너! 동료를 돕는 이타적인 플레이에 눈을 떴습니다." },
  { key: "slow_start",  trend: "up",      emoji: "🚀", label: "슬로우 스타터",   comment: "시즌 초반의 끔찍한 부진을 씻고 완벽하게 부활했습니다." },
  { key: "aging",       trend: "down",    emoji: "📉", label: "에이징 커브",     comment: "전반기의 폭격기는 어디 가고 침묵 중입니다. 에이징 커브가 의심됩니다." },
  { key: "steady",      trend: "stable",  emoji: "🍚", label: "국밥형 상수",     comment: "비가 오나 눈이 오나 자기 몫은 해내는 든든한 국밥형 플레이어." },
  { key: "zero",        trend: "down",    emoji: "🌧️", label: "영점 조절 실패",  comment: "경기장엔 늘 있지만 영점이 심하게 흔들립니다. 굿을 해야 합니다." },
  { key: "pokemon",     trend: "special", emoji: "👻", label: "전설의 포켓몬",   comment: "실존 인물인지 의심받고 있습니다. 제발 얼굴 좀 비춰주세요!" },
  { key: "spy",         trend: "down",    emoji: "🤦‍♂️", label: "상대팀의 스파이", comment: "최근 골망을 흔들었지만 불행히도 우리 팀 골대였습니다." },
  { key: "totem",       trend: "up",      emoji: "🍀", label: "인간 승리 토템",  comment: "기록지에 보이지 않는 아우라. 경기장에 서 있는 것만으로 승리를 부르는 토템입니다." },
  { key: "doom",        trend: "down",    emoji: "🧂", label: "패배 요정",       comment: "폼은 둘째치고 출전 날마다 팀이 고전합니다. 터가 안 맞을지도 모릅니다." },
  { key: "greedy",      trend: "special", emoji: "🤑", label: "탐욕의 항아리",   comment: "패스(X) 버튼이 고장 난 것이 분명합니다. 오직 골대만 바라보는 상남자." },
  { key: "clutch",      trend: "up",      emoji: "🦸‍♂️", label: "클러치 장인",    comment: "위태로울 때 빛나는 진정한 에이스. 벼랑 끝에서 팀을 구하는 해결사." },
  { key: "padder",      trend: "stable",  emoji: "🧽", label: "스탯 세탁기",     comment: "승부가 기울면 날카로워집니다. 빈집 털기의 스페셜리스트!" },
  { key: "unsung",      trend: "stable",  emoji: "🫀", label: "언성 히어로",     comment: "피치 위에서 가장 많은 땀을 흘리는 팀의 심장입니다." },
  { key: "iron",        trend: "stable",  emoji: "🤖", label: "철강왕",          comment: "지치지 않는 체력과 출석률! 풋살장 지박령이 의심되는 진정한 철인." },
];

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function lerp(value: number, lo: number, hi: number) { if (hi === lo) return value >= hi ? 100 : 0; return clamp(((value - lo) / (hi - lo)) * 100); }

export function getDeepScoutingReport(
  playerId: number,
  players: Player[],
  matches: Match[],
  teams: Team[],
  results: Result[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  momVotes?: { match_id: number; voted_player_id: number }[]
): ScoutingReport {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  const totalApp = sortedMatches.length;

  // Hard override: rookie < 3 games
  if (totalApp < 3) {
    const p = PATTERNS.find(p => p.key === "rookie")!;
    return { trend: p.trend, emoji: p.emoji, label: p.label, comment: p.comment };
  }

  // ── Helpers ──
  const getGoalsForSet = (mids: Set<number>) => {
    const ev = goalEvents.filter(e => mids.has(e.match_id) && e.goal_player_id === playerId && !e.is_own_goal).length;
    const ro = rosters.filter(r => mids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
    return ev + ro;
  };
  const getAssistsForSet = (mids: Set<number>) => {
    const ev = goalEvents.filter(e => mids.has(e.match_id) && e.assist_player_id === playerId).length;
    const ro = rosters.filter(r => mids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
    return ev + ro;
  };
  const getAPForSet = (mids: Set<number>) => getGoalsForSet(mids) + getAssistsForSet(mids);

  const allIds = new Set(sortedMatches.map(m => m.id));
  const totalGoals = getGoalsForSet(allIds);
  const totalAssists = getAssistsForSet(allIds);
  const totalAP = totalGoals + totalAssists;
  const gpg = totalGoals / totalApp;
  const apg = totalAssists / totalApp;

  // Recent 5
  const recent5 = sortedMatches.slice(0, Math.min(5, totalApp));
  const r5Ids = new Set(recent5.map(m => m.id));
  const r5Goals = getGoalsForSet(r5Ids);
  const r5Assists = getAssistsForSet(r5Ids);
  const r5GPG = r5Goals / recent5.length;
  const r5APG = r5Assists / recent5.length;

  // Half-season
  const half = Math.floor(totalApp / 2);
  const firstHalfIds = new Set(sortedMatches.slice(half).map(m => m.id)); // older
  const secondHalfIds = new Set(sortedMatches.slice(0, half).map(m => m.id)); // recent
  const fhLen = totalApp - half;
  const shLen = half;
  const firstHalfAPG = fhLen > 0 ? getAPForSet(firstHalfIds) / fhLen : 0;
  const secondHalfAPG = shLen > 0 ? getAPForSet(secondHalfIds) / shLen : 0;
  const apTrendDiff = secondHalfAPG - firstHalfAPG;

  // Attendance & Win Rate
  const nonCustom = matches.filter(m => !m.is_custom);
  const totalNonCustom = nonCustom.length;
  const matchResultsMap = new Map<number, string>();
  nonCustom.forEach(m => {
    const mTeams = teams.filter(t => t.match_id === m.id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const r = results.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
    if (r) matchResultsMap.set(m.id, r.result);
  });
  const presentNCIds = new Set(rosters.filter(r => r.player_id === playerId && matchResultsMap.has(r.match_id)).map(r => r.match_id));
  const attendanceRate = totalNonCustom > 0 ? (presentNCIds.size / totalNonCustom) * 100 : 50;
  let pWins = 0;
  presentNCIds.forEach(mid => { if (matchResultsMap.get(mid) === "승") pWins++; });
  const presentWR = presentNCIds.size > 0 ? (pWins / presentNCIds.size) * 100 : 50;
  let aWins = 0, aTotal = 0;
  [...matchResultsMap.keys()].forEach(mid => { if (!presentNCIds.has(mid)) { aTotal++; if (matchResultsMap.get(mid) === "승") aWins++; } });
  const absentWR = aTotal > 0 ? (aWins / aTotal) * 100 : 50;
  const wrDiff = presentWR - absentWR;

  // Own goals (recent 5)
  const r5OwnGoals = goalEvents.filter(e => r5Ids.has(e.match_id) && e.is_own_goal && e.goal_player_id === playerId).length;

  // Clutch / Padding analysis
  let clutchGoals = 0, paddingGoals = 0, totalScoredGoals = 0;
  goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).forEach(g => {
    totalScoredGoals++;
    const matchEvents = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
    const mTeams = teams.filter(t => t.match_id === g.match_id);
    const ourTeam = mTeams.find(t => t.is_ours);
    if (!ourTeam) return;
    const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
    let ourScore = 0, oppScore = 0;
    matchEvents.forEach(e => {
      if (e.is_own_goal) { oppScore++; }
      else if (ourTeamIds.has(e.team_id)) { ourScore++; }
      else { oppScore++; }
    });
    const diff = ourScore - oppScore;
    if (diff >= 3) paddingGoals++;
    else if (Math.abs(diff) <= 1) clutchGoals++;
  });
  const clutchRatio = totalScoredGoals > 0 ? clutchGoals / totalScoredGoals : 0;
  const paddingRatio = totalScoredGoals > 0 ? paddingGoals / totalScoredGoals : 0;

  // Greedy ratio: goals vs assists ratio
  const greedyRatio = totalAP > 0 ? totalGoals / totalAP : 0.5; // 1 = only goals, 0 = only assists

  // Per-match goal variance (for "dice" style check)
  const goalsPerMatch = sortedMatches.map(m => {
    const mSet = new Set([m.id]);
    return getGoalsForSet(mSet);
  });
  const gpgMean = goalsPerMatch.reduce((a, b) => a + b, 0) / goalsPerMatch.length;
  const gpgStd = Math.sqrt(goalsPerMatch.reduce((s, g) => s + (g - gpgMean) ** 2, 0) / goalsPerMatch.length);

  // MOM count for this player
  const momCount = momVotes ? momVotes.filter(v => v.voted_player_id === playerId).length : 0;

  // ── Score each pattern ──
  const scores = new Map<string, number>();

  // 1. 골 폭격기: recent GPG high, weighted 70% recent + 30% overall
  scores.set("bomber", (() => {
    const recentScore = lerp(r5GPG, 1.0, 3.0);
    const overallScore = lerp(gpg, 0.8, 2.5);
    return recentScore * 0.7 + overallScore * 0.3;
  })());

  // 2. 플레이메이커: recent assist PG high
  scores.set("playmaker", (() => {
    const recentScore = lerp(r5APG, 1.0, 2.5);
    const overallScore = lerp(apg, 0.6, 2.0);
    const lowGoalBonus = greedyRatio < 0.4 ? 15 : 0; // more assists than goals = bonus
    return recentScore * 0.7 + overallScore * 0.3 + lowGoalBonus;
  })());

  // 3. 슬로우 스타터: first half bad, second half good
  scores.set("slow_start", (() => {
    if (half < 3) return 0;
    const badFirst = lerp(0.5 - firstHalfAPG, 0, 0.5) * 0.4; // first half AP < 0.5
    const goodRecent = lerp(apTrendDiff, 0.5, 2.0) * 0.6;
    return clamp(badFirst + goodRecent);
  })());

  // 4. 에이징 커브: first half good, recent bad
  scores.set("aging", (() => {
    if (half < 3) return 0;
    const goodFirst = lerp(firstHalfAPG, 0.8, 2.0) * 0.4;
    const decline = lerp(-apTrendDiff, 0.5, 2.0) * 0.6;
    return clamp(goodFirst + decline);
  })());

  // 5. 국밥형 상수: consistent, decent attendance, moderate stats
  scores.set("steady", (() => {
    const consistencyScore = lerp(1.5 - gpgStd, 0, 1.5); // low variance = good
    const decentAP = gpg + apg >= 0.3 ? lerp(gpg + apg, 0.3, 1.5) * 0.3 : 0;
    const attendScore = lerp(attendanceRate, 40, 70) * 0.2;
    const noExtremeTrend = Math.abs(apTrendDiff) < 0.8 ? 20 : 0;
    return consistencyScore * 0.5 + decentAP + attendScore + noExtremeTrend;
  })());

  // 6. 영점 조절 실패: high attendance, very low production
  scores.set("zero", (() => {
    if (totalApp < 5) return 0;
    const highAttend = lerp(attendanceRate, 40, 70) * 0.3;
    const lowProd = lerp(0.5 - (gpg + apg), 0, 0.5) * 0.7;
    return clamp(highAttend + lowProd);
  })());

  // 7. 전설의 포켓몬: extremely low attendance
  scores.set("pokemon", (() => {
    if (totalNonCustom < 8) return 0;
    return lerp(25 - attendanceRate, 0, 25);
  })());

  // 8. 상대팀의 스파이: recent own goals
  scores.set("spy", (() => {
    if (r5OwnGoals === 0) return 0;
    return clamp(r5OwnGoals >= 2 ? 90 : r5OwnGoals >= 1 ? 50 : 0);
  })());

  // 9. 인간 승리 토템: big positive WR diff
  scores.set("totem", (() => {
    if (presentNCIds.size < 5) return 0;
    return lerp(wrDiff, 10, 30);
  })());

  // 10. 패배 요정: big negative WR diff
  scores.set("doom", (() => {
    if (presentNCIds.size < 5) return 0;
    return lerp(-wrDiff, 10, 30);
  })());

  // 11. 탐욕의 항아리: extremely high goal ratio, very low assists
  scores.set("greedy", (() => {
    if (totalGoals < 5) return 0;
    const ratioScore = lerp(greedyRatio, 0.85, 1.0); // need 85%+ goals in AP
    const lowAssistScore = totalAssists <= 1 ? 30 : totalAssists <= 3 ? 10 : 0;
    return clamp(ratioScore * 0.7 + lowAssistScore);
  })());

  // 12. 클러치 장인: clutch goal ratio >= 50%, min 3 scored
  scores.set("clutch", (() => {
    if (totalScoredGoals < 3) return 0;
    const ratioScore = lerp(clutchRatio, 0.35, 0.7);
    const recentClutch = (() => {
      let rc = 0;
      goalEvents.filter(g => r5Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal).forEach(g => {
        const matchEvents = goalEvents.filter(e => e.match_id === g.match_id && (e.quarter < g.quarter || (e.quarter === g.quarter && e.id < g.id)));
        const mTeams = teams.filter(t => t.match_id === g.match_id);
        const ourTeam = mTeams.find(t => t.is_ours);
        if (!ourTeam) return;
        const ourTeamIds = new Set(mTeams.filter(t => t.is_ours).map(t => t.id));
        let os = 0, ops = 0;
        matchEvents.forEach(e => { if (e.is_own_goal) ops++; else if (ourTeamIds.has(e.team_id)) os++; else ops++; });
        if (Math.abs(os - ops) <= 1) rc++;
      });
      return rc;
    })();
    const recentBonus = lerp(recentClutch, 0, 3) * 0.3;
    return ratioScore * 0.7 + recentBonus;
  })());

  // 13. 스탯 세탁기: padding goal ratio >= 60%, min 3 scored
  scores.set("padder", (() => {
    if (totalScoredGoals < 3) return 0;
    return lerp(paddingRatio, 0.4, 0.8);
  })());

  // 14. 언성 히어로: decent attendance, low stats, MOM consideration
  scores.set("unsung", (() => {
    if (totalApp < 4) return 0;
    const attendBonus = lerp(attendanceRate, 40, 70) * 0.3;
    const modestStats = gpg < 1.0 && apg < 1.0 ? 30 : 0;
    const momBonus = momCount >= 2 ? 20 : momCount >= 1 ? 10 : 0;
    const lowFlash = totalGoals < totalApp * 0.8 ? 10 : 0;
    return clamp(attendBonus + modestStats + momBonus + lowFlash);
  })());

  // 15. 철강왕: very high attendance
  scores.set("iron", (() => {
    if (totalNonCustom < 8) return 0;
    return lerp(attendanceRate, 60, 90);
  })());

  // ── Find winner ──
  let bestKey = "steady";
  let bestScore = -1;
  scores.forEach((score, key) => {
    if (score > bestScore) { bestScore = score; bestKey = key; }
  });

  const pattern = PATTERNS.find(p => p.key === bestKey) || PATTERNS.find(p => p.key === "steady")!;
  return { trend: pattern.trend, emoji: pattern.emoji, label: pattern.label, comment: pattern.comment };
}

// Keep old function for backward compat
export function getScoutingReport(playerId: number, matches: Match[], rosters: Roster[], goalEvents: GoalEvent[]): { trend: "up" | "down" | "stable"; comment: string } {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => a.date.localeCompare(b.date));
  if (sortedMatches.length < 6) return { trend: "stable", comment: "아직 데이터가 부족합니다." };
  const half = Math.floor(sortedMatches.length / 2);
  const firstHalf = new Set(sortedMatches.slice(0, half).map(m => m.id));
  const secondHalf = new Set(sortedMatches.slice(half).map(m => m.id));
  const getAP = (mids: Set<number>) => {
    const g = goalEvents.filter(e => mids.has(e.match_id) && e.goal_player_id === playerId && !e.is_own_goal).length;
    const a = goalEvents.filter(e => mids.has(e.match_id) && e.assist_player_id === playerId).length;
    const rg = rosters.filter(r => mids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
    const ra = rosters.filter(r => mids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
    return g + a + rg + ra;
  };
  const firstAP = getAP(firstHalf) / half;
  const secondAP = getAP(secondHalf) / (sortedMatches.length - half);
  const diff = secondAP - firstAP;
  if (diff > 0.5) return { trend: "up", comment: "최근 폼이 절정입니다! 득점 감각에 물이 올랐습니다. 🔥" };
  if (diff < -0.5) return { trend: "down", comment: "상반기의 폼을 잃어버렸습니다. 에이징 커브가 의심됩니다. 📉" };
  return { trend: "stable", comment: "기복 없는 국밥형 플레이어. 팀의 든든한 기둥입니다. 🍚" };
}

// ─── Variance Badge ───
export function getVarianceBadge(playerId: number, matches: Match[], rosters: Roster[], goalEvents: GoalEvent[]): PlayerBadge[] {
  const badges: PlayerBadge[] = [];
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  if (sortedMatches.length >= 5) {
    const goalsPerMatch = sortedMatches.map(m => {
      const g = goalEvents.filter(e => e.match_id === m.id && e.goal_player_id === playerId && !e.is_own_goal).length;
      const rg = rosters.filter(r => r.match_id === m.id && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
      return g + rg;
    });
    const mean = goalsPerMatch.reduce((a, b) => a + b, 0) / goalsPerMatch.length;
    const variance = goalsPerMatch.reduce((s, g) => s + (g - mean) ** 2, 0) / goalsPerMatch.length;
    if (Math.sqrt(variance) > 1.5 && mean > 0.5) badges.push({ label: "주사위형 선수", emoji: "🎲" });
  }
  const recent3 = sortedMatches.slice(0, 3);
  if (recent3.length === 3) {
    const r3Ids = new Set(recent3.map(m => m.id));
    const g = goalEvents.filter(e => r3Ids.has(e.match_id) && e.goal_player_id === playerId && !e.is_own_goal).length;
    const a = goalEvents.filter(e => r3Ids.has(e.match_id) && e.assist_player_id === playerId).length;
    const rg = rosters.filter(r => r3Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
    const ra = rosters.filter(r => r3Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
    if (g + a + rg + ra === 0) badges.push({ label: "폼 저하 및 방출 위기", emoji: "🚨" });
  }
  if (recent3.length > 0) {
    const r3Ids = new Set(recent3.map(m => m.id));
    for (const mid of r3Ids) {
      const g = goalEvents.filter(e => e.match_id === mid && e.goal_player_id === playerId && !e.is_own_goal).length;
      const rg = rosters.filter(r => r.match_id === mid && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
      if (g + rg >= 3) { badges.push({ label: "까방권 보유", emoji: "🛡️" }); break; }
    }
  }
  return badges;
}

// ─── Hall of Fame ───
export interface HallOfFameEntry { playerId: number; name: string; matchId: number; date: string; goals: number; assists: number; type: "hattrick" | "playmaker"; }

export function getHallOfFame(players: Player[], matches: Match[], rosters: Roster[], goalEvents: GoalEvent[]): HallOfFameEntry[] {
  const entries: HallOfFameEntry[] = [];
  const matchIds = [...new Set(goalEvents.map(g => g.match_id))];
  for (const mid of matchIds) {
    const match = matches.find(m => m.id === mid);
    if (!match) continue;
    const goalsMap = new Map<number, number>();
    const assistsMap = new Map<number, number>();
    goalEvents.filter(g => g.match_id === mid).forEach(g => {
      if (g.goal_player_id && !g.is_own_goal) goalsMap.set(g.goal_player_id, (goalsMap.get(g.goal_player_id) || 0) + 1);
      if (g.assist_player_id) assistsMap.set(g.assist_player_id, (assistsMap.get(g.assist_player_id) || 0) + 1);
    });
    rosters.filter(r => r.match_id === mid).forEach(r => {
      if (r.goals) goalsMap.set(r.player_id, (goalsMap.get(r.player_id) || 0) + r.goals);
      if (r.assists) assistsMap.set(r.player_id, (assistsMap.get(r.player_id) || 0) + r.assists);
    });
    goalsMap.forEach((goals, pid) => {
      if (goals >= 3) {
        const p = players.find(p => p.id === pid);
        entries.push({ playerId: pid, name: p?.name || `#${pid}`, matchId: mid, date: match.date, goals, assists: assistsMap.get(pid) || 0, type: "hattrick" });
      }
    });
    assistsMap.forEach((assists, pid) => {
      if (assists >= 3) {
        const p = players.find(p => p.id === pid);
        if (!entries.find(e => e.playerId === pid && e.matchId === mid && e.type === "hattrick")) {
          entries.push({ playerId: pid, name: p?.name || `#${pid}`, matchId: mid, date: match.date, goals: goalsMap.get(pid) || 0, assists, type: "playmaker" });
        }
      }
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── MOM Count ───
export function getMOMRanking(players: Player[], momVotes: { match_id: number; voted_player_id: number }[]): { playerId: number; name: string; count: number }[] {
  const map = new Map<number, number>();
  const matchVotes = new Map<number, Map<number, number>>();
  momVotes.forEach(v => {
    if (!matchVotes.has(v.match_id)) matchVotes.set(v.match_id, new Map());
    const mv = matchVotes.get(v.match_id)!;
    mv.set(v.voted_player_id, (mv.get(v.voted_player_id) || 0) + 1);
  });
  matchVotes.forEach((votes) => {
    const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) { map.set(sorted[0][0], (map.get(sorted[0][0]) || 0) + 1); }
  });
  return [...map.entries()].map(([pid, count]) => ({ playerId: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, count })).sort((a, b) => b.count - a.count);
}
