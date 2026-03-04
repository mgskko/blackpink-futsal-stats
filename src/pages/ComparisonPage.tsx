import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, Swords } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from "recharts";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import { getMOMRanking } from "@/hooks/useAdvancedStats";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ComparisonPage = () => {
  const navigate = useNavigate();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  if (isLoading) return <SplashScreen />;

  const activePlayers = players.filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name));
  const p1 = player1 ? players.find(p => p.id === Number(player1)) : null;
  const p2 = player2 ? players.find(p => p.id === Number(player2)) : null;

  const getStatsNormalized = (pid: number) => {
    const s = getPlayerStats(players, matches, teams, results, rosters, goalEvents, pid);
    const momRank = getMOMRanking(players, momVotes || []);
    const mom = momRank.find(m => m.playerId === pid)?.count || 0;
    const goalsPerGame = s.appearances > 0 ? s.goals / s.appearances : 0;
    const assistsPerGame = s.appearances > 0 ? s.assists / s.appearances : 0;
    const attendanceRate = (() => {
      const totalMatches = matches.filter(m => !m.is_custom).length;
      return totalMatches > 0 ? Math.round((s.appearances / totalMatches) * 100) : 0;
    })();
    return { goalsPerGame, assistsPerGame, attendanceRate, winRate: s.winRate, mom, appearances: s.appearances, goals: s.goals, assists: s.assists, attackPoints: s.attackPoints };
  };

  const s1 = p1 ? getStatsNormalized(p1.id) : null;
  const s2 = p2 ? getStatsNormalized(p2.id) : null;

  // Normalize for radar (0-100 scale)
  const maxVals = {
    goalsPerGame: Math.max(s1?.goalsPerGame || 1, s2?.goalsPerGame || 1, 1),
    assistsPerGame: Math.max(s1?.assistsPerGame || 1, s2?.assistsPerGame || 1, 1),
    attendanceRate: 100,
    winRate: 100,
    mom: Math.max(s1?.mom || 1, s2?.mom || 1, 1),
  };

  const radarData = s1 && s2 ? [
    { stat: "득점력", p1: Math.round((s1.goalsPerGame / maxVals.goalsPerGame) * 100), p2: Math.round((s2.goalsPerGame / maxVals.goalsPerGame) * 100), fullMark: 100 },
    { stat: "이타성", p1: Math.round((s1.assistsPerGame / maxVals.assistsPerGame) * 100), p2: Math.round((s2.assistsPerGame / maxVals.assistsPerGame) * 100), fullMark: 100 },
    { stat: "출석률", p1: s1.attendanceRate, p2: s2.attendanceRate, fullMark: 100 },
    { stat: "승률", p1: s1.winRate, p2: s2.winRate, fullMark: 100 },
    { stat: "MOM", p1: Math.round((s1.mom / maxVals.mom) * 100), p2: Math.round((s2.mom / maxVals.mom) * 100), fullMark: 100 },
  ] : [];

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft size={24} /></button>
          <h1 className="font-display text-xl tracking-wider text-primary text-glow">1:1 RIVAL COMPARE</h1>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Player Selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">선수 1</label>
            <Select value={player1} onValueChange={setPlayer1}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {activePlayers.filter(p => String(p.id) !== player2).map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">선수 2</label>
            <Select value={player2} onValueChange={setPlayer2}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {activePlayers.filter(p => String(p.id) !== player1).map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* VS Header */}
        {p1 && p2 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center gap-6 py-4">
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-secondary">
                <User size={32} className="text-primary" />
              </div>
              <span className="mt-2 font-bold text-foreground">{p1.name}</span>
            </div>
            <div className="flex flex-col items-center">
              <Swords size={28} className="text-primary text-glow" />
              <span className="font-display text-sm text-primary mt-1">VS</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/50 bg-secondary">
                <User size={32} className="text-accent" />
              </div>
              <span className="mt-2 font-bold text-foreground">{p2.name}</span>
            </div>
          </motion.div>
        )}

        {/* Radar Chart */}
        {s1 && s2 && radarData.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(0 0% 20%)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={p1!.name} dataKey="p1" stroke="hsl(330 100% 71%)" fill="hsl(330 100% 71%)" fillOpacity={0.3} strokeWidth={2} />
                <Radar name={p2!.name} dataKey="p2" stroke="hsl(200 80% 60%)" fill="hsl(200 80% 60%)" fillOpacity={0.3} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(0 0% 60%)" }} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Stat Comparison Table */}
        {s1 && s2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
            {[
              { label: "출전", v1: s1.appearances, v2: s2.appearances },
              { label: "골", v1: s1.goals, v2: s2.goals },
              { label: "어시스트", v1: s1.assists, v2: s2.assists },
              { label: "공격포인트", v1: s1.attackPoints, v2: s2.attackPoints },
              { label: "경기당 골", v1: s1.goalsPerGame.toFixed(2), v2: s2.goalsPerGame.toFixed(2) },
              { label: "승률", v1: `${s1.winRate}%`, v2: `${s2.winRate}%` },
              { label: "출석률", v1: `${s1.attendanceRate}%`, v2: `${s2.attendanceRate}%` },
              { label: "MOM", v1: s1.mom, v2: s2.mom },
            ].map(({ label, v1, v2 }, i) => {
              const n1 = typeof v1 === "string" ? parseFloat(v1) : v1;
              const n2 = typeof v2 === "string" ? parseFloat(v2) : v2;
              return (
                <div key={label} className={`flex items-center px-4 py-3 ${i < 7 ? "border-b border-border" : ""}`}>
                  <span className={`flex-1 text-right text-sm font-bold ${n1 > n2 ? "text-primary" : "text-foreground"}`}>{v1}</span>
                  <span className="mx-4 text-xs text-muted-foreground w-20 text-center">{label}</span>
                  <span className={`flex-1 text-sm font-bold ${n2 > n1 ? "text-accent" : "text-foreground"}`}>{v2}</span>
                </div>
              );
            })}
          </motion.div>
        )}

        {!p1 && !p2 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Swords size={48} className="mb-4 opacity-30" />
            <p className="text-sm">두 선수를 선택하면 능력치를 비교할 수 있습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonPage;
