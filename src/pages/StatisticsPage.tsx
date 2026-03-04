import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import {
  players,
  getPlayerStats,
  getPlayerName,
  getDeadlyDuos,
  getQuarterGoalDistribution,
} from "@/data/futsal";
import PageHeader from "@/components/PageHeader";

const StatisticsPage = () => {
  // Leaderboard data
  const allStats = players.map((p) => ({
    ...p,
    ...getPlayerStats(p.id),
  }));

  const topGoals = [...allStats].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const topAssists = [...allStats].sort((a, b) => b.assists - a.assists).slice(0, 10);
  const topAttackPoints = [...allStats].sort((a, b) => b.attackPoints - a.attackPoints).slice(0, 5);
  const topAppearances = [...allStats].sort((a, b) => b.appearances - a.appearances).slice(0, 10);

  // Chart data
  const apChartData = topAttackPoints.map((p) => ({
    name: p.name,
    공격포인트: p.attackPoints,
    골: p.goals,
    도움: p.assists,
  }));

  const quarterData = getQuarterGoalDistribution();
  const duos = getDeadlyDuos(5);

  const LeaderboardTable = ({
    title,
    data,
    valueKey,
    valueLabel,
  }: {
    title: string;
    data: typeof topGoals;
    valueKey: "goals" | "assists" | "attackPoints" | "appearances";
    valueLabel: string;
  }) => (
    <div className="mb-6">
      <h3 className="mb-3 font-display text-xl tracking-wider text-primary">{title}</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {data.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < data.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0
                    ? "gradient-pink text-primary-foreground"
                    : i === 1
                    ? "bg-primary/20 text-primary"
                    : i === 2
                    ? "bg-primary/10 text-primary/80"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
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
      <div className="px-4">
        {/* TOP 5 Attack Points Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">
            TOP 5 공격포인트
          </h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={apChartData} layout="vertical">
                <XAxis type="number" stroke="hsl(0 0% 40%)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="hsl(0 0% 40%)" fontSize={12} width={50} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 7%)",
                    border: "1px solid hsl(330 100% 71% / 0.3)",
                    borderRadius: "8px",
                    color: "hsl(0 0% 95%)",
                  }}
                />
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">
            쿼터별 득점 추이
          </h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={quarterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis
                  dataKey="quarter"
                  stroke="hsl(0 0% 40%)"
                  fontSize={11}
                  tickFormatter={(v) => `${v}Q`}
                />
                <YAxis stroke="hsl(0 0% 40%)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 7%)",
                    border: "1px solid hsl(330 100% 71% / 0.3)",
                    borderRadius: "8px",
                    color: "hsl(0 0% 95%)",
                  }}
                  formatter={(value: number) => [`${value}골`, "득점"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(330 100% 71%)"
                  strokeWidth={3}
                  dot={{ fill: "hsl(330 100% 71%)", strokeWidth: 0, r: 5 }}
                  activeDot={{ r: 8, fill: "hsl(345 80% 81%)" }}
                  style={{ filter: "drop-shadow(0 0 6px hsl(330 100% 71% / 0.5))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Deadly Duos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="mb-3 font-display text-xl tracking-wider text-primary">
            💀 DEADLY DUOS
          </h3>
          <div className="space-y-2">
            {duos.map((duo, i) => (
              <div
                key={`${duo.p1}-${duo.p2}`}
                className={`flex items-center justify-between rounded-lg border bg-card p-4 ${
                  i === 0 ? "border-primary/50 box-glow" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  <span className="font-medium text-foreground">
                    {getPlayerName(duo.p1)}
                  </span>
                  <span className="text-primary">×</span>
                  <span className="font-medium text-foreground">
                    {getPlayerName(duo.p2)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-display text-2xl ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>
                    {duo.count}
                  </span>
                  <span className="text-xs text-muted-foreground">합작</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboards */}
        <LeaderboardTable title="⚽ 누적 골" data={topGoals} valueKey="goals" valueLabel="골" />
        <LeaderboardTable title="🅰️ 누적 어시스트" data={topAssists} valueKey="assists" valueLabel="도움" />
        <LeaderboardTable title="📊 공격포인트" data={[...allStats].sort((a, b) => b.attackPoints - a.attackPoints).slice(0, 10)} valueKey="attackPoints" valueLabel="AP" />
        <LeaderboardTable title="🏟️ 참석 횟수" data={topAppearances} valueKey="appearances" valueLabel="경기" />
      </div>
    </div>
  );
};

export default StatisticsPage;
