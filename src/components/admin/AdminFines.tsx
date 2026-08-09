import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { useDisplayName } from "@/lib/displayName";
import { useFines, summarizeFines, FINE_AMOUNTS, FineType, fineLabel, formatKRW } from "@/hooks/useFines";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const TYPES: FineType[] = ["late", "no_show", "late_cancel"];

const AdminFines = () => {
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const displayName = useDisplayName();
  const { players } = useAllFutsalData();
  const { data: fines = [] } = useFines();
  const qc = useQueryClient();

  const activePlayers = players.filter(p => p.is_active);
  const [playerId, setPlayerId] = useState<string>("");
  const [fineType, setFineType] = useState<FineType>("late");
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>(String(FINE_AMOUNTS.late));
  const [isWaived, setIsWaived] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const playerName = (id: number) => {
    const p = players.find(x => x.id === id);
    return p ? displayName(p) : `#${id}`;
  };

  const totals = useMemo(() => summarizeFines(fines), [fines]);

  // 연간 1회 면제: 해당 선수의 올해 late_cancel 면제 사용 여부
  const waiverUsed = useMemo(() => {
    if (!playerId) return false;
    const year = (matchDate || "").slice(0, 4);
    return fines.some(f =>
      f.player_id === Number(playerId) &&
      f.fine_type === "late_cancel" &&
      f.is_waived &&
      (f.match_date ?? f.created_at).slice(0, 4) === year
    );
  }, [fines, playerId, matchDate]);

  const handleTypeChange = (t: FineType) => {
    setFineType(t);
    setAmount(String(FINE_AMOUNTS[t]));
    if (t !== "late_cancel") setIsWaived(false);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["player_fines"] });

  const handleAdd = async () => {
    if (!playerId) {
      toast({ title: L("선수를 선택하세요", "Select a player"), variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("player_fines").insert({
      player_id: Number(playerId),
      fine_type: fineType,
      amount: isWaived ? 0 : Number(amount) || 0,
      match_date: matchDate || null,
      is_waived: isWaived,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: L("오류", "Error"), description: error.message, variant: "destructive" });
      return;
    }
    setNote("");
    setIsWaived(false);
    refresh();
    toast({ title: L("벌금이 부과되었습니다", "Fine recorded") });
  };

  const togglePaid = async (id: string, paid: boolean) => {
    const { error } = await supabase.from("player_fines").update({ is_paid: paid }).eq("id", id);
    if (error) toast({ title: L("오류", "Error"), description: error.message, variant: "destructive" });
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("player_fines").delete().eq("id", id);
    if (error) toast({ title: L("오류", "Error"), description: error.message, variant: "destructive" });
    refresh();
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("총 벌금", "Total Fines")}</div>
          <div className="text-sm font-bold text-primary">{formatKRW(totals.total, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("납부", "Paid")}</div>
          <div className="text-sm font-bold text-foreground">{formatKRW(totals.paid, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("미납", "Unpaid")}</div>
          <div className="text-sm font-bold text-destructive">{formatKRW(totals.unpaid, isEn)}</div>
        </div>
      </div>

      {/* Create */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-sm font-bold text-primary">
          <Coins size={16} /> {L("벌금 부과", "Issue a Fine")}
        </div>

        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder={L("선수 선택", "Select player")} />
          </SelectTrigger>
          <SelectContent>
            {activePlayers.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{displayName(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fineType} onValueChange={(v) => handleTypeChange(v as FineType)}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => (
              <SelectItem key={t} value={t}>
                {fineLabel(t, isEn)} · {formatKRW(FINE_AMOUNTS[t], isEn)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="bg-background border-border" />
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background border-border" />
        </div>

        {fineType === "late_cancel" && (
          <label className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
            <Checkbox checked={isWaived} onCheckedChange={(c) => setIsWaived(c === true)} className="border-primary data-[state=checked]:bg-primary" />
            <span>
              {L("연간 1회 면제 적용", "Apply annual one-time waiver")}
              {waiverUsed && <span className="ml-1 text-destructive">{L("(올해 이미 사용)", "(already used this year)")}</span>}
            </span>
          </label>
        )}

        <Input value={note} onChange={e => setNote(e.target.value)} placeholder={L("메모 (선택)", "Note (optional)")} className="bg-background border-border" />

        <Button onClick={handleAdd} disabled={saving} className="w-full gradient-pink text-primary-foreground font-bold">
          <Plus size={16} /> {L("벌금 부과", "Add Fine")}
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {fines.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">{L("등록된 벌금 내역이 없습니다", "No fines recorded yet")}</p>
        )}
        {fines.map(f => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {playerName(f.player_id)}
                <span className="ml-2 text-xs text-muted-foreground">{fineLabel(f.fine_type, isEn)}</span>
                {f.is_waived && <span className="ml-2 text-[10px] text-emerald-400">{L("면제", "Waived")}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {f.match_date ?? f.created_at.slice(0, 10)} · {formatKRW(f.is_waived ? 0 : f.amount, isEn)}
                {f.note ? ` · ${f.note}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${f.is_paid ? "text-primary" : "text-muted-foreground"}`}>
                {f.is_paid ? L("납부", "Paid") : L("미납", "Unpaid")}
              </span>
              <Checkbox
                checked={f.is_paid}
                onCheckedChange={(c) => togglePaid(f.id, c === true)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <button onClick={() => remove(f.id)} className="text-destructive/70 hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFines;
