import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData, getPlayerName } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface GoalEntry {
  quarter: number;
  goalPlayerId: string;
  assistPlayerId: string;
  teamId: number;
  isOwnGoal: boolean;
}

const AdminMatchResult = () => {
  const { matches, venues, teams, players, rosters } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const matchId = selectedMatchId ? Number(selectedMatchId) : null;
  const matchTeams = matchId ? teams.filter(t => t.match_id === matchId) : [];
  const matchRoster = matchId ? rosters.filter(r => r.match_id === matchId) : [];
  const ourTeams = matchTeams.filter(t => t.is_ours);
  const rosterPlayerIds = new Set(matchRoster.map(r => r.player_id));
  const rosterPlayers = players.filter(p => rosterPlayerIds.has(p.id));
  // For goal/assist selection, show all players (roster first, then others)
  const allSelectablePlayers = [
    ...rosterPlayers,
    ...players.filter(p => p.is_active && !rosterPlayerIds.has(p.id)),
  ];

  const addGoalEntry = () => {
    setGoalEntries(prev => [
      ...prev,
      { quarter: 1, goalPlayerId: "", assistPlayerId: "", teamId: ourTeams[0]?.id ?? 0, isOwnGoal: false },
    ]);
  };

  const removeGoalEntry = (index: number) => {
    setGoalEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateGoalEntry = (index: number, field: keyof GoalEntry, value: any) => {
    setGoalEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    if (!matchId) return;
    setSaving(true);
    try {
      const scoreMap: Record<number, number> = {};
      matchTeams.forEach(t => { scoreMap[t.id] = 0; });

      for (const entry of goalEntries) {
        if (entry.teamId) scoreMap[entry.teamId] = (scoreMap[entry.teamId] || 0) + 1;
      }

      if (goalEntries.length > 0) {
        const inserts = goalEntries.map(e => ({
          match_id: matchId,
          team_id: e.teamId,
          quarter: e.quarter,
          goal_player_id: e.goalPlayerId ? Number(e.goalPlayerId) : null,
          assist_player_id: e.assistPlayerId && e.assistPlayerId !== "none" ? Number(e.assistPlayerId) : null,
          is_own_goal: e.isOwnGoal,
        }));
        const { error } = await supabase.from("goal_events").insert(inserts);
        if (error) throw error;
      }

      for (const team of matchTeams) {
        const opponentTeam = matchTeams.find(t => t.id !== team.id);
        const scoreFor = scoreMap[team.id] || 0;
        const scoreAgainst = opponentTeam ? (scoreMap[opponentTeam.id] || 0) : 0;
        const result = scoreFor > scoreAgainst ? "승" : scoreFor < scoreAgainst ? "패" : "무";

        await supabase
          .from("results")
          .update({ score_for: scoreFor, score_against: scoreAgainst, result })
          .eq("match_id", matchId)
          .eq("team_id", team.id);
      }

      await supabase.from("matches").update({ has_detail_log: true }).eq("id", matchId);

      queryClient.invalidateQueries({ queryKey: ["goal_events"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });

      toast({ title: "경기 결과가 저장되었습니다! 🎉" });
      setGoalEntries([]);
      setSelectedMatchId("");
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Select value={selectedMatchId} onValueChange={v => { setSelectedMatchId(v); setGoalEntries([]); }}>
        <SelectTrigger className="bg-card border-border">
          <SelectValue placeholder="경기를 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {sortedMatches.map(m => {
            const venue = venues.find(v => v.id === m.venue_id);
            return (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.date} - {venue?.name ?? "미정"}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {matchId && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">골 이벤트</span>
            <Button size="sm" variant="outline" onClick={addGoalEntry} className="border-primary/30 text-primary">
              <Plus size={14} /> 추가
            </Button>
          </div>

          {goalEntries.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-primary font-bold">골 #{i + 1}</span>
                <button onClick={() => removeGoalEntry(i)} className="text-destructive"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">쿼터</label>
                  <Select value={String(entry.quarter)} onValueChange={v => updateGoalEntry(i, "quarter", Number(v))}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(q => <SelectItem key={q} value={String(q)}>{q}Q</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">팀</label>
                  <Select value={String(entry.teamId)} onValueChange={v => updateGoalEntry(i, "teamId", Number(v))}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {matchTeams.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={entry.isOwnGoal}
                  onCheckedChange={(c) => updateGoalEntry(i, "isOwnGoal", c === true)}
                  className="border-primary"
                />
                <label className="text-xs text-muted-foreground">자책골</label>
              </div>
              {!entry.isOwnGoal && (
                <>
                  <div>
                    <label className="text-[10px] text-muted-foreground">득점자</label>
                    <Select value={entry.goalPlayerId} onValueChange={v => updateGoalEntry(i, "goalPlayerId", v)}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">도움</label>
                    <Select value={entry.assistPlayerId} onValueChange={v => updateGoalEntry(i, "assistPlayerId", v)}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="없음" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">없음</SelectItem>
                        {allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          ))}

          {goalEntries.length > 0 && (
            <Button onClick={handleSave} disabled={saving} className="w-full gradient-pink text-primary-foreground font-bold">
              {saving ? "저장 중..." : "결과 저장"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default AdminMatchResult;
