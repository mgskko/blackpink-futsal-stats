import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, User, Link as LinkIcon, Trophy, Target, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAllFutsalData, getPlayerStats, getPlayerBestAPMatch, getPlayerName } from "@/hooks/useFutsalData";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import burneesLogo from "@/assets/burnees-logo.png";

const MyPage = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { players, matches, teams, results, rosters, goalEvents, isLoading } = useAllFutsalData();
  const navigate = useNavigate();
  const [linking, setLinking] = useState(false);

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
          alt="Burnees FC"
          className="h-28 w-28 rounded-full box-glow"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        />
        <div className="text-center">
          <h1 className="font-display text-3xl tracking-wider text-glow text-primary">BURNEES FC</h1>
          <p className="mt-2 text-sm text-muted-foreground">Google 계정으로 로그인하세요</p>
        </div>
        <Button
          onClick={async () => {
            await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
          }}
          className="w-full max-w-xs gradient-pink text-primary-foreground font-bold text-base py-6"
        >
          Google로 로그인
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
        <PageHeader title="선수 연동" subtitle="본인의 프로필을 선택해주세요" />
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">현재 활동 선수</p>
          {activePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => handleLink(p.id)}
              disabled={linking}
              className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary transition-colors"
            >
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="ml-2 text-xs text-primary">ACTIVE</span>
            </button>
          ))}
          <p className="text-xs text-muted-foreground mt-4 mb-3">비활동 선수</p>
          {inactivePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => handleLink(p.id)}
              disabled={linking}
              className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary transition-colors"
            >
              <span className="text-muted-foreground">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Dashboard
  const stats = getPlayerStats(players, matches, teams, results, rosters, goalEvents, linkedPlayer.id);
  const bestMatch = getPlayerBestAPMatch(matches, rosters, goalEvents, linkedPlayer.id);
  const bestMatchResult = bestMatch ? (() => {
    const mt = teams.filter(t => t.match_id === bestMatch.matchId);
    const ourTeam = mt.find(t => t.is_ours && t.name === "버니즈") || mt.find(t => t.is_ours);
    const r = ourTeam ? results.find(r => r.team_id === ourTeam.id && r.match_id === bestMatch.matchId) : null;
    return r;
  })() : null;

  return (
    <div className="pb-20">
      <PageHeader title="MY PAGE" subtitle={`${linkedPlayer.name}님, 환영합니다`} />

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
              <h2 className="text-xl font-bold text-foreground">{linkedPlayer.name}</h2>
              <p className="text-xs text-muted-foreground">가입일: {linkedPlayer.join_date}</p>
              {linkedPlayer.is_active && (
                <span className="text-xs text-primary font-medium">ACTIVE</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "골", value: stats.goals, icon: Target, color: "text-primary" },
            { label: "어시스트", value: stats.assists, icon: Zap, color: "text-accent" },
            { label: "출전", value: stats.appearances, icon: Trophy, color: "text-foreground" },
            { label: "승률", value: `${stats.winRate}%`, icon: Trophy, color: "text-primary" },
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
            <div className="text-xs text-muted-foreground">승</div>
          </div>
          <div className="flex-1 rounded-lg bg-card border border-border p-3">
            <div className="text-lg font-bold text-muted-foreground">{stats.draws}</div>
            <div className="text-xs text-muted-foreground">무</div>
          </div>
          <div className="flex-1 rounded-lg bg-card border border-border p-3">
            <div className="text-lg font-bold text-destructive">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">패</div>
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
            <p className="text-sm text-foreground">{bestMatch.date} {bestMatchResult ? `(${bestMatchResult.result})` : ""}</p>
            <p className="text-lg font-bold text-primary">{bestMatch.goals}골 {bestMatch.assists}어시 ({bestMatch.ap} AP)</p>
          </motion.div>
        )}

        {/* View Full Profile */}
        <Button
          onClick={() => navigate(`/player/${linkedPlayer.id}`)}
          variant="outline"
          className="w-full border-primary/30 text-primary"
        >
          <LinkIcon size={16} /> 전체 프로필 보기
        </Button>

        {/* Sign Out */}
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          <LogOut size={16} /> 로그아웃
        </Button>
      </div>
    </div>
  );
};

export default MyPage;
