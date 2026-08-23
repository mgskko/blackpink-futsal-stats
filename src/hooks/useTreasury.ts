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

export const recentMonths = (count = 12) => {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};
