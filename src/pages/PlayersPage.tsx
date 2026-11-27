import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Flame, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAllFutsalData } from "@/hooks/useFutsalData";
import { useOnFirePlayers } from "@/hooks/useOnFirePlayers";
import { isPlayerInactive } from "@/hooks/useInactivePlayers";
import { useSquadTable, type SquadRow } from "@/hooks/useSquadTable";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import SportToggle from "@/components/SportToggle";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import RatingBadge from "@/components/player/RatingBadge";
import { useDisplayName } from "@/lib/displayName";
import { filterMatchesBySport, type SportFilter } from "@/lib/sport";
import type { RoleKey } from "@/lib/positions";

type SortKey = "position" | "rating" | "ap" | "apps";

const ROLE_ORDER: (RoleKey | "ETC")[] = ["GK", "DF", "MF", "FW", "ETC"];
const ROLE_LABEL: Record<RoleKey | "ETC", [string, string]> = {
  GK: ["골키퍼", "Goalkeepers"],
  DF: ["수비수", "Defenders"],
  MF: ["미드필더", "Midfielders"],
  FW: ["공격수", "Forwards"],
  ETC: ["포지션 미지정", "Unassigned"],
};

/** FotMob-style squad list: grouped by position, one tight row per player with rating. */
const PlayersPage = () => {
  const navigate = useNavigate();
  const data = useAllFutsalData();
  const { players, matches: allMatches, rosters, isLoading } = data;
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const displayName = useDisplayName();
  const [sport, setSport] = useState<SportFilter>("all");
  const [sort, setSort] = useState<SortKey>("position");
  const [showGuests, setShowGuests] = useState(false);

  const matches = useMemo(() => filterMatchesBySport(allMatches, sport), [allMatches, sport]);
  const fireMap = useOnFirePlayers(matches, rosters);
  const { rows } = useSquadTable(data, matches);

  const { active, inactive } = useMemo(() => {
    const visible = rows.filter(r => {
      const p = r.player as any;
      if (p.is_guest) return false;
      if (!showGuests && p.is_member === false) return false;
      return sport === "all" || r.apps > 0;
    });
    const isInactive = (r: SquadRow) => !r.player.is_active || isPlayerInactive(r.player.id, allMatches, rosters);
    return { active: visible.filter(r => !isInactive(r)), inactive: visible.filter(isInactive) };
  }, [rows, showGuests, sport, allMatches, rosters]);

  if (isLoading) return <SplashScreen />;

  const sorter = (a: SquadRow, b: SquadRow) =>
    sort === "rating" ? b.rating - a.rating || b.apps - a.apps
    : sort === "ap" ? b.ap - a.ap || b.goals - a.goals
    : sort === "apps" ? b.apps - a.apps
    : (a.player.back_number ?? 999) - (b.player.back_number ?? 999);

  const groups: { key: string; title: string; rows: SquadRow[] }[] =
    sort === "position"
      ? ROLE_ORDER.map(role => ({
          key: role,
          title: L(...ROLE_LABEL[role]),
          rows: active.filter(r => (r.role ?? "ETC") === role).sort(sorter),
        })).filter(g => g.rows.length)
      : [{ key: "all", title: L("전체", "All players"), rows: [...active].sort(sorter) }];
  if (inactive.length) groups.push({ key: "inactive", title: L("비활동", "Inactive"), rows: [...inactive].sort(sorter) });

  const statOf = (r: SquadRow) =>
    sort === "ap" ? { v: r.ap, l: L("공포", "G+A") } : sort === "apps" ? { v: r.apps, l: L("출전", "Apps") } : null;

  return (
    <div className="relative z-10">
      <PageHeader
        title="PLAYERS"
        subtitle={L(`스쿼드 ${active.length}명`, `${active.length} in squad`)}
        rightSlot={
          <button onClick={() => navigate("/compare")} className="liquid-glass pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary">
            <Swords size={12} /> {L("1:1 비교", "Compare")}
          </button>
        }
      />

      <div className="sticky z-30 space-y-2 border-b border-white/[0.04] bg-background/85 px-4 pb-3 pt-2 backdrop-blur-xl" style={{ top: "calc(env(safe-area-inset-top) + 3.75rem)" }}>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {([
            ["position", L("포지션", "Position")],
            ["rating", L("평점", "Rating")],
            ["ap", L("공격포인트", "G+A")],
            ["apps", L("출전", "Apps")],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${sort === k ? "gradient-pink text-primary-foreground" : "bg-secondary/60 text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <SportToggle value={sport} onChange={setSport} isEn={isEn} compact />
          <button
            onClick={() => setShowGuests(v => !v)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${showGuests ? "bg-foreground text-background ring-foreground" : "text-muted-foreground ring-border"}`}
          >
            {L("비회원 포함", "Incl. guests")}
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-3">
        {groups.map(g => (
          <section key={g.key}>
            <h2 className="mb-1.5 flex items-center justify-between px-1 text-[12px] font-bold text-muted-foreground" style={{ fontFamily: "inherit" }}>
              {g.title}
              <span className="font-num text-[10px]">{g.rows.length}</span>
            </h2>
            <div className={`surface divide-y divide-white/[0.05] overflow-hidden rounded-2xl ${g.key === "inactive" ? "opacity-60" : ""}`}>
              {g.rows.map((r, i) => {
                const fire = fireMap.get(r.player.id);
                const stat = statOf(r);
                return (
                  <motion.button
                    key={r.player.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 8) * 0.02 }}
                    onClick={() => navigate(`/player/${r.player.id}`)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                  >
                    <PlayerAvatar player={r.player} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-bold">{displayName(r.player)}</span>
                        {fire && fire.tier !== "none" && <Flame size={13} className="shrink-0 fill-orange-500 text-orange-400" />}
                        {(r.player as any).is_member === false && (
                          <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-bold text-muted-foreground">{L("게스트", "Guest")}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-num text-[11px] text-muted-foreground">
                        <span>{r.apps}{L("경기", " apps")}</span>
                        <span>⚽ {r.goals}</span>
                        <span>🅰 {r.assists}</span>
                        {r.mom > 0 && <span>👑 {r.mom}</span>}
                      </div>
                    </div>
                    {stat ? (
                      <div className="text-right">
                        <div className="font-num text-lg font-extrabold leading-none">{stat.v}</div>
                        <div className="text-[9px] font-semibold text-muted-foreground">{stat.l}</div>
                      </div>
                    ) : (
                      <RatingBadge value={r.rating} />
                    )}
                    <ChevronRight size={15} className="shrink-0 text-muted-foreground/40" />
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="surface rounded-3xl px-6 py-12 text-center text-sm text-muted-foreground">{L("선수가 없어요.", "No players.")}</div>
        )}
      </div>
    </div>
  );
};

export default PlayersPage;
