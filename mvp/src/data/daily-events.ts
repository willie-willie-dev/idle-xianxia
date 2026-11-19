/**
 * 日常事件：9 条，炼气 / 筑基 / 金丹各 3 条，按前期、中期、后期排列。
 *
 * 可复用的琐事：采药、挑水、守夜、赶集、帮工、试药、巡山、抄经、修补法阵。
 * 只给修为，并偶尔掉普通消耗品（止血草、回气丹、聚元丹）。
 */

import type { GameEvent } from '../event/types.ts';

export const DAILY_EVENTS: readonly GameEvent[] = [
  // ── 炼气 3 条 ─────────────────────────────────────────────
  {
    id: 'daily-lianqi-01',
    kind: 'daily',
    realm: '炼气',
    stage: '前期',
    title: '山坡采药',
    text: '后山坡上露水未干，止血草伏在石缝里。你挎着竹篓，一株一株地认过去。',
    options: [
      {
        text: '顺着坡往上多采一阵',
        cultivationGain: 7,
        staminaCost: 8,
        itemGrants: ['zhixue-cao'],
        outcome:
          '你爬到坡顶，指尖被草叶割出细口，篓里却多了一把叶脉完整的止血草。下山时腿发软，掌心的凉意却一直留到洞府门口。',
      },
      {
        text: '只在近处摘够即回',
        cultivationGain: 5,
        outcome:
          '你在坡脚摘了小半篓，没有再往上爬。回到洞府，草叶还沾着露，你把它们摊在石板上阴干。',
      },
    ],
  },
  {
    id: 'daily-lianqi-02',
    kind: 'daily',
    realm: '炼气',
    stage: '中期',
    title: '溪边挑水',
    text: '晨课前，你挑着空桶下到溪边，水面还冒着一层薄白的雾。',
    options: [
      {
        text: '连挑三趟，把缸灌满',
        cultivationGain: 8,
        staminaCost: 10,
        outcome:
          '扁担压在肩上，第三趟时你脚步已经发飘。最后一桶倒进缸里，你靠着缸沿坐了一会儿，呼吸才慢慢匀。',
      },
      {
        text: '挑一趟便歇，接过师兄的丹',
        cultivationGain: 6,
        itemGrants: ['huiqi-dan'],
        outcome:
          '你把一桶水倒进缸里，师兄看你肩头红了，塞给你一枚回气丹。你含在舌下，凉意顺着喉咙落下去，肩上的酸才松了一点。',
      },
    ],
  },
  {
    id: 'daily-lianqi-03',
    kind: 'daily',
    realm: '炼气',
    stage: '后期',
    title: '山门守夜',
    text: '今夜轮到你守山门，风从阙下灌进来，灯笼一晃一晃。你把剑横在膝上，听着远处偶尔传来的虫鸣。',
    options: [
      {
        text: '沿墙根巡到天亮',
        cultivationGain: 9,
        staminaCost: 7,
        itemGrants: ['zhixue-cao'],
        outcome:
          '你沿着墙根走了整夜，在角落后面捡到一丛被风吹倒的止血草。天光发白时腿已经木了，你把草叶裹进帕子，才去交班。',
      },
      {
        text: '守在灯下打坐',
        cultivationGain: 6,
        outcome:
          '你没有离灯，就在门洞里盘膝坐下，听风从耳边过去。交班的人来时，灯油见了底，你的呼吸却比入夜时稳。',
      },
    ],
  },
  // ── 筑基 3 条 ─────────────────────────────────────────────
  {
    id: 'daily-zhuji-01',
    kind: 'daily',
    realm: '筑基',
    stage: '前期',
    title: '坊市赶集',
    text: '坊市才开栅，你挤在人缝里，丹香和草药气混在一起。摊主把布帘掀开一条缝，朝你招了招手。',
    options: [
      {
        text: '买下一枚聚元丹',
        cultivationGain: 7,
        itemGrants: ['juyuan-dan'],
        outcome:
          '你数了灵石，把那枚聚元丹捏在掌心，丹身还带着炉火的余温。出了坊市，你没有立刻服下，先把它收进最里一层口袋。',
      },
      {
        text: '帮着看摊，换一枚回气丹',
        cultivationGain: 8,
        staminaCost: 5,
        itemGrants: ['huiqi-dan'],
        outcome:
          '你在摊后站到日头偏西，替他挡了几次讨价还价。收摊时他丢给你一枚回气丹，说是今天的工钱。',
      },
    ],
  },
  {
    id: 'daily-zhuji-02',
    kind: 'daily',
    realm: '筑基',
    stage: '中期',
    title: '灵田帮工',
    text: '灵田里的水渠堵了，管事点你的名，让你下田把淤泥清开。泥水没过脚踝，灵稻的叶子刮在袖上。',
    options: [
      {
        text: '一直清到渠水重流',
        cultivationGain: 10,
        staminaCost: 10,
        itemGrants: ['huiqi-dan'],
        outcome:
          '你弯着腰把淤泥一捧一捧捞上岸，渠水终于重新漫进田里。管事看你脸色发白，塞来一枚回气丹，让你先坐到田埂上缓一缓。',
      },
      {
        text: '清开主渠就停手',
        cultivationGain: 6,
        outcome:
          '你把堵住的主渠掏开，看水重新往下淌，便收了铲子。田里还有几处浅淤，你留给后来的人，自己先去洗掉小腿上的泥。',
      },
    ],
  },
  {
    id: 'daily-zhuji-03',
    kind: 'daily',
    realm: '筑基',
    stage: '后期',
    title: '丹房试药',
    text: '丹房师父把两枚新丹推到你面前，说要找个筑基修士试药性。药香很冲，隔着瓷碟就能闻见。',
    options: [
      {
        text: '先试聚元丹',
        cultivationGain: 9,
        staminaCost: 6,
        itemGrants: ['juyuan-dan'],
        outcome:
          '你把聚元丹含下，丹田里先热后胀，坐了半个时辰才把药性压住。师父记下脉象，又从瓷瓶里倒出一枚同样的，让你带回去。',
      },
      {
        text: '改试回气丹，记下感受',
        cultivationGain: 7,
        itemGrants: ['huiqi-dan'],
        outcome:
          '回气丹入口发凉，疲意从肩背往下退。你把感觉一条条说给师父听，他点头，又给你留了一枚同样的。',
      },
    ],
  },
  // ── 金丹 3 条 ─────────────────────────────────────────────
  {
    id: 'daily-jindan-01',
    kind: 'daily',
    realm: '金丹',
    stage: '前期',
    title: '后山巡山',
    text: '你奉命巡后山，雾气贴着林子走，石径上的苔又厚了一层。走到半山，你听见溪水在雾里响。',
    options: [
      {
        text: '下到溪边，收好散落的药草',
        cultivationGain: 8,
        staminaCost: 8,
        itemGrants: ['zhixue-cao'],
        outcome:
          '你拨开湿叶，在溪石缝里拢到一把止血草，叶边还挂着水。巡完一圈回到山门，靴筒里全是潮气，草却还是新鲜的。',
      },
      {
        text: '沿主径走到界碑就折返',
        cultivationGain: 5,
        outcome:
          '你没有下溪，沿着主径走到界碑，确认封印还在，便原路返回。雾在身后合上，你把看见的情形记在巡山簿上。',
      },
    ],
  },
  {
    id: 'daily-jindan-02',
    kind: 'daily',
    realm: '金丹',
    stage: '中期',
    title: '灯下抄经',
    text: '藏经阁的灯只留一盏，你摊开空白册页，照着残卷往下抄。字很小，抄到第三行，眼睛就开始发酸。',
    options: [
      {
        text: '抄到灯油燃尽',
        cultivationGain: 10,
        staminaCost: 6,
        outcome:
          '你一笔一笔抄到灯芯爆出最后一声轻响。合上册子时指节僵着，那些句子却已经在心里连成了一小段。',
      },
      {
        text: '抄完半卷，受赐一枚丹',
        cultivationGain: 7,
        itemGrants: ['juyuan-dan'],
        outcome:
          '你把半卷抄完，字迹工整，管事看过之后递来一枚聚元丹。你收进袖中，没有当场服下，先把笔洗干净。',
      },
    ],
  },
  {
    id: 'daily-jindan-03',
    kind: 'daily',
    realm: '金丹',
    stage: '后期',
    title: '修补法阵',
    text: '山门法阵缺了一角，灵纹暗了下去。你蹲在阵眼旁边，手里捏着修补用的灵石粉。',
    options: [
      {
        text: '自己把缺角补上',
        cultivationGain: 9,
        staminaCost: 9,
        outcome:
          '你把灵石粉按进缺口，灵纹一点一点重新亮起来。补完时额上全是汗，阵眼的热却从掌心退了下去。',
      },
      {
        text: '请同门搭手，分一枚回气丹',
        cultivationGain: 6,
        itemGrants: ['huiqi-dan'],
        outcome:
          '你把缺口指给同门看，两人一起把灵纹接上。事了之后他分你一枚回气丹，说补阵耗神，先把气顺回来。',
      },
    ],
  },
];
