import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Match } from "@/hooks/useFutsalData";

export function useOnFirePlayers(matches: Match[]) {
  const { data: allAttendance } = useQuery({
    queryKey: ["all_attendance_fire"],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_attendance")
        .select("match_id, player_id, status");
      return (data ?? []) as { match_id: number; player_id: number; status: string }[];
    },
  });

  const onFirePlayerIds = useMemo(() => {
    if (!allAttendance || matches.length === 0) return new Set<number>();

    // Sort matches by date descending
    const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
    // Take the most recent 5 matches
    const recent5 = sorted.slice(0, 5);
    if (recent5.length < 5) return new Set<number>();

    const recent5Ids = new Set(recent5.map(m => m.id));

    // Group attendance by player
    const playerAttendance = new Map<number, Set<number>>();
    allAttendance.forEach(a => {
      if (a.status === "attending" && recent5Ids.has(a.match_id)) {
        if (!playerAttendance.has(a.player_id)) playerAttendance.set(a.player_id, new Set());
        playerAttendance.get(a.player_id)!.add(a.match_id);
      }
    });

    const fireSet = new Set<number>();
    playerAttendance.forEach((matchIds, playerId) => {
      if (matchIds.size >= 5) fireSet.add(playerId);
    });

    return fireSet;
  }, [allAttendance, matches]);

  return onFirePlayerIds;
}
