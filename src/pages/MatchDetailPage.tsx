import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  matches,
  venues,
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
  const goalEvents = getMatchGoalEvents(matchId);

  // Group goal events by quarter
  const quarters = [...new Set(goalEvents.map((g) => g.quarter))].sort((a, b) => a - b);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-primary">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-display text-xl tracking-wider text-primary text-glow">
              MATCH DETAIL
            </h1>
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
            <div className={`mt-1 font-display text-5xl tracking-wider ${
              mr?.ourResult.result === "승" ? "text-primary text-glow" : "text-foreground"
            }`}>
              {mr?.ourResult.scoreFor ?? "-"}
            </div>
          </div>
          <div className="text-2xl text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{mr?.opponentTeam.name ?? "상대팀"}</div>
            <div className={`mt-1 font-display text-5xl tracking-wider ${
              mr?.opponentResult.result === "승" ? "text-primary text-glow" : "text-foreground"
            }`}>
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
              mr.ourResult.result === "승"
                ? "gradient-pink text-primary-foreground"
                : mr.ourResult.result === "패"
                ? "bg-muted text-muted-foreground"
                : "border border-primary/40 text-primary"
            }`}>
              {mr.ourResult.result}
            </span>
          </div>
        )}
      </motion.div>

      {/* Goal Timeline */}
      {goalEvents.length > 0 && (
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
                  {goalEvents
                    .filter((g) => g.quarter === q)
                    .map((g) => (
                      <div key={g.id} className="flex items-center gap-2 text-sm">
                        {g.isOwnGoal ? (
                          <span className="text-destructive">⚽ 자책골</span>
                        ) : (
                          <>
                            <span className="text-primary">⚽</span>
                            <span
                              className="cursor-pointer font-medium text-foreground hover:text-primary"
                              onClick={() => g.goalPlayerId && navigate(`/player/${g.goalPlayerId}`)}
                            >
                              {g.goalPlayerId ? getPlayerName(g.goalPlayerId) : "???"}
                            </span>
                            {g.assistPlayerId && (
                              <>
                                <span className="text-muted-foreground">←</span>
                                <span
                                  className="cursor-pointer text-muted-foreground hover:text-primary"
                                  onClick={() => navigate(`/player/${g.assistPlayerId}`)}
                                >
                                  {getPlayerName(g.assistPlayerId)}
                                </span>
                              </>
                            )}
                          </>
                        )}
                        {/* Show team name for custom matches */}
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

      {/* Roster */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-4"
      >
        <h2 className="mb-3 font-display text-lg tracking-wider text-primary">ROSTER</h2>
        {matchTeams
          .filter((t) => t.isOurs)
          .map((team) => {
            const teamRoster = roster.filter((r) => r.teamId === team.id);
            return (
              <div key={team.id} className="mb-3">
                {matchTeams.filter(t => t.isOurs).length > 1 && (
                  <div className="mb-2 text-xs font-bold text-primary">{team.name}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  {teamRoster.map((r) => (
                    <span
                      key={r.id}
                      onClick={() => navigate(`/player/${r.playerId}`)}
                      className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/50"
                    >
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
