import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Check,
  X,
  MinusCircle,
  Info,
  CalendarDays,
  Users,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useTreasuryEntries,
  useMonthlyDues,
  useClubSetting,
  BALANCE_KEY,
  formatKRW,
  recentMonths,
  duesIncomeEntries,
} from "@/hooks/useTreasury";
import { useAllFutsalData } from "@/hooks/useFutsalData";

const MONTHLY_FEE = 20000;

const monthLabel = (ym: string, isEnglish: boolean) => {
  const [y, m] = ym.split("-");
  return isEnglish
    ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${y}년 ${Number(m)}월`;
};

type Tab = "period" | "member" | "rules";

const TreasuryPage = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: entries = [], isLoading } = useTreasuryEntries();
  const { data: dues = [] } = useMonthlyDues();
  const { players } = useAllFutsalData();

  // Only current members (is_member) are billed dues.
  const activePlayers = useMemo(
    () => players.filter((p) => p.is_active && (p as any).is_member !== false),
    [players]
  );

  const months = useMemo(() => recentMonths(12), []);
  const [tab, setTab] = useState<Tab>("period");
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  const duesMap = useMemo(() => {
    const m = new Map<string, { status: string; amount: number }>();
    dues.forEach((d) =>
      m.set(`${d.player_id}|${d.year_month}`, {
        status: d.status ?? (d.is_paid ? "paid" : "unpaid"),
        amount: d.amount ?? 0,
      })
    );
    return m;
  }, [dues]);

  const getDue = (playerId: number, ym: string) =>
    duesMap.get(`${playerId}|${ym}`) ?? { status: "unpaid", amount: 0 };

  const toggleDue = async (playerId: number, ym: string) => {
    if (!isAdmin) return;
    const cur = getDue(playerId, ym);
    const next =
      cur.status === "unpaid"
        ? { status: "paid", amount: MONTHLY_FEE }
        : cur.status === "paid"
        ? { status: "exempt", amount: 0 }
        : { status: "unpaid", amount: 0 };
    const { error } = await supabase.from("monthly_dues").upsert(
      {
        player_id: playerId,
        year_month: ym,
        is_paid: next.status === "paid",
        status: next.status,
        amount: next.amount,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "player_id,year_month" }
    );
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["monthly_dues_all"] });
  };

  // Paid dues count as income in the ledger.
  const ledger = useMemo(() => {
    const names = new Map(players.map((p) => [p.id, p.name] as const));
    return [...entries, ...duesIncomeEntries(dues, names, isEnglish)].sort((a, b) =>
      (b.entry_date ?? "").localeCompare(a.entry_date ?? "")
    );
  }, [entries, dues, players, isEnglish]);

  const totalIn = ledger.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = ledger.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const { data: manualBalance } = useClubSetting(BALANCE_KEY);
  const isManual = manualBalance != null && manualBalance !== "";
  const balance = isManual ? Number(manualBalance) : totalIn - totalOut;

  const monthStat = useMemo(() => {
    const paid = activePlayers.filter((p) => getDue(p.id, selectedMonth).status === "paid");
    const exempt = activePlayers.filter((p) => getDue(p.id, selectedMonth).status === "exempt");
    const target = activePlayers.length - exempt.length;
    const collected = paid.reduce((s, p) => s + (getDue(p.id, selectedMonth).amount || MONTHLY_FEE), 0);
    return { paidCount: paid.length, target, collected, exemptCount: exempt.length };
  }, [activePlayers, duesMap, selectedMonth]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof ledger>();
    ledger
      .filter((e) => (e.entry_date ?? "").slice(0, 7) === selectedMonth)
      .forEach((e) => map.set(e.entry_date, [...(map.get(e.entry_date) ?? []), e]));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [ledger, selectedMonth]);

  const pct = monthStat.target > 0 ? Math.round((monthStat.paidCount / monthStat.target) * 100) : 0;

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "period", label: isEnglish ? "By period" : "기간별", icon: CalendarDays },
    { key: "member", label: isEnglish ? "By member" : "모임원별", icon: Users },
    { key: "rules", label: isEnglish ? "Rules" : "운영 안내", icon: Info },
  ];

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
          {isManual && (
            <p className="text-[10px] text-muted-foreground">
              {isEnglish ? "Updated by the admin" : "관리자가 입력한 실제 통장 잔고"}
            </p>
          )}
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
        </motion.div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "period" && (
          <div className="space-y-4">
            {/* Month selector */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                    selectedMonth === m
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {monthLabel(m, isEnglish)}
                </button>
              ))}
            </div>

            {/* Collection progress */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold text-foreground">{monthLabel(selectedMonth, isEnglish)}</p>
                <p className="text-xs text-muted-foreground">
                  {isEnglish
                    ? `${monthStat.paidCount}/${monthStat.target} paid`
                    : `${monthStat.paidCount}/${monthStat.target}명 완료`}
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{isEnglish ? "Collected" : "모인 금액"}</span>
                <span className="font-bold text-primary">{formatKRW(monthStat.collected)}</span>
              </div>
              {monthStat.exemptCount > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {isEnglish
                    ? `${monthStat.exemptCount} member(s) exempt`
                    : `면제 ${monthStat.exemptCount}명`}
                </p>
              )}
            </div>

            {/* Member status grid for the month */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold tracking-wide text-muted-foreground">
                {isEnglish ? "DUES STATUS" : "월 회비 납부 현황"}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {activePlayers.map((p) => {
                  const d = getDue(p.id, selectedMonth);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleDue(p.id, selectedMonth)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left ${
                        d.status === "paid"
                          ? "border-primary/40 bg-primary/10"
                          : d.status === "exempt"
                          ? "border-border bg-muted/40"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="truncate text-xs font-medium text-foreground">{p.name}</span>
                      {d.status === "paid" ? (
                        <Check size={14} className="shrink-0 text-primary" />
                      ) : d.status === "exempt" ? (
                        <MinusCircle size={14} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <X size={14} className="shrink-0 text-rose-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              {isAdmin && (
                <p className="text-[10px] text-muted-foreground">
                  {isEnglish
                    ? "Admin: tap a member to cycle Paid → Exempt → Unpaid."
                    : "관리자: 이름을 탭하면 완납 → 면제 → 미납 순으로 변경됩니다."}
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold tracking-wide text-muted-foreground">
                {isEnglish ? "TRANSACTIONS" : "입출금 내역"}
              </h2>
              {isLoading && (
                <p className="text-xs text-muted-foreground">{isEnglish ? "Loading..." : "불러오는 중..."}</p>
              )}
              {!isLoading && grouped.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "No transactions this month." : "이번 달 등록된 내역이 없습니다."}
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
                            e.direction === "in"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/15 text-rose-400"
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
        )}

        {tab === "member" && (
          <div className="space-y-4">
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {activePlayers.map((p) => {
                const on = selectedPlayer === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(on ? null : p.id)}
                    className="flex w-14 shrink-0 flex-col items-center gap-1"
                  >
                    <span
                      className={`h-12 w-12 overflow-hidden rounded-full border-2 ${
                        on ? "border-primary" : "border-border"
                      }`}
                    >
                      {p.profile_image_url ? (
                        <img src={p.profile_image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-muted text-xs font-bold text-muted-foreground">
                          {p.name.slice(-2)}
                        </span>
                      )}
                    </span>
                    <span
                      className={`w-full truncate text-center text-[10px] ${
                        on ? "font-bold text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {!selectedPlayer ? (
              <p className="text-xs text-muted-foreground">
                {isEnglish ? "Select a member to see their payment history." : "멤버를 선택하면 월별 납부 내역이 표시됩니다."}
              </p>
            ) : (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                {months.map((m) => {
                  const d = getDue(selectedPlayer, m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleDue(selectedPlayer, m)}
                      className="flex w-full items-center justify-between rounded-xl bg-background px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-medium text-foreground">{monthLabel(m, isEnglish)}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {d.status === "paid"
                            ? formatKRW(d.amount || MONTHLY_FEE)
                            : d.status === "exempt"
                            ? isEnglish
                              ? "Exempt"
                              : "면제"
                            : isEnglish
                            ? "Unpaid"
                            : "미납"}
                        </span>
                        {d.status === "paid" ? (
                          <Check size={15} className="text-primary" />
                        ) : d.status === "exempt" ? (
                          <MinusCircle size={15} className="text-muted-foreground" />
                        ) : (
                          <X size={15} className="text-rose-400" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "rules" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-primary">
                {isEnglish ? "Late & no-show fines" : "지각 · 노쇼 벌금제"}
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>
                  {isEnglish
                    ? "Late (not arrived by kick-off time): 5,000 KRW"
                    : "지각 (정시까지 미도착): 5,000원"}
                </li>
                <li>
                  {isEnglish
                    ? "No-show (not arrived before the end of Q2): 10,000 KRW"
                    : "노쇼 (2쿼터 종료 전까지 미도착): 10,000원"}
                </li>
                <li>
                  {isEnglish
                    ? "Cancelling after 22:00 the day before: 10,000 KRW (waived once a year for personal reasons)"
                    : "전날 22시 이후 취소: 10,000원 (개인 사정 고려하여 연 1회 면제)"}
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-primary">
                {isEnglish ? "Monthly dues & guest fees" : "회비 및 용병비 규칙"}
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>
                  {isEnglish
                    ? "Monthly dues are 20,000 KRW, announced in the group chat on the 1st of each month (with the Toss account). Admins check payments and follow up on unpaid dues."
                    : "월 회비는 20,000원이며 매월 1일 톡방에 공지합니다 (토스 계좌 포함). 관리자가 납부 여부를 확인하고 미납 시 독촉합니다."}
                </li>
                <li>
                  {isEnglish
                    ? "Real guest fees are split evenly among participants."
                    : "용병비(찐용병)는 참석 인원 N빵으로 처리합니다."}
                </li>
                <li>
                  {isEnglish
                    ? "A member who attends after declaring absence pays a 1,000 KRW guest fee."
                    : "팀원이 불참 통보 후 참석할 경우 용병비(팀원/개인사정인원)는 1,000원으로 책정합니다."}
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-primary">
                {isEnglish ? "Water & drinks settlement" : "물 · 음료 정산"}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {isEnglish
                  ? "Bulk-ordered via Coupang and settled after each match: water 700 KRW, drinks 1,800 KRW per unit."
                  : "쿠팡 대량 배송을 이용하며 경기 후 정산합니다 (물 700원, 음료 1,800원 단가)."}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreasuryPage;
