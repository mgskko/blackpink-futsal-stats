import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Player, MatchQuarter, GoalEvent } from "@/hooks/useFutsalData";
import { analyzeChemistry } from "@/hooks/useChemistryStats";
import { X, AlertTriangle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getPlayerName } from "@/hooks/useFutsalData";

interface Props {
  players: Player[];
  allQuarters: MatchQuarter[];
  goalEvents: GoalEvent[];
}

export default function ChemistryAnalyzer({ players, allQuarters, goalEvents }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const nm = (id: number) => getPlayerName(players, id, lang);
  const navigate = useNavigate();
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
        <Sparkles className="h-5 w-5" /> {L("케미 분석기", "Chemistry Analyzer")}
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">{L("선수 2~3명을 골라 호흡을 냉정하게 진단하세요.", "Pick 2–3 players to inspect their on-field chemistry.")}</p>

      {/* Selected chips */}
      <div className="mb-3 flex flex-wrap gap-2 min-h-[32px]">
        {selectedIds.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">{L("아래에서 선수를 선택하세요 (최소 2명, 최대 3명)", "Select players below (min. 2, max 3)")}</span>
        )}
        {selectedIds.map(id => {
          const p = players.find(pp => pp.id === id);
          return (
            <button
              key={id}
              onClick={() => togglePlayer(id)}
              className="flex items-center gap-1 rounded-full gradient-pink px-3 py-1 text-xs font-bold text-primary-foreground"
            >
              {nm(id)}
              <X className="h-3 w-3" />
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={L("선수 검색...", "Search player...")}
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
                {nm(p.id)}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedIds.length < 2 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {L("2명 이상 선택하면 분석 결과가 나타납니다.", "Select 2+ players to see the analysis.")}
          </motion.div>
        )}
        {selectedIds.length >= 2 && !result && (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {L("동시 출전 기록이 없습니다.", "No shared on-field record found.")}
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
                {L("동시출전", "Together")} {result.togetherQuarters}Q / {result.togetherMatches}{L("경기", " GP")}
                {result.reliable && <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">{L("신뢰도", "Reliable")} ✓</span>}
              </div>
            </div>

            {/* Attack & Synergy */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">⚔️ {L("정밀 공격 합작 데이터", "Combined Attack Detail")}</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={L("합작 골", "Combined Goals")} value={`${result.combinedGoals}`} suffix={L("회", "x")} />
                <Stat label={L("침묵 쿼터", "Silent Quarters")} value={`${result.silentQuarterRate}`} suffix="%" tone={result.silentQuarterRate > 40 ? "bad" : "neutral"} />
              </div>
              {(result.goalSplit.length > 0 || result.assistSplit.length > 0) && (
                <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
                  {result.goalSplit.map(g => (
                    <div key={`g-${g.scorerId}`} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">⚽ <span className="text-foreground font-medium">{nm(g.scorerId)}</span></span>
                      <span className="text-primary font-bold">{g.goals}{L("골", "G")}</span>
                    </div>
                  ))}
                  {result.assistSplit.map(a => (
                    <div key={`a-${a.assisterId}`} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">🅰️ <span className="text-foreground font-medium">{nm(a.assisterId)}</span></span>
                      <span className="text-primary font-bold">{a.assists}{L("도움", "A")}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.comboBreakdown.length > 0 && (
                <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                  <div className="text-[10px] font-bold text-primary mb-1">{L("합작 골 상세", "Combined Goal Detail")}</div>
                  {result.comboBreakdown.map(c => (
                    <div key={`${c.assisterId}-${c.scorerId}`} className="flex justify-between text-[11px]">
                      <span className="text-foreground"><span className="font-medium">{nm(c.assisterId)}</span> <span className="text-primary">→</span> <span className="font-medium">{nm(c.scorerId)}</span></span>
                      <span className="text-primary font-bold">{c.count}{L("회", "x")}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.comboTimeline.length > 0 && (
                <details className="mt-2 rounded-lg border border-border bg-secondary/20 p-2">
                  <summary className="cursor-pointer text-[10px] font-bold text-muted-foreground">📅 {L(`합작 골 타임라인 (${result.comboTimeline.length}건)`, `Combined Goals Timeline (${result.comboTimeline.length})`)}</summary>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {result.comboTimeline.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => navigate(`/match/${t.matchId}`)}
                        className="w-full text-left rounded px-2 py-1 text-[10px] text-foreground hover:bg-primary/10 transition"
                      >
                        Q{t.quarter} · {nm(t.assisterId)} → {nm(t.scorerId)}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Defense */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">🛡️ {L("수비 & 안정감", "Defense & Stability")}</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={L("쿼터당 평균 실점", "Conceded / Q")} value={result.goalsConcededPerQ.toFixed(2)} tone={result.goalsConcededPerQ > 1.5 ? "bad" : result.goalsConcededPerQ < 0.8 ? "good" : "neutral"} />
                <Stat label={L("수비 붕괴율", "Defense Collapse Rate")} value={`${result.defenseCollapseRate}`} suffix="%" tone={result.defenseCollapseRate > 30 ? "bad" : "neutral"} />
                <Stat label={L("합작 무실점 쿼터", "Clean-Sheet Quarters")} value={`${result.cleanSheetQuarters}`} suffix={`Q (${result.cleanSheetRate}%)`} tone={result.cleanSheetRate > 30 ? "good" : "neutral"} />
                <Stat label={L("총 실점 / 동시 쿼터", "Total Conceded / Shared Q")} value={`${Math.round(result.goalsConcededPerQ * result.togetherQuarters)} / ${result.togetherQuarters}`} />
              </div>
              {result.dfQuarters > 0 && (
                <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="mb-2 text-[10px] font-bold text-primary">🛡️ {L("전원 DF/GK 후방 책임 쿼터", "All DF/GK Back-Line Quarters")}</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="font-display text-lg text-foreground">{result.dfQuarters}</div><div className="text-[9px] text-muted-foreground">{L("동시 수비 쿼터", "Shared Def Q")}</div></div>
                    <div><div className="font-display text-lg text-primary">{result.dfConcededPerQ.toFixed(2)}</div><div className="text-[9px] text-muted-foreground">{L("쿼터당 실점", "Conceded/Q")}</div></div>
                    <div><div className="font-display text-lg text-primary text-glow">{result.dfCleanSheets}/{result.dfQuarters}</div><div className="text-[9px] text-muted-foreground">{L("무실점", "Clean sheets")}</div></div>
                  </div>
                </div>
              )}
            </div>

            {/* Win index */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">⚖️ {L("독립 마진 & 승리 지수", "Independent Margin & Win Index")}</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={L("평균 코트 마진", "Avg Court Margin")} value={`${result.marginPerQ > 0 ? "+" : ""}${result.marginPerQ.toFixed(2)}`} tone={result.marginPerQ > 0 ? "good" : "bad"} />
                <Stat label={L("동시출전 승률", "Together Win%")} value={`${result.winRate}`} suffix="%" tone={result.winRate >= 55 ? "good" : result.winRate < 40 ? "bad" : "neutral"} />
              </div>
              <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-[11px] text-foreground">
                {L("동시 출전 종합 전적", "Shared Record")}: <span className="text-primary font-bold">{result.wins}{L("승", "W")}</span> {result.draws}{L("무", "D")} <span className="text-destructive font-bold">{result.losses}{L("패", "L")}</span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground">{L("On/Off Court 마진 비교", "On/Off Court Margin Comparison")}</div>
                <div className="flex justify-between rounded-lg border border-primary/40 bg-primary/5 p-2 text-[11px]">
                  <span className="text-foreground font-medium">{L("전원 동시", "All Together")}</span>
                  <span className={`font-bold ${result.marginPerQ > 0 ? "text-primary" : "text-destructive"}`}>{result.marginPerQ > 0 ? "+" : ""}{result.marginPerQ.toFixed(2)}/Q ({result.togetherQuarters}Q)</span>
                </div>
                {result.soloMargins.map(s => (
                  <div key={s.id} className="flex justify-between rounded-lg border border-border bg-secondary/30 p-2 text-[11px]">
                    <span className="text-foreground">{nm(s.id)} {L("단독", "solo")}</span>
                    <span className={`font-bold ${s.quarters === 0 ? "text-muted-foreground" : s.marginPerQ > 0 ? "text-primary" : "text-destructive"}`}>
                      {s.quarters === 0 ? L("기록 없음", "No record") : `${s.marginPerQ > 0 ? "+" : ""}${s.marginPerQ.toFixed(2)}/Q (${s.quarters}Q)`}
                    </span>
                  </div>
                ))}
              </div>
              <div className={`mt-2 flex items-center justify-between rounded-lg border p-3 ${dangerApart ? "border-destructive/50 bg-destructive/10" : "border-border bg-secondary/30"}`}>
                <div className="flex items-center gap-2 text-xs">
                  {dangerApart && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className="text-foreground font-medium">{L("상극 판독기", "Anti-Chemistry Detector")}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {L("같이", "Together")} <span className="font-bold text-foreground">{result.winRate}%</span> · {L("따로", "Apart")} <span className="font-bold text-foreground">{result.apartWinRate}%</span>
                </div>
              </div>
            </div>

            {/* Bench */}
            <div>
              <div className="mb-2 text-xs font-bold text-foreground">💤 {L("벤치 동기화 & 영향도", "Bench Sync & Impact")}</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={L("동시 휴식 쿼터", "Shared Bench Q")} value={`${result.benchSyncQuarters}`} suffix="Q" />
                <Stat
                  label={L("벤치 다운 시 마진", "Margin While Benched")}
                  value={`${result.benchDownMarginPerQ > 0 ? "+" : ""}${result.benchDownMarginPerQ.toFixed(2)}`}
                  suffix="/Q"
                  tone={result.benchDownMarginPerQ < -0.5 ? "bad" : result.benchDownMarginPerQ > 0.5 ? "good" : "neutral"}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{L("동시 벤치 시 팀의 쿼터당 평균 마진 (- 일수록 팀이 밀림)", "Team's avg margin per quarter when both are benched (lower = worse)")}</p>
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