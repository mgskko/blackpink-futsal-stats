// Bilingual translation utilities for dynamic badge/scouting labels.
// UI-only; DB values remain in Korean for logic integrity.

const BADGE_STATIC: Record<string, string> = {
  "누적 MOM 1위": "All-time MOM Leader",
  "승리의 부적": "Lucky Charm",
  "패배 요정": "Doom Fairy",
  "주사위형 선수": "Wildcard Player",
  "까방권 보유": "Immunity (Hat-trick)",
};

const YEAR_TITLES: [RegExp, string][] = [
  [/^(\d{4}) 득점왕$/, "$1 Top Scorer"],
  [/^(\d{4}) 도움왕$/, "$1 Top Assister"],
  [/^(\d{4}) 공포왕$/, "$1 AP King"],
  [/^(\d{4}) 출석왕$/, "$1 Attendance King"],
  [/^(\d{4}) 자체전 득점왕$/, "$1 Intrasquad Top Scorer"],
  [/^(\d{4}) 자체전 여포$/, "$1 Intrasquad Warlord"],
];

export function translateBadgeLabel(label: string, isEn: boolean): string {
  if (!isEn) return label;
  if (BADGE_STATIC[label]) return BADGE_STATIC[label];
  for (const [re, tpl] of YEAR_TITLES) {
    const m = label.match(re);
    if (m) return tpl.replace("$1", m[1]);
  }
  return label;
}

// Scouting patterns (label + comment)
export const SCOUTING_EN: Record<string, { label: string; comment: string }> = {
  rookie:     { label: "Special Rookie",         comment: "A brand new addition to the squad. Excited to see them grow!" },
  bomber:     { label: "Goal Bomber",            comment: "Boots on fire — every touch seems to find the net." },
  playmaker:  { label: "Playmaker",              comment: "The team's De Bruyne — a selfless creator lifting teammates." },
  slow_start: { label: "Slow Starter",           comment: "Shook off an ugly early-season slump and is back in top form." },
  aging:      { label: "Aging Curve",            comment: "The early bomber has gone quiet. Aging curve suspected." },
  steady:     { label: "Reliable Regular",       comment: "Rain or shine, always delivers — a rock-solid contributor." },
  zero:       { label: "Off-target Woes",        comment: "Always on the pitch but the shooting boots are misfiring badly." },
  pokemon:    { label: "Legendary Pokémon",      comment: "Rumoured to be a myth. Please show your face at a match!" },
  spy:        { label: "Enemy Spy",              comment: "Recently shook the net — sadly, our own." },
  totem:      { label: "Living Win Totem",       comment: "Numbers don't fully explain it — the team just wins when they play." },
  doom:       { label: "Doom Fairy",             comment: "Regardless of form, the team struggles on their match days." },
  greedy:     { label: "Jar of Greed",           comment: "The pass button is broken — eyes only for goal, an alpha striker." },
  clutch:     { label: "Clutch Master",          comment: "Rises in the tightest moments — a true late-game hero." },
  padder:     { label: "Stat Padder",            comment: "Sharpens up in blowouts — the ultimate garbage-time specialist." },
  unsung:     { label: "Unsung Hero",            comment: "Sweats the most on the pitch — the beating heart of the side." },
  iron:       { label: "Iron Man",               comment: "Endless stamina and attendance — a true futsal court ghost." },
};

export function translateScoutingLabel(label: string, isEn: boolean): string {
  if (!isEn) return label;
  const found = Object.values(SCOUTING_EN).find(v => label && label.length > 0 && SCOUTING_EN_KO_LABEL_MAP[label] === undefined ? false : false);
  const key = SCOUTING_EN_KO_LABEL_MAP[label];
  return key ? SCOUTING_EN[key].label : label;
}

export function translateScoutingComment(comment: string, isEn: boolean): string {
  if (!isEn) return comment;
  const key = SCOUTING_EN_KO_COMMENT_MAP[comment];
  return key ? SCOUTING_EN[key].comment : comment;
}

// KO label → key
const SCOUTING_EN_KO_LABEL_MAP: Record<string, string> = {
  "특급 루키": "rookie",
  "골 폭격기": "bomber",
  "플레이메이커": "playmaker",
  "슬로우 스타터": "slow_start",
  "에이징 커브": "aging",
  "국밥형 상수": "steady",
  "영점 조절 실패": "zero",
  "전설의 포켓몬": "pokemon",
  "상대팀의 스파이": "spy",
  "인간 승리 토템": "totem",
  "패배 요정": "doom",
  "탐욕의 항아리": "greedy",
  "클러치 장인": "clutch",
  "스탯 세탁기": "padder",
  "언성 히어로": "unsung",
  "철강왕": "iron",
};

