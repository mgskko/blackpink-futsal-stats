import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAllFutsalData, getMatchResult, getPlayerName, type Match } from "@/hooks/useFutsalData";
import { getOpponentRecords, getVenueRecords, getAgeCategoryRecords } from "@/hooks/useAdvancedStats";
import { getInactivePlayerIds } from "@/hooks/useInactivePlayers";
import { useSquadTable } from "@/hooks/useSquadTable";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import SportToggle from "@/components/SportToggle";
import POTMCard from "@/components/stats/POTMCard";
import RecentFormBoard from "@/components/stats/RecentFormBoard";
import Leaderboard, { type LeaderRow } from "@/components/stats/Leaderboard";
import { useAllQuarters } from "@/hooks/useSquadTable";
import { localISODate } from "@/lib/utils";
import { filterMatchesBySport, type SportFilter } from "@/lib/sport";

type SeasonFilter = "all" | "custom" | string;
const EXCLUDED_NAMES = new Set(["용병1", "용병2"]);

interface RecordRow { name: string; wins: number; draws: number; losses: number; matches: number; winRate: number }

function RecordList({ title, rows, isEn, limit = 8 }: { title: string; rows: RecordRow[]; isEn: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h3 className="text-[14px] font-bold" style={{ fontFamily: "inherit" }}>{title}</h3>
        <span className="font-num text-[10px] text-muted-foreground">{isEn ? "GP  W-D-L  Win%" : "경기  승-무-패  승률"}</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {shown.map(r => (
          <div key={r.name} className="flex items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.name}</span>
            <span className="w-6 text-right font-num text-xs text-muted-foreground">{r.matches}</span>
            <span className="w-16 text-center font-num text-xs">
              <span className="text-win">{r.wins}</span>-<span className="text-draw">{r.draws}</span>-<span className="text-loss">{r.losses}</span>
            </span>
            <div className="flex w-20 items-center gap-1.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-win" style={{ width: `${r.winRate}%` }} />
              </div>
              <span className="w-8 text-right font-num text-[11px] font-bold">{r.winRate}%</span>
            </div>
          </div>
        ))}
      </div>
      {rows.length > limit && (
        <button onClick={() => setAll(v => !v)} className="w-full border-t border-white/[0.05] py-2.5 text-xs font-bold text-primary">
          {all ? (isEn ? "Show less" : "접기") : isEn ? `Show all ${rows.length}` : `전체 ${rows.length}개 보기`}
        </button>
      )}
    </section>
  );
}

