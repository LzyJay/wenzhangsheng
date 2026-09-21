/**
 * story.js —— 剧情路线数据层（只读配置层）（V6.5 · 批 A）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《提炼-剧情发展路线》§二 字段契约 + §三 九卷×十二界对照表 + §四 十二界路线卡（逐卡搬运）。
 * 边界（数据层）：**纯数据 + 纯函数**，不碰 DOM / 不 import 任何 system；本批（批 A）**不接 UI**——
 *   面板与演出由批 B（`StorySystem` 命运节拍器）消费。
 *
 * 铁律（照剧情册 §二 / §1.3）：
 *   · **不动 72 级骨架**：九卷只是「等级 → 卷」的换算视图，不改 `realms.js` / 产出公式 / 渡劫参数；
 *   · 卷↔大境的映射**全 12 界通用、不可错位**（见 `VOLUMES`）；阶段句前缀 = 该卷大境名；
 *   · 锚点密度：每卷 1 段开场白（60~100 字）+ 1 句阶段句（`大境·四字`）+ 1 个节点演出；
 *   · **不设任务链、不读秒、不打断挂机**（不读也不影响游玩）——本批只提供数据与查询函数；
 *   · 对外原创措辞，原型作品名仅作内部参照（IP 口径见剧情册 §1.5）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const STORY_VERSION = 1

/** 等级上限（与 realms.js 的 LEVEL_MAX 对齐；此处在数据层复述以免横向 import） */
const LEVEL_MAX = 72

/**
 * 九卷 ↔ 大境 ↔ 等级区间（§二 固定映射，**全 12 界通用，不可错位**）。
 * `trialIndex` = 该卷必经的渡劫关口在 `TRIAL_NODES` 的下标（卷八无关口，卷九 = 飞升劫）。
 */
export const VOLUMES = [
  { volume: 1, realm: '炼气', from: 1, to: 9, trialIndex: 0 },
  { volume: 2, realm: '筑基', from: 10, to: 18, trialIndex: 1 },
  { volume: 3, realm: '金丹', from: 19, to: 27, trialIndex: 2 },
  { volume: 4, realm: '元婴', from: 28, to: 36, trialIndex: 3 },
  { volume: 5, realm: '化神', from: 37, to: 45, trialIndex: 4 },
  { volume: 6, realm: '炼虚', from: 46, to: 54, trialIndex: 5 },
  { volume: 7, realm: '合体', from: 55, to: 63, trialIndex: 6 },
  { volume: 8, realm: '大乘', from: 64, to: 71, trialIndex: null },
  { volume: 9, realm: '终局', from: 72, to: 72, trialIndex: 7 }
]

/**
 * 12 界路线（`WorldRoute`，形状见剧情册 §二 字段契约）。
 * beats[].at ∈ 'trial' | 'dungeon' | 'sect' | 'world'（节点演出的挂载类别；
 *   'trial' 走渡劫面板 / 'dungeon' 走招牌秘境 / 'sect' 走宗门大比 / 'world' 走世界专属机制与纪事）。
 */
