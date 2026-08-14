// Format-aware position mapping system (futsal 5v5/6v6, soccer 7v7 ~ 11v11)

export type RoleKey = "GK" | "DF" | "MF" | "FW";

export interface PositionSlot {
  code: string;
  ko: string;
  en: string;
  role: RoleKey;
  x: number; // 0-100 (left→right)
  y: number; // 0-100 (top = attack)
}

export interface MatchFormat {
  code: string;
  ko: string;
  en: string;
  sport: "futsal" | "soccer";
  slots: PositionSlot[];
}

const s = (code: string, ko: string, en: string, role: RoleKey, x: number, y: number): PositionSlot => ({ code, ko, en, role, x, y });

export const MATCH_FORMATS: MatchFormat[] = [
  {
    code: "futsal5",
    ko: "풋살 5대5",
    en: "Futsal 5v5",
    sport: "futsal",
    slots: [
      s("GK", "골레이로", "Goleiro", "GK", 50, 88),
      s("FIXO", "픽소", "Fixo", "DF", 50, 68),
      s("L-ALA", "좌측 아라", "Left Ala", "MF", 20, 46),
      s("R-ALA", "우측 아라", "Right Ala", "MF", 80, 46),
      s("PIVO", "피보", "Pivo", "FW", 50, 22),
    ],
  },
  {
    code: "futsal6",
    ko: "풋살 6대6",
    en: "Futsal 6v6",
    sport: "futsal",
    slots: [
      s("GK", "골레이로", "Goleiro", "GK", 50, 88),
      s("FIXO", "픽소", "Fixo", "DF", 50, 70),
      s("L-FIXO", "좌측 픽소", "Left Fixo", "DF", 28, 70),
      s("R-FIXO", "우측 픽소", "Right Fixo", "DF", 72, 70),
      s("L-ALA", "좌측 아라", "Left Ala", "MF", 18, 46),
      s("R-ALA", "우측 아라", "Right Ala", "MF", 82, 46),
      s("PIVO", "피보", "Pivo", "FW", 50, 20),
      s("L-PIVO", "좌측 피보", "Left Pivo", "FW", 32, 20),
      s("R-PIVO", "우측 피보", "Right Pivo", "FW", 68, 20),
    ],
  },
  {
    code: "s7",
    ko: "축구 7대7",
    en: "Soccer 7v7",
    sport: "soccer",
    slots: [
      s("GK", "골키퍼", "Goalkeeper", "GK", 50, 90),
      s("CB", "센터백", "Centre Back", "DF", 50, 72),
      s("LWB", "좌측 윙백", "Left Wing Back", "DF", 16, 66),
      s("RWB", "우측 윙백", "Right Wing Back", "DF", 84, 66),
      s("CM", "중앙 미드필더", "Centre Mid", "MF", 50, 48),
      s("LW", "좌측 윙어", "Left Winger", "FW", 18, 26),
      s("RW", "우측 윙어", "Right Winger", "FW", 82, 26),
      s("ST", "스트라이커", "Striker", "FW", 50, 18),
    ],
  },
  {
    code: "s8",
    ko: "축구 8대8",
    en: "Soccer 8v8",
    sport: "soccer",
    slots: [
      s("GK", "골키퍼", "Goalkeeper", "GK", 50, 90),
      s("CB", "센터백", "Centre Back", "DF", 50, 74),
      s("LB", "좌측 풀백", "Left Back", "DF", 16, 70),
      s("RB", "우측 풀백", "Right Back", "DF", 84, 70),
      s("CDM", "수비형 미드필더", "Defensive Mid", "MF", 50, 58),
      s("CM", "중앙 미드필더", "Centre Mid", "MF", 50, 44),
      s("LW", "좌측 윙어", "Left Winger", "FW", 18, 26),
      s("RW", "우측 윙어", "Right Winger", "FW", 82, 26),
      s("ST", "스트라이커", "Striker", "FW", 50, 16),
    ],
  },
  {
    code: "s9",
    ko: "축구 9대9",
    en: "Soccer 9v9",
    sport: "soccer",
    slots: [
      s("GK", "골키퍼", "Goalkeeper", "GK", 50, 90),
      s("CB", "센터백", "Centre Back", "DF", 50, 74),
      s("LCB", "좌측 센터백", "Left Centre Back", "DF", 34, 74),
      s("RCB", "우측 센터백", "Right Centre Back", "DF", 66, 74),
      s("LB", "좌측 풀백", "Left Back", "DF", 14, 68),
      s("RB", "우측 풀백", "Right Back", "DF", 86, 68),
      s("CM", "중앙 미드필더", "Centre Mid", "MF", 50, 48),
      s("LCM", "좌측 볼란치", "Left Volante", "MF", 34, 52),
      s("RCM", "우측 볼란치", "Right Volante", "MF", 66, 52),
      s("LW", "좌측 윙어", "Left Winger", "FW", 18, 26),
      s("RW", "우측 윙어", "Right Winger", "FW", 82, 26),
      s("ST", "스트라이커", "Striker", "FW", 50, 15),
    ],
  },
  {
    code: "s10",
    ko: "축구 10대10",
    en: "Soccer 10v10",
    sport: "soccer",
    slots: [
      s("GK", "골키퍼", "Goalkeeper", "GK", 50, 91),
      s("CB", "센터백", "Centre Back", "DF", 50, 76),
      s("LCB", "좌측 센터백", "Left Centre Back", "DF", 34, 76),
      s("RCB", "우측 센터백", "Right Centre Back", "DF", 66, 76),
      s("LB", "좌측 풀백", "Left Back", "DF", 13, 70),
      s("RB", "우측 풀백", "Right Back", "DF", 87, 70),
      s("DM", "수비형 미드필더", "Defensive Mid", "MF", 50, 60),
      s("CM", "중앙 미드필더", "Centre Mid", "MF", 50, 48),
      s("AM", "공격형 미드필더", "Attacking Mid", "MF", 50, 36),
      s("LW", "좌측 윙어", "Left Winger", "FW", 17, 26),
      s("RW", "우측 윙어", "Right Winger", "FW", 83, 26),
      s("ST", "스트라이커", "Striker", "FW", 50, 14),
    ],
  },
  {
    code: "s11",
    ko: "축구 11대11",
    en: "Soccer 11v11",
    sport: "soccer",
    slots: [
      s("GK", "골키퍼", "Goalkeeper", "GK", 50, 92),
      s("LB", "좌측 풀백", "Left Back", "DF", 12, 72),
      s("CB-L", "센터백 (좌)", "Centre Back (L)", "DF", 37, 77),
      s("CB-R", "센터백 (우)", "Centre Back (R)", "DF", 63, 77),
      s("CB", "센터백", "Centre Back", "DF", 50, 77),
      s("RB", "우측 풀백", "Right Back", "DF", 88, 72),
      s("DM", "수비형 미드필더", "Defensive Mid", "MF", 50, 61),
      s("L-DM", "좌측 더블 볼란치", "Left Double Pivot", "MF", 36, 61),
      s("R-DM", "우측 더블 볼란치", "Right Double Pivot", "MF", 64, 61),
      s("CM", "중앙 미드필더", "Centre Mid", "MF", 50, 48),
      s("AM", "공격형 미드필더", "Attacking Mid", "MF", 50, 36),
      s("LW", "좌측 윙어", "Left Winger", "FW", 15, 27),
      s("RW", "우측 윙어", "Right Winger", "FW", 85, 27),
      s("ST", "스트라이커", "Striker", "FW", 50, 13),
    ],
  },
];

