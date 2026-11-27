import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerStats, type Match, type MatchQuarter, type Player } from "@/hooks/useFutsalData";
import { computeSeasonRatings } from "@/hooks/useSeasonRating";
import { useKeyedOverrideMap } from "@/hooks/useMatchRatings";
import { useFines } from "@/hooks/useFines";
import { getMOMRanking } from "@/hooks/useAdvancedStats";
import { ALL_SLOTS, type RoleKey } from "@/lib/positions";
import type { useAllFutsalData } from "@/hooks/useFutsalData";

/** Every quarter of every match (paginated). Shared cache key with the rest of the app. */
export function useAllQuarters() {
  return useQuery({
    queryKey: ["all_match_quarters"],
    queryFn: async () => {
      let all: MatchQuarter[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from("match_quarters").select("*").range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as MatchQuarter[]);
        if (data.length < 1000) break;
      }
      return all;
    },
  });
}

export function useMomVotes() {
  return useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });
}

export interface SquadRow {
  player: Player;
  role: RoleKey | null;
  apps: number;
  goals: number;
  assists: number;
  ap: number;
  rating: number;
  mom: number;
  wins: number;
  winRate: number;
  cleanSheets: number;
}

type ClubData = ReturnType<typeof useAllFutsalData>;

/** Main position: first preferred slot, otherwise the role played most in lineups. */
function primaryRole(p: Player, roleCounts: Map<number, Map<string, number>>): RoleKey | null {
  const pref = String(p.pref_positions ?? "").split(",").map(s => s.trim()).find(c => ALL_SLOTS[c]);
  if (pref) return ALL_SLOTS[pref].role;
  const counts = roleCounts.get(p.id);
  if (!counts) return null;
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return (best?.[0] as RoleKey) ?? null;
}

/**
 * One row per player for the given matches: apps, G/A, season rating, MOMs, win rate.
 * Single source for the squad list and the leaderboards so numbers always agree.
 */
export function useSquadTable(data: ClubData, matches: Match[]) {
  const { data: quarters = [], isLoading: qLoading } = useAllQuarters();
  const { data: momVotes = [] } = useMomVotes();
  const { data: fines = [] } = useFines();
  const overrideKeyed = useKeyedOverrideMap();
  const { players, teams, results, rosters, goalEvents } = data;

  const rows = useMemo<SquadRow[]>(() => {
    const ids = new Set(matches.map(m => m.id));
    const mQuarters = quarters.filter(q => ids.has(q.match_id));
    const mRosters = rosters.filter(r => ids.has(r.match_id));
    const fineCounts = new Map<number, number>();
    fines.forEach(f => {
      if (!f.is_waived) fineCounts.set(f.player_id, (fineCounts.get(f.player_id) ?? 0) + 1);
    });
    const ratingById = new Map(
      computeSeasonRatings(players, matches, mRosters, goalEvents, mQuarters, fineCounts, overrideKeyed).map(r => [r.playerId, r])
    );
    const momById = new Map(getMOMRanking(players, momVotes.filter(v => ids.has(v.match_id))).map(m => [m.playerId, m.count]));

    const roleCounts = new Map<number, Map<string, number>>();
    quarters.forEach(q => {
      const l: any = q.lineup;
      const units = l && (l.teamA || l.teamB) ? [l.teamA, l.teamB] : [l];
      units.forEach(u => {
        if (!u || typeof u !== "object") return;
        (["GK", "DF", "MF", "FW"] as const).forEach(role => {
          const raw = u[role] ?? u[role.toLowerCase()];
          if (raw == null) return;
          (Array.isArray(raw) ? raw : [raw]).map(Number).forEach((pid: number) => {
            if (Number.isNaN(pid)) return;
            const m = roleCounts.get(pid) ?? new Map<string, number>();
            m.set(role, (m.get(role) ?? 0) + 1);
            roleCounts.set(pid, m);
          });
        });
      });
    });

    return players.map(p => {
      const st = getPlayerStats(players, matches, teams, results, mRosters, goalEvents, p.id);
      const r = ratingById.get(p.id);
      return {
        player: p,
        role: primaryRole(p, roleCounts),
        apps: st.appearances,
        goals: st.goals,
        assists: st.assists,
        ap: st.attackPoints,
        rating: r && r.appearances > 0 ? r.rating : 0,
        mom: momById.get(p.id) ?? 0,
        wins: st.wins,
        winRate: st.winRate,
        cleanSheets: r?.cleanSheets ?? 0,
      };
    });
  }, [players, matches, teams, results, rosters, goalEvents, quarters, momVotes, fines, overrideKeyed]);

  return { rows, isLoading: qLoading };
}