export const WORLD_ROUTES = {
  // ══ 01 · 青岚界（凡人修仙传）══════════════════════════════════════════
  qinglan: {
    worldId: 'qinglan',
    title: '青岚界长生路',
    tag: '经典·均衡',
    identity: '山村少年 · 外门弟子',
    motif: '资质最差的人，靠一只瓶子、一本账和不冒险，走得最远。',
    volumes: [
      {
        volume: 1, name: '开瓶', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你是青岚门外门弟子，资质平平，名册上排在末位。师父丢下一卷无名口诀便不再过问；倒是床头那只不起眼的旧瓶，每逢月夜凝出一滴碧液——谁也说不清它的来历。',
        beats: [{ at: 'world', title: '小瓶首凝绿液', text: '月夜，瓶口一点碧光聚成液滴——第一滴碧液到手，可催熟一季灵田。' }]
      },
      {
        volume: 2, name: '夺丹', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '升仙擂开，七台并立，两两胜进。筑基丹只有那么几粒，台下人人都在算：是该一路藏拙到最后，还是趁早攥住那一线机会。',
        beats: [{ at: 'sect', title: '擂台夺丹', text: '七台并开、两两胜进，胜者取丹——本界的赛季大比。' }]
      },
      {
        volume: 3, name: '药园', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '一纸调令把你打发去管药园。别人嫌清苦，你却在垄间算得清清楚楚：哪畦该催、哪株该留，药苗的长势比同门的脸色好看得多。',
        beats: [{ at: 'world', title: '催熟灵田', text: '掌天瓶的碧液滴土生金——药园成了你最稳的第二产线。' }]
      },
      {
        volume: 4, name: '小劫', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '元婴之后，天要定期来考你一次。雷不算大，却次次准时：过得去，便得一道雷淬；过不去，先前攒的就得吐出来。',
        beats: [{ at: 'world', title: '首次小天劫', text: '雷淬考核如期而至——过了添一道雷淬，不过吐出一截积蓄。' }]
      },
      {
        volume: 5, name: '禁地', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '禁地五年一开，只放低阶弟子进去，五日即闭。长辈在门外破禁，你在里头夺药——进去的人多，出来的人少。',
        beats: [{ at: 'dungeon', title: '限时秘境开启', text: '五日窗口，门内门外俱是算计；带出来的药，只认先到的手。' }]
      },
      {
        volume: 6, name: '坊市', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '你把法宝收进袖中，只做坊市里一个寻常顾客。灵石换符、符换药材，账目从不写在脸上——藏锋不是怯，是活得久。',
        beats: [{ at: 'world', title: '露富招祸', text: '坊市里有人盯上了出手阔绰的生面孔；账不写在脸上的人，才走得远。' }]
      },
      {
        volume: 7, name: '雷淬', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '小天劫一道一道地过，雷淬攒了整整一炉。你不与人争名次，只与上一次的自己比：这一回，能不能少挨一道雷。',
        beats: [{ at: 'world', title: '雷淬循环', text: '一炉雷淬攒成，你的家底又多了一分——长线积累，从来不起眼。' }]
      },
      {
        volume: 8, name: '开府', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '山门之外另立一府，灵脉自引，药田自熟。当年名册上排在末位的那个外门弟子，如今也有人登门求一粒丹了。',
        beats: [{ at: 'world', title: '洞府开辟', text: '灵脉自引、药田自熟——第二产线立起来，你终于不必看谁的脸色。' }]
      },
      {
        volume: 9, name: '飞升', realmFrom: '终局', realmTo: '终局', realmLine: '终局·羽化登仙',
        prologue: '最后一道雷落下时，你没有回头看山门。规矩是：飞升之后一切从头再来——但这一世的账，你算得比谁都清楚。',
        beats: [{ at: 'trial', title: '飞升劫', text: '最后一道雷落下，羽化登仙；这一世的账，到此结清。' }]
      }
    ],
    rituals: [
      '开瓶：月夜，瓶口一点碧光聚成液滴——新手第一分钟的一次性演出，赠第一滴碧液，可催熟一季灵田。',
      '擂台夺丹：七台并开、两两胜进，胜者取丹——周期大比（对齐灵兽大比赛制）。',
      '禁地破禁：长辈强行打开通路、五日窗口——限时秘境全服事件。'
    ],
    ending: {
      text: '飞升劫过后同界轮回，熟练度 +3%/世（封顶 +15%）。',
      rebirthHook: '青岚界的重开＝「再算一遍账」：前期伪灵根惩罚仍在（+10% 突破成本），故洗髓价值更高。'
    },
    namePool: ['青岚门', '无名口诀', '掌天瓶·碧液', '升仙擂', '筑基丹', '灵药园', '符箓', '雷淬', '禁地试炼', '万珍楼', '洗髓散', '外门弟子']
  },

  // ══ 02 · 破晓星域（仙逆）══════════════════════════════════════════════
  poxiao: {
    worldId: 'poxiao',
    title: '破晓星域问命路',
    tag: '因果·进阶',
    identity: '边陲小宗杂役',
    motif: '天不给的，就自己抢；每一次变强都要拿命去抵。',
    volumes: [
      {
        volume: 1, name: '坠崖', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你落选了，连记名弟子的名分都没有。于是你站上崖口——要么摔下去，要么让山门记住你的名字。后来你被抬了回来，成了一个每日挑水的杂役。',
        beats: [{ at: 'world', title: '以死明志', text: '崖口一跃，换一个入门资格——本界给所有冒险先标好了价。' }]
      },
      {
        volume: 2, name: '夺基', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '有人告诉你，道基不必自己修——可以从别人身上夺。代价写在脸上：夺来的基，随时可能被反噬一口吞掉。',
        beats: [{ at: 'world', title: '掠夺型突破', text: '夺来的道基在体内发烫：快，但随时可能咬你一口。' }]
      },
      {
        volume: 3, name: '身亡', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你真的死过一次。域外战场没有名姓，只有尸骨；等你再睁开眼，先回来的不是身体，是一缕不肯散的神识。',
        beats: [{ at: 'world', title: '真死 · 复活', text: '死过一次再回来——代价实质，故此后的每一步都算得更准。' }]
      },
      {
        volume: 4, name: '神识', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '神识推到极处，能看见别人看不见的东西。你又给自己做了一具魔头替身——从此有些事不必亲自去，代价由它去扛。',
        beats: [{ at: 'world', title: '分身 / 傀儡挂机', text: '魔傀替身替你走一趟险路——多线产出，代价由它去扛。' }]
      },
      {
        volume: 5, name: '古地', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '古传送阵那头是一片死地。前人留下的禁制没人看得懂，你却一行一行地学——传承不挑资质，只挑耐心。',
        beats: [{ at: 'dungeon', title: '遗迹探索 · 传承解锁', text: '古地禁制一行一行读下去，传承不挑资质，只挑耐心。' }]
      },
      {
        volume: 6, name: '轮回', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '有些事修为再高也换不回。于是你转身去问轮回：树在那里，路也在那里，只是走过去要先把这世放下。',
        beats: [{ at: 'world', title: '转世重生', text: '轮回树在那边——走过去之前，得先把这一世放下。' }]
      },
      {
        volume: 7, name: '收魂', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '幡面展开，收进来的都是不甘心的魂。你学会了一门不体面的法术：把别人的执念，炼成自己的力气。',
        beats: [{ at: 'world', title: '收容型产出', text: '炼魂幡收了满幡执念——别人的不甘，成了你的力气。' }]
      },
      {
        volume: 8, name: '问鼎', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '星空之下，问鼎者众，登顶者寡。你终于站到了能被人仰望的位置，可你问的还是那句：她到底在哪一世。',
        beats: [{ at: 'sect', title: '星域问鼎', text: '榜位战开——站到能被仰望的位置，问的还是那一句。' }]
      },
      {
        volume: 9, name: '踏天', realmFrom: '终局', realmTo: '终局', realmLine: '终局·踏天而去',
        prologue: '天有九重，你一层一层踏上去。路的尽头没有敌人，只有一个等了很久的人——雪落下来，你终于不必再走。',
        beats: [{ at: 'trial', title: '终局演出', text: '踏到最后一层，雪落下来——这一次，不必再走。' }]
      }
    ],
    rituals: [
      '坠崖：失足或跃下，换一个入门资格——新手唯一的「主动悲剧」，给后续所有冒险定价。',
      '身亡 · 神识苏醒：真死一次再回来，且死亡有实质代价（对齐道伤 / 灵气损失口径）。',
      '踏天终局：数千年追寻在一场雪里收束，作为转世系统（prestige）的情感锚点。'
    ],
    ending: {
      text: '踏天结束后同界轮回。',
      rebirthHook: '「天逆珠」每世 1 枚、渡劫失败免罚一次，是本界对天劫 +10% 摩擦的补偿，转世时重置。'
    },
    namePool: ['破晓宗', '边陲小宗', '天逆珠', '窃基法', '域外战场', '神识极境', '魔傀替身', '古传送阵', '禁制谱', '炼魂幡', '栖魂林', '踏天阶']
  },

  // ══ 03 · 观云界（我师兄实在太稳健了）════════════════════════════════
  denghuo: {
    worldId: 'denghuo',
    title: '观云界稳健路',
    tag: '仙门·稳健',
    identity: '山门入门弟子',
    motif: '做每一件事之前先问一句「最坏会怎样」——把稳健刻进骨头里的人，最后才走得到终点。',
    volumes: [
      {
        volume: 1, name: '入门', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '师父领你上山那天，山门小得可怜。第一课不是吐纳，是「什么叫危险」：这个世界不缺天才，缺的是能在天才堆里活到出师的人。',
        beats: [{ at: 'world', title: '入门审核', text: '入门第一课不授功，只问一句：什么最危险。答对了，才算进门。' }]
      },
      {
        volume: 2, name: '藏锋', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '你挑了一部没人肯练的笨功法，也学会了把本事压在别人看不见的地方。同门眼里你最不起眼——这正是你要的效果。',
        beats: [{ at: 'world', title: '藏拙 / 底牌登记', text: '底牌入簿，不示于人：本事压在看不见的地方，才叫本事。' }]
      },
      {
        volume: 3, name: '功德', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你发现有一种东西比灵石好用：功德。替天办事，天替你记一笔；替人扛下黑锅，功德还是你的。从此你开始有目的地做「好修行」。',
        beats: [{ at: 'world', title: '功德经营', text: '功德我拿，锅你们背——离线也在为你累积。' }]
      },
      {
        volume: 4, name: '挂职', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '你在天庭挂了个闲职，管一段河道。官不大，香火却日日不断——你的修行从此有了第二条线：人间有人烧香，山上就有人长生。',
        beats: [{ at: 'world', title: '神职 / 香火第二产线', text: '闲职到手，香火日日不断——第二条产线立住了。' }]
      },
      {
        volume: 5, name: '度劫', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '轮到你自己渡劫了。渡劫的地方你挑了三遍，退路算了七条，连替身都备了好几份——别人渡劫靠命硬，你渡劫靠预案。',
        beats: [{ at: 'trial', title: '渡劫预案', text: '地点挑三遍、退路算七条——别人靠命硬，你靠预案。' }]
      },
      {
        volume: 6, name: '债券', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '你开始跟「天」谈生意：替天把事办了，天就欠你一笔。握着这张欠条，你第一次站在圣人面前，还能笑着把话说完。',
        beats: [{ at: 'world', title: '高位话术 / 与规则议价', text: '天道债券握在手里——站在圣人面前，你还能把话说完。' }]
      },
      {
        volume: 7, name: '均势', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '你不肯选边，也劝别人别急着站队。有人笑你滑头，直到有一天你说出「均势」二字——它不再是姿态，是一条道。',
        beats: [{ at: 'world', title: '立道 · 中立经营', text: '「均势」二字出口，它不再是一种姿态，而是一条道。' }]
      },
      {
        volume: 8, name: '伐天', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '算了一辈子的退路，最后一条却通向天上。你把预案翻到最后一页，上面只写了四个字：那就反了。',
        beats: [{ at: 'trial', title: '叛出天庭 / 伐天', text: '预案翻到最后一页——上面只写了四个字：那就反了。' }]
      },
      {
        volume: 9, name: '归山', realmFrom: '终局', realmTo: '终局', realmLine: '终局·回到起点',
        prologue: '仗打完了，天还是那个天。你回到那座发育不良的小山头，给师妹留了封信，炉子上照旧炖着一锅汤——原来长生最难的从不是渡劫，是一路稳健地活到回家。',
        beats: [{ at: 'trial', title: '终局闭环', text: '回到小炉峰，炉上那锅汤还温着——这才是长生。' }]
      }
    ],
    rituals: [
      '入门审核：开门第一课不是授功，是问「什么最危险」——最轻的新手开场，也定下本界基调。',
      '助师渡劫：一套方案不够就再来一套，替师父把天劫躲过去——本界「预案文化」的最佳演出（对齐渡劫面板）。',
      '终局回山：把一辈子算好的东西留在山上，是转世系统最好的情感落点。'
    ],
    ending: {
      text: '产出最低（×0.90）、日常任务 ×2，故本界仍是碎片时间最优解；终局闭环后同界轮回，熟练度 +3%/世。',
      rebirthHook: '「藏拙」型玩法转世保留 10% 隐性战力（已实装 V6.8）：不出头，也不落空。'
    },
    namePool: ['观云峰', '小炉峰', '入门审核', '替身纸偶', '底牌簿', '退路预案', '功德簿', '天庭闲职', '河神土地', '香火愿力', '天道债券', '均势之道']
  },

  // ══ 04 · 青云古界（诛仙）══════════════════════════════════════════════
  qingyun: {
    worldId: 'qingyun',
    title: '青云古界剑心路',
    tag: '古典·正魔',
    identity: '名门弟子',
    motif: '正与魔的分界，从来不在门派，而在你自己身上。',
    volumes: [
      {
        volume: 1, name: '入门', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你是名门里最笨的那个：同门早已御剑，你还在扫院子。师父不看好你，师姐也不——只有灶房那根赤铁棍，用着还算顺手。',
        beats: [{ at: 'world', title: '双功法互斥 / 融合', text: '佛与道两条路摆在面前：一步走岔，往后都得自己扳回来。' }]
      },
      {
        volume: 2, name: '正魔', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '本界的正魔之分来得很早。筑基那年，你必须站一次队——站错了不是死，是再也没有回头的路。',
        beats: [{ at: 'world', title: '阵营选择', text: '筑基之年必须站一次队——站错了不是死，是再也回不了头。' }]
      },
      {
        volume: 3, name: '会武', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '六十四人抽签，六轮对决。你抽到的签不好，可你一站上台就没打算下来——会武之后，全门都记住了你的名字。',
        beats: [{ at: 'sect', title: '门派大比', text: '六十四人抽签、六轮淘汰——会武之后，全门都记住了你的名字。' }]
      },
      {
        volume: 4, name: '洞天', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '深渊之下有座洞府，进去的人没几个回来。你在里头得了半卷玉书、一只铜铃——前者是传承，后者是牵挂。',
        beats: [{ at: 'dungeon', title: '绝境洞府', text: '半卷玉书是传承，一只铜铃是牵挂——两者你都带了出来。' }]
      },
      {
        volume: 5, name: '入魔', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '十年之后你换了名字。旧门派贴出你的罪状，新门派递来你的面具——同一个人，两套身份，两笔账。',
        beats: [{ at: 'world', title: '阵营切换', text: '旧门贴罪状、新门递面具——同一个人，两套身份，两笔账。' }]
      },
      {
        volume: 6, name: '集卷', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '玉书散作四卷，散在四个没人想去的地方。你一卷一卷地捡，也一卷一卷地读懂自己当年为何走错。',
        beats: [{ at: 'world', title: '收集品主线', text: '四卷进度就是本界的主线进度条——捡的是书，读的是自己。' }]
      },
      {
        volume: 7, name: '剑冢', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '剑冢里插着历代人的剑，也插着他们没做完的事。你挑了一柄——不是最强的那柄，是最认你的那柄。',
        beats: [{ at: 'dungeon', title: '剑冢法宝成长线', text: '挑的不是最强的那柄，是最认你的那柄——法宝自此随你长大。' }]
      },
      {
        volume: 8, name: '大战', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '正魔两道终于打起来了。这次你站在哪一边，已经不重要——重要的是你还站着。',
        beats: [{ at: 'world', title: '正魔大战', text: '两道终于开战。站哪边已不重要——重要的是你还站着。' }]
      },
      {
        volume: 9, name: '超脱', realmFrom: '终局', realmTo: '终局', realmLine: '终局·剑意超脱',
        prologue: '此界无飞升。最后一式过后，剑还在，人已不在——门派把你的剑供起来，称作「超脱」。',
        beats: [{ at: 'trial', title: '终局替代', text: '此界无飞升：最后一式过后，门派把你的剑供起来，称作「超脱」。' }]
      }
    ],
    rituals: [
      '会武抽签：六十四人、六轮淘汰——最标准的赛季赛事，可直接复用大比赛制。',
      '滴血洞得天书：深渊绝境掉落传承与定情之物，高难副本的掉落演出范本。',
      '剑阵对巨鼎：终局大型演出（全服事件），结束后进入「剑意超脱」结算。'
    ],
    ending: {
      text: '**无飞升**——第 72 级关口改为「剑意超脱」，结算后转世奖励 +20%（对齐 worlds.js friction）。',
      rebirthHook: '剑冢法宝成长线是跨界资产：转世后仍可继承已祭炼的剑阶。'
    },
    namePool: ['云嶂门', '苍竹峰', '翠竹峰', '玉清境', '赤铁棍', '玉书四卷', '同心铃', '离火鉴', '剑冢', '正魔大战', '七峰会武', '剑意超脱']
  },

  // ══ 05 · 望族山河（玄鉴仙族）══════════════════════════════════════════
  wangzu: {
    worldId: 'wangzu',
    title: '望族山河世代路',
    tag: '家族·经营',
    identity: '家族子弟',
    motif: '一个人飞升不算本事，把一姓之族带上第一方才算。',
    volumes: [
      {
        volume: 1, name: '得镜', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你醒来时在一面青灰古镜里，只能看，不能言。镜外这户人家已耕荒两百余年：父亲算着明日的口粮，长兄惦记河里的鱼获——你就这么成了这一族的第一个秘密。',
        beats: [{ at: 'world', title: '托身器物', text: '你成了这一族的第一个秘密：看得见，说不了，只能借镜传法。' }]
      },
      {
        volume: 2, name: '符种', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '镜身能牵引月华凝出一枚玄珠符种，种入他人丹田，助人修行；待那人功成或身死，全部返还自身。一代只出一枚，族老争了三天，最后念到你的名字。',
        beats: [{ at: 'world', title: '名额抉择', text: '一代只出一枚符种——族老争了三天，最后念到你的名字。' }]
      },
      {
        volume: 3, name: '箓丹', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '祭萃夺元得来的箓气，配着月华能炼出一枚箓丹：一大境界只可服食一枚，专破关障。这一族从你开始，正式有了「仙基」二字。',
        beats: [{ at: 'world', title: '限额破障', text: '一大境界仅此一枚——每一步都很贵，所以每一步都要算。' }]
      },
      {
        volume: 4, name: '立祠', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '积蓄两百载，族里终于立了祠堂、开了族府：读书的出仕，习武的将兵。宗门只管到城，再往下这一层，靠的是自家的族规与人手。',
        beats: [{ at: 'world', title: '族府治理', text: '立祠堂、开族府：读书的出仕，习武的将兵——这一族真正立起来了。' }]
      },
      {
        volume: 5, name: '纳贡', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '势力之间开始伸手：上面要三成，族里就得给三成。库存年年见底，账却越算越细——此界弱者的第一课，是学会在别人的规矩里活下来。',
        beats: [{ at: 'world', title: '供奉博弈', text: '上面要三成，族里就得给三成——账越算越细，族才活得下去。' }]
      },
      {
        volume: 6, name: '金性', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '紫府往上，关键在于煅出那一点不坏的金性，寿元千年。可长老一去，那点金性也会被猎走——族里第一次明白：遗产也是要有人守的。',
        beats: [{ at: 'world', title: '遗产事件', text: '长老一去，金性就可能被猎走——族里第一次明白：遗产也要有人守。' }]
      },
      {
        volume: 7, name: '洞天', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '有人不肯蹚势力的浑水，把自己封进一只灵宝壶里：壶中开洞天，炼日月，神合洞天以化天地。此界的强者到这一步，已经能在自家后院里另立乾坤。',
        beats: [{ at: 'dungeon', title: '洞天经营', text: '壶中开洞天——自家后院里另立乾坤，从此不蹚别人的浑水。' }]
      },
      {
        volume: 8, name: '争衡', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '赤礁岛、各处宗门的旗号在你族门前起起落落。供奉可以谈，族贡可以复，唯独脚下的地退不得。族运面前，从来没有便宜的胜仗。',
        beats: [{ at: 'sect', title: '区域争霸', text: '供奉可以谈，族贡可以复，唯独脚下的地退不得。' }]
      },
      {
        volume: 9, name: '传承', realmFrom: '终局', realmTo: '终局', realmLine: '终局·世代交替',
        prologue: '你把符种交给下一个孩子，像当年有人交给你一样。谁能扛得起这个家的担子，谁就是下一任族长——族谱又厚了一页，山河还是那片山河。',
        beats: [{ at: 'trial', title: '世代交替', text: '符种交给下一个孩子——族谱又厚了一页，山河还是那片山河。' }]
      }
    ],
    rituals: [
      '授符种：一代一枚、择人而授，受益者功成或身死皆反哺自身——把修行资源与家族政治绑死的最强抉择演出。',
      '服箓丹：一大境界仅一枚，专破关障——把「每步都很贵」做成可预期的长线规划点。',
      '立祠开府：积蓄两百载才有的一次跃迁，是本界「慢就是快」的具象化。'
    ],
    ending: {
      text: '族贡抽成 10%（上缴换家族权益，代码口径）；终局「传承」后同界轮回，熟练度 +3%/世。',
      rebirthHook: '符种天赋（灵根保底真灵根）每世保留。'
    },
    namePool: ['古镜', '符种', '宗子', '箓丹', '仙基', '金性', '洞天之境', '族事堂', '族谱', '祠堂', '族贡', '供奉三成']
  },

  // ══ 06 · 幽傩界（道诡异仙）════════════════════════════════════════════
  younuo: {
    worldId: 'younuo',
    title: '幽傩界问心路',
    tag: '黑暗·高难',
    identity: '药房杂役',
    motif: '这条路没有「变强」，只有「还能不能认出自己」。',
    volumes: [
      {
        volume: 1, name: '药引', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你在药房捣药，师傅说你是「药引」——药引不是人，是材料。你要做的第一件事，是让自己不再是材料。',
        beats: [{ at: 'world', title: '生存压力条', text: '药引不是人，是材料——第一件事，是让自己不再被当成材料。' }]
      },
      {
        volume: 2, name: '丹方', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '有人给了你一张丹方，真伪难辨。吃对了是机缘，吃错了是代价——而此界所有的机缘，都长成丹方的样子。',
        beats: [{ at: 'world', title: '丹方收集', text: '此界所有的机缘都长成丹方的样子：吃对了是机缘，吃错了是代价。' }]
      },
      {
        volume: 3, name: '行走', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你离开道观，开始走。沿途的规矩没人写在书上，只能一处一处打听——打听本身要付代价，有人一次扣去三个月阳寿。',
        beats: [{ at: 'world', title: '情报图鉴', text: '规矩没人写在书上，打听本身要付代价——阳寿也是一种钱。' }]
      },
      {
        volume: 4, name: '请神', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '你学会借别人的神：请上身，力量是你的，代价也是你的。借得越久，越难分清哪句是你自己说的。',
        beats: [{ at: 'world', title: '限时 buff 租借', text: '力量是你的，代价也是你的——借得越久，越难分清哪句是自己说的。' }]
      },
      {
        volume: 5, name: '真幻', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '有两处地方在同时发生：一处是道观，一处是白墙。你分不清哪个是真的——而此界最高档的机缘，藏在分不清的地方。',
        beats: [{ at: 'world', title: '真幻双线事件', text: '最高档的机缘藏在分不清的地方——真幻双线同时开着。' }]
      },
      {
        volume: 6, name: '真性', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '你终于确认了自己是什么。修行要往前推，也得往下压——压不住便是走火入魔，压得住，也只是今天压住了。',
        beats: [{ at: 'world', title: '理智（san）条', text: '压得住也只是今天压住了——理智往下走一步，就走火一步。' }]
      },
      {
        volume: 7, name: '秘闻', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '此界最硬的通货不是灵石，是秘密。你知道的每一件事都能换东西，包括你自己的那件事。',
        beats: [{ at: 'world', title: '秘密交易行', text: '最硬的通货不是灵石，是秘密——包括你自己那一件。' }]
      },
      {
        volume: 8, name: '执命', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '你终于看见了坐在天上那些东西。天道的数目是分好的，你争的不是天命，是别人手里那一份。',
        beats: [{ at: 'world', title: '权柄争夺', text: '天道的数目是分好的——你争的不是天命，是别人手里那一份。' }]
      },
      {
        volume: 9, name: '言出', realmFrom: '终局', realmTo: '终局', realmLine: '终局·言出法随',
        prologue: '最后你明白了一件事：此界的规矩是可以被说出来的。你说你是什么，你便是什么——前提是，你说得出。',
        beats: [{ at: 'trial', title: '规则改写', text: '此界的规矩可以被说出来：你说你是什么，你便是什么。' }]
      }
    ],
    rituals: [
      '起乩请神：以自身为容器换外力，短期爆发——限时 buff 的最好包装。',
      '登阶献祭：需付出「代价型货币」才能上一步，且付出不可逆。',
      '言出法随：宣称即成立，作为本界终局与「改规则」类玩法的文案锚点。'
    ],
    ending: {
      text: '高收益 ×1.20 与心魔 ×2、寿元 ×1.25 绑定，属**二周目以上推荐**。',
      rebirthHook: '常备「镇心」类压制道具，前 7 天避开高难事件（对齐增补 v1.2 攻略提示）。'
    },
    namePool: ['药房', '药引', '丹方', '玄鼎', '阳寿', '真性', '走火', '请神', '真幻', '秘闻', '执命', '言出']
  },

  // ══ 07 · 通天界（一念永恒）════════════════════════════════════════════
  tongtian: {
    worldId: 'tongtian',
    title: '通天界长生路',
    tag: '轻快·喜剧',
    identity: '山村少年',
    motif: '怕死的人最想长生；而此界的天道，是可以讲价的。',
    volumes: [
      {
        volume: 1, name: '点香', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你点了十三次香，雷就响了十三回。全村人把你送上山，说这孩子有仙缘——其实你只是想活得久一点。',
        beats: [{ at: 'world', title: '点香引仙', text: '十三次香、十三回雷，全村把你送上山——你只是想活得久一点。' }]
      },
      {
        volume: 2, name: '天道', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '突破有三档：稳的、标准的、赌的。你咬牙选了最险那一档——成了，天地为你改一次规矩；不成，多赔一成家底。',
        beats: [{ at: 'world', title: '突破三档抉择', text: '凡道稳、地道标准、天道赌——成则天地为你改一次规矩。' }]
      },
      {
        volume: 3, name: '铁身', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你练的功法名字很俗，就叫「长生」。铁身、金身、金刚骨，一层一层挨打换来的——被打得越狠，活得越久。',
        beats: [{ at: 'world', title: '肉身抗性挂机', text: '铁身、金身、金刚骨——被打得越狠，活得越久。' }]
      },
      {
        volume: 4, name: '合流', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '三宗合成一宗，你也在合并名单里。旧名字作废，新人新账——乱世里最划算的事，是站到人多的那一边。',
        beats: [{ at: 'sect', title: '宗门合并', text: '旧名字作废，新人新账——乱世里最划算的事是站到人多的那一边。' }]
      },
      {
        volume: 5, name: '炼魂', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '你学会了炼魂，也学会了换身份。面具戴久了，脸就多了一张——此界的好处是：谁都有第二张脸。',
        beats: [{ at: 'world', title: '双身份经营', text: '面具戴久了，脸就多一张——此界的好处是，谁都有第二张脸。' }]
      },
      {
        volume: 6, name: '榜单', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '星空道极榜上，你的名字排在中间。往上看全是老怪，往下看全是新人——你决定往上挪一位，每天挪一位。',
        beats: [{ at: 'sect', title: '排行榜冲榜', text: '往上看全是老怪，往下看全是新人——那就每天往上挪一位。' }]
      },
      {
        volume: 7, name: '冥主', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '你接了一个自己都不信的位子。官职、阵营、称号一件件压上来，压得你连怕死都忘了。',
        beats: [{ at: 'sect', title: '官职 / 阵营晋升线', text: '官职、阵营、称号一件件压上来——压得你连怕死都忘了。' }]
      },
      {
        volume: 8, name: '尊位', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '尊位劫落下那天，天下都知道你的名字了。你却想起当年那个点香的孩子：他只是想活得久一点。',
        beats: [{ at: 'trial', title: '尊位劫', text: '天下都知道你的名字了——你却想起当年那个点香的孩子。' }]
      },
      {
        volume: 9, name: '永恒', realmFrom: '终局', realmTo: '终局', realmLine: '终局·一念永恒',
        prologue: '岁月长河上有两朵花。你只能摘一朵——摘了，这一念便成了永恒；另一朵，留给没讲完的那个人。',
        beats: [{ at: 'trial', title: '终局二选一', text: '两朵花，只能摘一朵——另一朵留给没讲完的那个人。' }]
      }
    ],
    rituals: [
      '点香引仙：点香十三次、雷鸣引来仙师，全村欢送——最喜剧也最温暖的新手开场。',
      '天道筑基：大比夺天脉之气、与对手生死对拼，是本界「突破三档」的风险演示场。',
      '尊位劫 / 长生花：列名天下知 → 岁月长河二选一，作为终局与转世的情感锚点。'
    ],
    ending: {
      text: '天道档失败率较高（自选风险）；终局二选一后同界轮回，熟练度 +3%/世。',
      rebirthHook: '「喜剧类事件负面强度 −10%」已实装（V6.9）：data/worldEvents.js 的 negativeMul 0.9 —— 只减负，不加福。'
    },
    namePool: ['通天宗', '灶房', '长生功', '铁身·金身·金刚骨', '天道突破', '合流宗', '炼魂试炼', '星墟道榜', '冥主位', '尊位劫', '岁月长河', '长生花']
  },

  // ══ 08 · 天工界（仙工开物）════════════════════════════════════════════
  tiangong: {
    worldId: 'tiangong',
    title: '天工界造物路',
    tag: '匠造·建造',
    identity: '匠户子弟',
    motif: '别人抢机缘，你造机缘——一件作品，可以把规矩砸出一个洞。',
    volumes: [
      {
        volume: 1, name: '拆解', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '别人打完架收战利品，你收的是别人不要的东西：一枚储物袋上的旧阵、半块烧焦的精铁。拆开了，全是料。',
        beats: [{ at: 'world', title: '战利品拆解 / 回收', text: '别人不要的东西拆开了全是料——离线产线从这里起步。' }]
      },
      {
        volume: 2, name: '工坊', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '你的工坊不卖成品，只卖两样东西：一件趁手的器具，和一个不肯说的方法。为了处理一种材料，你会专门造一件工具。',
        beats: [{ at: 'world', title: '图纸 → 工具 → 成品', text: '为了处理一种材料，专门造一件工具——本界的科技树由此往上长。' }]
      },
      {
        volume: 3, name: '炸宫', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你造了个会自己走路的东西，让它带着千斤火精贴着仙宫自爆。门槛被硬生生砸下来一截，钟声传遍全城——从这天起，城里开始有人打听你的名字。',
        beats: [{ at: 'dungeon', title: '用产品砸开门槛', text: '一件会自己走路的东西贴上去自爆——门槛被硬生生砸下来一截。' }]
      },
      {
        volume: 4, name: '悬丝', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '你的魂不在身上，在一根丝上。没头的时候先找头，没手的时候先跑起来——身体是拼出来的，路也是。后来你把这根丝也种进了别人身上，从此看得见人心。',
        beats: [{ at: 'world', title: '魂魄寄宿机关体', text: '身体是拼出来的，路也是——悬丝种进别人身上，从此看得见人心。' }]
      },
      {
        volume: 5, name: '量产', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '第一只机关猴花了你三个月，第二十只花了三天。既然这套东西能复制，那就让它成建制地动起来——从这天起，你不是一个人在挂机，是一队。',
        beats: [{ at: 'world', title: '机关坊产线', text: '第一只三个月，第二十只三天——从这天起，你是一队在挂机。' }]
      },
      {
        volume: 6, name: '副城', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '黑市重新回到你手里，城里又添了一个副城主的位子。你想的不是风光，是那间工坊能不能再大一点、进出城的货能不能少交一道税。',
        beats: [{ at: 'world', title: '产业与权位双轨', text: '你想的不是风光，是工坊能不能再大一点、货能不能少交一道税。' }]
      },
      {
        volume: 7, name: '三田', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '别人一个丹田，你三个：三条产线同时开工，各算各的账。忙是真忙，快也是真快——别人练一遍的功夫，你已经练了三遍。',
        beats: [{ at: 'world', title: '三丹田三修', text: '三条产线同时开工——别人练一遍的功夫，你已经练了三遍。' }]
      },
      {
        volume: 8, name: '立威', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '元婴们一个接一个地站到你这边，城主府的旧账开始被人重新算。你造了一辈子东西，最强的那件第一次摆在明面上：名分。',
        beats: [{ at: 'sect', title: '高层结盟 / 座次重排', text: '你造了一辈子东西，最强的那件第一次摆到明面上：名分。' }]
      },
      {
        volume: 9, name: '断丝', realmFrom: '终局', realmTo: '终局', realmLine: '终局·不做木偶',
        prologue: '有人告诉你，你这一生早被安排好了，你只是台上的木偶。你扯断了那根丝——从今往后，剧本自己写。',
        beats: [{ at: 'trial', title: '终局抉择', text: '你扯断了那根丝——从今往后，剧本自己写。' }]
      }
    ],
    rituals: [
      '炸仙宫 · 传法钟：一键引爆 + 全城公告，把「制造业爽点」做成一个可复现的全服事件。',
      '悬丝拼装：从找回头颅到拼出手臂，机关体组装的觉醒演出；随后引出「忠诚可视」的下属线。',
      '断丝反叛：拒做木偶，制造业主角对系统规则的终极反叛——终局文案锚点。'
    ],
    ending: {
      text: '前期工艺门槛导致解锁慢，中后期靠产线反超。',
      rebirthHook: '傀儡挂机位（最多 +2）已实装（V6.8）：按本界世数保留（第 N 世 +N−1），秘境派遣槽位直接叠加。'
    },
    namePool: ['赤柿城', '机关坊', '悬丝术', '人命悬丝', '爆炎猴', '机关猴', '苍铁甲', '黑市', '白手兴坊', '三丹田', '传讯钟', '熔岩宫']
  },

  // ══ 09 · 六面囚笼（谁让他修仙的！）════════════════════════════════════
  liumian: {
    worldId: 'liumian',
    title: '六面囚笼解构路',
    tag: '解构·玩梗',
    identity: '五大仙门新弟子',
    motif: '天庭是编的，传承有真有假——看破的人拿走全部。',
    volumes: [
      {
        volume: 1, name: '测灵', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '测灵根那天，长老们看着你的结果，客气得反常。他们请你「务必谦让」，从此你多了个老实人的名头。',
        beats: [{ at: 'world', title: '测灵根仪式', text: '长老们客气得反常——从此你多了个「老实人」的名头。' }]
      },
      {
        volume: 2, name: '豆腐', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '你的入门功课是抓豆腐：力道重一分就碎，轻一分就掉。于是你天天吃豆腐，吃到同门都以为你穷。',
        beats: [{ at: 'world', title: '重复训练挂机', text: '抓豆腐练出的手感——重复训练也是一条熟练度产线。' }]
      },
      {
        volume: 3, name: '殿务', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '执事殿的兑换榜什么都敢写：贡献点、灵液，甚至「当一天宗主」。你认真研究了一下午，最后换了两样最实在的。',
        beats: [{ at: 'sect', title: '委托板＋贡献点商店', text: '兑换榜上什么都敢写，甚至「当一天宗主」——你换了两样最实在的。' }]
      },
      {
        volume: 4, name: '卧底', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '你被派去魔教卧底，结果魔教比正派人还好相处。两边都有人给你发任务，你谁也没告诉。',
        beats: [{ at: 'world', title: '阵营声望双轨', text: '两边都有人给你发任务——你谁也没告诉。' }]
      },
      {
        volume: 5, name: '盲盒', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '此界的天劫是盲盒：有时弱得离谱，有时强得离谱，开之前谁也不知道。你学会了留三分余地。',
        beats: [{ at: 'world', title: '天劫盲盒', text: '开之前谁也不知道里面是什么——所以你学会了留三分余地。' }]
      },
      {
        volume: 6, name: '骗局', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '有人在卖「上古传承」，写得极真。你多问了两句，卖家脸色变了——看破骗局的人，能拿走卖家身上所有的灵石。',
        beats: [{ at: 'world', title: '假传承骗术', text: '你多问了两句，卖家脸色就变了——看破的人拿走全部。' }]
      },
      {
        volume: 7, name: '代练', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '有位上古仙友看你太辛苦，说：这阵子我替你修炼。你醒来时修为涨了一截，她打着哈欠说不用谢。',
        beats: [{ at: 'world', title: '离线代练', text: '有人替你修炼了一个月，醒来时修为涨了一截——她打着哈欠说不用谢。' }]
      },
      {
        volume: 8, name: '对弈', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '你跟自己下了一盘棋：一边是宗主，一边是少教主，两边都是你。最后你输了半子，赢了整局。',
        beats: [{ at: 'world', title: '分身对战', text: '一边是宗主，一边是少教主，两边都是你——你输了半子，赢了整局。' }]
      },
      {
        volume: 9, name: '创境', realmFrom: '终局', realmTo: '终局', realmLine: '终局·自创一境',
        prologue: '此界的境界是被人定的，所以也能被人改。你给自己定了一个新境界——从今天起，有人要照着你的名字往上爬。',
        beats: [{ at: 'trial', title: '自创境界', text: '此界的境界既能被人定，就能被人改——从今天起，有人照着你的名字往上爬。' }]
      }
    ],
    rituals: [
      '测灵根：公开测评＋标签（「老实人」），开局即给玩家一个人设与社交预期。',
      '宗主一日体验游：用贡献点兑换「当一天宗主」，最好的玩梗型限时玩法。',
      '自创新境界：无中生有创造一个境界，作为本界终局与「改规则」文案锚点。'
    ],
    ending: {
      text: '产出 ×1.10 但伴随「神棍」诱惑事件（错误选择损失带微弱回本）；终局自创境界后同界轮回，熟练度 +3%/世。',
      rebirthHook: '终局按已读到章节收束（原著第 1085 章后混入他书，结局未定位）。'
    },
    namePool: ['五大仙门', '执事殿', '贡献点', '兑换榜', '豆腐', '仿生拳', '扛牛丹', '天劫盲盒', '假传承', '神棍', '代练仙友', '自创新境']
  },

  // ══ 10 · 九鼎九州（大乘期才有逆袭系统）════════════════════════════════
  jiuding: {
    worldId: 'jiuding',
    title: '九鼎九州功德路',
    tag: '功德·秩序',
    identity: '州县少年',
    motif: '此界的主角早已不必变强——他要做的是，让这个世界配得上他。',
    volumes: [
      {
        volume: 1, name: '县学', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '你从州县起步，接的第一件事不是修行，是替人跑一趟腿。人皇殿的告示贴满了城墙：哪处有灾、哪处要人。',
        beats: [{ at: 'sect', title: '人皇殿任务网', text: '第一件事不是修行，是替人跑腿——告示贴满了城墙。' }]
      },
      {
        volume: 2, name: '任务', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '系统给你的任务，级别低得可笑。你照做了——因为在这个世界，任务不是给强者发的，是给愿意做事的人发的。',
        beats: [{ at: 'sect', title: '系统任务板', text: '任务不是给强者发的，是给愿意做事的人发的——照做就是。' }]
      },
      {
        volume: 3, name: '功德', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你做了一件不算大的善事，金榜上多了一行字。后来你发现：这一行字，能抵掉两成突破的成本。',
        beats: [{ at: 'world', title: '功德换突破折扣', text: '金榜上多了一行字，能抵掉两成突破的成本——本界最强的资源是名声。' }]
      },
      {
        volume: 4, name: '金榜', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '功德金榜每季一开，榜上有名者不必自证。你排在第几不重要，重要的是榜下有人认得你的名字。',
        beats: [{ at: 'sect', title: '金榜排名', text: '榜上有名者不必自证——榜下有人认得你的名字就够了。' }]
      },
      {
        volume: 5, name: '修路', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '你重画了九州的地图，把垄断了百年的东西公开了出来。这一笔功德大得吓人——原来改变世界的门槛，可以只是一张图。',
        beats: [{ at: 'world', title: '基建解锁', text: '改变世界的门槛，可以只是一张图——这一笔功德大得吓人。' }]
      },
      {
        volume: 6, name: '著书', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '你把这一生的修炼心得写成一本书，署了真名。此后州县学堂人手一册——你不再是强者，是先生。',
        beats: [{ at: 'world', title: '著书立说', text: '此后州县学堂人手一册——你不再是强者，是先生。' }]
      },
      {
        volume: 7, name: '提携', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '你点了几个年轻人的名字，说他们配得上更高的位子。有人不服，你只回了一句：那就让他们试。',
        beats: [{ at: 'sect', title: '弟子 / 门客培养', text: '有人不服，你只回一句：那就让他们试。' }]
      },
      {
        volume: 8, name: '碎片', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '通往仙界的天梯断了，只剩碎片散在各处。你一片一片地捡——这是此界唯一还值得花时间的长线。',
        beats: [{ at: 'dungeon', title: '碎片长线收集', text: '天梯断了只剩碎片——此界唯一还值得花时间的长线。' }]
      },
      {
        volume: 9, name: '圆满', realmFrom: '终局', realmTo: '终局', realmLine: '终局·功德圆满',
        prologue: '此界不许飞升。你在人皇殿前站了一整天，来的人比想象中多——他们不是来道贺的，是来告别的。',
        beats: [{ at: 'trial', title: '终局替代', text: '此界不许飞升：来的人不是道贺的，是来告别的。' }]
      }
    ],
    rituals: [
      '迟到的新手礼包：满级主角收到练气期奖励——最好的「逆向成长」开场演出。',
      '重画九州：一件善举改变世界规则，功德系统的高光。',
      '人皇殿欢迎会：世界自发为主角办的庆典，长线内容以群像日常收尾（终局演出）。'
    ],
    ending: {
      text: '飞升禁用至末期，第 72 级关口改为「功德圆满」结算。',
      rebirthHook: '终局后同界轮回，功德折扣已实装（V6.8）：本界功德按 35% 结转跨世，每 500 点折突破成本 −20%。'
    },
    namePool: ['九州', '州县', '人皇殿', '功德金榜', '仙梯残片', '善行录', '修行总纲', '继任者', '五统领', '仙界方位', '重炼', '功德圆满']
  },

  // ══ 11 · 无缺古界（我欲封天）══════════════════════════════════════════
  wuyuan: {
    worldId: 'wuyuan',
    title: '无缺古界走满路',
    tag: '古典·极致',
    identity: '落第书生 · 杂役入门',
    motif: '此界的境界从来不是一条直线——同一境里有人有缺、有人无暇，传说还有一种走满了的。穷没关系，走到最后别留缺口。',
    volumes: [
      {
        volume: 1, name: '落第', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '第三次落第那天，你在崖边听见有人喊救命。你把藤条顺下去救了人，也没想到自己会一起被带进山门——从此柴房、砍木、看人脸色。别人冲着满阁的宝光去抢法宝，你挑了一面连标价都没有的旧鉴。后来回头看，陪你走到最后的，就是这天最不起眼的那件东西。',
        beats: [{ at: 'world', title: '杂役起步 ＋ 随手捡漏', text: '满阁宝光里你挑了最不起眼的那件——它陪你走到了最后。' }]
      },
      {
        volume: 2, name: '负山', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '你所在的这支没落宗门，千年前不是这个名字。吞下一枚没人认得出的古兽之丹，拿到一部人人都在找的残经，你才第一次听说：同样一个境界，也分走没走满。有人有缺，有人无暇，还有一种整个大地几百年不见一次的——偏偏你走到了它上面。',
        beats: [{ at: 'world', title: '无缺三档 ＋ 宗门真名线', text: '同样一个境界也分走没走满：有缺、无暇，还有一种几百年不见一次的。' }]
      },
      {
        volume: 3, name: '南域', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '故乡那一场风雨过去，你背上行囊到了更大的地方。这里没人记得你从哪里来，也不在乎你多穷——只看你现在站第几层。你拜进大宗，在一次又一次被看轻之后，把高出一整境的人打了下来。',
        beats: [{ at: 'sect', title: '换宗门 ＋ 越境而战', text: '这里只看你站第几层——你把高出一整境的人打了下来。' }]
      },
      {
        volume: 4, name: '赐名', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '你有了自己的丹炉，也学会了一门「叫出名字」的本事：器物、草木之灵、半成形的器灵，你给它一个名字，它就替你站稳。从此你不再只是一个人赶路——身后跟着一整炉被你点化过的东西。',
        beats: [{ at: 'world', title: '赐名术 ＋ 丹道成型', text: '你给它一个名字，它就替你站稳——身后跟着一整炉被你点化过的东西。' }]
      },
      {
        volume: 5, name: '问禁', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '越往上走，你就越发现这世界留着一套层层加锁的东西。每解开一道，就多一门别人练不了的手段；越往上的锁，解开时越疼。你一边走一边拆，把它们一条条记在自己身上。',
        beats: [{ at: 'world', title: '九道封禁 ＋ 远古战场', text: '越往上的锁，解开时越疼——每解一道，就多一门别人练不了的手段。' }]
      },
      {
        volume: 6, name: '取舍', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '到了这一层，天把两样东西同时放到你手里：要力量，还是要那个人陪你走完这一段。此界所有喜欢砰一声解决的事，最后都败在这类问题上——选了就得认，认了就别回头。',
        beats: [{ at: 'world', title: '取舍型仪式 ＋ 半步里程碑', text: '要力量，还是要那个人陪你走完这一段——选了就得认。' }]
      },
      {
        volume: 7, name: '试炼', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '整片大地办了一场所有人都来参加的试炼。长辈们教的是同一句话：厚积薄发——先压着不突破，攒到极致再一次性冲上去，能开出最多的一条路。你照做了，也把攒了很久的东西一次放出。',
        beats: [{ at: 'sect', title: '全境大试炼 ＋ 厚积薄发', text: '先压着不突破，攒到极致再一次性冲上去——能开出最多的一条路。' }]
      },
      {
        volume: 8, name: '一方天地', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '最强的东西不是拿来打架的——你把最重的那一道禁，化成了一整片海和天，给后来的人留了一条能走的道。这时候的你，已经可以不去在意谁认不认你了。',
        beats: [{ at: 'world', title: '铸造一方天地 ＋ 道源回归', text: '最强的东西不是拿来打架的——你把它化成一片海天，留给后来者。' }]
      },
      {
        volume: 9, name: '出世', realmFrom: '终局', realmTo: '终局', realmLine: '终局·不分你我',
        prologue: '最后一战的对手，是这片天本身。你赢的不是一座山、一个宗，而是「走出去」这三个字。你把自己最强的那一道，留在世界里让所有人都能练；然后在某一天带着要走的人，安静地离开——像来时那条河上的一片帆。',
        beats: [{ at: 'trial', title: '终局＝出世 ＋ 九世凝一身', text: '你赢的不是一座山，而是「走出去」这三个字——然后安静地离开。' }]
      }
    ],
    rituals: [
      '满阁宝光里的那面旧鉴：开局演出。最不起眼的那件东西陪到终局，是本界「低起点 × 长线」最好的文案锚点。',
      '一刀无缺：境界分有缺 / 无暇 / 无缺三档，每一境都要「走满」才算数——是 friction（境界更密）最有依据的解释，也是玩家的每境仪式。',
      '给那片海起名字：把最强的那一道化成一方天地留下来，是「不改数值、只改规则」型终局最好的收尾。'
    ],
    ending: {
      text: '原著已完结（第 1614 章），终局为**出世**——不设飞升，主角把自己最强的道留下（化一方山海，人人可练），随后带人离开。',
      rebirthHook: '轮回沿用「九世凝一身」已实装（V6.8）：熟练度系数 ×1.5（高于它界），每世保留一部分，第九世合一。'
    },
    namePool: ['负山宗', '青铜旧鉴', '云泽县', '大岷山', '有缺／无暇／无缺三档', '道源真经', '荒龙丹', '镇荒古玉', '九道封禁', '赐名术', '本命丹炉', '寒原荒帝', '凌霄古桥', '厚积薄发', '重溟九洲', '第九海疆', '出世']
  },

  // ══ 12 · 人间香火（我本无意成仙）══════════════════════════════════════
  xianghuo: {
    worldId: 'xianghuo',
    title: '人间香火游历路',
    tag: '神道·游历',
    identity: '山间道观少年',
    motif: '慢慢走，但别停下——此界不许长生，只许你把路走完。',
    volumes: [
      {
        volume: 1, name: '辞山', realmFrom: '炼气', realmTo: '筑基', realmLine: '炼气·引气入体',
        prologue: '师父让你下山走二十年，不为成仙，只为看看。你带了一只猫、一包袱符，从千年古柏下的山道走出去。',
        beats: [{ at: 'world', title: '出发演出', text: '一只猫、一包袱符，从千年古柏下的山道走出去——最强的「出发」。' }]
      },
      {
        volume: 2, name: '除妖', realmFrom: '筑基', realmTo: '金丹', realmLine: '筑基·筑就道基',
        prologue: '第一单生意是替人除一只小妖，钱不多，够租半间屋。你把招牌挂出去，从此靠手艺吃饭。',
        beats: [{ at: 'sect', title: '接单赚钱 / 据点租赁', text: '钱不多，够租半间屋——招牌挂出去，从此靠手艺吃饭。' }]
      },
      {
        volume: 3, name: '留名', realmFrom: '金丹', realmTo: '元婴', realmLine: '金丹·凝气成丹',
        prologue: '你在一处地方除完妖，随手在墙上写了「某年某月到此除妖」。后来才知道，留名的比除妖的更让人记得住。',
        beats: [{ at: 'world', title: '碑刻留名', text: '留名的比除妖的更让人记得住——碑刻进了游历墙。' }]
      },
      {
        volume: 4, name: '京城', realmFrom: '元婴', realmTo: '化神', realmLine: '元婴·破丹化婴',
        prologue: '大城里什么都有：城隍、香火、鬼市，还有一座用民心铸起来的金身。你在京城待得最久，也最不像自己。',
        beats: [{ at: 'world', title: '大城市副本', text: '城隍、香火、鬼市，还有一座民心铸起的金身——你在这里待得最久。' }]
      },
      {
        volume: 5, name: '神像', realmFrom: '化神', realmTo: '炼虚', realmLine: '化神·神念外放',
        prologue: '一夜之间，天下的神像都碎了。你才明白此界的神也是会退位的——香火在谁手里，谁就是神。',
        beats: [{ at: 'world', title: '神灵任免', text: '一夜之间天下神像皆碎——香火在谁手里，谁就是神。' }]
      },
      {
        volume: 6, name: '口碑', realmFrom: '炼虚', realmTo: '合体', realmLine: '炼虚·熔炼虚空',
        prologue: '你还没到，茶楼里已经在讲你的故事，讲得比真的还像真的。你的猫甚至先你一步，替你办完了一件事。',
        beats: [{ at: 'world', title: '口碑先于玩家到达', text: '你还没到，茶楼里已经在讲你的故事——你的猫先你一步办完了事。' }]
      },
      {
        volume: 7, name: '建庙', realmFrom: '合体', realmTo: '大乘', realmLine: '合体·法则入体',
        prologue: '你开始修庙。庙不大，香火却日日累积——此界不许长生，那就用香火换一点时间，再换一点运气。',
        beats: [{ at: 'world', title: '香火庙宇产线', text: '此界不许长生——那就用香火换一点时间，再换一点运气。' }]
      },
      {
        volume: 8, name: '祈雨', realmFrom: '大乘', realmTo: '终局', realmLine: '大乘·道法大成',
        prologue: '大漠三年无雨，你去借。借雨要付代价，付得起就下——此界的强者不是能赢的人，是能替人要到东西的人。',
        beats: [{ at: 'world', title: '地域神交易', text: '此界的强者不是能赢的人，是能替人要到东西的人——雨也一样。' }]
      },
      {
        volume: 9, name: '传承', realmFrom: '终局', realmTo: '终局', realmLine: '终局·回到山上',
        prologue: '二十年满，你回到观里。故人一个一个送别过，山门还是那道山门——传承交到你手上，像当年交到师父手上一样。',
        beats: [{ at: 'trial', title: '传承交替', text: '故人一个一个送别过，山门还是那道山门——传承交到你手上。' }]
      }
    ],
    rituals: [
      '一笑出门去：辞别师父与观中老八哥，踏上千年古柏的山道——最强的「出发」演出。',
      '民心铸金身 / 神像皆碎：香火与民心凝成金身、一夜之间天下神像尽碎，信仰体系剧变。',
      '传承的交替：二十年游历以故人巡礼回收全部地名，回山传承担当——长线收束。'
    ],
    ending: {
      text: '寿元流速 1s = 3 天（全界最大寿元压力），香火与延寿丹是生存线；终局「传承」后同界轮回，熟练度 +3%/世。',
      rebirthHook: '香火庙宇按既有第二产线规则延续。'
    },
    namePool: ['青芜山', '山间道观', '猫神', '符箓', '纸马', '雷法', '香火', '金身', '民心', '城隍', '鬼市', '祈雨', '游历碑']
  }
}

