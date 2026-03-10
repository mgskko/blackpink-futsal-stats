import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Player } from "@/hooks/useFutsalData";
import type { ScoutingReport } from "@/hooks/useAdvancedStats";

interface SeasonStats {
  goals: number;
  assists: number;
  attackPoints: number;
  appearances: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

interface Props {
  player: Player;
  year: string;
  stats: SeasonStats;
  scoutingReport: ScoutingReport;
  tierLabel: string;
  tierEmoji: string;
  onClose: () => void;
}

export default function SeasonWrapped({ player, year, stats, scoutingReport, tierLabel, tierEmoji, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${player.name}_${year}_wrapped.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Download failed", e);
    }
    setDownloading(false);
  };

  const handleShare = async () => {
    if (!cardRef.current || !navigator.share) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const file = new File([blob], `${player.name}_${year}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: `${player.name} ${year} Wrapped` });
    } catch (e) {
      console.error("Share failed", e);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="relative flex flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* The Card (9:16 ratio) */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-2xl"
            style={{ width: 360, height: 640 }}
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(330,80%,15%)] via-[hsl(330,60%,8%)] to-[hsl(0,0%,3%)]" />
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 30% 20%, hsl(330 100% 71% / 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, hsl(345 80% 81% / 0.3) 0%, transparent 50%)",
            }} />

            {/* Content */}
            <div className="relative flex h-full flex-col items-center justify-between p-8">
              {/* Header */}
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[hsl(330,100%,71%)]">
                  BUNNIES FUTSAL CLUB
                </div>
                <div className="mt-1 font-display text-5xl tracking-wider text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {year}
                </div>
                <div className="mt-0.5 text-xs tracking-[0.2em] text-[hsl(330,100%,71%)] uppercase">
                  Season Wrapped
                </div>
              </div>

              {/* Player */}
              <div className="text-center">
                <div className="text-4xl mb-1">{tierEmoji}</div>
                <div className="font-display text-3xl tracking-wider text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {player.name}
                </div>
                <div className="mt-1 rounded-full border border-[hsl(330,100%,71%)]/40 bg-[hsl(330,100%,71%)]/10 px-3 py-0.5 text-[10px] font-bold text-[hsl(330,100%,71%)]">
                  {tierLabel}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="w-full space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "골", value: stats.goals },
                    { label: "어시스트", value: stats.assists },
                    { label: "공격포인트", value: stats.attackPoints },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-white/5 p-3 text-center backdrop-blur-sm">
                      <div className="font-display text-2xl text-[hsl(330,100%,71%)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.value}</div>
                      <div className="text-[9px] text-white/60">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/5 p-3 text-center backdrop-blur-sm">
                    <div className="font-display text-2xl text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{stats.appearances}</div>
                    <div className="text-[9px] text-white/60">출전 경기</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center backdrop-blur-sm">
                    <div className="font-display text-2xl text-[hsl(330,100%,71%)]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{stats.winRate}%</div>
                    <div className="text-[9px] text-white/60">승률</div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 text-xs text-white/50">
                  <span>{stats.wins}승</span>
                  <span>{stats.draws}무</span>
                  <span>{stats.losses}패</span>
                </div>
              </div>

              {/* Scouting */}
              <div className="w-full rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{scoutingReport.emoji}</span>
                  <div>
                    <div className="text-xs font-bold text-[hsl(330,100%,71%)]">{scoutingReport.label}</div>
                    <div className="mt-0.5 text-[9px] text-white/60 leading-relaxed line-clamp-2">{scoutingReport.comment}</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-[8px] text-white/30 tracking-widest">
                BURNEES.LOVABLE.APP
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/40 text-primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={14} /> {downloading ? "저장 중..." : "이미지 저장"}
            </Button>
            {navigator.share && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/40 text-primary"
                onClick={handleShare}
              >
                <Share2 size={14} /> 공유하기
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onClose}
            >
              <X size={14} />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
