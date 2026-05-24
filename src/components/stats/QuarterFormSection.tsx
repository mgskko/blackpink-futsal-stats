import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Player, MatchQuarter } from "@/hooks/useFutsalData";
import { computeQuarterForm, generateTacticalComment, type PlayerQuarterForm } from "@/hooks/useQuarterFormStats";
import { LineChart as LineChartIcon } from "lucide-react";

type SortKey = "winRateDesc" | "winRateAsc" | "earlyStrong" | "lateStrong";

const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)" };

const QuarterFormSection = ({ players, allQuarters }: { players: Player[]; allQuarters: MatchQuarter[] }) => {
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
    return { name: `${q}Q`, 승: r.wins, 무: r.draws, 패: r.losses };
  }) : [];

  return (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
        <LineChartIcon size={18} /> 쿼터별 폼 (Form) 상세 분석
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        본인이 실제 필드에서 뛴 쿼터들의 승/무/패를 쪼개서 분석한 정밀 데이터 (최소 10쿼터 출전)
      </p>

      <div className="mb-3">
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="winRateDesc">📈 쿼터 승률 높은 순</SelectItem>
            <SelectItem value="winRateAsc">📉 쿼터 승률 낮은 순</SelectItem>
            <SelectItem value="earlyStrong">⏰ 1~2쿼터 강자 (초반형)</SelectItem>
            <SelectItem value="lateStrong">🔥 3쿼터+ 강자 (후반형)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {top10.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">데이터가 부족합니다</p>
        ) : top10.map((p, i) => {
          const mainPct = sortKey === "earlyStrong" ? p.earlyWinRate : sortKey === "lateStrong" ? p.lateWinRate : p.winRate;
          const mainLabel = sortKey === "earlyStrong" ? "1~2Q 승률" : sortKey === "lateStrong" ? "3Q+ 승률" : "쿼터 승률";
          return (
            <button key={p.playerId} onClick={() => setSelected(p)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-secondary text-left ${i < top10.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                <div>
                  <div className="text-sm font-medium text-foreground">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.totalQuarters}Q · {p.totalWins}승 {p.totalDraws}무 {p.totalLosses}패
                    {p.best && ` · 베스트 ${p.best.quarter}Q(${p.best.winRate}%)`}
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
            <DialogTitle className="text-primary">{selected?.name} · 쿼터별 폼 리포트</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-primary">{selected.winRate}%</div>
                  <div className="text-[9px] text-muted-foreground">전체 쿼터 승률</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-foreground">{selected.earlyWinRate}%</div>
                  <div className="text-[9px] text-muted-foreground">1~2Q 승률</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <div className="font-display text-lg text-foreground">{selected.lateWinRate}%</div>
                  <div className="text-[9px] text-muted-foreground">3Q+ 승률</div>
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
                    <Bar dataKey="승" stackId="a" fill="hsl(330 100% 71%)" />
                    <Bar dataKey="무" stackId="a" fill="hsl(0 0% 40%)" />
                    <Bar dataKey="패" stackId="a" fill="hsl(0 70% 50%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {selected.best && (
                <div className="text-xs text-foreground">
                  💪 필승 쿼터: <span className="text-primary font-bold">{selected.best.quarter}Q ({selected.best.winRate}%)</span> · {selected.best.played}회 출전
                </div>
              )}
              {selected.worst && selected.worst.quarter !== selected.best?.quarter && (
                <div className="text-xs text-foreground">
                  📉 부진 쿼터: <span className="text-destructive font-bold">{selected.worst.quarter}Q ({selected.worst.winRate}%)</span> · {selected.worst.played}회 출전
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] font-bold text-primary mb-1">🧠 전술 코멘트</div>
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