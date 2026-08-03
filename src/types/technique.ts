import type { SpiritRootKey } from './character';

export interface LearnedTechnique {
  /** 功法唯一实例ID */
  instanceId: string;
  /** 功法定义ID（暂时固定为 'wonder-drop'） */
  techniqueId: string;
  /** 功法名称 */
  name: string;
  /** 五行归属 */
  element: SpiritRootKey;
  /** 基础吸收比例 */
  baseRatio: number;
  /** 基础固定加成 */
  baseFixed: number;
  /** Bonus比例 */
  bonusRatio: number;
  /** Bonus固定值 */
  bonusFixed: number;
  /** 固定开销-灵根种类 */
  costSpiritType: SpiritRootKey;
  /** 固定开销-数值 */
  costSpiritValue: number;
}

// ── 行囊 key 工具函数 ────────────────────────────────────────
/** 生成功法在行囊(inventory)中的 key。格式: `📖 <name>*<instanceId>` */
export function techniqueInventoryKey(tech: LearnedTechnique): string {
  return `📖 ${tech.name}*${tech.instanceId}`;
}

/** 从行囊 key 反解 instanceId。格式: `📖 <name>*<instanceId>` */
export function instanceIdFromTechniqueInventoryKey(key: string): string | null {
  const idx = key.lastIndexOf('*');
  if (idx < 0 || !key.startsWith('📖 ')) return null;
  return key.slice(idx + 1);
}