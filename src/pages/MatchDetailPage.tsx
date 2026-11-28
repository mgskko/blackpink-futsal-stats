import { localISODate, parseLocalDate } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, HelpCircle, Users } from "lucide-react";
import { useAllFutsalData, getMatchResult, getMatchTeams, getMatchRoster, getMatchGoalEvents, getPlayerName, useMatchQuarters } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";
import DetailHeader, { DETAIL_HEADER_OFFSET } from "@/components/DetailHeader";
import Scoreboard from "@/components/match/Scoreboard";
import UnderlineTabs from "@/components/UnderlineTabs";
import MatchTimeline from "@/components/match/MatchTimeline";
import PlayerOfTheMatch from "@/components/match/PlayerOfTheMatch";
import PlayerStatsTable from "@/components/match/PlayerStatsTable";
import YouTubePlayer, { type YouTubeHandle } from "@/components/media/YouTubePlayer";
import { extractYoutubeId } from "@/lib/youtube";
import MOMVoting from "@/components/MOMVoting";
import WorstVoting from "@/components/match/WorstVoting";
import FormationBuilder from "@/components/match/FormationBuilder";
import MatchPrediction from "@/components/match/MatchPrediction";
import MatchComments from "@/components/match/MatchComments";
import QuarterPitchViewer from "@/components/match/QuarterPitchViewer";
import HeadToHead from "@/components/match/HeadToHead";
import { useAuth } from "@/hooks/useAuth";
import { computeMatchCourtMargins } from "@/hooks/useCourtStats";
import { useMatchAnalysis, computeDualDataMOM, scorePlayersForMatch } from "@/hooks/useMatchAnalysis";
import { useMatchRatings, useSaveRatingOverride, useMatchOverrideMap } from "@/hooks/useMatchRatings";
import type { DataMOMResult } from "@/hooks/useMatchAnalysis";
import { useTranslation } from "react-i18next";
import { resolveTeamName } from "@/lib/displayName";




type AttendanceStatus = "attending" | "absent" | "undecided";


