import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

interface MatchPredictionProps {
  matchId: number;
}

type Prediction = "win" | "draw" | "loss";

const MatchPrediction = ({ matchId }: MatchPredictionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: predictions } = useQuery({
    queryKey: ["match_predictions", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_predictions")
        .select("*")
        .eq("match_id", matchId);
      return (data ?? []) as { id: string; match_id: number; voter_id: string; prediction: string }[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`predictions-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_predictions", filter: `match_id=eq.${matchId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["match_predictions", matchId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, queryClient]);

  useEffect(() => {
    if (predictions && user) {
      const my = predictions.find(p => p.voter_id === user.id);
      if (my) setSelected(my.prediction as Prediction);
    }
  }, [predictions, user]);

  const total = predictions?.length ?? 0;
  const winCount = predictions?.filter(p => p.prediction === "win").length ?? 0;
  const drawCount = predictions?.filter(p => p.prediction === "draw").length ?? 0;
  const lossCount = predictions?.filter(p => p.prediction === "loss").length ?? 0;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const handleVote = async (pred: Prediction) => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    setSaving(true);
    try {
      const existing = predictions?.find(p => p.voter_id === user.id);
      if (existing) {
        await supabase.from("match_predictions").update({ prediction: pred }).eq("id", existing.id);
      } else {
        await supabase.from("match_predictions").insert({ match_id: matchId, voter_id: user.id, prediction: pred });
      }
      setSelected(pred);
      queryClient.invalidateQueries({ queryKey: ["match_predictions", matchId] });
      toast.success("예측이 등록되었습니다!");
    } catch { toast.error("오류가 발생했습니다"); }
    setSaving(false);
  };

  const options: { key: Prediction; label: string; emoji: string; color: string; barColor: string }[] = [
    { key: "win", label: "승리", emoji: "🏆", color: "text-blue-400", barColor: "bg-blue-500" },
    { key: "draw", label: "무승부", emoji: "🤝", color: "text-muted-foreground", barColor: "bg-muted-foreground" },
    { key: "loss", label: "패배", emoji: "💀", color: "text-red-400", barColor: "bg-red-500" },
  ];

  const counts = { win: winCount, draw: drawCount, loss: lossCount };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
        <TrendingUp size={18} /> 승부 예측 토토
      </h3>

      {total > 0 && (
        <div className="mb-4 text-xs text-muted-foreground text-center">
          총 <span className="text-primary font-bold">{total}</span>명 참여
        </div>
      )}

      <div className="space-y-3">
        {options.map(opt => {
          const count = counts[opt.key];
          const percent = pct(count);
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleVote(opt.key)}
              disabled={saving}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                isSelected
                  ? "border-primary/60 bg-primary/10 box-glow"
                  : "border-border bg-secondary/30 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{opt.emoji}</span>
                  <span className={`text-sm font-bold ${isSelected ? "text-primary" : opt.color}`}>{opt.label}</span>
                  {isSelected && <span className="text-[10px] text-primary">✓ 내 예측</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-display text-xl ${opt.color}`}>{percent}%</span>
                  <span className="text-[10px] text-muted-foreground">({count}명)</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className={`h-full rounded-full ${opt.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MatchPrediction;
