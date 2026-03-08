import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllFutsalData, getPlayerName } from "@/hooks/useFutsalData";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ThumbsDown, Skull } from "lucide-react";
import { motion } from "framer-motion";

interface WorstVotingProps {
  matchId: number;
}

const WorstVoting = ({ matchId }: WorstVotingProps) => {
  const { user } = useAuth();
  const { players, rosters } = useAllFutsalData();
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const rosterPlayerIds = [...new Set(rosters.filter(r => r.match_id === matchId).map(r => r.player_id))];
  const rosterPlayers = players.filter(p => rosterPlayerIds.includes(p.id));

  const { data: votes } = useQuery({
    queryKey: ["worst_votes", matchId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("worst_votes").select("*").eq("match_id", matchId);
      return (data ?? []) as { id: string; match_id: number; voted_player_id: number; voter_id: string }[];
    },
  });

  const myVote = votes?.find(v => v.voter_id === user?.id);
  const voteCounts = new Map<number, number>();
  votes?.forEach(v => voteCounts.set(v.voted_player_id, (voteCounts.get(v.voted_player_id) || 0) + 1));
  const topVoted = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalVotes = votes?.length || 0;

  useEffect(() => {
    if (myVote) setSelectedPlayer(myVote.voted_player_id);
  }, [myVote]);

  const handleVote = async () => {
    if (!selectedPlayer || !user) return;
    setSaving(true);
    try {
      if (myVote) {
        await (supabase as any).from("worst_votes").update({ voted_player_id: selectedPlayer }).eq("id", myVote.id);
      } else {
        await (supabase as any).from("worst_votes").insert({ match_id: matchId, voted_player_id: selectedPlayer, voter_id: user.id });
      }
      queryClient.invalidateQueries({ queryKey: ["worst_votes", matchId] });
      toast({ title: "워스트 투표 완료! 💀" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-destructive/30 bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg text-destructive">
        <Skull size={18} /> 오늘의 워스트 <span className="text-xs text-muted-foreground font-normal ml-auto">{totalVotes}표</span>
      </h3>

      {topVoted.length > 0 && (
        <div className="mb-3 space-y-1">
          {topVoted.slice(0, 3).map(([pid, count], i) => (
            <div key={pid} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${i === 0 ? "text-destructive" : "text-muted-foreground"}`}>{i === 0 ? "💀" : `${i + 1}`}</span>
                <span className="text-xs font-medium text-foreground">{getPlayerName(players, pid)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-destructive/60 rounded-full" style={{ width: `${totalVotes > 0 ? (count / totalVotes) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{count}표</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {rosterPlayers.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPlayer(p.id)}
            className={`rounded-md border p-2 text-xs font-medium transition-all ${
              selectedPlayer === p.id
                ? "border-destructive bg-destructive/20 text-destructive"
                : "border-border bg-secondary text-muted-foreground hover:border-destructive/40"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <Button
        onClick={handleVote}
        disabled={!selectedPlayer || saving}
        className="w-full bg-destructive/80 hover:bg-destructive text-destructive-foreground font-bold text-xs"
        size="sm"
      >
        <ThumbsDown size={14} /> {myVote ? "투표 변경" : "워스트 투표하기"}
      </Button>
    </motion.div>
  );
};

export default WorstVoting;