// ── 查询（纯函数；未登记界一律回落 null / ''，损坏档不抛错）────────────────────

/** 等级 → 卷号（1~9）；越界钳制，非法值按 1 级算 */
export function volumeOfLevel (level) {
  const n = Number(level)
  const L = Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), LEVEL_MAX) : 1
  for (const v of VOLUMES) {
    if (L >= v.from && L <= v.to) return v.volume
  }
  return VOLUMES[VOLUMES.length - 1].volume
}

/** 卷号 → 该卷定义（1~9）；越界返回 null */
export function volumeMeta (volume) {
  const i = Number(volume)
  if (!Number.isFinite(i) || i < 1 || i > VOLUMES.length) return null
  return VOLUMES[i - 1]
}

/** 取某界路线；未登记 / 脏值返回 null（调用方自行回落通用表现） */
export function routeOf (worldId) {
  if (typeof worldId !== 'string' || !worldId) return null
  return WORLD_ROUTES[worldId] || null
}

/** 取某界某卷的卷数据（含 prologue / realmLine / beats）；未登记返回 null */
export function volumeOfWorld (worldId, volume) {
  const r = routeOf(worldId)
  if (!r) return null
  const v = Number(volume)
  if (!Number.isFinite(v) || v < 1 || v > r.volumes.length) return null
  return r.volumes[v - 1]
}

