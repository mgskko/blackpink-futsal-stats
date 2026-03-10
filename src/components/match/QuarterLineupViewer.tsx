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

function isCustomLineup(lineup: any): boolean {
  return lineup && typeof lineup === "object" && !Array.isArray(lineup) && (lineup.teamA || lineup.teamB);
}

function getPositionsFromFlat(lineup: any) {
  if (!lineup) return [];
  const positions: { playerId: number; x: number; y: number; role: string }[] = [];

  const extract = (key: string, targetY: number) => {
    const raw = lineup[key] || lineup[key.toUpperCase()];
    if (!raw) return [];
    const ids = (Array.isArray(raw) ? raw : [raw]).map(Number);
    return ids.map((id: number, i: number) => {
      const count = ids.length;
      const x = count === 1 ? 50 : key.toLowerCase() === "gk" ? 50 : 20 + (60 / (count - 1)) * i;
      return { playerId: id, x, y: targetY, role: key.toUpperCase() };
    });
  };

  // Try both casings
  positions.push(...extract("GK", 88));
  positions.push(...extract("DF", 72));
  positions.push(...extract("MF", 52));
  positions.push(...extract("FW", 30));

  // Also try lowercase
  if (positions.length === 0) {
    positions.push(...extract("gk", 88));
    positions.push(...extract("df", 72));
    positions.push(...extract("mf", 52));
    positions.push(...extract("fw", 30));
  }
  return positions;
}

function getBenchFromFlat(lineup: any): number[] {
  if (!lineup) return [];
  const raw = lineup.Bench || lineup.bench;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(Number);
}

function renderField(positions: { playerId: number; x: number; y: number; role: string }[], players: Player[], bench: number[], label?: string, borderColor?: string) {
  return (
    <div className={`flex-1 ${borderColor ? `border-t-2 ${borderColor}` : ""}`}>
      {label && <div className="text-[10px] font-bold text-center py-1 text-muted-foreground">{label}</div>}
      <div className="relative w-full rounded-xl border border-green-800/50 overflow-hidden"
        style={{ aspectRatio: "3/4", background: "linear-gradient(180deg, #1a4d1a 0%, #1f5c1f 30%, #1a4d1a 50%, #1f5c1f 70%, #1a4d1a 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-white/20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-b border-l border-r border-white/15 rounded-b-lg" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-t border-l border-r border-white/15 rounded-t-lg" />
        </div>
        {positions.map((p, idx) => (
          <div key={`${p.playerId}-${p.role}-${idx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-10"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[8px] font-bold shadow-lg ${ROLE_COLORS[p.role] || "bg-muted text-foreground"}`}>
              {p.role}
            </div>
            <span className="text-[8px] text-white font-medium drop-shadow-lg whitespace-nowrap">
              {getPlayerName(players, p.playerId)}
            </span>
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <div className="mt-1 flex items-center gap-1 px-1">
          <span className="text-[9px] text-muted-foreground font-bold">벤치:</span>
          <div className="flex flex-wrap gap-0.5">
            {bench.map((id: number, i: number) => (
              <span key={`bench-${id}-${i}`} className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {getPlayerName(players, id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuarterLineupViewer({ quarters, players }: Props) {
  const quartersWithLineup = quarters.filter(q => {
    if (!q.lineup || typeof q.lineup !== "object") return false;
    if (isCustomLineup(q.lineup)) return true;
    return Object.keys(q.lineup).length > 0 && ((q.lineup as any).GK || (q.lineup as any).gk);
  });
  const [selectedQ, setSelectedQ] = useState(quartersWithLineup[0]?.quarter ?? 1);

  if (quartersWithLineup.length === 0) return null;

  const current = quartersWithLineup.find(q => q.quarter === selectedQ) || quartersWithLineup[0];
  const isCustom = isCustomLineup(current.lineup);

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

      {isCustom ? (
        <div className="grid grid-cols-2 gap-2">
          {renderField(
            getPositionsFromFlat(current.lineup.teamA),
            players,
            getBenchFromFlat(current.lineup.teamA),
            `🅰️ ${current.lineup.teamA?.formation || ""}`,
            "border-blue-500"
          )}
          {renderField(
            getPositionsFromFlat(current.lineup.teamB),
            players,
            getBenchFromFlat(current.lineup.teamB),
            `🅱️ ${current.lineup.teamB?.formation || ""}`,
            "border-orange-500"
          )}
        </div>
      ) : (
        <>
          {renderField(
            getPositionsFromFlat(current.lineup),
            players,
            getBenchFromFlat(current.lineup)
          )}
        </>
      )}
    </motion.div>
  );
}