export const DEFAULT_FORMAT = "futsal5";

export const getFormat = (code?: string | null): MatchFormat =>
  MATCH_FORMATS.find(f => f.code === code) ?? MATCH_FORMATS[0];

export const getSlots = (code?: string | null): PositionSlot[] => getFormat(code).slots;

// Global lookup across every format (for profile rendering without match context)
export const ALL_SLOTS: Record<string, PositionSlot> = MATCH_FORMATS.reduce((acc, f) => {
  f.slots.forEach(sl => { if (!acc[sl.code]) acc[sl.code] = sl; });
  return acc;
}, {} as Record<string, PositionSlot>);

export const getSlot = (code?: string | null, formatCode?: string | null): PositionSlot | null => {
  if (!code) return null;
  const inFormat = getSlots(formatCode).find(sl => sl.code === code);
  return inFormat ?? ALL_SLOTS[code] ?? null;
};

export const slotLabel = (code: string, isEn: boolean, formatCode?: string | null) => {
  const sl = getSlot(code, formatCode);
  return sl ? (isEn ? sl.en : sl.ko) : code;
};

export const formatLabel = (code: string | null | undefined, isEn: boolean) => {
  const f = getFormat(code);
  return isEn ? f.en : f.ko;
};

/** slot map stored inside the lineup unit: { _slot: { "12": "L-ALA" } } */
export const slotMapOf = (unit: any): Record<string, string> =>
  unit && typeof unit._slot === "object" && unit._slot ? unit._slot : {};

export const slotOfPlayer = (unit: any, playerId: number): string | null =>
  slotMapOf(unit)[String(playerId)] ?? null;
