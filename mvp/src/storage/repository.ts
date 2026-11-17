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
  START_INVENTORY,
  START_SLOTS,
  TECHNIQUE_LIBRARY,
  TECHNIQUE_SLOT_COUNT,
  cultivationMaxOf,
  findTechnique,
  nextThresholdOf,
} from '../data/balance.ts';
import type {
  CharacterSummary,
  CreateCharacterInput,
  InventoryItem,
  MvpCharacter,
  Roots,
  TechniqueId,
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

/** 灵根 7 键，缺一不可。合计只加这些键，避免漏键变成 NaN 后比较失效。 */
const ROOT_KEYS = ['metal', 'wood', 'water', 'fire', 'earth', 'qian', 'kun'] as const satisfies readonly (keyof Roots)[];

function assertRootNumber(key: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`灵根 ${key} 必须是非负有限数（当前 ${String(value)}）`);
  }
  return value;
}

/** 灵根合计。7 个键都必须在，且都是有限非负数；缺键直接抛错，不返回 NaN。 */
export function rootsSum(roots: Roots): number {
  let sum = 0;
  for (const key of ROOT_KEYS) {
    const value =
      roots !== null && typeof roots === 'object' && Object.hasOwn(roots, key)
        ? roots[key]
        : undefined;
    sum += assertRootNumber(key, value);
  }
  return sum;
}

