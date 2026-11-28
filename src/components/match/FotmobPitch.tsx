import { memo } from "react";
import { ratingTone } from "@/lib/matchRating";

export interface PitchPlayer {
  playerId: number;
  /** 0-100, left → right from the team's own perspective */
  x: number;
  /** 0-100, 0 = attacking end, 100 = own goal */
  y: number;
  name: string;
  kit: number | null;
  photo: string | null;
  rating: number | null;
  ratingAdjusted?: boolean;
  goals: number;
  assists: number;
  ownGoals?: number;
  potm?: boolean;
  slot?: string | null;
}

export interface PitchTeam {
  label?: string;
  formation?: string;
  players: PitchPlayer[];
  /** colour of the kit disc when there is no photo */
  kitColor: "pink" | "sky" | "orange";
}

interface Props {
  sport: "futsal" | "soccer";
  /** bottom team (attacks up). Optional top team (attacks down, mirrored) for intrasquad games. */
  home: PitchTeam;
  away?: PitchTeam;
  /** token size in px */
  token?: number;
  onPlayer?: (id: number) => void;
  className?: string;
}

const KIT: Record<PitchTeam["kitColor"], string> = {
  pink: "linear-gradient(160deg, hsl(330 95% 66%), hsl(330 75% 42%))",
  sky: "linear-gradient(160deg, hsl(205 90% 60%), hsl(215 70% 38%))",
  orange: "linear-gradient(160deg, hsl(28 95% 60%), hsl(18 80% 42%))",
};

/** Real pitch geometry: football 68×105, futsal court 25×42 (6 m penalty arcs). */
function Markings({ sport }: { sport: "futsal" | "soccer" }) {
  const line = { stroke: "rgba(255,255,255,0.38)", strokeWidth: sport === "soccer" ? 0.35 : 0.16, fill: "none" } as const;
  if (sport === "soccer") {
    const W = 68, H = 105;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="0.6" y="0.6" width={W - 1.2} height={H - 1.2} {...line} />
        <line x1="0.6" y1={H / 2} x2={W - 0.6} y2={H / 2} {...line} />
        <circle cx={W / 2} cy={H / 2} r="9.15" {...line} />
        <circle cx={W / 2} cy={H / 2} r="0.45" fill="rgba(255,255,255,0.55)" />
        {[0, 1].map(end => {
          const y0 = end ? H - 0.6 : 0.6;
          const d = end ? -1 : 1;
          return (
            <g key={end}>
              <rect x={(W - 40.3) / 2} y={end ? y0 - 16.5 : y0} width="40.3" height="16.5" {...line} />
              <rect x={(W - 18.3) / 2} y={end ? y0 - 5.5 : y0} width="18.3" height="5.5" {...line} />
              <circle cx={W / 2} cy={y0 + d * 11} r="0.45" fill="rgba(255,255,255,0.55)" />
              <path d={`M ${W / 2 - 7.3} ${y0 + d * 16.5} A 9.15 9.15 0 0 ${end ? 1 : 0} ${W / 2 + 7.3} ${y0 + d * 16.5}`} {...line} />
              <rect x={(W - 7.32) / 2} y={end ? y0 : y0 - 1.6} width="7.32" height="1.6" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.25" />
            </g>
          );
        })}
      </svg>
    );
  }
  const W = 25, H = 42;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect x="0.3" y="0.3" width={W - 0.6} height={H - 0.6} {...line} />
      <line x1="0.3" y1={H / 2} x2={W - 0.3} y2={H / 2} {...line} />
      <circle cx={W / 2} cy={H / 2} r="3" {...line} />
      <circle cx={W / 2} cy={H / 2} r="0.2" fill="rgba(255,255,255,0.55)" />
      {[0, 1].map(end => {
        const y0 = end ? H - 0.3 : 0.3;
        const d = end ? -1 : 1;
        const sweep = end ? 1 : 0;
        // two 6 m quarter circles joined by a 3.16 m line in front of the 3 m goal
        return (
          <g key={end}>
            <path d={`M ${W / 2 - 1.58 - 6} ${y0} A 6 6 0 0 ${1 - sweep} ${W / 2 - 1.58} ${y0 + d * 6} L ${W / 2 + 1.58} ${y0 + d * 6} A 6 6 0 0 ${1 - sweep} ${W / 2 + 1.58 + 6} ${y0}`} {...line} />
            <circle cx={W / 2} cy={y0 + d * 6} r="0.2" fill="rgba(255,255,255,0.55)" />
            <circle cx={W / 2} cy={y0 + d * 10} r="0.2" fill="rgba(255,255,255,0.55)" />
            <rect x={W / 2 - 1.5} y={end ? y0 : y0 - 0.8} width="3" height="0.8" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.12" />
          </g>
        );
      })}
    </svg>
  );
}

