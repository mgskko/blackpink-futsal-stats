import { describe, expect, it } from "vitest";
import { getConcacafBadges } from "./concacaf";
import type { GoalEvent, Match, MatchQuarter, Result, Roster, Team } from "@/hooks/useFutsalData";

function season(opts: { goalsPerMatch: number; soccer?: boolean; lose?: boolean }) {
  const matches: Match[] = [], quarters: MatchQuarter[] = [], goals: GoalEvent[] = [], rosters: Roster[] = [], teams: Team[] = [], results: Result[] = [];
  let gid = 1;
  for (let i = 0; i < 5; i++) {
    const id = i + 1;
    matches.push({ id, date: `2026-10-0${id}`, venue_id: 1, match_type: opts.soccer ? "11:11 축구" : "6:6 풋살", is_custom: false, has_detail_log: true, youtube_link: null, match_format: opts.soccer ? "s11" : "futsal6" } as Match);
    teams.push({ id: id * 10, match_id: id, name: "버니즈", is_ours: true, original_age_desc: null, age_category: null });
    const sf = opts.lose ? 0 : opts.goalsPerMatch + 1;
    const sa = opts.lose ? 3 : 1;
    results.push({ id, team_id: id * 10, match_id: id, result: opts.lose ? "패" : "승", score_for: sf, score_against: sa });
    for (let q = 1; q <= 4; q++) {
      quarters.push({ id: id * 10 + q, match_id: id, quarter: q, score_for: q === 1 ? sf : 0, score_against: q === 2 ? sa : 0, lineup: { GK: [9], DF: [2], MF: [3, 4], FW: [1] } } as MatchQuarter);
    }
    [1, 2, 3, 4, 9].forEach(pid => rosters.push({ id: id * 100 + pid, match_id: id, team_id: id * 10, player_id: pid, goals: 0, assists: 0 }));
    for (let g = 0; g < opts.goalsPerMatch; g++) goals.push({ id: gid++, match_id: id, team_id: id * 10, quarter: 1, goal_player_id: 1, assist_player_id: 3, is_own_goal: false, video_timestamp: null, assist_type: null, goal_type: null, build_up_process: null } as GoalEvent);
  }
  return { matches, quarters, goalEvents: goals, rosters, teams, results, players: [] };
}

describe("concacaf badges", () => {
  it("awards England + Brazil to a futsal striker scoring 3 a game", () => {
    const keys = getConcacafBadges(1, season({ goalsPerMatch: 3 })).map(b => b.key);
    expect(keys).toContain("ENG");
    expect(keys).toContain("BRA");
  });

  it("uses lower thresholds for football (1 goal a game is elite)", () => {
    expect(getConcacafBadges(1, season({ goalsPerMatch: 1, soccer: true })).map(b => b.key)).toContain("ENG");
    expect(getConcacafBadges(1, season({ goalsPerMatch: 1 })).map(b => b.key)).not.toContain("ENG");
  });

  it("flags a slump with a negative badge", () => {
    const b = getConcacafBadges(2, season({ goalsPerMatch: 0, lose: true }));
    expect(b.find(x => x.key === "HMB")?.negative).toBe(true);
  });

  it("needs five played matches", () => {
    const s = season({ goalsPerMatch: 3 });
    s.rosters = s.rosters.filter(r => r.match_id <= 4);
    expect(getConcacafBadges(1, s)).toEqual([]);
  });
});
