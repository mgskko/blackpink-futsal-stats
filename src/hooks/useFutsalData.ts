import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Player { id: number; name: string; is_active: boolean; join_date: string; back_number: number | null; profile_image_url: string | null; }
export interface Venue { id: number; name: string; }
export interface Match { id: number; date: string; venue_id: number; match_type: string; is_custom: boolean; has_detail_log: boolean; youtube_link: string | null; }
export interface Team { id: number; match_id: number; name: string; is_ours: boolean; original_age_desc: string | null; age_category: string | null; }
export interface Result { id: number; team_id: number; match_id: number; result: string; score_for: number | null; score_against: number | null; }
export interface Roster { id: number; match_id: number; team_id: number; player_id: number; goals: number; assists: number; }
export interface GoalEvent { id: number; match_id: number; team_id: number; quarter: number; goal_player_id: number | null; assist_player_id: number | null; is_own_goal: boolean; video_timestamp: string | null; assist_type: string | null; goal_type: string | null; build_up_process: string | null; }
export interface MatchQuarter { id: number; match_id: number; quarter: number; score_for: number; score_against: number; lineup: any; }

async function fetchAll<T>(table: string): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabase as any).from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
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

export function useMatchQuarters(matchId: number) {
  return useQuery({
    queryKey: ["match_quarters", matchId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("match_quarters").select("*").eq("match_id", matchId).order("quarter");
      if (error) throw error;
      return (data ?? []) as MatchQuarter[];
    },
    enabled: !!matchId,
  });
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

// ─── CORE FIX: Non-duplicating AP computation ───
// For matches with has_detail_log=true, use goal_events only.
// For matches without, use rosters only.
export function computeNonDuplicatedAP(
  playerId: number,
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  filterMatchIds?: Set<number>
): { goals: number; assists: number } {
  let goals = 0, assists = 0;
  const detailMatchIds = new Set(matches.filter(m => m.has_detail_log && (!filterMatchIds || filterMatchIds.has(m.id))).map(m => m.id));
  const nonDetailMatchIds = new Set(matches.filter(m => !m.has_detail_log && (!filterMatchIds || filterMatchIds.has(m.id))).map(m => m.id));

  // From goal_events (only for detail_log matches)
  goalEvents.forEach(g => {
    if (!detailMatchIds.has(g.match_id)) return;
    if (filterMatchIds && !filterMatchIds.has(g.match_id)) return;
    if (g.goal_player_id === playerId && !g.is_own_goal) goals++;
    if (g.assist_player_id === playerId) assists++;
  });

  // From rosters (only for NON-detail_log matches)
  rosters.forEach(r => {
    if (r.player_id !== playerId) return;
    if (!nonDetailMatchIds.has(r.match_id)) return;
    if (filterMatchIds && !filterMatchIds.has(r.match_id)) return;
    goals += r.goals || 0;
    assists += r.assists || 0;
  });

  return { goals, assists };
}

// Per-match AP (non-duplicated)
export function computeMatchAP(
  playerId: number,
  match: Match,
  rosters: Roster[],
  goalEvents: GoalEvent[]
): { goals: number; assists: number } {
  if (match.has_detail_log) {
    const g = goalEvents.filter(e => e.match_id === match.id && e.goal_player_id === playerId && !e.is_own_goal).length;
    const a = goalEvents.filter(e => e.match_id === match.id && e.assist_player_id === playerId).length;
    return { goals: g, assists: a };
  } else {
    const r = rosters.find(r => r.match_id === match.id && r.player_id === playerId);
    return { goals: r?.goals || 0, assists: r?.assists || 0 };
  }
}

// Helper functions
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
  const today = new Date().toISOString().slice(0, 10);
  // Filter out scheduled (future) matches from stat calculations
  const playedMatches = matches.filter(m => m.date <= today);
  const playedMatchIds = new Set(playedMatches.map(m => m.id));

  const { goals, assists } = computeNonDuplicatedAP(playerId, playedMatches, rosters.filter(r => playedMatchIds.has(r.match_id)), goalEvents.filter(g => playedMatchIds.has(g.match_id)));
  const appearances = [...new Set(rosters.filter(r => r.player_id === playerId && playedMatchIds.has(r.match_id)).map(r => r.match_id))].length;

  const playerRosters = rosters.filter(r => r.player_id === playerId && playedMatchIds.has(r.match_id));
  let wins = 0, losses = 0, draws = 0;

  const matchIds = [...new Set(playerRosters.map(r => r.match_id))];
  matchIds.forEach(matchId => {
    // Use only ONE team per match (the team the player is rostered on)
    const playerTeamIds = [...new Set(playerRosters.filter(r => r.match_id === matchId).map(r => r.team_id))];
    playerTeamIds.forEach(teamId => {
      const result = results.find(r => r.team_id === teamId && r.match_id === matchId);
      if (result) {
        if (result.result === "승") wins++;
        else if (result.result === "패") losses++;
        else if (result.result === "무") draws++;
        // Skip other/empty result values (scheduled matches)
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
    const { goals: g, assists: a } = computeMatchAP(playerId, match, rosters, goalEvents);
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

export function getQuarterGoalDistribution(goalEvents: GoalEvent[], allQuarters?: MatchQuarter[]) {
  const goalDist: Record<number, number> = {};
  goalEvents.forEach(g => { goalDist[g.quarter] = (goalDist[g.quarter] || 0) + 1; });
  const concededDist: Record<number, number> = {};
  if (allQuarters) {
    allQuarters.forEach(q => { concededDist[q.quarter] = (concededDist[q.quarter] || 0) + (q.score_against || 0); });
  }
  const allQs = new Set([...Object.keys(goalDist).map(Number), ...Object.keys(concededDist).map(Number)]);
  return [...allQs].sort((a, b) => a - b).map(q => ({ quarter: q, goals: goalDist[q] || 0, conceded: concededDist[q] || 0 }));
}
