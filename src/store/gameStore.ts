import { create } from 'zustand';
import type { Character, EquipBase, EquippedSlots, LogEntry, GameEvent, Skill } from '../types';
import { createInitialCharacter, addExp, calculateFinalStats, canBreakthrough, breakthrough, expToNextLevel } from '../systems/characterSystem';
import { getTotalEquipmentBonus } from '../systems/equipmentSystem';
import { simulateBattle } from '../systems/combatSystem';
import { checkEventTrigger } from '../systems/eventSystem';
import { MONSTERS_DATA, IDLE_EXP_PER_TICK, IDLE_GOLD_PER_TICK } from '../data/monsters';
import { SKILLS_DATA } from '../data/skills';

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
  dismissEvent: () => void;

  getFinalStats: () => ReturnType<typeof calculateFinalStats>;
}

const initialChar = createInitialCharacter();

const ironSword: EquipBase = {
  id: 'init-iron-sword', name: '铁剑', slot: 'weapon', quality: 'white',
  baseStats: { atk: 15 }, affixes: [], enhanceLevel: 0,
};
const clothArmor: EquipBase = {
  id: 'init-cloth-armor', name: '布甲', slot: 'armor', quality: 'white',
  baseStats: { def: 8, hp: 30 }, affixes: [], enhanceLevel: 0,
};

const initialSkills: Skill[] = SKILLS_DATA.filter(s => s.unlockRealm === '炼气').map(s => ({ ...s }));

