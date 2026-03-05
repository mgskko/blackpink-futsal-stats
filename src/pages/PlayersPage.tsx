import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import { getPlayerFormGuide } from "@/hooks/useAdvancedStats";
import { useOnFirePlayers } from "@/hooks/useOnFirePlayers";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";

const PlayersPage = () => {
  const navigate = useNavigate();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const onFireIds = useOnFirePlayers(matches);

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
          const form = getPlayerFormGuide(player.id, matches, rosters, goalEvents);
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/player/${player.id}`)}
              className={`cursor-pointer rounded-lg border p-4 transition-all active:scale-[0.97] ${
                onFireIds.has(player.id)
                  ? "on-fire-card border-orange-500/50"
                  : "border-border bg-card hover:border-primary/40 hover:box-glow"
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 relative">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-secondary overflow-hidden ${
                    onFireIds.has(player.id) ? "on-fire-ring" : "border-primary/30"
                  }`}>
                    {player.profile_image_url ? (
                      <img src={player.profile_image_url} alt={player.name} className="h-full w-full object-cover" />
                    ) : (
                      <User size={28} className="text-primary" />
                    )}
                  </div>
                  {player.back_number !== null && player.back_number !== undefined && (
                    <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-md">
                      {player.back_number}
                    </span>
                  )}
                  {onFireIds.has(player.id) && <span className="absolute -top-1 -right-1 text-sm sparkle-anim">🔥</span>}
                  {!onFireIds.has(player.id) && form.form === "hot" && <span className="absolute -top-1 -right-1 text-sm">🔥</span>}
                  {form.form === "cold" && <span className="absolute -top-1 -right-1 text-sm">❄️</span>}
                </div>
                <span className="font-medium text-foreground">
                  {player.name}
                  {onFireIds.has(player.id) && <span className="ml-1 sparkle-anim inline-block">✨</span>}
                </span>
                <div className="mt-3 grid grid-cols-4 gap-1 text-xs w-full">
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
                  <div className="text-center">
                    <div className="font-display text-lg text-primary">{stats.winRate}%</div>
                    <div className="text-muted-foreground">승률</div>
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
