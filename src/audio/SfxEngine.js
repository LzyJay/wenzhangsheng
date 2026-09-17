/**
 * SfxEngine.js —— 3.5 音效与音乐：程序化音效引擎（Web Audio）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / §13.1①）：
 *   · **本文件不做任何 DOM 查询**（不 getElementById、不查 class）—— 音频图与 DOM 无关；
 *   · 不读 state、不写 state；音量与开关由装配层（main.js）通过 setEnabled/setVolumes 传入；
 *   · 一切异常**降级为静默**（返回 false），绝不把错误抛进主循环 —— 声音坏掉不能影响挂机。
 * 为什么放在 audio/ 而不是 data/：它是"引擎"（有 AudioContext 生命周期），不是配置表；
 * 音色配方单点在 `src/data/sfx.js`（data 层禁 import 引擎，方向单向）。
 *
 * 设计要点：
 *   · AudioContext **懒建**：首次用户手势（pointerdown）里才 new + resume()，
 *     既满足浏览器/Electron 的自动播放策略，也避免为了"可能的音效"提前占一个音频线程；
 *   · 每个音效按需创建振荡器 / 噪声源，`start/stop` 后节点自动被 GC；**没有常驻节点**，
 *     唯一常驻的是打坐环境音（一路，且随挂机暂停 / 窗口隐藏 / 音效关闭淡出）；
 *   · 音量档变更只改 `GainNode.gain.value`，不重建音频图（切换零延迟、零爆音）。
 *
 * 存档：无 —— 引擎自身不碰存档；音量档在 settings.volSfx / settings.volBgm。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SFX_TABLE, AMBIENT, gainOfTier, DEFAULT_TIER } from '../data/sfx.js'

const MIN_GAIN = 0.0001        // exponentialRamp 不能到 0（Web Audio 规定）
const NOISE_SECONDS = 2        // 噪声缓冲长度（复用同一块白噪，避免每次合成）
const CLICK_THROTTLE_MS = 45   // 同一音效的最小触发间隔（防连点叠成一坨噪音）

export default class SfxEngine {
  /**
   * @param {{table?:object, ambient?:object, enabled?:boolean, sfxTier?:string, bgmTier?:string}} [opts]
   */
  constructor (opts = {}) {
    this.table = opts.table || SFX_TABLE
    this.ambientRecipe = opts.ambient || AMBIENT
    this.enabled = !!opts.enabled
    this.sfxTier = opts.sfxTier || DEFAULT_TIER
    this.bgmTier = opts.bgmTier || DEFAULT_TIER

    this._ctx = null
    this._master = null
    this._sfxBus = null
    this._ambientBus = null
    this._ambientGraph = null
    this._noiseBuf = null
    this._ambientOn = false                       // 挂机 / 窗口可见性"想要"环境音
    this._lastAt = new Map()                      // id → 上次触发时刻（秒）
    this._supported = typeof window !== 'undefined' &&
      !!(window.AudioContext || window.webkitAudioContext)
  }

  get supported () { return this._supported }

  /** 音频图是否已建且已 running（自测/CDP 用） */
  get ready () {
    return !!(this._ctx && this._ctx.state === 'running')
  }

  /** 诊断快照（调试出口用；纯读） */
  get status () {
    return {
      supported: this._supported,
      built: !!this._ctx,
      state: this._ctx ? this._ctx.state : 'none',
      enabled: this.enabled,
      sfxTier: this.sfxTier,
      bgmTier: this.bgmTier,
      ambient: !!(this._ambientOn && this.enabled)
    }
  }

  // ── 生命周期 ──────────────────────────────────────────────────────────────

  /**
   * 首次用户手势内调用：懒建 AudioContext 并 resume。
   * 幂等；不支持 Web Audio 或抛错时返回 false（静默降级）。
   */
  unlock () {
    if (!this._supported) return false
    try {
      if (!this._ctx) this._build()
      if (this._ctx.state !== 'running') this._ctx.resume().catch(() => {})
      this._applyAmbient(true)          // 建图前若已请求环境音，这里补上
      return true
    } catch (err) {
      console.warn('[音效] AudioContext 建立失败，已降级为静默：', err && err.message)
      this._supported = false
      return false
    }
  }

  /** 建音频图：master ← sfxBus / ambientBus */
  _build () {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    this._ctx = ctx

    const master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
    this._master = master

    const sfxBus = ctx.createGain()
    sfxBus.gain.value = gainOfTier('sfx', this.sfxTier)
    sfxBus.connect(master)
    this._sfxBus = sfxBus

    const ambientBus = ctx.createGain()
    ambientBus.gain.value = MIN_GAIN        // 常驻但默认静音，靠 setAmbient 淡入
    ambientBus.connect(master)
    this._ambientBus = ambientBus

    this._noiseBuf = this._makeNoiseBuffer(ctx)
  }

  /** 2 秒白噪声缓冲（雷声 / 雨声类共用一块，避免每次现算） */
  _makeNoiseBuffer (ctx) {
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** 窗口隐藏到托盘 / 系统休眠时省电（不销毁音频图，恢复更快） */
  suspend () {
    try { if (this._ctx && this._ctx.state === 'running') this._ctx.suspend().catch(() => {}) } catch (_) { /* 忽略 */ }
  }

  resume () {
    try { if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume().catch(() => {}) } catch (_) { /* 忽略 */ }
  }

  dispose () {
    try {
      if (this._ambientGraph) {
        for (const n of this._ambientGraph.stoppable) { try { n.stop() } catch (_) { /* 已停 */ } }
        this._ambientGraph = null
      }
      if (this._ctx) this._ctx.close().catch(() => {})
    } catch (_) { /* 忽略 */ }
    this._ctx = null
    this._lastAt.clear()
  }

  // ── 音量与开关 ───────────────────────────────────────────────────────────

  /**
   * 音效总开关（沿用 1.8a 的 settings.sound）。
   * 关闭时：后续 play 一律空转，环境音淡出（不硬切，避免"啪"）。
   */
  setEnabled (on) {
    const next = !!on
    if (next === this.enabled) return this.enabled
    this.enabled = next
    this._applyAmbient(false)
    return this.enabled
  }

  /**
   * 音量档（音效 / 音乐各一档；只改 GainNode，不重建图）。
   * ⚠ 音乐的档位只保存在此（真实音量由装配层设在 `<audio>` 元素上），
   *    因为音乐走的是 `<audio>` + 文件，不归 Web Audio。
   * @param {{sfx?:string, bgm?:string}} o
   */
  setVolumes ({ sfx, bgm } = {}) {
    if (sfx) this.sfxTier = sfx
    if (bgm) this.bgmTier = bgm
    try {
      if (this._sfxBus) this._sfxBus.gain.value = gainOfTier('sfx', this.sfxTier)
    } catch (_) { /* 忽略 */ }
    return { sfx: this.sfxTier, bgm: this.bgmTier }
  }

  /**
   * 打坐环境音启停（装配层按"挂机未暂停 + 窗口可见 + 音效开着"三点决定）。
   * @param {boolean} on
   */
  setAmbient (on) {
    this._ambientOn = !!on
    this._applyAmbient(false)
  }

  /** 把「想要环境音」× 「音效总开关」落到渐入/渐出上 */
  _applyAmbient (immediateStart) {
    if (!this._ctx || !this._ambientBus) return
    const want = this._ambientOn && this.enabled
    const r = this.ambientRecipe
    try {
      if (want) this._ensureAmbientGraph()
      const now = this._ctx.currentTime
      const g = this._ambientBus.gain
      const cur = Math.max(MIN_GAIN, g.value)
      g.cancelScheduledValues(now)
      g.setValueAtTime(cur, now)
      if (want) {
        const fade = immediateStart ? 0.05 : r.attackMs / 1000
        g.linearRampToValueAtTime(Math.max(MIN_GAIN, r.gain), now + fade)
      } else {
        g.linearRampToValueAtTime(MIN_GAIN, now + r.releaseMs / 1000)
      }
    } catch (_) { /* 忽略 */ }
  }

  /** 建常驻环境音图（一次）：双正弦微失谐 + 极慢 LFO 调幅 */
  _ensureAmbientGraph () {
    if (this._ambientGraph || !this._ctx) return
    const ctx = this._ctx
    const r = this.ambientRecipe
    const amp = ctx.createGain()                    // 被 LFO 调幅的"气息"层
    amp.gain.value = 1 - r.lfoDepth / 2
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = r.lfoHz
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = r.lfoDepth
    lfo.connect(lfoGain)
    lfoGain.connect(amp.gain)                       // 音频参数相加 → 调幅

    const stoppable = [lfo]
    for (const f of r.freq) {
      const osc = ctx.createOscillator()
      osc.type = r.wave
      osc.frequency.value = f
      osc.connect(amp)
      osc.start()
      stoppable.push(osc)
    }
    amp.connect(this._ambientBus)
    lfo.start()
    this._ambientGraph = { amp, lfo, lfoGain, stoppable }
  }

  // ── 播放 ─────────────────────────────────────────────────────────────────

  /**
   * 播一个音效。
   * @param {string} id SFX_TABLE 的键
   * @param {{gainScale?:number, throttleMs?:number}} [opts] gainScale 由调用方再压/抬（如按钮音压到 0.6）
   * @returns {boolean} 是否真的发出了声音（未 unlock / 关闭 / 节流中 / 不支持 → false，且**不抛错**）
   */
  play (id, { gainScale = 1, throttleMs = CLICK_THROTTLE_MS } = {}) {
    if (!this.enabled || !this._ctx || !this._sfxBus) return false
    const r = this.table[id]
    if (!r) return false
    try {
      const now = this._ctx.currentTime
      const last = this._lastAt.get(id)
      if (last != null && (now - last) * 1000 < throttleMs) return false
      this._lastAt.set(id, now)
      this._render(r, now, (Number(r.gain) || 0.2) * gainScale)
      return true
    } catch (err) {
      console.warn('[音效] 合成失败（已忽略）：', id, err && err.message)
      return false
    }
  }

  /** 按配方 kind 分派渲染 */
  _render (r, t0, peak) {
    switch (r.kind) {
      case 'arp': return this._renderArp(r, t0, peak)
      case 'thunder': return this._renderThunder(r, t0, peak)
      case 'bell': return this._renderBell(r, t0, peak)
      default: return this._renderTone(r, t0, peak)
    }
  }

  /**
   * 通用包络：起振 → 保持 → 指数收尾（返回总时长秒）。
   * 指数收尾是"自然衰减"的听感来源；线性收尾会像被掐断。
   */
  _envelope (t0, peak, { ms = 120, attackMs = 4, releaseMs = 80 } = {}) {
    const ctx = this._ctx
    const g = ctx.createGain()
    const attack = Math.max(0.002, attackMs / 1000)
    const release = Math.max(0.02, releaseMs / 1000)
    const total = Math.max(attack + release, ms / 1000)
    const sustainUntil = Math.max(attack, total - release)
    g.gain.setValueAtTime(MIN_GAIN, t0)
    g.gain.linearRampToValueAtTime(Math.max(MIN_GAIN, peak), t0 + attack)
    g.gain.setValueAtTime(Math.max(MIN_GAIN, peak), t0 + sustainUntil)
    g.gain.exponentialRampToValueAtTime(MIN_GAIN, t0 + total)
    return { node: g, total }
  }

  /** 单音：频率可带包络（freq:[起,止]），可选低通把方波/三角削柔 */
  _renderTone (r, t0, peak) {
    const ctx = this._ctx
    const [f0, f1] = Array.isArray(r.freq) ? r.freq : [r.freq || 440, r.freq || 440]
    const env = this._envelope(t0, peak, r)
    const osc = ctx.createOscillator()
    osc.type = r.wave || 'sine'
    osc.frequency.setValueAtTime(Math.max(20, f0), t0)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + env.total)
    let tail = osc
    if (r.lowpass) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = r.lowpass
      osc.connect(lp)
      tail = lp
    }
    tail.connect(env.node)
    env.node.connect(this._sfxBus)
    osc.start(t0)
    osc.stop(t0 + env.total + 0.02)
  }

  /**
   * 琶音：逐音递进，尾部重叠（每音自己一条包络，后一音起时前一音还在收尾）。
   * bell=true 时每个音再叠一个二倍频的钟声泛音（"清亮而不刺"的来源）。
   */
  _renderArp (r, t0, peak) {
    const ctx = this._ctx
    const notes = Array.isArray(r.notes) && r.notes.length ? r.notes : [440]
    const step = Math.max(0.03, (r.stepMs || 90) / 1000)
    const perMs = Math.max(120, (r.stepMs || 90) * 2)
    notes.forEach((f, i) => {
      const at = t0 + i * step
      const lastOne = i === notes.length - 1
      const env = this._envelope(at, peak * (lastOne ? 1 : 0.85), {
        ms: lastOne ? (r.ms || 400) : perMs,
        attackMs: r.attackMs || 5,
        releaseMs: lastOne ? (r.releaseMs || 200) : perMs * 0.75
      })
      env.node.connect(this._sfxBus)
      const osc = ctx.createOscillator()
      osc.type = r.wave || 'sine'
      osc.frequency.value = f
      osc.connect(env.node)
      osc.start(at)
      osc.stop(at + env.total + 0.02)
      if (r.bell) {
        const b = this._envelope(at, peak * 0.34, { ms: perMs * 1.6, attackMs: 2, releaseMs: perMs * 1.3 })
        b.node.connect(this._sfxBus)
        const bo = ctx.createOscillator()
        bo.type = 'sine'
        bo.frequency.value = f * 2
        bo.connect(b.node)
        bo.start(at)
        bo.stop(at + b.total + 0.02)
      }
    })
  }

  /**
   * 雷声：三样东西叠出来的 ——
   *   ① 炸裂（短促宽带噪声 + 高通，只有 60ms）；
   *   ② 主体（噪声过 420Hz 低通，1.5s 长衰减 —— "滚滚"）；
   *   ③ 轰鸣（44Hz 低频正弦缓慢下坠 —— 胸口那一下）。
   * 与 3.2 的三道雷光同拍（装配层在 'cult:tribulation' 上播放，劈落即响）。
   */
  _renderThunder (r, t0, peak) {
    const ctx = this._ctx
    const ms = r.ms || 1400

    // ① 炸裂
    const crack = ctx.createBufferSource()
    crack.buffer = this._noiseBuf
    const crackHp = ctx.createBiquadFilter()
    crackHp.type = 'highpass'
    crackHp.frequency.value = 1600
    const crackEnv = this._envelope(t0, peak * (r.crackGain || 0.5), { ms: 90, attackMs: 1, releaseMs: 80 })
    crack.connect(crackHp)
    crackHp.connect(crackEnv.node)
    crackEnv.node.connect(this._sfxBus)
    crack.start(t0)
    crack.stop(t0 + 0.12)

    // ② 主体
    const body = ctx.createBufferSource()
    body.buffer = this._noiseBuf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = r.lowpass || 420
    const bodyEnv = this._envelope(t0, peak, { ms, attackMs: r.attackMs || 2, releaseMs: r.releaseMs || 900 })
    body.connect(lp)
    lp.connect(bodyEnv.node)
    bodyEnv.node.connect(this._sfxBus)
    body.start(t0)
    body.stop(t0 + bodyEnv.total + 0.05)

    // ③ 轰鸣
    const rumble = this._envelope(t0, peak * 0.7, { ms: ms * 0.9, attackMs: 8, releaseMs: ms * 0.7 })
    rumble.node.connect(this._sfxBus)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(Math.max(20, r.rumbleHz || 44), t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, (r.rumbleHz || 44) * 0.6), t0 + rumble.total)
    osc.connect(rumble.node)
    osc.start(t0)
    osc.stop(t0 + rumble.total + 0.05)
  }

  /** 钟 + 鼓（秘境结算）：先一记闷鼓，再一声钟，钟带二倍频泛音 */
  _renderBell (r, t0, peak) {
    const ctx = this._ctx
    const ms = r.ms || 600

    const drum = this._envelope(t0, peak * 0.8, { ms: 180, attackMs: 2, releaseMs: 160 })
    drum.node.connect(this._sfxBus)
    const dOsc = ctx.createOscillator()
    dOsc.type = 'sine'
    dOsc.frequency.setValueAtTime(Math.max(20, r.drumHz || 120), t0)
    dOsc.frequency.exponentialRampToValueAtTime(Math.max(20, (r.drumHz || 120) * 0.42), t0 + 0.18)
    dOsc.connect(drum.node)
    dOsc.start(t0)
    dOsc.stop(t0 + 0.24)

    const bellHz = r.bellHz || 988
    const bell = this._envelope(t0 + 0.06, peak, { ms, attackMs: 3, releaseMs: r.releaseMs || 380 })
    bell.node.connect(this._sfxBus)
    for (const [mul, gain] of [[1, 1], [2.01, 0.3], [3.02, 0.12]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = bellHz * mul
      const g = ctx.createGain()
      g.gain.value = gain
      o.connect(g)
      g.connect(bell.node)
      o.start(t0 + 0.06)
      o.stop(t0 + 0.06 + bell.total + 0.05)
    }
  }
}
