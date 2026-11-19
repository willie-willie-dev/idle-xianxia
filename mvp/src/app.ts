/**
 * 应用层：把「读档 → 领域函数 → 写档」编排成一次操作。
 *
 * 这里不含规则（规则在 `systems/`）、不含 DOM（在 `ui/`）、不含存储细节
 * （在 `storage/`）。UI 每点一下按钮，调用这里的一个方法。
 */

import {
  ABSORB_STAMINA_COST,
  ACTION_DAYS,
  POJING_ITEM_ID,
  REST_DAYS,
  REST_STAMINA_GAIN,
  assertTechniqueSlot,
  findTechnique,
  nextStageOf,
  techniqueById,
} from './data/balance.ts';
import type { TechniqueDef } from './data/balance.ts';
import { DEFAULT_LOCATION_ID, LOCATIONS, findLocation } from './data/locations.ts';
import { createEventSystem } from './event/index.ts';
import type { EventSystem } from './event/index.ts';
import { IndexedDbCharacterRepository } from './storage/indexeddb.ts';
import { MemoryCharacterRepository } from './storage/repository.ts';
import type { CharacterRepository } from './storage/repository.ts';
import { absorb } from './systems/absorb.ts';
import type { AbsorbResult, Location } from './systems/absorb.ts';
import { tryBreakthrough } from './systems/breakthrough.ts';
import type { BreakthroughResult } from './types.ts';
import { useConsumable } from './systems/consumables.ts';
import type { ConsumableEffect } from './systems/consumables.ts';
import { cultivate } from './systems/cultivate.ts';
import {
  activeTechnique,
  addItem,
  equip,
  findItemByUid,
  hasTechnique,
} from './systems/inventory.ts';
import { nextSeed } from './systems/rng.ts';
import { canAbsorb, restoreStamina, spendStamina } from './systems/stamina.ts';
import { createTimeService } from './time/time-service.ts';
import type { TimeService } from './time/time-service.ts';
import type {
  CharacterSummary,
  GameEvent,
  InventoryItem,
  MvpCharacter,
  OptionOutcome,
} from './types.ts';

/** 一次吸收的回报（含 UI 明细用的灵气入池量，不入存档）。 */
export interface AbsorbTurn {
  character: MvpCharacter;
  /** 无功法时不计算灵气入池，为 null。 */
  absorption: AbsorbResult | null;
  /** 本次名义产出（未封顶前）；被功法门禁挡住时为 0。 */
  gain: number;
  /** 是否被修为上限截断。 */
  capped: boolean;
  /** 当前生效槽位没有功法，或体力不够：修为 +0、不推进时间。 */
  blocked: boolean;
  /** 被挡住的原因。无功法为 technique，体力不够为 stamina。 */
  blockedReason?: 'technique' | 'stamina';
}

/** 一次打坐的回报。`gained` 是实际回复的体力（不超过上限）。 */
export interface RestTurn {
  character: MvpCharacter;
  gained: number;
}

/** 使用一件消耗品的回报。 */
export interface UseItemTurn {
  character: MvpCharacter;
  effect: ConsumableEffect;
}

/** 一次突破的回报。 */
export interface BreakthroughTurn {
  character: MvpCharacter;
  result: BreakthroughResult;
  /** 没有破境丹：本次不结算、不写档。 */
  blocked?: boolean;
}

/** 一次抽事件的回报。`event === null` 表示本境界本阶位已历练完。 */
export interface DrawEventTurn {
  character: MvpCharacter;
  event: GameEvent | null;
}

/** 一次事件结算的回报。 */
export interface EventTurn {
  character: MvpCharacter;
  outcome: OptionOutcome;
  event: GameEvent;
  /** 本次新进背包的功法（重复获得的不在这里）。 */
  granted: InventoryItem[];
  /** 本次重复获得、已被忽略的功法 id。 */
  duplicates: string[];
  /** 本次扣除的体力。 */
  staminaCost: number;
  /** 本次进入背包的消耗品 id（同一 id 可重复出现，表示继续堆叠）。 */
  grantedItems: string[];
}

