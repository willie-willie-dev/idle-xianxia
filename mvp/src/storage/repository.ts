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
  STAMINA_INITIAL,
  STAMINA_MAX,
  TECHNIQUE_LIBRARY,
  TECHNIQUE_SLOT_COUNT,
  cultivationMaxOf,
  findConsumable,
  findTechnique,
  nextThresholdOf,
} from '../data/balance.ts';
import type {
  CharacterSummary,
  ConsumableItem,
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
    stamina: STAMINA_INITIAL,
    staminaMax: STAMINA_MAX,
    breakthroughGuard: false,
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

/**
 * 规范化背包：丢掉坏条目。
 *
 * - `kind === "technique"`，以及老存档里没有 `kind` 但有 `techniqueId` 的条目：
 *   按功法处理，`techniqueId` 必须在功法库里，同 id 只留第一条；
 * - `kind === "consumable"`：`itemId` 必须在消耗品库里，同 id 合并堆叠
 *   （`count` 相加，每条至少 1），`uid` 沿用第一条。
 */
function normalizeInventory(character: MvpCharacter): InventoryItem[] {
  const raw: unknown = character.inventory;
  if (!Array.isArray(raw)) return [];
  const now = Number.isFinite(character.updatedAt) ? character.updatedAt : Date.now();
  const items: InventoryItem[] = [];
  const seenTechniques = new Set<string>();
  const consumableAt = new Map<string, number>();
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const item = entry as {
      uid?: unknown;
      kind?: unknown;
      techniqueId?: unknown;
      itemId?: unknown;
      count?: unknown;
      fromEventId?: unknown;
      obtainedAt?: unknown;
    };
    const kind = itemKind(item);
    if (kind === 'technique') {
      const techniqueId =
        typeof item.techniqueId === 'string' ? item.techniqueId : null;
      if (techniqueId === null || findTechnique(techniqueId) === null) continue;
      if (seenTechniques.has(techniqueId)) continue;
      seenTechniques.add(techniqueId);
      items.push({
        uid: itemUid(item.uid),
        kind: 'technique',
        techniqueId,
        fromEventId: itemFromEventId(item.fromEventId),
        obtainedAt: itemObtainedAt(item.obtainedAt, now),
      });
      continue;
    }
    if (kind !== 'consumable') continue;
    const itemId = typeof item.itemId === 'string' ? item.itemId : null;
    if (itemId === null || findConsumable(itemId) === null) continue;
    const count = itemCount(item.count);
    const existing = consumableAt.get(itemId);
    if (existing !== undefined) {
      const prev = items[existing];
      if (prev !== undefined && prev.kind === 'consumable') {
        prev.count = Math.max(1, prev.count + count);
      }
      continue;
    }
    const stacked: ConsumableItem = {
      uid: itemUid(item.uid),
      kind: 'consumable',
      itemId,
      count,
      fromEventId: itemFromEventId(item.fromEventId),
      obtainedAt: itemObtainedAt(item.obtainedAt, now),
    };
    consumableAt.set(itemId, items.length);
    items.push(stacked);
  }
  return items;
}

/** 没有 `kind` 但有 `techniqueId` 的老条目按功法处理；其余未知 kind 丢掉。 */
function itemKind(item: {
  kind?: unknown;
  techniqueId?: unknown;
}): 'technique' | 'consumable' | null {
  if (item.kind === 'technique') return 'technique';
  if (item.kind === 'consumable') return 'consumable';
  if (
    (item.kind === undefined || item.kind === null) &&
    typeof item.techniqueId === 'string'
  ) {
    return 'technique';
  }
  return null;
}

function itemUid(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : crypto.randomUUID();
}

function itemFromEventId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'migrated';
}

function itemObtainedAt(value: unknown, now: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : now;
}

/** 堆叠数量：非有限数或小于 1 时按 1。 */
function itemCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, value);
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
  migrateStamina(next);
  return next;
}

/**
 * 体力与破境丹：老存档缺字段时补开局值。
 *
 * `stamina` 夹在 `[0, staminaMax]`；`staminaMax` 只在缺失或非有限数时补 `STAMINA_MAX`。
 */
function migrateStamina(character: MvpCharacter): void {
  const rawMax: unknown = character.staminaMax;
  if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
    character.staminaMax = STAMINA_MAX;
  }
  const rawStamina: unknown = character.stamina;
  const stamina =
    typeof rawStamina === 'number' && Number.isFinite(rawStamina)
      ? rawStamina
      : STAMINA_INITIAL;
  const upper = character.staminaMax > 0 ? character.staminaMax : 0;
  character.stamina = Math.min(upper, Math.max(0, stamina));
  if (typeof character.breakthroughGuard !== 'boolean') {
    character.breakthroughGuard = false;
  }
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
    if (
      inventory.some(
        (item) => item.kind === 'technique' && item.techniqueId === id,
      )
    ) {
      continue;
    }
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
    stamina: character.stamina,
    staminaMax: character.staminaMax,
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
