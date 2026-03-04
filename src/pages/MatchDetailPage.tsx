import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  matches,
  venues,
  goalEvents,
  rosters,
  getMatchResult,
  getMatchTeams,
  getMatchRoster,
  getMatchGoalEvents,
  getPlayerName,
} from "@/data/futsal";

const MatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const matchId = Number(id);
  const match = matches.find((m) => m.id === matchId);

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        경기를 찾을 수 없습니다
      </div>
    );
  }

  const venue = venues.find((v) => v.id === match.venueId);
  const mr = getMatchResult(matchId);
  const matchTeams = getMatchTeams(matchId);
  const roster = getMatchRoster(matchId);
  const matchGoalEvents = getMatchGoalEvents(matchId);

  const quarters = [...new Set(matchGoalEvents.map((g) => g.quarter))].sort((a, b) => a - b);

  // Build per-player match stats (for all matches)
  const getPlayerMatchStats = () => {
    const statsMap = new Map<number, { goals: number; assists: number; teamId: number }>();

    if (match.hasDetailLog) {
      // From goal events
      matchGoalEvents.forEach(g => {
        if (g.goalPlayerId && !g.isOwnGoal) {
          const s = statsMap.get(g.goalPlayerId) || { goals: 0, assists: 0, teamId: g.teamId };
          s.goals++;
          statsMap.set(g.goalPlayerId, s);
        }
        if (g.assistPlayerId) {
          const s = statsMap.get(g.assistPlayerId) || { goals: 0, assists: 0, teamId: g.teamId };
          s.assists++;
          statsMap.set(g.assistPlayerId, s);
        }
      });
      // Also include roster players with 0 stats
      roster.filter(r => matchTeams.some(t => t.isOurs && t.id === r.teamId)).forEach(r => {
        if (!statsMap.has(r.playerId)) {
          statsMap.set(r.playerId, { goals: 0, assists: 0, teamId: r.teamId });
        }
      });
    } else {
      // From roster goals/assists
      roster.filter(r => matchTeams.some(t => t.isOurs && t.id === r.teamId)).forEach(r => {
        statsMap.set(r.playerId, { goals: r.goals || 0, assists: r.assists || 0, teamId: r.teamId });
      });
    }

    return [...statsMap.entries()]
      .map(([playerId, s]) => ({ playerId, ...s, ap: s.goals + s.assists }))
      .sort((a, b) => b.ap - a.ap || b.goals - a.goals);
  };

  const playerMatchStats = getPlayerMatchStats();

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-display text-xl tracking-wider text-primary text-glow">MATCH DETAIL</h1>
            <p className="text-xs text-muted-foreground">{match.date}</p>
          </div>
        </div>
      </div>

      {/* Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-4 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.ourTeam.name ?? "버니즈"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${mr?.ourResult.result === "승" ? "text-primary text-glow" : "text-foreground"}`}>
              {mr?.ourResult.scoreFor ?? "-"}
            </div>
          </div>
          <div className="text-2xl text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.opponentTeam.name ?? "상대팀"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${mr?.opponentResult.result === "승" ? "text-primary text-glow" : "text-foreground"}`}>
              {mr?.ourResult.scoreAgainst ?? "-"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>{venue?.name}</span>
          <span className="text-primary/50">•</span>
          <span>{match.matchType}</span>
          {match.isCustom && (
            <>
              <span className="text-primary/50">•</span>
              <span className="text-primary">자체전</span>
            </>
          )}
        </div>
        {mr && (
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full px-4 py-1 text-sm font-bold ${
              mr.ourResult.result === "승" ? "gradient-pink text-primary-foreground"
                : mr.ourResult.result === "패" ? "bg-muted text-muted-foreground"
                : "border border-primary/40 text-primary"
            }`}>{mr.ourResult.result}</span>
          </div>
        )}
      </motion.div>

      {/* Goal Timeline (detail log only) */}
      {match.hasDetailLog && matchGoalEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4 mt-4"
        >
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">GOAL TIMELINE</h2>
          <div className="space-y-1">
            {quarters.map((q) => (
              <div key={q} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-xs font-bold text-primary">{q}Q</div>
                <div className="space-y-1.5">
                  {matchGoalEvents.filter((g) => g.quarter === q).map((g) => (
                    <div key={g.id} className="flex items-center gap-2 text-sm">
                      {g.isOwnGoal ? (
                        <span className="text-destructive">⚽ 자책골</span>
                      ) : (
                        <>
                          <span className="text-primary">⚽</span>
                          <span className="cursor-pointer font-medium text-foreground hover:text-primary"
                            onClick={() => g.goalPlayerId && navigate(`/player/${g.goalPlayerId}`)}>
                            {g.goalPlayerId ? getPlayerName(g.goalPlayerId) : "???"}
                          </span>
                          {g.assistPlayerId && (
                            <>
                              <span className="text-muted-foreground">←</span>
                              <span className="cursor-pointer text-muted-foreground hover:text-primary"
                                onClick={() => navigate(`/player/${g.assistPlayerId}`)}>
                                {getPlayerName(g.assistPlayerId)}
                              </span>
                            </>
                          )}
                        </>
                      )}
                      {match.isCustom && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {matchTeams.find(t => t.id === g.teamId)?.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Player Match Stats (always shown) */}
      {playerMatchStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 mt-4"
        >
          <h2 className="mb-3 font-display text-lg tracking-wider text-primary">
            {match.hasDetailLog ? "종합 기록" : "MATCH SUMMARY"}
          </h2>
          {!match.hasDetailLog && (
            <p className="mb-3 text-xs text-muted-foreground">
              쿼터별 상세 기록이 없는 경기입니다. (개인별 합산 기록만 표시)
            </p>
          )}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {playerMatchStats.map((p, i) => (
              <div
                key={p.playerId}
                onClick={() => navigate(`/player/${p.playerId}`)}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${
                  i < playerMatchStats.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-sm font-medium text-foreground">{getPlayerName(p.playerId)}</span>
                <div className="flex items-center gap-3">
                  {p.goals > 0 && <span className="text-sm text-primary">⚽ {p.goals}</span>}
                  {p.assists > 0 && <span className="text-sm text-muted-foreground">🅰️ {p.assists}</span>}
                  {p.goals === 0 && p.assists === 0 && <span className="text-xs text-muted-foreground">-</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Roster */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-4"
      >
        <h2 className="mb-3 font-display text-lg tracking-wider text-primary">ROSTER</h2>
        {matchTeams.filter((t) => t.isOurs).map((team) => {
          const teamRoster = roster.filter((r) => r.teamId === team.id);
          return (
            <div key={team.id} className="mb-3">
              {matchTeams.filter(t => t.isOurs).length > 1 && (
                <div className="mb-2 text-xs font-bold text-primary">{team.name}</div>
              )}
              <div className="flex flex-wrap gap-2">
                {teamRoster.map((r) => (
                  <span key={r.id} onClick={() => navigate(`/player/${r.playerId}`)}
                    className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/50">
                    {getPlayerName(r.playerId)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default MatchDetailPage;
