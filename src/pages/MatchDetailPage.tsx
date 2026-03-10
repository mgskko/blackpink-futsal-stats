import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Youtube, Check, X, HelpCircle, Users } from "lucide-react";
import { useAllFutsalData, getMatchResult, getMatchTeams, getMatchRoster, getMatchGoalEvents, getPlayerName, useMatchQuarters } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";
import MOMVoting from "@/components/MOMVoting";
import WorstVoting from "@/components/match/WorstVoting";
import FormationBuilder from "@/components/match/FormationBuilder";
import MatchPrediction from "@/components/match/MatchPrediction";
import MatchComments from "@/components/match/MatchComments";
import QuarterScoreboard from "@/components/match/QuarterScoreboard";
import { useAuth } from "@/hooks/useAuth";
import { computeMatchCourtMargins } from "@/hooks/useCourtStats";
import { useMatchAnalysis, computeDualDataMOM } from "@/hooks/useMatchAnalysis";
import type { DataMOMResult } from "@/hooks/useMatchAnalysis";

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

// Helper: get player position info per quarter from lineup data (supports teamA/teamB)
function getPlayerPositionFromLineup(lineup: any, playerId: number): string | null {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return null;
  // Check teamA/teamB format
  if (lineup.teamA || lineup.teamB) {
    for (const team of [lineup.teamA, lineup.teamB]) {
      if (!team) continue;
      for (const pos of ["GK", "DF", "MF", "FW", "Bench"]) {
        if (team[pos]) {
          const ids = (Array.isArray(team[pos]) ? team[pos] : [team[pos]]).map(Number);
          if (ids.includes(playerId)) return pos;
        }
      }
    }
    return null;
  }
  for (const pos of ["GK", "DF", "MF", "FW", "Bench"]) {
    if (lineup[pos]) {
      const ids = (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).map(Number);
      if (ids.includes(playerId)) return pos;
    }
  }
  return null;
}

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

  const courtMargins = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return null;
    const sorted = [...matchQuarters].sort((a, b) => a.quarter - b.quarter);
    const matchGoals = goalEvents.filter(g => g.match_id === matchId);
    return computeMatchCourtMargins(sorted, matchGoals, players);
  }, [matchQuarters, goalEvents, matchId, players]);

  const { dataMOM, dualDataMOM, aiComments } = useMatchAnalysis(matchId, players, teams, results, goalEvents, matchQuarters ?? []);

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

  // Build lineup summary table: player → position per quarter (supports teamA/teamB)
  const lineupSummary = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return null;
    const hasLineup = matchQuarters.some(q => {
      if (!q.lineup || typeof q.lineup !== "object" || Array.isArray(q.lineup)) return false;
      const l = q.lineup as any;
      return l.GK || l.teamA?.GK || l.teamB?.GK;
    });
    if (!hasLineup) return null;

    const sortedQ = [...matchQuarters].sort((a, b) => a.quarter - b.quarter);
    const playerMap = new Map<number, Map<number, string>>();
    const playerTeamMap = new Map<number, "teamA" | "teamB">();

    sortedQ.forEach(q => {
      if (!q.lineup) return;
      const lineup = q.lineup as any;
      const isCustom = lineup.teamA || lineup.teamB;

      if (isCustom) {
        for (const teamKey of ["teamA", "teamB"] as const) {
          if (!lineup[teamKey]) continue;
          for (const pos of ["GK", "DF", "MF", "FW", "Bench"]) {
            if (lineup[teamKey][pos]) {
              const ids = (Array.isArray(lineup[teamKey][pos]) ? lineup[teamKey][pos] : [lineup[teamKey][pos]]).map(Number);
              ids.forEach((pid: number) => {
                if (!playerMap.has(pid)) playerMap.set(pid, new Map());
                playerMap.get(pid)!.set(q.quarter, pos);
                playerTeamMap.set(pid, teamKey);
              });
            }
          }
        }
      } else {
        for (const pos of ["GK", "DF", "MF", "FW", "Bench"]) {
          if (lineup[pos]) {
            const ids = (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).map(Number);
            ids.forEach((pid: number) => {
              if (!playerMap.has(pid)) playerMap.set(pid, new Map());
              playerMap.get(pid)!.set(q.quarter, pos);
            });
          }
        }
      }
    });

    return { players: playerMap, quarters: sortedQ.map(q => q.quarter), playerTeamMap };
  }, [matchQuarters]);

  // Compute clean sheet badges per player (supports teamA/teamB)
  const cleanSheetBadges = useMemo(() => {
    if (!matchQuarters || matchQuarters.length === 0) return new Map<number, number>();
    const badges = new Map<number, number>();
    matchQuarters.forEach(q => {
      if (!q.lineup) return;
      const lineup = q.lineup as any;
      const isCustom = lineup.teamA || lineup.teamB;
      const getDFGK = (l: any, conceded: number) => {
        if (conceded > 0) return;
        const players: number[] = [];
        if (l?.GK) (Array.isArray(l.GK) ? l.GK : [l.GK]).forEach((id: any) => players.push(Number(id)));
        if (l?.DF) (Array.isArray(l.DF) ? l.DF : [l.DF]).forEach((id: any) => players.push(Number(id)));
        players.forEach(pid => badges.set(pid, (badges.get(pid) || 0) + 1));
      };
      if (isCustom) {
        getDFGK(lineup.teamA, q.score_against || 0);
        getDFGK(lineup.teamB, q.score_for || 0);
      } else {
        getDFGK(lineup, q.score_against || 0);
      }
    });
    return badges;
  }, [matchQuarters]);

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

  // Use quarter total if available, otherwise use results table
  const displayScoreFor = quarterTotalScore?.scoreFor ?? mr?.ourResult.score_for ?? null;
  const displayScoreAgainst = quarterTotalScore?.scoreAgainst ?? mr?.ourResult.score_against ?? null;
  const displayResult = displayScoreFor !== null && displayScoreAgainst !== null
    ? (displayScoreFor > displayScoreAgainst ? "승" : displayScoreFor < displayScoreAgainst ? "패" : "무")
    : mr?.ourResult.result ?? null;

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

      {/* Score Card - uses quarter totals */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.ourTeam.name ?? "버니즈"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${displayResult === "승" ? "text-primary text-glow" : "text-foreground"}`}>{displayScoreFor ?? "-"}</div>
          </div>
          <div className="text-2xl text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.opponentTeam.name ?? opponentTeam?.name ?? "상대팀"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${displayResult === "패" ? "text-primary text-glow" : "text-foreground"}`}>{displayScoreAgainst ?? "-"}</div>
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
        {displayResult && (
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full px-4 py-1 text-sm font-bold ${displayResult === "승" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : displayResult === "패" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-muted text-muted-foreground border border-border"}`}>{displayResult}</span>
          </div>
        )}
        {isScheduled && !displayResult && (
          <div className="mt-3 flex justify-center">
            <span className="rounded-full border border-muted bg-muted/30 px-4 py-1 text-sm font-bold text-muted-foreground">예정</span>
          </div>
        )}
      </motion.div>

      {/* AI Match Comments */}
      {aiComments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 space-y-1.5">
          {aiComments.map((c, i) => (
            <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
              {c}
            </div>
          ))}
        </motion.div>
      )}

      {/* Data MOM */}
      {dataMOM && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-primary/30 bg-card p-4 box-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👑</span>
              <div>
                <div className="text-[10px] font-bold tracking-wider text-primary">DATA MOM</div>
                <div className="text-lg font-bold text-foreground">{dataMOM.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display text-primary text-glow">{dataMOM.score.toFixed(1)}</div>
              <div className="text-[9px] text-muted-foreground">종합 점수</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md bg-secondary/50 p-2 text-center">
              <div className="text-[9px] text-muted-foreground">공격</div>
              <div className="text-sm font-bold text-foreground">{dataMOM.breakdown.attack.toFixed(1)}</div>
            </div>
            <div className="rounded-md bg-secondary/50 p-2 text-center">
              <div className="text-[9px] text-muted-foreground">수비</div>
              <div className="text-sm font-bold text-foreground">{dataMOM.breakdown.defense.toFixed(1)}</div>
            </div>
            <div className="rounded-md bg-secondary/50 p-2 text-center">
              <div className="text-[9px] text-muted-foreground">감점</div>
              <div className="text-sm font-bold text-foreground">{dataMOM.breakdown.penalty.toFixed(1)}</div>
            </div>
          </div>
        </motion.div>
      )}

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
                        {g.video_timestamp && !youtubeId && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{formatTimestamp(g.video_timestamp)}</span>
                        )}
                        {g.is_own_goal ? <span className="text-destructive">⚽ 자책골 ({g.goal_player_id ? getPlayerName(players, g.goal_player_id) : "???"})</span> : (
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

      {/* Match Summary with Court Margin + Clean Sheet Badge */}
      {playerMatchStats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mx-4 mt-4">
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">{match.has_detail_log ? "종합 기록" : "MATCH SUMMARY"}</h2>
          {!match.has_detail_log && <p className="mb-3 text-xs text-muted-foreground">쿼터별 상세 기록이 없는 경기입니다.</p>}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {playerMatchStats.map((p, i) => {
              const cm = courtMargins?.get(p.playerId);
              const margin = cm?.margin ?? null;
              const isSuperSub = cm?.isSuperSub ?? false;
              const csCount = cleanSheetBadges.get(p.playerId) || 0;
              return (
                <div key={p.playerId}
                  className={`px-4 py-2.5 transition-colors hover:bg-secondary ${i < playerMatchStats.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="flex cursor-pointer items-center justify-between" onClick={() => navigate(`/player/${p.playerId}`)}>
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
                  {csCount > 0 && (
                    <div className="mt-1 text-[11px] text-green-400">
                      🛡️ DF/GK로 출전하여 무실점 쿼터를 {csCount}회 기록했습니다!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* MOM Voting */}
      <div className="mx-4 mt-4"><MOMVoting matchId={matchId} /></div>

      {/* Worst Voting */}
      <div className="mx-4 mt-4"><WorstVoting matchId={matchId} /></div>

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

      {/* Quarter Lineup Summary Table */}
      {lineupSummary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-4 mt-4">
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">QUARTER LINEUP</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-2 text-left font-bold text-foreground">이름</th>
                  {lineupSummary.quarters.map(q => (
                    <th key={q} className="px-2 py-2 text-center font-bold text-primary">{q}Q</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...lineupSummary.players.entries()].map(([pid, posMap]) => (
                  <tr key={pid} className="border-b border-border last:border-0 hover:bg-secondary/20">
                    <td className="px-3 py-2 font-medium text-foreground cursor-pointer hover:text-primary" onClick={() => navigate(`/player/${pid}`)}>
                      {getPlayerName(players, pid)}
                    </td>
                    {lineupSummary.quarters.map(q => {
                      const pos = posMap.get(q);
                      const posColor = pos === "GK" ? "text-yellow-400" : pos === "DF" ? "text-blue-400" : pos === "FW" ? "text-red-400" : pos === "MF" ? "text-green-400" : pos === "Bench" ? "text-muted-foreground" : "";
                      return (
                        <td key={q} className={`px-2 py-2 text-center ${posColor}`}>
                          {pos || "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
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
