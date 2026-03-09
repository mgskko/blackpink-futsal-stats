import { useState } from "react";
import { motion } from "framer-motion";
import { Book, Trophy, Shirt, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Import the guide data
const GUIDE_SECTIONS = [
  {
    title: "📊 기본 스탯 용어",
    items: [
      { term: "공격포인트 (AP)", desc: "골 + 어시스트 합산 수치입니다. 공격 기여도를 한눈에 보여주는 핵심 지표입니다." },
      { term: "PPQ (Points Per Quarter)", desc: "출전 쿼터 수 대비 공격포인트 비율입니다. 쿼터당 평균 몇 개의 공격포인트를 기록하는지 보여줍니다." },
      { term: "득점 마진 (코트 마진, +/-)", desc: "해당 선수가 필드에서 뛰는 동안 팀이 기록한 (총 득점 - 총 실점). 농구에서 차용된 지표로, 스탯에 나타나지 않는 팀 승리 기여도를 보여줍니다." },
      { term: "승리 요정 지수", desc: "해당 선수 출전 경기 승률 vs 결장 경기 승률 차이. 양수면 팀에 긍정적 영향." },
    ],
  },
  {
    title: "⚽ 득점 루트 용어 사전",
    items: [
      { term: "킬패스", desc: "수비 라인 사이를 관통하여 골 기회를 만드는 결정적 패스." },
      { term: "컷백패스", desc: "사이드에서 골문 앞으로 깔아주는 패스. 과르디올라의 맨시티가 가장 사랑하는 공격 패턴입니다." },
      { term: "골문 앞 혼전골", desc: "골문 앞 밀집 상황에서 혼전 중 발생하는 득점." },
      { term: "주워먹기", desc: "수비수나 골키퍼의 실수, 또는 포스트에 맞고 나온 공을 골문 앞에서 마무리한 득점." },
      { term: "중거리골", desc: "페널티 박스 밖에서 강력한 슈팅으로 넣은 골." },
      { term: "침투골", desc: "수비 라인 뒤 공간을 파고들어 오프사이드 트랩을 무력화하며 넣은 득점." },
    ],
  },
  {
    title: "🔥 선수 고유 특성 (Traits)",
    items: [
      { term: "⚽ 인자기의 환생", desc: "AC 밀란의 전설 필리포 인자기. 주워먹기/혼전골/인자기골 비율이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "⚽ 제라드의 강림", desc: "리버풀의 심장 스티븐 제라드. 시원한 중거리포를 가장 많이 꽂아 넣은 팀 내 1~2위에게 부여됩니다." },
      { term: "⚽ 즐라탄 빙의", desc: "발리골/터닝골/칩슛/헤딩골 등 고난도 골이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🎯 덕배의 택배기사", desc: "킬패스 어시스트가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🎯 마에스트로 외질", desc: "AP 중 어시스트 비율이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🤡 패스 버튼 고장난 로벤", desc: "AP 중 어시스트 비율이 팀 내 최하위 1~2명에게 부여됩니다." },
      { term: "🛡️ 비디치의 통곡의 벽", desc: "DF 출전 시 최소 실점 팀 내 1~2위에게 부여됩니다." },
      { term: "🛡️ 로드리의 무패 부적", desc: "코트 마진 팀 내 1~2위에게 부여됩니다." },
      { term: "🛡️ 가투소의 미친개", desc: "압박/패스차단 기반 득점+어시가 팀 내 1~2위인 선수에게 부여됩니다." },
    ],
  },
  {
    title: "👑 Data MOM 및 랭크 시스템",
    items: [
      { term: "Data MOM이란?", desc: "골(3점), 어시스트(2.5점), 수비 출전 마진(+1당 2점), 무실점(1점), 출전(0.5점), 클러치(+2점), 자책골(-2점)을 종합하여 객관적으로 산정한 그날의 MVP입니다." },
      { term: "8단계 티어 시스템", desc: "출전(+1pt), FW AP(+3pt), DF/GK 클린시트(+3pt), MOM 선정(+5pt), 워스트 투표(-3pt)를 종합하여 동네축구 → 조기축구 → 아마추어3부 → 아마추어1부 → K5 리거 → 세미프로 → 국대급 에이스 → 월드클래스까지 8단계로 승급합니다." },
    ],
  },
  {
    title: "🤝 케미스트리(조합) 지표 설명",
    items: [
      { term: "💀 THE DEATH LINEUP", desc: "같은 쿼터에 필드에 선 최강의 5인 조합. 최소 5쿼터 함께 출전 기준." },
      { term: "⚔️ BEST FW DUO", desc: "동시에 FW로 뛰었을 때 승률 기준 최강 투톱. '⚽ 합작 골' 수치를 함께 표시합니다." },
      { term: "🛡️ BEST DF DUO", desc: "동시에 DF로 뛰었을 때 승률 기준 최강 센터백 듀오. '🛡️ 합작 무실점 쿼터 수'를 함께 표시합니다." },
      { term: "☠️ 버뮤다 삼각지대", desc: "3명 동시 출전 시 승률 최하위 조합. 쿼터당 실점률, 득점률, 합산 마진을 표시합니다." },
    ],
  },
  {
    title: "📋 포메이션별 통계 가이드",
    items: [
      { term: "⛺ 전방 캠핑족", desc: "FW 출전 시 공격포인트는 높지만 해당 쿼터 팀 실점률이 1위인 이기적 공격수." },
      { term: "🛡️ 수비형 공격수", desc: "FW 출전 시 AP는 0에 수렴하나 팀 실점률이 최저인 전방 압박형 공격수." },
      { term: "⚔️ 수트라이커", desc: "DF 출전 시 직접 넣은 골이 가장 많은 공격적 수비수." },
      { term: "🚌 무임승차 VIP", desc: "FW 출전 시 AP 0인데 쿼터 승률이 80% 이상인 승리 토템." },
      { term: "🧤 소년가장 키퍼", desc: "GK 출전 시 빈공 상황(팀 0~1득점)에서도 클린시트로 팀을 지켜낸 횟수 1위." },
      { term: "🧊 빙하기 메이커", desc: "필드 출전 시 양팀 합산 스코어가 가장 낮은 수면제 축구의 창시자." },
    ],
  },
  {
    title: "🚨 폼 저하 / 방출 위기",
    items: [
      { term: "FW 방출 위기", desc: "최근 5경기 출전 쿼터 기준, FW에서 AP 0~1개에 수렴하면서 코트 마진이 마이너스인 선수." },
      { term: "DF/GK 방출 위기", desc: "최근 5경기 출전 쿼터 기준, DF/GK 포지션 출전 시 쿼터당 평균 실점이 2.0 이상인 선수." },
    ],
  },
  {
    title: "💸 민생지원금 수령자",
    items: [
      { term: "산정 기준", desc: "최소 10경기 출전 & 10AP 이상인 선수 중, ①전체 AP 대비 2점 차 이상 대승 경기에서 올린 AP 비율(%), ②이미 +2 이상 리드한 가비지 타임 쿼터에서 기록한 AP 개수를 합산하여 순위를 매깁니다." },
      { term: "가비지 타임이란?", desc: "직전 쿼터까지의 누적 마진이 +2 이상인 상태에서 시작하는 쿼터. 이미 이기고 있는 여유 상황." },
    ],
  },
  {
    title: "🏆 북중미모드 — 국대급 진심 모드",
    items: [
      { term: "🏆 북중미모드란?", desc: "극악의 조건을 달성한 극소수 선수에게만 부여되는 특별 뱃지입니다." },
      { term: "🇧🇷 브라질", desc: "최근 10경기에서 공격포인트 합산 30개 이상. 브라질 삼바 축구급 에이스를 증명해야 합니다." },
      { term: "🇫🇷 프랑스", desc: "최근 5경기에서 어시스트 10개 이상." },
      { term: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 잉글랜드", desc: "최근 5경기 출전 쿼터의 합산 득실 마진 +10 이상." },
      { term: "🇰🇷 한국", desc: "최근 5경기에서 '압박'/'패스 차단' 기반 AP 5개 이상." },
      { term: "🇪🇸 스페인", desc: "최근 5경기에서 '킬패스'/'패스 플레이' 어시스트 5개 이상." },
      { term: "🇩🇪 독일", desc: "최근 5경기 15쿼터 이상 출전 & 승률 50% 이상." },
      { term: "🇮🇹 이탈리아", desc: "최근 5경기 DF/GK 무실점 8쿼터 이상." },
      { term: "🇦🇷 아르헨티나", desc: "최근 5경기 MOM 2회 이상." },
      { term: "🇳🇱 네덜란드", desc: "최근 5경기 FW 8Q+ & DF 8Q+, 두 포지션 마진 모두 +3 이상." },
    ],
  },
];

interface HistoryItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  year: number | null;
  image_url: string | null;
  sort_order: number | null;
}

const ClubhousePage = () => {
  const [activeSection, setActiveSection] = useState<"guide" | "history">("guide");

  const { data: historyItems = [] } = useQuery({
    queryKey: ["team_history"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_history").select("*").order("sort_order", { ascending: true });
      return (data ?? []) as HistoryItem[];
    },
  });

  const logos = historyItems.filter(i => i.category === "logo");
  const uniforms = historyItems.filter(i => i.category === "uniform");
  const milestones = historyItems.filter(i => i.category === "milestone");

  return (
    <div className="pb-20">
      <PageHeader title="CLUBHOUSE" subtitle="버니즈 클럽하우스" />
      <div className="px-4">
        {/* Section switcher */}
        <div className="flex rounded-lg border border-border bg-card overflow-hidden mb-6">
          <button onClick={() => setActiveSection("guide")}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeSection === "guide" ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            📖 가이드
          </button>
          <button onClick={() => setActiveSection("history")}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeSection === "history" ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            🏛️ 구단 역사
          </button>
        </div>

        {activeSection === "guide" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                <Book size={16} /> 앱에서 사용되는 모든 용어와 기준을 설명합니다
              </div>
              <p className="text-xs text-muted-foreground">각 항목을 탭하면 상세 설명을 확인할 수 있습니다.</p>
            </div>

            {GUIDE_SECTIONS.map((section, si) => (
              <motion.div key={si} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.03 }} className="mb-4">
                <h2 className="font-display text-lg tracking-wider text-primary mb-2">{section.title}</h2>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Accordion type="multiple">
                    {section.items.map((item, ii) => (
                      <AccordionItem key={ii} value={`${si}-${ii}`} className="border-b border-border last:border-b-0">
                        <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline">{item.term}</AccordionTrigger>
                        <AccordionContent className="px-4 text-xs text-muted-foreground leading-relaxed">{item.desc}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeSection === "history" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {historyItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Shield size={48} className="mb-3 opacity-30" />
                <p className="text-sm">아직 등록된 구단 역사가 없습니다</p>
                <p className="text-xs mt-1">관리자가 클럽하우스 컨텐츠를 추가할 수 있습니다</p>
              </div>
            )}

            {/* Emblems */}
            {logos.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Shield size={18} /> 엠블럼 변천사
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {logos.map(item => (
                    <motion.div key={item.id} whileHover={{ scale: 1.02 }}
                      className="rounded-xl border border-border bg-card overflow-hidden">
                      {item.image_url && (
                        <div className="aspect-square bg-secondary/30 flex items-center justify-center p-4">
                          <img src={item.image_url} alt={item.title} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="text-sm font-bold text-foreground">{item.title}</div>
                        {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                        {item.description && <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Uniforms */}
            {uniforms.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Shirt size={18} /> 유니폼 컬렉션
                </h3>
                <div className="space-y-3">
                  {uniforms.map(item => (
                    <motion.div key={item.id} whileHover={{ scale: 1.01 }}
                      className="flex rounded-xl border border-border bg-card overflow-hidden">
                      {item.image_url && (
                        <div className="w-28 h-28 flex-shrink-0 bg-secondary/30 flex items-center justify-center p-2">
                          <img src={item.image_url} alt={item.title} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="p-3 flex-1">
                        <div className="text-sm font-bold text-foreground">{item.title}</div>
                        {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                        {item.description && <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Trophy size={18} /> 구단 마일스톤 & 트로피
                </h3>
                <div className="space-y-3">
                  {milestones.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-4">
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Trophy size={20} className="text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-foreground">{item.title}</div>
                          {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ClubhousePage;
