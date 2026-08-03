export type HistoryEventType = 
  | 'battle'      // 历练
  | 'refine'      // 周天
  | 'breakthrough_major' // 大境界突破
  | 'breakthrough_minor' // 小境界突破
  | 'absorb';     // 灵气吸收

export interface CharacterHistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: number;
  description: string;
  // 历练相关
  foe?: string;
  victory?: boolean;
  // 周天相关
  refinedAmount?: number;
  // 突破相关
  fromRealm?: string;
  toRealm?: string;
  fromStage?: string;
  toStage?: string;
}

export interface CharacterHistory {
  characterId: string;
  events: CharacterHistoryEvent[];
}