/**
 * events.js —— 随机事件池 + 气运档位表（只读配置层）(2.3)
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《世界事件库 v1》（槽位结构 / 当量标准 / 触发权重 / 校验口径）
 *       +《设计增补 v1.1》§三（气运五档表 / 频率 / 自动策略 / 气运增减）。
 *
 * 批 C 分界池（V6.1 样板 2 界 → V6.3 铺满）：**12 界齐备**——青岚（§01，原生）＋ V6.1 观云界
 *   （§03 换源新卡）/ 无缺古界（§11 换源新表）＋ V6.3 破晓（§02）/ 青云（§04）/ 望族（§05）/
 *   幽傩（§06）/ 通天（§07）/ 天工（§08）/ 六面（§09）/ 九鼎（§10）/ 香火（§12）。
 *   世界池由 EventSystem.worldPoolId 按 state.world.worldId 选取（未抽定 / 未登记 → 回退 common）；
 *   poolSplit 与当量口径一律不变 → 青岚界行为逐位不变。追加新界照同一模板（每池槽位照 §一，
 *   id 用 `evt_<界前缀>_<拼音>`）。
 *   文案口径：观云界按**剧情册 §三 03 新卡**（原型已换为《我师兄实在太稳健了》）重写，不采用
 *     《世界事件库 v1》§03 旧表（其「灵气费 / 聊天群任务板」已由剧情册 §1.5 判为原著侧失据）；
 *     无缺古界照《世界事件库 v1》§11 换源后新表。
 *   效果映射注记：观云招牌的「渡劫调息」走既有 tribCdExtraSec（V6.10 核对：2.5 有消费点）；
 *     六面「真假天劫符」走 **tribEasePct**（V6.10 批 H 新增字段：下次渡劫单雷 +N%，一次性，渡劫后清）；
 *     「小瓶颈 ±%」（无缺 #2/#9）与「封妖进度」（#10）折 qiH / cause 承载。
 *   无缺招牌数值口径（主人 2026-09-21 拍板）：**照录原文 +10%×72h**（当量 7.2h），不抬高到同族招牌量级。
 *     换算说明：buff 的 hours 走**现实时间**（_resolve 用 nowMs = Date.now() 计时）；而 1 现实分钟 = 1 游戏天
 *     （gametime 口径），故 7.2h 当量 ≈ **432 游戏天**的产出——在游戏内体感并不小，无需改数值。
 *
 * 槽位结构（每池 10 条）：机缘 4（良/珍/绝/仙）｜日常 2（凡）｜恩怨 2（珍）｜灾劫 2（良/珍）。
 * 通用池无仙级 → 抽到仙级时按「绝→珍→良」向下回退（EventSystem 采样逻辑）。
 * 当量标准：h = 本世界当前产出/小时；奖励按 h 当量发放，自动跟随调参——
 *   良 ≈2h ｜ 珍 ≈8h ｜ 绝 ≈24h ｜ 仙 ≈72h ｜ 日常 ≈0.5h ｜ 灾劫 −1~−4h ｜ 恩怨 ±8h。
 * 自动策略（v1.1 §三）：稳健＝保底项(safe) ｜ 均衡＝期望项(balanced) ｜ 激进＝高波动项(risky)。
 *
 * ⚠ 频率口径（拍板项，见开发计划 §二）：《增补 v1.1》原文「在线每分钟期望 1 起」
 *   × 单条期望 +4.2h 当量 ≈ 每小时 +250h 收益，违反《开发计划》§七
 *   「随机事件占比 1~2%」护栏约 250 倍；按护栏反推校准为 onlinePerHour = 0.2（⚖ 可调）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { QUALITY_KEYS, QUALITY_NAME, QUALITY_COLOR } from '../util/quality.js'   // 品质 5 档（键序 / 档名 / 色板）唯一真源

/** 气运五档表（增补 v1.1 §三原文数值；luck 0–100 主驱动） */
export const LUCK_TIERS = [
  { id: 'shuai', name: '衰运', min: 0, max: 20, goodPct: 0.30, qualCoef: 0.8, freqCoef: 1.2 },
  { id: 'ping', name: '平运', min: 21, max: 50, goodPct: 0.45, qualCoef: 1.0, freqCoef: 1.0 },
  { id: 'xiao', name: '小运', min: 51, max: 75, goodPct: 0.55, qualCoef: 1.2, freqCoef: 1.0 },
  { id: 'hong', name: '鸿运', min: 76, max: 90, goodPct: 0.70, qualCoef: 1.5, freqCoef: 1.1 },
  { id: 'tian', name: '天运', min: 91, max: 100, goodPct: 0.85, qualCoef: 2.0, freqCoef: 1.2 }
]

/** 类别触发权重（世界事件库 v1 §一·3）：机缘 40%／日常 20%／恩怨 20%／灾劫 20% */
export const CAT_WEIGHTS = { jiyuan: 40, richang: 20, enyuan: 20, zaijie: 20 }

/** 机缘内品质权重（良 50／珍 30／绝 15／仙 5；气运品质系数按档位指数上移） */
export const QUALITY_WEIGHTS = { liang: 50, zhen: 30, jue: 15, xian: 5 }

/** 品质档名 / 档色（对外文案；唯一真源已迁 src/util/quality.js，此处再导出以保持导出面不变） */
export { QUALITY_NAME, QUALITY_COLOR }

/** 类别中文名 */
export const CAT_NAME = { jiyuan: '机缘', richang: '日常', enyuan: '恩怨', zaijie: '灾劫' }

/** 品质当量基准（世界事件库 v1 §一·2；平衡核对与护栏校验用） */
export const EQUIV_H = { fan: 0.5, liang: 2, zhen: 8, jue: 24, xian: 72 }

/**
 * 品质档序（低 → 高）—— V4.7 主人：**纪事消息与事件共用同一套等级语言**
 * （消息逐条标等级、按等级着色与置顶，口径与事件的 quality 一致）
 */
export const QUALITY_ORDER = QUALITY_KEYS   // 键序唯一真源：src/util/quality.js

/**
 * 自动策略 → 可自动处置的最高等级（V4.7 主人 2026-09-18 拍板「全自动激进」）
 *   稳健＝只自动处理 凡 / 良（珍起亲断）｜均衡＝凡 / 良 / 珍（绝 / 仙亲断）｜激进＝凡 ~ 仙全自动
 *   这条口径**同时管事件与纪事消息**：超出范围的条目一律置顶，等玩家亲自决断。
 */
export const STRATEGY_AUTO = {
  steady: { maxQ: 'liang', label: '凡 / 良' },
  balanced: { maxQ: 'zhen', label: '凡 / 良 / 珍' },
  aggressive: { maxQ: 'xian', label: '凡 ~ 仙（全自动）' }
}

/**
 * 自动策略 → 选项偏好序（增补 v1.1 §三：稳健＝保底项 / 均衡＝期望项 / 激进＝高波动项）
 * 事件与纪事消息共用同一张表（纪事选项的 tag 同取 safe / balanced / risky）。
 */
export const STRATEGY_PREF = {
  steady: ['safe', 'balanced', 'risky'],
  balanced: ['balanced', 'safe', 'risky'],
  aggressive: ['risky', 'balanced', 'safe']
}

/** 该等级是否落在自动策略的处置范围内（超范围 → 置顶等玩家决断；未知档按均衡兜底） */
export function isAutoQuality (quality, strategy) {
  const conf = STRATEGY_AUTO[strategy] || STRATEGY_AUTO.balanced
  const max = QUALITY_ORDER.indexOf(conf.maxQ)
  const i = QUALITY_ORDER.indexOf(quality)
  return i >= 0 && i <= max
}

/** 自动策略可自动处置的等级文案（面板展示用） */
export function strategyAutoLabel (strategy) {
  return (STRATEGY_AUTO[strategy] || STRATEGY_AUTO.balanced).label
}

/** 触发与累积参数（⚖ 数值可调；频率口径见文件头注） */
export const TRIGGER = {
  onlinePerHour: 0.2,        // 在线基准频率：期望 1 起 / 5 小时（护栏校准值）
  offlineFactor: 0.5,        // 离线按 50% 累积（v1.1 §三）
  offlineCap: 12,            // 离线累积上限 12 起
  dedupeMs: 2 * 3600 * 1000, // 同一事件 2 小时内不重复（池小防连刷）
  poolSplit: 0.5,            // 世界池 / 通用池各 50%（合并池等权采样）
  bookCap: 40,               // 近事录容量
  causeCap: 24               // 因果条目容量
}

/**
 * 灵石时薪：事件的「+N h 灵石」按此换算（与突破奖励同族曲线 ×0.6，随境界水涨船高）。
 * 放在 data 层做纯函数，供装配层与 EventSystem 共用同一口径。
 */
export function stoneHourly (level) {
  return Math.max(1, Math.round(6 * Math.pow(1.12, Math.max(1, level) - 1)))
}

// ── 事件池 ────────────────────────────────────────────────────────────────
// options[].strategy：safe 稳健 / balanced 均衡 / risky 激进（每条至少一个策略位，
// 自动结算按 稳健[safe→balanced→risky] 均衡[balanced→safe→risky] 激进[risky→balanced→safe] 取首个可选）。
// effects 字段：qiH 灵气 h 当量｜stonesH 灵石 h 当量｜luck 气运增减｜fit 契合累计｜
//   buff {name, qiRatePct, hours} 产出增益｜repay {days, qiH, stonesH, label} 延迟兑现｜
//   gamble {p, win, lose} 赌性选项｜bonus {p, effects} 附加概率｜
//   tribCdExtraSec 渡劫冷却附加（2.5 消费）｜tribEasePct 渡劫单雷 +N%（V6.10 批 H，一次性）｜
//   learnTech {from, p} 他界功法奇遇（V6.11：命中推入 eventState.pendingTech，装配层入袋）｜
//   cause {name, val} 因果条目。

