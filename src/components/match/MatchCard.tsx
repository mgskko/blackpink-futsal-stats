import { memo } from "react";
import { Users } from "lucide-react";
import burneesLogo from "@/assets/burnees-logo.png";
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

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RESULT_PILL: Record<Exclude<MatchStatus, "scheduled">, string> = {
  win: "bg-win text-white",
  draw: "bg-draw text-black",
  loss: "bg-loss text-white",
};

function Crest({ name, ours }: { name: string; ours?: boolean }) {
  if (ours) return <img src={burneesLogo} alt="" className="h-5 w-5 shrink-0 rounded-full" />;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
      style={{ background: `linear-gradient(145deg, hsl(${h} 65% 52%), hsl(${(h + 40) % 360} 55% 30%))` }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

/** SofaScore-style dense row: date | stacked teams | stacked score | result pill. */
function MatchCard(p: Props) {
  const d = parseLocalDate(p.date);
  const played = p.status !== "scheduled";
  const ourWin = p.status === "win";
  const oppWin = p.status === "loss";

  return (
    <button
      type="button"
      onClick={p.onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
    >
      <div className="flex w-11 shrink-0 flex-col items-center border-r border-white/[0.06] pr-3 text-center">
        <span className="font-num text-[13px] font-bold leading-tight">
          {d.getMonth() + 1}.{d.getDate()}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">{(p.isEn ? DOW_EN : DOW_KO)[d.getDay()]}</span>
        <span className={`mt-0.5 text-[9px] font-bold ${played ? "text-muted-foreground" : "text-primary"}`}>{played ? (p.isEn ? "FT" : "종료") : p.statusLabel}</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Crest name={p.ourName} ours={!p.isCustom} />
          <span className={`truncate text-[14px] ${!played || ourWin || p.status === "draw" ? "font-bold" : "font-medium text-foreground/60"}`}>{p.ourName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Crest name={p.oppName} />
          <span className={`truncate text-[14px] ${!played || oppWin || p.status === "draw" ? "font-bold" : "font-medium text-foreground/60"}`}>{p.oppName}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="shrink-0">{p.sportBadge}</span>
          {p.isCustom && <span className="shrink-0 font-bold text-primary">{p.customLabel}</span>}
          {p.venue && <span className="truncate">· {p.venue}</span>}
        </div>
      </div>

      {played ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex flex-col items-end gap-1.5 font-num text-[17px] font-extrabold leading-5 tabular-nums">
            <span className={ourWin || p.status === "draw" ? "" : "text-foreground/50"}>{p.scoreFor ?? "-"}</span>
            <span className={oppWin || p.status === "draw" ? "" : "text-foreground/50"}>{p.scoreAgainst ?? "-"}</span>
          </div>
          <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black ${RESULT_PILL[p.status as Exclude<MatchStatus, "scheduled">]}`}>
            {p.statusLabel}
          </span>
        </div>
      ) : p.attending ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[11px] font-bold text-primary">
          <Users size={11} /> {p.attending}
        </span>
      ) : null}
    </button>
  );
}

export default memo(MatchCard);
