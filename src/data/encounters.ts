import type { EncounterKind } from '../systems/cultivationSystem';

export interface EncounterOption {
  kind: EncounterKind;
  icon: string;
  name: string;
  desc: string;
}

export const ENCOUNTER_OPTIONS: EncounterOption[] = [
  {
    kind: 'absorb',
    icon: '🌿',
    name: '吸纳灵气',
    desc: '汲取天地灵气，巩固灵根修为',
  },
  {
    kind: 'wonder',
    icon: '🎁',
    name: '奇遇探宝',
    desc: '机缘巧合，或有意外收获',
  },
  {
    kind: 'battle',
    icon: '⚔',
    name: '争斗切磋',
    desc: '与其他修士交锋，胜则有所斩获',
  },
  {
    kind: 'absorb', // placeholder for 4th slot
    icon: '⚠',
    name: '危机四伏',
    desc: '待开发选项',
  },
];
