import type { StatKey } from './character';

export type SkillType = 'active' | 'passive' | 'talent';
export type SkillTarget = 'self' | 'enemy' | 'allEnemy' | 'ally';
export type EffectType = 'damage' | 'heal' | 'buff' | 'debuff';

export interface SkillEffect {
  type: EffectType;
  target: SkillTarget;
  multiplier: number;
  buffStat?: StatKey;
  buffValue?: number;
  buffDuration?: number;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  level: number;
  maxLevel: number;
  mpCost: number;
  cooldown: number;
  currentCd: number;
  effects: SkillEffect[];
  unlockRealm: string;
  description: string;
}
