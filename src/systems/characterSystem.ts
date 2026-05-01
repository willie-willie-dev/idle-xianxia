import type { Stats, StatKey, Character, Realm, WuXing } from '../types';
import { WUXING_GROWTH } from '../types/character';
import { REALMS, REALM_ORDER } from '../data/realms';

export const DEFAULT_GROWTH_RATES = { hp: 12, mp: 5, atk: 2.5, def: 2, spd: 0.3, wil: 1.0 };

export function expToNextLevel(level: number): number {
  return level * level * 10;
}

export function getRealmIndex(realm: Realm): number {
  return REALM_ORDER.indexOf(realm);
}

export function canBreakthrough(char: Character): boolean {
  const idx = getRealmIndex(char.realm);
  if (idx >= REALM_ORDER.length - 1) return false;
  const nextRealm = REALM_ORDER[idx + 1];
  return char.level >= REALMS[nextRealm].levelReq;
}

export function getNextRealm(char: Character): Realm | null {
  const idx = getRealmIndex(char.realm);
  if (idx >= REALM_ORDER.length - 1) return null;
  return REALM_ORDER[idx + 1];
}

export function breakthrough(char: Character): Character {
  const next = getNextRealm(char);
  if (!next) return char;
  return { ...char, realm: next, skillPoint: char.skillPoint + 2 };
}

export function calculateFinalStats(
  char: Character,
  equipmentBonus: Partial<Stats>,
  skillBonus: Partial<Stats>,
): Stats {
  const r = REALMS[char.realm];
  const g = char.growthRates;
  const wuxingBonus = WUXING_GROWTH[char.element];
  const keys: StatKey[] = ['hp', 'mp', 'atk', 'def', 'spd', 'wil'];
  const result = {} as Stats;
  for (const k of keys) {
    const base = char.baseStats[k];
    const growth = char.level * g[k];
    const realmMult = r.multiplier;
    const wuxMult = wuxingBonus[k] ?? 1;
    const eqBonus = equipmentBonus[k] ?? 0;
    const skBonus = skillBonus[k] ?? 0;
    const eventBonus = char.bonusFromEvents[k] ?? 0;
    result[k] = (base + growth) * realmMult * wuxMult + eqBonus + skBonus + eventBonus;
  }
  return result;
}

export function addExp(char: Character, exp: number): Character {
  let c = { ...char, exp: char.exp + exp };
  while (c.exp >= expToNextLevel(c.level)) {
    c = { ...c, level: c.level + 1, exp: c.exp - expToNextLevel(c.level - 1) };
  }
  return c;
}

export function createInitialCharacter(element: WuXing = 'metal'): Character {
  return {
    id: 'player',
    name: '无名修士',
    level: 1,
    exp: 0,
    realm: '炼气',
    element,
    baseStats: { hp: 100, mp: 30, atk: 10, def: 5, spd: 10, wil: 8 },
    growthRates: { ...DEFAULT_GROWTH_RATES },
    bonusFromEvents: {},
    skillPoint: 0,
    gold: 0,
  };
}
