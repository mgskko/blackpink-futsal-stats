import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Youtube, Check, X, HelpCircle, Users } from "lucide-react";
import { useAllFutsalData, getMatchResult, getMatchTeams, getMatchRoster, getMatchGoalEvents, getPlayerName, useMatchQuarters } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";
import MOMVoting from "@/components/MOMVoting";
import FormationBuilder from "@/components/match/FormationBuilder";
import MatchPrediction from "@/components/match/MatchPrediction";
import MatchComments from "@/components/match/MatchComments";
import QuarterScoreboard from "@/components/match/QuarterScoreboard";
import QuarterLineupViewer from "@/components/match/QuarterLineupViewer";
import { useAuth } from "@/hooks/useAuth";
import { computeMatchCourtMargins } from "@/hooks/useCourtStats";

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?#]+)/);
  return m ? m[1] : null;
}

function parseTimestampToSeconds(ts: string): number | null {
  let m = ts.match(/(\d+):(\d+):(\d+)/);
  if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
  m = ts.match(/(\d+):(\d+)/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = ts.match(/(\d+)시간\s*(\d+)분\s*(\d+)초/);
  if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
  m = ts.match(/(\d+)분\s*(\d+)초/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

function formatTimestamp(ts: string): string {
  const secs = parseTimestampToSeconds(ts);
  if (secs === null) return ts;
  const h = Math.floor(secs / 3600);
  const mn = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(mn).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${mn}:${String(s).padStart(2, "0")}`;
}

type AttendanceStatus = "attending" | "absent" | "undecided";

const MatchDetailPage = () => {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const matchId = Number(id);
  const { players, matches, venues, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const [attendance, setAttendance] = useState<Map<number, AttendanceStatus>>(new Map());
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

  // Court margins for this match
  const courtMargins = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return null;
    const sorted = [...matchQuarters].sort((a, b) => a.quarter - b.quarter);
    const matchGoals = goalEvents.filter(g => g.match_id === matchId);
    return computeMatchCourtMargins(sorted, matchGoals, players);
  }, [matchQuarters, goalEvents, matchId, players]);

  if (isLoading) return <SplashScreen />;

  const match = matches.find((m) => m.id === matchId);
  if (!match) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">경기를 찾을 수 없습니다</div>;

  const venue = venues.find((v) => v.id === match.venue_id);
  const mr = getMatchResult(teams, results, matchId);
  const matchTeams = getMatchTeams(teams, matchId);
  const roster = getMatchRoster(rosters, matchId);
  const matchGoalEvents = getMatchGoalEvents(goalEvents, matchId);
  const quarters = [...new Set(matchGoalEvents.map((g) => g.quarter))].sort((a, b) => a - b);
  const opponentTeam = matchTeams.find(t => !t.is_ours);
  const youtubeId = match.youtube_link ? extractYoutubeId(match.youtube_link) : null;
  const today = new Date().toISOString().slice(0, 10);
  const isScheduled = match.date > today || (!mr || mr.ourResult.score_for === null);

  const seekTo = (timestamp: string) => {
    const secs = parseTimestampToSeconds(timestamp);
    if (secs === null || !iframeRef.current) return;
    iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&start=${secs}`;
  };

  const getPlayerMatchStats = () => {
    const statsMap = new Map<number, { goals: number; assists: number; teamId: number }>();
    if (match.has_detail_log) {
      matchGoalEvents.forEach(g => {
        if (g.goal_player_id && !g.is_own_goal) {
          const s = statsMap.get(g.goal_player_id) || { goals: 0, assists: 0, teamId: g.team_id };
          s.goals++; statsMap.set(g.goal_player_id, s);
        }
        if (g.assist_player_id) {
          const s = statsMap.get(g.assist_player_id) || { goals: 0, assists: 0, teamId: g.team_id };
          s.assists++; statsMap.set(g.assist_player_id, s);
        }
      });
      roster.filter(r => matchTeams.some(t => t.is_ours && t.id === r.team_id)).forEach(r => {
        if (!statsMap.has(r.player_id)) statsMap.set(r.player_id, { goals: 0, assists: 0, teamId: r.team_id });
      });
    } else {
      roster.filter(r => matchTeams.some(t => t.is_ours && t.id === r.team_id)).forEach(r => {
        statsMap.set(r.player_id, { goals: r.goals || 0, assists: r.assists || 0, teamId: r.team_id });
      });
    }
    return [...statsMap.entries()].map(([playerId, s]) => ({ playerId, ...s, ap: s.goals + s.assists })).sort((a, b) => b.ap - a.ap || b.goals - a.goals);
  };

  const playerMatchStats = getPlayerMatchStats();
  const attendingPlayers = players.filter(p => attendance.get(p.id) === "attending");
  const absentPlayers = players.filter(p => attendance.get(p.id) === "absent");
  const undecidedPlayers = players.filter(p => attendance.get(p.id) === "undecided");
  const hasAttendanceData = attendance.size > 0;

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft size={24} /></button>
          <div>
            <h1 className="font-display text-xl tracking-wider text-primary text-glow">MATCH DETAIL</h1>
            <p className="text-xs text-muted-foreground">{match.date}</p>
          </div>
        </div>
      </div>

      {isScheduled && (
        <div className="mx-4 mt-4"><MatchPrediction matchId={matchId} /></div>
      )}

      {/* Score Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.ourTeam.name ?? "버니즈"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${mr?.ourResult.result === "승" ? "text-primary text-glow" : "text-foreground"}`}>{mr?.ourResult.score_for ?? "-"}</div>
          </div>
          <div className="text-2xl text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${mr?.opponentResult.result === "승" ? "text-primary text-glow" : "text-foreground"}`}>{mr?.ourResult.score_against ?? "-"}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>{venue?.name}</span>
          <span className="text-primary/50">•</span>
          <span>{match.match_type}</span>
          {match.is_custom && (<><span className="text-primary/50">•</span><span className="text-primary">자체전</span></>)}
        </div>
        {opponentTeam?.age_category && (
          <div className="mt-2 flex justify-center">
            <span className="text-[10px] text-muted-foreground">상대 연령대: {opponentTeam.original_age_desc || opponentTeam.age_category}</span>
          </div>
        )}
        {mr && (
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full px-4 py-1 text-sm font-bold ${mr.ourResult.result === "승" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : mr.ourResult.result === "패" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-muted text-muted-foreground border border-border"}`}>{mr.ourResult.result}</span>
          </div>
        )}
        {isScheduled && (
          <div className="mt-3 flex justify-center">
            <span className="rounded-full border border-muted bg-muted/30 px-4 py-1 text-sm font-bold text-muted-foreground">예정</span>
          </div>
        )}
      </motion.div>

      {/* Quarter Scoreboard */}
      {matchQuarters && matchQuarters.length > 0 && (
        <div className="mx-4 mt-4">
          <QuarterScoreboard
            quarters={matchQuarters}
            ourTeamName={mr?.ourTeam.name ?? matchTeams.find(t => t.is_ours)?.name ?? "버니즈"}
            opponentTeamName={mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀"}
          />
        </div>
      )}

      {/* YouTube */}
      {youtubeId && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-4 mt-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary"><Youtube size={18} /> MATCH VIDEO</h2>
          <div className="aspect-video overflow-hidden rounded-xl border border-border">
            <iframe ref={iframeRef} src={`https://www.youtube.com/embed/${youtubeId}`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </motion.div>
      )}

      {/* Goal Timeline */}
      {match.has_detail_log && matchGoalEvents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mx-4 mt-4">
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">GOAL TIMELINE</h2>
          <div className="space-y-1">
            {quarters.map((q) => (
              <div key={q} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-xs font-bold text-primary">{q}Q</div>
                <div className="space-y-1.5">
                  {matchGoalEvents.filter((g) => g.quarter === q).map((g) => (
                    <div key={g.id} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {g.video_timestamp && youtubeId && (
                          <button onClick={() => seekTo(g.video_timestamp!)} className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/30 transition-colors">▶ {formatTimestamp(g.video_timestamp)}</button>
                        )}
                        {g.is_own_goal ? <span className="text-destructive">⚽ 자책골</span> : (
                          <>
                            <span className="text-primary">⚽</span>
                            <span className="cursor-pointer font-medium text-foreground hover:text-primary" onClick={() => g.goal_player_id && navigate(`/player/${g.goal_player_id}`)}>{g.goal_player_id ? getPlayerName(players, g.goal_player_id) : "???"}</span>
                            {g.assist_player_id && (
                              <>
                                <span className="text-muted-foreground">←</span>
                                <span className="cursor-pointer text-muted-foreground hover:text-primary" onClick={() => navigate(`/player/${g.assist_player_id}`)}>{getPlayerName(players, g.assist_player_id)}</span>
                              </>
                            )}
                          </>
                        )}
                        {match.is_custom && <span className="ml-auto text-[10px] text-muted-foreground">{matchTeams.find(t => t.id === g.team_id)?.name}</span>}
                      </div>
                      {(g.goal_type || g.assist_type || g.build_up_process) && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {g.goal_type && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary border border-primary/20">{g.goal_type}</span>}
                          {g.assist_type && <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400 border border-blue-500/20">{g.assist_type}</span>}
                          {g.build_up_process && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-400 border border-green-500/20">{g.build_up_process}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Match Summary with Court Margin */}
      {playerMatchStats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mx-4 mt-4">
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">{match.has_detail_log ? "종합 기록" : "MATCH SUMMARY"}</h2>
          {!match.has_detail_log && <p className="mb-3 text-xs text-muted-foreground">쿼터별 상세 기록이 없는 경기입니다.</p>}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {playerMatchStats.map((p, i) => {
              const cm = courtMargins?.get(p.playerId);
              const margin = cm?.margin ?? null;
              const isSuperSub = cm?.isSuperSub ?? false;
              return (
                <div key={p.playerId} onClick={() => navigate(`/player/${p.playerId}`)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < playerMatchStats.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{getPlayerName(players, p.playerId)}</span>
                    {isSuperSub && <span className="rounded-full bg-orange-500/10 border border-orange-500/30 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">🔥 슈퍼 서브</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.goals > 0 && <span className="text-sm text-primary">⚽ {p.goals}</span>}
                    {p.assists > 0 && <span className="text-sm text-muted-foreground">🅰️ {p.assists}</span>}
                    {p.goals === 0 && p.assists === 0 && margin === null && <span className="text-xs text-muted-foreground">-</span>}
                    {margin !== null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        margin > 0 ? "bg-green-500/10 border border-green-500/30 text-green-400"
                        : margin < 0 ? "bg-red-500/10 border border-red-500/30 text-red-400"
                        : "bg-muted border border-border text-muted-foreground"
                      }`}>
                        {margin > 0 ? `+${margin}` : margin === 0 ? "0" : `${margin}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* MOM Voting */}
      <div className="mx-4 mt-4"><MOMVoting matchId={matchId} /></div>

      {/* Attendance */}
      {hasAttendanceData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mx-4 mt-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary"><Users size={18} /> ATTENDANCE</h2>
          <div className="space-y-2">
            {attendingPlayers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-green-400"><Check size={12} /> 참석 ({attendingPlayers.length}명)</div>
                <div className="flex flex-wrap gap-1.5">{attendingPlayers.map(p => <span key={p.id} className="rounded-full bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 text-xs text-green-400">{p.name}</span>)}</div>
              </div>
            )}
            {absentPlayers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-400"><X size={12} /> 불참 ({absentPlayers.length}명)</div>
                <div className="flex flex-wrap gap-1.5">{absentPlayers.map(p => <span key={p.id} className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs text-red-400">{p.name}</span>)}</div>
              </div>
            )}
            {undecidedPlayers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-yellow-400"><HelpCircle size={12} /> 미정 ({undecidedPlayers.length}명)</div>
                <div className="flex flex-wrap gap-1.5">{undecidedPlayers.map(p => <span key={p.id} className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 text-xs text-yellow-400">{p.name}</span>)}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Quarter Lineup Viewer */}
      {matchQuarters && matchQuarters.length > 0 && (
        <div className="mx-4 mt-4"><QuarterLineupViewer quarters={matchQuarters} players={players} /></div>
      )}

      {/* Formation Builder */}
      <div className="mx-4 mt-4">
        <FormationBuilder matchId={matchId} players={players} roster={roster} matchTeams={matchTeams} isAdmin={isAdmin} />
      </div>

      {/* Roster */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-4 mt-4">
        <h2 className="mb-3 font-display text-lg tracking-wider text-primary">ROSTER</h2>
        {matchTeams.filter((t) => t.is_ours).map((team) => {
          const teamRoster = roster.filter((r) => r.team_id === team.id);
          return (
            <div key={team.id} className="mb-3">
              {matchTeams.filter(t => t.is_ours).length > 1 && <div className="mb-2 text-xs font-bold text-primary">{team.name}</div>}
              <div className="flex flex-wrap gap-2">
                {teamRoster.map((r) => (
                  <span key={r.id} onClick={() => navigate(`/player/${r.player_id}`)}
                    className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/50">
                    {getPlayerName(players, r.player_id)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Match Comments */}
      <div className="mx-4 mt-4"><MatchComments matchId={matchId} /></div>
    </div>
  );
};

export default MatchDetailPage;
