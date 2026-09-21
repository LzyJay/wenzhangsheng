/**
 * ForgeSystem.js —— 炼器系统（纯逻辑层 · V7.3）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/forge.js（炼器配方）+ src/data/items.js（物品定义）
 * 范式：**逐条对齐 AlchemySystem**（`canBrew/brew/recipesView` → `canForge/forge/forgeView`），
 *   便于丹房「炼丹 / 炼器」两页共用同一套渲染与自测口径。
 *
 * 职责：
 *   · forge     材料 → 成器率判定 → 法宝入囊（失败返还一半材料，与炼炉同口径）
 *   · forgeView 炼器页面板视图（含输入持有量 / 可炼状态）
 *
 * ⚠ 不新增任何 state 叶子（`SCHEMA_VERSION` 仍 1）：炼器无每日次数、无独立进度，
 *   材料与产出都落在既有 `state.inventory.items` 上 → 结构上不可能产生迁移需求。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { FORGE_RECIPES, FORGE_QUALITY_RATE, getForgeRecipe } from '../data/forge.js'
import { QUALITY_NAME } from '../util/quality.js'   // 品质档名单一真源
import { getItem } from '../data/items.js'

class ForgeSystem {
  /** @param {object} state 存档状态树（只读写 state.inventory.items） */
  constructor (state) {
    this.state = state
  }

  /** 行囊快捷访问（老档自愈，与其余系统同口径） */
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

  // ── 炼制 ────────────────────────────────────────────────────────────────

  /** 材料是否齐备 */
  canForge (recipeId) {
    const r = getForgeRecipe(recipeId)
    if (!r) return { ok: false, missing: [], message: '未登记的炼器配方' }
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
   * 开一炉：扣材料 → 成器率判定 → 法宝入囊
   * @returns {{ok:boolean, success?:boolean, message:string, treasureId?:string, treasureName?:string, backs?:Array}}
   */
  forge (recipeId) {
    const r = getForgeRecipe(recipeId)
    if (!r) return { ok: false, message: '未登记的炼器配方' }
    const check = this.canForge(recipeId)
    if (!check.ok) return { ok: false, message: check.message }

    for (const i of r.inputs) this.items[i.id] = this._count(i.id) - i.n

    const success = Math.random() < r.rate
    const treasureName = getItem(r.treasureId).name
    if (!success) {
      // 失败：炉炸器毁，返还一半材料（向下取整），法宝不入囊
      const backs = []
      for (const i of r.inputs) {
        const back = Math.floor(i.n / 2)
        if (back > 0) {
          this.items[i.id] = this._count(i.id) + back
          backs.push(`${getItem(i.id).name}×${back}`)
        }
      }
      return {
        ok: true,
        success: false,
        treasureId: r.treasureId,
        treasureName,
        backs,
        message: `${r.name}开炉失败：器胚崩了，收回${backs.length ? backs.join('、') : '零碎料'}。`
      }
    }

    this.items[r.treasureId] = this._count(r.treasureId) + 1
    return {
      ok: true,
      success: true,
      treasureId: r.treasureId,
      treasureName,
      backs: [],
      message: `炼成 ${treasureName} ×1（已成器入囊，现存 ${this._count(r.treasureId)} 件）。`
    }
  }

  // ── 展示 ────────────────────────────────────────────────────────────────

  /**
   * 炼器页面板视图（含输入持有量与可炼状态）
   * @param {object} [opts] 预留（与 `recipesView` 同形，便于面板共用渲染）
   */
  forgeView (opts = {}) {
    void opts
    return FORGE_RECIPES.map((r) => {
      const check = this.canForge(r.id)
      const it = getItem(r.treasureId)
      return {
        ...r,
        treasureName: it.name,
        needed: false,                       // 炼器无「当前所需」概念（与丹药的卡关判定不同）
        have: this._count(r.treasureId),
        qualityName: QUALITY_NAME[r.quality] || r.quality,
        inputsView: r.inputs.map((i) => ({
          ...i,
          name: getItem(i.id).name,
          have: this._count(i.id),
          enough: this._count(i.id) >= i.n
        })),
        canForge: check.ok,
        missing: check.missing
      }
    })
  }

  /** 炼制成功率的纯展示文案（面板脚注 / title 共用） */
  rateTextOf (r) {
    const rate = (r && Number(r.rate)) || 0
    return `${QUALITY_NAME[(r && r.quality) || 'fan'] || '凡'}档 · 成器率 ${Math.round(rate * 100)}%`
  }
}

export { FORGE_QUALITY_RATE }
export default ForgeSystem
