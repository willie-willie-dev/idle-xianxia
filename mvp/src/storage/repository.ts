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
  INITIAL_STAGE,
  INITIAL_NEXT_THRESHOLD,
  REALMS,
  REALM_STAGES,
  ROOTS_SUM_TARGET,
  ROOTS_SUM_TOLERANCE,
  TECHNIQUE_SLOT_COUNT,
  cultivationMaxOf,
  defaultTechniques,
  nextThresholdOf,
  toTechnique,
} from '../data/balance.ts';
import type {
  CharacterSummary,
  CreateCharacterInput,
  MvpCharacter,
  Roots,
  Technique,
  TechniqueSlot,
  TimeState,
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

  const techniques = resolveTechniques(input.techniques);

  const element = input.element ?? dominantElement(spiritRoots);

  return {
    id: crypto.randomUUID(),
    name,
    spiritRoots,
    element,
    realm: INITIAL_REALM,
    stage: INITIAL_STAGE,
    cultivation: INITIAL_CULTIVATION,
    cultivationMax: INITIAL_CULTIVATION_MAX,
    nextThreshold: INITIAL_NEXT_THRESHOLD,
    techniques,
    activeSlot: 0,
    eventState: { doneIds: [], count: 0 },
    plotFlags: [],
    time: { day: INITIAL_DAY, tick: 0 },
    rngSeed: now >>> 0,
    saveVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** 建号用的三槽功法：校验入参、截断 / 补齐到 3 槽。 */
function resolveTechniques(input: Technique[] | undefined): Technique[] {
  if (input === undefined) return defaultTechniques();
  if (!Array.isArray(input)) throw new Error('功法槽位必须是数组');
  const slots: Technique[] = [];
  for (const item of input.slice(0, TECHNIQUE_SLOT_COUNT)) {
    if (!isUsableTechnique(item)) throw new Error('功法必须有名字与非负系数');
    slots.push(toTechnique(item));
  }
  const defaults = defaultTechniques();
  while (slots.length < TECHNIQUE_SLOT_COUNT) {
    slots.push(defaults[slots.length]);
  }
  return slots;
}

/** 是否为可用的功法对象（名字非空、两个系数为有限非负数）。 */
function isUsableTechnique(value: unknown): value is Technique {
  if (value === null || typeof value !== 'object') return false;
  const raw = value as Partial<Technique>;
  return (
    typeof raw.name === 'string' &&
    raw.name.trim().length > 0 &&
    typeof raw.absorbRate === 'number' &&
    Number.isFinite(raw.absorbRate) &&
    raw.absorbRate >= 0 &&
    typeof raw.convertRate === 'number' &&
    Number.isFinite(raw.convertRate) &&
    raw.convertRate >= 0
  );
}

/** 宽容版：迁移老存档时把坏数据丢掉，不抛错。 */
function normalizeTechnique(value: unknown): Technique | null {
  return isUsableTechnique(value) ? toTechnique(value) : null;
}

/** 老存档补齐后加的字段（无迁移脚本时的兜底）。 */
export function withDefaults(character: MvpCharacter): MvpCharacter {
  if (!Array.isArray(character.plotFlags)) character.plotFlags = [];
  if (!Array.isArray(character.eventState?.doneIds)) {
    character.eventState = { doneIds: [], count: character.eventState?.count ?? 0 };
  }
  migrateTime(character);
  migrateTechniques(character);
  migrateStage(character);
  return character;
}

/**
 * 功法迁移：单 `technique` → 三槽 `techniques` + `activeSlot`。
 *
 * - 已有 `techniques`：规范化、截断 / 补齐到 3 槽；
 * - 只有旧 `technique`：`[旧功法, 烈火诀, 厚土诀]`（旧功法可能不在库里，原样放槽 0）；
 * - 两者都没有：默认 `[青木诀, 烈火诀, 厚土诀]`；
 * - `activeSlot` 缺失或非法 → 0；最后删掉旧 `technique` 字段。
 */
function migrateTechniques(character: MvpCharacter): void {
  const legacy = character as MvpCharacter & { technique?: unknown };
  const current: unknown[] = Array.isArray(character.techniques)
    ? character.techniques
    : [];
  const slots: Technique[] = [];
  for (const item of current) {
    const normalized = normalizeTechnique(item);
    if (normalized !== null) slots.push(normalized);
    if (slots.length === TECHNIQUE_SLOT_COUNT) break;
  }
  if (slots.length === 0) {
    const old = normalizeTechnique(legacy.technique);
    if (old !== null) slots.push(old);
  }
  const defaults = defaultTechniques();
  while (slots.length < TECHNIQUE_SLOT_COUNT) {
    slots.push(defaults[slots.length]);
  }
  character.techniques = slots;

  const active: unknown = character.activeSlot;
  character.activeSlot = (active === 1 || active === 2 ? active : 0) as TechniqueSlot;
  delete legacy.technique;
}

/**
 * 阶位迁移：缺 `stage` 补「前期」；随后按 (realm, stage) 重算阈值与上限，
 * 让老存档的旧三阶数值（100 / 500）不会继续冒充新阶位表。
 */
function migrateStage(character: MvpCharacter): void {
  const realm = REALMS.includes(character.realm) ? character.realm : INITIAL_REALM;
  const stage = REALM_STAGES.includes(character.stage)
    ? character.stage
    : INITIAL_STAGE;
  character.realm = realm;
  character.stage = stage;
  character.nextThreshold = nextThresholdOf(realm, stage);
  character.cultivationMax = cultivationMaxOf(realm, stage);
}

/**
 * 时间字段迁移：老存档只有 `day: number`，没有 `time`。
 * 有旧 `day` 就沿用它补 `{ day, tick: day - 1 }`（tick = 累计推进天数），
 * 否则从第 1 天开始；随后删掉旧字段。
 */
function migrateTime(character: MvpCharacter): void {
  const legacy = character as MvpCharacter & { day?: unknown };
  const current = character.time as TimeState | undefined;
  const day =
    current !== undefined && current !== null && Number.isFinite(current.day)
      ? current.day
      : typeof legacy.day === 'number' && Number.isFinite(legacy.day)
        ? legacy.day
        : INITIAL_DAY;
  const tick =
    current !== undefined &&
    current !== null &&
    Number.isFinite(current.tick)
      ? current.tick
      : Math.max(0, day - INITIAL_DAY);
  character.time = { day, tick };
  delete legacy.day;
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
    stage: character.stage,
    cultivation: character.cultivation,
    day: character.time.day,
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
    // list 也过一遍 withDefaults：老存档缺 time 时不能把整个列表打挂。
    return [...this.#items.values()].map(withDefaults).map(summarize).sort(compareSummary);
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
