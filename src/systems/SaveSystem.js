/**
 * SaveSystem.js —— 存档序列化 / 迁移 / 落盘 / 离线收益结算（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state 与存储介质。
 *
 * 存储（阶段一 1.2 加固 + V3.5.2 存档加固后的口径）：
 *   ① 唯一真源：`%APPDATA%\问长生\save.json` —— 由主进程原子写（.tmp → rename），
 *      写前把旧档按环形规则转存（save.bak → .bak.2 → … → .bak.5，10 分钟一轮转，
 *      兼防"30 秒一档把所有备份挤进最近两分钟"）。
 *   ①b 校验和：serialize 对除自身外的整包算 FNV-1a 写入 checksum 字段；parse 复核，
 *      不符即按坏档处理（防传输截断 / 磁盘坏块 / 随手改档；非加密，档仍为明文 JSON）。
 *   ①c 自愈：真源与热备都坏时，load 会从环形备份逐格找可复核的档恢复（reason=recover）。
 *   ② 热备：同一份 JSON 同时镜像到 localStorage —— 仅当 save.json 缺失/损坏时才会被采用。
 *   ③ 浏览器开发模式（无 Electron）：只走 localStorage。
 * 结构：schemaVersion + 迁移函数链；字段新增由 mergeDefaults 自动兜底，不必升版；
 *       只有"字段语义变更 / 结构重组"才升版并在 MIGRATIONS 里补一条迁移函数。
 * 离线：由调用方传入"当前有效产出"（本类不依赖 CultivationSystem，避免循环依赖）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OFFLINE, getRealmMeta } from '../data/realms.js'

const SAVE_KEY = 'wenzhangsheng.save'      // localStorage 键（兼作热备槽）
const SCHEMA_VERSION = 1
const APP_VERSION = '5.1.0'                                // V5.1（阶段五首批：招牌秘境接线 + 遗留待办 1 收官）；与 package.json 同步
const LOG_MAX = 40
const BACKUP_INTERVAL_MS = 60 * 1000

const hasLocalStorage = typeof localStorage !== 'undefined'

// ── 存档校验和（V3.5.2 存档加固）──────────────────────────────────────────
// FNV-1a 32 位：同步、零依赖、毫秒级。目的＝**完整性**（传输截断 / 磁盘坏块 /
// 随手改档），不是加密——防君子不防 decryption 专家（存档明文 JSON 的口径不变）。
// 序列化时把 checksum 作为最后一个字段写入；校验时把该字段摘掉后重新序列化比对，
// 键序与写入时逐位一致（JSON.stringify 保持插入序），结果可复现。
function fnv1a (str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * 迁移函数链：键 = 起始版本号。示例（本次无结构变更，仅留框架）：
 *   1: (save) => { save.newField = save.oldField; delete save.oldField; return save }
 */
const MIGRATIONS = {}

class SaveSystem {
  /**
   * @param {object|null} bridge window.desktop.save（Electron）；为空则退化为浏览器模式
   */
  constructor (bridge = null, key = SAVE_KEY) {
    this.bridge = bridge
    this.key = key
    this.backupKey = key + '.bak'
    this.lastBackupAt = 0
    this.lastSource = 'default'   // 本次启动实际用了哪份档：file | localstorage | default
  }

  /** 'file' | 'localStorage' | 'memory' */
  get backend () {
    if (this.bridge) return 'file'
    return hasLocalStorage ? 'localStorage' : 'memory'
  }

  get backendLabel () {
    return { file: '文件存档', localStorage: '浏览器存档', memory: '内存（不落盘）' }[this.backend]
  }

  // ── 全新存档（字段结构对齐《数据模型》§十三）────────────────────────────

