import { create } from 'zustand';
import type { Storage, AppScreen, SavedGameState } from '../types/account';
import type { WuXing, Stats, LogEntry } from '../types';
import type { EquipBase, EquippedSlots } from '../types/equipment';
import type { Skill } from '../types/skill';
import type { Character, Realm, RealmStage, SpiritRootKey, SpiritType } from '../types/character';
import type { LearnedTechnique } from '../types/technique';
import { patchCharacter, defaultEvenSpiritRoots, SPIRIT_ROOT_LABELS, type Gender } from '../types/character';
import type { GameEvent, SpiritReward } from '../types/event';
import { createInitialCharacter, addExp, calculateFinalStats, expToNextLevel } from '../systems/characterSystem';
import { getTotalEquipmentBonus } from '../systems/equipmentSystem';
import { simulateBattle } from '../systems/combatSystem';
import { checkEventTrigger } from '../systems/eventSystem';
import { MONSTERS_DATA, IDLE_EXP_PER_TICK, IDLE_GOLD_PER_TICK } from '../data/monsters';
import { SKILLS_DATA } from '../data/skills';
import { REALM_ORDER } from '../data/realms';
import {
  advanceMinorRealmIfEligible,
  applySpiritAbsorption,
  grantWonderLoot,
  getSpiritQiCap,
  performMajorRealmBreakthrough,
  realmDisplayLabel,
  rollAbsorbEncounter,
  runRandomBattleQi,
  refineSpiritToProgress,
  REALM_PROGRESS_NAMES,
  type EncounterKind,
} from '../systems/cultivationSystem';
import {
  applyEventReward,
  applySpiritAbsorptionFromReward,
  describeSpiritAbsorption,
} from '../systems/spiritAbsorption';
import { type GameTime, INITIAL_GAME_TIME, advanceDays, ZHOU_TIAN_DAYS } from '../types/time';
import { techniqueInventoryKey } from '../types/technique';

/** 历练结算预览（供 EventScreen 等与 executeEncounter 对齐，避免二次随机） */
export type ExecuteEncounterResult =
  | {
    kind: 'absorb';
    charBefore: Character;
    charAfter: Character;
    spiritReward: Record<string, number>;
    cap: number;
  }
  | {
    kind: 'wonder';
    charBefore: Character;
    charAfter: Character;
    drops: string[];
    techniqueDrop?: LearnedTechnique;
    spiritReward?: SpiritReward;
    cap: number;
  }
  | {
    kind: 'battle';
    charBefore: Character;
    charAfter: Character;
    victory: boolean;
    foe: string;
    lossFrac: number;
  };

const STORAGE_KEY = 'idle_xianxia_accounts';
const MAX_ACCOUNTS = 3;

function uuid(): string {
  return (typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Load from localStorage */
function loadStorage(): Storage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Storage;
  } catch { /* ignore */ }
  return { accounts: [], activeAccountId: null, gameStates: {} };
}

