import { useMemo } from "react";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDisplayName } from "@/lib/displayName";
import { useFines, summarizeFines, FineType, fineLabel, formatKRW, PlayerFine } from "@/hooks/useFines";
import type { Player } from "@/hooks/useFutsalData";

const TYPES: FineType[] = ["late", "no_show", "late_cancel"];

const FinesBoard = ({ players }: { players: Player[] }) => {
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const displayName = useDisplayName();
  const { data: fines = [] } = useFines();

  const rows = useMemo(() => {
    const byPlayer = new Map<number, PlayerFine[]>();
    fines.forEach(f => {
      if (!players.some(p => p.id === f.player_id)) return;
      byPlayer.set(f.player_id, [...(byPlayer.get(f.player_id) ?? []), f]);
    });
    return [...byPlayer.entries()]
      .map(([id, list]) => {
        const p = players.find(x => x.id === id)!;
        return { player: p, ...summarizeFines(list) };
      })
      .filter(r => r.total > 0 || r.waivedCount > 0)
      .sort((a, b) => b.total - a.total);
  }, [fines, players]);

  const team = useMemo(() => summarizeFines(fines.filter(f => players.some(p => p.id === f.player_id))), [fines, players]);

  return (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
        <Coins size={18} /> {L("벌금 현황판", "Fine System Board")}
      </h3>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("팀 누적 벌금", "Team Total")}</div>
          <div className="text-sm font-bold text-primary">{formatKRW(team.total, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("납부", "Paid")}</div>
          <div className="text-sm font-bold text-foreground">{formatKRW(team.paid, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("미납", "Unpaid")}</div>
          <div className="text-sm font-bold text-destructive">{formatKRW(team.unpaid, isEn)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-center text-xs text-muted-foreground">
          {L("등록된 벌금 내역이 없습니다", "No fines recorded yet")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.player.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-display text-sm ${i === 0 ? "text-primary text-glow" : "text-muted-foreground"}`}>#{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{displayName(r.player)}</span>
                </div>
                <span className="font-display text-lg text-primary">{formatKRW(r.total, isEn)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {TYPES.map(t => (
                  <span key={t}>{fineLabel(t, isEn)} {r.counts[t]}{isEn ? "" : "회"}</span>
                ))}
                <span className={r.unpaid > 0 ? "text-destructive" : "text-primary"}>
                  {r.unpaid > 0 ? `${L("미납", "Unpaid")} ${formatKRW(r.unpaid, isEn)}` : L("완납", "Settled")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FinesBoard;
