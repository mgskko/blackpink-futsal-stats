import { computeMatchAP } from "@/hooks/useFutsalData";
import type { Player, Match, Roster, GoalEvent } from "@/hooks/useFutsalData";
import { localISODate } from "@/lib/utils";

export type FormMode = "fire" | "rise" | "streak";
export interface RecentFormEntry {
  player: Player;
  appearances: number;
  recent: { matchId: number; date: string; goals: number; assists: number; ap: number }[];
  recentAP: number;
  recentGoals: number;
  recentAssists: number;
  improvement: number;
  streak: number;
}

export function computeRecentForm(
  players: Player[], matches: Match[], rosters: Roster[], events: GoalEvent[], today = localISODate(),
): RecentFormEntry[] {
  const completed = matches.filter(m => m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const appearances = new Map<number, Set<number>>();
  rosters.forEach(r => {
    const ids = appearances.get(r.player_id) ?? new Set<number>();
    ids.add(r.match_id);
    appearances.set(r.player_id, ids);
  });
  return players.filter(p => !p.is_guest && !/^용병[12]$/.test(p.name)).flatMap(player => {
    const ids = appearances.get(player.id);
    const played = completed.filter(m => ids?.has(m.id));
    if (played.length < 10) return [];
    const history = played.map(m => {
      const { goals, assists } = computeMatchAP(player.id, m, rosters, events);
      return { matchId: m.id, date: m.date, goals, assists, ap: goals + assists };
    });
    const recent = history.slice(0, 5);
    const previous = history.slice(5, 10);
    const recentAP = recent.reduce((sum, m) => sum + m.ap, 0);
    const previousAP = previous.reduce((sum, m) => sum + m.ap, 0);
    const firstBlank = history.findIndex(m => m.ap === 0);
    return [{
      player, appearances: played.length, recent, recentAP,
      recentGoals: recent.reduce((sum, m) => sum + m.goals, 0),
      recentAssists: recent.reduce((sum, m) => sum + m.assists, 0),
      improvement: (recentAP - previousAP) / 5,
      streak: firstBlank < 0 ? history.length : firstBlank,
    }];
  });
}

export function rankRecentForm(entries: RecentFormEntry[], mode: FormMode): RecentFormEntry[] {
  const score = (e: RecentFormEntry) => mode === "fire" ? e.recentAP : mode === "rise" ? e.improvement : e.streak;
  return entries.filter(e => score(e) > 0)
    .sort((a, b) => score(b) - score(a) || b.recentAP - a.recentAP || a.player.id - b.player.id)
    .slice(0, 5);
}