import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAllFutsalData, getPlayerName, getMatchGoalEvents, getMatchRoster } from "@/hooks/useFutsalData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const REACTION_EMOJIS = ["👍", "🔥", "😭", "😂", "💪"];

interface MatchCommentsProps {
  matchId: number;
}

const MatchComments = ({ matchId }: MatchCommentsProps) => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { players, rosters, goalEvents } = useAllFutsalData();
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["match_comments", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_comments")
        .select("*")
        .eq("match_id", matchId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["comment_reactions", matchId],
    queryFn: async () => {
      const commentIds = comments.map((c: any) => c.id);
      if (commentIds.length === 0) return [];
      const { data } = await supabase
        .from("comment_reactions")
        .select("*")
        .in("comment_id", commentIds);
      return data ?? [];
    },
    enabled: comments.length > 0,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, nickname, equipped_title, player_id");
      return data ?? [];
    },
  });

  // System auto-comments based on match data
  const systemHighlights = useMemo(() => {
    const highlights: string[] = [];
    const matchGoals = getMatchGoalEvents(goalEvents, matchId);
    const matchRoster = getMatchRoster(rosters, matchId);

    // Hat-trick detection
    const goalCounts = new Map<number, number>();
    matchGoals.forEach(g => {
      if (g.goal_player_id && !g.is_own_goal) {
        goalCounts.set(g.goal_player_id, (goalCounts.get(g.goal_player_id) || 0) + 1);
      }
    });
    goalCounts.forEach((count, pid) => {
      if (count >= 3) highlights.push(`🚨 ${getPlayerName(players, pid)} 선수가 해트트릭(${count}골)을 달성했습니다!`);
    });

    return highlights;
  }, [goalEvents, rosters, players, matchId]);

  const getDisplayName = (userId: string) => {
    const p = allProfiles.find((pr: any) => pr.id === userId);
    if (!p) return "익명";
    const title = p.equipped_title ? `[${p.equipped_title}] ` : "";
    const name = p.nickname || p.display_name || "익명";
    return `${title}${name}`;
  };

  const handlePost = async () => {
    if (!user || !newComment.trim()) return;
    setPosting(true);
    await supabase.from("match_comments").insert({
      match_id: matchId,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    queryClient.invalidateQueries({ queryKey: ["match_comments", matchId] });
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("match_comments").delete().eq("id", commentId);
    queryClient.invalidateQueries({ queryKey: ["match_comments", matchId] });
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r: any) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("comment_reactions").delete().eq("id", (existing as any).id);
    } else {
      await supabase.from("comment_reactions").insert({ comment_id: commentId, user_id: user.id, emoji });
    }
    queryClient.invalidateQueries({ queryKey: ["comment_reactions", matchId] });
  };

  const getReactionCounts = (commentId: string) => {
    const counts = new Map<string, { count: number; myReaction: boolean }>();
    reactions.forEach((r: any) => {
      if (r.comment_id === commentId) {
        const existing = counts.get(r.emoji) || { count: 0, myReaction: false };
        existing.count++;
        if (user && r.user_id === user.id) existing.myReaction = true;
        counts.set(r.emoji, existing);
      }
    });
    return counts;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider text-primary">
        <MessageCircle size={18} /> MATCH THREAD
      </h2>

      {/* System highlights */}
      {systemHighlights.map((h, i) => (
        <div key={`sys-${i}`} className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary">
          {h}
        </div>
      ))}

      {/* Comments */}
      <div className="space-y-2">
        {comments.map((c: any) => {
          const reactionCounts = getReactionCounts(c.id);
          return (
            <div key={c.id} className={`rounded-lg border p-3 ${c.is_pinned ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">{c.is_system ? "🤖 SYSTEM" : getDisplayName(c.user_id)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{c.content}</p>
                </div>
                {(user?.id === c.user_id || isAdmin) && !c.is_system && (
                  <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {/* Reactions */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {REACTION_EMOJIS.map(emoji => {
                  const info = reactionCounts.get(emoji);
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(c.id, emoji)}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-all ${
                        info?.myReaction
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {emoji} {info?.count || ""}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* New comment */}
      {user ? (
        <div className="mt-3 flex gap-2">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="경기에 대해 한마디..."
            className="min-h-[40px] resize-none text-sm"
            rows={1}
          />
          <Button onClick={handlePost} disabled={posting || !newComment.trim()} size="icon" className="shrink-0">
            <Send size={16} />
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">댓글을 작성하려면 로그인하세요</p>
      )}
    </motion.div>
  );
};

export default MatchComments;
