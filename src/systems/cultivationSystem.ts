import type { Character, Realm, SpiritRootKey } from '../types';
import type { LearnedTechnique } from '../types/technique';
import type { SpiritType } from '../types/character';
import type { SpiritReward } from '../types/event';
import { ELEMENT_KEYS } from '../types/character';
import { REALM_ORDER } from '../data/realms';
import {
  MAJOR_REALM_SPIRIT_CAP,
  REALM_STAGE_THRESHOLDS,
  emptySpiritQi,
  getRealmProgressCap,
  type RealmStage,
} from '../types/character';

/** 各境界对应的修为值名称 */
export const REALM_PROGRESS_NAMES: Record<Realm, string> = {
  '炼气': '道种', '筑基': '丹华', '金丹': '婴魄', '元婴': '神识', '化神': '神识',
};

/**
 * 将灵气提炼为修为的函数。
 * 灵根比例决定提炼效率：spiritRoots[element] 越高，提炼收益越大。
 * 乾/坤不参与提炼（灵气只有五行）。
 */
export function refineSpiritToProgress(
  char: Character,
  spiritType: SpiritType,
  amount: number,
): { char: Character; refined: number; wasted: number } {
  const current = char.spiritQi[spiritType];
  const actualAmount = Math.min(amount, Math.max(0, current));
  const ratio = Math.max(0, Math.min(100, char.spiritRoots[spiritType])) / 100;
  const refined = Math.floor(actualAmount * ratio);
  const wasted = actualAmount - refined;

  const spiritQi = { ...char.spiritQi, [spiritType]: current - actualAmount };
  const realmProgress = char.realmProgress + refined;

  return { char: { ...char, spiritQi, realmProgress }, refined, wasted };
}

export type EncounterKind = 'absorb' | 'wonder' | 'battle';

const WONDER_ITEMS = ['空灵匣', '残破玉简', '无名灵草'] as const;
const BREAKTHROUGH_ITEMS = ['筑基丹', '金丹丹', '元婴丹', '化神丹'] as const;
const BATTLE_FOES = ['荒山狼妖', '散修李云', '魔道尸傀', '护山灵蟒', '游荡剑修'] as const;

function getMajorRealmSpiritCapFull(realm: Realm): number {
  const cap = MAJOR_REALM_SPIRIT_CAP[realm];
  if (cap !== undefined) return cap;
  const idx = REALM_ORDER.indexOf(realm);
  const huaShenIdx = REALM_ORDER.indexOf('化神');
  const huaShenCap = MAJOR_REALM_SPIRIT_CAP['化神'] ?? 1200000;
  if (idx < 0 || huaShenIdx < 0) return huaShenCap;
  return Math.floor(huaShenCap * 3 ** (idx - huaShenIdx));
}

/** 当前小境界下的单系灵气槽上限（占大境界后期上限的比例见 REALM_STAGE_THRESHOLDS）。 */
export function getSpiritQiCap(realm: Realm, realmStage: RealmStage): number {
  const majorFull = getMajorRealmSpiritCapFull(realm);
  const frac = REALM_STAGE_THRESHOLDS[realmStage];
  return Math.floor(majorFull * frac);
}

/** 五系灵气全部达到当前槽上限时，可触发小境界晋升。 */
export function isAllQiAtCap(char: Character): boolean {
  const cap = getSpiritQiCap(char.realm, char.realmStage);
  return ELEMENT_KEYS.every(k => char.spiritQi[k] >= cap);
}

/** At late stage when full, advancing major realm is possible via pill elsewhere; auto minor does nothing. */
export function advanceMinorRealmIfEligible(char: Character): Character {
  if (char.realmStage === 'late') return char;
  if (!isAllQiAtCap(char)) return char;

  let nextStage: RealmStage;
  if (char.realmStage === 'early') nextStage = 'mid';
  else nextStage = 'late';

  return { ...char, realmStage: nextStage, spiritQi: emptySpiritQi() };
}

export function inventoryCount(char: Character, item: string): number {
  return char.inventory[item] ?? 0;
}

export function addInventory(char: Character, item: string, amount: number): Character {
  if (amount <= 0) return char;
  const next = { ...char.inventory };
  next[item] = (next[item] ?? 0) + amount;
  return { ...char, inventory: next };
}

export function consumeInventory(char: Character, item: string, amount: number): Character | null {
  const cur = char.inventory[item] ?? 0;
  if (cur < amount) return null;
  const next = { ...char.inventory };
  const left = cur - amount;
  if (left <= 0) delete next[item];
  else next[item] = left;
  return { ...char, inventory: next };
}

