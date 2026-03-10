import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, Trophy, TrendingUp, TrendingDown, Minus, Sparkles, Gift, Skull, Shield } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useAllFutsalData, getPlayerStats, getPlayerBestAPMatch, getPlayerAssistGiven, getPlayerAssistReceived, getPlayerName, getMatchResult, useMatchQuarters, computeMatchAP } from "@/hooks/useFutsalData";
import type { Match, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerBadges, getWinFairyData, getPlayerFormGuide, getDeepScoutingReport, getVarianceBadge, getOpponentRecords } from "@/hooks/useAdvancedStats";
import { useOnFirePlayers, type FireTier } from "@/hooks/useOnFirePlayers";
import { computeAllCourtMargins, getPlayerPositionDistribution, getKillerQuarter, getDefenseContribution, getOwnGoalInducerCount, getSoloVsTeamGoals, computePlayerTraits, getPlayerPosition, getPlayerTeamInLineup } from "@/hooks/useCourtStats";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PlayerFilterTabs, { getAvailableYears, filterMatchesByMode, type FilterMode } from "@/components/player/PlayerFilterTabs";
import PlayerTierBadge, { getPlayerTier } from "@/components/player/PlayerTierBadge";
import ActivityHeatmap from "@/components/player/ActivityHeatmap";
import SeasonWrapped from "@/components/player/SeasonWrapped";
import AvatarModal from "@/components/player/AvatarModal";
import PlayerComments from "@/components/player/PlayerComments";

function getConcacafMode(playerId: number, matches: Match[], rosters: Roster[], goalEvents: GoalEvent[], allQuarters: MatchQuarter[], momVotes?: { match_id: number; voted_player_id: number }[], players?: any[]): { active: boolean; country: string; text: string } {
  // Get last 5 matches this player appeared in
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  const recent5 = sortedMatches.slice(0, 5);
  if (recent5.length < 5) return { active: false, country: "", text: "" };
  const r5Ids = new Set(recent5.map(m => m.id));
  const r5Goals = goalEvents.filter(g => r5Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal);
  const r5Assists = goalEvents.filter(g => r5Ids.has(g.match_id) && g.assist_player_id === playerId);
  const r5AP = r5Goals.length + r5Assists.length;
  const r5Quarters = allQuarters.filter(q => r5Ids.has(q.match_id) && q.lineup && getPlayerPosition(q.lineup, playerId) && getPlayerPosition(q.lineup, playerId) !== "Bench");
  let r5Margin = 0;
  r5Quarters.forEach(q => {
    const baseDiff = (q.score_for || 0) - (q.score_against || 0);
    const pTeam = getPlayerTeamInLineup(q.lineup, playerId);
    r5Margin += pTeam === "teamB" ? -baseDiff : baseDiff;
  });

  // 🇧🇷 Brazil: AP >= 30 in last 10 matches
  const recent10 = sortedMatches.slice(0, 10);
  if (recent10.length >= 10) {
    const r10Ids = new Set(recent10.map(m => m.id));
    const r10Goals = goalEvents.filter(g => r10Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal);
    const r10Assists = goalEvents.filter(g => r10Ids.has(g.match_id) && g.assist_player_id === playerId);
    const r10AP = r10Goals.length + r10Assists.length;
    if (r10AP >= 30) return { active: true, country: "🇧🇷 브라질", text: "브라질 삼바 축구급 폼! 최근 10경기 공포 30개 이상으로 팀을 지배 중입니다." };
  }

  // 🇫🇷 France: Assists >= 10
  if (r5Assists.length >= 10) return { active: true, country: "🇫🇷 프랑스", text: "프랑스 아트 사커의 재림! 최근 5경기 10도움 이상을 기록한 마에스트로입니다." };

  // ENG England: Court margin >= +10
  if (r5Margin >= 10) return { active: true, country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 잉글랜드", text: "잉글랜드 국대급 피지컬과 전술! 최근 5경기 마진 +10 이상의 승리 보증수표!" };

  // 🇰🇷 Korea: pressing/intercept AP >= 5
  const pressAP = goalEvents.filter(g => r5Ids.has(g.match_id) && !g.is_own_goal && (g.build_up_process === "압박" || g.build_up_process === "패스 차단") && (g.goal_player_id === playerId || g.assist_player_id === playerId)).length;
  if (pressAP >= 5) return { active: true, country: "🇰🇷 한국", text: "대한민국 국대급 꺾이지 않는 투혼! 미친 활동량과 압박으로 상대를 질식시킵니다." };

  // 🇪🇸 Spain: kill pass / pass play assists >= 5
  const passAssists = goalEvents.filter(g => r5Ids.has(g.match_id) && g.assist_player_id === playerId && (g.assist_type === "킬패스" || g.assist_type === "패스 플레이")).length;
  if (passAssists >= 5) return { active: true, country: "🇪🇸 스페인", text: "스페인 무적함대급 패스워크! 최근 5경기 무자비한 킬패스로 수비진을 붕괴시켰습니다." };

  // 🇩🇪 Germany: 15+ quarters in last 5 matches & quarter win rate >= 50%
  if (r5Quarters.length >= 15) {
    const qWins = r5Quarters.filter(q => (q.score_for || 0) > (q.score_against || 0)).length;
    if (qWins / r5Quarters.length >= 0.5) return { active: true, country: "🇩🇪 독일", text: "독일 전차군단의 냉혹함! 최근 출전 쿼터 승률 50% 이상의 무자비한 효율성!" };
  }

  // 🇮🇹 Italy: 8+ clean sheet quarters as DF/GK
  const csQuarters = r5Quarters.filter(q => {
    const pos = getPlayerPosition(q.lineup, playerId);
    return (pos === "DF" || pos === "GK") && (q.score_against || 0) === 0;
  }).length;
  if (csQuarters >= 8) return { active: true, country: "🇮🇹 이탈리아", text: "이탈리아의 카테나치오 강림! 최근 5경기 8번의 무실점 쿼터를 만들어낸 통곡의 벽!" };

  // 🇦🇷 Argentina: Data MOM 2+ times in last 5
  if (momVotes) {
    // Count MOM wins per match (most votes)
    let momCount = 0;
    recent5.forEach(m => {
      const mVotes = momVotes.filter(v => v.match_id === m.id);
      if (mVotes.length === 0) return;
      const voteCounts = new Map<number, number>();
      mVotes.forEach(v => voteCounts.set(v.voted_player_id, (voteCounts.get(v.voted_player_id) || 0) + 1));
      const sorted = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted[0][0] === playerId) momCount++;
    });
    if (momCount >= 2) return { active: true, country: "🇦🇷 아르헨티나", text: "아르헨티나 탱고 군단의 에이스! 최근 5경기 MOM 2회 선정으로 팀을 하드캐리!" };
  }

  // 🇳🇱 Netherlands: FW 8+ quarters & DF 8+ quarters, both margins +3
  const fwQ = r5Quarters.filter(q => getPlayerPosition(q.lineup, playerId) === "FW");
  const dfQ = r5Quarters.filter(q => getPlayerPosition(q.lineup, playerId) === "DF");
  if (fwQ.length >= 8 && dfQ.length >= 8) {
    const fwMargin = fwQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0);
    const dfMargin = dfQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0);
    if (fwMargin >= 3 && dfMargin >= 3) return { active: true, country: "🇳🇱 네덜란드", text: "네덜란드 토탈 사커의 교과서! 전후방 가리지 않고 필드 전역을 지배하는 멀티 플레이어!" };
  }

  return { active: false, country: "", text: "" };
}