function Token({ p, size, kit, onPlayer }: { p: PitchPlayer; size: number; kit: string; onPlayer?: (id: number) => void }) {
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        onPlayer?.(p.playerId);
      }}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${p.x}%`, top: `${p.y}%`, width: size * 1.9 }}
    >
      <span className="relative block" style={{ width: size, height: size }}>
        <span
          className="block h-full w-full overflow-hidden rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.45)] ring-2 ring-white/90 transition-transform group-active:scale-95"
          style={{ background: p.photo ? "#0b0b10" : kit }}
        >
          {p.photo ? (
            <img src={p.photo} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-num font-black text-white" style={{ fontSize: size * 0.4 }}>
              {p.kit ?? p.name.charAt(0)}
            </span>
          )}
        </span>
        {p.rating != null && (
          <span
            className={`absolute -right-2.5 -top-1 rounded-md px-1 font-num font-extrabold leading-[1.35] shadow ${ratingTone(p.rating)} ${p.ratingAdjusted ? "ring-1 ring-white" : ""}`}
            style={{ fontSize: Math.max(9, size * 0.24) }}
          >
            {p.rating.toFixed(1)}
          </span>
        )}
        {p.potm && <span className="absolute -left-2 -top-1.5 text-[13px] drop-shadow">⭐</span>}
        {(p.goals > 0 || p.assists > 0 || (p.ownGoals ?? 0) > 0) && (
          <span className="absolute -bottom-1 -left-2.5 flex gap-px">
            {Array.from({ length: Math.min(3, p.goals) }).map((_, i) => (
              <span key={`g${i}`} className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] shadow">⚽</span>
            ))}
            {Array.from({ length: Math.min(2, p.ownGoals ?? 0) }).map((_, i) => (
              <span key={`o${i}`} className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] shadow">⚽</span>
            ))}
          </span>
        )}
        {p.assists > 0 && (
          <span className="absolute -bottom-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-0.5 font-num text-[9px] font-black text-white shadow">
            A{p.assists > 1 ? p.assists : ""}
          </span>
        )}
      </span>
      <span
        className="mt-1 max-w-full truncate rounded px-1 text-center font-semibold leading-tight text-white"
        style={{ fontSize: Math.max(10, size * 0.24), textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {p.kit != null && p.photo && <span className="mr-0.5 font-num opacity-70">{p.kit}</span>}
        {p.name}
      </span>
    </button>
  );
}

/**
 * FotMob-style lineup pitch. One team fills the whole pitch; with `away`, the
 * pitch is split (home bottom attacking up, away top attacking down).
 */
function FotmobPitch({ sport, home, away, token = 46, onPlayer, className }: Props) {
  const aspect = sport === "soccer" ? "68 / 105" : "25 / 42";
  const place = (p: PitchPlayer, side: "full" | "home" | "away"): PitchPlayer => {
    const x = Math.min(92, Math.max(8, p.x));
    const y = Math.min(94, Math.max(6, p.y));
    if (side === "full") return { ...p, x, y: 4 + y * 0.9 };
    if (side === "home") return { ...p, x, y: 52 + y * 0.45 };
    return { ...p, x: 100 - x, y: 48 - y * 0.45 };
  };
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${className ?? ""}`}
      style={{
        aspectRatio: aspect,
        backgroundColor: "#1c4a33",
        backgroundImage: [
          "radial-gradient(120% 70% at 50% 50%, rgba(255,255,255,0.06), transparent 70%)",
          `repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 ${100 / 14}%, rgba(0,0,0,0.035) ${100 / 14}% ${200 / 14}%)`,
          "linear-gradient(180deg, #1f5238, #18412d)",
        ].join(","),
        boxShadow: "inset 0 0 60px rgba(0,0,0,0.35)",
      }}
    >
      <Markings sport={sport} />
      {away?.label && (
        <span className="absolute left-2 top-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
          {away.label}{away.formation ? ` · ${away.formation}` : ""}
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
        {home.label ? `${home.label}${home.formation ? " · " : ""}` : ""}{home.formation}
      </span>
      {home.players.map(p => (
        <Token key={`h${p.playerId}`} p={place(p, away ? "home" : "full")} size={token} kit={KIT[home.kitColor]} onPlayer={onPlayer} />
      ))}
      {away?.players.map(p => (
        <Token key={`a${p.playerId}`} p={place(p, "away")} size={token} kit={KIT[away.kitColor]} onPlayer={onPlayer} />
      ))}
    </div>
  );
}

export default memo(FotmobPitch);
