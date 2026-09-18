/**
 * ambience.js —— 3.3 氛围系统：昼夜色调 / 灵气粒子流 / 轻天气 的配置与纯函数（data 层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界：本文件**禁止 import** systems / Phaser / DOM（数据层铁律，§13.1①）；
 *       只 import 本层 data（gametime.js），与 appearance.js ← realms.js 同例。
 * 职责：为表现层（MainScene 演出 / main.js 装配）提供"此刻该是什么氛围"的唯一数据源：
 *   · 昼夜色调 —— 四相位（晨 / 昼 / 暮 / 夜）的色与浓度
 *   · 灵气粒子流 —— 横向流过身周的灵气微光（与 3.1 常态上升粒子分工不同）
 *   · 轻天气 —— 晴 / 雨 / 雪 / 霞 四态的参数与轮换规则
 *   · 低性能自动降载 —— 帧率触发的三档负载（标准 / 轻降载 / 重降载）
 *
 * 数据来源：《问长生-开发计划》§五 3.3「灵气粒子流、昼夜色调、轻天气（雨/雪/霞）；
 *   低性能模式自动降载」。设计库未给氛围规格，以下口径为自定（改口味只改本表）：
 *   ① **昼夜相位跟现实时钟**（AMBIENCE.phaseSource = 'real'）—— 桌面常驻陪件，
 *      24 小时一循环，白天亮、黄昏暖、夜里冷，变化很慢不打扰；改 'game' 即改跟
 *      游戏历时辰（1 现实小时 = 15 游戏天，会快得晃眼，故不作默认）。
 *   ② **天气按游戏日轮换**（1 游戏天 = 现实 4 分钟一变，见 gametime.js），
 *      由「游戏日序 + 相位」哈希决定 —— 纯函数、无存档、重开同一天仍是同一场天气。
 *      霞只在晨/暮出现（天边才有霞）。**天气是表现层，不产不耗任何数值。**
 *   ③ 浓度一律克制：色调最浓仅 0.30（夜），且前层只按 0.34 比例再叠一次，
 *      保证大字/数值/立绘的辨识度不被氛围吃掉。
 *   ④ 「减弱动态」的处理：自动档仍是全开，但**自动降一档负载**（粒子更稀更缓）——
 *      该偏好要治的是"晃"而非"下雨"；要彻底安静可选「静态」（只留色调）或「关闭」。
 * 存档：无 —— 氛围由「时钟 + settings」派生；settings 里只有三个偏好叶子
 *   （ambience / weather / dayPhase，默认全自动），归本模块所有（见 §13.1⑤）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GAME_TIME, gameDaysForMs, gameClockOf } from './gametime.js'

// ── 参数表（唯一调参点）────────────────────────────────────────────────────

export const AMBIENCE = {
  // ① 昼夜色调
  phaseSource: 'real',    // 'real' 跟现实时钟（默认）| 'game' 跟游戏历时辰
  toneMs: 2600,           // 相位切换的色调过渡时长（避免跳变）
  toneFrontRatio: 0.34,   // 前层（叠在立绘/HUD 之上）相对后层的浓度比例

  // ② 灵气粒子流：横向缓缓流过身周的灵气微光（境界色，浓度随负载档缩放）
  qiFlow: {
    intervalMs: 460,      // 出点间隔（基准；轻降载 ×2 间隔）
    speedX: { min: 26, max: 62 },   // 横向速度（向右，随呼吸般的缓流）
    spreadY: 0.62,        // 纵向散布 / 立绘显示高（以立绘为轴心上下展开）
    scale: { start: 0.46, end: 0.12 },
    alpha: { start: 0.46, end: 0 },
    lifespanMs: { min: 2800, max: 4600 }
  },

  // ③ 轻天气：轮换规则（池 + 权重；霞仅晨暮）
  weather: {
    changeMs: 1600,       // 天气切换的淡出/淡入时长
    pool: [
      { id: 'clear', name: '晴', weight: 44 },
      { id: 'rain', name: '雨', weight: 24 },
      { id: 'snow', name: '雪', weight: 18 },
      { id: 'rosy', name: '霞', weight: 14, onlyPhases: ['dawn', 'dusk'] }
    ]
  },
  rain: {                 // 雨：细丝斜落（冷色，半透明）
    intervalMs: 65,
    // 寿命按"一落到底"定：最快 560px/s × 1.3s ≈ 730px、最慢 380px/s × 2.1s ≈ 800px，
    // 正好覆盖 720 高的默认窗（窗更高时由场景的 deathZone 兜底剔除出画粒子）。
    // 此前 2.2~3.4s 的寿命会让半数雨丝在窗外打转、且淡到看不见（真机实拍抓到）。
    speedY: { min: 380, max: 560 },
    speedX: { min: -40, max: -12 },
    alpha: { start: 0.55, end: 0.22 },   // 落到窗口下沿时仍有 0.22，不做"半途消失"
    scale: { start: 0.95, end: 0.95 },
    lifespanMs: { min: 1300, max: 2100 },
    tint: '#cfe0ff'
  },
  snow: {                 // 雪：慢飘（暖白，横向随机摆动）
    intervalMs: 190,
    speedY: { min: 34, max: 62 },
    speedX: { min: -18, max: 18 },
    alpha: { start: 0.62, end: 0.16 },   // 同样的道理：飘到下半屏别淡没了
    scale: { start: 0.6, end: 0.3 },
    lifespanMs: { min: 5000, max: 8000 },
    tint: '#eaf4ff'
  },
  rosy: {                 // 霞：天边暖光带缓缓漂移（非粒子，静态光带也可单独用）
    count: 3,
    tint: '#ffc48e',
    alpha: 0.32,
    driftMs: 26000,       // 单向漂移时长（往复）
    widthRatio: 0.72,     // 单带宽 / 窗宽
    heightRatio: 0.34,    // 单带高 / 窗高
    yRatio: 0.30          // 带心高度 / 窗高（偏上，在天边）
  },

  // ④ 低性能自动降载：帧率低于 lowFps 持续 downMs → 降一档；高于 highFps 持续 upMs → 升回一档
  // ⚠ 采样只在**窗口可见时**进行（见 MainScene.update 的 game.isVisible 判定）：
  //   窗口被遮挡/最小化时 Chromium 会节流 rAF，若照算就会"明明不卡却降载"。
  load: {
    lowFps: 44,
    highFps: 56,
    downMs: 2400,         // 连续低于 lowFps 这么久才降（避免偶发掉帧误判）
    upMs: 8000,           // 连续高于 highFps 这么久才升回（升回来要谨慎，但别让主人等太久）
    tiers: [
      { id: 0, name: '标准', qiMul: 1, weatherMul: 1 },
      { id: 1, name: '轻降载', qiMul: 0.5, weatherMul: 0.5 },   // 出点间隔 ×2
      { id: 2, name: '重降载', qiMul: 0, weatherMul: 0 }        // 0 = 停粒子流与天气，只留色调
    ]
  }
}

/** 天气 id → 演出参数（晴无演出，故不在表内） */
export const WEATHER_FX = { rain: AMBIENCE.rain, snow: AMBIENCE.snow, rosy: AMBIENCE.rosy }

