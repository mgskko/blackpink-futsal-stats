import { useMemo } from "react";
import type { Match, Roster } from "@/hooks/useFutsalData";

export type FireTier = "none" | "warming" | "heating" | "onfire" | "legendary" | "godmode";

export interface FireInfo {
  tier: FireTier;
  streak: number;
}

export function getFireTier(streak: number): FireTier {
  if (streak >= 30) return "godmode";
  if (streak >= 10) return "legendary";
  if (streak >= 7) return "onfire";
  if (streak >= 5) return "heating";
  if (streak >= 3) return "warming";
  return "none";
}

export const FIRE_TIER_CONFIG: Record<Exclude<FireTier, "none">, {
  label: string;
  emoji: string;
  borderClass: string;
  cardClass: string;
  ringClass: string;
  textClass: string;
  bgClass: string;
}> = {
  warming: {
    label: "WARMING UP",
    emoji: "🟡",
    borderClass: "border-yellow-400/50",
    cardClass: "warming-fire-card",
    ringClass: "warming-fire-ring",
    textClass: "text-yellow-400",
    bgClass: "border-yellow-400/40 bg-yellow-400/10",
  },
  heating: {
    label: "HEATING UP",
    emoji: "💎",
    borderClass: "border-blue-400/50",
    cardClass: "blue-fire-card",
    ringClass: "blue-fire-ring",
    textClass: "text-blue-400",
    bgClass: "border-blue-400/40 bg-blue-400/10",
  },
  onfire: {
    label: "ON FIRE",
    emoji: "🔥",
    borderClass: "border-orange-500/50",
    cardClass: "on-fire-card",
    ringClass: "on-fire-ring",
    textClass: "text-orange-400",
    bgClass: "border-orange-500/40 bg-orange-500/10",
  },
  legendary: {
    label: "LEGENDARY",
    emoji: "👑",
    borderClass: "border-purple-500/50",
    cardClass: "legendary-fire-card",
    ringClass: "legendary-fire-ring",
    textClass: "text-purple-400",
    bgClass: "border-purple-500/40 bg-purple-500/10",
  },
  godmode: {
    label: "GOD MODE",
    emoji: "💫",
    borderClass: "border-cyan-300/50",
    cardClass: "godmode-fire-card",
    ringClass: "godmode-fire-ring",
    textClass: "text-cyan-300",
    bgClass: "border-cyan-300/40 bg-cyan-300/10",
  },
};

export function useOnFirePlayers(matches: Match[], rosters?: Roster[]) {
  const fireMap = useMemo(() => {
    const map = new Map<number, FireInfo>();
    if (!rosters || rosters.length === 0 || matches.length === 0) return map;

    // Only consider matches that actually have rosters (completed matches)
    const matchIdsWithRosters = new Set(rosters.map(r => r.match_id));
    const sorted = [...matches]
      .filter(m => matchIdsWithRosters.has(m.id))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) return map;

    // Get all unique player IDs from rosters
    const allPlayerIds = new Set(rosters.map(r => r.player_id));

    allPlayerIds.forEach(playerId => {
      let streak = 0;
      for (const match of sorted) {
        const inRoster = rosters.some(r => r.match_id === match.id && r.player_id === playerId);
        if (inRoster) {
          streak++;
        } else {
          break; // streak broken
        }
      }
      const tier = getFireTier(streak);
      if (tier !== "none") {
        map.set(playerId, { tier, streak });
      }
    });

    return map;
  }, [matches, rosters]);

  return fireMap;
}
