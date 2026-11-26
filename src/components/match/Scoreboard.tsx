import { motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";
import burneesLogo from "@/assets/burnees-logo.png";
import Tilt3D, { Float3D } from "@/components/fx/Tilt3D";

interface Props {
  ourName: string;
  oppName: string;
  scoreFor: number | null;
  scoreAgainst: number | null;
  /** DB label: 승 / 무 / 패 */
  result: string | null;
  resultLabel: string | null;
  scheduled: boolean;
  date: string;
  venue?: string;
  matchType: string;
  isCustom: boolean;
  ageGroup?: string | null;
  isEn: boolean;
}

const crest = (name: string) => {
  const ch = name.trim().charAt(0) || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { ch, hue: h };
};

/** Broadcast-style 3D scoreboard for the match detail hero. */
export default function Scoreboard(p: Props) {
  const L = (ko: string, en: string) => (p.isEn ? en : ko);
  const opp = crest(p.oppName);
  const tone =
    p.result === "승" ? "win" : p.result === "패" ? "loss" : p.result === "무" ? "draw" : null;
  const toneText = tone ? `text-${tone}` : "text-muted-foreground";
  const glow = tone === "win" ? "hsl(var(--win))" : tone === "loss" ? "hsl(var(--loss))" : tone === "draw" ? "hsl(var(--draw))" : "hsl(var(--primary))";

  return (
    <Tilt3D max={7} wrapperClassName="mx-4 mt-4" className="liquid-glass overflow-hidden rounded-[28px]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-64 rounded-full opacity-40 blur-3xl" style={{ background: glow }} />
      <div className="relative px-5 pb-5 pt-6" style={{ transformStyle: "preserve-3d" }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* our crest */}
          <Float3D z={30} className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-full bg-primary/40 blur-md" aria-hidden />
              <img src={burneesLogo} alt="" className="relative h-14 w-14 rounded-full ring-2 ring-white/25" />
            </div>
            <span className="max-w-[7rem] truncate text-center text-[13px] font-bold">{p.ourName}</span>
          </Float3D>

          {/* score */}
          <Float3D z={50} className="flex flex-col items-center">
            {p.scheduled && p.scoreFor === null ? (
              <span className="font-display text-5xl tracking-widest text-muted-foreground">VS</span>
            ) : (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                className="flex items-center gap-2 font-num text-[52px] font-black leading-none tracking-tighter"
              >
                <span className={p.result === "패" ? "text-foreground/45" : "text-foreground"}>{p.scoreFor ?? "-"}</span>
                <span className="pb-2 text-2xl text-muted-foreground/50">:</span>
                <span className={p.result === "승" ? "text-foreground/45" : "text-foreground"}>{p.scoreAgainst ?? "-"}</span>
              </motion.div>
            )}
            {p.resultLabel ? (
              <span className={`mt-2 rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-widest ring-1 ring-white/10 ${toneText}`} style={{ backgroundColor: `color-mix(in srgb, ${glow} 14%, transparent)` }}>
                {tone === "win" ? L("승리", "WIN") : tone === "loss" ? L("패배", "LOSS") : tone === "draw" ? L("무승부", "DRAW") : p.resultLabel}
              </span>
            ) : p.scheduled ? (
              <span className="mt-2 rounded-full bg-muted px-3 py-0.5 text-[11px] font-bold text-muted-foreground">{L("경기 예정", "UPCOMING")}</span>
            ) : null}
          </Float3D>

          {/* opponent crest */}
          <Float3D z={30} className="flex flex-col items-center gap-2">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl text-white ring-2 ring-white/20"
              style={{ background: `linear-gradient(145deg, hsl(${opp.hue} 70% 55%), hsl(${(opp.hue + 40) % 360} 60% 28%))` }}
            >
              {opp.ch}
            </div>
            <span className="max-w-[7rem] truncate text-center text-[13px] font-bold text-foreground/85">{p.oppName}</span>
          </Float3D>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarDays size={11} />{p.date}</span>
          {p.venue && <span className="flex items-center gap-1"><MapPin size={11} />{p.venue}</span>}
          <span className="rounded-md bg-secondary/70 px-1.5 py-px font-semibold text-foreground/80">{p.matchType}</span>
          {p.isCustom && <span className="rounded-md bg-primary/15 px-1.5 py-px font-bold text-primary">{L("자체전", "Intrasquad")}</span>}
          {p.ageGroup && <span>{L("상대 연령대", "Age group")}: {p.ageGroup}</span>}
        </div>
      </div>
    </Tilt3D>
  );
}
