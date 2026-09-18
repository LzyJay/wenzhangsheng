/**
 * worldMechanics.js —— 各世界专属机制（只读配置层）（V5.2 · P5.2 三界样板）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《设计增补 v1.2》§二 十二世界卡池总表 + §三 世界详情卡（01 青岚 / 04 青云 / 05 望族）；
 *       展示口径的 exclusive / friction 一律照抄 src/data/worlds.js 同名字段原文（两处漂移由自测盯）。
 * 归属：设计库**内容批次 2/3（世界篇）**；本批三界样板，其余 9 界＝A4a 铺量（照本文件模板追加块）。
 *
 * 设计原则（增补 v1.2 §一.5 平衡护栏）：专属机制**不得绕过 72 级骨架**——只做加速 / 旁路 / 兑换，
 *   不做跳级；产出不发境界，只给灵石与既有材料（法宝成长给战力乘区，走 main.js 接线）。
 *
 * ── 本文件的形状（A4a 铺量模板：新增一界只需在此追加一个块）─────────────────
 *   WORLD_MECHANICS[<worldId>] = {
 *     id, name,                       // 与世界卡池同 id / 同对外名
 *     source,                         // 设计出处（回执与面板脚注都引它）
 *     exclusive, friction,            // 展示文案（照 worlds.js 原文）
 *     acts: [ … ],                    // 面板动作行；一行一个按钮
 *     points?: { <key>: { name, unit } },   // 本界内部计分（族贡 / 剑意…），面板显示名
 *     frictionRule: { … }             // 摩擦项口径：只展示 / 已在别处生效（展示联动）/ 可开关
 *   }
 *   act = {
 *     id, kind, label, note,          // kind: 'grant'（默认）｜'check'（战力校验）｜'refine'（升阶）
 *     cycleDays,                      // 周期（游戏天）；缺省 = MECH.dayGameDays（现实 1 日）
 *     unlockRealm?,                   // 门槛（REALM_META 下标：3 元婴 …）
 *     quota?: { base, perRank },      // 每周期可用次数（职级越高越多）
 *     cost?: { h?, mats?, <point>? }, // 支出：h 当量灵石 / 材料 / 内部计分
 *     gain?: { h?, mats?, <point>? }, // 收入：同上；h 可被 hPerSkillLevel × 剑阶 放大
 *     hPerSkillLevel?,                // 产出微加成：gain.h × (1 + hPerSkillLevel × 剑阶)
 *     needPowerMul?,                  // kind='check'：需求战力 = 该倍数 × 当前境界基准战力
 *     maxLevel?, powerPctPer?, ratePctPer?   // kind='refine'：升阶上限与每阶加成
 *   }
 *   内部计分用「键名 + 数字」自由扩展：cost/gain 里出现的、不属于 h/mats 的键，一律按计分处理。
 *
 * ── 量级口径（开发册 §七 护栏 + §6.3 归因复核报告同口径）────────────────────
 *   · 1 h 当量 = stoneHourly(level) 灵石（data/events.js，与事件 / 秘境 / 灵兽同一把尺）
 *   · 材料按秘境产出率折当量（data/dungeon.js RESOURCE_DUNGEONS.matPerH）：灵草 3 份/h、
 *     玄铁 2 份/h、妖丹 1 份/h、残页 1.2 份/h —— MAT_H 即其倒数
 *   · 轮长统一走 gametime（1 现实分钟 = 1 游戏天）：MECH.dayGameDays = 1440 游戏天 = 现实 1 日
 *   · 静态日产出见 staticDailyH()；结论（L47 静态，派遣线 0.9 h/h ≈ 992 灵石/h）：
 *       青岚 ≈ 1.71h/日（0.071 h/h ≈ 派遣线 7.9%）· 青云 ≈ 0.33~1.18h/日 ·
 *       望族 ≈ 0.42~1.60h/日（取决于职级与抽成开关）——**均远低于招牌线（V5.1 发现的 62~78 倍）**。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { stoneHourly } from './events.js'
import { gameDaysToMs, periodKeyOf, msToNextPeriod } from './gametime.js'
import { getLevelInfo } from './realms.js'
import { getWorld } from './worlds.js'
import { getItem } from './items.js'

/** 材料 → 当量 h（倒数即秘境 matPerH；见文件头「量级口径」） */
export const MAT_H = {
  mat_lingcao: 1 / 3,     // 灵药谷 3 份/h
  mat_kuang: 1 / 2,       // 玄铁矿洞 2 份/h
  mat_yaodan: 1,          // 万兽林 1 份/h
  frag_canjuan: 1 / 1.2   // 古修遗迹 1.2 份/h
}

