/**
 * 装备 ↔ 角色 属性接口 · 双向联动示样板
 *
 * 展示内容：
 *   - 装备 → 角色：getTotalEquipmentBonus() 提供属性加成
 *   - 角色 → 装备：当角色状态变化时，装备响应（失效/卸下/激活）
 *
 * 核心设计原则：
 *   角色和装备通过「属性状态」而非「直接引用」进行联动。
 *   双方都只读写「属性包」，不直接修改对方内部状态。
 */

// ============================================================
// 一、基础类型
// ============================================================

export type StatKey = 'hp' | 'mp' | 'atk' | 'def' | 'spd' | 'wil';
export type Realm   = '炼气' | '筑基' | '金丹' | '元婴' | '化神';
export type WuXing  = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export interface Stats {
  hp: number; mp: number; atk: number; def: number; spd: number; wil: number;
}

export type EquipSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2' | 'artifact';
export type Quality   = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red';

export interface Affix { stat: StatKey; value: number; }

export interface EquipBase {
  id: string;
  name: string;
  slot: EquipSlot;
  quality: Quality;
  baseStats: Partial<Stats>;
  affixes: Affix[];
  enhanceLevel: number;
  setId?: string;
  /** 装备是否当前生效（死亡/损坏/不满足条件时置 false） */
  active: boolean;
  /** 装备要求的最低境界（无要求则为 undefined） */
  minRealm?: Realm;
}

export interface EquippedSlots {
  weapon: EquipBase | null;
  armor: EquipBase | null;
  accessory1: EquipBase | null;
  accessory2: EquipBase | null;
  artifact: EquipBase | null;
}

// ============================================================
// 二、角色类型
// ============================================================

export interface Character {
  name: string;
  level: number;
  realm: Realm;
  element: WuXing;
  baseStats: Stats;
  growthRates: Stats;
  /** 角色当前是否存活（死亡时装备部分失效） */
  alive: boolean;
  equipment: EquippedSlots;
  equipmentBonus: Partial<Stats>;
  skillBonus: Partial<Stats>;
  cultivationBonus: Partial<Stats>;
  bonusFromEvents: Partial<Stats>;
}

// ============================================================
// 三、装备 → 角色：计算属性加成
// ============================================================

/** 单件装备强化后属性 */
function getEnhancedStats(equip: EquipBase): Stats {
  const mult = 1 + equip.enhanceLevel * 0.10;
  const enhanced: Stats = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, wil: 0 };
  for (const k of Object.keys(equip.baseStats) as StatKey[]) {
    enhanced[k] = (equip.baseStats[k] ?? 0) * mult;
  }
  for (const a of equip.affixes) {
    enhanced[a.stat] += a.value;
  }
  return enhanced;
}

/**
 * 汇总所有已装备物品的属性加成
 * 仅统计 active === true 的装备
 */
export function getTotalEquipmentBonus(equipped: EquippedSlots): Partial<Stats> {
  const bonus: Partial<Stats> = {};
  for (const slot of Object.keys(equipped) as EquipSlot[]) {
    const item = equipped[slot];
    if (!item || !item.active) continue; // ← 角色死亡时 active=false，加成消失
    const enhanced = getEnhancedStats(item);
    for (const k of Object.keys(enhanced) as StatKey[]) {
      bonus[k] = (bonus[k] ?? 0) + enhanced[k];
    }
  }
  return bonus;
}

// ============================================================
// 四、角色 → 装备：状态变化驱动装备响应
// ============================================================

const REALM_ORDER: Realm[] = ['炼气', '筑基', '金丹', '元婴', '化神'];

function realmLevel(r: Realm): number {
  return REALM_ORDER.indexOf(r);
}

/**
 * 当角色状态变化时，更新所有装备的 active 状态
 * 这是「角色 → 装备」方向通过属性接口联动
 *
 * 触发场景：
 *   1. 角色死亡/复活 → 装备 active 切换
 *   2. 角色境界变化 → 低于 minRealm 的装备自动卸下
 *   3. 角色转五行 → 某些套装效果需要重新校验
 */
export function syncEquipmentFromCharacter(character: Character): void {
  for (const slot of Object.keys(character.equipment) as EquipSlot[]) {
    const item = character.equipment[slot];
    if (!item) continue;

    // --- 方向一：角色死亡 → 装备失效 ---
    // 角色死亡时，所有装备暂时失效（但不清空，依然穿在身上）
    if (!character.alive) {
      if (item.active !== false) {
        item.active = false;
        console.log(`[联动] ${character.name} 死亡，${item.name} 效果暂停`);
      }
      continue;
    }

    // --- 方向二：角色复活 → 装备恢复 ---
    if (character.alive && item.active === false) {
      // 检查是否满足其他条件（境界要求等）再恢复
      const realmOk = !item.minRealm || realmLevel(character.realm) >= realmLevel(item.minRealm);
      if (realmOk) {
        item.active = true;
        console.log(`[联动] ${character.name} 复活，${item.name} 效果恢复`);
      } else {
        // 境界仍然不足，保持失效
        console.log(`[联动] ${character.name} 复活，但 ${item.name} 因境界不足仍失效`);
      }
    }

    // --- 方向三：角色境界下降（被压制）→ 不满足 minRealm 的装备卸下 ---
    if (item.minRealm && realmLevel(character.realm) < realmLevel(item.minRealm)) {
      console.log(`[联动] ${character.name} 境界跌落至${character.realm}，` +
                  `${item.name}（要求${item.minRealm}）自动卸下`);
      character.equipment[slot] = null; // 直接清空槽位
    }
  }
}

