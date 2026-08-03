/**
 * 装备系统 → 角色系统 属性接口示例
 *
 * 展示内容：
 *   1. Stats 类型（角色属性结构）
 *   2. EquipBase 类型（装备数据结构）
 *   3. getEnhancedStats（单件装备 → 强化后属性）
 *   4. getTotalEquipmentBonus（所有槽位 → 装备加成汇总）
 *   5. calculateFinalStats（最终面板公式，含装备加成层）
 *
 * 核心设计原则：
 *   角色系统只通过 Partial<Stats> 这个「属性包」跟装备系统交互，
 *   角色系统不持有装备引用，不调用装备方法，不知道装备内部状态。
 */

// ============================================================
// 一、基础类型（与 src/types/character.ts 一致）
// ============================================================

export type StatKey = 'hp' | 'mp' | 'atk' | 'def' | 'spd' | 'wil';

export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  wil: number;
}

// ============================================================
// 二、装备类型（与 src/types/equipment.ts 一致）
// ============================================================

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
  /** 基础属性，随强化等级缩放 */
  baseStats: Partial<Stats>;
  /** 附加属性词缀，不随强化缩放 */
  affixes: Affix[];
  /** 强化等级 */
  enhanceLevel: number;
  /** 所属套装 ID（无套装则为 undefined） */
  setId?: string;
}

export interface EquippedSlots {
  weapon: EquipBase | null;
  armor: EquipBase | null;
  accessory1: EquipBase | null;
  accessory2: EquipBase | null;
  artifact: EquipBase | null;
}

// ============================================================
// 三、强化公式（与 src/systems/equipmentSystem.ts 一致）
// ============================================================

const ENHANCE_MULTIPLIER_PER_LEVEL = 0.10; // 每级 +10%

/**
 * 计算单件装备强化后的属性
 *
 * 设计要点：
 *   - baseStats 中的每项 × (1 + enhanceLevel × 0.10)
 *   - affixes 固定值附加，不参与强化缩放
 *
 * @param equip 装备实例
 * @returns 强化后的完整属性（不含套装加成）
 */
export function getEnhancedStats(equip: EquipBase): Stats {
  const multiplier = 1 + equip.enhanceLevel * ENHANCE_MULTIPLIER_PER_LEVEL;

  // 初始化全零属性
  const enhanced: Stats = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, wil: 0 };

  // 1. 基础属性 × 强化倍率
  for (const key of Object.keys(equip.baseStats) as StatKey[]) {
    enhanced[key] = (equip.baseStats[key] ?? 0) * multiplier;
  }

  // 2. 附加属性直接叠加（不缩放）
  for (const affix of equip.affixes) {
    enhanced[affix.stat] += affix.value;
  }

  return enhanced;
}

// ============================================================
// 四、装备加成汇总（接口层）
// ============================================================

/**
 * 将所有已穿戴装备的属性加成汇总为 Partial<Stats>
 *
 * 角色系统只调用此函数，得到一个 Partial<Stats>，
 * 然后直接塞进最终属性公式的 +equipmentBonus 层。
 *
 * 角色系统不知道：
 *   - 有哪些槽位
 *   - 哪些槽位穿了什么装备
 *   - 装备强化了多少级
 *   - 有没有激活套装效果
 *
 * 它只拿数字。
 *
 * @param equipped 当前穿戴的五个槽位
 * @returns 装备提供的属性加成（key-value 映射，缺失为 0）
 */
export function getTotalEquipmentBonus(equipped: EquippedSlots): Partial<Stats> {
  const bonus: Partial<Stats> = {};

  // 对每个槽位累加
  for (const slot of Object.keys(equipped) as EquipSlot[]) {
    const item = equipped[slot];
    if (!item) continue;

    const enhanced = getEnhancedStats(item); // ← 单件属性

    // 按 StatKey 累加到 bonus
    for (const key of Object.keys(enhanced) as StatKey[]) {
      bonus[key] = (bonus[key] ?? 0) + enhanced[key];
    }
  }

  // TODO: 套装加成尚未接入此处（需在 equippedSlots 层面按 setId 聚合）
  // 接入后同样是 { stat: StatKey, value: number } 的格式，
  // 与 getEnhancedStats 的输出格式完全一致，可直接合并。

  return bonus;
}

// ============================================================
// 五、角色最终属性公式（与 01-character-system.md 第二节一致）
// ============================================================

export interface RealmConfig {
  multiplier: number;
}

export const REALMS: Record<string, RealmConfig> = {
  '炼气': { multiplier: 1.0 },
  '筑基': { multiplier: 1.5 },
  '金丹': { multiplier: 2.5 },
  '元婴': { multiplier: 4.0 },
  '化神': { multiplier: 6.5 },
};

export interface WuXingGrowth {
  hp?: number;
  mp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  wil?: number;
}

