import { useState, useMemo } from "react";
import type { Player, MatchQuarter, GoalEvent } from "@/hooks/useFutsalData";
import { analyzeChemistry } from "@/hooks/useChemistryStats";
import { X, AlertTriangle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  players: Player[];
  allQuarters: MatchQuarter[];
  goalEvents: GoalEvent[];
}

export default function ChemistryAnalyzer({ players, allQuarters, goalEvents }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const activePlayers = useMemo(
    () => players.filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [players]
  );

  const result = useMemo(
    () => analyzeChemistry(players, allQuarters, goalEvents, selectedIds),
    [players, allQuarters, goalEvents, selectedIds]
  );

  const togglePlayer = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const filtered = search
    ? activePlayers.filter(p => p.name.includes(search))
    : activePlayers;

  const dangerApart = result && result.apartQuarters >= 5 && result.winRate < result.apartWinRate;

  return (
    <div className="mb-8 rounded-2xl border border-primary/30 bg-card p-4 box-glow">
      <h3 className="mb-1 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
        <Sparkles className="h-5 w-5" /> 케미 분석기
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">선수 2~3명을 골라 호흡을 냉정하게 진단하세요.</p>

      {/* Selected chips */}
      <div className="mb-3 flex flex-wrap gap-2 min-h-[32px]">
        {selectedIds.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">아래에서 선수를 선택하세요 (최소 2명, 최대 3명)</span>
        )}
        {selectedIds.map(id => {
          const p = players.find(pp => pp.id === id);
          return (
            <button
              key={id}
              onClick={() => togglePlayer(id)}
              className="flex items-center gap-1 rounded-full gradient-pink px-3 py-1 text-xs font-bold text-primary-foreground"
            >
              {p?.name}
              <X className="h-3 w-3" />
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="선수 검색..."
        className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-border bg-background/50 p-2">
        <div className="flex flex-wrap gap-1.5">
          {filtered.map(p => {
            const isSelected = selectedIds.includes(p.id);
            const disabled = !isSelected && selectedIds.length >= 3;
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                disabled={disabled}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : disabled
                    ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                    : "bg-secondary text-foreground hover:bg-primary/30"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedIds.length < 2 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            2명 이상 선택하면 분석 결과가 나타납니다.
          </motion.div>
        )}
        {selectedIds.length >= 2 && !result && (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            동시 출전 기록이 없습니다.
          </motion.div>
        )}
        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Badge */}
            <div className={`rounded-xl border p-4 text-center ${result.badge.tone === "good" ? "border-primary/50 bg-primary/10" : result.badge.tone === "bad" ? "border-destructive/50 bg-destructive/10" : "border-border bg-secondary/30"}`}>
              <div className="text-3xl mb-1">{result.badge.emoji}</div>
              <div className={`font-display text-lg tracking-wider ${result.badge.tone === "good" ? "text-primary text-glow" : result.badge.tone === "bad" ? "text-destructive" : "text-foreground"}`}>
                {result.badge.title}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                동시출전 {result.togetherQuarters}쿼터 / {result.togetherMatches}경기
                {result.reliable && <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">신뢰도 ✓</span>}
              </div>
            </div>

            {/* Attack & Synergy */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">⚔️ 공격 & 시너지</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="합작 골" value={`${result.combinedGoals}`} suffix="회" />
                <Stat label="침묵 쿼터" value={`${result.silentQuarterRate}`} suffix="%" tone={result.silentQuarterRate > 40 ? "bad" : "neutral"} />
              </div>
            </div>

            {/* Defense */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">🛡️ 수비 & 안정감</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="쿼터당 평균 실점" value={result.goalsConcededPerQ.toFixed(2)} tone={result.goalsConcededPerQ > 1.5 ? "bad" : result.goalsConcededPerQ < 0.8 ? "good" : "neutral"} />
                <Stat label="수비 붕괴율" value={`${result.defenseCollapseRate}`} suffix="%" tone={result.defenseCollapseRate > 30 ? "bad" : "neutral"} />
              </div>
            </div>

            {/* Win index */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">⚖️ 냉정한 승리 지수</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="평균 코트 마진" value={`${result.marginPerQ > 0 ? "+" : ""}${result.marginPerQ.toFixed(2)}`} tone={result.marginPerQ > 0 ? "good" : "bad"} />
                <Stat label="동시출전 승률" value={`${result.winRate}`} suffix="%" tone={result.winRate >= 55 ? "good" : result.winRate < 40 ? "bad" : "neutral"} />
              </div>
              <div className={`mt-2 flex items-center justify-between rounded-lg border p-3 ${dangerApart ? "border-destructive/50 bg-destructive/10" : "border-border bg-secondary/30"}`}>
                <div className="flex items-center gap-2 text-xs">
                  {dangerApart && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className="text-foreground font-medium">상극 판독기</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  같이 <span className="font-bold text-foreground">{result.winRate}%</span> · 따로 <span className="font-bold text-foreground">{result.apartWinRate}%</span>
                </div>
              </div>
            </div>

            {/* Bench */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">💤 벤치 동기화</div>
              <Stat label="동시 휴식 쿼터" value={`${result.benchSyncQuarters}`} suffix="Q" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, suffix, tone = "neutral" }: { label: string; value: string; suffix?: string; tone?: "good" | "bad" | "neutral" }) {
  const colorCls = tone === "good" ? "text-primary text-glow" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
      <div className={`font-display text-2xl ${colorCls}`}>
        {value}
        {suffix && <span className="ml-0.5 text-xs">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}