import { useMemo, useState } from "react";
import type { Player } from "@/hooks/useFutsalData";
import type { MatchRatingDetail } from "@/lib/matchRating";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import RatingBadge from "@/components/player/RatingBadge";

type Key = "rating" | "goals" | "assists" | "q" | "pm";
interface Row {
  player: Player;
  name: string;
  detail: MatchRatingDetail;
  margin: number | null;
  team?: string;
}

const POS_KO: Record<string, string> = { GK: "GK", DF: "DF", MF: "MF", W: "W", FW: "FW" };

/** FotMob player-stats table: sortable columns, tap a row for the profile; admins tap the rating to override. */
export default function PlayerStatsTable({ rows, isEn, isAdmin, onOpen, onEditRating }: { rows: Row[]; isEn: boolean; isAdmin: boolean; onOpen: (id: number) => void; onEditRating: (id: number) => void }) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const [sort, setSort] = useState<Key>("rating");
  const sorted = useMemo(() => {
    const v = (r: Row) => (sort === "rating" ? r.detail.rating : sort === "goals" ? r.detail.goals : sort === "assists" ? r.detail.assists : sort === "q" ? r.detail.quartersPlayed : r.margin ?? -99);
    return [...rows].sort((a, b) => v(b) - v(a) || b.detail.rating - a.detail.rating);
  }, [rows, sort]);

  const H = ({ k, children }: { k: Key; children: string }) => (
    <button onClick={() => setSort(k)} className={`w-9 text-center text-[10px] font-bold ${sort === k ? "text-primary" : "text-muted-foreground"}`}>
      {children}{sort === k ? "↓" : ""}
    </button>
  );

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <span className="flex-1 text-[10px] font-bold text-muted-foreground">{L("선수", "Player")}</span>
        <H k="goals">{L("골", "G")}</H>
        <H k="assists">{L("도움", "A")}</H>
        <H k="q">Q</H>
        <H k="pm">+/-</H>
        <button onClick={() => setSort("rating")} className={`w-11 text-center text-[10px] font-bold ${sort === "rating" ? "text-primary" : "text-muted-foreground"}`}>
          {L("평점", "Rating")}{sort === "rating" ? "↓" : ""}
        </button>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {sorted.map((r, i) => (
          <div key={r.player.id} className="flex items-center gap-2 px-3 py-2">
            <button onClick={() => onOpen(r.player.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <PlayerAvatar player={r.player} size={30} />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-[13px] font-semibold">
                  {i === 0 && sort === "rating" && <span>👑</span>}
                  {r.name}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {POS_KO[r.detail.group]}{r.team ? ` · ${r.team}` : ""}{r.detail.cleanSheet ? " · 🧤" : ""}
                </span>
              </span>
            </button>
            <span className="w-9 text-center font-num text-[13px] font-bold">{r.detail.goals || "-"}</span>
            <span className="w-9 text-center font-num text-[13px] font-bold">{r.detail.assists || "-"}</span>
            <span className="w-9 text-center font-num text-[12px] text-muted-foreground">{r.detail.quartersPlayed || "-"}</span>
            <span className={`w-9 text-center font-num text-[12px] font-bold ${r.margin == null ? "text-muted-foreground" : r.margin > 0 ? "text-win" : r.margin < 0 ? "text-loss" : ""}`}>
              {r.margin == null ? "-" : r.margin > 0 ? `+${r.margin}` : r.margin}
            </span>
            <button
              onClick={isAdmin ? () => onEditRating(r.player.id) : undefined}
              className={`w-11 text-center ${isAdmin ? "" : "cursor-default"}`}
              title={`${L("공격", "ATT")} ${r.detail.attack} · ${L("영향", "IMP")} ${r.detail.impact} · ${L("수비", "DEF")} ${r.detail.defense} · ${L("결과", "RES")} ${r.detail.teamMod}`}
            >
              <RatingBadge value={r.detail.rating} size="sm" />
              {r.detail.isOverride && <span className="block text-[8px] text-primary">{L("보정", "adj.")}</span>}
            </button>
          </div>
        ))}
      </div>
      <p className="border-t border-white/[0.05] px-3 py-2 text-[10px] text-muted-foreground">
        {L("평점: 골·도움, 출전 중 득실(+/-), 쿼터당 실점률, 팀 결과를 반영 (클럽 > 가이드 참고)", "Rating reflects goals/assists, on-pitch +/-, conceded per quarter and the result (see Club › Guide)")}
        {isAdmin ? L(" · 관리자는 평점을 눌러 보정", " · admins tap a rating to adjust") : ""}
      </p>
    </section>
  );
}