export interface GameApp {
  readonly locations: readonly Location[];
  list(): Promise<CharacterSummary[]>;
  getActiveId(): Promise<string | null>;
  create(name: string): Promise<MvpCharacter>;
  enter(id: string): Promise<MvpCharacter>;
  resume(): Promise<MvpCharacter | null>;
  leave(): Promise<void>;
  current(): MvpCharacter | null;
  absorb(locationId?: string): Promise<AbsorbTurn>;
  /** 打坐：时间前进，回复体力。不修炼、不推进种子。 */
  rest(): Promise<RestTurn>;
  /** 使用背包里的一件消耗品（按 uid）。 */
  useItem(uid: string): Promise<UseItemTurn>;
  breakthrough(): Promise<BreakthroughTurn>;
  drawEvent(): Promise<DrawEventTurn>;
  resolveEvent(event: GameEvent, optionIndex: number): Promise<EventTurn>;
  /** 切换生效功法槽位（0 / 1 / 2），吸收立即改用新功法。 */
  setActiveSlot(index: number): Promise<MvpCharacter>;
  /** 把背包里的一条物品（按 uid）装备到指定槽位。 */
  equipTechnique(slot: number, itemUid: string): Promise<MvpCharacter>;
  /** 把第 slot 槽换成功法库里的某条（必须已拥有；未知 id / 越界抛错）。 */
  setSlotTechnique(slot: number, techniqueId: string): Promise<MvpCharacter>;
  /** 当前已拥有的功法（按背包顺序，含库外脏数据已过滤）。 */
  ownedTechniques(): readonly TechniqueDef[];
  /** 当前背包条目的副本。 */
  inventory(): InventoryItem[];
  remove(id: string): Promise<void>;
}

/** 背包里破境丹的枚数（同 id 的多条堆叠合计）。 */
function poJingCount(character: MvpCharacter): number {
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  let total = 0;
  for (const item of inventory) {
    if (item.kind !== 'consumable' || item.itemId !== POJING_ITEM_ID) continue;
    const count = Number.isFinite(item.count) ? item.count : 0;
    if (count > 0) total += count;
  }
  return total;
}

/** 背包里是否还有至少一枚破境丹。 */
function hasPoJing(character: MvpCharacter): boolean {
  return poJingCount(character) > 0;
}

/** 从背包扣 1 枚破境丹；减到 0 则移除该条。 */
function consumePoJing(inventory: InventoryItem[]): InventoryItem[] {
  const next = inventory.map((item) => ({ ...item }));
  const index = next.findIndex(
    (entry) =>
      entry.kind === 'consumable' &&
      entry.itemId === POJING_ITEM_ID &&
      entry.count > 0,
  );
  if (index < 0) return next;
  const current = next[index];
  if (current.kind !== 'consumable') return next;
  if (current.count <= 1) {
    next.splice(index, 1);
  } else {
    next[index] = { ...current, count: current.count - 1 };
  }
  return next;
}

/** 修为达到阈值、还没到顶阶、且持有破境丹时，才可以点突破。 */
export function canBreakthrough(character: MvpCharacter): boolean {
  return (
    nextStageOf(character.realm, character.stage) !== null &&
    character.cultivation >= character.nextThreshold &&
    hasPoJing(character)
  );
}

class GameAppImpl implements GameApp {
  readonly locations: readonly Location[] = LOCATIONS;
  #repo: CharacterRepository;
  #time: TimeService;
  #events: EventSystem;
  #character: MvpCharacter | null = null;

  constructor(repo: CharacterRepository) {
    this.#repo = repo;
    this.#time = createTimeService();
    this.#events = createEventSystem();
  }

  async list(): Promise<CharacterSummary[]> {
    return this.#repo.list();
  }

  async getActiveId(): Promise<string | null> {
    return this.#repo.getActiveId();
  }

  async create(name: string): Promise<MvpCharacter> {
    const character = await this.#repo.create({ name });
    await this.#repo.setActiveId(character.id);
    this.#character = character;
    return character;
  }

  async enter(id: string): Promise<MvpCharacter> {
    const character = await this.#repo.get(id);
    if (character === null) throw new Error(`角色不存在：${id}`);
    await this.#repo.setActiveId(id);
    this.#character = character;
    return character;
  }

