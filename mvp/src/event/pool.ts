/**
 * 事件池索引：把奇遇（`data/events.ts`）与日常（`data/daily-events.ts`）
 * 合并成「按 id」「按境界」与「按境界+阶位」三张表。
 *
 * 数据本身不搬文件；这一层只读、无副作用、不碰时间与存储。
 */

import { DAILY_EVENTS } from '../data/daily-events.ts';
import { EVENTS } from '../data/events.ts';
import type { Realm } from '../types.ts';
import type { EventPoolQuery, GameEvent } from './types.ts';

/** 默认源：奇遇在前，日常在后，各自保持数据文件里的顺序。 */
const SOURCE_EVENTS: readonly GameEvent[] = [...EVENTS, ...DAILY_EVENTS];

/** 按类别取某境界、某阶位的全部事件。 */
export interface ByKindQuery {
  realm: Realm;
  stage: GameEvent['stage'];
  kind: GameEvent['kind'];
}

/** 事件池查询接口。 */
export interface EventPool {
  /** 事件总数。 */
  readonly size: number;
  /** 全部事件，保持合并后的顺序（奇遇在前，日常在后）。 */
  all(): readonly GameEvent[];
  /** 全部事件，与 `all()` 相同。 */
  list(): readonly GameEvent[];
  /** 按 id 取；未知 id 返回 null。 */
  byId(id: string): GameEvent | null;
  /** 某境界的全部事件（池内顺序）。 */
  byRealm(realm: Realm): readonly GameEvent[];
  /** 某境界、某阶位的全部事件（池内顺序）。 */
  byRealmStage(realm: Realm, stage: GameEvent['stage']): readonly GameEvent[];
  /** 某境界、某阶位里还没做过的事件（`doneIds` 之外的）。 */
  eligible(query: EventPoolQuery & { stage: GameEvent['stage'] }): GameEvent[];
  /** 某境界、某阶位、某类别的全部事件（池内顺序）。 */
  byKind(query: ByKindQuery): readonly GameEvent[];
}

/**
 * 用给定事件数组建索引。
 *
 * id 重复会直接抛错 —— 事件 id 是 `doneIds` 与掉落来源的唯一键，不能撞。
 * 缺省合并奇遇与日常。
 */
export function createEventPool(
  events: readonly GameEvent[] = SOURCE_EVENTS,
): EventPool {
  const all = [...events];
  const byIdIndex = new Map<string, GameEvent>();
  const byRealmIndex = new Map<Realm, GameEvent[]>();
  const byRealmStageIndex = new Map<Realm, Map<GameEvent['stage'], GameEvent[]>>();

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
    let stageMap = byRealmStageIndex.get(event.realm);
    if (stageMap === undefined) {
      stageMap = new Map();
      byRealmStageIndex.set(event.realm, stageMap);
    }
    const stageBucket = stageMap.get(event.stage);
    if (stageBucket === undefined) {
      stageMap.set(event.stage, [event]);
    } else {
      stageBucket.push(event);
    }
  }

  return {
    size: all.length,
    all: () => all,
    list: () => all,
    byId: (id) => byIdIndex.get(id) ?? null,
    byRealm: (realm) => byRealmIndex.get(realm) ?? [],
    byRealmStage: (realm, stage) => byRealmStageIndex.get(realm)?.get(stage) ?? [],
    eligible(query) {
      const doneIds = query.doneIds ?? [];
      return (byRealmStageIndex.get(query.realm)?.get(query.stage) ?? []).filter(
        (event) => !doneIds.includes(event.id),
      );
    },
    byKind(query) {
      return (byRealmStageIndex.get(query.realm)?.get(query.stage) ?? []).filter(
        (event) => event.kind === query.kind,
      );
    },
  };
}

/** 默认事件池（奇遇 24 条 + 日常 9 条）。 */
export const eventPool: EventPool = createEventPool();
