import type { Player, Match, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerPosition } from "@/hooks/useCourtStats";

export type TierLevel = "worldclass" | "nationalAce" | "semipro" | "k5" | "amateur1" | "amateur3" | "morning" | "casual";

export interface TierInfo {
  level: TierLevel;
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  score: number;
}

export const TIER_CONFIG: Record<TierLevel, Omit<TierInfo, "score" | "level">> = {
  worldclass:  { label: "월드클래스",       emoji: "🏆", colorClass: "text-yellow-400", bgClass: "bg-yellow-500/20", borderClass: "border-yellow-500/50" },
  nationalAce: { label: "국대급 에이스",    emoji: "🌟", colorClass: "text-amber-400",  bgClass: "bg-amber-500/20",  borderClass: "border-amber-500/50" },
  semipro:     { label: "세미프로",          emoji: "💎", colorClass: "text-blue-400",   bgClass: "bg-blue-500/20",   borderClass: "border-blue-500/50" },
  k5:          { label: "K5 리거",           emoji: "🥇", colorClass: "text-primary",    bgClass: "bg-primary/20",    borderClass: "border-primary/50" },
  amateur1:    { label: "아마추어 1부",      emoji: "🥈", colorClass: "text-cyan-400",   bgClass: "bg-cyan-500/20",   borderClass: "border-cyan-500/50" },
  amateur3:    { label: "아마추어 3부",      emoji: "🥉", colorClass: "text-muted-foreground", bgClass: "bg-secondary",     borderClass: "border-border" },
  morning:     { label: "조기축구",          emoji: "☀️", colorClass: "text-muted-foreground", bgClass: "bg-secondary/50",  borderClass: "border-border" },
  casual:      { label: "동네축구",          emoji: "⚽", colorClass: "text-muted-foreground", bgClass: "bg-secondary/30",  borderClass: "border-border" },
};

const TIER_DEFS = TIER_CONFIG;

export function getPlayerTier(
  playerId: number,
  matches: Match[],
  rosters: Roster[],
  goalEvents: GoalEvent[],
  momVotes?: { match_id: number; voted_player_id: number }[],
  worstVotes?: { match_id: number; voted_player_id: number }[],
  allQuarters?: MatchQuarter[]
): TierInfo {
  const playerMatchIds = [...new Set(rosters.filter(r => r.player_id === playerId).map(r => r.match_id))];
  const sortedMatches = matches.filter(m => playerMatchIds.includes(m.id)).sort((a, b) => b.date.localeCompare(a.date));

  if (sortedMatches.length < 3) {
    return { level: "casual", score: 0, ...TIER_DEFS.casual };
  }

  let score = 0;

  // 1. Attendance: +1 per match appearance
  score += playerMatchIds.length;

  // 2. FW AP: +3 per AP when playing FW
  if (allQuarters) {
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const pos = getPlayerPosition(q.lineup, playerId);
      if (pos === "FW") {
        const qGoals = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.goal_player_id === playerId && !g.is_own_goal).length;
        const qAssists = goalEvents.filter(g => g.match_id === q.match_id && g.quarter === q.quarter && g.assist_player_id === playerId).length;
        score += (qGoals + qAssists) * 3;
      }
      // DF/GK clean sheet: +3 per clean sheet quarter
      if (pos === "DF" || pos === "GK") {
        if ((q.score_against || 0) === 0) score += 3;
      }
    });
  } else {
    // Fallback: simple AP scoring
    const recent10 = sortedMatches.slice(0, 10);
    const r10Ids = new Set(recent10.map(m => m.id));
    const goals = goalEvents.filter(g => r10Ids.has(g.match_id) && g.goal_player_id === playerId && !g.is_own_goal).length;
    const assists = goalEvents.filter(g => r10Ids.has(g.match_id) && g.assist_player_id === playerId).length;
    score += (goals * 3 + assists * 2);
  }

  // 3. MOM: +5 per MOM selection
  if (momVotes) {
    const momCount = momVotes.filter(v => v.voted_player_id === playerId).length;
    score += momCount * 5;
  }

  // 4. Worst: -3 per worst vote
  if (worstVotes) {
    const worstCount = worstVotes.filter(v => v.voted_player_id === playerId).length;
    score -= worstCount * 3;
  }

  let level: TierLevel;
  if (score >= 200) level = "worldclass";
  else if (score >= 150) level = "nationalAce";
  else if (score >= 110) level = "semipro";
  else if (score >= 80) level = "k5";
  else if (score >= 55) level = "amateur1";
  else if (score >= 35) level = "amateur3";
  else if (score >= 18) level = "morning";
  else level = "casual";

  return { level, score: Math.round(score), ...TIER_DEFS[level] };
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