  /** 刷新页面后按 activeId 自动回到上次的角色。 */
  async resume(): Promise<MvpCharacter | null> {
    const activeId = await this.#repo.getActiveId();
    if (activeId === null) return null;
    const character = await this.#repo.get(activeId);
    if (character === null) {
      await this.#repo.setActiveId(null);
      return null;
    }
    this.#character = character;
    return character;
  }

  async leave(): Promise<void> {
    await this.#repo.setActiveId(null);
    this.#character = null;
  }

  current(): MvpCharacter | null {
    return this.#character;
  }

  async #require(): Promise<MvpCharacter> {
    if (this.#character === null) throw new Error('还没有进入任何角色');
    return this.#character;
  }

  /**
   * 吸收一次：灵气 → 修为（R1=A，灵气池只做 UI 明细）。
   *
   * 当前生效槽位没有功法时：修为 +0、不推进时间、不推进种子 ——
   * 「无功法不消耗」。
   * 体力不够支付吸收消耗时同样不推进时间、不推进种子。
   */
  async absorb(locationId?: string): Promise<AbsorbTurn> {
    const character = await this.#require();
    const technique = activeTechnique(
      character.techniques,
      character.activeSlot,
    );
    if (technique === null) {
      return {
        character,
        absorption: null,
        gain: 0,
        capped: false,
        blocked: true,
        blockedReason: 'technique',
      };
    }

    if (!canAbsorb(character.stamina, ABSORB_STAMINA_COST)) {
      return {
        character,
        absorption: null,
        gain: 0,
        capped: false,
        blocked: true,
        blockedReason: 'stamina',
      };
    }

    const stamina = spendStamina(character.stamina, ABSORB_STAMINA_COST);
    const location = findLocation(locationId ?? DEFAULT_LOCATION_ID);
    const absorption = absorb(location, character.spiritRoots, technique);
    const { cultivationGain } = cultivate(absorption);
    const raw = character.cultivation + cultivationGain;
    const cultivation = Math.min(raw, character.cultivationMax);
    const advanced = this.#time.advance(character.time, ACTION_DAYS.absorb, {
      kind: 'absorb',
    });

    const updated = await this.#repo.update(character.id, {
      cultivation,
      stamina,
      time: advanced.state,
      rngSeed: nextSeed(character.rngSeed),
    });
    this.#character = updated;
    return {
      character: updated,
      absorption,
      gain: cultivationGain,
      capped: raw > character.cultivationMax,
      blocked: false,
    };
  }

  /** 打坐：时间 +REST_DAYS，体力 +REST_STAMINA_GAIN（不超过上限）。不修炼、不推进种子。 */
  async rest(): Promise<RestTurn> {
    const character = await this.#require();
    const before = Number.isFinite(character.stamina) ? character.stamina : 0;
    const stamina = restoreStamina(
      character.stamina,
      REST_STAMINA_GAIN,
      character.staminaMax,
    );
    const advanced = this.#time.advance(character.time, REST_DAYS, {
      kind: 'manual',
      label: '打坐',
    });
    const updated = await this.#repo.update(character.id, {
      stamina,
      time: advanced.state,
    });
    this.#character = updated;
    return { character: updated, gained: stamina - before };
  }

  /** 使用背包里 uid 对应的消耗品，并把库存、体力、修为写回存档。 */
  async useItem(uid: string): Promise<UseItemTurn> {
    const character = await this.#require();
    const { character: next, effect } = useConsumable(character, uid);
    const updated = await this.#repo.update(character.id, {
      inventory: next.inventory,
      stamina: next.stamina,
      cultivation: next.cultivation,
    });
    this.#character = updated;
    return { character: updated, effect };
  }

  /**
   * 尝试突破。没有破境丹则不结算、不写档。
   * 有丹则无论成败都消耗 1 枚；成功则阶位 +1、修为扣阈值。
   */
  async breakthrough(): Promise<BreakthroughTurn> {
    const character = await this.#require();
    if (!hasPoJing(character)) {
      return {
        character,
        blocked: true,
        result: {
          blocked: true,
          success: false,
          realm: character.realm,
          stage: character.stage,
          cultivation: character.cultivation,
          cultivationMax: character.cultivationMax,
          nextThreshold: character.nextThreshold,
          lost: 0,
          nextSeed: character.rngSeed,
        },
      };
    }

    const result = tryBreakthrough(
      {
        cultivation: character.cultivation,
        nextThreshold: character.nextThreshold,
        realm: character.realm,
        stage: character.stage,
        hasPoJing: true,
      },
      character.rngSeed,
    );
    // 突破不耗天（0 天），但仍走一遍 action 钩子管线。
    const advanced = this.#time.advance(
      character.time,
      ACTION_DAYS.breakthrough,
      { kind: 'breakthrough' },
    );
    const inventory = consumePoJing(
      Array.isArray(character.inventory) ? character.inventory : [],
    );
    const updated = await this.#repo.update(character.id, {
      realm: result.realm,
      stage: result.stage,
      cultivation: result.cultivation,
      cultivationMax: result.cultivationMax,
      nextThreshold: result.nextThreshold,
      time: advanced.state,
      rngSeed: result.nextSeed,
      inventory,
    });
    this.#character = updated;
    return { character: updated, result, blocked: false };
  }

  /** 抽一条当前境界、当前阶位的事件；种子推进写回存档。 */
  async drawEvent(): Promise<DrawEventTurn> {
    const character = await this.#require();
    const picked = this.#events.next({
      realm: character.realm,
      stage: character.stage,
      rngSeed: character.rngSeed,
      eventState: character.eventState,
    });
    const updated = await this.#repo.update(character.id, {
      rngSeed: picked.seed,
    });
    this.#character = updated;
    return { character: updated, event: picked.event };
  }

  /**
   * 结算事件选项：修为 + 剧情标记 + 选项级功法掉落。
   *
   * 掉落先进背包（每种一本，重复则忽略并在 `duplicates` 里回报）；
   * 不进槽位，玩家需要自己装备才生效。
   */
  async resolveEvent(event: GameEvent, optionIndex: number): Promise<EventTurn> {
    const character = await this.#require();
    const outcome = this.#events.resolve(character, event.id, optionIndex);
    const doneIds = character.eventState.doneIds.includes(event.id)
      ? character.eventState.doneIds
      : [...character.eventState.doneIds, event.id];
    const base = Array.isArray(character.plotFlags) ? character.plotFlags : [];
    const flags = Array.isArray(outcome.plotFlags) ? outcome.plotFlags : [];
    const plotFlags = flags.length === 0 ? base : Array.from(new Set([...base, ...flags]));
    // 事件可自带耗时（2~7 天）；没写就按 ACTION_DAYS.event（0 天）。
    const advanced = this.#time.advance(
      character.time,
      event.days ?? ACTION_DAYS.event,
      { kind: 'event' },
    );

    // 选项级掉落：addItem 按 techniqueId 去重，重复获得只回报不叠加。
    let inventory = Array.isArray(character.inventory)
      ? [...character.inventory]
      : [];
    const granted: InventoryItem[] = [];
    const duplicates: string[] = [];
    const grantedItems: string[] = [];
    const obtainedAt = Date.now();
    for (const techniqueId of outcome.grants) {
      const item: InventoryItem = {
        uid: crypto.randomUUID(),
        kind: 'technique',
        techniqueId,
        fromEventId: event.id,
        obtainedAt,
      };
      const result = addItem(inventory, item);
      inventory = result.inventory;
      if (result.added) {
        granted.push(item);
      } else {
        duplicates.push(techniqueId);
      }
    }

    for (const itemId of outcome.itemGrants) {
      const index = inventory.findIndex(
        (entry) => entry.kind === 'consumable' && entry.itemId === itemId,
      );
      if (index >= 0) {
        const current = inventory[index];
        if (current.kind === 'consumable') {
          inventory[index] = { ...current, count: current.count + 1 };
        }
      } else {
        inventory.push({
          uid: crypto.randomUUID(),
          kind: 'consumable',
          itemId,
          count: 1,
          fromEventId: event.id,
          obtainedAt,
        });
      }
      grantedItems.push(itemId);
    }

    const stamina = spendStamina(character.stamina, outcome.staminaCost);
    const updated = await this.#repo.update(character.id, {
      cultivation: Math.min(outcome.cultivation, character.cultivationMax),
      stamina,
      rngSeed: outcome.nextSeed,
      eventState: { doneIds, count: character.eventState.count + 1 },
      plotFlags,
      time: advanced.state,
      inventory,
    });
    this.#character = updated;
    return {
      character: updated,
      outcome,
      event,
      granted,
      duplicates,
      staminaCost: outcome.staminaCost,
      grantedItems,
    };
  }

  /** 切换生效槽位；吸收始终用 `techniques[activeSlot]`。 */
  async setActiveSlot(index: number): Promise<MvpCharacter> {
    const character = await this.#require();
    assertTechniqueSlot(index);
    const updated = await this.#repo.update(character.id, { activeSlot: index });
    this.#character = updated;
    return updated;
  }

  /** 把背包里的一条物品装备到指定槽位（按 uid 定位）。 */
  async equipTechnique(
    slot: number,
    itemUid: string,
  ): Promise<MvpCharacter> {
    const character = await this.#require();
    assertTechniqueSlot(slot);
    const inventory = character.inventory ?? [];
    const item = findItemByUid(inventory, itemUid);
    if (item === null) throw new Error(`背包里没有这件物品：${itemUid}`);
    const techniques = equip(character.techniques, slot, item.techniqueId, inventory);
    const updated = await this.#repo.update(character.id, { techniques });
    this.#character = updated;
    return updated;
  }

  /**
   * 兼容旧入口：按功法 id 换槽。
   * 与 `equipTechnique` 同一条规则 —— 必须已在背包里，未知 id / 槽位越界抛错。
   */
  async setSlotTechnique(
    slot: number,
    techniqueId: string,
  ): Promise<MvpCharacter> {
    const character = await this.#require();
    assertTechniqueSlot(slot);
    const def = techniqueById(techniqueId);
    const inventory = character.inventory ?? [];
    if (!hasTechnique(inventory, def.id)) {
      throw new Error(`功法不在背包里：${def.name}`);
    }
    const techniques = equip(character.techniques, slot, def.id, inventory);
    const updated = await this.#repo.update(character.id, { techniques });
    this.#character = updated;
    return updated;
  }

  /** 当前已拥有的功法定义（背包顺序，库外脏数据过滤掉）。 */
  ownedTechniques(): readonly TechniqueDef[] {
    if (this.#character === null) return [];
    return this.#character.inventory
      .map((item) => findTechnique(item.techniqueId))
      .filter((def): def is TechniqueDef => def !== null);
  }

  /** 当前背包条目副本（UI 只读渲染用）。 */
  inventory(): InventoryItem[] {
    if (this.#character === null) return [];
    return this.#character.inventory.map((item) => ({ ...item }));
  }

  async remove(id: string): Promise<void> {
    await this.#repo.remove(id);
    if (this.#character !== null && this.#character.id === id) {
      this.#character = null;
    }
  }
}

/** 用给定存储实现装配一个 app（测试与浏览器共用）。 */
export function createApp(repo: CharacterRepository): GameApp {
  return new GameAppImpl(repo);
}

/** 纯内存 app，单测 / 无 IndexedDB 环境用。 */
export function createMemoryApp(): GameApp {
  return createApp(new MemoryCharacterRepository());
}

/**
 * 浏览器装配：默认 IndexedDB；`?storage=memory` 或环境不支持时降级内存。
 * 返回的 app 附带一份说明用的 `storageName`。
 */
export function createBrowserApp(
  search: string = '',
): { app: GameApp; storageName: 'indexeddb' | 'memory' } {
  const params = new URLSearchParams(search);
  const forcedMemory = params.get('storage') === 'memory';
  const hasIndexedDb = typeof indexedDB !== 'undefined';
  if (forcedMemory || !hasIndexedDb) {
    return { app: createMemoryApp(), storageName: 'memory' };
  }
  return {
    app: createApp(new IndexedDbCharacterRepository()),
    storageName: 'indexeddb',
  };
}
