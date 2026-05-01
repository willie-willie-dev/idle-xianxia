import type { Stats, StatKey } from './character';

export type EquipSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2' | 'artifact';
export type Quality = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red';

export interface Affix {
  stat: StatKey;
  value: number;
}

export interface EquipBase {
  id: string;
  name: string;
  slot: EquipSlot;
  quality: Quality;
  baseStats: Partial<Stats>;
  affixes: Affix[];
  enhanceLevel: number;
  setId?: string;
}

export interface SetEffect {
  setId: string;
  name: string;
  pieces2: { description: string; statBonus: Partial<Stats> };
  pieces4?: { description: string; statBonus: Partial<Stats>; special?: string };
}

export interface EquippedSlots {
  weapon: EquipBase | null;
  armor: EquipBase | null;
  accessory1: EquipBase | null;
  accessory2: EquipBase | null;
  artifact: EquipBase | null;
}
