/**
 * MainScene.js —— 主界面视觉层（Phaser 场景层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界：本场景**只做视觉演出**，绝不修改游戏状态、不做任何数值判定。
 *       状态与结算由 src/systems/* 负责，本场景只"听事件 + 播动画"。
 *
 * 几何口径：全部对齐 design/V2 问长生-立绘UI设计.html（V2.3 落地规格，420×320 基准）
 *   · 立绘：参考图整图贴用（assets/portrait_male.jpg / portrait_female.jpg，356×760），
 *     显示高目标 = 196/320 窗高，以装配层同步的中部可用区为硬上限（全身入画·不遮头）
 *   · 呼吸轴心：立绘丹田（贴图高 300/640 ≈ 47%），呼吸 3.6s（scale 1.012/0.994 + 上浮 1.2px）
 *   · 光晕：直径 = min(w,h) × 210/320，中心跟随立绘胸部
 *   · 飘字基线：窗口高度 35.6%（原型 114px @ 320）；副行 +26px
 *   · 爆发中心：窗口 38% 高度处（原型 cx=210 cy=122）
 *   · 光晕 2.4s（缩放 +9%）｜飘字 1.5s 上浮 42px
 *
 * 事件契约（均由 src/main.js 通过 this.game.events 发出）：
 *   'cult:float'   { text, kind, sub }  → 飘字（kind: ok | fail | offline | life | info；sub=true 为副行）
 *   'cult:burst'   { kind, success?, title? } → 气场爆发（breakthrough | trial | offline）
 *                   3.2：kind=breakthrough 时 success=true 触发完整突破演出
 *                   （灵气漩涡 → 顿帧 → 大字浮现）；失败/offline 等仍走轻反馈
 *   'cult:tribulation' { success, strikes, title? } → 三道天雷逐道劈落的完整演出
 *                   （含落点爆光与震屏）；3.2：成功收势叠「霞光 + 大字」，失败叠「焦黑」
 *   'root:spin'    { durationMs }       → 测灵根：四色光轮开始旋转
 *   'root:reveal'  { displayName, color, rarity, tag, trait } → 测灵根：落定揭晓
 *   'root:aura'    { color }            → 按灵根颜色给光晕上色（null = 恢复默认金）
 *   'realm:look'   { getRealmLook() 视图 } → 3.1 角色表现：境界圆光 / 服饰色 / 呼吸节律
 *                   （装配层按 state.player.realm.level 变化时下发；场景自己也会在
 *                     create 时经 window.__wcs 读一次初值，两处口径同源 appearance.js）
 *   'ambience:set' { ambienceView() 视图 } → 3.3 氛围系统：昼夜色调 / 灵气粒子流 / 轻天气
 *                   （装配层每秒复算一次，视图指纹变化才下发；场景只按视图换色与开关粒子。
 *                     低性能自动降载由**本场景**采样帧率决定，结果写进
 *                     game.registry['ambienceLoad']，装配层读取后用于设置面板展示）
 *   'skin:set'     { id, name, accent, palette:{hue,sat}, slots } → 3.4 UI 动效与主题：
 *                   皮肤（装配层 resolveSkin() 结果）。只重染「主序色」相关的几处 tint
 *                   （光晕默认色 / 常态灵气粒子 / 爆发粒子）＋换蒲团贴图＋按皮肤主色相
 *                   重铸境界圆光与法袍；灵根色、劫红、灵玉等**语义色不随皮肤漂移**。
 *                   装配层在下发后由场景回报 game.registry['skinKey']，避免每秒重发。
 *
 * 3.1 角色表现层次（自后向前）：洞府暗部 → 石壁剪影 / 地面 → 蒲团 → 灵根光晕
 *   → 境界圆光 → 立绘（法袍下摆按境界色微染）→ 常态灵气 / 吐纳汇聚光点
 * 3.3 氛围层次（不插进上面这条链，独立前后各一层）：
 *   后层色调（-9，最底）< 霞光带（-4.8）< … 3.1 全部层次 … < 灵气粒子流（1）
 *   < 雨雪（6）< 飘字（10）< 大字（20）< 前层色调（30，按 0.34 比例再叠一次环境色）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getRealmLook, SCENE_LOOK } from '../data/appearance.js'
import { BREAKTHROUGH_FX, TRIBULATION_FX } from '../data/fx.js'   // 3.2 演出参数
import { AMBIENCE, stepLoad, viewKey } from '../data/ambience.js'  // 3.3 氛围参数
import { cushionTexKey } from '../data/themes.js'                   // 3.4 皮肤（蒲团贴图 key）

// ── 设计稿基准（勿随意改；改前对照 design/V2 问长生-立绘UI设计.html 落地规格）──
const REF_MIN = 320              // 参考窗口短边
// V2.3 立绘：参考图整图贴用（贴图 356×760，设计画框 300:640）
const TEX_MALE = 'portrait_male'
const TEX_FEMALE = 'portrait_female'
const PORTRAIT_H_RATIO = 196 / 320   // 立绘目标显示高占窗高（196px @ 420×320 基准；以中部可用区为硬上限）
const PIVOT_RATIO_Y = 300 / 640      // 呼吸轴心（设计稿丹田 300/640 ≈ 46.9%）
const AURA_REF = 210             // 光晕直径 @ 320 短边
const AURA_TEX = 128             // 光晕贴图原始边长
const FLOAT_Y_RATIO = 0.356      // 飘字基线（114 / 320）
const FLOAT_SUB_OFFSET = 26      // 副行下移
const BURST_Y_RATIO = 0.38       // 爆发中心
const DEFAULT_AURA_TINT = 0xe8b96a

const REDUCED_MOTION = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

export default class MainScene extends Phaser.Scene {
  constructor () {
    super('MainScene')
  }

  create () {
    this.figure = null
    this.figureInner = null
    this.aura = null
    this.auraWrap = null
    this.ambient = null
    this.burst = null
    this.rootWheel = null
    this.scaleFactor = 1
    this._lastAuraColor = null
    // 3.1 角色表现：境界圆光 / 蒲团 / 洞府背景 / 法袍染色 / 吐纳节律
    this.realmRing = null
    this.cushion = null
    this.caveShade = null
    this.caveG = null
    this.robe = null
    this._robeMask = null
    this._robeMaskG = null
    this.breathTween = null
    this.inhaleTimer = null
    this.scorchLayer = null   // 3.2 渡劫失败的焦黑蒙层（随用随建随销）
    // 3.3 氛围系统：昼夜色层 / 灵气粒子流 / 天气粒子 / 霞光带 / 低性能自动降载
    this.toneBack = null
    this.toneFront = null
    this.qiFlow = null
    this.rainFx = null
    this.snowFx = null
    this.rosyBands = []
    this._ambView = null
    this._rosyOn = false
    this._loadState = { level: 0, lowMs: 0, highMs: 0 }
    this._loadAcc = 0
    this.realmLook = getRealmLook(1)
    // 3.4 UI 动效与主题：当前皮肤（装配层经 'skin:set' 下发；null = 还没下发，按默认鎏金画）
    this.skin = null
    this.skinTint = { gold: DEFAULT_AURA_TINT, goldLight: 0xffe3a8 }
    // 中部可用区（装配层经 'layout:mid' 同步；给个兜底值防首帧未同步）
    this.midTop = 0.25 * (this.scale.gameSize.height || 320)
    this.midBottom = 0.575 * (this.scale.gameSize.height || 320)

    this._buildBackdrop()
    this._buildCushion()
    this._buildAura()
    this._buildRealmRing()
    this._buildFigure()
    this._buildParticles()
    this._buildAmbience()

    // 初值：直接读装配层的当前境界（与 'avatar:set' 同款"场景自读初值"先例），
    // 之后境界变化由 main.js 经 'realm:look' 下发
    const savedLevel = (typeof window !== 'undefined' && window.__wcs && window.__wcs.state)
      ? window.__wcs.state.player.realm.level
      : 1
    this.applyRealmLook(getRealmLook(savedLevel))

    this._layout(this.scale.gameSize)

    this.scale.on('resize', this._layout, this)

    // ── 事件订阅（只读，不改状态）────────────────────────────────────────
    const bus = this.game.events
    this._onFloat = (payload) => this.spawnFloat(payload)
    this._onBurst = (payload) => this.playBurst(payload)
    bus.on('cult:float', this._onFloat)
    bus.on('cult:burst', this._onBurst)
    bus.on('cult:tribulation', (p) => this.playTribulation(p || {}))
    bus.on('root:spin', (p) => this.playRootSpin(p || {}))
    bus.on('root:reveal', (p) => this.playRootReveal(p || {}))
    bus.on('root:aura', (p) => this.setAuraColor(p && p.color))
    bus.on('avatar:set', (p) => this.setAvatar(p && p.avatar === 'female' ? TEX_FEMALE : TEX_MALE))
    bus.on('layout:mid', (p) => this.setMidArea(p || {}))
    bus.on('realm:look', (p) => { if (p && p.ring) this.applyRealmLook(p) })
    // 3.4 UI 动效与主题：皮肤下发（换蒲团贴图 + 重铸主序色）
    bus.on('skin:set', (p) => { if (p && p.slots) this.applySkin(p) })
    // 3.3 氛围系统：装配层算好的视图（昼夜/天气/负载档）在这里落地
    this._onAmbience = (p) => this.applyAmbience(p || {})
    bus.on('ambience:set', this._onAmbience)
    // 负载档的初值：装配层（设置面板）随时可读，不必等第一次采样
    this.game.registry.set('ambienceLoad', 0)

    this.events.once('shutdown', () => {
      bus.off('cult:float', this._onFloat)
      bus.off('cult:burst', this._onBurst)
      bus.off('ambience:set', this._onAmbience)
      this.scale.off('resize', this._layout, this)
      if (this.inhaleTimer) this.inhaleTimer.remove()
    })
  }

  // ── 构建 ────────────────────────────────────────────────────────────────

  /**
   * 洞府背景层次（3.1）：洞府暗部 + 石壁剪影 + 地面，全部程序化、半透明，
   * 让立绘"坐在洞里"而不是浮在桌面上。窗口本体贴桌面，暗部必须收敛克制。
   */
  _buildBackdrop () {
    // 洞府暗部：白色柔光贴图染成近黑的暖褐，NORMAL 叠出一团洞窟幽暗
    this.caveShade = this.add.image(0, 0, 'tex_glow_white')
      .setTint(0x151009)
      .setAlpha(SCENE_LOOK.cave.shadeAlpha)
      .setDepth(-6)

    // 石壁剪影 + 地面：graphics，窗口尺寸变化时整体重画
    this.caveG = this.add.graphics().setDepth(-5)

    // 地面暗影：脚下一片扁椭圆暗层（先于蒲团）
    this.floorShadow = this.add.image(0, 0, 'tex_glow_white')
      .setTint(0x0d0a07)
      .setAlpha(SCENE_LOOK.cave.floorAlpha)
      .setDepth(-4)
  }

  /** 蒲团（3.1；3.4 起随皮肤换贴图）：脚下地台，直接用带成色的 tex_cushion（尺寸交给布局层） */
  _buildCushion () {
    this.cushion = this.add.image(0, 0, cushionTexKey(this.skin && this.skin.id))
      .setAlpha(SCENE_LOOK.cushion.alpha)
      .setDepth(-3)
  }

  /** 身后光晕（白色程序化贴图 + 染色；外包一层容器，缩放交给布局层） */
  _buildAura () {
    this.aura = this.add.image(0, 0, 'tex_glow_white')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.skinTint.gold)

    this.auraWrap = this.add.container(0, 0, [this.aura])

    if (REDUCED_MOTION) {
      this.aura.setAlpha(0.42)
      return
    }
    // 原型：2.4s 呼吸，透明度 0.62→1、缩放 +9%
    this.tweens.add({
      targets: this.aura,
      alpha: { from: 0.34, to: 0.56 },
      scale: { from: 1, to: 1.09 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  /** 境界圆光（3.1）：脑后背光圆环，白环贴图按境界色染色，尺寸/透明度随境界递进 */
  _buildRealmRing () {
    this.realmRing = this.add.image(0, 0, 'tex_ring')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-2)
  }

  /**
   * 立绘化身（V2.3 设计稿：参考图整图贴用，矢量小人整套退役）
   * 贴图 origin = 呼吸轴心（丹田 47%），容器缩放 = 显示高 / 贴图原生高。
   * 3.1 增补：法袍染色层 —— 同贴图再贴一张，按境界色低透明度 ADD 叠色
   * （JPG 自带暗底几乎不吃色 → 视觉上只有袍子被"镀"上境界色），
   * 用矩形几何遮罩把染色限制在腰际以下，遮罩矩形由布局层按窗口坐标重画。
   */
  _buildFigure () {
    const saved = (typeof window !== 'undefined' && window.__wcs && window.__wcs.state)
      ? window.__wcs.state.settings.avatar
      : 'male'
    this.avatarKey = saved === 'female' ? TEX_FEMALE : TEX_MALE

    // 立绘本体：origin 直接钉在丹田轴心，容器位移/缩放即全部几何
    this.portrait = this.add.image(0, 0, this.avatarKey)
      .setOrigin(0.5, PIVOT_RATIO_Y)

    // 法袍染色层（3.1）：与立绘同位同源，先白板出图（染色与透明度由 applyRealmLook 定）
    this.robe = this.add.image(0, 0, this.avatarKey)
      .setOrigin(0.5, PIVOT_RATIO_Y)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
    this._robeMaskG = this.make.graphics({ add: false })
    this._robeMask = this._robeMaskG.createGeometryMask()
    this.robe.setMask(this._robeMask)

    // 闪电照亮人脸：独立闪光层（人脸约在轴心上方 38% 贴图高处）
    this.flash = this.add.image(0, -290, 'tex_glow_white')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff0c8)
      .setAlpha(0)
      .setScale(0.5)

    // 内层容器承担呼吸缩放（轴心即容器原点）
    this.figureInner = this.add.container(0, 0, [this.portrait, this.robe])
    this.figure = this.add.container(0, 0, [this.flash, this.figureInner])
  }

  /**
   * 应用境界外观（3.1）：圆光色/透明度、法袍染色、呼吸节律、灵气密度、吐纳节律。
   * @param {{ring:string, robe:string, breathMs:number, ringAlpha:number, ambientMs:number}} look
   */
  applyRealmLook (look) {
    if (!look || !look.ring) return
    this.realmLook = look
    const tint = this._hex(look.ring)
    this.realmRing.setTint(tint)
    if (this.qiFlow) this.qiFlow.setParticleTint(tint)   // 3.3：灵气流的成色随境界圆光同源
    this.robe.setTint(this._hex(look.robe))
    this.robe.setAlpha(SCENE_LOOK.robe.alpha)   // 染色强度单点在 data（ADD 叠色，暗底不吃色）
    this._layout(this.scale.gameSize)
    this._applyBreath(look.breathMs)
  }

  /** 呼吸节律（3.1 吐纳升级）：按境界呼吸周期重建呼吸补间 + 吐纳汇聚节律 */
  _applyBreath (breathMs) {
    // 呼吸补间：境界越高周期越长（3.6s → 5.0s），起伏幅度微增（越修越沉）
    const deep = (this.realmLook.realmIdx || 0) * 0.0006
    if (this.breathTween) this.breathTween.remove()
    if (REDUCED_MOTION) {
      this.figureInner.setScale(1)
      this.figureInner.y = 0
      this.breathTween = null
    } else {
      this.tweens.killTweensOf(this.figureInner)
      this.breathTween = this.tweens.add({
        targets: this.figureInner,
        scaleX: 1.012 + deep,
        scaleY: 0.994 - deep,
        y: -1.2,
        duration: breathMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }

    // 常态灵气密度：境界越高灵气愈浓
    if (this.ambient) this.ambient.frequency = REDUCED_MOTION ? -1 : this.realmLook.ambientMs

    // 吐纳节律：每个呼吸周期，一圈灵气光点自四周向丹田汇聚（吸气）
    if (this.inhaleTimer) this.inhaleTimer.remove()
    this.inhaleTimer = null
    if (!REDUCED_MOTION && SCENE_LOOK.inhale.perBreath > 0) {
      this.inhaleTimer = this.time.addEvent({
        delay: breathMs,
        loop: true,
        callback: () => this._spawnInhale()
      })
    }
  }

  /** 吐纳（吸气）演出：数点灵气自圆光外缘飞向丹田，随呼吸周期往复 */
  _spawnInhale () {
    const n = SCENE_LOOK.inhale.perBreath
    const cx = this.figure.x
    const cy = this.figure.y
    const ringR = this.figure.getData('dispH') * SCENE_LOOK.ring.sizeRatio * this.realmLook.ringScale / 2
    const fromR = ringR * SCENE_LOOK.inhale.fromRatio
    const travel = this.realmLook.breathMs * SCENE_LOOK.inhale.travelPct

    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const sx = cx + Math.cos(ang) * fromR
      const sy = cy + Math.sin(ang) * fromR * 0.8
      const spark = this.add.image(sx, sy, 'tex_spark')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(this._hex(this.realmLook.ring))
        .setAlpha(0)
        .setScale(0.5)
        .setDepth(1)
      this.tweens.add({
        targets: spark,
        x: cx,
        y: cy,
        alpha: { from: 0, to: 0.85 },
        scale: { from: 0.5, to: 0.18 },
        delay: i * (travel / n) * 0.6,
        duration: travel,
        ease: 'Sine.easeIn',
        onComplete: () => spark.destroy()
      })
    }
  }

  /** 切换化身（男修 / 女修）；贴图同规格，切换后按当前窗重排一次即可 */
  setAvatar (key) {
    if (!this.portrait || !this.textures.exists(key)) return
    this.avatarKey = key
    this.portrait.setTexture(key)
    if (this.robe) this.robe.setTexture(key)   // 3.1：法袍染色层与立绘同源换图
    this._layout(this.scale.gameSize)
  }

  /** 灵气粒子：常态上升的微光 + 手动爆发的星芒 */
  _buildParticles () {
    this.ambient = this.add.particles(0, 0, 'tex_spark', {
      x: { min: -30, max: 30 },
      y: { min: -20, max: 30 },
      lifespan: { min: 2000, max: 3200 },
      speedX: { min: -8, max: 8 },
      speedY: { min: -36, max: -14 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      frequency: REDUCED_MOTION ? -1 : 360,
      blendMode: 'ADD',
      tint: this.skinTint.gold
    })

    this.burst = this.add.particles(0, 0, 'tex_spark', {
      x: 0,
      y: 0,
      lifespan: { min: 500, max: 1100 },
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: -30,
      blendMode: 'ADD',
      tint: this.skinTint.goldLight,
      emitting: false
    })
  }

  // ── 3.3 氛围系统：昼夜色调 / 灵气粒子流 / 轻天气 ────────────────────────
  // 参数单点在 src/data/ambience.js；本段只"按视图换色 + 开关粒子"，不改任何状态。

  /**
   * 构建氛围层（初始全部不发射/不上色，等 'ambience:set' 下发视图后落地）：
   *   · 昼夜色调：前后两层 1×1 色块（后层垫在最底，前层叠在全部演出之上）
   *   · 灵气粒子流：横穿身周的灵气微光（境界色，与 3.1 常态上升粒子分工不同）
   *   · 天气：雨（细丝斜落）/ 雪（慢飘）/ 霞（天边暖光带，缓缓漂移）
   * 发射区用**可变矩形**（Geom.Rectangle）：窗口缩放时只改矩形尺寸，不重建发射器。
   */
  _buildAmbience () {
    // 昼夜色层：tex_pixel 拉伸铺满 → 均匀环境色（tex_glow_white 是径向衰减，会四角发虚）
    this.toneBack = this.add.image(0, 0, 'tex_pixel').setOrigin(0).setDepth(-9).setAlpha(0)
    this.toneFront = this.add.image(0, 0, 'tex_pixel').setOrigin(0).setDepth(30).setAlpha(0)

    const q = AMBIENCE.qiFlow
    this._qiZone = new Phaser.Geom.Rectangle(-60, -60, 120, 120)   // 局部坐标，随布局 setTo
    this.qiFlow = this.add.particles(0, 0, 'tex_spark', {
      emitZone: { type: 'random', source: this._qiZone },
      speedX: { min: q.speedX.min, max: q.speedX.max },
      speedY: { min: -6, max: 6 },
      lifespan: { min: q.lifespanMs.min, max: q.lifespanMs.max },
      scale: { start: q.scale.start, end: q.scale.end },
      alpha: { start: q.alpha.start, end: q.alpha.end },
      quantity: 1,
      frequency: -1,
      blendMode: 'ADD',
      tint: this.skinTint.gold
    }).setDepth(1)

    // 雨 / 雪共用一条"窗口上沿"发射带（同为可变矩形）
    this._wxZone = new Phaser.Geom.Rectangle(-20, -26, 460, 26)
    // 出画兜底：窗口下沿外的一条"死亡区" —— 落到这里的雨雪立即回收，不在窗外做无用功
    this._deadZone = new Phaser.Geom.Rectangle(-80, 740, 600, 80)
    const r = AMBIENCE.rain
    this.rainFx = this.add.particles(0, 0, 'tex_rain', {
      emitZone: { type: 'random', source: this._wxZone },
      deathZone: { type: 'onEnter', source: this._deadZone },
      speedY: { min: r.speedY.min, max: r.speedY.max },
      speedX: { min: r.speedX.min, max: r.speedX.max },
      lifespan: { min: r.lifespanMs.min, max: r.lifespanMs.max },
      scale: { start: r.scale.start, end: r.scale.end },
      alpha: { start: r.alpha.start, end: r.alpha.end },
      quantity: 1,
      frequency: -1,
      tint: this._hex(r.tint)
    }).setDepth(6).setAlpha(0).setVisible(false)

    const s = AMBIENCE.snow
    this.snowFx = this.add.particles(0, 0, 'tex_spark_white', {
      emitZone: { type: 'random', source: this._wxZone },
      deathZone: { type: 'onEnter', source: this._deadZone },
      speedY: { min: s.speedY.min, max: s.speedY.max },
      speedX: { min: s.speedX.min, max: s.speedX.max },
      lifespan: { min: s.lifespanMs.min, max: s.lifespanMs.max },
      scale: { start: s.scale.start, end: s.scale.end },
      alpha: { start: s.alpha.start, end: s.alpha.end },
      quantity: 1,
      frequency: -1,
      blendMode: 'ADD',
      tint: this._hex(s.tint)
    }).setDepth(6).setAlpha(0).setVisible(false)

    // 霞：几条暖光带贴在天边（静态层，天边才有的霞不参与粒子）
    this.rosyBands = []
    for (let i = 0; i < AMBIENCE.rosy.count; i++) {
      this.rosyBands.push(
        this.add.image(0, 0, 'tex_glow_white')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(this._hex(AMBIENCE.rosy.tint))
          .setDepth(-4.8)
          .setAlpha(0)
      )
    }
  }

  /**
   * 应用氛围视图（3.3）：装配层每秒复算、指纹变化才下发，所以这里可以"整份重设"。
   * 色调走补间过渡（避免相位/设置切换时跳色）；天气/粒子按 mode 与负载档开关。
   * @param {object} view ambienceView() 的返回值
   */
  applyAmbience (view) {
    if (!view || !view.tone) return
    this._ambView = view
    // 回执：把已落地的视图指纹写进 registry，装配层据此确认"这一版到了没"
    // （启动时事件可能早于本场景 create，丢了也不会卡死 —— 装配层每秒复算并补发）
    this.game.registry.set('ambienceKey', viewKey(view))
    const ms = AMBIENCE.toneMs

    this.tweens.killTweensOf(this.toneBack)
    this.tweens.killTweensOf(this.toneFront)
    const alphaBack = view.mode === 'off' ? 0 : view.tone.alpha
    this.toneBack.setTint(this._hex(view.tone.tint))
    this.toneFront.setTint(this._hex(view.tone.tint))
    this.tweens.add({ targets: this.toneBack, alpha: alphaBack, duration: ms, ease: 'Sine.easeInOut' })
    this.tweens.add({
      targets: this.toneFront,
      alpha: alphaBack * AMBIENCE.toneFrontRatio,
      duration: ms,
      ease: 'Sine.easeInOut'
    })

    // 霞光带（非粒子）：仅 全开 + 天气=霞 时显出，并缓缓漂移
    this._rosyOn = view.mode === 'full' && view.weatherFx.active && view.weather.id === 'rosy'
    for (const band of this.rosyBands) {
      this.tweens.killTweensOf(band)
      this.tweens.add({
        targets: band,
        alpha: this._rosyOn ? AMBIENCE.rosy.alpha : 0,
        duration: AMBIENCE.weather.changeMs,
        ease: 'Sine.easeInOut'
      })
    }
    this._applyAmbienceLoad()
  }

  /**
   * 按「当前视图 + 负载档」重配发射器（天气切换与低性能降载共用这条路径）：
   * 频率 -1 = 不再出点（已在场的粒子自然落完，不硬切）；淡入淡出由 alpha 补间负责。
   */
  _applyAmbienceLoad () {
    const v = this._ambView
    const full = !!v && v.mode === 'full'
    const qiOn = full && v.qi.active
    const rainOn = full && v.weatherFx.active && v.weather.id === 'rain'
    const snowOn = full && v.weatherFx.active && v.weather.id === 'snow'
    const ms = AMBIENCE.weather.changeMs

    if (this.qiFlow) this.qiFlow.frequency = qiOn ? v.qi.intervalMs : -1

    const setup = (fx, on) => {
      if (!fx) return
      fx.frequency = on ? v.weatherFx.intervalMs : -1
      if (on) fx.setVisible(true)
      this.tweens.killTweensOf(fx)
      this.tweens.add({
        targets: fx,
        alpha: on ? 1 : 0,
        duration: ms,
        ease: 'Sine.easeInOut',
        onComplete: () => { if (!on) fx.setVisible(false) }
      })
    }
    setup(this.rainFx, rainOn)
    setup(this.snowFx, snowOn)
  }

  /**
   * 霞光带的缓缓漂移：**不用补间**，直接在 update 里用正弦驱动位移。
   * 为什么不用补间：Phaser 的 `killTweensOf(target, property)` **忽略第二个参数**
   * （源码只按 target 匹配），一个 target 上的漂移补间会把同 target 的
   * alpha 补间一起杀掉 —— 表现为"霞永远显不出来"。正弦驱动没有这个问题，
   * 也省掉了"窗口缩放要重启补间"的麻烦（缩放只改基准位 baseX）。
   */
  _driftRosy (time) {
    const width = this.scale.gameSize.width
    const amp = width * 0.06
    this.rosyBands.forEach((band, i) => {
      const base = band.getData('baseX') || 0
      const period = AMBIENCE.rosy.driftMs * (0.8 + i * 0.15)
      band.x = base + Math.sin((time / period) * Math.PI * 2) * amp * (i % 2 === 0 ? 1 : -1)
    })
  }

  /**
   * 低性能模式自动降载（3.3）：每秒采一次实测帧率，带滞回地升降负载档
   * （连续低于 lowFps 达 downMs 才降；连续高于 highFps 达 upMs 才升回）。
   * 结果写进 game.registry['ambienceLoad'] —— 装配层（设置面板）读它显示，场景不碰 DOM。
   */
  update (time, delta) {
    // 霞光带缓缓漂移（只在霞显出时跑；正弦驱动，见 _driftRosy 的说明）
    if (this._rosyOn) this._driftRosy(time)

    // 窗口被遮挡 / 最小化 / 切到托盘时，Chromium 会节流 rAF：此处的低帧率
    // 不代表"性能不足"，计进去就会"明明不卡却降载"。可见性用 Phaser 自己的
    // game.isVisible（由页面的 visibilitychange 驱动），场景层不必碰 DOM。
    if (this.game.isVisible === false) { this._loadAcc = 0; return }

    this._loadAcc += (delta || 0)
    if (this._loadAcc < 1000) return
    const dtMs = this._loadAcc
    this._loadAcc = 0
    const fps = (this.game && this.game.loop) ? this.game.loop.actualFps : 0
    const next = stepLoad(fps, this._loadState, dtMs)
    const changed = next.level !== this._loadState.level
    this._loadState = next
    if (changed) {
      this._applyAmbienceLoad()
      this.game.registry.set('ambienceLoad', next.level)
    }
  }

  // ── 布局（窗口可缩放：以 320 短边为基准等比缩放）────────────────────────

  _layout (gameSize) {
    const { width, height } = gameSize || this.scale.gameSize
    const cx = width / 2
    const k = Phaser.Math.Clamp(Math.min(width, height) / REF_MIN, 0.9, 1.6)
    this.scaleFactor = k

    // 立绘几何（设计稿落地规格 + 实机约束）：
    //   目标显示高 = 196/320 窗高；但必须全身入画（不遮头/不压按钮）——
    //   以装配层同步来的中部可用区（#mid）为硬边界，等比缩放，窗口越大越接近设计稿尺寸。
    const midH = this.midBottom - this.midTop
    const dispH = Math.max(48, Math.min(height * PORTRAIT_H_RATIO, midH - 4))
    const anchorY = this.midTop + 2 + dispH * PIVOT_RATIO_Y

    this.figure.setPosition(cx, anchorY)
    this.figure.setScale(dispH / (this.portrait || { height: 760 }).height)
    this.figure.setData('anchorY', anchorY)
    this.figure.setData('dispH', dispH)

    this.auraWrap.setPosition(cx, anchorY - dispH * 0.18)
    this.aura.setScale((Math.min(width, height) * (AURA_REF / REF_MIN)) / AURA_TEX)

    this.ambient.setPosition(cx, anchorY)
    this.burst.setPosition(cx, height * BURST_Y_RATIO)

    if (this.rootWheel) this.rootWheel.setPosition(cx, anchorY - 8 * k)

    // ── 3.1 角色表现：洞府层次 / 蒲团 / 境界圆光 / 法袍染色遮罩 ──────────
    const look = this.realmLook
    const feetY = anchorY + dispH * (1 - PIVOT_RATIO_Y)

    // 洞府暗部：罩住立绘上下的一点余量
    this.caveShade.setPosition(cx, anchorY - dispH * 0.08)
    this.caveShade.setScale((Math.min(width, height) * SCENE_LOOK.cave.shadeScale) / AURA_TEX)

    // 石壁剪影 + 地面：随窗口重画（两侧收进一点，地面在脚底延伸出去）
    const inset = width * SCENE_LOOK.cave.archInsetRatio
    const g = this.caveG
    g.clear()
    // 左右石壁：从顶垂下的不规则剪影（三段折线，右壁略高错落）
    g.fillStyle(0x120d09, SCENE_LOOK.cave.archAlpha)
    g.beginPath()
    g.moveTo(0, 0); g.lineTo(inset + width * 0.10, 0)
    g.lineTo(inset + width * 0.05, height * 0.30)
    g.lineTo(inset, height * 0.62)
    g.lineTo(0, height * 0.78)
    g.closePath(); g.fillPath()
    g.beginPath()
    g.moveTo(width, 0); g.lineTo(width - inset - width * 0.08, 0)
    g.lineTo(width - inset - width * 0.04, height * 0.24)
    g.lineTo(width - inset, height * 0.58)
    g.lineTo(width, height * 0.72)
    g.closePath(); g.fillPath()
    // 地面：脚下一条暗层横带，往外渐隐靠上下两条透明度不同的横带叠出
    g.fillStyle(0x0f0b08, SCENE_LOOK.cave.floorAlpha * 0.8)
    g.fillRect(0, feetY + dispH * 0.015, width, Math.max(10, dispH * 0.10))
    g.fillStyle(0x0f0b08, SCENE_LOOK.cave.floorAlpha * 0.35)
    g.fillRect(0, feetY + dispH * 0.015 + Math.max(10, dispH * 0.10), width, Math.max(6, dispH * 0.06))

    // 地面暗影 + 蒲团：中心都在脚底略沉一点（脚踝没进垫沿）
    const cushW = dispH * SCENE_LOOK.cushion.wRatio
    const cushH = cushW * SCENE_LOOK.cushion.hRatio
    const cushY = feetY + dispH * SCENE_LOOK.cushion.yOffsetRatio
    this.floorShadow.setPosition(cx, cushY + cushH * 0.18)
    this.floorShadow.setScale((cushW * 1.5) / AURA_TEX, (cushH * 2.6) / AURA_TEX)
    if (this.cushion) {
      this.cushion.setPosition(cx, cushY)
      this.cushion.setDisplaySize(cushW, cushH)
    }

    // 境界圆光：罩在胸部高度，直径随境界递进
    this.realmRing.setPosition(cx, anchorY - dispH * 0.18)
    this.realmRing.setDisplaySize(
      dispH * SCENE_LOOK.ring.sizeRatio * look.ringScale,
      dispH * SCENE_LOOK.ring.sizeRatio * look.ringScale
    )
    this.realmRing.setAlpha(look.ringAlpha)

    // 法袍染色遮罩：世界坐标矩形，罩住腰际以下（呼吸 ±1.2px 的错位可忽略）
    if (this._robeMaskG) {
      const top = anchorY - dispH * PIVOT_RATIO_Y
      const robeTop = top + dispH * (PIVOT_RATIO_Y + SCENE_LOOK.robe.topFromPivot)
      const halfW = dispH * SCENE_LOOK.robe.halfWidthRatio
      this._robeMaskG.clear()
      this._robeMaskG.fillStyle(0xffffff)
      this._robeMaskG.fillRect(cx - halfW, robeTop, halfW * 2, top + dispH + 6 - robeTop)
    }

    // ── 3.3 氛围：色层铺满窗口 / 发射区随布局 / 霞光带贴天边 ──────────────
    if (this.toneBack) {
      this.toneBack.setDisplaySize(width, height)
      this.toneFront.setDisplaySize(width, height)
    }
    // 灵气粒子流：以立绘为轴心的矩形发射区（横向流过身周，纵向随显示高收放）
    if (this._qiZone && this.qiFlow) {
      const qh = dispH * AMBIENCE.qiFlow.spreadY
      const qw = dispH * 0.9
      this._qiZone.setTo(-qw / 2, -qh / 2, qw, qh)
      this.qiFlow.setPosition(cx, anchorY)
    }
    // 雨雪：自窗口上沿一条窄带落下（矩形随窗宽更新，发射器不重建）
    if (this._wxZone) this._wxZone.setTo(-20, -26, width + 40, 26)
    if (this._deadZone) this._deadZone.setTo(-80, height + 6, width + 160, 80)
    if (this.rainFx) this.rainFx.setPosition(0, 0)
    if (this.snowFx) this.snowFx.setPosition(0, 0)
    // 霞光带：三条错落贴在上半窗（左右轻微错开，避免三条重叠成一块）
    this.rosyBands.forEach((band, i) => {
      const baseX = cx + (i - 1) * width * 0.16
      band.setData('baseX', baseX)   // 漂移基准位（正弦驱动从它出发，见 _driftRosy）
      band.setPosition(baseX, height * (AMBIENCE.rosy.yRatio + i * 0.07))
      band.setDisplaySize(width * AMBIENCE.rosy.widthRatio, height * AMBIENCE.rosy.heightRatio)
    })
  }

  /**
   * 装配层同步中部可用区（#mid 的窗口坐标），立绘以此为硬边界全身入画
   * @param {{top:number, bottom:number}} rect
   */
  setMidArea ({ top, bottom } = {}) {
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return
    this.midTop = top
    this.midBottom = bottom
    this._layout(this.scale.gameSize)
  }

  // ── 演出 ────────────────────────────────────────────────────────────────

  /** 飘字：从人形头顶浮起并淡出（突破成败、离线收益都用它） */
  spawnFloat ({ text, kind = 'info', sub = false, offsetY = 0 } = {}) {
    if (!text) return
    const colors = {
      ok: '#ffd98a',        // 突破成功 —— 鎏金
      fail: '#ff8f7d',      // 关口失败 —— 劫红
      offline: '#f0d9a8',   // 闭关归来（补发的是修为）—— 鎏金族，与进度条同源
      life: '#8fe3b6',      // 寿元回满 —— 灵玉（玉色专属于寿元/生机）
      info: '#cfe6ff'
    }
    const h = this.scale.gameSize.height
    const x = this.scale.gameSize.width / 2
    const y = h * FLOAT_Y_RATIO + offsetY + (sub ? FLOAT_SUB_OFFSET : 0)

    const label = this.add.text(x, y, text, {
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: sub ? '13px' : '16px',
      fontStyle: 'bold',
      color: colors[kind] || colors.info,
      stroke: '#1c1712',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(10)

    this.tweens.add({
      targets: label,
      y: y - (REDUCED_MOTION ? 8 : 42),
      alpha: 0,
      duration: REDUCED_MOTION ? 600 : 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    })
  }

  /** 气场爆发：突破/渡劫/归来的粒子反馈（渡劫附 320ms 震屏）；3.2 突破成功转完整演出 */
  playBurst (payload = {}) {
    const { kind = 'breakthrough' } = payload
    // 3.2：突破成功 → 完整演出段（内部自带 RM 降级：RM 下仅保留大字文案）
    if (kind === 'breakthrough' && payload.success) { this.playBreakthroughFx(payload); return }
    if (REDUCED_MOTION) return
    if (kind === 'trial') {
      this.burst.setParticleTint(0xffd08a)
      this.burst.explode(46)
      this.cameras.main.shake(320, 0.006)
    } else if (kind === 'offline') {
      this.burst.setParticleTint(0xf0d9a8)   // 补发的是修为 → 鎏金族
      this.burst.explode(26)
    } else if (kind === 'life') {
      this.burst.setParticleTint(0x8fe3b6)   // 寿元回满 → 灵玉
      this.burst.explode(20)
    } else {
      this.burst.setParticleTint(0xffe3a8)   // 突破失败等：保持既有轻反馈
      this.burst.explode(28)
    }
  }

  // ── 3.2 突破演出：灵气漩涡 → 顿帧 → 文案浮现 ───────────────────────────
  // 节奏与配色单点在 src/data/fx.js；失败分支不进本段（保持既有轻反馈）。

  /**
   * 突破成功完整演出：灵气漩涡卷入丹田 → 顿帧（呼吸/吐纳/粒子瞬停 + 照面闪光）
   * → 大字文案浮现。装配层把成功飘字推迟到 totalMs 同拍，漩涡未尽不出结果。
   * @param {{success?:boolean, title?:string}} p
   */
  playBreakthroughFx ({ success = false, title = '' } = {}) {
    if (!success) return
    const cx = this.figure.x
    const cy = this.figure.y
    const dispH = this.figure.getData('dispH')
    if (!REDUCED_MOTION) {
      // 漩涡起步的淡淡涌动 + 顿帧落点的一记金光（替代原轻反馈的 explode）
      this.burst.setParticleTint(0xffe3a8)
      this.burst.explode(30)
      this._qiVortex(cx, cy, dispH * BREAKTHROUGH_FX.vortex.radiusRatio)
      this.time.delayedCall(
        BREAKTHROUGH_FX.vortex.durationMs + BREAKTHROUGH_FX.vortex.staggerMs * BREAKTHROUGH_FX.vortex.count * 0.5,
        () => this._hitStop()
      )
    }
    if (title) {
      this.time.delayedCall(REDUCED_MOTION ? 200 : BREAKTHROUGH_FX.totalMs, () => this._ritualTitle(title))
    }
  }

  /** 灵气漩涡：一圈灵气光点自立绘四周螺旋卷入丹田（境界色，越卷越快） */
  _qiVortex (cx, cy, R) {
    const v = BREAKTHROUGH_FX.vortex
    const tint = this._hex(this.realmLook.ring)
    for (let i = 0; i < v.count; i++) {
      const a0 = (i / v.count) * Math.PI * 2 + Math.random() * 0.4
      const spark = this.add.image(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * v.squashY, 'tex_spark')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setAlpha(0)
        .setScale(0.72)
        .setDepth(3)
      const prog = { t: 0 }
      this.tweens.add({
        targets: prog,
        t: 1,
        delay: i * v.staggerMs,
        duration: v.durationMs,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const ang = a0 + prog.t * v.turns * Math.PI * 2
          const r = R * (1 - prog.t)
          spark.x = cx + Math.cos(ang) * r
          spark.y = cy + Math.sin(ang) * r * v.squashY
          spark.alpha = 0.9 * Math.sin(prog.t * Math.PI) + 0.1
          spark.scale = 0.72 - prog.t * 0.5
        },
        onComplete: () => spark.destroy()
      })
    }
  }

  /** 顿帧：呼吸补间 / 吐纳节律 / 常态粒子瞬停一拍，照面闪光后齐齐恢复 */
  _hitStop () {
    if (REDUCED_MOTION) return
    const h = BREAKTHROUGH_FX.hitStop
    if (this.breathTween) this.breathTween.pause()
    if (this.inhaleTimer) this.inhaleTimer.paused = true
    if (this.ambient) this.ambient.pause()
    this._auraFlash(h.flashAlpha, h.flashMs)
    this.cameras.main.flash(h.flashMs, 255, 240, 205, false)
    this.time.delayedCall(h.ms, () => {
      if (this.breathTween) this.breathTween.resume()
      if (this.inhaleTimer) this.inhaleTimer.paused = false
      if (this.ambient) this.ambient.resume()
    })
  }

  /** 文案浮现：突破/渡劫共用的大字（楷体鎏金，自小放大浮出，停留后上浮淡去） */
  _ritualTitle (text) {
    const t = BREAKTHROUGH_FX.title
    const x = this.scale.gameSize.width / 2
    const y = this.figure.getData('anchorY') - this.figure.getData('dispH') * 0.47 - 20 * this.scaleFactor
    const label = this.add.text(x, y, text, {
      fontFamily: '"KaiTi", "STKaiti", "Microsoft YaHei", serif',
      fontSize: '21px',
      fontStyle: 'bold',
      color: t.color,
      stroke: '#1c1712',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(20).setAlpha(0)

    if (REDUCED_MOTION) {
      label.setAlpha(1)
      this.time.delayedCall(t.holdMs + t.outMs, () => label.destroy())
      return
    }
    label.setScale(0.35)
    this.tweens.add({ targets: label, alpha: 1, scale: 1, duration: t.inMs, ease: 'Back.easeOut' })
    this.time.delayedCall(t.inMs + t.holdMs, () => {
      this.tweens.add({
        targets: label,
        alpha: 0,
        y: y - 22,
        duration: t.outMs,
        ease: 'Cubic.easeOut',
        onComplete: () => label.destroy()
      })
    })
  }

  // ── 三道天雷（渡劫演出）────────────────────────────────────────────────

  /**
   * 渡劫演出：三道天雷逐道自天而降
   * 成则三道皆落实；败则只第一道落实、其余两道中途溃散（对应「过二即成」）
   * @param {object} o
   * @param {boolean} o.success 是否渡劫成功
   * @param {number}  o.strikes 天雷道数（默认 3）
   */
  playTribulation ({ success = false, strikes = 3, title = '' } = {}) {
    this.clearRootWheel()
    const total = Math.max(1, strikes)
    const gap = 460                                  // 两道之间 460ms
    const w = this.scale.gameSize.width
    const k = this.scaleFactor
    const figureX = w / 2
    const hitY = this.figure.getData('anchorY') - 12 * k
    const landCount = success ? total : 1

    for (let i = 0; i < total; i++) {
      this.time.delayedCall(i * gap, () => this._strikeBolt(figureX, hitY, i < landCount, i))
    }

    // 收势：成则金光炸开，败则暗红余烬
    this.time.delayedCall(total * gap + 140, () => {
      if (REDUCED_MOTION) return
      this.ambient.frequency = success ? 260 : 460
      if (success) {
        this.burst.setParticleTint(0xffe3a8)
        this.burst.explode(52)
        this.cameras.main.shake(220, 0.004)
      } else {
        this.burst.setParticleTint(0xa8442f)
        this.burst.explode(24)
        this.aura.setTint(0x8c3b2a)                  // 焦痕：光晕转暗红
        this.time.delayedCall(900, () => this.setAuraColor(this._lastAuraColor))
      }
    })

    // 3.2 收势演出：成功叠「霞光 + 大字」，失败叠「焦黑蒙层 + 黑烟」
    this.time.delayedCall(total * gap + 140, () => {
      if (success) {
        this._rosyGlow()
        if (title) this._ritualTitle(title)
      } else {
        this._scorchFigure()
      }
    })
  }

  /** 单道天雷：锯齿闪电 + 落点爆光 + 震屏（溃散则半途而灭） */
  _strikeBolt (figureX, hitY, lands, index) {
    const jitter = (n) => Phaser.Math.FloatBetween(-n, n)
    const x0 = figureX + jitter(18)
    const x1 = figureX + jitter(10)
    const endY = lands ? hitY : hitY - 78 * this.scaleFactor   // 溃散：只劈到七成高度

    const bolt = this.add.graphics().setDepth(8)
    const path = (color, width, alpha) => {
      bolt.lineStyle(width, color, alpha)
      bolt.beginPath()
      bolt.moveTo(x0, -14)
      const segs = 7
      for (let s = 1; s <= segs; s++) {
        const t = s / segs
        const px = Phaser.Math.Linear(x0, x1, t) + (s === segs ? 0 : jitter(s < 4 ? 15 : 7))
        const py = Phaser.Math.Linear(-14, endY, t)
        bolt.lineTo(px, py)
      }
      bolt.strokePath()
    }
    path(0xffd08a, 10, 0.16)   // 外层光晕
    path(0xffe9b8, 4.5, 0.55)  // 中层
    path(0xfffdf4, 1.8, 1)     // 核心

    if (lands) {
      // 落点爆光
      const glow = this.add.image(x1, hitY, 'tex_glow_white')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe3a8)
        .setDepth(9)
        .setScale(0.3)
      this.tweens.add({
        targets: glow,
        scale: 1.6,
        alpha: { from: 0.95, to: 0 },
        duration: 360,
        ease: 'Cubic.easeOut',
        onComplete: () => glow.destroy()
      })
      if (!REDUCED_MOTION) {
        this.burst.setParticleTint(0xffe9b8)
        this.burst.explode(16)
        this.cameras.main.shake(240, 0.008)
      }
      this._auraFlash(0.92, 260)
    } else {
      // 溃散：一声闷响，天雷半途而灭
      const puff = this.add.image(x1, endY, 'tex_glow_cool')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9)
        .setScale(0.45)
        .setAlpha(0.5)
      this.tweens.add({ targets: puff, scale: 0.9, alpha: 0, duration: 320, onComplete: () => puff.destroy() })
      if (!REDUCED_MOTION) this.cameras.main.shake(90, 0.002)
    }

    // 闪电本体：闪一下即灭
    if (REDUCED_MOTION) {
      bolt.setAlpha(0.7)
      this.tweens.add({ targets: bolt, alpha: 0, duration: 260, onComplete: () => bolt.destroy() })
    } else {
      this.tweens.add({
        targets: bolt,
        alpha: 0,
        duration: 230,
        ease: 'Cubic.easeIn',
        onComplete: () => bolt.destroy()
      })
    }
  }

  /** 闪电照亮人脸：独立闪光层的一次性脉冲（不干扰光晕呼吸补间） */
  _auraFlash (peak, ms) {
    if (REDUCED_MOTION || !this.flash) return
    this.tweens.killTweensOf(this.flash)
    this.flash.setAlpha(peak).setScale(0.5)
    this.tweens.add({
      targets: this.flash,
      alpha: 0,
      scale: 1.25,
      duration: ms + 160,
      ease: 'Cubic.easeOut'
    })
  }

  // ── 3.2 渡劫收势演出：成功霞光 / 失败焦黑（参数单点在 data/fx.js）──────

  /** 成功霞光：一片暖霞色光带自人身后升腾凝住再散去，光晕同拍转霞色后复原 */
  _rosyGlow () {
    const g = TRIBULATION_FX.rosyGlow
    const { width, height } = this.scale.gameSize
    const band = this.add.image(width / 2, height * 0.6, 'tex_glow_white')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this._hex(g.tint))
      .setDisplaySize(width * g.widthRatio, height * g.heightRatio)
      .setDepth(4)
      .setAlpha(0)

    if (REDUCED_MOTION) {
      band.setAlpha(g.alphaPeak * 0.6)
      this.time.delayedCall(g.inMs + g.holdMs + g.outMs, () => band.destroy())
    } else {
      this.tweens.add({
        targets: band,
        alpha: { from: 0, to: g.alphaPeak },
        duration: g.inMs,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: g.holdMs,
        onYoyo: () => this.tweens.add({ targets: band, duration: g.outMs, ease: 'Sine.easeIn' }),
        onComplete: () => band.destroy()
      })
      // 光晕同拍转霞色一拍（劫后余生的暖意），随后复原灵根色
      this.aura.setTint(this._hex(g.tint))
      this._auraFlash(0.8, g.inMs)
      this.time.delayedCall(g.auraHoldMs, () => this.setAuraColor(this._lastAuraColor))
    }
  }

  /** 失败焦黑：立绘蒙一层近黑焦色（随呼吸同缩放），一缕黑烟升起，缓缓褪去 */
  _scorchFigure () {
    const s = TRIBULATION_FX.scorch
    const dispH = this.figure.getData('dispH')
    if (this.scorchLayer) this.scorchLayer.destroy()   // 防重入（连败演示等极端情形）
    this.scorchLayer = this.add.image(0, 0, this.avatarKey)
      .setOrigin(0.5, PIVOT_RATIO_Y)
      .setTint(this._hex(s.tint))
      .setDepth(1)
    // 挂进 figureInner：随呼吸缩放与立绘完全同位（否则会错位穿帮）
    this.figureInner.add(this.scorchLayer)

    if (REDUCED_MOTION) {
      this.scorchLayer.setAlpha(s.alphaPeak * 0.6)
      this.time.delayedCall(s.holdMs, () => {
        if (this.scorchLayer) { this.scorchLayer.destroy(); this.scorchLayer = null }
      })
    } else {
      this.scorchLayer.setAlpha(0)
      this.tweens.add({ targets: this.scorchLayer, alpha: s.alphaPeak, duration: s.inMs, ease: 'Sine.easeOut' })
      // 黑烟：几团暗烟自立绘躯干升起（NORMAL 混合，暗色才能压得住 ADD 的光）
      for (let i = 0; i < s.smoke.count; i++) {
        this.time.delayedCall(Math.random() * s.smoke.spanMs, () => {
          if (!this.figure || !this.figure.scene) return
          const puff = this.add.image(
            this.figure.x + Phaser.Math.FloatBetween(-dispH * 0.18, dispH * 0.18),
            this.figure.y - dispH * Phaser.Math.FloatBetween(0.05, 0.4),
            'tex_glow_white'
          ).setTint(0x14100d)
            .setAlpha(0)
            .setScale(0.4)
            .setDepth(2)
          this.tweens.add({
            targets: puff,
            y: puff.y - dispH * s.smoke.riseRatio,
            alpha: { from: 0, to: s.smoke.alpha },
            scale: 0.9,
            duration: 900,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this.tweens.add({ targets: puff, alpha: 0, duration: 380, onComplete: () => puff.destroy() })
            }
          })
        })
      }
      this.time.delayedCall(s.inMs + s.holdMs, () => {
        if (!this.scorchLayer) return
        this.tweens.add({
          targets: this.scorchLayer,
          alpha: 0,
          duration: s.outMs,
          ease: 'Sine.easeIn',
          onComplete: () => {
            if (this.scorchLayer) { this.scorchLayer.destroy(); this.scorchLayer = null }
          }
        })
      })
    }
  }

  // ── 测灵根演出（开局抽卡）──────────────────────────────────────────────

  /** 演算中：四色光轮旋转（四段弧＝灵根四档） */
  playRootSpin ({ durationMs = 1700 } = {}) {
    this.clearRootWheel()
    const colors = [0xb9b3a8, 0x7fd6a8, 0xb98cff, 0xffd98a]
    const k = this.scaleFactor
    const g = this.add.graphics()
    for (let i = 0; i < 4; i++) {
      g.lineStyle(3, colors[i], 0.9)
      g.beginPath()
      g.arc(0, 0, 52, Phaser.Math.DegToRad(i * 90 + 10), Phaser.Math.DegToRad(i * 90 + 72))
      g.strokePath()
    }
    g.lineStyle(1, 0xe8e2d6, 0.28)
    g.strokeCircle(0, 0, 62)

    const anchorY = this.figure.getData('anchorY')
    this.rootWheel = this.add.container(this.scale.gameSize.width / 2, anchorY - 8 * k, [g])
    this.rootWheel.setDepth(5).setAlpha(0).setScale(k * 0.7)

    this.tweens.add({ targets: this.rootWheel, alpha: 1, scale: k, duration: 280, ease: 'Cubic.easeOut' })
    if (!REDUCED_MOTION) {
      this.tweens.add({ targets: this.rootWheel, rotation: Math.PI * 6, duration: durationMs, ease: 'Cubic.easeIn' })
      this.ambient.frequency = 90 // 灵气涌动
    }
  }

  /** 揭晓：炸光 + 大字（灵根名 + 特性/战斗词条） */
  playRootReveal ({ displayName = '', color = '#ffd98a', rarity = 'false', tag = '', trait = '' } = {}) {
    this.clearRootWheel()
    const tint = this._hex(color)
    const heaven = rarity === 'heaven'
    const mutant = rarity === 'mutant'

    if (!REDUCED_MOTION) {
      this.burst.setParticleTint(tint)
      this.burst.explode(heaven ? 64 : mutant ? 48 : 30)
      if (heaven || mutant) this.cameras.main.shake(heaven ? 400 : 240, heaven ? 0.008 : 0.004)
      this.ambient.frequency = 260
    }

    const x = this.scale.gameSize.width / 2
    const y = this.figure.getData('anchorY') - this.figure.getData('dispH') * 0.47 - 20 * this.scaleFactor
    const title = this.add.text(x, y, displayName, {
      fontFamily: '"KaiTi", "STKaiti", "Microsoft YaHei", serif',
      fontSize: heaven ? '22px' : '19px',
      fontStyle: 'bold',
      color,
      stroke: '#1c1712',
      strokeThickness: 5,
      align: 'center'
    }).setOrigin(0.5).setDepth(20).setScale(0.35).setAlpha(0)

    const sub = tag || trait
    const subText = sub
      ? this.add.text(x, y + 25, sub, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '11px',
        color: '#ded7c9',
        stroke: '#1c1712',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: 300 }
      }).setOrigin(0.5).setDepth(20).setAlpha(0)
      : null

    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut' })
    if (subText) this.tweens.add({ targets: subText, alpha: 1, duration: 380, delay: 240 })

    this.time.delayedCall(2000, () => {
      const targets = subText ? [title, subText] : [title]
      this.tweens.add({
        targets,
        alpha: 0,
        y: '-=22',
        duration: 700,
        onComplete: () => {
          title.destroy()
          if (subText) subText.destroy()
        }
      })
    })
  }

  /** 按灵根颜色给光晕上色（null → 恢复默认金）；记住颜色供"焦痕"后复原 */
  setAuraColor (color) {
    this._lastAuraColor = color || null
    // 3.4：无灵根色时回落到**当前皮肤**的主序金（而非写死的默认鎏金）
    this.aura.setTint(color ? this._hex(color) : this.skinTint.gold)
  }

  // ── 3.4 UI 动效与主题：皮肤落地（只换"主序色"，不碰任何语义色）──────────────
  // 皮肤真源在 src/data/themes.js；本段只负责把下发的色板变成 Phaser 的 tint 与贴图。

  /** `#rrggbb` → 0xRRGGBB；非法输入回 0 */
  _hexInt (hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
    return m ? parseInt(m[1], 16) : 0
  }

  /** "r,g,b" → 0xRRGGBB（各通道钳到 0~255；缺项回 fallback） */
  _tripleInt (triple, fallback = 0) {
    if (!triple) return fallback
    const n = String(triple).split(',').map((v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0))))
    if (n.length < 3) return fallback
    return (n[0] << 16) | (n[1] << 8) | n[2]
  }

  /**
   * 应用皮肤（装配层经 'skin:set' 下发 resolveSkin() 结果）。
   * 重染范围（刻意收窄，避免皮肤"改玩法观感"）：
   *   ① 光晕默认色 / 常态灵气粒子 / 爆发粒子  → 皮肤主序金族
   *   ② 蒲团贴图 → 按皮肤预生成的那张
   *   ③ 境界圆光 + 法袍 → 按皮肤主色相重铸（明度阶梯沿用原表，境界递进关系不变）
   * 不动的：灵根色（root:aura 优先级更高）、劫红、灵玉、天雷、洞府暗部（近黑，皮肤无感）。
   * @param {{id:string, accent:string, palette:{hue:number,sat:number}, slots:Record<string,string>}} p
   */
  applySkin (p) {
    if (!p || !p.slots) return
    this.skin = p
    this.skinTint = {
      gold: this._tripleInt(p.slots.gold, DEFAULT_AURA_TINT),
      goldLight: this._tripleInt(p.slots.goldLight, 0xffe3a8)
    }
    if (!this._lastAuraColor && this.aura) this.aura.setTint(this.skinTint.gold)
    if (this.ambient) this.ambient.setParticleTint(this.skinTint.gold)
    if (this.burst) this.burst.setParticleTint(this.skinTint.goldLight)
    if (this.cushion) {
      const key = cushionTexKey(p.id)
      if (this.textures.exists(key)) this.cushion.setTexture(key)
    }
    // 圆光 / 袍色：按皮肤主色相重铸（realmIdx → 该大境界的代表等级，只看 idx 不影响配色阶梯）
    this.applyRealmLook(getRealmLook(this.realmLook.realmIdx * 9 + 1, p))
  }

  clearRootWheel () {
    if (!this.rootWheel) return
    this.tweens.killTweensOf(this.rootWheel)
    this.rootWheel.destroy()
    this.rootWheel = null
  }

  _hex (str) {
    if (typeof str === 'number') return str
    return Phaser.Display.Color.HexStringToColor(String(str || '#ffffff')).color
  }
}