/** 全局旋钮（只改这一处） */
export const MECH = {
  dayGameDays: 1440,        // 「现实 1 日」＝ 1440 游戏天（1 现实分钟 = 1 游戏天）
  weekGameDays: 10080,      // 「现实 7 日」（青岚小天劫，照增补 §三 01「每隔 7 天」）
  /**
   * 内部计分折率：1 h 当量灵石 ↔ 15 点。**只对「可花灵石买到 / 可换回灵石」的计分生效**
   * （望族族贡：纳贡 2h 买 30 点、兑换 30 点换 2.4h）——只用于量级核算，不参与真实结算。
   * 纯成长型计分（青云剑意：只进不出、无灵石购买路径）不入估值，避免把"进度"算成"财富"。
   */
  pointPerH: 15,
  /** 单界机制静态日产出护栏（当量 h/日）；A4a 铺量时自测按此断言（L47 派遣线 0.9h/h = 21.6h/日） */
  dailyHCap: 4
}

/** 望族山河 · 家族职权（增补 §三 05「外门→内门→族正院→族长：职权越高，抽成越低、福利越多」） */
export const WANGZU_RANKS = [
  { idx: 0, id: 'waimen', name: '外门', donated: 0, rate: 0.10 },
  { idx: 1, id: 'neimen', name: '内门', donated: 60, rate: 0.08 },
  { idx: 2, id: 'zuzhengyuan', name: '族正院', donated: 200, rate: 0.06 },
  { idx: 3, id: 'zuzhang', name: '族长', donated: 500, rate: 0.04 }
]

/** 职级门槛折扣（抽成「上缴」档的家族权益：升职更快） */
export const RANK_DISCOUNT_ON = 0.9

/**
 * 十二界的专属机制参数（本批 3 界；其余 9 界＝A4a 铺量在此追加）
 * ⚙ 所有数值旋钮都在这里；WorldMechanicSystem 不另立数值。
 */
