import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getPlayerName, type Player, type MatchQuarter } from "@/hooks/useFutsalData";
import { computeSlotStats } from "@/hooks/useCourtStats";
import { slotLabel, roleLabel, getSlot } from "@/lib/positions";
import type { SportFilter } from "@/lib/sport";

interface Props {
  players: Player[];
  quarters: MatchQuarter[];
  sport: SportFilter;
}

/**
 * Sport-scoped detailed position leaderboard.
 * Futsal aggregates only futsal vocabulary (Goleiro / Fixo / Ala / Pivo …),
 * football only football vocabulary (GK / CB / LB / CM / ST …).
 * Cross-sport codes are reported as excluded instead of polluting the numbers.
 */
export default function PositionShareBoard({ players, quarters, sport }: Props) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language ?? i18n.resolvedLanguage ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const pn = (id: number) => getPlayerName(players, id, lang);

  const validIds = useMemo(() => new Set(players.map(p => p.id)), [players]);
  const { slots, totalTagged, excluded } = useMemo(
    () => computeSlotStats(quarters, sport, validIds),
    [quarters, sport, validIds]
  );

  const formatCode = sport === "soccer" ? "s11" : sport === "futsal" ? "futsal6" : null;

  if (totalTagged === 0 && excluded === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-primary">
          {sport === "futsal"
            ? L("풋살 포지션 점유율", "Futsal position share")
            : sport === "soccer"
              ? L("축구 포지션 점유율", "Football position share")
              : L("포지션 점유율", "Position share")}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {L(`${totalTagged}쿼터 집계`, `${totalTagged} quarters counted`)}
        </span>
      </div>

      {totalTagged === 0 ? (
        <p className="text-xs text-muted-foreground">
          {L("이 종목의 세부 포지션 데이터가 아직 없습니다.", "No detailed position data for this sport yet.")}
        </p>
      ) : (
        <div className="space-y-2">
          {slots.slice(0, 12).map(s => {
            const sl = getSlot(s.code, formatCode);
            return (
              <div key={s.code} className="rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">{s.code}</span>
                    <span className="text-xs font-bold text-foreground">{slotLabel(s.code, isEn, formatCode)}</span>
                    {sl && (
                      <span className="text-[10px] text-muted-foreground">
                        {roleLabel(sl.role, isEn, sport === "all" ? "all" : sport)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {L(`${s.quarters}쿼터`, `${s.quarters} Q`)} · {Math.round((s.quarters / totalTagged) * 100)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.leaders.map((ld, i) => (
                    <button
                      key={ld.playerId}
                      onClick={() => navigate(`/players/${ld.playerId}`)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        i === 0 ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {i === 0 ? "👑 " : ""}{pn(ld.playerId)}{" "}
                      <span className="opacity-70">{ld.quarters}Q · {ld.share}%</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {excluded > 0 && (
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-300">
          ⚠️ {isEn
            ? `${excluded} quarter tag(s) use the other sport's position vocabulary and were excluded. Re-map them in the admin position panel to include them.`
            : `${excluded}건의 포지션 기록이 다른 종목 용어로 입력되어 집계에서 제외되었습니다. 관리자 포지션 지정 패널에서 정식 포지션으로 수정하면 반영됩니다.`}
        </p>
      )}
    </motion.div>
  );
}
