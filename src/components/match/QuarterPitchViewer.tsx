import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getPlayerName } from "@/hooks/useFutsalData";
import { ratingTone } from "@/lib/matchRating";
import FotmobPitch, { type PitchTeam } from "@/components/match/FotmobPitch";
import AdminPositionPanel from "@/components/admin/AdminPositionPanel";
import { DEFAULT_FORMAT, formatLabel, getFormat, getSlot, slotMapOf, slotLabel, autoSlots, shapeOf } from "@/lib/positions";
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
  /** unified rating source (see src/lib/matchRating.ts) */
  ratings?: Map<number, { rating: number; isOverride?: boolean }> | null;
}

const ROLE_ORDER = ["GK", "DF", "MF", "FW"] as const;
const ROLE_Y: Record<string, number> = { GK: 88, DF: 68, MF: 46, FW: 22 };

const isCustomLineup = (l: any) => !!l && typeof l === "object" && !Array.isArray(l) && (l.teamA || l.teamB);
const idsOf = (raw: any): number[] => (raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n)));
const benchOf = (lineup: any) => idsOf(lineup?.Bench ?? lineup?.bench);

function positionsOf(lineup: any, formatCode?: string | null, compact = false) {
  const out: { playerId: number; x: number; y: number; role: string; slot?: string }[] = [];
  if (!lineup) return out;
  // No stored slots → lay the quarter out as a real formation instead of stacking a line on one spot.
  const stored = slotMapOf(lineup);
  const slotMap = Object.keys(stored).length ? stored : autoSlots(lineup, formatCode);
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
  return spreadOverlaps(out, compact);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const MIN_DX = 22; // horizontal breathing room between avatars (%)
const MIN_DY = 11; // vertical band that counts as "same row" (%)

/** Dynamic collision prevention: fan out players sharing a slot, then resolve residual overlaps. */
function spreadOverlaps<T extends { x: number; y: number; slot?: string; playerId: number }>(list: T[], compact = false): T[] {
  const minDx = compact ? 15 : MIN_DX;
  const minDy = compact ? 8 : MIN_DY;
  // 1) fan out identical slot coordinates (left / center / right, wrapping to a second row when crowded)
  const groups = new Map<string, T[]>();
  list.forEach(p => {
    const k = `${Math.round(p.x)}:${Math.round(p.y)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  groups.forEach(g => {
    if (g.length < 2) return;
    const perRow = g.length <= 3 ? g.length : Math.ceil(g.length / 2);
    const rows = Math.ceil(g.length / perRow);
    g.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, g.length - row * perRow);
      const step = Math.min(minDx, 84 / Math.max(1, inRow - 1 || 1));
      p.x = clamp(p.x + (col - (inRow - 1) / 2) * step, 10, 90);
      if (rows > 1) p.y = clamp(p.y + (row - (rows - 1) / 2) * 12, 8, 92);
    });
  });

  // 2) iterative separation for players that still sit too close (different slots, same band)
  const sorted = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (Math.abs(a.y - b.y) >= minDy) continue;
        const dx = b.x - a.x;
        const overlap = minDx - Math.abs(dx);
        if (overlap <= 0) continue;
        const dir = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
        const shift = overlap / 2 + 0.5;
        a.x = clamp(a.x - dir * shift, 10, 90);
        b.x = clamp(b.x + dir * shift, 10, 90);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return list;
}

export default function QuarterPitchViewer({ quarters, players, goalEvents, matchTeams, courtMargins, isAdmin, matchId, formatCode, ratings }: Props) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const pn = (id: number) => getPlayerName(players, id, lang);
  const avatar = (id: number) => players.find(p => p.id === id)?.profile_image_url ?? null;
  const kit = (id: number) => players.find(p => p.id === id)?.back_number ?? null;
  const isSoccer = getFormat(formatCode ?? DEFAULT_FORMAT).sport === "soccer";
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

  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const safeIdx = Math.min(idx, Math.max(0, list.length - 1));
  const current = list[safeIdx];

  if (list.length === 0) return null;
  const custom = isCustomLineup(current.lineup);
  const quarterGoals = goalEvents.filter(g => g.quarter === current.quarter);

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

  // Unified rating (src/lib/matchRating.ts) — identical everywhere in the app
  const matchRating = (pid: number) => ratings?.get(pid)?.rating ?? 6;
  const isOverridden = (pid: number) => !!ratings?.get(pid)?.isOverride;

  // ── FotMob pitch data ──
  const topRated = (() => {
    let best: number | null = null, bestR = -1;
    ratings?.forEach((d, pid) => { if (d.rating > bestR) { bestR = d.rating; best = pid; } });
    return best;
  })();
  const toPitchTeam = (unit: any, kitColor: "pink" | "sky" | "orange", label?: string, compact = false): PitchTeam => {
    const pos = positionsOf(unit, formatCode, compact || isSoccer);
    return {
      label,
      kitColor,
      formation: shapeOf(Object.fromEntries(pos.filter(p => p.slot).map(p => [String(p.playerId), p.slot!])), formatCode),
      players: pos.map(p => {
        const qs = quarterStats(p.playerId);
        return {
          playerId: p.playerId,
          x: p.x,
          y: p.y,
          name: pn(p.playerId),
          kit: kit(p.playerId),
          photo: avatar(p.playerId),
          rating: ratings?.get(p.playerId)?.rating ?? null,
          ratingAdjusted: isOverridden(p.playerId),
          goals: qs.goals,
          assists: qs.assists,
          ownGoals: quarterGoals.filter(g => g.is_own_goal && g.goal_player_id === p.playerId).length,
          potm: p.playerId === topRated,
          slot: p.slot ?? null,
        };
      }),
    };
  };
  const lineupNow: any = current.lineup;
  const home = custom ? toPitchTeam(lineupNow.teamA, "sky", matchTeams[0]?.name ?? L("A팀", "Team A"), true) : toPitchTeam(lineupNow, "pink");
  const away = custom ? toPitchTeam(lineupNow.teamB, "orange", matchTeams[1]?.name ?? L("B팀", "Team B"), true) : undefined;
  const benchIds = custom ? [...benchOf(lineupNow.teamA), ...benchOf(lineupNow.teamB)] : benchOf(lineupNow);
  const sportKey: "futsal" | "soccer" = isSoccer ? "soccer" : "futsal";
  const selStats = sel !== null ? playerStats(sel) : null;
  const go = (d: number) => setIdx(i => Math.min(list.length - 1, Math.max(0, Math.min(i, list.length - 1) + d)));

  const QuarterChips = ({ dark = false }: { dark?: boolean }) => (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {list.map((q, i) => (
        <button
          key={q.quarter}
          onClick={() => setIdx(i)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            i === safeIdx ? "bg-foreground text-background" : dark ? "bg-white/10 text-white/80" : "bg-secondary/70 text-muted-foreground"
          }`}
        >
          {isEn ? `Q${q.quarter}` : `${q.quarter}Q`}
          <span className="ml-1.5 font-num opacity-70">{q.score_for}-{q.score_against}</span>
        </button>
      ))}
    </div>
  );

  const swipe = {
    drag: editing ? false : ("x" as const),
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.18,
    onDragEnd: (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x < -60) go(1);
      else if (info.offset.x > 60) go(-1);
    },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold" style={{ fontFamily: "inherit" }}>{L("라인업", "Lineup")}</h2>
          <p className="text-[11px] text-muted-foreground">{formatLabel(formatCode ?? DEFAULT_FORMAT, isEn)} · {L("좌우로 넘겨 쿼터 이동", "swipe to change quarter")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <button
              onClick={() => setEditing(e => !e)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${editing ? "border border-border text-muted-foreground" : "border border-primary/50 text-primary"}`}
            >
              {editing ? <X size={12} /> : <SlidersHorizontal size={12} />}
              {editing ? L("닫기", "Close") : L("포지션", "Positions")}
            </button>
          )}
          <button onClick={() => setFull(true)} className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background">
            <Maximize2 size={12} /> {L("크게 보기", "Full screen")}
          </button>
        </div>
      </div>

      {isAdmin && editing && matchId != null && (
        <AdminPositionPanel matchId={matchId} quarters={list} players={players} formatCode={formatCode ?? DEFAULT_FORMAT} />
      )}

      <QuarterChips />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.quarter}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          className="mt-2.5"
          {...swipe}
        >
          <FotmobPitch sport={sportKey} home={home} away={away} token={isSoccer ? (custom ? 30 : 36) : custom ? 40 : 54} onPlayer={setSel} />
        </motion.div>
      </AnimatePresence>

      {/* bench */}
      {benchIds.length > 0 && (
        <section className="surface mt-3 overflow-hidden rounded-2xl">
          <h3 className="px-4 pb-1 pt-3 text-[13px] font-bold" style={{ fontFamily: "inherit" }}>{L(`${current.quarter}쿼터 벤치`, `Bench · Q${current.quarter}`)}</h3>
          <div className="divide-y divide-white/[0.05]">
            {benchIds.map((id, i) => {
              const r = ratings?.get(id)?.rating;
              return (
                <button key={`${id}-${i}`} onClick={() => setSel(id)} className="flex w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary font-num text-xs font-bold">
                    {avatar(id) ? <img src={avatar(id)!} alt="" className="h-full w-full object-cover" /> : kit(id) ?? pn(id).charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{pn(id)}</span>
                  {r != null && <span className={`rounded-md px-1.5 font-num text-[11px] font-extrabold ${ratingTone(r)}`}>{r.toFixed(1)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* full-screen pop-up (portal: must sit above the bottom tab bar) */}
      {createPortal(<AnimatePresence>
        {full && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog"
            aria-modal
          >
            <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="text-[15px] font-bold">{L(`${current.quarter}쿼터 라인업`, `Quarter ${current.quarter} lineup`)}</div>
                <div className="font-num text-xs text-white/60">{current.score_for} - {current.score_against} · {home.formation}{away ? ` / ${away.formation}` : ""}</div>
              </div>
              <button onClick={() => setFull(false)} aria-label={L("닫기", "Close")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <X size={18} />
              </button>
            </div>
            <div className="mx-auto w-full max-w-lg px-4"><QuarterChips dark /></div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.quarter}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="h-full"
                  style={{ aspectRatio: isSoccer ? "68 / 105" : "25 / 42", maxWidth: "100%" }}
                  {...swipe}
                >
                  <FotmobPitch sport={sportKey} home={home} away={away} token={isSoccer ? (custom ? 34 : 44) : custom ? 46 : 64} onPlayer={id => { setFull(false); setSel(id); }} className="h-full" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-center gap-6 pb-4 text-white/80">
              <button onClick={() => go(-1)} disabled={safeIdx === 0} className="rounded-full bg-white/10 p-2.5 disabled:opacity-30" aria-label={L("이전 쿼터", "Previous quarter")}><ChevronLeft size={18} /></button>
              <span className="font-num text-sm">{safeIdx + 1} / {list.length}</span>
              <button onClick={() => go(1)} disabled={safeIdx === list.length - 1} className="rounded-full bg-white/10 p-2.5 disabled:opacity-30" aria-label={L("다음 쿼터", "Next quarter")}><ChevronRight size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

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
                        const code = slotMapOf(u)[String(sel)];
                        if (code) return slotLabel(code, isEn, formatCode);
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
