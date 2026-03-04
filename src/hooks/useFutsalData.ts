import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Player { id: number; name: string; is_active: boolean; join_date: string; }
export interface Venue { id: number; name: string; }
export interface Match { id: number; date: string; venue_id: number; match_type: string; is_custom: boolean; has_detail_log: boolean; }
export interface Team { id: number; match_id: number; name: string; is_ours: boolean; }
export interface Result { id: number; team_id: number; match_id: number; result: string; score_for: number | null; score_against: number | null; }
export interface Roster { id: number; match_id: number; team_id: number; player_id: number; goals: number; assists: number; }
export interface GoalEvent { id: number; match_id: number; team_id: number; quarter: number; goal_player_id: number | null; assist_player_id: number | null; is_own_goal: boolean; }

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as T[];
}

export function usePlayers() {
  return useQuery({ queryKey: ["players"], queryFn: () => fetchAll<Player>("players") });
}
export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: () => fetchAll<Venue>("venues") });
}
export function useMatches() {
  return useQuery({ queryKey: ["matches"], queryFn: () => fetchAll<Match>("matches") });
}
export function useTeams() {
  return useQuery({ queryKey: ["teams"], queryFn: () => fetchAll<Team>("teams") });
}
export function useResults() {
  return useQuery({ queryKey: ["results"], queryFn: () => fetchAll<Result>("results") });
}
export function useRosters() {
  return useQuery({ queryKey: ["rosters"], queryFn: () => fetchAll<Roster>("rosters") });
}
export function useGoalEvents() {
  return useQuery({ queryKey: ["goal_events"], queryFn: () => fetchAll<GoalEvent>("goal_events") });
}

export function useAllFutsalData() {
  const players = usePlayers();
  const venues = useVenues();
  const matches = useMatches();
  const teams = useTeams();
  const results = useResults();
  const rosters = useRosters();
  const goalEvents = useGoalEvents();

  const isLoading = players.isLoading || venues.isLoading || matches.isLoading || teams.isLoading || results.isLoading || rosters.isLoading || goalEvents.isLoading;

  return {
    players: players.data ?? [],
    venues: venues.data ?? [],
    matches: matches.data ?? [],
    teams: teams.data ?? [],
    results: results.data ?? [],
    rosters: rosters.data ?? [],
    goalEvents: goalEvents.data ?? [],
    isLoading,
  };
}

// Helper functions that work with loaded data
export function getPlayerName(players: Player[], id: number): string {
  return players.find(p => p.id === id)?.name ?? `선수#${id}`;
}

export function getVenueName(venues: Venue[], id: number): string {
  return venues.find(v => v.id === id)?.name ?? "미정";
}

export function getMatchResult(teams: Team[], results: Result[], matchId: number) {
  const matchTeams = teams.filter(t => t.match_id === matchId);
  const ourTeam = matchTeams.find(t => t.is_ours && t.name === "버니즈") || matchTeams.find(t => t.is_ours);
  const opponentTeam = matchTeams.find(t => !t.is_ours) || matchTeams.find(t => t.id !== ourTeam?.id);
  if (!ourTeam || !opponentTeam) return null;

  const ourResult = results.find(r => r.team_id === ourTeam.id && r.match_id === matchId);
  const opponentResult = results.find(r => r.team_id === opponentTeam.id && r.match_id === matchId);
  if (!ourResult || !opponentResult) return null;

  return { ourTeam, opponentTeam, ourResult, opponentResult };
}

export function getMatchTeams(teams: Team[], matchId: number): Team[] {
  return teams.filter(t => t.match_id === matchId);
}

export function getMatchRoster(rosters: Roster[], matchId: number): Roster[] {
  return rosters.filter(r => r.match_id === matchId);
}

export function getMatchGoalEvents(goalEvents: GoalEvent[], matchId: number): GoalEvent[] {
  return goalEvents.filter(g => g.match_id === matchId);
}

