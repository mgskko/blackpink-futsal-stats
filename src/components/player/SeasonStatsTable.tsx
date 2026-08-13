import { useMemo } from "react";
import { motion } from "framer-motion";
import { computeMatchAP } from "@/hooks/useFutsalData";
import type { Match, Roster, GoalEvent, Result, MatchQuarter, Player } from "@/hooks/useFutsalData";
import { computeSeasonRatings } from "@/hooks/useSeasonRating";

export function computeRating(goals: number, assists: number, appearances: number, winRate: number) {
  if (appearances === 0) return 6.0;
  const apPerGame = (goals + assists) / appearances;
  const raw = 6.0 + apPerGame * 0.45 + (winRate / 100) * 0.9;
  return Math.max(5, Math.min(10, Math.round(raw * 100) / 100));
}

export interface SeasonRow {
  year: string;
  appearances: number;
  quarters: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  rating: number;
  goalRank: number | null;
  assistRank: number | null;
  ratingRank: number | null;
  totalRanked: number;
}

export function buildSeasonRows(
  playerId: number,
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  results: Result[],
  quarters: MatchQuarter[],
  fineCounts: Map<number, number> = new Map(),
): SeasonRow[] {
  const today = new Date().toISOString().slice(0, 10);
  const played = matches.filter(m => m.date <= today);
  const eligible = players.filter(p => !/^용병\d*$/.test(p.name));

  const years = [...new Set(played.map(m => m.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const rows: SeasonRow[] = [];

  years.forEach(year => {
    const yearMatches = played.filter(m => m.date.slice(0, 4) === year);
    const yearIds = new Set(yearMatches.map(m => m.id));
    // shared v2 rating engine — identical to the Statistics tab board
    const entries = computeSeasonRatings(
      eligible,
      yearMatches,
      rosters.filter(r => yearIds.has(r.match_id)),
      goalEvents,
      quarters.filter(q => yearIds.has(q.match_id)),
      fineCounts,
    );
    const me = entries.find(e => e.playerId === playerId);
    if (!me) return;

    let wins = 0, draws = 0, losses = 0;
    yearMatches.forEach(m => {
      const mine = rosters.find(r => r.match_id === m.id && r.player_id === playerId);
      if (!mine) return;
      const res = results.find(x => x.match_id === m.id && x.team_id === mine.team_id);
      if (res?.result === "승") wins++;
      else if (res?.result === "패") losses++;
      else if (res?.result === "무") draws++;
    });
    const totalWDL = wins + draws + losses;

    const rankOf = (key: "goals" | "assists" | "rating") => {
      const sorted = [...entries].sort((a, b) => (b[key] as number) - (a[key] as number));
      const idx = sorted.findIndex(e => e.playerId === playerId);
      if (idx < 0) return null;
      const val = sorted[idx][key] as number;
      return sorted.findIndex(e => (e[key] as number) === val) + 1;
    };

    rows.push({
      year,
      appearances: me.appearances,
      quarters: me.quarters,
      goals: me.goals,
      assists: me.assists,
      cleanSheets: me.cleanSheets,
      wins, draws, losses,
      winRate: totalWDL > 0 ? Math.round((wins / totalWDL) * 100) : 0,
      rating: me.rating,
      goalRank: rankOf("goals"),
      assistRank: rankOf("assists"),
      ratingRank: rankOf("rating"),
      totalRanked: entries.length,
    });
  });

  return rows;
}

interface Props {
  isEn: boolean;
  fineCounts?: Map<number, number>;
  playerId: number;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  results: Result[];
  quarters: MatchQuarter[];
}

export default function SeasonStatsTable({ isEn, playerId, players, matches, rosters, goalEvents, results, quarters, fineCounts }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const rows = useMemo(
    () => buildSeasonRows(playerId, players, matches, rosters, goalEvents, results, quarters, fineCounts),
    [playerId, players, matches, rosters, goalEvents, results, quarters, fineCounts]
  );

  if (rows.length === 0) return null;

  const rankChip = (rank: number | null, total: number) => {
    if (!rank) return <span className="text-muted-foreground">-</span>;
    const cls = rank === 1 ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
      : rank <= 3 ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border bg-secondary/50 text-muted-foreground";
    return (
      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
        {isEn ? `#${rank}` : `${rank}위`}<span className="ml-0.5 opacity-60">/{total}</span>
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg text-primary">📅 {L("시즌별 기록", "Season Stats")}</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {L("팀 내 순위는 해당 시즌 출전 선수 기준입니다.", "Ranks are calculated among all players who featured that season.")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-center text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">{L("시즌", "Season")}</th>
              <th className="px-2 py-2">{L("출전", "MP")}</th>
              <th className="px-2 py-2">{L("쿼터", "Q")}</th>
              <th className="px-2 py-2">{L("골", "G")}</th>
              <th className="px-2 py-2">{L("도움", "A")}</th>
              <th className="px-2 py-2">{L("무실점", "CS")}</th>
              <th className="px-2 py-2">{L("승무패", "W-D-L")}</th>
              <th className="px-2 py-2">{L("평점", "Rating")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.year} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 text-left font-display text-base text-foreground">{r.year}</td>
                <td className="px-2 py-2.5 text-foreground">{r.appearances}</td>
                <td className="px-2 py-2.5 text-muted-foreground">{r.quarters}</td>
                <td className="px-2 py-2.5 font-bold text-primary">{r.goals}</td>
                <td className="px-2 py-2.5 font-bold text-primary">{r.assists}</td>
                <td className="px-2 py-2.5 text-foreground">{r.cleanSheets}</td>
                <td className="px-2 py-2.5 text-muted-foreground">{r.wins}-{r.draws}-{r.losses}</td>
                <td className="px-2 py-2.5">
                  <span className={`font-display text-base ${r.rating >= 7.5 ? "text-green-400" : r.rating >= 6.8 ? "text-primary" : "text-foreground"}`}>
                    {r.rating.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {rows.map(r => (
          <div key={r.year} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
            <span className="font-display text-sm text-foreground">{r.year}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {L("득점 순위", "Goals rank")} {rankChip(r.goalRank, r.totalRanked)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {L("도움 순위", "Assists rank")} {rankChip(r.assistRank, r.totalRanked)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {L("평점 순위", "Rating rank")} {rankChip(r.ratingRank, r.totalRanked)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
