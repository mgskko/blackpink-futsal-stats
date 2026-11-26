import { motion } from "framer-motion";
import { CalendarClock, MapPin, Users } from "lucide-react";
import LazyBall3D from "@/components/fx/LazyBall3D";
import Tilt3D from "@/components/fx/Tilt3D";
import { parseLocalDate } from "@/lib/utils";

export type ResultKind = "win" | "draw" | "loss";

export interface SeasonRecord {
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  /** most-recent first */
  form: ResultKind[];
}

export interface NextFixture {
  id: number;
  date: string;
  opponent: string;
  venue?: string;
  attending?: number;
}

interface Props {
  record: SeasonRecord;
  next?: NextFixture | null;
  isEn: boolean;
  onOpenMatch?: (id: number) => void;
}

const FORM_STYLE: Record<ResultKind, string> = {
  win: "bg-win text-white",
  draw: "bg-draw text-black",
  loss: "bg-loss text-white",
};

function dDay(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((parseLocalDate(date).getTime() - today.getTime()) / 86_400_000);
  return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** Club record hero: win-rate ring, W/D/L split, last-5 form and the next fixture, with a live 3D ball. */
export default function SeasonHero({ record, next, isEn, onOpenMatch }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const decided = record.win + record.draw + record.loss;
  const winRate = decided ? Math.round((record.win / decided) * 100) : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const seg = (n: number) => (decided ? (n / decided) * C : 0);
  const gd = record.goalsFor - record.goalsAgainst;

  return (
    <Tilt3D max={6} wrapperClassName="mx-4" className="liquid-glass overflow-hidden rounded-[28px]">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative flex items-center gap-4 p-5 pb-4" style={{ transformStyle: "preserve-3d" }}>
        {/* Win-rate ring split into W / D / L arcs */}
        <div className="relative h-[88px] w-[88px] shrink-0" style={{ transform: "translateZ(24px)" }}>
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
            {[
              { n: record.win, off: 0, c: "hsl(var(--win))" },
              { n: record.draw, off: seg(record.win), c: "hsl(var(--draw))" },
              { n: record.loss, off: seg(record.win) + seg(record.draw), c: "hsl(var(--loss))" },
            ].map((s, i) =>
              s.n > 0 ? (
                <motion.circle
                  key={i}
                  cx="40"
                  cy="40"
                  r={R}
                  fill="none"
                  stroke={s.c}
                  strokeWidth="7"
                  strokeLinecap="butt"
                  strokeDasharray={`${seg(s.n)} ${C}`}
                  initial={{ strokeDashoffset: seg(s.n) }}
                  animate={{ strokeDashoffset: -s.off }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-num text-2xl font-extrabold leading-none tracking-tight">{winRate}<span className="text-sm">%</span></span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{L("승률", "Win")}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1" style={{ transform: "translateZ(16px)" }}>
          <div className="eyebrow">{L("클럽 전적", "Club record")}</div>
          <div className="mt-1 flex items-baseline gap-2 font-num">
            <span className="text-3xl font-extrabold tracking-tight">{record.played}</span>
            <span className="text-xs font-semibold text-muted-foreground">{L("경기", "played")}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 font-num text-[13px] font-bold">
            <span className="text-win">{record.win}{L("승", "W")}</span>
            <span className="text-draw">{record.draw}{L("무", "D")}</span>
            <span className="text-loss">{record.loss}{L("패", "L")}</span>
          </div>
          <div className="mt-1 font-num text-[11px] text-muted-foreground">
            {L("득", "GF")} {record.goalsFor} · {L("실", "GA")} {record.goalsAgainst} ·{" "}
            <span className={gd > 0 ? "text-win" : gd < 0 ? "text-loss" : ""}>{gd > 0 ? `+${gd}` : gd}</span>
          </div>
        </div>

        {/* floating 3D ball */}
        <div className="relative -my-4 -mr-3 shrink-0" style={{ transform: "translateZ(50px)" }}>
          <LazyBall3D size={96} spin={0.8} />
        </div>
      </div>

      {record.form.length > 0 && (
        <div className="relative flex items-center justify-between border-t border-white/10 px-5 py-3">
          <span className="eyebrow">{L("최근 폼", "Form")}</span>
          <div className="flex gap-1.5">
            {record.form.map((f, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 500, damping: 24 }}
                className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black shadow-sm ${FORM_STYLE[f]} ${i === 0 ? "ring-2 ring-white/60" : ""}`}
              >
                {f === "win" ? L("승", "W") : f === "draw" ? L("무", "D") : L("패", "L")}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {next && (
        <button
          onClick={() => onOpenMatch?.(next.id)}
          className="relative flex w-full items-center gap-3 border-t border-white/10 bg-primary/[0.07] px-5 py-3 text-left transition-colors hover:bg-primary/[0.12]"
        >
          <span className="rounded-lg gradient-pink px-2 py-1 font-num text-[11px] font-extrabold text-primary-foreground">{dDay(next.date)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold">
              {L("다음 경기", "Next")} · vs {next.opponent}
            </div>
            <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarClock size={11} />{next.date}</span>
              {next.venue && <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={11} />{next.venue}</span>}
            </div>
          </div>
          {next.attending ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Users size={11} /> {next.attending}
            </span>
          ) : null}
        </button>
      )}
    </Tilt3D>
  );
}