/** 校验灵根：7 个键都在、都是有限非负数，合计 = 100（±0.01）；不合规直接抛错，不落库。 */
export function assertRootsValid(roots: Roots): void {
  if (roots !== null && typeof roots === 'object') {
    for (const [key, value] of Object.entries(roots)) {
      assertRootNumber(key, value);
    }
  }
  const sum = rootsSum(roots);
  if (!Number.isFinite(sum) || Math.abs(sum - ROOTS_SUM_TARGET) > ROOTS_SUM_TOLERANCE) {
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

  const techniques = resolveSlots(input.techniques);

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
    inventory: [...START_INVENTORY],
    eventState: { doneIds: [], count: 0 },
    plotFlags: [],
    time: { day: INITIAL_DAY, tick: 0 },
    rngSeed: now >>> 0,
    saveVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 建号用的三槽功法 id：校验入参、截断 / 补齐到 3 槽。
 *
 * 缺省 `START_SLOTS`（全空）；非空 id 必须在功法库里，否则抛错。
 */
function resolveSlots(input: (string | null)[] | undefined): (string | null)[] {
  if (input === undefined) return [...START_SLOTS];
  if (!Array.isArray(input)) throw new Error('功法槽位必须是数组');
  const slots: (string | null)[] = [];
  for (const item of input.slice(0, TECHNIQUE_SLOT_COUNT)) {
    if (item === null) {
      slots.push(null);
      continue;
    }
    if (typeof item !== 'string') {
      throw new Error('功法槽位必须是功法 id 或 null');
    }
    if (findTechnique(item) === null) throw new Error(`未知功法：${item}`);
    slots.push(item);
  }
  while (slots.length < TECHNIQUE_SLOT_COUNT) slots.push(null);
  return slots;
}

/**
 * 把老存档里的一条功法（对象或字符串）匹配到功法库 id。
 *
 * 先按 id、再按名字；匹配不到返回 null（该槽置空，不猜）。
 */
function matchTechniqueId(value: unknown): TechniqueId | null {
  if (typeof value === 'string') {
    const byId = findTechnique(value);
    if (byId !== null) return byId.id;
    const byName = TECHNIQUE_LIBRARY.find((def) => def.name === value);
    return byName?.id ?? null;
  }
  if (value !== null && typeof value === 'object') {
    const raw = value as { id?: unknown; name?: unknown };
    if (typeof raw.id === 'string') {
      const hit = findTechnique(raw.id);
      if (hit !== null) return hit.id;
    }
    if (typeof raw.name === 'string') {
      const byName = TECHNIQUE_LIBRARY.find((def) => def.name === raw.name);
      if (byName !== undefined) return byName.id;
      const byId = findTechnique(raw.name);
      if (byId !== null) return byId.id;
    }
  }
  return null;
}

/** 规范化背包：丢掉坏条目、按 `techniqueId` 去重、补齐缺字段。 */
function normalizeInventory(character: MvpCharacter): InventoryItem[] {
  const raw: unknown = character.inventory;
  if (!Array.isArray(raw)) return [];
  const now = Number.isFinite(character.updatedAt) ? character.updatedAt : Date.now();
  const items: InventoryItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const item = entry as Partial<InventoryItem>;
    const techniqueId =
      typeof item.techniqueId === 'string' ? item.techniqueId : null;
    if (techniqueId === null || findTechnique(techniqueId) === null) continue;
    if (seen.has(techniqueId)) continue;
    seen.add(techniqueId);
    items.push({
      uid:
        typeof item.uid === 'string' && item.uid.length > 0
          ? item.uid
          : crypto.randomUUID(),
      kind: 'technique',
      techniqueId,
      fromEventId:
        typeof item.fromEventId === 'string' && item.fromEventId.length > 0
          ? item.fromEventId
          : 'migrated',
      obtainedAt:
        typeof item.obtainedAt === 'number' && Number.isFinite(item.obtainedAt)
          ? item.obtainedAt
          : now,
    });
  }
  return items;
}

/**
 * 老存档补齐后加的字段（无迁移脚本时的兜底）。
 *
 * 先拷贝再迁移，不改传入对象；迁移结果与原先就地补齐一致。
 */
export function withDefaults(character: MvpCharacter): MvpCharacter {
  const next = clone(character);
  if (!Array.isArray(next.plotFlags)) next.plotFlags = [];
  if (!Array.isArray(next.eventState?.doneIds)) {
    next.eventState = { doneIds: [], count: next.eventState?.count ?? 0 };
  }
  migrateTime(next);
  migrateTechniques(next);
  migrateStage(next);
  return next;
}

/**
 * 功法迁移：老存档的对象数组 → 功法 id 数组 + 背包。
 *
 * - 旧 `techniques: Technique[]` / 单 `technique`：按 id / 名字匹配功法库，
 *   匹配不到就丢弃并把该槽置 `null`；
 * - 匹配到的功法同时补进 `inventory`（`fromEventId: 'migrated'`，每种一条）；
 * - 缺 `inventory` → `[]`；缺 / 非法 `activeSlot` → 0；最后删掉旧 `technique` 字段。
 */
function migrateTechniques(character: MvpCharacter): void {
  const legacy = character as MvpCharacter & { technique?: unknown };
  const current: unknown = character.techniques;
  const slots: (string | null)[] = [];

  if (Array.isArray(current) && current.length > 0) {
    for (const item of current.slice(0, TECHNIQUE_SLOT_COUNT)) {
      slots.push(matchTechniqueId(item));
    }
  } else if (legacy.technique !== undefined) {
    slots.push(matchTechniqueId(legacy.technique));
  }
  while (slots.length < TECHNIQUE_SLOT_COUNT) slots.push(null);
  const nextSlots = slots.slice(0, TECHNIQUE_SLOT_COUNT);
  character.techniques = nextSlots;

  const inventory = normalizeInventory(character);
  const now = Number.isFinite(character.updatedAt) ? character.updatedAt : Date.now();
  for (const id of nextSlots) {
    if (id === null) continue;
    if (inventory.some((item) => item.techniqueId === id)) continue;
    inventory.push({
      uid: `migrated-${id}`,
      kind: 'technique',
      techniqueId: id,
      fromEventId: 'migrated',
      obtainedAt: now,
    });
  }
  character.inventory = inventory;

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

/** 合并 patch：id / createdAt 不可改，updatedAt 强制刷新。嵌套字段深拷贝后再入库。 */
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
  next.inventory = clone(next.inventory);
  next.techniques = clone(next.techniques);
  next.time = clone(next.time);
  next.spiritRoots = clone(next.spiritRoots);
  next.eventState = clone(next.eventState);
  next.plotFlags = clone(next.plotFlags);
  return next;
}

/** 内存实现：单测用，行为与 IndexedDB 版对齐。 */
export class MemoryCharacterRepository implements CharacterRepository {
  #items: Map<string, MvpCharacter>;
  #activeId: string | null = null;

  /** `initial` 按引用放入仓库（缺省空表），测试用来核对读路径没有改写原对象。 */
  constructor(initial?: Iterable<readonly [string, MvpCharacter]>) {
    this.#items = initial === undefined ? new Map() : new Map(initial);
  }

  async list(): Promise<CharacterSummary[]> {
    // 先拷贝再补默认值：老存档缺 time 时列表仍可读，且不改仓库里的原对象。
    return [...this.#items.values()]
      .map((item) => withDefaults(clone(item)))
      .map(summarize)
      .sort(compareSummary);
  }

  async get(id: string): Promise<MvpCharacter | null> {
    const found = this.#items.get(id);
    return found === undefined ? null : withDefaults(clone(found));
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
