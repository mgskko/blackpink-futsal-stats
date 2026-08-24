// ─────────────────────────────────────────────────────────────
// Bunnies FC — Unified Match Rating Engine (single source of truth)
// FotMob-style 4.0 ~ 10.0 rating, differentiated by sport & position.
//
// Every rating surface in the app (match lineup pitch, match stats table,
// player profile, season leaderboard) MUST read from this module so the same
// player always shows the exact same number.
// ─────────────────────────────────────────────────────────────
import type { Match, MatchQuarter, GoalEvent, Roster } from "@/hooks/useFutsalData";
import { sportOfMatch, type SportKey } from "@/lib/sport";
import { slotMapOf } from "@/lib/positions";

export type RatingGroup = "GK" | "DF" | "MF" | "W" | "FW";

export interface MatchRatingDetail {
  playerId: number;
  rating: number;
  base: number;
  attack: number;
  defense: number;
  discipline: number;
  teamMod: number;
  bonus: number;
  goals: number;
  assists: number;
  ownGoals: number;
  quartersPlayed: number;
  conceded: number;
  cleanSheet: boolean;
  group: RatingGroup;
  slot: string | null;
  sport: SportKey;
  isOverride: boolean;
}

export interface RatingOverride {
  match_id: number;
  player_id: number;
  rating: number;
}

export interface CardCount {
  yellow: number;
  red: number;
}

export const RATING_BOUNDS = { base: 6.0, min: 4.0, max: 10.0 };

// ── tuning tables ─────────────────────────────────────────────
// Soccer: goals are scarce, so a single goal must not dominate; position role
// expectation drives the penalty for a blank game instead.
const SOCCER = {
  goal: { FW: 0.9, W: 1.0, MF: 1.15, DF: 1.5, GK: 2.0 },
  assist: { FW: 0.6, W: 0.7, MF: 0.8, DF: 1.0, GK: 1.4 },
  // blank-game penalty (no goal & no assist) — heaviest for strikers
  blank: { FW: -0.8, W: -0.5, MF: -0.3, DF: 0, GK: 0 },
  cleanSheet: { GK: 1.8, DF: 1.5, MF: 0.3, W: 0.1, FW: 0.1 },
  nearCleanSheet: { GK: 0.6, DF: 0.5, MF: 0.1, W: 0, FW: 0 }, // conceded <= 1
  concededPer: { GK: -0.35, DF: -0.25, MF: -0.08, W: 0, FW: 0 },
  margin: 0.09,
  marginClamp: 0.8,
};

// Futsal: high scoring, fast transitions — keeps the legacy weighting feel.
const FUTSAL = {
  goal: { FW: 0.5, W: 0.55, MF: 0.6, DF: 0.75, GK: 0.9 },
  assist: { FW: 0.35, W: 0.38, MF: 0.4, DF: 0.5, GK: 0.6 },
  blank: { FW: -0.35, W: -0.25, MF: -0.15, DF: 0, GK: 0 },
  cleanSheet: { GK: 0.9, DF: 0.7, MF: 0.2, W: 0.1, FW: 0.1 },
  nearCleanSheet: { GK: 0.3, DF: 0.25, MF: 0.05, W: 0, FW: 0 },
  concededPer: { GK: -0.15, DF: -0.12, MF: -0.04, W: 0, FW: 0 },
  margin: 0.13,
  marginClamp: 1.2,
};

export const OWN_GOAL_PENALTY = -1.0;
export const MOM_BONUS = 1.0;
export const YELLOW_PENALTY = -0.3;
export const RED_PENALTY = -1.0;
export const RESULT_MOD = { win: 0.5, draw: 0, loss: -0.5 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

// ── lineup helpers (support both flat and teamA/teamB shapes) ──
const isCustomLineup = (l: any) => !!l && typeof l === "object" && !Array.isArray(l) && (l.teamA || l.teamB);
const idsOf = (raw: any): number[] =>
  raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n));

const ROLES = ["GK", "DF", "MF", "FW"] as const;

function unitsOf(lineup: any): any[] {
  if (!lineup || typeof lineup !== "object") return [];
  return isCustomLineup(lineup) ? [lineup.teamA, lineup.teamB].filter(Boolean) : [lineup];
}

