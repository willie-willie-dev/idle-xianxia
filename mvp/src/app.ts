/**
 * 应用层：把「读档 → 领域函数 → 写档」编排成一次操作。
 *
 * 这里不含规则（规则在 `systems/`）、不含 DOM（在 `ui/`）、不含存储细节
 * （在 `storage/`）。UI 每点一下按钮，调用这里的一个方法。
 */

import { DAYS_PER_ABSORB } from './data/balance.ts';
import { DEFAULT_LOCATION_ID, LOCATIONS, findLocation } from './data/locations.ts';
import { IndexedDbCharacterRepository } from './storage/indexeddb.ts';
import { MemoryCharacterRepository } from './storage/repository.ts';
import type { CharacterRepository } from './storage/repository.ts';
import { absorb } from './systems/absorb.ts';
import type { AbsorbResult, Location } from './systems/absorb.ts';
import { tryBreakthrough } from './systems/breakthrough.ts';
import type { BreakthroughResult } from './types.ts';
import { cultivate } from './systems/cultivate.ts';
import { applyOption, pickEvent } from './systems/event.ts';
import { nextSeed } from './systems/rng.ts';
import type {
  CharacterSummary,
  GameEvent,
  MvpCharacter,
  OptionOutcome,
} from './types.ts';

/** 一次吸收的回报（含 UI 明细用的灵气入池量，不入存档）。 */
export interface AbsorbTurn {
  character: MvpCharacter;
  absorption: AbsorbResult;
  /** 本次名义产出（未封顶前）。 */
  gain: number;
  /** 是否被修为上限截断。 */
  capped: boolean;
}

/** 一次突破的回报。 */
export interface BreakthroughTurn {
  character: MvpCharacter;
  result: BreakthroughResult;
}

/** 一次抽事件的回报。`event === null` 表示本境界已历练完。 */
export interface DrawEventTurn {
  character: MvpCharacter;
  event: GameEvent | null;
}

/** 一次事件结算的回报。 */
export interface EventTurn {
  character: MvpCharacter;
  outcome: OptionOutcome;
  event: GameEvent;
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
  breakthrough(): Promise<BreakthroughTurn>;
  drawEvent(): Promise<DrawEventTurn>;
  resolveEvent(event: GameEvent, optionIndex: number): Promise<EventTurn>;
  remove(id: string): Promise<void>;
}

/** 修为达到阈值、且还没到顶阶时，才可以点突破。 */
export function canBreakthrough(character: MvpCharacter): boolean {
  return character.realm !== '金丹' && character.cultivation >= character.nextThreshold;
}

class GameAppImpl implements GameApp {
  readonly locations: readonly Location[] = LOCATIONS;
  #repo: CharacterRepository;
  #character: MvpCharacter | null = null;

  constructor(repo: CharacterRepository) {
    this.#repo = repo;
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
   * `day + 1` 与 `rngSeed` 推进都入存档。
   */
  async absorb(locationId?: string): Promise<AbsorbTurn> {
    const character = await this.#require();
    const location = findLocation(locationId ?? DEFAULT_LOCATION_ID);
    const absorption = absorb(location, character.spiritRoots, character.technique);
    const { cultivationGain } = cultivate(absorption);
    const raw = character.cultivation + cultivationGain;
    const cultivation = Math.min(raw, character.cultivationMax);

    const updated = await this.#repo.update(character.id, {
      cultivation,
      day: character.day + DAYS_PER_ABSORB,
      rngSeed: nextSeed(character.rngSeed),
    });
    this.#character = updated;
    return {
      character: updated,
      absorption,
      gain: cultivationGain,
      capped: raw > character.cultivationMax,
    };
  }

  /** 尝试突破；成功则境界 +1、修为扣阈值、阈值与上限按 balance 重算。 */
  async breakthrough(): Promise<BreakthroughTurn> {
    const character = await this.#require();
    const result = tryBreakthrough(
      {
        cultivation: character.cultivation,
        nextThreshold: character.nextThreshold,
        realm: character.realm,
      },
      character.rngSeed,
    );
    const updated = await this.#repo.update(character.id, {
      realm: result.realm,
      cultivation: result.cultivation,
      cultivationMax: result.cultivationMax,
      nextThreshold: result.nextThreshold,
      rngSeed: result.nextSeed,
    });
    this.#character = updated;
    return { character: updated, result };
  }

  /** 抽一条当前境界的事件；种子推进写回存档。 */
  async drawEvent(): Promise<DrawEventTurn> {
    const character = await this.#require();
    const picked = pickEvent({
      realm: character.realm,
      doneIds: character.eventState.doneIds,
      seed: character.rngSeed,
    });
    const updated = await this.#repo.update(character.id, {
      rngSeed: picked.nextSeed,
    });
    this.#character = updated;
    return { character: updated, event: picked.event };
  }

  /** 结算事件选项：修为 + 剧情标记（标记只回报给 UI，不入存档）。 */
  async resolveEvent(event: GameEvent, optionIndex: number): Promise<EventTurn> {
    const character = await this.#require();
    const outcome = applyOption(
      { cultivation: character.cultivation, rngSeed: character.rngSeed },
      event,
      optionIndex,
    );
    const doneIds = character.eventState.doneIds.includes(event.id)
      ? character.eventState.doneIds
      : [...character.eventState.doneIds, event.id];
    const base = Array.isArray(character.plotFlags) ? character.plotFlags : [];
    const flags = Array.isArray(outcome.plotFlags) ? outcome.plotFlags : [];
    const plotFlags = flags.length === 0 ? base : Array.from(new Set([...base, ...flags]));
    const updated = await this.#repo.update(character.id, {
      cultivation: Math.min(outcome.cultivation, character.cultivationMax),
      rngSeed: outcome.nextSeed,
      eventState: { doneIds, count: character.eventState.count + 1 },
      plotFlags,
    });
    this.#character = updated;
    return { character: updated, outcome, event };
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
