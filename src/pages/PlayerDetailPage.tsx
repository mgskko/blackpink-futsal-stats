import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, Trophy, TrendingUp, TrendingDown, Minus, Sparkles, Gift } from "lucide-react";
import { useAllFutsalData, getPlayerStats, getPlayerBestAPMatch, getPlayerAssistGiven, getPlayerAssistReceived, getPlayerName, getMatchResult } from "@/hooks/useFutsalData";
import type { Match, Roster, GoalEvent } from "@/hooks/useFutsalData";
import { getPlayerBadges, getWinFairyData, getPlayerFormGuide, getDeepScoutingReport, getVarianceBadge } from "@/hooks/useAdvancedStats";
import { useOnFirePlayers, type FireTier } from "@/hooks/useOnFirePlayers";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PlayerFilterTabs, { getAvailableYears, filterMatchesByMode, type FilterMode } from "@/components/player/PlayerFilterTabs";
import PlayerTierBadge, { getPlayerTier, TIER_CONFIG } from "@/components/player/PlayerTierBadge";
import ActivityHeatmap from "@/components/player/ActivityHeatmap";
import SeasonWrapped from "@/components/player/SeasonWrapped";

const PlayerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const playerId = Number(id);
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const fireMap = useOnFirePlayers(matches, rosters);
  const fireInfo = fireMap.get(playerId);
  const fireTier: FireTier = fireInfo?.tier || "none";

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showWrapped, setShowWrapped] = useState(false);

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const years = useMemo(() => getAvailableYears(matches), [matches]);

  // Filter data based on mode
  const filtered = useMemo(() => {
    const fm = filterMatchesByMode(matches, filterMode, selectedYear);
    const fmIds = new Set(fm.map(m => m.id));
    return {
      matches: fm,
      matchIds: fmIds,
      rosters: rosters.filter(r => fmIds.has(r.match_id)),
      goalEvents: goalEvents.filter(g => fmIds.has(g.match_id)),
      teams: teams.filter(t => fmIds.has(t.match_id)),
      results: results.filter(r => fmIds.has(r.match_id)),
    };
  }, [matches, teams, results, rosters, goalEvents, filterMode, selectedYear]);

  const handleFilterChange = (mode: FilterMode, year?: string) => {
    setFilterMode(mode);
    if (mode === "year") setSelectedYear(year || years[0] || "");
    else setSelectedYear("");
  };

  if (isLoading) return <SplashScreen />;

  const player = players.find(p => p.id === playerId);
  if (!player) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">선수를 찾을 수 없습니다</div>;

  const stats = getPlayerStats(players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, playerId);
  const bestAP = getPlayerBestAPMatch(filtered.matches, filtered.rosters, filtered.goalEvents, playerId);
  const assistGiven = getPlayerAssistGiven(filtered.goalEvents, playerId, 7);
  const assistReceived = getPlayerAssistReceived(filtered.goalEvents, playerId, 7);
  const badges = getPlayerBadges(playerId, players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, momVotes);
  const varianceBadges = getVarianceBadge(playerId, filtered.matches, filtered.rosters, filtered.goalEvents);
  const allBadges = [...badges, ...varianceBadges];

  const winFairyAll = getWinFairyData(players, filtered.matches, filtered.teams, filtered.results, filtered.rosters);
  const myFairy = winFairyAll.find(d => d.playerId === playerId);

  const formGuide = getPlayerFormGuide(playerId, filtered.matches, filtered.rosters, filtered.goalEvents);
  const scoutingReport = getDeepScoutingReport(playerId, players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, momVotes);

  // Tier uses ALL data (not filtered)
  const tier = getPlayerTier(playerId, matches, rosters, goalEvents, momVotes);

  const playerDuos = new Map<number, number>();
  filtered.goalEvents.forEach(g => {
    if (g.goal_player_id === playerId && g.assist_player_id) playerDuos.set(g.assist_player_id, (playerDuos.get(g.assist_player_id) || 0) + 1);
    if (g.assist_player_id === playerId && g.goal_player_id) playerDuos.set(g.goal_player_id, (playerDuos.get(g.goal_player_id) || 0) + 1);
  });
  const topDuos = [...playerDuos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);

  const goalsPerGame = stats.appearances > 0 ? (stats.goals / stats.appearances).toFixed(2) : "0";
  const bestAPResult = bestAP ? getMatchResult(teams, results, bestAP.matchId) : null;

  const PartnerList = ({ title, data, subLabel }: { title: string; data: { partnerId: number; count: number }[]; subLabel: string }) => (
    data.length > 0 ? (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-lg text-primary">{title}</h3>
        <div className="space-y-2">
          {data.map(({ partnerId, count }, i) => (
            <div key={partnerId} onClick={() => navigate(`/player/${partnerId}`)}
              className="flex cursor-pointer items-center justify-between rounded-md bg-secondary/50 px-3 py-2 transition-colors hover:bg-secondary">
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                <span className="text-sm font-medium text-foreground">{getPlayerName(players, partnerId)}</span>
              </div>
              <span className="text-sm text-primary">{count}회 {subLabel}</span>
            </div>
          ))}
        </div>
      </motion.div>
    ) : null
  );

  const trendIcon = scoutingReport.trend === "up" ? <TrendingUp size={16} className="text-primary" />
    : scoutingReport.trend === "down" ? <TrendingDown size={16} className="text-destructive" />
    : scoutingReport.trend === "special" ? <Sparkles size={16} className="text-primary" />
    : <Minus size={16} className="text-muted-foreground" />;

  const filterLabel = filterMode === "all" ? "종합" : filterMode === "year" ? `${selectedYear}시즌` : "자체전";

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft size={24} /></button>
          <h1 className="font-display text-xl tracking-wider text-primary text-glow">PLAYER PROFILE</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <PlayerFilterTabs
        filterMode={filterMode}
        selectedYear={selectedYear}
        years={years}
        onFilterChange={handleFilterChange}
      />

      {/* Profile Header - Stat Card Style */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`mx-4 mt-4 rounded-xl border overflow-hidden ${
          fireTier === "golden"
            ? "golden-fire-card border-yellow-500/50"
            : fireTier === "red"
            ? "on-fire-card border-orange-500/50"
            : fireTier === "blue"
            ? "blue-fire-card border-blue-400/50"
            : "border-primary/30 bg-card box-glow"
        }`}
      >
        {/* Hero section with gradient background */}
        <div className={`relative p-6 ${
          fireTier === "golden"
            ? "bg-gradient-to-br from-yellow-900/30 via-transparent to-amber-900/20"
            : fireTier === "red"
            ? "bg-gradient-to-br from-orange-900/30 via-transparent to-red-900/20"
            : fireTier === "blue"
            ? "bg-gradient-to-br from-blue-900/30 via-transparent to-cyan-900/20"
            : "bg-gradient-to-br from-primary/20 via-card to-card"
        }`}>
          {/* Back number watermark */}
          {player.back_number !== null && player.back_number !== undefined && (
            <div className="absolute top-2 right-4 font-display text-[80px] leading-none text-primary/10 select-none pointer-events-none">
              {player.back_number}
            </div>
          )}

          {/* Fire particles for on-fire players */}
          {fireTier !== "none" && (
            <>
              <span className="fire-particle fire-particle-1" style={{ top: '10px', right: '20px' }}>{fireTier === "golden" ? "👑" : fireTier === "red" ? "🔥" : "💎"}</span>
              <span className="fire-particle fire-particle-2" style={{ top: '30px', left: '15px' }}>✨</span>
              <span className="fire-particle fire-particle-1" style={{ bottom: '15px', right: '40px' }}>{fireTier === "golden" ? "⭐" : fireTier === "red" ? "🔥" : "💎"}</span>
              <span className="fire-particle fire-particle-2" style={{ bottom: '10px', left: '30px' }}>✨</span>
            </>
          )}

          <div className="flex items-center gap-5 relative z-10">
            {/* Profile image */}
            <div className="relative flex-shrink-0">
              <div className={`h-24 w-24 overflow-hidden rounded-2xl border-2 bg-secondary shadow-lg ${
                fireTier === "golden" ? "golden-fire-ring shadow-yellow-500/30"
                : fireTier === "red" ? "on-fire-ring shadow-orange-500/30"
                : fireTier === "blue" ? "blue-fire-ring shadow-blue-500/30"
                : "border-primary/50 shadow-primary/20"
              }`}>
                {player.profile_image_url ? (
                  <img src={player.profile_image_url} alt={player.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User size={44} className="text-primary/60" />
                  </div>
                )}
              </div>
              {/* Back number badge */}
              {player.back_number !== null && player.back_number !== undefined && (
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-lg gradient-pink text-sm font-bold text-primary-foreground shadow-md">
                  {player.back_number}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground">{player.name}</h2>
                {fireTier !== "none" && <span className="text-lg sparkle-anim">{fireTier === "golden" ? "👑" : fireTier === "red" ? "🔥" : "💎"}</span>}
                <PlayerTierBadge tier={tier} size="md" />
                {formGuide.form === "hot" && fireTier === "none" && <span className="text-lg" title="최근 폼 상승">🔥</span>}
                {formGuide.form === "cold" && <span className="text-lg" title="최근 폼 하락">❄️</span>}
              </div>
              {fireTier !== "none" && (
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold sparkle-anim ${
                  fireTier === "golden" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : fireTier === "red" ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                  : "border-blue-400/40 bg-blue-400/10 text-blue-400"
                }`}>
                  {fireTier === "golden" ? "👑 LEGENDARY — " : fireTier === "red" ? "🔥 ON FIRE — " : "💎 HEATING UP — "}
                  {fireInfo?.streak}연속 출석!
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                가입일: {player.join_date}
                {player.is_active && <span className="ml-2 text-primary">● ACTIVE</span>}
              </p>
              {formGuide.recentGames > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  최근 {formGuide.recentGames}경기 AP: <span className={formGuide.form === "hot" ? "text-primary font-bold" : formGuide.form === "cold" ? "text-destructive" : "text-foreground"}>{formGuide.recentAP}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        {allBadges.length > 0 && (
          <div className="px-6 pb-5 pt-3 flex flex-wrap gap-1.5">
            {allBadges.map((badge, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                badge.emoji === "🚨" ? "border-destructive/40 bg-destructive/10 text-destructive"
                : badge.emoji === "🛡️" ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-primary/40 bg-primary/10 text-primary"
              }`}>
                <span>{badge.emoji}</span>
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Filter indicator */}
      {filterMode !== "all" && (
        <div className="mx-4 mt-2 text-center text-[11px] text-primary font-bold">
          📊 {filterLabel} 기준 데이터
        </div>
      )}

      {/* Deep Scouting Report */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-4 mt-4 rounded-xl border border-primary/40 bg-background p-5 shadow-lg shadow-primary/5">
        <h3 className="mb-3 font-display text-lg tracking-wide text-primary text-glow flex items-center gap-2">
          {trendIcon}
          수석코치 AI 스카우팅 리포트
        </h3>
        <div className="flex items-start gap-4 rounded-lg bg-secondary/30 border border-primary/20 p-4">
          <span className="text-4xl drop-shadow-lg">{scoutingReport.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-primary text-glow mb-1.5">{scoutingReport.label}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{scoutingReport.comment}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mx-4 mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "골", value: stats.goals, glow: true },
          { label: "어시스트", value: stats.assists, glow: false },
          { label: "공격포인트", value: stats.attackPoints, glow: true },
          { label: "경기당 골", value: goalsPerGame, glow: false },
          { label: "출전", value: stats.appearances, glow: false },
          { label: "승률", value: `${stats.winRate}%`, glow: true },
        ].map(({ label, value, glow }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
            <div className={`font-display text-3xl ${glow ? "text-primary text-glow" : "text-foreground"}`}>{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </motion.div>

      {/* Win/Draw/Loss */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mx-4 mt-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-lg text-primary">전적</h3>
        <div className="flex justify-around">
          <div className="text-center"><div className="font-display text-2xl text-primary text-glow">{stats.wins}</div><div className="text-xs text-muted-foreground">승</div></div>
          <div className="text-center"><div className="font-display text-2xl text-foreground">{stats.draws}</div><div className="text-xs text-muted-foreground">무</div></div>
          <div className="text-center"><div className="font-display text-2xl text-muted-foreground">{stats.losses}</div><div className="text-xs text-muted-foreground">패</div></div>
        </div>
      </motion.div>

      {/* Win Fairy - only show for non-custom */}
      {myFairy && filterMode !== "custom" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="mx-4 mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 font-display text-lg text-primary flex items-center gap-2">
            {myFairy.diff >= 15 ? "🧚" : myFairy.diff <= -15 ? "👻" : "📊"} 승리 요정 지수
          </h3>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <div>출석 시 팀 승률: <span className="text-primary font-bold">{myFairy.presentWinRate}%</span> ({myFairy.presentMatches}경기)</div>
              <div>결장 시 팀 승률: <span className="text-foreground">{myFairy.absentWinRate}%</span> ({myFairy.absentMatches}경기)</div>
            </div>
            <div className={`font-display text-2xl ${myFairy.diff > 0 ? "text-primary text-glow" : "text-muted-foreground"}`}>
              {myFairy.diff > 0 ? "+" : ""}{myFairy.diff}%
            </div>
          </div>
        </motion.div>
      )}

      {/* Best Match */}
      {bestAP && bestAP.ap > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-4 mt-4 rounded-lg border border-primary/30 bg-card p-4 box-glow">
          <h3 className="mb-3 font-display text-lg text-primary flex items-center gap-2"><Trophy size={18} /> BEST MATCH</h3>
          <div onClick={() => navigate(`/match/${bestAP.matchId}`)} className="cursor-pointer rounded-md bg-secondary/50 p-3 transition-colors hover:bg-secondary">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{bestAP.date}</div>
                {bestAPResult && (
                  <div className="mt-1 text-sm text-foreground">
                    vs {bestAPResult.opponentTeam.name}
                    <span className={`ml-2 text-xs font-bold ${bestAPResult.ourResult.result === "승" ? "text-primary" : "text-muted-foreground"}`}>{bestAPResult.ourResult.result}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-display text-2xl text-primary text-glow">{bestAP.ap}AP</div>
                <div className="text-xs text-muted-foreground">{bestAP.goals}골 {bestAP.assists}어시</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Best Partners */}
      {topDuos.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mx-4 mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-display text-lg text-primary">BEST PARTNERS</h3>
          <div className="space-y-2">
            {topDuos.map(([partnerId, count], i) => (
              <div key={partnerId} onClick={() => navigate(`/player/${partnerId}`)}
                className="flex cursor-pointer items-center justify-between rounded-md bg-secondary/50 px-3 py-2 transition-colors hover:bg-secondary">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{getPlayerName(players, partnerId)}</span>
                </div>
                <span className="text-sm text-primary">{count}회 합작</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <PartnerList title="🅰️ 내가 어시스트 해준 선수" data={assistGiven} subLabel="도움" />
      <PartnerList title="⚽ 나에게 어시스트 해준 선수" data={assistReceived} subLabel="도움" />

      {/* Activity Heatmap */}
      <ActivityHeatmap
        playerId={playerId}
        matches={matches}
        rosters={rosters}
        goalEvents={goalEvents}
        momVotes={momVotes}
        year={filterMode === "year" && selectedYear ? parseInt(selectedYear) : undefined}
      />

      {/* Season Wrapped Button */}
      {filterMode === "year" && selectedYear && parseInt(selectedYear) < new Date().getFullYear() && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4">
          <button
            onClick={() => setShowWrapped(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/60"
          >
            <Gift size={18} /> {selectedYear} 시즌 결산 카드 만들기
          </button>
        </motion.div>
      )}

      {/* Season Wrapped Modal */}
      {showWrapped && filterMode === "year" && selectedYear && (
        <SeasonWrapped
          player={player}
          year={selectedYear}
          stats={stats}
          scoutingReport={scoutingReport}
          tierLabel={tier.label}
          tierEmoji={tier.emoji}
          onClose={() => setShowWrapped(false)}
        />
      )}
    </div>
  );
};

export default PlayerDetailPage;