export const useGameStore = create<GameState>((set, get) => ({
  character: initialChar,
  equipped: { weapon: ironSword, armor: clothArmor, accessory1: null, accessory2: null, artifact: null },
  bag: [],
  skills: initialSkills,
  logs: [{ id: 0, text: '欢迎踏入修仙之道……', type: 'idle', timestamp: Date.now() }],
  isIdling: false,
  logCounter: 1,
  currentEvent: null,
  triggeredEvents: new Set<string>(),

  addLog: (text, type) => set(s => {
    const id = s.logCounter;
    return {
      logs: [...s.logs.slice(-99), { id, text, type, timestamp: Date.now() }],
      logCounter: id + 1,
    };
  }),

  startIdle: () => set({ isIdling: true }),
  stopIdle: () => set({ isIdling: false }),

  getFinalStats: () => {
    const s = get();
    const eqBonus = getTotalEquipmentBonus(s.equipped);
    const skBonus: Record<string, number> = {};
    for (const sk of s.skills) {
      if (sk.type === 'passive' || sk.type === 'talent') {
        for (const eff of sk.effects) {
          if (eff.type === 'buff' && eff.buffStat && eff.buffValue) {
            skBonus[eff.buffStat] = (skBonus[eff.buffStat] ?? 0) + eff.buffValue;
          }
        }
      }
    }
    return calculateFinalStats(s.character, eqBonus, skBonus);
  },

  tickIdle: () => {
    const s = get();
    const char = addExp(s.character, IDLE_EXP_PER_TICK);
    const gold = char.gold + IDLE_GOLD_PER_TICK;
    s.addLog(`修炼中…获得 ${IDLE_EXP_PER_TICK} 经验、${IDLE_GOLD_PER_TICK} 金币`, 'idle');

    const evt = checkEventTrigger({ ...char, gold }, s.triggeredEvents);
    if (evt) {
      set(s => ({ triggeredEvents: new Set([...s.triggeredEvents, evt.id]) }));
      set({ currentEvent: evt });
      s.addLog(`奇遇触发：${evt.title}`, 'event');
    }

    set({ character: { ...char, gold } });
  },

  doBattle: () => {
    const s = get();
    const stats = s.getFinalStats();
    if (stats.hp <= 0) {
      s.addLog('你已力竭，无法战斗', 'battle');
      return;
    }

    const eligible = MONSTERS_DATA.filter(m => m.level <= s.character.level + 10);
    const monster = eligible[Math.floor(Math.random() * eligible.length)] ?? MONSTERS_DATA[0];
    const result = simulateBattle(stats, s.character.element, s.character.level, monster);

    s.addLog(`⚔ 遭遇 ${monster.name}！`, 'battle');
    for (const l of result.log) s.addLog(l, 'battle');

    let char = { ...s.character, exp: s.character.exp + result.expGained, gold: s.character.gold + result.goldGained };
    while (char.exp >= expToNextLevel(char.level)) {
      char = { ...char, level: char.level + 1, exp: char.exp - expToNextLevel(char.level - 1) };
      s.addLog(`🌟 突破成功！晋升至 ${char.level} 层！`, 'levelup');
    }

    if (result.victory) {
      s.addLog(`✨ 击败 ${monster.name}！获得 ${result.expGained} 经验、${result.goldGained} 金币`, 'reward');
      if (result.drops.length > 0) {
        for (const d of result.drops) {
          s.addLog(`🎁 获得装备【${d.name}】！`, 'drop');
        }
        set(s => ({ bag: [...s.bag, ...result.drops] }));
      }
    } else {
      s.addLog(`💀 败于 ${monster.name}，灵力护体，勉强脱身`, 'battle');
    }

    set({ character: char });

    const evt = checkEventTrigger(char, s.triggeredEvents);
    if (evt) {
      set(s => ({ triggeredEvents: new Set([...s.triggeredEvents, evt.id]) }));
      set({ currentEvent: evt });
      s.addLog(`奇遇触发：${evt.title}`, 'event');
    }
  },

  equipItem: (item) => set(s => {
    const slot = item.slot;
    const current = s.equipped[slot];
    let bag = s.bag.filter(b => b.id !== item.id);
    if (current) bag = [...bag, current];
    return { equipped: { ...s.equipped, [slot]: item }, bag };
  }),

  unequipSlot: (slot) => set(s => {
    const item = s.equipped[slot];
    if (!item) return s;
    return { equipped: { ...s.equipped, [slot]: null }, bag: [...s.bag, item] };
  }),

  enhanceItem: (itemId) => set(s => {
    const idx = s.bag.findIndex(b => b.id === itemId);
    if (idx === -1) return s;
    const item = s.bag[idx];
    const cost = item.enhanceLevel * 1000;
    if (s.character.gold < cost) return s;
    const newItem = { ...item, enhanceLevel: item.enhanceLevel + 1 };
    const bag = [...s.bag];
    bag[idx] = newItem;
    return { bag, character: { ...s.character, gold: s.character.gold - cost } };
  }),

  tryBreakthrough: () => {
    const s = get();
    if (!canBreakthrough(s.character)) {
      s.addLog('境界突破条件不满足', 'idle');
      return;
    }
    const char = breakthrough(s.character);
    s.addLog(`🌟🌟🌟 境界突破！晋升${char.realm}境！`, 'levelup');
    const newSkills = SKILLS_DATA.filter(sk => sk.unlockRealm === char.realm);
    set(s => {
      const existingIds = new Set(s.skills.map(sk => sk.id));
      const toAdd = newSkills.filter(sk => !existingIds.has(sk.id)).map(sk => ({ ...sk }));
      return { character: char, skills: [...s.skills, ...toAdd] };
    });
  },

  resolveEvent: (optionIndex) => {
    const s = get();
    if (!s.currentEvent) return;
    const option = s.currentEvent.options[optionIndex];
    if (!option) return;

    let char = { ...s.character };
    const reward = option.reward;

    if (reward.statBonus) {
      const bonus = { ...char.bonusFromEvents };
      for (const [k, v] of Object.entries(reward.statBonus)) {
        bonus[k as keyof typeof bonus] = (bonus[k as keyof typeof bonus] ?? 0) + v;
      }
      char.bonusFromEvents = bonus;
    }
    if (reward.expBonus) {
      char = addExp(char, reward.expBonus);
    }
    if (reward.goldBonus) {
      char.gold += reward.goldBonus;
    }

    s.addLog(`📜 ${option.resultText}`, 'event');
    set({ character: char, currentEvent: null });

    if (reward.equipment) {
      set(s => ({ bag: [...s.bag, reward.equipment!] }));
      s.addLog(`🎁 获得装备【${reward.equipment.name}】！`, 'drop');
    }
  },

  dismissEvent: () => set({ currentEvent: null }),
}));
