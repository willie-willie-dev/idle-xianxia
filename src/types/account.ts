import type { WuXing } from '../types';
import type { Character } from './character';
import type { EquipBase, EquippedSlots } from './equipment';
import type { Skill } from './skill';
import type { GameEvent } from './event';
import type { LogEntry } from './combat';
import type { EncounterKind } from '../systems/cultivationSystem';
import type { GameTime } from './time';
import type { CharacterHistoryEvent } from './history';
import type { LearnedTechnique } from './technique';

export interface Account {
  id: string;
  name: string;
  attribute: WuXing;
  createdAt: number;
  lastPlayedAt: number;
}

/**
 * Same as GameState but with triggeredEvents as string[] (for localStorage serialization)
 * and pendingEncounterKind (runtime navigation state — not persisted).
 */
export interface SavedGameState {
  character: Character;
  equipped: EquippedSlots;
  bag: EquipBase[];
  skills: Skill[];
  logs: LogEntry[];
  isIdling: boolean;
  logCounter: number;
  currentEvent: GameEvent | null;
  triggeredEvents: string[];
  history: CharacterHistoryEvent[];
  /** Runtime-only: which encounter kind is pending for EventScreen. Not persisted. */
  pendingEncounterKind?: EncounterKind | null;
  /** 游戏内时间 */
  gameTime?: GameTime;
  /** 冗余：兼容旧存档，优先使用 character.knownTechniques */
  knownTechniques?: LearnedTechnique[];
}

export interface Storage {
  accounts: Account[];
  activeAccountId: string | null;
  gameStates: Record<string, SavedGameState>;
}

export type AppScreen = 'entry' | 'create' | 'game' | 'event' | 'character';