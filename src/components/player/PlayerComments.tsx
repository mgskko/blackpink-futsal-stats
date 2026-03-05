import { useState, useEffect } from "react";
import { MessageCircle, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface PlayerCommentsProps {
  playerId: number;
}

const PlayerComments = ({ playerId }: PlayerCommentsProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["player_comments", playerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("player_comments")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, nickname, equipped_title");
      return data ?? [];
    },
  });

  const getDisplayName = (userId: string) => {
    const p = profiles.find((pr: any) => pr.id === userId);
    if (!p) return "익명";
    const title = p.equipped_title ? `[${p.equipped_title}] ` : "";
    return title + (p.nickname || p.display_name || "익명");
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    await (supabase as any).from("player_comments").insert({ player_id: playerId, user_id: user.id, content: content.trim() });
    setContent("");
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["player_comments", playerId] });
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("player_comments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["player_comments", playerId] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-lg text-primary flex items-center gap-2">
        <MessageCircle size={18} /> 방명록
      </h3>

      {user && (
        <div className="flex gap-2 mb-4">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="응원 메시지를 남겨보세요..."
            className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">아직 방명록이 비어있어요 ✍️</p>
        )}
        {comments.map((c: any) => (
          <div key={c.id} className="rounded-lg bg-secondary/30 border border-border/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-primary">{getDisplayName(c.user_id)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
                {user?.id === c.user_id && (
                  <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground">{c.content}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PlayerComments;