/**
 * 当装备变化时（穿上/强化/卸下），重新计算角色属性
 * 这是「装备 → 角色」方向，注入新的 equipmentBonus
 */
export function syncCharacterFromEquipment(character: Character): void {
  character.equipmentBonus = getTotalEquipmentBonus(character.equipment);
}

// ============================================================
// 五、完整联动流程演示
// ============================================================

function makeCharacter(): Character {
  return {
    name: '测试弟子',
    level: 20,
    realm: '筑基',
    element: 'metal',
    baseStats:  { hp: 100, mp: 30, atk: 10, def: 5, spd: 10, wil: 8 },
    growthRates:{ hp: 12,  mp: 5,  atk: 2.5, def: 2, spd: 0.3, wil: 1.0 },
    alive: true,
    equipment: {
      // 天雷剑要求金丹才能使用（演示境界不足的情况）
      weapon:    { id: 'tianlei-sword', name: '天雷剑',   slot: 'weapon',     quality: 'gold', baseStats: { atk: 80 }, affixes: [{ stat: 'wil', value: 20 }, { stat: 'spd', value: 15 }, { stat: 'hp', value: 500 }], enhanceLevel: 0, active: true, minRealm: '金丹' },
      armor:     { id: 'xuantie-armor', name: '玄铁甲',   slot: 'armor',      quality: 'blue', baseStats: { def: 30, hp: 80 }, affixes: [{ stat: 'def', value: 5 }, { stat: 'spd', value: -2 }], enhanceLevel: 3, active: true },
      accessory1:{ id: 'zidian-bracer', name: '紫电护腕', slot: 'accessory1', quality: 'purple', baseStats: { atk: 12, spd: 8 }, affixes: [{ stat: 'wil', value: 10 }, { stat: 'atk', value: 5 }], enhanceLevel: 0, active: true },
      accessory2:null,
      artifact:  null,
    },
    equipmentBonus:    {},
    skillBonus:        {},
    cultivationBonus:  {},
    bonusFromEvents:   {},
  };
}

function calcAndPrint(char: Character, label: string) {
  syncCharacterFromEquipment(char);
  const b = char.equipmentBonus;
  const hp  = (char.baseStats.hp  + char.level * char.growthRates.hp)  * 1.5 + (b.hp  ?? 0);
  const atk = (char.baseStats.atk + char.level * char.growthRates.atk) * 1.5 * 1.3 + (b.atk ?? 0);
  const def = (char.baseStats.def + char.level * char.growthRates.def) * 1.5 + (b.def ?? 0);
  console.log(`${label} → HP: ${Math.round(hp)}  ATK: ${Math.round(atk)}  DEF: ${Math.round(def)}  装备加成: hp=${b.hp??0} atk=${b.atk??0} def=${b.def??0}`);
  return { hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def) };
}

// ─── 场景一：正常状态 ───
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【场景一】正常状态（筑基/存活）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const char1 = makeCharacter();
calcAndPrint(char1, '  ');

// ─── 场景二：角色死亡 → 装备失效 ───
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【场景二】角色死亡 → 装备效果暂停');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const char2 = makeCharacter();
syncCharacterFromEquipment(char2);
console.log('死亡前装备加成：', char2.equipmentBonus);
char2.alive = false;
syncEquipmentFromCharacter(char2);     // ← 角色死亡驱动装备响应
syncCharacterFromEquipment(char2);     // ← 重新计算（active=false 的装备不计入）
console.log('死亡后装备加成：', char2.equipmentBonus);

// ─── 场景三：角色复活 → 装备恢复 ───
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【场景三】角色复活 → 装备效果恢复（境界满足）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const char3 = makeCharacter();
char3.alive = false;
syncEquipmentFromCharacter(char3);
syncCharacterFromEquipment(char3);
console.log('死亡期间装备加成：', char3.equipmentBonus);
char3.alive = true;
syncEquipmentFromCharacter(char3); // ← 角色复活驱动装备检查
syncCharacterFromEquipment(char3);
console.log('复活后装备加成：', char3.equipmentBonus);

// ─── 场景四：境界下降 → 装备自动卸下 ───
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【场景四】境界下降至炼气 → 天雷剑（要求金丹）自动卸下');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const char4 = makeCharacter();
syncCharacterFromEquipment(char4);
console.log('卸下前装备加成：', char4.equipmentBonus);
char4.realm = '炼气';  // 境界被打落
syncEquipmentFromCharacter(char4);  // ← 境界变化驱动装备检查
syncCharacterFromEquipment(char4);
console.log('卸下后装备加成：', char4.equipmentBonus);
console.log('当前穿戴：', char4.equipment);
