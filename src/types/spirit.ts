// 灵气系统类型定义

// 灵气类型：只有五行（乾/坤不存储灵气）
export type SpiritType = 'fire' | 'water' | 'wood' | 'metal' | 'earth';
export type SpiritRootKey = 'qian' | 'kun' | 'fire' | 'water' | 'wood' | 'metal' | 'earth';

export const ELEMENT_KEYS: SpiritType[] = ['fire', 'water', 'wood', 'metal', 'earth'];

export const SPIRIT_LABELS: Record<SpiritType | SpiritRootKey, string> = {
  qian: '乾白', kun: '坤黑',
  fire: '火', water: '水', wood: '木', metal: '金', earth: '土',
};

export const ELEMENT_LABELS: Record<SpiritType, string> = {
  fire: '火', water: '水', wood: '木', metal: '金', earth: '土',
};

// 灵气存量（五种元素灵气）
export interface SpiritEnergy {
  fire: number;
  water: number;
  wood: number;
  metal: number;
  earth: number;
}

// 境界灵气上限（与 MAJOR_REALM_SPIRIT_CAP 对齐后 ×100，避免小数精度问题）
export type RealmIndex = 0 | 1 | 2 | 3 | 4; // 炼气/筑基/金丹/元婴/化神

export const REALM_SPIRIT_CAP: Record<RealmIndex, number> = {
  0: 192000,     // 炼气
  1: 960000,     // 筑基
  2: 4800000,    // 金丹
  3: 24000000,   // 元婴
  4: 120000000,  // 化神
};

export const REALM_INDEX_MAP: Record<string, RealmIndex> = {
  '炼气': 0, '筑基': 1, '金丹': 2, '元婴': 3, '化神': 4,
};

export const DEFAULT_SPIRIT_ENERGY: SpiritEnergy = {
  fire: 0, water: 0, wood: 0, metal: 0, earth: 0,
};