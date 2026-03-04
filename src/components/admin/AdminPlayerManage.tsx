import { useState } from "react";
import { usePlayers } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Save, User } from "lucide-react";

const AdminPlayerManage = () => {
  const { data: players = [], isLoading } = usePlayers();
  const queryClient = useQueryClient();
  const [editingNumbers, setEditingNumbers] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

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

    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
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
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">로딩 중...</div>;

  return (
    <div className="mt-4 space-y-6">
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
    </div>
  );
};

export default AdminPlayerManage;
