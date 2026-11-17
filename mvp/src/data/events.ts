/**
 * 《登仙·MVP》事件池：24 条，每境界 8 条。
 *
 * 遵循 R2（事件不消耗资源）；R3 只给修为 + 剧情标记：
 * 每个选项至少给 `cultivationGain` 或 `plotFlag` 之一，禁止空结算。
 *
 * 功法是事件掉落（`option.grants`，选项级奖励）：新手第一本由
 * `lianqi-01` 保底给 `qingmu`，其余四本分布到筑基 / 金丹事件，各 1 本。
 * 掉落进背包，需要玩家自己装备到功法槽后才生效。
 *
 * 文案 v0.2：炼气写凡俗与初入门径，筑基写宗门、坊市、灵田、同道，
 * 金丹写秘境、天象、心魔、大能。选项一律一保守一激进，`plotFlag`
 * 用可累积的短标签（结善缘 / 伤生灵 / 藏锋 / 忍辱 …）。
 */

import type { GameEvent } from '../types.ts';

export const EVENTS: readonly GameEvent[] = [
  // ── 炼气 8 条 ─────────────────────────────────────────────
  {
    id: 'lianqi-01',
    realm: '炼气',
    title: '山道拾遗',
    text: '山道拐弯处，你踢到一枚玉简，边角被雨水浸得发亮。玉简贴掌时微微发烫，似在等你探入神识。',
    options: [
      { text: '就地以神识探入', cultivationGain: 8, grants: ['qingmu'] },
      { text: '收入袖中，回洞府再看', cultivationGain: 5, plotFlag: '藏玉简', grants: ['qingmu'] },
      { text: '放回原处，只当未见', cultivationGain: 6, plotFlag: '不取遗物', grants: ['qingmu'] },
    ],
  },
  {
    id: 'lianqi-02',
    realm: '炼气',
    title: '雨夜借宿',
    text: '破庙檐下雨声连成一片，一个老道把半块冷饼掰成两半，递了半块过来。',
    options: [
      { text: '把自己的干粮也分他一半', cultivationGain: 6, plotFlag: '结善缘' },
      { text: '谢过，独自坐到天亮', cultivationGain: 10 },
    ],
  },
  {
    id: 'lianqi-03',
    realm: '炼气',
    title: '溪畔灵鲤',
    text: '浅滩的水退了下去，一条巴掌大的灵鲤搁在卵石间，鳞片还泛着青光。',
    options: [
      { text: '捧回溪中放走', cultivationGain: 10, plotFlag: '放生灵鲤' },
      { text: '带回洞府炼药', cultivationGain: 12, plotFlag: '伤生灵' },
      { text: '留在原地，看它自去', cultivationGain: 5 },
    ],
  },
  {
    id: 'lianqi-04',
    realm: '炼气',
    title: '丹房门外',
    text: '外门弟子堵在丹房门口，说你这个月的丹药该让给他，一只手始终按在剑柄上。',
    options: [
      { text: '忍下这口气，退开一步', cultivationGain: 8, plotFlag: '忍辱' },
      { text: '寸步不让，与他论理', cultivationGain: 6, plotFlag: '结怨' },
      { text: '让出丹药，换他一枚旧符', cultivationGain: 9, plotFlag: '通人情' },
    ],
  },
  {
    id: 'lianqi-05',
    realm: '炼气',
    title: '月下吐纳',
    text: '今夜月华极盛，院里石阶像积了一层薄霜，连呼吸都带着凉意。',
    options: [
      { text: '在院中打坐到天亮', cultivationGain: 15 },
      { text: '抄录那半卷功法残页', cultivationGain: 6, plotFlag: '抄残页' },
      { text: '早早安睡，养足精神', cultivationGain: 7 },
    ],
  },
  {
    id: 'lianqi-06',
    realm: '炼气',
    title: '药圃失窃',
    text: '夜里巡圃，你撞见有人正把灵草往怀里塞。那人回头，脸白得像纸。',
    options: [
      { text: '去报知管事', cultivationGain: 5, plotFlag: '守规矩' },
      { text: '装作没看见', cultivationGain: 9 },
      { text: '拦住他，问清缘由', cultivationGain: 7, plotFlag: '问缘由' },
    ],
  },
  {
    id: 'lianqi-07',
    realm: '炼气',
    title: '崖边试剑石',
    text: '崖边立着一块试剑石，石面上被前人削出一道深痕，痕里积着雨水。',
    options: [
      { text: '运足灵力，全力一击', cultivationGain: 12 },
      { text: '以指沿那道痕描过', cultivationGain: 5, plotFlag: '初悟剑意' },
      { text: '绕石三匝，回去再想三日', cultivationGain: 6, plotFlag: '不轻出手' },
    ],
  },
  {
    id: 'lianqi-08',
    realm: '炼气',
    title: '集市旧书',
    text: '旧书摊上压着一本残破游记，前几页已被人撕去，剩下的字迹却极有风骨。',
    options: [
      { text: '买下，回洞府慢慢读', cultivationGain: 5, plotFlag: '读游记' },
      { text: '拿钱换两个热馒头', cultivationGain: 9 },
      { text: '借来誊抄一夜，明日归还', cultivationGain: 8, plotFlag: '借书' },
    ],
  },

  // ── 筑基 8 条 ─────────────────────────────────────────────
  {
    id: 'zhuji-01',
    realm: '筑基',
    title: '洞府灵脉',
    text: '新开的洞府里，灵脉在石壁下低鸣，像有活物在土里翻身。',
    days: 5,
    options: [
      { text: '布一座聚灵阵，就此闭关', cultivationGain: 15, grants: ['liehuo'] },
      { text: '封了洞府，继续云游', cultivationGain: 8, plotFlag: '云游' },
      { text: '请宗门长辈先来看一眼', cultivationGain: 6, plotFlag: '报宗门' },
    ],
  },
  {
    id: 'zhuji-02',
    realm: '筑基',
    title: '旧友提酒来访',
    text: '当年同门已结金丹，提着两坛酒站在洞府外，笑你还在筑基。',
    options: [
      { text: '以茶代酒，听他讲山外的事', cultivationGain: 6, plotFlag: '故人重逢' },
      { text: '闭门谢客，先冲一次关', cultivationGain: 13 },
    ],
  },
  {
    id: 'zhuji-03',
    realm: '筑基',
    title: '妖兽袭山',
    text: '一头二阶妖狼撞破山门，山下的药农正抱着孩子往山上跑。',
    options: [
      { text: '迎上去，把人护在身后', cultivationGain: 12, plotFlag: '护山' },
      { text: '绕后追击，取它内丹', cultivationGain: 7, plotFlag: '取内丹' },
    ],
  },
  {
    id: 'zhuji-04',
    realm: '筑基',
    title: '丹炉炸响',
    text: '炉火忽然失控，炉壁上的雷纹一寸寸亮起，丹房里已经站不住人。',
    options: [
      { text: '以灵力强压炉火', cultivationGain: 10, plotFlag: '护丹' },
      { text: '退出门外，任它炸开', cultivationGain: 5 },
      { text: '开炉泄气，弃丹保炉', cultivationGain: 7, plotFlag: '弃丹' },
    ],
  },
  {
    id: 'zhuji-05',
    realm: '筑基',
    title: '荒原剑冢',
    text: '荒原上有座无名剑冢，几十柄断剑斜插在土里，风过时却有铮铮之声。',
    options: [
      { text: '整衣拜上一拜', cultivationGain: 8, plotFlag: '敬剑冢' },
      { text: '挖出最深那柄残剑', cultivationGain: 13, plotFlag: '取残剑' },
    ],
  },
  {
    id: 'zhuji-06',
    realm: '筑基',
    title: '渡口论道三日',
    text: '一位云游道人坐在渡口石上，说愿与你论道三日，输了的人请酒。',
    days: 3,
    options: [
      { text: '倾囊相辩，不肯让人', cultivationGain: 15, plotFlag: '论道胜', grants: ['houtu'] },
      { text: '只听不语，任他讲完', cultivationGain: 9, plotFlag: '听道' },
      { text: '借故离席，回去炼丹', cultivationGain: 7 },
    ],
  },
  {
    id: 'zhuji-07',
    realm: '筑基',
    title: '灵田将枯',
    text: '药圃的土裂了缝，几株养了三年的灵草开始打卷。',
    options: [
      { text: '引来灵泉，日夜灌溉', cultivationGain: 9, plotFlag: '救灵田' },
      { text: '改种耐旱的野草', cultivationGain: 5 },
      { text: '去坊市请水灵师相助', cultivationGain: 6, plotFlag: '出人情' },
    ],
  },
  {
    id: 'zhuji-08',
    realm: '筑基',
    title: '雷夜闭关',
    text: '窗外雷声滚过，一层压着一层。你第一次觉得那声音离自己这么近。',
    days: 2,
    options: [
      { text: '开门，借雷淬体', cultivationGain: 14, plotFlag: '引雷淬体' },
      { text: '收心守一，把雷声关在门外', cultivationGain: 10 },
    ],
  },

  // ── 金丹 8 条 ─────────────────────────────────────────────
  {
    id: 'jindan-01',
    realm: '金丹',
    title: '金丹初转',
    text: '丹田里那颗金丹缓缓转了一圈，整座洞府的灵气都跟着晃了晃。',
    days: 3,
    options: [
      { text: '以识海温养，一坐三日', cultivationGain: 15, grants: ['gengjin'] },
      { text: '以剑意淬炼，逼它再快一分', cultivationGain: 10, plotFlag: '剑淬金丹' },
      { text: '出关走走，看看境界变了什么', cultivationGain: 8, plotFlag: '观境' },
    ],
  },
  {
    id: 'jindan-02',
    realm: '金丹',
    title: '寒梅素笺',
    text: '一封素笺压在洞府石桌上，墨迹还新，落款只画了一枝寒梅。',
    options: [
      { text: '提笔回信，写尽山中事', cultivationGain: 8, plotFlag: '回音' },
      { text: '把信焚了，一心向道', cultivationGain: 6, plotFlag: '断音' },
    ],
  },
  {
    id: 'jindan-03',
    realm: '金丹',
    title: '天雷试探',
    text: '云层压得极低，第一道雷光在云里游走，迟迟不肯落下，像在称你的斤两。',
    options: [
      { text: '迎雷而立，任它劈下', cultivationGain: 15, plotFlag: '迎雷' },
      { text: '入定避劫，不动如山', cultivationGain: 12 },
      { text: '敛息藏形，退入洞府', cultivationGain: 7, plotFlag: '藏锋' },
    ],
  },
  {
    id: 'jindan-04',
    realm: '金丹',
    title: '三宗会盟',
    text: '请柬送到洞府，落款是三个你都不熟的道统，日子定在下月初三。',
    options: [
      { text: '赴盟，看看他们图什么', cultivationGain: 10, plotFlag: '入盟' },
      { text: '婉拒，闭门炼剑', cultivationGain: 13, plotFlag: '闭门' },
    ],
  },
  {
    id: 'jindan-05',
    realm: '金丹',
    title: '门外长跪',
    text: '一个炼气小童在洞府外长跪不起，说愿拜你为师，膝下的石板已经洇湿。',
    options: [
      { text: '收为记名弟子', cultivationGain: 9, plotFlag: '收徒' },
      { text: '予他一瓶丹药，让他回去', cultivationGain: 7, plotFlag: '赠药' },
    ],
  },
  {
    id: 'jindan-06',
    realm: '金丹',
    title: '旧剑夜鸣',
    text: '剑冢里那柄残剑今夜自己响了，声如远钟，一声一声敲在你的识海上。',
    options: [
      { text: '以心血重铸，续它剑身', cultivationGain: 12, plotFlag: '重铸旧剑' },
      { text: '就地掩埋，让它安息', cultivationGain: 8, plotFlag: '葬剑' },
    ],
  },
  {
    id: 'jindan-07',
    realm: '金丹',
    title: '心境失守',
    text: '闭关第七日，妄念一间间推开你识海里的门，每一间里都坐着一个你。',
    days: 7,
    options: [
      { text: '以剑斩念，一间不留', cultivationGain: 13, plotFlag: '斩妄念', grants: ['xuanshui'] },
      { text: '静观其变，看它要说什么', cultivationGain: 10 },
      { text: '出关，暂避锋芒', cultivationGain: 6, plotFlag: '避心魔' },
    ],
  },
  {
    id: 'jindan-08',
    realm: '金丹',
    title: '星图缺笔',
    text: '星图上有一块空白，位置正对着你洞府上方，那空白处连墨都没有。',
    options: [
      { text: '记下那块空白，夜夜仰望', cultivationGain: 9, plotFlag: '星图缺笔' },
      { text: '焚图证道，不信天象', cultivationGain: 14, plotFlag: '焚图' },
    ],
  },
];
