import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const AdminMatchCreate = () => {
  const { venues, players } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [venueId, setVenueId] = useState("");
  const [matchType, setMatchType] = useState("6:6 풋살");
  const [isCustom, setIsCustom] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const activePlayers = players.filter(p => p.is_active);

  const togglePlayer = (id: number) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedPlayers(activePlayers.map(p => p.id));
  };

  const handleCreate = async () => {
    if (!date) {
      toast({ title: "날짜를 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Create match
      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert({
          date,
          venue_id: venueId ? Number(venueId) : null,
          match_type: matchType,
          is_custom: isCustom,
        })
        .select()
        .single();

      if (matchErr) throw matchErr;

      // Create teams
      const teamInserts = [
        { match_id: match.id, name: "버니즈", is_ours: true },
      ];
      if (!isCustom && opponentName) {
        teamInserts.push({ match_id: match.id, name: opponentName, is_ours: false });
      }
      if (isCustom) {
        teamInserts.push({ match_id: match.id, name: "버니즈 B", is_ours: true });
      }

      const { data: createdTeams, error: teamErr } = await supabase
        .from("teams")
        .insert(teamInserts)
        .select();

      if (teamErr) throw teamErr;

      // Create roster entries for our team
      const ourTeam = createdTeams.find((t: any) => t.name === "버니즈");
      if (ourTeam && selectedPlayers.length > 0) {
        const rosterInserts = selectedPlayers.map(pid => ({
          match_id: match.id,
          team_id: ourTeam.id,
          player_id: pid,
        }));
        await supabase.from("rosters").insert(rosterInserts);
      }

      // Create empty results
      for (const team of createdTeams) {
        await supabase.from("results").insert({
          match_id: match.id,
          team_id: team.id,
          result: "무",
          score_for: 0,
          score_against: 0,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["rosters"] });

      toast({ title: "경기가 생성되었습니다! ⚽" });
      // Reset
      setDate("");
      setVenueId("");
      setOpponentName("");
      setSelectedPlayers([]);
      setIsCustom(false);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">날짜</label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-card border-border" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">장소</label>
        <Select value={venueId} onValueChange={setVenueId}>
          <SelectTrigger className="bg-card border-border"><SelectValue placeholder="장소 선택" /></SelectTrigger>
          <SelectContent>
            {venues.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">경기 유형</label>
        <Select value={matchType} onValueChange={setMatchType}>
          <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="6:6 풋살">6:6 풋살</SelectItem>
            <SelectItem value="7:7 풋살">7:7 풋살</SelectItem>
            <SelectItem value="5:5 풋살">5:5 풋살</SelectItem>
            <SelectItem value="11:11 축구">11:11 축구</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={isCustom}
          onCheckedChange={(c) => setIsCustom(c === true)}
          className="border-primary"
        />
        <label className="text-sm text-foreground">자체전</label>
      </div>

      {!isCustom && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">상대팀 이름</label>
          <Input value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="상대팀" className="bg-card border-border" />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">출전 선수 선택</label>
          <button onClick={selectAll} className="text-xs text-primary hover:underline">전체 선택</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {activePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => togglePlayer(p.id)}
              className={`rounded-md border p-2 text-xs font-medium transition-colors ${
                selectedPlayers.includes(p.id)
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleCreate} disabled={saving} className="w-full gradient-pink text-primary-foreground font-bold">
        {saving ? "생성 중..." : "경기 생성"}
      </Button>
    </div>
  );
};

export default AdminMatchCreate;
