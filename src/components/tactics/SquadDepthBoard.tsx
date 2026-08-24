import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

export const DEPTH_POSITIONS = [
  { code: "ST", ko: "스트라이커", en: "Striker", x: 50, y: 9 },
  { code: "LW", ko: "왼쪽 윙어", en: "Left Wing", x: 18, y: 27 },
  { code: "RW", ko: "오른쪽 윙어", en: "Right Wing", x: 82, y: 27 },
  { code: "LCM", ko: "좌측 중앙 미드필더", en: "Left Central Mid", x: 30, y: 45 },
  { code: "RCM", ko: "우측 중앙 미드필더", en: "Right Central Mid", x: 70, y: 45 },
  { code: "DM", ko: "수비형 미드필더", en: "Defensive Mid", x: 50, y: 64 },
  { code: "LB", ko: "왼쪽 풀백", en: "Left Back", x: 18, y: 77 },
  { code: "LCB", ko: "좌측 센터백", en: "Left Centre Back", x: 36, y: 85 },
  { code: "RCB", ko: "우측 센터백", en: "Right Centre Back", x: 64, y: 85 },
  { code: "RB", ko: "오른쪽 풀백", en: "Right Back", x: 82, y: 77 },
  { code: "GK", ko: "골키퍼", en: "Goalkeeper", x: 50, y: 95 },
] as const;

export type DepthRow = { id: string; position_code: string; player_id: number | null; sort_order: number };

export const useSquadDepth = () =>
  useQuery({
    queryKey: ["squad_depth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squad_depth")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DepthRow[];
    },
  });

interface Props {
  playerNames: Map<number, string>;
  onPlayerClick?: (playerId: number) => void;
}

const SquadDepthBoard = ({ playerNames, onPlayerClick }: Props) => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.language ?? "ko").startsWith("en");
  const { data: rows = [], isLoading } = useSquadDepth();

  const byPos = new Map<string, DepthRow[]>();
  rows.forEach((r) => byPos.set(r.position_code, [...(byPos.get(r.position_code) ?? []), r]));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg tracking-wider text-primary">
          {isEnglish ? "SQUAD DEPTH" : "스쿼드 뎁스"}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {isEnglish ? "11-a-side football" : "11인제 축구"}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/10"
        style={{
          aspectRatio: "3 / 4.6",
          background:
            "linear-gradient(180deg, hsl(160 40% 12%) 0%, hsl(160 45% 9%) 50%, hsl(160 40% 12%) 100%)",
        }}
      >
        {/* pitch markings */}
        <div className="pointer-events-none absolute inset-3 rounded-md border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[16%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 border-t border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-[13%] w-[46%] -translate-x-1/2 border border-white/15" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[13%] w-[46%] -translate-x-1/2 border border-white/15" />

        {isLoading && (
          <div className="absolute inset-0 grid place-items-center text-xs text-white/60">
            {isEnglish ? "Loading..." : "불러오는 중..."}
          </div>
        )}

        {DEPTH_POSITIONS.map((pos) => {
          const list = (byPos.get(pos.code) ?? []).filter((r) => r.player_id != null);
          return (
            <div
              key={pos.code}
              className="absolute flex w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <span className="rounded-full bg-black/45 px-1.5 py-px text-[8px] font-bold tracking-wider text-white/70">
                {pos.code}
              </span>
              {list.length === 0 ? (
                <span className="w-full rounded-full border border-dashed border-white/25 bg-white/5 px-2 py-1 text-center text-[10px] text-white/50">
                  {isEnglish ? "TBD" : "미정"}
                </span>
              ) : (
                list.map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => r.player_id && onPlayerClick?.(r.player_id)}
                    className="w-full truncate rounded-full bg-sky-400/75 px-2 py-1 text-center text-[11px] font-bold text-slate-900 shadow-sm backdrop-blur-sm"
                  >
                    {playerNames.get(r.player_id!) ?? `#${r.player_id}`}
                  </motion.button>
                ))
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {isEnglish
          ? "Top capsule = first choice. Tap a name to open the player profile."
          : "맨 위 캡슐이 주전 옵션입니다. 이름을 탭하면 선수 프로필로 이동합니다."}
      </p>
    </div>
  );
};

export default SquadDepthBoard;