  createDefaultState () {
    const now = Date.now()
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: now,
      meta: { createdAt: now, playtimeSec: 0, appVersion: APP_VERSION, gameVersion: APP_VERSION },
      player: {
        name: '无名散修',
        createdAt: now,
        realm: { level: 1 },                       // 1 = 炼气一重
        root: { id: null, rarity: null, attrs: [], rerollCount: 0, lowStreak: 0, drawnAt: 0 },
        lifespan: { maxYears: getRealmMeta(0).lifespanYears, remainYears: getRealmMeta(0).lifespanYears, lastUpdateAt: now },
        luck: 50,
        fit: 50,
        faction: null,
        techniqueSlots: { main: null, side: [null, null] },
        cooldownUntil: 0,                          // 突破调息冷却截止时间戳
        // 2.5 渡劫：本次准备 / 八关口战绩 / 最近二十次引雷 / 累计消耗（老档由 CultivationSystem.ensureTribul 兜底）
        tribul: { preps: {}, nodeStats: {}, history: [], total: { hujie: 0, sect: 0, cure: 0 } },
        flags: {}                                  // rootDrawn / firstTrialDone / ascended …
      },
      resources: { qi: 0, stones: 100, contribution: 0, daoXing: 0 },
      inventory: {
        items: {
          pill_xisui: 5                            // 洗髓丹：开局赠 5 枚；大境界突破 +1（阶段二改为任务/事件产出）
        }
      },
      buffs: [],
      techniques: {
        // 唯一真源：等级在 ownedTechniques[id].level，装备关系在 player.techniqueSlots
        ownedTechniques: {}
      },
      eventState: { pending: [], book: [], dedupe: {} },
      econ: null,              // V3.5.4 单日收益归因台账（EconLedger 懒建兜底；null＝老档未建）
      world: null,             // 2.9 世界卡池：null＝尚未抽世界（WorldSystem 懒建兜底）
      sect: null,
      beast: null,             // 2.8 灵兽：null＝尚无灵兽资产（BeastSystem 懒建兜底）
      achievements: null,      // 2.10 成就与纪事：null＝老档（AchievementSystem 懒建兜底）
      dungeonState: { cleared: {}, stars: {}, dispatch: { slots: 0, runs: [] } },
      petState: { pets: [] },
      trialState: { node: 0, consecutiveFails: 0, lastAttemptAt: 0, daoShangUntil: 0 },
      offline: {
        lastSeenAt: now,
        awayMs: 0,
        // 累计离线时长（主人 2026-09-19：顶栏显示"总共离线多久"，上次离线的明细移入浮层）
        totalAwayMs: 0,
        awayCount: 0,
        effPct: OFFLINE.effPct,
        capHours: OFFLINE.capHours,
        pending: { gainQi: 0, eventCount: 0, collected: false }
      },
      stats: { totalBreakthroughs: 0, totalFails: 0, totalTrials: 0, deaths: 0, eventCount: 0, offlineGainTotal: 0, rerolls: 0 },
      settings: {
        autoStrategy: 'balanced',
        paused: false,
        sound: true,
        bgm: false,             // 背景音乐（06-BGM 四曲循环；默认关，顶栏「乐」键开关）
        // 3.4 UI 动效与主题（归本模块所有的偏好叶子；老档靠 mergeDefaults 自动补，无迁移）
        skin: 'default',        // 皮肤：default 鎏金 | zhu 朱砂 | xuan 玄墨 | yue 月白 | auto 随世界
        motion: 'full',         // 动效总档：full 全开（默认，不受系统「减弱动态」约束）| auto 跟系统 | static 静态
        // 3.5 音效与音乐（归本模块所有的偏好叶子；总开关 sound 沿用 1.8a 的 settings.sound）
        volSfx: 'mid',          // 音效音量：low 低 | mid 中（参考增益 0.60）| high 高
        volBgm: 'mid',          // 音乐音量：low | mid（= 3.5 之前写死的 0.35，老档观感不变）| high
        avatar: 'male',         // 立绘化身（V2 立绘 UI）：male 男修·红黑金 | female 女修·月白水蓝
        autoLaunch: false,      // P4.2 开机自启（真源在档，主进程落到系统登录项；浏览器模式无效）
        alwaysOnTop: true,      // 窗口置顶
        clickThrough: false,    // 鼠标穿透（整窗不接收点击）
        lockPosition: false,    // 锁定位置（禁止拖拽移动窗口）
        // 3.3 氛围系统（归本模块所有的三个偏好叶子；'auto' 一律走自动口径）
        ambience: 'auto',       // 总档：auto 自动（跟系统减弱动态）| full 全开 | static 静态 | off 关闭
        weather: 'auto',        // 天气：auto 按游戏日轮换 | clear 晴 | rain 雨 | snow 雪 | rosy 霞
        dayPhase: 'auto'        // 昼夜：auto 跟现实时钟 | dawn 晨 | day 昼 | dusk 暮 | night 夜
      },
      log: []
    }
  }

  // ── 读 ──────────────────────────────────────────────────────────────────

  /**
   * 读档：文件真源 → localStorage 热备 → 环形备份逐格自愈 → 新档
   * @returns {Promise<object>} state
   */
  async load () {
    // ① 文件真源（Electron）
    if (this.bridge) {
      const res = await this.bridge.read()
      if (res && res.ok && res.data) {
        const parsed = this.parse(res.data)
        if (parsed) {
          this.lastSource = 'file'
          this._mirror(parsed)
          return parsed
        }
        console.warn('[存档] save.json 解析失败，改用热备')
      } else if (res && !res.ok) {
        console.warn('[存档] save.json 读取失败：', res.error)
      }
    }

    // ② 热备 / 浏览器模式
    const raw = this._readLocal()
    if (raw) {
      const parsed = this.parse(raw)
      if (parsed) {
        const fromLegacy = this.lastSource !== 'file' && !!this.bridge
        this.lastSource = 'localstorage'
        if (fromLegacy) {
          // 老版本（v0.1.0）只写 localStorage —— 首次升级时把它迁到真源文件
          console.log('[存档] 检测到 localStorage 老档，迁移到 save.json')
        }
        await this.save(parsed, 'migrate')
        return parsed
      }
    }

    // ③ 环形备份自愈（V3.5.2）：真源与热备都坏时，从最新格起逐格试；
    //    候选由主进程按 JSON 可解析性预筛，这里再做校验和/迁移级复核
    if (this.bridge && typeof this.bridge.restoreBackup === 'function') {
      try {
        const res = await this.bridge.restoreBackup()
        const candidates = (res && res.ok && res.candidates) || []
        for (const c of candidates) {
          const parsed = this.parse(c.data)
          if (parsed) {
            console.warn(`[存档] 已从环形备份 ${c.name} 恢复（真源与热备均不可用）`)
            this.lastSource = 'backup'
            await this.save(parsed, 'recover')
            return parsed
          }
        }
      } catch (err) {
        console.warn('[存档] 环形备份自愈失败：', err)
      }
    }

    // ④ 全新
    this.lastSource = 'default'
    return this.createDefaultState()
  }

  /** JSON 文本 → state（校验和 → 迁移 + 默认值补全）；失败/校验不符返回 null */
  parse (raw) {
    let obj = null
    try {
      obj = JSON.parse(raw)
    } catch (err) {
      console.warn('[存档] JSON 解析失败：', err.message)
      return null
    }
    if (!obj || typeof obj !== 'object') return null
    if (!this._verifyChecksum(obj)) {
      console.warn('[存档] 校验和不符（内容被改动或损坏），按坏档处理')
      return null
    }
    return this.mergeDefaults(this.migrate(obj), this.createDefaultState())
  }

  /** 校验和复核：带 checksum 的档必须逐位对上；老档（无 checksum 字段）放行 */
  _verifyChecksum (obj) {
    if (typeof obj.checksum !== 'string') return true
    const body = { ...obj }
    delete body.checksum
    return fnv1a(JSON.stringify(body)) === obj.checksum
  }

  /** 迁移链：逐级升级（当前仅 v1；结构未变时靠 mergeDefaults 补字段） */
  migrate (save) {
    let v = Number(save.schemaVersion) || 1
    while (v < SCHEMA_VERSION) {
      const fn = MIGRATIONS[v]
      if (typeof fn === 'function') save = fn(save)
      v += 1
      save.schemaVersion = v
    }
    save.schemaVersion = SCHEMA_VERSION
    return save
  }

  /** 用默认值补全缺失字段（老存档吃到新字段，避免 undefined 崩溃） */
  mergeDefaults (save, defaults) {
    if (save === null || save === undefined) return Array.isArray(defaults) ? [] : { ...defaults }
    if (typeof defaults !== 'object' || Array.isArray(defaults)) return save

    const out = { ...defaults }
    for (const key of Object.keys(save)) {
      const base = defaults[key]
      const val = save[key]
      if (val && typeof val === 'object' && !Array.isArray(val) && base && typeof base === 'object' && !Array.isArray(base)) {
        out[key] = this.mergeDefaults(val, base)
      } else {
        out[key] = val
      }
    }
    return out
  }

  // ── 写 ──────────────────────────────────────────────────────────────────

  serialize (state) {
    const out = { ...state }
    delete out.checksum
    out.schemaVersion = SCHEMA_VERSION
    out.savedAt = Date.now()
    // appVersion / gameVersion 记「最后写入的版本」（meta.createdAt 才是"建档时间"）；
    // 否则 v0.1.0 建的档会永远把 0.1.0 带下去，看日志时无法判断实际跑的是哪版
    out.meta = { ...(out.meta || {}), appVersion: APP_VERSION, gameVersion: APP_VERSION }
    if (Array.isArray(out.log) && out.log.length > LOG_MAX) out.log = out.log.slice(-LOG_MAX)
    // 校验和（V3.5.2）：对除自身外的整包算 FNV-1a，作为最后一个字段写入
    out.checksum = fnv1a(JSON.stringify(out))
    return JSON.stringify(out)
  }

  /**
   * 落盘：主进程文件（原子写 + .bak）+ localStorage 热备镜像
   * @param {object} state
   * @param {string} reason 'auto' | 'key' | 'quit' | 'migrate' …
   * @returns {Promise<{ok:boolean, via:string, error?:string, path?:string, bytes?:number}>}
   */
  async save (state, reason = 'auto') {
    const json = this.serialize(state)
    this._mirror(json)

    if (this.bridge) {
      try {
        const res = await this.bridge.write(json)
        if (res && res.ok) return { ok: true, via: 'file', path: res.path, bytes: res.bytes, reason }
        console.warn('[存档] 文件写入失败，已退至热备：', res && res.error)
        return { ok: false, via: 'localStorage', error: (res && res.error) || 'unknown', reason }
      } catch (err) {
        console.warn('[存档] 主进程写入异常：', err)
        return { ok: false, via: 'localStorage', error: String(err && err.message || err), reason }
      }
    }

    return { ok: hasLocalStorage, via: this.backend, error: hasLocalStorage ? undefined : 'no-storage', reason }
  }

  /** 同步写热备槽（退出前这种"最后一刻"用，避免异步来不及） */
  _mirror (data) {
    if (!hasLocalStorage) return
    const json = typeof data === 'string' ? data : this.serialize(data)
    try {
      const now = Date.now()
      if (now - this.lastBackupAt > BACKUP_INTERVAL_MS) {
        const prev = localStorage.getItem(this.key)
        if (prev) localStorage.setItem(this.backupKey, prev)
        this.lastBackupAt = now
      }
      localStorage.setItem(this.key, json)
    } catch (err) {
      console.warn('[存档] 热备写入失败：', err)
    }
  }

  _readLocal () {
    if (!hasLocalStorage) return null
    try {
      return localStorage.getItem(this.key)
    } catch (_) {
      return null
    }
  }

  /** 存档位置与备份状态（设置面板展示用） */
  async info () {
    if (this.bridge) {
      try { return await this.bridge.info() } catch (_) { /* 忽略 */ }
    }
    return { dir: '（浏览器 localStorage）', path: this.key, backupPath: this.backupKey, save: { exists: !!this._readLocal() }, backup: { exists: hasLocalStorage && !!localStorage.getItem(this.backupKey) } }
  }

  // ── 导入 / 导出（Electron 走原生对话框；浏览器分支由 UI 层处理）─────────

  /**
   * 像不像一份问长生存档：至少要有 schemaVersion 或 player.realm。
   * 只在"导入"时严格校验——避免用户选错文件被静默变成新档；
   * 读档（load）保持宽容，坏字段交由 mergeDefaults 兜底。
   */
  isSaveLike (obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
    if (typeof obj.schemaVersion === 'number') return true
    return !!(obj.player && obj.player.realm && typeof obj.player.realm.level === 'number')
  }

  async exportToFile (state) {
    if (!this.bridge) return { ok: false, error: 'no-bridge' }
    const res = await this.bridge.export(this.serialize(state))
    return res || { ok: false, error: 'unknown' }
  }

  async importFromFile () {
    if (!this.bridge) return { ok: false, error: 'no-bridge' }
    const res = await this.bridge.import()
    if (!res || !res.ok || !res.data) return res || { ok: false, error: 'unknown' }
    let probe = null
    try { probe = JSON.parse(res.data) } catch (_) { /* 下面统一报错 */ }
    if (!this.isSaveLike(probe)) return { ok: false, error: '这份文件不是问长生存档' }
    const state = this.parse(res.data)
    if (!state) return { ok: false, error: '存档内容已损坏，无法解析' }
    return { ok: true, state, path: res.path }
  }

  /** 从 save.bak 恢复（主进程会把当前档另存 .before-restore） */
  async restoreBackup () {
    if (!this.bridge) return { ok: false, error: '浏览器模式没有备份档功能' }
    const res = await this.bridge.restoreBackup()
    if (!res || !res.ok || !res.data) return res || { ok: false, error: 'unknown' }
    const state = this.parse(res.data)
    if (!state) return { ok: false, error: '备份档已损坏，无法解析' }
    return { ok: true, state, from: res.from }
  }

  /** 导入一段 JSON 文本（浏览器分支用 file input 读到的内容） */
  importFromText (text) {
    let probe = null
    try { probe = JSON.parse(text) } catch (_) { /* 下面统一报错 */ }
    if (!this.isSaveLike(probe)) return { ok: false, error: '这份文件不是问长生存档' }
    const state = this.parse(text)
    if (!state) return { ok: false, error: '存档内容已损坏，无法解析' }
    return { ok: true, state }
  }

  /** 清空存档（重置用） */
  clear () {
    if (!hasLocalStorage) return
    try {
      localStorage.removeItem(this.key)
      localStorage.removeItem(this.backupKey)
      localStorage.removeItem(this.key + '.broken')
    } catch (err) {
      console.warn('[存档] 清空失败：', err)
    }
  }

  // ── 离线结算 ────────────────────────────────────────────────────────────

  /** 进入离线：记录离开时间点（隐藏到托盘 / 退出前调用） */
  markOfflineStart (state, nowMs = Date.now()) {
    state.offline.lastSeenAt = nowMs
    state.offline.pending = { gainQi: 0, eventCount: 0, collected: false }
  }

  /**
   * 离开归来：按真实时间补发修为
   * @param {object} state
   * @param {number} nowMs
   * @param {number} effRate 当前有效产出（灵气/秒），由 CultivationSystem 提供
   * @returns {object} 结算报告（供「闭关归来」提示使用）
   */
  settleOffline (state, nowMs, effRate) {
    const off = state.offline
    const last = off.lastSeenAt || state.savedAt || nowMs
    const awayMs = nowMs - last
    off.lastSeenAt = nowMs

    // 时钟回拨：负偏移按 0 计，不给收益也不扣（数据模型 §十二）
    if (!(awayMs > 0)) {
      off.pending = { gainQi: 0, eventCount: 0, collected: false }
      return { ok: false, reason: 'clock-back', awayMs: 0, gainQi: 0 }
    }

    const awaySec = awayMs / 1000
    if (awaySec < OFFLINE.minAwaySec) {
      return { ok: false, reason: 'too-short', awayMs, gainQi: 0 }
    }

    const capMs = off.capHours * 3600 * 1000
    const cappedMs = Math.min(awayMs, capMs)
    const gainQi = effRate * (cappedMs / 1000) * off.effPct

    state.resources.qi += gainQi
    state.stats.offlineGainTotal = (state.stats.offlineGainTotal || 0) + gainQi
    off.awayMs = awayMs
    // 累计离线（主人 2026-09-19）：顶栏显示"总共离线多久"，明细留给交互浮层
    off.totalAwayMs = (off.totalAwayMs | 0) + awayMs
    off.awayCount = (off.awayCount | 0) + 1
    off.pending = { gainQi, eventCount: 0, collected: true }

    // 同长在线挂机本该拿到的收益（未打折、未受上限影响的对照值）
    const activeQi = effRate * awaySec

    return {
      ok: true,
      awayMs,
      awaySec,
      cappedMs,
      capped: awayMs > capMs,
      gainQi,
      activeQi,
      // 离线收益 ÷ 同时长挂机收益（超上限时会低于 effPct）
      vsActivePct: activeQi > 0 ? gainQi / activeQi : 0,
      effRate,
      effPct: off.effPct,
      capHours: off.capHours,
      totalAwayMs: off.totalAwayMs,
      awayCount: off.awayCount
    }
  }
}

export default SaveSystem
export { SAVE_KEY, SCHEMA_VERSION, APP_VERSION }
