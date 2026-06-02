import { useState } from "react";
import { usePlayers } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Camera, Save, User, Plus, Trash2 } from "lucide-react";

const AdminPlayerManage = () => {
  const { data: players = [], isLoading } = usePlayers();
  const queryClient = useQueryClient();
  const [editingNumbers, setEditingNumbers] = useState<Record<number, string>>({});
  const [editingNamesEn, setEditingNamesEn] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingNameEnId, setSavingNameEnId] = useState<number | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<typeof players[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePlayer = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const pid = deleteTarget.id;
    // Clean related rows first (no FK cascade in DB)
    await Promise.all([
      supabase.from("rosters").delete().eq("player_id", pid),
      supabase.from("match_attendance").delete().eq("player_id", pid),
      supabase.from("goal_events").delete().eq("goal_player_id", pid),
      supabase.from("goal_events").delete().eq("assist_player_id", pid),
      supabase.from("mom_votes").delete().eq("voted_player_id", pid),
      supabase.from("worst_votes").delete().eq("voted_player_id", pid),
      supabase.from("monthly_dues").delete().eq("player_id", pid),
      supabase.from("player_comments").delete().eq("player_id", pid),
    ]);
    const { error, count } = await supabase
      .from("players")
      .delete({ count: "exact" })
      .eq("id", pid);
    setIsDeleting(false);
    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }
    if (!count || count === 0) {
      toast.error("삭제 권한이 없거나 이미 삭제된 선수입니다");
      return;
    }
    toast.success(`${deleteTarget.name} 선수가 삭제되었습니다`);
    setDeleteTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["players"] }),
      queryClient.invalidateQueries({ queryKey: ["rosters"] }),
      queryClient.invalidateQueries({ queryKey: ["goal_events"] }),
    ]);
    queryClient.refetchQueries({ queryKey: ["players"] });
  };

  const handleAddPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) { toast.error("선수 이름을 입력해 주세요"); return; }
    setIsAdding(true);
    // Get next available ID
    const maxId = players.length > 0 ? Math.max(...players.map(p => p.id)) : 0;
    const newId = maxId + 1;
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("players").insert({
      id: newId,
      name,
      is_active: true,
      is_guest: false,
      join_date: today,
    });
    setIsAdding(false);
    if (error) { toast.error("선수 등록 실패: " + error.message); return; }
    toast.success(`${name} 선수가 등록되었습니다`);
    setNewPlayerName("");
    queryClient.invalidateQueries({ queryKey: ["players"] });
  };

  const activePlayers = [...players].filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const inactivePlayers = [...players].filter(p => !p.is_active).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const handleBackNumberChange = (playerId: number, value: string) => {
    setEditingNumbers(prev => ({ ...prev, [playerId]: value }));
  };

  const saveBackNumber = async (playerId: number) => {
    const val = editingNumbers[playerId];
    if (val === undefined) return;
    setSavingId(playerId);
    const num = val === "" ? null : parseInt(val);
    const { error } = await supabase.from("players").update({ back_number: num } as any).eq("id", playerId);
    setSavingId(null);
    if (error) { toast.error("저장 실패"); return; }
    toast.success("등번호 저장 완료");
    setEditingNumbers(prev => { const n = { ...prev }; delete n[playerId]; return n; });
    queryClient.invalidateQueries({ queryKey: ["players"] });
  };

  const saveNameEn = async (playerId: number) => {
    const val = editingNamesEn[playerId];
    if (val === undefined) return;
    setSavingNameEnId(playerId);
    const next = val.trim() === "" ? null : val.trim();
    const { error } = await supabase.from("players").update({ name_en: next } as any).eq("id", playerId);
    setSavingNameEnId(null);
    if (error) { toast.error("EN 이름 저장 실패"); return; }
    toast.success("영문 이름 저장 완료");
    setEditingNamesEn(prev => { const n = { ...prev }; delete n[playerId]; return n; });
    queryClient.invalidateQueries({ queryKey: ["players"] });
  };

  const handleImageUpload = async (playerId: number, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 업로드 가능합니다"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("5MB 이하 파일만 가능합니다"); return; }

    setUploadingId(playerId);
    const ext = file.name.split(".").pop();
    const path = `${playerId}.${ext}`;

    // Delete old image if exists
    await supabase.storage.from("player-images").remove([path]);

    const { error: uploadError } = await supabase.storage.from("player-images").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("업로드 실패: " + uploadError.message); setUploadingId(null); return; }

    const { data: urlData } = supabase.storage.from("player-images").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now();

    const { error: updateError } = await supabase.from("players").update({ profile_image_url: url } as any).eq("id", playerId);
    setUploadingId(null);
    if (updateError) { toast.error("URL 저장 실패"); return; }

    toast.success("프로필 사진 업로드 완료");
    queryClient.invalidateQueries({ queryKey: ["players"] });
  };

  const PlayerRow = ({ player }: { player: typeof players[0] }) => {
    const currentVal = editingNumbers[player.id] ?? (player.back_number?.toString() ?? "");
    const hasChanged = editingNumbers[player.id] !== undefined;
    const currentNameEn = editingNamesEn[player.id] ?? ((player as any).name_en ?? "");
    const hasNameEnChanged = editingNamesEn[player.id] !== undefined;

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-3">
        {/* Profile Image */}
        <div className="relative flex-shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-border bg-secondary flex items-center justify-center">
            {player.profile_image_url ? (
              <img src={player.profile_image_url} alt={player.name} className="h-full w-full object-cover" />
            ) : (
              <User size={20} className="text-muted-foreground" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110">
            <Camera size={12} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(player.id, f);
              }}
              disabled={uploadingId === player.id}
            />
          </label>
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground text-sm truncate">{player.name}</div>
          {uploadingId === player.id && <div className="text-[10px] text-primary animate-pulse">업로드 중...</div>}
        </div>

        {/* Back Number */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">#</span>
          <Input
            type="number"
            value={currentVal}
            onChange={(e) => handleBackNumberChange(player.id, e.target.value)}
            className="h-8 w-16 text-center text-sm bg-secondary border-border"
            placeholder="-"
          />
          {hasChanged && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-primary hover:text-primary"
              onClick={() => saveBackNumber(player.id)}
              disabled={savingId === player.id}
            >
              <Save size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteTarget(player)}
            title="선수 삭제"
          >
            <Trash2 size={14} />
          </Button>
        </div>
        </div>
        {/* EN Name editor */}
        <div className="flex items-center gap-2 pl-15">
          <span className="text-[10px] font-bold text-muted-foreground w-10">EN</span>
          <Input
            value={currentNameEn}
            onChange={(e) => setEditingNamesEn(prev => ({ ...prev, [player.id]: e.target.value }))}
            placeholder="English name (e.g. Myungseok Kim)"
            className="h-8 flex-1 text-sm bg-secondary border-border"
          />
          {hasNameEnChanged && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-primary hover:text-primary"
              onClick={() => saveNameEn(player.id)}
              disabled={savingNameEnId === player.id}
            >
              <Save size={14} />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">로딩 중...</div>;

  return (
    <div className="mt-4 space-y-6">
      {/* 신규 선수 등록 */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Input
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          placeholder="새 선수 이름 입력"
          className="h-9 flex-1 bg-card border-border text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
          disabled={isAdding}
        />
        <Button
          size="sm"
          onClick={handleAddPlayer}
          disabled={isAdding || !newPlayerName.trim()}
          className="h-9 gap-1.5"
        >
          <Plus size={14} />
          등록
        </Button>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-bold text-foreground">활동 선수 ({activePlayers.length}명)</h3>
        <div className="space-y-2">
          {activePlayers.map(p => <PlayerRow key={p.id} player={p} />)}
        </div>
      </div>
      {inactivePlayers.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">비활동 선수 ({inactivePlayers.length}명)</h3>
          <div className="space-y-2">
            {inactivePlayers.map(p => <PlayerRow key={p.id} player={p} />)}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선수 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 <span className="font-bold text-foreground">{deleteTarget?.name}</span> 선수를 삭제하시겠습니까?
              <br />
              (관련 출전 기록에 영향이 있을 수 있습니다.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeletePlayer(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPlayerManage;
