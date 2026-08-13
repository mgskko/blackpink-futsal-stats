import type { Player, Match, Roster, GoalEvent, Team, Result, MatchQuarter } from "@/hooks/useFutsalData";
import { computeNonDuplicatedAP } from "@/hooks/useFutsalData";
import { computePOTMWinners } from "@/lib/potm";

export type TitleKind = "goals" | "assists" | "apps";
export type TitleScope = "career" | "year" | "custom";

export interface SeasonTitle {
  playerId: number;
  kind: TitleKind;
  scope: TitleScope;
  year?: number;
  value: number;
}

const EXCLUDED = /^용병\d*$/;

export function eligiblePlayers(players: Player[] = []): Player[] {
  return (players ?? []).filter(p => p && !(p as any).is_guest && !EXCLUDED.test(p.name));
}

function tally(scopeMatches: Match[], rosters: Roster[], goalEvents: GoalEvent[], players: Player[]) {
  const ids = new Set(scopeMatches.map(m => m.id));
  const scopedRosters = rosters.filter(r => ids.has(r.match_id));
  const scopedEvents = goalEvents.filter(g => ids.has(g.match_id));
  const goals = new Map<number, number>(), assists = new Map<number, number>(), apps = new Map<number, number>();
  players.forEach(p => {
    const ap = computeNonDuplicatedAP(p.id, scopeMatches, scopedRosters, scopedEvents);
    if (ap.goals) goals.set(p.id, ap.goals);
    if (ap.assists) assists.set(p.id, ap.assists);
    const n = new Set(scopedRosters.filter(r => r.player_id === p.id).map(r => r.match_id)).size;
    if (n) apps.set(p.id, n);
  });
  return { goals, assists, apps };
}

function topEntries(m: Map<number, number>) {
  const top = Math.max(0, ...m.values());
  return top > 0 ? [...m.entries()].filter(([, v]) => v === top) : [];
}

/** All Bunnies season titles across career / yearly / intrasquad scopes. Ties all win. */
export function computeSeasonTitles(
  players: Player[] = [],
  matches: Match[] = [],
  rosters: Roster[] = [],
  goalEvents: GoalEvent[] = [],
): SeasonTitle[] {
  const today = new Date().toISOString().slice(0, 10);
  const played = (matches ?? []).filter(m => m?.date && m.date <= today);
  const elig = eligiblePlayers(players);
  const out: SeasonTitle[] = [];

  const push = (scope: TitleScope, year: number | undefined, t: ReturnType<typeof tally>) => {
    (["goals", "assists", "apps"] as TitleKind[]).forEach(kind => {
      topEntries(t[kind]).forEach(([playerId, value]) => out.push({ playerId, kind, scope, year, value }));
    });
  };

  push("career", undefined, tally(played, rosters, goalEvents, elig));

  const years = [...new Set(played.map(m => Number(m.date.slice(0, 4))))].sort((a, b) => b - a);
  years.forEach(y => {
    const ym = played.filter(m => Number(m.date.slice(0, 4)) === y);
    push("year", y, tally(ym, rosters, goalEvents, elig));
    const custom = ym.filter(m => m.is_custom);
    if (custom.length > 0) push("custom", y, tally(custom, rosters, goalEvents, elig));
  });

  return out;
}

export interface BallonDorEntry {
  playerId: number;
  goals: number;
  assists: number;
  apps: number;
  potm: number;
  score: number;
  rank: number;
}
export interface BallonDorSeason {
  year: number;
  entries: BallonDorEntry[];
}

/** Ballon d'Or (Season MVP) ranking per year. goals*3 + assists*2 + apps + POTM*5 */
export function computeBallonDor(
  players: Player[] = [],
  matches: Match[] = [],
  teams: Team[] = [],
  results: Result[] = [],
  rosters: Roster[] = [],
  goalEvents: GoalEvent[] = [],
  quarters: MatchQuarter[] = [],
): BallonDorSeason[] {
  const today = new Date().toISOString().slice(0, 10);
  const played = (matches ?? []).filter(m => m?.date && m.date <= today);
  const elig = eligiblePlayers(players);
  const potmAll = computePOTMWinners(players, matches, teams, results, rosters, goalEvents, quarters);

  const years = [...new Set(played.map(m => Number(m.date.slice(0, 4))))].sort((a, b) => b - a);
  return years.map(year => {
    const ym = played.filter(m => Number(m.date.slice(0, 4)) === year);
    const { goals, assists, apps } = tally(ym, rosters, goalEvents, elig);
    const potmBy = new Map<number, number>();
    potmAll.forEach(w => { if (w.year === year) potmBy.set(w.player.id, (potmBy.get(w.player.id) ?? 0) + 1); });

    const entries = elig.map(p => {
      const g = goals.get(p.id) ?? 0, a = assists.get(p.id) ?? 0, mp = apps.get(p.id) ?? 0, po = potmBy.get(p.id) ?? 0;
      return { playerId: p.id, goals: g, assists: a, apps: mp, potm: po, score: g * 3 + a * 2 + mp + po * 5, rank: 0 };
    }).filter(e => e.apps >= 1 && e.score > 0)
      .sort((x, y) => y.score - x.score || y.goals - x.goals || y.assists - x.assists);

    entries.forEach((e, i) => { e.rank = i > 0 && entries[i - 1].score === e.score ? entries[i - 1].rank : i + 1; });
    return { year, entries };
  }).filter(s => s.entries.length > 0);
}
