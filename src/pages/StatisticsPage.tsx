import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import {
  players,
  matches,
  rosters,
  results,
  goalEvents,
  getPlayerName,
  getDeadlyDuos,
  getQuarterGoalDistribution,
} from "@/data/futsal";

// Get unique years from matches
function getAvailableYears(): string[] {
  const years = new Set(matches.map(m => m.date.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

// Compute player stats filtered by year
function getFilteredPlayerStats(playerId: number, year?: string) {
  const filteredMatchIds = year
    ? new Set(matches.filter(m => m.date.startsWith(year)).map(m => m.id))
    : null;

  const playerRosters = rosters.filter(r =>
    r.playerId === playerId && (!filteredMatchIds || filteredMatchIds.has(r.matchId))
  );

  const matchIds = [...new Set(playerRosters.map(r => r.matchId))];
  const appearances = matchIds.length;

  // Goals from roster (non-detail matches)
  const rosterGoals = playerRosters.reduce((s, r) => s + (r.goals || 0), 0);
  const rosterAssists = playerRosters.reduce((s, r) => s + (r.assists || 0), 0);

  // Goals from events (detail matches)
  const filteredEvents = filteredMatchIds
    ? goalEvents.filter(g => filteredMatchIds.has(g.matchId))
    : goalEvents;
  const eventGoals = filteredEvents.filter(g => g.goalPlayerId === playerId && !g.isOwnGoal).length;
  const eventAssists = filteredEvents.filter(g => g.assistPlayerId === playerId).length;

  const goals = rosterGoals + eventGoals;
  const assists = rosterAssists + eventAssists;

  // W/L/D
  let wins = 0, losses = 0, draws = 0;
  // Import results inline
  const { results } = require("@/data/futsal");
  matchIds.forEach(matchId => {
    const teamIds = playerRosters.filter(r => r.matchId === matchId).map(r => r.teamId);
    teamIds.forEach(teamId => {
      const result = results.find((r: any) => r.teamId === teamId && r.matchId === matchId);
      if (result) {
        if (result.result === "승") wins++;
        else if (result.result === "패") losses++;
        else draws++;
      }
    });
  });

  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return { goals, assists, attackPoints: goals + assists, appearances, wins, losses, draws, winRate };
}

const StatisticsPage = () => {
  const navigate = useNavigate();
  const years = getAvailableYears();
  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);

  const allStats = players.map((p) => ({
    ...p,
    ...getFilteredPlayerStats(p.id, selectedYear),
  }));

  const topGoals = [...allStats].sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10);
  const topAssists = [...allStats].sort((a, b) => b.assists - a.assists).filter(p => p.assists > 0).slice(0, 10);
  const topAttackPoints = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 5);
  const topAP10 = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).filter(p => p.attackPoints > 0).slice(0, 10);
  const topAppearances = [...allStats].sort((a, b) => b.appearances - a.appearances).filter(p => p.appearances > 0).slice(0, 10);

  const apChartData = topAttackPoints.map((p) => ({
    name: p.name,
    공격포인트: p.attackPoints,
    골: p.goals,
    도움: p.assists,
  }));

  const quarterData = getQuarterGoalDistribution();
  const duos = getDeadlyDuos(10);

  const LeaderboardTable = ({
    title, data, valueKey,
  }: {
    title: string;
    data: typeof topGoals;
    valueKey: "goals" | "assists" | "attackPoints" | "appearances";
  }) => (
    <div className="mb-6">
      <h3 className="mb-3 font-display text-xl tracking-wider text-primary">{title}</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {data.map((p, i) => (
          <div
            key={p.id}
            onClick={() => navigate(`/player/${p.id}`)}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${
              i < data.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i === 0 ? "gradient-pink text-primary-foreground"
                  : i === 1 ? "bg-primary/20 text-primary"
                  : i === 2 ? "bg-primary/10 text-primary/80"
                  : "bg-secondary text-muted-foreground"
              }`}>{i + 1}</span>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
            </div>
            <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>
              {p[valueKey]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <PageHeader title="STATISTICS" subtitle="버니즈 통계" />

      {/* Year Filter */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedYear(undefined)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              !selectedYear ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            }`}
          >전체</button>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedYear === y ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

      <div className="px-4">
        {/* TOP 5 Attack Points Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">TOP 5 공격포인트</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={apChartData} layout="vertical">
                <XAxis type="number" stroke="hsl(0 0% 40%)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="hsl(0 0% 40%)" fontSize={12} width={50} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} />
                <Bar dataKey="공격포인트" fill="url(#pinkGradient)" radius={[0, 4, 4, 0]} />
                <defs>
                  <linearGradient id="pinkGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(330 80% 45%)" />
                    <stop offset="100%" stopColor="hsl(330 100% 71%)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Quarter Goal Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">쿼터별 득점 추이</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={quarterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis dataKey="quarter" stroke="hsl(0 0% 40%)" fontSize={11} tickFormatter={(v) => `${v}Q`} />
                <YAxis stroke="hsl(0 0% 40%)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(value: number) => [`${value}골`, "득점"]} />
                <Line type="monotone" dataKey="count" stroke="hsl(330 100% 71%)" strokeWidth={3} dot={{ fill: "hsl(330 100% 71%)", strokeWidth: 0, r: 5 }} activeDot={{ r: 8, fill: "hsl(345 80% 81%)" }} style={{ filter: "drop-shadow(0 0 6px hsl(330 100% 71% / 0.5))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Deadly Duos (10) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">💀 DEADLY DUOS</h3>
          <div className="space-y-2">
            {duos.map((duo, i) => (
              <div key={`${duo.p1}-${duo.p2}`} className={`flex items-center justify-between rounded-lg border bg-card p-4 ${i === 0 ? "border-primary/50 box-glow" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>#{i + 1}</span>
                  <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${duo.p1}`)}>
                    {getPlayerName(duo.p1)}
                  </span>
                  <span className="text-primary">×</span>
                  <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => navigate(`/player/${duo.p2}`)}>
                    {getPlayerName(duo.p2)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-display text-2xl ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{duo.count}</span>
                  <span className="text-xs text-muted-foreground">합작</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboards */}
        <LeaderboardTable title="⚽ 누적 골" data={topGoals} valueKey="goals" />
        <LeaderboardTable title="🅰️ 누적 어시스트" data={topAssists} valueKey="assists" />
        <LeaderboardTable title="📊 공격포인트" data={topAP10} valueKey="attackPoints" />
        <LeaderboardTable title="🏟️ 참석 횟수" data={topAppearances} valueKey="appearances" />
      </div>
    </div>
  );
};

export default StatisticsPage;
