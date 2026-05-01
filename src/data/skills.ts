import type { Skill } from '../types';

export const SKILLS_DATA: Skill[] = [
  {
    id: 'fireball', name: '火球术', type: 'active', level: 1, maxLevel: 10,
    mpCost: 10, cooldown: 0, currentCd: 0,
    effects: [{ type: 'damage', target: 'enemy', multiplier: 1.8 }],
    unlockRealm: '炼气', description: '凝聚灵力化为火球，造成1.8倍伤害',
  },
  {
    id: 'yujian', name: '御剑术', type: 'active', level: 1, maxLevel: 10,
    mpCost: 20, cooldown: 2, currentCd: 0,
    effects: [{ type: 'damage', target: 'enemy', multiplier: 2.5 }],
    unlockRealm: '筑基', description: '御剑杀敌，造成2.5倍伤害，冷却2回合',
  },
  {
    id: 'iron-wall', name: '铁壁', type: 'passive', level: 1, maxLevel: 5,
    mpCost: 0, cooldown: 0, currentCd: 0,
    effects: [{ type: 'buff', target: 'self', multiplier: 0, buffStat: 'def', buffValue: 20 }],
    unlockRealm: '炼气', description: '永久提升防御20点',
  },
  {
    id: 'lingshi', name: '灵识', type: 'passive', level: 1, maxLevel: 5,
    mpCost: 0, cooldown: 0, currentCd: 0,
    effects: [{ type: 'buff', target: 'self', multiplier: 0, buffStat: 'wil', buffValue: 8 }],
    unlockRealm: '筑基', description: '永久提升神识8点',
  },
  {
    id: 'jianxin', name: '剑心', type: 'talent', level: 1, maxLevel: 3,
    mpCost: 0, cooldown: 0, currentCd: 0,
    effects: [
      { type: 'buff', target: 'self', multiplier: 0, buffStat: 'wil', buffValue: 15 },
      { type: 'damage', target: 'enemy', multiplier: 2.5 },
    ],
    unlockRealm: '金丹', description: '天赋：神识+15，附带主动剑气伤害',
  },
  {
    id: 'shenshenli', name: '天生神力', type: 'talent', level: 1, maxLevel: 3,
    mpCost: 0, cooldown: 0, currentCd: 0,
    effects: [{ type: 'buff', target: 'self', multiplier: 0, buffStat: 'atk', buffValue: 30 }],
    unlockRealm: '炼气', description: '天赋：永久提升攻击30点',
  },
];