export function canMajorRealmBreakthrough(char: Character): boolean {
  const next = nextMajorRealm(char.realm);
  if (!next) return false;
  const cap = getRealmProgressCap(char.realm, char.realmStage);
  return char.realmProgress >= cap;
}

export function nextMajorRealm(realm: Realm): Realm | null {
  const idx = REALM_ORDER.indexOf(realm);
  if (idx < 0 || idx >= REALM_ORDER.length - 1) return null;
  return REALM_ORDER[idx + 1];
}

/** Major breakpoint: consumes pill + moves to next realm 初期 + clears qi. */
export function performMajorRealmBreakthrough(char: Character): Character | null {
  const nextRealm = nextMajorRealm(char.realm);
  if (!nextRealm) return null;
  const cap = getRealmProgressCap(char.realm, char.realmStage);
  if (char.realmProgress < cap) return null;
  return {
    ...char,
    realm: nextRealm,
    realmStage: 'early',
    spiritQi: emptySpiritQi(),
    realmProgress: 0,
    skillPoint: char.skillPoint + 2,
  };
}

/**
 * 灵气吸收 v2.0（历练遭遇用）。
 *
 * 各灵根按自身比例直接分配总灵气量（不是剩余量模型）：
 * - 五行灵根（金木水火土）：仅当灵气类型=自身属性时才吸收，否则=0
 *   吸收量 = rawBase × 该灵根比例
 * - 乾灵根：可吸收所有五行灵气，按乾比例分配，再 ×1.5（增幅50%）
 * - 坤灵根：可吸收所有五行灵气，按坤比例分配，再 ×0.1（权重10%）
 *
 * @param char - 当前角色
 * @param spiritReward - 本次获得的灵气奖励（各五行类型的基础量）
 * @returns 吸收结果，含 qianStored（乾吸收量×1.5后）和 kunStored（坤吸收量×0.1后）
 */
export function applySpiritAbsorption(
  char: Character,
  spiritReward: SpiritReward,
): {
  char: Character;
  wastedAbsorb: number;
  overflowLost: number;
  stored: number;
  qianStored: number;
  kunStored: number;
} {
  const qianPct = Math.max(0, Math.min(100, char.spiritRoots['qian'] ?? 0)) / 100;
  const kunPct = Math.max(0, Math.min(100, char.spiritRoots['kun'] ?? 0)) / 100;

  const cap = getSpiritQiCap(char.realm, char.realmStage);

  const spiritQi = { ...char.spiritQi };

  let totalStored = 0;
  let totalOverflow = 0;
  let totalQianStored = 0;
  let totalKunStored = 0;

  for (const key of ELEMENT_KEYS) {
    const rawBase = spiritReward[key] ?? 0;
    if (rawBase <= 0) continue;

    // 五行灵根：仅吸收匹配属性
    const elementPct = Math.max(0, Math.min(100, char.spiritRoots[key] ?? 0)) / 100;
    const elementAbsorbed = rawBase * elementPct;

    // 乾灵根吸收所有五行灵气（×1.5）
    const qianAbsorbed = rawBase * qianPct;
    const qianStored = qianAbsorbed * 1.5;

    // 坤灵根吸收所有五行灵气（×0.1）
    const kunAbsorbed = rawBase * kunPct;
    const kunStored = kunAbsorbed * 0.1;

    const totalAbsorbed = elementAbsorbed + qianStored + kunStored;
    const current = char.spiritQi[key];
    const room = Math.max(0, cap - current);
    const overflow = Math.max(0, totalAbsorbed - room);
    const stored = totalAbsorbed - overflow;

    spiritQi[key] = Math.floor(current + stored);
    totalStored += stored;
    totalOverflow += overflow;
    totalQianStored += qianStored;
    totalKunStored += kunStored;
  }

  let next: Character = { ...char, spiritQi };
  next = advanceMinorRealmIfEligible(next);

  return {
    char: next,
    wastedAbsorb: 0,
    overflowLost: totalOverflow,
    stored: totalStored,
    qianStored: Math.floor(totalQianStored),
    kunStored: Math.floor(totalKunStored),
  };
}