const SCOUTING_EN_KO_COMMENT_MAP: Record<string, string> = {
  "이제 막 팀에 합류한 신입입니다. 앞으로의 활약을 기대합니다!": "rookie",
  "발끝이 아주 뜨겁습니다! 발만 갖다 대도 들어가는 득점 감각.": "bomber",
  "팀의 더 브라위너! 동료를 돕는 이타적인 플레이에 눈을 떴습니다.": "playmaker",
  "시즌 초반의 끔찍한 부진을 씻고 완벽하게 부활했습니다.": "slow_start",
  "전반기의 폭격기는 어디 가고 침묵 중입니다. 에이징 커브가 의심됩니다.": "aging",
  "비가 오나 눈이 오나 자기 몫은 해내는 든든한 국밥형 플레이어.": "steady",
  "경기장엔 늘 있지만 영점이 심하게 흔들립니다. 굿을 해야 합니다.": "zero",
  "실존 인물인지 의심받고 있습니다. 제발 얼굴 좀 비춰주세요!": "pokemon",
  "최근 골망을 흔들었지만 불행히도 우리 팀 골대였습니다.": "spy",
  "기록지에 보이지 않는 아우라. 경기장에 서 있는 것만으로 승리를 부르는 토템입니다.": "totem",
  "폼은 둘째치고 출전 날마다 팀이 고전합니다. 터가 안 맞을지도 모릅니다.": "doom",
  "패스(X) 버튼이 고장 난 것이 분명합니다. 오직 골대만 바라보는 상남자.": "greedy",
  "위태로울 때 빛나는 진정한 에이스. 벼랑 끝에서 팀을 구하는 해결사.": "clutch",
  "승부가 기울면 날카로워집니다. 빈집 털기의 스페셜리스트!": "padder",
  "피치 위에서 가장 많은 땀을 흘리는 팀의 심장입니다.": "unsung",
  "지치지 않는 체력과 출석률! 풋살장 지박령이 의심되는 진정한 철인.": "iron",
};

// Result label KO → EN
export function translateResultLabel(r: string, isEn: boolean): string {
  if (!isEn) return r;
  if (r === "승") return "W";
  if (r === "패") return "L";
  if (r === "무") return "D";
  return r;
}

// Position-based scouting lines from PlayerDetailPage
export function translateScoutingLine(line: string, isEn: boolean): string {
  if (!isEn) return line;
  const map: Record<string, string> = {
    "📋 전방 배치 권장 — FW 출전 시 팀 성적이 돋보입니다.":
      "📋 Deploy up front — the team performs better with them as FW.",
    "📋 후방 수비/빌드업 핵심 — DF 배치 시 안정감이 극대화됩니다.":
      "📋 Back-line linchpin — most stable when deployed at DF.",
    "📋 완벽한 헥사곤 멀티 플레이어 — 어디를 서도 팀에 기여합니다.":
      "📋 Perfect hexagon multi-player — contributes anywhere on the pitch.",
    "⚽ 이타적 폴스 나인(False 9) — 골보다 동료 살리기에 능한 플레이메이커.":
      "⚽ Selfless False 9 — creates for teammates more than scores.",
    "⚽ 타겟맨/포쳐 — 골문 앞 혼전과 주워먹기에 특화된 스트라이커.":
      "⚽ Target-man / Poacher — thrives on scrambles and tap-ins in the box.",
    "⚽ 역습의 선봉장 — 빠른 전환 공격의 마무리를 책임지는 스피드스터.":
      "⚽ Counter-attack spearhead — finishes off fast transitions.",
    "⚽ 아직 충분한 득점 데이터가 쌓이지 않았습니다.":
      "⚽ Not enough scoring data yet.",
  };
  if (map[line]) return map[line];
  // Dynamic patterns
  let m = line.match(/^📋 FW 승률 (\d+)% \/ DF 승률 (\d+)% — 포지션 최적화가 필요합니다\.$/);
  if (m) return `📋 FW Win% ${m[1]} / DF Win% ${m[2]} — position optimisation needed.`;
  m = line.match(/^⚽ 균형잡힌 스트라이커 — (\d+)골 (\d+)도움의 만능형 공격수\.$/);
  if (m) return `⚽ Balanced striker — ${m[1]}G ${m[2]}A all-rounder.`;
  m = line.match(/^🤝 베스트 시너지: (.+) \((\d+)회 합작\)$/);
  if (m) return `🤝 Best synergy: ${m[1]} (${m[2]} combos)`;
  return line;
}

