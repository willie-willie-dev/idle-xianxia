import type { Stats, Realm } from './character';
import type { EquipBase } from './equipment';

export type EventType = '奇遇' | '机缘' | '抉择' | '危机';

export interface EventReward {
  statBonus?: Partial<Stats>;
  expBonus?: number;
  goldBonus?: number;
  equipment?: EquipBase;
  followUpEventId?: string;
}

export interface EventOption {
  text: string;
  resultText: string;
  reward: EventReward;
  condition?: { realm?: Realm; statReq?: Partial<Stats> };
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  realmRange: [Realm, Realm];
  options: EventOption[];
  triggerChance: number;
  oneTime: boolean;
}

export interface EventHistory {
  eventId: string;
  chosenOptionIndex: number;
  timestamp: number;
}
