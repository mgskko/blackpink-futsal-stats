import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData, getPlayerName } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Save, AlertTriangle, UserPlus, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import CreatableSelect from "@/components/ui/creatable-select";
import AdminQuarterEditor from "@/components/admin/AdminQuarterEditor";
import AdminCustomQuarterEditor from "@/components/admin/AdminCustomQuarterEditor";

const AGE_CATEGORIES = [
  "20대 초반", "20대 중반", "20대 후반",
  "2030 혼합", "30대 초반", "30대 중반", "30대 후반",
  "3040 혼합", "30대초중반", "30대중~40대",
  "정보없음",
];

const GOAL_TYPE_OPTIONS = ["주워먹기", "중거리골", "발리골", "헤딩골", "칩슛", "드리블골", "터닝골", "아크로바틱", "파포스트골", "엉덩이골", "가슴골", "프리킥골", "페널티킥", "코너킥직접골"];
const ASSIST_TYPE_OPTIONS = ["킬패스", "컷백패스", "크로스", "스루패스", "숏패스", "롱패스", "코너킥", "프리킥", "헤더패스", "드리블돌파", "GK어시"];
const BUILD_UP_OPTIONS = ["압박 탈취", "역습", "빌드업", "세트피스", "개인기", "키퍼 실수", "혼전", "세컨볼", "패스연계", "롱볼"];

