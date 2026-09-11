import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import {
  useTreasuryEntries,
  useMonthlyDues,
  useClubSetting,
  BALANCE_KEY,
  formatKRW,
  duesIncomeEntries,
} from "@/hooks/useTreasury";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

const STATUS_CYCLE = [
  { status: "unpaid", amount: 0 },
  { status: "paid", amount: 30000 },
  { status: "paid", amount: 20000 },
  { status: "exempt", amount: 0 },
];

const statusLabel = (status: string, amount: number, isEnglish: boolean) => {
  if (status === "exempt") return isEnglish ? "Exempt" : "예외";
  if (status === "paid") return isEnglish ? `${(amount / 1000).toFixed(0)}k` : `${(amount / 10000).toFixed(0)}만`;
  return isEnglish ? "Unpaid" : "미납";
};

const AdminTreasury = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const qc = useQueryClient();
  const { players } = useAllFutsalData();
  // Dues are only charged to current members (is_member).
  const activePlayers = useMemo(
    () => players.filter((p) => p.is_active && (p as any).is_member !== false),
    [players]
  );

  const { data: entries = [] } = useTreasuryEntries();
  const { data: dues = [] } = useMonthlyDues();
  const { data: manualBalance } = useClubSetting(BALANCE_KEY);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const selectedYm = `${year}-${month}`;
  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 3 + i)),
    []
  );
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );

  const [balanceInput, setBalanceInput] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveBalance = async () => {
    const raw = balanceInput.replace(/[^0-9-]/g, "");
    if (!raw) {
      toast({
        title: isEnglish ? "Enter an amount" : "금액을 입력하세요",
        variant: "destructive",
      });
      return;
    }
    setSavingBalance(true);
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: BALANCE_KEY, value: raw, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingBalance(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setBalanceInput("");
    qc.invalidateQueries({ queryKey: ["club_settings", BALANCE_KEY] });
    toast({ title: isEnglish ? "Balance updated" : "잔고가 반영되었습니다" });
  };

  const clearBalance = async () => {
    const { error } = await supabase.from("club_settings").delete().eq("key", BALANCE_KEY);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["club_settings", BALANCE_KEY] });
    toast({ title: isEnglish ? "Reverted to auto balance" : "자동 계산 잔액으로 되돌렸습니다" });
  };

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [memo, setMemo] = useState("");

  const duesMap = useMemo(() => {
    const m = new Map<string, { status: string; amount: number }>();
    dues.forEach((d) => m.set(`${d.player_id}|${d.year_month}`, { status: d.status ?? (d.is_paid ? "paid" : "unpaid"), amount: d.amount ?? 0 }));
    return m;
  }, [dues]);

  const addEntry = async () => {
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || !memo.trim()) {
      toast({ title: isEnglish ? "Amount and memo required" : "금액과 적요를 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("treasury_entries").insert({
      entry_date: date,
      direction,
      amount: amt,
      counterparty: counterparty.trim() || null,
      memo: memo.trim(),
    });
    setSaving(false);
    if (error) return toast({ title: "오류", description: error.message, variant: "destructive" });
    setAmount(""); setCounterparty(""); setMemo("");
    qc.invalidateQueries({ queryKey: ["treasury_entries"] });
    toast({ title: isEnglish ? "Entry added" : "내역이 등록되었습니다" });
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("treasury_entries").delete().eq("id", id);
    if (error) return toast({ title: "오류", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["treasury_entries"] });
  };

  const cycleDue = async (playerId: number, ym: string) => {
    const cur = duesMap.get(`${playerId}|${ym}`) ?? { status: "unpaid", amount: 0 };
    const idx = STATUS_CYCLE.findIndex((s) => s.status === cur.status && s.amount === cur.amount);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
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
    if (error) return toast({ title: "오류", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["monthly_dues_all"] });
  };

  // Paid dues are derived income rows in the ledger.
  const ledger = useMemo(() => {
    const names = new Map(players.map((p) => [p.id, p.name] as const));
    return [...entries, ...duesIncomeEntries(dues, names, isEnglish)].sort((a, b) =>
      (b.entry_date ?? "").localeCompare(a.entry_date ?? "")
    );
  }, [entries, dues, players, isEnglish]);

  const totalIn = ledger.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = ledger.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mt-4 space-y-6">
      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEnglish ? "Income" : "입금"}</p>
          <p className="mt-1 text-sm font-bold text-emerald-400">{formatKRW(totalIn)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEnglish ? "Expense" : "출금"}</p>
          <p className="mt-1 text-sm font-bold text-rose-400">{formatKRW(totalOut)}</p>
        </div>
        <div className="rounded-xl border border-primary/40 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEnglish ? "Balance" : "잔액"}</p>
          <p className="mt-1 text-sm font-bold text-primary">{formatKRW(totalIn - totalOut)}</p>
        </div>
      </div>

      {/* Manual balance override */}
      <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Wallet size={13} /> {isEnglish ? "Current bank balance" : "현재 통장 잔고"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {isEnglish
            ? manualBalance
              ? `Currently shown to members: ${formatKRW(Number(manualBalance))}`
              : "Not set — members see the auto-calculated balance."
            : manualBalance
            ? `멤버에게 표시 중: ${formatKRW(Number(manualBalance))}`
            : "미설정 — 멤버에게는 자동 계산 잔액이 표시됩니다."}
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder={isEnglish ? "e.g. 30651" : "예: 30651"}
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            className="bg-background"
          />
          <Button onClick={saveBalance} disabled={savingBalance} className="shrink-0">
            {isEnglish ? "Save" : "저장"}
          </Button>
        </div>
        {manualBalance && (
          <Button variant="outline" size="sm" onClick={clearBalance} className="w-full text-xs">
            {isEnglish ? "Use auto-calculated balance" : "자동 계산 잔액으로 되돌리기"}
          </Button>
        )}
      </div>


      {/* Entry form */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground">{isEnglish ? "Add ledger entry" : "입출금 내역 추가"}</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background" />
          <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">{isEnglish ? "Income" : "입금"}</SelectItem>
              <SelectItem value="out">{isEnglish ? "Expense" : "출금"}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="numeric"
            placeholder={isEnglish ? "Amount" : "금액"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-background"
          />
          <Input
            placeholder={isEnglish ? "Name / payer" : "대상자"}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            className="bg-background"
          />
        </div>
        <Input
          placeholder={isEnglish ? "Description (e.g. pitch fee)" : "적요 (예: 인덕대 구장비, 월 회비)"}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="bg-background"
        />
        <Button onClick={addEntry} disabled={saving} className="w-full gap-1">
          <Plus size={14} /> {isEnglish ? "Add" : "등록"}
        </Button>
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-foreground">{isEnglish ? "Ledger" : "장부 내역"}</p>
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground">{isEnglish ? "No entries yet." : "등록된 내역이 없습니다."}</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${e.direction === "in" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
              {e.direction === "in" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{e.memo}</p>
              <p className="text-[11px] text-muted-foreground">
                {e.entry_date}{e.counterparty ? ` · ${e.counterparty}` : ""}
              </p>
            </div>
            <span className={`text-sm font-bold ${e.direction === "in" ? "text-emerald-400" : "text-rose-400"}`}>
              {e.direction === "in" ? "+" : "-"}{formatKRW(e.amount)}
            </span>
            <button onClick={() => deleteEntry(e.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Dues by selected month */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-foreground">
          {isEnglish ? "Monthly dues (tap to change)" : "멤버별 월 회비 (탭하여 변경)"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder={isEnglish ? "Year" : "연도"} />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {isEnglish ? y : `${y}년`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder={isEnglish ? "Month" : "월"} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {isEnglish
                    ? new Date(2000, Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long" })
                    : `${Number(m)}월`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {isEnglish ? "Unpaid → 30,000 → 20,000 → Exempt" : "미납 → 3만원 → 2만원 → 예외(개인사정)"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {activePlayers.map((p) => {
            const cur = duesMap.get(`${p.id}|${selectedYm}`) ?? { status: "unpaid", amount: 0 };
            const tone =
              cur.status === "paid"
                ? "border-primary/40 bg-primary/10 text-primary"
                : cur.status === "exempt"
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-border bg-card text-muted-foreground";
            return (
              <button
                key={p.id}
                onClick={() => cycleDue(p.id, selectedYm)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${tone}`}
              >
                <span className="truncate font-medium text-foreground">{p.name}</span>
                <span className="shrink-0 font-bold">{statusLabel(cur.status, cur.amount, isEnglish)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminTreasury;