export const WUXING_GROWTH: Record<string, WuXingGrowth> = {
  metal:  { atk: 1.3, spd: 1.1 },
  wood:   { hp:  1.3, mp: 1.1 },
  water:  { mp:  1.3, wil: 1.3 },
  fire:   { atk: 1.2, spd: 1.2, wil: 1.1 },
  earth:  { def: 1.3, hp:  1.1 },
};

export interface Character {
  name: string;
  level: number;
  realm: string;
  element: string;
  baseStats: Stats;
  growthRates: Stats;
  equipment: EquippedSlots;
  /** 装备子系统贡献的属性加成 */
  equipmentBonus: Partial<Stats>;
  /** 技能子系统贡献的属性加成 */
  skillBonus: Partial<Stats>;
  /** 修炼子系统贡献的属性加成 */
  cultivationBonus: Partial<Stats>;
  /** 奇遇永久加成 */
  bonusFromEvents: Partial<Stats>;
}

/**
 * 计算角色最终面板属性
 *
 * 公式：
 *   最终属性 = (baseStats + level × growthRates) × 境界倍率 × 五行倍率
 *              + equipmentBonus + skillBonus + cultivationBonus + bonusFromEvents
 *
 * 关键设计：
 *   - 装备系统通过 equipmentBonus（Partial<Stats>）接入角色系统
 *   - 角色系统不持有任何装备引用
 *   - equipmentBonus 的内部实现（强化/词缀/套装）对角色系统完全黑箱
 */
export function calculateFinalStats(char: Character): Stats {
  const result: Stats = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, wil: 0 };

  for (const key of Object.keys(result) as StatKey[]) {
    const base = char.baseStats[key] ?? 0;
    const growth = (char.growthRates[key] ?? 0) * char.level;
    const realmMult = REALMS[char.realm]?.multiplier ?? 1;
    const wuxingMult = WUXING_GROWTH[char.element]?.[key] ?? 1;

    const beforeAdd =
      (base + growth) * realmMult * wuxingMult;

    const add =
      (char.equipmentBonus[key] ?? 0) +
      (char.skillBonus[key] ?? 0) +
      (char.cultivationBonus[key] ?? 0) +
      (char.bonusFromEvents[key] ?? 0);

    result[key] = Math.round(beforeAdd + add);
  }

  return result;
}

// ============================================================
// 六、示例数据与调用
// ============================================================

const exampleCharacter: Character = {
  name: '测试角色',
  level: 15,
  realm: '筑基',
  element: 'metal',
  baseStats: { hp: 100, mp: 30, atk: 10, def: 5, spd: 10, wil: 8 },
  growthRates: { hp: 12, mp: 5, atk: 2.5, def: 2, spd: 0.3, wil: 1.0 },
  equipment: {
    weapon:    { id: 'tianlei-sword', name: '天雷剑',   slot: 'weapon',     quality: 'gold', baseStats: { atk: 80 }, affixes: [{ stat: 'wil', value: 20 }, { stat: 'spd', value: 15 }, { stat: 'hp', value: 500 }], enhanceLevel: 0, setId: 'thunder-god' },
    armor:     { id: 'xuantie-armor', name: '玄铁甲',   slot: 'armor',      quality: 'blue', baseStats: { def: 30, hp: 80 }, affixes: [{ stat: 'def', value: 5 }, { stat: 'spd', value: -2 }], enhanceLevel: 3 },
    accessory1:{ id: 'zidian-bracer', name: '紫电护腕', slot: 'accessory1', quality: 'purple', baseStats: { atk: 12, spd: 8 }, affixes: [{ stat: 'wil', value: 10 }, { stat: 'atk', value: 5 }], enhanceLevel: 0 },
    accessory2:null,
    artifact:  null,
  },
  // 这四行全部由各自子系统计算后传入，角色系统不关心来源
  equipmentBonus:    getTotalEquipmentBonus({} as EquippedSlots), // 先用空槽演示，后续会重新计算
  skillBonus:        {},
  cultivationBonus:  {},
  bonusFromEvents:   {},
};

// 正确做法：先从 equipment 计算出 equipmentBonus，再传入角色
const realEquipmentBonus = getTotalEquipmentBonus(exampleCharacter.equipment);
exampleCharacter.equipmentBonus = realEquipmentBonus;

// 对比：有无装备时的面板
const withoutEquip: Character = { ...exampleCharacter, equipmentBonus: {} };
const withEquip: Character    = exampleCharacter;

const statsWithout = calculateFinalStats(withoutEquip);
const statsWith    = calculateFinalStats(withEquip);

console.log('=== 装备加成（equipmentBonus）===');
console.table(realEquipmentBonus);

console.log('\n=== 最终面板对比（等级15/筑基/metal）===');
console.table({ 无装备: statsWithout, 有装备: statsWith });
