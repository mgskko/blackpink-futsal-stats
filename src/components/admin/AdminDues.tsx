import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const AdminDues = () => {
  const { players } = useAllFutsalData();
  const activePlayers = players.filter(p => p.is_active);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [paidMap, setPaidMap] = useState<Map<number, boolean>>(new Map());

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  useEffect(() => {
    supabase
      .from("monthly_dues")
      .select("*")
      .eq("year_month", yearMonth)
      .then(({ data }) => {
        const map = new Map<number, boolean>();
        (data ?? []).forEach((r: any) => map.set(r.player_id, r.is_paid));
        setPaidMap(map);
      });
  }, [yearMonth]);

  const handleToggle = async (playerId: number, paid: boolean) => {
    const prev = new Map(paidMap);
    setPaidMap(new Map(paidMap).set(playerId, paid));

    const { error } = await supabase
      .from("monthly_dues")
      .upsert(
        { player_id: playerId, year_month: yearMonth, is_paid: paid, updated_at: new Date().toISOString() },
        { onConflict: "player_id,year_month" }
      );

    if (error) {
      setPaidMap(prev);
      toast({ title: "오류", description: error.message, variant: "destructive" });
    }
  };

  const paidCount = [...paidMap.values()].filter(Boolean).length;

  return (
    <div className="space-y-4 mt-4">
      <Select value={yearMonth} onValueChange={setYearMonth}>
        <SelectTrigger className="bg-card border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <span className="text-sm text-foreground">납부 현황</span>
        <span className="text-sm font-bold text-primary">{paidCount} / {activePlayers.length}</span>
      </div>

      <div className="space-y-2">
        {activePlayers.map(player => (
          <div key={player.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <span className="text-sm font-medium text-foreground">{player.name}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${paidMap.get(player.id) ? "text-primary" : "text-muted-foreground"}`}>
                {paidMap.get(player.id) ? "납부" : "미납"}
              </span>
              <Checkbox
                checked={paidMap.get(player.id) ?? false}
                onCheckedChange={(c) => handleToggle(player.id, c === true)}
                className="border-primary data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDues;