/** Save to localStorage */
function saveStorage(storage: Storage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

/** Convert SavedGameState (string[]) → runtime GameState (Set) */
export function toGameState(sgs: SavedGameState): GameState {
  const rawChar = { ...(sgs.character as Character) };
  const knownTechniques = (rawChar.knownTechniques && rawChar.knownTechniques.length > 0)
    ? rawChar.knownTechniques
    : (sgs.knownTechniques ?? []);
  const character = patchCharacter({ ...rawChar, knownTechniques });
  return {
    character,
    equipped: sgs.equipped,
    bag: sgs.bag,
    skills: sgs.skills,
    logs: sgs.logs,
    isIdling: sgs.isIdling,
    logCounter: sgs.logCounter,
    currentEvent: sgs.currentEvent,
    triggeredEvents: new Set(sgs.triggeredEvents),
    pendingEncounterKind: sgs.pendingEncounterKind ?? null,
    gameTime: sgs.gameTime ?? { ...INITIAL_GAME_TIME },
    history: sgs.history ?? [],
  };
}

/** Convert runtime GameState (Set) → SavedGameState (string[]) */
function toSavedGameState(gs: GameState): SavedGameState {
  const kt = gs.character.knownTechniques ?? [];
  return {
    ...gs,
    triggeredEvents: [...gs.triggeredEvents],
    knownTechniques: kt,
    character: { ...gs.character, knownTechniques: kt },
  };
}

/** Runtime game state - same shape as SavedGameState but with Set for triggeredEvents */
interface GameState {
  character: Character;
  equipped: EquippedSlots;
  bag: EquipBase[];
  skills: Skill[];
  logs: LogEntry[];
  isIdling: boolean;
  logCounter: number;
  currentEvent: GameEvent | null;
  triggeredEvents: Set<string>;
  pendingEncounterKind: EncounterKind | null;
  /** 当前游戏内时间 */
  gameTime: GameTime;
  history: import('../types/history').CharacterHistoryEvent[];
}

function createDefaultEquipped(): EquippedSlots {
  const ironSword: EquipBase = {
    id: 'init-iron-sword', name: '铁剑', slot: 'weapon', quality: 'white',
    baseStats: { atk: 15 }, affixes: [], enhanceLevel: 0,
  };
  const clothArmor: EquipBase = {
    id: 'init-cloth-armor', name: '布甲', slot: 'armor', quality: 'white',
    baseStats: { def: 8, hp: 30 }, affixes: [], enhanceLevel: 0,
  };
  return { weapon: ironSword, armor: clothArmor, accessory1: null, accessory2: null, artifact: null };
}

function starterSkillsForRealm(realm: Realm): Skill[] {
  const idx = REALM_ORDER.indexOf(realm);
  const maxIdx = idx < 0 ? 0 : idx;
  return SKILLS_DATA.filter(s => {
    const ri = REALM_ORDER.indexOf(s.unlockRealm as Realm);
    return ri >= 0 && ri <= maxIdx;
  }).map(s => ({ ...s }));
}

function createStarterGameState(
  element: WuXing,
  name: string,
  cultivation: { realm: Realm; realmStage: RealmStage; spiritRoots: Record<SpiritRootKey, number>; gender?: Gender },
): GameState {
  const character = createInitialCharacter(element, {
    name,
    realm: cultivation.realm,
    realmStage: cultivation.realmStage,
    spiritRoots: cultivation.spiritRoots,
    gender: cultivation.gender,
  });

  const skills = starterSkillsForRealm(character.realm);
  return {
    character: { ...character, realmProgress: 0 },
    equipped: createDefaultEquipped(),
    bag: [] as EquipBase[],
    skills,
    logs: [{ id: 0, text: '欢迎踏入修仙之道……', type: 'event' as const, timestamp: Date.now() }],
    isIdling: false,
    logCounter: 1,
    currentEvent: null,
    triggeredEvents: new Set<string>(),
    pendingEncounterKind: null,
    gameTime: { ...INITIAL_GAME_TIME },
    history: [],
  };
}

interface AccountStore {
  screen: AppScreen;
  storage: Storage;
  characterSubTab: 'person' | 'techniques';

  navigateTo: (screen: AppScreen) => void;

  createAccount: (
    name: string,
    element: WuXing,
    cultivation?: { realm: Realm; realmStage: RealmStage; spiritRoots: Record<SpiritRootKey, number>; gender?: Gender },
  ) => { ok: boolean; error?: string };
  deleteAccount: (id: string) => void;
  loginAccount: (id: string) => void;
  logout: () => void;

  getActiveAccount: () => Storage['accounts'][number] | null;
  getActiveGameState: () => GameState | null;
  canCreateMore: () => boolean;
  isNameTaken: (name: string) => boolean;

  // Game actions
  startIdle: () => void;
  stopIdle: () => void;
  tickIdle: () => void;
  doBattle: () => void;
  addLog: (text: string, type: LogEntry['type']) => void;
  equipItem: (item: EquipBase) => void;
  unequipSlot: (slot: keyof EquippedSlots) => void;
  enhanceItem: (itemId: string) => void;
  resolveEvent: (optionIndex: number) => void;
  tryBreakthrough: () => void;
  tryMinorRealmBreakthrough: () => void;
  nextEncounterRound: () => void;
  executeEncounter: (kind: EncounterKind) => ExecuteEncounterResult | undefined;
  dismissEncounterSelect: () => void;
  dismissEvent: () => void;
  learnTechnique: (tech: LearnedTechnique) => void;
  getFinalStats: () => Stats;
  doRefineSpirit: (spiritType: SpiritType, amount: number) => { refined: number; wasted: number };
  navigateToEvent: (kind: EncounterKind) => void;
  navigateToGame: () => void;
  navigateToCharacter: () => void;
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  screen: 'entry',
  storage: loadStorage(),
  characterSubTab: 'person',

  navigateTo: (screen) => set({ screen }),

  createAccount: (name, element, cultivation) => {
    const s = get();
    if (s.storage.accounts.length >= MAX_ACCOUNTS) {
      return { ok: false, error: `最多只能创建 ${MAX_ACCOUNTS} 个角色` };
    }
    if (s.isNameTaken(name)) {
      return { ok: false, error: '角色名已被占用' };
    }
    const cult = cultivation ?? {
      realm: '炼气' as Realm,
      realmStage: 'early' as RealmStage,
      spiritRoots: defaultEvenSpiritRoots(),
    };
    const id = uuid();
    const now = Date.now();
    const account: Storage['accounts'][number] = {
      id, name, attribute: element, createdAt: now, lastPlayedAt: now,
    };
    const gameState = createStarterGameState(element, name, cult);

    const newStorage: Storage = {
      accounts: [...s.storage.accounts, account],
      activeAccountId: id,
      gameStates: { ...s.storage.gameStates, [id]: toSavedGameState(gameState) },
    };
    saveStorage(newStorage);
    set({ storage: newStorage, screen: 'game' });
    return { ok: true };
  },

  deleteAccount: (id) => {
    const s = get();
    const newAccounts = s.storage.accounts.filter(a => a.id !== id);
    const newGameStates = { ...s.storage.gameStates };
    delete newGameStates[id];
    const newActiveId = s.storage.activeAccountId === id ? null : s.storage.activeAccountId;
    const newStorage: Storage = { accounts: newAccounts, activeAccountId: newActiveId, gameStates: newGameStates };
    saveStorage(newStorage);
    set({ storage: newStorage, screen: 'entry' });
  },

  loginAccount: (id) => {
    const s = get();
    const account = s.storage.accounts.find(a => a.id === id);
    if (!account) return;
    const now = Date.now();
    const newAccounts = s.storage.accounts.map(a => a.id === id ? { ...a, lastPlayedAt: now } : a);
    const newStorage: Storage = { ...s.storage, accounts: newAccounts, activeAccountId: id };
    saveStorage(newStorage);
    set({ storage: newStorage, screen: 'game' });
  },

  logout: () => {
    const s = get();
    const newStorage: Storage = { ...s.storage, activeAccountId: null };
    saveStorage(newStorage);
    set({ storage: newStorage, screen: 'entry' });
  },

  getActiveAccount: () => {
    const s = get();
    if (!s.storage.activeAccountId) return null;
    return s.storage.accounts.find(a => a.id === s.storage.activeAccountId) ?? null;
  },

  getActiveGameState: () => {
    const s = get();
    if (!s.storage.activeAccountId) return null;
    const sgs = s.storage.gameStates[s.storage.activeAccountId];
    if (!sgs) return null;
    return toGameState(sgs);
  },

  canCreateMore: () => get().storage.accounts.length < MAX_ACCOUNTS,

  isNameTaken: (name) => get().storage.accounts.some(a => a.name === name),

  // ── Game delegates ──────────────────────────────────────────────────────

  startIdle: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    gs.isIdling = true;
    setStorageGameState(id, gs);
  },

  stopIdle: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    gs.isIdling = false;
    setStorageGameState(id, gs);
  },

  addLog: (text, type) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const entry: LogEntry = { id: gs.logCounter, text, type, timestamp: Date.now() };
    gs.logs = [...gs.logs.slice(-99), entry];
    gs.logCounter += 1;
    setStorageGameState(id, gs);
  },

  getFinalStats: () => {
    const gs = get().getActiveGameState();
    if (!gs) return { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, wil: 0 };
    const eqBonus = getTotalEquipmentBonus(gs.equipped);
    const skBonus: Partial<Stats> = {};
    for (const sk of gs.skills) {
      if (sk.type === 'passive' || sk.type === 'talent') {
        for (const eff of sk.effects) {
          if (eff.type === 'buff' && eff.buffStat && eff.buffValue) {
            skBonus[eff.buffStat] = (skBonus[eff.buffStat] ?? 0) + eff.buffValue;
          }
        }
      }
    }
    return calculateFinalStats(gs.character, eqBonus, skBonus);
  },

  tickIdle: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    gs.gameTime = advanceDays(gs.gameTime, 1);
    get().addLog(`⏱ 挂机 1 天`, 'idle');
    let char = addExp(gs.character, IDLE_EXP_PER_TICK);
    const gold = char.gold + IDLE_GOLD_PER_TICK;
    get().addLog(`静坐吐纳…获得 ${IDLE_EXP_PER_TICK} 经验、${IDLE_GOLD_PER_TICK} 金石`, 'reward');

    const evt = checkEventTrigger({ ...char, gold }, gs.triggeredEvents);
    if (evt) {
      gs.triggeredEvents = new Set([...gs.triggeredEvents, evt.id]);
      gs.currentEvent = evt;
      get().addLog(`奇遇触发：${evt.title}`, 'event');
    }
    gs.character = { ...char, gold };
    setStorageGameState(id, gs);
  },

  doBattle: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const stats = get().getFinalStats();
    if (stats.hp <= 0) {
      get().addLog('你已力竭，无法战斗', 'battle');
      return;
    }

    const eligible = MONSTERS_DATA.filter(m => m.level <= gs.character.level + 10);
    const monster = eligible[Math.floor(Math.random() * eligible.length)] ?? MONSTERS_DATA[0];
    const result = simulateBattle(stats, gs.character.element, gs.character.level, monster);

    get().addLog(`⚔ 遭遇 ${monster.name}！`, 'battle');
    for (const l of result.log) get().addLog(l, 'battle');

    let char = { ...gs.character, exp: gs.character.exp + result.expGained, gold: gs.character.gold + result.goldGained };
    while (char.exp >= expToNextLevel(char.level)) {
      char = { ...char, level: char.level + 1, exp: char.exp - expToNextLevel(char.level - 1) };
      get().addLog(`🌟 突破成功！晋升至 ${char.level} 层！`, 'levelup');
    }

    gs.character = char;

    if (result.victory) {
      get().addLog(`✨ 击败 ${monster.name}！获得 ${result.expGained} 经验、${result.goldGained} 金石`, 'reward');
      if (result.drops.length > 0) {
        for (const d of result.drops) get().addLog(`🎁 获得装备【${d.name}】！`, 'drop');
        gs.bag = [...gs.bag, ...result.drops];
      }
    } else {
      get().addLog(`💀 败于 ${monster.name}，灵力护体，勉强脱身`, 'battle');
    }

    const evt = checkEventTrigger(char, gs.triggeredEvents);
    if (evt) {
      gs.triggeredEvents = new Set([...gs.triggeredEvents, evt.id]);
      gs.currentEvent = evt;
      get().addLog(`奇遇触发：${evt.title}`, 'event');
    }

    setStorageGameState(id, gs);
  },

  equipItem: (item) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const slot = item.slot as keyof EquippedSlots;
    const current = gs.equipped[slot];
    let bag = gs.bag.filter((b: EquipBase) => b.id !== item.id);
    if (current) bag = [...bag, current];
    gs.equipped = { ...gs.equipped, [slot]: item };
    gs.bag = bag;
    setStorageGameState(id, gs);
  },

  unequipSlot: (slot) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const item = gs.equipped[slot];
    if (!item) return;
    gs.equipped = { ...gs.equipped, [slot]: null };
    gs.bag = [...gs.bag, item];
    setStorageGameState(id, gs);
  },

  enhanceItem: (itemId) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const idx = gs.bag.findIndex((b: EquipBase) => b.id === itemId);
    if (idx === -1) return;
    const item = gs.bag[idx];
    const cost = item.enhanceLevel * 1000;
    if (gs.character.gold < cost) return;
    const newItem = { ...item, enhanceLevel: item.enhanceLevel + 1 };
    const bag = [...gs.bag];
    bag[idx] = newItem;
    gs.bag = bag;
    gs.character = { ...gs.character, gold: gs.character.gold - cost };
    setStorageGameState(id, gs);
  },

  resolveEvent: (optionIndex) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    if (!gs.currentEvent) return;
    const option = gs.currentEvent.options[optionIndex];
    if (!option) return;

    let char: Character = { ...gs.character };
    const reward = option.reward;

    if (reward.statBonus) {
      const bonus: Partial<Stats> = { ...char.bonusFromEvents };
      for (const [k, v] of Object.entries(reward.statBonus)) {
        bonus[k as keyof Stats] = (bonus[k as keyof Stats] ?? 0) + v;
      }
      char.bonusFromEvents = bonus;
    }
    if (reward.expBonus) char = addExp(char, reward.expBonus);
    if (reward.goldBonus) char.gold += reward.goldBonus;

    const timeCost = option.timeCost ?? 1;
    gs.gameTime = advanceDays(gs.gameTime, timeCost);
    get().addLog(`⏱ 消耗 ${timeCost} 天`, 'event');

    // 灵气吸收（遭遇结算）
    if (reward.spiritReward) {
      const actualReward = applyEventReward(char, reward.spiritReward);
      const { char: charAfter, result } = applySpiritAbsorptionFromReward(char, actualReward);
      char = charAfter;
      const parts = describeSpiritAbsorption(result);
      if (parts.length > 0) {
        get().addLog(`🌿 灵气吸纳：${parts.join(' · ')}`, 'reward');
      }
    }

    get().addLog(`📜 ${option.resultText}`, 'event');

    gs.character = char;
    gs.currentEvent = null;

    if (reward.equipment) {
      gs.bag = [...gs.bag, reward.equipment];
      get().addLog(`🎁 获得装备【${reward.equipment.name}】！`, 'drop');
    }

    setStorageGameState(id, gs);
  },

  tryMinorRealmBreakthrough: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    if (gs.character.realmStage === 'late') {
      get().addLog('已至当前大境界圆满，请以丹药冲破关隘', 'event');
      return;
    }
    const prevStage = gs.character.realmStage;
    const upgraded = advanceMinorRealmIfEligible(gs.character);
    if (upgraded.realmStage === prevStage) {
      get().addLog('七类灵气均需达到当前上限方可晋升小境界', 'event');
      return;
    }
    gs.character = upgraded;
    get().addLog(`✨ 小境界突破 → ${realmDisplayLabel(upgraded.realm, upgraded.realmStage)}`, 'levelup');
    setStorageGameState(id, gs);
  },

  tryBreakthrough: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const prev = gs.character;
    const next = performMajorRealmBreakthrough(prev);
    if (!next) {
      get().addLog('大境界契机未至（须处在后期、七类灵气已满，并服食对应一枚丹药）', 'event');
      return;
    }
    get().addLog(`🌟🌟🌟 大境界突破！晋入 ${realmDisplayLabel(next.realm, next.realmStage)}`, 'levelup');
    const realm = next.realm;
    const newSkills = SKILLS_DATA.filter(sk => sk.unlockRealm === realm);
    const existingIds = new Set(gs.skills.map(sk => sk.id));
    const toAdd = newSkills.filter(sk => !existingIds.has(sk.id)).map(sk => ({ ...sk }));
    gs.character = next;
    gs.skills = [...gs.skills, ...toAdd];
    setStorageGameState(id, gs);
  },

  nextEncounterRound: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    get().addLog(`── 三象：吸纳灵气 · 奇遇 · 争斗 ──`, 'event');
    setStorageGameState(id, gs);
  },

  executeEncounter: (encounter) => {
    const id = get().storage.activeAccountId;
    if (!id) return undefined;

    const gs = toGameState(get().storage.gameStates[id]);
    get().addLog(`机缘落定：「${({ absorb: '吸纳灵气', wonder: '奇遇', battle: '争斗' }[encounter])}」`, 'event');

    const charBeforeEncounter = gs.character;
    let char = charBeforeEncounter;
    const cap = getSpiritQiCap(charBeforeEncounter.realm, charBeforeEncounter.realmStage);

    let absorbReward: Record<string, number> | null = null;
    let wonderMeta: { drops: string[]; techniqueDrop?: LearnedTechnique; spiritReward?: SpiritReward } | null = null;
    let battleMeta: { victory: boolean; foe: string; lossFrac: number } | null = null;

    switch (encounter) {
      case 'absorb': {
        const { element, raw } = rollAbsorbEncounter();
        absorbReward = { [element]: raw };
        const r = applySpiritAbsorption(char, absorbReward);
        char = r.char;
        const label = SPIRIT_ROOT_LABELS[element];
        const parts = [
          `${label}灵气基数 ${raw}，炼入 +${Math.floor(r.stored)}`,
          `乾吸收 +${r.qianStored}`,
          `坤吸收 +${r.kunStored}`,
        ];
        if (r.overflowLost > 0.0001) parts.push(`超上限散失 ${r.overflowLost.toFixed(1)}`);
        get().addLog(parts.join(' · '), 'reward');
        break;
      }
      case 'wonder': {
        const w = grantWonderLoot(char);
        char = w.char;
        wonderMeta = {
          drops: w.drops,
          techniqueDrop: w.techniqueDrop,
          spiritReward: w.spiritReward,
        };
        get().addLog(`奇遇收获：${w.drops.join('、')}`, 'reward');
        if (w.techniqueDrop) {
          const tech = w.techniqueDrop;
          const techKey = techniqueInventoryKey(tech);
          const updatedInventory = { ...char.inventory };
          updatedInventory[techKey] = (updatedInventory[techKey] ?? 0) + 1;
          const techniqueStash = { ...char.techniqueStash };
          techniqueStash[tech.instanceId] = tech;
          char = { ...char, inventory: updatedInventory, techniqueStash };
          get().addLog(`🎁 获得功法【${tech.name}】！`, 'drop');
        }
        if (w.spiritReward) {
          const spiritParts: string[] = [];
          for (const [k, v] of Object.entries(w.spiritReward)) {
            if (v) spiritParts.push(`${SPIRIT_ROOT_LABELS[k as SpiritType]} +${v}`);
          }
          if (spiritParts.length > 0) get().addLog(`灵气吸收：${spiritParts.join('、')}`, 'reward');
        }
        break;
      }
      case 'battle': {
        const b = runRandomBattleQi(char);
        char = b.char;
        battleMeta = { victory: b.victory, foe: b.foe, lossFrac: b.lossFrac };
        if (b.victory) {
          get().addLog(`⚔ 历练胜利！击败${b.foe}！`, 'battle');
        } else {
          get().addLog(`⚔ 历练失败，灵气损耗${Math.round(b.lossFrac * 100)}%`, 'battle');
        }
        break;
      }
    }

    char = advanceMinorRealmIfEligible(char);

    const timeCost = encounter === 'absorb' ? 7 : encounter === 'wonder' ? 10 : 7;
    gs.gameTime = advanceDays(gs.gameTime, timeCost);

    gs.character = char;
    setStorageGameState(id, gs);

    if (encounter === 'absorb' && absorbReward) {
      return { kind: 'absorb', charBefore: charBeforeEncounter, charAfter: char, spiritReward: absorbReward, cap };
    }
    if (encounter === 'wonder' && wonderMeta) {
      return {
        kind: 'wonder',
        charBefore: charBeforeEncounter,
        charAfter: char,
        cap,
        drops: wonderMeta.drops,
        techniqueDrop: wonderMeta.techniqueDrop,
        spiritReward: wonderMeta.spiritReward,
      };
    }
    if (encounter === 'battle' && battleMeta) {
      return {
        kind: 'battle',
        charBefore: charBeforeEncounter,
        charAfter: char,
        victory: battleMeta.victory,
        foe: battleMeta.foe,
        lossFrac: battleMeta.lossFrac,
      };
    }
    return undefined;
  },

  dismissEncounterSelect: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    setStorageGameState(id, gs);
  },

  learnTechnique: (tech) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    const char = gs.character;

    if ((char.knownTechniques ?? []).some(t => t.instanceId === tech.instanceId)) return;

    const techKey = techniqueInventoryKey(tech);
    const updatedInventory = { ...char.inventory };
    const count = updatedInventory[techKey] ?? 0;
    if (count <= 0) return;
    if (count <= 1) delete updatedInventory[techKey];
    else updatedInventory[techKey] = count - 1;

    const techniqueStash = { ...char.techniqueStash };
    delete techniqueStash[tech.instanceId];

    const knownTechniques = [...(char.knownTechniques ?? []), tech];
    gs.character = { ...char, knownTechniques, inventory: updatedInventory, techniqueStash };
    get().addLog(`学会了功法【${tech.name}】！`, 'reward');
    setStorageGameState(id, gs);
  },

  dismissEvent: () => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    gs.currentEvent = null;
    setStorageGameState(id, gs);
  },

  doRefineSpirit: (spiritType: SpiritType, amount: number): { refined: number; wasted: number } => {
    const id = get().storage.activeAccountId;
    if (!id) return { refined: 0, wasted: 0 };
    const gs = toGameState(get().storage.gameStates[id]);
    const { char, refined, wasted } = refineSpiritToProgress(gs.character, spiritType, amount);
    gs.character = char;
    const progressName = REALM_PROGRESS_NAMES[char.realm];
    const label = SPIRIT_ROOT_LABELS[spiritType as keyof typeof SPIRIT_ROOT_LABELS];
    const logParts = [`${label}灵气 ×${amount}`];
    if (refined > 0) logParts.push(`→ ${progressName} +${refined}`);
    if (wasted > 0.0001) logParts.push(`散逸 ${wasted.toFixed(1)}`);
    get().addLog(logParts.join(' '), 'reward');
    gs.gameTime = advanceDays(gs.gameTime, ZHOU_TIAN_DAYS);
    get().addLog(`⏱ 周天运转消耗 ${ZHOU_TIAN_DAYS} 天`, 'event');
    setStorageGameState(id, gs);
    return { refined, wasted };
  },

  navigateToEvent: (kind) => {
    const id = get().storage.activeAccountId;
    if (!id) return;
    const gs = toGameState(get().storage.gameStates[id]);
    gs.pendingEncounterKind = kind;
    setStorageGameState(id, gs);
    set({ screen: 'event' });
  },

  navigateToGame: () => {
    const id = get().storage.activeAccountId;
    if (id) {
      const gs = toGameState(get().storage.gameStates[id]);
      if (gs.pendingEncounterKind) {
        gs.pendingEncounterKind = null;
        setStorageGameState(id, gs);
      }
    }
    set({ screen: 'game' });
  },

  navigateToCharacter: (tab?: 'person' | 'techniques') => {
    set({ characterSubTab: tab ?? 'person' });
    set({ screen: 'character' });
  },
}));

/** Helper to update a game state in storage (converts Set→string[]) */
export function setStorageGameState(id: string, gs: GameState) {
  const s = useAccountStore.getState();
  const newStorage: Storage = {
    ...s.storage,
    gameStates: { ...s.storage.gameStates, [id]: toSavedGameState(gs) },
  };
  saveStorage(newStorage);
  useAccountStore.setState({ storage: newStorage });
}
