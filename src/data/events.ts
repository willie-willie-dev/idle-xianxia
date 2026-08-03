import type { GameEvent } from '../types';

export const EVENTS_DATA: GameEvent[] = [
  {
    id: 'spring',
    title: '灵泉洗礼',
    description: '你发现了一处隐秘的灵泉，泉水散发着淡淡灵光。饮之可固本培元，浸之可淬炼肉身。',
    type: '奇遇',
    realmRange: ['炼气', '炼气'],
    options: [
      {
        text: '饮用灵泉',
        resultText: '灵力灌体，全身经脉通畅！',
        timeCost: 10,
        reward: {
          statBonus: { hp: 50, mp: 20 },
          spiritReward: { water: 42, fire: 24, wood: 22, metal: 16, earth: 18 },
        },
      },
      {
        text: '浸泡全身',
        resultText: '你感到力量涌动，但泉水冰凉刺骨…',
        timeCost: 15,
        reward: {
          statBonus: { atk: 5, def: -3 },
          spiritReward: { water: 58, earth: 31 },
        },
      },
    ],
    triggerChance: 0.08,
    oneTime: false,
  },
  {
    id: 'spirit_rich',
    title: '灵气浓郁',
    description: '此地五行之一格外充沛，相生两系亦随之盈满，正是吐纳良机。',
    type: '机缘',
    realmRange: ['炼气', '炼气'],
    options: [
      {
        text: '引火系灵气入体',
        resultText: '火气蒸腾，木薪土载，丹田暖热。',
        timeCost: 7,
        reward: {
          spiritReward: { fire: 165, wood: 88, earth: 76 },
        },
      },
      {
        text: '引水系灵气入体',
        resultText: '水意流淌，金源木汇，周天清朗。',
        timeCost: 7,
        reward: {
          spiritReward: { water: 172, metal: 95, wood: 82 },
        },
      },
    ],
    triggerChance: 0.065,
    oneTime: false,
  },
  {
    id: 'spirit_poor',
    title: '灵气贫瘠',
    description: '周遭灵脉稀薄，仅余一丝五行痕迹，你只能勉强撷取微薄灵气。',
    type: '危机',
    realmRange: ['炼气', '炼气'],
    options: [
      {
        text: '枯坐感悟金脉',
        resultText: '土载金敛，水光微漪，只得点滴。',
        timeCost: 7,
        reward: {
          spiritReward: { metal: 55, earth: 36, water: 28 },
        },
      },
      {
        text: '枯坐感悟木脉',
        resultText: '水滋木蔓，火化星点，精进有限。',
        timeCost: 7,
        reward: {
          spiritReward: { wood: 48, water: 26, fire: 21 },
        },
      },
    ],
    triggerChance: 0.07,
    oneTime: false,
  },
];
