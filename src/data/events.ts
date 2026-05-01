import type { GameEvent } from '../types';

export const EVENTS_DATA: GameEvent[] = [
  {
    id: 'spring', title: '灵泉洗礼',
    description: '你发现了一处隐秘的灵泉，泉水散发着淡淡灵光。饮之可固本培元，浸之可淬炼肉身。',
    type: '奇遇', realmRange: ['炼气', '筑基'],
    options: [
      { text: '饮用灵泉', resultText: '灵力灌体，全身经脉通畅！', reward: { statBonus: { hp: 50, mp: 20 } } },
      { text: '浸泡全身', resultText: '你感到力量涌动，但泉水冰凉刺骨...', reward: { statBonus: { atk: 5, def: -3 } } },
    ],
    triggerChance: 0.08, oneTime: false,
  },
  {
    id: 'cave-treasure', title: '山洞遗宝',
    description: '一个隐蔽的山洞入口被藤蔓遮掩，隐约透出灵光。洞内或有宝物，或有凶险。',
    type: '机缘', realmRange: ['炼气', '筑基'],
    options: [
      { text: '进入探索', resultText: '你在洞中找到了前人遗留的宝物！', reward: { goldBonus: 200 } },
      { text: '谨慎观察', resultText: '你发现了洞口的阵法痕迹，获得启示。', reward: { expBonus: 100 } },
    ],
    triggerChance: 0.06, oneTime: false,
  },
  {
    id: 'secret-realm', title: '秘境探险',
    description: '一道空间裂缝出现在你面前，裂缝另一端灵气充沛，似是一处上古秘境。',
    type: '抉择', realmRange: ['金丹', '元婴'],
    options: [
      { text: '深入秘境', resultText: '你在秘境中获得了上古修士的传承！', reward: { statBonus: { atk: 15, def: 10 } } },
      { text: '在外警戒', resultText: '你捕获了从秘境中逃出的灵兽，获得奖励。', reward: { statBonus: { hp: 100 } } },
    ],
    triggerChance: 0.05, oneTime: false,
  },
  {
    id: 'ancient-ruin', title: '古修遗府',
    description: '一座破旧的修士洞府出现在眼前，门上刻着古老符文。其中或有大机缘。',
    type: '机缘', realmRange: ['金丹', '元婴'],
    options: [
      { text: '强行破门', resultText: '机关触发！但你还是拿到了宝物。', reward: { statBonus: { hp: -30 }, goldBonus: 500 } },
      { text: '仔细研究符文', resultText: '符文自然消散，门缓缓打开。', reward: { expBonus: 500 }, condition: { realm: '元婴' } },
    ],
    triggerChance: 0.05, oneTime: true,
  },
  {
    id: 'heavenly-tribulation', title: '天劫洗礼',
    description: '乌云密布，天道劫雷凝聚成形。若能扛过，道心更加坚固。',
    type: '危机', realmRange: ['化神', '渡劫'],
    options: [
      { text: '硬抗天劫', resultText: '劫雷轰击，你身受重伤但道心更坚。', reward: { statBonus: { atk: 25, hp: -200 } } },
      { text: '以阵法化解', resultText: '你布下防御阵法，成功化解大部分劫雷。', reward: { statBonus: { def: 15 } } },
    ],
    triggerChance: 0.04, oneTime: false,
  },
  {
    id: 'dao-test', title: '天道考验',
    description: '天地间一声巨响，一道威严的声音传来："道友，何为道？"你感觉修为将因此考验而改变。',
    type: '抉择', realmRange: ['大乘', '仙人'],
    options: [
      { text: '道在心中', resultText: '天道认可你的道心，赐予无上造化！', reward: { statBonus: { atk: 50, def: 30, hp: 500 } } },
      { text: '道法自然', resultText: '天地灵气涌入体内，修为大进。', reward: { expBonus: 2000, statBonus: { mp: 200 } } },
    ],
    triggerChance: 0.03, oneTime: true,
  },
];