const CHART_COLORS = ["hsl(330, 100%, 71%)", "hsl(210, 100%, 60%)", "hsl(150, 80%, 50%)", "hsl(45, 100%, 60%)", "hsl(280, 80%, 60%)", "hsl(0, 80%, 60%)", "hsl(180, 70%, 50%)"];

const PlayerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const playerId = Number(id);
  const { players, matches, venues, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const fireMap = useOnFirePlayers(matches, rosters);
  const fireInfo = fireMap.get(playerId);
  const fireTier: FireTier = fireInfo?.tier || "none";

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showWrapped, setShowWrapped] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "matches" | "stats">("profile");
  const [avatarOpen, setAvatarOpen] = useState(false);

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  const { data: worstVotes } = useQuery({
    queryKey: ["worst_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("worst_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  // Fetch ALL quarters for court stats
  const { data: allQuartersRaw } = useQuery({
    queryKey: ["all_match_quarters"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("match_quarters").select("*").order("quarter");
      return (data ?? []) as MatchQuarter[];
    },
  });
  const allQuarters = allQuartersRaw ?? [];

  const years = useMemo(() => getAvailableYears(matches), [matches]);

  const filtered = useMemo(() => {
    const fm = filterMatchesByMode(matches, filterMode, selectedYear);
    const fmIds = new Set(fm.map(m => m.id));
    return {
      matches: fm, matchIds: fmIds,
      rosters: rosters.filter(r => fmIds.has(r.match_id)),
      goalEvents: goalEvents.filter(g => fmIds.has(g.match_id)),
      teams: teams.filter(t => fmIds.has(t.match_id)),
      results: results.filter(r => fmIds.has(r.match_id)),
      quarters: allQuarters.filter(q => fmIds.has(q.match_id)),
    };
  }, [matches, teams, results, rosters, goalEvents, filterMode, selectedYear, allQuarters]);

  const handleFilterChange = (mode: FilterMode, year?: string) => {
    setFilterMode(mode);
    if (mode === "year") setSelectedYear(year || years[0] || "");
    else setSelectedYear("");
  };

  const playerMatchList = useMemo(() => {
    if (!playerId) return [];
    const playerMatchIds = [...new Set(filtered.rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
    return filtered.matches
      .filter(m => playerMatchIds.includes(m.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(m => {
      const mr = getMatchResult(teams, results, m.id);
        const mTeams = teams.filter(t => t.match_id === m.id);
        const { goals: g, assists: a } = computeMatchAP(playerId, m, rosters, goalEvents);
        
        // For custom matches, find the player's team and the opposing team
        let opponentName = "???";
        let playerResult: string | undefined = mr?.ourResult.result;
        if (m.is_custom) {
          const playerRoster = rosters.find(r => r.match_id === m.id && r.player_id === playerId);
          if (playerRoster) {
            const playerTeam = mTeams.find(t => t.id === playerRoster.team_id);
            const oppTeam = mTeams.find(t => t.id !== playerRoster.team_id);
            opponentName = oppTeam?.name || "자체전";
            const playerTeamResult = results.find(r => r.team_id === playerRoster.team_id && r.match_id === m.id);
            playerResult = playerTeamResult?.result;
          } else {
            opponentName = "자체전";
          }
        } else {
          const oppTeam = mTeams.find(t => !t.is_ours) || mTeams.find(t => t.name !== "버니즈");
          opponentName = oppTeam?.name || "???";
        }
        return { match: m, matchResult: mr, opponentName, goals: g, assists: a, playerResult };
      });
  }, [filtered.matches, filtered.rosters, playerId, teams, results, goalEvents, rosters]);

  const playerOpponentRecords = useMemo(() => {
    if (filterMode === "custom" || !playerId) return [];
    const playerMatchIds = new Set(filtered.rosters.filter(r => r.player_id === playerId).map(r => r.match_id));
    const playerMatches = filtered.matches.filter(m => playerMatchIds.has(m.id) && !m.is_custom);
    const playerTeams = filtered.teams.filter(t => playerMatches.some(m => m.id === t.match_id));
    const playerResults = filtered.results.filter(r => playerMatches.some(m => m.id === r.match_id));
    return getOpponentRecords(playerMatches, playerTeams, playerResults);
  }, [filtered, playerId, filterMode]);

  const goalTypeStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal && g.goal_type).forEach(g => {
      map.set(g.goal_type!, (map.get(g.goal_type!) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered.goalEvents, playerId]);

  const assistTypeStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.goalEvents.filter(g => g.assist_player_id === playerId && g.assist_type).forEach(g => {
      map.set(g.assist_type!, (map.get(g.assist_type!) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered.goalEvents, playerId]);

  // Court stats
  const courtStats = useMemo(() => {
    if (!playerId || filtered.quarters.length === 0) return null;
    const allMargins = computeAllCourtMargins(players, filtered.matches, filtered.quarters, filtered.goalEvents);
    return allMargins.find(p => p.playerId === playerId) || null;
  }, [playerId, players, filtered.matches, filtered.quarters, filtered.goalEvents]);

  const positionDist = useMemo(() => getPlayerPositionDistribution(playerId, filtered.quarters), [playerId, filtered.quarters]);
  const killerQuarter = useMemo(() => getKillerQuarter(playerId, filtered.goalEvents), [playerId, filtered.goalEvents]);
  const defenseCont = useMemo(() => getDefenseContribution(playerId, filtered.quarters), [playerId, filtered.quarters]);
  const ownGoalInducer = useMemo(() => getOwnGoalInducerCount(playerId, filtered.goalEvents, filtered.quarters), [playerId, filtered.goalEvents, filtered.quarters]);
  const soloVsTeam = useMemo(() => getSoloVsTeamGoals(playerId, filtered.goalEvents), [playerId, filtered.goalEvents]);
  const playerTraits = useMemo(() => computePlayerTraits(playerId, players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, filtered.quarters), [playerId, players, filtered]);

  if (isLoading) return <SplashScreen />;

  const player = players.find(p => p.id === playerId);
  if (!player) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">선수를 찾을 수 없습니다</div>;

  const stats = getPlayerStats(players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, playerId);
  const bestAP = getPlayerBestAPMatch(filtered.matches, filtered.rosters, filtered.goalEvents, playerId);
  const assistGiven = getPlayerAssistGiven(filtered.goalEvents, playerId, 7);
  const assistReceived = getPlayerAssistReceived(filtered.goalEvents, playerId, 7);
  const badges = getPlayerBadges(playerId, players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, momVotes);
  const varianceBadges = getVarianceBadge(playerId, filtered.matches, filtered.rosters, filtered.goalEvents, filtered.quarters);
  const allBadges = [...badges, ...varianceBadges];

  const winFairyAll = getWinFairyData(players, filtered.matches, filtered.teams, filtered.results, filtered.rosters);
  const myFairy = winFairyAll.find(d => d.playerId === playerId);

  const formGuide = getPlayerFormGuide(playerId, filtered.matches, filtered.rosters, filtered.goalEvents);
  const scoutingReport = getDeepScoutingReport(playerId, players, filtered.matches, filtered.teams, filtered.results, filtered.rosters, filtered.goalEvents, momVotes);
  const tier = getPlayerTier(playerId, matches, rosters, goalEvents, momVotes, worstVotes, allQuarters);
  const goalsPerGame = stats.appearances > 0 ? (stats.goals / stats.appearances).toFixed(2) : "0";
  const bestAPResult = bestAP ? getMatchResult(teams, results, bestAP.matchId) : null;

  const concacafInfo = getConcacafMode(playerId, matches, rosters, goalEvents, allQuarters, momVotes, players);
  const isConcacaf = concacafInfo.active;

  const playerDuos = new Map<number, number>();
  filtered.goalEvents.forEach(g => {
    if (g.goal_player_id === playerId && g.assist_player_id) playerDuos.set(g.assist_player_id, (playerDuos.get(g.assist_player_id) || 0) + 1);
    if (g.assist_player_id === playerId && g.goal_player_id) playerDuos.set(g.goal_player_id, (playerDuos.get(g.goal_player_id) || 0) + 1);
  });
  const topDuos = [...playerDuos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);

  const bestOpponent = playerOpponentRecords.filter(r => r.matches >= 2).sort((a, b) => b.goalsFor - a.goalsFor || b.winRate - a.winRate)[0];
  const worstOpponent = playerOpponentRecords.filter(r => r.matches >= 2).sort((a, b) => a.winRate - b.winRate)[0];

  const trendIcon = scoutingReport.trend === "up" ? <TrendingUp size={16} className="text-primary" />
    : scoutingReport.trend === "down" ? <TrendingDown size={16} className="text-destructive" />
    : scoutingReport.trend === "special" ? <Sparkles size={16} className="text-primary" />
    : <Minus size={16} className="text-muted-foreground" />;

  const filterLabel = filterMode === "all" ? "종합" : filterMode === "year" ? `${selectedYear}시즌` : "자체전";

  const tooltipStyle = { backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(330 100% 71% / 0.3)", borderRadius: "8px", color: "hsl(0 0% 95%)", fontSize: "11px" };

  // Donut chart data
  const goalTypeChartData = goalTypeStats.slice(0, 6).map(([name, value]) => ({ name, value }));
  const assistTypeChartData = assistTypeStats.slice(0, 6).map(([name, value]) => ({ name, value }));
  const soloTeamData = soloVsTeam.total > 0 ? [
    { name: "솔로 골", value: soloVsTeam.solo },
    { name: "팀 어시스트 골", value: soloVsTeam.team },
  ] : [];

  const PartnerList = ({ title, data, subLabel }: { title: string; data: { partnerId: number; count: number }[]; subLabel: string }) => (
    data.length > 0 ? (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-4 mt-4">
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

  return (
    <div className={`pb-20 ${isConcacaf ? "concacaf-bg" : ""}`}>
      <AvatarModal imageUrl={player.profile_image_url} name={player.name} open={avatarOpen} onClose={() => setAvatarOpen(false)} />

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft size={24} /></button>
          <h1 className="font-display text-xl tracking-wider text-primary text-glow">PLAYER PROFILE</h1>
        </div>
      </div>

      {/* Profile Header Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`mx-4 mt-4 rounded-xl border overflow-hidden ${
          isConcacaf ? "border-emerald-500/50 bg-gradient-to-br from-emerald-900/30 via-card to-blue-900/20"
          : fireTier === "golden" ? "golden-fire-card border-yellow-500/50"
          : fireTier === "red" ? "on-fire-card border-orange-500/50"
          : fireTier === "blue" ? "blue-fire-card border-blue-400/50"
          : "border-primary/30 bg-card box-glow"
        }`}
      >
        <div className={`relative p-6 ${
          isConcacaf ? "" : fireTier === "golden" ? "bg-gradient-to-br from-yellow-900/30 via-transparent to-amber-900/20"
          : fireTier === "red" ? "bg-gradient-to-br from-orange-900/30 via-transparent to-red-900/20"
          : fireTier === "blue" ? "bg-gradient-to-br from-blue-900/30 via-transparent to-cyan-900/20"
          : "bg-gradient-to-br from-primary/20 via-card to-card"
        }`}>
          {player.back_number !== null && player.back_number !== undefined && (
            <div className="absolute top-2 right-4 font-display text-[80px] leading-none text-primary/10 select-none pointer-events-none">{player.back_number}</div>
          )}
          {fireTier !== "none" && (
            <>
              <span className="fire-particle fire-particle-1" style={{ top: '10px', right: '20px' }}>{fireTier === "golden" ? "👑" : fireTier === "red" ? "🔥" : "💎"}</span>
              <span className="fire-particle fire-particle-2" style={{ top: '30px', left: '15px' }}>✨</span>
              <span className="fire-particle fire-particle-1" style={{ bottom: '15px', right: '40px' }}>{fireTier === "golden" ? "⭐" : fireTier === "red" ? "🔥" : "💎"}</span>
            </>
          )}
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative flex-shrink-0 cursor-pointer" onClick={() => player.profile_image_url && setAvatarOpen(true)}>
              <div className={`h-24 w-24 overflow-hidden rounded-2xl border-2 bg-secondary shadow-lg ${
                fireTier === "golden" ? "golden-fire-ring shadow-yellow-500/30"
                : fireTier === "red" ? "on-fire-ring shadow-orange-500/30"
                : fireTier === "blue" ? "blue-fire-ring shadow-blue-500/30"
                : "border-primary/50 shadow-primary/20"
              }`}>
                {player.profile_image_url ? (
                  <img src={player.profile_image_url} alt={player.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><User size={44} className="text-primary/60" /></div>
                )}
              </div>
              {player.back_number !== null && player.back_number !== undefined && (
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-lg gradient-pink text-sm font-bold text-primary-foreground shadow-md">{player.back_number}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground">{player.name}</h2>
                {fireTier !== "none" && <span className="text-lg sparkle-anim">{fireTier === "golden" ? "👑" : fireTier === "red" ? "🔥" : "💎"}</span>}
                <PlayerTierBadge tier={tier} size="md" />
              </div>
              {isConcacaf && (
                <div className="mt-1 space-y-1">
                  <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 sparkle-anim">🏆 북중미모드 — {concacafInfo.country} 🏆</div>
                  <p className="text-[10px] text-emerald-400/80 leading-snug">{concacafInfo.text}</p>
                </div>
              )}
              {fireTier !== "none" && (
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold sparkle-anim ${
                  fireTier === "golden" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : fireTier === "red" ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                  : "border-blue-400/40 bg-blue-400/10 text-blue-400"
                }`}>
                  {fireTier === "golden" ? "👑 LEGENDARY — " : fireTier === "red" ? "🔥 ON FIRE — " : "💎 HEATING UP — "}{fireInfo?.streak}연속 출석!
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">가입일: {player.join_date}{player.is_active && <span className="ml-2 text-primary">● ACTIVE</span>}</p>
            </div>
          </div>
        </div>
        {allBadges.length > 0 && (
          <div className="px-6 pb-4 pt-2 flex flex-wrap gap-1.5">
            {allBadges.map((badge, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                badge.emoji === "🚨" ? "border-destructive/40 bg-destructive/10 text-destructive"
                : badge.emoji === "🛡️" ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-primary/40 bg-primary/10 text-primary"
              }`}><span>{badge.emoji}</span><span>{badge.label}</span></span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Summary stats bar */}
      <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
        {[
          { label: "골", value: stats.goals },
          { label: "도움", value: stats.assists },
          { label: "AP", value: stats.attackPoints },
          { label: "G/경기", value: goalsPerGame },
          { label: "출전", value: stats.appearances },
          { label: "승률", value: `${stats.winRate}%` },
          { label: "+/-", value: courtStats ? (courtStats.margin > 0 ? `+${courtStats.margin}` : `${courtStats.margin}`) : "-" },
          { label: "PPQ", value: courtStats ? courtStats.ppq.toFixed(2) : "-" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-2 text-center">
            <div className={`font-display text-lg ${s.label === "+/-" ? (courtStats && courtStats.margin > 0 ? "text-green-400" : courtStats && courtStats.margin < 0 ? "text-red-400" : "text-foreground") : "text-primary text-glow"}`}>{s.value}</div>
            <div className="text-[9px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 3-Tab System */}
      <div className="mx-4 mt-4">
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          {(["profile", "matches", "stats"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeTab === tab ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab === "profile" ? "👤 프로필" : tab === "matches" ? "⚽ 경기" : "📊 통계"}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === "matches" || activeTab === "stats") && (
        <PlayerFilterTabs filterMode={filterMode} selectedYear={selectedYear} years={years} onFilterChange={handleFilterChange} />
      )}

      {filterMode !== "all" && (activeTab === "matches" || activeTab === "stats") && (
        <div className="mx-4 mt-2 text-center text-[11px] text-primary font-bold">📊 {filterLabel} 기준 데이터</div>
      )}

      {/* ===== PROFILE TAB ===== */}
      {activeTab === "profile" && (
        <div className="mx-4">
          {/* FC Online Traits */}
          {playerTraits.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-primary/30 bg-card p-4">
              <h3 className="mb-3 font-display text-lg text-primary flex items-center gap-2">🎮 선수 고유 특성</h3>
              <div className="flex flex-wrap gap-2">
                {playerTraits.map((t, i) => (
                  <div key={i} className={`group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${
                    t.color === "red" ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : t.color === "yellow" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                    : "border-green-500/40 bg-green-500/10 text-green-400"
                  }`}>
                    <span>{t.emoji}</span>
                    <span>{t.name}</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 rounded-lg border border-border bg-background p-2 text-[10px] text-muted-foreground shadow-xl z-50">
                      {t.description}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Scouting Report - Position Based */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-primary/40 bg-background p-5 shadow-lg shadow-primary/5">
            <h3 className="mb-3 font-display text-lg tracking-wide text-primary text-glow flex items-center gap-2">{trendIcon} 수석코치 AI 스카우팅 리포트</h3>
            <div className="flex items-start gap-4 rounded-lg bg-secondary/30 border border-primary/20 p-4">
              <span className="text-4xl drop-shadow-lg">{scoutingReport.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-primary text-glow mb-1.5">{scoutingReport.label}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{scoutingReport.comment}</p>
              </div>
            </div>
            {/* Position-based 3-line report */}
            {positionDist.total >= 5 && (
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                {(() => {
                  const fwQ = filtered.quarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "FW");
                  const dfQ = filtered.quarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "DF");
                  const fwWinRate = fwQ.length >= 3 ? Math.round(fwQ.filter(q => (q.score_for || 0) > (q.score_against || 0)).length / fwQ.length * 100) : null;
                  const dfWinRate = dfQ.length >= 3 ? Math.round(dfQ.filter(q => (q.score_for || 0) > (q.score_against || 0)).length / dfQ.length * 100) : null;
                  const fwMargin = fwQ.length >= 3 ? fwQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0) / fwQ.length : 0;
                  const dfMargin = dfQ.length >= 3 ? dfQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0) / dfQ.length : 0;
                  
                  // Line 1: Best/Worst position
                  let posLine = "";
                  if (fwWinRate !== null && dfWinRate !== null) {
                    if (fwMargin > dfMargin && fwMargin > 0.3) posLine = "📋 전방 배치 권장 — FW 출전 시 팀 성적이 돋보입니다.";
                    else if (dfMargin > fwMargin && dfMargin > 0.3) posLine = "📋 후방 수비/빌드업 핵심 — DF 배치 시 안정감이 극대화됩니다.";
                    else if (fwMargin > 0 && dfMargin > 0) posLine = "📋 완벽한 헥사곤 멀티 플레이어 — 어디를 서도 팀에 기여합니다.";
                    else posLine = `📋 FW 승률 ${fwWinRate}% / DF 승률 ${dfWinRate}% — 포지션 최적화가 필요합니다.`;
                  }
                  
                  // Line 2: Playstyle
                  const totalGoals = goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal).length;
                  const totalAssists = goalEvents.filter(g => g.assist_player_id === playerId).length;
                  const pocherGoals = goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal && (g.goal_type === "주워먹기" || g.goal_type === "골문 앞 혼전골" || g.goal_type === "골문앞혼전")).length;
                  const counterGoals = goalEvents.filter(g => g.goal_player_id === playerId && !g.is_own_goal && (g.build_up_process === "역습" || g.goal_type === "드리블골")).length;
                  let styleLine = "";
                  if (totalGoals > 0 && totalAssists > totalGoals) styleLine = "⚽ 이타적 폴스 나인(False 9) — 골보다 동료 살리기에 능한 플레이메이커.";
                  else if (totalGoals > 0 && pocherGoals / totalGoals >= 0.5) styleLine = "⚽ 타겟맨/포쳐 — 골문 앞 혼전과 주워먹기에 특화된 스트라이커.";
                  else if (counterGoals >= 3) styleLine = "⚽ 역습의 선봉장 — 빠른 전환 공격의 마무리를 책임지는 스피드스터.";
                  else if (totalGoals >= 3) styleLine = `⚽ 균형잡힌 스트라이커 — ${totalGoals}골 ${totalAssists}도움의 만능형 공격수.`;
                  else styleLine = "⚽ 아직 충분한 득점 데이터가 쌓이지 않았습니다.";
                  
                  // Line 3: Synergy partner
                  let synergyLine = "";
                  if (topDuos.length > 0) {
                    const [topPartnerId, topCount] = topDuos[0];
                    synergyLine = `🤝 베스트 시너지: ${getPlayerName(players, topPartnerId)} (${topCount}회 합작)`;
                  }
                  
                  return (
                    <>
                      {posLine && <p>{posLine}</p>}
                      {styleLine && <p>{styleLine}</p>}
                      {synergyLine && <p>{synergyLine}</p>}
                    </>
                  );
                })()}
              </div>
            )}
          </motion.div>

          {/* W/D/L */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-display text-lg text-primary">전체 전적 요약</h3>
            <div className="flex justify-around">
              <div className="text-center"><div className="font-display text-2xl text-primary text-glow">{stats.wins}</div><div className="text-xs text-muted-foreground">승</div></div>
              <div className="text-center"><div className="font-display text-2xl text-foreground">{stats.draws}</div><div className="text-xs text-muted-foreground">무</div></div>
              <div className="text-center"><div className="font-display text-2xl text-muted-foreground">{stats.losses}</div><div className="text-xs text-muted-foreground">패</div></div>
            </div>
          </motion.div>

          {/* Win Fairy */}
          {myFairy && filterMode !== "custom" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
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

          <ActivityHeatmap playerId={playerId} matches={matches} rosters={rosters} goalEvents={goalEvents} momVotes={momVotes}
            year={filterMode === "year" && selectedYear ? parseInt(selectedYear) : undefined} />

          <PlayerComments playerId={playerId} />

          {filterMode === "year" && selectedYear && parseInt(selectedYear) < new Date().getFullYear() && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <button onClick={() => setShowWrapped(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/60">
                <Gift size={18} /> {selectedYear} 시즌 결산 카드 만들기
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* ===== MATCHES TAB ===== */}
      {activeTab === "matches" && (
        <div className="mx-4 mt-4 space-y-2">
          {playerMatchList.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">출전 기록이 없습니다</p>}
          {playerMatchList.map(({ match: m, matchResult: mr, opponentName, goals, assists, playerResult }) => {
            const resultStr = m.is_custom ? playerResult : mr?.ourResult.result;
            const bgColor = resultStr === "승" ? "border-blue-500/30 bg-blue-500/5" : resultStr === "패" ? "border-red-500/30 bg-red-500/5" : resultStr === "무" ? "border-muted bg-muted/5" : "border-border bg-card";
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate(`/match/${m.id}`)}
                className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-secondary/50 ${bgColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        resultStr === "승" ? "bg-blue-500/20 text-blue-400" : resultStr === "패" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                      }`}>{resultStr || "예정"}</span>
                      <span className="text-sm font-medium text-foreground">vs {opponentName}</span>
                      {m.is_custom && <span className="text-[10px] text-primary">자체전</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{m.date}</span>
                      {mr && <span>{mr.ourResult.score_for ?? "-"} : {mr.ourResult.score_against ?? "-"}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {goals > 0 && <span className="text-sm font-bold text-primary">⚽{goals}</span>}
                      {assists > 0 && <span className="text-sm font-bold text-muted-foreground">🅰️{assists}</span>}
                      {goals === 0 && assists === 0 && <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                    {(goals + assists) > 0 && <div className="text-[10px] text-primary">{goals + assists} AP</div>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===== STATS TAB ===== */}
      {activeTab === "stats" && (
        <div className="mx-4">
          {/* Best Match */}
          {bestAP && bestAP.ap > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-primary/30 bg-card p-4 box-glow">
              <h3 className="mb-3 font-display text-lg text-primary flex items-center gap-2"><Trophy size={18} /> BEST MATCH</h3>
              <div onClick={() => navigate(`/match/${bestAP.matchId}`)} className="cursor-pointer rounded-md bg-secondary/50 p-3 transition-colors hover:bg-secondary">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{bestAP.date}</div>
                    {bestAPResult && <div className="mt-1 text-sm text-foreground">vs {bestAPResult.opponentTeam.name} <span className={`ml-2 text-xs font-bold ${bestAPResult.ourResult.result === "승" ? "text-primary" : "text-muted-foreground"}`}>{bestAPResult.ourResult.result}</span></div>}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-primary text-glow">{bestAP.ap}AP</div>
                    <div className="text-xs text-muted-foreground">{bestAP.goals}골 {bestAP.assists}어시</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Killer Quarter & Position */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {killerQuarter && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-primary/30 bg-card p-3 text-center">
                <div className="text-xs font-bold text-primary mb-1">⚡ 킬러 쿼터</div>
                <div className="font-display text-3xl text-primary text-glow">{killerQuarter.quarter}Q</div>
                <div className="text-[10px] text-muted-foreground">{killerQuarter.ap} AP 기록</div>
              </motion.div>
            )}
            {positionDist.total > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs font-bold text-primary mb-2">📍 포지션 분포</div>
              <div className="space-y-1">
                  {(["GK", "DF", "MF", "FW"] as const).filter(pos => positionDist[pos] > 0).sort((a, b) => positionDist[b] - positionDist[a]).map(pos => (
                    <div key={pos} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground font-medium">{pos}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full gradient-pink rounded-full" style={{ width: `${(positionDist[pos] / positionDist.total) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground w-8 text-right">{positionDist[pos]}Q</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Defense Contribution */}
          {defenseCont.quartersWithPlayer >= 5 && defenseCont.quartersWithoutPlayer >= 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-display text-sm text-primary flex items-center gap-2">🛡️ 수비 기여도</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">투입 시 실점</div>
                  <div className="font-display text-lg text-foreground">{defenseCont.withPlayer.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">미투입 시 실점</div>
                  <div className="font-display text-lg text-foreground">{defenseCont.withoutPlayer.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">차이</div>
                  <div className={`font-display text-lg ${defenseCont.diff < 0 ? "text-green-400" : defenseCont.diff > 0 ? "text-red-400" : "text-foreground"}`}>
                    {defenseCont.diff > 0 ? "+" : ""}{defenseCont.diff.toFixed(2)}
                  </div>
                </div>
              </div>
              {ownGoalInducer > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground text-center">💥 자책골 유발 기여: {ownGoalInducer}회 (상대 자책골 시 필드 위)</div>
              )}
            </motion.div>
          )}

          {/* Scoring Arsenal & Playmaking Style - Donut Charts */}
          {(goalTypeStats.length > 0 || assistTypeStats.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 font-display text-lg text-primary">🎯 시그니처 무기</h3>
              <div className="grid grid-cols-2 gap-4">
                {goalTypeStats.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground mb-2 text-center">⚽ 득점 루트 TOP 5</h4>
                    <div className="space-y-1.5">
                      {goalTypeStats.slice(0, 5).map(([name, value], i) => {
                        const total = goalTypeStats.reduce((s, [, v]) => s + v, 0);
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                        return (
                          <div key={name} className="flex items-center gap-2 text-[11px]">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                            <span className="text-foreground truncate flex-1">{name}</span>
                            <span className="text-primary font-bold">{value}</span>
                            <span className="text-muted-foreground text-[9px]">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {assistTypeStats.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground mb-2 text-center">🅰️ 어시스트 취향 TOP 5</h4>
                    <div className="space-y-1.5">
                      {assistTypeStats.slice(0, 5).map(([name, value], i) => {
                        const total = assistTypeStats.reduce((s, [, v]) => s + v, 0);
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                        return (
                          <div key={name} className="flex items-center gap-2 text-[11px]">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                            <span className="text-foreground truncate flex-1">{name}</span>
                            <span className="text-primary font-bold">{value}</span>
                            <span className="text-muted-foreground text-[9px]">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Solo vs Team Goals */}
          {soloTeamData.length > 0 && soloVsTeam.total >= 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-display text-sm text-primary">🎯 골 의존도 (Solo vs Team)</h3>
              <ResponsiveContainer width="100%" height={50}>
                <BarChart data={[{ solo: soloVsTeam.solo, team: soloVsTeam.team }]} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Bar dataKey="solo" stackId="a" fill="hsl(330, 100%, 71%)" name="솔로 골" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="team" stackId="a" fill="hsl(210, 100%, 60%)" name="팀 어시스트 골" radius={[0, 4, 4, 0]} />
                  <Tooltip contentStyle={tooltipStyle} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>솔로 {soloVsTeam.solo}골 ({soloVsTeam.total > 0 ? Math.round(soloVsTeam.solo / soloVsTeam.total * 100) : 0}%)</span>
                <span>팀 {soloVsTeam.team}골 ({soloVsTeam.total > 0 ? Math.round(soloVsTeam.team / soloVsTeam.total * 100) : 0}%)</span>
              </div>
            </motion.div>
          )}

          {/* Best Partners */}
          {topDuos.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
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

          {/* Position Win Rate Comparison */}
          {positionDist.total >= 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 font-display text-sm text-primary flex items-center gap-2">📊 포지션별 팀 승률</h3>
              <div className="space-y-2">
                {(["FW", "DF", "GK", "MF"] as const).map(pos => {
                  const posQ = filtered.quarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === pos);
                  if (posQ.length < 2) return null;
                  const wins = posQ.filter(q => (q.score_for || 0) > (q.score_against || 0)).length;
                  const winRate = Math.round((wins / posQ.length) * 100);
                  const avgMargin = posQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0) / posQ.length;
                  return (
                    <div key={pos} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary w-6">{pos}</span>
                        <span className="text-[10px] text-muted-foreground">{posQ.length}Q</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full gradient-pink rounded-full" style={{ width: `${winRate}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${winRate >= 50 ? "text-primary" : "text-muted-foreground"}`}>{winRate}%</span>
                        <span className={`text-[10px] font-mono ${avgMargin > 0 ? "text-green-400" : avgMargin < 0 ? "text-red-400" : "text-foreground"}`}>
                          {avgMargin > 0 ? "+" : ""}{avgMargin.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </motion.div>
          )}

          {/* Attacking Contribution */}
          {courtStats && courtStats.quartersPlayed >= 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-display text-sm text-primary flex items-center gap-2">⚔️ 공격 기여도</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">팀 득점 관여율</div>
                  <div className="font-display text-lg text-primary">{(() => {
                    const playerQIds = new Set<string>();
                    filtered.quarters.forEach(q => {
                      if (!q.lineup) return;
                      const field = [...(q.lineup?.GK || []), ...(q.lineup?.DF || []), ...(q.lineup?.MF || []), ...(q.lineup?.FW || [])];
                      if (field.includes(playerId)) playerQIds.add(`${q.match_id}-${q.quarter}`);
                    });
                    let teamGoals = 0;
                    filtered.quarters.forEach(q => { if (playerQIds.has(`${q.match_id}-${q.quarter}`)) teamGoals += (q.score_for || 0); });
                    return teamGoals > 0 ? `${Math.round((courtStats.ap / teamGoals) * 100)}%` : "-";
                  })()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">FW 출전 시 마진</div>
                  <div className={`font-display text-lg ${(() => {
                    const fwQ = filtered.quarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "FW");
                    const avg = fwQ.length > 0 ? fwQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0) / fwQ.length : 0;
                    return avg > 0 ? "text-green-400" : avg < 0 ? "text-red-400" : "text-foreground";
                  })()}`}>{(() => {
                    const fwQ = filtered.quarters.filter(q => q.lineup && getPlayerPosition(q.lineup, playerId) === "FW");
                    if (fwQ.length === 0) return "-";
                    const avg = fwQ.reduce((s, q) => s + (q.score_for || 0) - (q.score_against || 0), 0) / fwQ.length;
                    return avg > 0 ? `+${avg.toFixed(2)}` : avg.toFixed(2);
                  })()}</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {showWrapped && filterMode === "year" && selectedYear && (
        <SeasonWrapped player={player} year={selectedYear} stats={stats} scoutingReport={scoutingReport} tierLabel={tier.label} tierEmoji={tier.emoji} onClose={() => setShowWrapped(false)} />
      )}
    </div>
  );
};

export default PlayerDetailPage;
