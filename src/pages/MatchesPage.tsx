import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAllFutsalData, getMatchResult, getMatchSides } from "@/hooks/useFutsalData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import SignInHero from "@/components/SignInHero";
import SportToggle from "@/components/SportToggle";
import SeasonHero, { type ResultKind, type SeasonRecord } from "@/components/match/SeasonHero";
import MatchCard, { type MatchStatus } from "@/components/match/MatchCard";
import { useTeamName } from "@/lib/displayName";
import { localISODate } from "@/lib/utils";
import { filterMatchesBySport, sportOfMatch, sportLabel, sportEmoji, type SportFilter } from "@/lib/sport";

/** Live attending-count per match (realtime). */
function useAttendanceCounts(enabled: boolean) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const fetchAttendance = async () => {
      const { data } = await supabase.from("match_attendance").select("match_id, status").eq("status", "attending");
      if (!alive || !data) return;
      const next: Record<number, number> = {};
      data.forEach((r: { match_id: number }) => {
        next[r.match_id] = (next[r.match_id] || 0) + 1;
      });
      setCounts(next);
    };
    fetchAttendance();
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "match_attendance" }, fetchAttendance)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [enabled]);
  return counts;
}

const MatchesPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { matches: allSportMatches, venues, teams, results, isLoading } = useAllFutsalData();
  const [sport, setSport] = useState<SportFilter>("all");
  const attendanceCounts = useAttendanceCounts(!!user);
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  const teamName = useTeamName();

  const matches = useMemo(() => filterMatchesBySport(allSportMatches, sport), [allSportMatches, sport]);

  const rows = useMemo(() => {
    const today = localISODate();
    const venueName = new Map(venues.map(v => [v.id, v.name]));
    return [...matches]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map(match => {
        const mr = getMatchResult(teams, results, match.id);
        // Future → scheduled; past without a result record → scheduled; otherwise the result.
        const status: MatchStatus =
          match.date > today || !mr
            ? "scheduled"
            : mr.ourResult.result === "승"
              ? "win"
              : mr.ourResult.result === "패"
                ? "loss"
                : "draw";
        const venue = venueName.get(match.venue_id);
        const sides = getMatchSides(teams, match.id);
        return { match, mr, sides, status, venue: venue ? `${venue}${match.sub_venue ? ` ${match.sub_venue}` : ""}` : undefined };
      });
  }, [matches, venues, teams, results]);

  const { record, next } = useMemo(() => {
    const rec: SeasonRecord = { played: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, form: [] };
    rows.forEach(r => {
      if (r.status === "scheduled" || r.match.is_custom) return; // intrasquad games don't count for the club record
      rec.played++;
      rec[r.status]++;
      rec.goalsFor += r.mr?.ourResult.score_for ?? 0;
      rec.goalsAgainst += r.mr?.ourResult.score_against ?? 0;
      if (rec.form.length < 5) rec.form.push(r.status as ResultKind);
    });
    const today = localISODate();
    const upcoming = rows.filter(r => r.match.date >= today && r.status === "scheduled").at(-1);
    return {
      record: rec,
      next: upcoming
        ? {
            id: upcoming.match.id,
            date: upcoming.match.date,
            opponent: teamName(upcoming.sides.opponentTeam?.name) || t("matches.opponentFallback"),
            venue: upcoming.venue,
            attending: attendanceCounts[upcoming.match.id],
          }
        : null,
    };
  }, [rows, attendanceCounts, teamName, t]);

  // Month sections
  const sections = useMemo(() => {
    const out: { key: string; label: string; items: typeof rows }[] = [];
    rows.forEach(r => {
      const key = r.match.date.slice(0, 7);
      let sec = out[out.length - 1];
      if (!sec || sec.key !== key) {
        const [y, m] = key.split("-").map(Number);
        const label = isEn ? new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" }) : `${y}년 ${m}월`;
        sec = { key, label, items: [] };
        out.push(sec);
      }
      sec.items.push(r);
    });
    return out;
  }, [rows, isEn]);

  if (authLoading || (user && isLoading)) return <SplashScreen />;
  if (!user) return <SignInHero />;

  const statusLabel = (s: MatchStatus) =>
    s === "win" ? t("matches.win") : s === "loss" ? t("matches.loss") : s === "draw" ? t("matches.draw") : t("matches.scheduled");

  let idx = 0;
  return (
    <div className="relative z-10">
      <PageHeader
        title={t("matches.title")}
        subtitle={t("matches.totalCount", { count: matches.length })}
        rightSlot={
          isAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              className="liquid-glass pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <PenSquare size={12} />
              {t("matches.manage")}
            </button>
          ) : null
        }
      />

      <SeasonHero record={record} next={next} isEn={isEn} onOpenMatch={id => navigate(`/match/${id}`)} />

      <div className="sticky top-0 z-30 px-4 pb-2 pt-4" style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}>
        <SportToggle value={sport} onChange={setSport} isEn={isEn} className="w-full" />
      </div>

      <div className="px-4">
        {sections.map(sec => (
          <section key={sec.key} className="mt-3">
            <h2 className="mb-2 flex items-center gap-2 px-1 text-[12px] font-bold tracking-wide text-muted-foreground" style={{ fontFamily: "inherit" }}>
              {sec.label}
              <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              <span className="font-num text-[10px]">{sec.items.length}</span>
            </h2>
            <div className="space-y-2.5">
              {sec.items.map(({ match, mr, sides, status, venue }) => (
                <MatchCard
                  key={match.id}
                  index={idx++}
                  isEn={isEn}
                  date={match.date}
                  venue={venue}
                  sportBadge={`${sportEmoji(sportOfMatch(match))} ${sportLabel(sportOfMatch(match), isEn)}`}
                  matchType={match.match_type}
                  isCustom={match.is_custom}
                  customLabel={t("matches.selfMatch")}
                  ourName={teamName(sides.ourTeam?.name) || t("matches.ourTeamFallback")}
                  oppName={teamName(sides.opponentTeam?.name) || t("matches.opponentFallback")}
                  scoreFor={mr?.ourResult.score_for}
                  scoreAgainst={mr?.ourResult.score_against}
                  status={status}
                  statusLabel={statusLabel(status)}
                  attending={attendanceCounts[match.id]}
                  onClick={() => navigate(`/match/${match.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
        {rows.length === 0 && (
          <div className="surface mt-4 rounded-3xl px-6 py-12 text-center text-sm text-muted-foreground">
            {isEn ? "No matches yet." : "아직 등록된 경기가 없어요."}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchesPage;
