import type { EquipBase } from '../types';

export const EQUIPMENT_DATA: EquipBase[] = [
  {
    id: 'iron-sword', name: '铁剑', slot: 'weapon', quality: 'white',
    baseStats: { atk: 15 }, affixes: [], enhanceLevel: 0,
  },
  {
    id: 'cloth-armor', name: '布甲', slot: 'armor', quality: 'white',
    baseStats: { def: 8, hp: 30 }, affixes: [], enhanceLevel: 0,
  },
  {
    id: 'green-blade', name: '青锋剑', slot: 'weapon', quality: 'green',
    baseStats: { atk: 25 }, affixes: [{ stat: 'spd', value: 3 }], enhanceLevel: 0,
  },
  {
    id: 'xuantie-armor', name: '玄铁甲', slot: 'armor', quality: 'blue',
    baseStats: { def: 30, hp: 80 }, affixes: [{ stat: 'def', value: 5 }, { stat: 'spd', value: -2 }], enhanceLevel: 0,
  },
  {
    id: 'zidian-bracer', name: '紫电护腕', slot: 'accessory1', quality: 'purple',
    baseStats: { atk: 12, spd: 8 }, affixes: [{ stat: 'wil', value: 10 }, { stat: 'atk', value: 5 }], enhanceLevel: 0,
  },
  {
    id: 'tianlei-sword', name: '天雷剑', slot: 'weapon', quality: 'gold',
    baseStats: { atk: 80 }, affixes: [{ stat: 'wil', value: 20 }, { stat: 'spd', value: 15 }, { stat: 'hp', value: 500 }], enhanceLevel: 0,
    setId: 'thunder-god',
  },
  {
    id: 'jade-pendant', name: '玉佩', slot: 'accessory2', quality: 'green',
    baseStats: { hp: 40, mp: 20 }, affixes: [{ stat: 'def', value: 3 }], enhanceLevel: 0,
  },
  {
    id: 'hunyuan-seal', name: '混元印', slot: 'artifact', quality: 'red',
    baseStats: { atk: 50, def: 40, hp: 300, mp: 100, spd: 10 }, affixes: [{ stat: 'wil', value: 30 }, { stat: 'atk', value: 20 }, { stat: 'def', value: 15 }], enhanceLevel: 0,
  },
];

export const SET_EFFECTS = [
  {
    setId: 'thunder-god',
    name: '雷神',
    pieces2: { description: 'ATK+15%', statBonus: { atk: 30 } },
    pieces4: { description: '攻击时20%概率触发雷击', statBonus: { atk: 60 }, special: '雷击' },
  },
];

export const QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'] as const;

export const QUALITY_MULTIPLIER: Record<string, number> = {
  white: 1, green: 1.5, blue: 2, purple: 3, gold: 5, red: 10,
};

export const QUALITY_WEIGHTS: Record<string, number> = {
  white: 50, green: 25, blue: 15, purple: 7, gold: 2.5, red: 0.5,
};

export const QUALITY_COLORS: Record<string, string> = {
  white: '#c8ccd4', green: '#81c784', blue: '#64b5f6', purple: '#ce93d8', gold: '#d4a843', red: '#e57373',
};
