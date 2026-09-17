/**
 * TechniqueSystem.js —— 功法系统（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/techniques.js
 *
 * 唯一真源（同一事实只留一处，避免漂移）：
 *   · 装备关系 → `state.player.techniqueSlots { main, side:[a,b] }`
 *   · 等级     → `state.techniques.ownedTechniques[id].level`
 *   （《数据模型》§六 的示例里 `ownedTechniques[id].equipped` 与 `techniqueSlots`
 *     描述的是同一件事 —— 本项目只保留后者，杜绝两处写法不一致。）
 *
 * 效果：
 *   · 产出乘区 `× (1 + ratePct())`，加法叠加（《数值与公式手册》§2.1）。
 *   · 战力乘区 `× (1 + combatPct())`，同样加法叠加（主人 2026-09-19：功法要影响战力）。
 *   · 长期参悟（主人 2026-09-19）：装备中的功法按**在线**时间累积参悟值，
 *     攒够 cultivateSecOf(t, 级) 秒自动升 1 级，不消耗灵气 / 灵石（见 trainTick）。
 * 存档子树：state.techniques.ownedTechniques（等级）＋ state.techniques.train（参悟秒数，懒建）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  TECHNIQUES, SLOT_META, STARTER_TECHNIQUE,
  getTechnique, levelCost, tierLabel, slotKindsOf, cultivateSecOf
} from '../data/techniques.js'

const REALM_SIZE = 9

class TechniqueSystem {
  constructor (state) {
    this.state = state
  }

  // ── 基础访问 ────────────────────────────────────────────────────────────

  get owned () {
    const t = this.state.techniques
    if (!t || typeof t !== 'object') return {}
    if (!t.ownedTechniques || typeof t.ownedTechniques !== 'object') t.ownedTechniques = {}
    return t.ownedTechniques
  }

  get slots () {
    const p = this.state.player
    if (!p.techniqueSlots || typeof p.techniqueSlots !== 'object') {
      p.techniqueSlots = { main: null, side: [null, null] }
    }
    if (!Array.isArray(p.techniqueSlots.side)) p.techniqueSlots.side = [null, null]
    while (p.techniqueSlots.side.length < 2) p.techniqueSlots.side.push(null)
    return p.techniqueSlots
  }

  /** 当前大境界序号（0 = 炼气） */
  get realmIndex () {
    return Math.floor((this.state.player.realm.level - 1) / REALM_SIZE)
  }

  has (id) {
    return !!this.owned[id]
  }

  /**
   * 直接授予（宗门按境界下发 / 秘境残卷所得）；幂等：已持有则不改动
   * —— 供装配层注入调用（SectSystem / DungeonSystem 亦经注入引用调用，不横向 import）
   * @param {string} id 功法 id
   * @param {number} [level] 初始等级（默认 1）
   * @returns {{ok:boolean, message:string, id?:string, name?:string}}
   */
  grant (id, level = 1) {
    const t = getTechnique(id)
    if (!t) return { ok: false, message: '未登记的功法，无法授予' }
    if (this.has(id)) return { ok: false, message: `《${t.name}》已在囊中` }
    this.owned[id] = { level: Math.max(1, level | 0 || 1) }
    return { ok: true, id, name: t.name, message: `习得《${t.name}》（${tierLabel(t)}）——去功法面板装槽即可生效。` }
  }

  levelOf (id) {
    const o = this.owned[id]
    return o ? (o.level | 0) || 1 : 0
  }

  /** 该功法当前装在哪个槽（'main' | 'side0' | 'side1' | null） */
  slotOf (id) {
    const s = this.slots
    if (s.main === id) return 'main'
    if (s.side[0] === id) return 'side0'
    if (s.side[1] === id) return 'side1'
    return null
  }

  /** 槽位是否已解锁 */
  unlocked (kind) {
    if (kind === 'main') return true
    const meta = SLOT_META[kind]
    if (!meta || typeof meta.unlockRealmIndex !== 'number') return false
    return this.realmIndex >= meta.unlockRealmIndex
  }

  /** 槽位当前装的功法 id */
  slotTechId (kind) {
    const s = this.slots
    if (kind === 'main') return s.main
    if (kind === 'side0') return s.side[0]
    if (kind === 'side1') return s.side[1]
    return null
  }

  _writeSlot (kind, id) {
    const s = this.slots
    if (kind === 'main') s.main = id
    else if (kind === 'side0') s.side[0] = id
    else if (kind === 'side1') s.side[1] = id
  }

  // ── 乘区 ────────────────────────────────────────────────────────────────

  /**
   * 单个功法的产出加成（当前等级）
   * 按等级线性累加：1 级就有 +rateAddPctPerLevel —— 装备立刻见效（验收口径：
   * "装备功法后产出倍率实时变化"，若从 0 级起算，1 级装上等于没装）
   */
  ratePctOf (id) {
    const t = getTechnique(id)
    const lv = this.levelOf(id)
    if (!t || !lv) return 0
    return t.rateAddPctPerLevel * lv
  }

  /** 已装备功法的产出加成合计（加法叠加，供产出乘区使用） */
  ratePct () {
    let sum = 0
    for (const kind of ['main', 'side0', 'side1']) {
      const id = this.slotTechId(kind)
      if (id) sum += this.ratePctOf(id)
    }
    return sum
  }

  /**
   * 单个功法的战力加成（当前等级）
   * 与产出同口径：1 级即生效，按等级线性累加
   */
  combatPctOf (id) {
    const t = getTechnique(id)
    const lv = this.levelOf(id)
    if (!t || !lv) return 0
    return (t.combatAddPctPerLevel || 0) * lv
  }

  /** 已装备功法的战力加成合计（加法叠加，供战力乘区使用） */
  combatPct () {
    let sum = 0
    for (const kind of ['main', 'side0', 'side1']) {
      const id = this.slotTechId(kind)
      if (id) sum += this.combatPctOf(id)
    }
    return sum
  }

  // ── 装备 / 卸下 ─────────────────────────────────────────────────────────

  /** 该功法能否装进指定槽位 */
  canEquip (id, kind) {
    const t = getTechnique(id)
    if (!t) return { ok: false, message: '未登记的功法' }
    if (!this.has(id)) return { ok: false, message: `${t.name} 尚未习得` }
    if (kind === 'main' && !slotKindsOf(t).includes('main')) {
      return { ok: false, message: `${t.name} 是流派辅修功法，只能入辅修槽` }
    }
    if (kind !== 'main' && !slotKindsOf(t).includes('side')) {
      return { ok: false, message: `${t.name} 是吐纳主修功法，只能入主修槽` }
    }
    if (!this.unlocked(kind)) {
      const m = SLOT_META[kind]
      return { ok: false, message: `${m.label}需 ${m.unlockName} 期方可开启` }
    }
    return { ok: true, message: '' }
  }

  /**
   * 装备：若目标槽已有功法则替换（旧的自动卸下）；若该功法已装在别处则先挪走
   * @returns {{ok:boolean, message:string, replaced?:string}}
   */
  equip (id, kind) {
    const check = this.canEquip(id, kind)
    if (!check.ok) return check

    const prev = this.slotTechId(kind)
    if (prev === id) return { ok: true, message: `${getTechnique(id).name} 已在该槽`, replaced: null }

    // 同一本功法不能在两个槽里同时存在
    const old = this.slotOf(id)
    if (old) this._writeSlot(old, null)

    this._writeSlot(kind, id)
    const t = getTechnique(id)
    const m = SLOT_META[kind]
    const msg = prev
      ? `${m.label}改修：${getTechnique(prev).name} → ${t.name}`
      : `${m.label}已习：${t.name}（产出 +${(this.ratePctOf(id) * 100).toFixed(0)}%）`
    return { ok: true, message: msg, replaced: prev || null }
  }

  unequip (kind) {
    const id = this.slotTechId(kind)
    if (!id) return { ok: false, message: `${SLOT_META[kind].label}本就空着` }
    this._writeSlot(kind, null)
    return { ok: true, message: `已卸下 ${getTechnique(id).name}`, removed: id }
  }

  // ── 升级 ────────────────────────────────────────────────────────────────

  /** 升级所需与是否付得起 */
  upgradeInfo (id) {
    const t = getTechnique(id)
    const lv = this.levelOf(id)
    if (!t || !lv) return { ok: false, message: '尚未习得' }
    const maxed = lv >= t.maxLevel
    const cost = maxed ? null : levelCost(t, lv)
    const qi = this.state.resources.qi
    const stones = this.state.resources.stones
    const enoughQi = !!cost && qi >= cost.qi
    const enoughStone = !!cost && stones >= cost.stone
    return {
      ok: true, maxed, level: lv, maxLevel: t.maxLevel, cost,
      qi, stones, enoughQi, enoughStone,
      affordable: !!cost && enoughQi && enoughStone,
      curPct: this.ratePctOf(id),
      nextPct: maxed ? this.ratePctOf(id) : t.rateAddPctPerLevel * lv,
      curCombatPct: this.combatPctOf(id),
      nextCombatPct: maxed ? this.combatPctOf(id) : (t.combatAddPctPerLevel || 0) * lv,
      blocker: maxed ? '已至圆满' : (!enoughQi ? '灵气不足' : (!enoughStone ? '灵石不足' : null))
    }
  }

  /**
   * 升级：消耗灵气 + 灵石，等级 +1
   * 灵气与境界推进共用同一池 —— 这是设计里的取舍（《设定书》§5 灵气主消耗）
   */
  upgrade (id) {
    const info = this.upgradeInfo(id)
    if (!info.ok) return info
    if (info.maxed) return { ok: false, message: `${getTechnique(id).name} 已至圆满（${info.maxLevel} 级）` }
    if (!info.affordable) return { ok: false, message: `${info.blocker}，暂不可升级` }

    this.state.resources.qi -= info.cost.qi
    this.state.resources.stones -= info.cost.stone
    this.owned[id].level = info.level + 1
    const t = getTechnique(id)
    return {
      ok: true,
      message: `${t.name} 参悟至第 ${info.level + 1} 级（产出 +${(this.ratePctOf(id) * 100).toFixed(0)}%）`,
      spentQi: info.cost.qi,
      spentStone: info.cost.stone,
      level: info.level + 1,
      pct: this.ratePctOf(id)
    }
  }

  // ── 长期参悟（自动升级；主人 2026-09-19）─────────────────────────────────

  /** 参悟台账（懒建：老档无此字段时补全，不进迁移链） */
  get train () {
    const t = this.state.techniques
    if (!t.train || typeof t.train !== 'object') t.train = {}
    return t.train
  }

  /** 某功法已累积的参悟秒数 */
  trainSecOf (id) {
    return Math.max(0, Number(this.train[id]) || 0)
  }

  /**
   * 参悟进度（面板显示用）
   * @returns {{ok:boolean, maxed:boolean, level:number, need:number, cur:number, pct:number, remainSec:number}}
   */
  trainInfo (id) {
    const t = getTechnique(id)
    const lv = this.levelOf(id)
    if (!t || !lv) return { ok: false, maxed: false, level: 0, need: 0, cur: 0, pct: 0, remainSec: 0 }
    if (lv >= t.maxLevel) {
      return { ok: true, maxed: true, level: lv, need: 0, cur: 0, pct: 1, remainSec: 0 }
    }
    const need = cultivateSecOf(t, lv)
    const cur = Math.min(this.trainSecOf(id), need)
    return {
      ok: true,
      maxed: false,
      level: lv,
      need,
      cur,
      pct: need > 0 ? cur / need : 0,
      remainSec: Math.max(0, need - cur)
    }
  }

  /**
   * 参悟节拍（装配层主循环调用）：装备中的功法按在线秒累积，攒够即自动 +1 级
   *   · 只算**在线**挂机时长（与俸禄、灵兽被动同口径：闭关不算）
   *   · 免费，不消耗灵气 / 灵石；花资源升级仍是"更快的那条路"
   *   · 满级即清掉参悟进度（不占档）
   * @param {number} dtSec 本拍经过的在线秒数
   * @returns {Array<{id:string,name:string,level:number,pct:number,combatPct:number}>} 本次精进的功法
   */
  trainTick (dtSec = 0) {
    const out = []
    const dt = Number(dtSec) || 0
    if (!(dt > 0)) return out
    const equipped = ['main', 'side0', 'side1'].map((k) => this.slotTechId(k)).filter(Boolean)
    for (const id of equipped) {
      const t = getTechnique(id)
      if (!t) continue
      let lv = this.levelOf(id)
      if (lv >= t.maxLevel) { delete this.train[id]; continue }
      let acc = this.trainSecOf(id) + dt
      // 一拍可能跨过多个等级（长间隔 / 调试跳时）→ 逐级结算，不会丢进度
      while (lv < t.maxLevel) {
        const need = cultivateSecOf(t, lv)
        if (!(need > 0) || acc < need) break
        acc -= need
        lv += 1
        this.owned[id].level = lv
        out.push({
          id,
          name: t.name,
          level: lv,
          pct: this.ratePctOf(id),
          combatPct: this.combatPctOf(id)
        })
      }
      if (lv >= t.maxLevel) delete this.train[id]
      else this.train[id] = acc
    }
    return out
  }

  // ── 开局赠予 / 老档补发 ─────────────────────────────────────────────────

  /**
   * 确保有入门功法（幂等）：测灵根后赠予，老档缺则补发
   * @returns {{granted:boolean, id?:string, name?:string}}
   */
  ensureStarter () {
    if (Object.keys(this.owned).length > 0) return { granted: false }
    const t = getTechnique(STARTER_TECHNIQUE)
    if (!t) return { granted: false }
    this.owned[STARTER_TECHNIQUE] = { level: 1 }
    this._writeSlot('main', STARTER_TECHNIQUE)
    return { granted: true, id: STARTER_TECHNIQUE, name: t.name }
  }

  // ── 展示用 ──────────────────────────────────────────────────────────────

  /** 槽位卡列表（含未解锁态） */
  slotList () {
    return ['main', 'side0', 'side1'].map((kind) => {
      const meta = SLOT_META[kind]
      const id = this.slotTechId(kind)
      const t = id ? getTechnique(id) : null
      return {
        kind,
        label: meta.label,
        unlocked: this.unlocked(kind),
        unlockName: meta.unlockName,
        id,
        tech: t,
        level: id ? this.levelOf(id) : 0,
        pct: id ? this.ratePctOf(id) : 0,
        combatPct: id ? this.combatPctOf(id) : 0,
        train: id ? this.trainInfo(id) : null,
        label2: t ? tierLabel(t) : ''
      }
    })
  }

  /** 全表 + 习得状态（面板用：已习得列表 + 图鉴） */
  catalog () {
    const attrs = (this.state.player.root && this.state.player.root.attrs) || []
    return TECHNIQUES.map((t) => {
      const owned = this.has(t.id)
      const kind = this.slotOf(t.id)
      return {
        tech: t,
        tierLabel: tierLabel(t),
        slotKinds: slotKindsOf(t),
        owned,
        level: owned ? this.levelOf(t.id) : 0,
        equipped: kind,
        equippedLabel: kind ? SLOT_META[kind].label : null,
        pct: owned ? this.ratePctOf(t.id) : 0,
        combatPct: owned ? this.combatPctOf(t.id) : 0,
        train: owned ? this.trainInfo(t.id) : null,
        match: this.tagMatch(t, attrs),
        upgrade: owned ? this.upgradeInfo(t.id) : null
      }
    })
  }

  /**
   * 与灵根是否同源（仅作显示提示，不加成 —— 设计库未给系数，不发明数值）
   * tags 含 'wuxing' 视为通用；否则任一 tag 命中灵根属性即为同源
   */
  tagMatch (t, attrs = null) {
    const list = attrs || ((this.state.player.root && this.state.player.root.attrs) || [])
    const tags = t.tags || []
    if (tags.includes('wuxing')) return 'any'
    if (!list.length) return 'none'
    return tags.some((x) => list.includes(x)) ? 'yes' : 'no'
  }

  /** 面板顶部汇总 */
  summary () {
    const pct = this.ratePct()
    const combatPct = this.combatPct()
    const eq = ['main', 'side0', 'side1']
      .map((k) => this.slotTechId(k))
      .filter(Boolean)
      .map((id) => ({
        id,
        name: getTechnique(id).name,
        level: this.levelOf(id),
        pct: this.ratePctOf(id),
        combatPct: this.combatPctOf(id)
      }))
    return { pct, combatPct, equipped: eq }
  }
}

export default TechniqueSystem
