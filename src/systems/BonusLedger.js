/**
 * BonusLedger.js —— 统一加成接口的聚合账本（V3.5.3 工程加固 · 纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（§13.1①）：零 import、无 DOM / Phaser、不读不写 state ——
 *   只吃注入进来的「加成行」与只读 buffs 快照；它自己**不产生任何新数值**。
 *
 * 背景（对照两参考项目提炼）：产出 / 战力乘区散在 CultivationSystem.getEffRate 与
 *   main.js powerBreakdown 两处，各提供方（世界/灵根/功法/灵兽/契合/buff）没有
 *   统一的对外形状——想画完整乘区明细或做收益归因，只能各处硬抄。本文件把
 *   "读"与"算"分开：提供方各自声明加成行，账本只负责收拢与重算。
 *
 * 加成行形状（同签名 bonusView(now) 的返回约定，§13.2① view 形态）：
 *   { kind: 'rate' | 'power',   // 归属哪条乘区链
 *     label: string,            // 展示名（如「世界·青岚」「功法·产出加成」）
 *     mul: number,              // **本组折叠后的乘法因子**（世界 ×1.10 / 灵根 ×2.00 /
 *                               //   功法 1+Σ槽位 / 灵兽 1+N% / 契合 ×1.3 …）
 *     pct?: number,             // 展示用加成百分比（= mul−1；仅供 UI 显示，不参与重算）
 *     note?: string }           // 悬停说明（可空）
 *   ⚠ 契约修订（V3.5.4 真机点验抓到）：**每行 mul 是"组内已加法折叠"的独立乘法因子**，
 *   重算 = Π(mul)。游戏的既有乘区是 (1+功法)×(1+buff) 各自成乘——若把 pct 全并成一个
 *   (1+Σ) 会算小（真机 9.63 vs 12.945）。组内加法（功法三槽、多 buff 合计）由提供方在
 *   自己内部完成；pct 字段仅作展示。from 字段由 collect 自动补（提供方 id）。
 *
 * 重算口径（与既有公式逐位一致，V3.5.3-自测的 recomposition 断言即防漂对账器）：
 *   rate  = clamp( Π(mul), 0.05, 100 )   —— getEffRate 同式同钳制
 *   power = Π(mul)                       —— powerBreakdown 同式 ((1+功法)×(1+灵兽))
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RATE_CLAMP = { min: 0.05, max: 100 }   // 与 CultivationSystem.getEffRate 的 clamp 一致

/**
 * 收拢各提供方的加成行 + buff 公共乘区（装配层调用，实例由 main.js 注入）
 * buff 组（可能多条限时增益）在此**合计成一行**：mul = 1 + Σ qiRatePct——与 getEffRate
 * 的 "(1+buffPct) 单一因子" 同式；逐条增益名目由修为浮层的「增益明细」自行列出。
 * @param {Array<{id:string, bonusView:(now:number)=>Array<object>}>} providers
 * @param {Array<object>} buffs 只读 state.buffs 快照（buff 公共乘区归装配层所有，经此处入账）
 * @param {number} now
 * @returns {Array<object>} lines（新数组，不改任何入参）
 */
export function collectBonusLines (providers = [], buffs = [], now = Date.now()) {
  const lines = []
  for (const p of providers) {
    if (!p || typeof p.bonusView !== 'function') continue
    const rows = p.bonusView(now) || []
    for (const r of rows) lines.push({ ...r, from: r.from || p.id })
  }
  let buffPct = 0
  for (const b of Array.isArray(buffs) ? buffs : []) {
    if (!b || !b.mods || typeof b.mods.qiRatePct !== 'number') continue
    if ((b.endsAt || Infinity) <= now) continue              // 与 getEffRate 的过期判定同式
    buffPct += b.mods.qiRatePct
  }
  if (buffPct) {
    lines.push({
      kind: 'rate',
      label: `增益合计（${buffPct > 0 ? '+' : '−'}${Math.round(Math.abs(buffPct) * 100)}%）`,
      mul: 1 + buffPct,
      pct: buffPct,
      note: '全部限时/常在增益的净合计（逐条名目见修为浮层）',
      from: 'buff'
    })
  }
  return lines
}

/**
 * 重算两条乘区链（与既有公式逐位一致；只读不写）
 * @param {Array<object>} lines collectBonusLines 的产出（或任何同形状行）
 * @returns {{ rateMul:number, powerMul:number }}
 */
export function recomposeBonus (lines = []) {
  let rateMul = 1
  let powerMul = 1
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!l || typeof l.mul !== 'number') continue
    if (l.kind === 'rate') rateMul *= l.mul
    else if (l.kind === 'power') powerMul *= l.mul
  }
  rateMul = Math.min(RATE_CLAMP.max, Math.max(RATE_CLAMP.min, rateMul))
  return { rateMul, powerMul }
}
