/**
 * 《登仙·MVP》事件池：24 条，每境界 8 条。
 *
 * 遵循 R2（事件不消耗资源）与 R3（只给修为 + 剧情标记，不给装备）：
 * 每个选项至少给 `cultivationGain` 或 `plotFlag` 之一，禁止空结算。
 * 文案是占位级，跑通后再打磨。
 */

import type { GameEvent } from '../types.ts';

export const EVENTS: readonly GameEvent[] = [
  // ── 炼气 8 条 ─────────────────────────────────────────────
  {
    id: 'lianqi-01',
    realm: '炼气',
    title: '山道拾遗',
    text: '山道上躺着一枚温润玉简，边角被雨水浸得发亮。',
    options: [
      { text: '以神识探入', cultivationGain: 8 },
      { text: '收进袖中，日后再看', cultivationGain: 5, plotFlag: '藏玉简' },
    ],
  },
  {
    id: 'lianqi-02',
    realm: '炼气',
    title: '雨夜借宿',
    text: '破庙檐下，一个老道把半块冷饼掰成两半，递过来一半。',
    options: [
      { text: '把自己的干粮分他一半', cultivationGain: 6, plotFlag: '结善缘' },
      { text: '谢过，独自打坐', cultivationGain: 10 },
    ],
  },
  {
    id: 'lianqi-03',
    realm: '炼气',
    title: '溪畔灵鲤',
    text: '一条巴掌大的灵鲤搁浅在浅滩，鳞片还泛着青光。',
    options: [
      { text: '捧回溪中', cultivationGain: 10, plotFlag: '放生灵鲤' },
      { text: '带回去炼药', cultivationGain: 12, plotFlag: '伤生灵' },
    ],
  },
  {
    id: 'lianqi-04',
    realm: '炼气',
    title: '丹房门外',
    text: '外门弟子堵在丹房门口，说你今日的丹药该让给他。',
    options: [
      { text: '忍下这口气', cultivationGain: 8, plotFlag: '忍辱' },
      { text: '出手教训他', cultivationGain: 6, plotFlag: '结怨' },
    ],
  },
  {
    id: 'lianqi-05',
    realm: '炼气',
    title: '月下吐纳',
    text: '今夜月华极盛，院里的石阶像积了一层薄霜。',
    options: [
      { text: '打坐到天亮', cultivationGain: 15 },
      { text: '借着月光抄录功法残页', cultivationGain: 6 },
    ],
  },
  {
    id: 'lianqi-06',
    realm: '炼气',
    title: '药圃失窃',
    text: '你撞见有人正把灵草往怀里塞，那人回头，脸色惨白。',
    options: [
      { text: '去告知管事', cultivationGain: 5, plotFlag: '守规矩' },
      { text: '装作没看见', cultivationGain: 9 },
    ],
  },
  {
    id: 'lianqi-07',
    realm: '炼气',
    title: '试剑石',
    text: '崖边立着一块试剑石，石面被前人削出一道深痕。',
    options: [
      { text: '全力一击', cultivationGain: 12 },
      { text: '以指描那道痕', cultivationGain: 5, plotFlag: '初悟剑意' },
    ],
  },
  {
    id: 'lianqi-08',
    realm: '炼气',
    title: '集市旧书',
    text: '摊上压着一本残破游记，缺了前面几页，字迹却极有风骨。',
    options: [
      { text: '买下慢慢读', cultivationGain: 5, plotFlag: '读游记' },
      { text: '换个热馒头吃', cultivationGain: 9 },
    ],
  },

  // ── 筑基 8 条 ─────────────────────────────────────────────
  {
    id: 'zhuji-01',
    realm: '筑基',
    title: '洞府灵脉',
    text: '新开的洞府里，灵脉在石壁下低鸣，像有活物在翻身。',
    options: [
      { text: '布一座聚灵阵', cultivationGain: 15 },
      { text: '封了洞府，继续云游', cultivationGain: 8, plotFlag: '云游' },
    ],
  },
  {
    id: 'zhuji-02',
    realm: '筑基',
    title: '旧友来访',
    text: '当年同门已结丹，提着两坛酒站在洞府外，笑你还在筑基。',
    options: [
      { text: '以茶相待，听他讲外面的事', cultivationGain: 6, plotFlag: '故人重逢' },
      { text: '闭门谢客，先冲一次关', cultivationGain: 13 },
    ],
  },
  {
    id: 'zhuji-03',
    realm: '筑基',
    title: '妖兽袭山',
    text: '一头二阶妖狼撞破山门，山下的药农正往山上跑。',
    options: [
      { text: '迎上去，把人护在身后', cultivationGain: 12, plotFlag: '护山' },
      { text: '避其锋芒，绕后追击', cultivationGain: 7 },
    ],
  },
  {
    id: 'zhuji-04',
    realm: '筑基',
    title: '丹炉炸响',
    text: '炉火忽然失控，炉壁上的雷纹一寸寸亮起来。',
    options: [
      { text: '以灵力强压炉火', cultivationGain: 10, plotFlag: '护丹' },
      { text: '退开，任它炸毁', cultivationGain: 5 },
    ],
  },
  {
    id: 'zhuji-05',
    realm: '筑基',
    title: '断剑埋骨',
    text: '荒原上有座无名剑冢，几十柄断剑斜插在土里。',
    options: [
      { text: '拜上一拜', cultivationGain: 8, plotFlag: '敬剑冢' },
      { text: '挖出最深那柄残剑', cultivationGain: 13, plotFlag: '取残剑' },
    ],
  },
  {
    id: 'zhuji-06',
    realm: '筑基',
    title: '论道三日',
    text: '一位云游道人坐在渡口石上，说愿与你论道，输了的人请酒。',
    options: [
      { text: '倾囊相辩', cultivationGain: 15, plotFlag: '论道胜' },
      { text: '只听不语', cultivationGain: 9 },
    ],
  },
  {
    id: 'zhuji-07',
    realm: '筑基',
    title: '灵田将枯',
    text: '药圃的土裂了缝，几株养了三年的灵草开始打卷。',
    options: [
      { text: '引来灵泉灌溉', cultivationGain: 9, plotFlag: '救灵田' },
      { text: '改种耐旱的野草', cultivationGain: 5 },
    ],
  },
  {
    id: 'zhuji-08',
    realm: '筑基',
    title: '雷夜闭关',
    text: '窗外雷声滚过，你第一次觉得那声音离自己这么近。',
    options: [
      { text: '开门，借雷淬体', cultivationGain: 14, plotFlag: '引雷淬体' },
      { text: '收心守一，把雷声关在门外', cultivationGain: 10 },
    ],
  },

  // ── 金丹 8 条 ─────────────────────────────────────────────
  {
    id: 'jindan-01',
    realm: '金丹',
    title: '金丹初成',
    text: '丹田里那颗金丹缓缓转了一圈，整个洞府的灵气都跟着晃了晃。',
    options: [
      { text: '以识海温养', cultivationGain: 15 },
      { text: '以剑意淬炼', cultivationGain: 10, plotFlag: '剑淬金丹' },
    ],
  },
  {
    id: 'jindan-02',
    realm: '金丹',
    title: '道侣来书',
    text: '一封素笺压在洞府石桌上，墨迹还新。',
    options: [
      { text: '提笔回信', cultivationGain: 8, plotFlag: '回音' },
      { text: '把信焚了', cultivationGain: 6, plotFlag: '断音' },
    ],
  },
  {
    id: 'jindan-03',
    realm: '金丹',
    title: '天雷试探',
    text: '云层压得极低，第一道雷光在云里游走，迟迟不落。',
    options: [
      { text: '迎雷而立', cultivationGain: 15, plotFlag: '迎雷' },
      { text: '入定避劫', cultivationGain: 12 },
    ],
  },
  {
    id: 'jindan-04',
    realm: '金丹',
    title: '三宗会盟',
    text: '请柬送到洞府，落款是三个你都不熟的道统。',
    options: [
      { text: '赴盟，看看他们图什么', cultivationGain: 10, plotFlag: '入盟' },
      { text: '婉拒，闭门炼剑', cultivationGain: 13 },
    ],
  },
  {
    id: 'jindan-05',
    realm: '金丹',
    title: '门人叩首',
    text: '一个炼气小童在洞府外长跪不起，说要拜你为师。',
    options: [
      { text: '收为记名弟子', cultivationGain: 9, plotFlag: '收徒' },
      { text: '予他一瓶丹药，让他回去', cultivationGain: 7 },
    ],
  },
  {
    id: 'jindan-06',
    realm: '金丹',
    title: '旧剑残鸣',
    text: '剑冢里那柄残剑今夜自己响了，声如远钟。',
    options: [
      { text: '以心血重铸', cultivationGain: 12, plotFlag: '重铸旧剑' },
      { text: '就地掩埋，让它安息', cultivationGain: 8 },
    ],
  },
  {
    id: 'jindan-07',
    realm: '金丹',
    title: '心境失守',
    text: '闭关第七日，妄念一间间推开你识海里的门。',
    options: [
      { text: '以剑斩念', cultivationGain: 13, plotFlag: '斩妄念' },
      { text: '静观其变，看它要说什么', cultivationGain: 10 },
    ],
  },
  {
    id: 'jindan-08',
    realm: '金丹',
    title: '观星台上',
    text: '星图上有一块空白，位置正对着你洞府上方。',
    options: [
      { text: '记下那块空白', cultivationGain: 9, plotFlag: '星图缺笔' },
      { text: '焚图证道', cultivationGain: 14 },
    ],
  },
];
