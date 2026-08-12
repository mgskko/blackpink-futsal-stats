import { useMemo } from "react";
import { motion } from "framer-motion";
import { computeMatchAP } from "@/hooks/useFutsalData";
import type { Match, Roster, GoalEvent, Result, MatchQuarter, Player } from "@/hooks/useFutsalData";
import { getPlayerPosition, getPlayerTeamInLineup } from "@/hooks/useCourtStats";

export function computeRating(goals: number, assists: number, appearances: number, winRate: number) {
  if (appearances === 0) return 6.0;
  const apPerGame = (goals + assists) / appearances;
  const raw = 6.0 + apPerGame * 0.45 + (winRate / 100) * 0.9;
  return Math.max(5, Math.min(10, Math.round(raw * 100) / 100));
}

export interface SeasonRow {
  year: string;
  appearances: number;
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

interface AggRow { goals: number; assists: number; appearances: number; wins: number; draws: number; losses: number; cleanSheets: number }

function emptyAgg(): AggRow {
  return { goals: 0, assists: 0, appearances: 0, wins: 0, draws: 0, losses: 0, cleanSheets: 0 };
}

export function buildSeasonRows(
  playerId: number,
  players: Player[],
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  results: Result[],
  quarters: MatchQuarter[],
): SeasonRow[] {
  const today = new Date().toISOString().slice(0, 10);
  const played = matches.filter(m => m.date <= today);
  const eligible = players.filter(p => !/^용병\d*$/.test(p.name));
  const eligibleIds = new Set(eligible.map(p => p.id));

  // year -> playerId -> agg
  const byYear = new Map<string, Map<number, AggRow>>();

  played.forEach(m => {
    const year = m.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, new Map());
    const bucket = byYear.get(year)!;
    const matchRosters = rosters.filter(r => r.match_id === m.id);
    const seen = new Set<number>();
    matchRosters.forEach(r => {
      if (!eligibleIds.has(r.player_id) || seen.has(r.player_id)) return;
      seen.add(r.player_id);
      const agg = bucket.get(r.player_id) ?? emptyAgg();
      const ap = computeMatchAP(r.player_id, m, rosters, goalEvents);
      agg.goals += ap.goals;
      agg.assists += ap.assists;
      agg.appearances += 1;
      const res = results.find(x => x.match_id === m.id && x.team_id === r.team_id);
      if (res?.result === "승") agg.wins++;
      else if (res?.result === "패") agg.losses++;
      else if (res?.result === "무") agg.draws++;
      // clean sheet quarters as GK/DF
      quarters.filter(q => q.match_id === m.id).forEach(q => {
        const pos = getPlayerPosition(q.lineup, r.player_id);
        if (pos !== "GK" && pos !== "DF") return;
        const team = getPlayerTeamInLineup(q.lineup, r.player_id);
        const conceded = team === "teamB" ? (q.score_for || 0) : (q.score_against || 0);
        if (conceded === 0) agg.cleanSheets++;
      });
      bucket.set(r.player_id, agg);
    });
  });

  const rows: SeasonRow[] = [];
  [...byYear.keys()].sort((a, b) => b.localeCompare(a)).forEach(year => {
    const bucket = byYear.get(year)!;
    const mine = bucket.get(playerId);
    if (!mine) return;
    const entries = [...bucket.entries()].map(([id, a]) => {
      const total = a.wins + a.draws + a.losses;
      const winRate = total > 0 ? Math.round((a.wins / total) * 100) : 0;
      return { id, ...a, winRate, rating: computeRating(a.goals, a.assists, a.appearances, winRate) };
    });
    const rankOf = (key: "goals" | "assists" | "rating") => {
      const sorted = [...entries].sort((a, b) => (b[key] as number) - (a[key] as number));
      const idx = sorted.findIndex(e => e.id === playerId);
      if (idx < 0) return null;
      const val = sorted[idx][key] as number;
      return sorted.findIndex(e => (e[key] as number) === val) + 1;
    };
    const me = entries.find(e => e.id === playerId)!;
    rows.push({
      year,
      appearances: me.appearances,
      goals: me.goals,
      assists: me.assists,
      cleanSheets: me.cleanSheets,
      wins: me.wins,
      draws: me.draws,
      losses: me.losses,
      winRate: me.winRate,
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
  playerId: number;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  results: Result[];
  quarters: MatchQuarter[];
}

export default function SeasonStatsTable({ isEn, playerId, players, matches, rosters, goalEvents, results, quarters }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const rows = useMemo(
    () => buildSeasonRows(playerId, players, matches, rosters, goalEvents, results, quarters),
    [playerId, players, matches, rosters, goalEvents, results, quarters]
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
