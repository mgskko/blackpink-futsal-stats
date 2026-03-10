import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import { useOnFirePlayers, FIRE_TIER_CONFIG, type FireTier } from "@/hooks/useOnFirePlayers";
import { getPlayerCondition } from "@/hooks/useConditionArrow";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import AvatarModal from "@/components/player/AvatarModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MatchQuarter } from "@/hooks/useFutsalData";

function getCardClass(tier: FireTier) {
  if (tier === "none") return "border-border bg-card hover:border-primary/40 hover:box-glow";
  return `${FIRE_TIER_CONFIG[tier].cardClass} ${FIRE_TIER_CONFIG[tier].borderClass}`;
}
function getRingClass(tier: FireTier) {
  if (tier === "none") return "border-primary/30";
  return FIRE_TIER_CONFIG[tier].ringClass;
}
function getFireEmoji(tier: FireTier) {
  if (tier === "none") return "";
  return FIRE_TIER_CONFIG[tier].emoji;
}

const PlayersPage = () => {
  const navigate = useNavigate();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const fireMap = useOnFirePlayers(matches, rosters);
  const [avatarPlayer, setAvatarPlayer] = useState<{ url: string | null; name: string } | null>(null);

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

  if (isLoading) return <SplashScreen />;

  const activePlayers = players.filter(p => !(p as any).is_guest);
  const sortedPlayers = [...activePlayers].sort((a, b) => {
    const sa = getPlayerStats(players, matches, teams, results, rosters, goalEvents, a.id);
    const sb = getPlayerStats(players, matches, teams, results, rosters, goalEvents, b.id);
    return sb.attackPoints - sa.attackPoints;
  });

  return (
    <div className="pb-20">
      <AvatarModal imageUrl={avatarPlayer?.url || null} name={avatarPlayer?.name || ""} open={!!avatarPlayer} onClose={() => setAvatarPlayer(null)} />
      <PageHeader title="PLAYERS" subtitle={`총 ${activePlayers.length}명`} />
      <div className="grid grid-cols-2 gap-3 px-4">
        {sortedPlayers.map((player, i) => {
          const stats = getPlayerStats(players, matches, teams, results, rosters, goalEvents, player.id);
          const fire = fireMap.get(player.id);
          const tier = fire?.tier || "none";
          const condition = getPlayerCondition(player.id, matches, rosters, goalEvents, allQuarters);
          return (
            <motion.div key={player.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/player/${player.id}`)}
              className={`cursor-pointer rounded-lg border p-4 transition-all active:scale-[0.97] ${getCardClass(tier)}`}>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 relative">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-secondary overflow-hidden ${getRingClass(tier)}`}
                    onClick={(e) => { e.stopPropagation(); if (player.profile_image_url) setAvatarPlayer({ url: player.profile_image_url, name: player.name }); }}>
                    {player.profile_image_url ? (
                      <img src={player.profile_image_url} alt={player.name} className="h-full w-full object-cover" />
                    ) : (
                      <User size={28} className="text-primary" />
                    )}
                  </div>
                  {player.back_number !== null && player.back_number !== undefined && (
                    <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-md">{player.back_number}</span>
                  )}
                  {tier !== "none" && <span className="absolute -top-1 -right-1 text-sm sparkle-anim">{getFireEmoji(tier)}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{player.name}</span>
                  <span className={`text-sm ${condition.colorClass}`}>{condition.emoji}</span>
                  {tier !== "none" && <span className="sparkle-anim inline-block text-xs">✨</span>}
                </div>
                {tier === "onfire" && (
                  <>
                    <span className="fire-particle fire-particle-1" style={{ bottom: '8px', right: '12px' }}>🔥</span>
                    <span className="fire-particle fire-particle-2" style={{ bottom: '8px', left: '12px' }}>✨</span>
                  </>
                )}
                {(tier === "legendary" || tier === "godmode") && (
                  <>
                    <span className="fire-particle fire-particle-1" style={{ bottom: '8px', right: '8px' }}>{tier === "godmode" ? "💫" : "👑"}</span>
                    <span className="fire-particle fire-particle-2" style={{ bottom: '8px', left: '8px' }}>⭐</span>
                  </>
                )}
                <div className="mt-3 grid grid-cols-4 gap-1 text-xs w-full">
                  <div className="text-center"><div className="font-display text-lg text-primary text-glow">{stats.goals}</div><div className="text-muted-foreground">골</div></div>
                  <div className="text-center"><div className="font-display text-lg text-pink-soft">{stats.assists}</div><div className="text-muted-foreground">도움</div></div>
                  <div className="text-center"><div className="font-display text-lg text-foreground">{stats.appearances}</div><div className="text-muted-foreground">출전</div></div>
                  <div className="text-center"><div className="font-display text-lg text-primary">{stats.winRate}%</div><div className="text-muted-foreground">승률</div></div>
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
