import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getPlayerName } from "@/hooks/useFutsalData";
import AdminPositionPanel from "@/components/admin/AdminPositionPanel";
import { DEFAULT_FORMAT, formatLabel, getSlot, slotMapOf, slotLabel } from "@/lib/positions";
import type { Player, MatchQuarter, GoalEvent, Team } from "@/hooks/useFutsalData";

interface Props {
  quarters: MatchQuarter[];
  players: Player[];
  goalEvents: GoalEvent[];
  matchTeams: Team[];
  courtMargins?: Map<number, { margin: number; isSuperSub?: boolean }> | null;
  isAdmin?: boolean;
  matchId?: number;
  formatCode?: string | null;
}

const ROLE_ORDER = ["GK", "DF", "MF", "FW"] as const;
const ROLE_Y: Record<string, number> = { GK: 88, DF: 68, MF: 46, FW: 22 };
const ROLE_RING: Record<string, string> = {
  GK: "ring-yellow-400/80",
  DF: "ring-blue-400/80",
  MF: "ring-green-400/80",
  FW: "ring-red-400/80",
};

const isCustomLineup = (l: any) => !!l && typeof l === "object" && !Array.isArray(l) && (l.teamA || l.teamB);
const idsOf = (raw: any): number[] => (raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n)));
const benchOf = (lineup: any) => idsOf(lineup?.Bench ?? lineup?.bench);

