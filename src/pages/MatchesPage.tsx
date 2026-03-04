import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  matches,
  venues,
  getMatchResult,
} from "@/data/futsal";
import PageHeader from "@/components/PageHeader";

const MatchesPage = () => {
  const navigate = useNavigate();
  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="pb-20">
      <PageHeader title="MATCHES" subtitle={`총 ${matches.length}경기`} />
      <div className="space-y-3 px-4">
        {sortedMatches.map((match, i) => {
          const venue = venues.find((v) => v.id === match.venueId);
          const mr = getMatchResult(match.id);

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/match/${match.id}`)}
              className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:box-glow active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{match.date}</span>
                    <span className="text-primary/60">•</span>
                    <span>{venue?.name}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {mr?.ourTeam.name ?? "버니즈"}
                    </span>
                    {mr?.ourResult.scoreFor !== undefined ? (
                      <div className="flex items-center gap-1">
                        <span className={`font-display text-2xl tracking-wider ${
                          mr.ourResult.result === "승"
                            ? "text-primary text-glow"
                            : mr.ourResult.result === "패"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}>
                          {mr.ourResult.scoreFor}
                        </span>
                        <span className="text-muted-foreground text-lg">:</span>
                        <span className={`font-display text-2xl tracking-wider ${
                          mr.opponentResult.result === "승"
                            ? "text-primary text-glow"
                            : "text-muted-foreground"
                        }`}>
                          {mr.ourResult.scoreAgainst}
                        </span>
                      </div>
                    ) : (
                      <span className="font-display text-xl text-primary text-glow">
                        {mr?.ourResult.result ?? "-"}
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {mr?.opponentTeam.name ?? "상대팀"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    mr?.ourResult.result === "승"
                      ? "gradient-pink text-primary-foreground"
                      : mr?.ourResult.result === "패"
                      ? "bg-muted text-muted-foreground"
                      : "border border-primary/40 text-primary"
                  }`}>
                    {mr?.ourResult.result ?? "-"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {match.matchType}
                  </span>
                  {match.isCustom && (
                    <span className="text-[10px] text-primary/70">자체전</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchesPage;
