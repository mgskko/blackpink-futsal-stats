import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ChevronRight, Flame, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPlayerName } from "@/hooks/useFutsalData";
import type { Player, Match, Roster, GoalEvent } from "@/hooks/useFutsalData";
import { computeRecentForm, rankRecentForm, type FormMode } from "@/lib/recentForm";

interface Props {
  players: Player[];
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
}

export default function RecentFormBoard({ players, matches, rosters, goalEvents }: Props) {
  const [mode, setMode] = useState<FormMode>("fire");
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => isEn ? en : ko;
  const navigate = useNavigate();
  const entries = useMemo(() => computeRecentForm(players, matches, rosters, goalEvents), [players, matches, rosters, goalEvents]);
  const ranking = useMemo(() => rankRecentForm(entries, mode), [entries, mode]);
  const modes = [
    { key: "fire" as const, icon: Flame, label: L("최근 화력", "Firepower") },
    { key: "rise" as const, icon: TrendingUp, label: L("상승세", "Risers") },
    { key: "streak" as const, icon: Zap, label: L("연속 공포", "AP streak") },
  ];

  return (
    <section className="mb-8" aria-labelledby="recent-form-heading">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-primary">
            <Flame size={15} aria-hidden="true" /> FORM CHECK
          </div>
          <h2 id="recent-form-heading" className="text-xl font-bold text-foreground">{L("요즘 누가 미쳤나", "Who's on fire?")}</h2>
        </div>
        <span className="shrink-0 pt-1 text-[10px] text-muted-foreground">{L("10경기 이상 출전", "10+ appearances")}</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1 border-b border-border pb-3" role="group" aria-label={L("폼 순위 기준", "Form ranking metric")}>
        {modes.map(({ key, icon: Icon, label }) => (
          <Button key={key} variant={mode === key ? "secondary" : "ghost"} size="sm" aria-pressed={mode === key}
            onClick={() => setMode(key)} className={`min-w-0 px-2 text-xs ${mode === key ? "text-primary" : "text-muted-foreground"}`}>
            <Icon aria-hidden="true" /> {label}
          </Button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{mode === "fire" ? L("최근 출전 5경기 · 골 + 도움", "Last 5 appearances · goals + assists")
          : mode === "rise" ? L("직전 5경기 대비 · 경기당 공격포인트 증가", "AP/game increase vs preceding 5 appearances")
          : L("최근 출전부터 이어진 공격포인트 기록", "Consecutive appearances with an attack point")}</span>
        <span>{L("최근 5경기 →", "Last 5 →")}</span>
      </div>

      {ranking.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-b border-border py-8 text-center">
          <Flame className="text-muted-foreground" size={24} />
          <p className="text-sm text-muted-foreground">{entries.length === 0
            ? L("선택한 기간에 10경기 이상 출전한 선수가 없습니다.", "No players with 10 appearances in this selection.")
            : L("아직 이 순위에 해당하는 기록이 없습니다.", "No qualifying records yet.")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry, index) => {
            const name = getPlayerName(players, entry.player.id, lang);
            return (
              <Button key={entry.player.id} variant="ghost" onClick={() => navigate(`/player/${entry.player.id}`)}
                aria-label={L(`${name} 선수 프로필`, `${name} player profile`)}
                className={`h-auto w-full justify-start gap-3 whitespace-normal rounded-lg border px-3 py-3 text-left ${index === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"}`}>
                <span className={`w-3 shrink-0 text-xs font-bold tabular-nums ${index === 0 ? "text-primary" : "text-muted-foreground"}`}>{index + 1}</span>
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={entry.player.profile_image_url ?? undefined} alt={name} className="object-cover" />
                  <AvatarFallback className="text-xs text-muted-foreground">{entry.player.back_number ?? name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-lg font-bold tabular-nums text-primary">
                      {mode === "fire" ? entry.recentAP : mode === "rise" ? `+${entry.improvement.toFixed(1)}` : entry.streak}
                      {mode === "rise" && <ArrowUpRight aria-hidden="true" />}
                      <span className="text-[10px] font-medium">{mode === "fire" ? "AP" : mode === "streak" ? L("경기", "GP") : "AP/GP"}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">{entry.recentGoals}{L("골", " G")} · {entry.recentAssists}{L("도움", " A")}</span>
                    <div className="flex shrink-0 gap-1" aria-label={L("최근 5경기 공격포인트, 오래된 경기부터", "Last 5 AP totals, oldest first")}>
                      {[...entry.recent].reverse().map(m => (
                        <span key={m.matchId} title={`${m.date} · ${m.goals}G ${m.assists}A`}
                          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold tabular-nums ${m.ap > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {m.ap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ChevronRight className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}