export const WORLD_MECHANICS = {
  // ══ 01 · 青岚界（《凡人修仙传》）════════════════════════════════════════
  qinglan: {
    id: 'qinglan',
    name: '青岚界',
    source: '《设计增补 v1.2》§二 总表 #1 · §三 详情卡 01',
    exclusive: '元婴后定期「小天劫」考核（过则得雷淬资源）；「掌天瓶」催熟灵田',
    friction: '伪灵根突破成本 +10%（洗髓价值更高）',
    acts: [
      {
        id: 'qinglan_ripening',
        kind: 'grant',
        label: '掌天瓶 · 催熟灵田',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 01：「掌天瓶道具线（花灵石催熟灵田下一季产出）」——灵石 → 灵草 的偏利兑换
        cost: { h: 3 },
        gain: { mats: [{ id: 'mat_lingcao', n: 12 }] },
        note: '花灵石引地脉灵气，催熟灵田下一季：一次入库一季灵草（约合 4h 当量）。'
      },
      {
        id: 'qinglan_small_trial',
        kind: 'check',
        label: '小天劫 · 雷淬考核',
        unlockRealm: 3,                       // 元婴（增补 §三 01「元婴期起」）
        cycleDays: MECH.weekGameDays,         // 「每隔 7 天」（增补 §三 01 原文，按现实日读）
        needPowerMul: 1.15,                   // 战力校验：需求 = 1.15 × 当前境界基准战力
        gain: { mats: [{ id: 'mat_kuang', n: 10 }] },
        note: '元婴期起每 7 日一次小考：战力过关者受雷淬之礼（炼器材料），不过则本轮空过。'
      }
    ],
    frictionRule: {
      kind: 'rootCost',
      rarity: 'false',
      label: '伪灵根突破成本 +10%',
      note: '已在突破报价生效（WorldSystem.rootCostMul → worlds.js rootCost）——机制侧只做展示联动，不重复收费。'
    }
  },

  // ══ 04 · 青云古界（《诛仙》）════════════════════════════════════════════
  qingyun: {
    id: 'qingyun',
    name: '青云古界',
    source: '《设计增补 v1.2》§二 总表 #4 · §三 详情卡 04',
    exclusive: '「剑冢」法宝成长线；周期「正魔大战」事件',
    friction: '无飞升——终局改为「剑意超脱」（满级转世奖励 +20%）',
    // 剑意＝纯成长型计分（只进不出、无灵石购买路径）→ 不给 hPer，不参与量级估值
    points: { jianYi: { name: '剑意', unit: '缕' } },
    acts: [
      {
        id: 'qingyun_insight',
        kind: 'grant',
        label: '剑冢 · 参悟剑意',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 04：「收集剑意解锁法宝成长线」——参悟本身也偶有所得（灵石折算）
        gain: { jianYi: 10, h: 1, hPerSkillLevel: 0.02 },
        note: '在剑冢中听剑、看剑、忘剑：得剑意，偶有所悟折作灵石（每阶法宝 +2%）。'
      },
      {
        id: 'qingyun_refine',
        kind: 'refine',
        label: '剑冢 · 祭炼法宝',
        cycleDays: 3 * MECH.dayGameDays,   // 攒够 30 缕剑意（参悟 10 缕/日）→ 每 3 日可祭炼一次
        cost: { jianYi: 30, h: 2 },
        maxLevel: 9,
        powerPctPer: 0.005,   // 战力微加成 +0.5%/阶（走 main.js 战力乘区接线）
        ratePctPer: 0.02,     // 产出微加成：剑冢线自身产出 +2%/阶
        note: '以剑意祭炼本命法宝：每阶战力 +0.5%、剑冢产出 +2%，九阶封顶。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '无飞升 · 终局「剑意超脱」',
      note: '飞升结算与转世系统尚未实装 → 本轮只做标记与展示（+20% 满级转世奖励待转世排期）。'
    }
  },

  // ══ 05 · 望族山河（《玄鉴仙族》）════════════════════════════════════════
  wangzu: {
    id: 'wangzu',
    name: '望族山河',
    source: '《设计增补 v1.2》§二 总表 #5 · §三 详情卡 05',
    exclusive: '家族职权（族贡换资源）；「符种天赋」开局灵根保底真灵根',
    friction: '族贡抽成 10%（资源上缴换家族权益）',
    // hPer：可折当量 h 的计分（族贡可花灵石买入、也可换回灵石 → 参与量级估值）
    points: { tribute: { name: '族贡', unit: '点', hPer: 1 / MECH.pointPerH } },
    acts: [
      {
        id: 'wangzu_tribute',
        kind: 'donate',
        label: '族贡 · 纳贡',
        cycleDays: MECH.dayGameDays,
        quota: { base: 1, perRank: 1 },       // 每现实日 1 + 职级序 次
        cost: { h: 2 },
        gain: { tribute: 30 },
        note: '以灵石上缴族库换族贡（1h 当量 ↔ 15 族贡）；职级越高，每日纳贡额度越大。'
      },
      {
        id: 'wangzu_exchange',
        kind: 'exchange',
        label: '家族职权 · 兑换',
        cycleDays: MECH.dayGameDays,
        quota: { base: 1, perRank: 1 },
        cost: { tribute: 30 },
        gain: { h: 2.4 },                     // 族贡支取族中资源：+20% 折让
        note: '以族贡支取族中资源（+20% 折让）；抽成开则按职级上缴该笔产出，上缴额回流族贡。'
      }
    ],
    ranks: WANGZU_RANKS,
    frictionRule: {
      kind: 'tribute',
      toggle: true,
      defaultOn: true,
      label: '族贡抽成',
      note: '「上缴」＝按职级抽成（外门 10% / 内门 8% / 族正院 6% / 族长 4%），上缴额按 15 族贡/h 回流、职级门槛 −10%；' +
        '「免缴」＝全额到手，但无回流、无门槛折扣。'
    }
  }
}

// ── 纯函数（数据层，供 system / 面板 / 自测共用）────────────────────────────

/** 本界是否有已实装机制（A4a 之前的 9 界返回 false） */
export function hasMechanics (worldId) {
  return !!WORLD_MECHANICS[worldId]
}

/** 本界机制块；未实装返回 null */
export function mechanicsOf (worldId) {
  return WORLD_MECHANICS[worldId] || null
}

/** 本界全部动作 */
export function actsOf (worldId) {
  const b = mechanicsOf(worldId)
  return b ? b.acts.slice() : []
}

/** 取某动作定义 */
export function getAct (worldId, actId) {
  return actsOf(worldId).find((a) => a.id === actId) || null
}

/** 动作周期（毫秒；缺省 = 现实 1 日） */
export function cycleMsOf (act) {
  const d = (act && act.cycleDays) || MECH.dayGameDays
  return gameDaysToMs(d)
}

/** 动作周期键（与坊市 / 兽潮同一把尺：gametime.periodKeyOf） */
export function cycleKeyOf (act, now) {
  return periodKeyOf(now, cycleMsOf(act))
}

/** 距下一周期边界（毫秒） */
export function cycleMsToNext (act, now) {
  return msToNextPeriod(now, cycleMsOf(act))
}

/** 当量 h → 灵石（与事件 / 秘境 / 灵兽同口径） */
export function stonesOfH (h, level) {
  const v = Number(h) || 0
  return Math.max(0, Math.round(stoneHourly(level) * v))
}

/** 材料清单 → 当量 h */
export function matsHOf (mats) {
  let h = 0
  for (const m of Array.isArray(mats) ? mats : []) {
    if (!m) continue
    h += (MAT_H[m.id] || 0) * (Number(m.n) || 0)
  }
  return h
}

/** 本界内部计分键名表（cost / gain 里非 h / mats 的数值键＝计分） */
export function pointKeysOf (act) {
  const keys = []
  for (const side of [act && act.cost, act && act.gain]) {
    if (!side) continue
    for (const k of Object.keys(side)) {
      if (k === 'h' || k === 'mats') continue
      if (typeof side[k] === 'number' && !keys.includes(k)) keys.push(k)
    }
  }
  return keys
}

/** 计分展示名（族贡 / 剑意…）；未登记回退键名 */
export function pointNameOf (block, key) {
  const p = block && block.points && block.points[key]
  return (p && p.name) || key
}

/** 动作可用次数上限（每周期）；无 quota 字段 = 不限次（只受周期约束） */
export function quotaOf (act, rankIdx) {
  if (!act || !act.quota) return null
  const base = Number(act.quota.base) || 0
  const per = Number(act.quota.perRank) || 0
  return base + per * Math.max(0, Math.round(rankIdx) || 0)
}

/** 职级门槛（抽成「上缴」档 ×0.9 → 升职更快） */
export function rankThresholdsOf (block, tributeOn = true) {
  const ranks = (block && block.ranks) || WANGZU_RANKS
  const mul = tributeOn ? RANK_DISCOUNT_ON : 1
  return ranks.map((r) => Math.round(r.donated * mul))
}

/** 由「累计纳贡」定职级（返回 WANGZU_RANKS 条目；未登记世界返回 null） */
export function rankOf (block, donated, tributeOn = true) {
  const ranks = (block && block.ranks) || null
  if (!ranks) return null
  const th = rankThresholdsOf(block, tributeOn)
  const d = Math.max(0, Number(donated) || 0)
  let hit = ranks[0]
  for (let i = 0; i < ranks.length; i++) if (d >= th[i]) hit = ranks[i]
  return hit
}

/** 抽成率（按职级；关闭抽成时返回 0） */
export function tributeRateOf (block, rankIdx, tributeOn = true) {
  if (!tributeOn) return 0
  const ranks = (block && block.ranks) || WANGZU_RANKS
  const i = Math.min(Math.max(Math.round(rankIdx) || 0, 0), ranks.length - 1)
  return ranks[i].rate
}

/** kind='check' 的需求战力（缺省 1.15 × 当前境界基准战力） */
export function needPowerOf (act, level) {
  const base = getLevelInfo(level).combat.power
  return Math.round(base * ((act && act.needPowerMul) || 1.15))
}

/** 材料清单 → 面板文案（`灵草 ×12`） */
export function matsTextOf (mats) {
  return (Array.isArray(mats) ? mats : [])
    .map((m) => (m && m.n > 0 ? `${getItem(m.id).name} ×${m.n}` : ''))
    .filter(Boolean)
    .join(' · ')
}

/** 内部计分折当量 h（仅登记了 hPer 的计分参与估值；未登记 → 0＝不折价） */
export function pointHPerOf (block, key) {
  const p = block && block.points && block.points[key]
  const v = p && p.hPer
  return Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * 静态日产出（当量 h/日）——**核算口径**，供回执量级预估与自测断言（不参与真实结算）
 *   单动作净 = 收入（gain.h × 剑阶系数 + 材料折当量 + 计分折当量）− 支出（h + 计分折当量）
 *   日化 = 净 × 每周期可用次数 × (1440 / cycleDays)
 * ⚙ 抽成（望族）刻意**不计入**：灵石扣减与族贡回流等值，静态净额不变（短期灵石少、长期升职快）。
 * @param {string} worldId
 * @param {{level?:number, rankIdx?:number, skillLevel?:number, tributeOn?:boolean}} ctx
 * @returns {{h:number, rows:Array<{id:string, netH:number, uses:number, dayH:number}>}}
 */
export function staticDailyH (worldId, ctx = {}) {
  const block = mechanicsOf(worldId)
  if (!block) return { h: 0, rows: [] }
  const rankIdx = Number.isFinite(ctx.rankIdx) ? ctx.rankIdx : 0
  const skill = Math.max(0, Number(ctx.skillLevel) || 0)
  const per = MECH.dayGameDays
  const rows = []
  let total = 0

  for (const act of block.acts) {
    // 升阶型动作封顶后不再消耗（满阶后只有收入没有支出）——否则会低估满配稳态
    if (act.kind === 'refine' && skill >= (act.maxLevel || 0)) continue
    const cyc = (act.cycleDays || per)
    const q = quotaOf(act, rankIdx)
    const uses = (q == null ? 1 : q) * (per / cyc)
    const keys = pointKeysOf(act)
    let gainH = 0
    if (act.gain) {
      gainH += (Number(act.gain.h) || 0) * (1 + (Number(act.gain.hPerSkillLevel) || 0) * skill)
      gainH += matsHOf(act.gain.mats)
      for (const k of keys) gainH += (Number(act.gain[k]) || 0) * pointHPerOf(block, k)
    }
    let costH = (act.cost && Number(act.cost.h)) || 0
    if (act.cost) {
      for (const k of keys) costH += (Number(act.cost[k]) || 0) * pointHPerOf(block, k)
    }
    const net = gainH - costH
    rows.push({ id: act.id, netH: net, uses, dayH: net * uses })
    total += net * uses
  }
  return { h: total, rows }
}

/** 静态日产出上限（满职级 / 满阶 / 关抽成的最坏情况；A4a 铺量护栏断言用） */
export function staticDailyHCap (worldId, ctx = {}) {
  const block = mechanicsOf(worldId)
  if (!block) return 0
  const ranks = block.ranks ? block.ranks.length - 1 : 0
  let cap = 0
  for (const rankIdx of [0, ranks]) {
    for (const tributeOn of [true, false]) {
      for (const skillLevel of [0, 9]) {
        cap = Math.max(cap, staticDailyH(worldId, Object.assign({}, ctx, { rankIdx, tributeOn, skillLevel })).h)
      }
    }
  }
  return cap
}

/** 世界定义（展示用：颜色 / 标签），未登记返回 null */
export function worldMetaOf (worldId) {
  return getWorld(worldId)
}

export default {
  MAT_H, MECH, WANGZU_RANKS, RANK_DISCOUNT_ON, WORLD_MECHANICS,
  hasMechanics, mechanicsOf, actsOf, getAct,
  cycleMsOf, cycleKeyOf, cycleMsToNext,
  stonesOfH, matsHOf, matsTextOf, pointKeysOf, pointNameOf, pointHPerOf,
  quotaOf, rankThresholdsOf, rankOf, tributeRateOf, needPowerOf,
  staticDailyH, staticDailyHCap, worldMetaOf
}
