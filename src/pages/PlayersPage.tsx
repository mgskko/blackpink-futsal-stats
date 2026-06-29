import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useAllFutsalData, getPlayerStats } from "@/hooks/useFutsalData";
import { useOnFirePlayers, FIRE_TIER_CONFIG, type FireTier } from "@/hooks/useOnFirePlayers";
import { getPlayerCondition } from "@/hooks/useConditionArrow";
import { isPlayerInactive } from "@/hooks/useInactivePlayers";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import AvatarModal from "@/components/player/AvatarModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MatchQuarter } from "@/hooks/useFutsalData";
import { useDisplayName } from "@/lib/displayName";
import { getConcacafMode } from "@/pages/PlayerDetailPage";

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
  const [concacafMode, setConcacafMode] = useState(false);
  const displayName = useDisplayName();

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

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const activePlayers = players.filter(p => !(p as any).is_guest);
  const concacafSet = useMemo(() => {
    if (!concacafMode) return new Set<number>();
    const s = new Set<number>();
    activePlayers.forEach(p => {
      const badges = getConcacafMode(p.id, matches, rosters, goalEvents, allQuarters, teams, results, momVotes, players);
      if (badges.length > 0) s.add(p.id);
    });
    return s;
  }, [concacafMode, activePlayers, matches, rosters, goalEvents, allQuarters, teams, results, momVotes, players]);

  if (isLoading) return <SplashScreen />;

  const sortedPlayers = [...activePlayers].sort((a, b) => {
    if (concacafMode) {
      const aHas = concacafSet.has(a.id) ? 1 : 0;
      const bHas = concacafSet.has(b.id) ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
    }
    const sa = getPlayerStats(players, matches, teams, results, rosters, goalEvents, a.id);
    const sb = getPlayerStats(players, matches, teams, results, rosters, goalEvents, b.id);
    return sb.attackPoints - sa.attackPoints;
  });

  return (
    <div className="pb-20">
      <AvatarModal imageUrl={avatarPlayer?.url || null} name={avatarPlayer?.name || ""} open={!!avatarPlayer} onClose={() => setAvatarPlayer(null)} />
      <PageHeader title="PLAYERS" subtitle={`총 ${activePlayers.length}명`} />
      <div className="px-4 pb-3">
        <button
          onClick={() => setConcacafMode(v => !v)}
          className={`w-full rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-md transition shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
            concacafMode
              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300 sparkle-anim"
              : "border-border bg-card/60 text-muted-foreground hover:border-emerald-500/40"
          }`}
        >
          🏆 북중미 월드컵 모드 {concacafMode ? "ON" : "OFF"}
        </button>
        <motion.div
          initial={false}
          animate={{ height: concacafMode ? "auto" : 0, opacity: concacafMode ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="mt-2 rounded-lg border border-border/60 bg-card/40 backdrop-blur-md p-3 text-xs text-muted-foreground shadow-sm">
            <p className="mb-2 font-semibold text-foreground">상단 우선 배지 기준</p>
            <ul className="space-y-1.5 leading-relaxed">
              <li>🇪🇸 스페인의 티키타카 — 최근 10경기 연속 공격포인트(골+도움 ≥1)</li>
              <li>🇲🇦 모로코의 철벽 — 수비수(DF)로 투입된 10쿼터 합산 골득실 +</li>
              <li>🇰🇷 홍명보의 강림 — 최근 5경기 4패 이상 OR 출전 쿼터 패배율 70% 이상</li>
              <li>🇨🇻보베르데의 벽 — 최근 5경기 GK 출전 쿼터당 실점율 1.0 미만</li>
            </ul>
          </div>
        </motion.div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4">
        {sortedPlayers.map((player, i) => {
          const stats = getPlayerStats(players, matches, teams, results, rosters, goalEvents, player.id);
          const fire = fireMap.get(player.id);
          const tier = fire?.tier || "none";
          const condition = getPlayerCondition(player.id, matches, rosters, goalEvents, allQuarters);
          const inactive = isPlayerInactive(player.id, matches, rosters);
          const isConcacaf = concacafSet.has(player.id);
          return (
            <motion.div key={player.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/player/${player.id}`)}
              className={`cursor-pointer rounded-lg border p-4 transition-all active:scale-[0.97] ${getCardClass(tier)} ${inactive ? "opacity-50 grayscale" : ""} ${isConcacaf ? "ring-2 ring-emerald-500/60" : ""}`}>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 relative">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-secondary overflow-hidden ${getRingClass(tier)}`}
                    onClick={(e) => { e.stopPropagation(); if (player.profile_image_url) setAvatarPlayer({ url: player.profile_image_url, name: displayName(player) }); }}>
                    {player.profile_image_url ? (
                      <img src={player.profile_image_url} alt={displayName(player)} className="h-full w-full object-cover" />
                    ) : (
                      <User size={28} className="text-primary" />
                    )}
                  </div>
                  {player.back_number !== null && player.back_number !== undefined && (
                    <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-md">{player.back_number}</span>
                  )}
                  {tier !== "none" && <span className="absolute -top-1 -right-1 text-sm sparkle-anim">{getFireEmoji(tier)}</span>}
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  <span className="font-medium text-foreground">{displayName(player)}</span>
                  <span className={`text-sm ${condition.colorClass}`}>{condition.emoji}</span>
                  {tier !== "none" && <span className="sparkle-anim inline-block text-xs">✨</span>}
                  {inactive && (
                    <span className="rounded-full border border-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">💤 비활동</span>
                  )}
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
