import { useMemo } from "react";
import type { Match, Roster } from "@/hooks/useFutsalData";

export type FireTier = "none" | "blue" | "red" | "golden";

export interface FireInfo {
  tier: FireTier;
  streak: number;
}

export function getFireTier(streak: number): FireTier {
  if (streak >= 10) return "golden";
  if (streak >= 5) return "red";
  if (streak >= 3) return "blue";
  return "none";
}

export function useOnFirePlayers(matches: Match[], rosters?: Roster[]) {
  const fireMap = useMemo(() => {
    const map = new Map<number, FireInfo>();
    if (!rosters || matches.length === 0) return map;

    // Sort matches by date descending (most recent first)
    const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));

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
