import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, Swords, Users } from "lucide-react";
import { MATCH_FORMATS } from "@/lib/positions";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { localISODate } from "@/lib/utils";
import { Chip } from "@/components/admin/AdminStep";

const AGE_CATEGORIES = [
  "20대 초반", "20대 중반", "20대 후반",
  "2030 혼합", "30대 초반", "30대 중반", "30대 후반",
  "3040 혼합", "30대초중반", "30대중~40대",
  "정보없음",
];

/** "futsal6" → "6:6 풋살", "s11" → "11:11 축구" (legacy match_type text kept in sync with the format). */
const matchTypeOf = (code: string) => {
  const f = MATCH_FORMATS.find(x => x.code === code);
  const n = Number(code.replace(/\D/g, ""));
  return `${n}:${n} ${f?.sport === "soccer" ? "축구" : "풋살"}`;
};

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground/90">
        <span className="text-primary">{icon}</span>
        {label}
      </h3>
      {children}
    </section>
  );
}

/** Step 1 of the match workflow: register a fixture. Results are recorded afterwards on the match screen. */
const AdminMatchCreate = ({ onCreated }: { onCreated?: (matchId: number) => void }) => {
  const navigate = useNavigate();
  const { venues, players } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(localISODate());
  const [venueId, setVenueId] = useState<string>("");
  const [venueQuery, setVenueQuery] = useState("");
  const [subVenue, setSubVenue] = useState("");
  const [format, setFormat] = useState("futsal6");
  const [isCustom, setIsCustom] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [teamAName, setTeamAName] = useState("버니즈 A");
  const [teamBName, setTeamBName] = useState("버니즈 B");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [playerTeams, setPlayerTeams] = useState<Record<number, "A" | "B">>({});
  const [youtubeLink, setYoutubeLink] = useState("");
  const [finished, setFinished] = useState(false);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);
  const [saving, setSaving] = useState(false);

  const activePlayers = players.filter(p => p.is_active);
  const venue = venues.find(v => String(v.id) === venueId);
  const venueMatches = useMemo(() => {
    const q = venueQuery.trim();
    const list = q ? venues.filter(v => v.name.includes(q)) : venues;
    return [...list].sort((a, b) => b.id - a.id).slice(0, q ? 12 : 8);
  }, [venues, venueQuery]);

  const togglePlayer = (id: number) => {
    setSelectedPlayers(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
    setPlayerTeams(pt => (pt[id] ? (({ [id]: _, ...rest }) => rest)(pt) : { ...pt, [id]: "A" }));
  };

  const addVenue = async () => {
    const name = venueQuery.trim();
    if (!name) return;
    try {
      const nextId = (venues.reduce((m, v) => Math.max(m, v.id), 0) || 0) + 1;
      const { data, error } = await supabase.from("venues").insert({ id: nextId, name }).select().single();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["venues"] });
      if (data?.id) setVenueId(String(data.id));
      setVenueQuery("");
      toast({ title: `구장 추가: ${name} 🏟️` });
    } catch (err: any) {
      toast({ title: "구장 추가 실패", description: err.message, variant: "destructive" });
    }
  };

  const canSubmit = !!date && (isCustom || opponentName.trim().length > 0);

  const handleCreate = async () => {
    if (!canSubmit) {
      toast({ title: isCustom ? "날짜를 입력하세요" : "날짜와 상대팀을 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert({
          date,
          venue_id: venueId ? Number(venueId) : null,
          sub_venue: subVenue || null,
          match_type: matchTypeOf(format),
          match_format: format,
          is_custom: isCustom,
          is_internal: isCustom,
          youtube_link: youtubeLink || null,
        })
        .select()
        .single();
      if (matchErr) throw matchErr;

      const teamInserts = isCustom
        ? [
            { match_id: match.id, name: teamAName, is_ours: true },
            { match_id: match.id, name: teamBName, is_ours: true },
          ]
        : [
            { match_id: match.id, name: "버니즈", is_ours: true },
            { match_id: match.id, name: opponentName.trim(), is_ours: false, original_age_desc: ageCategory || null, age_category: ageCategory || null },
          ];
      const { data: createdTeams, error: teamErr } = await supabase.from("teams").insert(teamInserts).select();
      if (teamErr) throw teamErr;

      if (selectedPlayers.length > 0) {
        const teamA = createdTeams.find((t: any) => t.name === teamAName);
        const teamB = createdTeams.find((t: any) => t.name === teamBName);
        const ours = createdTeams.find((t: any) => t.is_ours);
        const rosterInserts = selectedPlayers.map(pid => ({
          match_id: match.id,
          team_id: isCustom ? (playerTeams[pid] === "B" ? teamB?.id : teamA?.id) ?? createdTeams[0].id : ours!.id,
          player_id: pid,
        }));
        const { error: rErr } = await supabase.from("rosters").insert(rosterInserts);
        if (rErr) throw rErr;
      }

      // One result row per team (0:0 placeholder unless the final score is already known).
      const resultInserts = createdTeams.map((team: any) => {
        let sf = 0;
        let sa = 0;
        if (finished) {
          const first = isCustom ? team.name === teamAName : team.is_ours;
          sf = first ? scoreFor : scoreAgainst;
          sa = first ? scoreAgainst : scoreFor;
        }
        return { match_id: match.id, team_id: team.id, result: sf > sa ? "승" : sf < sa ? "패" : "무", score_for: sf, score_against: sa };
      });
      const { error: resErr } = await supabase.from("results").insert(resultInserts);
      if (resErr) throw resErr;

      ["matches", "teams", "results", "rosters"].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "경기가 등록되었습니다 ⚽", description: "이어서 기록을 입력할 수 있어요." });
      onCreated?.(match.id);
      navigate(`/admin/match/${match.id}`);
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const futsal = MATCH_FORMATS.filter(f => f.sport === "futsal");
  const soccer = MATCH_FORMATS.filter(f => f.sport === "soccer");

  return (
    <div className="space-y-3 pb-24">
      {/* type */}
      <div className="segmented flex w-full">
        {[
          { v: false, l: "⚔️ 친선 · 리그" },
          { v: true, l: "🎽 자체전" },
        ].map(o => (
          <button
            key={String(o.v)}
            onClick={() => setIsCustom(o.v)}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${isCustom === o.v ? "gradient-pink text-primary-foreground" : "text-muted-foreground"}`}
          >
            {o.l}
          </button>
        ))}
      </div>

      <Field icon={<CalendarDays size={15} />} label="날짜 · 종목">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11 bg-background/60 text-base" />
        <div className="mt-3 space-y-2">
          {[{ l: "풋살", list: futsal }, { l: "축구", list: soccer }].map(g => (
            <div key={g.l} className="flex flex-wrap items-center gap-1.5">
              <span className="w-8 text-[11px] font-bold text-muted-foreground">{g.l}</span>
              {g.list.map(f => (
                <Chip key={f.code} active={format === f.code} onClick={() => setFormat(f.code)}>
                  {f.code.replace(/\D/g, "")}:{f.code.replace(/\D/g, "")}
                </Chip>
              ))}
            </div>
          ))}
        </div>
      </Field>

      {isCustom ? (
        <Field icon={<Swords size={15} />} label="팀 이름">
          <div className="grid grid-cols-2 gap-2">
            <Input value={teamAName} onChange={e => setTeamAName(e.target.value)} className="h-10 bg-background/60" />
            <Input value={teamBName} onChange={e => setTeamBName(e.target.value)} className="h-10 bg-background/60" />
          </div>
        </Field>
      ) : (
        <Field icon={<Swords size={15} />} label="상대팀">
          <Input value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="상대팀 이름 (필수)" className="h-11 bg-background/60 text-base" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {AGE_CATEGORIES.map(a => (
              <Chip key={a} active={ageCategory === a} onClick={() => setAgeCategory(ageCategory === a ? "" : a)}>
                {a}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field icon={<MapPin size={15} />} label="구장">
        {venue ? (
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5">
            <span className="text-sm font-bold text-primary">{venue.name}</span>
            <button onClick={() => { setVenueId(""); setSubVenue(""); }} className="text-xs font-semibold text-muted-foreground">변경</button>
          </div>
        ) : (
          <>
            <Input value={venueQuery} onChange={e => setVenueQuery(e.target.value)} placeholder="구장 검색 또는 새 이름" className="h-10 bg-background/60" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {venueMatches.map(v => (
                <Chip key={v.id} onClick={() => { setVenueId(String(v.id)); setVenueQuery(""); }}>{v.name}</Chip>
              ))}
              {venueQuery.trim() && !venues.some(v => v.name === venueQuery.trim()) && (
                <Chip tone="neutral" active onClick={addVenue}><Plus size={12} className="mr-0.5 inline" />"{venueQuery.trim()}" 추가</Chip>
              )}
            </div>
          </>
        )}
        {venue?.name.includes("용산 더베이스") && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["1구장", "2구장", "3구장", "4구장", "5구장", "6구장", "7구장"].map(s => (
              <Chip key={s} active={subVenue === s} onClick={() => setSubVenue(subVenue === s ? "" : s)}>{s}</Chip>
            ))}
          </div>
        )}
      </Field>

      <Field icon={<Users size={15} />} label={`출전 명단 ${selectedPlayers.length ? `(${selectedPlayers.length}명)` : "(나중에 추가 가능)"}`}>
        <div className="mb-2 flex justify-end gap-3 text-xs font-semibold">
          <button onClick={() => { setSelectedPlayers(activePlayers.map(p => p.id)); setPlayerTeams(Object.fromEntries(activePlayers.map(p => [p.id, "A"]))); }} className="text-primary">전체 선택</button>
          <button onClick={() => { setSelectedPlayers([]); setPlayerTeams({}); }} className="text-muted-foreground">초기화</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activePlayers.map(p => (
            <Chip key={p.id} active={selectedPlayers.includes(p.id)} onClick={() => togglePlayer(p.id)}>{p.name}</Chip>
          ))}
        </div>
        {isCustom && selectedPlayers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-bold text-muted-foreground">팀 배정 (탭해서 전환)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {selectedPlayers.map(pid => {
                const team = playerTeams[pid] || "A";
                return (
                  <button
                    key={pid}
                    onClick={() => setPlayerTeams(pt => ({ ...pt, [pid]: team === "A" ? "B" : "A" }))}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-semibold ring-1 ${team === "A" ? "bg-sky-500/10 ring-sky-500/40" : "bg-orange-500/10 ring-orange-500/40"}`}
                  >
                    {activePlayers.find(p => p.id === pid)?.name}
                    <span className={`text-[11px] font-black ${team === "A" ? "text-sky-400" : "text-orange-400"}`}>{team}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Field>

      <details className="surface rounded-2xl p-4">
        <summary className="cursor-pointer text-[13px] font-bold text-foreground/90">이미 끝난 경기 · 영상 링크 (선택)</summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={finished} onChange={e => setFinished(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            최종 스코어 바로 입력 (득점자는 다음 화면에서)
          </label>
          {finished && (
            <div className="flex items-center gap-3">
              <Input type="number" min={0} value={scoreFor} onChange={e => setScoreFor(Number(e.target.value))} className="h-11 text-center text-lg font-bold" aria-label="우리 득점" />
              <span className="font-bold text-muted-foreground">:</span>
              <Input type="number" min={0} value={scoreAgainst} onChange={e => setScoreAgainst(Number(e.target.value))} className="h-11 text-center text-lg font-bold" aria-label="상대 득점" />
            </div>
          )}
          <Input value={youtubeLink} onChange={e => setYoutubeLink(e.target.value)} placeholder="유튜브 링크 https://youtube.com/..." className="h-10 bg-background/60" />
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 mx-auto max-w-lg px-4">
        <Button onClick={handleCreate} disabled={saving || !canSubmit} className="h-12 w-full rounded-2xl gradient-pink text-[15px] font-black text-primary-foreground shadow-xl">
          {saving ? "등록 중..." : canSubmit ? `${date} 경기 등록하고 기록 입력하기` : isCustom ? "날짜를 입력하세요" : "상대팀 이름을 입력하세요"}
        </Button>
      </div>
    </div>
  );
};

export default AdminMatchCreate;
