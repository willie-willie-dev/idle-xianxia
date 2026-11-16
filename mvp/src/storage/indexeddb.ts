/**
 * 存储层：IndexedDB 实现（浏览器）。
 *
 * 库名 `dengxian-mvp`，版本 1：
 * - `characters`（keyPath `id`，索引 `createdAt`）放完整 MvpCharacter；
 * - `meta`（keyPath `key`）放 `activeId`、`schemaVersion`。
 *
 * 迁移策略：`onupgradeneeded` 里按 `oldVersion` 递进建表。
 * `schemaVersion`（库结构）与 `saveVersion`（角色数据格式）分开演进。
 *
 * 本文件只在浏览器里跑；单测用 Memory 实现。
 */

import type {
  CharacterSummary,
  CreateCharacterInput,
  MvpCharacter,
} from '../types.ts';
import {
  buildCharacter,
  type CharacterRepository,
  withDefaults,
} from './repository.ts';

export const DB_NAME = 'dengxian-mvp';
export const DB_VERSION = 1;
export const STORE_CHARACTERS = 'characters';
export const STORE_META = 'meta';
export const INDEX_CREATED_AT = 'createdAt';
export const ACTIVE_ID_KEY = 'activeId';
export const SCHEMA_VERSION_KEY = 'schemaVersion';
export const SCHEMA_VERSION = 1;

/** meta 记录。 */
interface MetaRecord {
  key: string;
  value: unknown;
}

function assertSupported(): void {
  if (typeof indexedDB === 'undefined') {
    throw new Error('当前环境没有 IndexedDB，请用 `npm run dev` 打开或用 ?storage=memory 降级');
  }
}

/** 把 IDBRequest 包成 Promise。 */
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 请求失败'));
  });
}

/** 等事务提交完成。 */
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务中止'));
  });
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

function compareSummary(a: CharacterSummary, b: CharacterSummary): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export class IndexedDbCharacterRepository implements CharacterRepository {
  #dbName: string;
  #dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string = DB_NAME) {
    this.#dbName = dbName;
  }

  #open(): Promise<IDBDatabase> {
    if (this.#dbPromise !== null) return this.#dbPromise;
    assertSupported();
    this.#dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.#dbName, DB_VERSION);

      req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = req.result;
        const tx = req.transaction;
        if (event.oldVersion < 1) {
          const characters = db.createObjectStore(STORE_CHARACTERS, {
            keyPath: 'id',
          });
          characters.createIndex(INDEX_CREATED_AT, 'createdAt', {
            unique: false,
          });
          db.createObjectStore(STORE_META, { keyPath: 'key' });
          if (tx !== null) {
            const meta: MetaRecord = {
              key: SCHEMA_VERSION_KEY,
              value: SCHEMA_VERSION,
            };
            tx.objectStore(STORE_META).put(meta);
          }
        }
        // 将来的 v2 迁移在这里按 oldVersion 递进追加。
      };

      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          this.#dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () =>
        reject(req.error ?? new Error(`IndexedDB 打开失败：${this.#dbName}`));
      req.onblocked = () =>
        reject(new Error('IndexedDB 被其他标签页占用，请关闭后重试'));
    });
    return this.#dbPromise;
  }

  async list(): Promise<CharacterSummary[]> {
    const db = await this.#open();
    const tx = db.transaction(STORE_CHARACTERS, 'readonly');
    const all = await request<MvpCharacter[]>(
      tx.objectStore(STORE_CHARACTERS).getAll() as IDBRequest<MvpCharacter[]>,
    );
    if (all.length === 0) return [];
    return all.map(summarize).sort(compareSummary);
  }

  async get(id: string): Promise<MvpCharacter | null> {
    const db = await this.#open();
    const tx = db.transaction(STORE_CHARACTERS, 'readonly');
    const found = await request<MvpCharacter | undefined>(
      tx.objectStore(STORE_CHARACTERS).get(id) as IDBRequest<MvpCharacter | undefined>,
    );
    return found === undefined ? null : withDefaults(found);
  }

  async create(input: CreateCharacterInput): Promise<MvpCharacter> {
    // 先校验再落库：灵根合计不对时这里就会抛错。
    const character = buildCharacter(input);
    const db = await this.#open();
    const tx = db.transaction(STORE_CHARACTERS, 'readwrite');
    tx.objectStore(STORE_CHARACTERS).add(character);
    await transactionDone(tx);
    return character;
  }

  async update(
    id: string,
    patch: Partial<MvpCharacter>,
  ): Promise<MvpCharacter> {
    const db = await this.#open();
    const tx = db.transaction(STORE_CHARACTERS, 'readwrite');
    const store = tx.objectStore(STORE_CHARACTERS);
    const current = await request<MvpCharacter | undefined>(
      store.get(id) as IDBRequest<MvpCharacter | undefined>,
    );
    if (current === undefined) {
      tx.abort();
      throw new Error(`角色不存在：${id}`);
    }
    const next: MvpCharacter = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    };
    store.put(next);
    await transactionDone(tx);
    return next;
  }

  async remove(id: string): Promise<void> {
    const db = await this.#open();
    const tx = db.transaction([STORE_CHARACTERS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHARACTERS).delete(id);
    const active = await request<MetaRecord | undefined>(
      tx.objectStore(STORE_META).get(ACTIVE_ID_KEY) as IDBRequest<
        MetaRecord | undefined
      >,
    );
    if (active !== undefined && active.value === id) {
      const cleared: MetaRecord = { key: ACTIVE_ID_KEY, value: null };
      tx.objectStore(STORE_META).put(cleared);
    }
    await transactionDone(tx);
  }

  async getActiveId(): Promise<string | null> {
    const db = await this.#open();
    const tx = db.transaction(STORE_META, 'readonly');
    const record = await request<MetaRecord | undefined>(
      tx.objectStore(STORE_META).get(ACTIVE_ID_KEY) as IDBRequest<
        MetaRecord | undefined
      >,
    );
    if (record === undefined || typeof record.value !== 'string') return null;
    return record.value;
  }

  async setActiveId(id: string | null): Promise<void> {
    const db = await this.#open();
    const tx = db.transaction(STORE_META, 'readwrite');
    const record: MetaRecord = { key: ACTIVE_ID_KEY, value: id };
    tx.objectStore(STORE_META).put(record);
    await transactionDone(tx);
  }
}
