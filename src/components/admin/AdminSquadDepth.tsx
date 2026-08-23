import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { DEPTH_POSITIONS, useSquadDepth } from "@/components/tactics/SquadDepthBoard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminSquadDepth = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const qc = useQueryClient();
  const { players } = useAllFutsalData();
  const activePlayers = players.filter((p) => p.is_active);
  const { data: rows = [] } = useSquadDepth();

  const refresh = () => qc.invalidateQueries({ queryKey: ["squad_depth"] });

  const add = async (code: string, playerId: number) => {
    const list = rows.filter((r) => r.position_code === code);
    if (list.some((r) => r.player_id === playerId)) return;
    const { error } = await supabase
      .from("squad_depth")
      .insert({ position_code: code, player_id: playerId, sort_order: list.length } as never);
    if (error) return toast({ title: "오류", description: error.message, variant: "destructive" });
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("squad_depth").delete().eq("id", id);
    if (error) return toast({ title: "오류", description: error.message, variant: "destructive" });
    refresh();
  };

  const moveUp = async (code: string, id: string) => {
    const list = rows.filter((r) => r.position_code === code);
    const idx = list.findIndex((r) => r.id === id);
    if (idx <= 0) return;
    const above = list[idx - 1];
    const cur = list[idx];
    await supabase.from("squad_depth").update({ sort_order: above.sort_order } as never).eq("id", cur.id);
    await supabase.from("squad_depth").update({ sort_order: cur.sort_order } as never).eq("id", above.id);
    refresh();
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        {isEnglish
          ? "Manage football squad depth by position. Changes appear instantly on the Tactics tab."
          : "포지션별 스쿼드 뎁스를 관리합니다. 수정 시 TACTICS 탭에 즉시 반영됩니다."}
      </p>

      {DEPTH_POSITIONS.map((pos) => {
        const list = rows.filter((r) => r.position_code === pos.code);
        return (
          <div key={pos.code} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">{pos.code}</span>
              <span className="text-xs text-muted-foreground">{isEnglish ? pos.en : pos.ko}</span>
            </div>

            <div className="space-y-1">
              {list.length === 0 && (
                <p className="text-[11px] text-muted-foreground">{isEnglish ? "TBD" : "미정"}</p>
              )}
              {list.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5">
                  <span className="w-4 text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-xs font-medium text-foreground">
                    {players.find((p) => p.id === r.player_id)?.name ?? `#${r.player_id}`}
                  </span>
                  <button
                    onClick={() => moveUp(pos.code, r.id)}
                    disabled={i === 0}
                    className="text-muted-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <Select value="" onValueChange={(v) => add(pos.code, Number(v))}>
              <SelectTrigger className="mt-2 h-8 bg-background text-xs">
                <SelectValue placeholder={isEnglish ? "+ Add player" : "+ 선수 추가"} />
              </SelectTrigger>
              <SelectContent>
                {activePlayers
                  .filter((p) => !list.some((r) => r.player_id === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
};

export default AdminSquadDepth;
