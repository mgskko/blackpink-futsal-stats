import { useState } from "react";
import { motion } from "framer-motion";
import { Dice5, Save, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const ADJECTIVES = [
  "탐욕스러운", "수비 안 하는", "패스만 하는", "슈팅 머신", "독보적인",
  "예측불가", "철벽의", "미친듯이 뛰는", "눈치 빠른", "전설의",
  "졸린", "배고픈", "화난", "달리는", "날아다니는",
  "느긋한", "집중하는", "무모한", "조용한", "흥분한",
];

const NOUNS = [
  "홀란드", "풀백", "스트라이커", "골키퍼", "미드필더",
  "감독님", "용병", "에이스", "캡틴", "메시",
  "호날두", "음바페", "네이마르", "벤제마", "살라",
  "손흥민", "박지성", "차범근", "이강인", "김민재",
];

function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

interface NicknameEditorProps {
  currentNickname?: string | null;
  currentTitle?: string | null;
  badges: { emoji: string; label: string }[];
  onUpdate: () => void;
}

const NicknameEditor = ({ currentNickname, currentTitle, badges, onUpdate }: NicknameEditorProps) => {
  const { user } = useAuth();
  const [nickname, setNickname] = useState(currentNickname || "");
  const [saving, setSaving] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(currentTitle || "");

  const handleRandomize = () => {
    setNickname(generateRandomNickname());
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: nickname.trim() || null,
        equipped_title: selectedTitle || null,
      })
      .eq("id", user.id);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "저장 완료!", description: "닉네임과 칭호가 업데이트되었습니다." });
      onUpdate();
    }
    setSaving(false);
  };

  const titleOptions = badges.map(b => `${b.emoji} ${b.label}`);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <h3 className="font-display text-lg text-primary flex items-center gap-2">
        <Sparkles size={18} /> 닉네임 & 칭호
      </h3>

      {/* Nickname */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">닉네임</label>
        <div className="flex gap-2">
          <Input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="닉네임을 입력하세요"
            maxLength={20}
            className="flex-1"
          />
          <Button onClick={handleRandomize} variant="outline" size="icon" title="랜덤 생성">
            <Dice5 size={16} />
          </Button>
        </div>
      </div>

      {/* Title equip */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">대표 칭호</label>
        {titleOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTitle("")}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                !selectedTitle ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              없음
            </button>
            {titleOptions.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTitle(t)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                  selectedTitle === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">획득한 뱃지가 없습니다. 경기에 참여하여 칭호를 획득하세요!</p>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full gradient-pink text-primary-foreground font-bold">
        <Save size={16} /> 저장
      </Button>
    </motion.div>
  );
};

export default NicknameEditor;
