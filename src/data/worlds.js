/**
 * worlds.js —— 十二世界卡池（只读配置层）（2.9）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《设计增补 v1.2》——随机世界开局：十二世界卡池 + 开发计划 模块 2.9。
 *
 * 设计原则（增补 v1.2）：骨架不变，世界只做「皮肤＋修正＋专属内容」——
 *   72 级数值骨架、渡劫三道天雷、寿元时钟等底座全局通用；世界提供 ±20% 内的
 *   环境修正与「1 个核心专属 ＋ 1 个摩擦项」，保证多样性且不破坏平衡。
 *
 * 范围（本模块 MVP）：
 *   · 12 世界等概率抽取（各 1/12）+ 开局 1 次免费重掷
 *   · 世界修正立即生效：产出 rateMul ／ 寿元流速 ／ 天劫强度 ／ 灵根突破成本
 *   · 熟练度字段（同界轮回 +3%/世，封顶 +15%）——触发点随转世系统（阶段二）接入
 *   ——12 套专属事件池 / 12 个招牌秘境 / 各世界专属机制（小天劫·掌天瓶·灵气费·
 *     剑冢·机关坊·香火庙宇·功德系统·技炼公会…）/ 界镜道具 / 界游符换界 ＝ 内容批次 2/3。
 *
 * 口径（增补 v1.2 §二 总表 + §三 详情卡）：
 *   · 产出修正 rateMul ∈ [0.90, 1.20]（护栏：世界间期望收益差 ≤ 15%）
 *   · 寿元流速 lifespanMul：**倍率**（基准＝1 现实分钟 = 1 游戏天，见 lifespan.js）；
 *     幽傩界 ×1.25、人间香火 ×1.5（世界摩擦项）
 *   · 天劫强度 trialMul：默认 1.0；破晓星域 1.10（天劫需求战力 +10%）
 *   · 灵根成本 rootCost：默认 1.0；青岚界伪灵根 ×1.10（低资质惩罚加重）
 *   · 对外命名用「对外名」，不复用原型作品专名（原型作品名仅内部设计参照）
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 同界轮回熟练度：每世 +3%，封顶 +15%（增补 v1.2 §一.4） */
export const MASTERY = { perRebirth: 0.03, cap: 0.15 }

/** 开局抽取规则（增补 v1.2 §一.2）：12 池等概率；开局免费重掷 1 次 */
export const DRAW = { freeRerolls: 1 }

