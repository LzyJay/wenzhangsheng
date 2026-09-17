/**
 * appearance.js —— 3.1 角色表现：境界外观配置与纯函数（data 层，纯配置 + 纯函数）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界：本文件**禁止 import** systems / Phaser / DOM（数据层铁律，§13.1①）。
 * 职责：为表现层（MainScene）提供"按大境界查外观"的唯一数据源：
 *   · 境界圆光（背光圆环）颜色 / 透明度 / 尺寸 —— 境界越高金光越盛
 *   · 法袍染色（服饰色）—— 同族金光，照在袍上的成色
 *   · 打坐呼吸节律 —— 境界越高呼吸越缓越沉（吐纳升级）
 *   · 常态灵气粒子密度 —— 境界越高灵气愈浓
 * 数据来源：《问长生-开发计划V2》§五 3.1「打坐呼吸/吐纳升级；境界提升后的外观变化
 *   （光晕色、服饰色）；蒲团/洞府背景层次」。设计库未给定境界配色，本表按
 *   §〇 颜色语义表自定：境界属「修行主序」→ **一律取鎏金族**（不占用玉/紫/劫红的
 *   语义色），用"由暗金到仙光白金"的明度阶梯表达境界递进；改配色只改本表。
 * 存档：无 —— 外观完全由 state.player.realm.level 派生，不新增存档子树。
 *
 * 3.4 增补（UI 动效与主题）：`getRealmLook(level, palette?)` 加**可选第二参** ——
 *   传皮肤即把圆光/袍色重铸到该皮肤主色相（明度阶梯沿用原表，递进关系不变）；
 *   不传＝默认鎏金族原值。**旧调用点（1 参）行为逐位不变**，3.1 自测无需改动。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { REALM_META } from './realms.js'
import { hexToHsl, hslToHex } from './themes.js'   // 3.4：皮肤主色相（同层 data→data，无循环依赖）

/** 每一大境界的外观参数（下标 = 大境界序号 0~7，对应 REALM_META 炼气→大乘） */
export const REALM_LOOK = [
  //                 圆光色      服饰染色     呼吸周期ms  圆光透明度  圆光尺寸系数  灵气粒子间隔ms
  { ring: '#c9b98f', robe: '#d8c9a4', breathMs: 3600, ringAlpha: 0.08, ringScale: 1.00, ambientMs: 360 }, // 炼气 · 雾金
  { ring: '#d6bc80', robe: '#dcc794', breathMs: 3800, ringAlpha: 0.10, ringScale: 1.04, ambientMs: 330 }, // 筑基 · 浅鎏金
  { ring: '#e8b96a', robe: '#e4c185', breathMs: 4000, ringAlpha: 0.12, ringScale: 1.08, ambientMs: 300 }, // 金丹 · 正鎏金（默认色同源）
  { ring: '#f0c078', robe: '#eaca90', breathMs: 4200, ringAlpha: 0.15, ringScale: 1.12, ambientMs: 275 }, // 元婴 · 丹金
  { ring: '#f5cc8a', robe: '#eed39c', breathMs: 4400, ringAlpha: 0.17, ringScale: 1.16, ambientMs: 250 }, // 化神 · 明金
  { ring: '#f9d9a0', robe: '#f2dcaa', breathMs: 4600, ringAlpha: 0.20, ringScale: 1.20, ambientMs: 228 }, // 炼虚 · 澄金
  { ring: '#fce6ba', robe: '#f6e4bc', breathMs: 4800, ringAlpha: 0.23, ringScale: 1.24, ambientMs: 205 }, // 合体 · 暖仙金
  { ring: '#fff2d8', robe: '#fdecce', breathMs: 5000, ringAlpha: 0.26, ringScale: 1.28, ambientMs: 180 }  // 大乘 · 仙光白金
]

