import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User } from "lucide-react";
import {
  players,
  getPlayerStats,
  getPlayerRecentForm,
  goalEvents,
  rosters,
  matches,
  getPlayerName,
} from "@/data/futsal";

const PlayerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const playerId = Number(id);
  const player = players.find((p) => p.id === playerId);

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        선수를 찾을 수 없습니다
      </div>
    );
  }

  const stats = getPlayerStats(playerId);
  const recentForm = getPlayerRecentForm(playerId, 5);

  // Labels/badges based on stats
  const labels: string[] = [];
  if (stats.goals >= 20) labels.push("득점기계");
  if (stats.assists >= 15) labels.push("어시왕");
  if (stats.appearances >= 30) labels.push("철강왕");
  if (stats.winRate >= 60) labels.push("승리요정");
  if (stats.attackPoints >= 30) labels.push("핵심선수");
  if (stats.goals >= 10 && stats.assists >= 10) labels.push("올라운더");

  // Goals per game
  const goalsPerGame = stats.appearances > 0 ? (stats.goals / stats.appearances).toFixed(2) : "0";

  // Top duos for this player
  const playerDuos = new Map<number, number>();
  goalEvents.forEach((g) => {
    if (g.goalPlayerId === playerId && g.assistPlayerId) {
      playerDuos.set(g.assistPlayerId, (playerDuos.get(g.assistPlayerId) || 0) + 1);
    }
    if (g.assistPlayerId === playerId && g.goalPlayerId) {
      playerDuos.set(g.goalPlayerId, (playerDuos.get(g.goalPlayerId) || 0) + 1);
    }
  });
  const topDuos = [...playerDuos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary">
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-display text-xl tracking-wider text-primary text-glow">
            PLAYER PROFILE
          </h1>
        </div>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-4 rounded-xl border border-primary/30 bg-card p-6 box-glow"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/50 bg-secondary">
            <User size={40} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{player.name}</h2>
            <p className="text-xs text-muted-foreground">
              가입일: {player.joinDate}
              {player.isActive && <span className="ml-2 text-primary">● ACTIVE</span>}
            </p>
            {labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full gradient-pink px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-4 mt-4 grid grid-cols-2 gap-3"
      >
        {[
          { label: "골", value: stats.goals, glow: true },
          { label: "어시스트", value: stats.assists, glow: false },
          { label: "공격포인트", value: stats.attackPoints, glow: true },
          { label: "경기당 골", value: goalsPerGame, glow: false },
          { label: "출전", value: stats.appearances, glow: false },
          { label: "승률", value: `${stats.winRate}%`, glow: true },
        ].map(({ label, value, glow }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-4 text-center"
          >
            <div className={`font-display text-3xl ${glow ? "text-primary text-glow" : "text-foreground"}`}>
              {value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </motion.div>

      {/* Win/Draw/Loss */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-4 mt-4 rounded-lg border border-border bg-card p-4"
      >
        <h3 className="mb-3 font-display text-lg text-primary">전적</h3>
        <div className="flex justify-around">
          <div className="text-center">
            <div className="font-display text-2xl text-primary text-glow">{stats.wins}</div>
            <div className="text-xs text-muted-foreground">승</div>
          </div>
          <div className="text-center">
            <div className="font-display text-2xl text-foreground">{stats.draws}</div>
            <div className="text-xs text-muted-foreground">무</div>
          </div>
          <div className="text-center">
            <div className="font-display text-2xl text-muted-foreground">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">패</div>
          </div>
        </div>
      </motion.div>

      {/* Recent Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-4 rounded-lg border border-border bg-card p-4"
      >
        <h3 className="mb-3 font-display text-lg text-primary">RECENT FORM</h3>
        <div className="flex justify-center gap-2">
          {recentForm.map((result, i) => (
            <div
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                result === "승"
                  ? "gradient-pink text-primary-foreground"
                  : result === "패"
                  ? "bg-muted text-muted-foreground"
                  : "border border-primary/40 text-primary"
              }`}
            >
              {result}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Best Duos */}
      {topDuos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-4 mt-4 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-display text-lg text-primary">BEST PARTNERS</h3>
          <div className="space-y-2">
            {topDuos.map(([partnerId, count]) => (
              <div
                key={partnerId}
                onClick={() => navigate(`/player/${partnerId}`)}
                className="flex cursor-pointer items-center justify-between rounded-md bg-secondary/50 px-3 py-2 transition-colors hover:bg-secondary"
              >
                <span className="text-sm font-medium text-foreground">{getPlayerName(partnerId)}</span>
                <span className="text-sm text-primary">{count}회 합작</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PlayerDetailPage;