/** 青岚界专属池（世界事件库 v1 §01；原型：凡人修仙传） */
export const QINGLAN_POOL = [
  {
    id: 'evt_ql_fangshi', cat: 'jiyuan', quality: 'liang', name: '坊市捡漏',
    desc: '坊市角落里翻出一只蒙尘玉瓶，掌柜开价随意。',
    options: [
      { id: 'a', label: '淘得残丹', strategy: 'safe', hint: '服下残丹，药力化作灵气（+2h）。', effects: { qiH: 2 } },
      { id: 'b', label: '转手摆摊', strategy: 'balanced', hint: '卖给有缘人，换些灵石（+2.5h）。', effects: { stonesH: 2.5 } }
    ]
  },
  {
    id: 'evt_ql_lingyan', cat: 'jiyuan', quality: 'zhen', name: '灵眼之泉',
    desc: '洞府地下涌出一缕灵眼之气，经年不散。',
    options: [
      { id: 'a', label: '引泉入洞', strategy: 'safe', hint: '洞府产出 +15%，持续 24h（≈3.6h）。', effects: { buff: { name: '灵眼之泉', qiRatePct: 0.15, hours: 24 } } },
      { id: 'b', label: '上报宗门', strategy: 'balanced', hint: '宗门嘉奖折算灵石 +8h（2.4 宗门开放后改记贡献）。', effects: { stonesH: 8 } }
    ]
  },
  {
    id: 'evt_ql_paimai', cat: 'jiyuan', quality: 'jue', name: '拍卖会压轴',
    desc: '压轴拍品是一枚古宝残片，台下喊价者众。',
    options: [
      { id: 'a', label: '拍下残片', strategy: 'risky', hint: '花 12h 灵石拍下温养法宝：产出 +50%×72h（净 ≈+24h）。', effects: { stonesH: -12, buff: { name: '古宝残片', qiRatePct: 0.5, hours: 72 } } },
      { id: 'b', label: '转手让拍', strategy: 'safe', hint: '他人豪掷，你落袋为安（+24h 灵石）。', effects: { stonesH: 24 } }
    ]
  },
  {
    id: 'evt_ql_xiaoping', cat: 'jiyuan', quality: 'xian', name: '神秘小瓶', signature: true,
    desc: '拾得一只古怪小瓶，瓶中灵液滴土生金，可催熟灵田。',
    options: [
      { id: 'a', label: '以瓶养田', strategy: 'balanced', hint: '灵田产出 ×2 持续 72h（≈72h）；因果「瓶之来历」已记。', effects: { buff: { name: '神秘小瓶·灵液', qiRatePct: 1.0, hours: 72 }, cause: { name: '瓶之来历', val: 1 } } },
      { id: 'b', label: '高价售出', strategy: 'safe', hint: '交给识货的掌柜，稳妥变现（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_ql_yaotong', cat: 'richang', quality: 'fan', name: '药童值日',
    desc: '药童值日多抓了一味灵药，顺手分你半份。',
    options: [
      { id: 'a', label: '收下灵药', strategy: 'safe', hint: '+0.5h 当量。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_ql_kuangchang', cat: 'richang', quality: 'fan', name: '矿场监工',
    desc: '替矿场盯一日工，结算时多给了份例。',
    options: [
      { id: 'a', label: '领份例', strategy: 'balanced', hint: '+0.5h 灵石；5% 挖到中品灵石（+2h）。', effects: { stonesH: 0.5, bonus: { p: 0.05, effects: { stonesH: 2 } } } }
    ]
  },
  {
    id: 'evt_ql_jieqian', cat: 'enyuan', quality: 'zhen', name: '同门借钱',
    desc: '同门师弟开口借钱，说是要购一炉丹砂。',
    options: [
      { id: 'a', label: '借给他', strategy: 'balanced', hint: '七日后连本带利奉还（+12h 灵石）。', effects: { repay: { days: 7, stonesH: 12, label: '同门还钱' } } },
      { id: 'b', label: '婉拒', strategy: 'safe', hint: '银钱伤和气（气运 −1）。', effects: { luck: -1 } }
    ]
  },
  {
    id: 'evt_ql_guren', cat: 'enyuan', quality: 'zhen', name: '故人之徒求助',
    desc: '故人之子登门求助，手头实在拮据。',
    options: [
      { id: 'a', label: '相助', strategy: 'balanced', hint: '花费 2h 灵气，三日后回报 +12h、契合 +3。', effects: { qiH: -2, repay: { days: 3, qiH: 12, label: '故人回报' }, fit: 3 } },
      { id: 'b', label: '婉拒', strategy: 'safe', hint: '人情淡薄（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_ql_heiyi', cat: 'zaijie', quality: 'liang', name: '黑衣人踩点',
    desc: '有黑衣人在洞府外徘徊，来意不善。',
    options: [
      { id: 'a', label: '破财免灾', strategy: 'safe', hint: '−1h 灵石消灾。', effects: { stonesH: -1 } },
      { id: 'b', label: '交个朋友', strategy: 'risky', hint: '破例结交：下次渡劫调息 +1h（2.5 消费）。', effects: { tribCdExtraSec: 3600 } }
    ]
  },
  {
    id: 'evt_ql_yaoshou', cat: 'zaijie', quality: 'zhen', name: '妖兽潮过境',
    desc: '兽潮擦境而过，闭门还是出战？',
    options: [
      { id: 'a', label: '闭门不出', strategy: 'safe', hint: '损失 −4h 当量。', effects: { qiH: -4 } },
      { id: 'b', label: '出战', strategy: 'risky', hint: '战力校验（简化 60%）：胜 +6h、气运 +1；败 −2h。', effects: { gamble: { p: 0.6, win: { qiH: 6, luck: 1 }, lose: { qiH: -2 } } } }
    ]
  }
]

/** 通用池（增补 v1.1 §三「事件样例」十事；各世界合并使用） */
export const COMMON_POOL = [
  {
    id: 'evt_cm_shijuan', cat: 'jiyuan', quality: 'liang', name: '拾得残卷',
    desc: '荒径旁拾得半卷残篇，字迹已见斑驳。',
    options: [
      { id: 'a', label: '照卷行气', strategy: 'safe', hint: '依样吞吐（+2h）。', effects: { qiH: 2 } },
      { id: 'b', label: '细细参悟', strategy: 'balanced', hint: '所得略少但心有所悟（+1h、气运 +1）。', effects: { qiH: 1, luck: 1 } }
    ]
  },
  {
    id: 'evt_cm_fangshi', cat: 'jiyuan', quality: 'liang', name: '地摊寻宝',
    desc: '地摊上一件缺角法器，摊主开价随意。',
    options: [
      { id: 'a', label: '稳妥收下', strategy: 'safe', hint: '+2h 灵石。', effects: { stonesH: 2 } },
      { id: 'b', label: '讨价还价', strategy: 'risky', hint: '五成砍到底（+4h）、五成被抬价（+0.5h）。', effects: { gamble: { p: 0.5, win: { stonesH: 4 }, lose: { stonesH: 0.5 } } } }
    ]
  },
  {
    id: 'evt_cm_lingquan', cat: 'jiyuan', quality: 'zhen', name: '灵泉涌现',
    desc: '打坐处石缝渗出灵泉，泉气清冽。',
    options: [
      { id: 'a', label: '引泉淬体', strategy: 'safe', hint: '产出 +10%×24h（≈2.4h）。', effects: { buff: { name: '灵泉淬体', qiRatePct: 0.10, hours: 24 } } },
      { id: 'b', label: '掬泉入壶', strategy: 'balanced', hint: '慢饮化开（+8h）。', effects: { qiH: 8 } }
    ]
  },
  {
    id: 'evt_cm_gudong', cat: 'richang', quality: 'fan', name: '古洞探秘',
    desc: '山腹里寻见一座荒废古洞，深浅未知。',
    options: [
      { id: 'a', label: '贸然深入', strategy: 'risky', hint: '五五之数：得 +2h，或受惊 −1h。', effects: { gamble: { p: 0.55, win: { qiH: 2 }, lose: { qiH: -1 } } } },
      { id: 'b', label: '洞口观望', strategy: 'safe', hint: '按兵不动。', effects: {} },
      { id: 'c', label: '邀友同探', strategy: 'balanced', hint: '结伴小有所得（+0.5h、气运 +1）。', effects: { qiH: 0.5, luck: 1 } }
    ]
  },
  {
    id: 'evt_cm_yidie', cat: 'jiyuan', quality: 'jue', name: '大能遗蜕',
    desc: '峭壁之间惊现大能坐化遗蜕，宝光未散。',
    options: [
      { id: 'a', label: '深入取宝', strategy: 'risky', hint: '七成满载而归（+30h）、三成折损（−4h）。', effects: { gamble: { p: 0.7, win: { qiH: 30 }, lose: { qiH: -4 } } } },
      { id: 'b', label: '外围拾取', strategy: 'safe', hint: '捡些散逸宝气（+16h）。', effects: { qiH: 16 } }
    ]
  },
  {
    id: 'evt_cm_xinmo', cat: 'richang', quality: 'fan', name: '心魔夜话',
    desc: '夜深人静，心魔化作故人模样来闲谈。',
    options: [
      { id: 'a', label: '静坐天明', strategy: 'safe', hint: '+0.5h。', effects: { qiH: 0.5 } },
      { id: 'b', label: '与之对谈', strategy: 'balanced', hint: '道心反稳（气运 +1）。', effects: { luck: 1 } }
    ]
  },
  {
    id: 'evt_cm_yujie', cat: 'enyuan', quality: 'zhen', name: '遇劫道友',
    desc: '一名道友被邪修所伤，倒在你必经的路上。',
    options: [
      { id: 'a', label: '出手相助', strategy: 'balanced', hint: '花 2h 灵气（气运 +2、契合 +2、因果「路救之恩」）。', effects: { qiH: -2, luck: 2, fit: 2, cause: { name: '路救之恩', val: 1 } } },
      { id: 'b', label: '绕道避开', strategy: 'safe', hint: '各安天命。', effects: {} },
      { id: 'c', label: '趁火打劫', strategy: 'risky', hint: '+8h，但气运 −3、因果「夺宝之怨」。', effects: { qiH: 8, luck: -3, cause: { name: '夺宝之怨', val: -1 } } }
    ]
  },
  {
    id: 'evt_cm_zhaichang', cat: 'enyuan', quality: 'zhen', name: '因果追偿',
    desc: '一笔旧账上门：早年欠下的因果，今日来讨。',
    options: [
      { id: 'a', label: '如数奉还', strategy: 'safe', hint: '−4h 灵石，气运 +2。', effects: { stonesH: -4, luck: 2 } },
      { id: 'b', label: '赖账不认', strategy: 'risky', hint: '当下无损（气运 −4、因果「赖账之亏」，后续兑现）。', effects: { luck: -4, cause: { name: '赖账之亏', val: -1 } } }
    ]
  },
  {
    id: 'evt_cm_xiexiu', cat: 'zaijie', quality: 'liang', name: '邪修袭扰',
    desc: '一名邪修盯上了你的洞府，夜夜窥伺。',
    options: [
      { id: 'a', label: '破财免灾', strategy: 'safe', hint: '−0.5h 灵石消灾。', effects: { stonesH: -0.5 } },
      { id: 'b', label: '布阵反杀', strategy: 'risky', hint: '六五之数：胜 +1h、气运 +1；败 −2h。', effects: { gamble: { p: 0.65, win: { qiH: 1, luck: 1 }, lose: { qiH: -2 } } } }
    ]
  },
  {
    id: 'evt_cm_yinlei', cat: 'zaijie', quality: 'zhen', name: '引雷炼体',
    desc: '雷雨天降至，有人劝你以身引雷、淬炼肉身。',
    options: [
      { id: 'a', label: '不冒此险', strategy: 'safe', hint: '安稳为上。', effects: {} },
      { id: 'b', label: '引雷炼体', strategy: 'risky', hint: '赌命之法：五五之数，胜 +8h、败 −2h 且气运 −1（扣寿随 2.11 接入）。', effects: { gamble: { p: 0.55, win: { qiH: 8 }, lose: { qiH: -2, luck: -1 } } } }
    ]
  },
  {
    // V6.11 功法库改造：**他界功法奇遇**（需求 3）—— 放在通用池，故 12 界**任意一界**都能抽到；
    //   不进各界专属池，避免改动既有「槽位恰等」口径（V2.3 / V6.1 / V6.3 的槽位断言）。
    //   候选池由 data 层 `learnCandidates` 过滤：他界专属 ＋ 公用库，且境界与顶级灵根门槛已判；
    //   命中后写入 `es.pendingTech`，由装配层 `tech.grant()` 入袋（EventSystem 不 import TechniqueSystem）。
    //   当量口径：学习路径名义当量记 0（功法是长期收益，不是即时产出）→ 期望护栏不受影响。
    id: 'evt_cm_yijie', cat: 'jiyuan', quality: 'jue', name: '他界残卷',
    desc: '一页残卷自虚空缝隙里飘落：字迹陌生，法门也陌生 —— 分明不是此界之物。',
    options: [
      {
        id: 'a',
        label: '依卷参悟',
        strategy: 'balanced',
        hint: '六成参透一门他界功法（须与你此刻的境界、灵根相符），否则白费一场；因果「异界残卷」已记。',
        effects: { learnTech: { from: 'other', p: 0.6 }, cause: { name: '异界残卷', val: 1 } }
      },
      { id: 'b', label: '卖给识货的', strategy: 'safe', hint: '来历不明，不敢乱修 —— 换一笔实在的（+24h 灵石）。', effects: { stonesH: 24 } }
    ]
  }
]

// ── V6.1 批 C（2/12 样板）：分界专属池 ──────────────────────────────────────
// 槽位照 §一 统一口径（机缘4 良/珍/绝/仙｜日常2 凡｜恩怨2 珍｜灾劫2 良/珍），当量照 EQUIV_H。
// 效果一律走现有 effects 字段；原文中现有字段无法表达者按既有先例落地（均记在条目 hint 与文件头注）。

/**
 * 观云界专属池（依据《提炼-剧情发展路线》§三 03 新卡；原型：**我师兄实在太稳健了**）
 * ⚠ 口径换源（2026-09-20）：**不采用**《世界事件库 v1》§03 旧表——其原型为《修真聊天群》，
 *   「灵气费 / 聊天群任务板」已由剧情册 §1.5 判为「原著侧失去依据」（仅存于 worlds.js 已落地字段）。
 *   本池按新卡母题重写：入门审核 / 藏拙底牌 / 功德 / 退路预案 / 同门与黑锅 / 渡劫之地 / 天劫提前。
 *   槽位与当量仍照 §一 统一口径；worlds.js 的 proto / exclusive / identity 已同步（2026-09-21，见剧情册 §1.6）。
 */
export const DENGHUO_POOL = [
  {
    id: 'evt_dh_rumen', cat: 'jiyuan', quality: 'liang', name: '入门审核',
    desc: '师父领你上山第一天，不教吐纳，先问一句：什么最危险？',
    options: [
      { id: 'a', label: '答「人心最险」', strategy: 'balanced', hint: '师父点头，赏你一册《底牌簿》抄本（+2h）。', effects: { qiH: 2 } },
      { id: 'b', label: '答「天劫最险」', strategy: 'safe', hint: '师父摇头，却记你答得实在（气运 +1）。', effects: { luck: 1 } }
    ]
  },
  {
    id: 'evt_dh_gongde', cat: 'jiyuan', quality: 'zhen', name: '功德簿上记一笔',
    desc: '一桩过失没人肯认，功德簿却在你眼前摊开着。',
    options: [
      { id: 'a', label: '功德我拿，锅你们背', strategy: 'balanced', hint: '把过失揽下，功德记你名下（48h 内产出 +17%，≈8h）。', effects: { buff: { name: '功德簿', qiRatePct: 0.17, hours: 48 } } },
      { id: 'b', label: '功德让出去', strategy: 'safe', hint: '不留名，功德化作香火愿力回来（7 天后 +9h 灵石）。', effects: { repay: { days: 7, stonesH: 9, label: '香火愿力' } } }
    ]
  },
  {
    id: 'evt_dh_tishen', cat: 'jiyuan', quality: 'jue', name: '替身纸偶',
    desc: '你数了数手上的底牌：还不够——退路总要再多备一份。',
    options: [
      { id: 'a', label: '再做一只替身纸偶', strategy: 'balanced', hint: '多一条退路，渡劫时替你挡一次「没算到」（≈24h）。', effects: { qiH: 24 } },
      { id: 'b', label: '折成实在的进项', strategy: 'safe', hint: '把备下的东西出手，换一笔现银（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_dh_dipai', cat: 'jiyuan', quality: 'xian', name: '这张底牌先不亮', signature: true,
    desc: '你手里多了一张牌。最稳的用法从来不是打出去，是压着。',
    options: [
      { id: 'a', label: '收进底牌簿', strategy: 'balanced', hint: '藏拙不露，底牌压着（产出 ×2×72h）；渡劫前多一份从容调息的余裕（+24h）；因果「底牌簿多一笔」已记。', effects: { buff: { name: '底牌·藏拙', qiRatePct: 1.0, hours: 72 }, tribCdExtraSec: 86400, cause: { name: '底牌簿多一笔', val: 1 } } },
      { id: 'b', label: '亮出来换实在', strategy: 'safe', hint: '换一份立刻能用的东西（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_dh_saodi', cat: 'richang', quality: 'fan', name: '小炉峰扫地',
    desc: '山门的落叶又积了一层，今日轮到你扫。',
    options: [
      { id: 'a', label: '扫完这一场', strategy: 'balanced', hint: '师父赏你半份月例（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_dh_yuan', cat: 'richang', quality: 'fan', name: '退路预案',
    desc: '睡前你照旧把退路又推演了一遍。',
    options: [
      { id: 'a', label: '再推演一遍', strategy: 'balanced', hint: '推演有所得（+0.5h）；偶然想到一条从没走过的退路（5% +2h）。', effects: { qiH: 0.5, bonus: { p: 0.05, effects: { qiH: 2 } } } }
    ]
  },
  {
    id: 'evt_dh_tongmen', cat: 'enyuan', quality: 'zhen', name: '同门来借预案',
    desc: '同门师弟要渡劫，来求你那份算好的退路。',
    options: [
      { id: 'a', label: '抄一份给他', strategy: 'balanced', hint: '把退路分他一条（+8h；同门之谊，24h 内产出 +5%）。', effects: { qiH: 8, buff: { name: '同门之谊', qiRatePct: 0.05, hours: 24 } } },
      { id: 'b', label: '底牌不外借', strategy: 'safe', hint: '这是规矩，谁也不能破。', effects: {} }
    ]
  },
  {
    id: 'evt_dh_heiguo', cat: 'enyuan', quality: 'zhen', name: '这口锅谁背',
    desc: '宗里出了纰漏，长辈暗示这口锅总得有人背下。',
    options: [
      { id: 'a', label: '我背', strategy: 'balanced', hint: '功德我拿，锅你们背（+8h 功德当量）＋契合 +3。', effects: { qiH: 8, fit: 3 } },
      { id: 'b', label: '把话说清', strategy: 'safe', hint: '谁也别欠谁——却伤了同门和气（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_dh_zhandi', cat: 'zaijie', quality: 'liang', name: '渡劫之地被人占先',
    desc: '你勘定的渡劫之地被人抢先占了，理由还挑不出错。',
    options: [
      { id: 'a', label: '另择一处', strategy: 'safe', hint: '绕路重勘，多耗了时辰（−1h）。', effects: { qiH: -1 } },
      { id: 'b', label: '把备选全跑一遍', strategy: 'balanced', hint: '花 1h 灵石走遍备选地，预案再添一处。', effects: { stonesH: -1, cause: { name: '退路预案·补', val: 1 } } }
    ]
  },
  {
    id: 'evt_dh_tianjie', cat: 'zaijie', quality: 'zhen', name: '天劫提前',
    desc: '金仙劫比你算的早了三个月。算错一次，就是一辈子。',
    options: [
      { id: 'a', label: '硬着头皮上', strategy: 'safe', hint: '仓促应对，准备打了折扣（−3h 当量）。', effects: { qiH: -3 } },
      { id: 'b', label: '按预案退走', strategy: 'balanced', hint: '依预案退去（−1h 灵石），七日后重整旗鼓（+8h 灵石）。', effects: { stonesH: -1, repay: { days: 7, stonesH: 8, label: '重整旗鼓' } } }
    ]
  }
]

/** 无缺古界专属池（世界事件库 v1 §11；原型：我欲封天。2026-09-20 换源后重做口径） */
export const WUYUAN_POOL = [
  {
    id: 'evt_wy_chaiwu', cat: 'jiyuan', quality: 'liang', name: '柴房旧物',
    desc: '满阁宝光里没人肯要的那件旧物，被你收在柴房。',
    options: [
      { id: 'a', label: '留着自己用', strategy: 'balanced', hint: '用着趁手，也算一件家当（+2h）。', effects: { qiH: 2 } },
      { id: 'b', label: '拿去换钱', strategy: 'safe', hint: '换几枚灵石，更实在（+2.5h 灵石）。', effects: { stonesH: 2.5 } }
    ]
  },
  {
    id: 'evt_wy_zouman', cat: 'jiyuan', quality: 'zhen', name: '走满一线',
    desc: '此境你走得极慢，每一步都踩实了才肯往前。',
    options: [
      { id: 'a', label: '按「无暇」收束', strategy: 'balanced', hint: '此境按「无暇」结账，下一处小瓶颈轻一分（≈8h）；因果「无暇·走满」已记。', effects: { qiH: 8, cause: { name: '无暇·走满', val: 1 } } },
      { id: 'b', label: '再压一档，赌「无缺」', strategy: 'risky', hint: '五成走成「无缺」（≈16h），五成白攒一场（≈−2h）。', effects: { gamble: { p: 0.5, win: { qiH: 16 }, lose: { qiH: -2 } } } }
    ]
  },
  {
    id: 'evt_wy_houji', cat: 'jiyuan', quality: 'jue', name: '厚积薄发',
    desc: '你已修到瓶颈，只差一步就能跨过去，却迟迟不肯迈。',
    options: [
      { id: 'a', label: '压住不放，期满再放行', strategy: 'balanced', hint: '先压一境（本期 −4h），七日后一次放行（+28h）；一成机许多开一条经脉（+12h）。', effects: { qiH: -4, repay: { days: 7, qiH: 28, label: '厚积薄发' }, bonus: { p: 0.1, effects: { qiH: 12 } } } },
      { id: 'b', label: '即刻突破', strategy: 'safe', hint: '不压了，先走一步算一步（+8h）。', effects: { qiH: 8 } }
    ]
  },
  {
    id: 'evt_wy_qiming', cat: 'jiyuan', quality: 'xian', name: '给此山起个名字', signature: true,
    desc: '你在一方无名之地停下：山无名字，便不算真正入世。',
    options: [
      { id: 'a', label: '以名点化', strategy: 'balanced', hint: '点化一方无名之地，山气随名而聚（产出 +10%×72h，≈7.2h 当量）；因果「此名有人记得」已记。', effects: { buff: { name: '此山有名', qiRatePct: 0.10, hours: 72 }, cause: { name: '此名有人记得', val: 1 } } },
      { id: 'b', label: '只换一份实在', strategy: 'safe', hint: '名字让与他人，你落一笔进项（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_wy_zhiri', cat: 'richang', quality: 'fan', name: '柴房值日',
    desc: '杂役的活计轮到你，一日下来例钱不多。',
    options: [
      { id: 'a', label: '做满一日', strategy: 'balanced', hint: '扫尽落叶，分得半份月例（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_wy_jiujian', cat: 'richang', quality: 'fan', name: '旧鉴养光',
    desc: '你以灵光温养一面旧鉴，鉴上纹路偶尔一闪。',
    options: [
      { id: 'a', label: '以光养鉴', strategy: 'balanced', hint: '静静擦拭（+0.5h）；偶尔照出一道古纹（5% +2h）。', effects: { qiH: 0.5, bonus: { p: 0.05, effects: { qiH: 2 } } } }
    ]
  },
  {
    id: 'evt_wy_wuming', cat: 'enyuan', quality: 'zhen', name: '无名之托',
    desc: '有人托你保管一件没有名字的东西，说七日后必来取。',
    options: [
      { id: 'a', label: '替他保管', strategy: 'balanced', hint: '先垫一份心力（本期 −1h），七日后归还（+12h）＋契合 +3。', effects: { qiH: -1, repay: { days: 7, qiH: 12, label: '无名之托' }, fit: 3 } },
      { id: 'b', label: '婉言相拒', strategy: 'safe', hint: '来历不明，不接为妙（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_wy_fengjin', cat: 'enyuan', quality: 'zhen', name: '一道封禁的归属',
    desc: '你拾得一道无主封禁，此地人说那是大地留下的。',
    options: [
      { id: 'a', label: '收归己有', strategy: 'risky', hint: '封禁入袋（+8h），却违了大地之约（契合 −4）。', effects: { qiH: 8, fit: -4 } },
      { id: 'b', label: '交还大地', strategy: 'balanced', hint: '原物奉还（+4h），契合 +3、气运 +2。', effects: { qiH: 4, fit: 3, luck: 2 } }
    ]
  },
  {
    id: 'evt_wy_zouji', cat: 'zaijie', quality: 'liang', name: '走得太急',
    desc: '上一境你走得太急，留下了一道没补的缺口。',
    options: [
      { id: 'a', label: '认了这个缺口', strategy: 'safe', hint: '缺口就缺口，先往前走（−1h）。', effects: { qiH: -1 } },
      { id: 'b', label: '慢下来重走一遍', strategy: 'balanced', hint: '花 1h 灵石把这一境重走一遍，缺口补上。', effects: { stonesH: -1, cause: { name: '重走补缺', val: 1 } } }
    ]
  },
  {
    id: 'evt_wy_shouchao', cat: 'zaijie', quality: 'zhen', name: '寒原兽潮',
    desc: '寒原兽潮南下，族中问你是闭门还是出战。',
    options: [
      { id: 'a', label: '闭门不出', strategy: 'safe', hint: '兽潮过境，闭门自守（−4h 当量）。', effects: { qiH: -4 } },
      { id: 'b', label: '出战', strategy: 'risky', hint: '战力校验（简化 60%）：胜 +6h、「封妖」进度 +1；败 −2h。', effects: { gamble: { p: 0.6, win: { qiH: 6, cause: { name: '封妖', val: 1 } }, lose: { qiH: -2 } } } }
    ]
  }
]

/** 破晓星域专属池（世界事件库 v1 §02；原型：仙逆） */
export const POXIAO_POOL = [
  {
    id: 'evt_px_yunxing', cat: 'jiyuan', quality: 'liang', name: '陨星残骸',
    desc: '一截陨星坠在荒原上，裂口里散着细碎的星砂。',
    options: [
      { id: 'a', label: '捡拾星砂', strategy: 'balanced', hint: '星砂入囊，炼器可用（+2h 当量）。', effects: { qiH: 2 } },
      { id: 'b', label: '就地占卜', strategy: 'safe', hint: '以星砂为引卜一卦，心有所安（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_px_dongtu', cat: 'jiyuan', quality: 'zhen', name: '古修洞图',
    desc: '残破兽皮上画着一处洞府，字迹写着「我之所有，留予后来」。',
    options: [
      { id: 'a', label: '按图探索两日', strategy: 'balanced', hint: '洞里果然有东西（+8h 级资源）；因果「图之原主」已记。', effects: { qiH: 8, cause: { name: '图之原主', val: 1 } } },
      { id: 'b', label: '转手给识货人', strategy: 'safe', hint: '图换灵石，不沾因果（+6h 灵石）。', effects: { stonesH: 6 } }
    ]
  },
  {
    id: 'evt_px_huixiang', cat: 'jiyuan', quality: 'jue', name: '因果回响',
    desc: '早年随手结下的一点善缘，忽然自己找上门来兑付。',
    options: [
      { id: 'a', label: '收下这份因果', strategy: 'balanced', hint: '灵石丹药一并到手（+24h 当量）；气运 +3。', effects: { qiH: 24, luck: 3 } },
      { id: 'b', label: '只取一半', strategy: 'safe', hint: '留一半予身后人（+18h 灵石当量）。', effects: { stonesH: 18 } }
    ]
  },
  {
    id: 'evt_px_tiannishi', cat: 'jiyuan', quality: 'xian', name: '天逆石', signature: true,
    desc: '一块逆生而上的石头停在掌心：它逆的是天，也是命。',
    options: [
      { id: 'a', label: '留住「命定一瞬」', strategy: 'balanced', hint: '得一次逆命之机（产出 ×2×72h）；因果「命定一瞬」已记（渡劫免罚由本界「天逆珠」承载：每世 1 枚）。', effects: { buff: { name: '命定一瞬', qiRatePct: 1.0, hours: 72 }, cause: { name: '命定一瞬', val: 1 } } },
      { id: 'b', label: '折成一笔实在', strategy: 'safe', hint: '逆天之物换灵石，先活着要紧（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_px_guanxing', cat: 'richang', quality: 'fan', name: '观星夜课',
    desc: '夜课照旧是观星，今夜星象散乱，看不真切。',
    options: [
      { id: 'a', label: '静看一夜', strategy: 'balanced', hint: '星象虽乱，道心渐稳（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_px_fazhen', cat: 'richang', quality: 'fan', name: '修补法阵',
    desc: '洞府外的护山法阵缺了一角，补上并不费事。',
    options: [
      { id: 'a', label: '顺手补上', strategy: 'balanced', hint: '阵成，省下一笔修葺（+0.5h 灵石）。', effects: { stonesH: 0.5 } }
    ]
  },
  {
    id: 'evt_px_jiudi', cat: 'enyuan', quality: 'zhen', name: '旧敌上门',
    desc: '当年结下的旧敌找到了星域，堵在你的洞府外。',
    options: [
      { id: 'a', label: '应战', strategy: 'risky', hint: '战力校验（简化 60%）：胜 +8h、气运 +3；败 −4h。', effects: { gamble: { p: 0.6, win: { qiH: 8, luck: 3 }, lose: { qiH: -4 } } } },
      { id: 'b', label: '避战', strategy: 'safe', hint: '暂避锋芒，名头受损（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_px_baoen', cat: 'enyuan', quality: 'zhen', name: '报恩者远来',
    desc: '一名素不相识的修士登门，说祖上曾受过你一饭之恩。',
    options: [
      { id: 'a', label: '收下谢礼', strategy: 'balanced', hint: '受之无愧（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '转赠他人', strategy: 'safe', hint: '把这份情转给更需要的人（契合 +5；七日后另有回报 +12h）。', effects: { fit: 5, repay: { days: 7, qiH: 12, label: '转赠之报' } } }
    ]
  },
  {
    id: 'evt_px_xingchen', cat: 'zaijie', quality: 'liang', name: '星尘风暴',
    desc: '细碎的星尘擦过星域，搅得灵气一时不宁。',
    options: [
      { id: 'a', label: '闭府静守', strategy: 'safe', hint: '风暴过境，吐纳受阻（−0.9h 当量）。', effects: { qiH: -0.9 } }
    ]
  },
  {
    id: 'evt_px_fanshi', cat: 'zaijie', quality: 'zhen', name: '因果反噬',
    desc: '一笔没还干净的旧因果，这时候翻上来了。',
    options: [
      { id: 'a', label: '硬受这一下', strategy: 'safe', hint: '一身加持提前散去（−4h 当量）。', effects: { qiH: -4 } },
      { id: 'b', label: '花灵石化解', strategy: 'balanced', hint: '破财抵掉大半（−2h 灵石当量）。', effects: { stonesH: -2 } }
    ]
  }
]

/** 青云古界专属池（世界事件库 v1 §04；原型：诛仙） */
export const QINGYUN_POOL = [
  {
    id: 'evt_qy_jianzhong', cat: 'jiyuan', quality: 'liang', name: '剑冢拾遗',
    desc: '剑冢深处一柄锈剑，磨去锈迹，剑脊上竟存着一缕剑意。',
    options: [
      { id: 'a', label: '磨剑取意', strategy: 'balanced', hint: '剑意碎片收进法宝成长线（+2h 当量）。', effects: { qiH: 2 } },
      { id: 'b', label: '连剑一起卖了', strategy: 'safe', hint: '锈剑也是好铁（+2.5h 灵石）。', effects: { stonesH: 2.5 } }
    ]
  },
  {
    id: 'evt_qy_lingquan', cat: 'jiyuan', quality: 'zhen', name: '灵泉淬体',
    desc: '后山灵泉眼今夜水气最盛，正是淬体的好时候。',
    options: [
      { id: 'a', label: '入泉淬体', strategy: 'balanced', hint: '体质材料炼化入体（+8h 当量）。', effects: { qiH: 8 } },
      { id: 'b', label: '引泉入圃', strategy: 'safe', hint: '灵泉浇进药圃，二十四时可收（产出 +10%×24h）。', effects: { buff: { name: '灵泉淬体', qiRatePct: 0.10, hours: 24 } } }
    ]
  },
  {
    id: 'evt_qy_canjuan', cat: 'jiyuan', quality: 'jue', name: '古卷残页',
    desc: '藏经阁角落里翻出半页古卷，笔意极古，似有未尽之火。',
    options: [
      { id: 'a', label: '闭门悟法', strategy: 'balanced', hint: '所悟可抵一次苦修（随机功法升一小级，≈24h）。', effects: { qiH: 24 } },
      { id: 'b', label: '献给藏经阁', strategy: 'safe', hint: '换一份厚赏（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_qy_jianyi', cat: 'jiyuan', quality: 'xian', name: '诛仙剑意', signature: true,
    desc: '剑冢最深处那缕剑意忽然活了过来，绕着你转了一圈，没有伤你。',
    options: [
      { id: 'a', label: '纳「剑意·诛」', strategy: 'balanced', hint: '剑意入体（产出 ×2×72h）；契合 +3；因果「剑意·诛」已记（原文为战力 +10%，事件层按同族产出当量记）。', effects: { buff: { name: '剑意·诛', qiRatePct: 1.0, hours: 72 }, fit: 3, cause: { name: '剑意·诛', val: 1 } } },
      { id: 'b', label: '封印之后埋回', strategy: 'safe', hint: '不该拿的不拿，换一份稳妥（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_qy_xunye', cat: 'richang', quality: 'fan', name: '守山巡夜',
    desc: '轮到你在山门巡夜，一路无事。',
    options: [
      { id: 'a', label: '走完这一圈', strategy: 'balanced', hint: '月例照领（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_qy_yaopu', cat: 'richang', quality: 'fan', name: '打理药圃',
    desc: '药圃里的灵草该松土了，趁清晨做正好。',
    options: [
      { id: 'a', label: '松土施肥', strategy: 'balanced', hint: '顺手收一把丹药材料（+0.5h 当量）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_qy_bijian', cat: 'enyuan', quality: 'zhen', name: '同门比剑',
    desc: '同门师兄递来剑鞘，请你去校场走两招。',
    options: [
      { id: 'a', label: '应战', strategy: 'balanced', hint: '六成胜面：胜 +8h、声望涨；败 −2h（切磋无损）。', effects: { gamble: { p: 0.6, win: { qiH: 8 }, lose: { qiH: -2 } } } },
      { id: 'b', label: '认输', strategy: 'safe', hint: '给师兄留面子，自己气短（气运 −1）。', effects: { luck: -1 } }
    ]
  },
  {
    id: 'evt_qy_mojiao', cat: 'enyuan', quality: 'zhen', name: '魔教示好',
    desc: '一名自称魔教中人者递上厚礼，说仰慕你的剑。',
    options: [
      { id: 'a', label: '收下厚礼', strategy: 'risky', hint: '礼很重（+6h），但道心蒙尘（契合 −3）。', effects: { qiH: 6, fit: -3 } },
      { id: 'b', label: '原礼奉还', strategy: 'balanced', hint: '持正不阿（契合 +3）；身周自生「正气」（产出 +5%×24h）。', effects: { fit: 3, buff: { name: '正气', qiRatePct: 0.05, hours: 24 } } }
    ]
  },
  {
    id: 'evt_qy_shanyu', cat: 'zaijie', quality: 'liang', name: '山雨冲毁药圃',
    desc: '一夜山雨，药圃塌了半边。',
    options: [
      { id: 'a', label: '重新培土', strategy: 'safe', hint: '补种耗去许多工夫（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_qy_zhengmo', cat: 'zaijie', quality: 'zhen', name: '正魔冲突波及',
    desc: '正魔两道在山下短兵相接，余波直冲山门。',
    options: [
      { id: 'a', label: '助正道', strategy: 'risky', hint: '战力校验（简化 60%）：胜 +10h、契合 +4；败 −4h。', effects: { gamble: { p: 0.6, win: { qiH: 10, fit: 4 }, lose: { qiH: -4 } } } },
      { id: 'b', label: '避战', strategy: 'balanced', hint: '闭门不出，声望受损（气运 −2）。', effects: { luck: -2 } }
    ]
  }
]

/** 望族山河专属池（世界事件库 v1 §05；原型：玄鉴仙族） */
export const WANGZU_POOL = [
  {
    id: 'evt_wz_yuekao', cat: 'jiyuan', quality: 'liang', name: '族学月考',
    desc: '族学每月一考，这回你答得格外顺。',
    options: [
      { id: 'a', label: '争这个第一', strategy: 'balanced', hint: '考第一，族中另给一份份例（+2h）；族望小涨。', effects: { qiH: 2 } },
      { id: 'b', label: '藏拙不争', strategy: 'safe', hint: '不出头也有好处（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_wz_fenhong', cat: 'jiyuan', quality: 'zhen', name: '族产分红',
    desc: '族产这一季盈余，按职权分下来。',
    options: [
      { id: 'a', label: '照例领回', strategy: 'balanced', hint: '额外分红入袋（+8h；职权越高另有加成）。', effects: { qiH: 8 } },
      { id: 'b', label: '折成灵石存着', strategy: 'safe', hint: '存成现银，日后好办事（+8h 灵石）。', effects: { stonesH: 8 } }
    ]
  },
  {
    id: 'evt_wz_fuzhong', cat: 'jiyuan', quality: 'jue', name: '符种共鸣',
    desc: '族中传下的符种忽然与你共鸣，三日之内灵根格外通透。',
    options: [
      { id: 'a', label: '借共鸣苦修', strategy: 'balanced', hint: '灵根临时提档三日（≈24h 当量）；因果「符种共鸣」已记。', effects: { qiH: 24, cause: { name: '符种共鸣', val: 1 } } },
      { id: 'b', label: '把符种上交族库', strategy: 'safe', hint: '换个稳妥的赏格（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_wz_xuanjian', cat: 'jiyuan', quality: 'xian', name: '玄鉴微光', signature: true,
    desc: '家族法器「玄鉴」今夜亮了一线，镜面照出的是整座族产。',
    options: [
      { id: 'a', label: '借镜光赐福', strategy: 'balanced', hint: '全产线受赐（产出 +15%×72h＝≈10.8h 当量）；因果「玄鉴微光」已记。', effects: { buff: { name: '玄鉴微光', qiRatePct: 0.15, hours: 72 }, cause: { name: '玄鉴微光', val: 1 } } },
      { id: 'b', label: '只求一份现成', strategy: 'safe', hint: '不借法器，换现银（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_wz_citang', cat: 'richang', quality: 'fan', name: '祠堂洒扫',
    desc: '祠堂轮到你这房洒扫，香灰要一炉一炉清。',
    options: [
      { id: 'a', label: '扫完这一进', strategy: 'balanced', hint: '族中照给月例（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_wz_zuku', cat: 'richang', quality: 'fan', name: '族库清点',
    desc: '族库年末清点，你去帮着对账。',
    options: [
      { id: 'a', label: '逐项点完', strategy: 'balanced', hint: '对出几笔盈余（+0.5h）；偶尔发现「库藏遗漏」（5% +2h）。', effects: { qiH: 0.5, bonus: { p: 0.05, effects: { qiH: 2 } } } }
    ]
  },
  {
    id: 'evt_wz_qingtuo', cat: 'enyuan', quality: 'zhen', name: '支脉请托',
    desc: '一支旁脉找上门，想借你的族权办件事。',
    options: [
      { id: 'a', label: '借他一用', strategy: 'balanced', hint: '人情链续上一环（+8h 当量）。', effects: { qiH: 8 } },
      { id: 'b', label: '按规矩回绝', strategy: 'safe', hint: '规矩守住了，人情淡了（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_wz_zuzheng', cat: 'enyuan', quality: 'zhen', name: '族争调停',
    desc: '族中两房为一份产业闹到族正院，请你出面说合。',
    options: [
      { id: 'a', label: '接下这桩调停', strategy: 'balanced', hint: '说合成功（+8h 当量，七日后结算）；族望随之上涨。', effects: { repay: { days: 7, qiH: 8, label: '调停之报' } } },
      { id: 'b', label: '推手不问', strategy: 'risky', hint: '两房皆怨（−2h 当量）。', effects: { qiH: -2 } }
    ]
  },
  {
    id: 'evt_wz_zhengchan', cat: 'zaijie', quality: 'liang', name: '旁支争产',
    desc: '旁支为几亩灵田争执不休，牵累到你这房。',
    options: [
      { id: 'a', label: '让出这一份', strategy: 'safe', hint: '息事宁人，少收一成（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_wz_jiazheng', cat: 'zaijie', quality: 'zhen', name: '族贡加征',
    desc: '族中要修祠堂，这一期族贡加征。',
    options: [
      { id: 'a', label: '照额纳上', strategy: 'safe', hint: '抽成多出不少（−4h 当量）。', effects: { qiH: -4 } },
      { id: 'b', label: '献一条良策', strategy: 'balanced', hint: '以工代贡（花 1h 灵石），抽成恢复原值。', effects: { stonesH: -1 } }
    ]
  }
]

/** 幽傩界专属池（世界事件库 v1 §06；原型：道诡异仙） */
export const YOUNUO_POOL = [
  {
    id: 'evt_yn_taisui', cat: 'jiyuan', quality: 'liang', name: '拾得黑太岁',
    desc: '泥地里埋着一团黑太岁，摸着还有点温热。',
    options: [
      { id: 'a', label: '收好压心魔', strategy: 'balanced', hint: '可压制心魔（+2h 等值材料）。', effects: { qiH: 2 } },
      { id: 'b', label: '只当没见过', strategy: 'safe', hint: '此物蹊跷，不入己手（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_yn_zhenhuan', cat: 'jiyuan', quality: 'zhen', name: '真幻间隙',
    desc: '墙上的影子比你先动了一步——你分不清哪边是真的。',
    options: [
      { id: 'a', label: '往幻象那边走', strategy: 'balanced', hint: '所得颇丰（+8h）；偶被幻象反噬（30% −2h）。', effects: { qiH: 8, bonus: { p: 0.3, effects: { qiH: -2 } } } },
      { id: 'b', label: '闭眼退回原处', strategy: 'safe', hint: '求稳，只拿看得见的那点（+6h 灵石）。', effects: { stonesH: 6 } }
    ]
  },
  {
    id: 'evt_yn_yitui', cat: 'jiyuan', quality: 'jue', name: '诡异遗蜕',
    desc: '林中一具诡异的遗蜕，皮肉之下全是高倍材料。',
    options: [
      { id: 'a', label: '尽数剖出', strategy: 'balanced', hint: '材料成色极好（+24h 当量，本界材料另有强化）。', effects: { qiH: 24 } },
      { id: 'b', label: '只取外皮', strategy: 'safe', hint: '不深究那具身体（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_yn_zhenjia', cat: 'jiyuan', quality: 'xian', name: '真假之间', signature: true,
    desc: '两道同样的天雷在云里对峙——一道是真的，一道只是它自己的影子。',
    options: [
      { id: 'a', label: '收下「真假天劫符」', strategy: 'balanced', hint: '下次渡劫的单道天雷成功率 +10%（一次性，用在渡劫上）；产出 ×2×72h；因果「真假之间」已记。', effects: { buff: { name: '真假天劫符', qiRatePct: 1.0, hours: 72 }, tribEasePct: 0.10, cause: { name: '真假之间', val: 1 } } },
      { id: 'b', label: '撕了它', strategy: 'safe', hint: '不留这种拿不准的东西（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_yn_niangyao', cat: 'richang', quality: 'fan', name: '药房碾药',
    desc: '药房里碾了一日的药，药气熏得人昏沉。',
    options: [
      { id: 'a', label: '碾完这一臼', strategy: 'balanced', hint: '分得一点药末（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_yn_songjing', cat: 'richang', quality: 'fan', name: '诵经安神',
    desc: '夜里心里发慌，你照旧取经卷来诵。',
    options: [
      { id: 'a', label: '诵到天明', strategy: 'balanced', hint: '心魔值退了一分，道心稳当（气运 +1）。', effects: { luck: 1 } }
    ]
  },
  {
    id: 'evt_yn_qiujiu', cat: 'enyuan', quality: 'zhen', name: '教友求救',
    desc: '教中一位道友深夜叩门，说家里出了说不清的事。',
    options: [
      { id: 'a', label: '随他走一趟', strategy: 'balanced', hint: '先垫一份心力（本期 −1h），三日后得报（+10h）＋契合 +3。', effects: { qiH: -1, repay: { days: 3, qiH: 10, label: '教友之报' }, fit: 3 } },
      { id: 'b', label: '闭门不应', strategy: 'safe', hint: '夜里的事，最好别掺和（气运 −3）。', effects: { luck: -3 } }
    ]
  },
  {
    id: 'evt_yn_jiuzhang', cat: 'enyuan', quality: 'zhen', name: '旧账诡异',
    desc: '一笔旧账自己找上门来讨，来人长得和债主一模一样。',
    options: [
      { id: 'a', label: '真还', strategy: 'safe', hint: '如数还上，两清（−4h）。', effects: { qiH: -4 } },
      { id: 'b', label: '假还', strategy: 'risky', hint: '糊弄过去（气运 −4），七日后账还是会再来一次（−6h）。', effects: { luck: -4, repay: { days: 7, qiH: -6, label: '假还之账' } } }
    ]
  },
  {
    id: 'evt_yn_diyu', cat: 'zaijie', quality: 'liang', name: '疯癫低语',
    desc: '不知从哪儿传来低语，听久了头疼。',
    options: [
      { id: 'a', label: '堵住耳朵', strategy: 'safe', hint: '静心不成，一日白费（−0.6h）。', effects: { qiH: -0.6 } }
    ]
  },
  {
    id: 'evt_yn_huanying', cat: 'zaijie', quality: 'zhen', name: '幻象入侵',
    desc: '幻象越过了门槛，坐在你对面，用你的脸看你。',
    options: [
      { id: 'a', label: '硬抗', strategy: 'safe', hint: '撑到天亮，元气大伤（−4h）。', effects: { qiH: -4 } },
      { id: 'b', label: '嚼一口黑太岁', strategy: 'balanced', hint: '折损一份药材（−1h 灵石当量），免灾且心魔抗性 +1。', effects: { stonesH: -1 } }
    ]
  }
]

/** 通天界专属池（世界事件库 v1 §07；原型：一念永恒） */
export const TONGTIAN_POOL = [
  {
    id: 'evt_tt_shanhuo', cat: 'jiyuan', quality: 'liang', name: '山货捎来',
    desc: '村里托人捎来一包山货，都是炼丹的好料。',
    options: [
      { id: 'a', label: '自己留下', strategy: 'balanced', hint: '炼丹材料入库（+2h 当量）。', effects: { qiH: 2 } },
      { id: 'b', label: '分给同门', strategy: 'safe', hint: '人人有份，情分更厚（契合 +2）。', effects: { fit: 2 } }
    ]
  },
  {
    id: 'evt_tt_lianling', cat: 'jiyuan', quality: 'zhen', name: '炼灵小成',
    desc: '给随身法器灌注灵性，这一次手很稳。',
    options: [
      { id: 'a', label: '一鼓作气灌满', strategy: 'balanced', hint: '八成成功（+8h，战力随之涨）；失手则材料折损（−1h）。', effects: { gamble: { p: 0.75, win: { qiH: 8 }, lose: { qiH: -1 } } } },
      { id: 'b', label: '浅灌即止', strategy: 'safe', hint: '稳妥收手（+5h 灵石当量）。', effects: { stonesH: 5 } }
    ]
  },
  {
    id: 'evt_tt_baozang', cat: 'jiyuan', quality: 'jue', name: '白鼠狼的宝藏',
    desc: '跟着一只白鼠狼钻了半天洞，尽头竟真有前辈藏宝。',
    options: [
      { id: 'a', label: '尽数搬回', strategy: 'balanced', hint: '一夜暴富的滋味（+24h）；气运 +2。', effects: { qiH: 24, luck: 2 } },
      { id: 'b', label: '只取一件', strategy: 'safe', hint: '剩下的留给后来人（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_tt_hengcai', cat: 'jiyuan', quality: 'xian', name: '天降横财', signature: true,
    desc: '一道天道眷顾毫无理由地落在你头上，像谁随手丢了块石头。',
    options: [
      { id: 'a', label: '换成灵石', strategy: 'balanced', hint: '灵石 +72h 当量（原文另附专属皮肤，UI 资产待接线）。', effects: { stonesH: 72 } },
      { id: 'b', label: '用来加深修为', strategy: 'safe', hint: '尽数化入体内（+48h 修为当量）。', effects: { qiH: 48 } }
    ]
  },
  {
    id: 'evt_tt_bangchu', cat: 'richang', quality: 'fan', name: '帮厨大锅饭',
    desc: '轮到你给全谷的人做一顿饭，灶火一天没停。',
    options: [
      { id: 'a', label: '掌这个勺', strategy: 'balanced', hint: '人人吃得满意（+0.5h）；契合 +1。', effects: { qiH: 0.5, fit: 1 } }
    ]
  },
  {
    id: 'evt_tt_hechang', cat: 'richang', quality: 'fan', name: '捧场喝道',
    desc: '谷里论道，你在下头认真捧了个场。',
    options: [
      { id: 'a', label: '喝彩到底', strategy: 'balanced', hint: '讲的人也高兴（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_tt_dadu', cat: 'enyuan', quality: 'zhen', name: '师兄弟打赌',
    desc: '师兄弟非要跟你赌一把，赌注两小时的功夫。',
    options: [
      { id: 'a', label: '赌这一把', strategy: 'risky', hint: '先押 2h：五成赢回（净 +4h），五成白送。', effects: { qiH: -2, gamble: { p: 0.5, win: { qiH: 6 }, lose: {} } } },
      { id: 'b', label: '不赌', strategy: 'safe', hint: '不赌就是赢（按兵不动）。', effects: {} }
    ]
  },
  {
    id: 'evt_tt_xieli', cat: 'enyuan', quality: 'zhen', name: '邻村谢礼',
    desc: '早年救过的人家，如今把谢礼送到了谷口。',
    options: [
      { id: 'a', label: '收下', strategy: 'balanced', hint: '当年一饭换来今日厚礼（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '转赠学堂', strategy: 'safe', hint: '把谢礼给了更缺的孩子们（契合 +4）。', effects: { fit: 4 } }
    ]
  },
  {
    id: 'evt_tt_shigu', cat: 'zaijie', quality: 'liang', name: '炼器事故',
    desc: '炉子炸了，一炉料全废。',
    options: [
      { id: 'a', label: '收拾残局', strategy: 'safe', hint: '重来一遍（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_tt_fanshi', cat: 'zaijie', quality: 'zhen', name: '天道档反噬',
    desc: '前几日借了「天道档」的势，如今利息找上门。',
    options: [
      { id: 'a', label: '照本还上', strategy: 'safe', hint: '重试成本抬高（−4h 当量）。', effects: { qiH: -4 } },
      { id: 'b', label: '改走地道', strategy: 'balanced', hint: '不罚钱，但脸上无光（气运 −2）。', effects: { luck: -2 } }
    ]
  }
]

/** 天工界专属池（世界事件库 v1 §08；原型：仙工开物） */
export const TIANGONG_POOL = [
  {
    id: 'evt_tg_canjian', cat: 'jiyuan', quality: 'liang', name: '废旧机关残件',
    desc: '工坊角落堆着一台报废机关，零件还能拆出不少。',
    options: [
      { id: 'a', label: '拆解归料', strategy: 'balanced', hint: '拆出一堆好料（+2h 当量）。', effects: { qiH: 2 } },
      { id: 'b', label: '整机卖出去', strategy: 'safe', hint: '当废铁卖也有价（+2.5h 灵石）。', effects: { stonesH: 2.5 } }
    ]
  },
  {
    id: 'evt_tg_xiaosai', cat: 'jiyuan', quality: 'zhen', name: '匠造小赛',
    desc: '本季匠造小赛开赛，你的活计被推上去参评。',
    options: [
      { id: 'a', label: '争个名次', strategy: 'balanced', hint: '名次奖励入袋（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '先顾着赶工', strategy: 'safe', hint: '不参赛，工坊效率反而高了（产出 +10%×12h）。', effects: { buff: { name: '工坊效率', qiRatePct: 0.10, hours: 12 } } }
    ]
  },
  {
    id: 'evt_tg_gutu', cat: 'jiyuan', quality: 'jue', name: '古机关图',
    desc: '一张古图从旧书里掉出来，画的是一台会自己走的蜂形机关。',
    options: [
      { id: 'a', label: '照着研造', strategy: 'balanced', hint: '「机关蜂」产线进度 +1（≈24h 等值）；因果「机关蜂」已记。', effects: { qiH: 24, cause: { name: '机关蜂', val: 1 } } },
      { id: 'b', label: '卖给工坊', strategy: 'safe', hint: '图纸转手，一笔厚利（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_tg_qihuo', cat: 'jiyuan', quality: 'xian', name: '炉林奇火', signature: true,
    desc: '炉林深处生出一簇异火，火色发青，烧的不是柴，是机关的气。',
    options: [
      { id: 'a', label: '引火入炉', strategy: 'balanced', hint: '全部机关产出受火（产出 +20%×72h＝≈14.4h 当量）；因果「炉林奇火」已记。', effects: { buff: { name: '炉林奇火', qiRatePct: 0.20, hours: 72 }, cause: { name: '炉林奇火', val: 1 } } },
      { id: 'b', label: '装一罐卖了', strategy: 'safe', hint: '异火难得，识货的人不少（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_tg_damo', cat: 'richang', quality: 'fan', name: '打磨零件',
    desc: '一日就在磨同一个齿轮，手指头都是铁腥味。',
    options: [
      { id: 'a', label: '磨到合手', strategy: 'balanced', hint: '零件入库（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_tg_jianxiu', cat: 'richang', quality: 'fan', name: '检修机关车',
    desc: '出门用的机关车该检修了，趁今天有工夫。',
    options: [
      { id: 'a', label: '全套检修', strategy: 'balanced', hint: '下次探索少走些弯路（+0.5h 当量）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_tg_shezhang', cat: 'enyuan', quality: 'zhen', name: '同行赊账',
    desc: '邻坊的同行来赊料，说七日后必定连本带利还上。',
    options: [
      { id: 'a', label: '赊给他', strategy: 'balanced', hint: '先赊出 8h 材料，七日后收回（+10h）。', effects: { qiH: -8, repay: { days: 7, qiH: 10, label: '同行还账' } } },
      { id: 'b', label: '婉拒', strategy: 'safe', hint: '同行脸上挂不住（气运 −1）。', effects: { luck: -1 } }
    ]
  },
  {
    id: 'evt_tg_xuetu', cat: 'enyuan', quality: 'zhen', name: '学徒求助',
    desc: '一个小学徒捧着做坏的活计站在你门口，不敢进来。',
    options: [
      { id: 'a', label: '收下教他', strategy: 'balanced', hint: '先花 1h 指点，七日后他送来谢礼（+12h）＋匠望 +3%。', effects: { qiH: -1, repay: { days: 7, qiH: 12, label: '学徒回报' }, fit: 2 } },
      { id: 'b', label: '让他自己琢磨', strategy: 'safe', hint: '不收徒也不得罪（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_tg_shikong', cat: 'zaijie', quality: 'liang', name: '机关失控',
    desc: '一台没拴牢的机关在工坊里横冲直撞。',
    options: [
      { id: 'a', label: '拆了它', strategy: 'safe', hint: '收拾残局耗去半日（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_tg_beifang', cat: 'zaijie', quality: 'zhen', name: '作品被仿',
    desc: '市面上出现了一批和你手笔极像的活计，价压得很低。',
    options: [
      { id: 'a', label: '隐忍', strategy: 'safe', hint: '由他们去，收入少了（−4h）。', effects: { qiH: -4 } },
      { id: 'b', label: '打假到底', strategy: 'balanced', hint: '花 2h 灵石查证，七日后讨回公道（+8h 灵石）。', effects: { stonesH: -2, repay: { days: 7, stonesH: 8, label: '打假所得' } } }
    ]
  }
]

/** 六面囚笼专属池（世界事件库 v1 §09；原型：谁让他修仙的！） */
export const LIUMIAN_POOL = [
  {
    id: 'evt_lm_manghe', cat: 'jiyuan', quality: 'liang', name: '盲盒开到丹药',
    desc: '花小钱开的盲盒里躺着一枚丹药，包装夸张得像要成精。',
    options: [
      { id: 'a', label: '当场吃了', strategy: 'balanced', hint: '药力还算实在（+2h）。', effects: { qiH: 2 } },
      { id: 'b', label: '转手挂出去', strategy: 'safe', hint: '包装值钱（+2h 灵石）。', effects: { stonesH: 2 } }
    ]
  },
  {
    id: 'evt_lm_fanpian', cat: 'jiyuan', quality: 'zhen', name: '反骗一笔',
    desc: '路边「神棍」说要传你上古传承，开口先要香火钱。',
    options: [
      { id: 'a', label: '当场戳穿', strategy: 'balanced', hint: '假传承底下压着真东西（+8h）；气运 +3。', effects: { qiH: 8, luck: 3 } },
      { id: 'b', label: '不理他', strategy: 'safe', hint: '省下嘴皮子（+6h 灵石）。', effects: { stonesH: 6 } }
    ]
  },
  {
    id: 'evt_lm_qiandao', cat: 'jiyuan', quality: 'jue', name: '古洞天签到',
    desc: '一处古洞天还剩最后一次签到名额，你挤进去了。',
    options: [
      { id: 'a', label: '领传承真迹', strategy: 'balanced', hint: '上古真迹到手（+24h）；契合 +5。', effects: { qiH: 24, fit: 5 } },
      { id: 'b', label: '把名额让出去', strategy: 'safe', hint: '名额转手，一笔进项（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_lm_caidan', cat: 'jiyuan', quality: 'xian', name: '天劫彩蛋', signature: true,
    desc: '拆到最后一个盲盒，盒子里居然是空的——除非里面装的是运气。',
    options: [
      { id: 'a', label: '开出彩蛋', strategy: 'balanced', hint: '随机绝品：五成开出大彩（+120h 当量）、五成小彩（+24h）。', effects: { gamble: { p: 0.5, win: { qiH: 120 }, lose: { qiH: 24 } } } },
      { id: 'b', label: '连盒一起转手', strategy: 'safe', hint: '赌运气不如拿现钱（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_lm_pangting', cat: 'richang', quality: 'fan', name: '论道旁听',
    desc: '有人在广场上讲道，听得人挤人。',
    options: [
      { id: 'a', label: '听到散场', strategy: 'balanced', hint: '多少有收获（+0.5h）；气运 +1。', effects: { qiH: 0.5, luck: 1 } }
    ]
  },
  {
    id: 'evt_lm_tuifei', cat: 'richang', quality: 'fan', name: '退掉「天庭会费」',
    desc: '压箱底的一张天庭会员契，居然还能退。',
    options: [
      { id: 'a', label: '退掉', strategy: 'balanced', hint: '退回一点年费（+0.5h 灵石）。', effects: { stonesH: 0.5 } }
    ]
  },
  {
    id: 'evt_lm_huanqian', cat: 'enyuan', quality: 'zhen', name: '骗子还钱',
    desc: '当年骗过你的人居然回来还钱了，说得声泪俱下。',
    options: [
      { id: 'a', label: '信他一次', strategy: 'risky', hint: '五成真还（+12h），五成再骗一笔（−2h）。', effects: { gamble: { p: 0.5, win: { qiH: 12 }, lose: { qiH: -2 } } } },
      { id: 'b', label: '不信', strategy: 'balanced', hint: '不留余地，心里倒痛快（气运 +1）。', effects: { luck: 1 } }
    ]
  },
  {
    id: 'evt_lm_tuomeng', cat: 'enyuan', quality: 'zhen', name: '前辈托梦',
    desc: '夜里梦见一位前辈，交代了一桩小事，说得清清楚楚。',
    options: [
      { id: 'a', label: '照做', strategy: 'balanced', hint: '办完果然有谢礼（+8h）；因果「前辈之托」已记。', effects: { qiH: 8, cause: { name: '前辈之托', val: 1 } } },
      { id: 'b', label: '当它是梦', strategy: 'safe', hint: '翻个身继续睡。', effects: {} }
    ]
  },
  {
    id: 'evt_lm_jiashen', cat: 'zaijie', quality: 'liang', name: '供奉假神',
    desc: '香案上那尊「神」被查出来是隔壁作坊批量做的。',
    options: [
      { id: 'a', label: '撤了香案', strategy: 'safe', hint: '白供了这些天（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_lm_feiyou', cat: 'zaijie', quality: 'zhen', name: '盲盒非酋',
    desc: '连开十几个盲盒全是安慰奖，连摊主都不忍心看你。',
    options: [
      { id: 'a', label: '认了这个非', strategy: 'safe', hint: '心态崩了，下次渡劫更费劲（−4h 当量）。', effects: { qiH: -4 } },
      { id: 'b', label: '花灵石买个保底', strategy: 'balanced', hint: '摊主给你换了个实在的（−4h 灵石）。', effects: { stonesH: -4 } }
    ]
  }
]

/** 九鼎九州专属池（世界事件库 v1 §10；原型：大乘期才有逆袭系统） */
export const JIUDING_POOL = [
  {
    id: 'evt_jd_timing', cat: 'jiyuan', quality: 'liang', name: '善行榜提名',
    desc: '你顺手做的一桩小事被人报上善行榜，还提了名。',
    options: [
      { id: 'a', label: '接着做下去', strategy: 'balanced', hint: '功德入账（+2h 突破折扣当量）。', effects: { qiH: 2 } },
      { id: 'b', label: '留个名就好', strategy: 'safe', hint: '名声在外，路好走些（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_jd_biaoyang', cat: 'jiyuan', quality: 'zhen', name: '人皇殿表扬',
    desc: '人皇殿当众点了你的名，殿外掌声一片。',
    options: [
      { id: 'a', label: '受这份表扬', strategy: 'balanced', hint: '赏赐随之而来（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '折成现银', strategy: 'safe', hint: '名声换实惠（+8h 灵石）。', effects: { stonesH: 8 } }
    ]
  },
  {
    id: 'evt_jd_jinguang', cat: 'jiyuan', quality: 'jue', name: '功德金光',
    desc: '积的功德忽然化作一道金光，落回你身上。',
    options: [
      { id: 'a', label: '尽数接下', strategy: 'balanced', hint: '功德翻倍（+24h 等值折扣）；因果「功德金光」已记。', effects: { qiH: 24, cause: { name: '功德金光', val: 1 } } },
      { id: 'b', label: '散给旁人', strategy: 'safe', hint: '金光分予街市，换一份清名（+30h 灵石当量）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_jd_tianti', cat: 'jiyuan', quality: 'xian', name: '天梯残阶', signature: true,
    desc: '断掉的天梯上还剩一阶残片，踩上去能省一大截力气。',
    options: [
      { id: 'a', label: '收下「登天残片」', strategy: 'balanced', hint: '下一次大境界突破成本 −20%（产出 ×2×72h）；因果「登天残片」已记（突破折扣待接线）。', effects: { buff: { name: '登天残片', qiRatePct: 1.0, hours: 72 }, cause: { name: '登天残片', val: 1 } } },
      { id: 'b', label: '残片换现银', strategy: 'safe', hint: '不指望那一阶（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_jd_tiaojie', cat: 'richang', quality: 'fan', name: '街市调解',
    desc: '街市上两家人为摊位吵起来，你顺手劝了两句。',
    options: [
      { id: 'a', label: '劝到和好', strategy: 'balanced', hint: '功德 +50（≈0.5h 当量）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_jd_xiuqiao', cat: 'richang', quality: 'fan', name: '修桥补路',
    desc: '城外的桥又塌了一角，你跟着去搭了把手。',
    options: [
      { id: 'a', label: '出这份力', strategy: 'balanced', hint: '功德与工钱都有（+0.5h）。', effects: { qiH: 0.5 } }
    ]
  },
  {
    id: 'evt_jd_menke', cat: 'enyuan', quality: 'zhen', name: '受助者来投',
    desc: '当年你救过的人如今学成了，愿意投到门下。',
    options: [
      { id: 'a', label: '收为门客', strategy: 'balanced', hint: '门客替你分担（产出 +5%×24h＝≈1.2h）。', effects: { buff: { name: '门客', qiRatePct: 0.05, hours: 24 } } },
      { id: 'b', label: '赠金遣归', strategy: 'safe', hint: '送他一笔盘缠（−1h 灵石），功德 +200（气运 +2）。', effects: { stonesH: -1, luck: 2 } }
    ]
  },
  {
    id: 'evt_jd_jiuan', cat: 'enyuan', quality: 'zhen', name: '旧案纠葛',
    desc: '一桩旧案翻出来重审，牵涉到和你有关的人。',
    options: [
      { id: 'a', label: '秉公直言', strategy: 'balanced', hint: '得罪人，但心正（+4h）；契合 +3。', effects: { qiH: 4, fit: 3 } },
      { id: 'b', label: '偏私一回', strategy: 'risky', hint: '得了好处（+8h），道心蒙尘（契合 −4）。', effects: { qiH: 8, fit: -4 } }
    ]
  },
  {
    id: 'evt_jd_xiaoxiao', cat: 'zaijie', quality: 'liang', name: '宵小作祟',
    desc: '夜里有人翻进院子，没偷到什么，倒砸了几件家什。',
    options: [
      { id: 'a', label: '算了', strategy: 'safe', hint: '修补家什耗去一点（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_jd_duanjue', cat: 'zaijie', quality: 'zhen', name: '天梯断绝余波',
    desc: '天梯断了的消息传开，人心浮动，谁也静不下心修行。',
    options: [
      { id: 'a', label: '由他们浮动', strategy: 'safe', hint: '士气低落，产出受损（−3.2h 当量）。', effects: { qiH: -3.2 } },
      { id: 'b', label: '开坛讲道安抚', strategy: 'balanced', hint: '花 1h 灵石搭个场面，损失减半（再 −1.6h）。', effects: { stonesH: -1, qiH: -1.6 } }
    ]
  }
]

/** 人间香火专属池（世界事件库 v1 §12；原型：我本无意成仙） */
export const XIANGHUO_POOL = [
  {
    id: 'evt_xh_bushi', cat: 'jiyuan', quality: 'liang', name: '香客布施',
    desc: '一早就有香客上山，布施之外还多添了一炷香。',
    options: [
      { id: 'a', label: '收下香火', strategy: 'balanced', hint: '香火 +2h 当量。', effects: { qiH: 2 } },
      { id: 'b', label: '折成灯油钱', strategy: 'safe', hint: '布施换现银（+2h 灵石）。', effects: { stonesH: 2 } }
    ]
  },
  {
    id: 'evt_xh_lingqian', cat: 'jiyuan', quality: 'zhen', name: '灵签应验',
    desc: '上个月求的灵签应验了，信众专程上山还愿。',
    options: [
      { id: 'a', label: '收下还愿', strategy: 'balanced', hint: '信众还愿（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '把香火线铺开', strategy: 'safe', hint: '拿这笔钱广结善缘（香火线 +5%×24h）。', effects: { buff: { name: '香火线', qiRatePct: 0.05, hours: 24 } } }
    ]
  },
  {
    id: 'evt_xh_guguan', cat: 'jiyuan', quality: 'jue', name: '古观遗址',
    desc: '荒山里寻见一座废弃古观，香案上的灰积了三寸。',
    options: [
      { id: 'a', label: '接手香火', strategy: 'balanced', hint: '古观香火归你（+24h）＝庙宇等级进度 +1；因果「庙宇进度」已记。', effects: { qiH: 24, cause: { name: '庙宇进度', val: 1 } } },
      { id: 'b', label: '把木料拆走', strategy: 'safe', hint: '古观的梁柱还能卖钱（+30h 灵石）。', effects: { stonesH: 30 } }
    ]
  },
  {
    id: 'evt_xh_chifeng', cat: 'jiyuan', quality: 'xian', name: '神道敕封', signature: true,
    desc: '一道敕封从云里落下来，不大，只够封你做个「小神」。',
    options: [
      { id: 'a', label: '受这「小神」敕封', strategy: 'balanced', hint: '香火 ×2×72h（≈72h 当量）；因果「庙号」已记。', effects: { buff: { name: '小神敕封', qiRatePct: 1.0, hours: 72 }, cause: { name: '庙号', val: 1 } } },
      { id: 'b', label: '把敕封让出去', strategy: 'safe', hint: '神位让给更想要的（+36h 灵石）。', effects: { stonesH: 36 } }
    ]
  },
  {
    id: 'evt_xh_shizhou', cat: 'richang', quality: 'fan', name: '施粥',
    desc: '山门外支起粥棚，一早就排了长队。',
    options: [
      { id: 'a', label: '守到粥尽', strategy: 'balanced', hint: '一日施粥（+0.5h）；功德 +1。', effects: { qiH: 0.5, fit: 1 } }
    ]
  },
  {
    id: 'evt_xh_chaojing', cat: 'richang', quality: 'fan', name: '抄经',
    desc: '夜里抄经，一笔一画抄到灯花结穗。',
    options: [
      { id: 'a', label: '抄完这一卷', strategy: 'balanced', hint: '心气平顺（气运 +2）。', effects: { luck: 2 } }
    ]
  },
  {
    id: 'evt_xh_jiesu', cat: 'enyuan', quality: 'zhen', name: '借宿道人',
    desc: '一位云游道人上门借宿，吃了你一顿斋饭。',
    options: [
      { id: 'a', label: '供他一顿斋', strategy: 'balanced', hint: '花半份香火（−0.5h 灵石），七日后他送来回礼（+10h）。', effects: { stonesH: -0.5, repay: { days: 7, qiH: 10, label: '道人回礼' } } },
      { id: 'b', label: '婉言逐客', strategy: 'safe', hint: '天色已晚，不便留人（气运 −2）。', effects: { luck: -2 } }
    ]
  },
  {
    id: 'evt_xh_jiuyuan', cat: 'enyuan', quality: 'zhen', name: '旧愿兑现',
    desc: '当年许下的一个愿，如今该兑现了。',
    options: [
      { id: 'a', label: '照愿办妥', strategy: 'balanced', hint: '愿一了，心事也了（+8h）。', effects: { qiH: 8 } },
      { id: 'b', label: '先记着，缓缓再说', strategy: 'safe', hint: '往后推一推，心里却不安（−2h 当量、契合 +2）。', effects: { qiH: -2, fit: 2 } }
    ]
  },
  {
    id: 'evt_xh_shanyu', cat: 'zaijie', quality: 'liang', name: '山雨毁庙角',
    desc: '一场山雨把庙角冲塌了，泥水进了殿。',
    options: [
      { id: 'a', label: '修回去', strategy: 'safe', hint: '修补耗去一些香火（−1h）。', effects: { qiH: -1 } }
    ]
  },
  {
    id: 'evt_xh_tianfa', cat: 'zaijie', quality: 'zhen', name: '天罚示警',
    desc: '天上一道闷雷，算是给你的示警。',
    options: [
      { id: 'a', label: '受着', strategy: 'safe', hint: '香火一时不济（−3h 当量）。', effects: { qiH: -3 } },
      { id: 'b', label: '设醮化解', strategy: 'balanced', hint: '花 1.5h 香火办一场斋醮，免灾。', effects: { stonesH: -1.5 } }
    ]
  }
]

/** 合并池索引（EventSystem 按池采样；键 = 世界 id，common 为通用回退池）。V6.3：12 界齐备 */
export const WORLD_POOLS = {
  qinglan: QINGLAN_POOL,
  poxiao: POXIAO_POOL,
  denghuo: DENGHUO_POOL,
  qingyun: QINGYUN_POOL,
  wangzu: WANGZU_POOL,
  younuo: YOUNUO_POOL,
  tongtian: TONGTIAN_POOL,
  tiangong: TIANGONG_POOL,
  liumian: LIUMIAN_POOL,
  jiuding: JIUDING_POOL,
  wuyuan: WUYUAN_POOL,
  xianghuo: XIANGHUO_POOL,
  common: COMMON_POOL
}

// V6.6 批 B：命运节拍器的仪式抉择与事件**同构**，并入同一查询后
//   `_resolve / resolvePending / view` 全部零改动即可消费（见 systems/StorySystem.js）。
import { storyEventById } from './storyRituals.js'

/** 取单条事件；未登记返回 null（先查 12 界事件池，再兜底查仪式抉择表） */
export function getEvent (id) {
  for (const pool of Object.values(WORLD_POOLS)) {
    const hit = pool.find((e) => e.id === id)
    if (hit) return hit
  }
  return storyEventById(id)
}

/** 按气运档位表取档；越界值钳到首末档 */
export function getLuckTier (luck) {
  const v = clampNum(luck, 0, 100)
  for (const t of LUCK_TIERS) {
    if (v >= t.min && v <= t.max) return t
  }
  return v < 21 ? LUCK_TIERS[0] : LUCK_TIERS[LUCK_TIERS.length - 1]
}

/**
 * 名义当量（h）：一个效果包折算成「小时产出当量」的名义值。
 * 用途：护栏校验（§七）与面板提示；延迟兑现（repay）按名义计入，buff 按 (x/100)×y 换算。
 */
export function nominalH (fx) {
  if (!fx || typeof fx !== 'object') return 0
  let h = 0
  if (typeof fx.qiH === 'number') h += fx.qiH
  if (typeof fx.stonesH === 'number') h += fx.stonesH
  if (fx.buff) h += fx.buff.qiRatePct * fx.buff.hours
  if (fx.gamble) h += fx.gamble.p * nominalH(fx.gamble.win) + (1 - fx.gamble.p) * nominalH(fx.gamble.lose)
  if (fx.bonus) h += fx.bonus.p * nominalH(fx.bonus.effects)
  if (fx.repay) h += (fx.repay.qiH || 0) + (fx.repay.stonesH || 0)
  return h
}

function clampNum (v, a, b) {
  v = Number(v)
  if (!Number.isFinite(v)) return a
  return Math.min(Math.max(v, a), b)
}

export default {
  LUCK_TIERS, CAT_WEIGHTS, QUALITY_WEIGHTS, QUALITY_NAME, QUALITY_COLOR, CAT_NAME, EQUIV_H,
  TRIGGER, stoneHourly,
  QINGLAN_POOL, POXIAO_POOL, DENGHUO_POOL, QINGYUN_POOL, WANGZU_POOL, YOUNUO_POOL,
  TONGTIAN_POOL, TIANGONG_POOL, LIUMIAN_POOL, JIUDING_POOL, WUYUAN_POOL, XIANGHUO_POOL,
  COMMON_POOL, WORLD_POOLS, getEvent, getLuckTier, nominalH
}