/** 等级 → 某界阶段句（`大境·四字`）；未登记界返回 ''（调用方回落 realms.js 的通用 flavor） */
export function realmLineOf (worldId, level) {
  const v = volumeOfWorld(worldId, volumeOfLevel(level))
  return v ? v.realmLine : ''
}

/** 卷首开场白；未登记界 / 越界卷返回 '' */
export function prologueOf (worldId, volume) {
  const v = volumeOfWorld(worldId, volume)
  return v ? v.prologue : ''
}

/** 该卷的节点演出列表（可空数组）；未登记界返回 [] */
export function beatsOf (worldId, volume) {
  const v = volumeOfWorld(worldId, volume)
  return v && Array.isArray(v.beats) ? v.beats.slice() : []
}

/** 按挂载类别筛节点（'trial' | 'dungeon' | 'sect' | 'world'）；未给 at 时返回全部 */
export function beatsAt (worldId, volume, at) {
  const list = beatsOf(worldId, volume)
  return at ? list.filter((b) => b.at === at) : list
}

/** 该卷的卷名（2 字）；未登记界返回 '' */
export function volumeNameOf (worldId, volume) {
  const v = volumeOfWorld(worldId, volume)
  return v ? v.name : ''
}

/** 三个仪式节点；未登记界返回 [] */
export function ritualsOf (worldId) {
  const r = routeOf(worldId)
  return r && Array.isArray(r.rituals) ? r.rituals.slice() : []
}

/** 终局与转世衔接；未登记界返回 null */
export function endingOf (worldId) {
  const r = routeOf(worldId)
  return r ? r.ending : null
}

/** 命名池；未登记界返回 [] */
export function namePoolOf (worldId) {
  const r = routeOf(worldId)
  return r && Array.isArray(r.namePool) ? r.namePool.slice() : []
}

/** 已登记的界 id 列表（与 worlds.js 顺序无关，仅作遍历用） */
export function routeIds () {
  return Object.keys(WORLD_ROUTES)
}

export default {
  STORY_VERSION, VOLUMES, WORLD_ROUTES,
  volumeOfLevel, volumeMeta, routeOf, volumeOfWorld,
  realmLineOf, prologueOf, beatsOf, beatsAt, volumeNameOf,
  ritualsOf, endingOf, namePoolOf, routeIds
}
