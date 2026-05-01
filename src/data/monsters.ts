import type { Monster } from '../types';

export const MONSTERS_DATA: Monster[] = [
  {
    id: 'grass-spirit', name: '灵草精', level: 1, realm: '炼气', element: 'wood',
    stats: { hp: 30, mp: 0, atk: 5, def: 2, spd: 5, wil: 3 },
    expReward: 15, goldReward: 3,
  },
  {
    id: 'soul-wolf', name: '噬魂狼', level: 5, realm: '炼气', element: 'earth',
    stats: { hp: 60, mp: 0, atk: 10, def: 4, spd: 12, wil: 5 },
    expReward: 30, goldReward: 8,
  },
  {
    id: 'ghost', name: '幽冥鬼', level: 12, realm: '筑基', element: 'water',
    stats: { hp: 100, mp: 20, atk: 18, def: 8, spd: 15, wil: 12 },
    expReward: 60, goldReward: 15,
  },
  {
    id: 'fire-demon', name: '赤焰魔', level: 20, realm: '金丹', element: 'fire',
    stats: { hp: 200, mp: 50, atk: 30, def: 15, spd: 18, wil: 20 },
    expReward: 120, goldReward: 30,
  },
  {
    id: 'thunder-beast', name: '雷兽', level: 35, realm: '元婴', element: 'metal',
    stats: { hp: 400, mp: 80, atk: 50, def: 25, spd: 25, wil: 35 },
    expReward: 250, goldReward: 60,
  },
  {
    id: 'dragon', name: '九天龙', level: 55, realm: '化神', element: 'fire',
    stats: { hp: 800, mp: 150, atk: 80, def: 40, spd: 30, wil: 60 },
    expReward: 500, goldReward: 120,
  },
  {
    id: 'ancient-demon', name: '上古魔神', level: 80, realm: '合体', element: 'earth',
    stats: { hp: 1500, mp: 300, atk: 130, def: 65, spd: 35, wil: 100 },
    expReward: 1000, goldReward: 250,
  },
  {
    id: 'fallen-immortal', name: '堕仙', level: 120, realm: '大乘', element: 'metal',
    stats: { hp: 3000, mp: 500, atk: 200, def: 100, spd: 50, wil: 160 },
    expReward: 2500, goldReward: 500,
  },
];

export const IDLE_EXP_PER_TICK = 5;
export const IDLE_GOLD_PER_TICK = 2;
export const IDLE_TICK_MS = 2000;
