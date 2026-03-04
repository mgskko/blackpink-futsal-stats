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
  // Only non-custom matches
  const nonCustom = matches.filter(m => !m.is_custom);
  const matchResults = new Map<number, string>(); // matchId -> "승" | "패" | "무"
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
      if (presentMatchIds.has(mid)) {
        pTotal++;
        if (res === "승") pWins++;
      } else {
        aTotal++;
        if (res === "승") aWins++;
      }
    });
    const presentWinRate = pTotal > 0 ? Math.round((pWins / pTotal) * 100) : 0;
    const absentWinRate = aTotal > 0 ? Math.round((aWins / aTotal) * 100) : 0;
    return { playerId: p.id, name: p.name, presentWinRate, absentWinRate, diff: presentWinRate - absentWinRate, presentMatches: pTotal, absentMatches: aTotal };
  }).filter(d => d.presentMatches >= 3).sort((a, b) => b.diff - a.diff);
}

// ─── Last Quarter Specialist ───
export interface LastQuarterData {
  playerId: number;
  name: string;
  lastQGoals: number;
}

export function getLastQuarterSpecialists(players: Player[], matches: Match[], goalEvents: GoalEvent[]): LastQuarterData[] {
  // For each match, find the max quarter
  const matchMaxQ = new Map<number, number>();
  goalEvents.forEach(g => {
    const cur = matchMaxQ.get(g.match_id) || 0;
    if (g.quarter > cur) matchMaxQ.set(g.match_id, g.quarter);
  });

  const playerGoals = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.goal_player_id && !g.is_own_goal) {
      const maxQ = matchMaxQ.get(g.match_id);
      if (maxQ && g.quarter === maxQ) {
        playerGoals.set(g.goal_player_id, (playerGoals.get(g.goal_player_id) || 0) + 1);
      }
    }
  });

  return [...playerGoals.entries()]
    .map(([pid, count]) => {
      const p = players.find(p => p.id === pid);
      return { playerId: pid, name: p?.name || `#${pid}`, lastQGoals: count };
    })
    .sort((a, b) => b.lastQGoals - a.lastQGoals)
    .slice(0, 10);
}

// ─── Duo Synergy Win Rate ───
export interface DuoSynergy {
  p1: number;
  p2: number;
  name1: string;
  name2: string;
  together: number;
  wins: number;
  winRate: number;
}

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

  const activePlayers = players.filter(p => p.is_active);
  const duoMap = new Map<string, DuoSynergy>();

  const matchIds = [...matchResults.keys()];
  matchIds.forEach(mid => {
    const matchPlayers = [...new Set(rosters.filter(r => r.match_id === mid).map(r => r.player_id))];
    const res = matchResults.get(mid)!;
    for (let i = 0; i < matchPlayers.length; i++) {
      for (let j = i + 1; j < matchPlayers.length; j++) {
        const [a, b] = [Math.min(matchPlayers[i], matchPlayers[j]), Math.max(matchPlayers[i], matchPlayers[j])];
        const key = `${a}-${b}`;
        const duo = duoMap.get(key) || {
          p1: a, p2: b,
          name1: activePlayers.find(p => p.id === a)?.name || `#${a}`,
          name2: activePlayers.find(p => p.id === b)?.name || `#${b}`,
          together: 0, wins: 0, winRate: 0
        };
        duo.together++;
        if (res === "승") duo.wins++;
        duoMap.set(key, duo);
      }
    }
  });

  const all = [...duoMap.values()].filter(d => d.together >= 5);
  all.forEach(d => { d.winRate = Math.round((d.wins / d.together) * 100); });
  const sorted = [...all].sort((a, b) => b.winRate - a.winRate);
  return {
    best: sorted.slice(0, 3),
    worst: [...all].sort((a, b) => a.winRate - b.winRate).slice(0, 3),
  };
}

// ─── Own Goal Ranking ───
export interface OwnGoalData {
  playerId: number;
  name: string;
  count: number;
}

export function getOwnGoalRanking(players: Player[], goalEvents: GoalEvent[]): OwnGoalData[] {
  const map = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.is_own_goal && g.goal_player_id) {
      map.set(g.goal_player_id, (map.get(g.goal_player_id) || 0) + 1);
    }
  });
  return [...map.entries()]
    .map(([pid, count]) => ({ playerId: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Player Badges ───
export interface PlayerBadge {
  label: string;
  emoji: string;
  year?: string;
}

export function getPlayerBadges(
  playerId: number, players: Player[], matches: Match[], teams: Team[], results: Result[], rosters: Roster[], goalEvents: GoalEvent[]
): PlayerBadge[] {
  const badges: PlayerBadge[] = [];
  const years = [...new Set(matches.map(m => m.date.slice(0, 4)))].sort();

  for (const year of years) {
    const yearMatches = matches.filter(m => m.date.startsWith(year));
    const yearMatchIds = new Set(yearMatches.map(m => m.id));
    const yearEvents = goalEvents.filter(g => yearMatchIds.has(g.match_id));
    const yearRosters = rosters.filter(r => yearMatchIds.has(r.match_id));

    // Calculate goals/assists for all players this year
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

    // Custom match badges
    const customMatches = yearMatches.filter(m => m.is_custom);
    const customMatchIds = new Set(customMatches.map(m => m.id));
    const customEvents = goalEvents.filter(g => customMatchIds.has(g.match_id));
    const customRosters = rosters.filter(r => customMatchIds.has(r.match_id));

    const customGoals = new Map<number, number>();
    const customAP = new Map<number, number>();
    customEvents.forEach(g => {
      if (g.goal_player_id && !g.is_own_goal) customGoals.set(g.goal_player_id, (customGoals.get(g.goal_player_id) || 0) + 1);
    });
    customRosters.forEach(r => {
      if (r.goals) customGoals.set(r.player_id, (customGoals.get(r.player_id) || 0) + r.goals);
    });
    // AP for custom
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
  const allMatchIds = [...matchResultsMap.keys()];
  const presentIds = new Set(rosters.filter(r => r.player_id === playerId && matchResultsMap.has(r.match_id)).map(r => r.match_id));
  let pWins = 0, pTotal = presentIds.size;
  presentIds.forEach(mid => { if (matchResultsMap.get(mid) === "승") pWins++; });
  let aWins = 0, aTotal = 0;
  allMatchIds.forEach(mid => {
    if (!presentIds.has(mid)) { aTotal++; if (matchResultsMap.get(mid) === "승") aWins++; }
  });
  const presentWR = pTotal > 0 ? (pWins / pTotal) * 100 : 0;
  const absentWR = aTotal > 0 ? (aWins / aTotal) * 100 : 0;
  if (pTotal >= 5 && presentWR - absentWR >= 15) badges.push({ label: "승리의 부적", emoji: "🧚" });
  if (pTotal >= 5 && absentWR - presentWR >= 15) badges.push({ label: "패배 요정", emoji: "👻" });

  return badges;
}
