import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useTreasuryEntries, useMonthlyDues, formatKRW, recentMonths } from "@/hooks/useTreasury";
import { useAllFutsalData } from "@/hooks/useFutsalData";

const TreasuryPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const { data: entries = [], isLoading } = useTreasuryEntries();
  const { data: dues = [] } = useMonthlyDues();
  const { players } = useAllFutsalData();

  const totalIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const balance = totalIn - totalOut;

  const monthly = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    entries.forEach((e) => {
      const ym = (e.entry_date ?? "").slice(0, 7);
      const cur = map.get(ym) ?? { in: 0, out: 0 };
      if (e.direction === "in") cur.in += e.amount; else cur.out += e.amount;
      map.set(ym, cur);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [entries]);

  const currentMonth = recentMonths(1)[0];
  const activePlayers = players.filter((p) => p.is_active);
  const paidThisMonth = dues.filter(
    (d) => d.year_month === currentMonth && (d.status === "paid" || (!d.status && d.is_paid))
  ).length;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    entries.forEach((e) => {
      const key = e.entry_date;
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="pb-28">
      <PageHeader title="TREASURY" subtitle={isEnglish ? "Club ledger" : "구단 회비 장부"} />
      <div className="space-y-5 px-4">
        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-card p-5"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet size={14} /> {isEnglish ? "Total balance" : "총 잔액"}
          </div>
          <p className="mt-1 text-3xl font-bold text-primary">{formatKRW(balance)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-[10px] text-muted-foreground">{isEnglish ? "Income" : "총 입금"}</p>
              <p className="text-sm font-bold text-emerald-400">{formatKRW(totalIn)}</p>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <p className="text-[10px] text-muted-foreground">{isEnglish ? "Expense" : "총 출금"}</p>
              <p className="text-sm font-bold text-rose-400">{formatKRW(totalOut)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {isEnglish
              ? `Dues paid this month: ${paidThisMonth} / ${activePlayers.length}`
              : `이번 달 회비 납부: ${paidThisMonth} / ${activePlayers.length}명`}
          </p>
        </motion.div>

        {/* Monthly breakdown */}
        {monthly.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground">
              {isEnglish ? "MONTHLY SUMMARY" : "월별 수입 · 지출"}
            </h2>
            <div className="space-y-1.5 rounded-2xl border border-border bg-card p-3">
              {monthly.map(([ym, v]) => (
                <div key={ym} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{ym}</span>
                  <span className="flex gap-3">
                    <span className="text-emerald-400">+{formatKRW(v.in)}</span>
                    <span className="text-rose-400">-{formatKRW(v.out)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold tracking-wide text-muted-foreground">
            {isEnglish ? "TRANSACTIONS" : "입출금 내역"}
          </h2>
          {isLoading && <p className="text-xs text-muted-foreground">{isEnglish ? "Loading..." : "불러오는 중..."}</p>}
          {!isLoading && grouped.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {isEnglish ? "No transactions recorded yet." : "아직 등록된 내역이 없습니다."}
            </p>
          )}
          {grouped.map(([day, list]) => (
            <div key={day} className="space-y-1.5">
              <p className="px-1 text-[11px] text-muted-foreground">{day}</p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {list.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        e.direction === "in" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {e.direction === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{e.memo}</p>
                      {e.counterparty && (
                        <p className="truncate text-[11px] text-muted-foreground">{e.counterparty}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        e.direction === "in" ? "text-emerald-400" : "text-foreground"
                      }`}
                    >
                      {e.direction === "in" ? "+" : "-"}
                      {formatKRW(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TreasuryPage;
