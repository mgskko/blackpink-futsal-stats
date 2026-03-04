import type { Player, Match, Roster, GoalEvent } from "@/hooks/useFutsalData";

export type TierLevel = "worldclass" | "pro" | "semipro" | "amateur" | "casual";

export interface TierInfo {
  level: TierLevel;
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  score: number;
}

const TIER_DEFS: Record<TierLevel, Omit<TierInfo, "score" | "level">> = {
  worldclass: { label: "월드클래스", emoji: "🏆", colorClass: "text-yellow-400", bgClass: "bg-yellow-500/20", borderClass: "border-yellow-500/50" },
  pro:        { label: "프로", emoji: "💎", colorClass: "text-blue-400", bgClass: "bg-blue-500/20", borderClass: "border-blue-500/50" },
  semipro:    { label: "세미프로", emoji: "🥇", colorClass: "text-primary", bgClass: "bg-primary/20", borderClass: "border-primary/50" },
  amateur:    { label: "아마추어", emoji: "🥈", colorClass: "text-muted-foreground", bgClass: "bg-secondary", borderClass: "border-border" },
  casual:     { label: "동네축구인", emoji: "🥉", colorClass: "text-muted-foreground", bgClass: "bg-secondary/50", borderClass: "border-border" },
};

export function getPlayerTier(
  playerId: number,
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  momVotes?: { match_id: number; voted_player_id: number }[]
): TierInfo {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));
  const recent10 = sortedMatches.slice(0, 10);
  
  if (recent10.length < 3) {
    return { level: "casual", score: 0, ...TIER_DEFS.casual };
  }

  // Attendance: what % of recent 10 team matches did they attend?
  const allRecentMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const attendedRecent = allRecentMatches.filter(m => playerMatchIds.includes(m.id)).length;
  const attendanceRate = attendedRecent / allRecentMatches.length;

  // Performance in recent 10
  const r10Ids = new Set(recent10.map(m => m.id));
  const goals = goalEvents.filter(g => r10Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal).length
    + rosters.filter(r => r10Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.goals || 0), 0);
  const assists = goalEvents.filter(g => r10Ids.has(g.match_id) && g.assist_player_id === playerId).length
    + rosters.filter(r => r10Ids.has(r.match_id) && r.player_id === playerId).reduce((s, r) => s + (r.assists || 0), 0);
  
  const momCount = momVotes 
    ? momVotes.filter(v => r10Ids.has(v.match_id) && v.voted_player_id === playerId).length 
    : 0;

  const performanceScore = (goals * 3 + assists * 2 + momCount * 5) / recent10.length;
  const totalScore = (performanceScore * 0.6 + attendanceRate * 100 * 0.4);

  let level: TierLevel;
  if (totalScore >= 65) level = "worldclass";
  else if (totalScore >= 48) level = "pro";
  else if (totalScore >= 32) level = "semipro";
  else if (totalScore >= 18) level = "amateur";
  else level = "casual";

  return { level, score: Math.round(totalScore), ...TIER_DEFS[level] };
}

interface PlayerTierBadgeProps {
  tier: TierInfo;
  size?: "sm" | "md";
}

const PlayerTierBadge = ({ tier, size = "sm" }: PlayerTierBadgeProps) => {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tier.bgClass} ${tier.borderClass} ${tier.colorClass}`}>
      <span>{tier.emoji}</span>
      <span>{tier.label}</span>
      {size === "md" && <span className="opacity-60">({tier.score}pt)</span>}
    </span>
  );
};

export default PlayerTierBadge;
