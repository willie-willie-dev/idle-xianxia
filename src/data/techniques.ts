/**
 * 功法数据
 *
 * 设计来源：design-docs/概览设计/05-修炼子系统.md
 *
 * 功法字段：
 * - 基础比例（float）：灵根吸收基础比例
 * - 基础固定值（int）：灵根吸收基础固定加成
 * - Bonus比例（float）：额外加成比例
 * - Bonus固定值（int）：额外加成固定值
 * - 固定开销-灵根种类（SpiritRootKey）：消耗的灵根类型
 * - 固定开销-数值（int）：对应灵根种类的消耗数值
 * - 反噬效果（object）：预留机制，暂不实现
 */

import type { SpiritRootKey } from '../types/character';
import type { TechniquePosition } from '../types/character';

/** 紫薇位（周天运转中枢）- 功法定义 */
export interface ZhouTianTechnique {
  id: string;
  /** 功法名称 */
  name: string;
  /** 所属星宿位置（对应 Character.techniqueSlots 的 key） */
  position: TechniquePosition;
  /** 五行归属 */
  element: SpiritRootKey;
  /** 基础吸收比例（灵根百分比） */
  baseRatio: number;
  /** 基础固定加成值 */
  baseFixed: number;
  /** Bonus比例（额外加成） */
  bonusRatio: number;
  /** Bonus固定值（额外加成） */
  bonusFixed: number;
  /** 固定开销-灵根种类 */
  costSpiritType: SpiritRootKey;
  /** 固定开销-数值 */
  costSpiritValue: number;
  /** 反噬效果（预留） */
  backlash?: {
    triggerCondition: string;
    effect: string;
  };
}

/** 周天运转 - 紫薇位基础功法
 *
 * 火行灵根功法：每次激活消耗30点火灵气
 * 提供灵根吸收加成和提炼效率加成
 */
export const ZHOU_TIAN_TECHNIQUE: ZhouTianTechnique = {
  id: 'zhou-tian-ziwei',
  name: '周天运转',
  position: 'ziwei',
  element: 'fire',
  /** 灵根吸收基础比例 +5% */
  baseRatio: 0.05,
  /** 基础固定加成：+0 */
  baseFixed: 0,
  /** Bonus比例：+2%（额外加成） */
  bonusRatio: 0.02,
  /** Bonus固定值：+10（额外加成） */
  bonusFixed: 10,
  /** 固定开销：火灵气 30点/次 */
  costSpiritType: 'fire',
  costSpiritValue: 30,
};

/** 周天运转 - 角宿（木行灵根功法）
 *
 * 木行灵根功法：每次激活消耗30点木灵气
 * 提供灵根吸收加成和提炼效率加成
 */
export const ZHOU_TIAN_TECHNIQUE_JIAO: ZhouTianTechnique = {
  id: 'zhou-tian-jiao',
  name: '周天运转',
  position: 'jiao',
  element: 'wood',
  /** 灵根吸收基础比例 +5% */
  baseRatio: 0.05,
  /** 基础固定加成：+0 */
  baseFixed: 0,
  /** Bonus比例：+2%（额外加成） */
  bonusRatio: 0.02,
  /** Bonus固定值：+10（额外加成） */
  bonusFixed: 10,
  /** 固定开销：木灵气 30点/次 */
  costSpiritType: 'wood',
  costSpiritValue: 30,
};

/** 周天运转 - 井宿（金行灵根功法）
 *
 * 金行灵根功法：每次激活消耗30点金灵气
 * 提供灵根吸收加成和提炼效率加成
 */
export const ZHOU_TIAN_TECHNIQUE_JING: ZhouTianTechnique = {
  id: 'zhou-tian-jing',
  name: '周天运转',
  position: 'jing',
  element: 'metal',
  /** 灵根吸收基础比例 +5% */
  baseRatio: 0.05,
  /** 基础固定加成：+0 */
  baseFixed: 0,
  /** Bonus比例：+2%（额外加成） */
  bonusRatio: 0.02,
  /** Bonus固定值：+10（额外加成） */
  bonusFixed: 10,
  /** 固定开销：金灵气 30点/次 */
  costSpiritType: 'metal',
  costSpiritValue: 30,
};

/** 周天运转 - 奎宿（土行灵根功法）
 *
 * 土行灵根功法：每次激活消耗30点土灵气
 * 提供灵根吸收加成和提炼效率加成
 */
export const ZHOU_TIAN_TECHNIQUE_KUI: ZhouTianTechnique = {
  id: 'zhou-tian-kui',
  name: '周天运转',
  position: 'kui',
  element: 'earth',
  /** 灵根吸收基础比例 +5% */
  baseRatio: 0.05,
  /** 基础固定加成：+0 */
  baseFixed: 0,
  /** Bonus比例：+2%（额外加成） */
  bonusRatio: 0.02,
  /** Bonus固定值：+10（额外加成） */
  bonusFixed: 10,
  /** 固定开销：土灵气 30点/次 */
  costSpiritType: 'earth',
  costSpiritValue: 30,
};

/** 周天运转 - 斗宿（水行灵根功法）
 *
 * 水行灵根功法：每次激活消耗30点水灵气
 * 提供灵根吸收加成和提炼效率加成
 */
export const ZHOU_TIAN_TECHNIQUE_DOU: ZhouTianTechnique = {
  id: 'zhou-tian-dou',
  name: '周天运转',
  position: 'dou',
  element: 'water',
  /** 灵根吸收基础比例 +5% */
  baseRatio: 0.05,
  /** 基础固定加成：+0 */
  baseFixed: 0,
  /** Bonus比例：+2%（额外加成） */
  bonusRatio: 0.02,
  /** Bonus固定值：+10（额外加成） */
  bonusFixed: 10,
  /** 固定开销：水灵气 30点/次 */
  costSpiritType: 'water',
  costSpiritValue: 30,
};

/** 所有周天运转功法 */
export const ZHOU_TIAN_TECHNIQUES = [
  ZHOU_TIAN_TECHNIQUE,
  ZHOU_TIAN_TECHNIQUE_JIAO,
  ZHOU_TIAN_TECHNIQUE_JING,
  ZHOU_TIAN_TECHNIQUE_KUI,
  ZHOU_TIAN_TECHNIQUE_DOU,
];