import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, PenSquare, Calendar } from "lucide-react";
import { useAllFutsalData, getMatchResult } from "@/hooks/useFutsalData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import { useTranslation } from "react-i18next";
import { useTeamName } from "@/lib/displayName";

const MatchesPage = () => {
  const navigate = useNavigate();
  const { matches, venues, teams, results, isLoading } = useAllFutsalData();
  const { isAdmin } = useAuth();
  const [attendanceCounts, setAttendanceCounts] = useState<Record<number, number>>({});
  const { t } = useTranslation();
  const teamName = useTeamName();

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
    // Past match with no result record at all → scheduled
    if (!mr) return "scheduled";
    // Past match with a result record → show the result even if score is null
    return mr.ourResult.result === "승" ? "win" : mr.ourResult.result === "패" ? "loss" : "draw";
  };

  return (
    <div className="relative z-10 pb-28">
      <PageHeader
        title={t("matches.title")}
        subtitle={t("matches.totalCount", { count: matches.length })}
        rightSlot={
          isAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              className="glass glass-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <PenSquare size={12} />
              {t("matches.manage")}
            </button>
          ) : null
        }
      />
      <div className="space-y-3 px-4">
        {sortedMatches.map((match, i) => {
          const venue = venues.find((v) => v.id === match.venue_id);
          const mr = getMatchResult(teams, results, match.id);
          const attendCount = attendanceCounts[match.id];
          const status = getMatchStatus(match);

          const stripColor = status === "win"
            ? "bg-blue-500 shadow-[0_0_15px_hsl(217_91%_60%/0.5)]"
            : status === "loss"
            ? "bg-pink-500 shadow-[0_0_15px_hsl(330_100%_71%/0.5)]"
            : status === "draw"
            ? "bg-amber-400 shadow-[0_0_15px_hsl(45_100%_55%/0.5)]"
            : "bg-muted-foreground/50";

          const badgeStyle = status === "win"
            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
            : status === "loss"
            ? "bg-pink-500/20 text-pink-400 border-pink-500/30"
            : status === "draw"
            ? "bg-amber-400/20 text-amber-400 border-amber-400/30"
            : "bg-muted text-muted-foreground border-border";

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/match/${match.id}`)}
              className="group relative cursor-pointer overflow-hidden rounded-3xl glass glass-hover active:scale-[0.98]"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`} />
              <div className="flex items-center justify-between p-5">
                <div className="flex-1 min-w-0">
                  {/* Date & venue row */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span>{match.date}</span>
                    <span className="opacity-40">•</span>
                    <span className="truncate">{venue?.name}</span>
                    {match.is_custom && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="text-primary/80">{t("matches.selfMatch")}</span>
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
                    <span className="text-sm font-bold text-foreground truncate max-w-[100px]">
                      {teamName(mr?.ourTeam.name) || t("matches.ourTeamFallback")}
                    </span>

                    {status === "scheduled" ? (
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl text-muted-foreground">{t("matches.vs")}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 tabular-nums">
                        <span className={`font-display text-2xl tracking-wider ${
                          status === "win" ? "text-blue-400" : status === "loss" ? "text-red-400" : "text-muted-foreground"
                        }`}>
                          {mr?.ourResult.score_for ?? "-"}
                        </span>
                        <span className="text-muted-foreground text-lg">:</span>
                        <span className={`font-display text-2xl tracking-wider ${
                          status === "loss" ? "text-red-400" : "text-muted-foreground"
                        }`}>
                          {mr?.ourResult.score_against ?? "-"}
                        </span>
                      </div>
                    )}

                    <span className="text-sm font-bold text-foreground truncate max-w-[100px]">
                      {teamName(mr?.opponentTeam.name) || t("matches.opponentFallback")}
                    </span>
                  </div>
                </div>

                {/* Result badge */}
                <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                  {status === "scheduled" ? (
                    <span className="flex items-center gap-1 rounded-full border border-muted bg-muted/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Calendar size={10} /> {t("matches.scheduled")}
                    </span>
                  ) : (
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeStyle}`}>
                      {status === "win" ? t("matches.win") : status === "loss" ? t("matches.loss") : t("matches.draw")}
                    </span>
                  )}
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
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
