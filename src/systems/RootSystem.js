/**
 * RootSystem.js —— 灵根开局：测灵根 / 洗髓重掷 / 保底递增（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数值与权重全部来自 src/data/roots.js（唯一参数源）。
 *
 * 抽取流程：按（漂移后的）权重选档 → 按档位属性池随机取 N 个属性 → 写入 player.root。
 * 保底递增：rerollCount 越大，伪灵根权重越低、高资质权重越高；
 *           累计 hardGuaranteeAt 次未出"变异及以上"则下一次必出。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  ROOT_TIERS, HIDDEN_ROOT, HIDDEN_CHANCE, REROLL_PITY, XISUI_DROP, WUXING, MUTANT, MUTANT_TAG,
  getRootTier, attrsLabel
} from '../data/roots.js'

class RootSystem {
  constructor (state) {
    this.state = state
  }

  // ── 当前灵根 ────────────────────────────────────────────────────────────

  get drawn () {
    return !!this.state.player.root.id
  }

  get tier () {
    return getRootTier(this.state.player.root.rarity)
  }

  /** 产出 / 成本乘区（未测灵根时均为 1） */
  get mods () {
    const t = this.tier
    return t ? { ...t.mods } : { rateMul: 1, costMul: 1 }
  }

  /**
   * 统一加成接口（V3.5.3）：本系统提供的加成行（只读，无副作用）。
   * 产出乘区 = 灵根 rateMul——独立乘法因子，恒给行（未测灵根也要有 ×1 中性行）。
   */
  bonusView () {
    const t = this.tier
    return [{
      kind: 'rate',
      label: `灵根·${t ? t.name : '未测'}`,
      mul: this.mods.rateMul,
      note: t ? '资质决定基础吐纳速率' : '测出灵根前不产出（先测灵根再打坐）'
    }]
  }

  get attrs () {
    return this.state.player.root.attrs || []
  }

  get attrLabel () {
    return attrsLabel(this.attrs)
  }

  /** 显示名：天灵根·雷 / 真灵根·水木 */
  get displayName () {
    const t = this.tier
    if (!t) return '未测灵根'
    const a = this.attrLabel
    return a ? `${t.name}·${a}` : t.name
  }

  get pillCount () {
    return this.state.inventory.items[XISUI_DROP.itemId] | 0
  }

  get rerollCount () {
    return this.state.player.root.rerollCount | 0
  }

  /** 天灵根特权：结丹（第 3 个大境界）无瓶颈（混沌灵根同享——万法归一） */
  get noBottleneckOnJindan () {
    return this.state.player.root.rarity === 'heaven' || this.state.player.root.rarity === HIDDEN_ROOT.rarity
  }

  // ── 洗髓：权重与保底 ────────────────────────────────────────────────────

  /** 按重掷次数漂移后的权重（未归一化） */
  getWeights () {
    const p = REROLL_PITY
    const steps = Math.min(this.rerollCount, p.maxSteps)
    const out = {}
    for (const t of ROOT_TIERS) {
      const delta = p.step[t.rarity] || 0
      let w = t.weight + delta * steps
      if (p.minWeight[t.rarity] != null) w = Math.max(p.minWeight[t.rarity], w)
      out[t.rarity] = Math.max(0.001, w)
    }
    return out
  }

  /** 保底状态：累计多少次未出"变异及以上" */
  get lowStreak () {
    return this.state.player.root.lowStreak | 0
  }

  get hardGuaranteeReady () {
    return this.lowStreak >= REROLL_PITY.hardGuaranteeAt
  }

  /** 洗髓预览（UI 展示用：当前概率、丹药、保底倒计时） */
  previewReroll () {
    const weights = this.getWeights()
    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    const prob = {}
    for (const t of ROOT_TIERS) {
      if (!this.hardGuaranteeReady) {
        prob[t.rarity] = weights[t.rarity] / total
        continue
      }
      // 硬保底：只出变异 / 天灵根 —— 其余两档真实概率为 0（面板要如实显示，
      // 否则玩家会以为还能抽到伪/真灵根）。82 / 18 与 _pickTier 的同源权重一致；
      // 另有 HIDDEN_CHANCE 的混沌灵根彩蛋独立于四档之外（V3.5.1），下方单独给 prob.hidden。
      const high = ROOT_TIERS.filter((x) => x.rarity === 'mutant' || x.rarity === 'heaven')
      const highTotal = high.reduce((a, b) => a + b.weight, 0)
      prob[t.rarity] = (t.rarity === 'mutant' || t.rarity === 'heaven')
        ? (1 - HIDDEN_CHANCE) * t.weight / highTotal
        : 0
    }
    // 混沌灵根彩蛋：只在硬保底就绪的那次掷里有概率；平时一律 0
    prob[HIDDEN_ROOT.rarity] = this.hardGuaranteeReady ? HIDDEN_CHANCE : 0
    return {
      weights,
      prob,
      hiddenReady: this.hardGuaranteeReady,
      pillCount: this.pillCount,
      rerollCount: this.rerollCount,
      lowStreak: this.lowStreak,
      hardNeed: Math.max(0, REROLL_PITY.hardGuaranteeAt - this.lowStreak),
      hardGuaranteeReady: this.hardGuaranteeReady,
      canReroll: this.drawn && this.pillCount > 0
    }
  }

  // ── 抽取 ────────────────────────────────────────────────────────────────

  /** 首次测灵根（不计入洗髓次数） */
  drawFirst () {
    const result = this._roll()
    this._commit(result, { reroll: false })
    return result
  }

  /** 洗髓重掷（消耗 1 枚洗髓丹） */
  reroll () {
    if (!this.drawn) return { ok: false, reason: 'not-drawn', message: '尚未测过灵根。' }
    if (this.pillCount <= 0) {
      return { ok: false, reason: 'pill', message: `洗髓丹不足（需 1 枚，现 ${this.pillCount} 枚）。` }
    }
    this.state.inventory.items[XISUI_DROP.itemId] = this.pillCount - 1
    this.state.player.root.rerollCount = this.rerollCount + 1
    this.state.stats.rerolls = (this.state.stats.rerolls || 0) + 1

    const result = this._roll()
    this._commit(result, { reroll: true })
    return { ok: true, ...result }
  }

  /** 大境界突破成功时的洗髓丹补充（MVP 口径） */
  grantTrialDrop () {
    const n = XISUI_DROP.perTrial
    this.state.inventory.items[XISUI_DROP.itemId] = this.pillCount + n
    return n
  }

  // ── 内部 ────────────────────────────────────────────────────────────────

  /** 按权重抽档 + 抽属性；返回 { tier, attrs, attrLabel, displayName, tag } */
  _roll () {
    const tier = this._pickTier()
    const pool = tier.attrPool === 'mutant' ? MUTANT : WUXING
    const n = tier.attrCount[0] === tier.attrCount[1]
      ? tier.attrCount[0]
      : tier.attrCount[0] + Math.round(Math.random() * (tier.attrCount[1] - tier.attrCount[0]))

    const picked = this._sample(pool, n)
    const attrLabel = attrsLabel(picked)
    return {
      tier,
      attrs: picked,
      attrLabel,
      displayName: attrLabel ? `${tier.name}·${attrLabel}` : tier.name,
      tag: tier.rarity === 'mutant' ? (MUTANT_TAG[picked[0]] || '') : '',
      hardGuarantee: this.hardGuaranteeReady
    }
  }

  _pickTier () {
    // 硬保底：只允许变异 / 天灵根；另有混沌灵根彩蛋（独立小概率，V3.5.1）
    if (this.hardGuaranteeReady) {
      if (Math.random() < HIDDEN_CHANCE) return HIDDEN_ROOT
      const high = ROOT_TIERS.filter((t) => t.rarity === 'mutant' || t.rarity === 'heaven')
      const w = high.map((t) => t.weight)
      return this._weighted(high, w)
    }
    const weights = this.getWeights()
    return this._weighted(ROOT_TIERS, ROOT_TIERS.map((t) => weights[t.rarity]))
  }

  _weighted (items, weights) {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }

  /** 从池中不重复抽 n 个 */
  _sample (pool, n) {
    const copy = [...pool]
    const out = []
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
    }
    return out
  }

  /** 写入 state（含保底计数维护） */
  _commit (result, { reroll }) {
    const root = this.state.player.root
    root.id = `root_${result.tier.rarity}${result.attrs.length ? '_' + result.attrs.join('') : ''}`
    root.rarity = result.tier.rarity
    root.attrs = result.attrs
    root.drawnAt = Date.now()
    this.state.player.flags.rootDrawn = true

    // 保底计数：出了"变异及以上"（含混沌彩蛋）就清零
    if (['mutant', 'heaven', HIDDEN_ROOT.rarity].includes(result.tier.rarity)) root.lowStreak = 0
    else root.lowStreak = this.lowStreak + 1

    if (reroll) root.lastRerollAt = Date.now()
  }
}

export default RootSystem
