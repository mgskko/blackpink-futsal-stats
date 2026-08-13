import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Match, Roster, GoalEvent, Player, Team, Result, MatchQuarter } from "@/hooks/useFutsalData";
import { computePOTMWinners } from "@/lib/potm";
import { computeSeasonTitles, computeBallonDor, type TitleKind, type TitleScope } from "@/lib/awards";

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

const KIND_META: Record<TitleKind, { emoji: string; ko: string; en: string; unit: [string, string] }> = {
  goals: { emoji: "💥", ko: "득점왕", en: "Golden Boot", unit: ["골", "G"] },
  assists: { emoji: "🅰️", ko: "도움왕", en: "Playmaker", unit: ["도움", "A"] },
  apps: { emoji: "🏟️", ko: "출석왕", en: "Most Appearances", unit: ["경기", "MP"] },
};

export default function PlayerTrophies({ playerId, players, matches, rosters, goalEvents, teams, results, quarters, isEn }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);

  const potmWinnersAll = useMemo(
    () => computePOTMWinners(players, matches, teams ?? [], results ?? [], rosters, goalEvents, quarters ?? []),
    [players, matches, teams, results, rosters, goalEvents, quarters]
  );
  const potmWins = useMemo(() => potmWinnersAll.filter(w => w.player.id === playerId), [potmWinnersAll, playerId]);

  const ballonDor = useMemo(
    () => computeBallonDor(players, matches, teams ?? [], results ?? [], rosters, goalEvents, quarters ?? []),
    [players, matches, teams, results, rosters, goalEvents, quarters]
  );

  const mvpRows: TrophyRow[] = useMemo(() => {
    const rows: TrophyRow[] = [];
    ballonDor.forEach(s => {
      const me = s.entries.find(e => e.playerId === playerId);
      if (me && me.rank === 1) {
        rows.push({
          emoji: "🥇",
          title: `${s.year} ${L("발롱도르 (시즌 MVP)", "Ballon d'Or (Season MVP)")}`,
          meta: `${me.goals}${L("골", "G")} · ${me.assists}${L("도움", "A")} · ${L("포인트", "Pts")} ${me.score}`,
        });
      }
    });
    return rows;
  }, [ballonDor, playerId, isEn]);

  const titleRows = useMemo(() => {
    const all = computeSeasonTitles(players, matches, rosters, goalEvents).filter(t => t.playerId === playerId);
    const label = (scope: TitleScope, year?: number) =>
      scope === "career" ? L("종합", "All-time") : scope === "custom" ? `${year} ${L("자체전", "Intrasquad")}` : `${year}`;
    const group = (scope: TitleScope) =>
      all.filter(t => t.scope === scope)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .map(t => {
          const m = KIND_META[t.kind];
          return {
            emoji: t.scope === "career" ? "🏅" : m.emoji,
            title: `${label(t.scope, t.year)} ${L(m.ko, m.en)}`,
            meta: `${t.value}${L(m.unit[0], m.unit[1])}`,
          } as TrophyRow;
        });
    return { career: group("career"), year: group("year"), custom: group("custom") };
  }, [playerId, players, matches, rosters, goalEvents, isEn]);

  const totalTitles = titleRows.career.length + titleRows.year.length + titleRows.custom.length;
  if (totalTitles === 0 && potmWins.length === 0 && mvpRows.length === 0) return null;

  const sectionHead = (text: string) => (
    <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-foreground">{text}</div>
  );

  const list = (rows: TrophyRow[]) => (
    <div>
      {rows.map((t, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
          <span className="text-base">{t.emoji}</span>
          <span className="flex-1 text-sm text-foreground">{t.title}</span>
          <span className="text-[10px] text-muted-foreground">{t.meta}</span>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary">🏆 {L("트로피", "Trophies")}</h3>

      {mvpRows.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-amber-400/40">
          {sectionHead(L(`발롱도르 · ${mvpRows.length}회`, `Ballon d'Or · ${mvpRows.length}`))}
          {list(mvpRows)}
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
                  {w.goals}{L("골", "G")} · {w.assists}{L("도움", "A")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {titleRows.career.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-primary/30">
          {sectionHead(L(`종합 타이틀 · ${titleRows.career.length}개`, `All-time Titles · ${titleRows.career.length}`))}
          {list(titleRows.career)}
        </div>
      )}

      {titleRows.year.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-border">
          {sectionHead(L(`시즌 타이틀 · ${titleRows.year.length}개`, `Season Titles · ${titleRows.year.length}`))}
          {list(titleRows.year)}
        </div>
      )}

      {titleRows.custom.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {sectionHead(L(`자체전 타이틀 · ${titleRows.custom.length}개`, `Intrasquad Titles · ${titleRows.custom.length}`))}
          {list(titleRows.custom)}
        </div>
      )}
    </motion.div>
  );
}
