import type { StatKey, Stats, WuXing } from './character';
import type { EquipBase } from './equipment';
import type { Skill } from './skill';

export interface Buff {
  stat: StatKey;
  value: number;
  turnsLeft: number;
}

export interface Combatant {
  name: string;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  stats: Stats;
  element: WuXing;
  skills: Skill[];
  buffs: Buff[];
}

export interface BattleResult {
  victory: boolean;
  turnsUsed: number;
  expGained: number;
  goldGained: number;
  drops: EquipBase[];
  log: string[];
  hpLeft: number;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  realm: string;
  element: WuXing;
  stats: Stats;
  expReward: number;
  goldReward: number;
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'battle' | 'reward' | 'levelup' | 'idle' | 'event' | 'drop';
  timestamp: number;
}
