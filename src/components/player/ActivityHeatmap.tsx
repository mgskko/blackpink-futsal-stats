import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent } from "@/hooks/useFutsalData";

interface Props {
  playerId: number;
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  momVotes?: { match_id: number; voted_player_id: number }[];
  year?: number;
}

function getWeekDay(dateStr: string) {
  return new Date(dateStr).getDay();
}

function getAllDatesInYear(year: number): string[] {
  const dates: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

type Level = 0 | 1 | 2 | 3;

const LEVEL_COLORS: Record<Level, string> = {
  0: "bg-secondary",
  1: "bg-primary/30",
  2: "bg-primary/60",
  3: "bg-primary",
};

const LEVEL_LABELS = ["활동 없음", "참석", "공격포인트 기록", "해트트릭/MOM"];
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function ActivityHeatmap({ playerId, matches, rosters, goalEvents, momVotes, year }: Props) {
  const displayYear = year || new Date().getFullYear();

  const { dateMap, totalDays, maxStreak } = useMemo(() => {
    const map = new Map<string, Level>();
    const yearMatches = matches.filter(m => m.date.startsWith(String(displayYear)));
    const playerMatchIds = new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id));

    // MOM winners per match
    const momWinners = new Map<number, number>();
    if (momVotes) {
      const matchVoteCounts = new Map<number, Map<number, number>>();
      momVotes.forEach(v => {
        if (!matchVoteCounts.has(v.match_id)) matchVoteCounts.set(v.match_id, new Map());
        const mv = matchVoteCounts.get(v.match_id)!;
        mv.set(v.voted_player_id, (mv.get(v.voted_player_id) || 0) + 1);
      });
      matchVoteCounts.forEach((votes, mid) => {
        const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) momWinners.set(mid, sorted[0][0]);
      });
    }

    yearMatches.forEach(m => {
      if (!playerMatchIds.has(m.id)) return;
      
      // Count goals + assists
      const evGoals = goalEvents.filter(g => g.match_id === m.id && g.goal_player_id === playerId && !g.is_own_goal).length;
      const evAssists = goalEvents.filter(g => g.match_id === m.id && g.assist_player_id === playerId).length;
      const rGoals = rosters.filter(r => r.match_id === m.id && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
      const rAssists = rosters.filter(r => r.match_id === m.id && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
      const ap = evGoals + evAssists + rGoals + rAssists;
      const isMOM = momWinners.get(m.id) === playerId;
      const isHattrick = (evGoals + rGoals) >= 3;

      let level: Level = 1; // attended
      if (ap > 0) level = 2;
      if (isHattrick || isMOM) level = 3;

      map.set(m.date, level);
    });

    // Calculate streak
    const sortedDates = [...map.keys()].sort();
    let streak = 0, maxS = 0, prev = "";
    // We count "consecutive match days" based on actual match availability
    const allMatchDates = yearMatches.map(m => m.date).sort();
    for (const d of allMatchDates) {
      if (map.has(d)) { streak++; maxS = Math.max(maxS, streak); }
      else { streak = 0; }
    }

    return { dateMap: map, totalDays: map.size, maxStreak: maxS };
  }, [playerId, matches, rosters, goalEvents, momVotes, displayYear]);

  const allDates = useMemo(() => getAllDatesInYear(displayYear), [displayYear]);

  // Build weeks grid
  const weeks = useMemo(() => {
    const w: string[][] = [];
    let currentWeek: string[] = [];
    // Pad first week
    const firstDay = getWeekDay(allDates[0]);
    for (let i = 0; i < firstDay; i++) currentWeek.push("");
    for (const d of allDates) {
      currentWeek.push(d);
      if (currentWeek.length === 7) { w.push(currentWeek); currentWeek = []; }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push("");
      w.push(currentWeek);
    }
    return w;
  }, [allDates]);

  // Month labels
  const monthPositions = useMemo(() => {
    const positions: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      for (const d of week) {
        if (!d) continue;
        const month = parseInt(d.slice(5, 7)) - 1;
        if (month !== lastMonth) {
          positions.push({ label: MONTHS[month], col: wi });
          lastMonth = month;
        }
        break;
      }
    });
    return positions;
  }, [weeks]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 font-display text-lg text-primary">🌿 ACTIVITY</h3>
      <p className="mb-3 text-[10px] text-muted-foreground">{displayYear}년 — {totalDays}일 활동 · 최대 {maxStreak}연속 출석</p>
      
      {/* Month labels */}
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ minWidth: weeks.length * 14 + 20 }}>
          <div className="flex gap-0 mb-1 ml-[18px]" style={{ height: 12 }}>
            {monthPositions.map((mp, i) => (
              <span
                key={i}
                className="text-[9px] text-muted-foreground absolute"
                style={{ left: mp.col * 14 + 18 }}
              >
                {mp.label}
              </span>
            ))}
          </div>
          
          {/* Grid */}
          <div className="flex gap-[2px] mt-3">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1">
              {["", "월", "", "수", "", "금", ""].map((d, i) => (
                <div key={i} className="h-[10px] w-[12px] text-[8px] text-muted-foreground flex items-center">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((date, di) => (
                  <div
                    key={di}
                    className={`h-[10px] w-[10px] rounded-[2px] transition-colors ${
                      !date ? "bg-transparent" : LEVEL_COLORS[dateMap.get(date) || 0]
                    }`}
                    title={date ? `${date}: ${LEVEL_LABELS[dateMap.get(date) || 0]}` : ""}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-[9px] text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3] as Level[]).map(l => (
          <div key={l} className={`h-[10px] w-[10px] rounded-[2px] ${LEVEL_COLORS[l]}`} title={LEVEL_LABELS[l]} />
        ))}
        <span>More</span>
      </div>
    </motion.div>
  );
}
