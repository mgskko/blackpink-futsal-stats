import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { useTreasuryEntries, useMonthlyDues, formatKRW, recentMonths } from "@/hooks/useTreasury";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const STATUS_CYCLE = [
  { status: "unpaid", amount: 0 },
  { status: "paid", amount: 30000 },
  { status: "paid", amount: 20000 },
  { status: "exempt", amount: 0 },
];

const statusLabel = (status: string, amount: number, isEnglish: boolean) => {
  if (status === "exempt") return isEnglish ? "Exempt" : "예외";
  if (status === "paid") return `${(amount / 10000).toFixed(0)}만`;
  return isEnglish ? "Unpaid" : "미납";
};

const AdminTreasury = () => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const qc = useQueryClient();
  const { players } = useAllFutsalData();
  const activePlayers = useMemo(() => players.filter((p) => p.is_active), [players]);

  const { data: entries = [] } = useTreasuryEntries();
  const { data: dues = [] } = useMonthlyDues();

  const months = useMemo(() => recentMonths(6), []);
  const [saving, setSaving] = useState(false);

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

  const totalIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);

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

      {/* Dues matrix */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-foreground">{isEnglish ? "Monthly dues (tap to change)" : "멤버별 월 회비 (탭하여 변경)"}</p>
        <p className="text-[10px] text-muted-foreground">
          {isEnglish ? "Unpaid → 30,000 → 20,000 → Exempt" : "미납 → 3만원 → 2만원 → 예외(개인사정)"}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 bg-card px-2 py-2 text-left text-[10px] text-muted-foreground">{isEnglish ? "Player" : "선수"}</th>
                {months.map((m) => (
                  <th key={m} className="px-1 py-2 text-center text-[10px] text-muted-foreground">{m.slice(5)}{isEnglish ? "" : "월"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePlayers.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="sticky left-0 bg-card px-2 py-1.5 text-left font-medium text-foreground whitespace-nowrap">{p.name}</td>
                  {months.map((m) => {
                    const cur = duesMap.get(`${p.id}|${m}`) ?? { status: "unpaid", amount: 0 };
                    const tone =
                      cur.status === "paid" ? "bg-primary/20 text-primary"
                      : cur.status === "exempt" ? "bg-muted text-muted-foreground"
                      : "bg-background text-muted-foreground/60";
                    return (
                      <td key={m} className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => cycleDue(p.id, m)}
                          className={`w-full rounded-md px-1 py-1 text-[10px] font-semibold ${tone}`}
                        >
                          {statusLabel(cur.status, cur.amount, isEnglish)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTreasury;
