import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";

const PlayersPage = () => {
  const navigate = useNavigate();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();

  if (isLoading) return <SplashScreen />;

  const sortedPlayers = [...players].sort((a, b) => {
    const sa = getPlayerStats(players, matches, teams, results, rosters, goalEvents, a.id);
    const sb = getPlayerStats(players, matches, teams, results, rosters, goalEvents, b.id);
    return sb.attackPoints - sa.attackPoints;
  });

  return (
    <div className="pb-20">
      <PageHeader title="PLAYERS" subtitle={`총 ${players.length}명`} />
      <div className="grid grid-cols-2 gap-3 px-4">
        {sortedPlayers.map((player, i) => {
          const stats = getPlayerStats(players, matches, teams, results, rosters, goalEvents, player.id);
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/player/${player.id}`)}
              className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:box-glow active:scale-[0.97]"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/30 bg-secondary">
                  <User size={28} className="text-primary" />
                </div>
                <span className="font-medium text-foreground">{player.name}</span>
                {player.is_active && (
                  <span className="mt-1 text-[10px] text-primary">ACTIVE</span>
                )}
                <div className="mt-3 flex gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-display text-lg text-primary text-glow">{stats.goals}</div>
                    <div className="text-muted-foreground">골</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-lg text-pink-soft">{stats.assists}</div>
                    <div className="text-muted-foreground">도움</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-lg text-foreground">{stats.appearances}</div>
                    <div className="text-muted-foreground">출전</div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayersPage;
