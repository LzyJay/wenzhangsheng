/**
 * PreloadScene.js —— 资源准备场景
 * 职责：程序化生成运行期贴图（光晕、灵气粒子），并加载 V2 立绘（男修/女修 JPG，
 *       由设计稿内嵌成品提取至 assets/portrait_*.jpg），过场后进入 MainScene。
 * 3.1 增补：境界圆光环（tex_ring）+ 蒲团（tex_cushion）。
 * 3.3 增补：雨丝（tex_rain）+ 1×1 白块（tex_pixel，昼夜色调层拉伸铺满窗口用）。
 * 3.4 增补：蒲团按四套皮肤各出一张（tex_cushion / _zhu / _xuan / _yue）——
 *          蒲团是"带成色出图、不染色"的贴图，皮肤切换靠换 key，比运行期重绘更省。
 */
import portraitMaleUrl from '../../assets/portrait_male.jpg'
import portraitFemaleUrl from '../../assets/portrait_female.jpg'
import { SKIN_IDS, cushionColors, cushionTexKey } from '../data/themes.js'

export default class PreloadScene extends Phaser.Scene {
  constructor () {
    super('PreloadScene')
  }

  preload () {
    // V2 立绘（设计稿落地规格：300:640 画框、高 760px 成品图）
    this.load.image('portrait_male', portraitMaleUrl)
    this.load.image('portrait_female', portraitFemaleUrl)
  }

  create () {
    this._makeGlowTexture('tex_glow', 128, 0xe8b96a)
    // 白色光晕：供主场景 setTint 染色（灵根 / 境界颜色）
    this._makeGlowTexture('tex_glow_white', 128, 0xffffff)
    this._makeGlowTexture('tex_glow_cool', 96, 0x7fd6a8)
    this._makeSparkTexture('tex_spark', 12, 0xfff2d8)
    this._makeSparkTexture('tex_spark_white', 12, 0xffffff)
    // 3.1 角色表现：境界圆光环（白色环带，主场景染色）+ 蒲团（脚下地台，直接带成色）
    this._makeRingTexture('tex_ring', 128)
    // 3.4：四套皮肤各出一张蒲团；默认皮肤仍叫 tex_cushion（key 与 3.1 保持一致）
    for (const id of SKIN_IDS) {
      this._makeCushionTexture(cushionTexKey(id), 200, 60, cushionColors(id))
    }
    // 3.3 氛围系统：雨丝（细长条，主场景染色）+ 1×1 白块（昼夜色层拉伸铺满窗口）
    this._makeRainTexture('tex_rain', 3, 18)
    this._makePixelTexture('tex_pixel')

    const { width, height } = this.scale
    const label = this.add.text(width / 2, height * 0.44, '凝聚灵气…', {
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '14px',
      color: '#e8e2d6'
    }).setOrigin(0.5).setAlpha(0.9)

    this.tweens.add({
      targets: label,
      alpha: 0,
      duration: 260,
      delay: 320,
      onComplete: () => {
        label.destroy()
        this.scene.start('MainScene')
      }
    })
  }

  /**
   * 程序化径向光晕：多层同心圆叠加出柔和衰减（无需位图素材）
   * @param {string} key 纹理键
   * @param {number} size 直径
   * @param {number} color 主色
   */
  _makeGlowTexture (key, size, color) {
    if (this.textures.exists(key)) return
    const g = this.make.graphics({ add: false })
    const steps = 14
    for (let i = 0; i < steps; i++) {
      const r = (size / 2) * (1 - i / steps)
      g.fillStyle(color, 0.05) // 每层 5%，向心叠加成渐变
      g.fillCircle(size / 2, size / 2, r)
    }
    g.generateTexture(key, size, size)
    g.destroy()
  }

  /** 程序化灵气粒子：中心亮、边缘透明的小圆点 */
  _makeSparkTexture (key, size, color) {
    if (this.textures.exists(key)) return
    const g = this.make.graphics({ add: false })
    const steps = 5
    for (let i = 0; i < steps; i++) {
      const r = (size / 2) * (1 - i / steps)
      g.fillStyle(i === 0 ? 0xffffff : color, 0.28)
      g.fillCircle(size / 2, size / 2, r)
    }
    g.generateTexture(key, size, size)
    g.destroy()
  }