const MatchDetailPage = () => {
  const { isAdmin } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language ?? i18n.resolvedLanguage ?? "ko";
  const isEn = lang.startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const { id } = useParams();
  const navigate = useNavigate();
  const matchId = Number(id);
  const { players, matches, venues, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const pn = (id: number | null | undefined) => (id ? getPlayerName(players, id, lang) : "???");
  const tn = (name: string | null | undefined) => resolveTeamName(name ?? "", lang);
  const [attendance, setAttendance] = useState<Map<number, AttendanceStatus>>(new Map());
  const saveOverride = useSaveRatingOverride();
  const [tab, setTab] = useState<"facts" | "lineup" | "stats" | "h2h">("facts");
  const ytRef = useRef<YouTubeHandle>(null);
  const { data: matchQuarters } = useMatchQuarters(matchId);

  useEffect(() => {
    if (!matchId) return;
    const fetchAttendance = async () => {
      const { data } = await supabase.from("match_attendance").select("*").eq("match_id", matchId);
      if (data) {
        const map = new Map<number, AttendanceStatus>();
        data.forEach((r: any) => map.set(r.player_id, r.status as AttendanceStatus));
        setAttendance(map);
      }
    };
    fetchAttendance();
  }, [matchId]);

  const courtMargins = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return null;
    const sorted = [...matchQuarters].sort((a, b) => a.quarter - b.quarter);
    const matchGoals = goalEvents.filter(g => g.match_id === matchId);
    return computeMatchCourtMargins(sorted, matchGoals, players);
  }, [matchQuarters, goalEvents, matchId, players]);

  const currentMatchForMom = useMemo(() => matches.find(m => m.id === matchId) ?? null, [matches, matchId]);
  const overrideMap = useMatchOverrideMap(matchId);
  const { dataMOM, dualDataMOM, aiComments } = useMatchAnalysis(matchId, players, teams, results, goalEvents, matchQuarters ?? [], lang, currentMatchForMom, overrideMap);

  // ── Unified match rating (single source of truth for every rating surface) ──
  const currentMatch = useMemo(() => matches.find(m => m.id === matchId) ?? null, [matches, matchId]);
  const matchGoalEventsAll = useMemo(() => goalEvents.filter(g => g.match_id === matchId), [goalEvents, matchId]);
  const matchRostersAll = useMemo(() => rosters.filter(r => r.match_id === matchId), [rosters, matchId]);
  const momIds = useMemo(() => {
    const ids = [dualDataMOM?.teamA?.playerId, dualDataMOM?.teamB?.playerId, dataMOM?.playerId]
      .filter((v): v is number => typeof v === "number");
    return [...new Set(ids)];
  }, [dataMOM, dualDataMOM]);
  const ratingMap = useMatchRatings(currentMatch, matchQuarters ?? [], matchGoalEventsAll, matchRostersAll, momIds);



  // Compute total score from quarters
  const quarterTotalScore = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return null;
    let scoreFor = 0, scoreAgainst = 0;
    matchQuarters.forEach(q => {
      scoreFor += q.score_for || 0;
      scoreAgainst += q.score_against || 0;
    });
    return { scoreFor, scoreAgainst };
  }, [matchQuarters]);



  if (isLoading) return <SplashScreen />;

  const match = matches.find((m) => m.id === matchId);
  if (!match) return <div className="relative z-10 flex min-h-[70vh] items-center justify-center text-muted-foreground">{L("경기를 찾을 수 없습니다", "Match not found")}</div>;

  const venue = venues.find((v) => v.id === match.venue_id);
  const mr = getMatchResult(teams, results, matchId);
  const matchTeams = getMatchTeams(teams, matchId);
  const roster = getMatchRoster(rosters, matchId);
  const matchGoalEvents = getMatchGoalEvents(goalEvents, matchId);
  const opponentTeam = matchTeams.find(t => !t.is_ours);
  const youtubeId = match.youtube_link ? extractYoutubeId(match.youtube_link) : null;
  const today = localISODate();
  const isScheduled = match.date > today || (!mr || mr.ourResult.score_for === null);

  // FotMob-style scorer lines under the scoreboard: "윤태규 1Q, 3Q"
  const scorerLines = (() => {
    const firstTeamId = match.is_custom ? matchTeams[0]?.id : matchTeams.find(t => t.is_ours)?.id;
    const build = (evs: typeof matchGoalEvents) => {
      const byPlayer = new Map<string, number[]>();
      evs.forEach(g => {
        const name = g.is_own_goal ? `${L("자책", "OG")} ${pn(g.goal_player_id)}` : pn(g.goal_player_id);
        byPlayer.set(name, [...(byPlayer.get(name) ?? []), g.quarter]);
      });
      return [...byPlayer.entries()].map(([n, qs]) => `${n} ${qs.sort((a, b) => a - b).map(q => `${q}Q`).join(", ")}`);
    };
    if (!match.has_detail_log) return { first: [] as string[], second: [] as string[] };
    return match.is_custom
      ? { first: build(matchGoalEvents.filter(g => g.team_id === firstTeamId)), second: build(matchGoalEvents.filter(g => g.team_id !== firstTeamId)) }
      : { first: build(matchGoalEvents), second: [] as string[] };
  })();

  const seekTo = (seconds: number) => {
    document.getElementById("match-video")?.scrollIntoView({ behavior: "smooth", block: "center" });
    ytRef.current?.seek(seconds);
  };

  // Player of the Match: top-rated (per team in intrasquad games)
  const potm = (() => {
    const pick = (d: typeof dataMOM, team?: string) => {
      const pl = d ? players.find(p => p.id === d.playerId) : null;
      return d && pl ? [{ playerId: d.playerId, player: pl, team }] : [];
    };
    if (match.is_custom && (dualDataMOM.teamA || dualDataMOM.teamB)) {
      return [...pick(dualDataMOM.teamA, tn(matchTeams[0]?.name)), ...pick(dualDataMOM.teamB, tn(matchTeams[1]?.name))];
    }
    return pick(dataMOM);
  })();

  // rows for the player-stats table: everyone with a rating in this match
  const statRows = [...ratingMap.values()].flatMap(d => {
    const pl = players.find(p => p.id === d.playerId);
    if (!pl) return [];
    const teamId = roster.find(r => r.player_id === d.playerId)?.team_id;
    return [{
      player: pl,
      name: pn(d.playerId),
      detail: d,
      margin: courtMargins?.get(d.playerId)?.margin ?? null,
      team: match.is_custom ? tn(matchTeams.find(t => t.id === teamId)?.name) : undefined,
    }];
  });

  // Use quarter total if available, otherwise use results table
  const displayScoreFor = quarterTotalScore?.scoreFor ?? mr?.ourResult.score_for ?? null;
  const displayScoreAgainst = quarterTotalScore?.scoreAgainst ?? mr?.ourResult.score_against ?? null;
  // NOTE: keep DB-valued Korean labels ("승"/"무"/"패") for logic; translate only at render.
  const displayResult = displayScoreFor !== null && displayScoreAgainst !== null
    ? (displayScoreFor > displayScoreAgainst ? "승" : displayScoreFor < displayScoreAgainst ? "패" : "무")
    : mr?.ourResult.result ?? null;
  const displayResultLabel = displayResult ? (isEn ? (displayResult === "승" ? "W" : displayResult === "패" ? "L" : "D") : displayResult) : null;


  // Per-match rating — single source of truth (shared with lineup pitch, profile & leaderboards)
  const editRating = (pid: number) => {
    const cur = ratingMap.get(pid);
    const input = window.prompt(
      L("평점 수동 보정 (0~10, 비우면 자동 계산으로 복구)", "Manual rating override (0-10, blank = back to auto)"),
      cur?.isOverride ? String(cur.rating) : ""
    );
    if (input === null) return;
    const trimmed = input.trim();
    if (trimmed === "") { saveOverride.mutate({ matchId, playerId: pid, rating: null }); return; }
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 0 || val > 10) return;
    saveOverride.mutate({ matchId, playerId: pid, rating: Math.round(val * 100) / 100 });
  };


  const attendingPlayers = players.filter(p => attendance.get(p.id) === "attending");
  const absentPlayers = players.filter(p => attendance.get(p.id) === "absent");
  const undecidedPlayers = players.filter(p => attendance.get(p.id) === "undecided");
  const hasAttendanceData = attendance.size > 0;

  return (
    <div className="relative z-10">
      <DetailHeader title="MATCH DETAIL" subtitle={`${match.date} · ${tn(mr?.ourTeam.name ?? "버니즈")} vs ${tn(mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀")}`} />

      <Scoreboard
        isEn={isEn}
        ourName={tn(mr?.ourTeam.name ?? "버니즈")}
        oppName={tn(mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀")}
        scoreFor={displayScoreFor}
        scoreAgainst={displayScoreAgainst}
        result={displayResult}
        resultLabel={displayResultLabel}
        scheduled={isScheduled}
        date={match.date}
        venue={venue ? `${venue.name}${match.sub_venue ? ` ${match.sub_venue}` : ""}` : undefined}
        matchType={match.match_type}
        isCustom={match.is_custom}
        ageGroup={opponentTeam?.age_category ? opponentTeam.original_age_desc || opponentTeam.age_category : null}
        ourScorers={scorerLines.first}
        oppScorers={scorerLines.second}
      />

      {isScheduled && (
        <div className="mx-4 mt-4"><MatchPrediction matchId={matchId} /></div>
      )}

      {/* Tab bar (FotMob underline tabs) */}
      <div className="mt-4">
        <UnderlineTabs
          id="match"
          top={DETAIL_HEADER_OFFSET}
          value={tab}
          onChange={k => setTab(k as typeof tab)}
          tabs={[
            ["facts", L("개요", "Overview")],
            ["lineup", L("라인업", "Lineup")],
            ["stats", L("선수", "Players")],
            ["h2h", L("상대 전적", "H2H")],
          ] as const}
        />
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === "facts" && (
        <div className="mx-4 mt-3 space-y-3">
          {/* Player of the Match = top match rating (one per team for intrasquad) */}
          {potm.map(x => (
            <PlayerOfTheMatch
              key={x.playerId}
              player={x.player}
              detail={ratingMap.get(x.playerId)}
              name={pn(x.playerId)}
              teamLabel={x.team}
              isEn={isEn}
              onOpen={() => navigate(`/player/${x.playerId}`)}
            />
          ))}

          {youtubeId && (
            <section id="match-video" className="surface overflow-hidden rounded-2xl p-2">
              <YouTubePlayer ref={ytRef} videoId={youtubeId} />
              {matchGoalEvents.some(g => g.video_timestamp) && (
                <p className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">{L("타임라인의 ▶ 시간을 누르면 해당 장면부터 재생돼요", "Tap ▶ times in the timeline to jump to the moment")}</p>
              )}
            </section>
          )}

          {(matchQuarters?.length || matchGoalEvents.length) && !isScheduled ? (
            <MatchTimeline
              quarters={[...(matchQuarters ?? [])].sort((a, b) => a.quarter - b.quarter)}
              goals={match.has_detail_log ? matchGoalEvents : []}
              isCustom={match.is_custom}
              leftTeamId={match.is_custom ? matchTeams[0]?.id : null}
              leftName={tn(match.is_custom ? matchTeams[0]?.name : mr?.ourTeam.name ?? "버니즈")}
              rightName={tn(match.is_custom ? matchTeams[1]?.name : mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀")}
              isEn={isEn}
              pn={pn}
              onPlayer={id => navigate(`/player/${id}`)}
              onSeek={youtubeId ? seekTo : undefined}
            />
          ) : !isScheduled ? (
            <div className="surface rounded-2xl px-4 py-6 text-center text-xs text-muted-foreground">
              {L("쿼터·득점 상세 기록이 없는 경기예요.", "No quarter or goal log for this match.")}
            </div>
          ) : null}

          {aiComments.length > 0 && (
            <section className="surface rounded-2xl p-4">
              <h3 className="mb-2 text-[15px] font-bold" style={{ fontFamily: "inherit" }}>{L("경기 팩트", "Match facts")}</h3>
              <ul className="space-y-2">
                {aiComments.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Match info (FotMob) */}
          <section className="surface rounded-2xl p-4">
            <h3 className="mb-2.5 text-[15px] font-bold" style={{ fontFamily: "inherit" }}>{L("경기 정보", "Match info")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {[
                [L("날짜", "Date"), `${match.date} (${(isEn ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"])[parseLocalDate(match.date).getDay()]})`],
                [L("구장", "Venue"), venue ? `${venue.name}${match.sub_venue ? ` ${match.sub_venue}` : ""}` : "-"],
                [L("경기 방식", "Format"), match.match_type],
                [L("구분", "Type"), match.is_custom ? L("자체전", "Intrasquad") : L("친선 · 리그", "Friendly / league")],
                ...(opponentTeam?.age_category ? [[L("상대 연령대", "Opponent age"), opponentTeam.original_age_desc || opponentTeam.age_category]] : []),
                ...(attendingPlayers.length ? [[L("참석", "Attending"), L(`${attendingPlayers.length}명`, `${attendingPlayers.length}`)]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="truncate font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {!isScheduled && <h3 className="px-1 pt-2 text-[13px] font-bold text-muted-foreground" style={{ fontFamily: "inherit" }}>{L("멤버 투표", "Member votes")}</h3>}
        </div>
      )}

      {/* MOM Voting */}
      {tab === "facts" && <div className="mx-4 mt-4"><MOMVoting matchId={matchId} /></div>}

      {/* Worst Voting */}
      {tab === "facts" && <div className="mx-4 mt-4"><WorstVoting matchId={matchId} /></div>}

      {/* Attendance */}
      {tab === "lineup" && hasAttendanceData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mx-4 mt-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary"><Users size={18} /> ATTENDANCE</h2>
          <div className="space-y-2">
            {attendingPlayers.length > 0 && (
              <div className="surface rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-green-400"><Check size={12} /> {L(`참석 (${attendingPlayers.length}명)`, `Attending (${attendingPlayers.length})`)}</div>
                <div className="flex flex-wrap gap-1.5">{attendingPlayers.map(p => <span key={p.id} className="rounded-full bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 text-xs text-green-400">{pn(p.id)}</span>)}</div>
              </div>
            )}
            {absentPlayers.length > 0 && (
              <div className="surface rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-400"><X size={12} /> {L(`불참 (${absentPlayers.length}명)`, `Absent (${absentPlayers.length})`)}</div>
                <div className="flex flex-wrap gap-1.5">{absentPlayers.map(p => <span key={p.id} className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs text-red-400">{pn(p.id)}</span>)}</div>
              </div>
            )}
            {undecidedPlayers.length > 0 && (
              <div className="surface rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-yellow-400"><HelpCircle size={12} /> {L(`미정 (${undecidedPlayers.length}명)`, `Undecided (${undecidedPlayers.length})`)}</div>
                <div className="flex flex-wrap gap-1.5">{undecidedPlayers.map(p => <span key={p.id} className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 text-xs text-yellow-400">{pn(p.id)}</span>)}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Quarter Pitch Viewer (FotMob style) */}
      {tab === "lineup" && matchQuarters && matchQuarters.length > 0 && (
        <div className="mx-4 mt-4">
          <QuarterPitchViewer
            quarters={matchQuarters}
            players={players}
            goalEvents={matchGoalEvents}
            matchTeams={matchTeams.map(t => ({ ...t, name: tn(t.name) }))}
            courtMargins={courtMargins as any}
            isAdmin={isAdmin}
            matchId={matchId}
            formatCode={match?.match_format}
            ratings={ratingMap}
          />

        </div>
      )}

      {/* Formation Builder */}
      {tab === "lineup" && isScheduled && (
        <div className="mx-4 mt-4">
          <FormationBuilder matchId={matchId} players={players} roster={roster} matchTeams={matchTeams} isAdmin={isAdmin} />
        </div>
      )}

      {/* Roster */}
      {tab === "lineup" && (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-4 mt-4">
        <h2 className="mb-3 font-display text-lg tracking-wider text-primary">ROSTER</h2>
        {matchTeams.filter((t) => t.is_ours).map((team) => {
          const teamRoster = roster.filter((r) => r.team_id === team.id);
          return (
            <div key={team.id} className="mb-3">
              {matchTeams.filter(t => t.is_ours).length > 1 && <div className="mb-2 text-xs font-bold text-primary">{tn(team.name)}</div>}
              <div className="flex flex-wrap gap-2">
                {teamRoster.map((r) => (
                  <span key={r.id} onClick={() => navigate(`/player/${r.player_id}`)}
                    className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/50">
                    {pn(r.player_id)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </motion.div>
      )}

      {/* ===== PLAYER STATS ===== */}
      {tab === "stats" && (
        <div className="mx-4 mt-3">
          {statRows.length > 0 ? (
            <PlayerStatsTable rows={statRows} isEn={isEn} isAdmin={isAdmin} onOpen={id => navigate(`/player/${id}`)} onEditRating={editRating} />
          ) : (
            <div className="surface rounded-2xl px-4 py-8 text-center text-xs text-muted-foreground">{L("선수 기록이 아직 없어요.", "No player data yet.")}</div>
          )}
        </div>
      )}

      {tab === "h2h" && (
        <div className="mx-4 mt-4">
          <HeadToHead
            matches={matches}
            teams={teams}
            results={results}
            currentMatchId={matchId}
            opponentName={mr?.opponentTeam.name ?? opponentTeam?.name ?? ""}
            lang={lang}
          />
        </div>
      )}

      {/* Match Comments */}
      {tab === "facts" && <div className="mx-4 mt-4"><MatchComments matchId={matchId} /></div>}
    </div>
  );
};

export default MatchDetailPage;
