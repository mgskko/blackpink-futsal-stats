import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, PenSquare, Calendar } from "lucide-react";
import { useAllFutsalData, getMatchResult } from "@/hooks/useFutsalData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";

const MatchesPage = () => {
  const navigate = useNavigate();
  const { matches, venues, teams, results, isLoading } = useAllFutsalData();
  const { isAdmin } = useAuth();
  const [attendanceCounts, setAttendanceCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const fetchAttendance = async () => {
      const { data } = await supabase
        .from("match_attendance")
        .select("match_id, status")
        .eq("status", "attending");
      if (data) {
        const counts: Record<number, number> = {};
        data.forEach((r: any) => {
          counts[r.match_id] = (counts[r.match_id] || 0) + 1;
        });
        setAttendanceCounts(counts);
      }
    };
    fetchAttendance();
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "match_attendance" }, () => {
        fetchAttendance();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (isLoading) return <SplashScreen />;

  const today = new Date().toISOString().slice(0, 10);
  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));

  const getMatchStatus = (match: typeof matches[0]) => {
    // Future matches are always "scheduled"
    if (match.date > today) return "scheduled";
    const mr = getMatchResult(teams, results, match.id);
    if (!mr || mr.ourResult.score_for === null) return "scheduled";
    return mr.ourResult.result === "승" ? "win" : mr.ourResult.result === "패" ? "loss" : "draw";
  };

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between px-4">
        <PageHeader title="MATCHES" subtitle={`총 ${matches.length}경기`} />
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <PenSquare size={14} />
            경기 관리
          </button>
        )}
      </div>
      <div className="space-y-2 px-4">
        {sortedMatches.map((match, i) => {
          const venue = venues.find((v) => v.id === match.venue_id);
          const mr = getMatchResult(teams, results, match.id);
          const attendCount = attendanceCounts[match.id];
          const status = getMatchStatus(match);

          const borderColor = status === "win"
            ? "border-l-blue-500"
            : status === "loss"
            ? "border-l-red-500"
            : status === "draw"
            ? "border-l-muted-foreground"
            : "border-l-muted";

          const bgColor = status === "win"
            ? "bg-blue-500/5"
            : status === "loss"
            ? "bg-red-500/5"
            : status === "scheduled"
            ? "bg-muted/20"
            : "bg-card";

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/match/${match.id}`)}
              className={`cursor-pointer rounded-lg border border-border border-l-4 ${borderColor} ${bgColor} p-4 transition-all hover:border-primary/40 active:scale-[0.98]`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* Date & venue row */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{match.date}</span>
                    <span className="opacity-40">•</span>
                    <span className="truncate">{venue?.name}</span>
                    {match.is_custom && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="text-primary/70">자체전</span>
                      </>
                    )}
                    {attendCount != null && attendCount > 0 && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="flex items-center gap-0.5 text-primary font-medium">
                          <Users size={10} /> {attendCount}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Score row */}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground truncate max-w-[80px]">
                      {mr?.ourTeam.name ?? "버니즈"}
                    </span>

                    {status === "scheduled" ? (
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl text-muted-foreground">VS</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={`font-display text-2xl tracking-wider ${
                          status === "win" ? "text-blue-400" : status === "loss" ? "text-red-400" : "text-muted-foreground"
                        }`}>
                          {mr?.ourResult.score_for}
                        </span>
                        <span className="text-muted-foreground text-lg">:</span>
                        <span className={`font-display text-2xl tracking-wider ${
                          status === "loss" ? "text-red-400" : "text-muted-foreground"
                        }`}>
                          {mr?.ourResult.score_against}
                        </span>
                      </div>
                    )}

                    <span className="text-sm font-bold text-foreground truncate max-w-[80px]">
                      {mr?.opponentTeam.name ?? "상대팀"}
                    </span>
                  </div>
                </div>

                {/* Result badge */}
                <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                  {status === "scheduled" ? (
                    <span className="flex items-center gap-1 rounded-full border border-muted bg-muted/30 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                      <Calendar size={10} /> 예정
                    </span>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      status === "win"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : status === "loss"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {mr?.ourResult.result ?? "-"}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {match.match_type}
                  </span>
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
