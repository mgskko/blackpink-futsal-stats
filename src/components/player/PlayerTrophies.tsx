import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent, Player } from "@/hooks/useFutsalData";

interface Props {
  playerId: number;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  momVotes?: { match_id: number; voted_player_id: number }[];
  isEn: boolean;
}

export default function PlayerTrophies({ playerId, players, matches, rosters, goalEvents, momVotes, isEn }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);

  const { momByYear, seasonTitles } = useMemo(() => {
    const matchById = new Map(matches.map(m => [m.id, m]));

    // MOM wins (vote winner per match)
    const perMatch = new Map<number, Map<number, number>>();
    (momVotes ?? []).forEach(v => {
      const m = perMatch.get(v.match_id) ?? new Map<number, number>();
      m.set(v.voted_player_id, (m.get(v.voted_player_id) ?? 0) + 1);
      perMatch.set(v.match_id, m);
    });
    const momByYear = new Map<string, number>();
    perMatch.forEach((votes, matchId) => {
      const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[0] === playerId) {
        const y = matchById.get(matchId)?.date.slice(0, 4) ?? "?";
        momByYear.set(y, (momByYear.get(y) ?? 0) + 1);
      }
    });

    // Season titles: top scorer / top assister / most appearances per year
    const years = [...new Set(matches.map(m => m.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
    const activeIds = new Set(players.filter(p => !/용병/.test(p.name)).map(p => p.id));
    const seasonTitles: { year: string; title: string; value: number }[] = [];

    years.forEach(y => {
      const yMatchIds = new Set(matches.filter(m => m.date.startsWith(y)).map(m => m.id));
      const goals = new Map<number, number>(), assists = new Map<number, number>(), apps = new Map<number, number>();
      goalEvents.forEach(g => {
        if (!yMatchIds.has(g.match_id)) return;
        if (g.goal_player_id && !g.is_own_goal && activeIds.has(g.goal_player_id)) goals.set(g.goal_player_id, (goals.get(g.goal_player_id) ?? 0) + 1);
        if (g.assist_player_id && activeIds.has(g.assist_player_id)) assists.set(g.assist_player_id, (assists.get(g.assist_player_id) ?? 0) + 1);
      });
      const seen = new Set<string>();
      rosters.forEach(r => {
        if (!yMatchIds.has(r.match_id) || !activeIds.has(r.player_id)) return;
        const key = `${r.match_id}:${r.player_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        apps.set(r.player_id, (apps.get(r.player_id) ?? 0) + 1);
      });
      const winner = (m: Map<number, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const g = winner(goals), a = winner(assists), p = winner(apps);
      if (g && g[0] === playerId && g[1] > 0) seasonTitles.push({ year: y, title: L("득점왕", "Golden Boot"), value: g[1] });
      if (a && a[0] === playerId && a[1] > 0) seasonTitles.push({ year: y, title: L("도움왕", "Playmaker"), value: a[1] });
      if (p && p[0] === playerId && p[1] > 0) seasonTitles.push({ year: y, title: L("최다 출전", "Most Appearances"), value: p[1] });
    });

    return { momByYear, seasonTitles };
  }, [playerId, players, matches, rosters, goalEvents, momVotes, isEn]);

  const momRows = [...momByYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  if (momRows.length === 0 && seasonTitles.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">🏆 {L("트로피", "Trophies")}</h3>

      {seasonTitles.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-foreground">
            {L("버니즈FC · 시즌 타이틀", "Bunnies FC · Season Titles")}
          </div>
          {seasonTitles.map((t, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
              <span className="w-4 text-sm font-bold text-foreground">1</span>
              <span className="text-base">🏆</span>
              <span className="flex-1 text-sm text-foreground">{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.year} · {t.value}</span>
            </div>
          ))}
        </div>
      )}

      {momRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-foreground">
            {L("MOM 수상", "Man of the Match")}
          </div>
          {momRows.map(([year, count]) => (
            <div key={year} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
              <span className="w-4 text-sm font-bold text-foreground">{count}</span>
              <span className="text-base">🥇</span>
              <span className="flex-1 text-sm text-foreground">{L("이 달의 선수 MOM", "Man of the Match")}</span>
              <span className="text-xs text-muted-foreground">({year})</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}