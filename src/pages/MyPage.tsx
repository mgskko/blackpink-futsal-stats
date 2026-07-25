import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, User, Link as LinkIcon, Trophy, Target, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAllFutsalData, getPlayerStats, getPlayerBestAPMatch, getPlayerName } from "@/hooks/useFutsalData";
import { getPlayerBadges, getVarianceBadge } from "@/hooks/useAdvancedStats";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import NicknameEditor from "@/components/my/NicknameEditor";
import burneesLogo from "@/assets/burnees-logo.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDisplayName } from "@/lib/displayName";

const MyPage = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(false);
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const displayName = useDisplayName();

  const { data: momVotes } = useQuery({
    queryKey: ["mom_votes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("mom_votes").select("match_id, voted_player_id");
      return (data ?? []) as { match_id: number; voted_player_id: number }[];
    },
  });

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.img
          src={burneesLogo}
          alt="Loading"
          className="h-16 w-16 rounded-full"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 pb-20">
        <motion.img
          src={burneesLogo}
          alt="Bunnies FC"
          className="h-28 w-28 rounded-full box-glow"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        />
        <div className="text-center">
          <h1 className="font-display text-3xl tracking-wider text-glow text-primary">BUNNIES FC</h1>
          <p className="mt-2 text-sm text-muted-foreground">{L("Google 계정으로 로그인하세요", "Sign in with your Google account")}</p>
        </div>
        <Button
          onClick={async () => {
            await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
          }}
          className="w-full max-w-xs gradient-pink text-primary-foreground font-bold text-base py-6"
        >
          {L("Google로 로그인", "Sign in with Google")}
        </Button>
      </div>
    );
  }

  // Linked player
  const linkedPlayer = profile?.player_id ? players.find(p => p.id === profile.player_id) : null;

  if (!linkedPlayer) {
    // Player linking screen
    const activePlayers = players.filter(p => p.is_active);
    const inactivePlayers = players.filter(p => !p.is_active);

    const handleLink = async (playerId: number) => {
      setLinking(true);
      await supabase.from("profiles").update({ player_id: playerId }).eq("id", user.id);
      await refreshProfile();
      setLinking(false);
    };

    return (
      <div className="pb-20">
        <PageHeader title={L("선수 연동", "Link Player")} subtitle={L("본인의 프로필을 선택해주세요", "Select your player profile")} />
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">{L("현재 활동 선수", "Active players")}</p>
          {activePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => handleLink(p.id)}
              disabled={linking}
              className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary transition-colors"
            >
              <span className="font-medium text-foreground">{displayName(p)}</span>
              <span className="ml-2 text-xs text-primary">ACTIVE</span>
            </button>
          ))}
          <p className="text-xs text-muted-foreground mt-4 mb-3">{L("비활동 선수", "Inactive players")}</p>
          {inactivePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => handleLink(p.id)}
              disabled={linking}
              className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary transition-colors"
            >
              <span className="text-muted-foreground">{displayName(p)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Dashboard
  const stats = getPlayerStats(players, matches, teams, results, rosters, goalEvents, linkedPlayer.id);
  const badges = getPlayerBadges(linkedPlayer.id, players, matches, teams, results, rosters, goalEvents, momVotes);
  const varianceBadges = getVarianceBadge(linkedPlayer.id, matches, rosters, goalEvents);
  const allBadges = [...badges, ...varianceBadges];
  const bestMatch = getPlayerBestAPMatch(matches, rosters, goalEvents, linkedPlayer.id);
  const bestMatchResult = bestMatch ? (() => {
    const mt = teams.filter(t => t.match_id === bestMatch.matchId);
    const ourTeam = mt.find(t => t.is_ours && t.name === "버니즈") || mt.find(t => t.is_ours);
    const r = ourTeam ? results.find(r => r.team_id === ourTeam.id && r.match_id === bestMatch.matchId) : null;
    return r;
  })() : null;

  return (
    <div className="pb-20">
      <PageHeader title="MY PAGE" subtitle={isEn ? `Welcome, ${displayName(linkedPlayer)}` : `${linkedPlayer.name}님, 환영합니다`} />

      <div className="px-4 space-y-4">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-pink">
              <User size={28} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{displayName(linkedPlayer)}</h2>
              <p className="text-xs text-muted-foreground">{L("가입일", "Joined")}: {linkedPlayer.join_date}</p>
              {linkedPlayer.is_active && (
                <span className="text-xs text-primary font-medium">ACTIVE</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: L("골", "Goals"), value: stats.goals, icon: Target, color: "text-primary" },
            { label: L("어시스트", "Assists"), value: stats.assists, icon: Zap, color: "text-accent" },
            { label: L("출전", "Appearances"), value: stats.appearances, icon: Trophy, color: "text-foreground" },
            { label: L("승률", "Win Rate"), value: `${stats.winRate}%`, icon: Trophy, color: "text-primary" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-border bg-card p-4 text-center"
            >
              <s.icon size={18} className={`mx-auto mb-1 ${s.color}`} />
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* W/D/L */}
        <div className="flex gap-3 text-center">
          <div className="flex-1 rounded-lg bg-card border border-border p-3">
            <div className="text-lg font-bold text-primary">{stats.wins}</div>
            <div className="text-xs text-muted-foreground">{L("승", "W")}</div>
          </div>
          <div className="flex-1 rounded-lg bg-card border border-border p-3">
            <div className="text-lg font-bold text-muted-foreground">{stats.draws}</div>
            <div className="text-xs text-muted-foreground">{L("무", "D")}</div>
          </div>
          <div className="flex-1 rounded-lg bg-card border border-border p-3">
            <div className="text-lg font-bold text-destructive">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">{L("패", "L")}</div>
          </div>
        </div>

        {/* Best Match */}
        {bestMatch && bestMatch.ap > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/match/${bestMatch.matchId}`)}
            className="rounded-xl border border-primary/30 bg-card p-4 cursor-pointer hover:border-primary transition-colors"
          >
            <p className="text-xs text-primary font-bold mb-2">🏆 BEST MATCH</p>
            <p className="text-sm text-foreground">{bestMatch.date} {bestMatchResult ? `(${isEn ? (bestMatchResult.result === "승" ? "W" : bestMatchResult.result === "패" ? "L" : bestMatchResult.result === "무" ? "D" : bestMatchResult.result) : bestMatchResult.result})` : ""}</p>
            <p className="text-lg font-bold text-primary">{isEn ? `${bestMatch.goals}G ${bestMatch.assists}A (${bestMatch.ap} AP)` : `${bestMatch.goals}골 ${bestMatch.assists}어시 (${bestMatch.ap} AP)`}</p>
          </motion.div>
        )}

        {/* Nickname & Title Editor */}
        <NicknameEditor
          currentNickname={profile?.nickname}
          currentTitle={profile?.equipped_title}
          badges={allBadges}
          onUpdate={() => {
            refreshProfile();
            queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
          }}
        />

        {/* View Full Profile */}
        <Button
          onClick={() => navigate(`/player/${linkedPlayer.id}`)}
          variant="outline"
          className="w-full border-primary/30 text-primary"
        >
          <LinkIcon size={16} /> {L("전체 프로필 보기", "View Full Profile")}
        </Button>

        {/* Sign Out */}
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          <LogOut size={16} /> {L("로그아웃", "Sign Out")}
        </Button>
      </div>
    </div>
  );
};

export default MyPage;