/** 世界池（12 界，顺序即 index；等概率 1/12） */
export const WORLDS = [
  {
    id: 'qinglan',
    name: '青岚界',
    proto: '凡人修仙传',
    tag: '经典·均衡',
    color: '#7fd6a8',
    rateMul: 1.00,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: { false: 1.10 },          // 伪灵根突破成本 +10%（低资质惩罚加重）
    identity: '山村少年 · 外门弟子',
    desc: '灵气适中，不偏不倚，最是适合初入道途之人。',
    exclusive: '元婴后定期「小天劫」考核（过则得雷淬资源）；「掌天瓶」催熟灵田',
    friction: '伪灵根突破成本 +10%（洗髓价值更高）'
  },
  {
    id: 'poxiao',
    name: '破晓星域',
    proto: '仙逆',
    tag: '因果·进阶',
    color: '#9fb8ff',
    rateMul: 0.95,
    lifespanMul: 1.0,
    trialMul: 1.10,                      // 天劫需求战力 +10%
    rootCost: {},
    identity: '边陲小宗杂役',
    desc: '星空浩渺，因果如丝，逆天者于此界争一线天机。',
    exclusive: '因果事件链密度 ×1.5；「天逆珠」渡劫失败免罚一次（每世 1 枚）',
    friction: '天劫需求战力 +10%'
  },
  {
    id: 'denghuo',
    name: '灯火人间',
    proto: '修真聊天群',
    tag: '都市·轻快',
    color: '#ffb37a',
    rateMul: 0.90,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '大学城学生',
    desc: '修行与都市并存，一盏灯火下照见群友的道心。',
    exclusive: '「灵气费」灵石买灵气；聊天群任务板（日常任务 ×2）',
    friction: '基础产出最低（×0.90），依赖任务收益'
  },
  {
    id: 'qingyun',
    name: '青云古界',
    proto: '诛仙',
    tag: '古典·正魔',
    color: '#7fd6c8',
    rateMul: 1.00,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '名门弟子',
    desc: '正魔两道剑拔弩张，剑冢之中藏着无上传承。',
    exclusive: '「剑冢」法宝成长线；周期「正魔大战」事件',
    friction: '无飞升——终局改为「剑意超脱」（满级转世奖励 +20%）'
  },
  {
    id: 'wangzu',
    name: '望族山河',
    proto: '玄鉴仙族',
    tag: '家族·经营',
    color: '#ffd98a',
    rateMul: 1.05,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '家族子弟',
    desc: '一姓之族，山河为业，把家族带到第一方是此界大愿。',
    exclusive: '家族职权（族贡换资源）；「符种天赋」开局灵根保底真灵根',
    friction: '族贡抽成 10%（资源上缴换家族权益）'
  },
  {
    id: 'younuo',
    name: '幽傩界',
    proto: '道诡异仙',
    tag: '黑暗·高难',
    color: '#c98bff',
    rateMul: 1.20,
    lifespanMul: 1.25,                   // 寿元流速 ×1.25（此界最短寿）
    trialMul: 1.0,
    rootCost: {},
    identity: '药房杂役',
    desc: '诡异横行，心神易失；高收益之下是随时噬人的黑暗。',
    exclusive: '诡异资源（炼器强化 +15%）；「真幻双线」最高档事件',
    friction: '心魔事件 ×2；寿元流速 1s = 2.5 天'
  },
  {
    id: 'tongtian',
    name: '通天界',
    proto: '一念永恒',
    tag: '轻快·喜剧',
    color: '#9fd6ff',
    rateMul: 1.05,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '山村少年',
    desc: '喜剧当头，天道也可讲价；突破有三档，稳中带浪。',
    exclusive: '「突破三档」每次大境界可选：凡道稳 / 地道标准 / 天道赌',
    friction: '天道档失败率较高（自选风险）'
  },
  {
    id: 'tiangong',
    name: '天工界',
    proto: '仙工开物',
    tag: '匠造·建造',
    color: '#b8c98b',
    rateMul: 0.95,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '匠户子弟',
    desc: '百工造物，机关成军；三丹田三修，先苦后甜。',
    exclusive: '「机关坊」产线（傀儡自动挂机，最多 +2 位）；三丹田三修',
    friction: '前期解锁慢（工艺门槛），中后期反超'
  },
  {
    id: 'liumian',
    name: '六面囚笼',
    proto: '谁让他修仙的！',
    tag: '解构·玩梗',
    color: '#b9a8c9',
    rateMul: 1.10,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '五大仙门新弟子',
    desc: '天庭是编的，传承有真有假；看破骗局者得厚报。',
    exclusive: '「天劫盲盒」随机爆改；假传承骗术（看破得高额灵石）',
    friction: '「神棍」事件诱惑错误选择（损失带微弱回本）'
  },
  {
    id: 'jiuding',
    name: '九鼎九州',
    proto: '大乘期才有逆袭系统',
    tag: '功德·秩序',
    color: '#e8c878',
    rateMul: 1.00,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '州县少年',
    desc: '行善积德，功德金榜留名；秩序之下，稳健登仙。',
    exclusive: '功德系统（善行换突破折扣，最高 −20%）；人皇殿任务网',
    friction: '飞升禁用至末期（终局以「功德圆满」替代）'
  },
  {
    id: 'wuyuan',
    name: '武元大陆',
    proto: '没钱修什么仙？',
    tag: '武道·经商',
    color: '#e8986a',
    rateMul: 1.05,
    lifespanMul: 1.0,
    trialMul: 1.0,
    rootCost: {},
    identity: '落魄皇族 · 寒门学生',
    desc: '没钱修什么仙？元石开路，技炼四会，倒卖成道。',
    exclusive: '元石经济；技炼公会（丹/器/符/阵四条生产链，可交易）',
    friction: '境界细分更密（每境九重天，小瓶颈 +20%）'
  },
  {
    id: 'xianghuo',
    name: '人间香火',
    proto: '我本无意成仙',
    tag: '神道·游历',
    color: '#cfc7ba',
    rateMul: 0.95,
    lifespanMul: 1.5,                    // 寿元流速 ×1.5（长生最难）
    trialMul: 1.0,
    rootCost: {},
    identity: '山间道观少年',
    desc: '天道不许长生，唯有香火续命；慢慢走，但别停下。',
    exclusive: '「香火庙宇」第二产线（建庙收香火，可换延寿与气运）',
    friction: '寿元流速 1s = 3 天（长生最难的世界）'
  }
]

/** 取世界定义；未登记 id 返回 null（损坏档兜底，装配层据此回退默认） */
export function getWorld (id) {
  return WORLDS.find((w) => w.id === id) || null
}

/** 按随机数 roll 世界（等概率 1/12；r ∈ [0,1) 映射到 index） */
export function rollWorldIndex (r = Math.random()) {
  return Math.min(WORLDS.length - 1, Math.floor(r * WORLDS.length))
}

/** 重掷池（排除当前世界，从其余 11 个等概率抽）——重掷语义＝「换一个」 */
export function rerollWorldIndex (excludeId, r = Math.random()) {
  const pool = WORLDS.filter((w) => w.id !== excludeId)
  const idx = Math.min(pool.length - 1, Math.floor(r * pool.length))
  return WORLDS.indexOf(pool[idx])
}

export default { WORLDS, MASTERY, DRAW, getWorld, rollWorldIndex, rerollWorldIndex }