export function getPlayerStats(players: Player[], matches: Match[], teams: Team[], results: Result[], rosters: Roster[], goalEvents: GoalEvent[], playerId: number) {
  const goalsFromEvents = goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).length;
  const assistsFromEvents = goalEvents.filter(g => g.assist_player_id === playerId).length;

  const rosterGoals = rosters
    .filter(r => r.player_id === playerId && r.goals)
    .reduce((sum, r) => sum + (r.goals || 0), 0);
  const rosterAssists = rosters
    .filter(r => r.player_id === playerId && r.assists)
    .reduce((sum, r) => sum + (r.assists || 0), 0);

  const goals = goalsFromEvents + rosterGoals;
  const assists = assistsFromEvents + rosterAssists;
  const appearances = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))].length;

  const playerRosters = rosters.filter(r => r.player_id === playerId);
  let wins = 0, losses = 0, draws = 0;

  const matchIds = [...new Set(playerRosters.map(r => r.match_id))];
  matchIds.forEach(matchId => {
    const playerTeamIds = playerRosters.filter(r => r.match_id === matchId).map(r => r.team_id);
    playerTeamIds.forEach(teamId => {
      const result = results.find(r => r.team_id === teamId && r.match_id === matchId);
      if (result) {
        if (result.result === "승") wins++;
        else if (result.result === "패") losses++;
        else draws++;
      }
    });
  });

  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return { goals, assists, attackPoints: goals + assists, appearances, wins, losses, draws, winRate };
}

export function getPlayerBestAPMatch(matches: Match[], rosters: Roster[], goalEvents: GoalEvent[], playerId: number) {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  let best: { matchId: number; goals: number; assists: number; ap: number; date: string } | null = null;

  playerMatchIds.forEach(matchId => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    let g = 0, a = 0;
    if (match.has_detail_log) {
      g = goalEvents.filter(e => e.match_id === matchId && e.goal_player_id === playerId && !e.is_own_goal).length;
      a = goalEvents.filter(e => e.match_id === matchId && e.assist_player_id === playerId).length;
    } else {
      const r = rosters.find(r => r.match_id === matchId && r.player_id === playerId);
      g = r?.goals || 0;
      a = r?.assists || 0;
    }
    const ap = g + a;
    if (!best || ap > best.ap) {
      best = { matchId, goals: g, assists: a, ap, date: match.date };
    }
  });
  return best;
}

export function getPlayerAssistGiven(goalEvents: GoalEvent[], playerId: number, topN = 7) {
  const map = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.assist_player_id === playerId && g.goal_player_id && !g.is_own_goal) {
      map.set(g.goal_player_id, (map.get(g.goal_player_id) || 0) + 1);
    }
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([partnerId, count]) => ({ partnerId, count }));
}

export function getPlayerAssistReceived(goalEvents: GoalEvent[], playerId: number, topN = 7) {
  const map = new Map<number, number>();
  goalEvents.forEach(g => {
    if (g.goal_player_id === playerId && g.assist_player_id && !g.is_own_goal) {
      map.set(g.assist_player_id, (map.get(g.assist_player_id) || 0) + 1);
    }
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([partnerId, count]) => ({ partnerId, count }));
}

export function getDeadlyDuos(goalEvents: GoalEvent[], topN = 10) {
  const duoMap = new Map<string, { p1: number; p2: number; count: number }>();
  goalEvents.forEach(g => {
    if (g.goal_player_id && g.assist_player_id && !g.is_own_goal) {
      const key = [Math.min(g.goal_player_id, g.assist_player_id), Math.max(g.goal_player_id, g.assist_player_id)].join("-");
      const existing = duoMap.get(key);
      if (existing) existing.count++;
      else duoMap.set(key, { p1: Math.min(g.goal_player_id, g.assist_player_id), p2: Math.max(g.goal_player_id, g.assist_player_id), count: 1 });
    }
  });
  return [...duoMap.values()].sort((a, b) => b.count - a.count).slice(0, topN);
}

export function getQuarterGoalDistribution(goalEvents: GoalEvent[]) {
  const dist: Record<number, number> = {};
  goalEvents.forEach(g => { dist[g.quarter] = (dist[g.quarter] || 0) + 1; });
  return Object.entries(dist).map(([q, count]) => ({ quarter: Number(q), count })).sort((a, b) => a.quarter - b.quarter);
}