  /**
   * 程序化圆光环（3.1）：柔和环带——内缘与外缘都渐隐，中段最亮。
   * 白色出图，主场景按境界色 setTint；多层低透明度叠出柔边，避免密纹摩尔感。
   */
  _makeRingTexture (key, size) {
    if (this.textures.exists(key)) return
    const g = this.make.graphics({ add: false })
    const c = size / 2
    const rOuter = c - 2
    const bands = 10
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1)                 // 0 外缘 → 1 内缘
      const r = rOuter - t * rOuter * 0.26      // 环带占外径 26%
      // 亮度钟形：中段（t≈0.5）最实，两侧渐隐
      const a = 0.16 * Math.sin(Math.PI * (0.15 + 0.70 * t))
      g.lineStyle(4.5, 0xffffff, a)
      g.strokeCircle(c, c, r)
    }
    g.generateTexture(key, size, size)
    g.destroy()
  }

  /** `#rrggbb` → Phaser 用的 0xRRGGBB 整数（仅本文件内部用） */
  _hexInt (hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
    return m ? parseInt(m[1], 16) : 0x000000
  }

  /**
   * 程序化蒲团（3.1；3.4 起按皮肤出图）：玄色蒲编圆垫——暗体 + 金线锁边 + 内圈编织纹。
   * 直接带成色出图（不染色），铺在立绘脚下当地台层次。
   * @param {string} key 纹理键（由 themes.cushionTexKey 决定）
   * @param {number} w 宽
   * @param {number} h 高
   * @param {{lo:string, mid:string, hi:string, line:string, line2:string}} [pal]
   *        配色（themes.cushionColors）；缺省＝3.1 原玄色金线（向后兼容）
   */
  _makeCushionTexture (key, w, h, pal) {
    if (this.textures.exists(key)) return
    const P = pal || { lo: '#14100c', mid: '#221a12', hi: '#2b2115', line: '#e8b96a', line2: '#c99a4e' }
    const g = this.make.graphics({ add: false })
    const cx = w / 2
    const cy = h / 2
    const rx = w / 2 - 3
    const ry = h / 2 - 3
    // 垫体：由深到浅的三层椭圆叠出体积
    g.fillStyle(this._hexInt(P.lo), 1)
    g.fillEllipse(cx, cy + 2, rx * 2, ry * 2)
    g.fillStyle(this._hexInt(P.mid), 1)
    g.fillEllipse(cx, cy, rx * 2 - 8, ry * 2 - 6)
    g.fillStyle(this._hexInt(P.hi), 1)
    g.fillEllipse(cx, cy - 2, rx * 2 - 26, ry * 2 - 14)
    // 编织纹：内圈同心椭圆金线（低透明度，远看是质感近看是纹）
    const ringAlpha = [0.30, 0.22, 0.15]
    for (let i = 0; i < 3; i++) {
      g.lineStyle(1, this._hexInt(P.line), ringAlpha[i])
      g.strokeEllipse(cx, cy - 1, rx * 2 - 34 - i * 16, ry * 2 - 20 - i * 9)
    }
    // 金线锁边：外缘双线（立绘暗底卡会遮住垫身，靠外露的边沿与垫肩读出"蒲团"）
    g.lineStyle(2.2, this._hexInt(P.line), 0.8)
    g.strokeEllipse(cx, cy, rx * 2 - 6, ry * 2 - 5)
    g.lineStyle(1.4, this._hexInt(P.line2), 0.45)
    g.strokeEllipse(cx, cy, rx * 2, ry * 2)
    g.generateTexture(key, w, h)
    g.destroy()
  }

  /**
   * 程序化雨丝（3.3）：上虚下实的细长竖条，出白色，主场景按天气色 setTint。
   * 用两段叠出"上端渐隐"的观感（雨丝拖尾），避免看起来像一根硬棍。
   */
  _makeRainTexture (key, w, h) {
    if (this.textures.exists(key)) return
    const g = this.make.graphics({ add: false })
    g.fillStyle(0xffffff, 0.28)
    g.fillRect(0, 0, w, h)
    g.fillStyle(0xffffff, 0.55)
    g.fillRect(0, h * 0.35, w, h * 0.65)
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, h * 0.7, w, h * 0.3)
    g.generateTexture(key, w, h)
    g.destroy()
  }

  /**
   * 程序化 1×1 白块（3.3）：昼夜色调层用 —— 拉到整窗大小时是**均匀**色块
   * （tex_glow_white 是径向衰减，用作色层会四角发虚，故另出一张）。
   */
  _makePixelTexture (key) {
    if (this.textures.exists(key)) return
    const g = this.make.graphics({ add: false })
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture(key, 1, 1)
    g.destroy()
  }
}