function roleInUnit(unit: any, pid: number): (typeof ROLES)[number] | null {
  for (const r of ROLES) {
    if (idsOf(unit?.[r] ?? unit?.[r.toLowerCase()]).includes(pid)) return r;
  }
  return null;
}

function teamOfPlayer(lineup: any, pid: number): "teamA" | "teamB" | null {
  if (!isCustomLineup(lineup)) return null;
  if (roleInUnit(lineup.teamA, pid)) return "teamA";
  if (roleInUnit(lineup.teamB, pid)) return "teamB";
  return null;
}

const WINGER_SLOTS = new Set(["LW", "RW", "L-W", "R-W", "LM", "RM", "L-ALA", "R-ALA", "ALA"]);

function groupOf(role: (typeof ROLES)[number], slot: string | null): RatingGroup {
  if (role === "GK") return "GK";
  if (role === "DF") return "DF";
  if (role === "MF") return slot && WINGER_SLOTS.has(slot) ? "W" : "MF";
  return slot && WINGER_SLOTS.has(slot) ? "W" : "FW";
}

export interface ComputeMatchRatingsInput {
  match: Match | null | undefined;
  quarters: MatchQuarter[];
  goalEvents: GoalEvent[];
  rosters?: Roster[];
  /** DataMOM / voted MOM winner(s) get a bonus */
  momPlayerIds?: number[];
  /** admin manual override: playerId -> rating */
  overrides?: Map<number, number>;
  cards?: Map<number, CardCount>;
}

/**
 * Compute the per-match rating for every player involved in the match.
 * Works with or without per-quarter lineup logs (falls back to roster totals).
 */
