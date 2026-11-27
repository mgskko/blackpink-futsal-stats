import { describe, expect, it } from "vitest";
import { computeRecentForm, rankRecentForm } from "./recentForm";
import type { Player, Match, Roster, GoalEvent } from "@/hooks/useFutsalData";

const player: Player = { id: 1, name: "고명석", is_active: true, join_date: "2025-01-01", back_number: 7, profile_image_url: null };
const matches: Match[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, date: `2026-10-${String(i + 1).padStart(2, "0")}`, venue_id: 1, match_type: "풋살", is_custom: false, has_detail_log: false, youtube_link: null }));
const rosters: Roster[] = matches.map(m => ({ id: m.id, match_id: m.id, player_id: 1, team_id: 1, goals: m.id >= 6 ? 2 : 1, assists: 0 }));
const compute = (p = [player], m = matches, r = rosters, e: GoalEvent[] = []) => computeRecentForm(p, m, r, e, "2026-11-27");

describe("recent form", () => {
  it("compares the latest five appearances with the preceding five", () => {
    const entry = compute()[0];
    expect(entry.recent.map(m => m.matchId)).toEqual([10, 9, 8, 7, 6]);
    expect(entry.recentAP).toBe(10);
    expect(entry.improvement).toBe(1);
  });
  it("requires ten distinct completed appearances", () => {
    expect(compute([player], matches.slice(0, 9), [...rosters, rosters[0]])).toEqual([]);
    expect(compute([player], [...matches.slice(0, 9), { ...matches[9], date: "2027-01-01" }])).toEqual([]);
  });
  it("excludes guests and named guest placeholders", () => {
    expect(compute([{ ...player, is_guest: true }])).toEqual([]);
    expect(compute([{ ...player, name: "용병1" }])).toEqual([]);
    expect(compute([{ ...player, name: "용병2" }])).toEqual([]);
  });
  it("respects supplied season/sport matches even with unfiltered rosters", () => {
    expect(compute([player], matches.slice(5), rosters)).toEqual([]);
  });
  it("counts only the current AP streak and breaks it at a blank appearance", () => {
    expect(compute([player], matches, rosters.map(r => r.match_id === 8 ? { ...r, goals: 0 } : r))[0].streak).toBe(2);
    expect(compute()[0].streak).toBe(10);
    expect(compute([player], matches, rosters.map(r => r.match_id === 10 ? { ...r, goals: 0 } : r))[0].streak).toBe(0);
  });
  it("uses detail events instead of roster totals and excludes own goals", () => {
    const event: GoalEvent = { id: 1, match_id: 10, team_id: 1, quarter: 1, goal_player_id: 1, assist_player_id: null, is_own_goal: false, video_timestamp: null, assist_type: null, goal_type: null, build_up_process: null };
    const data = compute([player], matches.map(m => m.id === 10 ? { ...m, has_detail_log: true } : m), rosters, [event, { ...event, id: 2, is_own_goal: true }]);
    expect(data[0].recent[0].ap).toBe(1);
    expect(data[0].recentAP).toBe(9);
  });
  it("does not promote non-positive rising form", () => {
    const entries = compute();
    expect(rankRecentForm(entries, "rise")[0].player.id).toBe(1);
    expect(rankRecentForm([{ ...entries[0], improvement: 0 }], "rise")).toEqual([]);
  });
});