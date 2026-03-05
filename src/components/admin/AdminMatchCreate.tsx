import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const AGE_CATEGORIES = [
  "20대 초반", "20대 중반", "20대 후반",
  "2030 혼합", "30대 초반", "30대 중반", "30대 후반",
  "3040 혼합", "30대초중반", "30대중~40대",
  "정보없음",
];

const AdminMatchCreate = () => {
  const { venues, players } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [venueId, setVenueId] = useState("");
  const [matchType, setMatchType] = useState("6:6 풋살");
  const [isCustom, setIsCustom] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [teamAName, setTeamAName] = useState("버니즈 A");
  const [teamBName, setTeamBName] = useState("버니즈 B");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [playerTeams, setPlayerTeams] = useState<Record<number, "A" | "B">>({});
  const [saving, setSaving] = useState(false);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [overrideScore, setOverrideScore] = useState(false);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);

  const activePlayers = players.filter(p => p.is_active);

  const togglePlayer = (id: number) => {
    setSelectedPlayers(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(p => p !== id);
        const copy = { ...playerTeams };
        delete copy[id];
        setPlayerTeams(copy);
        return next;
      }
      setPlayerTeams(pt => ({ ...pt, [id]: "A" }));
      return [...prev, id];
    });
  };

  const selectAll = () => {
    const ids = activePlayers.map(p => p.id);
    setSelectedPlayers(ids);
    const pt: Record<number, "A" | "B"> = {};
    ids.forEach(id => { pt[id] = "A"; });
    setPlayerTeams(pt);
  };

  const handleCreate = async () => {
    if (!date) {
      toast({ title: "날짜를 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert({
          date,
          venue_id: venueId ? Number(venueId) : null,
          match_type: matchType,
          is_custom: isCustom,
          youtube_link: youtubeLink || null,
        })
        .select()
        .single();

      if (matchErr) throw matchErr;

      const teamInserts: any[] = [];
      if (isCustom) {
        teamInserts.push({ match_id: match.id, name: teamAName, is_ours: true });
        teamInserts.push({ match_id: match.id, name: teamBName, is_ours: true });
      } else {
        teamInserts.push({ match_id: match.id, name: "버니즈", is_ours: true });
        if (opponentName) {
          teamInserts.push({
            match_id: match.id,
            name: opponentName,
            is_ours: false,
            original_age_desc: ageCategory || null,
            age_category: ageCategory || null,
          });
        }
      }

      const { data: createdTeams, error: teamErr } = await supabase
        .from("teams")
        .insert(teamInserts)
        .select();

      if (teamErr) throw teamErr;

      // Create roster entries
      if (selectedPlayers.length > 0) {
        if (isCustom) {
          const teamA = createdTeams.find((t: any) => t.name === teamAName);
          const teamB = createdTeams.find((t: any) => t.name === teamBName);
          const rosterInserts = selectedPlayers.map(pid => ({
            match_id: match.id,
            team_id: (playerTeams[pid] === "B" ? teamB?.id : teamA?.id) || createdTeams[0].id,
            player_id: pid,
          }));
          await supabase.from("rosters").insert(rosterInserts);
        } else {
          const ourTeam = createdTeams.find((t: any) => t.name === "버니즈");
          if (ourTeam) {
            const rosterInserts = selectedPlayers.map(pid => ({
              match_id: match.id,
              team_id: ourTeam.id,
              player_id: pid,
            }));
            await supabase.from("rosters").insert(rosterInserts);
          }
        }
      }

      // Create results
      for (const team of createdTeams) {
        const isOurs = team.is_ours;
        if (overrideScore) {
          const sf = isOurs ? scoreFor : scoreAgainst;
          const sa = isOurs ? scoreAgainst : scoreFor;
          const result = sf > sa ? "승" : sf < sa ? "패" : "무";
          await supabase.from("results").insert({
            match_id: match.id,
            team_id: team.id,
            result,
            score_for: sf,
            score_against: sa,
          });
        } else {
          await supabase.from("results").insert({
            match_id: match.id,
            team_id: team.id,
            result: "무",
            score_for: 0,
            score_against: 0,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["rosters"] });

      toast({ title: "경기가 생성되었습니다! ⚽" });
      setDate("");
      setVenueId("");
      setOpponentName("");
      setSelectedPlayers([]);
      setPlayerTeams({});
      setIsCustom(false);
      setAgeCategory("");
      setYoutubeLink("");
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
            <SelectItem value="8:8 축구">8:8 축구</SelectItem>
            <SelectItem value="11:11 축구">11:11 축구</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">유튜브 링크</label>
        <Input value={youtubeLink} onChange={e => setYoutubeLink(e.target.value)} placeholder="https://youtube.com/..." className="bg-card border-border" />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={isCustom}
          onCheckedChange={(c) => setIsCustom(c === true)}
          className="border-primary"
        />
        <label className="text-sm text-foreground">자체전</label>
      </div>

      {isCustom ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">팀 A 이름</label>
            <Input value={teamAName} onChange={e => setTeamAName(e.target.value)} className="bg-card border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">팀 B 이름</label>
            <Input value={teamBName} onChange={e => setTeamBName(e.target.value)} className="bg-card border-border" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">상대팀 이름</label>
            <Input value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="상대팀" className="bg-card border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">상대팀 연령대</label>
            <Select value={ageCategory} onValueChange={setAgeCategory}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="연령대 선택" /></SelectTrigger>
              <SelectContent>
                {AGE_CATEGORIES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

      {/* Custom match: team assignment */}
      {isCustom && selectedPlayers.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">팀 배정</label>
          <div className="space-y-1.5">
            {selectedPlayers.map(pid => {
              const player = activePlayers.find(p => p.id === pid);
              return (
                <div key={pid} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{player?.name}</span>
                  <Select value={playerTeams[pid] || "A"} onValueChange={v => setPlayerTeams(pt => ({ ...pt, [pid]: v as "A" | "B" }))}>
                    <SelectTrigger className="h-7 w-24 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">{teamAName}</SelectItem>
                      <SelectItem value="B">{teamBName}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button onClick={handleCreate} disabled={saving} className="w-full gradient-pink text-primary-foreground font-bold">
        {saving ? "생성 중..." : "경기 생성"}
      </Button>
    </div>
  );
};

export default AdminMatchCreate;
