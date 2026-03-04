import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, PenSquare } from "lucide-react";
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

  // Fetch attendance counts for upcoming matches
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

    // Realtime subscription
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "match_attendance" }, () => {
        fetchAttendance();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (isLoading) return <SplashScreen />;

  const sortedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date));

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
      <div className="space-y-3 px-4">
        {sortedMatches.map((match, i) => {
          const venue = venues.find((v) => v.id === match.venue_id);
          const mr = getMatchResult(teams, results, match.id);
          const attendCount = attendanceCounts[match.id];

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
                    {attendCount != null && attendCount > 0 && (
                      <>
                        <span className="text-primary/60">•</span>
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Users size={10} /> {attendCount}명 참석
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {mr?.ourTeam.name ?? "버니즈"}
                    </span>
                    {mr?.ourResult.score_for != null ? (
                      <div className="flex items-center gap-1">
                        <span className={`font-display text-2xl tracking-wider ${
                          mr.ourResult.result === "승"
                            ? "text-primary text-glow"
                            : mr.ourResult.result === "패"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}>
                          {mr.ourResult.score_for}
                        </span>
                        <span className="text-muted-foreground text-lg">:</span>
                        <span className={`font-display text-2xl tracking-wider ${
                          mr.opponentResult.result === "승"
                            ? "text-primary text-glow"
                            : "text-muted-foreground"
                        }`}>
                          {mr.ourResult.score_against}
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
                    {match.match_type}
                  </span>
                  {match.is_custom && (
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
