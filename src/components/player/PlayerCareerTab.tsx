import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent, Team, Player, Result, MatchQuarter } from "@/hooks/useFutsalData";
import SeasonStatsTable from "@/components/player/SeasonStatsTable";

interface Props {
  isEn: boolean;
  playerId: number;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  teams: Team[];
  results: Result[];
  quarters: MatchQuarter[];
  fineCounts: Map<number, number>;
}

export default function PlayerCareerTab({ isEn, playerId, players, matches, rosters, goalEvents, teams, results, quarters, fineCounts }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const [view, setView] = useState<"seasons" | "clubs">("seasons");

  const clubs = useMemo(() => {
    const matchById = new Map(matches.map(m => [m.id, m]));
    const teamById = new Map(teams.map(t => [t.id, t]));
    const map = new Map<string, { name: string; matchIds: Set<number>; goals: number; assists: number; from: string; to: string }>();

    rosters.filter(r => r.player_id === playerId).forEach(r => {
      const m = matchById.get(r.match_id);
      const t = teamById.get(r.team_id);
      if (!m || !t) return;
      const name = t.is_ours && !m.is_custom ? (isEn ? "Bunnies FC" : "버니즈FC") : t.name;
      const entry = map.get(name) ?? { name, matchIds: new Set<number>(), goals: 0, assists: 0, from: m.date, to: m.date };
      entry.matchIds.add(m.id);
      if (m.date < entry.from) entry.from = m.date;
      if (m.date > entry.to) entry.to = m.date;
      map.set(name, entry);
    });

    // goals/assists per club, counted once per match
    map.forEach(entry => {
      entry.goals = goalEvents.filter(g => entry.matchIds.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal).length;
      entry.assists = goalEvents.filter(g => entry.matchIds.has(g.match_id) && g.assist_player_id === playerId).length;
    });

    return [...map.values()].sort((a, b) => b.to.localeCompare(a.to));
  }, [playerId, matches, rosters, goalEvents, teams, isEn]);

  return (
    <div>
      <div className="mt-4 flex overflow-hidden rounded-full border border-border bg-card p-1">
        {(["seasons", "clubs"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${
              view === v ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "seasons" ? L("시즌", "Seasons") : L("클럽", "Clubs")}
          </button>
        ))}
      </div>

      {view === "seasons" ? (
        <SeasonStatsTable
          isEn={isEn}
          playerId={playerId}
          players={players}
          matches={matches}
          rosters={rosters}
          goalEvents={goalEvents}
          results={results}
          quarters={quarters}
          fineCounts={fineCounts}
        />
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center border-b border-border px-3 py-2 text-[11px] font-bold text-muted-foreground">
            <span className="flex-1">{L("1군 경력", "Senior Career")}</span>
            <span className="w-12 text-right">{L("경기", "MP")}</span>
            <span className="w-10 text-right">{L("골", "G")}</span>
            <span className="w-10 text-right">{L("도움", "A")}</span>
          </div>
          {clubs.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{L("경력 데이터가 없습니다.", "No career data.")}</p>
          ) : (
            clubs.map(c => (
              <div key={c.name} className="flex items-center border-b border-border/60 px-3 py-3 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.from} – {c.to}</div>
                </div>
                <span className="w-12 text-right text-sm text-foreground">{c.matchIds.size}</span>
                <span className="w-10 text-right text-sm text-foreground">{c.goals}</span>
                <span className="w-10 text-right text-sm text-foreground">{c.assists}</span>
              </div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}