/** 生成奇遇探宝的灵气奖励（1~2种五行灵气） */
export function rollWonderSpiritReward(): SpiritReward {
  const idx1 = Math.floor(Math.random() * ELEMENT_KEYS.length);
  let idx2 = Math.floor(Math.random() * ELEMENT_KEYS.length);
  // 有50%概率只给1种
  const count = Math.random() < 0.5 ? 1 : 2;
  if (count === 1) idx2 = idx1;

  const reward: SpiritReward = {};
  for (const k of count === 1 ? [ELEMENT_KEYS[idx1]] : [ELEMENT_KEYS[idx1], ELEMENT_KEYS[idx2]]) {
    reward[k] = 1000 + Math.floor(Math.random() * 4001); // 1000~5000
  }
  return reward;
}

/** 从奇遇中随机获取一种周天功法 */
export function rollWonderTechnique(): LearnedTechnique {
  const elements: SpiritRootKey[] = ['fire', 'water', 'wood', 'metal', 'earth'];
  const element = elements[Math.floor(Math.random() * elements.length)];
  const baseRatio = 0.03 + Math.random() * 0.07; // 3%~10%
  const costSpiritValue = 20 + Math.floor(Math.random() * 40); // 20~60
  const baseFixed = Math.floor(Math.random() * 20); // 0~19
  const bonusRatio = baseRatio * 0.4;
  const bonusFixed = Math.floor(baseFixed * 2);

  return {
    instanceId: `tech-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    techniqueId: 'wonder-drop',
    name: getWonderTechniqueName(element),
    element,
    baseRatio,
    baseFixed,
    bonusRatio,
    bonusFixed,
    costSpiritType: element,
    costSpiritValue,
  };
}

function getWonderTechniqueName(element: SpiritRootKey): string {
  const names: Partial<Record<SpiritRootKey, string>> = {
    fire: '灵火诀', water: '水息术', wood: '长春功', metal: '金锋斩', earth: '厚土引',
    qian: '乾元劲', kun: '坤灵诀',
  };
  return names[element] ?? '无名功法';
}

export function grantWonderLoot(char: Character): {
  char: Character;
  drops: string[];
  techniqueDrop?: LearnedTechnique;
  spiritReward?: SpiritReward;
} {
  const roll = Math.random();

  // 20% 概率掉落功法
  if (roll < 0.20) {
    const tech = rollWonderTechnique();
    const spiritReward = rollWonderSpiritReward();
    const result = applySpiritAbsorption(char, spiritReward);
    return {
      char: result.char,
      drops: [],
      techniqueDrop: tech,
      spiritReward,
    };
  }

  let item: string;
  const itemRoll = Math.random();
  if (itemRoll < 0.12) {
    item = BREAKTHROUGH_ITEMS[Math.floor(Math.random() * BREAKTHROUGH_ITEMS.length)];
  } else {
    item = WONDER_ITEMS[Math.floor(Math.random() * WONDER_ITEMS.length)];
  }
  const spiritReward = rollWonderSpiritReward();
  const result = applySpiritAbsorption(char, spiritReward);
  return { char: result.char, drops: [item], spiritReward };
}

/** 战斗失败：五系灵气按比例损耗。 */
export function runRandomBattleQi(char: Character): {
  char: Character; foe: string; victory: boolean; lossFrac: number;
} {
  const foe = BATTLE_FOES[Math.floor(Math.random() * BATTLE_FOES.length)];
  const victory = Math.random() < 0.5;
  if (victory) return { char, foe, victory, lossFrac: 0 };

  const lossFrac = 0.1 + Math.random() * 0.2;
  const spiritQi = { ...char.spiritQi };
  for (const k of ELEMENT_KEYS) {
    spiritQi[k] = Math.floor(spiritQi[k] * (1 - lossFrac));
  }

  let next: Character = { ...char, spiritQi };
  next = advanceMinorRealmIfEligible(next);
  return { char: next, foe, victory, lossFrac };
}

export function rollEncounterKind(): EncounterKind {
  const r = Math.random();
  if (r < 1 / 3) return 'absorb';
  if (r < 2 / 3) return 'wonder';
  return 'battle';
}

/** 历练遭遇：随机五行灵气类型 + 基础量。 */
export function rollAbsorbEncounter(): { element: SpiritType; raw: number } {
  const element = ELEMENT_KEYS[Math.floor(Math.random() * ELEMENT_KEYS.length)];
  const raw = 1000 + Math.floor(Math.random() * 9001);
  return { element, raw };
}

export function realmDisplayLabel(realm: Realm, _realmStage: RealmStage): string {
  return realm;
}

export function getSpiritQiCapForRoot(_char: Character, _rootKey: SpiritRootKey): number {
  return getSpiritQiCap(_char.realm, _char.realmStage);
}