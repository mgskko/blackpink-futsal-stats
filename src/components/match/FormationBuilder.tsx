import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlayerName } from "@/hooks/useFutsalData";
import type { Player, Roster, Team } from "@/hooks/useFutsalData";

interface Props {
  matchId: number;
  players: Player[];
  roster: Roster[];
  matchTeams: Team[];
  isAdmin: boolean;
}

interface PlacedPlayer {
  playerId: number;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
}

const ZONES = [
  { label: "GK", y: 88, color: "hsl(45 80% 50%)" },
  { label: "DEF", y: 70, color: "hsl(200 60% 50%)" },
  { label: "MID", y: 45, color: "hsl(140 50% 45%)" },
  { label: "FWD", y: 22, color: "hsl(330 100% 71%)" },
];

export default function FormationBuilder({ matchId, players, roster, matchTeams, isAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [placed, setPlaced] = useState<PlacedPlayer[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const ourRoster = roster.filter(r => matchTeams.some(t => t.is_ours && t.id === r.team_id));
  const unplaced = ourRoster.filter(r => !placed.find(p => p.playerId === r.player_id));

  const handleFieldClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId === null) return;
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPlaced(prev => [...prev.filter(p => p.playerId !== draggingId), { playerId: draggingId, x, y }]);
    setDraggingId(null);
  }, [draggingId]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (draggingId === null || !fieldRef.current) return;
    const touch = e.touches[0];
    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100));
    setPlaced(prev => [...prev.filter(p => p.playerId !== draggingId), { playerId: draggingId, x, y }]);
  }, [draggingId]);

  const handleTouchEnd = () => setDraggingId(null);

  const removePlaced = (playerId: number) => {
    setPlaced(prev => prev.filter(p => p.playerId !== playerId));
  };

  const handleDownload = async () => {
    if (!fieldRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(fieldRef.current, { backgroundColor: null, scale: 3 });
      const link = document.createElement("a");
      link.download = `formation_match_${matchId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error(e); }
    setDownloading(false);
  };

  if (!isOpen) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-card py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Users size={16} /> 포메이션 빌더
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-lg text-primary">⚽ FORMATION BUILDER</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setPlaced([])}>
            <RotateCcw size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setIsOpen(false)}>
            닫기
          </Button>
        </div>
      </div>

      {/* Field */}
      <div
        ref={fieldRef}
        className="relative mx-4 my-3 rounded-lg overflow-hidden select-none"
        style={{
          aspectRatio: "3/4",
          background: "linear-gradient(180deg, hsl(120 40% 22%) 0%, hsl(120 35% 18%) 100%)",
          cursor: draggingId !== null ? "crosshair" : "default",
        }}
        onClick={handleFieldClick}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Field lines */}
        <div className="absolute inset-2 rounded-md border-2 border-white/20" />
        <div className="absolute left-2 right-2 top-1/2 h-px bg-white/20" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20" />
        {/* Penalty areas */}
        <div className="absolute bottom-2 left-1/2 h-[22%] w-[60%] -translate-x-1/2 border-2 border-b-0 border-white/15 rounded-t-md" />
        <div className="absolute top-2 left-1/2 h-[22%] w-[60%] -translate-x-1/2 border-2 border-t-0 border-white/15 rounded-b-md" />
        {/* Goal areas */}
        <div className="absolute bottom-2 left-1/2 h-[10%] w-[30%] -translate-x-1/2 border-2 border-b-0 border-white/10 rounded-t-sm" />
        <div className="absolute top-2 left-1/2 h-[10%] w-[30%] -translate-x-1/2 border-2 border-t-0 border-white/10 rounded-b-sm" />

        {/* Zone labels */}
        {ZONES.map(z => (
          <div
            key={z.label}
            className="absolute left-1 text-[8px] font-bold uppercase opacity-30"
            style={{ top: `${z.y}%`, color: z.color }}
          >
            {z.label}
          </div>
        ))}

        {/* Placed players */}
        {placed.map(p => (
          <div
            key={p.playerId}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={(e) => { e.stopPropagation(); if (!isAdmin) return; }}
            onDoubleClick={(e) => { e.stopPropagation(); removePlaced(p.playerId); }}
            onTouchStart={(e) => { e.stopPropagation(); setDraggingId(p.playerId); }}
            onMouseDown={(e) => { e.stopPropagation(); setDraggingId(p.playerId); }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 text-[10px] font-bold text-primary-foreground">
              {getPlayerName(players, p.playerId).slice(0, 1)}
            </div>
            <span className="mt-0.5 rounded bg-black/60 px-1 py-px text-[8px] font-bold text-white whitespace-nowrap">
              {getPlayerName(players, p.playerId)}
            </span>
          </div>
        ))}
      </div>

      {/* Bench */}
      {unplaced.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-[10px] font-bold text-muted-foreground">
            {draggingId !== null ? "⬆️ 필드를 터치하여 배치" : "선수를 탭하여 배치 시작"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map(r => (
              <button
                key={r.player_id}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  draggingId === r.player_id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                onClick={() => setDraggingId(draggingId === r.player_id ? null : r.player_id)}
              >
                {getPlayerName(players, r.player_id)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-3 text-[9px] text-muted-foreground">
        💡 선수 탭 → 필드 터치로 배치 | 더블탭으로 제거 | 드래그로 이동
      </div>
    </motion.div>
  );
}
