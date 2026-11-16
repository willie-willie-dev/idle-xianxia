/**
 * 《登仙·MVP》灵地数据。
 *
 * 结构直接用 `systems/absorb.ts` 的 `Location`，吸收函数与数据同源。
 */

import type { Location } from '../systems/absorb.ts';

/** 火山：火 200 + 土 30（Issue #3 用例）。 */
export const VOLCANO: Location = {
  id: 'volcano',
  name: '火山',
  spirits: [
    { type: '火', amount: 200 },
    { type: '土', amount: 30 },
  ],
};

/** 灵泉：水 200 + 木 50。 */
export const SPIRIT_SPRING: Location = {
  id: 'spirit-spring',
  name: '灵泉',
  spirits: [
    { type: '水', amount: 200 },
    { type: '木', amount: 50 },
  ],
};

/** 全部灵地。 */
export const LOCATIONS: readonly Location[] = [VOLCANO, SPIRIT_SPRING];

/** 缺省灵地：火山。 */
export const DEFAULT_LOCATION_ID = VOLCANO.id;

/** 按 id 取灵地；找不到时回落到缺省灵地。 */
export function findLocation(id: string | undefined): Location {
  if (id !== undefined) {
    const hit = LOCATIONS.find((location) => location.id === id);
    if (hit !== undefined) return hit;
  }
  return VOLCANO;
}
