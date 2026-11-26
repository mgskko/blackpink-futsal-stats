import { memo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Users } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

export type MatchStatus = "win" | "draw" | "loss" | "scheduled";

interface Props {
  date: string;
  venue?: string;
  sportBadge: string;
  matchType: string;
  isCustom: boolean;
  customLabel: string;
  ourName: string;
  oppName: string;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  status: MatchStatus;
  statusLabel: string;
  attending?: number;
  index: number;
  isEn: boolean;
  onClick: () => void;
}

const TONE: Record<MatchStatus, { bar: string; chip: string; score: string }> = {
  win: { bar: "from-win/90 to-win/20", chip: "bg-win/15 text-win ring-win/30", score: "text-win" },
  draw: { bar: "from-draw/90 to-draw/20", chip: "bg-draw/15 text-draw ring-draw/30", score: "text-draw" },
  loss: { bar: "from-loss/90 to-loss/20", chip: "bg-loss/15 text-loss ring-loss/30", score: "text-loss" },
  scheduled: { bar: "from-muted-foreground/50 to-transparent", chip: "bg-muted text-muted-foreground ring-border", score: "text-muted-foreground" },
};

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function MatchCard(p: Props) {
  const d = parseLocalDate(p.date);
  const tone = TONE[p.status];
  const played = p.status !== "scheduled";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.45, delay: Math.min(p.index, 6) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={p.onClick}
      className="surface group relative flex w-full items-stretch overflow-hidden rounded-[22px] text-left"
    >
      {/* result rail */}
      <span aria-hidden className={`w-1 shrink-0 bg-gradient-to-b ${tone.bar}`} />

      {/* date block */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-white/[0.06] py-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {p.isEn ? `${d.toLocaleString("en", { month: "short" })}` : `${d.getMonth() + 1}월`}
        </span>
        <span className="font-num text-[26px] font-extrabold leading-none tracking-tight">{d.getDate()}</span>
        <span className="mt-0.5 text-[9px] font-semibold text-muted-foreground">{(p.isEn ? DOW_EN : DOW_KO)[d.getDay()]}</span>
      </div>

      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="shrink-0 rounded-md bg-secondary/70 px-1.5 py-px font-bold text-foreground/80">{p.sportBadge}</span>
          {p.isCustom && <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-px font-bold text-primary">{p.customLabel}</span>}
          <span className="truncate">{p.venue}</span>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="truncate text-[13px] font-bold">{p.ourName}</span>
          {played ? (
            <span className="flex items-center gap-1 font-num text-[22px] font-extrabold leading-none tracking-tight">
              <span className={p.status === "loss" ? "text-foreground/60" : tone.score}>{p.scoreFor ?? "-"}</span>
              <span className="text-sm text-muted-foreground/60">:</span>
              <span className={p.status === "loss" ? tone.score : "text-foreground/60"}>{p.scoreAgainst ?? "-"}</span>
            </span>
          ) : (
            <span className="font-display text-lg tracking-widest text-muted-foreground">VS</span>
          )}
          <span className="truncate text-right text-[13px] font-bold text-foreground/85">{p.oppName}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 pr-3">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${tone.chip}`}>{p.statusLabel}</span>
        {p.attending ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
            <Users size={10} /> {p.attending}
          </span>
        ) : (
          <span className="max-w-[56px] truncate text-[9px] uppercase tracking-wider text-muted-foreground">{p.matchType}</span>
        )}
      </div>
      <ChevronRight size={14} className="mr-2 self-center text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}

export default memo(MatchCard);
