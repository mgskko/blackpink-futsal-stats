import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Team } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, ArrowLeftRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITIONS = ["GK", "DF", "MF", "FW", "Bench"] as const;
type PosKey = typeof POSITIONS[number];
type TeamLineup = { GK: number[]; DF: number[]; MF: number[]; FW: number[]; Bench: number[]; formation?: string };

interface CustomQuarterData {
  id?: number;
  quarter: number;
  score_for: number;
  score_against: number;
  lineup: { teamA: TeamLineup; teamB: TeamLineup };
}

const FORMATION_OPTIONS = ["1-2-2", "2-1-2", "2-2-1", "1-3-1", "1-1-3", "3-1-1", "2-1-1-1", "1-2-1-1", "1-1-2-1"];

const emptyLineup = (): TeamLineup => ({ GK: [], DF: [], MF: [], FW: [], Bench: [] });

interface Props {
  matchId: number;
  matchTeams: Team[];
  rosterPlayerIds: number[];
  players: Player[];
  rosters: { player_id: number; team_id: number }[];
}

export default function AdminCustomQuarterEditor({ matchId, matchTeams, rosterPlayerIds, players, rosters }: Props) {
  const queryClient = useQueryClient();
  const [quarters, setQuarters] = useState<CustomQuarterData[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const teamA = matchTeams[0];
  const teamB = matchTeams[1];
  const teamAName = teamA?.name || "A팀";
  const teamBName = teamB?.name || "B팀";

  // Players by team based on rosters
  const teamAPlayerIds = new Set(rosters.filter(r => r.team_id === teamA?.id).map(r => r.player_id));
  const teamBPlayerIds = new Set(rosters.filter(r => r.team_id === teamB?.id).map(r => r.player_id));
  const teamAPlayers = players.filter(p => teamAPlayerIds.has(p.id));
  const teamBPlayers = players.filter(p => teamBPlayerIds.has(p.id));

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const { data } = await (supabase as any).from("match_quarters").select("*").eq("match_id", matchId).order("quarter");
      if (data && data.length > 0) {
        setQuarters(data.map((q: any) => {
          const raw = q.lineup || {};
          // Support both old format and new teamA/teamB format
          if (raw.teamA && raw.teamB) {
            return { id: q.id, quarter: q.quarter, score_for: q.score_for || 0, score_against: q.score_against || 0, lineup: raw };
          }
          // Legacy: single lineup → put into teamA, leave teamB empty
          return {
            id: q.id, quarter: q.quarter, score_for: q.score_for || 0, score_against: q.score_against || 0,
            lineup: { teamA: { ...emptyLineup(), ...raw }, teamB: emptyLineup() },
          };
        }));
      } else {
        setQuarters([]);
      }
      setLoaded(true);
    })();
  }, [matchId]);

  const addQuarter = () => {
    const nextQ = quarters.length > 0 ? Math.max(...quarters.map(q => q.quarter)) + 1 : 1;
    setQuarters(prev => [...prev, { quarter: nextQ, score_for: 0, score_against: 0, lineup: { teamA: emptyLineup(), teamB: emptyLineup() } }]);
  };

  const removeQuarter = (idx: number) => setQuarters(prev => prev.filter((_, i) => i !== idx));

  const updateScore = (idx: number, field: "score_for" | "score_against", val: number) => {
    setQuarters(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  const setFormation = (qIdx: number, team: "teamA" | "teamB", formation: string) => {
    setQuarters(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, lineup: { ...q.lineup, [team]: { ...q.lineup[team], formation } } };
    }));
  };

  const getPlayerPos = (teamLineup: TeamLineup, pid: number): PosKey | null => {
    for (const pos of POSITIONS) {
      if ((teamLineup[pos] || []).includes(pid)) return pos;
    }
    return null;
  };

  const togglePlayer = (qIdx: number, team: "teamA" | "teamB", pos: PosKey, playerId: number) => {
    setQuarters(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const tl = { ...q.lineup[team] };
      POSITIONS.forEach(p => { tl[p] = (tl[p] || []).filter((id: number) => id !== playerId); });
      if (!(q.lineup[team][pos] || []).includes(playerId)) {
        tl[pos] = [...(tl[pos] || []), playerId];
      }
      return { ...q, lineup: { ...q.lineup, [team]: tl } };
    }));
  };

  const removePlayerFromTeam = (qIdx: number, team: "teamA" | "teamB", playerId: number) => {
    setQuarters(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const tl = { ...q.lineup[team] };
      POSITIONS.forEach(p => { tl[p] = (tl[p] || []).filter((id: number) => id !== playerId); });
      return { ...q, lineup: { ...q.lineup, [team]: tl } };
    }));
  };

  const countPlayers = (tl: TeamLineup) => POSITIONS.reduce((s, p) => s + (tl[p]?.length || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await (supabase as any).from("match_quarters").delete().eq("match_id", matchId);
      if (quarters.length > 0) {
        const inserts = quarters.map(q => ({
          match_id: matchId, quarter: q.quarter, score_for: q.score_for, score_against: q.score_against, lineup: q.lineup,
        }));
        const { error } = await (supabase as any).from("match_quarters").insert(inserts);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["all_match_quarters"] });
      queryClient.invalidateQueries({ queryKey: ["match_quarters"] });
      toast({ title: "쿼터 데이터가 저장되었습니다 ✅" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const renderTeamSection = (q: CustomQuarterData, qIdx: number, team: "teamA" | "teamB", teamName: string, teamPlayers: Player[], color: string) => {
    const tl = q.lineup[team];
    return (
      <div className={`flex-1 rounded-lg border p-3 ${color}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold">{teamName}</span>
          <span className="text-[10px] text-muted-foreground">{countPlayers(tl)}명</span>
        </div>
        {/* Formation */}
        <div className="mb-2">
          <label className="text-[10px] text-muted-foreground">포메이션</label>
          <Select value={tl.formation || ""} onValueChange={v => setFormation(qIdx, team, v)}>
            <SelectTrigger className="h-7 text-xs bg-background border-border">
              <SelectValue placeholder="포메이션 선택" />
            </SelectTrigger>
            <SelectContent>
              {FORMATION_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Positions */}
        {POSITIONS.map(pos => {
          const posPlayers = tl[pos] || [];
          return (
            <div key={pos} className="mb-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-[10px] font-bold ${pos === "Bench" ? "text-muted-foreground" : "text-primary"}`}>{pos}</span>
                <span className="text-[10px] text-muted-foreground">({posPlayers.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {teamPlayers.map(p => {
                  const currentPos = getPlayerPos(tl, p.id);
                  const isInThisPos = currentPos === pos;
                  const isInOtherPos = currentPos && currentPos !== pos;
                  return (
                    <button
                      key={p.id}
                      onClick={() => isInThisPos ? removePlayerFromTeam(qIdx, team, p.id) : togglePlayer(qIdx, team, pos, p.id)}
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        isInThisPos ? "border-primary bg-primary/20 text-primary"
                          : isInOtherPos ? "border-border bg-secondary/30 text-muted-foreground/50 line-through"
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
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-primary">⚔️ 자체전 쿼터별 스코어 & 라인업</h3>
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
                  <span className="text-muted-foreground font-normal">
                    {teamAName} {q.score_for} : {q.score_against} {teamBName}
                  </span>
                  <span className="text-muted-foreground font-normal text-[10px]">
                    (🅰️{countPlayers(q.lineup.teamA)} / 🅱️{countPlayers(q.lineup.teamB)})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-1">
                  {/* Score row */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground font-bold">🅰️ {teamAName}</label>
                      <Input type="number" min={0} value={q.score_for} onChange={e => updateScore(idx, "score_for", Number(e.target.value))} className="h-7 text-xs text-center bg-background border-border" />
                    </div>
                    <span className="text-muted-foreground font-bold mt-3">vs</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground font-bold">🅱️ {teamBName}</label>
                      <Input type="number" min={0} value={q.score_against} onChange={e => updateScore(idx, "score_against", Number(e.target.value))} className="h-7 text-xs text-center bg-background border-border" />
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => removeQuarter(idx)} className="h-7 w-7 p-0 mt-3">
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {/* Two team columns */}
                  <div className="grid grid-cols-2 gap-2">
                    {renderTeamSection(q, idx, "teamA", `🅰️ ${teamAName}`, teamAPlayers, "border-blue-500/30 bg-blue-500/5")}
                    {renderTeamSection(q, idx, "teamB", `🅱️ ${teamBName}`, teamBPlayers, "border-orange-500/30 bg-orange-500/5")}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
