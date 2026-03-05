import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import { getPlayerFormGuide } from "@/hooks/useAdvancedStats";
import { useOnFirePlayers, type FireTier } from "@/hooks/useOnFirePlayers";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";

function getCardClass(tier: FireTier) {
  if (tier === "golden") return "golden-fire-card border-yellow-500/50";
  if (tier === "red") return "on-fire-card border-orange-500/50";
  if (tier === "blue") return "blue-fire-card border-blue-400/50";
  return "border-border bg-card hover:border-primary/40 hover:box-glow";
}
function getRingClass(tier: FireTier) {
  if (tier === "golden") return "golden-fire-ring";
  if (tier === "red") return "on-fire-ring";
  if (tier === "blue") return "blue-fire-ring";
  return "border-primary/30";
}
function getFireEmoji(tier: FireTier) {
  if (tier === "golden") return "👑";
  if (tier === "red") return "🔥";
  if (tier === "blue") return "💎";
  return "";
}

const PlayersPage = () => {
  const navigate = useNavigate();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const fireMap = useOnFirePlayers(matches, rosters);

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
          const fire = fireMap.get(player.id);
          const tier = fire?.tier || "none";
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/player/${player.id}`)}
              className={`cursor-pointer rounded-lg border p-4 transition-all active:scale-[0.97] ${getCardClass(tier)}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 relative">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-secondary overflow-hidden ${getRingClass(tier)}`}>
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
                  {tier !== "none" && <span className="absolute -top-1 -right-1 text-sm sparkle-anim">{getFireEmoji(tier)}</span>}
                  {tier === "none" && form.form === "hot" && <span className="absolute -top-1 -right-1 text-sm">🔥</span>}
                  {form.form === "cold" && <span className="absolute -top-1 -right-1 text-sm">❄️</span>}
                </div>
                <span className="font-medium text-foreground">
                  {player.name}
                  {tier !== "none" && <span className="ml-1 sparkle-anim inline-block">✨</span>}
                </span>
                {/* Fire particles */}
                {tier === "red" && (
                  <>
                    <span className="fire-particle fire-particle-1" style={{ bottom: '8px', right: '12px' }}>🔥</span>
                    <span className="fire-particle fire-particle-2" style={{ bottom: '8px', left: '12px' }}>✨</span>
                  </>
                )}
                {tier === "golden" && (
                  <>
                    <span className="fire-particle fire-particle-1" style={{ bottom: '8px', right: '8px' }}>👑</span>
                    <span className="fire-particle fire-particle-2" style={{ bottom: '8px', left: '8px' }}>⭐</span>
                    <span className="fire-particle fire-particle-1" style={{ top: '50%', right: '4px' }}>✨</span>
                  </>
                )}
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
