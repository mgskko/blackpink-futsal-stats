import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface QuarterData {
  id?: number;
  quarter: number;
  score_for: number;
  score_against: number;
  lineup: { GK: number[]; DF: number[]; MF: number[]; FW: number[]; Bench: number[] };
}

interface Props {
  matchId: number;
  rosterPlayerIds: number[];
  players: Player[];
}

const POSITIONS = ["GK", "DF", "MF", "FW", "Bench"] as const;

export default function AdminQuarterEditor({ matchId, rosterPlayerIds, players }: Props) {
  const queryClient = useQueryClient();
  const [quarters, setQuarters] = useState<QuarterData[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const { data } = await (supabase as any).from("match_quarters").select("*").eq("match_id", matchId).order("quarter");
      if (data && data.length > 0) {
        setQuarters(data.map((q: any) => ({
          id: q.id,
          quarter: q.quarter,
          score_for: q.score_for || 0,
          score_against: q.score_against || 0,
          lineup: q.lineup || { GK: [], DF: [], MF: [], FW: [], Bench: [] },
        })));
      } else {
        setQuarters([]);
      }
      setLoaded(true);
    })();
  }, [matchId]);

  const addQuarter = () => {
    const nextQ = quarters.length > 0 ? Math.max(...quarters.map(q => q.quarter)) + 1 : 1;
    setQuarters(prev => [...prev, { quarter: nextQ, score_for: 0, score_against: 0, lineup: { GK: [], DF: [], MF: [], FW: [], Bench: [] } }]);
  };

  const removeQuarter = (idx: number) => {
    setQuarters(prev => prev.filter((_, i) => i !== idx));
  };

  const updateScore = (idx: number, field: "score_for" | "score_against", val: number) => {
    setQuarters(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  const togglePlayer = (qIdx: number, pos: typeof POSITIONS[number], playerId: number) => {
    setQuarters(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newLineup = { ...q.lineup };
      // Remove from all positions first
      POSITIONS.forEach(p => {
        newLineup[p] = (newLineup[p] || []).filter((id: number) => id !== playerId);
      });
      // If not already in this position, add
      if (!(q.lineup[pos] || []).includes(playerId)) {
        newLineup[pos] = [...(newLineup[pos] || []), playerId];
      }
      return { ...q, lineup: newLineup };
    }));
  };

  const removePlayerFromQuarter = (qIdx: number, playerId: number) => {
    setQuarters(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newLineup = { ...q.lineup };
      POSITIONS.forEach(p => {
        newLineup[p] = (newLineup[p] || []).filter((id: number) => id !== playerId);
      });
      return { ...q, lineup: newLineup };
    }));
  };

  const getPlayerPos = (q: QuarterData, pid: number): string | null => {
    for (const pos of POSITIONS) {
      if ((q.lineup[pos] || []).includes(pid)) return pos;
    }
    return null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing quarters for this match
      await (supabase as any).from("match_quarters").delete().eq("match_id", matchId);
      
      if (quarters.length > 0) {
        const inserts = quarters.map(q => ({
          match_id: matchId,
          quarter: q.quarter,
          score_for: q.score_for,
          score_against: q.score_against,
          lineup: q.lineup,
        }));
        const { error } = await (supabase as any).from("match_quarters").insert(inserts);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["all_match_quarters"] });
      queryClient.invalidateQueries({ queryKey: ["match_quarters"] });
      toast({ title: "쿼터 데이터가 저장되었습니다 ✅" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const rosterPlayers = players.filter(p => rosterPlayerIds.includes(p.id));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-primary">쿼터별 스코어 & 라인업</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addQuarter} className="h-7 text-xs border-primary/30 text-primary">
            <Plus size={12} /> 쿼터 추가
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground">
            <Save size={12} /> 저장
          </Button>
        </div>
      </div>

      {!loaded ? (
        <p className="text-xs text-muted-foreground">로딩 중...</p>
      ) : quarters.length === 0 ? (
        <p className="text-xs text-muted-foreground">쿼터 데이터가 없습니다. "쿼터 추가"를 눌러 시작하세요.</p>
      ) : (
        <Accordion type="multiple" className="w-full">
          {quarters.map((q, idx) => (
            <AccordionItem key={idx} value={`q-${idx}`}>
              <AccordionTrigger className="text-xs font-bold py-2">
                <div className="flex items-center gap-3">
                  <span className="text-primary">{q.quarter}Q</span>
                  <span className="text-muted-foreground font-normal">{q.score_for} : {q.score_against}</span>
                  <span className="text-muted-foreground font-normal text-[10px]">
                    ({POSITIONS.reduce((s, p) => s + (q.lineup[p]?.length || 0), 0)}명)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-1">
                  {/* Score */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">우리팀</label>
                      <Input type="number" min={0} value={q.score_for} onChange={e => updateScore(idx, "score_for", Number(e.target.value))} className="h-7 text-xs text-center bg-background border-border" />
                    </div>
                    <span className="text-muted-foreground font-bold mt-3">:</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">상대팀</label>
                      <Input type="number" min={0} value={q.score_against} onChange={e => updateScore(idx, "score_against", Number(e.target.value))} className="h-7 text-xs text-center bg-background border-border" />
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => removeQuarter(idx)} className="h-7 w-7 p-0 mt-3">
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {/* Lineup */}
                  {POSITIONS.map(pos => {
                    const posPlayers = (q.lineup[pos] || []);
                    return (
                      <div key={pos}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold ${pos === "Bench" ? "text-muted-foreground" : "text-primary"}`}>{pos}</span>
                          <span className="text-[10px] text-muted-foreground">({posPlayers.length}명)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rosterPlayers.map(p => {
                            const currentPos = getPlayerPos(q, p.id);
                            const isInThisPos = currentPos === pos;
                            const isInOtherPos = currentPos && currentPos !== pos;
                            return (
                              <button
                                key={p.id}
                                onClick={() => isInThisPos ? removePlayerFromQuarter(idx, p.id) : togglePlayer(idx, pos, p.id)}
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                  isInThisPos
                                    ? "border-primary bg-primary/20 text-primary"
                                    : isInOtherPos
                                    ? "border-border bg-secondary/30 text-muted-foreground/50 line-through"
                                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                                }`}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
