import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TreasuryEntry {
  id: string;
  entry_date: string;
  direction: "in" | "out";
  amount: number;
  counterparty: string | null;
  memo: string;
}

export interface DuesRow {
  id: string;
  player_id: number;
  year_month: string;
  is_paid: boolean;
  amount: number;
  status: string; // paid | unpaid | exempt
  note: string | null;
}

export const useTreasuryEntries = () =>
  useQuery({
    queryKey: ["treasury_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TreasuryEntry[];
    },
  });

export const useMonthlyDues = () =>
  useQuery({
    queryKey: ["monthly_dues_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_dues").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as DuesRow[];
    },
  });

export const formatKRW = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/**
 * Paid monthly dues are treated as income entries in the club ledger.
 * They are derived (not stored in treasury_entries), so a status change
 * is reflected in the balance and the transaction feed immediately.
 */
export const duesIncomeEntries = (
  dues: DuesRow[],
  playerNames: Map<number, string>,
  isEnglish = false
): (TreasuryEntry & { isDues: true })[] =>
  dues
    .filter((d) => (d.status ?? (d.is_paid ? "paid" : "unpaid")) === "paid" && (d.amount ?? 0) > 0)
    .map((d) => ({
      id: `dues-${d.player_id}-${d.year_month}`,
      entry_date: `${d.year_month}-01`,
      direction: "in" as const,
      amount: d.amount,
      counterparty: playerNames.get(d.player_id) ?? null,
      memo: isEnglish ? `Monthly dues ${d.year_month}` : `${d.year_month} 월 회비`,
      isDues: true as const,
    }));

export const recentMonths = (count = 12) => {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

export const BALANCE_KEY = "treasury_balance";

export const useClubSetting = (key: string) =>
  useQuery({
    queryKey: ["club_settings", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as string | null;
    },
  });
