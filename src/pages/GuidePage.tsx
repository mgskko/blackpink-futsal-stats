import { motion } from "framer-motion";
import { Book } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const GUIDE_SECTIONS = [
  {
    title: "📊 기본 스탯 용어",
    items: [
      { term: "공격포인트 (AP)", desc: "골 + 어시스트 합산 수치입니다. 공격 기여도를 한눈에 보여주는 핵심 지표입니다." },
      { term: "PPQ (Points Per Quarter)", desc: "출전 쿼터 수 대비 공격포인트 비율입니다. 즉, 쿼터 하나를 뛸 때마다 평균적으로 몇 개의 공격포인트를 기록하는지 보여줍니다." },
      { term: "득점 마진 (코트 마진, +/-)", desc: "해당 선수가 필드에서 뛰고 있던 쿼터 동안 팀이 기록한 (총 득점 - 총 실점) 수치입니다. 농구 통계에서 차용한 것으로, 스탯지에 나타나지 않는 선수의 팀 승리 기여도를 보여줍니다." },
      { term: "승리 요정 지수", desc: "해당 선수가 출전한 경기의 팀 승률과 결장한 경기의 팀 승률 차이입니다. 양수면 팀에 긍정적 영향, 음수면 부정적 영향을 미치는 것으로 해석합니다." },
    ],
  },
  {
    title: "🎮 선수 고유 특성 (Traits)",
    items: [
      { term: "⚽ 위치 선정의 달인 (Poacher)", desc: "전체 골 중 '주워먹기' + '골문 앞 혼전골' + '인자기골' 합산 비율이 10% 이상일 때 부여됩니다." },
      { term: "⚽ 중거리 난사 (Long Shot Taker)", desc: "전체 골 중 '중거리골' 비율이 5% 이상일 때 부여됩니다." },
      { term: "⚽ 아크로바틱 (Acrobatic)", desc: "'발리골', '터닝골', '칩슛', '헤딩골', '파포스트골' 등 고난도 골을 1개 이상 보유 시 부여됩니다." },
      { term: "⚽ 치달 장인 (Speed Dribbler)", desc: "'역습' + '솔로 치달골' + '드리블골' 유형 조합 득점이 2개 이상일 때 부여됩니다." },
      { term: "⚽ 침투의 귀재 (Infiltrator)", desc: "'침투골'을 1개 이상 기록 시 부여됩니다." },
      { term: "⚽ 원샷 원킬 (Clinical Finisher)", desc: "PPQ(쿼터당 공격포인트) 기준 팀 내 1위 (최소 5쿼터 출전)일 때 부여됩니다." },
      { term: "🎯 대지를 가르는 패스 (Playmaker)", desc: "전체 어시스트 중 '킬패스' 비율이 20% 이상이고 어시스트가 3개 이상일 때 부여됩니다." },
      { term: "🎯 컷백 마스터 (Cut-back Specialist)", desc: "전체 어시스트 중 '컷백' 비율이 20% 이상일 때 부여됩니다." },
      { term: "🎯 어시스트 머신 (Assist King)", desc: "공격포인트 중 어시스트 비율이 30% 이상이고 어시스트가 5개 이상일 때 부여됩니다." },
      { term: "🎯 탐욕왕 (Selfish)", desc: "공격포인트 중 어시스트 비율이 20% 미만 (최소 공격포인트 5개 이상)일 때 부여됩니다." },
      { term: "💪 강철 체력 (Iron Lungs)", desc: "1~2쿼터와 7~8쿼터 공격포인트 차이가 20% 이내 (최소 10쿼터 출전)일 때 부여됩니다." },
      { term: "💪 조루 체력 (Early Fader)", desc: "후반 쿼터(5~8) 공격포인트가 전반(1~4) 대비 50% 이하로 급감할 때 부여됩니다. 최소 10쿼터 출전." },
      { term: "🛡️ 통곡의 벽 (The Wall)", desc: "DF 포지션 출전 쿼터의 팀 실점 평균이 전체 평균보다 0.3골 이상 낮을 때 부여됩니다. 최소 3쿼터 DF 출전." },
      { term: "🛡️ 승리 부적 (Victory Totem)", desc: "코트 마진(+/-) 팀 내 1위 (최소 8쿼터 출전)일 때 부여됩니다." },
      { term: "🛡️ 미친 개 (High Motor)", desc: "득점 과정 중 '압박' 비율이 팀 내 가장 높은 선수에게 부여됩니다. 최소 2골." },
      { term: "🛡️ 클린시트 수호자 (GK Master)", desc: "GK 출전 쿼터 무실점 비율 40% 이상 (최소 3쿼터 GK 출전)일 때 부여됩니다." },
      { term: "👑 퍼스트 블러드 (First Blood)", desc: "경기일 기준 팀의 첫 번째 골을 기록한 횟수가 팀 내 1위일 때 부여됩니다." },
      { term: "👑 버저비터 (Buzzer Beater)", desc: "7~8쿼터에 기록한 골 비율이 전체 골의 25% 이상일 때 부여됩니다." },
      { term: "👑 스탯 세탁기 (Stat Padder)", desc: "본인이 기록한 공격포인트 중, 팀이 이미 3점 차 이상으로 이기고 있는 여유로운 상황에서 기록한 스탯의 비율이 55% 이상일 때 부여됩니다." },
    ],
  },
  {
    title: "👑 Data MOM 산정 방식",
    items: [
      { term: "Data MOM이란?", desc: "득점(3점), 어시스트(2.5점), 수비수 출전 시 득실마진(+1당 2점), 무실점 쿼터(1점), 출전 쿼터(0.5점), 클러치 상황(+2점), 자책골(-2점)을 종합하여 객관적으로 산정한 그날의 MVP입니다." },
      { term: "공격/이타성 점수", desc: "골 × 3점 + 어시스트 × 2.5점. 패스 플레이를 장려하기 위해 어시스트 가중치를 높게 설정했습니다." },
      { term: "수비/헌신 점수", desc: "(수비수(DF/GK) 출전 쿼터의 코트 마진 1점당 × 2점) + (출전 쿼터 × 0.5점) + (수비/GK 무실점 쿼터당 × 1점)" },
      { term: "클러치 점수", desc: "결승골/동점골(1점차 이내) 또는 해당 골의 어시스트를 기록하면 +2점이 추가됩니다." },
      { term: "감점 요소", desc: "자책골 기록 시 -2점이 감점됩니다." },
    ],
  },
  {
    title: "🏆 명예의 전당",
    items: [
      { term: "등재 기준", desc: "한 경기에 공격포인트(골+어시스트)를 합산하여 7개 이상 기록한 경우 명예의 전당에 박제됩니다." },
    ],
  },
  {
    title: "📈 기타 통계 용어",
    items: [
      { term: "수비 기여도", desc: "해당 선수가 투입된 쿼터 vs 미투입 쿼터의 팀 실점 평균을 비교합니다. 마이너스(-)면 해당 선수가 있을 때 실점이 줄어든다는 의미입니다." },
      { term: "공격 기여도 - 팀 득점 관여율", desc: "본인이 출전한 쿼터에서 팀 전체 골 중 본인의 공격포인트가 차지하는 비율입니다." },
      { term: "공격 기여도 - FW 출전 시 마진", desc: "공격수(FW)로 출전한 쿼터의 득점 마진 평균입니다." },
      { term: "킬러 쿼터", desc: "해당 선수가 가장 많은 공격포인트를 기록한 쿼터 번호입니다." },
      { term: "슈퍼 서브 🔥", desc: "직전 쿼터에 벤치에 있다가 필드에 투입된 후 바로 그 쿼터에서 공격포인트를 기록한 선수에게 부여됩니다." },
    ],
  },
];

const GuidePage = () => (
  <div className="pb-20">
    <PageHeader title="GUIDE" subtitle="스탯 백과사전" />
    <div className="px-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
          <Book size={16} /> 앱에서 사용되는 모든 용어와 기준을 설명합니다
        </div>
        <p className="text-xs text-muted-foreground">각 항목을 탭하면 상세 설명을 확인할 수 있습니다.</p>
      </motion.div>

      {GUIDE_SECTIONS.map((section, si) => (
        <motion.div key={si} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.05 }}
          className="mb-4">
          <h2 className="font-display text-lg tracking-wider text-primary mb-2">{section.title}</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Accordion type="multiple">
              {section.items.map((item, ii) => (
                <AccordionItem key={ii} value={`${si}-${ii}`} className="border-b border-border last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline">
                    {item.term}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default GuidePage;