/** 蒲团 / 洞府背景的几何与透明度（比例均相对立绘显示高 dispH 或窗口短边） */
export const SCENE_LOOK = {
  cushion: {
    wRatio: 0.94,        // 蒲团宽 / 立绘显示高（站姿脚下地台）
    hRatio: 0.30,        // 蒲团高 / 宽（椭圆压扁比）
    yOffsetRatio: 0.035, // 中心相对"脚底"再下沉量 / dispH（脚踝没进垫沿一点）
    alpha: 0.9
  },
  cave: {
    shadeScale: 3.1,     // 洞府暗部（柔光暗斑）直径 / 窗口短边
    shadeAlpha: 0.5,
    archAlpha: 0.42,     // 两侧石壁剪影透明度
    floorAlpha: 0.3,     // 地面暗层透明度
    archInsetRatio: 0.06 // 石壁剪影距窗口左右边的留白 / 窗宽
  },
  ring: {
    sizeRatio: 0.52      // 圆光直径 / 立绘显示高（再乘 REALM_LOOK.ringScale）；只罩头肩背光
  },
  robe: {
    alpha: 0.17,         // 服饰染色强度（ADD 叠色，JPG 自带暗底几乎不受影响）
    topFromPivot: 0.16,  // 染色上缘：轴心(丹田47%)再往下 16% 显示高处 ≈ 腰际
    halfWidthRatio: 0.36 // 染色矩形半宽 / 显示高
  },
  inhale: {
    perBreath: 6,        // 每次吐纳（吸气半程）汇聚的灵气光点数
    fromRatio: 0.55,     // 出发半径 / 圆光直径
    travelPct: 0.42      // 飞行时长占呼吸周期的比例
  }
}

/**
 * 把鎏金族原色重铸到皮肤主色相（3.4）：
 *   · **只换色相与饱和度，明度阶梯沿用原表**——境界越高光越盛、袍越亮的递进关系原样保留；
 *   · 传入 null、`{id:'default'}` 或缺 `hue` 时**逐位返回原色**，保证默认皮肤与既有断言不变。
 * @param {string} hex 原色（REALM_LOOK 里的 ring / robe）
 * @param {object|null} palette 皮肤（resolveSkin() 结果，或裸 `{hue,sat}`）；null = 默认
 * @returns {string} `#rrggbb`
 */
function recolor (hex, palette) {
  if (!palette) return hex
  if (palette.id === 'default') return hex              // 默认鎏金：原值冻结
  const p = palette.palette || palette                  // 兼容 resolveSkin() 结果与裸 {hue,sat}
  if (typeof p.hue !== 'number' || Number.isNaN(p.hue)) return hex
  return hslToHex({ h: p.hue, s: p.sat, l: hexToHsl(hex).l })
}

/**
 * 按角色等级取外观视图（纯函数；scene / main 共用同一口径）
 * @param {number} level state.player.realm.level（1~72；越界自动钳制）
 * @param {object|null} [palette] 3.4 皮肤（可选第二参）：传则圆光/袍色随皮肤主色相重铸；
 *        缺省＝默认鎏金族（**向后兼容**：既有 3.1 断言与调用点无需改动）
 * @returns {{realmIdx:number, realmName:string, ring:string, robe:string,
 *            breathMs:number, ringAlpha:number, ringScale:number, ambientMs:number}}
 */
export function getRealmLook (level, palette = null) {
  const lv = Math.max(1, Math.min(72, Math.floor(Number(level) || 1)))
  const realmIdx = Math.min(REALM_LOOK.length - 1, Math.floor((lv - 1) / 9))
  const look = REALM_LOOK[realmIdx]
  return {
    realmIdx,
    realmName: REALM_META[realmIdx].name,
    ring: recolor(look.ring, palette),
    robe: recolor(look.robe, palette),
    breathMs: look.breathMs,
    ringAlpha: look.ringAlpha,
    ringScale: look.ringScale,
    ambientMs: look.ambientMs
  }
}