/**
 * 昼夜四相位（现实时钟口径；区间 [fromHour, toHour)，夜跨零点）。
 * 色温口径（"一天的温度线"）：晨=清冷拂晓 → 昼=近白 → 暮=暖琥珀 → 夜=深冷。
 *   晨刻意走**冷调**（拂晓雾气的青白），这样暮的暖琥珀才不跟劫红/警示那族暖红撞车；
 *   晨/暮的"暖"由当相位可能出现的「霞」演出补上（见 weather.pool 的 rosy.onlyPhases）。
 * 语义（§〇）：氛围色是**环境光**，不承担 UI 语义 —— 只用中性白 / 冷雾 / 琥珀 / 深冷四类，
 *   避开灵玉（生机）、灵紫（灵根）、劫红（劫难）三族语义色。
 */
export const DAY_PHASES = [
  { id: 'dawn', name: '晨', tint: '#e7eef8', alpha: 0.13, fromHour: 5, toHour: 8 },
  { id: 'day', name: '昼', tint: '#fff4dd', alpha: 0.05, fromHour: 8, toHour: 17 },
  { id: 'dusk', name: '暮', tint: '#ffdfae', alpha: 0.20, fromHour: 17, toHour: 22 },
  { id: 'night', name: '夜', tint: '#0e1a33', alpha: 0.30, fromHour: 22, toHour: 5 }
]

/** 游戏历口径的相位映射（12 时辰 → 四相位；phaseSource='game' 时才用到） */
const PHASE_BY_SHICHEN = ['night', 'night', 'night', 'dawn', 'dawn', 'day', 'day', 'day', 'day', 'dusk', 'dusk', 'night']

/** 氛围总档（settings.ambience）| 有效档（resolveAmbienceMode 的结果） */
export const AMBIENCE_MODES = ['auto', 'full', 'static', 'off']
export const MODE_NAMES = { auto: '自动', full: '全开', static: '静态', off: '关闭' }

const MODE_INDEX = AMBIENCE_MODES.reduce((m, k, i) => { m[k] = i; return m }, {})

