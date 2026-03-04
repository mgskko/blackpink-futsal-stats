import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData, getPlayerName } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Save, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const AdminMatchEdit = () => {
  const { matches, venues, teams, results, players, rosters, goalEvents } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [editingScore, setEditingScore] = useState(false);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "match" | "goal"; id: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const matchId = selectedMatchId ? Number(selectedMatchId) : null;
  const matchTeams = matchId ? teams.filter(t => t.match_id === matchId) : [];
  const matchResults = matchId ? results.filter(r => r.match_id === matchId) : [];
  const matchRoster = matchId ? rosters.filter(r => r.match_id === matchId) : [];
  const matchGoals = matchId ? goalEvents.filter(g => g.match_id === matchId).sort((a, b) => a.quarter - b.quarter) : [];
  const ourTeam = matchTeams.find(t => t.is_ours);
  const ourResult = ourTeam ? matchResults.find(r => r.team_id === ourTeam.id) : null;

  const handleSelectMatch = (v: string) => {
    setSelectedMatchId(v);
    setEditingScore(false);
    const mid = Number(v);
    const mTeams = teams.filter(t => t.match_id === mid);
    const ot = mTeams.find(t => t.is_ours);
    const or = ot ? results.find(r => r.team_id === ot.id && r.match_id === mid) : null;
    setScoreFor(or?.score_for || 0);
    setScoreAgainst(or?.score_against || 0);
  };

  const handleSaveScore = async () => {
    if (!matchId) return;
    setSaving(true);
    try {
      for (const team of matchTeams) {
        const isOurs = team.is_ours;
        const sf = isOurs ? scoreFor : scoreAgainst;
        const sa = isOurs ? scoreAgainst : scoreFor;
        const result = sf > sa ? "승" : sf < sa ? "패" : "무";
        await supabase.from("results").update({ score_for: sf, score_against: sa, result }).eq("match_id", matchId).eq("team_id", team.id);
      }
      queryClient.invalidateQueries({ queryKey: ["results"] });
      toast({ title: "스코어가 수정되었습니다! ✅" });
      setEditingScore(false);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("goal_events").delete().eq("id", goalId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["goal_events"] });
      toast({ title: "골 이벤트가 삭제되었습니다" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteMatch = async (mid: number) => {
    setSaving(true);
    try {
      await supabase.from("goal_events").delete().eq("match_id", mid);
      await supabase.from("rosters").delete().eq("match_id", mid);
      await supabase.from("results").delete().eq("match_id", mid);
      await supabase.from("teams").delete().eq("match_id", mid);
      await supabase.from("match_attendance").delete().eq("match_id", mid);
      const { error } = await supabase.from("matches").delete().eq("id", mid);
      if (error) throw error;
      ["matches", "teams", "results", "rosters", "goal_events", "match_attendance"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      toast({ title: "경기가 삭제되었습니다" });
      setSelectedMatchId("");
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Select value={selectedMatchId} onValueChange={handleSelectMatch}>
        <SelectTrigger className="bg-card border-border">
          <SelectValue placeholder="수정할 경기 선택" />
        </SelectTrigger>
        <SelectContent>
          {sortedMatches.map(m => {
            const venue = venues.find(v => v.id === m.venue_id);
            const mt = teams.filter(t => t.match_id === m.id);
            const opp = mt.find(t => !t.is_ours);
            return (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.date} - {opp?.name || "자체전"} ({venue?.name ?? "미정"})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {matchId && (
        <>
          {/* Score Edit */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-primary">스코어</h3>
              {!editingScore ? (
                <Button size="sm" variant="outline" onClick={() => setEditingScore(true)} className="h-7 text-xs border-primary/30 text-primary">
                  <Edit size={12} /> 수정
                </Button>
              ) : (
                <Button size="sm" onClick={handleSaveScore} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground">
                  <Save size={12} /> 저장
                </Button>
              )}
            </div>
            {editingScore ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">{ourTeam?.name || "우리팀"}</label>
                  <Input type="number" value={scoreFor} onChange={e => setScoreFor(Number(e.target.value))} className="h-8 text-center bg-background border-border" />
                </div>
                <span className="text-muted-foreground font-bold">:</span>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">상대팀</label>
                  <Input type="number" value={scoreAgainst} onChange={e => setScoreAgainst(Number(e.target.value))} className="h-8 text-center bg-background border-border" />
                </div>
              </div>
            ) : (
              <div className="text-center font-display text-2xl text-foreground">
                {ourResult?.score_for ?? "-"} : {ourResult?.score_against ?? "-"}
                <span className="ml-2 text-sm text-muted-foreground">({ourResult?.result})</span>
              </div>
            )}
          </div>

          {/* Roster */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-primary mb-2">출전 선수 ({matchRoster.length}명)</h3>
            <div className="flex flex-wrap gap-1.5">
              {matchRoster.map(r => (
                <span key={r.id} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground">
                  {getPlayerName(players, r.player_id)}
                </span>
              ))}
            </div>
          </div>

          {/* Goal Events */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-primary mb-2">골 이벤트 ({matchGoals.length}개)</h3>
            <div className="space-y-1.5">
              {matchGoals.map(g => (
                <div key={g.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-primary">{g.quarter}Q</span>
                    {g.is_own_goal ? (
                      <span className="text-destructive">자책골</span>
                    ) : (
                      <>
                        <span className="text-foreground">⚽ {g.goal_player_id ? getPlayerName(players, g.goal_player_id) : "?"}</span>
                        {g.assist_player_id && <span className="text-muted-foreground">← {getPlayerName(players, g.assist_player_id)}</span>}
                      </>
                    )}
                  </div>
                  <button onClick={() => setDeleteTarget({ type: "goal", id: g.id })} className="text-destructive hover:text-destructive/80">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {matchGoals.length === 0 && <p className="text-xs text-muted-foreground">골 이벤트가 없습니다</p>}
            </div>
          </div>

          {/* Delete Match */}
          <Button variant="destructive" onClick={() => setDeleteTarget({ type: "match", id: matchId })} className="w-full">
            <Trash2 size={14} /> 경기 전체 삭제
          </Button>
        </>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="text-destructive" size={18} />
              삭제 확인
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {deleteTarget?.type === "match" ? "이 경기의 모든 데이터(팀, 결과, 로스터, 골 이벤트)가 삭제됩니다. 되돌릴 수 없습니다." : "이 골 이벤트를 삭제하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-border">취소</Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => {
                if (deleteTarget?.type === "match") handleDeleteMatch(deleteTarget.id);
                else if (deleteTarget?.type === "goal") handleDeleteGoal(deleteTarget.id);
              }}
            >
              {saving ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMatchEdit;
