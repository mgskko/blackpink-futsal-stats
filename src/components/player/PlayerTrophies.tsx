import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent, Player, Team, Result, MatchQuarter } from "@/hooks/useFutsalData";
import { computeNonDuplicatedAP } from "@/hooks/useFutsalData";
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
  isEn: boolean;
}

interface TrophyRow { emoji: string; title: string; meta: string }

export default function PlayerTrophies({ playerId, players, matches, rosters, goalEvents, teams, results, quarters, isEn }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);

  // ── Player of the Month wins, sourced from the same archive as the Statistics tab ──
  const potmWins = useMemo(
    () => computePOTMWinners(players, matches, teams ?? [], results ?? [], rosters, goalEvents, quarters ?? [])
      .filter(w => w.player.id === playerId),
    [playerId, players, matches, teams, results, rosters, goalEvents, quarters]
  );

  const { seasonTrophies, mvpRows } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const played = (matches ?? []).filter(m => m?.date && m.date <= today);

    const eligible = (players ?? []).filter(p => p && !(p as any).is_guest && !/^용병\d*$/.test(p.name));

    // Season/career tally for every eligible player using the non-duplicating AP rule
    const tally = (scopeMatches: Match[]) => {
      const ids = new Set(scopeMatches.map(m => m.id));
      const scopedRosters = rosters.filter(r => ids.has(r.match_id));
      const scopedEvents = goalEvents.filter(g => ids.has(g.match_id));
      const goals = new Map<number, number>(), assists = new Map<number, number>(), apps = new Map<number, number>();
      eligible.forEach(p => {
        const ap = computeNonDuplicatedAP(p.id, scopeMatches, scopedRosters, scopedEvents);
        if (ap.goals) goals.set(p.id, ap.goals);
        if (ap.assists) assists.set(p.id, ap.assists);
        const n = new Set(scopedRosters.filter(r => r.player_id === p.id).map(r => r.match_id)).size;
        if (n) apps.set(p.id, n);
      });
      return { goals, assists, apps };
    };
    // Winners: ties all count as winners
    const winners = (m: Map<number, number>) => {
      const top = Math.max(0, ...m.values());
      return top > 0 ? [...m.entries()].filter(([, v]) => v === top) : [];
    };

    const seasonTrophies: TrophyRow[] = [];

    // Career-wide (종합) titles
    const career = tally(played);
    const careerDefs: { key: keyof typeof career; emoji: string; ko: string; en: string; unit: [string, string] }[] = [
      { key: "goals", emoji: "🏅", ko: "종합 득점왕", en: "All-time Top Scorer", unit: ["골", "G"] },
      { key: "assists", emoji: "🏅", ko: "종합 도움왕", en: "All-time Top Assister", unit: ["도움", "A"] },
      { key: "apps", emoji: "🏅", ko: "종합 출석왕", en: "All-time Most Appearances", unit: ["경기", "MP"] },
    ];
    careerDefs.forEach(d => {
      const w = winners(career[d.key]).find(([id]) => id === playerId);
      if (w) seasonTrophies.push({ emoji: d.emoji, title: L(d.ko, d.en), meta: `${L("통산", "Career")} · ${w[1]}${L(d.unit[0], d.unit[1])}` });
    });

    // Season titles + Season MVP (Ballon d'Or concept), newest first
    const years = [...new Set(played.map(m => m.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
    const mvpRows: TrophyRow[] = [];

    years.forEach(y => {
      const yearMatches = played.filter(m => m.date.startsWith(y));
      const { goals, assists, apps } = tally(yearMatches);

      winners(goals).forEach(([id, v]) => { if (id === playerId) seasonTrophies.push({ emoji: "💥", title: `${y} ${L("공포왕", "Golden Boot")}`, meta: `${v}${L("골", "G")}` }); });
      winners(assists).forEach(([id, v]) => { if (id === playerId) seasonTrophies.push({ emoji: "🅰️", title: `${y} ${L("도움왕", "Playmaker")}`, meta: `${v}${L("도움", "A")}` }); });
      winners(apps).forEach(([id, v]) => { if (id === playerId) seasonTrophies.push({ emoji: "🏟️", title: `${y} ${L("출석왕", "Most Appearances")}`, meta: `${v}${L("경기", "MP")}` }); });

      // Season MVP: Ballon d'Or style composite — goals x3 + assists x2 + appearances x1 + POTM x5
      const potmByPlayer = new Map<number, number>();
      potmWinnersAll.forEach(w => {
        if (w.year === Number(y)) potmByPlayer.set(w.player.id, (potmByPlayer.get(w.player.id) ?? 0) + 1);
      });
      let bestId = 0, bestScore = 0, bestG = 0, bestA = 0;
      eligible.forEach(p => {
        const g = goals.get(p.id) ?? 0, a = assists.get(p.id) ?? 0, mp = apps.get(p.id) ?? 0;
        if (mp < 2) return;
        const score = g * 3 + a * 2 + mp + (potmByPlayer.get(p.id) ?? 0) * 5;
        if (score > bestScore) { bestScore = score; bestId = p.id; bestG = g; bestA = a; }
      });
      if (bestScore > 0 && bestId === playerId) {
        mvpRows.push({
          emoji: "🥇",
          title: `${y} ${L("시즌 MVP", "Season MVP")}`,
          meta: `${bestG}${L("골", "G")} · ${bestA}${L("도움", "A")} · ${L("포인트", "Pts")} ${bestScore}`,
        });
      }
    });

    return { seasonTrophies, mvpRows };
    // potmWinnersAll captured below
  }, [playerId, players, matches, rosters, goalEvents, isEn, quarters, teams, results]);

  if (seasonTrophies.length === 0 && potmWins.length === 0 && mvpRows.length === 0) return null;

  const sectionHead = (text: string) => (
    <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-foreground">{text}</div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">🏆 {L("트로피", "Trophies")}</h3>

      {mvpRows.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-amber-400/40">
          {sectionHead(L(`시즌 MVP (발롱도르) · ${mvpRows.length}회`, `Season MVP (Ballon d'Or) · ${mvpRows.length}`))}
          <div>
            {mvpRows.map((t, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                <span className="text-base">{t.emoji}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">{t.title}</span>
                <span className="text-[10px] text-muted-foreground">{t.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {potmWins.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-yellow-500/30">
          {sectionHead(L(`이달의 선수 (POTM) · ${potmWins.length}회`, `Player of the Month · ${potmWins.length}`))}
          <div>
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
        <div className="overflow-hidden rounded-xl border border-border">
          {sectionHead(L(`버니즈 시즌 트로피 · ${seasonTrophies.length}개`, `Bunnies Season Trophies · ${seasonTrophies.length}`))}
          <div>
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
    </motion.div>
  );
}
