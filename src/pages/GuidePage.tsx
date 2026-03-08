import { motion } from "framer-motion";
import { Book, Trophy, Zap, Shield, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    title: "🔥 선수 고유 특성 (Traits) — 축구 레전드 에디션",
    items: [
      { term: "⚽ 인자기의 환생 (Tap-in Master)", desc: "AC 밀란의 전설 필리포 인자기. 골문 앞에서 환상적인 위치 선정으로 '주워먹기'와 '혼전골'을 양산하던 역대 최고의 골잡이. 주워먹기/혼전골/인자기골 비율이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "⚽ 제라드의 강림 (Long Shot King)", desc: "리버풀의 심장 스티븐 제라드. 2005 챔피언스리그 결승에서의 중거리 폭격은 영원히 회자됩니다. 시원한 중거리포를 가장 많이 꽂아 넣은 팀 내 1~2위에게 부여됩니다." },
      { term: "⚽ 즐라탄 빙의 (Acrobatic God)", desc: "즐라탄 이브라히모비치. 바이시클킥, 발리, 스콜피온킥... 그가 골을 넣을 때마다 물리법칙이 의심됩니다. 발리골/터닝골/칩슛/헤딩골 등 고난도 골이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "⚽ 폭주기관차 베일 (Speed Racer)", desc: "가레스 베일. 시속 36km의 괴물 스피드로 수비수를 현관문처럼 열어젖힌 웨일스의 용. 역습/솔로 치달/드리블골 관련 득점+어시가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "⚽ 라인 브레이커 토레스 (Infiltrator)", desc: "페르난도 토레스. 오프사이드 트랩을 무력화시키는 침투 본능의 대명사. 침투골+킬패스 연계 득점이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "⚽ 괴물 득점 기계 홀란드 (Clinical Finisher)", desc: "엘링 홀란드. 맨시티 이적 첫 시즌 36골. 기회가 오면 반드시 넣는 냉혈한 효율의 화신. PPQ(쿼터당 공격포인트) 팀 내 1~2위에게 부여됩니다." },
      { term: "🎯 덕배의 택배기사 (Kill-Pass Master)", desc: "안정환의 별명 '덕배'와 그의 시그니처 킬패스. 수비 라인을 찢는 킬패스 어시스트가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🎯 펩이 사랑한 컷백 (Cut-back Specialist)", desc: "과르디올라의 맨시티가 가장 사랑하는 공격 패턴, 컷백. 사이드에서 골문 앞으로 깔아주는 컷백 어시스트가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🎯 마에스트로 외질 (Assist Machine)", desc: "메수트 외질. '눈이 달린 발'이라 불린 아스날의 마에스트로. AP 중 어시스트 비율이 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🤡 패스 버튼 고장난 로벤 (Greedy Boy)", desc: "아르옌 로벤. 왼발로 컷인해서 슈팅! 또 컷인해서 슈팅! 다들 알지만 못 막는 그 움직임. AP 중 어시스트 비율이 팀 내 최하위 1~2명에게 부여됩니다." },
      { term: "💪 세 개의 폐 박지성 (Iron Lungs)", desc: "박지성. 퍼거슨 감독이 '폐가 세 개'라 극찬한 90분 풀타임 체력 괴물. 전반~후반 AP 차이가 적어 체력이 고르게 유지되는 선수에게 부여됩니다." },
      { term: "💪 은돔벨레의 산책 (Early Fader)", desc: "탕기 은돔벨레. 전반 30분 만에 산책 모드에 돌입하는 전설적인 체력 관리(?)의 달인. 후반 AP가 전반 대비 급감하는 선수에게 부여됩니다." },
      { term: "🛡️ 비디치의 통곡의 벽 (The Wall)", desc: "네마냐 비디치. 맨유 수비의 철벽. 그 앞에선 공격수들이 통곡할 수밖에 없었습니다. DF 출전 시 최소 실점 팀 내 1~2위에게 부여됩니다." },
      { term: "🛡️ 로드리의 무패 부적 (Victory Totem)", desc: "로드리. 맨시티에서 74경기 연속 무패 기록. 그가 빠지면 팀이 흔들리는 궁극의 승리 부적. 코트 마진 팀 내 1~2위에게 부여됩니다." },
      { term: "🛡️ 가투소의 미친개 (Crazy Dog)", desc: "젠나로 가투소. 상대가 공을 잡는 순간 미사일처럼 돌진하는 미들필더. 압박/패스차단 기반 득점+어시가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "🧤 부폰의 거미손 (GK Wall)", desc: "잔루이지 부폰. 40년 넘게 골문을 지킨 역대 최고의 골키퍼. GK 무실점 쿼터 수가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "👑 빅게임 해결사 드록바 (First Blood)", desc: "디디에 드록바. FA컵만 4회 우승, 결승전의 사나이. 선제골 기록 횟수가 팀 내 1~2위인 선수에게 부여됩니다." },
      { term: "👑 라모스 극장골 (Buzzer Beater)", desc: "세르히오 라모스. 2014 챔피언스리그 결승 93분 동점 헤딩골. 후반 7~8쿼터 득점 비율이 높은 선수에게 부여됩니다." },
      { term: "🤡 루카쿠의 양민학살 (Stat Padder)", desc: "로멜루 루카쿠. 빅매치에서는 사라지고, 약팀 상대로 해트트릭을 쏟아내는 양민학살의 아이콘. 3점차+ 리드 상황에서의 스탯 비율이 높은 선수에게 부여됩니다." },
      { term: "⚽ 세트피스 장인 (Dead-ball Specialist)", desc: "코너킥, 프리킥 등 세트피스 상황에서 골이나 어시스트를 만들어낸 합산 개수가 팀 내 1~2위인 선수에게 부여됩니다." },
    ],
  },
  {
    title: "👑 Data MOM 산정 방식",
    items: [
      { term: "Data MOM이란?", desc: "골(3점), 어시스트(2.5점), 수비 출전 마진(+1당 2점), 무실점(1점), 출전(0.5점), 클러치(+2점), 자책골(-2점)을 종합하여 객관적으로 산정한 그날의 MVP입니다." },
      { term: "공격/이타성 점수", desc: "골 × 3점 + 어시스트 × 2.5점. 패스 플레이를 장려하기 위해 어시스트 가중치를 높게 설정했습니다." },
      { term: "수비/헌신 점수", desc: "수비수(DF/GK) 출전 쿼터의 코트 마진 × 2점 + 출전 쿼터 × 0.5점 + 무실점 쿼터 × 1점" },
      { term: "클러치 점수", desc: "결승골/동점골(1점차 이내) 또는 해당 골의 어시스트 기록 시 +2점." },
      { term: "감점 요소", desc: "자책골 기록 시 -2점." },
    ],
  },
  {
    title: "📋 포메이션별 통계 가이드",
    items: [
      { term: "🧤 클린시트 방어율", desc: "GK로 출전한 전체 쿼터 중 무실점(0골)으로 막아낸 쿼터 비율. 최소 3쿼터 GK 출전 필요." },
      { term: "🧤 최악의 자동문", desc: "GK로 출전했을 때 쿼터당 평균 실점이 가장 높은 선수. 최소 3쿼터 GK 출전." },
      { term: "🧤 골 넣는 키퍼", desc: "GK 포지션 출전 쿼터에 공격포인트를 기록한 횟수." },
      { term: "🛡️ 빌드업 마스터", desc: "DF 포지션 출전 쿼터에 기록한 어시스트 횟수 TOP 5." },
      { term: "🛡️ 수비수 승률", desc: "해당 선수가 DF로 출전했을 때 팀이 해당 쿼터를 이긴 승률. 최소 5쿼터." },
      { term: "🛡️ 영혼의 센터백 듀오", desc: "두 선수가 동시에 DF로 출전했을 때 쿼터당 최소 실점 조합. 최소 5쿼터." },
      { term: "⚔️ 가짜 9번 (False 9)", desc: "FW 출전 시 어시스트 > 골인 이타적 공격수. 최소 5쿼터 FW 출전." },
      { term: "⚔️ 독박 공격수", desc: "FW 출전 쿼터에 팀 전체 골 중 본인 직접 득점 비율. 최소 5쿼터." },
      { term: "🏃 게임 체인저", desc: "벤치에서 투입된 직후 쿼터에 팀 득실 마진이 크게 폭등한 선수. 최소 2회 투입." },
      { term: "🦾 혹사 지수 (Iron Man)", desc: "벤치 휴식 없이 가장 많은 쿼터를 연속으로 출전한 기록." },
      { term: "🔷 헥사곤 플레이어", desc: "FW 2쿼터+, DF 2쿼터+, GK 1쿼터+ 이상 소화하면서 누적 득실 마진이 가장 높은 멀티 플레이어. 최소 10쿼터 출전." },
    ],
  },
  {
    title: "🎪 이색/예능 통계 가이드",
    items: [
      { term: "🏃 유산소의 신 (Cardio FC)", desc: "출전 쿼터 수 15+ 이상인데 AP가 극히 적고 누적 마진이 0 이하인, 열심히 뛰지만 스탯이 안 나오는 러닝머신 선수." },
      { term: "🛡️ 전술적 희생양", desc: "FW 출전 시 마진은 상위권이나, 팀 사정상 DF/GK로 많이 출전하여 전체 마진에서 손해 보는 만능 선수." },
      { term: "⏱️ 얼리버드 vs 슬로우 스타터", desc: "1~3쿼터 공격포인트 집중 선수 vs 6~8쿼터 공격포인트 집중 선수 비교." },
      { term: "🤡 패배 요정 (The Jinx)", desc: "본인이 AP를 올린 경기의 팀 승률이 유독 낮은 선수. 최소 5경기 AP 기록 필요." },
      { term: "✨ 낭만 원툴 (Highlight Reel)", desc: "중거리/발리/칩슛/헤딩/드리블 등 고난도 골 비율이 가장 높은 선수. 최소 5골, 2+ 고난도골." },
    ],
  },
  {
    title: "🤝 케미스트리 통계 가이드",
    items: [
      { term: "💀 THE DEATH LINEUP", desc: "같은 쿼터에 필드에 선 최강의 5인 조합. 최소 5쿼터 함께 출전 기준." },
      { term: "🤝 환상의 짝꿍 TOP 10", desc: "A의 패스를 받아 B가 골을 넣은 패스 네트워크 랭킹. 최소 8경기 함께 출전한 듀오 기준." },
      { term: "☠️ TOXIC DUO", desc: "같은 필드에 설 때 팀 실점률 최고 조합. 최소 10쿼터." },
      { term: "🛡️ BEST DEFENSIVE LINE", desc: "DF 포지션 동시 출전 시 최소 실점 조합. 최소 5쿼터." },
      { term: "⚡ SYNERGY MARGIN", desc: "같이 뛸 때 vs 따로 뛸 때 마진 차이. 최소 10쿼터 함께+따로." },
      { term: "🫥 WITHOUT YOU", desc: "선수가 벤치에 앉을 때 vs 필드에 있을 때 팀 마진 차이." },
      { term: "⚔️ BEST FW DUO", desc: "동시에 FW로 뛰었을 때 최강 투톱. 최소 5쿼터." },
    ],
  },
  {
    title: "🏆 명예의 전당",
    items: [
      { term: "등재 기준", desc: "한 경기에 공격포인트(골+어시스트) 합산 7개 이상 기록 시 명예의 전당에 박제됩니다." },
    ],
  },
  {
    title: "📈 기타 통계 용어",
    items: [
      { term: "수비 기여도", desc: "선수 투입 쿼터 vs 미투입 쿼터의 팀 실점 평균 비교. 마이너스(-)면 해당 선수가 있을 때 실점이 줄어든다는 의미." },
      { term: "킬러 쿼터", desc: "해당 선수가 가장 많은 공격포인트를 기록한 쿼터 번호." },
      { term: "슈퍼 서브 🔥", desc: "직전 쿼터 벤치에서 투입 후 바로 AP를 기록한 선수." },
      { term: "포지션별 팀 승률", desc: "선수가 특정 포지션(FW/DF/GK/MF)으로 뛰었을 때 해당 쿼터의 팀 승률." },
    ],
  },
];

const GuidePage = () => (
  <div className="pb-20">
    <PageHeader title="GUIDE" subtitle="버니즈 축구 백과사전" />
    <div className="px-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
          <Book size={16} /> 앱에서 사용되는 모든 용어와 기준을 설명합니다
        </div>
        <p className="text-xs text-muted-foreground">각 항목을 탭하면 상세 설명과 축구 레전드 밈의 유래를 확인할 수 있습니다.</p>
      </motion.div>

      {GUIDE_SECTIONS.map((section, si) => (
        <motion.div key={si} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.04 }}
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
