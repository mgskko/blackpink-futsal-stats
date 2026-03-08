import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Ticket, Crown, TrendingDown, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Match, Result, Team } from "@/hooks/useFutsalData";
import { getMatchResult } from "@/hooks/useFutsalData";

interface TotoStatsTabProps {
  matches: Match[];
  teams: Team[];
  results: Result[];
}

interface PredictionRow {
  id: string;
  match_id: number;
  voter_id: string;
  prediction: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

function getQuarter(dateStr: string): number {
  const month = parseInt(dateStr.slice(5, 7));
  return Math.ceil(month / 3);
}

function getQuarterLabel(year: string, q: number): string {
  return `${year} ${q}분기`;
}

const TotoStatsTab = ({ matches, teams, results }: TotoStatsTabProps) => {
  const navigate = useNavigate();

  const { data: predictions } = useQuery({
    queryKey: ["all_match_predictions"],
    queryFn: async () => {
      const { data } = await supabase.from("match_predictions").select("*");
      return (data ?? []) as PredictionRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name");
      return (data ?? []) as ProfileRow[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles?.forEach(p => map.set(p.id, p.display_name || "익명"));
    return map;
  }, [profiles]);

  // Build quarterly rankings
  const quarterlyRankings = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    const today = new Date().toISOString().slice(0, 10);

    // Only count finished matches (past date with results)
    const finishedMatchMap = new Map<number, string>(); // matchId -> actual result ("win"|"draw"|"loss")
    matches.forEach(match => {
      if (match.date > today) return; // include today's matches as finished
      const mr = getMatchResult(teams, results, match.id);
      if (!mr) return;
      const r = mr.ourResult.result;
      if (!r || (r !== "승" && r !== "패" && r !== "무")) return; // skip if no result yet
      finishedMatchMap.set(match.id, r === "승" ? "win" : r === "패" ? "loss" : "draw");
    });

    // Group predictions by quarter
    type UserQuarterStats = { correct: number; total: number; allLoss: boolean; predictions: string[] };
    const quarterMap = new Map<string, Map<string, UserQuarterStats>>(); // quarterKey -> userId -> stats

    predictions.forEach(pred => {
      const match = matches.find(m => m.id === pred.match_id);
      if (!match) return;
      const actualResult = finishedMatchMap.get(pred.match_id);
      if (!actualResult) return; // match not finished

      const year = match.date.slice(0, 4);
      const q = getQuarter(match.date);
      const qKey = `${year}-Q${q}`;

      if (!quarterMap.has(qKey)) quarterMap.set(qKey, new Map());
      const userMap = quarterMap.get(qKey)!;
      if (!userMap.has(pred.voter_id)) userMap.set(pred.voter_id, { correct: 0, total: 0, allLoss: true, predictions: [] });

      const stats = userMap.get(pred.voter_id)!;
      stats.total++;
      stats.predictions.push(pred.prediction);
      if (pred.prediction !== "loss") stats.allLoss = false;
      if (pred.prediction === actualResult) stats.correct++;
    });

    // Build rankings per quarter
    const rankings: { quarterKey: string; label: string; users: { userId: string; name: string; correct: number; total: number; rate: number; allLoss: boolean; eligible: boolean }[] }[] = [];

    const sortedKeys = [...quarterMap.keys()].sort((a, b) => b.localeCompare(a));
    sortedKeys.forEach(qKey => {
      const [year, qStr] = qKey.split("-Q");
      const userMap = quarterMap.get(qKey)!;
      const users = [...userMap.entries()]
        .map(([userId, s]) => ({
          userId,
          name: profileMap.get(userId) || "익명",
          correct: s.correct,
          total: s.total,
          rate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
          allLoss: s.allLoss,
          eligible: !s.allLoss, // abuse prevention
        }))
        .sort((a, b) => b.rate - a.rate || b.correct - a.correct);

      rankings.push({ quarterKey: qKey, label: getQuarterLabel(year, parseInt(qStr)), users });
    });

    return rankings;
  }, [predictions, matches, teams, results, profileMap]);

  // Underdog Master: predicted win/draw when majority predicted loss, and was correct
  const underdogMaster = useMemo(() => {
    if (!predictions || predictions.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);

    const finishedMatchMap = new Map<number, string>();
    matches.forEach(match => {
      if (match.date > today) return;
      const mr = getMatchResult(teams, results, match.id);
      if (!mr) return;
      const r = mr.ourResult.result;
      if (!r || (r !== "승" && r !== "패" && r !== "무")) return;
      finishedMatchMap.set(match.id, r === "승" ? "win" : r === "패" ? "loss" : "draw");
    });

    // Find matches where majority predicted loss
    const matchPredGroups = new Map<number, PredictionRow[]>();
    predictions.forEach(p => {
      if (!matchPredGroups.has(p.match_id)) matchPredGroups.set(p.match_id, []);
      matchPredGroups.get(p.match_id)!.push(p);
    });

    const underdogCounts = new Map<string, number>();
    matchPredGroups.forEach((preds, matchId) => {
      const actual = finishedMatchMap.get(matchId);
      if (!actual || actual === "loss") return; // only count when we actually won/drew

      const lossCount = preds.filter(p => p.prediction === "loss").length;
      if (lossCount <= preds.length / 2) return; // majority didn't predict loss

      preds.forEach(p => {
        if (p.prediction !== "loss") { // they predicted win or draw against the majority
          underdogCounts.set(p.voter_id, (underdogCounts.get(p.voter_id) || 0) + 1);
        }
      });
    });

    if (underdogCounts.size === 0) return null;
    const sorted = [...underdogCounts.entries()].sort((a, b) => b[1] - a[1]);
    return { userId: sorted[0][0], name: profileMap.get(sorted[0][0]) || "익명", count: sorted[0][1] };
  }, [predictions, matches, teams, results, profileMap]);

  // Pele's Curse: lowest accuracy
  const peleCurse = useMemo(() => {
    if (!quarterlyRankings.length) return null;
    // Across all quarters, find user with most predictions and lowest rate
    const allUsers = new Map<string, { correct: number; total: number }>();
    quarterlyRankings.forEach(q => {
      q.users.forEach(u => {
        const existing = allUsers.get(u.userId) || { correct: 0, total: 0 };
        existing.correct += u.correct;
        existing.total += u.total;
        allUsers.set(u.userId, existing);
      });
    });

    const candidates = [...allUsers.entries()]
      .filter(([, s]) => s.total >= 3) // at least 3 predictions
      .map(([userId, s]) => ({ userId, name: profileMap.get(userId) || "익명", rate: Math.round((s.correct / s.total) * 100), total: s.total }))
      .sort((a, b) => a.rate - b.rate);

    return candidates.length > 0 ? candidates[0] : null;
  }, [quarterlyRankings, profileMap]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Anti-abuse notice */}
      <Alert className="mb-6 border-yellow-500/40 bg-yellow-500/5">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-xs text-yellow-200/80">
          <span className="font-bold text-yellow-400">어뷰징 방지 규정:</span> 분기 내 모든 예측을 '패배'로만 투표한 경우, 적중률이 높아도 <span className="font-bold text-yellow-400">참가비 면제권 보상에서 제외</span>됩니다. 공정한 예측 문화를 만들어 주세요! 🙏
        </AlertDescription>
      </Alert>

      {/* Quarterly Rankings */}
      {quarterlyRankings.map((qr) => (
        <div key={qr.quarterKey} className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
            <Crown size={18} /> {qr.label} 적중률 랭킹
          </h3>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {qr.users.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">아직 데이터가 없습니다</div>
            ) : (
              qr.users.map((u, i) => {
                const isFirst = i === 0 && u.eligible && u.total >= 2;
                return (
                  <div key={u.userId}
                    className={`flex items-center justify-between px-4 py-3 transition-colors ${i < qr.users.length - 1 ? "border-b border-border" : ""} ${isFirst ? "bg-primary/5" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                      {isFirst && (
                        <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary sparkle-anim">
                          <Ticket size={10} /> 면제권
                        </span>
                      )}
                      {!u.eligible && u.allLoss && (
                        <span className="rounded-full bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive font-bold">
                          제외
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[10px] text-muted-foreground">{u.correct}/{u.total}</span>
                      <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{u.rate}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}

      {quarterlyRankings.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="text-sm">아직 승부 예측 데이터가 없습니다.</p>
          <p className="text-xs mt-1">예정된 경기에서 예측을 남겨보세요! 🎯</p>
        </div>
      )}

      {/* Fun titles section */}
      <div className="mt-8 space-y-4">
        <h3 className="font-display text-xl tracking-wider text-primary flex items-center gap-2">
          <Sparkles size={18} /> 토토 칭호
        </h3>

        {/* Underdog Master */}
        <div className="rounded-xl border border-primary/30 bg-card p-4 box-glow">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🦸</span>
            <div>
              <div className="text-sm font-bold text-primary">역배의 신 (Underdog Master)</div>
              <p className="text-[10px] text-muted-foreground">다수가 패배를 예상한 경기에서 승/무를 맞춘 횟수 1위</p>
            </div>
          </div>
          {underdogMaster ? (
            <div className="rounded-lg bg-secondary/50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{underdogMaster.name}</span>
              <span className="font-display text-lg text-primary text-glow">{underdogMaster.count}회</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">아직 해당자 없음</div>
          )}
        </div>

        {/* Pele's Curse */}
        <div className="rounded-xl border border-destructive/30 bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚽</span>
            <div>
              <div className="text-sm font-bold text-destructive flex items-center gap-1">
                <TrendingDown size={14} /> 인간 펠레 (Pelé's Curse)
              </div>
              <p className="text-[10px] text-muted-foreground">예측 적중률이 가장 낮은 유저 (3회 이상 예측)</p>
            </div>
          </div>
          {peleCurse ? (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{peleCurse.name}</span>
              <span className="font-display text-lg text-destructive">{peleCurse.rate}% <span className="text-[10px] text-muted-foreground">({peleCurse.total}전)</span></span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">아직 해당자 없음</div>
          )}
        </div>

        {/* Exact Score Oracle placeholder */}
        <div className="rounded-xl border border-dashed border-muted bg-card p-4 opacity-60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <div>
              <div className="text-sm font-bold text-muted-foreground">퍼펙트 스코어 선지자 (Exact Score Oracle)</div>
              <p className="text-[10px] text-muted-foreground">정확한 스코어까지 맞추는 이벤트 — Coming Soon!</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TotoStatsTab;
