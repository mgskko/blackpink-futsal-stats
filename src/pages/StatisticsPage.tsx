import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { useAllFutsalData, getPlayerName, getDeadlyDuos, getQuarterGoalDistribution } from "@/hooks/useFutsalData";
import type { Player, Match, Result, Roster, GoalEvent } from "@/hooks/useFutsalData";
import { getOpponentRecords, getVenueRecords, getAgeCategoryRecords, getWinFairyData, getLastQuarterSpecialists, getDuoSynergyWinRate, getOwnGoalRanking, getHallOfFame, getMOMRanking } from "@/hooks/useAdvancedStats";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import { Skull, Trophy, Flame, Ghost, Target, Clock, Users, MapPin, Shield, Swords, Star, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import TotoStatsTab from "@/components/stats/TotoStatsTab";

type FilterType = "all" | "custom" | string; // string = year

function getAvailableYears(matches: Match[]): string[] {
  const years = new Set(matches.map(m => m.date.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

function getFilteredPlayerStats(playerId: number, matches: Match[], results: Result[], rosters: Roster[], goalEvents: GoalEvent[], filter: FilterType) {
  let filteredMatchIds: Set<number> | null = null;
  if (filter === "custom") {
    filteredMatchIds = new Set(matches.filter(m => m.is_custom).map(m => m.id));
  } else if (filter !== "all") {
    filteredMatchIds = new Set(matches.filter(m => m.date.startsWith(filter)).map(m => m.id));
  }

  const playerRosters = rosters.filter(r => r.player_id === playerId && (!filteredMatchIds || filteredMatchIds.has(r.match_id)));
  const matchIds = [...new Set(playerRosters.map(r => r.match_id))];
  const appearances = matchIds.length;
  const rosterGoals = playerRosters.reduce((s, r) => s + (r.goals || 0), 0);
  const rosterAssists = playerRosters.reduce((s, r) => s + (r.assists || 0), 0);
  const filteredEvents = filteredMatchIds ? goalEvents.filter(g => filteredMatchIds!.has(g.match_id)) : goalEvents;
  const eventGoals = filteredEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).length;
  const eventAssists = filteredEvents.filter(g => g.assist_player_id === playerId).length;
  const goals = rosterGoals + eventGoals;
  const assists = rosterAssists + eventAssists;
  let wins = 0, losses = 0, draws = 0;
  matchIds.forEach(matchId => {
    const teamIds = playerRosters.filter(r => r.match_id === matchId).map(r => r.team_id);
    teamIds.forEach(teamId => {
      const result = results.find(r => r.team_id === teamId && r.match_id === matchId);
      if (result) { if (result.result === "승") wins++; else if (result.result === "패") losses++; else draws++; }
    });
  });
  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  return { goals, assists, attackPoints: goals + assists, appearances, wins, losses, draws, winRate };
}

const StatisticsPage = () => {
  const navigate = useNavigate();
  const { players, matches, venues, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [activeTab, setActiveTab] = useState<"player" | "team" | "fun">("player");

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const years = getAvailableYears(matches);
  const isCustomFilter = selectedFilter === "custom";

  // Filter matches for charts/widgets
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

  if (isLoading) return <SplashScreen />;

  const allStats = players.map(p => ({ ...p, ...getFilteredPlayerStats(p.id, matches, results, rosters, goalEvents, selectedFilter) }));

  const topGoals = [...allStats].sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10);
  const topAssists = [...allStats].sort((a, b) => b.assists - a.assists).filter(p => p.assists > 0).slice(0, 10);
  const topAttackPoints = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 5);
  const topAP10 = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 10);
  const topAppearances = [...allStats].sort((a, b) => b.appearances - a.appearances).filter(p => p.appearances > 0).slice(0, 10);

  const apChartData = topAttackPoints.map(p => ({ name: p.name, 공격포인트: p.attackPoints, 골: p.goals, 도움: p.assists }));
  const quarterData = getQuarterGoalDistribution(filteredGoalEvents);
  const duos = getDeadlyDuos(filteredGoalEvents, 10);

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

  const LeaderboardTable = ({ title, data, valueKey }: { title: string; data: typeof topGoals; valueKey: "goals" | "assists" | "attackPoints" | "appearances" }) => (
    <div className="mb-6">
      <h3 className="mb-3 font-display text-xl tracking-wider text-primary">{title}</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {data.map((p, i) => (
          <div key={p.id} onClick={() => navigate(`/player/${p.id}`)}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < data.length - 1 ? "border-b border-border" : ""}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
            </div>
            <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{p[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const RecordTable = ({ title, icon, data }: { title: string; icon: React.ReactNode; data: { name: string; wins: number; draws: number; losses: number; matches: number; winRate: number }[] }) => (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">{icon} {title}</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">이름</th>
              <th className="px-2 py-2 text-center font-medium">경기</th>
              <th className="px-2 py-2 text-center font-medium">승</th>
              <th className="px-2 py-2 text-center font-medium">무</th>
              <th className="px-2 py-2 text-center font-medium">패</th>
              <th className="px-2 py-2 text-center font-medium">승률</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.name} className={`${i < data.length - 1 ? "border-b border-border" : ""} hover:bg-secondary/50 transition-colors`}>
                <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r.name}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.matches}</td>
                <td className="px-2 py-2 text-center text-primary">{r.wins}</td>
                <td className="px-2 py-2 text-center text-foreground">{r.draws}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.losses}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`font-bold ${r.winRate >= 50 ? "text-primary" : "text-muted-foreground"}`}>{r.winRate}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <PageHeader title="STATISTICS" subtitle="버니즈 통계" />

      {/* Filter: All / Years / Custom */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setSelectedFilter("all")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === "all" ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
            전체
          </button>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedFilter(y)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === y ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
              {y}
            </button>
          ))}
          <button onClick={() => setSelectedFilter("custom")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${selectedFilter === "custom" ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
            ⚔️ 자체전
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-6">
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          {([
            ["player", "👤 개인"] as const,
            ...(!isCustomFilter ? [["team", "⚔️ 팀 전적"] as const] : []),
            ["fun", "📊 각종 기록"] as const,
          ]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeTab === key ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Compare button */}
      <div className="px-4 mb-4">
        <button onClick={() => navigate("/compare")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20">
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
              <h3 className="mb-3 font-display text-xl tracking-wider text-primary">쿼터별 득점 추이</h3>
              <div className="rounded-lg border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={quarterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                    <XAxis dataKey="quarter" stroke="hsl(0 0% 40%)" fontSize={11} tickFormatter={v => `${v}Q`} />
                    <YAxis stroke="hsl(0 0% 40%)" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}골`, "득점"]} />
                    <Line type="monotone" dataKey="count" stroke="hsl(330 100% 71%)" strokeWidth={3} dot={{ fill: "hsl(330 100% 71%)", strokeWidth: 0, r: 5 }} activeDot={{ r: 8, fill: "hsl(345 80% 81%)" }} style={{ filter: "drop-shadow(0 0 6px hsl(330 100% 71% / 0.5))" }} />
                  </LineChart>
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

            <LeaderboardTable title="⚽ 누적 골" data={topGoals} valueKey="goals" />
            <LeaderboardTable title="🅰️ 누적 어시스트" data={topAssists} valueKey="assists" />
            <LeaderboardTable title="📊 공격포인트" data={topAP10} valueKey="attackPoints" />
            <LeaderboardTable title="🏟️ 참석 횟수" data={topAppearances} valueKey="appearances" />

            {/* MOM Ranking */}
            {momRanking.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 font-display text-xl tracking-wider text-primary">⭐ MOM 랭킹</h3>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {momRanking.slice(0, 10).map((d, i) => (
                    <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)}
                      className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < momRanking.length - 1 ? "border-b border-border" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                        <span className="text-sm font-medium text-foreground">{d.name}</span>
                      </div>
                      <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "team" && !isCustomFilter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RecordTable title="상대팀별 전적" icon={<Shield size={18} />} data={opponentRecords} />
            <RecordTable title="구장별 전적" icon={<MapPin size={18} />} data={venueRecords} />

            {/* Age category win rate */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Target size={18} /> 연령대별 승률</h3>
              <div className="space-y-2">
                {ageRecords.map(r => (
                  <div key={r.category} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{r.category}</span>
                      <span className={`font-display text-lg ${r.winRate >= 50 ? "text-primary text-glow" : "text-muted-foreground"}`}>{r.winRate}%</span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>{r.matches}경기</span>
                      <span className="text-primary">{r.wins}승</span>
                      <span>{r.draws}무</span>
                      <span>{r.losses}패</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full gradient-pink rounded-full transition-all" style={{ width: `${r.winRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "fun" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Hall of Fame */}
            {hallOfFame.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Trophy size={18} /> 명예의 전당</h3>
                <div className="space-y-2">
                  {hallOfFame.slice(0, 15).map((e, i) => (
                    <div key={`${e.playerId}-${e.matchId}-${e.type}`} onClick={() => navigate(`/match/${e.matchId}`)}
                      className="cursor-pointer rounded-lg border border-primary/30 bg-card p-3 transition-colors hover:bg-secondary box-glow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{e.type === "hattrick" ? "🎩" : "🎯"}</span>
                          <span className="cursor-pointer text-sm font-bold text-foreground hover:text-primary" onClick={(ev) => { ev.stopPropagation(); navigate(`/player/${e.playerId}`); }}>{e.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{e.date}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.type === "hattrick" ? `⚽ ${e.goals}골` : `🅰️ ${e.assists}어시`}
                        {e.type === "hattrick" ? " 해트트릭!" : " 플레이메이커!"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Win Fairy - hide for custom */}
            {!isCustomFilter && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">🧚 승리 요정 판독기</h3>
                <div className="space-y-2">
                  {winFairy.slice(0, 10).map((d, i) => (
                    <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)}
                      className={`cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-secondary ${i === 0 ? "border-primary/50 box-glow" : i >= winFairy.length - 3 ? "border-destructive/30" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{d.diff >= 15 ? "🧚" : d.diff <= -15 ? "👻" : "🤔"}</span>
                          <span className="text-sm font-medium text-foreground">{d.name}</span>
                        </div>
                        <div className="text-right">
                          <div className={`font-display text-lg ${d.diff > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {d.diff > 0 ? "+" : ""}{d.diff}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                        <span>출석 시 승률 <span className="text-primary">{d.presentWinRate}%</span> ({d.presentMatches}경기)</span>
                        <span>결장 시 승률 {d.absentWinRate}% ({d.absentMatches}경기)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Quarter Specialist */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Clock size={18} /> 극장골 장인</h3>
              <p className="mb-2 text-xs text-muted-foreground">경기 마지막 쿼터 최다 득점자</p>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {lastQSpecialists.map((d, i) => (
                  <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)}
                    className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < lastQSpecialists.length - 1 ? "border-b border-border" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{d.name}</span>
                    </div>
                    <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.lastQGoals}골</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Duo Synergy - hide for custom */}
            {!isCustomFilter && (
              <>
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Users size={18} /> 환상의 짝꿍 TOP 3</h3>
                  <p className="mb-2 text-xs text-muted-foreground">5경기 이상 함께 출전한 듀오 기준</p>
                  <div className="space-y-2">
                    {duoSynergy.best.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className={`rounded-lg border bg-card p-3 ${i === 0 ? "border-primary/50 box-glow" : "border-border"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span>
                            <span className="text-primary">×</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span>
                          </div>
                          <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.winRate}%</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.together}경기 중 {d.wins}승</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-destructive"><Ghost size={18} /> 파멸의 듀오 TOP 3</h3>
                  <div className="space-y-2">
                    {duoSynergy.worst.map((d, i) => (
                      <div key={`${d.p1}-${d.p2}`} className="rounded-lg border border-destructive/30 bg-card p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💀</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p1}`)}>{d.name1}</span>
                            <span className="text-destructive">×</span>
                            <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${d.p2}`)}>{d.name2}</span>
                          </div>
                          <span className="font-display text-lg text-destructive">{d.winRate}%</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{d.together}경기 중 {d.wins}승</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Own Goal Ranking */}
            {ownGoals.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary"><Skull size={18} /> X맨 / 자책골 랭킹</h3>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {ownGoals.map((d, i) => (
                    <div key={d.playerId} onClick={() => navigate(`/player/${d.playerId}`)}
                      className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < ownGoals.length - 1 ? "border-b border-border" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💀</span>
                        <span className="text-sm font-medium text-foreground">{d.name}</span>
                      </div>
                      <span className="font-display text-lg text-destructive">{d.count}골</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
