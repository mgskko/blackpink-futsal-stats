import type { Match, Roster, Player } from "./useFutsalData";

const INACTIVE_DAYS = 180;

export function getLastMatchDate(playerId: number, matches: Match[], rosters: Roster[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const matchIds = new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id));
  const dates = matches.filter(m => matchIds.has(m.id) && m.date <= today).map(m => m.date).sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

export function isPlayerInactive(playerId: number, matches: Match[], rosters: Roster[]): boolean {
  const last = getLastMatchDate(playerId, matches, rosters);
  if (!last) return true;
  const diffMs = Date.now() - new Date(last).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= INACTIVE_DAYS;
}

export function getInactivePlayerIds(players: Player[], matches: Match[], rosters: Roster[]): Set<number> {
  const set = new Set<number>();
  players.forEach(p => {
    if (isPlayerInactive(p.id, matches, rosters)) set.add(p.id);
  });
  return set;
}