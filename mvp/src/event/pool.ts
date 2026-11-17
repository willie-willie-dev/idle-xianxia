/**
 * 事件池索引：把 `data/events.ts` 的数组整理成「按 id」与「按境界」两张表。
 *
 * 数据本身不搬文件；这一层只读、无副作用、不碰时间与存储。
 */

import { EVENTS } from '../data/events.ts';
import type { Realm } from '../types.ts';
import type { EventPoolQuery, GameEvent } from './types.ts';

/** 事件池查询接口。 */
export interface EventPool {
  /** 事件总数。 */
  readonly size: number;
  /** 全部事件，保持 `data/events.ts` 里的顺序。 */
  all(): readonly GameEvent[];
  /** 按 id 取；未知 id 返回 null。 */
  byId(id: string): GameEvent | null;
  /** 某境界的全部事件（池内顺序）。 */
  byRealm(realm: Realm): readonly GameEvent[];
  /** 某境界里还没做过的事件（`doneIds` 之外的）。 */
  eligible(query: EventPoolQuery): GameEvent[];
}

/**
 * 用给定事件数组建索引。
 *
 * id 重复会直接抛错 —— 事件 id 是 `doneIds` 与掉落来源的唯一键，不能撞。
 */
export function createEventPool(events: readonly GameEvent[] = EVENTS): EventPool {
  const all = [...events];
  const byIdIndex = new Map<string, GameEvent>();
  const byRealmIndex = new Map<Realm, GameEvent[]>();

  for (const event of all) {
    if (byIdIndex.has(event.id)) {
      throw new Error(`事件 id 重复：${event.id}`);
    }
    byIdIndex.set(event.id, event);
    const bucket = byRealmIndex.get(event.realm);
    if (bucket === undefined) {
      byRealmIndex.set(event.realm, [event]);
    } else {
      bucket.push(event);
    }
  }

  return {
    size: all.length,
    all: () => all,
    byId: (id) => byIdIndex.get(id) ?? null,
    byRealm: (realm) => byRealmIndex.get(realm) ?? [],
    eligible(query) {
      const doneIds = query.doneIds ?? [];
      return (byRealmIndex.get(query.realm) ?? []).filter(
        (event) => !doneIds.includes(event.id),
      );
    },
  };
}

/** 默认事件池（来自 `data/events.ts`，24 条）。 */
export const eventPool: EventPool = createEventPool(EVENTS);