/** 设置项循环的下一个值（设置面板按钮用；尾接首） */
export function nextMode (cur) {
  const i = MODE_INDEX[cur] === undefined ? 0 : MODE_INDEX[cur]
  return AMBIENCE_MODES[(i + 1) % AMBIENCE_MODES.length]
}

/** 天气/相位的合法设置值（'auto' = 跟随自动） */
export const WEATHER_SETTINGS = ['auto', 'clear', 'rain', 'snow', 'rosy']
export const PHASE_SETTINGS = ['auto', 'dawn', 'day', 'dusk', 'night']

/** 32 位 FNV-1a：把「游戏日序」这类整数打散成稳定伪随机（同一输入永远同一结果） */
export function hash32 (str) {
  const s = String(str)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function inHourRange (h, from, to) {
  return from < to ? (h >= from && h < to) : (h >= from || h < to)
}

/**
 * 此刻的昼夜相位（纯函数）。
 * @param {number} ts 现实时间戳
 * @param {string} [source] 'real'（默认）| 'game'
 * @returns {{id:string, name:string, tint:string, alpha:number, source:string}}
 */
export function phaseAt (ts, source = AMBIENCE.phaseSource) {
  const t = Number(ts) || 0
  let id = 'day'
  if (source === 'game') {
    const c = gameClockOf(t)
    const idx = GAME_TIME.shichen.indexOf(c.shichen)
    id = PHASE_BY_SHICHEN[idx >= 0 ? idx : 5] || 'day'
  } else {
    const h = new Date(t).getHours()
    const hit = DAY_PHASES.find((p) => inHourRange(h, p.fromHour, p.toHour))
    id = (hit || DAY_PHASES[1]).id
  }
  const p = DAY_PHASES.find((x) => x.id === id) || DAY_PHASES[1]
  return { id: p.id, name: p.name, tint: p.tint, alpha: p.alpha, source }
}

/** 手动指定相位（设置面板）；非法值返回 null */
export function phaseById (id) {
  const p = DAY_PHASES.find((x) => x.id === id)
  return p ? { id: p.id, name: p.name, tint: p.tint, alpha: p.alpha, source: 'manual' } : null
}

/**
 * 此刻的天气（纯函数、确定性）：按「游戏日序」哈希在权重池里取一态；
 * forced 传具体 id 时直接采用（设置面板手动指定）。
 * 霞受相位约束（只在晨/暮）——被约束掉时其权重从总分里去掉，不改变其余相对比例。
 * @returns {{id:string, name:string, forced:boolean, auto:boolean}}
 */
export function weatherAt (ts, phaseId, forced = 'auto') {
  const pool = AMBIENCE.weather.pool
  const manual = pool.find((w) => w.id === forced)
  if (manual) return { id: manual.id, name: manual.name, forced: true, auto: false }
  const dayIdx = Math.floor(gameDaysForMs((Number(ts) || 0) - GAME_TIME.epochMs))
  const candidates = pool.filter((w) => !w.onlyPhases || w.onlyPhases.includes(phaseId))
  const total = candidates.reduce((s, w) => s + w.weight, 0)
  const r = hash32(`amb-w-${dayIdx}`) % total
  let acc = 0
  for (const w of candidates) {
    acc += w.weight
    if (r < acc) return { id: w.id, name: w.name, forced: false, auto: true }
  }
  const last = candidates[candidates.length - 1]
  return { id: last.id, name: last.name, forced: false, auto: true }
}

/**
 * 有效氛围档：设置 'auto' 时＝**全开**（不做"因系统偏好而整个关掉"分流）。
 * 系统「减弱动态」的处理改在**负载档**上：`ambienceView` 在 reducedMotion 时自动降一档
 * （出点间隔 ×2、雨雪更稀）—— 口径理由：该偏好要治的是"晃"（大幅位移/闪烁/缩放），
 *   而氛围微粒是缓慢的环境层；一刀切成"只剩色调"会让氛围系统在开着该偏好的机器上
 *   （本项目主人本机即是）等于不存在。要彻底安静请直接选「静态」或「关闭」。
 * 手动选择永远优先于任何自动口径。
 */
export function resolveAmbienceMode (setting, reducedMotion) {
  const s = String(setting || 'auto')
  if (s === 'full' || s === 'static' || s === 'off') return s
  return 'full'
}

/**
 * 低性能自动降载（纯函数、带滞回）：喂入帧率与上次状态，返回新状态。
 * @param {number} fps 实测帧率（game.loop.actualFps）
 * @param {{level:number, lowMs:number, highMs:number}} prev
 * @param {number} dtMs 距上次采样的毫秒
 * @param {object} [cfg] 默认 AMBIENCE.load
 * @returns {{level:number, lowMs:number, highMs:number, changed:boolean}}
 */
export function stepLoad (fps, prev, dtMs = 1000, cfg = AMBIENCE.load) {
  const cur = (prev && typeof prev.level === 'number') ? prev : { level: 0, lowMs: 0, highMs: 0 }
  let level = Math.max(0, Math.min(cfg.tiers.length - 1, cur.level | 0))
  let lowMs = Math.max(0, cur.lowMs || 0)
  let highMs = Math.max(0, cur.highMs || 0)
  const n = Number(fps)
  if (!Number.isFinite(n) || n <= 0) return { level, lowMs, highMs, changed: false }  // 尚无实测帧率 → 不动
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 1000

  if (n < cfg.lowFps) { lowMs += dt; highMs = Math.max(0, highMs - dt) }
  else if (n > cfg.highFps) { highMs += dt; lowMs = Math.max(0, lowMs - dt) }
  else { lowMs = Math.max(0, lowMs - dt * 0.5); highMs = Math.max(0, highMs - dt * 0.5) }

  let next = level
  if (lowMs >= cfg.downMs) { next = Math.min(cfg.tiers.length - 1, level + 1); lowMs = 0; highMs = 0 }
  else if (highMs >= cfg.upMs) { next = Math.max(0, level - 1); lowMs = 0; highMs = 0 }
  return { level: next, lowMs, highMs, changed: next !== level }
}

/**
 * 汇总视图（装配层算好，经 'ambience:set' 下发给场景；纯函数、可 JSON 序列化）。
 * 负载档 = 传入的实测档 + 「减弱动态」加成（+1，封顶重降载）：系统开着减弱动态时
 *   粒子出点更稀、雨雪更缓，但氛围仍然看得见（见 resolveAmbienceMode 的口径说明）。
 * @param {{ts:number, phaseSetting:string, weatherSetting:string, mode:string,
 *          loadLevel:number, reducedMotion:boolean}} o
 */
export function ambienceView ({
  ts = 0,
  phaseSetting = 'auto',
  weatherSetting = 'auto',
  mode = 'full',
  loadLevel = 0,
  reducedMotion = false
} = {}) {
  const autoPhase = phaseAt(ts)
  const manualPhase = phaseById(phaseSetting)
  const phase = manualPhase || autoPhase
  const weather = weatherAt(ts, phase.id, weatherSetting)
  const tiers = AMBIENCE.load.tiers
  const rmBoost = (mode === 'full' && reducedMotion) ? 1 : 0
  const tierIdx = Math.max(0, Math.min(tiers.length - 1, (Number(loadLevel) || 0) + rmBoost))
  const tier = tiers[tierIdx]

  const fxOn = mode === 'full'
  const qiMul = fxOn ? tier.qiMul : 0
  const wxMul = fxOn ? tier.weatherMul : 0
  const qiActive = qiMul > 0
  const wxActive = wxMul > 0 && weather.id !== 'clear'
  // 天气演出间隔：雨/雪是粒子（有 intervalMs）；霞是静态光带（无 intervalMs → -1，不参与粒子出点）
  const wxDef = WEATHER_FX[weather.id]
  const wxInterval = (wxDef && Number.isFinite(wxDef.intervalMs)) ? Math.round(wxDef.intervalMs / wxMul) : -1

  return {
    mode,
    phase: { id: phase.id, name: phase.name, tint: phase.tint, alpha: phase.alpha, manual: !!manualPhase },
    weather: { id: weather.id, name: weather.name, manual: weather.forced },
    load: { level: tier.id, name: tier.name, rmBoosted: rmBoost > 0 },
    tone: { tint: phase.tint, alpha: mode === 'off' ? 0 : phase.alpha },
    qi: {
      active: qiActive,
      intervalMs: qiActive ? Math.max(40, Math.round(AMBIENCE.qiFlow.intervalMs / qiMul)) : -1
    },
    weatherFx: {
      active: wxActive,
      intervalMs: (wxActive && wxInterval > 0) ? Math.max(24, wxInterval) : -1
    },
    label: `${phase.name} · ${weather.name}`
  }
}

/** 视图指纹：装配层用它判断"要不要重新下发"（避免每秒重启动画） */
export function viewKey (v) {
  if (!v) return ''
  return [v.mode, v.phase.id, v.weather.id, v.load.level, v.qi.active ? v.qi.intervalMs : 0, v.weatherFx.active ? v.weatherFx.intervalMs : 0].join('|')
}

export default {
  AMBIENCE, DAY_PHASES, WEATHER_FX, AMBIENCE_MODES, MODE_NAMES, WEATHER_SETTINGS, PHASE_SETTINGS,
  nextMode, hash32, phaseAt, phaseById, weatherAt, resolveAmbienceMode, stepLoad,
  ambienceView, viewKey
}
