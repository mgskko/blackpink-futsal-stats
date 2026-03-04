import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Check, X, HelpCircle } from "lucide-react";

type AttendanceStatus = "attending" | "absent" | "undecided";

interface AttendanceRecord {
  match_id: number;
  player_id: number;
  status: AttendanceStatus;
}

const AdminAttendance = () => {
  const { matches, players, venues } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [attendance, setAttendance] = useState<Map<number, AttendanceStatus>>(new Map());
  const [saving, setSaving] = useState(false);

  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const activePlayers = players.filter(p => p.is_active);

  useEffect(() => {
    if (!selectedMatchId) return;
    const matchId = Number(selectedMatchId);
    supabase
      .from("match_attendance")
      .select("*")
      .eq("match_id", matchId)
      .then(({ data }) => {
        const map = new Map<number, AttendanceStatus>();
        (data ?? []).forEach((r: any) => map.set(r.player_id, r.status));
        setAttendance(map);
      });
  }, [selectedMatchId]);

  const handleStatusChange = async (playerId: number, status: AttendanceStatus) => {
    const matchId = Number(selectedMatchId);
    const prev = new Map(attendance);
    setAttendance(new Map(attendance).set(playerId, status));

    const { error } = await supabase
      .from("match_attendance")
      .upsert(
        { match_id: matchId, player_id: playerId, status, updated_at: new Date().toISOString() },
        { onConflict: "match_id,player_id" }
      );

    if (error) {
      setAttendance(prev);
      toast({ title: "오류", description: error.message, variant: "destructive" });
    }
  };

  const attendingCount = [...attendance.values()].filter(s => s === "attending").length;
  const absentCount = [...attendance.values()].filter(s => s === "absent").length;

  const statusButton = (playerId: number, status: AttendanceStatus, icon: React.ReactNode, label: string, activeClass: string) => {
    const current = attendance.get(playerId) ?? "undecided";
    const isActive = current === status;
    return (
      <button
        onClick={() => handleStatusChange(playerId, status)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          isActive ? activeClass : "bg-secondary text-muted-foreground hover:bg-secondary/80"
        }`}
      >
        {icon} {label}
      </button>
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
        <SelectTrigger className="border-border bg-card">
          <SelectValue placeholder="경기를 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {sortedMatches.map(m => {
            const venue = venues.find(v => v.id === m.venue_id);
            return (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.date} - {venue?.name ?? "미정"} ({m.match_type})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {selectedMatchId && (
        <>
          <div className="flex gap-3 text-center">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <div className="text-lg font-bold text-primary">{attendingCount}</div>
              <div className="text-xs text-muted-foreground">참석</div>
            </div>
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <div className="text-lg font-bold text-destructive">{absentCount}</div>
              <div className="text-xs text-muted-foreground">불참</div>
            </div>
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <div className="text-lg font-bold text-muted-foreground">
                {activePlayers.length - attendingCount - absentCount}
              </div>
              <div className="text-xs text-muted-foreground">미정</div>
            </div>
          </div>

          <div className="space-y-2">
            {activePlayers.map(player => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <span className="text-sm font-medium text-foreground">{player.name}</span>
                <div className="flex gap-1">
                  {statusButton(player.id, "attending", <Check size={12} />, "참석", "bg-primary text-primary-foreground")}
                  {statusButton(player.id, "absent", <X size={12} />, "불참", "bg-destructive text-destructive-foreground")}
                  {statusButton(player.id, "undecided", <HelpCircle size={12} />, "미정", "bg-accent text-accent-foreground")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAttendance;