function positionsOf(lineup: any, formatCode?: string | null) {
  const out: { playerId: number; x: number; y: number; role: string; slot?: string }[] = [];
  if (!lineup) return out;
  const slotMap = slotMapOf(lineup);
  const mapped = new Set<number>();
  Object.entries(slotMap).forEach(([pid, code]) => {
    const sl = getSlot(code, formatCode);
    const id = Number(pid);
    if (!sl || Number.isNaN(id)) return;
    out.push({ playerId: id, x: sl.x, y: sl.y, role: sl.role, slot: code });
    mapped.add(id);
  });
  ROLE_ORDER.forEach(role => {
    const ids = idsOf(lineup[role] ?? lineup[role.toLowerCase()]).filter(id => !mapped.has(id));
    ids.forEach((id, i) => {
      const count = ids.length;
      const x = count === 1 ? 50 : role === "GK" ? 50 : 18 + (64 / (count - 1)) * i;
      out.push({ playerId: id, x, y: ROLE_Y[role], role });
    });
  });
  // spread players sharing the exact same slot coordinates
  const groups = new Map<string, typeof out>();
  out.forEach(p => {
    const k = `${p.x}:${p.y}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  groups.forEach(g => {
    if (g.length < 2) return;
    g.forEach((p, i) => { p.x = clamp(p.x + (i - (g.length - 1) / 2) * 16, 8, 92); });
  });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function QuarterPitchViewer({ quarters, players, goalEvents, matchTeams, courtMargins, isAdmin, matchId }: Props) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const pn = (id: number) => getPlayerName(players, id, lang);
  const avatar = (id: number) => players.find(p => p.id === id)?.profile_image_url ?? null;
  const kit = (id: number) => players.find(p => p.id === id)?.back_number ?? null;
  const roleLabel = (role: string) =>
    isEn ? role : role === "GK" ? "골키퍼" : role === "DF" ? "수비수" : role === "MF" ? "미드필더" : role === "FW" ? "공격수" : role === "Bench" ? "벤치" : role;

  const list = useMemo(
    () =>
      [...quarters]
        .filter(q => {
          const l: any = q.lineup;
          if (!l || typeof l !== "object") return false;
          if (isCustomLineup(l)) return true;
          return ROLE_ORDER.some(r => l[r] || l[r.toLowerCase()]);
        })
        .sort((a, b) => a.quarter - b.quarter),
    [quarters]
  );

  const pitchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // key: `${unit}:${playerId}` -> {x,y}
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const dirty = Object.keys(overrides).length > 0;

  const safeIdx = Math.min(idx, Math.max(0, list.length - 1));
  const current = list[safeIdx];

  useEffect(() => {
    setOverrides({});
    setEditing(false);
  }, [safeIdx]);

  if (list.length === 0) return null;
  const custom = isCustomLineup(current.lineup);
  const quarterGoals = goalEvents.filter(g => g.quarter === current.quarter);

  const storedPos = (unit: any, pid: number) => {
    const p = unit?._pos?.[String(pid)];
    return p && typeof p.x === "number" && typeof p.y === "number" ? p : null;
  };

  const playerStats = (pid: number) => {
    let played = 0, bench = 0;
    list.forEach(q => {
      const l: any = q.lineup;
      const units = isCustomLineup(l) ? [l?.teamA, l?.teamB] : [l];
      units.forEach(u => {
        if (!u) return;
        if (ROLE_ORDER.some(r => idsOf(u[r] ?? u[r.toLowerCase()]).includes(pid))) played++;
        else if (benchOf(u).includes(pid)) bench++;
      });
    });
    const goals = goalEvents.filter(g => g.goal_player_id === pid && !g.is_own_goal).length;
    const assists = goalEvents.filter(g => g.assist_player_id === pid).length;
    const margin = courtMargins?.get(pid)?.margin ?? null;
    return { played, bench, goals, assists, margin };
  };

  const quarterStats = (pid: number) => ({
    goals: quarterGoals.filter(g => g.goal_player_id === pid && !g.is_own_goal).length,
    assists: quarterGoals.filter(g => g.assist_player_id === pid).length,
  });

  // Lightweight FotMob-style match rating (display only)
  const matchRating = (pid: number) => {
    const s = playerStats(pid);
    const per = s.played > 0 ? s.played : 1;
    const r = 6 + (s.goals * 0.9 + s.assists * 0.6) / Math.sqrt(per) + (s.margin ?? 0) * 0.12;
    return Math.max(4, Math.min(10, Number.isFinite(r) ? r : 6));
  };
  const ratingTone = (r: number) =>
    r >= 7.5 ? "bg-blue-500 text-white" : r >= 6.8 ? "bg-green-500 text-black" : r >= 6 ? "bg-orange-500 text-black" : "bg-red-500 text-white";

  const save = async () => {
    if (!dirty || !current) return;
    setSaving(true);
    const base: any = JSON.parse(JSON.stringify(current.lineup ?? {}));
    Object.entries(overrides).forEach(([key, val]) => {
      const [unitKey, pid] = key.split(":");
      const unit = unitKey === "A" ? (base.teamA ??= {}) : unitKey === "B" ? (base.teamB ??= {}) : base;
      unit._pos = { ...(unit._pos ?? {}), [pid]: { x: Math.round(val.x * 10) / 10, y: Math.round(val.y * 10) / 10 } };
    });
    const { error } = await (supabase as any).from("match_quarters").update({ lineup: base }).eq("id", current.id);
    setSaving(false);
    if (error) {
      toast({ title: L("저장 실패", "Save failed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: L("포메이션 저장 완료", "Formation saved") });
    setOverrides({});
    setEditing(false);
    if (matchId) qc.invalidateQueries({ queryKey: ["match_quarters", matchId] });
    else qc.invalidateQueries({ queryKey: ["match_quarters"] });
  };

  const renderPitch = (lineup: any, unitKey: string, label?: string, accent?: string) => {
    const positions = positionsOf(lineup);
    const bench = benchOf(lineup);
    return (
      <div className="flex-1 min-w-0">
        {label && <div className={`mb-1 text-center text-[10px] font-bold ${accent ?? "text-muted-foreground"}`}>{label}</div>}
        <div
          ref={el => { pitchRefs.current[unitKey] = el; }}
          className="relative w-full overflow-hidden rounded-2xl border border-green-900/60 shadow-inner"
          style={{
            aspectRatio: "3/4",
            backgroundColor: "#14471f",
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.045) 0 6.25%, rgba(0,0,0,0.045) 6.25% 12.5%), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 5px), radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.10), transparent 60%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
            <div className="absolute left-1/2 top-0 h-[15%] w-1/2 -translate-x-1/2 rounded-b-lg border-b border-l border-r border-white/15" />
            <div className="absolute left-1/2 top-0 h-[6%] w-1/4 -translate-x-1/2 rounded-b border-b border-l border-r border-white/15" />
            <div className="absolute bottom-0 left-1/2 h-[15%] w-1/2 -translate-x-1/2 rounded-t-lg border-l border-r border-t border-white/15" />
            <div className="absolute bottom-0 left-1/2 h-[6%] w-1/4 -translate-x-1/2 rounded-t border-l border-r border-t border-white/15" />
            <div className="absolute inset-1 rounded-xl border border-white/10" />
          </div>
          {positions.map((p, i) => {
            const img = avatar(p.playerId);
            const qs = quarterStats(p.playerId);
            const key = `${unitKey}:${p.playerId}`;
            const stored = storedPos(lineup, p.playerId);
            const pos = overrides[key] ?? stored ?? { x: p.x, y: p.y };
            return (
              <motion.div
                key={`${p.playerId}-${p.role}-${i}`}
                drag={editing}
                dragMomentum={false}
                dragElastic={0}
                onDragEnd={(_, info) => {
                  const rect = pitchRefs.current[unitKey]?.getBoundingClientRect();
                  if (!rect) return;
                  setOverrides(o => ({
                    ...o,
                    [key]: {
                      x: clamp(pos.x + (info.offset.x / rect.width) * 100, 6, 94),
                      y: clamp(pos.y + (info.offset.y / rect.height) * 100, 6, 94),
                    },
                  }));
                }}
                className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 ${editing ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <button
                  onClick={() => !editing && setSel(p.playerId)}
                  className="flex flex-col items-center gap-0.5 transition-transform active:scale-95"
                >
                  <div className="relative">
                    <div className={`relative h-[68px] w-[68px] overflow-hidden rounded-full bg-black/60 ring-[3px] ${ROLE_RING[p.role] ?? "ring-white/50"} shadow-[0_6px_16px_rgba(0,0,0,0.55)] ${editing ? "ring-dashed" : ""}`}>
                      {img ? (
                        <img src={img} alt={pn(p.playerId)} className="h-full w-full object-cover" loading="lazy" draggable={false} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">{p.role}</span>
                      )}
                    </div>
                    <span className={`absolute -right-2 -top-1.5 rounded-md px-1.5 py-px text-[10px] font-extrabold shadow ${ratingTone(matchRating(p.playerId))}`}>
                      {matchRating(p.playerId).toFixed(1)}
                    </span>
                    {kit(p.playerId) != null && (
                      <span className="absolute -left-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-black/75 px-1 text-[10px] font-bold text-white ring-1 ring-white/20">
                        {kit(p.playerId)}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 max-w-[84px] truncate rounded bg-black/55 px-1.5 py-px text-[11px] font-semibold text-white drop-shadow">
                    {pn(p.playerId)}
                  </span>
                  {(qs.goals > 0 || qs.assists > 0) && (
                    <span className="flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-px text-[9px] font-bold text-white">
                      {qs.goals > 0 && <span>⚽{qs.goals}</span>}
                      {qs.assists > 0 && <span className="text-primary">🅰{qs.assists}</span>}
                    </span>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
        {bench.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold text-muted-foreground">{L("벤치", "Bench")}</span>
            {bench.map((id, i) => (
              <button key={`b-${id}-${i}`} onClick={() => setSel(id)} className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-primary">
                {pn(id)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const selStats = sel !== null ? playerStats(sel) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg tracking-wider text-primary">{L("쿼터별 라인업", "QUARTER LINEUP")}</h2>
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            {editing ? (
              <>
                <button
                  onClick={() => setOverrides({})}
                  disabled={!dirty}
                  title={L("변경 초기화", "Reset changes")}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
                >
                  <RotateCcw size={12} /> {L("초기화", "Reset")}
                </button>
                <button
                  onClick={() => { setOverrides({}); setEditing(false); }}
                  title={L("편집 종료", "Exit editor")}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  <X size={12} /> {L("취소", "Cancel")}
                </button>
                <button
                  onClick={save}
                  disabled={!dirty || saving}
                  title={L("포메이션 저장", "Save formation")}
                  className="flex items-center gap-1 rounded-full gradient-pink px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
                >
                  <Save size={12} /> {saving ? L("저장 중...", "Saving...") : L("저장", "Save")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                title={L("선수를 드래그해 포메이션을 조정합니다", "Drag players to adjust the formation")}
                className="flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-[11px] font-bold text-primary"
              >
                <Pencil size={12} /> {L("포메이션 편집", "Edit formation")}
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <p className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground">
          {L("선수를 드래그해 위치를 옮긴 뒤 저장을 누르세요. 이 쿼터에만 적용됩니다.", "Drag players to reposition them, then hit Save. Changes apply to this quarter only.")}
        </p>
      )}

      {/* Quarter tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {list.map((q, i) => (
          <button
            key={q.quarter}
            onClick={() => setIdx(i)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
              i === safeIdx ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            {isEn ? `Q${q.quarter}` : `${q.quarter}Q`}
            <span className="ml-1 text-[10px] opacity-70">{q.score_for}-{q.score_against}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => setIdx(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
            className="rounded-full border border-border p-1 text-muted-foreground disabled:opacity-30"
            aria-label={L("이전 쿼터", "Previous quarter")}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-foreground">{L(`${current.quarter}쿼터`, `Quarter ${current.quarter}`)}</div>
            <div className="text-[11px] text-muted-foreground">{current.score_for} - {current.score_against}</div>
          </div>
          <button
            onClick={() => setIdx(Math.min(list.length - 1, safeIdx + 1))}
            disabled={safeIdx === list.length - 1}
            className="rounded-full border border-border p-1 text-muted-foreground disabled:opacity-30"
            aria-label={L("다음 쿼터", "Next quarter")}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.quarter}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            drag={editing ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (editing) return;
              if (info.offset.x < -60) setIdx(Math.min(list.length - 1, safeIdx + 1));
              else if (info.offset.x > 60) setIdx(Math.max(0, safeIdx - 1));
            }}
          >
            {custom ? (
              <div className="grid grid-cols-2 gap-2">
                {renderPitch((current.lineup as any).teamA, "A", `🅰️ ${matchTeams[0]?.name ?? L("A팀", "Team A")}`, "text-blue-400")}
                {renderPitch((current.lineup as any).teamB, "B", `🅱️ ${matchTeams[1]?.name ?? L("B팀", "Team B")}`, "text-orange-400")}
              </div>
            ) : (
              renderPitch(current.lineup, "M")
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-2.5">
          <div className="mb-1.5 text-[10px] font-bold tracking-wider text-primary">
            {L("이 쿼터 득점 / 도움", "GOALS & ASSISTS THIS QUARTER")}
          </div>
          {quarterGoals.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{L("이 쿼터에는 골이 없습니다.", "No goals in this quarter.")}</p>
          ) : (
            <div className="space-y-1">
              {quarterGoals.map(g => (
                <div key={g.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-primary">⚽</span>
                  {g.is_own_goal ? (
                    <span className="text-destructive">
                      {L("자책골", "Own Goal")} ({g.goal_player_id ? pn(g.goal_player_id) : "???"})
                    </span>
                  ) : (
                    <>
                      <button onClick={() => g.goal_player_id && setSel(g.goal_player_id)} className="font-medium text-foreground hover:text-primary">
                        {g.goal_player_id ? pn(g.goal_player_id) : "???"}
                      </button>
                      {g.assist_player_id && (
                        <>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-[10px] text-muted-foreground">🅰️</span>
                          <button onClick={() => setSel(g.assist_player_id!)} className="text-muted-foreground hover:text-primary">
                            {pn(g.assist_player_id)}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={sel !== null} onOpenChange={o => !o && setSel(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left text-primary">{L("경기 내 기록", "Match Performance")}</SheetTitle>
          </SheetHeader>
          {sel !== null && selStats && (
            <div className="mt-2 space-y-4">
              <button onClick={() => navigate(`/player/${sel}`)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 text-left transition-colors hover:border-primary/50">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                  {avatar(sel) ? (
                    <img src={avatar(sel)!} alt={pn(sel)} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">{pn(sel).slice(0, 1)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-foreground">{pn(sel)}</div>
                  <div className="text-[11px] text-muted-foreground">{L("프로필 보기", "View full profile")}</div>
                </div>
                <ExternalLink size={16} className="text-primary" />
              </button>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="font-display text-lg text-primary">{selStats.played}</div>
                  <div className="text-[9px] text-muted-foreground">{L("출전 쿼터", "Quarters")}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="font-display text-lg text-foreground">{selStats.goals}</div>
                  <div className="text-[9px] text-muted-foreground">{L("골", "Goals")}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="font-display text-lg text-foreground">{selStats.assists}</div>
                  <div className="text-[9px] text-muted-foreground">{L("도움", "Assists")}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className={`font-display text-lg ${selStats.margin != null && selStats.margin > 0 ? "text-green-400" : selStats.margin != null && selStats.margin < 0 ? "text-red-400" : "text-foreground"}`}>
                    {selStats.margin == null ? "-" : selStats.margin > 0 ? `+${selStats.margin}` : selStats.margin}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{L("팀 마진", "Team Margin")}</div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div>
                  {L("이번 쿼터 포지션", "Position this quarter")}:{" "}
                  <span className="text-foreground">
                    {(() => {
                      const l: any = current.lineup;
                      const units = isCustomLineup(l) ? [l.teamA, l.teamB] : [l];
                      for (const u of units) {
                        if (!u) continue;
                        for (const r of ROLE_ORDER) if (idsOf(u[r] ?? u[r.toLowerCase()]).includes(sel)) return roleLabel(r);
                        if (benchOf(u).includes(sel)) return roleLabel("Bench");
                      }
                      return "-";
                    })()}
                  </span>
                </div>
                {selStats.bench > 0 && <div>{L(`벤치 대기 ${selStats.bench}쿼터`, `${selStats.bench} quarter(s) on the bench`)}</div>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
