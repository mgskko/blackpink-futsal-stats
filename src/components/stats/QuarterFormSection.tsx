import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Player, MatchQuarter } from "@/hooks/useFutsalData";
import { computeQuarterForm, generateTacticalComment, type PlayerQuarterForm } from "@/hooks/useQuarterFormStats";
import { LineChart as LineChartIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type SortKey = "winRateDesc" | "winRateAsc" | "earlyStrong" | "lateStrong";

const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)" };

const QuarterFormSection = ({ players, allQuarters }: { players: Player[]; allQuarters: MatchQuarter[] }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const nm = (id: number) => {
    const p = players.find(pp => pp.id === id);
    if (!p) return "";
    if (isEn && p.name_en && p.name_en.trim()) return p.name_en;
    return p.name;
  };
  const [sortKey, setSortKey] = useState<SortKey>("winRateDesc");
  const [selected, setSelected] = useState<PlayerQuarterForm | null>(null);

  const data = useMemo(() => computeQuarterForm(players, allQuarters).filter(d => d.totalQuarters >= 10), [players, allQuarters]);

  const sorted = useMemo(() => {
    const arr = [...data];
    switch (sortKey) {
      case "winRateDesc": return arr.sort((a, b) => b.winRate - a.winRate);
      case "winRateAsc": return arr.sort((a, b) => a.winRate - b.winRate);
      case "earlyStrong": return arr.filter(d => d.earlyQuarters >= 3).sort((a, b) => b.earlyWinRate - a.earlyWinRate);
      case "lateStrong": return arr.filter(d => d.lateQuarters >= 3).sort((a, b) => b.lateWinRate - a.lateWinRate);
    }
  }, [data, sortKey]);

  const top10 = sorted.slice(0, 10);

  const chartData = selected ? Object.keys(selected.perQuarter).map(Number).sort((a, b) => a - b).map(q => {
    const r = selected.perQuarter[q];
    return { name: `${q}Q`, [L("승", "W")]: r.wins, [L("무", "D")]: r.draws, [L("패", "L")]: r.losses };
  }) : [];

  return (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
        <LineChartIcon size={18} /> {L("쿼터별 폼 (Form) 상세 분석", "Quarter-by-Quarter Form Report")}
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {L("본인이 실제 필드에서 뛴 쿼터들의 승/무/패를 쪼개서 분석한 정밀 데이터 (최소 10쿼터 출전)", "Precise W/D/L splits for quarters the player actually played (min. 10 quarters)")}
      </p>

      <div className="mb-3">
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="winRateDesc">📈 {L("쿼터 승률 높은 순", "Highest Quarter Win%")}</SelectItem>
            <SelectItem value="winRateAsc">📉 {L("쿼터 승률 낮은 순", "Lowest Quarter Win%")}</SelectItem>
            <SelectItem value="earlyStrong">⏰ {L("1~2쿼터 강자 (초반형)", "Early-Quarter Specialist (1–2Q)")}</SelectItem>
            <SelectItem value="lateStrong">🔥 {L("3쿼터+ 강자 (후반형)", "Late-Quarter Specialist (3Q+)")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {top10.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">{L("데이터가 부족합니다", "Not enough data")}</p>
        ) : top10.map((p, i) => {
          const mainPct = sortKey === "earlyStrong" ? p.earlyWinRate : sortKey === "lateStrong" ? p.lateWinRate : p.winRate;
          const mainLabel = sortKey === "earlyStrong" ? L("1~2Q 승률", "1–2Q Win%") : sortKey === "lateStrong" ? L("3Q+ 승률", "3Q+ Win%") : L("쿼터 승률", "Quarter Win%");
          return (
            <button key={p.playerId} onClick={() => setSelected(p)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-secondary text-left ${i < top10.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                <div>
                  <div className="text-sm font-medium text-foreground">{nm(p.playerId)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.totalQuarters}Q · {p.totalWins}{L("승", "W")} {p.totalDraws}{L("무", "D")} {p.totalLosses}{L("패", "L")}
                    {p.best && ` · ${L("베스트", "Best")} ${p.best.quarter}Q(${p.best.winRate}%)`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-display text-lg ${mainPct >= 60 ? "text-primary text-glow" : mainPct <= 30 ? "text-destructive" : "text-foreground"}`}>{mainPct}%</div>
                <div className="text-[9px] text-muted-foreground">{mainLabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">{selected ? nm(selected.playerId) : ""} · {L("쿼터별 폼 리포트", "Quarter Form Report")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-primary">{selected.winRate}%</div>
                  <div className="text-[9px] text-muted-foreground">{L("전체 쿼터 승률", "Overall Q Win%")}</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-foreground">{selected.earlyWinRate}%</div>
                  <div className="text-[9px] text-muted-foreground">{L("1~2Q 승률", "1–2Q Win%")}</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-foreground">{selected.lateWinRate}%</div>
                  <div className="text-[9px] text-muted-foreground">{L("3Q+ 승률", "3Q+ Win%")}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                    <XAxis dataKey="name" stroke="hsl(0 0% 50%)" fontSize={11} />
                    <YAxis stroke="hsl(0 0% 50%)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey={L("승", "W")} stackId="a" fill="hsl(330 100% 71%)" />
                    <Bar dataKey={L("무", "D")} stackId="a" fill="hsl(0 0% 40%)" />
                    <Bar dataKey={L("패", "L")} stackId="a" fill="hsl(0 70% 50%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {selected.best && (
                <div className="text-xs text-foreground">
                  💪 {L("필승 쿼터", "Best quarter")}: <span className="text-primary font-bold">{selected.best.quarter}Q ({selected.best.winRate}%)</span> · {selected.best.played}{L("회 출전", " played")}
                </div>
              )}
              {selected.worst && selected.worst.quarter !== selected.best?.quarter && (
                <div className="text-xs text-foreground">
                  📉 {L("부진 쿼터", "Worst quarter")}: <span className="text-destructive font-bold">{selected.worst.quarter}Q ({selected.worst.winRate}%)</span> · {selected.worst.played}{L("회 출전", " played")}
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] font-bold text-primary mb-1">🧠 {L("전술 코멘트", "Tactical Comment")}</div>
                <p className="text-xs text-foreground leading-relaxed">{generateTacticalComment(selected)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuarterFormSection;