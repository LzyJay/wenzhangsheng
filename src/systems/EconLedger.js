/**
 * EconLedger.js —— 单日收益归因台账（V3.5.4 工程加固 · 纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（§13.1①）：零 import、无 DOM / Phaser；只读写 **state.econ 子树**（归本模块所有，
 *   与 BonusLedger 的"零 state"不同——账本本身要落档）。老档兼容：createDefaultState
 *   里 econ 为 null，本模块 ensureEcon 懒建兜底（同 sect / beast 惯例，不进迁移链）。
 *
 * 目的（开发计划V2 §七 占比护栏 / §4.4 待办 3）：副产线上线后从未做过"单日总收益
 *   归因统计"。本台账按**内容线**累计每日修为 / 灵石净入账，供主人对照护栏：
 *   打坐 ≈60% ｜ 秘境 ≤30% ｜ 宗门 ≤15% ｜ 灵兽 5~8% ｜ 随机事件 1~2%。
 *
 * 归因线（LINES）：
 *   cult         打坐（在线主挂机，含小瓶颈/突破的修为增减——它们都在 cult 段内发生）
 *   offline      离线折算（主挂机的 50% 折算表达，单列不稀释在线占比）
 *   sect         宗门（俸禄 + 任务奖励净额）
 *   dungeon      秘境（派遣 / 周扫荡 / 首通净额）
 *   beast        灵兽（出战被动产出）
 *   event        随机事件（奖励与代价净额——负值也是归因事实）
 *   breakthrough 突破奖励灵石（MVP 过渡逻辑，§4.4 待办 1 的复核对象）
 *   other        兜底（防未知来源静默丢失）
 *
 * 「单日」口径：**现实自然日**（本地时区 YYYY-MM-DD）——护栏统计窗，与游戏历显示层
 *   无关（游戏历 1 分钟 = 1 天，做统计窗会碎成噪音）。跨日自动结转：note 时发现换日
 *   → 旧账进 history（滚动 7 份）→ 清零开新日。
 *
 * 记账方式（§13.1②，不改任何 system）：装配层用**段间快照差值**喂账——主循环里各
 *   产线结算段前后拍 resources 快照，差值即该线净入账；doBreakthrough / 离线结算在
 *   事件点直接 note。坊市买卖（灵石回收 / 拍卖）是**转换**不是产出、开局赠礼是一次性
 *   语境值，均不设归因点（转换只会搬动已有灵石，不影响护栏占比的分母）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

const LINES = ['cult', 'offline', 'sect', 'dungeon', 'beast', 'event', 'breakthrough', 'other']
const HISTORY_MAX = 7          // 滚动保留最近 7 个归因日

const pad = (v) => String(v).padStart(2, '0')
const dayKeyOf = (now) => {
  const d = new Date(now)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function blankLines () {
  const o = {}
  for (const k of LINES) o[k] = { qi: 0, stones: 0 }
  return o
}

function totalsOf (lines) {
  let qi = 0
  let stones = 0
  for (const k of LINES) { qi += lines[k].qi; stones += lines[k].stones }
  return { qi, stones }
}

/** 懒建 + 老档兜底（返回 econ 子树；跨日在此结转） */
export function ensureEcon (state, now = Date.now()) {
  let econ = state && state.econ
  if (!econ || typeof econ !== 'object' || !econ.lines) {
    econ = state.econ = { dayKey: dayKeyOf(now), dayStartAt: now, lines: blankLines(), history: [] }
  }
  if (!Array.isArray(econ.history)) econ.history = []
  if (typeof econ.dayStartAt !== 'number') econ.dayStartAt = now
  const key = dayKeyOf(now)
  if (econ.dayKey !== key) {
    // 跨日结转：旧账整份入史册（哪怕全零也留一行——留痕便于核对"这天没挂"）
    econ.history.push({
      dayKey: econ.dayKey,
      dayStartAt: econ.dayStartAt,
      lines: econ.lines,
      totals: totalsOf(econ.lines)
    })
    if (econ.history.length > HISTORY_MAX) econ.history = econ.history.slice(-HISTORY_MAX)
    econ.dayKey = key
    econ.dayStartAt = now
    econ.lines = blankLines()
  }
  return econ
}

/**
 * 记一笔净入账（正负皆可——事件的代价、突破失败的修为损失都是归因事实）
 * @param {object} state 存档根
 * @param {string} line  LINES 之一（未知来源落 other，不静默丢失）
 * @param {{qi?:number, stones?:number}} gain 净额
 * @param {number} now
 */
export function noteGain (state, line, gain, now = Date.now()) {
  if (!state || !gain || (typeof gain.qi !== 'number' && typeof gain.stones !== 'number')) return null
  const econ = ensureEcon(state, now)
  const key = LINES.includes(line) ? line : 'other'
  const l = econ.lines[key]
  if (typeof gain.qi === 'number' && gain.qi) l.qi += gain.qi
  if (typeof gain.stones === 'number' && gain.stones) l.stones += gain.stones
  return econ
}

/**
 * 归因视图（设置面板 / 调试出口用；只读）
 * @returns {{ dayKey, spanMs, rows:[{line,qi,stones,qiPct,stonesPct}], totals, history }}
 */
export function econView (state, now = Date.now()) {
  const econ = ensureEcon(state, now)
  const t = totalsOf(econ.lines)
  const rows = LINES
    .map((k) => ({
      line: k,
      qi: econ.lines[k].qi,
      stones: econ.lines[k].stones,
      qiPct: t.qi > 0 ? econ.lines[k].qi / t.qi : 0,
      stonesPct: t.stones > 0 ? econ.lines[k].stones / t.stones : 0
    }))
    .filter((r) => r.qi !== 0 || r.stones !== 0)
  return {
    dayKey: econ.dayKey,
    spanMs: now - (econ.dayStartAt || now),
    rows,
    totals: t,
    history: econ.history.map((h) => ({ ...h }))
  }
}
