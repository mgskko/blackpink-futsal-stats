import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Player } from "@/hooks/useFutsalData";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import RatingBadge from "@/components/player/RatingBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface LeaderRow {
  player: Player;
  name: string;
  value: number;
  /** secondary text, e.g. "20경기" */
  sub?: string;
}

interface Props {
  title: string;
  rows: LeaderRow[];
  /** render value as a rating chip */
  rating?: boolean;
  suffix?: string;
  decimals?: number;
  emptyText: string;
  allLabel: string;
}

const fmt = (v: number, d = 0, suffix = "") => `${d ? v.toFixed(d) : v}${suffix}`;

/** FotMob "top stats" card: leader spotlight + #2–#3, full table in a sheet. */
export default function Leaderboard({ title, rows, rating, suffix = "", decimals = 0, emptyText, allLabel }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [first, ...rest] = rows;
  const Value = ({ r, big }: { r: LeaderRow; big?: boolean }) =>
    rating ? (
      <RatingBadge value={r.value} size={big ? "lg" : "md"} />
    ) : (
      <span className={`font-num font-extrabold tabular-nums ${big ? "text-[28px] leading-none text-primary" : "text-base"}`}>{fmt(r.value, decimals, suffix)}</span>
    );

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <h3 className="px-4 pt-3.5 text-[14px] font-bold" style={{ fontFamily: "inherit" }}>{title}</h3>
      {!first ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <button onClick={() => navigate(`/player/${first.player.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <div className="relative">
              <PlayerAvatar player={first.player} size={52} ring />
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full gradient-pink text-[10px] font-black text-primary-foreground">1</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-bold">{first.name}</div>
              {first.sub && <div className="text-[11px] text-muted-foreground">{first.sub}</div>}
            </div>
            <Value r={first} big />
          </button>
          <div className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
            {rest.slice(0, 2).map((r, i) => (
              <button key={r.player.id} onClick={() => navigate(`/player/${r.player.id}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03]">
                <span className="w-4 text-center font-num text-xs font-bold text-muted-foreground">{i + 2}</span>
                <PlayerAvatar player={r.player} size={28} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.name}</span>
                <Value r={r} />
              </button>
            ))}
          </div>
          {rows.length > 3 && (
            <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1 border-t border-white/[0.05] py-2.5 text-xs font-bold text-primary">
              {allLabel} <ChevronRight size={13} />
            </button>
          )}
        </>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-left">{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-2 divide-y divide-border">
            {rows.map((r, i) => (
              <button key={r.player.id} onClick={() => { setOpen(false); navigate(`/player/${r.player.id}`); }} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className={`w-5 text-center font-num text-xs font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                <PlayerAvatar player={r.player} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  {r.sub && <span className="block text-[10px] text-muted-foreground">{r.sub}</span>}
                </span>
                <Value r={r} />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
