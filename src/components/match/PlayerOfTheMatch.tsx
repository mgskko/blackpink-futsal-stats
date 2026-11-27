import { motion } from "framer-motion";
import type { Player } from "@/hooks/useFutsalData";
import type { MatchRatingDetail } from "@/lib/matchRating";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import RatingBadge from "@/components/player/RatingBadge";

const GROUP_KO: Record<string, string> = { GK: "골키퍼", DF: "수비수", MF: "미드필더", W: "윙어", FW: "공격수" };

/** FotMob "Player of the Match" card, driven by the unified match rating. */
export default function PlayerOfTheMatch({ player, detail, name, teamLabel, isEn, onOpen }: { player: Player; detail?: MatchRatingDetail; name: string; teamLabel?: string; isEn: boolean; onOpen: () => void }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className="surface relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-4 text-left"
    >
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative">
        <PlayerAvatar player={player} size={56} ring />
        <span className="absolute -bottom-1 -right-1 text-lg">👑</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
          {L("오늘의 선수", "Player of the Match")}{teamLabel ? ` · ${teamLabel}` : ""}
        </div>
        <div className="truncate text-[18px] font-extrabold">{name}</div>
        {detail && (
          <div className="mt-0.5 flex flex-wrap gap-x-2 font-num text-[11px] text-muted-foreground">
            <span>{isEn ? detail.group : GROUP_KO[detail.group] ?? detail.group}</span>
            {detail.goals > 0 && <span>⚽ {detail.goals}</span>}
            {detail.assists > 0 && <span>🅰 {detail.assists}</span>}
            <span>{detail.quartersPlayed}Q</span>
            {detail.cleanSheet && <span>🧤 {L("무실점", "clean sheet")}</span>}
          </div>
        )}
      </div>
      <RatingBadge value={detail?.rating ?? 0} size="lg" />
    </motion.button>
  );
}
