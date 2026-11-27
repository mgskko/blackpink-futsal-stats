import { useTranslation } from "react-i18next";

export interface GuideItem { term: string; desc: string; term_en?: string; desc_en?: string; }
export interface GuideSection { title: string; title_en?: string; items: GuideItem[]; }

export const GUIDE_SECTIONS_RAW: GuideSection[] = [
  {
    title: "📊 기본 스탯 용어",
    title_en: "📊 Core Stat Glossary",
    items: [
      { term: "평점 (Rating)", term_en: "Rating",
        desc: "풋몹 방식의 경기 평점(3.0~10.0, 평균 약 6.8)입니다. 기준 6.25점에서 ①골·도움(포지션별 가중치, 같은 경기 추가 골은 조금씩 체감) ②출전 중 쿼터당 득실 마진 ③쿼터당 실점률(팀 평균·종목 기준 대비)과 무실점 쿼터 ④팀 승패로 가감합니다. 출전 쿼터가 많아도 불이익이 없고, 짧게 뛴 선수는 수비·결과 항목이 줄어듭니다. 한 쿼터도 안 뛴 선수는 평점이 없습니다. 시즌 평점은 출전 비율로 가중한 평균입니다.",
        desc_en: "FotMob-style match rating (3.0-10.0, average about 6.8). From a 6.25 base: goals and assists (weighted by position, extra goals in the same match count slightly less), on-pitch goal difference per quarter, goals conceded per quarter versus expectation plus clean-sheet quarters, and the team result. Playing more quarters is never penalised; short cameos have their defensive and result terms scaled down; players who never came on get no rating. Season rating is a participation-weighted average." },
      { term: "공격포인트 (AP)", term_en: "Attack Points (AP)",
        desc: "골 + 어시스트 합산 수치입니다. 공격 기여도를 한눈에 보여주는 핵심 지표입니다.",
        desc_en: "Sum of goals + assists. The headline number for attacking contribution." },
      { term: "PPQ (Points Per Quarter)", term_en: "PPQ (Points Per Quarter)",
        desc: "출전 쿼터 수 대비 공격포인트 비율입니다. 쿼터당 평균 몇 개의 공격포인트를 기록하는지 보여줍니다.",
        desc_en: "Attack points divided by quarters played — attacking output per quarter on the pitch." },
      { term: "득점 마진 (코트 마진, +/-)", term_en: "Court Margin (+/-)",
        desc: "해당 선수가 필드에서 뛰는 동안 팀이 기록한 (총 득점 - 총 실점). 농구에서 차용된 지표로, 스탯에 나타나지 않는 팀 승리 기여도를 보여줍니다.",
        desc_en: "Team goals scored minus conceded while the player is on the pitch — a basketball-style +/- for hidden win contribution." },
    ],
  },
  {
    title: "⚽ 득점 루트 용어 사전",
    title_en: "⚽ Goal-Route Glossary",
    items: [
      { term: "킬패스", term_en: "Kill-Pass",
        desc: "수비 라인 사이를 관통하여 골 기회를 만드는 결정적 패스.",
        desc_en: "A line-breaking pass through the defence that creates a clear scoring chance." },
      { term: "컷백패스", term_en: "Cut-Back",
        desc: "사이드에서 골문 앞으로 깔아주는 패스. 과르디올라의 맨시티가 가장 사랑하는 공격 패턴입니다.",
        desc_en: "A ball rolled back from the byline to the front of goal — Guardiola-era Man City's favourite pattern." },
      { term: "골문 앞 혼전골", term_en: "Goalmouth Scramble",
        desc: "골문 앞 밀집 상황에서 혼전 중 발생하는 득점.",
        desc_en: "A goal from a scrappy scramble in a crowded six-yard box." },
      { term: "주워먹기", term_en: "Tap-in / Poacher's Goal",
        desc: "수비수나 골키퍼의 실수, 또는 포스트에 맞고 나온 공을 골문 앞에서 마무리한 득점.",
        desc_en: "Finishing off a rebound, keeper error, or ball off the post from close range." },
      { term: "중거리골", term_en: "Long-Range Goal",
        desc: "페널티 박스 밖에서 강력한 슈팅으로 넣은 골.",
        desc_en: "A powerful strike from outside the penalty area." },
      { term: "침투골", term_en: "Off-the-Shoulder Run",
        desc: "수비 라인 뒤 공간을 파고들어 오프사이드 트랩을 무력화하며 넣은 득점.",
        desc_en: "A goal from timing a run in behind the defensive line, beating the offside trap." },
    ],
  },
  {
    title: "👑 Data MOM 및 랭크 시스템",
    title_en: "👑 Data MOM & Rank System",
    items: [
      { term: "Data MOM이란?", term_en: "What is Data MOM?",
        desc: "그 경기 최고 평점 선수입니다(풋몹의 Player of the Match와 같은 방식). 평점이 같으면 공격포인트 → 출전 쿼터 → 출전 중 득실 마진 순으로 가립니다. 자체전은 팀별로 한 명씩 선정합니다. 관리자가 평점을 보정하면 MOM에도 그대로 반영됩니다.",
        desc_en: "The match's highest-rated player (like FotMob's Player of the Match). Ties go to more goals+assists, then more quarters played, then better on-pitch margin. Intrasquad games pick one per team. Admin rating overrides apply." },
      { term: "8단계 티어 시스템", term_en: "8-Tier Rank System",
        desc: "출전(+1pt), FW AP(+3pt), DF/GK 클린시트(+3pt), MOM 선정(+5pt), 워스트 투표(-3pt)를 종합하여 동네축구 → 조기축구 → 아마추어3부 → 아마추어1부 → K5 리거 → 세미프로 → 국대급 에이스 → 월드클래스까지 8단계로 승급합니다.",
        desc_en: "Appearance +1, FW AP +3, DF/GK clean sheet +3, MOM +5, worst vote -3. Promotes across 8 tiers from Kickabout → World Class." },
    ],
  },
  {
    title: "🏆 북중미모드 — 국대급 진심 모드",
    title_en: "🏆 Concacaf Mode — National-Team Serious Mode",
    items: [
      { term: "🏆 북중미모드란?", term_en: "🏆 What is Concacaf Mode?",
        desc: "2026 북중미 월드컵 콘셉트의 폼 배지입니다. 선수의 최근 출전 5경기(일부 10경기)를 경기 평점·공격포인트·수비 지표로 판정하며, 축구는 골이 드문 만큼 기준이 풋살의 약 40%로 낮아집니다. 프로필에는 가장 인상적인 배지 최대 2개가 표시됩니다.",
        desc_en: "World Cup 2026-themed form badges judged on each player's last 5 played matches (some use 10) from match ratings, goal involvements and defensive numbers. Football thresholds are ~40% of futsal's because goals are scarcer. Up to two strongest badges show on the profile." },
      { term: "🇦🇷 아르헨티나", term_en: "🇦🇷 Argentina",
        desc: "최근 5경기 평균 평점 7.6 이상 + Data MOM 2회 이상. 경기를 끝내는 에이스.",
        desc_en: "Average rating 7.6+ and 2+ Player of the Match awards in the last 5." },
      { term: "🇧🇷 브라질", term_en: "🇧🇷 Brazil",
        desc: "최근 5경기 경기당 공격포인트 2.4개 이상 (축구 약 1.0).",
        desc_en: "2.4+ goal involvements per match over the last 5 (football ~1.0)." },
      { term: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 잉글랜드", term_en: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England",
        desc: "최근 5경기 경기당 1.6골 이상 (축구 약 0.64).",
        desc_en: "1.6+ goals per match over the last 5 (football ~0.64)." },
      { term: "🇫🇷 프랑스", term_en: "🇫🇷 France",
        desc: "최근 5경기 경기당 1.0도움 이상 (축구 약 0.4).",
        desc_en: "1.0+ assists per match over the last 5 (football ~0.4)." },
      { term: "🇪🇸 스페인", term_en: "🇪🇸 Spain",
        desc: "6경기 이상 연속 공격포인트.",
        desc_en: "A goal involvement in 6+ consecutive matches." },
      { term: "🇩🇪 독일", term_en: "🇩🇪 Germany",
        desc: "최근 5경기 모두 평점 6.8 이상 + 평균 출전 75% 이상. 기복 없는 꾸준함.",
        desc_en: "Rated 6.8+ in every one of the last 5 while playing 75%+ of the minutes." },
      { term: "🇮🇹 이탈리아", term_en: "🇮🇹 Italy",
        desc: "수비수·골키퍼로 뛴 3경기 이상에서 수비 평점 평균 +0.45 이상.",
        desc_en: "An average defensive rating component of +0.45 across 3+ matches as DF/GK." },
      { term: "🇲🇦 모로코", term_en: "🇲🇦 Morocco",
        desc: "뒷선 출전 경기의 출전 중 득실 영향력 +0.15 이상 + 최근 5경기 3승 이상.",
        desc_en: "Positive on-pitch impact (+0.15) at the back and 3+ wins in the last 5." },
      { term: "🇨🇻 카보베르데", term_en: "🇨🇻 Cape Verde",
        desc: "골키퍼로 5쿼터 이상, 쿼터당 실점 0.8 미만 (축구 약 0.32).",
        desc_en: "5+ quarters in goal conceding under 0.8 per quarter (football ~0.32)." },
      { term: "🇳🇱 네덜란드", term_en: "🇳🇱 Netherlands",
        desc: "최근 5경기 3개 이상 포지션을 소화하며 평균 평점 7.0 이상.",
        desc_en: "3+ different positions in the last 5 with a 7.0+ average rating." },
      { term: "🇰🇷 대한민국", term_en: "🇰🇷 Korea",
        desc: "평균 출전 90% 이상 + 최근 5경기 3승 이상. 꺾이지 않는 마음.",
        desc_en: "90%+ of minutes played and 3+ wins in the last 5." },
      { term: "🇰🇷 홍명보의 강림", term_en: "🇰🇷 Slump Alert",
        desc: "부진 시그널 — 최근 5경기 평균 평점 6.0 미만 또는 4패 이상. 회색으로 표시됩니다.",
        desc_en: "Slump signal — average rating under 6.0 or 4+ losses in the last 5. Shown in grey." },
    ],
  },
];

/** Backwards-compatible export (Korean shape). */
export const GUIDE_SECTIONS = GUIDE_SECTIONS_RAW;

/** Hook that returns sections localized to the active i18n language. */
export function useGuideSections() {
  const { i18n } = useTranslation();
  const lang = (i18n.language ?? i18n.resolvedLanguage ?? "ko");
  const isEn = lang.startsWith("en");
  return GUIDE_SECTIONS_RAW.map(s => ({
    title: isEn ? (s.title_en ?? s.title) : s.title,
    items: s.items.map(it => ({
      term: isEn ? (it.term_en ?? it.term) : it.term,
      desc: isEn ? (it.desc_en ?? it.desc) : it.desc,
    })),
  }));
}
