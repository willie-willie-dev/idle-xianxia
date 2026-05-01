export type Realm =
  | '炼气' | '筑基' | '金丹' | '元婴' | '化神'
  | '合体' | '大乘' | '渡劫' | '仙人';

export type WuXing = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  wil: number;  // 神识（法攻+法防）
}

export type StatKey = keyof Stats;

export const WUXING_GROWTH: Record<WuXing, Partial<Stats>> = {
  metal: { atk: 1.3, spd: 1.1 },
  wood: { hp: 1.3, mp: 1.1 },
  water: { mp: 1.3, wil: 1.3 },
  fire: { atk: 1.2, spd: 1.2, wil: 1.1 },
  earth: { def: 1.3, hp: 1.1 },
};

export interface GrowthRates {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  wil: number;
}

export interface RealmConfig {
  realm: Realm;
  levelReq: number;
  multiplier: number;
  materials: { name: string; count: number }[];
}

export interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  realm: Realm;
  element: WuXing;
  baseStats: Stats;
  growthRates: GrowthRates;
  bonusFromEvents: Partial<Stats>;
  skillPoint: number;
  gold: number;
}
