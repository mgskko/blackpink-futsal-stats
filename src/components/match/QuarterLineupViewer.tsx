import { useState } from "react";
import { motion } from "framer-motion";
import { getPlayerName } from "@/hooks/useFutsalData";
import type { Player } from "@/hooks/useFutsalData";

interface MatchQuarter {
  id: number;
  match_id: number;
  quarter: number;
  score_for: number;
  score_against: number;
  lineup: any;
}

interface Props {
  quarters: MatchQuarter[];
  players: Player[];
}

const ROLE_COLORS: Record<string, string> = {
  GK: "bg-yellow-500/80 text-yellow-950",
  DF: "bg-blue-500/80 text-blue-950",
  MF: "bg-green-500/80 text-green-950",
  FW: "bg-red-500/80 text-red-950",
};

function getPositions(lineup: any) {
  if (!lineup) return [];
  const positions: { playerId: number; x: number; y: number; role: string }[] = [];

  if (lineup.gk) {
    lineup.gk.forEach((id: number) => positions.push({ playerId: id, x: 50, y: 88, role: "GK" }));
  }
  if (lineup.df) {
    const count = lineup.df.length;
    lineup.df.forEach((id: number, i: number) => {
      const x = count === 1 ? 50 : 25 + (50 / (count - 1)) * i;
      positions.push({ playerId: id, x, y: 72, role: "DF" });
    });
  }
  if (lineup.mf) {
    const count = lineup.mf.length;
    lineup.mf.forEach((id: number, i: number) => {
      const x = count === 1 ? 50 : 30 + (40 / (count - 1)) * i;
      positions.push({ playerId: id, x, y: 52, role: "MF" });
    });
  }
  if (lineup.fw) {
    const count = lineup.fw.length;
    lineup.fw.forEach((id: number, i: number) => {
      const x = count === 1 ? 50 : count === 2 ? 30 + 40 * i : count === 3 ? 20 + 30 * i : 15 + (70 / (count - 1)) * i;
      positions.push({ playerId: id, x, y: 30, role: "FW" });
    });
  }
  return positions;
}

export default function QuarterLineupViewer({ quarters, players }: Props) {
  const quartersWithLineup = quarters.filter(q => q.lineup && typeof q.lineup === "object" && Object.keys(q.lineup).length > 0);
  const [selectedQ, setSelectedQ] = useState(quartersWithLineup[0]?.quarter ?? 1);

  if (quartersWithLineup.length === 0) return null;

  const current = quartersWithLineup.find(q => q.quarter === selectedQ) || quartersWithLineup[0];
  const positions = getPositions(current.lineup);
  const bench: number[] = current.lineup?.bench || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="mb-3 font-display text-lg tracking-wider text-primary">QUARTER LINEUP</h2>

      {/* Quarter tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {quartersWithLineup.map(q => (
          <button key={q.quarter} onClick={() => setSelectedQ(q.quarter)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
              selectedQ === q.quarter ? "gradient-pink text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
            }`}>
            {q.quarter}Q
            <span className="ml-1 text-[10px] opacity-70">{q.score_for}-{q.score_against}</span>
          </button>
        ))}
      </div>

      {/* Field */}
      <div className="relative w-full rounded-xl border border-green-800/50 overflow-hidden"
        style={{ aspectRatio: "3/4", background: "linear-gradient(180deg, #1a4d1a 0%, #1f5c1f 30%, #1a4d1a 50%, #1f5c1f 70%, #1a4d1a 100%)" }}>
        {/* Field markings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-b border-l border-r border-white/15 rounded-b-lg" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-t border-l border-r border-white/15 rounded-t-lg" />
        </div>

        {/* Players */}
        {positions.map((p, idx) => (
          <div key={`${p.playerId}-${p.role}-${idx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-10"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[9px] font-bold shadow-lg ${ROLE_COLORS[p.role] || "bg-muted text-foreground"}`}>
              {p.role}
            </div>
            <span className="text-[9px] text-white font-medium drop-shadow-lg whitespace-nowrap">
              {getPlayerName(players, p.playerId)}
            </span>
          </div>
        ))}
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div className="mt-2 flex items-center gap-2 px-2">
          <span className="text-[10px] text-muted-foreground font-bold">벤치:</span>
          <div className="flex flex-wrap gap-1">
            {bench.map((id: number, i: number) => (
              <span key={`bench-${id}-${i}`} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                {getPlayerName(players, id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
