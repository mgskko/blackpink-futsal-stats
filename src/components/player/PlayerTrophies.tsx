import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent, Player, Team, Result, MatchQuarter } from "@/hooks/useFutsalData";
import { computePOTMWinners } from "@/lib/potm";

interface Props {
  playerId: number;
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  teams?: Team[];
  results?: Result[];
  quarters?: MatchQuarter[];
  momVotes?: { match_id: number; voted_player_id: number }[];
  isEn: boolean;
}

interface TrophyRow { emoji: string; title: string; meta: string }

export default function PlayerTrophies({ playerId, players, matches, rosters, goalEvents, teams, results, quarters, momVotes, isEn }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);

  // ── Player of the Month wins, sourced from the same archive as the Statistics tab ──
  const potmWins = useMemo(
    () => computePOTMWinners(players, matches, teams ?? [], results ?? [], rosters, goalEvents, quarters ?? [])
      .filter(w => w.player.id === playerId),
    [playerId, players, matches, teams, results, rosters, goalEvents, quarters]
  );

  const { momByYear, seasonTrophies } = useMemo(() => {
    const matchById = new Map(matches.map(m => [m.id, m]));

    // MOM votes won per match
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

    const activeIds = new Set(players.filter(p => !/^용병\d*$/.test(p.name)).map(p => p.id));
    const tally = (matchIds: Set<number>) => {
      const goals = new Map<number, number>(), assists = new Map<number, number>(), apps = new Map<number, number>();
      goalEvents.forEach(g => {
        if (!matchIds.has(g.match_id)) return;
        if (g.goal_player_id && !g.is_own_goal && activeIds.has(g.goal_player_id)) goals.set(g.goal_player_id, (goals.get(g.goal_player_id) ?? 0) + 1);
        if (g.assist_player_id && activeIds.has(g.assist_player_id)) assists.set(g.assist_player_id, (assists.get(g.assist_player_id) ?? 0) + 1);
      });
      const seen = new Set<string>();
      rosters.forEach(r => {
        if (!matchIds.has(r.match_id) || !activeIds.has(r.player_id)) return;
        const key = `${r.match_id}:${r.player_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        apps.set(r.player_id, (apps.get(r.player_id) ?? 0) + 1);
      });
      return { goals, assists, apps };
    };
    const winner = (m: Map<number, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];

    const seasonTrophies: TrophyRow[] = [];

    // Career-wide (종합) titles
    const allIds = new Set(matches.map(m => m.id));
    const career = tally(allIds);
    const careerDefs: { key: keyof typeof career; emoji: string; ko: string; en: string; unit: [string, string] }[] = [
      { key: "goals", emoji: "🏅", ko: "종합 득점왕", en: "All-time Top Scorer", unit: ["골", "G"] },
      { key: "assists", emoji: "🏅", ko: "종합 도움왕", en: "All-time Top Assister", unit: ["도움", "A"] },
      { key: "apps", emoji: "🏅", ko: "종합 출석왕", en: "All-time Most Appearances", unit: ["경기", "MP"] },
    ];
    careerDefs.forEach(d => {
      const w = winner(career[d.key]);
      if (w && w[0] === playerId && w[1] > 0) {
        seasonTrophies.push({ emoji: d.emoji, title: L(d.ko, d.en), meta: `${L("통산", "Career")} · ${w[1]}${L(d.unit[0], d.unit[1])}` });
      }
    });

    // Season titles, newest first
    const years = [...new Set(matches.map(m => m.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
    years.forEach(y => {
      const ids = new Set(matches.filter(m => m.date.startsWith(y)).map(m => m.id));
      const { goals, assists, apps } = tally(ids);
      const g = winner(goals), a = winner(assists), p = winner(apps);
      if (g && g[0] === playerId && g[1] > 0) seasonTrophies.push({ emoji: "💥", title: `${y} ${L("공포왕", "Golden Boot")}`, meta: `${g[1]}${L("골", "G")}` });
      if (a && a[0] === playerId && a[1] > 0) seasonTrophies.push({ emoji: "🅰️", title: `${y} ${L("도움왕", "Playmaker")}`, meta: `${a[1]}${L("도움", "A")}` });
      if (p && p[0] === playerId && p[1] > 0) seasonTrophies.push({ emoji: "🏟️", title: `${y} ${L("출석왕", "Most Appearances")}`, meta: `${p[1]}${L("경기", "MP")}` });
    });

    return { momByYear, seasonTrophies };
  }, [playerId, players, matches, rosters, goalEvents, momVotes, isEn]);

  const momRows = [...momByYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  if (momRows.length === 0 && seasonTrophies.length === 0 && potmWins.length === 0) return null;

  const sectionHead = (text: string) => (
    <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-foreground">{text}</div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">🏆 {L("트로피", "Trophies")}</h3>

      {potmWins.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-yellow-500/30">
          {sectionHead(L(`이달의 선수 (POTM) · ${potmWins.length}회`, `Player of the Month · ${potmWins.length}`))}
          <div className="max-h-72 overflow-y-auto">
            {potmWins.map(w => (
              <div key={w.prefix} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                <span className="text-base">🏆</span>
                <span className="flex-1 text-sm text-foreground">
                  {isEn ? `${w.year}.${String(w.month).padStart(2, "0")} POTM` : `${w.year}년 ${w.month}월 이달의 선수`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {w.goals}{L("골", "G")} · {w.assists}{L("도움", "A")} · MOM {w.momCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {seasonTrophies.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-border">
          {sectionHead(L("버니즈 시즌 트로피", "Bunnies Season Trophies"))}
          <div className="max-h-80 overflow-y-auto">
            {seasonTrophies.map((t, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                <span className="text-base">{t.emoji}</span>
                <span className="flex-1 text-sm text-foreground">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {momRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {sectionHead(L("MOM 투표 수상", "Man of the Match (votes)"))}
          <div className="max-h-72 overflow-y-auto">
            {momRows.map(([year, count]) => (
              <div key={year} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                <span className="w-4 text-sm font-bold text-foreground">{count}</span>
                <span className="text-base">🥇</span>
                <span className="flex-1 text-sm text-foreground">{L("경기 MVP", "Man of the Match")}</span>
                <span className="text-xs text-muted-foreground">({year})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
