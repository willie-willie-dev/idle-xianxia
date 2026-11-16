/**
 * 存储层：`CharacterRepository` 接口 + 内存实现。
 *
 * 铁律：存储层只存结构化的 `MvpCharacter`，不 import 任何 `systems/` 的规则函数
 * （`systems/absorb.ts` 只提供 `Roots` / `Technique` 两个类型）。
 *
 * 两份实现共用 `buildCharacter()`，保证内存版与 IndexedDB 版建号行为完全一致。
 */

import {
  DEFAULT_ELEMENT,
  DEFAULT_ROOTS,
  ELEMENT_ORDER,
  INITIAL_CULTIVATION,
  INITIAL_CULTIVATION_MAX,
  INITIAL_DAY,
  INITIAL_REALM,
  INITIAL_NEXT_THRESHOLD,
  ROOTS_SUM_TARGET,
  ROOTS_SUM_TOLERANCE,
  START_TECHNIQUE,
} from '../data/balance.ts';
import type {
  CharacterSummary,
  CreateCharacterInput,
  MvpCharacter,
  Roots,
  Technique,
  WuXing,
} from '../types.ts';

/** 存储接口：列表 / 读 / 建 / 改 / 删 / 当前角色。 */
export interface CharacterRepository {
  list(): Promise<CharacterSummary[]>;
  get(id: string): Promise<MvpCharacter | null>;
  create(input: CreateCharacterInput): Promise<MvpCharacter>;
  update(id: string, patch: Partial<MvpCharacter>): Promise<MvpCharacter>;
  remove(id: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  setActiveId(id: string | null): Promise<void>;
}

/** 灵根合计。 */
export function rootsSum(roots: Roots): number {
  return (
    roots.metal +
    roots.wood +
    roots.water +
    roots.fire +
    roots.earth +
    roots.qian +
    roots.kun
  );
}

/** 校验灵根：每项有限且非负，合计 = 100（±0.01）；不合规直接抛错，不落库。 */
export function assertRootsValid(roots: Roots): void {
  for (const [key, value] of Object.entries(roots)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`灵根 ${key} 必须是非负有限数（当前 ${String(value)}）`);
    }
  }
  const sum = rootsSum(roots);
  if (Math.abs(sum - ROOTS_SUM_TARGET) > ROOTS_SUM_TOLERANCE) {
    throw new Error(
      `灵根合计必须为 ${ROOTS_SUM_TARGET}（±${ROOTS_SUM_TOLERANCE}），当前 ${sum}`,
    );
  }
}

/** 从灵根里推导五行主属性（平手按 ELEMENT_ORDER 顺序取前者）。 */
export function dominantElement(roots: Roots): WuXing {
  const channel: Record<WuXing, keyof Roots> = {
    金: 'metal',
    木: 'wood',
    水: 'water',
    火: 'fire',
    土: 'earth',
  };
  let best: WuXing = DEFAULT_ELEMENT;
  let bestValue = -1;
  for (const element of ELEMENT_ORDER) {
    const value = roots[channel[element]];
    if (value > bestValue) {
      best = element;
      bestValue = value;
    }
  }
  return best;
}

/** 建号：两份存储实现共用，`now` 可注入以便测试。 */
export function buildCharacter(
  input: CreateCharacterInput,
  now: number = Date.now(),
): MvpCharacter {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) throw new Error('角色名不能为空');

  const spiritRoots: Roots =
    input.spiritRoots === undefined
      ? { ...DEFAULT_ROOTS }
      : { ...input.spiritRoots };
  assertRootsValid(spiritRoots);

  const technique: Technique =
    input.technique === undefined
      ? { ...START_TECHNIQUE }
      : { ...input.technique };
  if (technique.name === undefined || technique.name.length === 0) {
    throw new Error('功法必须有名字');
  }

  const element = input.element ?? dominantElement(spiritRoots);

  return {
    id: crypto.randomUUID(),
    name,
    spiritRoots,
    element,
    realm: INITIAL_REALM,
    cultivation: INITIAL_CULTIVATION,
    cultivationMax: INITIAL_CULTIVATION_MAX,
    nextThreshold: INITIAL_NEXT_THRESHOLD,
    technique,
    eventState: { doneIds: [], count: 0 },
    plotFlags: [],
    day: INITIAL_DAY,
    rngSeed: now >>> 0,
    saveVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** 老存档补齐后加的字段（无迁移脚本时的兜底）。 */
export function withDefaults(character: MvpCharacter): MvpCharacter {
  if (!Array.isArray(character.plotFlags)) character.plotFlags = [];
  if (!Array.isArray(character.eventState?.doneIds)) {
    character.eventState = { doneIds: [], count: character.eventState?.count ?? 0 };
  }
  return character;
}

/** 深拷贝，避免调用方拿到存档内部引用。 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

function summarize(character: MvpCharacter): CharacterSummary {
  return {
    id: character.id,
    name: character.name,
    realm: character.realm,
    cultivation: character.cultivation,
    day: character.day,
    createdAt: character.createdAt,
  };
}

/** 列表排序：createdAt 倒序；同一毫秒内用 id 兜底，保证顺序稳定。 */
function compareSummary(a: CharacterSummary, b: CharacterSummary): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** 合并 patch：id / createdAt 不可改，updatedAt 强制刷新。 */
function mergePatch(
  current: MvpCharacter,
  patch: Partial<MvpCharacter>,
  now: number = Date.now(),
): MvpCharacter {
  const next: MvpCharacter = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: now,
  };
  return next;
}

/** 内存实现：单测用，行为与 IndexedDB 版对齐。 */
export class MemoryCharacterRepository implements CharacterRepository {
  #items: Map<string, MvpCharacter> = new Map();
  #activeId: string | null = null;

  async list(): Promise<CharacterSummary[]> {
    return [...this.#items.values()].map(summarize).sort(compareSummary);
  }

  async get(id: string): Promise<MvpCharacter | null> {
    const found = this.#items.get(id);
    return found === undefined ? null : clone(withDefaults(found));
  }

  async create(input: CreateCharacterInput): Promise<MvpCharacter> {
    // buildCharacter 会先校验灵根再生成 id，校验失败时不会留下半条记录。
    const character = buildCharacter(input);
    this.#items.set(character.id, character);
    return clone(character);
  }

  async update(id: string, patch: Partial<MvpCharacter>): Promise<MvpCharacter> {
    const current = this.#items.get(id);
    if (current === undefined) throw new Error(`角色不存在：${id}`);
    const next = mergePatch(current, patch);
    this.#items.set(id, next);
    return clone(next);
  }

  async remove(id: string): Promise<void> {
    this.#items.delete(id);
    if (this.#activeId === id) this.#activeId = null;
  }

  async getActiveId(): Promise<string | null> {
    return this.#activeId;
  }

  async setActiveId(id: string | null): Promise<void> {
    this.#activeId = id;
  }
}
