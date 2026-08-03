export type { GameTime } from './time';
export { EPOCH_START_YEAR, ZHOU_TIAN_DAYS, IDLE_TICK_DAYS, isLeapYear, getDaysInMonth, getDaysInYear, advanceDays, formatGameTime, INITIAL_GAME_TIME } from './time';

export type {
  Realm, WuXing, Gender, Stats, StatKey, GrowthRates, RealmConfig,
  Character, SpiritRootKey, RealmStage,
} from './character';
export {
  WUXING_GROWTH,
  SPIRIT_ROOT_KEYS,
  SPIRIT_ROOT_LABELS,
  REALM_STAGE_LABEL,
  REALM_STAGE_RANK,
  MAJOR_REALM_SPIRIT_CAP,
  REALM_STAGE_PROGRESS_CAP,
  getRealmProgressCap,
  REALM_MAJOR_BREAKTHROUGH_ITEM,
  realmMajorBreakthroughConsumedItem,
  defaultEvenSpiritRoots,
  emptySpiritQi,
  patchCharacter,
  GENDER_LABELS,
} from './character';
export type { EquipSlot, Quality, Affix, EquipBase, SetEffect, EquippedSlots } from './equipment';
export type { SkillType, SkillTarget, EffectType, SkillEffect, Skill } from './skill';
export type { EventType, EventReward, EventOption, GameEvent, EventHistory } from './event';
export type { Buff, Combatant, BattleResult, Monster, LogEntry } from './combat';
export * from './history';
export type { LearnedTechnique } from './technique';
export { techniqueInventoryKey, instanceIdFromTechniqueInventoryKey } from './technique';
