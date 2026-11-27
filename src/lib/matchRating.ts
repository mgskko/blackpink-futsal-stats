// ─────────────────────────────────────────────────────────────
// Bunnies FC — Unified Match Rating Engine (single source of truth)
// FotMob-style 3.0 ~ 10.0 rating (v3), differentiated by sport & position.
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
  /** on-pitch goal-difference component */
  impact: number;
  /** share of the match's quarters played (1 when no lineup log) */
  share: number;
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

export const RATING_BOUNDS = { base: 6.25, min: 3.0, max: 10.0 };

// ── Rating v3 tuning ──────────────────────────────────────────
// Every component is a *rate* or a *relative* measure, so playing more
// quarters is never penalised and a short cameo can't produce extremes.
interface SportTuning {
  goal: Record<RatingGroup, number>;
  assist: Record<RatingGroup, number>;
  /** no goal & no assist after playing ≥ half the match */
  blank: Record<RatingGroup, number>;
  /** on-pitch goal difference per quarter → rating */
  impactPerGoal: number;
  impactClamp: number;
  /** baseline goals conceded per quarter for this sport */
  concededBaseline: number;
  /** weight of (expected − actual conceded per quarter) by position */
  defense: Record<RatingGroup, number>;
  defenseClamp: number;
  /** per clean-sheet quarter on the pitch */
  cleanQuarter: Record<RatingGroup, number>;
  cleanQuarterCap: number;
  /** whole-match clean sheet (played ≥ half) */
  cleanSheet: Record<RatingGroup, number>;
}

const SOCCER: SportTuning = {
  goal: { FW: 0.8, W: 0.9, MF: 1.0, DF: 1.25, GK: 1.7 },
  assist: { FW: 0.55, W: 0.6, MF: 0.7, DF: 0.85, GK: 1.1 },
  blank: { FW: -0.35, W: -0.2, MF: -0.05, DF: 0, GK: 0 },
  impactPerGoal: 0.32,
  impactClamp: 0.85,
  concededBaseline: 0.6,
  defense: { GK: 1.0, DF: 0.75, MF: 0.22, W: 0.08, FW: 0.04 },
  defenseClamp: 0.85,
  cleanQuarter: { GK: 0.22, DF: 0.16, MF: 0.05, W: 0.02, FW: 0 },
  cleanQuarterCap: 0.8,
  cleanSheet: { GK: 0.7, DF: 0.5, MF: 0.1, W: 0, FW: 0 },
};

const FUTSAL: SportTuning = {
  goal: { FW: 0.42, W: 0.46, MF: 0.5, DF: 0.65, GK: 0.85 },
  assist: { FW: 0.28, W: 0.3, MF: 0.33, DF: 0.42, GK: 0.55 },
  blank: { FW: -0.25, W: -0.15, MF: -0.05, DF: 0, GK: 0 },
  impactPerGoal: 0.15,
  impactClamp: 0.8,
  concededBaseline: 1.1,
  defense: { GK: 0.55, DF: 0.4, MF: 0.14, W: 0.06, FW: 0.03 },
  defenseClamp: 0.75,
  cleanQuarter: { GK: 0.12, DF: 0.08, MF: 0.03, W: 0.01, FW: 0 },
  cleanQuarterCap: 0.6,
  cleanSheet: { GK: 0.4, DF: 0.3, MF: 0.08, W: 0, FW: 0 },
};

