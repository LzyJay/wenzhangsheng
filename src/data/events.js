/**
 * events.js —— 随机事件池 + 气运档位表（只读配置层）(2.3)
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《世界事件库 v1》（槽位结构 / 当量标准 / 触发权重 / 校验口径）
 *       +《设计增补 v1.1》§三（气运五档表 / 频率 / 自动策略 / 气运增减）。
 *
 * 槽位结构（每池 10 条）：机缘 4（良/珍/绝/仙）｜日常 2（凡）｜恩怨 2（珍）｜灾劫 2（良/珍）。
 * 通用池无仙级 → 抽到仙级时按「绝→珍→良」向下回退（EventSystem 采样逻辑）。
 * 当量标准：h = 本世界当前产出/小时；奖励按 h 当量发放，自动跟随调参——
 *   良 ≈2h ｜ 珍 ≈8h ｜ 绝 ≈24h ｜ 仙 ≈72h ｜ 日常 ≈0.5h ｜ 灾劫 −1~−4h ｜ 恩怨 ±8h。
 * 自动策略（v1.1 §三）：稳健＝保底项(safe) ｜ 均衡＝期望项(balanced) ｜ 激进＝高波动项(risky)。
 *
 * ⚠ 频率口径（拍板项，见开发计划 V2 §二）：《增补 v1.1》原文「在线每分钟期望 1 起」
 *   × 单条期望 +4.2h 当量 ≈ 每小时 +250h 收益，违反《开发计划 V2》§七
 *   「随机事件占比 1~2%」护栏约 250 倍；按护栏反推校准为 onlinePerHour = 0.2（⚖ 可调）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

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

/** 品质档名 / 档色（对外文案；色板与丹房同族） */
export const QUALITY_NAME = { fan: '凡', liang: '良', zhen: '珍', jue: '绝', xian: '仙' }
export const QUALITY_COLOR = { fan: '#b9b3a8', liang: '#e8b96a', zhen: '#7fd6a8', jue: '#b98cff', xian: '#9fd6ff' }

/** 类别中文名 */
export const CAT_NAME = { jiyuan: '机缘', richang: '日常', enyuan: '恩怨', zaijie: '灾劫' }

/** 品质当量基准（世界事件库 v1 §一·2；平衡核对与护栏校验用） */
export const EQUIV_H = { fan: 0.5, liang: 2, zhen: 8, jue: 24, xian: 72 }

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
//   tribCdExtraSec 渡劫冷却附加（2.5 消费）｜cause {name, val} 因果条目。

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
      { id: 'b', label: '交个朋友', strategy: 'risky', hint: '破例结交：下次渡劫调息 +1h（2.5 渡劫完整版消费）。', effects: { tribCdExtraSec: 3600 } }
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
  }
]

/** 合并池索引（EventSystem 按池采样） */
export const WORLD_POOLS = {
  qinglan: QINGLAN_POOL,
  common: COMMON_POOL
}

/** 取单条事件；未登记返回 null */
export function getEvent (id) {
  for (const pool of Object.values(WORLD_POOLS)) {
    const hit = pool.find((e) => e.id === id)
    if (hit) return hit
  }
  return null
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
  TRIGGER, stoneHourly, QINGLAN_POOL, COMMON_POOL, WORLD_POOLS, getEvent, getLuckTier, nominalH
}