// Tier config (from PlayerTierBadge) — EN labels
export const TIER_EN_LABEL: Record<string, string> = {
  "월드클래스": "World Class",
  "국대급 에이스": "National Team Ace",
  "세미프로": "Semi-Pro",
  "K5 리거": "K5 Leaguer",
  "아마추어 1부": "Amateur Div. 1",
  "아마추어 3부": "Amateur Div. 3",
  "조기축구": "Morning League",
  "동네축구": "Casual Kickabout",
};

export function translateTierLabel(label: string, isEn: boolean): string {
  return isEn ? (TIER_EN_LABEL[label] ?? label) : label;
}

// ─── Player Traits (from useCourtStats.computePlayerTraits) ───
// Map KO trait name → EN name
const TRAIT_NAME_EN: Record<string, string> = {
  "제라드의 강림": "Gerrard Reborn",
  "인자기의 환생": "Inzaghi Reborn",
  "즐라탄 빙의": "Zlatan Mode",
  "폭주기관차 베일": "Runaway Bale",
  "라인 브레이커 토레스": "Line-breaker Torres",
  "덕배의 택배기사": "Killer-pass Courier",
  "펩이 사랑한 컷백": "Pep's Cut-back",
  "마에스트로 외질": "Maestro Özil",
  "비디치의 통곡의 벽": "Vidić's Wailing Wall",
  "가투소의 미친개": "Gattuso's Mad Dog",
  "빅게임 해결사 드록바": "Big-game Drogba",
  "라모스 극장골": "Ramos Late-drama",
  "위기의 남자": "Crisis Man",
  "부폰의 거미손": "Buffon's Spider Hands",
  "루카쿠의 양민학살": "Lukaku Bully-mode",
  "패스 버튼 고장난 로벤": "Broken-pass Robben",
  "세트피스 장인": "Set-piece Specialist",
};

// Description translator — handles both static strings and dynamic templates
export function translateTraitName(name: string, isEn: boolean): string {
  if (!isEn) return name;
  return TRAIT_NAME_EN[name] ?? name;
}

export function translateTraitDescription(desc: string, isEn: boolean): string {
  if (!isEn) return desc;
  // Dynamic patterns first
  let m = desc.match(/^중거리골 팀 내 1~2위 \((\d+)골\)$/);
  if (m) return `Long-range goals: team top-2 (${m[1]}G)`;
  m = desc.match(/^선제골 팀 내 1~2위 \((\d+)회\)$/);
  if (m) return `First-blood goals: team top-2 (${m[1]}x)`;
  m = desc.match(/^GK 무실점 쿼터 팀 내 1~2위 \((\d+)회\)$/);
  if (m) return `GK clean-sheet quarters: team top-2 (${m[1]}x)`;
  m = desc.match(/^주워먹기\/혼전골 비율 팀 내 1~2위 \((\d+)\/(\d+)\)$/);
  if (m) return `Tap-in ratio: team top-2 (${m[1]}/${m[2]})`;
  m = desc.match(/^세트피스 골\+어시 팀 내 1~2위 \((\d+)회\)$/);
  if (m) return `Set-piece G+A: team top-2 (${m[1]}x)`;

  const staticMap: Record<string, string> = {
    "주워먹기/혼전골 팀 내 1~2위": "Tap-in / scramble goals: team top-2",
    "고난도 골 팀 내 1~2위": "Trick goals: team top-2",
    "치달/역습 득점+어시 팀 내 1~2위": "Counter-attack G+A: team top-2",
    "침투/킬패스 연계 팀 내 1~2위": "Off-ball runs / kill-pass finishes: team top-2",
    "킬패스 어시스트 팀 내 1~2위": "Kill-pass assists: team top-2",
    "컷백패스 어시스트 팀 내 1~2위": "Cut-back assists: team top-2",
    "어시스트 비율 팀 내 1~2위": "Assist ratio: team top-2",
    "DF 출전 시 최소 실점 팀 내 1~2위": "Fewest conceded as DF: team top-2",
    "압박/차단 기반 득점+어시 팀 내 1~2위": "Press / intercept G+A: team top-2",
    "7-8Q 득점 팀 내 1~2위": "Late-quarter (7-8Q) goals: team top-2",
    "클러치 득점 팀 내 1~2위": "Clutch goals when tied/behind: team top-2",
    "3점차+ 리드 시 기록 비율 팀 내 1위": "Stat-padder ratio (+3 lead): team #1",
    "어시스트 비율 최저 팀 내 1~2위": "Lowest assist ratio: team bottom-2",
  };
  return staticMap[desc] ?? desc;
}