export const OWN_GOAL_PENALTY = -0.8;
/** MOM no longer affects the rating (rating stays purely performance-derived). */
export const MOM_BONUS = 0;
export const YELLOW_PENALTY = -0.3;
export const RED_PENALTY = -1.0;
export const RESULT_MOD = { win: 0.25, draw: 0, loss: -0.25 };
/** later goals in the same match are worth a bit less (hat-trick ≠ +3 flat) */
const GOAL_DECAY = 0.88;
const ATTACK_CAP = 3.2;

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
  /** @deprecated MOM no longer affects the rating — kept for call-site compatibility */
  momPlayerIds?: number[];
  /** admin manual override: playerId -> rating */
  overrides?: Map<number, number>;
  cards?: Map<number, CardCount>;
  /** our result when there is no quarter log (from the results table) */
  result?: "win" | "draw" | "loss" | null;
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
  overrides,
  cards,
  result: resultLabel = null,
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
    cleanQuarters: number;
    team: "teamA" | "teamB" | null;
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
        cleanQuarters: 0,
        team: null,
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
          if (ga === 0) s.cleanQuarters += 1;
          if (isB) s.team = "teamB";
          else if (isCustomLineup(lineup)) s.team = "teamA";
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

  // 4) match context
  const lineupQuarters = qs.filter(q => q.lineup && typeof q.lineup === "object" && unitsOf(q.lineup).some(u => ROLES.some(r => idsOf(u?.[r]).length)));
  const T = lineupQuarters.length;
  const totalFor = qs.reduce((a, q) => a + (q.score_for || 0), 0);
  const totalAgainst = qs.reduce((a, q) => a + (q.score_against || 0), 0);
  const teamGAperQ = T > 0 ? totalAgainst / T : W.concededBaseline;
  // expected conceded per quarter: half this match's average, half the sport baseline
  const expectedGA = 0.5 * teamGAperQ + 0.5 * W.concededBaseline;

  state.forEach((s, pid) => {
    const played = s.quartersPlayed;
    const hasLineup = T > 0;
    // In a lineup-logged match, roster-only players never stepped on the pitch: no rating
    // (unless the log says they scored/assisted, i.e. the lineup is incomplete).
    if (hasLineup && played === 0 && s.goals + s.assists + s.ownGoals === 0) return;

    const group = (Object.entries(s.roleCount) as [RatingGroup, number][]).sort((a, b) => b[1] - a[1])[0];
    const g: RatingGroup = group && group[1] > 0 ? group[0] : "MF";
    const share = hasLineup ? Math.min(1, played / T) : 1;
    // short cameos keep their goals but context terms are shrunk toward neutral
    const weight = hasLineup ? 0.5 + 0.5 * Math.min(1, share / 0.6) : 0.7;

    // attack (diminishing returns per extra goal)
    let attack = 0;
    for (let k = 0; k < s.goals; k++) attack += W.goal[g] * Math.pow(GOAL_DECAY, k);
    attack += s.assists * W.assist[g];
    attack = Math.min(ATTACK_CAP, attack);
    const blank = s.goals === 0 && s.assists === 0 && share >= 0.5 ? W.blank[g] : 0;
    attack += blank + s.ownGoals * OWN_GOAL_PENALTY;

    // on-pitch impact (+/- per quarter)
    const pmPerQ = played > 0 ? s.margin / played : hasLineup ? 0 : (totalFor - totalAgainst) / Math.max(1, qs.length || 4);
    const impact = clamp(pmPerQ * W.impactPerGoal, -W.impactClamp, W.impactClamp) * weight;

    // defense: conceded rate vs expectation, clean quarters, clean sheet
    let defense = 0;
    let cleanSheet = false;
    if (played > 0) {
      const gaPerQ = s.conceded / played;
      defense += clamp((expectedGA - gaPerQ) * W.defense[g], -W.defenseClamp, W.defenseClamp);
      const cleanQs = s.cleanQuarters;
      defense += Math.min(W.cleanQuarterCap, cleanQs * W.cleanQuarter[g]);
      cleanSheet = s.conceded === 0 && share >= 0.5;
      if (cleanSheet) defense += W.cleanSheet[g];
      defense *= weight;
    } else if (!hasLineup && qs.length > 0 && totalAgainst === 0) {
      cleanSheet = true;
      defense += 0.2;
    }

    // discipline
    const c = cards?.get(pid);
    const discipline = (c?.yellow ?? 0) * YELLOW_PENALTY + (c?.red ?? 0) * RED_PENALTY;

    // team result (the club's result, not the player's on-pitch margin — that's in impact)
    let teamResult: keyof typeof RESULT_MOD = "draw";
    if (qs.length > 0) {
      const isB = isCustomLineup(lineupQuarters[0]?.lineup) && s.team === "teamB";
      const f = isB ? totalAgainst : totalFor;
      const a = isB ? totalFor : totalAgainst;
      teamResult = f > a ? "win" : f < a ? "loss" : "draw";
    } else if (resultLabel) {
      teamResult = resultLabel;
    }
    const teamMod = RESULT_MOD[teamResult] * weight;

    const rawUnsafe = RATING_BOUNDS.base + attack + impact + defense + discipline + teamMod;
    const raw = Number.isFinite(rawUnsafe) ? rawUnsafe : RATING_BOUNDS.base;

    const overrideVal = overrides?.get(pid);
    const isOverride = typeof overrideVal === "number" && Number.isFinite(overrideVal);

    out.set(pid, {
      playerId: pid,
      rating: round2(isOverride ? clamp(overrideVal as number, 0, RATING_BOUNDS.max) : clamp(raw, RATING_BOUNDS.min, RATING_BOUNDS.max)),
      base: RATING_BOUNDS.base,
      attack: round2(attack),
      defense: round2(defense),
      discipline: round2(discipline),
      teamMod: round2(teamMod),
      bonus: 0,
      impact: round2(impact),
      share: round2(share),
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

/** Colour tone shared by every rating badge in the app (FotMob bands). */
export const ratingTone = (v: number) =>
  !v ? "bg-muted text-muted-foreground"
    : v >= 8 ? "bg-[#1a7dff] text-white"
      : v >= 7 ? "bg-emerald-500 text-white"
        : v >= 6.5 ? "bg-lime-500 text-black"
          : v >= 6 ? "bg-amber-400 text-black"
            : "bg-red-500 text-white";

export const ratingTextTone = (r: number) =>
  r >= 8 ? "text-[#4f9bff]" : r >= 7 ? "text-emerald-400" : r >= 6.5 ? "text-lime-400" : r >= 6 ? "text-amber-400" : "text-red-400";
