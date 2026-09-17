/**
 * BootScene.js —— 启动场景（Phaser 场景层：只做视觉与调度，不碰规则）
 * 职责：确认画布透明（与桌面融合）、把画布背景置空，然后交棒给 PreloadScene。
 */

export default class BootScene extends Phaser.Scene {
  constructor () {
    super('BootScene')
  }

  create () {
    // 画布必须完全透明，窗口才能"贴"在桌面上（Phaser transparent: true + 背景透明）
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')
    this.scene.start('PreloadScene')
  }
}
