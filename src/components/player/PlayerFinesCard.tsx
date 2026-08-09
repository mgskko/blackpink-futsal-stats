import { useMemo } from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFines, summarizeFines, FineType, fineLabel, formatKRW } from "@/hooks/useFines";

const TYPES: FineType[] = ["late", "no_show", "late_cancel"];

const PlayerFinesCard = ({ playerId }: { playerId: number }) => {
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const { data: fines = [] } = useFines();

  const mine = useMemo(() => fines.filter(f => f.player_id === playerId), [fines, playerId]);
  const s = useMemo(() => summarizeFines(mine), [mine]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
        <Coins size={16} /> {L("벌금 현황", "Fine Record")}
      </h3>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("누적 벌금", "Total Fines")}</div>
          <div className="text-base font-bold text-primary">{formatKRW(s.total, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("납부", "Paid")}</div>
          <div className="text-base font-bold text-foreground">{formatKRW(s.paid, isEn)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
          <div className="text-[10px] text-muted-foreground">{L("미납", "Unpaid")}</div>
          <div className={`text-base font-bold ${s.unpaid > 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatKRW(s.unpaid, isEn)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {TYPES.map(t => (
          <div key={t} className="rounded-lg border border-border bg-background/40 p-3 text-center">
            <div className="text-[10px] text-muted-foreground">{fineLabel(t, isEn)}</div>
            <div className="text-lg font-bold text-foreground">{isEn ? s.counts[t] : `${s.counts[t]}회`}</div>
          </div>
        ))}
      </div>

      {s.waivedCount > 0 && (
        <p className="mt-2 text-[10px] text-emerald-400">
          {isEn ? `${s.waivedCount} waived (annual exemption)` : `면제 ${s.waivedCount}건 (연간 1회 면제)`}
        </p>
      )}
      {mine.length === 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">{L("벌금 내역이 없습니다. 클린 플레이어! 🐰", "No fines. Clean record! 🐰")}</p>
      )}
    </motion.div>
  );
};

export default PlayerFinesCard;
