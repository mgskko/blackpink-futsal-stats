import { describe, expect, it } from "vitest";
import { computeMatchRatings } from "./matchRating";
import type { GoalEvent, Match, MatchQuarter } from "@/hooks/useFutsalData";

const match = (id: number, format = "futsal6"): Match =>
  ({ id, date: "2026-10-01", venue_id: 1, match_type: format.startsWith("s") ? "11:11 축구" : "6:6 풋살", is_custom: false, has_detail_log: true, youtube_link: null, match_format: format }) as Match;

const q = (matchId: number, quarter: number, sf: number, sa: number, lineup: Record<string, number[]>): MatchQuarter =>
  ({ id: matchId * 10 + quarter, match_id: matchId, quarter, score_for: sf, score_against: sa, lineup }) as MatchQuarter;

let gid = 1;
const goal = (matchId: number, quarter: number, scorer: number, assist: number | null = null): GoalEvent =>
  ({ id: gid++, match_id: matchId, team_id: 1, quarter, goal_player_id: scorer, assist_player_id: assist, is_own_goal: false, video_timestamp: null, assist_type: null, goal_type: null, build_up_process: null }) as GoalEvent;

const base = { GK: [1], DF: [2], MF: [3, 4], FW: [5] };

describe("rating v3", () => {
  it("does not penalise playing more quarters at the same per-quarter level", () => {
    // player 2 (DF) plays all 4 quarters, player 6 (DF) only 2; both concede 1 per quarter
    const m = match(1);
    const quarters = [
      q(1, 1, 1, 1, { ...base }),
      q(1, 2, 1, 1, { ...base }),
      q(1, 3, 1, 1, { ...base, DF: [6] , MF: [3, 4], FW: [5], GK: [1] }),
      q(1, 4, 1, 1, { ...base, DF: [6] }),
    ];
    // make player 2 also play q3,q4 as MF so both have identical conceded/quarter
    const r = computeMatchRatings({ match: m, quarters, goalEvents: [] });
    expect(r.get(2)!.quartersPlayed).toBe(2);
    expect(r.get(6)!.quartersPlayed).toBe(2);
    expect(Math.abs(r.get(2)!.rating - r.get(6)!.rating)).toBeLessThan(0.01);
  });

  it("gives no rating to a roster player who never played", () => {
    const m = match(2);
    const r = computeMatchRatings({
      match: m,
      quarters: [q(2, 1, 1, 0, base), q(2, 2, 0, 0, base)],
      goalEvents: [],
      rosters: [{ id: 1, match_id: 2, team_id: 1, player_id: 99, goals: 0, assists: 0 }],
    });
    expect(r.has(99)).toBe(false);
    expect(r.has(5)).toBe(true);
  });

  it("rewards a futsal hat-trick in a win (goals are common in futsal, so ~8)", () => {
    const m = match(3);
    const quarters = [q(3, 1, 2, 1, base), q(3, 2, 1, 1, base), q(3, 3, 2, 0, base), q(3, 4, 1, 1, base)];
    const r = computeMatchRatings({ match: m, quarters, goalEvents: [goal(3, 1, 5, 3), goal(3, 3, 5), goal(3, 4, 5, 4)] });
    const fw = r.get(5)!.rating;
    expect(fw).toBeGreaterThan(7.5);
    expect(fw).toBeLessThan(9.0);
    expect(fw).toBeGreaterThan(r.get(3)!.rating);
  });

  it("rates a football hat-trick far higher than a futsal one", () => {
    const m = match(4, "s11");
    const lineup = { GK: [1], DF: [2, 6, 7, 8], MF: [3, 4, 9], FW: [5, 10, 11] };
    const quarters = [q(4, 1, 1, 0, lineup), q(4, 2, 1, 1, lineup), q(4, 3, 1, 0, lineup), q(4, 4, 0, 0, lineup)];
    const r = computeMatchRatings({ match: m, quarters, goalEvents: [goal(4, 1, 5), goal(4, 2, 5, 3), goal(4, 3, 5)] });
    expect(r.get(5)!.rating).toBeGreaterThan(8.6);
    // the keeper conceded once in four quarters of a win
    expect(r.get(1)!.rating).toBeGreaterThan(7);
  });

  it("produces a FotMob-like distribution on simulated futsal and football seasons", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pois = (l: number) => { let k = 0, p = Math.exp(-l), s = p; const u = rnd(); while (u > s) { k++; p *= l / k; s += p; } return k; };
    const all: number[] = [];
    for (let i = 0; i < 280; i++) {
      const soccer = i >= 200;
      const m = match(100 + i, soccer ? "s11" : "futsal6");
      const squad = Array.from({ length: soccer ? 14 : 9 }, (_, k) => k + 1);
      const quarters: MatchQuarter[] = [];
      const events: GoalEvent[] = [];
      const strength = rnd() - 0.5;
      for (let qq = 1; qq <= 4; qq++) {
        const pool = [...squad].sort(() => rnd() - 0.5);
        const lineup = soccer
          ? { GK: [pool[0]], DF: pool.slice(1, 5), MF: pool.slice(5, 8), FW: pool.slice(8, 11) }
          : { GK: [pool[0]], DF: [pool[1]], MF: [pool[2], pool[3]], FW: [pool[4]] };
        const sf = pois((soccer ? 0.6 : 1.4) * (1 + strength));
        const sa = pois((soccer ? 0.6 : 1.4) * (1 - strength));
        quarters.push(q(m.id, qq, sf, sa, lineup));
        const outfield = [...lineup.DF, ...lineup.MF, ...lineup.FW, ...lineup.FW];
        for (let k = 0; k < sf; k++) {
          const sc = outfield[Math.floor(rnd() * outfield.length)];
          const as = rnd() < 0.6 ? outfield.filter(x => x !== sc)[Math.floor(rnd() * (outfield.length - 1))] : null;
          events.push(goal(m.id, qq, sc, as));
        }
      }
      computeMatchRatings({ match: m, quarters, goalEvents: events }).forEach(d => all.push(d.rating));
    }
    all.sort((a, b) => a - b);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const pct = (p: number) => all[Math.floor((all.length - 1) * p)];
    // eslint-disable-next-line no-console
    console.log(`n=${all.length} mean=${mean.toFixed(2)} p5=${pct(0.05)} p25=${pct(0.25)} p50=${pct(0.5)} p75=${pct(0.75)} p95=${pct(0.95)} max=${all[all.length - 1]} min=${all[0]}`);
    expect(mean).toBeGreaterThan(6.2);
    expect(mean).toBeLessThan(7.1);
    expect(pct(0.95)).toBeLessThan(8.8);
    expect(pct(0.05)).toBeGreaterThan(5.0);
    expect(all.filter(r => r >= 10).length / all.length).toBeLessThan(0.01);
  });
});
