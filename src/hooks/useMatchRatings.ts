import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeMatchRatings, type MatchRatingDetail } from "@/lib/matchRating";
import type { Match, MatchQuarter, GoalEvent, Roster } from "./useFutsalData";

export interface RatingOverrideRow {
  id: string;
  match_id: number;
  player_id: number;
  rating: number;
  note: string | null;
}

/** All admin rating overrides (global, cached once). */
export function useRatingOverrides() {
  return useQuery({
    queryKey: ["match_rating_overrides"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_rating_overrides")
        .select("id, match_id, player_id, rating, note");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, rating: Number(r.rating) })) as RatingOverrideRow[];
    },
  });
}

export function useSaveRatingOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, playerId, rating }: { matchId: number; playerId: number; rating: number | null }) => {
      if (rating === null) {
        const { error } = await (supabase as any)
          .from("match_rating_overrides")
          .delete()
          .eq("match_id", matchId)
          .eq("player_id", playerId);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("match_rating_overrides")
        .upsert({ match_id: matchId, player_id: playerId, rating }, { onConflict: "match_id,player_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_rating_overrides"] });
    },
  });
}

/** Overrides for one match as a playerId -> rating map. */
export function useMatchOverrideMap(matchId: number) {
  const { data } = useRatingOverrides();
  return useMemo(() => {
    const m = new Map<number, number>();
    (data ?? []).filter(o => o.match_id === matchId).forEach(o => m.set(o.player_id, o.rating));
    return m;
  }, [data, matchId]);
}

/** Overrides for every match keyed as `${matchId}:${playerId}` (season aggregation). */
export function useKeyedOverrideMap() {
  const { data } = useRatingOverrides();
  return useMemo(() => {
    const m = new Map<string, number>();
    (data ?? []).forEach(o => m.set(`${o.match_id}:${o.player_id}`, o.rating));
    return m;
  }, [data]);
}

/**
 * THE rating source for a single match — every surface in the app uses this.
 */
export function useMatchRatings(
  match: Match | null | undefined,
  quarters: MatchQuarter[] | undefined,
  goalEvents: GoalEvent[] | undefined,
  rosters?: Roster[],
  momPlayerIds?: number[],
): Map<number, MatchRatingDetail> {
  const overrides = useMatchOverrideMap(match?.id ?? -1);
  const momKey = (momPlayerIds ?? []).join(",");
  return useMemo(
    () =>
      computeMatchRatings({
        match,
        quarters: quarters ?? [],
        goalEvents: goalEvents ?? [],
        rosters: rosters ?? [],
        momPlayerIds: momPlayerIds ?? [],
        overrides,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match, quarters, goalEvents, rosters, momKey, overrides],
  );
}
