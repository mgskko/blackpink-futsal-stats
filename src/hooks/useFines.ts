import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FineType = "late" | "no_show" | "late_cancel";

export interface PlayerFine {
  id: string;
  player_id: number;
  fine_type: FineType;
  amount: number;
  match_date: string | null;
  is_waived: boolean;
  is_paid: boolean;
  note: string | null;
  created_at: string;
}

export const FINE_AMOUNTS: Record<FineType, number> = {
  late: 5000,
  no_show: 10000,
  late_cancel: 10000,
};

export const FINE_LABELS: Record<FineType, { ko: string; en: string }> = {
  late: { ko: "지각", en: "Late Arrival" },
  no_show: { ko: "노쇼", en: "No-Show" },
  late_cancel: { ko: "전날 22시 이후 취소", en: "Late Cancellation" },
};

export const fineLabel = (t: FineType, isEn: boolean) =>
  isEn ? FINE_LABELS[t].en : FINE_LABELS[t].ko;

export const formatKRW = (n: number, isEn: boolean) =>
  isEn ? `KRW ${n.toLocaleString()}` : `${n.toLocaleString()}원`;

export const useFines = () =>
  useQuery({
    queryKey: ["player_fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_fines")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlayerFine[];
    },
  });

export interface FineSummary {
  total: number;
  paid: number;
  unpaid: number;
  counts: Record<FineType, number>;
  waivedCount: number;
}

export const summarizeFines = (fines: PlayerFine[]): FineSummary => {
  const counts: Record<FineType, number> = { late: 0, no_show: 0, late_cancel: 0 };
  let total = 0, paid = 0, waivedCount = 0;
  fines.forEach(f => {
    if (counts[f.fine_type] !== undefined) counts[f.fine_type] += 1;
    if (f.is_waived) { waivedCount += 1; return; }
    total += f.amount;
    if (f.is_paid) paid += f.amount;
  });
  return { total, paid, unpaid: total - paid, counts, waivedCount };
};
