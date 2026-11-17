/**
 * 兼容转发层：旧 import 路径（`systems/event.ts`）保留，避免一次性改爆。
 *
 * 新代码请直接用 `src/event/`：
 * - 纯函数：`event/picker.ts` / `event/resolver.ts` / `event/pool.ts`
 * - 服务：`event/index.ts` 的 `createEventSystem()`
 *
 * 这里只做 re-export，不写任何逻辑。
 */

export {
  applyOption,
  createEventPool,
  createEventSystem,
  eligibleEvents,
  eventPool,
  pickEvent,
} from '../event/index.ts';
export type { EventPool } from '../event/index.ts';
export type {
  EventOption,
  EventPoolQuery,
  GameEvent,
  PickEventInput,
  PickEventResult,
  PickResult,
  ResolveResult,
} from '../event/types.ts';
