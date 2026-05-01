import type { Stats, StatKey, EquipBase, EquippedSlots, Quality } from '../types';
import { QUALITY_WEIGHTS, QUALITY_MULTIPLIER, EQUIPMENT_DATA } from '../data/equipment';

export function getEnhancedStats(equip: EquipBase): Partial<Stats> {
  const factor = 1 + equip.enhanceLevel * 0.10;
  const enhanced: Partial<Stats> = {};
  const keys = Object.keys(equip.baseStats) as StatKey[];
  for (const k of keys) {
    enhanced[k] = (equip.baseStats[k] ?? 0) * factor;
  }
  for (const a of equip.affixes) {
    enhanced[a.stat] = (enhanced[a.stat] ?? 0) + a.value;
  }
  return enhanced;
}

export function getTotalEquipmentBonus(slots: EquippedSlots): Partial<Stats> {
  const total: Partial<Stats> = {};
  const all = [slots.weapon, slots.armor, slots.accessory1, slots.accessory2, slots.artifact];
  for (const eq of all) {
    if (!eq) continue;
    const stats = getEnhancedStats(eq);
    for (const k of Object.keys(stats) as StatKey[]) {
      total[k] = (total[k] ?? 0) + (stats[k] ?? 0);
    }
  }
  return total;
}

export function enhanceCost(equip: EquipBase): number {
  return equip.enhanceLevel * 1000 * (QUALITY_MULTIPLIER[equip.quality] ?? 1);
}

export function enhance(equip: EquipBase): EquipBase {
  return { ...equip, enhanceLevel: equip.enhanceLevel + 1 };
}

export function rollDrop(monsterLevel: number): EquipBase | null {
  const qualities: Quality[] = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
  const weights = qualities.map(q => (QUALITY_WEIGHTS[q] ?? 0) * (1 + monsterLevel * 0.01));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let chosen: Quality = 'white';
  for (let i = 0; i < qualities.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosen = qualities[i]; break; }
  }
  const pool = EQUIPMENT_DATA.filter(e => e.quality === chosen);
  if (pool.length === 0) return null;
  const base = pool[Math.floor(Math.random() * pool.length)];
  return { ...base, id: `${base.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, enhanceLevel: 0 };
}
