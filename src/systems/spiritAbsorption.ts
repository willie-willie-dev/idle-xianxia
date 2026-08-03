import type { Character } from '../types';
import type { SpiritReward } from '../types/event';
import { ELEMENT_KEYS, type SpiritType } from '../types/character';
import { getSpiritQiCap, advanceMinorRealmIfEligible } from './cultivationSystem';

export interface AbsorbResult {
  absorbed: Record<SpiritType, number>;
  overflowLost: number;
}

/**
 * 遭遇中的 spiritReward 为固定灵气量（已由策划配表），直接使用整数值结算。
 * 乾/坤字段在 spiritReward 中被忽略——它们只作为角色自身灵根的增幅/缩减系数。
 */
export function applyEventReward(
  _char: Character,
  spiritReward: SpiritReward,
): SpiritReward {
  const result: SpiritReward = {};
  for (const [key, value] of Object.entries(spiritReward)) {
    if (value !== undefined && value !== 0) {
      (result as Record<string, number>)[key] = Math.floor(Number(value));
    }
  }
  return result;
}

/**
 * 根据角色灵根配比，从原始灵气奖励中计算出实际吸收量。
 *
 * 规则：
 * - 灵气只有五行（fire/water/wood/metal/earth），乾/坤不存储灵气
 * - 乾灵根：所有五行灵气吸收量 × (1 + 乾%)
 * - 坤灵根：所有五行灵气吸收量 × (1 − 坤%)
 * - 公式：actual = raw × (1 + qian/100) × (1 − kun/100)
 * - 吸收上限：单系灵气槽上限 = getSpiritQiCap(当前境界)
 */
export function absorbSpiritReward(
  rawReward: SpiritReward,
  char: Character,
): AbsorbResult {
  const qianPct = Math.max(0, Math.min(100, char.spiritRoots['qian'] ?? 0)) / 100;
  const kunPct = Math.max(0, Math.min(100, char.spiritRoots['kun'] ?? 0)) / 100;

  const absorbed: Record<SpiritType, number> = {
    fire: 0, water: 0, wood: 0, metal: 0, earth: 0,
  };

  let totalOverflow = 0;

  for (const key of ELEMENT_KEYS) {
    const raw = rawReward[key] ?? 0;
    const multiplier = (1 + qianPct) * (1 - kunPct);
    const rawAbsorbed = raw * multiplier;

    const cap = getSpiritQiCap(char.realm, char.realmStage);
    const current = char.spiritQi[key];
    const room = Math.max(0, cap - current);

    const overflow = Math.max(0, rawAbsorbed - room);
    absorbed[key] = rawAbsorbed - overflow;
    totalOverflow += overflow;
  }

  return { absorbed, overflowLost: totalOverflow };
}

/**
 * 将吸收结果应用到角色身上，返回更新后的角色。
 * 超上限部分散失。
 */
export function applySpiritAbsorptionFromReward(
  char: Character,
  rawReward: SpiritReward,
): { char: Character; result: AbsorbResult } {
  const result = absorbSpiritReward(rawReward, char);
  const spiritQi = { ...char.spiritQi };

  for (const k of ELEMENT_KEYS) {
    spiritQi[k] = Math.floor(spiritQi[k] + result.absorbed[k]);
  }

  let next = { ...char, spiritQi };
  next = advanceMinorRealmIfEligible(next);

  return { char: next, result };
}

/** 生成日志描述（用于遭遇结算显示） */
export function describeSpiritAbsorption(result: AbsorbResult): string[] {
  const parts: string[] = [];
  for (const k of ELEMENT_KEYS) {
    if (result.absorbed[k] > 0) parts.push(`${k} +${Math.floor(result.absorbed[k])}`);
  }
  if (result.overflowLost > 1) parts.push(`溢出散失 ${Math.round(result.overflowLost)}`);
  return parts;
}