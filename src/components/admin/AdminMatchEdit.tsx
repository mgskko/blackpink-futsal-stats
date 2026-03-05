import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData, getPlayerName } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Save, AlertTriangle, UserPlus, UserMinus, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const AdminMatchEdit = () => {
  const { matches, venues, teams, results, players, rosters, goalEvents } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [editingScore, setEditingScore] = useState(false);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "match" | "goal" | "roster"; id: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Goal editing
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editGoalQuarter, setEditGoalQuarter] = useState(1);
  const [editGoalIsOwnGoal, setEditGoalIsOwnGoal] = useState(false);
  const [editGoalPlayerId, setEditGoalPlayerId] = useState("");
  const [editGoalAssistId, setEditGoalAssistId] = useState("");
  const [editGoalTimestamp, setEditGoalTimestamp] = useState("");

  // YouTube link editing
  const [editYoutubeLink, setEditYoutubeLink] = useState("");
  const [editingYoutube, setEditingYoutube] = useState(false);

  // Guest goal
  const [showGuestGoal, setShowGuestGoal] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestQuarter, setGuestQuarter] = useState(1);
  const [guestIsGoal, setGuestIsGoal] = useState(true);

  // Roster add
  const [showAddRoster, setShowAddRoster] = useState(false);

  // Manual MOM
  const [showMOM, setShowMOM] = useState(false);
  const [manualMOM, setManualMOM] = useState("");

  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const matchId = selectedMatchId ? Number(selectedMatchId) : null;
  const matchTeams = matchId ? teams.filter(t => t.match_id === matchId) : [];
  const matchResults = matchId ? results.filter(r => r.match_id === matchId) : [];
  const matchRoster = matchId ? rosters.filter(r => r.match_id === matchId) : [];
  const matchGoals = matchId ? goalEvents.filter(g => g.match_id === matchId).sort((a, b) => a.quarter - b.quarter) : [];
  const ourTeam = matchTeams.find(t => t.is_ours);
  const ourResult = ourTeam ? matchResults.find(r => r.team_id === ourTeam.id) : null;
  const rosterPlayerIds = new Set(matchRoster.map(r => r.player_id));
  const rosterPlayers = players.filter(p => rosterPlayerIds.has(p.id));
  const nonRosterPlayers = players.filter(p => p.is_active && !rosterPlayerIds.has(p.id));

  const invalidateAll = () => {
    ["matches", "teams", "results", "rosters", "goal_events", "match_attendance", "mom_votes"].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const handleSelectMatch = (v: string) => {
    setSelectedMatchId(v);
    setEditingScore(false);
    setEditingGoalId(null);
    setShowGuestGoal(false);
    setShowAddRoster(false);
    setShowMOM(false);
    const mid = Number(v);
    const mTeams = teams.filter(t => t.match_id === mid);
    const ot = mTeams.find(t => t.is_ours);
    const or2 = ot ? results.find(r => r.team_id === ot.id && r.match_id === mid) : null;
    setScoreFor(or2?.score_for || 0);
    setScoreAgainst(or2?.score_against || 0);
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
      invalidateAll();
      toast({ title: "스코어가 수정되었습니다! ✅" });
      setEditingScore(false);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteGoal = async (goalId: number) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("goal_events").delete().eq("id", goalId);
      if (error) throw error;
      invalidateAll();
      toast({ title: "골 이벤트가 삭제되었습니다" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); setDeleteTarget(null); }
  };

  const handleEditGoal = (g: typeof matchGoals[0]) => {
    setEditingGoalId(g.id);
    setEditGoalQuarter(g.quarter);
    setEditGoalIsOwnGoal(g.is_own_goal);
    setEditGoalPlayerId(g.goal_player_id ? String(g.goal_player_id) : "");
    setEditGoalAssistId(g.assist_player_id ? String(g.assist_player_id) : "");
  };

  const handleSaveGoalEdit = async () => {
    if (!editingGoalId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("goal_events").update({
        quarter: editGoalQuarter,
        is_own_goal: editGoalIsOwnGoal,
        goal_player_id: editGoalIsOwnGoal ? null : (editGoalPlayerId ? Number(editGoalPlayerId) : null),
        assist_player_id: editGoalIsOwnGoal ? null : (editGoalAssistId ? Number(editGoalAssistId) : null),
      }).eq("id", editingGoalId);
      if (error) throw error;
      invalidateAll();
      toast({ title: "골 이벤트가 수정되었습니다 ✅" });
      setEditingGoalId(null);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddGuestGoal = async () => {
    if (!matchId || !guestName.trim()) return;
    setSaving(true);
    try {
      // Insert goal event with no player_id (guest)
      const { error } = await supabase.from("goal_events").insert({
        match_id: matchId,
        team_id: ourTeam?.id || matchTeams[0]?.id,
        quarter: guestQuarter,
        goal_player_id: null,
        assist_player_id: null,
        is_own_goal: false,
        video_timestamp: `용병: ${guestName}`,
      });
      if (error) throw error;
      invalidateAll();
      toast({ title: `용병 ${guestName}의 기록이 추가되었습니다` });
      setGuestName("");
      setShowGuestGoal(false);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddPlayerToRoster = async (pid: number) => {
    if (!matchId || !ourTeam) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("rosters").insert({ match_id: matchId, team_id: ourTeam.id, player_id: pid });
      if (error) throw error;
      invalidateAll();
      toast({ title: `${getPlayerName(players, pid)} 추가됨` });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRemoveFromRoster = async (rosterId: number) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("rosters").delete().eq("id", rosterId);
      if (error) throw error;
      invalidateAll();
      toast({ title: "선수가 명단에서 제거되었습니다" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); setDeleteTarget(null); }
  };

  const handleSetManualMOM = async () => {
    if (!matchId || !manualMOM) return;
    setSaving(true);
    try {
      // Delete existing votes for this match, then insert admin vote
      await supabase.from("mom_votes").delete().eq("match_id", matchId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("mom_votes").insert({
        match_id: matchId,
        voted_player_id: Number(manualMOM),
        voter_id: user.id,
      });
      if (error) throw error;
      invalidateAll();
      toast({ title: `MOM이 ${getPlayerName(players, Number(manualMOM))}(으)로 지정되었습니다 ⭐` });
      setShowMOM(false);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteMatch = async (mid: number) => {
    setSaving(true);
    try {
      await supabase.from("mom_votes").delete().eq("match_id", mid);
      await supabase.from("goal_events").delete().eq("match_id", mid);
      await supabase.from("rosters").delete().eq("match_id", mid);
      await supabase.from("results").delete().eq("match_id", mid);
      await supabase.from("teams").delete().eq("match_id", mid);
      await supabase.from("match_attendance").delete().eq("match_id", mid);
      const { error } = await supabase.from("matches").delete().eq("id", mid);
      if (error) throw error;
      invalidateAll();
      toast({ title: "경기가 삭제되었습니다" });
      setSelectedMatchId("");
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); setDeleteTarget(null); }
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
                <Button size="sm" variant="outline" onClick={() => setEditingScore(true)} className="h-7 text-xs border-primary/30 text-primary"><Edit size={12} /> 수정</Button>
              ) : (
                <Button size="sm" onClick={handleSaveScore} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground"><Save size={12} /> 저장</Button>
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

          {/* Roster with add/remove */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-primary">출전 선수 ({matchRoster.length}명)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddRoster(!showAddRoster)} className="h-7 text-xs border-primary/30 text-primary">
                <UserPlus size={12} /> {showAddRoster ? "닫기" : "추가/제거"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matchRoster.map(r => (
                <span key={r.id} className="group relative rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground">
                  {getPlayerName(players, r.player_id)}
                  {showAddRoster && (
                    <button onClick={() => setDeleteTarget({ type: "roster", id: r.id })} className="ml-1 text-destructive hover:text-destructive/80"><Trash2 size={10} /></button>
                  )}
                </span>
              ))}
            </div>
            {showAddRoster && nonRosterPlayers.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[10px] text-muted-foreground mb-2">클릭하여 추가:</p>
                <div className="flex flex-wrap gap-1.5">
                  {nonRosterPlayers.map(p => (
                    <button key={p.id} onClick={() => handleAddPlayerToRoster(p.id)} disabled={saving}
                      className="rounded-full border border-dashed border-primary/30 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/10 transition-colors">
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Goal Events with edit */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-primary">골 이벤트 ({matchGoals.length}개)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowGuestGoal(!showGuestGoal)} className="h-7 text-xs border-primary/30 text-primary">
                <Plus size={12} /> 용병 기록
              </Button>
            </div>

            {/* Guest goal form */}
            {showGuestGoal && (
              <div className="mb-3 rounded-md border border-dashed border-primary/30 bg-secondary/30 p-3 space-y-2">
                <p className="text-[10px] text-primary font-bold">용병 득점/도움 기록</p>
                <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="용병 이름" className="h-8 text-xs bg-background border-border" />
                <div className="flex gap-2">
                  <Select value={String(guestQuarter)} onValueChange={v => setGuestQuarter(Number(v))}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(q => <SelectItem key={q} value={String(q)}>{q}Q</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddGuestGoal} disabled={saving || !guestName.trim()} className="h-8 text-xs gradient-pink text-primary-foreground">추가</Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {matchGoals.map(g => (
                <div key={g.id}>
                  {editingGoalId === g.id ? (
                    <div className="rounded-md border border-primary/30 bg-secondary/30 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">쿼터</label>
                          <Select value={String(editGoalQuarter)} onValueChange={v => setEditGoalQuarter(Number(v))}>
                            <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                            <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(q => <SelectItem key={q} value={String(q)}>{q}Q</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <Checkbox checked={editGoalIsOwnGoal} onCheckedChange={c => setEditGoalIsOwnGoal(c === true)} className="border-primary" />
                          <label className="text-xs text-muted-foreground">자책골</label>
                        </div>
                      </div>
                      {!editGoalIsOwnGoal && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">득점자</label>
                            <Select value={editGoalPlayerId} onValueChange={setEditGoalPlayerId}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>{rosterPlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">도움</label>
                            <Select value={editGoalAssistId} onValueChange={setEditGoalAssistId}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="없음" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">없음</SelectItem>
                                {rosterPlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveGoalEdit} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground flex-1"><Save size={12} /> 저장</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingGoalId(null)} className="h-7 text-xs border-border">취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-primary">{g.quarter}Q</span>
                        {g.is_own_goal ? (
                          <span className="text-destructive">자책골</span>
                        ) : (
                          <>
                            <span className="text-foreground">⚽ {g.goal_player_id ? getPlayerName(players, g.goal_player_id) : (g.video_timestamp?.startsWith("용병:") ? g.video_timestamp.replace("용병: ", "🎽 ") : "?")}</span>
                            {g.assist_player_id && <span className="text-muted-foreground">← {getPlayerName(players, g.assist_player_id)}</span>}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditGoal(g)} className="text-primary hover:text-primary/80"><Edit size={14} /></button>
                        <button onClick={() => setDeleteTarget({ type: "goal", id: g.id })} className="text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {matchGoals.length === 0 && <p className="text-xs text-muted-foreground">골 이벤트가 없습니다</p>}
            </div>
          </div>

          {/* Manual MOM */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-primary flex items-center gap-1"><Star size={14} /> MOM 수동 지정</h3>
              <Button size="sm" variant="outline" onClick={() => setShowMOM(!showMOM)} className="h-7 text-xs border-primary/30 text-primary">
                {showMOM ? "닫기" : "지정"}
              </Button>
            </div>
            {showMOM && (
              <div className="flex gap-2">
                <Select value={manualMOM} onValueChange={setManualMOM}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border flex-1"><SelectValue placeholder="MOM 선택" /></SelectTrigger>
                  <SelectContent>{rosterPlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={handleSetManualMOM} disabled={saving || !manualMOM} className="h-8 text-xs gradient-pink text-primary-foreground">확정</Button>
              </div>
            )}
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
            <DialogTitle className="text-foreground flex items-center gap-2"><AlertTriangle className="text-destructive" size={18} /> 삭제 확인</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {deleteTarget?.type === "match" ? "이 경기의 모든 데이터가 삭제됩니다. 되돌릴 수 없습니다."
                : deleteTarget?.type === "roster" ? "이 선수를 명단에서 제거하시겠습니까?"
                : "이 골 이벤트를 삭제하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-border">취소</Button>
            <Button variant="destructive" disabled={saving} onClick={() => {
              if (deleteTarget?.type === "match") handleDeleteMatch(deleteTarget.id);
              else if (deleteTarget?.type === "goal") handleDeleteGoal(deleteTarget.id);
              else if (deleteTarget?.type === "roster") handleRemoveFromRoster(deleteTarget.id);
            }}>
              {saving ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMatchEdit;
