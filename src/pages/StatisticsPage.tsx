import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, CartesianGrid, ComposedChart } from "recharts";
import { useAllFutsalData, getPlayerName, getDeadlyDuos, getQuarterGoalDistribution, computeNonDuplicatedAP, computeMatchAP } from "@/hooks/useFutsalData";
import type { Player, Match, Result, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getOpponentRecords, getVenueRecords, getAgeCategoryRecords, getWinFairyData, getLastQuarterSpecialists, getDuoSynergyWinRate, getOwnGoalRanking, getHallOfFame, getMOMRanking } from "@/hooks/useAdvancedStats";
import { computeAllCourtMargins, getDefenseContribution } from "@/hooks/useCourtStats";
import { computeDataMOM } from "@/hooks/useMatchAnalysis";
import { computeDeathLineup, computePassNetwork, computeToxicDuos, computeBestDefenseLine, computeSynergyMargin, computeWithoutYou, computeFWDuos, computePositionDuosByWinRate, computeTriosByWinRate } from "@/hooks/useChemistryStats";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import { Skull, Trophy, Flame, Ghost, Target, Clock, Users, MapPin, Shield, Swords, Star, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import TotoStatsTab from "@/components/stats/TotoStatsTab";
import FormationStatsTab from "@/components/stats/FormationStatsTab";
import FunStatsTab from "@/components/stats/FunStatsTab";
import GarbageTimeTab from "@/components/stats/GarbageTimeTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterType = "all" | "custom" | string;

function getAvailableYears(matches: Match[]): string[] {
  const years = new Set(matches.map(m => m.date.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

function getFilteredPlayerStats(playerId: number, matches: Match[], results: Result[], rosters: Roster[], goalEvents: GoalEvent[], filter: FilterType) {
  const today = new Date().toISOString().slice(0, 10);
  let filteredMatches = matches.filter(m => m.date <= today); // exclude scheduled
  if (filter === "custom") filteredMatches = filteredMatches.filter(m => m.is_custom);
  else if (filter !== "all") filteredMatches = filteredMatches.filter(m => m.date.startsWith(filter));

  const filteredMatchIds = new Set(filteredMatches.map(m => m.id));
  const { goals, assists } = computeNonDuplicatedAP(playerId, filteredMatches, rosters.filter(r => filteredMatchIds.has(r.match_id)), goalEvents.filter(g => filteredMatchIds.has(g.match_id)));

  const playerRosters = rosters.filter(r => r.player_id === playerId && filteredMatchIds.has(r.match_id));
  const matchIds = [...new Set(playerRosters.map(r => r.match_id))];
  const appearances = matchIds.length;
  let wins = 0, losses = 0, draws = 0;
  matchIds.forEach(matchId => {
    const teamIds = [...new Set(playerRosters.filter(r => r.match_id === matchId).map(r => r.team_id))];
    teamIds.forEach(teamId => {
      const result = results.find(r => r.team_id === teamId && r.match_id === matchId);
      if (result) {
        if (result.result === "승") wins++;
        else if (result.result === "패") losses++;
        else if (result.result === "무") draws++;
      }
    });
  });
  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  return { goals, assists, attackPoints: goals + assists, appearances, wins, losses, draws, winRate };
}

type RankingOption = "ap" | "goals" | "assists" | "ppq" | "courtMargin" | "defense" | "dataMom" | "deadlyDuos" | "appearances" | "mom" | "fun" | "worst";

const StatisticsPage = () => {
  const navigate = useNavigate();
  const { players, matches, venues, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [activeTab, setActiveTab] = useState<"player" | "team" | "fun" | "chemistry" | "formation" | "toto">("player");
  const [selectedRanking, setSelectedRanking] = useState<RankingOption>("ap");

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const { data: worstVotesAll } = useQuery({
    queryKey: ["worst_votes_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("worst_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const { data: allQuartersRaw } = useQuery({
    queryKey: ["all_match_quarters"],
    queryFn: async () => {
      let allData: MatchQuarter[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase as any).from("match_quarters").select("*").range(from, from + 999);
        if (!data || data.length === 0) break;
        allData = allData.concat(data as MatchQuarter[]);
        if (data.length < 1000) break;
        from += 1000;
      }
      return allData;
    },
  });
  const allQuarters = allQuartersRaw ?? [];

  const years = getAvailableYears(matches);
  const isCustomFilter = selectedFilter === "custom";

  const filteredMatches = useMemo(() => {
    if (selectedFilter === "custom") return matches.filter(m => m.is_custom);
    if (selectedFilter !== "all") return matches.filter(m => m.date.startsWith(selectedFilter));
    return matches;
  }, [matches, selectedFilter]);

  const filteredMatchIds = useMemo(() => new Set(filteredMatches.map(m => m.id)), [filteredMatches]);
  const filteredGoalEvents = useMemo(() => goalEvents.filter(g => filteredMatchIds.has(g.match_id)), [goalEvents, filteredMatchIds]);
  const filteredRosters = useMemo(() => rosters.filter(r => filteredMatchIds.has(r.match_id)), [rosters, filteredMatchIds]);
  const filteredTeams = useMemo(() => teams.filter(t => filteredMatchIds.has(t.match_id)), [teams, filteredMatchIds]);
  const filteredResults = useMemo(() => results.filter(r => filteredMatchIds.has(r.match_id)), [results, filteredMatchIds]);
  const filteredQuarters = useMemo(() => allQuarters.filter(q => filteredMatchIds.has(q.match_id)), [allQuarters, filteredMatchIds]);

  const dataMomRanking = useMemo(() => {
    const momCounts = new Map<number, number>();
    const matchIdsWithQuarters = [...new Set(filteredQuarters.map(q => q.match_id))];
    matchIdsWithQuarters.forEach(mid => {
      const mom = computeDataMOM(mid, players, teams, goalEvents, allQuarters, results);
      if (mom) momCounts.set(mom.playerId, (momCounts.get(mom.playerId) || 0) + 1);
    });
    return [...momCounts.entries()].map(([pid, count]) => ({
      id: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, count
    })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredQuarters, players, teams, goalEvents, allQuarters, results]);

  if (isLoading) return <SplashScreen />;

  const allStats = players.map(p => ({ ...p, ...getFilteredPlayerStats(p.id, matches, results, rosters, goalEvents, selectedFilter) }));

  const topGoals = [...allStats].sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10);
  const topAssists = [...allStats].sort((a, b) => b.assists - a.assists).filter(p => p.assists > 0).slice(0, 10);
  const topAttackPoints = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 5);
  const topAP10 = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 10);
  const topAppearances = [...allStats].sort((a, b) => b.appearances - a.appearances).filter(p => p.appearances > 0).slice(0, 10);

  const apChartData = topAttackPoints.map(p => ({ name: p.name, 공격포인트: p.attackPoints, 골: p.goals, 도움: p.assists }));
  const quarterData = getQuarterGoalDistribution(filteredGoalEvents, filteredQuarters);
  const duos = getDeadlyDuos(filteredGoalEvents, 10);

  // Court margins
  const courtMargins = computeAllCourtMargins(players, filteredMatches, filteredQuarters, filteredGoalEvents);
  const topCourtMargin = [...courtMargins].filter(p => p.quartersPlayed >= 10).sort((a, b) => b.margin - a.margin).slice(0, 10);
  const topPPQ = [...courtMargins].filter(p => p.quartersPlayed >= 10).sort((a, b) => b.ppq - a.ppq).slice(0, 10);

  // Defense contribution ranking
  const defenseRanking = players.map(p => {
    const dc = getDefenseContribution(p.id, filteredQuarters);
    return { ...p, diff: dc.diff, quartersWithPlayer: dc.quartersWithPlayer };
  }).filter(p => p.quartersWithPlayer >= 10).sort((a, b) => a.diff - b.diff).slice(0, 10);

  const opponentRecords = getOpponentRecords(filteredMatches, filteredTeams, filteredResults);
  const venueRecords = getVenueRecords(filteredMatches, filteredTeams, filteredResults, venues);
  const ageRecords = getAgeCategoryRecords(filteredMatches, filteredTeams, filteredResults);
  const winFairy = getWinFairyData(players, filteredMatches, filteredTeams, filteredResults, filteredRosters);
  const lastQSpecialists = getLastQuarterSpecialists(players, filteredMatches, filteredGoalEvents);
  const duoSynergy = getDuoSynergyWinRate(players, filteredMatches, filteredTeams, filteredResults, filteredRosters);
  const ownGoals = getOwnGoalRanking(players, filteredGoalEvents);
  const hallOfFame = getHallOfFame(players, filteredMatches, filteredRosters, filteredGoalEvents);
  const momRanking = getMOMRanking(players, momVotes || []);

  const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)" };

  const GenericRanking = ({ data, valueLabel, valueFn }: { data: { id: number; name: string }[]; valueLabel: string; valueFn: (d: any) => string | number }) => (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {data.map((p, i) => (
        <div key={p.id} onClick={() => navigate(`/player/${p.id}`)}
          className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < data.length - 1 ? "border-b border-border" : ""}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
            <span className="text-sm font-medium text-foreground">{p.name}</span>
          </div>
          <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{valueFn(p)}</span>
        </div>
      ))}
    </div>
  );

  const RecordTable = ({ title, icon, data }: { title: string; icon: React.ReactNode; data: { name: string; wins: number; draws: number; losses: number; matches: number; winRate: number }[] }) => (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">{icon} {title}</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-muted-foreground"><th className="px-3 py-2 text-left font-medium">이름</th><th className="px-2 py-2 text-center font-medium">경기</th><th className="px-2 py-2 text-center font-medium">승</th><th className="px-2 py-2 text-center font-medium">무</th><th className="px-2 py-2 text-center font-medium">패</th><th className="px-2 py-2 text-center font-medium">승률</th></tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.name} className={`${i < data.length - 1 ? "border-b border-border" : ""} hover:bg-secondary/50 transition-colors`}>
                <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r.name}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.matches}</td>
                <td className="px-2 py-2 text-center text-primary">{r.wins}</td>
                <td className="px-2 py-2 text-center text-foreground">{r.draws}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.losses}</td>
                <td className="px-2 py-2 text-center"><span className={`font-bold ${r.winRate >= 50 ? "text-primary" : "text-muted-foreground"}`}>{r.winRate}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSelectedRanking = () => {
    switch (selectedRanking) {
      case "ap":
        return <GenericRanking data={topAP10} valueLabel="AP" valueFn={(p: any) => p.attackPoints} />;
      case "goals":
        return <GenericRanking data={topGoals} valueLabel="골" valueFn={(p: any) => p.goals} />;
      case "assists":
        return <GenericRanking data={topAssists} valueLabel="도움" valueFn={(p: any) => p.assists} />;
      case "ppq":
        return <GenericRanking data={topPPQ.map(p => ({ id: p.playerId, name: p.name, ppq: p.ppq }))} valueLabel="PPQ" valueFn={(p: any) => p.ppq.toFixed(2)} />;
      case "courtMargin":
        return <GenericRanking data={topCourtMargin.map(p => ({ id: p.playerId, name: p.name, margin: p.margin }))} valueLabel="+/-" valueFn={(p: any) => (p.margin > 0 ? "+" : "") + p.margin} />;
      case "defense":
        return <GenericRanking data={defenseRanking.map(p => ({ id: p.id, name: p.name, diff: p.diff }))} valueLabel="실점차" valueFn={(p: any) => p.diff.toFixed(2)} />;
      case "dataMom":
        return <GenericRanking data={dataMomRanking.map(d => ({ id: d.id, name: d.name, count: d.count }))} valueLabel="횟수" valueFn={(d: any) => `${d.count}회`} />;
      case "appearances":
        return <GenericRanking data={topAppearances} valueLabel="출전" valueFn={(p: any) => p.appearances} />;
      case "mom":
        return momRanking.length > 0
          ? <GenericRanking data={momRanking.slice(0, 10).map(d => ({ id: d.playerId, name: d.name, count: d.count }))} valueLabel="MOM" valueFn={(d: any) => `${d.count}회`} />
          : <p className="text-center text-sm text-muted-foreground py-4">MOM 투표 데이터가 없습니다</p>;
      case "worst": {
        const worstCounts = new Map<number, number>();
        (worstVotesAll || []).forEach((v: any) => worstCounts.set(v.voted_player_id, (worstCounts.get(v.voted_player_id) || 0) + 1));
        const worstRanking = [...worstCounts.entries()].map(([pid, count]) => ({ id: pid, name: players.find(p => p.id === pid)?.name || `#${pid}`, count })).sort((a, b) => b.count - a.count).slice(0, 10);
        return worstRanking.length > 0
          ? <GenericRanking data={worstRanking} valueLabel="워스트" valueFn={(d: any) => `${d.count}표`} />
          : <p className="text-center text-sm text-muted-foreground py-4">워스트 투표 데이터가 없습니다</p>;
      }
      default:
        return null;
    }
  };

  return (
    <div className="pb-20">
      <PageHeader title="STATISTICS" subtitle="버니즈 통계" />

      {/* Filter */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setSelectedFilter("all")} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === "all" ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>전체</button>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedFilter(y)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === y ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>{y}</button>
          ))}
          <button onClick={() => setSelectedFilter("custom")} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === "custom" ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>⚔️ 자체전</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-6">
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          {([
            ["player", "👤 개인"] as const,
            ...(!isCustomFilter ? [["team", "⚔️ 팀"] as const] : []),
            ["chemistry", "🤝 케미"] as const,
            ["formation", "📋 포메이션"] as const,
            ["fun", "📊 기록"] as const,
            ["toto", "🎯 토토"] as const,
          ]).map(([key, label]) => (
            <button key={key + label} onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-2.5 text-[10px] font-bold transition-all ${activeTab === key ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Compare button */}
      <div className="px-4 mb-4">
        <button onClick={() => navigate("/compare")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20">
          <Swords size={16} /> 1:1 라이벌 비교
        </button>
      </div>

      <div className="px-4">
        {activeTab === "player" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* AP Chart */}
            <div className="mb-6">
              <h3 className="mb-3 font-display text-xl tracking-wider text-primary">TOP 5 공격포인트</h3>
              <div className="rounded-lg border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={apChartData} layout="vertical">
                    <XAxis type="number" stroke="hsl(0 0% 40%)" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="hsl(0 0% 40%)" fontSize={12} width={50} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="공격포인트" fill="url(#pinkGradient)" radius={[0, 4, 4, 0]} />
                    <defs><linearGradient id="pinkGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="hsl(330 80% 45%)" /><stop offset="100%" stopColor="hsl(330 100% 71%)" /></linearGradient></defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quarter trend */}
            <div className="mb-6">
              <h3 className="mb-3 font-display text-xl tracking-wider text-primary">쿼터별 득점/실점 추이</h3>
              <div className="rounded-lg border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={quarterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                    <XAxis dataKey="quarter" stroke="hsl(0 0% 40%)" fontSize={11} tickFormatter={v => `${v}Q`} />
                    <YAxis stroke="hsl(0 0% 40%)" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="goals" fill="hsl(330 100% 71%)" name="득점" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="conceded" stroke="hsl(0 80% 60%)" strokeWidth={2.5} name="실점" dot={{ fill: "hsl(0 80% 60%)", r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Deadly Duos */}
            <div className="mb-6">
              <h3 className="mb-3 font-display text-xl tracking-wider text-primary">💀 DEADLY DUOS</h3>
              <div className="space-y-2">
                {duos.map((duo, i) => (
                  <div key={`${duo.p1}-${duo.p2}`} className={`flex items-center justify-between rounded-lg border bg-card p-4 ${i === 0 ? "border-primary/50 box-glow" : "border-border"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>#{i + 1}</span>
                      <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${duo.p1}`)}>{getPlayerName(players, duo.p1)}</span>
                      <span className="text-primary">×</span>
                      <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${duo.p2}`)}>{getPlayerName(players, duo.p2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`font-display text-2xl ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{duo.count}</span>
                      <span className="text-xs text-muted-foreground">합작</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking Select Dropdown */}
            <div className="mb-4">
              <Select value={selectedRanking} onValueChange={(v) => setSelectedRanking(v as RankingOption)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="랭킹 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ap">📊 누적 공격포인트</SelectItem>
                  <SelectItem value="goals">⚽ 골 순위</SelectItem>
                  <SelectItem value="assists">🅰️ 어시스트 순위</SelectItem>
                  <SelectItem value="ppq">⚡ PPQ (공포 효율)</SelectItem>
                  <SelectItem value="courtMargin">📈 코트 마진 (+/-)</SelectItem>
                  <SelectItem value="defense">🛡️ 수비 기여도</SelectItem>
                  <SelectItem value="dataMom">👑 Data MOM 획득</SelectItem>
                  <SelectItem value="appearances">🏟️ 출전 횟수</SelectItem>
                  <SelectItem value="mom">⭐ MOM 투표 랭킹</SelectItem>
                  <SelectItem value="worst">👎 워스트 누적 랭킹</SelectItem>
                  <SelectItem value="fun">🎭 이색/예능 기록</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mb-6">
              {renderSelectedRanking()}
            </div>
          </motion.div>
        )}

        {activeTab === "team" && !isCustomFilter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RecordTable title="상대팀별 전적" icon={<Shield size={18} />} data={opponentRecords} />
            <RecordTable title="구장별 전적" icon={<MapPin size={18} />} data={venueRecords} />
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Target size={18} /> 연령대별 승률</h3>
              <div className="space-y-2">
                {ageRecords.map(r => (
                  <div key={r.category} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{r.category}</span>
                      <span className={`font-display text-lg ${r.winRate >= 50 ? "text-primary text-glow" : "text-muted-foreground"}`}>{r.winRate}%</span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground"><span>{r.matches}경기</span><span className="text-primary">{r.wins}승</span><span>{r.draws}무</span><span>{r.losses}패</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full gradient-pink rounded-full transition-all" style={{ width: `${r.winRate}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "chemistry" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Death Lineup */}
            {(() => {
              const deathLineup = computeDeathLineup(players, filteredQuarters);
              if (!deathLineup) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">💀 THE DEATH LINEUP</h3>
                  <p className="mb-2 text-xs text-muted-foreground">같은 쿼터에 필드에 선 최강의 5인 조합 (최소 5쿼터)</p>
                  <div className="rounded-xl border border-primary/30 bg-card p-4 box-glow">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {deathLineup.names.map((name, i) => (
                        <span key={i} className="rounded-full gradient-pink px-3 py-1 text-xs font-bold text-primary-foreground cursor-pointer" onClick={() => { const p = players.find(pp => pp.name === name); if (p) navigate(`/player/${p.id}`); }}>{name}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-secondary/50 p-2"><div className="font-display text-xl text-primary text-glow">{deathLineup.margin > 0 ? "+" : ""}{deathLineup.margin}</div><div className="text-[9px] text-muted-foreground">총 마진</div></div>
                      <div className="rounded-lg bg-secondary/50 p-2"><div className="font-display text-xl text-foreground">{deathLineup.quarters}</div><div className="text-[9px] text-muted-foreground">쿼터</div></div>
                      <div className="rounded-lg bg-secondary/50 p-2"><div className="font-display text-xl text-primary">{deathLineup.avgMargin > 0 ? "+" : ""}{deathLineup.avgMargin.toFixed(1)}</div><div className="text-[9px] text-muted-foreground">쿼터당 마진</div></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Pass Network */}
            {(() => {
              const passNet = computePassNetwork(players, filteredGoalEvents, rosters, 10);
              if (passNet.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🤝 환상의 짝꿍 TOP 10</h3>
                  <p className="mb-2 text-xs text-muted-foreground">A의 패스를 받아 B가 골을 넣은 횟수 (10경기 이상 함께 출전)</p>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {passNet.map((d, i) => (
                      <div key={`${d.assisterId}-${d.scorerId}`} className={`flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < passNet.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                          <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.assisterId}`)}>{d.assisterName}</span>
                          <span className="text-primary">→</span>
                          <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.scorerId}`)}>{d.scorerName}</span>
                        </div>
                        <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Toxic Duo */}
            {(() => {
              const toxicDuos = computeToxicDuos(players, filteredQuarters, rosters, 5);
              if (toxicDuos.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-destructive">☠️ TOXIC DUO</h3>
                  <p className="mb-2 text-xs text-muted-foreground">같은 필드에 설 때 팀 실점률이 가장 높은 조합 (최소 5쿼터)</p>
                  <div className="space-y-2">
                    {toxicDuos.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className={`rounded-lg border p-3 ${i === 0 ? "border-destructive/50" : "border-border"} bg-card`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💀</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span>
                            <span className="text-destructive">×</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span>
                          </div>
                          <span className="font-display text-lg text-destructive">{d.concededPerQ.toFixed(1)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.quarters}쿼터 동안 {d.totalConceded}실점</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Best Defensive Line */}
            {(() => {
              const defLines = computeBestDefenseLine(players, filteredQuarters, rosters, 5);
              if (defLines.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🛡️ BEST DEFENSIVE LINE</h3>
                  <p className="mb-2 text-xs text-muted-foreground">DF 포지션 최소 실점 조합 (최소 5쿼터)</p>
                  <div className="space-y-2">
                    {defLines.map((d, i) => (
                      <div key={d.names.join("-")} className={`rounded-lg border p-3 ${i === 0 ? "border-primary/50 box-glow" : "border-border"} bg-card`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🛡️</span>
                            {d.names.map((n, ni) => (
                              <span key={ni}>
                                <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => { const p = players.find(pp => pp.name === n); if (p) navigate(`/player/${p.id}`); }}>{n}</span>
                                {ni < d.names.length - 1 && <span className="text-primary mx-1">&</span>}
                              </span>
                            ))}
                          </div>
                          <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.concededPerQ.toFixed(2)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.quarters}쿼터 | 쿼터당 실점</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Synergy Margin */}
            {(() => {
              const synergy = computeSynergyMargin(players, filteredQuarters, rosters, 5);
              if (synergy.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">⚡ SYNERGY MARGIN</h3>
                  <p className="mb-2 text-xs text-muted-foreground">같이 뛸 때 vs 따로 뛸 때 마진 차이</p>
                  <div className="space-y-2">
                    {synergy.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className={`rounded-lg border p-3 ${i === 0 ? "border-primary/50 box-glow" : "border-border"} bg-card`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span>
                            <span className="text-primary">×</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span>
                          </div>
                          <span className={`font-display text-lg ${d.synergy > 0 ? "text-primary text-glow" : "text-destructive"}`}>{d.synergy > 0 ? "+" : ""}{d.synergy.toFixed(2)}</span>
                        </div>
                        <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                          <span>같이: <span className="text-primary">{d.togetherMarginPerQ > 0 ? "+" : ""}{d.togetherMarginPerQ.toFixed(2)}/Q</span> ({d.togetherQ}Q)</span>
                          <span>따로: {d.apartMarginPerQ > 0 ? "+" : ""}{d.apartMarginPerQ.toFixed(2)}/Q</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Without You */}
            {(() => {
              const withoutYou = computeWithoutYou(players, filteredQuarters, 7);
              if (withoutYou.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🫥 WITHOUT YOU</h3>
                  <p className="mb-2 text-xs text-muted-foreground">선수가 벤치에 앉을 때 팀 마진 변화</p>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {withoutYou.map((d, i) => (
                      <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)} className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < withoutYou.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                          <div>
                            <span className="text-sm font-medium text-foreground">{d.name}</span>
                            <div className="text-[10px] text-muted-foreground">출전 {d.onFieldQ}Q | 벤치 {d.benchQ}Q</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-display text-lg ${d.impact > 0 ? "text-primary" : "text-muted-foreground"}`}>{d.impact > 0 ? "+" : ""}{d.impact.toFixed(2)}</span>
                          <div className="text-[9px] text-muted-foreground">임팩트</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Position Duos by Win Rate */}
            {(() => {
              const bestFW = computePositionDuosByWinRate(players, filteredQuarters, "FW", 5, false, filteredGoalEvents);
              const worstFW = computePositionDuosByWinRate(players, filteredQuarters, "FW", 5, true, filteredGoalEvents);
              const bestDF = computePositionDuosByWinRate(players, filteredQuarters, "DF", 5, false, filteredGoalEvents);
              const worstDF = computePositionDuosByWinRate(players, filteredQuarters, "DF", 5, true, filteredGoalEvents);
              const DuoSection = ({ title, emoji, data, isWorst, isFW }: { title: string; emoji: string; data: typeof bestFW; isWorst?: boolean; isFW?: boolean }) => data.length === 0 ? null : (
                <div className="mb-6">
                  <h3 className={`mb-3 flex items-center gap-2 font-display text-xl tracking-wider ${isWorst ? "text-destructive" : "text-primary"}`}>{emoji} {title}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">승률 기준 (최소 10쿼터)</p>
                  <div className="space-y-2">
                    {data.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className={`rounded-lg border p-3 ${!isWorst && i === 0 ? "border-primary/50 box-glow" : isWorst && i === 0 ? "border-destructive/50" : "border-border"} bg-card`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span>
                            <span className={isWorst ? "text-destructive" : "text-primary"}>×</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span>
                          </div>
                          <span className={`font-display text-lg ${isWorst ? "text-destructive" : "text-primary text-glow"}`}>{d.winRate}%</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{d.quarters}쿼터</span>
                          <span>마진 {d.marginPerQ > 0 ? "+" : ""}{d.marginPerQ.toFixed(1)}/Q</span>
                          {isFW && !isWorst && <span className="text-primary font-bold">⚽ 합작 {d.combinedGoals}골</span>}
                          {!isFW && !isWorst && <span className="text-primary font-bold">🛡️ 합작 무실점 {d.cleanSheetQuarters}Q</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (<>
                <DuoSection title="BEST FW DUO" emoji="⚔️" data={bestFW} isFW />
                <DuoSection title="WORST FW DUO" emoji="💀" data={worstFW} isWorst isFW />
                <DuoSection title="BEST DF DUO" emoji="🛡️" data={bestDF} />
                <DuoSection title="WORST DF DUO" emoji="☠️" data={worstDF} isWorst />
              </>);
            })()}

            {/* Trios */}
            {(() => {
              const bestTrios = computeTriosByWinRate(players, filteredQuarters, 3, false);
              const worstTrios = computeTriosByWinRate(players, filteredQuarters, 5, true);
              return (<>
                {bestTrios.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">✨ 황금 삼각편대 (Best Trio)</h3>
                    <p className="mb-2 text-xs text-muted-foreground">3명 동시 출전 시 팀 승률 TOP (최소 10쿼터)</p>
                    <div className="space-y-2">
                      {bestTrios.map((d, i) => (
                        <div key={d.ids.join("-")} className={`rounded-lg border p-3 ${i === 0 ? "border-primary/50 box-glow" : "border-border"} bg-card`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-wrap">
                              {d.names.map((n, ni) => (<span key={ni}><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => { const p = players.find(pp => pp.name === n); if (p) navigate(`/player/${p.id}`); }}>{n}</span>{ni < d.names.length - 1 && <span className="text-primary mx-1">×</span>}</span>))}
                            </div>
                            <span className="font-display text-lg text-primary text-glow">{d.winRate}%</span>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{d.quarters}쿼터 | {d.wins}승</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {worstTrios.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-destructive">☠️ 버뮤다 삼각지대 (Worst Trio)</h3>
                    <p className="mb-2 text-xs text-muted-foreground">3명 동시 출전 시 팀 승률 최하위 (최소 10쿼터)</p>
                    <div className="space-y-2">
                      {worstTrios.map((d, i) => (
                        <div key={d.ids.join("-")} className={`rounded-lg border p-3 ${i === 0 ? "border-destructive/50" : "border-border"} bg-card`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-wrap">
                              {d.names.map((n, ni) => (<span key={ni}><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => { const p = players.find(pp => pp.name === n); if (p) navigate(`/player/${p.id}`); }}>{n}</span>{ni < d.names.length - 1 && <span className="text-destructive mx-1">×</span>}</span>))}
                            </div>
                            <span className="font-display text-lg text-destructive">{d.winRate}%</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                            <span>{d.quarters}쿼터 동시 출격</span>
                            <span>합산 마진 <span className="text-destructive font-bold">{d.margin > 0 ? "+" : ""}{d.margin}</span></span>
                            <span>쿼터당 <span className="text-destructive font-bold">{(d.totalConceded / d.quarters).toFixed(1)}</span>실점</span>
                            <span>쿼터당 <span className="text-foreground">{(d.totalScored / d.quarters).toFixed(1)}</span>득점</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>);
            })()}
          </motion.div>
        )}

        {activeTab === "formation" && (
          <FormationStatsTab players={players} matches={filteredMatches} goalEvents={filteredGoalEvents} allQuarters={filteredQuarters} rosters={rosters} />
        )}

        {activeTab === "fun" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* 민생지원금 수령자 */}
            <GarbageTimeTab players={players} matches={filteredMatches} results={filteredResults} rosters={filteredRosters} goalEvents={filteredGoalEvents} allQuarters={filteredQuarters} />

            {/* 이색/예능 기록 랭킹보드 */}
            <FunStatsTab players={players} matches={filteredMatches} teams={filteredTeams} results={filteredResults} rosters={filteredRosters} goalEvents={filteredGoalEvents} allQuarters={filteredQuarters} />

            {/* 방해꾼 트리오 */}
            {!isCustomFilter && (() => {
              const TRIO_IDS = [players.find(p => p.name === "이래현")?.id, players.find(p => p.name === "최영재")?.id, players.find(p => p.name === "유성민")?.id].filter(Boolean) as number[];
              if (TRIO_IDS.length < 3) return null;
              const trioMatchIds = [...new Set(filteredRosters.filter(r => TRIO_IDS.includes(r.player_id)).map(r => r.match_id))].filter(mid => TRIO_IDS.every(pid => filteredRosters.some(r => r.match_id === mid && r.player_id === pid)));
              const nonCustomTrioMatches = filteredMatches.filter(m => trioMatchIds.includes(m.id) && !m.is_custom);
              let trioWins = 0, trioTotal = 0, trioAP = 0;
              nonCustomTrioMatches.forEach(m => {
                const mTeams = filteredTeams.filter(t => t.match_id === m.id);
                const ourTeam = mTeams.find(t => t.is_ours);
                if (!ourTeam) return;
                const r = filteredResults.find(r => r.team_id === ourTeam.id && r.match_id === m.id);
                if (!r) return;
                trioTotal++; if (r.result === "승") trioWins++;
              });
              TRIO_IDS.forEach(pid => {
                filteredMatches.filter(m => trioMatchIds.includes(m.id)).forEach(m => {
                  const { goals, assists } = computeMatchAP(pid, m, rosters, goalEvents);
                  trioAP += goals + assists;
                });
              });
              // Compute conceded/scored from quarters where all 3 are on field
              let trioQCount = 0, trioScored = 0, trioConceded = 0, trioMargin = 0;
              filteredQuarters.filter(q => trioMatchIds.includes(q.match_id) && q.lineup).forEach(q => {
                const field = q.lineup ? Object.values(q.lineup as Record<string, any>).flat().map(Number) : [];
                if (TRIO_IDS.every(pid => field.includes(pid))) {
                  trioQCount++;
                  trioScored += q.score_for || 0;
                  trioConceded += q.score_against || 0;
                  trioMargin += (q.score_for || 0) - (q.score_against || 0);
                }
              });
              const trioWinRate = trioTotal > 0 ? Math.round((trioWins / trioTotal) * 100) : 0;
              return (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🚧 방해꾼 트리오</h3>
                  <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 box-glow">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {TRIO_IDS.map(pid => { const p = players.find(pp => pp.id === pid); return (
                        <div key={pid} className="text-center cursor-pointer" onClick={() => navigate(`/player/${pid}`)}>
                          <div className="h-12 w-12 mx-auto rounded-full border-2 border-primary/50 bg-secondary overflow-hidden">
                            {p?.profile_image_url ? <img src={p.profile_image_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary text-lg">👤</div>}
                          </div>
                          <span className="text-xs font-medium text-foreground mt-1 block">{p?.name}</span>
                        </div>
                      ); })}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-secondary/50 p-3"><div className="font-display text-2xl text-primary text-glow">{trioWinRate}%</div><div className="text-[10px] text-muted-foreground">동시출전 승률</div></div>
                      <div className="rounded-lg bg-secondary/50 p-3"><div className="font-display text-2xl text-destructive">{trioQCount > 0 ? (trioConceded / trioQCount).toFixed(1) : "0"}</div><div className="text-[10px] text-muted-foreground">쿼터당 실점</div></div>
                      <div className="rounded-lg bg-secondary/50 p-3"><div className="font-display text-2xl text-foreground">{trioQCount > 0 ? (trioScored / trioQCount).toFixed(1) : "0"}</div><div className="text-[10px] text-muted-foreground">쿼터당 득점</div></div>
                    </div>
                    <p className="mt-3 text-center text-[10px] text-muted-foreground">총 {trioMatchIds.length}경기 동시 출격 (외부전 {trioTotal}경기) | 합산 마진 <span className="text-destructive font-bold">{trioMargin > 0 ? "+" : ""}{trioMargin}</span></p>
                  </div>
                </div>
              );
            })()}

            {/* Hall of Fame */}
            {hallOfFame.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Trophy size={18} /> 명예의 전당</h3>
                <p className="mb-2 text-xs text-muted-foreground">한 경기 공격포인트 10개 이상 달성</p>
                <div className="space-y-2">
                  {hallOfFame.slice(0, 15).map((e) => (
                    <div key={`${e.playerId}-${e.matchId}`} onClick={() => navigate(`/match/${e.matchId}`)} className="cursor-pointer rounded-lg border border-primary/30 bg-card p-3 transition-colors hover:bg-secondary box-glow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="text-lg">🏆</span><span className="cursor-pointer text-sm font-bold text-foreground hover:text-primary" onClick={(ev) => { ev.stopPropagation(); navigate(`/player/${e.playerId}`); }}>{e.name}</span></div>
                        <span className="text-xs text-muted-foreground">{e.date}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">⚽ {e.goals}골 🅰️ {e.assists}어시 = <span className="text-primary font-bold">{e.ap}AP</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Win Fairy */}
            {!isCustomFilter && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🧚 승리 요정 판독기</h3>
                <div className="space-y-2">
                  {winFairy.slice(0, 10).map((d, i) => (
                    <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)} className={`cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-secondary ${i === 0 ? "border-primary/50 box-glow" : i >= winFairy.length - 3 ? "border-destructive/30" : "border-border"}`}>
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{d.diff >= 15 ? "🧚" : d.diff <= -15 ? "👻" : "🤔"}</span><span className="text-sm font-medium text-foreground">{d.name}</span></div><div className={`font-display text-lg ${d.diff > 0 ? "text-primary" : "text-muted-foreground"}`}>{d.diff > 0 ? "+" : ""}{d.diff}%</div></div>
                      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground"><span>출석 시 승률 <span className="text-primary">{d.presentWinRate}%</span> ({d.presentMatches}경기)</span><span>결장 시 승률 {d.absentWinRate}% ({d.absentMatches}경기)</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Quarter */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Clock size={18} /> 극장골 장인</h3>
              <p className="mb-2 text-xs text-muted-foreground">경기 마지막 쿼터 최다 득점자</p>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {lastQSpecialists.map((d, i) => (
                  <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)} className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < lastQSpecialists.length - 1 ? "border-b border-border" : ""}`}>
                    <div className="flex items-center gap-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span><span className="text-sm font-medium text-foreground">{d.name}</span></div>
                    <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.lastQGoals}골</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Duo Synergy */}
            {!isCustomFilter && (
              <>
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Users size={18} /> 환상의 짝꿍 TOP 3</h3>
                  <p className="mb-2 text-xs text-muted-foreground">10경기 이상 함께 출전한 듀오 기준</p>
                  <div className="space-y-2">
                    {duoSynergy.best.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className={`rounded-lg border bg-card p-3 ${i === 0 ? "border-primary/50 box-glow" : "border-border"}`}>
                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">✨</span><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span><span className="text-primary">×</span><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span></div><span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.winRate}%</span></div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.together}경기 중 {d.wins}승</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-destructive"><Ghost size={18} /> 파멸의 듀오 TOP 3</h3>
                  <div className="space-y-2">
                    {duoSynergy.worst.map((d) => (
                      <div key={`${d.p1}-${d.p2}`} className="rounded-lg border border-destructive/30 bg-card p-3">
                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">💀</span><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span><span className="text-destructive">×</span><span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span></div><span className="font-display text-lg text-destructive">{d.winRate}%</span></div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.together}경기 중 {d.wins}승</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Own Goals */}
            {ownGoals.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Skull size={18} /> X맨 / 자책골 랭킹</h3>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {ownGoals.map((d, i) => (
                    <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)} className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < ownGoals.length - 1 ? "border-b border-border" : ""}`}>
                      <div className="flex items-center gap-3"><span className="text-lg">💀</span><span className="text-sm font-medium text-foreground">{d.name}</span></div>
                      <span className="font-display text-lg text-destructive">{d.count}골</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "toto" && (
          <TotoStatsTab matches={matches} teams={teams} results={results} />
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