/** Stats: FotMob-style leaderboards (players) and club records (team). */
const StatisticsPage = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const data = useAllFutsalData();
  const { players, matches: allMatches, venues, teams, results, rosters, goalEvents, isLoading } = data;
  const { data: allQuarters = [] } = useAllQuarters();
  const [sport, setSport] = useState<SportFilter>("all");
  const [season, setSeason] = useState<SeasonFilter>("all");
  const [tab, setTab] = useState<"players" | "team">("players");

  const sportMatches = useMemo(() => filterMatchesBySport(allMatches, sport), [allMatches, sport]);
  const years = useMemo(() => [...new Set(sportMatches.map(m => m.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [sportMatches]);
  const matches: Match[] = useMemo(() => {
    const today = localISODate();
    const played = sportMatches.filter(m => m.date <= today);
    if (season === "custom") return played.filter(m => m.is_custom);
    if (season !== "all") return played.filter(m => m.date.startsWith(season));
    return played;
  }, [sportMatches, season]);

  const ids = useMemo(() => new Set(matches.map(m => m.id)), [matches]);
  const fRosters = useMemo(() => rosters.filter(r => ids.has(r.match_id)), [rosters, ids]);
  const fGoals = useMemo(() => goalEvents.filter(g => ids.has(g.match_id)), [goalEvents, ids]);
  const fTeams = useMemo(() => teams.filter(t => ids.has(t.match_id)), [teams, ids]);
  const fResults = useMemo(() => results.filter(r => ids.has(r.match_id)), [results, ids]);
  const fQuarters = useMemo(() => allQuarters.filter(q => ids.has(q.match_id)), [allQuarters, ids]);

  // Long-term inactive, guests and placeholder accounts never appear in rankings.
  const inactiveIds = useMemo(() => getInactivePlayerIds(players, sportMatches, rosters), [players, sportMatches, rosters]);
  const memberPlayers = useMemo(
    () => players.filter(p => !(p as any).is_guest && !inactiveIds.has(p.id) && !EXCLUDED_NAMES.has(p.name)),
    [players, inactiveIds]
  );
  const memberIds = useMemo(() => new Set(memberPlayers.map(p => p.id)), [memberPlayers]);
  const { rows } = useSquadTable(data, matches);
  const squad = useMemo(() => rows.filter(r => memberIds.has(r.player.id) && r.apps > 0), [rows, memberIds]);

  const boards = useMemo(() => {
    const nm = (id: number) => getPlayerName(players, id, lang);
    const apps = (n: number) => (isEn ? `${n} apps` : `${n}경기`);
    const minApps = Math.max(2, Math.round(Math.max(0, ...squad.map(r => r.apps)) * 0.3));
    const top = (list: typeof squad, val: (r: (typeof squad)[number]) => number, sub?: (r: (typeof squad)[number]) => string): LeaderRow[] =>
      [...list]
        .filter(r => val(r) > 0)
        .sort((a, b) => val(b) - val(a) || b.apps - a.apps)
        .map(r => ({ player: r.player, name: nm(r.player.id), value: val(r), sub: sub ? sub(r) : apps(r.apps) }));
    const qualified = squad.filter(r => r.apps >= minApps);
    return {
      minApps,
      rating: top(qualified, r => r.rating),
      goals: top(squad, r => r.goals, r => `${apps(r.apps)} · ${(r.goals / Math.max(1, r.apps)).toFixed(2)}/${isEn ? "g" : "경기"}`),
      assists: top(squad, r => r.assists),
      ap: top(squad, r => r.ap, r => `${r.goals}G ${r.assists}A`),
      apps: top(squad, r => r.apps, r => `${r.wins}${isEn ? "W" : "승"} · ${isEn ? "win" : "승률"} ${r.winRate}%`),
      mom: top(squad, r => r.mom),
      winRate: top(qualified, r => r.winRate),
      cleanSheets: top(squad, r => r.cleanSheets),
    };
  }, [squad, players, lang, isEn]);

  const team = useMemo(() => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, cs = 0;
    const bySeason = new Map<string, RecordRow & { gf: number; ga: number }>();
    matches.filter(m => !m.is_custom).forEach(m => {
      const mr = getMatchResult(fTeams, fResults, m.id);
      if (!mr) return;
      const r = mr.ourResult;
      const y = m.date.slice(0, 4);
      const row = bySeason.get(y) ?? { name: y, wins: 0, draws: 0, losses: 0, matches: 0, winRate: 0, gf: 0, ga: 0 };
      row.matches++;
      if (r.result === "승") { w++; row.wins++; } else if (r.result === "패") { l++; row.losses++; } else { d++; row.draws++; }
      gf += r.score_for ?? 0; ga += r.score_against ?? 0;
      row.gf += r.score_for ?? 0; row.ga += r.score_against ?? 0;
      if ((r.score_against ?? 0) === 0) cs++;
      bySeason.set(y, row);
    });
    const seasons = [...bySeason.values()].map(r => ({ ...r, winRate: r.matches ? Math.round((r.wins / r.matches) * 100) : 0 })).sort((a, b) => b.name.localeCompare(a.name));
    const played = w + d + l;
    return {
      played, w, d, l, gf, ga, cs, seasons,
      winRate: played ? Math.round((w / played) * 100) : 0,
      opponents: getOpponentRecords(matches, fTeams, fResults).sort((a: RecordRow, b: RecordRow) => b.matches - a.matches),
      venues: getVenueRecords(matches, fTeams, fResults, venues).sort((a: RecordRow, b: RecordRow) => b.matches - a.matches),
      ages: getAgeCategoryRecords(matches, fTeams, fResults).map((r: any) => ({ ...r, name: r.category })) as RecordRow[],
    };
  }, [matches, fTeams, fResults, venues]);

  if (isLoading) return <SplashScreen />;

  const S = (k: string, en: string) => L(k, en);
  const empty = L("기록이 없어요", "No data yet");
  const allLabel = L("전체 순위", "See all");

  return (
    <div className="relative z-10">
      <PageHeader
        title="STATS"
        subtitle={L(`${matches.length}경기 기준`, `Based on ${matches.length} matches`)}
        rightSlot={
          <button onClick={() => navigate("/compare")} className="liquid-glass pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary">
            <Swords size={12} /> {L("1:1 비교", "Compare")}
          </button>
        }
      />

      <div className="sticky z-30 space-y-2 border-b border-white/[0.04] bg-background/85 px-4 pb-3 pt-2 backdrop-blur-xl" style={{ top: "calc(env(safe-area-inset-top) + 3.75rem)" }}>
        <div className="segmented flex w-full">
          {([["players", L("선수", "Players")], ["team", L("팀", "Team")]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`relative flex-1 rounded-full py-2 text-[13px] font-bold ${tab === k ? "text-primary-foreground" : "text-muted-foreground"}`}>
              {tab === k && <motion.span layoutId="stats-tab-pill" className="absolute inset-0 rounded-full gradient-pink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[["all", L("전체 기간", "All-time")], ...years.map(y => [y, isEn ? `${y}` : `${y}시즌`]), ["custom", L("자체전", "Intrasquad")]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSeason(k)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${season === k ? "bg-foreground text-background ring-foreground" : "text-muted-foreground ring-border"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <SportToggle value={sport} onChange={setSport} isEn={isEn} compact />
      </div>

      <div className="space-y-3 px-4 pt-3">
        {tab === "players" ? (
          <>
            <POTMCard players={memberPlayers} matches={matches} teams={fTeams} results={fResults} rosters={fRosters} goalEvents={fGoals} allQuarters={fQuarters} />
            <Leaderboard title={`${S("평점", "Rating")} · ${L(`${boards.minApps}경기 이상`, `min. ${boards.minApps} apps`)}`} rows={boards.rating} rating emptyText={empty} allLabel={allLabel} />
            <div className="grid gap-3">
              <Leaderboard title={S("득점", "Goals")} rows={boards.goals} emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={S("도움", "Assists")} rows={boards.assists} emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={S("공격포인트", "Goals + Assists")} rows={boards.ap} emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={S("MOM", "Man of the Match")} rows={boards.mom} emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={S("출전", "Appearances")} rows={boards.apps} emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={`${S("승률", "Win rate")} · ${L(`${boards.minApps}경기 이상`, `min. ${boards.minApps} apps`)}`} rows={boards.winRate} suffix="%" emptyText={empty} allLabel={allLabel} />
              <Leaderboard title={S("무실점 쿼터 (수비·GK)", "Clean-sheet quarters (DF/GK)")} rows={boards.cleanSheets} emptyText={empty} allLabel={allLabel} />
            </div>
            <RecentFormBoard players={memberPlayers} matches={matches} rosters={fRosters} goalEvents={fGoals} />
          </>
        ) : (
          <>
            <section className="surface rounded-2xl p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="eyebrow">{L("팀 전적", "Club record")}</div>
                  <div className="mt-1 font-num text-3xl font-extrabold">
                    <span className="text-win">{team.w}</span>
                    <span className="mx-1 text-muted-foreground/50">-</span>
                    <span className="text-draw">{team.d}</span>
                    <span className="mx-1 text-muted-foreground/50">-</span>
                    <span className="text-loss">{team.l}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num text-3xl font-extrabold text-primary">{team.winRate}%</div>
                  <div className="text-[10px] text-muted-foreground">{L("승률", "Win rate")}</div>
                </div>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-win" style={{ width: `${(team.w / Math.max(1, team.played)) * 100}%` }} />
                <div className="bg-draw" style={{ width: `${(team.d / Math.max(1, team.played)) * 100}%` }} />
                <div className="bg-loss" style={{ width: `${(team.l / Math.max(1, team.played)) * 100}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { v: team.played, l: L("경기", "Played") },
                  { v: team.gf, l: L("득점", "Scored") },
                  { v: team.ga, l: L("실점", "Conceded") },
                  { v: team.cs, l: L("무실점", "Clean sheets") },
                ].map(x => (
                  <div key={x.l} className="rounded-xl bg-black/15 py-2.5">
                    <div className="font-num text-lg font-extrabold">{x.v}</div>
                    <div className="text-[10px] text-muted-foreground">{x.l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-black/15 py-2">
                  <div className="font-num text-base font-bold">{(team.gf / Math.max(1, team.played)).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{L("경기당 득점", "Goals / match")}</div>
                </div>
                <div className="rounded-xl bg-black/15 py-2">
                  <div className="font-num text-base font-bold">{(team.ga / Math.max(1, team.played)).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{L("경기당 실점", "Conceded / match")}</div>
                </div>
              </div>
            </section>
            {season === "all" && <RecordList title={L("시즌별 전적", "By season")} rows={team.seasons} isEn={isEn} />}
            <RecordList title={L("상대팀별 전적", "By opponent")} rows={team.opponents} isEn={isEn} />
            <RecordList title={L("구장별 전적", "By venue")} rows={team.venues} isEn={isEn} />
            <RecordList title={L("상대 연령대별 전적", "By opponent age group")} rows={team.ages} isEn={isEn} />
            {team.played === 0 && <div className="surface rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">{season === "custom" ? L("자체전은 팀 전적에 포함되지 않아요.", "Intrasquad games don't count for the club record.") : empty}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
