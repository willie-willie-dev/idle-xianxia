/**
 * 《登仙·最小可玩循环》第 1 步：灵气吸收纯函数。
 *
 * 纯计算，无副作用、无 I/O、不读时间、不读文件、不随机：
 * 相同输入永远得到相同输出。
 */

/** 灵根，值为百分比（合计 100）。 */
export interface Roots {
  fire: number;
  water: number;
  wood: number;
  metal: number;
  earth: number;
  qian: number;
  kun: number;
}

/** 五行灵气属性。 */
export type SpiritType = '火' | '水' | '木' | '金' | '土';

export interface Spirit {
  type: SpiritType;
  amount: number;
}

export interface Location {
  id: string;
  name: string;
  spirits: Spirit[];
}

/** 功法参数，例如 { absorbRate: 0.4, convertRate: 0.3 }。 */
export interface Technique {
  absorbRate: number;
  convertRate: number;
}

export interface AbsorbResult {
  /** 每个通道的入池量（尚未乘以 absorbRate），键与 Roots 的通道名一致。 */
  absorbed: Record<string, number>;
  /** 入池总量，即所有通道入池之和乘以 absorbRate。 */
  totalAbsorbed: number;
  /** 转出的修为，即 totalAbsorbed 乘以 convertRate。 */
  cultivationGain: number;
}

/** 五行属性 -> 对应灵根通道。 */
const ELEMENT_CHANNEL: Record<SpiritType, keyof Roots> = {
  火: 'fire',
  水: 'water',
  木: 'wood',
  金: 'metal',
  土: 'earth',
};

/** 灵根百分比换算为系数（30 -> 0.3）。 */
const PERCENT = 100;

/** 乾通道对所有灵气类型的加成系数。 */
const QIAN_MULTIPLIER = 1.5;

/** 坤通道对所有灵气类型的加成系数（只乘一次）。 */
const KUN_MULTIPLIER = 0.1;

/**
 * 计算一个地点的灵气吸收结果。
 *
 * 对每种灵气（amount = A）：
 * - 五行通道：仅当灵气属性与灵根属性相同时，入池 = A × roots[对应五行]；
 * - 乾通道：入池 = A × roots.qian × 1.5，对所有灵气类型都算；
 * - 坤通道：入池 = A × roots.kun × 0.1，对所有灵气类型都算，且只乘一次。
 *
 * totalAbsorbed = 所有通道入池之和 × technique.absorbRate；
 * cultivationGain = totalAbsorbed × technique.convertRate。
 */
export function absorb(
  location: Location,
  roots: Roots,
  technique: Technique,
): AbsorbResult {
  const absorbed: Record<keyof Roots, number> = {
    fire: 0,
    water: 0,
    wood: 0,
    metal: 0,
    earth: 0,
    qian: 0,
    kun: 0,
  };

  for (const spirit of location.spirits) {
    const amount = spirit.amount;
    const elementChannel = ELEMENT_CHANNEL[spirit.type];

    if (elementChannel !== undefined) {
      absorbed[elementChannel] += amount * (roots[elementChannel] / PERCENT);
    }

    absorbed.qian += amount * (roots.qian / PERCENT) * QIAN_MULTIPLIER;
    absorbed.kun += amount * (roots.kun / PERCENT) * KUN_MULTIPLIER;
  }

  const channelTotal = Object.values(absorbed).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalAbsorbed = channelTotal * technique.absorbRate;
  const cultivationGain = totalAbsorbed * technique.convertRate;

  return { absorbed, totalAbsorbed, cultivationGain };
}