export function computeMatchRatings({
  match,
  quarters,
  goalEvents,
  rosters = [],
  momPlayerIds = [],
  overrides,
  cards,
}: ComputeMatchRatingsInput): Map<number, MatchRatingDetail> {
  const out = new Map<number, MatchRatingDetail>();
  if (!match) return out;

  const matchId = match.id;
  const sport = sportOfMatch(match);
  const W = sport === "soccer" ? SOCCER : FUTSAL;

  const qs = quarters.filter(q => q.match_id === matchId).sort((a, b) => a.quarter - b.quarter);
  const events = goalEvents.filter(g => g.match_id === matchId);
  const matchRosters = rosters.filter(r => r.match_id === matchId);

  interface Acc {
    quartersPlayed: number;
    roleCount: Record<RatingGroup, number>;
    slot: string | null;
    goals: number;
    assists: number;
    ownGoals: number;
    conceded: number;
    goalsFor: number;
    margin: number;
    defQuarters: number;
  }
  const state = new Map<number, Acc>();
  const init = (pid: number): Acc => {
    if (!state.has(pid)) {
      state.set(pid, {
        quartersPlayed: 0,
        roleCount: { GK: 0, DF: 0, MF: 0, W: 0, FW: 0 },
        slot: null,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        conceded: 0,
        goalsFor: 0,
        margin: 0,
        defQuarters: 0,
      });
    }
    return state.get(pid)!;
  };

  // 1) per-quarter presence, position and conceded/scored context
  qs.forEach(q => {
    const lineup: any = q.lineup;
    if (!lineup || typeof lineup !== "object") return;
    const forBase = q.score_for || 0;
    const againstBase = q.score_against || 0;
    unitsOf(lineup).forEach(unit => {
      const slotMap = slotMapOf(unit);
      ROLES.forEach(role => {
        idsOf(unit?.[role] ?? unit?.[role.toLowerCase()]).forEach(pid => {
          const s = init(pid);
          const slot = slotMap[String(pid)] ?? null;
          if (slot) s.slot = slot;
          const isB = isCustomLineup(lineup) && teamOfPlayer(lineup, pid) === "teamB";
          const gf = isB ? againstBase : forBase;
          const ga = isB ? forBase : againstBase;
          s.quartersPlayed += 1;
          s.goalsFor += gf;
          s.conceded += ga;
          s.margin += gf - ga;
          s.roleCount[groupOf(role, slot)] += 1;
          if (role === "GK" || role === "DF") s.defQuarters += 1;
        });
      });
    });
  });

  // 2) goals / assists / own goals
  events.forEach(g => {
    if (g.goal_player_id) {
      const s = init(g.goal_player_id);
      if (g.is_own_goal) s.ownGoals += 1;
      else s.goals += 1;
    }
    if (g.assist_player_id) init(g.assist_player_id).assists += 1;
  });

  // 3) roster fallback (older matches without event/lineup logs)
  matchRosters.forEach(r => {
    const s = init(r.player_id);
    if (events.length === 0) {
      s.goals += r.goals || 0;
      s.assists += r.assists || 0;
    }
  });

  // 4) team-result modifier (our team's result for this match)
  const totalFor = qs.reduce((a, q) => a + (q.score_for || 0), 0);
  const totalAgainst = qs.reduce((a, q) => a + (q.score_against || 0), 0);

  const momSet = new Set(momPlayerIds.filter(Boolean));

  state.forEach((s, pid) => {
    const group = (Object.entries(s.roleCount) as [RatingGroup, number][])
      .sort((a, b) => b[1] - a[1])[0];
    const g: RatingGroup = group && group[1] > 0 ? group[0] : "MF";

    const played = s.quartersPlayed;
    const hasLineup = played > 0;

    // attack
    let attack = s.goals * W.goal[g] + s.assists * W.assist[g];
    if (s.goals === 0 && s.assists === 0) attack += W.blank[g];
    attack += s.ownGoals * OWN_GOAL_PENALTY;

    // defense
    const cleanSheet = hasLineup ? s.conceded === 0 : totalAgainst === 0 && qs.length > 0;
    let defense = 0;
    if (cleanSheet) defense += W.cleanSheet[g];
    else if (s.conceded <= 1) defense += W.nearCleanSheet[g];
    if (!cleanSheet) defense += s.conceded * W.concededPer[g];
    const marginAvg = played > 0 ? s.margin / played : totalFor - totalAgainst;
    defense += clamp(marginAvg * W.margin, -W.marginClamp, W.marginClamp);

    // discipline
    const c = cards?.get(pid);
    const discipline = (c?.yellow ?? 0) * YELLOW_PENALTY + (c?.red ?? 0) * RED_PENALTY;

    // team result modifier
    let teamResult: keyof typeof RESULT_MOD = "draw";
    if (hasLineup && played > 0) {
      teamResult = s.margin > 0 ? "win" : s.margin < 0 ? "loss" : "draw";
    } else if (qs.length > 0) {
      teamResult = totalFor > totalAgainst ? "win" : totalFor < totalAgainst ? "loss" : "draw";
    }
    const teamMod = RESULT_MOD[teamResult];

    const bonus = momSet.has(pid) ? MOM_BONUS : 0;

    const rawUnsafe = RATING_BOUNDS.base + attack + defense + discipline + teamMod + bonus;
    const raw = Number.isFinite(rawUnsafe) ? rawUnsafe : RATING_BOUNDS.base;

    const overrideVal = overrides?.get(pid);
    const isOverride = typeof overrideVal === "number" && Number.isFinite(overrideVal);

    out.set(pid, {
      playerId: pid,
      rating: round2(
        isOverride
          ? clamp(overrideVal as number, 0, RATING_BOUNDS.max)
          : clamp(raw, RATING_BOUNDS.min, RATING_BOUNDS.max)
      ),
      base: RATING_BOUNDS.base,
      attack: round2(attack),
      defense: round2(defense),
      discipline: round2(discipline),
      teamMod,
      bonus,
      goals: s.goals,
      assists: s.assists,
      ownGoals: s.ownGoals,
      quartersPlayed: played,
      conceded: s.conceded,
      cleanSheet,
      group: g,
      slot: s.slot,
      sport,
      isOverride,
    });
  });

  return out;
}

/** Colour tone shared by every rating badge in the app. */
export const ratingTone = (r: number) =>
  r >= 8 ? "bg-blue-500 text-white"
    : r >= 7 ? "bg-green-500 text-black"
      : r >= 6 ? "bg-orange-500 text-black"
        : "bg-red-500 text-white";

export const ratingTextTone = (r: number) =>
  r >= 8 ? "text-blue-400" : r >= 7 ? "text-green-400" : r >= 6 ? "text-primary" : "text-muted-foreground";
