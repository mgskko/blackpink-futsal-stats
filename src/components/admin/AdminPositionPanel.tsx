import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPlayerName } from "@/hooks/useFutsalData";
import type { MatchQuarter, Player } from "@/hooks/useFutsalData";
import { getSlots, slotMapOf, formatLabel } from "@/lib/positions";

const ROLES = ["GK", "DF", "MF", "FW"] as const;
const BENCH = "__BENCH__";

const idsOf = (raw: any): number[] =>
  raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n));
const isCustom = (l: any) => !!l && typeof l === "object" && !Array.isArray(l) && (l.teamA || l.teamB);

type Assign = Record<string, string>; // playerId -> slotCode | BENCH

function unitsOf(lineup: any): { key: "main" | "A" | "B"; unit: any }[] {
  if (!lineup || typeof lineup !== "object") return [];
  if (isCustom(lineup)) {
    const out: { key: "main" | "A" | "B"; unit: any }[] = [];
    if (lineup.teamA) out.push({ key: "A", unit: lineup.teamA });
    if (lineup.teamB) out.push({ key: "B", unit: lineup.teamB });
    return out;
  }
  return [{ key: "main", unit: lineup }];
}

function initialAssign(unit: any, formatCode: string): Assign {
  const slots = getSlots(formatCode);
  const stored = slotMapOf(unit);
  const out: Assign = {};
  ROLES.forEach(role => {
    idsOf(unit?.[role] ?? unit?.[role.toLowerCase()]).forEach(id => {
      out[String(id)] = stored[String(id)] ?? slots.find(s => s.role === role)?.code ?? role;
    });
  });
  idsOf(unit?.Bench ?? unit?.bench).forEach(id => { out[String(id)] = stored[String(id)] ?? BENCH; });
  return out;
}

export default function AdminPositionPanel({
  matchId, quarters, players, formatCode,
}: { matchId: number; quarters: MatchQuarter[]; players: Player[]; formatCode: string }) {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const pn = (id: number) => getPlayerName(players, id, lang);
  const slots = getSlots(formatCode);

  const list = useMemo(() => [...quarters].sort((a, b) => a.quarter - b.quarter), [quarters]);
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<Record<string, Assign>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, Assign> = {};
    list.forEach(q => {
      unitsOf(q.lineup).forEach(({ key, unit }) => {
        next[`${q.id}:${key}`] = initialAssign(unit, formatCode);
      });
    });
    setState(next);
  }, [list, formatCode]);

  if (list.length === 0) return null;
  const current = list[Math.min(idx, list.length - 1)];
  const units = unitsOf(current.lineup);

  const setSlot = (stateKey: string, pid: number, code: string) =>
    setState(s => ({ ...s, [stateKey]: { ...(s[stateKey] ?? {}), [String(pid)]: code } }));

  const buildUnit = (unit: any, assign: Assign) => {
    const next: any = { ...unit, GK: [], DF: [], MF: [], FW: [], Bench: [], _slot: {} as Record<string, string> };
    delete next.gk; delete next.df; delete next.mf; delete next.fw; delete next.bench;
    Object.entries(assign).forEach(([pid, code]) => {
      const id = Number(pid);
      if (code === BENCH) { next.Bench.push(id); return; }
      const slot = slots.find(s => s.code === code);
      next[slot?.role ?? "MF"].push(id);
      next._slot[pid] = code;
    });
    return next;
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const q of list) {
        const base: any = JSON.parse(JSON.stringify(q.lineup ?? {}));
        if (isCustom(base)) {
          if (base.teamA) base.teamA = buildUnit(base.teamA, state[`${q.id}:A`] ?? {});
          if (base.teamB) base.teamB = buildUnit(base.teamB, state[`${q.id}:B`] ?? {});
        } else {
          Object.assign(base, buildUnit(base, state[`${q.id}:main`] ?? {}));
        }
        const { error } = await (supabase as any).from("match_quarters").update({ lineup: base }).eq("id", q.id);
        if (error) throw error;
      }
      toast({ title: L("포지션이 저장되었습니다", "Positions saved") });
      qc.invalidateQueries({ queryKey: ["match_quarters", matchId] });
      qc.invalidateQueries({ queryKey: ["match_quarters"] });
      qc.invalidateQueries({ queryKey: ["all_match_quarters"] });
    } catch (e: any) {
      toast({ title: L("저장 실패", "Save failed"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-primary">{L("포지션 지정", "Position mapping")}</h3>
          <p className="text-[10px] text-muted-foreground">{formatLabel(formatCode, isEn)}</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 rounded-full gradient-pink px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
        >
          <Save size={12} /> {saving ? L("저장 중...", "Saving...") : L("전체 저장", "Save all")}
        </button>
      </div>

      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {list.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setIdx(i)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              i === Math.min(idx, list.length - 1) ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {isEn ? `Q${q.quarter}` : `${q.quarter}Q`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {units.map(({ key, unit }) => {
          const stateKey = `${current.id}:${key}`;
          const assign = state[stateKey] ?? {};
          const ids = Object.keys(assign).map(Number);
          return (
            <div key={stateKey}>
              {key !== "main" && (
                <div className="mb-1 text-[10px] font-bold text-primary">{key === "A" ? L("팀 A", "Team A") : L("팀 B", "Team B")}</div>
              )}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {ids.map(pid => (
                  <div key={pid} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-[11px] font-medium text-foreground">{pn(pid)}</span>
                    <Select value={assign[String(pid)] ?? BENCH} onValueChange={v => setSlot(stateKey, pid, v)}>
                      <SelectTrigger className="h-7 flex-1 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {slots.map(s => (
                          <SelectItem key={s.code} value={s.code} className="text-[11px]">
                            {s.code} · {isEn ? s.en : s.ko}
                          </SelectItem>
                        ))}
                        <SelectItem value={BENCH} className="text-[11px]">{L("벤치", "Bench")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {ids.length === 0 && <p className="text-[11px] text-muted-foreground">{L("등록된 선수가 없습니다", "No players in this quarter")}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
