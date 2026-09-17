/**
 * AlchemySystem.js —— 炼丹系统（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/alchemy.js（丹方）+ src/data/items.js（物品定义）
 *
 * 职责：
 *   · brew        材料 → 成丹率判定 → 丹药入库（失败返还一半材料）
 *   · recipesView 丹方面板视图（含持有量 / 可炼状态）
 *   · ensureBottleneckPill 首个小瓶颈赠破境丹（新手脚本 §5："首次小瓶颈出现（赠送破境丹）"；
 *     老档站在瓶颈级且无丹时补发一次）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RECIPES, getRecipe, QUALITY_NAME } from '../data/alchemy.js'
import { getItem } from '../data/items.js'

class AlchemySystem {
  constructor (state) {
    this.state = state
  }

  /** 库存快捷访问（自动补全结构，避免老档缺字段崩溃） */
  get items () {
    const inv = this.state.inventory
    if (!inv || typeof inv !== 'object') this.state.inventory = { items: {} }
    if (!this.state.inventory.items || typeof this.state.inventory.items !== 'object') {
      this.state.inventory.items = {}
    }
    return this.state.inventory.items
  }

  _count (id) {
    return this.items[id] | 0
  }

  /** 当前级是否是"要交破境丹"的瓶颈级（节点语义：breakthrough 描述离开本级时的关口） */
  _onBottleneckLevel () {
    const level = this.state.player.realm.level
    const info = this.state.player.realm && null
    // 不 import realms（保持纯逻辑零依赖）；瓶颈级 = 每境第 3 / 6 重
    const stage = ((level - 1) % 9) + 1
    void info
    return stage === 3 || stage === 6
  }

  // ── 炼制 ────────────────────────────────────────────────────────────────

  /** 材料是否齐备 */
  canBrew (recipeId) {
    const r = getRecipe(recipeId)
    if (!r) return { ok: false, missing: [], message: '未登记的丹方' }
    const missing = []
    for (const i of r.inputs) {
      const lack = i.n - this._count(i.id)
      if (lack > 0) missing.push(`${getItem(i.id).name}×${lack}`)
    }
    return missing.length
      ? { ok: false, missing, message: `材料不足：${missing.join('、')}` }
      : { ok: true, missing: [], message: '' }
  }

  /**
   * 炼制一炉：扣材料 → 成丹率判定 → 入库
   * @returns {{ok:boolean, success?:boolean, message:string, pillId?:string}}
   */
  brew (recipeId) {
    const r = getRecipe(recipeId)
    if (!r) return { ok: false, message: '未登记的丹方' }
    const check = this.canBrew(recipeId)
    if (!check.ok) return { ok: false, message: check.message }

    // 扣材料
    for (const i of r.inputs) this.items[i.id] = this._count(i.id) - i.n

    const success = Math.random() < r.rate
    if (!success) {
      // 失败：丹炉炸炉，返还一半材料（向下取整），丹药不入库
      const backs = []
      for (const i of r.inputs) {
        const back = Math.floor(i.n / 2)
        if (back > 0) {
          this.items[i.id] = this._count(i.id) + back
          backs.push(`${getItem(i.id).name}×${back}`)
        }
      }
      this.state.stats.brewFails = (this.state.stats.brewFails | 0) + 1
      return {
        ok: true,
        success: false,
        message: `炼制${r.name}失败，丹炉一团焦黑${backs.length ? `（收回 ${backs.join('、')}）` : ''}`
      }
    }

    this.items[r.pillId] = this._count(r.pillId) + 1
    this.state.stats.brewSuccess = (this.state.stats.brewSuccess | 0) + 1
    return {
      ok: true,
      success: true,
      pillId: r.pillId,
      message: `丹成！${getItem(r.pillId).name} ×1 入囊中（成丹率 ${Math.round(r.rate * 100)}%）`
    }
  }

  // ── 自动炼制（主人 2026-09-17：丹房自动炼制所需丹药）─────────────────────
  // 口径：缺丹 + 材料够 → 自动开炉，一直炼到成丹或材料耗尽为止（成丹率不足 100%，
  //       故可能连炼数炉；失败按既有口径收回一半材料）。只动本模块的库存与统计。

  /** 找到产出某丹药的丹方 */
  recipeForPill (pillId) {
    return RECIPES.find((r) => r.pillId === pillId) || null
  }

  /**
   * 自动炼制某丹药（缺则炼，有则不动）
   * @param {string} pillId 目标丹药 id（如 pill_pojing / pill_hujie）
   * @param {object} [opts] { maxAttempts?:number 最多开炉数（默认 12） }
   * @returns {{ok:boolean, attempts:number, success:boolean, pillId:string, name:string, message:string, details:string[]}}
   */
  autoBrewFor (pillId, opts = {}) {
    const recipe = this.recipeForPill(pillId)
    const name = getItem(pillId).name
    const out = { ok: false, attempts: 0, success: false, pillId, name, message: '', details: [] }
    if (!recipe) {
      out.message = `丹房没有${name}的方子。`
      return out
    }
    const maxAttempts = Math.max(1, opts.maxAttempts | 0 || 12)
    if (this._count(pillId) > 0) {
      out.ok = true
      out.success = true
      out.message = ''
      return out
    }

    while (out.attempts < maxAttempts && this._count(pillId) <= 0) {
      const check = this.canBrew(recipe.id)
      if (!check.ok) {
        out.message = `${name}材料不足（${check.missing.join('、')}），丹房无法自动开炉。`
        break
      }
      out.attempts += 1
      const r = this.brew(recipe.id)
      out.details.push(r.message)
      if (!r.ok) break
    }

    out.success = this._count(pillId) > 0
    out.ok = out.attempts > 0
    if (out.success) {
      out.message = `丹房自动开炉：${out.attempts} 炉成丹，${name} ×1 已入囊中。`
    } else if (out.attempts > 0) {
      out.message = `丹房自动开炉 ${out.attempts} 炉，未能成丹 —— 材料已耗，先去秘境或宗门补些料。`
    } else if (!out.message) {
      out.message = `${name}材料不足，丹房无法自动开炉。`
    }
    return out
  }

  // ── 老档补发 / 新手赠丹 ─────────────────────────────────────────────────

  /**
   * 确保站在瓶颈级的人手里有破境丹（幂等）：
   *   · 新档首次升到瓶颈级时赠 1 枚（对齐《新手 30 分钟体验脚本》§3）
   *   · 老档补发：站在瓶颈级、身上无丹、且从未赠过 → 补 1 枚
   * @returns {{granted:boolean, message?:string}}
   */
  ensureBottleneckPill () {
    const flags = this.state.player.flags
    if (flags.pojingGifted) return { granted: false }
    if (!this._onBottleneckLevel()) return { granted: false }
    if (this._count('pill_pojing') > 0) {
      // 已有丹就不占"首赠"名额（第一次真正无丹冲关时再赠）
      return { granted: false }
    }
    this.items.pill_pojing = this._count('pill_pojing') + 1
    flags.pojingGifted = true
    return { granted: true, message: '宗门执事送来一枚破境丹：「小瓶颈冲关必需，收好。」（已入囊中）' }
  }

  // ── 展示 ────────────────────────────────────────────────────────────────

  /**
   * 丹方面板视图（含持有量与可炼状态）
   * @param {object} [opts] { needed?: string[] 当下"正缺"的丹药 id（面板据此标注「当前所需」）}
   */
  recipesView (opts = {}) {
    const needed = Array.isArray(opts.needed) ? opts.needed : []
    return RECIPES.map((r) => {
      const check = this.canBrew(r.id)
      return {
        ...r,
        needed: needed.includes(r.pillId),
        have: this._count(r.pillId),
        qualityName: QUALITY_NAME[r.quality] || r.quality,
        inputsView: r.inputs.map((i) => ({
          ...i,
          name: getItem(i.id).name,
          have: this._count(i.id),
          enough: this._count(i.id) >= i.n
        })),
        canBrew: check.ok,
        missing: check.missing
      }
    })
  }
}

export default AlchemySystem