const AdminMatchEdit = () => {
  const { matches, venues, teams, results, players, rosters, goalEvents } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [editingScore, setEditingScore] = useState(false);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "match" | "goal" | "roster"; id: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Goal editing states
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editGoalQuarter, setEditGoalQuarter] = useState(1);
  const [editGoalIsOwnGoal, setEditGoalIsOwnGoal] = useState(false);
  const [editGoalPlayerId, setEditGoalPlayerId] = useState("");
  const [editGoalAssistId, setEditGoalAssistId] = useState("");
  const [editGoalTimestamp, setEditGoalTimestamp] = useState("");
  const [editGoalType, setEditGoalType] = useState("");
  const [editAssistType, setEditAssistType] = useState("");
  const [editBuildUp, setEditBuildUp] = useState("");

  // YouTube link editing
  const [editYoutubeLink, setEditYoutubeLink] = useState("");
  const [editingYoutube, setEditingYoutube] = useState(false);

  // Add goal record (replaces guest-only)
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [addQuarter, setAddQuarter] = useState(1);
  const [addIsOwnGoal, setAddIsOwnGoal] = useState(false);
  const [addGoalPlayerId, setAddGoalPlayerId] = useState("");
  const [addAssistPlayerId, setAddAssistPlayerId] = useState("");
  const [addTimestamp, setAddTimestamp] = useState("");
  const [addGoalType, setAddGoalType] = useState("");
  const [addAssistType, setAddAssistType] = useState("");
  const [addBuildUp, setAddBuildUp] = useState("");

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
  const allSelectablePlayers = [...rosterPlayers, ...nonRosterPlayers];

  const invalidateAll = () => {
    ["matches", "teams", "results", "rosters", "goal_events", "match_attendance", "mom_votes"].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const handleSelectMatch = (v: string) => {
    setSelectedMatchId(v);
    setEditingScore(false);
    setEditingGoalId(null);
    setShowAddGoal(false);
    setShowAddRoster(false);
    setShowMOM(false);
    setEditingYoutube(false);
    const mid = Number(v);
    const mTeams = teams.filter(t => t.match_id === mid);
    const ot = mTeams.find(t => t.is_ours);
    const or2 = ot ? results.find(r => r.team_id === ot.id && r.match_id === mid) : null;
    setScoreFor(or2?.score_for || 0);
    setScoreAgainst(or2?.score_against || 0);
    const m = matches.find(m => m.id === mid);
    setEditYoutubeLink(m?.youtube_link || "");
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
    setEditGoalTimestamp(g.video_timestamp || "");
    setEditGoalType(g.goal_type || "");
    setEditAssistType(g.assist_type || "");
    setEditBuildUp(g.build_up_process || "");
  };

  const handleSaveGoalEdit = async () => {
    if (!editingGoalId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("goal_events").update({
        quarter: editGoalQuarter,
        is_own_goal: editGoalIsOwnGoal,
        goal_player_id: editGoalPlayerId ? Number(editGoalPlayerId) : null,
        assist_player_id: editGoalIsOwnGoal ? null : (editGoalAssistId && editGoalAssistId !== "none" ? Number(editGoalAssistId) : null),
        video_timestamp: editGoalTimestamp || null,
        goal_type: editGoalType || null,
        assist_type: editAssistType || null,
        build_up_process: editBuildUp || null,
      }).eq("id", editingGoalId);
      if (error) throw error;
      invalidateAll();
      toast({ title: "골 이벤트가 수정되었습니다 ✅" });
      setEditingGoalId(null);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddGoalRecord = async () => {
    if (!matchId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("goal_events").insert({
        match_id: matchId,
        team_id: ourTeam?.id || matchTeams[0]?.id,
        quarter: addQuarter,
        goal_player_id: addGoalPlayerId ? Number(addGoalPlayerId) : null,
        assist_player_id: addIsOwnGoal ? null : (addAssistPlayerId && addAssistPlayerId !== "none" ? Number(addAssistPlayerId) : null),
        is_own_goal: addIsOwnGoal,
        video_timestamp: addTimestamp || null,
        goal_type: addGoalType || null,
        assist_type: addAssistType || null,
        build_up_process: addBuildUp || null,
      });
      if (error) throw error;
      invalidateAll();
      toast({ title: "기록이 추가되었습니다 ✅" });
      setAddQuarter(1); setAddIsOwnGoal(false); setAddGoalPlayerId(""); setAddAssistPlayerId("");
      setAddTimestamp(""); setAddGoalType(""); setAddAssistType(""); setAddBuildUp("");
      setShowAddGoal(false);
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
      await supabase.from("mom_votes").delete().eq("match_id", matchId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("mom_votes").insert({
        match_id: matchId, voted_player_id: Number(manualMOM), voter_id: user.id,
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

  const GoalEditFields = ({ isOwnGoal, goalType, setGoalType, assistType, setAssistType, buildUp, setBuildUp }: {
    isOwnGoal: boolean; goalType: string; setGoalType: (v: string) => void;
    assistType: string; setAssistType: (v: string) => void; buildUp: string; setBuildUp: (v: string) => void;
  }) => (
    <>
      {!isOwnGoal && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">골 유형</label>
            <CreatableSelect value={goalType} onChange={setGoalType} options={GOAL_TYPE_OPTIONS} placeholder="골 유형" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">어시스트 유형</label>
            <CreatableSelect value={assistType} onChange={setAssistType} options={ASSIST_TYPE_OPTIONS} placeholder="어시 유형" />
          </div>
        </div>
      )}
      <div>
        <label className="text-[10px] text-muted-foreground">득점 과정</label>
        <CreatableSelect value={buildUp} onChange={setBuildUp} options={BUILD_UP_OPTIONS} placeholder="득점 과정" />
      </div>
    </>
  );

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
          {/* YouTube Link Edit */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-primary">유튜브 링크</h3>
              {!editingYoutube ? (
                <Button size="sm" variant="outline" onClick={() => setEditingYoutube(true)} className="h-7 text-xs border-primary/30 text-primary"><Edit size={12} /> 수정</Button>
              ) : (
                <Button size="sm" onClick={async () => {
                  setSaving(true);
                  try {
                    await supabase.from("matches").update({ youtube_link: editYoutubeLink || null }).eq("id", matchId!);
                    invalidateAll();
                    toast({ title: "유튜브 링크가 수정되었습니다 ✅" });
                    setEditingYoutube(false);
                  } catch (err: any) { toast({ title: "오류", description: err.message, variant: "destructive" }); }
                  finally { setSaving(false); }
                }} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground"><Save size={12} /> 저장</Button>
              )}
            </div>
            {editingYoutube ? (
              <Input value={editYoutubeLink} onChange={e => setEditYoutubeLink(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-8 text-xs bg-background border-border" />
            ) : (
              <p className="text-xs text-muted-foreground truncate">{editYoutubeLink || "없음"}</p>
            )}
          </div>

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

          {/* Goal Events */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-primary">골 이벤트 ({matchGoals.length}개)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddGoal(!showAddGoal)} className="h-7 text-xs border-primary/30 text-primary">
                <Plus size={12} /> 기록
              </Button>
            </div>

            {/* Add goal form */}
            {showAddGoal && (
              <div className="mb-3 rounded-md border border-dashed border-primary/30 bg-secondary/30 p-3 space-y-2">
                <p className="text-[10px] text-primary font-bold">득점 기록 추가</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">쿼터</label>
                    <Select value={String(addQuarter)} onValueChange={v => setAddQuarter(Number(v))}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(q => <SelectItem key={q} value={String(q)}>{q}Q</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Checkbox checked={addIsOwnGoal} onCheckedChange={c => setAddIsOwnGoal(c === true)} className="border-primary" />
                    <label className="text-xs text-muted-foreground">자책골</label>
                  </div>
                </div>
                {addIsOwnGoal && (
                  <div>
                    <label className="text-[10px] text-muted-foreground">자책골 선수 (우리 팀)</label>
                    <Select value={addGoalPlayerId} onValueChange={setAddGoalPlayerId}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="자책골 선수" /></SelectTrigger>
                      <SelectContent>{rosterPlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {!addIsOwnGoal && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">득점자</label>
                      <Select value={addGoalPlayerId} onValueChange={setAddGoalPlayerId}>
                        <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>{allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">도움</label>
                      <Select value={addAssistPlayerId} onValueChange={setAddAssistPlayerId}>
                        <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="없음" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">없음</SelectItem>
                          {allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground">타임스탬프 (예: 1:12:08)</label>
                  <Input value={addTimestamp} onChange={e => setAddTimestamp(e.target.value)} placeholder="0:00" className="h-8 text-xs bg-background border-border" />
                </div>
                <GoalEditFields isOwnGoal={addIsOwnGoal} goalType={addGoalType} setGoalType={setAddGoalType}
                  assistType={addAssistType} setAssistType={setAddAssistType} buildUp={addBuildUp} setBuildUp={setAddBuildUp} />
                <Button size="sm" onClick={handleAddGoalRecord} disabled={saving} className="w-full h-8 text-xs gradient-pink text-primary-foreground">추가</Button>
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
                      {editGoalIsOwnGoal && (
                        <div>
                          <label className="text-[10px] text-muted-foreground">자책골 선수 (우리 팀)</label>
                          <Select value={editGoalPlayerId} onValueChange={setEditGoalPlayerId}>
                            <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="자책골 선수" /></SelectTrigger>
                            <SelectContent>{rosterPlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                      {!editGoalIsOwnGoal && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">득점자</label>
                            <Select value={editGoalPlayerId} onValueChange={setEditGoalPlayerId}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>{allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">도움</label>
                            <Select value={editGoalAssistId} onValueChange={setEditGoalAssistId}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue placeholder="없음" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">없음</SelectItem>
                                {allSelectablePlayers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] text-muted-foreground">타임스탬프 (예: 1:12:08)</label>
                        <Input value={editGoalTimestamp} onChange={e => setEditGoalTimestamp(e.target.value)} placeholder="0:00" className="h-8 text-xs bg-background border-border" />
                      </div>
                      <GoalEditFields isOwnGoal={editGoalIsOwnGoal} goalType={editGoalType} setGoalType={setEditGoalType}
                        assistType={editAssistType} setAssistType={setEditAssistType} buildUp={editBuildUp} setBuildUp={setEditBuildUp} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveGoalEdit} disabled={saving} className="h-7 text-xs gradient-pink text-primary-foreground flex-1"><Save size={12} /> 저장</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingGoalId(null)} className="h-7 text-xs border-border">취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-bold text-primary">{g.quarter}Q</span>
                        {g.is_own_goal ? (
                          <span className="text-destructive">자책골</span>
                        ) : (
                          <>
                            <span className="text-foreground">⚽ {g.goal_player_id ? getPlayerName(players, g.goal_player_id) : (g.video_timestamp?.startsWith("용병:") ? g.video_timestamp.replace("용병: ", "🎽 ") : "?")}</span>
                            {g.assist_player_id && <span className="text-muted-foreground">← {getPlayerName(players, g.assist_player_id)}</span>}
                            {g.goal_type && <span className="text-[10px] text-primary/70">({g.goal_type})</span>}
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

          {/* Opponent Age Category */}
          {(() => {
            const oppTeam = matchTeams.find(t => !t.is_ours);
            if (!oppTeam) return null;
            return (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-bold text-primary mb-2">상대팀 연령대</h3>
                <div className="flex gap-2">
                  <Select value={oppTeam.age_category || ""} onValueChange={async (v) => {
                    await supabase.from("teams").update({ age_category: v, original_age_desc: v }).eq("id", oppTeam.id);
                    invalidateAll();
                    toast({ title: "연령대가 수정되었습니다 ✅" });
                  }}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border flex-1"><SelectValue placeholder="연령대 선택" /></SelectTrigger>
                    <SelectContent>{AGE_CATEGORIES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            );
          })()}

          {/* Quarter Editor */}
          <AdminQuarterEditor matchId={matchId} rosterPlayerIds={[...rosterPlayerIds]} players={players} />

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
