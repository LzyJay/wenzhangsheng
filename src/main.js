/**
 * main.js —— 渲染层启动入口（装配层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 职责：把"系统（纯逻辑）"与"界面（DOM 面板 + Phaser 场景）"接起来。
 *   · 装配：SaveSystem 异步读档 → RootSystem / CultivationSystem → Phaser 启动
 *   · 数据流（项目文件结构 §三）：本文件收集输入 → 调 systems 方法 → 渲染面板 → 通知场景播演出
 * 注意：本文件是唯一允许同时接触 DOM 与 systems 的地方；场景不碰状态，系统不碰 DOM。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import PreloadScene from './scenes/PreloadScene.js'
import MainScene from './scenes/MainScene.js'
import CultivationSystem from './systems/CultivationSystem.js'
import SaveSystem, { APP_VERSION } from './systems/SaveSystem.js'
import RootSystem from './systems/RootSystem.js'
import LifespanSystem from './systems/LifespanSystem.js'
import TechniqueSystem from './systems/TechniqueSystem.js'
import AlchemySystem from './systems/AlchemySystem.js'
import SectSystem from './systems/SectSystem.js'
import BeastSystem from './systems/BeastSystem.js'
import WorldSystem from './systems/WorldSystem.js'
import EventSystem from './systems/EventSystem.js'
import DungeonSystem from './systems/DungeonSystem.js'
import MarketSystem from './systems/MarketSystem.js'
import AchievementSystem from './systems/AchievementSystem.js'
import { RECYCLE_RATE } from './data/market.js'
import { getLevelInfo, getRealmMeta, getNextBreakthrough, REALM_META, TRIBULATION } from './data/realms.js'
import { DRAW_ANIMATION, XISUI_DROP, REROLL_PITY, ROOT_TIERS, HIDDEN_ROOT, HIDDEN_CHANCE } from './data/roots.js'
import { getItem, getUnit } from './data/items.js'
// 游戏历（主人 2026-09-19 口径：**现实 1 分钟 = 游戏 1 天**）——
// 界面上的**所有时间文案**统一走它；机制仍按现实时间推进（见 data/gametime.js 头注）。
import { fmtGameDuration, fmtGameClock, fmtGameStamp, fmtGameDate, fmtRefreshPeriod, msToNextRefresh, gameClockOf } from './data/gametime.js'
import { TIER_MAP, maxRatePct, maxCombatPct, getTechnique } from './data/techniques.js'
import { stoneHourly, QUALITY_COLOR } from './data/events.js'
import { LIFESPAN } from './data/lifespan.js'
import { getRealmLook } from './data/appearance.js'   // 3.1 角色表现
import { BREAKTHROUGH_FX } from './data/fx.js'        // 3.2 演出：成功飘字推迟到文案浮现同拍
import {
  MODE_NAMES, WEATHER_SETTINGS, PHASE_SETTINGS,
  nextMode, resolveAmbienceMode, ambienceView, viewKey
} from './data/ambience.js'                           // 3.3 氛围系统
import { SKIN_IDS, SKIN_AUTO, resolveSkin } from './data/themes.js'  // 3.4 UI 动效与主题（皮肤）
import {
  MOTION, MOTION_SETTINGS, MOTION_NAMES, resolveMotionMode, rollDisplay
} from './data/motion.js'                             // 3.4 UI 动效与主题（动效纪律）
import SfxEngine from './audio/SfxEngine.js'          // 3.5 音效与音乐（程序化合成引擎）
import { VOLUME_NAMES, nextTier, gainOfTier, DEFAULT_TIER } from './data/sfx.js'

const TICK_MS = 100            // 挂机结算间隔（按秒速率连续入账，进度条因此顺滑）
const AUTOSAVE_MS = 30000      // 自动存档间隔（设计口径：30 秒 + 关键节点）
const STARTUP_DELAY = 900      // 等场景订阅完成后再补发启动演出
const TRIBULATION_FX_MS = 1560 // 三道天雷演出时长（3×460ms 劈落 + 收势），飘字与结算余韵在此之后
const RETURN_CARD_MS = 5000    // 闭关归来结算卡自动收起时长
const TIP_HOVER_MS = 90        // 悬停多久出明细（避免鼠标一掠而过就弹）

/** 系统「减弱动态」：DOM 由 CSS 媒体查询处理，Phaser 侧读这个常量 */
const REDUCED_MOTION = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

// ── 桌面桥（preload 暴露；浏览器开发模式下为 null）────────────────────────
const desktop = (typeof window !== 'undefined' && window.desktop) || null
const bridge = (desktop && desktop.save) ? desktop.save : null

const save = new SaveSystem(bridge)

let state = null
let cult = null
let roots = null
let tech = null
let alchemy = null
let sect = null
let beasts = null
let world = null
let events = null
let dungeon = null
let market = null
let achv = null
let life = null
let game = null
let offlineMode = false
let rootBusy = false
let worldBusy = false

// 场景就绪前的事件先入队，避免丢失
const pendingEvents = []

function emit (name, payload = null, delay = 0) {
  if (!game) { pendingEvents.push([name, payload]); return }
  if (delay > 0) setTimeout(() => game.events.emit(name, payload), delay)
  else game.events.emit(name, payload)
}

const emitFloat = (payload, delay = 0) => emit('cult:float', payload, delay)
const emitBurst = (payload, delay = 0) => emit('cult:burst', { kind: 'breakthrough', ...payload }, delay)

// ══ 3.1 角色表现 装配区（仅本函数 + doBreakthrough 一行 + 启动下发一行）══════
// 境界外观（圆光/服饰色/呼吸节律）完全由境界等级派生，无存档子树：
// 启动与"破境续命"各下发一次 'realm:look'；场景 create 时另自读 window.__wcs 兜初值。
function emitRealmLook (delay = 0) {
  if (!state) return
  emit('realm:look', getRealmLook(state.player.realm.level), delay)
}

// 挂机偶得材料（2.2）：检测库存变化并给一个轻飘字（离线结算不在此列）
let lastMatSnap = null
const MAT_NAMES = { mat_lingcao: '灵草', mat_kuang: '玄铁矿', mat_yaodan: '妖丹' }
function notifyMatDrops () {
  const items = state && state.inventory && state.inventory.items
  if (!items) return
  const snap = JSON.stringify(items)
  if (lastMatSnap === null) { lastMatSnap = snap; return }
  if (snap === lastMatSnap) return
  try {
    const prev = JSON.parse(lastMatSnap)
    for (const [id, name] of Object.entries(MAT_NAMES)) {
      const delta = ((items[id] | 0) - (prev[id] | 0))
      if (delta > 0) emitFloat({ text: `${name} +${delta}`, kind: 'info' })
    }
  } catch { /* 快照异常就跳过这一次提示 */ }
  lastMatSnap = snap
}

// 中部可用区（#mid）→ 场景：立绘以此为硬边界全身入画（不遮头/不压按钮）。
// 场景层不碰 DOM，几何由装配层（本文件）测量后下发；窗口缩放与面板高度变化都会重测。
function syncMidMetrics () {
  if (!dom || !dom.mid) return
  const r = dom.mid.getBoundingClientRect()
  emit('layout:mid', { top: r.top, bottom: r.bottom })
}

/**
 * 内容遮罩的落点 = 修行日志面板的实际矩形（主人 2026-09-17：遮罩只盖日志区，
 * 上方的修炼界面不被遮盖）。把矩形写进 :root 的 --ov-* 变量，全部 .ov 一次生效；
 * 窗口缩放、日志行数自适应都会改变矩形，故随 resize 与 1s 心跳一起刷新。
 */
function syncOverlayZone () {
  const zone = dom.logPanel
  if (!zone) return
  const r = zone.getBoundingClientRect()
  const root = document.documentElement
  root.style.setProperty('--ov-left', Math.round(r.left) + 'px')
  root.style.setProperty('--ov-top', Math.round(r.top) + 'px')
  root.style.setProperty('--ov-right', Math.round(window.innerWidth - r.right) + 'px')
  root.style.setProperty('--ov-bottom', Math.round(window.innerHeight - r.bottom) + 'px')
}

window.addEventListener('resize', () => { syncMidMetrics(); syncOverlayZone() })
setInterval(() => { syncMidMetrics(); syncOverlayZone() }, 1000)

// ── DOM ───────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id)
const dom = {
  realmName: el('realm-name'),
  rootChip: el('root-chip'),
  worldChip: el('world-chip'),
  stone: el('stone-text'),
  qiText: el('qi-text'),
  qiRate: el('qi-rate'),
  lifeText: el('life-text'),
  lifeProgress: el('life-progress'),
  progress: el('qi-progress'),
  ticks: el('progress-ticks'),
  btn: el('btn-breakthrough'),
  btnLabel: el('btn-label'),
  btnRate: el('btn-rate'),
  bubble: el('confirm-bubble'),
  bubbleRate: el('bubble-rate'),
  bubblePrep: el('bubble-prep'),
  btnStrike: el('btn-strike'),
  btnWait: el('btn-wait'),
  returnCard: el('return-card'),
  rcAway: el('rc-away'),
  rcGain: el('rc-gain'),
  btnSettings: el('btn-settings'),
  panelOverlay: el('panel-overlay'),
  panelClose: el('btn-panel-close'),
  tabs: Array.from(document.querySelectorAll('#panel-head .tab')),
  panes: Array.from(document.querySelectorAll('#panel-body .pane')),
  tgPause: el('tg-pause'),
  tgSound: el('tg-sound'),
  tgAvatar: el('tg-avatar'),
  tgTop: el('tg-top'),
  tgAutoBreak: el('tg-autobreak'),
  tgAutoEgg: el('tg-autoegg'),
  tgAmbience: el('tg-ambience'),         // 3.3 氛围：自动 / 全开 / 静态 / 关闭
  tgWeather: el('tg-weather'),           // 3.3 天气：自动 / 晴 / 雨 / 雪 / 霞
  tgDayphase: el('tg-dayphase'),         // 3.3 昼夜：自动 / 晨 / 昼 / 暮 / 夜
  vAmbienceLoad: el('v-ambience-load'),  // 3.3 负载档展示（自动降载）
  vMotion: el('v-motion'),               // 3.4 系统「减弱动态」实测值（只读展示）
  tgMotion: el('tg-motion'),             // 3.4 动效总档：全开 / 自动 / 静态
  tgSkin: el('tg-skin'),                 // 3.4 皮肤：鎏金 / 朱砂 / 玄墨 / 月白 / 随世界
  tgVolSfx: el('tg-vol-sfx'),            // 3.5 音效音量：低 / 中 / 高
  tgVolBgm: el('tg-vol-bgm'),            // 3.5 音乐音量：低 / 中 / 高
  vSavePath: el('v-savepath'),
  vSavePath2: el('v-savepath2'),
  vSaveMeta: el('v-save-meta'),
  vBakMeta: el('v-bak-meta'),
  vAppVersion: el('v-app-version'),
  btnReveal: el('btn-reveal'),
  btnRestore: el('btn-restore'),
  btnExport2: el('btn-export2'),
  btnImport2: el('btn-import2'),
  btnReset2: el('btn-reset2'),
  bagList: el('bag-list'),
  bagNote: el('bag-note'),
  bagOverlay: el('bag-overlay'),
  btnBagClose: el('btn-bag-close'),
  btnBag: el('btn-bag'),
  // 丹房（独立遮罩；主人 2026-09-17：背包与丹房界面分离）
  btnAlchemy: el('btn-alchemy'),
  alchemyOverlay: el('alchemy-overlay'),
  btnAlchemyClose: el('btn-alchemy-close'),
  alchemyMats: el('alchemy-mats'),
  brewList: el('brew-list'),
  brewNote: el('brew-note'),
  btnTech: el('btn-tech'),
  techOverlay: el('tech-overlay'),
  btnTechClose: el('btn-tech-close'),
  techSlots: el('tech-slots'),
  techOwned: el('tech-owned'),
  techCatalog: el('tech-catalog'),
  techNote: el('tech-note'),
  // 宗门（2.4）
  btnSect: el('btn-sect'),
  sectOverlay: el('sect-overlay'),
  btnSectClose: el('btn-sect-close'),
  sectInfo: el('sect-info'),
  sectTasks: el('sect-tasks'),
  sectLibrary: el('sect-library'),
  sectShop: el('sect-shop'),
  sectNote: el('sect-note'),
  // 灵兽（2.8）
  btnBeast: el('btn-beast'),
  beastOverlay: el('beast-overlay'),
  btnBeastClose: el('btn-beast-close'),
  beastInfo: el('beast-info'),
  beastDispatch: el('beast-dispatch'),
  beastEggs: el('beast-eggs'),
  beastPark: el('beast-park'),
  beastNote: el('beast-note'),
  // 秘境（2.7）
  btnDungeon: el('btn-dungeon'),
  dungeonOverlay: el('dungeon-overlay'),
  btnDungeonClose: el('btn-dungeon-close'),
  dungeonTower: el('dungeon-tower'),
  dungeonRes: el('dungeon-res'),
  dungeonDispatch: el('dungeon-dispatch'),
  dungeonNote: el('dungeon-note'),
  // 事件簿（2.3）
  btnTrial: el('btn-trial'),
  trialOverlay: el('trial-overlay'),
  btnTrialClose: el('btn-trial-close'),
  btnTrialCure: el('btn-trial-cure'),
  btnTrialGo: el('btn-trial-go'),
  trialNode: el('trial-node'),
  trialPreps: el('trial-preps'),
  trialNote: el('trial-note'),
  // 事件并入「事件与纪事」一册（主人 2026-09-18/19）：原 #event-overlay 与页签制已撤，同页呈现
  eventLuck: el('event-luck'),
  eventPending: el('event-pending'),
  eventBook: null,          // V3.5.1：近事录区块撤（事件并入纪事流），引用留空防旧代码误用
  eventNote: null,          // 同上
  stratPills: Array.from(document.querySelectorAll('.strat-pill')),
  // 坊市（2.6）
  btnMarket: el('btn-market'),
  marketOverlay: el('market-overlay'),
  btnMarketClose: el('btn-market-close'),
  marketTabs: Array.from(document.querySelectorAll('.bag-tab[data-markettab]')),
  marketShop: el('market-shop'),
  marketRecycle: el('market-recycle'),
  marketAuction: el('market-auction'),
  marketShopPage: el('market-shop-page'),
  marketRecyclePage: el('market-recycle-page'),
  marketAuctionPage: el('market-auction-page'),
  marketNote: el('market-note'),
  // 事件与纪事（2.10 + 2.3 同页）／成就与称号（另立一册）
  btnChronicle: el('btn-chronicle'),
  chronicleOverlay: el('chronicle-overlay'),
  btnChronicleClose: el('btn-chronicle-close'),
  btnGotoAchv: el('btn-goto-achv'),
  btnAchv: el('btn-achv'),
  achvOverlay: el('achv-overlay'),
  btnAchvClose: el('btn-achv-close'),
  achvTabs: Array.from(document.querySelectorAll('.bag-tab[data-achvtab]')),
  achvNote: el('achv-note'),
  chrFilter: el('chr-filter'),
  chrFilterPills: Array.from(document.querySelectorAll('.chr-pill')),
  logMeta: el('log-meta'),
  logOffline: el('log-offline'),
  powerWrap: el('power-wrap'),
  powerText: el('power-text'),
  achvHead: el('achv-head'),
  chrList: el('chr-list'),
  achvWall: el('achv-wall'),
  titleList: el('title-list'),
  chrNote: el('chr-note'),
  titleChip: el('title-chip'),
  buffChips: el('buff-chips'),
  logPanel: el('log-panel'),
  achvToast: el('achv-toast'),
  // BGM（设计库 06-BGM；顶栏「乐」键）
  btnBgm: el('btn-bgm'),
  btnThrough: el('btn-through'),
  btnLock: el('btn-lock'),
  btnTop: el('btn-top'),
  tgThrough: el('tg-through'),
  tgLock: el('tg-lock'),
  tip: el('tip'),
  ctHotspot: el('ct-hotspot'),
  mid: el('mid'),
  realmWrap: el('realm-name'),
  rootChipWrap: el('root-chip'),
  stoneWrap: el('stone-wrap'),
  lifeTrack: el('life-track'),
  progressTrack: el('progress-track'),
  btnHide: el('btn-hide'),
  btnExport: el('btn-export'),
  btnImport: el('btn-import'),
  btnReset: el('btn-reset'),
  log: el('log'),
  overlay: el('root-overlay'),
  btnDraw: el('btn-draw-root'),
  btnRootOk: el('btn-root-ok'),
  rootResultName: el('root-result-name'),
  rootResultTrait: el('root-result-trait'),
  rootResultMods: el('root-result-mods'),
  rootResultPity: el('root-result-pity'),
  worldOverlay: el('world-overlay'),
  btnDrawWorld: el('btn-draw-world'),
  btnWorldReroll: el('btn-world-reroll'),
  btnWorldOk: el('btn-world-ok'),
  worldResultName: el('world-result-name'),
  worldResultTag: el('world-result-tag'),
  worldResultMods: el('world-result-mods'),
  worldResultDesc: el('world-result-desc'),
  worldResultExclusive: el('world-result-exclusive'),
  worldResultFriction: el('world-result-friction')
}

// ── 数值格式化（显示层统一：<1万 整数 / ≥1万 X.XX万 / ≥1亿 X.XX亿 / ≥1万亿 X.XX万亿）──
function fmt (n) {
  if (!Number.isFinite(n)) return '∞'
  const abs = Math.abs(n)
  if (abs < 1e4) return String(Math.floor(n))
  if (abs < 1e8) return (n / 1e4).toFixed(2) + '万'
  if (abs < 1e12) return (n / 1e8).toFixed(2) + '亿'
  return (n / 1e12).toFixed(2) + '万亿'
}

function fmtRate (n) {
  if (!Number.isFinite(n)) return '∞'
  return Math.abs(n) < 100 ? n.toFixed(2) : fmt(n)
}

/**
 * 时间文案（主人 2026-09-17：游戏内一律用游戏历，不再显示现实时钟）
 *   · fmtClock   → 日志 / 事件簿行首：`3/12·午时`
 *   · fmtDuration→ 还差多久 / 剩余多久：`30 天`、`6.0 月`、`2.50 年`
 * 现实时间只保留给"文件系统事实"（存档 mtime、导出文件名，见下方 fmtDateTime / fmtStamp）。
 */
function fmtClock (ts) {
  return fmtGameStamp(ts)
}

function fmtDuration (ms) {
  return fmtGameDuration(ms)
}

function fmtStamp () {
  const d = new Date()
  const p = (v) => String(v).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/**
 * 现实时长文案（主人 2026-09-18）：挂机 / 离线是"现实里过了多久"，
 * 与游戏历（fmtGameDuration）分开，避免把 12 分钟读成十几天的笑话。
 * `3小时12分` / `14分27秒` / `47秒`
 */
function fmtRealSpan (ms) {
  const v = Math.max(0, Math.round(Number(ms) || 0))
  if (v < 1000) return '0秒'
  const totalSec = Math.floor(v / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}小时${String(m).padStart(2, '0')}分`
  if (m > 0) return `${m}分${String(s).padStart(2, '0')}秒`
  return `${s}秒`
}

/** 当前挂机（在线）总时长：meta.playtimeSec 为准（离线不计） */
function playtimeSec () {
  return (state && state.meta && (state.meta.playtimeSec | 0)) || 0
}

/**
 * 当前战力构成（主人 2026-09-19：功法也影响战力）
 *   基准（境界表）× (1 + 功法战力%) × (1 + 灵兽出战%)
 * —— 与注入给 SectSystem / DungeonSystem 的 powerMul 闭包同口径，三处不会各算各的。
 */
function powerBreakdown () {
  const base = getLevelInfo(state.player.realm.level).combat.power
  const techPct = tech ? tech.combatPct() : 0
  const petPct = beasts ? beasts.powerBonusPct() : 0
  return { base, techPct, petPct, total: Math.round(base * (1 + techPct) * (1 + petPct)) }
}

/** 战力乘区闭包（注入给宗门 / 秘境，避免它们横向 import 功法 / 灵兽） */
function powerMulClosure () {
  return () => {
    const techPct = tech ? tech.combatPct() : 0
    const petPct = beasts ? beasts.powerBonusPct() : 0
    return (1 + techPct) * (1 + petPct)
  }
}

/**
 * 离线台账（主人 2026-09-19）：
 *   顶栏只显示「累计离线多久」；上次离线的时长 / 收益 / 占挂机收益百分比
 *   全部收进 #log-offline 的交互浮层（TIP_BUILDERS.offline）。
 */
function offlineInfo () {
  const off = (state && state.offline) || {}
  return {
    totalMs: off.totalAwayMs | 0,
    awayMs: off.awayMs | 0,
    gain: (off.pending && off.pending.gainQi) || 0,
    count: off.awayCount | 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 数值明细浮层（#tip）：界面上"显示出来的值"一律可交互
//   · 悬停 → 出明细；点击 → 钉住（点空白或 Esc 收起），方便触摸与逐项核对
//   · 明细内容每次打开都现算，保证浮层里的数字与画面上的数字永远一致
// ═══════════════════════════════════════════════════════════════════════════

let tipPinned = false
let tipKey = null
let tipAnchor = null
let tipTimer = null

/**
 * 面板内动作绑定：一律用 **pointerdown**，不用 click。
 * 为什么（主人 2026-09-18 反馈「洗髓按钮点不动」的根因）：
 *   这些面板的数字每秒（明细浮层每 100ms）重绘一次，innerHTML 一换，
 *   按下时那个按钮实例就没了 —— 真人一次点击的 mousedown / mouseup 落在两个不同实例上，
 *   click 永远不会触发（JS 里 el.click() 却测不出来，所以自测全绿而主人点不动）。
 *   pointerdown 在"按下瞬间"就派发，重绘抢不走它；同时 preventDefault，
 *   让浏览器不再补发 click，避免同一次操作触发两遍。
 */
function onPress (node, handler) {
  if (!node) return
  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return          // 只认左键
    handler(e)
    e.preventDefault()
    e.stopPropagation()
  })
}

const tipRow = (k, v, cls = '') => `<div class="t-r"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`
/** 三栏行（V3.5.1 灵根浮层：灵根 ｜ 修炼速度 ｜ 概率，主人要求标题分三栏、各档速度必须可见） */
const tipRow3 = (k, m, v, cls = '') => `<div class="t-r3"><span class="k">${k}</span><span class="m">${m}</span><span class="v ${cls}">${v}</span></div>`
const pct1 = (v) => `${(v * 100).toFixed(1)}%`
const pct0 = (v) => `${Math.round(v * 100)}%`

const TIP_BUILDERS = {
  /** 境界：这一境有什么、下一关口在哪 */
  realm () {
    const lv = state.player.realm.level
    const info = getLevelInfo(lv)
    const meta = getRealmMeta(Math.floor((lv - 1) / 9))
    const preview = cult.getBreakthroughPreview(Date.now())
    const trial = preview.isTrial ? '（渡劫 · 三道天雷过二即成）' : ''
    const gate = preview.ascended
      ? '已飞升 · 静待二期'
      : `${preview.plan.label} → ${preview.plan.targetName}　${preview.isTrial ? pct1(preview.probability) : pct0(preview.probability)}${trial}`
    return `<span class="t-h">${info.displayName}</span>` +
      tipRow('大境界', `${meta.name}（第 ${Math.floor((lv - 1) / 9) + 1} / ${REALM_META.length} 境）`, 'gold') +
      tipRow('本级重数', `第 ${(lv - 1) % 9 + 1} / 9 重`) +
      tipRow('本境寿元上限', `${meta.lifespanYears} 年`, 'jade') +
      tipRow('基准产出', `${fmt(info.output.qiPerSec)} /秒`, 'gold') +
      tipRow('基准战力', fmt(info.combat.power)) +
      tipRow('下一关口', gate) +
      `<span class="t-note">72 级 = 8 境 × 9 重；每境第 3、6 重是小瓶颈，第 9 重是渡劫关口。</span>`
  },

  /**
   * 灵根：详情 + 各档概率 + 洗髓（原顶栏「洗髓丹 ×N」按钮已并到这里）
   * 主人 2026-09-17 要求：洗髓丹的各灵根概率、以及"重复使用会不会变差"必须写明。
   *   结论＝只会变好：每次重掷高资质权重上浮（伪灵根最低压到 5%），
   *   漂移上限 REROLL_PITY.maxSteps 次；累计 hardGuaranteeAt 次未出变异及以上 → 下次必出。
   */
  root () {
    // 隐藏灵根行（V3.5.1 · 主人：以「？？？」展示，不入常规概率）
    const hiddenRow = (vText, cls = 'violet') => tipRow3(
      `<span style="color:${HIDDEN_ROOT.color}">？？？</span>`,
      `×${HIDDEN_ROOT.mods.rateMul.toFixed(2)}`,
      vText,
      cls
    )
    if (!roots.drawn) {
      const baseTotal = ROOT_TIERS.reduce((s, x) => s + x.weight, 0)
      // V3.5.1（主人）：标题分三栏 —— 灵根 ｜ 修炼速度 ｜ 概率；每档速度独立成列
      const baseRows = ROOT_TIERS.map((x) => tipRow3(
        x.name,
        `×${x.mods.rateMul.toFixed(2)}`,
        `${Math.round((x.weight / baseTotal) * 100)}%`
      )).join('') + hiddenRow('彩蛋')
      return '<span class="t-h">灵根 · 尚未测出</span>' +
        `<span class="t-h" style="margin-top:4px">灵根 ｜ 修炼速度 ｜ 概率</span>` + baseRows +
        `<span class="t-note">修炼速度＝灵气产出的乘区（×2.00 就是两倍快）。未测灵根前不吐纳：修为不会增长。<br />` +
        `「？？？」是传说中的隐藏灵根——不在常规概率里，只在洗髓硬保底就绪后的那次掷里小概率现身。<br />` +
        `断根之后可用洗髓丹重掷 —— 重掷只会把高资质概率往上抬，绝不会把已有资质改差。</span>` +
        `<div class="t-act"><button class="violet" data-act="draw-root">开 始 测 灵 根</button></div>`
    }
    const t = roots.tier
    const pills = roots.pillCount
    const hardLeft = Math.max(0, REROLL_PITY.hardGuaranteeAt - roots.lowStreak)
    const p = roots.previewReroll()
    const probRows = ROOT_TIERS.map((x) => tipRow3(
      x.name + (x.rarity === t.rarity ? '（现在）' : ''),
      `×${x.mods.rateMul.toFixed(2)}`,
      `${(p.prob[x.rarity] * 100).toFixed(1)}%`,
      x.rarity === t.rarity ? 'violet' : ''
    )).join('') + hiddenRow(p.hiddenReady ? `${(HIDDEN_CHANCE * 100).toFixed(1)}%` : '——')
    const step = REROLL_PITY.step
    const drift = `伪灵根 ${step.false} ／ 真 ${step.true >= 0 ? '+' : ''}${step.true} ／ 变异 +${step.mutant} ／ 天 +${step.heaven}`
    // 各档修炼速度差（主人 2026-09-18：把差距写明白）
    const rateOf = Object.fromEntries(ROOT_TIERS.map((x) => [x.rarity, x.mods.rateMul]))
    const spread = (rateOf.heaven / rateOf.false).toFixed(1)
    const act = pills > 0
      ? `<button data-act="reroll-root"${rootBusy ? ' disabled' : ''}>洗 髓 重 掷 · 消耗 1 枚</button>`
      : '<button disabled>洗髓丹不足（渡劫成功可得 · 丹房可炼）</button>'
    return `<span class="t-h" style="color:${t.color}">${roots.displayName}</span>` +
      tipRow('品阶', t.name, 'violet') +
      tipRow('属性', roots.attrLabel || '—', 'violet') +
      tipRow('特质', t.trait) +
      tipRow('修炼速度', `×${t.mods.rateMul.toFixed(2)}（灵气产出同乘此数）`, 'violet') +
      tipRow('突破成本', `×${t.mods.costMul.toFixed(2)}`, 'violet') +
      `<span class="t-h" style="margin-top:6px">灵根 ｜ 修炼速度 ｜ 洗髓概率（下一次实际值）</span>` + probRows +
      tipRow('洗髓丹库存', `${pills} 枚`, 'gold') +
      tipRow('累计洗髓', `${roots.rerollCount} 次`) +
      tipRow('距硬保底', hardLeft === 0
        ? '已触发 · 下一次必出变异 / 天灵根（或 ？？？彩蛋）'
        : `还需 ${hardLeft} 次未出高资质即触发`) +
      `<div class="t-act">${act}</div>` +
      `<span class="t-note">` +
      `修炼速度差距：天灵根 ×${rateOf.heaven.toFixed(2)} 是伪灵根 ×${rateOf.false.toFixed(2)} 的 <b>${spread} 倍</b> —— 好资质是真的快。<br />` +
      `每洗一次权重漂移 ${drift}（伪灵根最低压到 ${REROLL_PITY.minWeight.false}%），漂移上限 ${REROLL_PITY.maxSteps} 次；` +
      `累计 ${REROLL_PITY.hardGuaranteeAt} 次未出变异及以上，则下一次必出变异或天灵根，并另有 ${(HIDDEN_CHANCE * 100).toFixed(0)}% 机会揭开「？？？」的真身。<br />` +
      `<b>重复使用不会变差</b>：漂移只会抬高变异与天灵根的权重、压低伪灵根，已得的资质也不会被改坏；只是每次都要花 1 枚洗髓丹。` +
      `</span>`
  },

  /** 世界：十二界词条 + 修正（2.9） */
  world () {
    const v = world && world.drawn ? world.view() : null
    if (!v) {
      return '<span class="t-h">世界 · 尚未抽定</span>' +
        tipRow('十二界', '青岚 · 破晓 · 灯火 · 青云 · 望族 · 幽傩 · 通天 · 天工 · 六面 · 九鼎 · 武元 · 香火') +
        `<span class="t-note">每局从十二界等概率抽一界开局；产出 / 寿元 / 天劫各有修正。</span>` +
        `<div class="t-act"><button class="violet" data-act="draw-world">抽 取 世 界</button></div>`
    }
    const trialLine = v.trialMul !== 1 ? tipRow('天劫强度', `×${v.trialMul.toFixed(2)}`, 'violet') : ''
    const masteryLine = v.masteryPct ? tipRow('轮回熟练', `+${Math.round(v.masteryPct * 100)}%`, 'gold') : ''
    return `<span class="t-h" style="color:${v.color}">${v.name}</span>` +
      tipRow('标签', v.tag, 'gold') +
      tipRow('开局身份', v.identity) +
      tipRow('灵气产出', `×${v.baseRateMul.toFixed(2)}`, 'violet') +
      tipRow('寿元流速', `×${(v.lifespanMul || 1).toFixed(2)}（基准 1 现实分钟 = 1 游戏天）`) +
      trialLine +
      masteryLine +
      tipRow('专属', v.exclusive) +
      tipRow('摩擦', v.friction) +
      `<span class="t-note">同界轮回熟练度每世 +3%（封顶 +15%）；界游符可换界（版本 2）。</span>`
  },

  /** 修为：产出乘区拆解 + 还差多久（限时增益的明细也在这里，不再占顶栏小牌） */
  qi () {
    const now = Date.now()
    const preview = cult.getBreakthroughPreview(now)
    const rate = cult.getEffRate(now)
    const finite = Number.isFinite(preview.need)
    const missing = finite ? Math.max(0, preview.need - state.resources.qi) : 0
    // 主人 2026-09-18：古宝残片等限时增益的「栏位」取消 —— 明细直接列在修为浮层里
    const buffRows = (state.buffs || [])
      .filter((b) => (b.endsAt || Infinity) > now && ((b.mods && b.mods.qiRatePct) || 0) !== 0)
      .map((b) => {
        const pct = b.mods.qiRatePct
        const left = Number.isFinite(b.endsAt) ? `　剩 ${fmtRealSpan(b.endsAt - now)}` : '　常在'
        return tipRow(b.name, `${pct > 0 ? '+' : '−'}${Math.abs(Math.round(pct * 100))}%${left}`, pct > 0 ? 'gold' : 'warn')
      }).join('')
    return '<span class="t-h">修为</span>' +
      tipRow('当前持有', fmt(state.resources.qi), 'gold') +
      tipRow('升至下一级', finite ? fmt(preview.need) : '已至圆满', 'gold') +
      tipRow('还差', finite ? fmt(missing) : '—') +
      tipRow('本级进度', pct1(preview.progress)) +
      tipRow('修为积累加成', `+${(preview.surplus.bonus * 100).toFixed(1)}%（富余 ×${preview.surplus.overflow.toFixed(2)}，境界衰减 ×${preview.surplus.decay.toFixed(2)}）`, 'gold') +
      tipRow('基础产出', `${fmtRate(rate.base)} /秒`) +
      tipRow('灵根倍率', `×${rate.rootMul.toFixed(2)}`, 'violet') +
      tipRow('功法加成', `+${(rate.techPct * 100).toFixed(0)}%（×${(1 + rate.techPct).toFixed(2)}）`, 'gold') +
      tipRow('契合加成', `×${rate.parts.fit.toFixed(2)}（${life ? life.fitTier.name : '凡常'}）`, 'gold') +
      tipRow('增益合计', `${rate.parts.buff >= 0 ? '+' : ''}${(rate.parts.buff * 100).toFixed(0)}%`) +
      (buffRows ? `<span class="t-h" style="margin-top:4px">增益明细</span>${buffRows}` : '') +
      tipRow('实际产出', `${fmtRate(rate.eff)} /秒`, 'gold') +
      tipRow('预计还需', finite && rate.eff > 0 ? fmtDuration((missing / rate.eff) * 1000) : '—') +
      `<span class="t-note">目标关口：${preview.plan.label} → ${preview.plan.targetName}${preview.isTrial ? '（渡劫关口）' : ''}<br />进度条三个刻度＝三成 / 六成 / 圆满；末刻度在本关为小瓶颈或渡劫时转红。</span>`
  },

  /** 战力：构成与用途（主人 2026-09-18：战力移到寿元条左下方；09-19：功法计入战力） */
  power () {
    const lv = state.player.realm.level
    const info = getLevelInfo(lv)
    const b = powerBreakdown()
    return '<span class="t-h">战力</span>' +
      tipRow('当前战力', fmt(b.total), 'gold') +
      tipRow('基准战力', fmt(b.base)) +
      (b.techPct ? tipRow('功法加成', `+${(b.techPct * 100).toFixed(1)}%（×${(1 + b.techPct).toFixed(3)}）`, 'gold') : '') +
      (b.petPct ? tipRow('灵兽出战', `+${Math.round(b.petPct * 100)}%`, 'gold') : '') +
      (!b.techPct && !b.petPct ? tipRow('加成', '暂无（装备功法 / 出战灵兽即计入）') : '') +
      tipRow('随境界', `${info.displayName}（${getRealmMeta(Math.floor((lv - 1) / 9)).name}期）`) +
      `<span class="t-note">用途：秘境试炼塔与资源秘境的战力门槛、宗门战力校验类任务的成败判定（接取时定标，成长有回报）。<br />` +
      `功法战力按品阶递增：凡阶每级 +0.4%，天阶每级 +4%（满级三槽合计可达 +90% 上下）。</span>`
  },

  /** 寿元：为什么在减少、什么时候回满 + 2.11 天道契合 / 天机榜 */
  life () {
    const lv = state.player.realm.level
    const realmIdx = Math.floor((lv - 1) / 9)
    const meta = getRealmMeta(realmIdx)
    const next = getRealmMeta(Math.min(REALM_META.length - 1, realmIdx + 1))
    const spent = Math.max(0, meta.lifespanYears - life.remainYears)
    const nextLine = realmIdx >= REALM_META.length - 1
      ? tipRow('破境后续命', '已至最高境', 'gold')
      : tipRow(`破境后（${next.name}）`, `上限 ${next.lifespanYears} 年`, 'gold')

    // 2.11 天道契合（顺天值六档，产出与渡劫双重修正）
    const fv = life.fitView()
    const t = fv.tier
    const sign = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`
    const fitLines =
      tipRow('天道契合', `${fv.fit} / 100 · ${t.name}`, 'violet') +
      tipRow('契合加成', `产出 ${sign(t.cultPct)}｜渡劫单雷 ${sign(t.trialPct)}`) +
      (fv.next ? tipRow('下一档', `${fv.next.name}（${fv.next.min} 起 · 还差 ${fv.nextGap} 点）`) : '')

    // 2.11 天机榜（增补 v1.1 样例任务，可循环 · 冷却 30 分钟）
    const quests = life.questViews({ nowMs: Date.now(), power: sect ? sect.power : 0 })
    const questLines = quests.map((q) => {
      const cd = q.state === 'cd' ? `（冷却 ${fmtDuration(q.cdSec * 1000)}）` : ''
      const act = q.state === 'ready'
        ? `<div class="t-act"><button data-act="fit-claim" data-quest="${q.id}">完 成 · 契合 +${q.fit}</button></div>`
        : ''
      return tipRow(`天机榜 · ${q.name}`, `${q.progressText}${cd}`) + act
    }).join('')

    // 2.11 延寿丹接线（丹房可炼 / 坊市有售）
    const pills = state.inventory.items.pill_yanshou | 0
    const lifeFull = life.remainYears >= life.maxYears - 0.005
    const yanshouAct = `<div class="t-act">${
      pills > 0
        ? `<button data-act="use-yanshou"${lifeFull ? ' disabled' : ''}>服 用 延 寿 丹 · 余寿 +${LIFESPAN.pill.daily} 年（存量 ${pills}）</button>`
        : '<button disabled>延寿丹不足（丹房可炼 · 坊市有售）</button>'
    }</div>`

    return '<span class="t-h">寿元 · 剩余可活年数</span>' +
      tipRow('余寿', `${life.remainText} 年`, 'jade') +
      tipRow('本境上限', `${life.maxText} 年`, 'jade') +
      tipRow('本境已历', `${spent.toFixed(2)} 年`) +
      tipRow('流逝速率', `1 现实秒 = ${world ? world.lifespanDays : LIFESPAN.gameDaysPerRealSecond} 游戏天`) +
      tipRow('照此还能撑', fmtDuration(life.remainingRealMs)) +
      nextLine +
      `<span class="t-h" style="margin-top:6px">天道契合</span>` + fitLines +
      `<span class="t-h" style="margin-top:6px">天机榜</span>` + questLines + yanshouAct +
      `<span class="t-note">寿元是倒计时：只有晋入新大境界才回满到该境上限（同境内的 1→9 重不续命）。顺天而行（天机榜 / 行善事件）涨契合，契合越高产出与渡劫越顺；延寿丹 +${LIFESPAN.pill.daily} 年，余寿将满时服用会溢散。</span>`
  },

  /** 灵石：用途与来源（点图标直接进背包） */
  stones () {
    return '<span class="t-h">灵石</span>' +
      tipRow('持有', fmt(state.resources.stones), 'gold') +
      tipRow('来源', '关卡突破奖励 · 秘境 · 事件') +
      tipRow('用途', '坊市 / 宗门 / 炼丹（阶段二）') +
      `<span class="t-note">点这颗灵石图标可直接打开背包。</span>`
  },

  /**
   * 离线：累计离线 + 上次离线明细 + 折算成挂机收益的百分比（主人 2026-09-19）
   *   顶栏只留"总共离线多久"；"上次离线上多久、拿回多少、相当于挂机的几成"都收在这里。
   */
  offline () {
    const off = (state && state.offline) || {}
    const totalMs = off.totalAwayMs | 0
    const awayMs = off.awayMs | 0
    const gain = (off.pending && off.pending.gainQi) || 0
    const count = off.awayCount | 0
    const effPct = typeof off.effPct === 'number' ? off.effPct : 0.5
    const capHours = off.capHours || 12

    if (!totalMs && !awayMs) {
      return '<span class="t-h">离线 · 尚无记录</span>' +
        `<span class="t-note">隐藏到托盘、关闭窗口或退出程序都算离线：回来时按离线系数补发修为。<br />` +
        `当前规则：离线收益 = 有效产出 × 离线时长 × ${Math.round(effPct * 100)}%（上限 ${capHours} 小时）。</span>`
    }

    // 折旧口径：拿"上次离线收益"比"同样久的在线挂机收益"
    const eff = cult.getEffRate(Date.now()).eff
    const activeQi = eff * (awayMs / 1000)
    const vsPct = activeQi > 0 ? (gain / activeQi) * 100 : 0

    return '<span class="t-h">离线结算</span>' +
      tipRow('累计离线', `${fmtRealSpan(totalMs)}${count ? `（${count} 次）` : ''}`, 'gold') +
      tipRow('上次离线', awayMs > 0 ? fmtRealSpan(awayMs) : '—') +
      tipRow('上次离线收益', awayMs > 0 ? `+${fmt(gain)} 修为` : '—', 'gold') +
      (awayMs > 0
        ? tipRow('占挂机收益', `≈ ${vsPct.toFixed(0)}%`, 'gold') +
          tipRow('同时长挂机本可得', fmt(activeQi)) +
          tipRow('折算参照', `＝挂机 ${fmtRealSpan(activeQi > 0 ? (gain / Math.max(1e-9, eff)) * 1000 : 0)} 的量`)
        : '') +
      `<span class="t-note">规则：离线收益 = 有效产出 × 离开时长 × <b>${Math.round(effPct * 100)}%</b>，` +
      `上限 ${capHours} 小时（超出部分不计）。<br />` +
      `因此"占同时长挂机收益"理想值就是 ${Math.round(effPct * 100)}%；` +
      `若离开超过上限，实际占比会低于此值。<br />` +
      `离线只补"打坐"这一条线：宗门俸禄 / 灵兽被动 / 素材偶得都要在场（在线）才结算。</span>`
  }
}

function openTip (key, anchor) {
  const build = TIP_BUILDERS[key]
  if (!build) return false
  tipKey = key
  tipAnchor = anchor
  const html = build()
  dom.tip.innerHTML = html
  // 带动作按钮的浮层要能点（默认 pointer-events:none，否则按钮点不到）
  dom.tip.classList.toggle('tip-act', /data-act=/.test(html))
  dom.tip.classList.add('show')
  positionTip(anchor)
  syncDragRegions()
  return true
}

/** 浮层定位：优先贴在元素下方，越界则翻到上方并横向夹回窗口内 */
function positionTip (anchor) {
  if (!anchor) return
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const r = anchor.getBoundingClientRect()
  const tw = dom.tip.offsetWidth
  const th = dom.tip.offsetHeight
  let left = r.left + r.width / 2 - tw / 2
  left = Math.max(4, Math.min(vw - tw - 4, left))
  let top = r.bottom + 5
  if (top + th > vh - 4) top = Math.max(4, r.top - th - 5)
  // #tip 挂在 #mid 内部（这样它才是拖拽区的"免拖拽子元素"，真鼠标才点得到），
  // 所以要把视口坐标换算成相对 #mid 的偏移
  const base = dom.mid.getBoundingClientRect()
  dom.tip.style.left = Math.round(left - base.left) + 'px'
  dom.tip.style.top = Math.round(top - base.top) + 'px'
}

/**
 * 任一浮层打开时，**中部**取消拖拽区（V3.5.1 收窄，主人：偶尔窗口拖不动）。
 * 为什么必须取消：Electron 里 `-webkit-app-region: drag` 的区域会把鼠标按下
 * 交给系统去拖动窗口，落在它上面的浮层按钮就"点不动"——而且 el.click() 测不出来，
 * 只有真人鼠标才会中招。
 * 为什么只取消 #mid：旧口径连 #topbar 一起摘，浮层/钉住的明细一多，
 * 整窗找不到拖拽把手 → "窗口拖不动"。顶栏交互子元素（.ix / .ico-btn /
 * .buff-chip / #btn-hide / #ct-hotspot）本就逐个 no-drag，不会复发坑 10；
 * 顶栏空白处保持 drag，窗口永远有地方可拖。
 */
function syncDragRegions () {
  // 内容遮罩一律带 .ov（含 #panel-overlay 与新增的 #alchemy-overlay）：
  // 一处判定即覆盖全部，杜绝"新遮罩忘登记"的坑 10 类隐患（§14.2 项 2 教训）。
  const open = !!(
    tipPinned ||
    document.querySelector('.ov.show') ||
    (dom.overlay && dom.overlay.classList.contains('show')) ||
    (dom.worldOverlay && dom.worldOverlay.classList.contains('show')) ||
    (dom.bubble && dom.bubble.classList.contains('show')) ||
    (dom.returnCard && dom.returnCard.classList.contains('show'))
  )
  document.body.classList.toggle('no-drag-all', open)
}

function closeTip () {
  clearTimeout(tipTimer)
  tipPinned = false
  tipKey = null
  tipAnchor = null
  dom.tip.classList.remove('show')
  dom.tip.classList.remove('tip-act')
  syncTipHighlight()
  syncDragRegions()
}

/** 钉住期间的数字要跟画面一起走（面板每 100ms 刷一次，浮层跟着刷） */
function refreshTip () {
  if (!tipPinned || !tipKey) return
  const build = TIP_BUILDERS[tipKey]
  if (!build) return
  // V3.5.1（主人：洗髓重掷按钮 hover 会闪烁）：重绘 innerHTML 会把按钮整个换掉，
  // 鼠标正悬停的实例一没，:hover 就断一拍 → 视觉上闪烁。
  // 处置：重绘后把旧动作区节点原样搬回来（节点不换，悬停态保持），
  //       只把新实例算出的 disabled / 文案 / 样式同步过去，状态不落后。
  const prevAct = dom.tip.querySelector('.t-act')
  const html = build()
  dom.tip.innerHTML = html
  if (prevAct) {
    const nextAct = dom.tip.querySelector('.t-act')
    if (nextAct && nextAct !== prevAct) {
      const nb = nextAct.querySelector('button')
      const ob = prevAct.querySelector('button')
      if (nb && ob) {
        ob.disabled = nb.disabled
        ob.textContent = nb.textContent
        ob.className = nb.className
        if (nb.title) ob.title = nb.title
        else ob.removeAttribute('title')
      }
      nextAct.replaceWith(prevAct)
    }
  }
  dom.tip.classList.toggle('tip-act', /data-act=/.test(html))
  positionTip(tipAnchor)
}

function syncTipHighlight () {
  for (const n of document.querySelectorAll('.ix')) {
    n.classList.toggle('ix-open', tipPinned && n === tipAnchor)
  }
}

function bindInteractive (node) {
  const key = node.dataset.tip
  if (!key) return
  // click 模式：只认点击（带动作按钮的浮层必须这样——鼠标移进浮层会离开锚点，
  //            悬停模式会立刻把它收起来，导致按钮点不到）
  const clickOnly = node.dataset.tipMode === 'click'

  if (!clickOnly) {
    node.addEventListener('mouseenter', () => {
      if (tipPinned) return
      clearTimeout(tipTimer)
      tipTimer = setTimeout(() => openTip(key, node), TIP_HOVER_MS)
    })
    node.addEventListener('mouseleave', () => {
      clearTimeout(tipTimer)
      if (!tipPinned) closeTip()
    })
  }

  node.addEventListener('click', (e) => {
    e.stopPropagation()
    clearTimeout(tipTimer)
    if (node.dataset.tipAction === 'bag') { closeTip(); openBag(); return }
    if (tipPinned && tipKey === key) { closeTip(); return }
    tipPinned = true
    if (!openTip(key, node)) { tipPinned = false; return }
    syncTipHighlight()
  })
}

// 浮层内的动作按钮：事件委托 + pointerdown（浮层每 100ms 重绘也不会丢这一次点击）
onPress(dom.tip, (e) => {
  e.stopPropagation()                       // 点浮层内部不算"点空白"，不要收起
  const btn = e.target.closest('[data-act]')
  if (!btn || btn.disabled) return
  const act = btn.dataset.act
  if (act === 'draw-root') { closeTip(); startRootDraw(); return }
  if (act === 'reroll-root') { doReroll(); return }   // 浮层保持打开，数字跟着刷新
  if (act === 'draw-world') { closeTip(); drawWorld(); return }
  // 2.11 天道契合：天机榜领奖（浮层保持打开）/ 服用延寿丹
  if (act === 'fit-claim') {
    const res = life.claimQuest(btn.dataset.quest, { nowMs: Date.now(), power: sect ? sect.power : 0 })
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) persist('fit-claim')
    return
  }
  if (act === 'use-yanshou') { doYanshou(); return }
})

for (const node of document.querySelectorAll('.ix')) bindInteractive(node)
// 点空白处收起钉住的浮层（.ix 的点击已 stopPropagation，不会误触发）
document.addEventListener('click', () => { if (tipPinned) closeTip() })

// ═══════════════════════════════════════════════════════════════════════════
// 窗口三态：置顶 / 鼠标穿透 / 锁定位置
//   真源在主进程（winState）；本层负责落档到 settings、画按钮状态，
//   并处理"穿透期间鼠标靠近顶部热区时临时放行"。
// ═══════════════════════════════════════════════════════════════════════════

const winState = { alwaysOnTop: true, clickThrough: false, lockPosition: false }
let clickThrough = false
let ctInteractive = false     // 穿透期间：热区是否已临时放行
let ctHotRect = null

function hotRectNow () {
  const r = dom.ctHotspot.getBoundingClientRect()
  return { l: r.left, t: r.top, r: r.right, b: r.bottom }
}

function applyWinStateToUI () {
  const top = winState.alwaysOnTop !== false
  const locked = !!winState.lockPosition
  dom.btnTop.classList.toggle('on', top)
  dom.btnThrough.classList.toggle('on', clickThrough)
  dom.btnLock.classList.toggle('on', locked)
  setToggle(dom.tgTop, top)
  setToggle(dom.tgThrough, clickThrough)
  setToggle(dom.tgLock, locked)
  document.body.classList.toggle('locked', locked)
  document.body.classList.toggle('click-through', clickThrough)
  dom.ctHotspot.classList.toggle('show', clickThrough)
  dom.btnTop.title = `窗口置顶：${top ? '已置顶（点按取消）' : '未置顶（点按开启）'}`
  dom.btnThrough.title = clickThrough
    ? '鼠标穿透：已开启（整窗不接收点击）｜点顶部热区或按 Ctrl+Alt+Q 恢复'
    : '鼠标穿透：整窗不再接收点击，只留顶部热区（快捷键 Ctrl+Alt+Q）'
  dom.btnLock.title = `锁定位置：${locked ? '已锁定（拖动不再移动窗口）' : '未锁定（点按禁止拖动）'}`
  dom.mid && (dom.mid.title = locked ? '位置已锁定' : '按住可拖动窗口')
  ctHotRect = hotRectNow()
}

/** 把内存三态写进存档（值没变则不写，避免主进程回执造成写档循环） */
function persistWinState () {
  const s = state.settings
  const top = winState.alwaysOnTop !== false
  const through = !!winState.clickThrough
  const locked = !!winState.lockPosition
  if (s.alwaysOnTop === top && s.clickThrough === through && s.lockPosition === locked) return false
  s.alwaysOnTop = top
  s.clickThrough = through
  s.lockPosition = locked
  persist('window-state')
  return true
}

function logWinChanges (before) {
  const s = state.settings
  if (before.alwaysOnTop !== s.alwaysOnTop) pushLog(`窗口置顶已${s.alwaysOnTop ? '开启' : '关闭'}。`, 'sys')
  if (before.clickThrough !== s.clickThrough) {
    pushLog(s.clickThrough
      ? '鼠标穿透已开启：整窗不再接收点击，顶部热区或 Ctrl+Alt+Q 可恢复。'
      : '鼠标穿透已关闭，恢复鼠标操作。', 'sys')
  }
  if (before.lockPosition !== s.lockPosition) pushLog(`窗口位置已${s.lockPosition ? '锁定（禁止拖动）' : '解锁'}。`, 'sys')
}

function snapshotWinSettings () {
  return {
    alwaysOnTop: state.settings.alwaysOnTop !== false,
    clickThrough: !!state.settings.clickThrough,
    lockPosition: !!state.settings.lockPosition
  }
}

/** 本层发起：改主进程 → 同步内存 → 落档 → 刷 UI → 写日志 */
async function commitWinState (patch) {
  if (!state) return
  if (!desktop || !desktop.window || !desktop.window.setState) {
    // 浏览器开发模式下没有窗口壳：如实说明，不假装设置生效
    pushLog('浏览器模式没有真实窗口，置顶/穿透/锁定不生效（请在 Electron 中运行）。', 'info')
    Object.assign(winState, patch)
    applyWinStateToUI()
    return
  }
  const before = snapshotWinSettings()
  const res = await desktop.window.setState(patch)
  if (res && res.state) Object.assign(winState, res.state)
  clickThrough = !!winState.clickThrough
  ctInteractive = false
  persistWinState()
  applyWinStateToUI()
  logWinChanges(before)
}

/** 外部发起（托盘勾选 / 全局快捷键）→ 主进程回执后同步本层 */
async function syncWinStateFromMain () {
  if (!state || !desktop || !desktop.window || !desktop.window.getState) return
  const res = await desktop.window.getState()
  if (!res || !res.state) return
  const before = snapshotWinSettings()
  Object.assign(winState, res.state)
  const wasThrough = clickThrough
  clickThrough = !!winState.clickThrough
  if (wasThrough !== clickThrough) ctInteractive = false
  persistWinState()
  applyWinStateToUI()
  logWinChanges(before)
}

/** 穿透期间鼠标靠近顶部热区 → 临时放行；离开 → 重新穿透 */
function onGlobalMouseMove (e) {
  if (!clickThrough) return
  const r = ctHotRect || hotRectNow()
  const inside = e.clientX >= r.l && e.clientX <= r.r && e.clientY >= r.t && e.clientY <= r.b
  if (inside === ctInteractive) return
  ctInteractive = inside
  if (desktop && desktop.window && desktop.window.ignoreMouseNow) {
    desktop.window.ignoreMouseNow(!inside)
  }
}

document.addEventListener('mousemove', onGlobalMouseMove)
document.addEventListener('mouseleave', () => {
  if (!clickThrough || !ctInteractive) return
  ctInteractive = false
  if (desktop && desktop.window && desktop.window.ignoreMouseNow) desktop.window.ignoreMouseNow(true)
})

// ── 日志 ──────────────────────────────────────────────────────────────────
function pushLog (text, kind = 'info') {
  if (!state) return
  state.log.push({ at: Date.now(), kind, text })
  if (state.log.length > 40) state.log = state.log.slice(-40)
  renderLog()
}

/**
 * 日志标题旁的一行摘要（主人 2026-09-18）：
 *   道历年份 ｜ 实际挂机（在线）时长 ｜ 上次离线时长 ｜ 离线收益（单独标注）
 * 离线收益用 gold 标注，与"修为"同族配色（§〇 色表）。
 */
function renderLogMeta () {
  if (!dom.logMeta || !state) return
  const { year } = gameClockOf(Date.now())
  const pt = playtimeSec()
  dom.logMeta.innerHTML =
    `道历 <b>${year}</b> 年　挂机 <b>${fmtRealSpan(pt * 1000)}</b>`
  dom.logMeta.title =
    `道历 ${year} 年（游戏历：1 现实分钟 = 1 游戏天）\n` +
    `实际挂机（在线）累计 ${fmtRealSpan(pt * 1000)}`

  // 离线：顶栏只留"总共离线多久"（主人 2026-09-19）；明细移入交互浮层
  if (dom.logOffline) {
    const info = offlineInfo()
    dom.logOffline.innerHTML = info.totalMs > 0
      ? `累计离线 <b>${fmtRealSpan(info.totalMs)}</b>`
      : '累计离线 <span style="color:#7f7a73">—</span>'
    dom.logOffline.title = info.awayMs > 0
      ? `上次离线 ${fmtRealSpan(info.awayMs)}，离线收益 +${fmt(info.gain)}\n点按看完整离线结算（含占挂机收益的百分比）`
      : '点按查看离线结算规则与记录'
  }
}

function renderLog () {
  if (!state) return
  const frag = document.createDocumentFragment()
  for (const entry of state.log.slice(-30)) {
    const line = document.createElement('div')
    line.className = `log-line log-${entry.kind || 'info'}`
    const time = document.createElement('span')
    time.className = 'log-time'
    time.textContent = fmtClock(entry.at)
    const body = document.createElement('span')
    body.textContent = entry.text
    line.appendChild(time)
    line.appendChild(body)
    frag.appendChild(line)
  }
  dom.log.replaceChildren(frag)
  dom.log.scrollTop = dom.log.scrollHeight
}

// ── 3.4 数值滚动（追赶式；静态档直写终值）──────────────────────────────────
// 为什么用「追赶」而不是「定长补间」：修为 / 灵石每 100ms 连续入账，定长补间永远追不上真值，
// 会越滚越落后。指数追赶在任意 dt 下都朝真值收敛，且目标一变即自动重定向、无需重置状态。
// 硬要求：**收敛后显示值逐位等于真值** —— 由 data/motion.js 的 rollDisplay 保证
// （"格式化后字符串相同即贴合"），因此既有断言（比对渲染出来的字符串）不受影响。

/** 滚动槽位台账：key → { shown 当前显示值, at 上次推进时刻 }（运行期结构，不入存档） */
const rollSlots = new Map()

/**
 * 取某槽位此刻该显示的**文案**（内部推进滚动台账并写回）。
 * @param {string} key 槽位键（唯一；一个数值宿主一个槽位）
 * @param {number} target 真值
 * @param {(n:number)=>string} format 数值格式化（fmt / fmtRate / 寿元的两位小数口径）
 * @param {(numText:string)=>string} text 文案模板（接收格式化后的数值串，分隔符与单位由它负责）
 * @param {number} at 当前时刻 Date.now()
 * @returns {string} 应写入 textContent 的文案
 */
function rollText (key, target, format, text, at) {
  const t = Number(target)
  let slot = rollSlots.get(key)
  if (!slot || !Number.isFinite(slot.shown)) {
    slot = { shown: Number.isFinite(t) ? t : 0, at }
    rollSlots.set(key, slot)
  }
  let shown = Number.isFinite(t) ? t : slot.shown
  if (motionMode() !== 'static' && Number.isFinite(t) && at > slot.at) {
    shown = rollDisplay(slot.shown, t, at - slot.at, format)
  }
  slot.shown = shown
  slot.at = at
  return text(format(shown))
}

/** 寿元数值口径（与 LifespanSystem.remainText 同源：<1000 年两位小数，否则取整） */
const lifeNumText = (n) => (n < 1000 ? Number(n).toFixed(2) : String(Math.floor(n)))

// ── HUD 渲染（纯读取，不修改状态）────────────────────────────────────────
function render () {
  if (!state) return
  const now = Date.now()
  const preview = cult.getBreakthroughPreview(now)
  const info = getLevelInfo(state.player.realm.level)
  const rate = cult.getEffRate(now)

  dom.realmName.textContent = info.displayName
  dom.stone.textContent = rollText('stone', state.resources.stones, fmt, (v) => v, now)
  // 战力（主人 2026-09-18）：与灵石左右对称，摆在寿命进度条左下方
  // 09-19：功法战力也计入（powerBreakdown 与宗门 / 秘境注入的闭包同口径）
  if (dom.powerText) {
    const b = powerBreakdown()
    const detail = [
      `基准 ${fmt(b.base)}`,
      b.techPct ? `功法 +${(b.techPct * 100).toFixed(1)}%` : '',
      b.petPct ? `灵兽 +${Math.round(b.petPct * 100)}%` : ''
    ].filter(Boolean).join(' ｜ ')
    dom.powerText.textContent = rollText('power', b.total, fmt, (v) => v, now)
    dom.powerWrap.title = `战力 ${fmt(b.total)}（${detail}）\n点按查看战力构成与用途`
  }

  const needText = Number.isFinite(preview.need) ? fmt(preview.need) : '—'
  dom.qiText.textContent = rollText('qi', state.resources.qi, fmt, (v) => `修为 ${v} / ${needText}`, now)
  if (!roots.drawn) {
    dom.qiRate.textContent = '待测灵根 · 暂不吐纳'
    dom.qiRate.classList.remove('low')
  } else {
    const mulPart = Math.abs(rate.mul - 1) > 1e-9 ? `（×${rate.mul.toFixed(2)}）` : ''
    dom.qiRate.textContent = rollText('rate', rate.eff, fmtRate, (v) => `+${v}/秒${mulPart}`, now)
    dom.qiRate.classList.toggle('low', rate.mul < 1)
  }
  dom.progress.style.width = (preview.progress * 100).toFixed(1) + '%'
  dom.progress.classList.toggle('trial', preview.isTrial)
  renderTicks(preview)

  // 寿元（增补 v1.1）：数值 + 细条，<20% 转警示色
  // 文案用「余寿」——它本来就是"剩余可活年数"（随时间减少），写"寿元"容易被读成"寿命上限"
  const lifePct = life.pct
  dom.lifeText.textContent = rollText('life', life.remainYears, lifeNumText,
    (v) => `余寿 ${v} / ${life.maxText} 年`, now)
  dom.lifeText.classList.toggle('warn', life.warning)
  dom.lifeText.title = life.exhausted
    ? '寿元已尽 —— 坐化（强制转世）将于阶段二开放'
    : `余寿 ${life.remainText} 年（上限 ${life.maxText}）｜还能撑 ${fmtDuration(life.remainingRealMs)}（现实时间）\n点按查看寿元为何减少、何时回满`
  dom.lifeProgress.style.width = (lifePct * 100).toFixed(2) + '%'
  dom.lifeProgress.classList.toggle('warn', life.warning)

  // 增益 / 减益小牌（主人 2026-09-17：挂在灵根徽记右边）
  // 主人 2026-09-18：限时产出增益（古宝残片 +50% 等）不再占小牌位，明细进修为浮层；
  //                  只有减益（道伤）与常在加成（契合 / 出战灵兽）留在顶栏。
  renderBuffChips(now)
  renderLogMeta()

  renderWorldChip()
  renderRootChip()
  renderBreakthroughButton(preview)
  refreshTip()        // 钉住的明细浮层跟着面板一起刷新（数字永不与画面脱节）
  syncDragRegions()   // 兜底：任何浮层开着就取消拖拽区（改这里最省心）
  // 功法面板开着时每 ~1 秒轻刷一次（升级按钮的"付不付得起"要跟着灵气走）
  if (dom.techOverlay.classList.contains('show')) {
    techTick = (techTick + 1) % 10
    if (techTick === 0) renderTech()
  }
  // 宗门面板同理：任务倒计时与"换不换得起"每 ~1 秒跟一拍
  if (dom.sectOverlay.classList.contains('show')) {
    sectTick = (sectTick + 1) % 10
    if (sectTick === 0) renderSect()
  }
  // 秘境面板同理：派遣倒计时每 ~1 秒跟一拍
  if (dom.dungeonOverlay.classList.contains('show')) {
    dungeonTick = (dungeonTick + 1) % 10
    if (dungeonTick === 0) renderDungeon()
  }
  // 灵兽面板同理：派遣/孵化倒计时每 ~1 秒跟一拍
  if (dom.beastOverlay.classList.contains('show')) {
    beastTick = (beastTick + 1) % 10
    if (beastTick === 0) renderBeast()
  }
  // 坊市（2.6）：每日刷新由 ensureDaily 幂等处理；面板开着时每 ~1 秒轻刷一次
  if (dom.marketOverlay.classList.contains('show')) {
    marketTick = (marketTick + 1) % 10
    if (marketTick === 0) renderMarket()
  }
  // 渡劫面板（2.5）：成率与可备状态每 ~1 秒跟一拍
  if (dom.trialOverlay.classList.contains('show')) {
    trialTick = (trialTick + 1) % 10
    if (trialTick === 0) renderTrial()
  }
  // 渡劫快捷条：站在关口且尚未备妥时点亮，提醒"这里还能再添一把火"
  if (dom.btnTrial) {
    const t = preview.trial
    const canPrep = preview.isTrial && t && t.preps && t.preps.views.some((v) => v.state === 'ready')
    dom.btnTrial.classList.toggle('attn', !!canPrep)
  }
  // 事件与纪事（主人 2026-09-19：两者同页）／成就与称号（另立一册）
  //   角标分工：事件纪事键 = 待抉择事件 + 新纪事 + 待出手互动；成就键 = 未读成就
  if (dom.btnChronicle) {
    const unread = achv ? achv.unreadCount : 0
    const openAct = achv ? achv.openInteractionCount : 0
    const pend = events ? events.pendingCount : 0
    const marks = []
    if (unread > 0) marks.push(`${unread} 条新消息未看`)
    if (openAct > 0) marks.push(`${openAct} 条互动纪事等你出手`)
    if (pend > 0) marks.push(`${pend} 起绝/仙事件待抉择`)
    dom.btnChronicle.classList.toggle('attn', marks.length > 0)
    dom.btnChronicle.title = marks.length
      ? `纪事：${marks.join(' · ')}`
      : '纪事（关键事件须亲断 · 三频道纪事流）'
    if (dom.btnAchv) {
      dom.btnAchv.classList.toggle('attn', unread > 0)
      dom.btnAchv.title = unread > 0
        ? `成就与称号：${unread} 个新成就未看`
        : '成就与称号（成就墙 · 称号佩戴）'
    }
  }
  if (dom.chronicleOverlay.classList.contains('show')) {
    chrTick = (chrTick + 1) % 10
    if (chrTick === 0) renderChronicle()
  }
  if (dom.achvOverlay && dom.achvOverlay.classList.contains('show')) {
    achvPaneTick = (achvPaneTick + 1) % 10
    if (achvPaneTick === 0) renderAchv()
  }
  // 丹房：面板开着时每 ~1 秒轻刷一次（材料到手后按钮应自己点亮）
  if (dom.alchemyOverlay && dom.alchemyOverlay.classList.contains('show')) {
    alchemyTick = (alchemyTick + 1) % 10
    if (alchemyTick === 0) renderAlchemy()
  }
  renderTitleChip()
}

/**
 * 顶栏增益 / 减益小牌（灵根徽记右侧）
 * 内容＝**减益**（道伤等，必须一眼看见）+ 常在加成（天道契合档 / 出战灵兽），
 * 至多显示 3 枚，超出折叠为「+N」；每枚都带悬停说明（原生 title）。
 *
 * 主人 2026-09-18：「古宝残片 +50%」这类**限时产出增益不再占栏位** ——
 *   它的明细直接列在「修为」浮层的「增益明细」里（点修为数值即可看到），
 *   顶栏因此只留"要提醒的坏事"与常在加成。
 */
function renderBuffChips (now) {
  const box = dom.buffChips
  if (!box || !state) return
  const items = []
  for (const b of (state.buffs || [])) {
    if ((b.endsAt || Infinity) <= now) continue
    const pct = (b.mods && typeof b.mods.qiRatePct === 'number') ? b.mods.qiRatePct : 0
    // 正收益限时增益：不占小牌位（明细在修为浮层）
    if (pct > 0) continue
    const bad = b.id === 'debuff_daoshang' || pct < 0
    const left = Number.isFinite(b.endsAt) ? `，剩余 ${fmtRealSpan(b.endsAt - now)}` : ''
    items.push({
      text: `${b.name}${pct ? ` ${Math.round(pct * 100)}%` : ''}`,
      kind: bad ? 'debuff' : 'buff',
      title: `${b.name}：产出 ${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%${left}`
    })
  }
  if (life) {
    const t = life.fitTier
    if (t && t.cultPct !== 0) {
      items.push({
        text: `契合·${t.name} ${t.cultPct > 0 ? '+' : '−'}${Math.abs(Math.round(t.cultPct * 100))}%`,
        kind: t.cultPct < 0 ? 'debuff' : 'buff',
        title: `天道契合 ${t.name}：产出 ${t.cultPct > 0 ? '+' : '−'}${Math.abs(Math.round(t.cultPct * 100))}%，渡劫单雷 ${t.trialPct >= 0 ? '+' : '−'}${Math.abs(Math.round(t.trialPct * 100))}%（点余寿看天机榜）`
      })
    }
  }
  // 主人 2026-09-19：出战灵兽不再占顶栏小牌（"顶部的灵兽为什么还在"）——
  // 它的加成仍照常计入产出 / 战力 / 渡劫，明细去「灵兽」面板与战力浮层看。

  const MAX = 3
  const frag = document.createDocumentFragment()
  for (const it of items.slice(0, MAX)) {
    const span = document.createElement('span')
    span.className = `buff-chip ${it.kind}`
    span.textContent = it.text
    span.title = it.title
    frag.appendChild(span)
  }
  if (items.length > MAX) {
    const more = document.createElement('span')
    more.className = 'buff-chip buff'
    more.textContent = `+${items.length - MAX}`
    more.title = items.slice(MAX).map((x) => x.title).join('\n')
    frag.appendChild(more)
  }
  const signature = items.map((x) => x.text).join('|')
  if (box.dataset.sig === signature) return
  box.dataset.sig = signature
  box.replaceChildren(frag)
  box.title = items.length ? items.map((x) => x.title).join('\n') : ''
}

/**
 * 进度条关口刻度（设计稿「本次精修 · 三处」之一）
 * 三成 / 六成 / 圆满 三个尺度刻度；末刻度在目标为 小瓶颈 / 渡劫 时转劫红。
 * 仅在"级数或关键性"变化时重建 DOM，避免每 100ms 重排。
 */
let ticksSignature = ''
function renderTicks (preview) {
  const keyTarget = preview.plan.type === 'bottleneck' || preview.isTrial
  const sig = `${state.player.realm.level}|${preview.plan.type}`
  if (sig === ticksSignature) return
  ticksSignature = sig

  const frag = document.createDocumentFragment()
  for (const [left, isKey] of [[33.3, false], [66.6, false], [99, keyTarget]]) {
    const i = document.createElement('i')
    i.style.left = left + '%'
    if (isKey) i.className = 'key'
    frag.appendChild(i)
  }
  dom.ticks.replaceChildren(frag)
}

function renderBreakthroughButton (preview) {
  let label = ''
  let badge = ''
  let disabled = true

  if (preview.ascended) {
    label = '已飞升 · 静待二期'
  } else if (preview.cooldownSec > 0) {
    label = `调息中 · ${preview.cooldownSec}s`
  } else if (!preview.enoughQi) {
    label = `修为不足 · 还需 ${fmt(preview.need - state.resources.qi)}`
  } else {
    disabled = false
    const tag = preview.plan.type === 'bottleneck' ? '（小瓶颈）' : (preview.heavenExempt ? '（无瓶颈）' : '')
    label = `${preview.plan.label} → ${preview.plan.targetName}${tag}`
    badge = `${(preview.probability * 100).toFixed(preview.isTrial ? 1 : 0)}%`
  }

  dom.btnLabel.textContent = label
  dom.btnRate.textContent = badge
  dom.btnRate.style.display = badge ? '' : 'none'
  dom.btn.disabled = disabled
  dom.btn.classList.toggle('trial', !disabled && preview.isTrial)
}

function renderRootChip () {
  // 徽记常驻：未测灵根也显示（它同时是"测灵根 / 洗髓"的唯一入口，
  // 点开浮层就能看到灵根详情与洗髓按钮 —— 顶栏因此只剩设置类按钮）
  const drawn = roots.drawn
  const t = drawn ? roots.tier : null
  dom.rootChip.textContent = drawn ? roots.displayName : '未测灵根'
  dom.rootChip.style.color = t ? t.color : 'var(--ash)'
  dom.rootChip.title = drawn
    ? `点按查看灵根详情 / 洗髓重掷（洗髓丹 ${roots.pillCount} 枚）`
    : '点按查看灵根详情 / 开始测灵根'
}

function renderWorldChip () {
  // 世界徽记（2.9）：常驻显示（未抽世界也显示），点开浮层看世界词条与修正
  const v = world && world.drawn ? world.view() : null
  dom.worldChip.textContent = v ? v.name : '未定世界'
  dom.worldChip.style.color = v ? v.color : 'var(--ash)'
  dom.worldChip.title = v
    ? `点按查看此界词条（产出 ×${v.baseRateMul.toFixed(2)}${v.masteryPct ? ` · 熟练 +${Math.round(v.masteryPct * 100)}%` : ''}）`
    : '点按查看十二世界卡池'
}

// ── 存档 ──────────────────────────────────────────────────────────────────
async function persist (reason = 'auto') {
  if (!state) return
  const res = await save.save(state, reason)
  if (!res.ok && res.error && res.error !== 'no-storage') {
    pushLog(`存档写入失败（已退至热备）：${res.error}`, 'fail')
  }
  return res
}

async function refreshSaveBadge () {
  // 日志旁的「文件存档」小标签已按主人要求去掉；这里只保留取一次存档信息，
  // 供设置/存档面板复用（避免重复 IPC）
  const info = await save.info()
  return info
}

async function doExport () {
  if (bridge) {
    const res = await save.exportToFile(state)
    if (res.canceled) return
    if (!res.ok) { pushLog(`导出失败：${res.error || '未知错误'}`, 'fail'); return }
    pushLog(`存档已导出：${res.path}`, 'ok')
    return
  }
  // 浏览器模式：直接下载
  const blob = new Blob([save.serialize(state)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `问长生-备份-${fmtStamp()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  pushLog('存档已导出到浏览器下载目录。', 'ok')
}

async function doImport () {
  if (bridge) {
    const res = await save.importFromFile()
    if (!res || res.canceled) return
    if (!res.ok) { pushLog(`导入失败：${res.error || '未知错误'}`, 'fail'); return }
    pushLog('存档已导入，正在重载…（原档已转存 save.bak）', 'ok')
    setTimeout(() => window.location.reload(), 500)
    return
  }
  // 浏览器模式：隐藏 file input
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files && input.files[0]
    if (!file) return
    const text = await file.text()
    const res = save.importFromText(text)
    if (!res.ok) { pushLog(`导入失败：${res.error}`, 'fail'); return }
    await save.save(res.state, 'import')
    pushLog('存档已导入，正在重载…', 'ok')
    setTimeout(() => window.location.reload(), 500)
  }
  input.click()
}

async function doReset () {
  if (!window.confirm('确定要重置存档吗？\n当前修为、境界、灵根与日志将全部清空（旧档会自动留在 save.bak）。')) return
  save.clear()
  const fresh = save.createDefaultState()
  await save.save(fresh, 'reset')
  window.location.reload()
}

// ── 寿元（增补 v1.1）：与产出共用同一份 dt，保证口径一致 ───────────────────
function tickLifespan (dtSec) {
  if (!life || !(dtSec > 0)) return
  const r = life.tick(dtSec)
  if (r.warnNow) {
    pushLog(`寿元将尽：仅剩 ${life.remainText} 年 —— 速寻破境之机（破境即回满）。`, 'fail')
  }
  if (r.exhaustedNow) {
    pushLog('寿元已尽 —— 坐化（强制转世）将于阶段二随转世系统开放，当前不中断修行。', 'fail')
  }
}

// ── 2.11 天道契合：事件侧果报（fitDelta）排水 → 顺天值入账 ─────────────────
// 每拍随事件 tick 排水一次；离线批量结算的果报也会在归来后第一拍入账。
function drainFitDelta () {
  if (!events || !life) return
  const d = events.drainFitDelta()
  if (!d) return
  const r = life.addFit(d, '（事件·行止果报）')
  pushLog(r.message, d > 0 ? 'ok' : 'fail')
  if (r.tierChanged) emitFloat({ text: `天道契合 · ${r.toTier}`, kind: d > 0 ? 'life' : 'info' }, 200)
}

// ── 2.11 延寿丹接线：库存 → 寿元入账（+50 年，封顶本境上限）────────────────
function doYanshou () {
  if (!state || !life) return
  const inv = state.inventory.items
  if ((inv.pill_yanshou | 0) <= 0) {
    pushLog('囊中没有延寿丹（丹房可炼、坊市有售）。', 'info')
    return
  }
  if (life.remainYears >= life.maxYears - 0.005) {
    pushLog('余寿尚满，药力无处着落——留到本境后期再服。', 'info')
    return
  }
  inv.pill_yanshou -= 1
  life.addYears(LIFESPAN.pill.daily)
  pushLog(`服下延寿丹：余寿 +${LIFESPAN.pill.daily} 年（现 ${life.remainText} 年）。`, 'ok')
  emitFloat({ text: `余寿 +${LIFESPAN.pill.daily} 年`, kind: 'life' }, 200)
  persist('use-yanshou')
}

// ── 离线（隐藏到托盘 / 退出 / 归来）───────────────────────────────────────
function enterOffline () {
  if (offlineMode || !state) return
  offlineMode = true
  save.markOfflineStart(state, Date.now())
  persist('offline-start')
}

function leaveOffline () {
  if (!offlineMode || !state) return
  offlineMode = false
  const now = Date.now()
  const rate = cult.getEffRate(now).eff
  const report = save.settleOffline(state, now, rate)
  cult.lastTickAt = now // 关键：重置在线结算基线，避免离线时长被重复计入

  if (report.ok) {
    tickLifespan(report.awaySec) // 寿元是实时时钟：离线同样流逝
    pushLog(`闭关归来：离开 ${fmtDuration(report.awayMs)}${report.capped ? `（超出上限 ${fmtGameDuration(report.capHours * 3600 * 1000)}，按上限结算）` : ''}，修为 +${fmt(report.gainQi)}`, 'offline')
    emitFloat({ text: `闭关归来 +${fmt(report.gainQi)}`, kind: 'offline' }, 200)
    emitBurst({ kind: 'offline' })
    showReturnCard(report.awayMs, report.gainQi)
    // 事件（2.3）：离线事件按 50% 累积、归来批量结算（绝/仙级入事件簿待抉择）
    reportOfflineEvents(events.settleOffline(report.awaySec, rate, stoneHourly(state.player.realm.level), now))
    persist('offline-end')
  }
}

// ── 世界卡池（2.9）：开局抽世界 / 免费重掷 ────────────────────────────────

function showWorldOverlay (stateName) {
  dom.worldOverlay.dataset.state = stateName
  dom.worldOverlay.classList.add('show')
  syncDragRegions()
}

function hideWorldOverlay () {
  dom.worldOverlay.classList.remove('show')
  syncDragRegions()
}

/** 世界结果卡：词条与修正一目了然（增补 v1.2 §一.3「抽取后开局界面完整展示」） */
function renderWorldResult (v) {
  if (!v || !v.drawn) return
  dom.worldResultName.textContent = v.name
  dom.worldResultName.style.color = v.color || 'var(--gold-light)'
  dom.worldResultTag.textContent = `${v.tag} · 开局身份：${v.identity}`
  const extra = v.trialMul !== 1 ? `　天劫 ×${v.trialMul.toFixed(2)}` : ''
  dom.worldResultMods.textContent = `产出 ×${v.baseRateMul.toFixed(2)}　寿元流速 ×${(v.lifespanMul || 1).toFixed(2)}${extra}`
  dom.worldResultDesc.textContent = v.desc
  dom.worldResultExclusive.textContent = `专属 · ${v.exclusive}`
  dom.worldResultFriction.textContent = `摩擦 · ${v.friction}`
  const rerollable = v.freeRerollLeft > 0
  dom.btnWorldReroll.disabled = !rerollable
  dom.btnWorldReroll.textContent = rerollable ? `重 掷 此 界（剩 ${v.freeRerollLeft} 次）` : '重掷已用尽（界镜 · 版本2上线）'
}

/** 抽世界（12 池等概率；抽定即揭晓，不另设演出） */
function drawWorld () {
  if (worldBusy || world.drawn) return
  worldBusy = true
  const r = world.draw()
  if (!r.ok) { worldBusy = false; return }
  persist('world-draw')
  pushLog(`界签已落：${r.world.name} —— ${r.world.tag}。`, 'root')
  renderWorldResult(world.view())
  showWorldOverlay('result')
  worldBusy = false
  renderWorldChip()
  applySkin({ silent: true })   // 3.4：'随世界'档下抽定此界即换肤（非该档为无操作）
}

/** 免费重掷（1 次；从其余 11 界等概率换一个） */
function doWorldReroll () {
  if (worldBusy || !world.drawn) return
  const r = world.reroll()
  if (!r.ok) {
    pushLog(r.message, 'info')
    renderWorldResult(world.view())
    return
  }
  persist('world-reroll')
  pushLog(`重掷此界：新界「${r.world.name}」（免费重掷剩 ${r.freeRerollLeft} 次）。`, 'root')
  renderWorldResult(world.view())
  renderWorldChip()
  applySkin({ silent: true })   // 3.4：'随世界'档下重掷即时换肤
}

// ── 灵根：开局测灵根 / 洗髓 ───────────────────────────────────────────────

function showOverlay (stateName) {
  dom.overlay.dataset.state = stateName
  dom.overlay.classList.add('show')
  syncDragRegions()
}

function hideOverlay () {
  dom.overlay.classList.remove('show')
  syncDragRegions()
}

/** 首次测灵根：遮罩引导 → 光轮推演 → 揭晓 → 结果卡 */
function startRootDraw () {
  if (rootBusy || roots.drawn) return
  rootBusy = true
  showOverlay('spin')

  const spin = Math.max(600, DRAW_ANIMATION.spinMs)
  emit('root:spin', { durationMs: spin })
  pushLog('取三滴精血，投入测灵石，天机开始流转…', 'root')

  setTimeout(() => {
    const r = roots.drawFirst()
    persist('root-draw')
    hideOverlay()                      // 让揭晓演出完整可见
    emit('root:reveal', { displayName: r.displayName, color: r.tier.color, rarity: r.tier.rarity, tag: r.tag, trait: r.tier.trait })
    emit('root:aura', { color: r.tier.color })
    pushLog(`灵根已定：${r.displayName} —— ${r.tier.trait}`, 'root')
    pushLog(`灵根加成：产出 ×${r.tier.mods.rateMul.toFixed(2)}、突破成本 ×${r.tier.mods.costMul.toFixed(2)}`, 'root')
    // 新手脚本：测灵根 → 获得第一份功法
    const g = tech.ensureStarter()
    if (g.granted) pushLog(`执事见你灵根已定，赠下入门功法「${g.name}」（已入主修槽）。`, 'root')
    rootBusy = false
    renderRootChip()
    setTimeout(() => {
      renderRootResult({
        displayName: r.displayName,
        color: r.tier.color,
        trait: r.tier.trait,
        tag: r.tag,
        mods: r.tier.mods,
        hardGuarantee: false,
        hardNeed: 0
      })
      showOverlay('result')
    }, DRAW_ANIMATION.revealMs + 800)
  }, spin + 100)
}

/** 洗髓重掷（不弹遮罩，直接在角色身上推演） */
function doReroll () {
  if (rootBusy) return
  if (!roots.drawn) { startRootDraw(); return }
  if (roots.pillCount <= 0) {
    pushLog('洗髓丹不足：需 1 枚（渡劫成功可得）。', 'info')
    return
  }

  rootBusy = true
  renderRootChip()
  const spin = Math.max(600, Math.round(DRAW_ANIMATION.spinMs * 0.75))
  emit('root:spin', { durationMs: spin })
  pushLog('洗髓开始：丹药入体，灵根重铸…', 'root')

  setTimeout(() => {
    const res = roots.reroll()
    persist('root-reroll')
    if (!res.ok) {
      pushLog(res.message, 'info')
      rootBusy = false
      renderRootChip()
      return
    }
    emit('root:reveal', { displayName: res.displayName, color: res.tier.color, rarity: res.tier.rarity, tag: res.tag, trait: res.tier.trait })
    emit('root:aura', { color: res.tier.color })
    pushLog(`洗髓结果：${res.displayName}（灵气根重铸，丹药剩 ${roots.pillCount} 枚）`, 'root')
    // V3.5.1：混沌灵根彩蛋揭晓（隐藏灵根只在硬保底掷里小概率现身）
    if (res.tier.rarity === HIDDEN_ROOT.rarity) {
      pushLog(`「？？？」揭开了真身——${HIDDEN_ROOT.name}！${HIDDEN_ROOT.desc}`, 'root')
    }
    if (res.hardGuarantee) pushLog('保底触发：命格终见天光。', 'root')
    rootBusy = false
    renderRootChip()
    render()   // 乘区变化 → 立即刷新产出显示
  }, spin + 100)
}

function renderRootResult ({ displayName, color, trait, tag, mods, hardGuarantee, hardNeed }) {
  dom.rootResultName.textContent = displayName
  dom.rootResultName.style.color = color || 'var(--gold-light)'
  dom.rootResultTrait.textContent = tag ? `${trait} · ${tag}` : trait
  dom.rootResultMods.textContent = `灵气产出 ×${mods.rateMul.toFixed(2)}　突破成本 ×${mods.costMul.toFixed(2)}`
  dom.rootResultPity.textContent = hardGuarantee
    ? '保底已触发：本次必出变异或天灵根。'
    : `洗髓可重掷（开局赠 ${XISUI_DROP.initial} 枚洗髓丹，${hardNeed} 次内未出高资质将触发保底）`
}

// ── 渡劫确认气泡（设计稿「本次精修 · 三处」之二）─────────────────────────
function showBubble (preview) {
  dom.bubbleRate.textContent = `${(preview.probability * 100).toFixed(1)}%`
  renderBubblePrep(preview)   // 2.5：这一眼要看得见"自己备了什么"
  dom.bubble.classList.add('show')
  syncDragRegions()
}

function hideBubble () {
  dom.bubble.classList.remove('show')
  syncDragRegions()
}

// ── 闭关归来结算卡（设计稿「本次精修 · 三处」之三；5 秒自动收起）─────────
let returnCardTimer = null

function showReturnCard (awayMs, gainQi) {
  dom.rcAway.textContent = fmtDuration(awayMs)
  dom.rcGain.textContent = '+' + fmt(gainQi)
  sfx('offline_back', { throttleMs: 2000 })   // 3.5 音效：闭关归来（开机补发时也不会连响）
  dom.returnCard.classList.add('show')
  if (returnCardTimer) clearTimeout(returnCardTimer)
  returnCardTimer = setTimeout(hideReturnCard, RETURN_CARD_MS)
  syncDragRegions()
}

function hideReturnCard () {
  if (returnCardTimer) { clearTimeout(returnCardTimer); returnCardTimer = null }
  dom.returnCard.classList.remove('show')
  syncDragRegions()
}

// ── 突破交互 ──────────────────────────────────────────────────────────────
function onBreakthrough () {
  if (rootBusy) return
  const preview = cult.getBreakthroughPreview(Date.now())
  if (!preview.ready) {
    // 卡在"缺少破境丹"时：先请丹房自动开炉（主人 2026-09-17：材料充足自动炼制）
    if (preview.blocked === '缺少破境丹') {
      const pill = (preview.plan && preview.plan.pill) || 'pill_pojing'
      const ab = alchemy.autoBrewFor(pill)
      if (ab.attempts > 0) {
        pushLog(ab.message, ab.success ? 'ok' : 'fail')
        persist('alchemy-autobrew')
        render()
        if (ab.success) onBreakthrough()   // 丹已成 → 重走一遍流程（此时不再缺丹）
        return
      }
      // 连材料都没有：老档/特殊情况没赶上首赠的，此刻递上来
      const pg = alchemy.ensureBottleneckPill()
      if (pg.granted) {
        pushLog(pg.message, 'root')
        render()
        return
      }
    }
    pushLog(`尚不可冲击：${preview.blocked || '条件不足'}。`, 'info')
    render()
    return
  }
  // 渡劫 / 飞升是掉修为的高光关口 → 先「引雷确认」，防手滑
  if (preview.isTrial) { showBubble(preview); return }
  doBreakthrough()
}

/**
 * 冲关（唯一执行口：手动按钮与自动突破都走这里）
 * @param {boolean} [auto] 自动突破触发（主人 2026-09-18）—— 只影响日志文案的前缀
 */
function doBreakthrough (auto = false) {
  hideBubble()
  const result = cult.attemptBreakthrough(Date.now())

  if (!result.ok) {
    pushLog(result.message, 'info')
    render()
    return
  }

  const isTrial = result.type === 'tribulation' || result.type === 'ascension'
  const tag = (!isTrial && auto) ? '【自动】' : ''   // 自动冲关在日志里看得出来，免得玩家莫名其妙
  // 演出时序：渡劫等"三道天雷"播完再报结果；突破成功等"漩涡→顿帧"播完与文案同拍浮现
  const delay = isTrial ? TRIBULATION_FX_MS : (result.success ? BREAKTHROUGH_FX.totalMs : 0)
  if (isTrial) {
    // 3.2：payload 增补 title（成功收势的大字文案；失败不带）
    emit('cult:tribulation', { success: result.success, strikes: 3, title: result.success ? result.toName : '' })
  }

  if (result.success) {
    pushLog(result.detail, 'ok')
    emitFloat({ text: result.floatText, kind: 'ok' }, delay)
    emitFloat({ text: result.toName, kind: 'ok', sub: true }, delay + 220)
    if (!isTrial) emitBurst({ success: true, title: result.toName })   // 3.2：payload 增补 success/title
    // 破境续命（增补 v1.1）：晋入新大境界 → 寿元上限更新并回满
    if (result.realmChanged) {
      const r = life.onRealmChange(state.player.realm.level)
      const gained = Math.max(0, Math.round(r.gainedYears))
      pushLog(`破境续命：晋入${r.realmName}，寿元上限 ${r.maxYears} 年，余寿已回满（+${gained} 年）。`, 'ok')
      // 寿元"增加"只在这一个时刻发生 —— 必须给出看得见的反馈，否则玩家只会觉得它一直在掉
      emitFloat({ text: `寿元回满 +${gained} 年`, kind: 'life' }, delay + 420)
      emitBurst({ kind: 'life' }, delay + 420)
      emitRealmLook(delay + 420)   // 3.1：晋入新大境界 → 圆光/服饰色/呼吸节律随境界更替
    }
  } else {
    pushLog(tag + result.detail, 'fail')
    emitFloat({ text: result.floatText, kind: 'fail' }, delay)
    if (!isTrial) emitBurst({ success: false })   // 3.2：失败保持轻反馈（无漩涡无大字）
  }

  // 丹药（2.2）：首次站上瓶颈级且身无破境丹 → 宗门赠丹（新手脚本 §3 口径，幂等）
  {
    const pg = alchemy.ensureBottleneckPill()
    if (pg.granted) pushLog(pg.message, 'root')
  }

  persist('breakthrough')
  render()
}

// ── 自动突破（主人 2026-09-18：修为够了自动冲关，**含瓶颈**；只有渡劫留给玩家掌控）──
// 口径：主循环每 100ms 问一次；「修为已满 + 非渡劫」→ 直接冲关；
//       缺破境丹先请丹房自动开炉（炼成即冲）。渡劫 / 飞升永不自动 —— 引雷要玩家亲自按。
let autoBreakNoteLv = 0   // 已在日志里解释过"为何没自动冲关"的等级（防刷屏）

function noteAutoBreakBlocked (reason) {
  const lv = state.player.realm.level
  if (autoBreakNoteLv === lv) return
  autoBreakNoteLv = lv
  pushLog(`【自动】这次替你按不下引雷键：${reason}。`, 'info')
}

function autoBreakTick () {
  if (!state || !cult || rootBusy) return
  const pv = cult.getBreakthroughPreview(Date.now())
  // 渡劫 / 飞升：绝不自动（isTrial）；条件未满（含调息冷却）也不动
  if (!pv.ready || pv.isTrial) return
  if (pv.pillRequired && pv.pillMissing) {
    const pill = (pv.plan && pv.plan.pill) || 'pill_pojing'
    const ab = alchemy.autoBrewFor(pill)
    if (ab.attempts > 0) {
      pushLog(ab.message, ab.success ? 'ok' : 'fail')
      persist('alchemy-autobrew')
      if (!ab.success) {
        noteAutoBreakBlocked('丹房材料不足，自动开炉没能成丹（去秘境或宗门补些灵草与玄铁矿）')
        return
      }
    } else {
      noteAutoBreakBlocked('缺破境丹，丹房材料也不够（去秘境或宗门补些灵草与玄铁矿）')
      return
    }
  }
  doBreakthrough(true)
}

// ═══════════════════════════════════════════════════════════════════════════
// ══ 2.5 渡劫 装配区（改动仅限本区块内；逻辑全在 CultivationSystem 的 2.5 区块）
// ═══════════════════════════════════════════════════════════════════════════
// 宿主：渡劫遮罩 #trial-overlay（八关口全览 / 准备加成 / 静养）+ 既有引雷气泡。
// 本区块只做「读系统 → 渲染 → 把点击交回系统」，不藏任何规则。

function openTrial () {
  if (!state) return
  closeTip()
  closeAllOverlays('trial')
  renderTrial()
  ovShow(dom.trialOverlay)
  dom.btnTrial.classList.add('on')
  syncDragRegions()
}

function closeTrial () {
  ovHide(dom.trialOverlay)
  dom.btnTrial.classList.remove('on')
  syncDragRegions()
}

function toggleTrial () {
  if (dom.trialOverlay.classList.contains('show')) closeTrial()
  else openTrial()
}

/** 该准备项所需的丹，丹房能否现炼（材料够了就允许"炼丹服下"一键走完） */
function canAutoBrew (v) {
  if (!v || !v.itemId || !alchemy) return false
  const rec = alchemy.recipeForPill(v.itemId)
  return !!(rec && alchemy.canBrew(rec.id).ok)
}

/** 引雷气泡上的「已备 +N%」——让玩家在按下引雷前最后一眼确认自己备了什么 */
function renderBubblePrep (preview) {
  const pct = (preview && preview.trial && preview.trial.preps) ? preview.trial.preps.pct : 0
  dom.bubblePrep.textContent = pct > 0 ? ` ｜ 已备 +${Math.round(pct * 100)}%` : ''
}

function renderTrial () {
  if (!state || !cult) return
  const preview = cult.getBreakthroughPreview(Date.now())
  const nodes = cult.nodesView()
  const cur = cult.trialNode
  const idx = cur >= 0 ? cur : Math.min(cult.trialCleared, nodes.length - 1)
  const node = nodes[idx]
  const preps = cult.prepSummary(idx)
  const fails = (state.trialState.consecutiveFails | 0)

  // ① 当前关口
  let head = ''
  if (preview.ascended) {
    head = '<div class="tn-name">已飞升 · 静待二期</div>' +
      `<div class="tn-line">八道天关皆已渡过，仙界之门暂封。</div>`
  } else {
    const failBonus = Math.min(fails * TRIBULATION.failBonus.per, TRIBULATION.failBonus.cap)
    const pityNext = fails + 1 >= TRIBULATION.pity.fails
    let rateLine = `<div class="tn-line">尚未行至此关：眼下是「${preview.plan.label} → ${preview.plan.targetName}」。</div>`
    if (preview.trial) {
      const t = preview.trial
      const fitPct = t.fitPct || 0
      // 裸口径 = 修为积累 + 契合（不含准备）；与最终 P 的差值拆成「准备」「契合」两段展示
      const naked = cult.getTrialChance(idx, t.fails, t.surplusBonus + fitPct)
      const mods = []
      if (preps.pct > 0) mods.push(`准备 <span class="jade">+${Math.round(preps.pct * 100)}%</span>`)
      if (fitPct !== 0) {
        mods.push(fitPct > 0
          ? `契合 <span class="jade">+${Math.round(fitPct * 100)}%</span>`
          : `契合 <span class="red">−${Math.round(-fitPct * 100)}%</span>`)
      }
      rateLine =
        `<div class="tn-line">单道天雷 <b>${(naked.p * 100).toFixed(1)}%</b>` +
        (mods.length ? ` → <b class="jade">${(t.p * 100).toFixed(1)}%</b>（${mods.join('｜')}）` : '') +
        ` ｜ 三道过二 <b>${(preview.probability * 100).toFixed(1)}%</b></div>`
    }
    head =
      `<div class="tn-name">${node.name}（第 ${node.index + 1} / ${node.total} 关${cur >= 0 ? ' · 已在关口' : ' · 尚未行至'}）</div>` +
      `<div class="tn-line">${node.fromRealm} → ${node.toRealm} ｜ 关口需求战力 <b>${fmt(node.trialReq)}</b>（第 ${node.index + 1} 关系数 ${node.fk}）</div>` +
      rateLine +
      `<div class="tn-line">本关战绩：<b>${node.tries}</b> 试 <b>${node.passes}</b> 成 ｜ 垫劫补正 <b>+${Math.round(failBonus * 100)}%</b>（连败 ${fails} 次${pityNext ? '，第 4 次起按保底计' : ''}）</div>` +
      `<div class="tn-desc">${node.desc}</div>`
  }
  dom.trialNode.innerHTML = head + '<div class="tr-gates" id="trial-gates"></div>'

  // ② 八关口格子
  const gateBox = document.getElementById('trial-gates')
  if (gateBox) {
    const frag = document.createDocumentFragment()
    for (const n of nodes) {
      const box = document.createElement('div')
      box.className = 'tr-gate' + (n.passed ? ' passed' : '') + (n.current ? ' cur' : '')
      const nm = document.createElement('span')
      nm.textContent = n.name.replace(/劫$/, '')
      box.appendChild(nm)
      const sub = document.createElement('i')
      sub.textContent = n.passed ? `已渡${n.passes ? '·' + n.passes + '成' : ''}` : (n.current ? '在此' : '未至')
      box.appendChild(sub)
      box.title = `第 ${n.index + 1} 关 · ${n.name}：${n.fromRealm} → ${n.toRealm}\n关口需求战力 ${fmt(n.trialReq)}（系数 ${n.fk}）\n战绩 ${n.tries} 试 ${n.passes} 成`
      frag.appendChild(box)
    }
    gateBox.replaceChildren(frag)
  }

  // ③ 准备项
  const fragp = document.createDocumentFragment()
  for (const v of preps.views) {
    const row = document.createElement('div')
    row.className = 'tr-row' + (v.active ? '' : (v.state === 'ready' ? '' : ' locked'))

    const pn = document.createElement('span')
    pn.className = 'pn'
    pn.textContent = v.name
    pn.title = `${v.from}`

    const pd = document.createElement('span')
    pd.className = 'pd'
    pd.textContent = v.message + (v.active ? '' : `　${v.note}`)

    const pb = document.createElement('span')
    pb.className = 'pb'
    pb.textContent = `+${Math.round(v.bonusPct * 100)}%`

    const btn = document.createElement('button')
    btn.className = 'mini' + (v.active ? ' on' : '')
    const lacked = v.kind === 'consume' && v.state === 'lack' && canAutoBrew(v)
    if (v.active) {
      btn.textContent = '已备'
      btn.disabled = true
      btn.title = '这一回天雷已经带上它了'
    } else if (cur >= 0 && (v.state === 'ready' || lacked)) {
      btn.textContent = lacked
        ? '炼 丹 服 下'
        : (v.kind === 'consume' ? '服下' : (v.kind === 'contrib' ? '请援' : '备妥'))
      btn.dataset.prep = v.id
      btn.title = lacked
        ? '囊中无此丹、但材料充足：点一下即由丹房自动开炉，炼成随即服下'
        : (v.kind === 'consume' ? '服下即刻生效；成败皆不退还' : '花贡献请同门结阵护法')
    } else {
      btn.textContent = '—'
      btn.disabled = true
      btn.title = cur >= 0 ? v.note : '需站在第九重关口上才可准备'
    }

    row.append(pn, pd, pb, btn)
    fragp.appendChild(row)
  }
  dom.trialPreps.replaceChildren(fragp)

  // ④ 静养按钮（有道伤才出现）
  const ds = state.buffs.find((b) => b.id === TRIBULATION.daoShang.id)
  dom.btnTrialCure.hidden = !ds
  if (ds) {
    const cost = cult.cureCost()
    const lack = (state.resources.stones | 0) < cost
    dom.btnTrialCure.textContent = `静养疗伤 · ${cost} 灵石`
    dom.btnTrialCure.disabled = lack
    dom.btnTrialCure.title = lack
      ? `灵石不足（需 ${cost}）`
      : `道伤：产出 −30%，剩余 ${fmtDuration(ds.endsAt - Date.now())}；花 ${cost} 灵石静养即可尽去`
  }

  // 前往引雷：条件不足时说清楚缺什么
  const goBtn = dom.btnTrialGo
  goBtn.disabled = !preview.ready
  goBtn.title = preview.ready
    ? '关闭本面板，去主界面引雷（三道天雷 · 过二即成）'
    : `尚不可冲击：${preview.blocked || '条件不足'}`

  const capPct = Math.round(preps.cap * 100)
  dom.trialNote.textContent =
    `八道天关（炼气→筑基 · … · 大乘→飞升）每境第九重开启；三道天雷过二即成，` +
    `准备加成合计上限 +${capPct}%（破例项见 item 表：护劫丹 +10% · 镇雷法宝 +8% · 灵兽助战 +7% · 道行天赋 +5% · 宗门援助 +5%）。` +
    `准备只对这一回天雷负责：引雷之后不论成败，服下的丹与请来的援都不留存。渡劫失败损失 30% 修为并落下道伤（可静养或等待消散），不掉级、不遗失宝物。`
}

// 渡劫面板交互（事件委托：面板每次重绘，避免丢监听）
dom.trialPreps.addEventListener('click', (e) => {
  const b = e.target.closest('[data-prep]')
  if (!b || b.disabled) return
  let res = cult.prepare(b.dataset.prep)
  // 护劫丹见底而材料充足 → 丹房自动开炉，炼成随即服下（主人 2026-09-17 口径）
  if (!res.ok) {
    const v = cult.prepViews().find((x) => x.id === b.dataset.prep)
    if (v && v.itemId && /囊中没有/.test(res.message || '')) {
      const ab = alchemy.autoBrewFor(v.itemId)
      if (ab.attempts > 0) {
        pushLog(ab.message, ab.success ? 'ok' : 'fail')
        persist('alchemy-autobrew')
        if (ab.success) res = cult.prepare(b.dataset.prep)
      }
    }
  }
  pushLog(res.message, res.ok ? 'ok' : 'info')
  if (res.ok) {
    persist('trial-prep')
    renderTrial()
    render()
  }
})

dom.btnTrialCure.addEventListener('click', () => {
  const res = cult.cureDaoShang(Date.now())
  pushLog(res.message, res.ok ? 'ok' : 'info')
  if (res.ok) {
    persist('trial-cure')
    renderTrial()
    render()
  }
})

dom.btnTrialGo.addEventListener('click', () => {
  closeTrial()
  onBreakthrough()
})

// ── 设置 / 存档 / 背包 面板（1.8a 设置 · 1.8b 背包 · 1.8c 存档）────────────

function fmtBytes (n) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(2)} MB`
}

function fmtDateTime (ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (v) => String(v).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function setToggle (btn, on) {
  btn.textContent = on ? '开' : '关'
  btn.classList.toggle('on', !!on)
}

/**
 * 内容遮罩互斥：开一个新面板前，先把其余全部收掉（except 传"自己"的键）。
 * 集中一处维护 —— 新增面板只要登记进 closers，就不必再去改十一个 open 函数。
 */
function closeAllOverlays (except = '') {
  const closers = {
    bag: closeBag,
    alchemy: closeAlchemy,
    tech: closeTech,
    sect: closeSect,
    trial: closeTrial,

    market: closeMarket,
    dungeon: closeDungeon,
    beast: closeBeast,
    chronicle: closeChronicle,
    achv: closeAchv,
    panel: closePanel
  }
  for (const key of Object.keys(closers)) {
    if (key === except) continue
    closers[key]()
  }
}

// ── 3.4 面板转场（.ov 家族统一走这两个函数；新增遮罩务必照抄，别再直接 add/remove 'show'）──
// 时序要求（硬约束）：关闭时**必须立刻**摘掉 .show —— syncDragRegions() 靠 `.ov.show` 判「有没有
// 遮罩开着」，若等动画播完再摘，这一百多毫秒里拖拽区判定滞后；反过来若保留 .show，遮罩会继续
// 吞点击（关掉后马上点快捷条会点不动）。所以：立即摘 .show，反向动画另挂 .closing 承接。
const OV_CLOSING_MS = MOTION.panel.outMs + 120   // 兜底时长（动画被取消时 animationend 不触发）
let ovOpenGuard = false                          // 3.5：同一轮里"关旧开新"只留"开"那一声（见 ovHide）

/** 打开 .ov 遮罩（清掉可能残留的 .closing，再播打开转场） */
function ovShow (el) {
  if (!el) return
  el.classList.remove('closing')
  el.classList.add('show')
  // 3.5 音效：面板开一声。互斥切换时"关旧"的那一声由 ovOpenGuard 压掉（只响开的那下）
  ovOpenGuard = true
  setTimeout(() => { ovOpenGuard = false }, 0)
  sfx('ui_open', { gainScale: 0.7, throttleMs: 120 })
}

/** 关闭 .ov 遮罩：立即摘 .show（拖拽判定即时恢复），另挂 .closing 播反向淡出 */
function ovHide (el) {
  if (!el || !el.classList.contains('show')) {
    if (el) el.classList.remove('closing')
    return
  }
  el.classList.remove('show')
  // 3.5 音效：滞后一拍再决定响不响 —— 若同一轮里紧接着开了新面板（互斥切换），这声就省掉
  setTimeout(() => { if (!ovOpenGuard) sfx('ui_close', { gainScale: 0.6, throttleMs: 120 }) }, 0)
  if (motionMode() === 'static') {
    el.classList.remove('closing')
    return
  }
  el.classList.add('closing')
  const done = () => el.classList.remove('closing')
  el.addEventListener('animationend', done, { once: true })
  setTimeout(done, OV_CLOSING_MS)
}

// 背包：独立遮罩（只装行囊；丹房已独立成 #alchemy-overlay）
function openBag () {
  if (!state) return
  closeTip()
  closeAllOverlays('bag')
  renderBag()
  ovShow(dom.bagOverlay)
  dom.btnBag.classList.add('on')
  syncDragRegions()
}

function closeBag () {
  ovHide(dom.bagOverlay)
  dom.btnBag.classList.remove('on')
  syncDragRegions()
}

// 丹房：独立遮罩（主人 2026-09-17：背包与丹房界面分离）
function openAlchemy () {
  if (!state) return
  closeTip()
  closeAllOverlays('alchemy')
  renderAlchemy()
  ovShow(dom.alchemyOverlay)
  dom.btnAlchemy.classList.add('on')
  syncDragRegions()
}

function closeAlchemy () {
  ovHide(dom.alchemyOverlay)
  dom.btnAlchemy.classList.remove('on')
  syncDragRegions()
}

function toggleAlchemy () {
  if (dom.alchemyOverlay.classList.contains('show')) closeAlchemy()
  else openAlchemy()
}

function toggleBag () {
  if (dom.bagOverlay.classList.contains('show')) closeBag()
  else openBag()
}

// ── 功法面板（2.1）：主修 / 辅修 · 装备 · 升级 ────────────────────────────

function openTech () {
  if (!state) return
  closeTip()
  closeAllOverlays('tech')
  renderTech()
  ovShow(dom.techOverlay)
  dom.btnTech.classList.add('on')
  syncDragRegions()
}

function closeTech () {
  ovHide(dom.techOverlay)
  dom.btnTech.classList.remove('on')
  syncDragRegions()
}

function toggleTech () {
  if (dom.techOverlay.classList.contains('show')) closeTech()
  else openTech()
}

/** 槽位短名（按钮文案用） */
const SLOT_LABEL = { main: '主修', side0: '辅修一', side1: '辅修二' }
let techTick = 0   // 功法面板的节流计数（每 10 拍 ≈ 1 秒刷一次）
let sectTick = 0   // 宗门面板的节流计数（同上）

/** 品阶名带的颜色（品质语汇：灰→金→玉→紫→青） */
function tierColor (tier) {
  const m = TIER_MAP[tier]
  return m ? m.color : 'var(--ash)'
}

/** 主辅修徽记文案（V3.5.1 主人：一眼要分清这本功法是主修还是辅修） */
function slotKindText (slotKinds) {
  const kinds = slotKinds || []
  if (kinds.includes('main') && kinds.includes('side')) return '主辅皆可'
  if (kinds.includes('main')) return '主修'
  if (kinds.includes('side')) return '辅修'
  return '—'
}

function renderTech () {
  if (!state || !tech) return
  const sm = tech.summary()

  // ① 槽位
  const slotFrag = document.createDocumentFragment()
  for (const s of tech.slotList()) {
    const row = document.createElement('div')
    row.className = 'slot' + (s.id ? '' : ' empty')

    const sk = document.createElement('span')
    sk.className = 'sk'
    sk.textContent = s.label

    if (!s.unlocked) {
      const sp = document.createElement('span')
      sp.className = 'sp'
      sp.textContent = `未开启 · 需 ${s.unlockName} 期`
      row.append(sk, sp)
      slotFrag.appendChild(row)
      continue
    }

    if (!s.id) {
      const sp = document.createElement('span')
      sp.className = 'sp'
      sp.textContent = s.kind === 'main' ? '空 · 从下方「已习得」中入主修' : '空 · 可从下方「已习得」中入辅修'
      row.append(sk, sp)
      slotFrag.appendChild(row)
      continue
    }

    const sn = document.createElement('span')
    sn.className = 'sn'
    sn.style.color = tierColor(s.tech.tier)
    sn.textContent = s.tech.name

    const sl = document.createElement('span')
    sl.className = 'sl'
    const tr = s.train
    const trText = tr ? (tr.maxed ? '· 圆满' : `· 参悟 ${Math.round(tr.pct * 100)}%`) : ''
    sl.textContent = `${s.level}级 修为+${(s.pct * 100).toFixed(0)}% 战力+${(s.combatPct * 100).toFixed(1)}% ${trText}`
    sl.title = tr
      ? (tr.maxed
          ? '已至圆满：修为与战力加成都吃满'
          : `长期参悟：还差约 ${fmtRealSpan(tr.remainSec * 1000)}（在线挂机）自行精进 1 级，不耗灵气与灵石`)
      : ''

    const sp = document.createElement('span')
    sp.className = 'sp'
    sp.textContent = s.label2

    const up = document.createElement('button')
    up.className = 'mini'
    up.dataset.up = s.id
    const info = tech.upgradeInfo(s.id)
    up.textContent = info.maxed ? '圆满' : `升级 ${fmt(info.cost.qi)}`
    up.title = info.maxed
      ? '已至圆满'
      : `消耗 ${fmt(info.cost.qi)} 灵气 + ${fmt(info.cost.stone)} 灵石（${info.blocker || '可升级'}）\n` +
        `升级后：修为 +${(info.nextPct * 100).toFixed(0)}%，战力 +${(info.nextCombatPct * 100).toFixed(1)}%`
    up.disabled = info.maxed || !info.affordable

    const off = document.createElement('button')
    off.className = 'mini'
    off.dataset.unequip = s.kind
    off.textContent = '卸下'

    row.append(sk, sn, sl, sp, up, off)
    slotFrag.appendChild(row)
  }
  dom.techSlots.replaceChildren(slotFrag)

  // ② 已习得
  const cat = tech.catalog()
  const ownedRows = cat.filter((c) => c.owned)
  const ownedFrag = document.createDocumentFragment()
  for (const c of ownedRows) {
    const row = document.createElement('div')
    row.className = 'tech-row'

    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.style.color = tierColor(c.tech.tier)
    tn.textContent = c.tech.name

    const tg = document.createElement('span')
    tg.className = 'tg'
    tg.textContent = `${c.tierLabel} · ${slotKindText(c.slotKinds)}`

    const tl = document.createElement('span')
    tl.className = 'tl'
    tl.textContent = `${c.level}/${c.tech.maxLevel}级`

    const tp = document.createElement('span')
    tp.className = 'tp'
    tp.textContent = `修为+${(c.pct * 100).toFixed(0)}% 战力+${(c.combatPct * 100).toFixed(1)}%`
    tp.title = c.train
      ? (c.train.maxed
          ? '已至圆满'
          : `参悟进度 ${Math.round(c.train.pct * 100)}%（还差约 ${fmtRealSpan(c.train.remainSec * 1000)} 自行精进，仅在线计）`)
      : ''

    const ta = document.createElement('span')
    ta.className = 'ta'
    const matchText = c.match === 'any' ? '通用' : (c.match === 'yes' ? '与灵根同源' : (c.match === 'no' ? '异于灵根' : '—'))
    ta.textContent = c.equippedLabel ? `${c.equippedLabel} · ${matchText}` : matchText

    row.append(tn, tg, tl, tp, ta)

    if (!c.equipped) {
      const kinds = c.slotKinds
      const slots = tech.slotList()
      const tryKinds = (kinds.includes('main') ? ['main'] : []).concat(kinds.includes('side') ? ['side0', 'side1'] : [])
      for (const kind of tryKinds) {
        const slot = slots.find((s) => s.kind === kind)
        const locked = !slot.unlocked
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.dataset.equip = `${c.tech.id}|${kind}`
        btn.textContent = locked ? `${SLOT_LABEL[kind]}锁` : `入${SLOT_LABEL[kind]}`
        btn.disabled = locked
        if (locked) btn.title = `${SLOT_LABEL[kind]}需 ${slot.unlockName} 期开启`
        row.appendChild(btn)
      }
    }
    ownedFrag.appendChild(row)
  }
  dom.techOwned.replaceChildren(ownedFrag)

  // ③ 图鉴（未习得：只露名字/品阶/来源，作为内容预告）
  const catFrag = document.createDocumentFragment()
  for (const c of cat.filter((x) => !x.owned)) {
    const row = document.createElement('div')
    row.className = 'tech-row locked'

    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = c.tech.name

    const tg = document.createElement('span')
    tg.className = 'tg'
    tg.textContent = `${c.tierLabel} · ${slotKindText(c.slotKinds)}`

    const ta = document.createElement('span')
    ta.className = 'ta'
    ta.textContent = `${c.tech.source.label} · 满级 修为+${(maxRatePct(c.tech) * 100).toFixed(0)}% 战力+${(maxCombatPct(c.tech) * 100).toFixed(1)}%`

    row.append(tn, tg, ta)
    catFrag.appendChild(row)
  }
  dom.techCatalog.replaceChildren(catFrag)

  // ④ 脚注
  if (dom.techNote) {
    dom.techNote.textContent =
      `已装备功法合计：修为 ×${(1 + sm.pct).toFixed(2)}（+${(sm.pct * 100).toFixed(0)}%），战力 +${(sm.combatPct * 100).toFixed(1)}%。` +
      `两条升级路：① 花灵气 + 灵石即刻参悟（灵气与境界推进共用同一池）；② 装备中的功法随时间自行精进（在线挂机才计，免费但更慢）。` +
      `品阶越高，每一级给的修为与战力都越多 —— 玄阶每级 +17% 修为，天阶每级 +40%。未习得的功法见「图鉴 · 来源」`
  }
}

// 功法面板内的动作：事件委托（面板每次重绘，避免丢监听）
onPress(dom.techOverlay, (e) => {
  const up = e.target.closest('[data-up]')
  if (up && !up.disabled) {
    const id = up.dataset.up
    const res = tech.upgrade(id)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      persist('technique-upgrade')
      renderTech()
      render()          // 产出乘区变了 → 立即刷新面板数字
    }
    return
  }
  const eq = e.target.closest('[data-equip]')
  if (eq && !eq.disabled) {
    const [id, kind] = eq.dataset.equip.split('|')
    const res = tech.equip(id, kind)
    pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      persist('technique-equip')
      renderTech()
      render()
      emit('cult:burst', { kind: 'breakthrough' })
    }
    return
  }
  const un = e.target.closest('[data-unequip]')
  if (un) {
    const res = tech.unequip(un.dataset.unequip)
    pushLog(res.message, res.ok ? 'info' : 'info')
    if (res.ok) {
      persist('technique-unequip')
      renderTech()
      render()
    }
  }
})

// ── 宗门面板（2.4）：信息 / 任务板 / 藏经阁 / 商店 ─────────────────────────

function openSect () {
  if (!state) return
  closeTip()
  closeAllOverlays('sect')
  renderSect()
  ovShow(dom.sectOverlay)
  dom.btnSect.classList.add('on')
  syncDragRegions()
}

function closeSect () {
  ovHide(dom.sectOverlay)
  dom.btnSect.classList.remove('on')
  syncDragRegions()
}

function toggleSect () {
  if (dom.sectOverlay.classList.contains('show')) closeSect()
  else openSect()
}

/** 剩余时长文案：一律走游戏历（主人 2026-09-17：界面时间用游戏时间，不用现实时分） */
const fmtHoursLeft = (ms) => fmtGameDuration(ms)

/**
 * 宗门任务倒计时（主人 2026-09-19：任务限时按**游戏时辰**计）
 *   一条活计只有几个时辰 ≈ 现实十几秒，光看"2 时辰"不直观 → 游戏时辰 + 现实秒并列。
 */
function fmtTaskLeft (ms) {
  const sec = Math.max(0, Math.ceil((Number(ms) || 0) / 1000))
  if (sec <= 0) return '已到点'
  return `${fmtGameDuration(ms)}（现实 ${sec} 秒）`
}

function renderSect () {
  if (!state || !sect) return
  const info = sect.infoView()

  // ① 宗门信息（未入宗给「拜入」入口）
  let infoHtml = ''
  if (!info.joined) {
    infoHtml =
      `<div class="si-name">${info.sect.name}</div>` +
      `<div class="si-line">${info.sect.intro}</div>` +
      `<div class="si-line">道统：<span class="violet">${info.sect.daoTong.name}</span> —— ${info.sect.daoTong.desc}</div>` +
      `<div class="si-line">入宗免费，列身外门：领宗门任务攒贡献，可在藏经阁借功法、商店换丹药材料。</div>` +
      `<div class="si-btns"><button class="mini" data-join>拜 入 云 岚 宗</button></div>`
  } else {
    const r = info.rank
    const p = info.promo
    const promoLine = p.maxed
      ? `职级：<b>${r.name}</b>（已至掌门）`
      : `<b>${r.name}</b> → 下一职 ${p.next.name}（需 ${p.realmName}期 ／ 累计贡献 ${p.next.contrib}，现 ${info.totalContrib}）`
    // V3.3.1：宗门按境界下发功法的进度（哪一档已领、哪一档待领）
    const granted = (info.realmGrants || [])
      .filter((g) => g.unlocked)
      .map((g) => `${g.label}${g.techId && g.techId !== '—' ? `已授《${(getTechnique(g.techId) || {}).name || g.techId}》` : '已授'}`)
      .join(' ｜ ')
    const pendingGrant = (info.pendingGrants || []).length
      ? `<div class="si-line">宗门授功：<span class="jade">${info.pendingGrants.join('、')}</span>档的普通功法即将下发（每晋一大境界补一本）</div>`
      : ''
    infoHtml =
      `<div class="si-name">${info.sect.name}</div>` +
      `<div class="si-line">道统：<span class="violet">${info.sect.daoTong.name}</span> —— ${info.sect.daoTong.desc}</div>` +
      `<div class="si-line">职级：${promoLine}</div>` +
      `<div class="si-line">境界：<b>${info.realmName}</b>期　任务板按此境界出题、悬赏随境界递增</div>` +
      `<div class="si-line">贡献：<b>${info.contribution}</b>（累计 ${info.totalContrib}）　俸禄：${r.salaryHours} 时/日 ≈ <span class="jade">+${fmt(info.salaryPerDay)} 修为/日</span>（在线随秒入账）</div>` +
      (granted ? `<div class="si-line">宗门授功：${granted}</div>` : '') +
      pendingGrant +
      (p.can ? `<div class="si-btns"><button class="mini" data-promote>晋 升 ${p.next.name}</button></div>` : '')
  }
  dom.sectInfo.innerHTML = infoHtml

  // ② 任务板
  if (!info.joined) {
    dom.sectTasks.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const t of sect.tasksView()) {
      if (t.broken) continue
      const row = document.createElement('div')
      row.className = 'sect-row' + (t.state === 'empty' ? ' locked' : '')

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = t.def.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = t.def.desc
      // 悬赏：贡献 +（材料）——主人 2026-09-17 标清奖励；09-18 起随境界递增
      const reward = document.createElement('div')
      const mat = t.def.material ? ` · ${getItem(t.def.material.id).name} ×${t.def.material.min}~${t.def.material.max}` : ''
      reward.textContent = `悬赏：贡献 +${t.contrib}${mat}${t.def.failHalf ? '（战力校验失败减半）' : ''}`
      reward.style.color = 'rgba(232,185,106,0.78)'
      td.appendChild(reward)
      if (t.def.minRealm > 0) {
        const tag = document.createElement('em')
        tag.textContent = `${getRealmMeta(t.def.minRealm).name}期解锁 · 重赏`
        tag.style.color = 'rgba(185,140,255,0.8)'
        td.appendChild(tag)
      }
      // 战力类：达标提示（接取即办妥 / 达标必成）
      if (t.def.kind === 'power' && t.state === 'open' && t.outmatched) {
        const em = document.createElement('em')
        em.textContent = '战力已过定标 · 接取即办妥'
        em.style.color = 'rgba(127,214,168,0.85)'
        td.appendChild(em)
      }
      if (t.state === 'running' && t.def.kind === 'power') {
        const em = document.createElement('em')
        em.textContent = `定标战力 ${fmt(t.req)} ｜ 当前成率 ${(t.liveRate * 100).toFixed(0)}%${t.outmatched ? ' · 达标必成' : ''}`
        em.style.color = 'rgba(232,185,106,0.75)'
        td.appendChild(em)
      }
      if (t.state === 'running') {
        // 提前交差：看得见"现在交能拿多少"
        const pre = document.createElement('em')
        pre.textContent = t.done
          ? '时辰已到 · 下一拍自动交差并结算'
          : `已办妥 ${Math.round((t.ratio || 0) * 100)}% → 提前交差可得贡献 +${t.previewContrib}（到点自动满额结算）`
        pre.style.color = 'rgba(127,214,168,0.8)'
        td.appendChild(pre)
      }

      const tp = document.createElement('span')
      tp.className = 'tp' + (t.state === 'running' && !t.done ? ' dim' : '')
      // 任务时长与倒计时：限时＝游戏时辰，倒计时另附现实秒（短活计只有十几秒）
      if (t.state === 'open') tp.textContent = `${t.def.hours} 时辰`
      else if (t.state === 'running') tp.textContent = t.done ? '已到点' : `还差 ${fmtTaskLeft(t.autoInMs)}`
      else tp.textContent = '本轮已交'

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (t.state === 'open') {
        btn.textContent = '接取'
        btn.dataset.taskStart = t.index
        if (t.def.kind === 'power') {
          btn.title = t.outmatched
            ? '战力已过定标：接取当场办妥（贡献按满额算）'
            : '战力未过定标：接取后到时按战力判定成败，也可提前交差'
        }
      } else if (t.state === 'running') {
        // 接取后随时可交（门槛 min(10% 时长, 1 秒)）；到点则由主循环自动交差
        btn.textContent = t.done ? '交差' : '提前交差'
        btn.disabled = !t.claimable
        btn.dataset.taskClaim = t.index
        if (!t.claimable) {
          const wait = Math.max(1, Math.ceil((t.gateMs - t.elapsedMs) / 1000))
          btn.title = `才刚接手，至少办够 ${(t.gateMs / 1000).toFixed(1)} 秒才好交差（约 ${wait} 秒后）`
        } else if (!t.done) {
          btn.title = `提前交差：按已办妥 ${Math.round((t.ratio || 0) * 100)}% 折算（贡献 +${t.previewContrib}）；\n不点也行——到点会自动满额交差`
        } else {
          btn.title = '办妥交差，满额结算（到点也会自动交）'
        }
      } else {
        btn.textContent = '—'
        btn.disabled = true
      }

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectTasks.replaceChildren(frag)
  }

  // ③ 藏经阁
  if (!info.joined) {
    dom.sectLibrary.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of sect.libraryView()) {
      const row = document.createElement('div')
      row.className = 'sect-row' + (e.rankLocked ? ' locked' : '')

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = e.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = `${e.tierLabel} ｜ ${e.rankLocked ? '需内门职级' : '可借阅'}`

      const tp = document.createElement('span')
      tp.className = 'tp dim'
      tp.textContent = `${e.cost} 贡献`

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (e.owned) { btn.textContent = '已习得'; btn.disabled = true }
      else { btn.textContent = '借阅'; btn.dataset.libBuy = e.id; btn.disabled = e.rankLocked }

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectLibrary.replaceChildren(frag)
  }

  // ④ 宗门商店
  if (!info.joined) {
    dom.sectShop.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of sect.shopView()) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = e.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = `${getItem(e.id).desc}`

      const tp = document.createElement('span')
      tp.className = 'tp dim'
      tp.textContent = e.discounted ? `${e.cost}→${e.price} 贡献` : `${e.price} 贡献`

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      btn.textContent = '兑换'
      btn.dataset.shopBuy = e.id

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectShop.replaceChildren(frag)
  }

  if (dom.sectNote) {
    dom.sectNote.textContent = info.joined
      ? `任务板${info.refreshText || fmtRefreshPeriod()}刷新一次（交完本轮转空 · 距下一轮 ${fmtTaskLeft(info.nextRefreshInMs || msToNextRefresh(Date.now()))}）；` +
        '任务按境界出题、悬赏随境界递增（每晋一大境界 +60%）；' +
        '限时按**游戏时辰**计（如巡山两个时辰），**时辰一到自动交差入账**，中途也可手动提前交差（按已办妥比例折算）；' +
        '战力校验类的定标以「基准战力 × 系数」为准：**战力已达标者接取即办妥**，未达标则到时按概率判定、失败贡献减半。' +
        '每晋一大境界，宗门还会下发一本该境界的普通功法（藏经阁高阶功法仍须贡献借阅）。' +
        '俸禄只随在线时间发放，闭关（离线）不结俸。'
      : '青岚界三宗：云岚宗（剑）｜丹霞谷（丹）｜磐石门（体）。本档开放云岚宗；名册随世界替换（2.9 世界卡池接入）。入宗即按当前境界下发普通功法，可在藏经阁以贡献借阅更多。'
  }
}

// 宗门面板动作（事件委托：面板每次重绘不丢监听）
dom.sectOverlay.addEventListener('click', (e) => {
  const join = e.target.closest('[data-join]')
  if (join) {
    const res = sect.join()
    pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      // 入宗即按境界下发功法（主人 2026-09-18）
      for (const g of (res.grants || [])) {
        pushLog(`宗门授功：${g.realmName}期弟子当习《${g.name}》，已录入功法册（去「功法」装槽）。`, 'root')
      }
      persist('sect-join')
      emitBurst({ kind: 'breakthrough' })
    }
    renderSect()
    return
  }
  const promo = e.target.closest('[data-promote]')
  if (promo) {
    const res = sect.promote()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { persist('sect-promote'); emitBurst({ kind: 'breakthrough' }) }
    renderSect()
    return
  }
  const ts = e.target.closest('[data-task-start]')
  if (ts && !ts.disabled) {
    const res = sect.startTask(+ts.dataset.taskStart)
    pushLog(res.message, res.ok ? (res.instant ? 'ok' : 'info') : 'info')
    if (res.ok && res.instant) {
      // 战力碾压：接取当场办妥（主人 2026-09-19）
      persist('sect-task-instant')
      emitFloat({ text: `贡献 +${res.contrib}`, kind: 'gold' })
    }
    renderSect()
    return
  }
  const tc = e.target.closest('[data-task-claim]')
  if (tc && !tc.disabled) {
    const res = sect.claimTask(+tc.dataset.taskClaim)
    pushLog(res.message, res.ok && res.success ? 'ok' : (res.ok ? 'fail' : 'info'))
    if (res.ok) {
      persist('sect-claim')
      emitFloat({ text: `贡献 +${res.contrib}${res.early ? '（提前）' : ''}`, kind: 'info' })
    } else {
      // 提前交差被拒（还没过门槛）也要给回执，别让人以为按钮坏了
      renderSect()
      return
    }
    renderSect()
    return
  }
  const lb = e.target.closest('[data-lib-buy]')
  if (lb && !lb.disabled) {
    const res = sect.buyLibrary(lb.dataset.libBuy)
    pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) { persist('sect-library'); emitBurst({ kind: 'breakthrough' }) }
    renderSect()
    return
  }
  const sb = e.target.closest('[data-shop-buy]')
  if (sb && !sb.disabled) {
    const res = sect.buyShop(sb.dataset.shopBuy)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) persist('sect-shop')
    renderSect()
  }
})

// ══ 2.7 秘境 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）═════════
// 接线内容：秘境遮罩（#dungeon-overlay）· 试炼塔挑战 · 资源秘境首通/派遣 ·
//           分身召回 · 主循环到期结算（真实时间驱动，离线照算）· 周扫荡

let dungeonTick = 0   // 秘境面板的节流计数（每 10 拍 ≈ 1 秒刷一次，倒计时跟拍）

function openDungeon () {
  if (!state) return
  closeTip()
  closeAllOverlays('dungeon')
  renderDungeon()
  ovShow(dom.dungeonOverlay)
  dom.btnDungeon.classList.add('on')
  syncDragRegions()
}

function closeDungeon () {
  ovHide(dom.dungeonOverlay)
  dom.btnDungeon.classList.remove('on')
  syncDragRegions()
}

function toggleDungeon () {
  if (dom.dungeonOverlay.classList.contains('show')) closeDungeon()
  else openDungeon()
}

function renderDungeon () {
  if (!state || !dungeon) return
  const now = Date.now()

  // ① 试炼塔（首通 + 里程碑的奖励内容都写出来）
  const tv = dungeon.towerView()
  let towerHtml
  if (tv.next) {
    const n = tv.next
    towerHtml =
      `<div class="dungeon-row">` +
      `<span class="dn">试炼塔</span>` +
      `<span class="dd">已通 <b>${tv.cleared}</b> / ${tv.floors} 层　当前战力 <b>${fmt(tv.power)}</b></span>` +
      `<span class="ds">周扫荡 <b>+${fmt(tv.weekly.stones)}</b> 灵石<br>还差 ${fmtGameDuration(tv.weekly.nextInMs)}</span>` +
      `</div>` +
      `<div class="dungeon-row">` +
      `<span class="dn">第 ${n.floor} 层</span>` +
      `<span class="dd">推荐战力 <b>${fmt(n.needPower)}</b>　首通奖励：灵石 <b>+${fmt(n.stones)}</b>` +
      (n.milestone ? `　里程碑：<b>${n.milestone}</b>（折算灵石 +${fmt(n.milestoneStones)}）` : '') +
      `</span>` +
      `<div class="dbtns"><button class="d-btn" data-tower-challenge${n.canChallenge ? '' : ' disabled'}>${n.canChallenge ? '挑 战' : '战力不足'}</button></div>` +
      `</div>`
  } else {
    towerHtml =
      `<div class="dungeon-row"><span class="dn">试炼塔</span><span class="dd">已通满 <b>${tv.floors}</b> 层，更高层随版本开放</span>` +
      `<span class="ds">周扫荡 <b>+${fmt(tv.weekly.stones)}</b> 灵石<br>还差 ${fmtGameDuration(tv.weekly.nextInMs)}</span></div>`
  }
  dom.dungeonTower.innerHTML = towerHtml

  // ② 资源秘境（首通/派遣的奖励内容逐项标注）
  const resFrag = document.createDocumentFragment()
  for (const r of dungeon.resourceView()) {
    const row = document.createElement('div')
    row.className = 'dungeon-row' + (r.unlocked ? '' : ' locked')
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = r.name
    const dd = document.createElement('span')
    dd.className = 'dd'
    if (!r.unlocked) {
      dd.textContent = `需 ${r.unlockRealmName}期开放`
    } else if (r.cleared >= 4) {
      dd.innerHTML = `已通满 4 层 · 派遣收益 <b>+${r.stars * 10}%</b>（★${r.stars}）　材料：<b>${r.materialName}</b>`
    } else {
      // 主人 2026-09-18：只标基础奖励（首通给什么），不再替玩家逐档算派遣收益
      const techLine = r.techId
        ? ` · 功法《${(getTechnique(r.techId) || {}).name || r.techId}》`
        : ''
      dd.innerHTML = `已通 ${r.cleared}/4 层 ｜ 主题：${r.theme}<br>` +
        `首通${r.nextName}（需战力 <b>${fmt(r.nextPower)}</b>）：灵石 <b>+${fmt(r.nextStones)}</b> · ${r.materialName} <b>+${r.nextMats}</b>${techLine}`
    }
    if (r.surprise) {
      const sup = document.createElement('div')
      sup.textContent = '此境最不可测：派遣归来或有〔机缘〕（遗藏 / 残卷），也可能〔触动禁制〕（所获寥寥）'
      sup.style.color = 'rgba(185,140,255,0.85)'
      dd.appendChild(sup)
    }
    if (r.canDispatch) {
      // 基础收益/小时（时长自选，具体数字不再逐档罗列）
      const line = document.createElement('div')
      const b = r.dispatchBase
      line.textContent =
        `派遣基础（${b.depthName}·★${b.stars}）：灵石 +${fmt(b.stonesPerHour)}/小时 · ${b.matName} +${b.matsPerHour}/小时` +
        `　·　每趟 ${Math.round(r.techDropPct * 100)}% 拾得功法残卷`
      line.style.color = 'rgba(127,214,168,0.85)'
      dd.appendChild(line)
    }
    const dbtns = document.createElement('div')
    dbtns.className = 'dbtns'
    if (r.unlocked && r.cleared < 4) {
      const btn = document.createElement('button')
      btn.className = 'd-btn'
      btn.textContent = '首 通'
      btn.dataset.resChallenge = `${r.id}|${r.nextDepth}`
      btn.disabled = !r.canChallenge
      btn.title = `首通奖励：灵石 +${fmt(r.nextStones)}、${r.materialName} +${r.nextMats}（按战力溢出评 1~3 星，星级永久提高派遣收益）`
      dbtns.appendChild(btn)
    }
    if (r.canDispatch) {
      for (const o of r.dispatchOptions) {
        const b = document.createElement('button')
        b.className = 'd-btn'
        b.textContent = `派${o.hours}h`
        b.dataset.resDispatch = `${r.id}|${r.cleared}|${o.hours}`
        b.title = `派分身驻留 ${fmtGameDuration(o.hours * 3600 * 1000)}（游戏历）：预计灵石 +${fmt(o.stones)}、${o.matName} +${o.mats}（离线照算 · 自动续派）`
        dbtns.appendChild(b)
      }
    }
    row.append(dn, dd, dbtns)
    resFrag.appendChild(row)
  }
  dom.dungeonRes.replaceChildren(resFrag)

  // ③ 分身派遣（槽位随大境界递增，阶梯写清楚）
  const dv = dungeon.dispatchView(now)
  const dispatchFrag = document.createDocumentFragment()
  const head = document.createElement('div')
  head.className = 'dungeon-row'
  head.innerHTML = `<span class="dn">分身槽</span><span class="dd">${dv.slots === 0 ? '金丹期解锁第一具分身' : `已用 <b>${dv.used}</b> / <b>${dv.slots}</b> 槽`}</span><span class="ds dim">离线照算 · 自动续派</span>`
  dispatchFrag.appendChild(head)

  const ladder = document.createElement('div')
  ladder.className = 'dungeon-row'
  ladder.innerHTML = '<span class="dn">槽位阶梯</span><span class="dd">' +
    dv.ladder.map((k) => `${k.current ? '<b>' : ''}${k.realmName} ${k.slots} 槽${k.current ? '</b>' : ''}`).join(' → ') +
    '　（每晋一大境界 +1 具，合体 5 槽封顶）</span>'
  dispatchFrag.appendChild(ladder)

  if (!dv.runs.length) {
    const empty = document.createElement('div')
    empty.className = 'bag-empty'
    empty.textContent = dv.slots === 0 ? '金丹期方得第一具分身' : '尚无分身驻留 · 到「资源秘境」选秘境派出一具'
    dispatchFrag.appendChild(empty)
  }
  for (const run of dv.runs) {
    const row = document.createElement('div')
    row.className = 'dungeon-row'
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = run.dungeonName
    const dd = document.createElement('span')
    dd.className = 'dd'
    dd.textContent = `${run.depthName} · ${run.hours}h · ★${run.stars} · 每趟结算：灵石 +${fmt(run.stones)}、${run.matName} +${run.mats}`
    const ds = document.createElement('span')
    ds.className = 'ds'
    ds.textContent = run.done ? '结算中…' : `还差 ${fmtHoursLeft(run.remainingMs)}`
    const btn = document.createElement('button')
    btn.className = 'd-btn'
    btn.textContent = '召回'
    btn.dataset.recall = run.index
    row.append(dn, dd, ds, btn)
    dispatchFrag.appendChild(row)
  }
  dom.dungeonDispatch.replaceChildren(dispatchFrag)

  if (dom.dungeonNote) {
    dom.dungeonNote.textContent =
      '秘境线以灵石、主题材料与功法残卷结算（不发境界）；当量 h 按灵石时薪折算，与随机事件同口径。' +
      '首通某层必得该档功法一本（已收满则折灵石），派遣每趟另有概率拾得残卷；' +
      '派遣收益随首通评星永久 +10%/星，周扫荡每周一自动入账；界面倒计时按游戏历显示（现实 2 小时 = 游戏 30 天）。'
  }
}

// 秘境面板动作（事件委托：面板每次重绘不丢监听）
onPress(dom.dungeonOverlay, (e) => {
  const tc = e.target.closest('[data-tower-challenge]')
  if (tc && !tc.disabled) {
    const res = dungeon.challengeTower()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      persist('dungeon-tower')
      emitBurst({ kind: 'breakthrough' })
      emitFloat({ text: `试炼塔第 ${res.floor} 层`, kind: 'info' })
    }
    renderDungeon()
    return
  }
  const rc = e.target.closest('[data-res-challenge]')
  if (rc && !rc.disabled) {
    const [id, depth] = rc.dataset.resChallenge.split('|')
    const res = dungeon.challengeResource(id, +depth)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      persist('dungeon-res')
      emitBurst({ kind: 'breakthrough' })
      emitFloat({ text: `首通 ${res.dungeon.name} · ${res.stars} 星`, kind: 'ok' })
      if (res.techName) emitFloat({ text: `得功法《${res.techName}》`, kind: 'root' }, 260)
    }
    renderDungeon()
    return
  }
  const rd = e.target.closest('[data-res-dispatch]')
  if (rd && !rd.disabled) {
    const [id, depth, hours] = rd.dataset.resDispatch.split('|')
    const res = dungeon.dispatch(id, +depth, +hours)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      persist('dungeon-dispatch')
      emitFloat({ text: `分身驻留 ${res.dungeonName || ''}`, kind: 'info' })
    }
    renderDungeon()
    return
  }
  const rcl = e.target.closest('[data-recall]')
  if (rcl && !rcl.disabled) {
    const res = dungeon.recall(+rcl.dataset.recall)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      sfx('dungeon_clear', { throttleMs: 400 })   // 3.5 音效：分身召回结算
      persist('dungeon-recall')
      if (res.stones > 0) emitFloat({ text: `召回 +${fmt(res.stones)} 灵石`, kind: 'info' })
      if (res.techName) emitFloat({ text: `残卷《${res.techName}》`, kind: 'root' }, 260)
    }
    renderDungeon()
  }
})
// ══ 2.7 秘境 装配区结束 ═════════════════════════════════════════════════════

// ══ 2.8 灵兽 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）═══════
// 接线内容：灵兽遮罩（#beast-overlay）· 万兽林派遣 · 孵化（妖丹催孵）·
//           灵兽园喂养/出战 · 主循环被动产出随秒入账（离线不发）
// 渡劫助战 / 宗门战力加成不在此接：经 boot 注入由 CultivationSystem / SectSystem 自取。

let beastTick = 0   // 灵兽面板的节流计数（每 10 拍 ≈ 1 秒刷一次，倒计时跟拍）

function openBeast () {
  if (!state) return
  closeTip()
  closeAllOverlays('beast')
  renderBeast()
  ovShow(dom.beastOverlay)
  dom.btnBeast.classList.add('on')
  syncDragRegions()
}

function closeBeast () {
  ovHide(dom.beastOverlay)
  dom.btnBeast.classList.remove('on')
  syncDragRegions()
}

function toggleBeast () {
  if (dom.beastOverlay.classList.contains('show')) closeBeast()
  else openBeast()
}

function renderBeast () {
  if (!state || !beasts) return
  const now = Date.now()
  const ov = beasts.overviewView(now)

  // ① 园况总览（主人 2026-09-18：文字精简，细则移进关键名词的悬停说明）
  if (!ov.unlocked && !ov.pets) {
    dom.beastInfo.innerHTML =
      '<div class="si-name">灵兽 · 尚未开园</div>' +
      '<div class="si-line">金丹期方可入万兽林寻蛋。</div>'
  } else {
    dom.beastInfo.innerHTML =
      `<div class="si-name">灵兽园 ${ov.pets}/${ov.parkCap}${ov.eggs ? ` · 蛋 ${ov.eggs}` : ''}</div>` +
      `<div class="si-line">出战：${ov.activeName ? `<b>${ov.activeName}</b>` : '<span style="color:#8f877c">空缺</span>'}` +
      `　产出：${ov.productionHours > 0 ? `<span class="jade" title="被动产出＝基准产出 × 0.2 时/日 × 品级系数 × 等级系数（上限 0.6 时/日），随在线秒入账，离线不发">+${fmt(ov.productionPerDay)}/日</span>` : '—'}` +
      `　战力 <span title="出战灵兽战力 +4%（皇品 +8%），计入宗门战力任务定标与秘境门槛">+${Math.round(ov.powerBonusPct * 100)}%</span>` +
      `　渡劫 <span title="渡劫时出战灵兽替你挡一线雷威：单道天雷通过率 +7%（持有即生效，不必另备）">+${Math.round(ov.trialAidPct * 100)}%</span></div>`
  }

  // ② 万兽林派遣
  if (!ov.unlocked) {
    dom.beastDispatch.innerHTML = '<div class="bag-empty">金丹期解锁</div>'
  } else {
    const dv = beasts.dispatchView(now)
    const autoEggOn = state.settings.autoEgg !== false
    const row = document.createElement('div')
    row.className = 'sect-row'
    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = '灵鹰寻蛋'
    const td = document.createElement('span')
    td.className = 'td'
    td.textContent = `每轮 1 次 · 去 ${fmtGameDuration(dv.hours * 3600 * 1000)}`
    td.title = `灵鹰入林一次带回一枚灵兽蛋，品级概率：凡 70% ｜ 灵 22% ｜ 王 7% ｜ 皇 1%\n` +
      `一轮＝${fmtRefreshPeriod()}（距下一轮 ${fmtGameDuration(msToNextRefresh(now))}）` +
      `${autoEggOn ? '\n已开「自动寻蛋」：灵鹰得空即入林，归巢自动收蛋（孵化与破壳仍由你决定）' : '\n当前为手动派遣（设置面板可开「自动寻蛋」）'}`
    const tp = document.createElement('span')
    tp.className = 'tp' + (dv.running && !dv.done ? ' dim' : '')
    tp.textContent = dv.collected ? '已归巢' : (dv.running ? `还差 ${dv.leftText}` : '待派遣')
    const btn = document.createElement('button')
    btn.className = 'mini gap'
    if (dv.collected) {
      btn.textContent = '领蛋'
      btn.dataset.dispatchCollect = '1'
    } else if (dv.running) {
      btn.textContent = '搜寻中'
      btn.disabled = true
    } else {
      btn.textContent = '派遣'
      btn.dataset.dispatch = '1'
    }
    row.append(tn, td, tp, btn)
    dom.beastDispatch.replaceChildren(row)
  }

  // ③ 蛋与孵化位（单孵位：同时只孵一枚）
  const eggs = beasts.eggsView(now)
  if (!eggs.length) {
    dom.beastEggs.innerHTML = '<div class="bag-empty">笼中无蛋 · 先派灵鹰入万兽林</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of eggs) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = `${e.gradeName}蛋`
      tn.style.color = e.color
      tn.title = `${e.gradeName}灵兽蛋 · 孵期 ${fmtGameDuration(e.hatchHours * 3600 * 1000)}（游戏历），1 枚妖丹可催短 ${fmtGameDuration(3600 * 1000)}`

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = e.hatching
        ? `${Math.round(e.pct * 100)}% · 孵期 ${fmtGameDuration(e.hatchHours * 3600 * 1000)}`
        : `待入孵 · ${fmtGameDuration(e.hatchHours * 3600 * 1000)}`

      const tp = document.createElement('span')
      tp.className = 'tp' + (e.hatching && !e.done ? ' dim' : '')
      tp.textContent = e.hatching ? (e.done ? '可破壳' : `还差 ${e.leftText}`) : '—'

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (e.hatching && e.done) {
        btn.textContent = '破壳'
        btn.dataset.hatchClaim = '1'
      } else if (e.hatching) {
        btn.textContent = '催孵'
        btn.dataset.hatchSpeed = '1'
        btn.title = `消耗 1 枚妖丹，孵期缩短 ${fmtGameDuration(3600 * 1000)}（游戏历）`
      } else if (e.isSlot === false && eggs.some((x) => x.hatching)) {
        btn.textContent = '排队'
        btn.disabled = true
        btn.title = '孵化位只有一个，先孵完这枚'
      } else {
        btn.textContent = '入孵'
        btn.dataset.hatch = e.uid
      }
      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.beastEggs.replaceChildren(frag)
  }

  // ④ 灵兽园（一兽一行：名字 + 等级 + 状态，细则进悬停）
  const pets = beasts.petsView()
  if (!pets.length) {
    dom.beastPark.innerHTML = '<div class="bag-empty">园中空空 · 灵兽破壳后在此安家</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const p of pets) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = p.name
      tn.style.color = p.color
      tn.title = `${p.gradeName}「${p.name}」${p.desc ? `\n${p.desc}` : ''}\n品级系数 ×${p.grade === 'huang' ? '2.0' : p.grade === 'wang' ? '1.5' : p.grade === 'ling' ? '1.2' : '1.0'}`

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = p.level >= 9
        ? `${p.gradeName} · Lv.${p.level}/9 · 圆满`
        : `${p.gradeName} · Lv.${p.level}/9 · 成长 ${Math.round(p.growPct * 100)}%`
      td.title = `等级系数 ×${p.levelCoef.toFixed(1)}（每级 +10%）· 产出 ${p.outputHours.toFixed(1)} 时/日 · 战力 +${Math.round(p.powerPct * 100)}%\n` +
        `${p.growText} · 在线挂机自动累积\n喂养消耗 1 枚妖丹升 1 级（快路），8% 概率悟性爆发连升 2 级`

      const tp = document.createElement('span')
      tp.className = 'tp' + (p.active ? '' : ' dim')
      tp.textContent = p.active ? '出战中' : '待命'

      const feedBtn = document.createElement('button')
      feedBtn.className = 'mini'
      feedBtn.textContent = p.level >= 9 ? '圆满' : '喂养'
      feedBtn.title = p.level >= 9 ? '已至 9 级圆满' : '消耗 1 枚妖丹升 1 级（8% 悟性爆发连升 2 级）'
      feedBtn.disabled = p.level >= 9
      feedBtn.dataset.feed = p.uid

      const actBtn = document.createElement('button')
      actBtn.className = 'mini gap'
      if (p.active) { actBtn.textContent = '—'; actBtn.disabled = true }
      else { actBtn.textContent = '出战'; actBtn.dataset.active = p.uid }

      row.append(tn, td, tp, feedBtn, actBtn)
      frag.appendChild(row)
    }
    dom.beastPark.replaceChildren(frag)
  }

  // ⑤ 脚注（只留一句口径；细则都在上面的悬停说明里）
  if (dom.beastNote) {
    dom.beastNote.textContent = ov.unlocked
      ? '出战 1 只即生效（元婴起 2 只随版本 2 开放）；被动产出随在线秒入账、离线不发，上限 0.6 时/日。血脉觉醒 / 化形 / 代采随版本 2、3 开放。'
      : '金丹期解锁万兽林；血脉觉醒 / 化形 / 灵兽园扩容 / 代采随版本 2、3 开放。'
  }
}

// 灵兽面板动作（事件委托：面板每次重绘不丢监听）
dom.beastOverlay.addEventListener('click', (e) => {
  const dp = e.target.closest('[data-dispatch]')
  if (dp && !dp.disabled) {
    const res = beasts.dispatch()
    pushLog(res.message, res.ok ? 'info' : 'info')
    renderBeast()
    return
  }
  const dc = e.target.closest('[data-dispatch-collect]')
  if (dc && !dc.disabled) {
    const res = beasts.collectDispatch()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { persist('beast-egg'); emitFloat({ text: `${res.grade === 'huang' ? '皇品蛋！' : '灵兽蛋 +1'}`, kind: 'ok' }) }
    renderBeast()
    return
  }
  const h = e.target.closest('[data-hatch]')
  if (h && !h.disabled) {
    const res = beasts.startHatch(+h.dataset.hatch)
    pushLog(res.message, res.ok ? 'info' : 'info')
    renderBeast()
    return
  }
  const hs = e.target.closest('[data-hatch-speed]')
  if (hs && !hs.disabled) {
    const res = beasts.speedHatch(1)
    pushLog(res.message, res.ok ? 'info' : 'info')
    if (res.ok) persist('beast-hatch-speed')
    renderBeast()
    return
  }
  const hc = e.target.closest('[data-hatch-claim]')
  if (hc && !hc.disabled) {
    const res = beasts.claimHatch()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      sfx('beast_hatch', { throttleMs: 400 })   // 3.5 音效：灵兽破壳
      persist('beast-hatch')
      emitBurst({ kind: 'breakthrough' })
    }
    renderBeast()
    return
  }
  const fd = e.target.closest('[data-feed]')
  if (fd && !fd.disabled) {
    const res = beasts.feed(+fd.dataset.feed)
    pushLog(res.message, res.ok ? (res.burst ? 'ok' : 'info') : 'info')
    if (res.ok) persist('beast-feed')
    renderBeast()
    return
  }
  const ac = e.target.closest('[data-active]')
  if (ac && !ac.disabled) {
    const res = beasts.setActive(+ac.dataset.active)
    pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) persist('beast-active')
    renderBeast()
  }
})
// ══ 2.8 灵兽 装配区结束 ═════════════════════════════════════════════════════

// ══ 2.3 事件气运 装配区（V3.3.1：事件簿已并入「纪事与事件」一册）═════════════
// 宿主：原 #event-overlay 撤销，节点迁入 #chronicle-overlay 的「事件」页（#event-page）。
// 接线内容：自动策略切换 · 待抉择手选 · 在线滚动触发（主循环）· 离线批量结算 · 待抉择角标。
// 产出换算：events.tick/settleOffline 需要的"有效产出/灵石时薪"在此现算传入
//          （13.1②：System 间不横向 import，经装配层中转）。

let trialTick = 0  // 渡劫面板的节流计数（每 10 拍 ≈ 1 秒刷一次）

/** 打开「事件与纪事」册（原独立事件簿入口的等价入口；2026-09-19 起不再有"事件页"这个切页动作） */
function openEvents () {
  openChronicle()
}

const STRAT_LABEL = { safe: '稳健', balanced: '均衡', risky: '激进' }

function renderEvents () {
  if (!state || !events) return
  const v = events.view()
  const stoneRate = stoneHourly(state.player.realm.level)

  // 顶栏气运摘要（悬停看五档口径）
  dom.eventLuck.textContent = `气运 ${v.luck} · ${v.tierName}`
  dom.eventLuck.title = `好事件概率 ${Math.round(v.goodPct * 100)}% ｜ 品质系数 ×${v.qualCoef} ｜ 频率系数 ×${v.freqCoef}（增补 v1.1 §三）`
  for (const b of dom.stratPills) b.classList.toggle('on', b.dataset.strategy === v.strategy)

  // 关键事件（V3.5.1 · 主人：绝/仙级强制亲断，不决不走、角标常亮）
  if (!v.pending.length) {
    dom.eventPending.innerHTML = '<div class="bag-empty">无事待断 · 凡 / 良 / 珍按自动策略随缘结算并入纪事流</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const p of v.pending) {
      if (p.broken) continue
      const card = document.createElement('div')
      card.className = 'evt-card key' + (p.signature ? ' sig' : '')

      const head = document.createElement('div')
      const ek = document.createElement('span')
      ek.className = 'eq'
      ek.textContent = '关键事件'
      ek.style.color = 'var(--fail)'
      const en = document.createElement('span')
      en.className = 'en'
      en.textContent = p.name
      en.style.color = QUALITY_COLOR[p.quality] || 'var(--gold-light)'
      const eq = document.createElement('span')
      eq.className = 'eq'
      eq.textContent = `${p.qualityName}级${p.signature ? ' · 本界招牌' : ''}`
      eq.style.color = QUALITY_COLOR[p.quality] || 'var(--gold-light)'
      const ec = document.createElement('span')
      ec.className = 'ec'
      ec.textContent = p.catName
      head.append(ek, en, eq, ec)
      card.appendChild(head)

      const ed = document.createElement('div')
      ed.className = 'ed'
      ed.textContent = p.desc
      card.appendChild(ed)

      const opts = document.createElement('div')
      opts.className = 'evt-opts'
      for (const o of p.options) {
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.textContent = o.label
        btn.dataset.opt = `${p.uid}|${o.id}`
        const costStones = Math.round(o.cost * stoneRate)
        const poor = costStones > 0 && state.resources.stones < costStones
        if (poor) btn.classList.add('poor')
        // 事件文案里的钟点（「持续 24h」）按游戏历显示；「h 当量」是经济单位，原样保留
        const hintText = String(o.hint || '').replace(/持续\s*(\d+(?:\.\d+)?)\s*h/g,
          (m, n) => `持续 ${fmtGameDuration(Number(n) * 3600 * 1000)}（游戏历）`)
        btn.title = `${hintText}` +
          `｜策略位：${STRAT_LABEL[o.strategy] || o.strategy}` +
          (o.nominal ? `｜名义当量 ≈${o.nominal}h` : '') +
          (costStones > 0 ? `｜需灵石 ≥${fmt(costStones)}` : '') +
          (poor ? '｜灵石不足，点按会被拒' : '') +
          (o.id === p.recommended.id ? '｜当前策略推荐' : '')
        opts.appendChild(btn)
      }
      card.appendChild(opts)
      frag.appendChild(card)
    }
    dom.eventPending.replaceChildren(frag)
  }
  // V3.5.1：「近事录」独立区块撤销——已结算事件改由 renderChronicleList 按
  // 统一格式并入纪事流（主人：事件和纪事直接合并为纪事，格式统一）。
}

// ══ 2.3 事件气运 装配区结束 ═════════════════════════════════════════════════

// ══ 2.6 坊市 装配区（改动仅限本区块 + 互斥开关联动行）══════════════════════
// 接线：坊市遮罩（#market-overlay）· 三页签（折扣店 / 回收 / 拍卖行）· 每日刷新
// 口径：买/卖/拍只搬动「灵石」与「道具」，不产修为、不晋境界（§七 占比护栏）

let marketTick = 0   // 坊市面板的节流计数（每 10 拍 ≈ 1 秒刷一次）
let marketTab = 'shop' // 当前页签：shop | recycle | auction

function openMarket () {
  if (!state) return
  closeTip()
  closeAllOverlays('market')   // 与其余遮罩互斥（集中维护，见 closeAllOverlays）
  renderMarket()
  ovShow(dom.marketOverlay)
  dom.btnMarket.classList.add('on')
  syncDragRegions()
}

function closeMarket () {
  ovHide(dom.marketOverlay)
  dom.btnMarket.classList.remove('on')
  syncDragRegions()
}

function toggleMarket () {
  if (dom.marketOverlay.classList.contains('show')) closeMarket()
  else openMarket()
}

function renderMarket () {
  if (!state || !market) return
  market.ensureDaily(Date.now())
  if (marketTab === 'shop') renderMarketShop()
  else if (marketTab === 'recycle') renderMarketRecycle()
  else renderMarketAuction()
}

function renderMarketShop () {
  const shop = market.shopView()
  if (!shop.length) {
    dom.marketShop.innerHTML = '<div class="bag-empty">今日货架空了，明日再来。</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const s of shop) {
      const row = document.createElement('div')
      row.className = 'sect-row'
      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = s.name
      const disc = document.createElement('span')
      disc.className = 'm-disc'
      disc.textContent = `${(s.discount * 10).toFixed(1)}折`
      const td = document.createElement('span')
      td.className = 'td'
      td.innerHTML = `<span class="m-old">${s.base}</span><span style="color:var(--gold-light)">${s.price}</span> 灵石`
      const btn = document.createElement('button')
      btn.className = 'mini'
      btn.textContent = '购买'
      btn.dataset.buy = String(s.index)
      if (!s.affordable) btn.disabled = true
      row.append(tn, disc, td, btn)
      frag.appendChild(row)
    }
    dom.marketShop.replaceChildren(frag)
  }
  if (dom.marketNote) {
    dom.marketNote.textContent = `折扣店${fmtRefreshPeriod()}刷新一次（同一轮内不变，下一轮换新）；灵石不足时按钮置灰。坊市只流通灵石与道具，不产修为、不晋境界。`
  }
}

function renderMarketRecycle () {
  const list = market.recycleView()
  if (!list.length) {
    dom.marketRecycle.innerHTML = '<div class="bag-empty">行囊里没有可卖之物。</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const it of list) {
      const row = document.createElement('div')
      row.className = 'sect-row'
      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = `${it.name} ×${it.count}`
      const td = document.createElement('span')
      td.className = 'td'
      td.innerHTML = `回收 <span style="color:var(--gold-light)">${it.price}</span>/${it.unit} → 共 <span style="color:var(--gold-light)">+${it.total}</span> 灵石`
      const btn = document.createElement('button')
      btn.className = 'mini'
      btn.textContent = '售全'
      btn.dataset.sell = it.id
      row.append(tn, td, btn)
      frag.appendChild(row)
    }
    dom.marketRecycle.replaceChildren(frag)
  }
  if (dom.marketNote) {
    dom.marketNote.textContent = `回收价＝货值 × ${RECYCLE_RATE}（<1，买来再卖会亏，防刷灵石）。一键卖清整堆。`
  }
}

function renderMarketAuction () {
  const a = market.auctionView()
  if (!a.open) {
    const need = a.minRealm >= 3 ? '元婴' : '金丹'
    dom.marketAuction.innerHTML = `<div class="bag-empty">拍卖行尚未开启。<br>需 ${need}期以上修士方可入拍。</div>`
    if (dom.marketNote) dom.marketNote.textContent = '高境界拍卖行（简化）：每日 1 件稀有物，达标可拍下，每日限 1 次。'
    return
  }
  const need = a.minRealm >= 3 ? '元婴' : '金丹'
  const frag = document.createDocumentFragment()
  const row = document.createElement('div')
  row.className = 'sect-row'
  const tn = document.createElement('span')
  tn.className = 'tn'
  tn.textContent = a.name
  const td = document.createElement('span')
  td.className = 'td'
  td.innerHTML = a.bought
    ? '今日已拍下，明日再来。'
    : `起拍 <span style="color:var(--gold-light)">${a.price}</span> 灵石${a.realmOk ? '' : `（需${need}期）`}`
  const btn = document.createElement('button')
  btn.className = 'mini'
  btn.textContent = a.bought ? '已结' : '拍下'
  btn.dataset.auction = '1'
  if (a.bought || !a.realmOk || !a.affordable) btn.disabled = true
  row.append(tn, td, btn)
  frag.appendChild(row)
  dom.marketAuction.replaceChildren(frag)
  if (dom.marketNote) {
    dom.marketNote.textContent = '高境界拍卖行（简化）：每日 1 件稀有物，达标可拍下，每日限 1 次。'
  }
}

// 坊市面板动作（事件委托：面板每次重绘不丢监听）
onPress(dom.marketOverlay, (e) => {
  const buy = e.target.closest('[data-buy]')
  if (buy && !buy.disabled) {
    const res = market.buy(+buy.dataset.buy)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { persist('market-buy'); emitFloat({ text: `灵石 −${res.cost}`, kind: 'gold' }) }
    renderMarket()
    return
  }
  const sell = e.target.closest('[data-sell]')
  if (sell && !sell.disabled) {
    const res = market.sell(sell.dataset.sell)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { persist('market-sell'); emitFloat({ text: `灵石 +${res.gain}`, kind: 'gold' }) }
    renderMarket()
    return
  }
  const auc = e.target.closest('[data-auction]')
  if (auc && !auc.disabled) {
    const res = market.buyAuction()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { persist('market-auction'); emitFloat({ text: `灵石 −${res.cost}`, kind: 'gold' }) }
    renderMarket()
  }
})

// 事件页动作（事件委托：面板每次重绘不丢监听）
// ⚠ 宿主必须是**整个纪事遮罩**：自动策略行（#ev-strat-row）位于 #event-page 之外
//   （与频道行同级），若只挂在 #event-page 上，策略按钮会收不到 pointerdown
//   —— 2026-09-18 真机 CDP 实测抓到（点了没反应）。
onPress(dom.chronicleOverlay, (e) => {
  const sp = e.target.closest('[data-strategy]')
  if (sp) {
    const res = events.setStrategy(sp.dataset.strategy)
    pushLog(res.message, res.ok ? 'sys' : 'info')
    if (res.ok) persist('event-strategy')
    renderEvents()
    return
  }
  const ob = e.target.closest('[data-opt]')
  if (ob && !ob.disabled) {
    const [uid, optId] = ob.dataset.opt.split('|')
    const now = Date.now()
    const res = events.resolvePending(+uid, optId, cult.getEffRate(now).eff, stoneHourly(state.player.realm.level), now)
    pushLog(res.message, res.ok ? (res.good ? 'ok' : 'fail') : 'info')
    if (res.ok) {
      persist('event-resolve')
      emitBurst({ kind: 'breakthrough' })
    }
    renderEvents()
  }
})

/** 离线批量结算的汇报：汇总一行 + 明细若干；有待抉择时弹事件簿 */
function reportOfflineEvents (results) {
  if (!results || !results.length) return
  pushLog(`离线遭遇 ${results.length} 起事件，天机已随缘结算。`, 'sys')
  for (const r of results.slice(0, 5)) pushLog(r.message, r.good ? 'ok' : 'fail')
  if (results.length > 5) pushLog(`……其余 ${results.length - 5} 起详见「纪事」册·纪事流。`, 'sys')
  if (events.pendingCount > 0) {
    pushLog(`有 ${events.pendingCount} 起绝/仙级事件待你亲自抉择。`, 'root')
    setTimeout(openEvents, 600)
  }
}

// ══ 2.6 坊市 装配区结束 ═════════════════════════════════════════════════

// ══ 2.10 成就与纪事 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）══
// 宿主：纪事遮罩 #chronicle-overlay（三频道纪事 / 成就墙 / 称号佩戴）+ 解锁提示 #achv-toast
//       + 顶栏称号 chip。
// 本区块只做「读系统 → 渲染 → 把点击交回系统」；判定用的他模块数值一律在此现算成快照
// （13.1②：System 间不横向 import；奖励发放经 grant 回调落到 resources / inventory）。

let achvTick = 0        // 每秒一判 + 纪事批次（节流计数，与 2.3 同理）
let chrTick = 0         // 「事件与纪事」面板的节流计数（同上）
let achvPaneTick = 0    // 「成就与称号」面板的节流计数
let chrFilter = 'all'   // 纪事频道筛选
let achvTab = 'wall'    // 成就册页签：wall 成就墙 / title 称号
let achvToastTimer = 0

/** 打开「事件与纪事」（主人 2026-09-19：事件与纪事同页看完，不再分页签） */
function openChronicle () {
  if (!state) return
  closeTip()
  closeAllOverlays('chronicle')
  achv.markSeen(Date.now())          // 打开即已读（角标只提示"没看过的"）
  renderChronicle()
  ovShow(dom.chronicleOverlay)
  dom.btnChronicle.classList.add('on')
  syncDragRegions()
}

function closeChronicle () {
  ovHide(dom.chronicleOverlay)
  dom.btnChronicle.classList.remove('on')
  syncDragRegions()
}

function toggleChronicle () {
  if (dom.chronicleOverlay.classList.contains('show')) closeChronicle()
  else openChronicle()
}

/** 打开「成就与称号」（2026-09-19：自事件纪事册拆出，另立一册两页签） */
function openAchv (tab) {
  if (!state) return
  closeTip()
  closeAllOverlays('achv')
  if (tab) achvTab = tab
  achv.markSeen(Date.now())
  renderAchv()
  ovShow(dom.achvOverlay)
  dom.btnAchv.classList.add('on')
  syncDragRegions()
}

function closeAchv () {
  ovHide(dom.achvOverlay)
  dom.btnAchv.classList.remove('on')
  syncDragRegions()
}

function toggleAchv () {
  if (dom.achvOverlay.classList.contains('show')) closeAchv()
  else openAchv()
}

/**
 * 判定快照：把他模块的只读视图汇总成 { metric: value }，交给 AchievementSystem.evaluate
 * ——成就系统不读别人子树，这里就是 13.1② 的"装配层中转"。
 */
function collectMetrics () {
  const now = Date.now()
  const p = state.player
  const inv = state.inventory.items || {}
  let itemsTotal = 0
  for (const k of Object.keys(inv)) itemsTotal += inv[k] | 0

  // 渡劫：战绩在 tribul.nodeStats（累计），连胜与「败而后勇」看最近 20 次史实
  const tribul = p.tribul || {}
  const nodeStats = tribul.nodeStats || {}
  let tries = 0
  let passes = 0
  for (const k of Object.keys(nodeStats)) {
    tries += nodeStats[k].tries | 0
    passes += nodeStats[k].passes | 0
  }
  const hist = tribul.history || []
  let streak = 0
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].ok) streak++
    else break
  }
  let failThenPass = 0
  for (let i = 1; i < hist.length; i++) {
    if (!hist[i - 1].ok && hist[i].ok) { failThenPass = 1; break }
  }

  const res = dungeon.resourceView()
  const resCleared = res.filter((r) => (r.cleared | 0) > 0).length
  const resStars = res.reduce((s, r) => s + (r.stars | 0), 0)
  const pets = beasts.petsView()
  const petMaxLevel = pets.reduce((m, x) => Math.max(m, x.level | 0), 0)
  const book = state.eventState.book || []
  const owned = state.techniques.ownedTechniques || {}
  const ownedIds = Object.keys(owned)
  const techMaxLevel = ownedIds.reduce((m, id) => Math.max(m, ((owned[id] || {}).level) | 0), 0)
  const info = sect.infoView()
  const d = new Date(now)

  return {
    level: p.realm.level | 0,
    realmIndex: Math.floor(((p.realm.level | 0) - 1) / 9),
    ascended: p.flags && p.flags.ascended ? 1 : 0,
    breakthroughs: state.stats.totalBreakthroughs | 0,
    trialPasses: passes,
    trialFails: Math.max(0, tries - passes),
    trialStreak: streak,
    failThenPass,
    cures: ((tribul.total || {}).cure) | 0,
    sectAid: ((tribul.total || {}).sect) | 0,
    qiRate: cult.getEffRate(now).eff,
    playtimeSec: (state.meta.playtimeSec | 0),
    lifespanRemain: life.remainYears,
    // 秘境（2.7）
    towerFloor: dungeon.towerCleared(),
    resCleared,
    resStars,
    dispatchSlots: dungeon.slotCount,
    dispatchRunning: dungeon.dispatchView(now).used,
    // 宗门（2.4）
    joined: info.joined ? 1 : 0,
    sectRank: info.joined ? ((info.rank && info.rank.idx) | 0) : 0,
    contrib: info.joined ? (info.contribution | 0) : 0,
    totalContrib: info.joined ? (info.totalContrib | 0) : 0,
    // 灵兽（2.8）
    pets: pets.length,
    petsWang: pets.filter((x) => x.grade === 'wang' || x.grade === 'huang').length,
    petsHuang: pets.filter((x) => x.grade === 'huang').length,
    petMaxLevel,
    petActive: beasts.activePet ? 1 : 0,
    beastDispatched: beasts.s.lastDispatchDay ? 1 : 0,
    // 事件与因果（2.3）
    events: state.stats.eventCount | 0,
    book: book.length,
    causes: (state.eventState.causes || []).length,
    pendResolve: book.filter((b) => !b.auto).length,
    luck: events.luck,
    // 探索收集
    stones: state.resources.stones | 0,
    itemsTotal,
    matLingcao: inv.mat_lingcao | 0,
    matKuang: inv.mat_kuang | 0,
    matYaodan: inv.mat_yaodan | 0,
    techOwned: ownedIds.length,
    techMaxLevel,
    zhenlei: inv.treasure_zhenlei | 0,
    pillHujie: inv.pill_hujie | 0,
    brews: state.stats.brewSuccess | 0,
    // 隐藏
    longOffline: (state.offline.awayMs | 0) >= 8 * 3600 * 1000 ? 1 : 0,
    hour: d.getHours(),
    dayKey: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }
}

/** 成就奖励的唯一落点：灵石进 resources，物品进 inventory（经炼丹系统的库存 getter） */
function grantAchvReward (payload) {
  if (!payload) return
  if (payload.stones > 0) state.resources.stones += payload.stones
  for (const it of payload.items || []) {
    if (!it || !(it.n > 0)) continue
    alchemy.items[it.id] = (alchemy.items[it.id] | 0) + it.n
  }
}

/** 每秒一判：纪事批次 + 成就解锁 + 阶梯升档 */
function runAchvCheck (now = Date.now()) {
  if (!state || !achv) return

  // ① 纪事：到点汇总一批（真实时间驱动，离线也照算——回来时一并补上）
  const fresh = achv.tick(now)
  if (fresh.length) {
    pushLog(`纪事更新：${fresh.length} 条新消息（本界 / 宗门 / 天下）。`, 'sys')
    if (dom.chronicleOverlay.classList.contains('show')) renderChronicle()
  }

  // ② 成就判定
  const out = achv.evaluate(collectMetrics(), now)
  if (!out.unlocked.length && !out.tierUps.length) return

  for (const u of out.unlocked) {
    pushLog(`成就达成「${u.name}」＋${u.points} 点${u.title ? ` · 称号「${u.title.name}」` : ''}${u.reward && u.reward.items && u.reward.items.length ? ` · 赏 ${u.reward.items.map((i) => `${getItem(i.id).name}×${i.n}`).join('、')}` : ''}`, 'ok')
  }
  for (const up of out.tierUps) {
    const t = up.tier
    pushLog(`成就阶梯升至「${t.name}」阶：称号「${up.title.name}」＋${up.reward.items.map((i) => `${getItem(i.id).name}×${i.n}`).join('、') || '—'}`, 'root')
  }
  // 提示只弹最值钱的那一个，其余进日志
  const top = out.tierUps.length
    ? { name: out.tierUps[out.tierUps.length - 1].title.name, points: 0, title: null, tierName: out.tierUps[out.tierUps.length - 1].tier.name }
    : out.unlocked.reduce((a, b) => ((b.points > (a ? a.points : -1)) ? b : a), null)
  if (top) showAchvToast(top, out.tierUps.length ? 'tier' : 'achv')

  persist('achv')
  renderTitleChip()
  if (dom.chronicleOverlay.classList.contains('show')) renderChronicle()
  if (dom.achvOverlay && dom.achvOverlay.classList.contains('show')) renderAchv()
}

/** 解锁提示（3.6 秒自动收起；点按直接进成就墙） */
function showAchvToast (u, kind = 'achv') {
  const box = dom.achvToast
  if (!box) return
  box.querySelector('.at-k').textContent = kind === 'tier' ? '阶 梯 升 档' : '成 就 达 成'
  box.querySelector('.at-n').textContent = kind === 'tier' ? `「${u.name}」` : u.name
  box.querySelector('.at-p').textContent = kind === 'tier'
    ? `${u.tierName}阶 · 称号已入袋`
    : `成就点 +${u.points}${u.title ? ` · 称号「${u.title.name}」` : ''}`
  sfx('achv', { throttleMs: 600 })   // 3.5 音效：成就 / 称号升档（只弹最值钱的那个，故也只响一声）
  box.classList.add('show')
  clearTimeout(achvToastTimer)
  achvToastTimer = setTimeout(() => box.classList.remove('show'), 3600)
}

/** 称号牌（挂在 #mid 内，叠在立绘上层显示在人物头顶上方；纯展示，不动布局） */
function renderTitleChip () {
  if (!dom.titleChip || !achv) return
  const t = achv.equippedTitle
  if (!t) {
    dom.titleChip.hidden = true
    dom.titleChip.textContent = ''
    return
  }
  dom.titleChip.hidden = false
  dom.titleChip.textContent = t.name
  dom.titleChip.title = `佩戴中的称号「${t.name}」——来自${t.from}（纯展示，不涉任何数值）`
}

/**
 * 「纪事」整页渲染（V3.5.1 · 主人：事件与纪事合并为一册「纪事」，格式统一）
 *   版面自上而下：气运 / 策略行 → 频道筛选 → 关键事件（绝 / 仙置顶，强制亲断）→ 纪事流（事件同列）
 *   成就与称号在独立遮罩（#achv-overlay，见 renderAchv）
 */
function renderChronicle () {
  if (!state || !achv) return
  for (const b of dom.chrFilterPills) b.classList.toggle('on', b.dataset.chrfilter === chrFilter)
  renderEvents()          // 关键事件（绝 / 仙级待抉择）
  renderChronicleList()   // 纪事流（已结算事件按统一格式并入）
  if (dom.chrNote) {
    dom.chrNote.textContent =
      `一册纪事：天下消息（你 / 本界 / 宗门 / 天下四频道）与遭遇过的事件同列一流，时间按游戏历显示；` +
      `凡 / 良 / 珍事件按自动策略随缘结算后入流，绝 / 仙级置顶为「关键事件」——强制亲断，不决不走、角标常亮。` +
      `带金边的是「互动纪事」——可当场择一个处置，择过即定，所得入囊。互动概率按频道：` +
      achv.interactChances.map((c) => `${c.name} ${Math.round(c.chance * 100)}%`).join(' ｜ ') +
      `（「你」频道是你自己的里程碑，无待抉择）。成就墙与称号在另一册（右上「成就与称号 ›」）。`
  }
}

/**
 * 「成就与称号」整页渲染（2026-09-19 拆出）
 *   两页签：成就墙 / 称号；顶栏显示成就点与阶梯进度
 */
function renderAchv () {
  if (!state || !achv) return
  for (const b of dom.achvTabs) b.classList.toggle('on', b.dataset.achvtab === achvTab)
  if (dom.achvWall) dom.achvWall.hidden = achvTab !== 'wall'
  if (dom.titleList) dom.titleList.hidden = achvTab !== 'title'
  if (achvTab === 'wall') renderAchvWall()
  else renderTitleList()

  const points = achv.points
  const tier = achv.tier
  const next = achv.nextTier
  if (dom.achvHead) {
    dom.achvHead.textContent = `成就点 ${points} · ${tier.name}阶`
    dom.achvHead.title = next
      ? `${tier.name}阶（${tier.need} 点）→ 下一阶 ${next.name}（${next.need} 点），还差 ${next.need - points} 点`
      : `已至顶阶 ${tier.name}（${tier.need} 点）`
  }
  if (dom.achvNote) {
    dom.achvNote.textContent =
      `成就 90 个 · 已解锁 ${achv.unlockedCount} 个 ｜ 五档阶梯（凡/灵/玄/王/皇）按累计成就点发放称号 + 外观碎片 + 少量材料；` +
      `称号同时只可佩戴 1 个，纯展示不涉数值。隐藏成就只给暗示，条件得自己撞。`
  }
}

/** 已结算事件 → 纪事条目（与 chr-item 同款：时间行 + 正文；品质色标事件名，V3.5.1） */
function buildEvtChronRow (m) {
  const b = m.raw
  const item = document.createElement('div')
  item.className = 'chr-item chr-evt'
  const l1 = document.createElement('div')
  l1.className = 'chr-line1'
  const qName = { fan: '凡', liang: '良', zhen: '珍', jue: '绝', xian: '仙' }[b.q] || ''
  l1.textContent = `${fmtGameClock(b.at)} · 事件${qName ? ` · ${qName}级` : ''}`
  const tx = document.createElement('div')
  tx.className = 'chr-text'
  tx.textContent = m.text
  tx.style.color = QUALITY_COLOR[b.q] || (m.good ? 'var(--gold)' : 'var(--warn)')
  item.append(l1, tx)
  return item
}

function renderChronicleList () {
  // V3.5.1（主人：事件的内容融入到纪事里，格式统一）：
  // 已结算事件（原近事录）按统一格式 {at, chName, text, note, cls} 并入纪事流，按时间倒序混排。
  const merged = achv.chronicleView(chrFilter, 80).map((e) => ({
    kind: 'chr',
    at: e.at,
    chName: e.chName,
    ch: e.ch,
    text: e.text,
    note: e.note,
    raw: e
  }))
  if (events && (chrFilter === 'all')) {
    for (const b of events.view().book.slice(0, 15)) {
      merged.push({
        kind: 'evt',
        at: b.at,
        chName: '事件',
        ch: 'evt',
        text: `【${b.name}】${b.opt ? b.opt + '——' : ''}${b.text}`,
        note: '',
        good: b.good,
        q: b.q,
        raw: b
      })
    }
  }
  merged.sort((a, b) => b.at - a.at)
  const list = merged.slice(0, 90)
  if (!list.length) {
    dom.chrList.innerHTML = '<div class="bag-empty">此处尚无消息 —— 每过一阵，天下自会有新的传闻传来。</div>'
    return
  }
  const frag = document.createDocumentFragment()
  for (const m of list) {
    if (m.kind === 'evt') { frag.appendChild(buildEvtChronRow(m)); continue }
    const e = m.raw
    const item = document.createElement('div')
    item.className = 'chr-item chr-' + e.ch + (e.interactive ? ' chr-act' : '')

    const l1 = document.createElement('div')
    l1.className = 'chr-line1'
    // 时间戳＝游戏历（主人 2026-09-17：纪事时间也用游戏时间）
    l1.textContent = `${fmtGameClock(e.at)} · ${e.chName}`

    const tx = document.createElement('div')
    tx.className = 'chr-text'
    tx.textContent = e.text

    item.append(l1, tx)
    if (e.note) {
      const nt = document.createElement('div')
      nt.className = 'chr-note'
      nt.textContent = e.note
      item.appendChild(nt)
    }

    // 互动选项：未抉择给按钮；已抉择落一句结果（选项只可择一次）
    if (e.interactive) {
      if (e.resolved) {
        const done = document.createElement('div')
        done.className = 'chr-result' + (e.resolved === 'wait' || e.resolved === 'ignore' || e.resolved === 'pass' || e.resolved === 'stay' || e.resolved === 'later' ? ' gap' : '')
        done.textContent = `（已决）${e.result || '此事已了。'}`
        item.appendChild(done)
      } else {
        const box = document.createElement('div')
        box.className = 'chr-opts'
        for (const o of e.options) {
          const btn = document.createElement('button')
          btn.className = 'mini'
          const needStones = o.costStones | 0
          const lackStones = needStones > 0 && (state.resources.stones | 0) < needStones
          const lackItems = (o.needItems || []).filter((n) => ((state.inventory.items[n.id] | 0) < n.n))
          const poor = lackStones || lackItems.length > 0
          if (poor) btn.classList.add('poor')
          btn.textContent = o.label
          btn.dataset.chrResolve = `${e.uid}|${o.id}`
          btn.disabled = poor
          const gains = []
          if (needStones > 0) gains.push(`需灵石 ${needStones}`)
          if (o.needItems && o.needItems.length) gains.push(`需${o.needItems.map((n) => `${getItem(n.id).name}×${n.n}`).join('、')}`)
          if (o.stones) gains.push(`灵石 +${o.stones}`)
          if (o.items && o.items.length) gains.push(o.items.map((n) => `${getItem(n.id).name}×${n.n}`).join('、'))
          btn.title = `${o.hint}${gains.length ? `（${gains.join('｜')}）` : ''}`
          box.appendChild(btn)
        }
        item.appendChild(box)
      }
    }
    frag.appendChild(item)
  }
  dom.chrList.replaceChildren(frag)
}

function renderAchvWall () {
  const v = achv.view(collectMetrics())
  const frag = document.createDocumentFragment()
  for (const c of v.cats) {
    const h = document.createElement('div')
    h.className = 'achv-cat'
    const hn = document.createElement('span')
    hn.textContent = c.name
    const hi = document.createElement('i')
    hi.textContent = `${c.got} / ${c.total}`
    h.append(hn, hi)
    frag.appendChild(h)

    for (const a of c.list) {
      const row = document.createElement('div')
      row.className = 'achv-row' + (a.got ? ' got' : '')

      const top = document.createElement('div')
      top.className = 'achv-top'
      const an = document.createElement('span')
      an.className = 'an'
      an.textContent = a.name
      const ap = document.createElement('span')
      ap.className = 'ap'
      ap.textContent = a.got ? `已得 +${a.points}` : `${a.points} 点`
      top.append(an, ap)

      const ad = document.createElement('div')
      ad.className = 'achv-desc'
      ad.textContent = a.desc

      row.append(top, ad)
      if (!a.got && a.progress.need > 0) {
        const bar = document.createElement('div')
        bar.className = 'achv-bar'
        const fill = document.createElement('i')
        fill.style.width = Math.min(100, (a.progress.cur / a.progress.need) * 100).toFixed(1) + '%'
        bar.appendChild(fill)
        row.appendChild(bar)
        row.title = a.hidden ? '隐藏成就：只给暗示，条件得自己撞。' : `进度 ${fmt(a.progress.cur)} / ${fmt(a.progress.need)}`
      } else if (a.got) {
        row.title = `解锁于 ${fmtDateTime(a.at)}`
      }
      frag.appendChild(row)
    }
  }
  dom.achvWall.replaceChildren(frag)
}

function renderTitleList () {
  const titles = achv.titles
  const eq = achv.equippedTitle
  if (!titles.length) {
    dom.titleList.innerHTML = '<div class="bag-empty">尚无称号 —— 解锁成就或升上成就阶梯即得。</div>'
    return
  }
  const frag = document.createDocumentFragment()
  for (const t of titles) {
    const row = document.createElement('div')
    row.className = 'title-row' + (eq && eq.id === t.id ? ' on' : '')

    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = t.name

    const tf = document.createElement('span')
    tf.className = 'tf'
    tf.textContent = t.from

    const btn = document.createElement('button')
    btn.className = 'mini' + (eq && eq.id === t.id ? ' on' : '')
    if (eq && eq.id === t.id) {
      btn.textContent = '佩戴中'
      btn.dataset.untitle = '1'
      btn.title = '点按摘下称号'
    } else {
      btn.textContent = '佩戴'
      btn.dataset.title = t.id
      btn.title = `佩戴「${t.name}」（同时只可佩戴 1 个 · 纯展示）`
    }

    row.append(tn, tf, btn)
    frag.appendChild(row)
  }
  dom.titleList.replaceChildren(frag)
}

// 频道筛选 / 成就册页签 / 称号佩戴（静态按钮直接绑，动态列表走事件委托，重绘不丢监听）
for (const b of dom.chrFilterPills) {
  b.addEventListener('click', () => {
    chrFilter = b.dataset.chrfilter
    renderChronicle()
  })
}
for (const b of dom.achvTabs) {
  b.addEventListener('click', () => {
    achvTab = b.dataset.achvtab
    achv.markSeen(Date.now())
    renderAchv()
  })
}
// 纪事里的互动选项（主人 2026-09-17）：选定即结算，选项只可择一次
onPress(dom.chrList, (e) => {
  const b = e.target.closest('[data-chr-resolve]')
  if (!b || b.disabled) return
  const [uid, optId] = b.dataset.chrResolve.split('|')
  const res = achv.resolveChronicle(+uid, optId)
  pushLog(res.message, res.ok ? (res.good ? 'ok' : 'info') : 'info')
  if (res.ok) {
    persist('chronicle-resolve')
    if (res.reward && res.reward.stones > 0) emitFloat({ text: `灵石 ${res.reward.stones > 0 ? '+' : ''}${res.reward.stones}`, kind: 'gold' })
    renderChronicle()
    render()
  }
})

dom.titleList.addEventListener('click', (e) => {
  const off = e.target.closest('[data-untitle]')
  if (off) {
    const res = achv.clearTitle()
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) persist('title')
    renderTitleList()
    renderTitleChip()
    return
  }
  const on = e.target.closest('[data-title]')
  if (on) {
    const res = achv.equipTitle(on.dataset.title)
    pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) persist('title')
    renderTitleList()
    renderTitleChip()
  }
})
if (dom.achvToast) {
  dom.achvToast.addEventListener('click', () => {
    dom.achvToast.classList.remove('show')
    openAchv('wall')            // 2026-09-19：成就已另立一册
  })
}
// 顶栏称号 chip：点按直接去「称号」页换戴（纯展示，故不做明细浮层）
if (dom.titleChip) {
  dom.titleChip.addEventListener('click', () => openAchv('title'))
}
// 成就册入口：快捷条「成就」键 + 事件纪事册右上角「成就与称号 ›」
if (dom.btnAchv) dom.btnAchv.addEventListener('click', toggleAchv)
if (dom.btnAchvClose) dom.btnAchvClose.addEventListener('click', closeAchv)
if (dom.btnGotoAchv) dom.btnGotoAchv.addEventListener('click', () => openAchv('wall'))

function openPanel (tab = 'settings') {
  closeAllOverlays('panel')
  switchTab(tab)
  ovShow(dom.panelOverlay)
  syncDragRegions()
  renderPanel()
}

function closePanel () {
  ovHide(dom.panelOverlay)
  syncDragRegions()
}

function switchTab (name) {
  for (const t of dom.tabs) t.classList.toggle('on', t.dataset.tab === name)
  for (const p of dom.panes) p.hidden = p.dataset.pane !== name
}

async function renderPanel () {
  if (!state) return
  const s = state.settings

  // ① 设置（窗口三态由 applyWinStateToUI 统一兜底刷新）
  setToggle(dom.tgPause, !!s.paused)
  setToggle(dom.tgSound, !!s.sound)
  // 自动化开关（主人 2026-09-18）：未写过字段即视为"开"（老档无需迁移）
  setToggle(dom.tgAutoBreak, s.autoBreak !== false)
  setToggle(dom.tgAutoEgg, s.autoEgg !== false)
  dom.tgAvatar.textContent = s.avatar === 'female' ? '女修' : '男修'
  dom.tgAvatar.classList.toggle('on', s.avatar === 'female')
  applyWinStateToUI()
  syncAmbienceUI()   // 3.3 氛围：总档 / 天气 / 昼夜 / 负载档四行
  syncSkinUI()       // 3.4 皮肤：色板名与循环顺序
  syncMotionUI()     // 3.4 动效：总档与系统实测值
  syncAudioUI()      // 3.5 音效：音量两行

  // ② 存档
  const info = await save.info()
  dom.vSavePath.textContent = info.path || '—'
  dom.vSavePath2.textContent = info.path || '—'
  dom.vAppVersion.textContent = `v${(state.meta && state.meta.appVersion) || '—'}`
  dom.vAppVersion.title = `存档由 v${(state.meta && state.meta.appVersion) || '—'} 写入；当前运行 v${APP_VERSION}`
  dom.vSaveMeta.textContent = info.save && info.save.exists
    ? `${fmtBytes(info.save.size)} · ${fmtDateTime(info.save.mtime)}`
    : (save.backend === 'file' ? '尚未写档' : '（浏览器模式）')
  dom.vBakMeta.textContent = info.backup && info.backup.exists
    ? `${fmtBytes(info.backup.size)} · ${fmtDateTime(info.backup.mtime)}`
    : '尚无备份'
  dom.btnRestore.disabled = !(bridge && info.backup && info.backup.exists)
}

function renderBag () {
  if (!state) return
  const items = (state.inventory && state.inventory.items) || {}
  const entries = Object.entries(items).filter(([, n]) => (n | 0) > 0)

  if (dom.bagNote) {
    dom.bagNote.textContent = '「持有 N 枚」＝背包里的实际数量；可「使用」的丹药右侧带按钮，点一下即消耗 1 枚。'
  }

  if (!entries.length) {
    const empty = document.createElement('div')
    empty.className = 'bag-empty'
    empty.append('囊中空空')
    empty.appendChild(document.createElement('br'))
    empty.append('打坐时会偶得灵草 · 玄铁矿 · 妖丹，也可去「丹房」查看丹方')
    dom.bagList.replaceChildren(empty)
    return
  }

  const frag = document.createDocumentFragment()
  for (const [id, count] of entries) {
    const it = getItem(id)
    const unit = getUnit(it)
    const row = document.createElement('div')
    row.className = 'bag-item'

    const nm = document.createElement('span')
    nm.className = 'nm'
    nm.textContent = it.name

    // 数量写成「持有 N 枚」——不再是一个孤零零的数字，避免看不懂
    const qt = document.createElement('span')
    qt.className = 'qt'
    const num = document.createElement('b')
    num.textContent = String(count)
    qt.append('持有 ', num, ` ${unit}`)
    qt.title = `${it.name}：持有 ${count} ${unit}`

    const ds = document.createElement('span')
    ds.className = 'ds'
    ds.textContent = it.desc
    ds.appendChild(document.createElement('br'))
    const from = document.createElement('em')
    from.textContent = it.from
    ds.appendChild(from)

    row.append(nm, qt, ds)

    if (it.usable) {
      const btn = document.createElement('button')
      btn.className = 'mini'
      btn.textContent = '使用'
      btn.title = it.useHint || ''
      btn.disabled = rootBusy
      btn.addEventListener('click', () => {
        if (it.id === 'pill_ningshen') { useNingshen(); renderBag(); return }
        closeBag(); doReroll()
      })
      row.appendChild(btn)
    }
    frag.appendChild(row)
  }
  dom.bagList.replaceChildren(frag)
}

/**
 * 丹房：丹方列表 + 炼制 / 自动炼制（主人 2026-09-17：背包与丹房分离；缺丹时自动开炉）
 * 「当前所需」＝当下真正卡关的丹药（突破缺的破境丹、渡劫缺的护劫丹）。
 */
let alchemyTick = 0   // 丹房面板的节流计数（每 10 拍 ≈ 1 秒刷一次）

// ── 凝神丹（V3.5.1 新增可用丹药）：限时产出增益，走 state.buffs 公共乘区 ──
const NINGSHEN = { itemId: 'pill_ningshen', buffId: 'buff_ningshen', pct: 0.15, durSec: 600 }

/** 服用凝神丹：现实 10 分钟修为产出 +15%（不叠加，再服只刷新时长） */
function useNingshen () {
  if (!state) return
  const inv = state.inventory.items
  const have = inv[NINGSHEN.itemId] | 0
  if (have <= 0) { pushLog('凝神丹不足。', 'info'); return }
  inv[NINGSHEN.itemId] = have - 1
  const now = Date.now()
  const i = (state.buffs || []).findIndex((b) => b.id === NINGSHEN.buffId)
  if (i >= 0) state.buffs.splice(i, 1)
  state.buffs.push({
    id: NINGSHEN.buffId,
    name: '凝神丹',
    kind: 'buff',
    mods: { qiRatePct: NINGSHEN.pct },
    endsAt: now + NINGSHEN.durSec * 1000,
    source: { type: 'pill', ref: NINGSHEN.itemId }
  })
  pushLog('凝神丹入腹，灵台一片清明——现实 10 分钟内修为产出 +15%。', 'ok')
  persist('pill-ningshen')
  render()
}

/** 当下"正缺"的丹药清单（纯读；判定归各系统，此处只做汇总） */
function neededPills () {
  const out = []
  try {
    const pv = cult.getBreakthroughPreview(Date.now())
    if (pv.pillRequired && pv.pillMissing && pv.plan && pv.plan.pill) out.push(pv.plan.pill)
    if (pv.isTrial && pv.trial && Array.isArray(pv.trial.preps.views)) {
      for (const v of pv.trial.preps.views) {
        if (v.kind === 'consume' && v.itemId && v.state !== 'active' && (v.count | 0) <= 0) out.push(v.itemId)
      }
    }
  } catch (_) { /* 预览不可得时不标"所需"，不影响面板 */ }
  return out
}

function renderAlchemy () {
  if (!alchemy) return
  const needed = neededPills()
  const views = alchemy.recipesView({ needed })

  // 材料摘要（一眼看清手上有什么）
  if (dom.alchemyMats) {
    const inv = (state.inventory && state.inventory.items) || {}
    dom.alchemyMats.innerHTML =
      `材料：<b>灵草 ${inv.mat_lingcao | 0}</b> ｜ <b>玄铁矿 ${inv.mat_kuang | 0}</b> ｜ <b>妖丹 ${inv.mat_yaodan | 0}</b>` +
      ` ｜ <b>清灵草 ${inv.mat_qinglingcao | 0}</b> ｜ <b>妖兽精血 ${inv.mat_yaohu | 0}</b> ｜ <b>千年灵乳 ${inv.mat_wannianru | 0}</b>` +
      `　·　打坐偶得 + 宗门任务 / 商店 / 秘境（离线不掉）`
  }

  dom.brewNote.textContent =
    '材料齐即可开炉；炼失败不白烧，收回一半材料。' +
    '标「当前所需」的是眼下卡关的那味丹：点「自动炼制」会一直开炉到成丹或材料耗尽（成丹率不足 100%，可能连炼数炉）。' +
    '突破 / 渡劫时若发现缺丹，丹房也会自动开炉一次。'

  const QUALITY_COLOR = { fan: '#b9b3a8', liang: '#e8b96a', zhen: '#7fd6a8', jue: '#b98cff', xian: '#9fd6ff' }
  const frag = document.createDocumentFragment()
  for (const r of views) {
    const row = document.createElement('div')
    row.className = 'brew-row' + (r.needed ? ' needed' : '')

    const bn = document.createElement('span')
    bn.className = 'bn'
    bn.textContent = r.name
    bn.style.color = QUALITY_COLOR[r.quality] || '#e8b96a'
    bn.title = `${r.qualityName} · 成丹率 ${Math.round(r.rate * 100)}% —— ${r.desc}`
    if (r.needed) {
      const mark = document.createElement('span')
      mark.className = 'brew-mark'
      mark.textContent = '当前所需'
      bn.appendChild(mark)
    }
    const have = document.createElement('span')
    have.className = 'brew-have'
    have.textContent = `存 ${r.have | 0}`
    have.title = `囊中现有${r.name} ${r.have | 0} 枚`
    bn.appendChild(have)

    const bi = document.createElement('span')
    bi.className = 'bi'
    for (let i = 0; i < r.inputsView.length; i++) {
      const iv = r.inputsView[i]
      const chip = document.createElement('span')
      chip.textContent = `${iv.name} ${iv.have}/${iv.n}`
      if (!iv.enough) {
        chip.className = 'lack'
        chip.title = `还差 ${iv.n - iv.have} 份`
      }
      bi.appendChild(chip)
      if (i < r.inputsView.length - 1) bi.append(' · ')
    }
    bi.appendChild(document.createElement('br'))
    const rate = document.createElement('span')
    rate.className = 'rate'
    rate.textContent = `${r.qualityName} ｜ 成丹率 ${Math.round(r.rate * 100)}%`
    bi.appendChild(rate)

    const btn = document.createElement('button')
    btn.className = 'mini'
    btn.textContent = '炼制'
    btn.dataset.brew = r.id
    btn.disabled = !r.canBrew
    btn.title = r.canBrew ? `开炉炼制${r.name}（1 炉）` : `材料不足：${r.missing.join('、')}`

    const auto = document.createElement('button')
    auto.className = 'mini'
    auto.textContent = '自动炼制'
    auto.dataset.autobrew = r.pillId
    auto.disabled = !r.canBrew
    auto.title = r.canBrew
      ? `自动开炉，直到炼出${r.name}或材料耗尽`
      : `材料不足：${r.missing.join('、')}`

    row.append(bn, bi, btn, auto)
    frag.appendChild(row)
  }
  dom.brewList.replaceChildren(frag)
}

// ── 界面事件绑定 ──────────────────────────────────────────────────────────
dom.btn.addEventListener('click', onBreakthrough)
dom.btnStrike.addEventListener('click', doBreakthrough)
dom.btnWait.addEventListener('click', () => {
  hideBubble()
  pushLog('先稳一手：再等等。', 'info')
})
dom.returnCard.addEventListener('click', () => hideReturnCard())

// 坊市页签（折扣店 / 回收 / 拍卖行）
for (const t of dom.marketTabs) {
  t.addEventListener('click', () => {
    marketTab = t.dataset.markettab || 'shop'
    for (const x of dom.marketTabs) x.classList.toggle('on', x === t)
    dom.marketShopPage.hidden = marketTab !== 'shop'
    dom.marketRecyclePage.hidden = marketTab !== 'recycle'
    dom.marketAuctionPage.hidden = marketTab !== 'auction'
    renderMarket()
  })
}
// 丹房：炼制 / 自动炼制（事件委托：面板每次重绘，避免丢监听）
onPress(dom.alchemyOverlay, (e) => {
  const b = e.target.closest('[data-brew]')
  if (b && !b.disabled) {
    const res = alchemy.brew(b.dataset.brew)
    pushLog(res.message, res.ok && res.success ? 'ok' : 'fail')
    if (res.ok) {
      persist('alchemy-brew')
      renderAlchemy()
    }
    return
  }
  const auto = e.target.closest('[data-autobrew]')
  if (auto && !auto.disabled) {
    const ab = alchemy.autoBrewFor(auto.dataset.autobrew)
    pushLog(ab.message, ab.success ? 'ok' : 'fail')
    for (const d of ab.details) pushLog(d, 'info')
    if (ab.attempts > 0) persist('alchemy-autobrew')
    renderAlchemy()
    render()
  }
})

dom.btnDraw.addEventListener('click', startRootDraw)
dom.btnRootOk.addEventListener('click', () => hideOverlay())
dom.btnDrawWorld.addEventListener('click', drawWorld)
dom.btnWorldReroll.addEventListener('click', doWorldReroll)
dom.btnWorldOk.addEventListener('click', () => {
  hideWorldOverlay()
  persist('world-confirm')
  renderWorldChip()
  showOverlay('intro')   // 抽定此界 → 进入测灵根
})
dom.btnExport.addEventListener('click', doExport)
dom.btnImport.addEventListener('click', doImport)
dom.btnReset.addEventListener('click', doReset)

dom.btnHide.addEventListener('click', () => {
  if (desktop) desktop.hide()
  else pushLog('浏览器模式下「隐藏到托盘」不可用（请在 Electron 中运行）。', 'info')
})

// ── 设置 / 存档 / 背包 交互 ───────────────────────────────────────────────
dom.btnSettings.addEventListener('click', () => {
  if (dom.panelOverlay.classList.contains('show')) closePanel()
  else openPanel('settings')
})
dom.panelClose.addEventListener('click', closePanel)
for (const t of dom.tabs) t.addEventListener('click', () => switchTab(t.dataset.tab))

dom.tgPause.addEventListener('click', () => {
  state.settings.paused = !state.settings.paused
  setToggle(dom.tgPause, state.settings.paused)
  pushLog(state.settings.paused ? '已暂停挂机：在线不再产出，离开时长照常累计。' : '已恢复挂机。', 'sys')
  persist('settings')
  render()
})

// 化身切换（V2 立绘 UI：男修·红黑金 / 女修·月白水蓝）
dom.tgAvatar.addEventListener('click', () => {
  state.settings.avatar = state.settings.avatar === 'female' ? 'male' : 'female'
  const isFemale = state.settings.avatar === 'female'
  dom.tgAvatar.textContent = isFemale ? '女修' : '男修'
  dom.tgAvatar.classList.toggle('on', isFemale)
  pushLog(isFemale ? '化身切换：女修 · 月白水蓝。' : '化身切换：男修 · 红黑金。', 'root')
  emit('avatar:set', { avatar: state.settings.avatar })
  persist('settings')
})

dom.tgSound.addEventListener('click', () => {
  state.settings.sound = !state.settings.sound
  setToggle(dom.tgSound, state.settings.sound)
  applyAudio({ persistIt: true })   // 3.5：总开关落到引擎（含环境音启停）；文案由 applyAudio 出
})

// 自动突破（默认开）：关掉就完全手动；开着一律"修为够了即冲关"，只有渡劫仍要玩家按键
dom.tgAutoBreak.addEventListener('click', () => {
  const next = state.settings.autoBreak === false
  state.settings.autoBreak = next
  setToggle(dom.tgAutoBreak, next)
  pushLog(next
    ? '已开启自动突破：修为够了自动冲关（含瓶颈，缺破境丹自动开炉）；渡劫仍需你亲自引雷。'
    : '已关闭自动突破：冲关全由你手动点按。', 'sys')
  persist('settings')
})

// 自动寻蛋（默认开）：灵鹰空闲即自动入林 + 归巢自动收蛋（孵化与破壳仍手动）
dom.tgAutoEgg.addEventListener('click', () => {
  const next = state.settings.autoEgg === false
  state.settings.autoEgg = next
  setToggle(dom.tgAutoEgg, next)
  pushLog(next ? '已开启自动寻蛋：灵鹰得空即入万兽林，蛋归来自动收笼。' : '已关闭自动寻蛋：寻蛋改由你手动派遣。', 'sys')
  persist('settings')
})

// ═══════════════════════════════════════════════════════════════════════════
// ══ 3.3 氛围系统 装配区（改动仅限本区块 + 启动下发一行 + renderPanel 一行）══
// ═══════════════════════════════════════════════════════════════════════════
// 接线内容：把「时钟 + settings(ambience/weather/dayPhase)」算成一份氛围视图，
//   每秒复算一次，**指纹变化才**经 'ambience:set' 下发给场景（场景只换色与开关粒子）。
//   低性能自动降载由场景采样实测帧率（写 game.registry['ambienceLoad']），此处只读来展示。
// 口径（§13.1⑤）：氛围纯表现层 —— 不产不耗任何数值、不写别人的存档子树；
//   本模块只拥有 settings 下三个偏好叶子（ambience / weather / dayPhase），默认全自动。

let ambKey = ''   // 已下发视图的指纹（避免每秒重发、重启动画）

/** 有效氛围档：settings='auto' 时按系统「减弱动态」分流（静态/全开），手动选择优先 */
function ambienceMode () {
  return resolveAmbienceMode(state && state.settings.ambience, REDUCED_MOTION)
}

/** 此刻的氛围视图（时钟 + 三个设置叶子 + 场景回报的负载档） */
function currentAmbience (ts = Date.now()) {
  const s = (state && state.settings) || {}
  const loadLevel = (game && game.registry) ? (game.registry.get('ambienceLoad') || 0) : 0
  return ambienceView({
    ts,
    phaseSetting: s.dayPhase || 'auto',
    weatherSetting: s.weather || 'auto',
    mode: resolveAmbienceMode(s.ambience, REDUCED_MOTION),
    loadLevel,
    reducedMotion: REDUCED_MOTION   // 系统减弱动态 → 自动降一档（粒子更稀更缓，但不消失）
  })
}

/**
 * 复算并（必要时）下发。判定条件有两条，缺一不可：
 *   ① 指纹变了（相位 / 天气 / 档位 / 负载）；② 场景已回过同一指纹的回执。
 * ② 是必需的：启动时事件可能早于 MainScene.create（订阅之前发出就丢了），
 * 丢一次而只靠指纹去重会一直不补发 —— 场景在 applyAmbience 里写 registry
 * `ambienceKey`，这里对不上就每秒重发一次，天然自愈。
 */
function emitAmbience (delay = 0) {
  if (!state) return
  const v = currentAmbience()
  const k = viewKey(v)
  const acked = (game && game.registry) ? game.registry.get('ambienceKey') : null
  if (k === ambKey && acked === k) return
  ambKey = k
  emit('ambience:set', v, delay)
}

/** 设置面板三行 + 负载档展示（面板打开时随 1s 心跳刷新） */
function syncAmbienceUI () {
  if (!state) return
  const s = state.settings || {}
  const mode = resolveAmbienceMode(s.ambience, REDUCED_MOTION)
  const v = currentAmbience()

  if (dom.tgAmbience) {
    dom.tgAmbience.textContent = (s.ambience || 'auto') === 'auto'
      ? `自动（${MODE_NAMES[mode]}）`
      : MODE_NAMES[mode]
    dom.tgAmbience.classList.toggle('on', mode !== 'off')
  }
  if (dom.tgWeather) {
    dom.tgWeather.textContent = v.weather.manual ? v.weather.name : `自动（${v.weather.name}）`
    dom.tgWeather.classList.toggle('on', v.weather.id !== 'clear')
  }
  if (dom.tgDayphase) {
    dom.tgDayphase.textContent = v.phase.manual ? v.phase.name : `自动（${v.phase.name}）`
    dom.tgDayphase.classList.toggle('on', v.phase.id === 'night')
  }
  if (dom.vAmbienceLoad) {
    dom.vAmbienceLoad.textContent = (v.load.level === 0 ? '标准' : `${v.load.name} L${v.load.level}`) +
      (v.load.rmBoosted ? '（减弱动态）' : '')
    dom.vAmbienceLoad.classList.toggle('dim', v.load.level === 0)
    dom.vAmbienceLoad.title = '低性能自动降载：帧率不足时自动减稀粒子、必要时停天气，恢复后自动升回；' +
      '系统开着「减弱动态」时默认就按轻降载跑（粒子更稀更缓）。'
  }
}

const nextIn = (list, cur) => list[(Math.max(0, list.indexOf(cur)) + 1) % list.length]

// 氛围总档：自动 → 全开 → 静态 → 关闭（系统减弱动态时「自动」＝静态）
dom.tgAmbience.addEventListener('click', () => {
  state.settings.ambience = nextMode(state.settings.ambience)
  const mode = ambienceMode()
  pushLog({
    full: '氛围：全开（昼夜色调 · 灵气粒子流 · 雨雪霞）。',
    static: '氛围：静态（只留昼夜色调，雨雪与灵气流停下）。',
    off: '氛围：已关闭（画面上只保留修行本身的演出）。',
    auto: '氛围：自动。'
  }[mode], 'sys')
  syncAmbienceUI()
  ambKey = ''
  emitAmbience()
  persist('settings')
})

// 天气：自动 → 晴 → 雨 → 雪 → 霞（手动指定便于当场看四种天气；霞只在晨/暮有）
dom.tgWeather.addEventListener('click', () => {
  const cur = WEATHER_SETTINGS.includes(state.settings.weather) ? state.settings.weather : 'auto'
  state.settings.weather = nextIn(WEATHER_SETTINGS, cur)
  const v = currentAmbience()
  pushLog(v.weather.manual
    ? `天气：${v.weather.name}（手动固定；「自动」时按游戏日轮换，现实约 4 分钟一变）。`
    : `天气：自动（此刻 ${v.weather.name}）。`, 'sys')
  syncAmbienceUI()
  ambKey = ''
  emitAmbience()
  persist('settings')
})

// 昼夜相位：自动 → 晨 → 昼 → 暮 → 夜（自动＝跟现实时钟，24 小时一循环）
dom.tgDayphase.addEventListener('click', () => {
  const cur = PHASE_SETTINGS.includes(state.settings.dayPhase) ? state.settings.dayPhase : 'auto'
  state.settings.dayPhase = nextIn(PHASE_SETTINGS, cur)
  const v = currentAmbience()
  pushLog(v.phase.manual
    ? `昼夜：${v.phase.name}（手动固定；「自动」时跟现实时钟，白天亮、黄昏暖、夜里冷）。`
    : `昼夜：自动（此刻 ${v.phase.name}）。`, 'sys')
  syncAmbienceUI()
  ambKey = ''
  emitAmbience()
  persist('settings')
})

// 1s 心跳：相位/天气/负载档都会随时间变，这里复算并补发；设置面板开着就顺手刷新展示
setInterval(() => {
  if (!state) return
  emitAmbience()
  if (dom.panelOverlay && dom.panelOverlay.classList.contains('show')) syncAmbienceUI()
}, 1000)
// ══ 3.3 氛围系统 装配区结束 ═══════════════════════════════════════════════

// ══ 3.4 UI 动效与主题 装配区 ═══════════════════════════════════════════════
// 皮肤真源在 src/data/themes.js（四套色板 + 12 世界色系映射），本区只做三件事：
//   ① 把皮肤写成 DOM 的 CSS 变量（`index.html` 的 :root 只留默认值兜底）；
//   ② 经 'skin:set' 把同一份色板下发给 MainScene（换蒲团贴图 + 重铸境界圆光/袍色）；
//   ③ 设置面板「皮肤」一行的接线与文案。
// 边界（§13.1①）：只改表现，不碰任何 state 数值；皮肤是 settings.skin 一个偏好叶子。

let skinKey = ''   // 已落地皮肤的指纹（id|auto），避免每次 render 重写整套变量

/** 当前皮肤（纯读；'auto' 档取当前世界色系，未抽世界回默认鎏金） */
function currentSkin () {
  const s = (state && state.settings) || {}
  return resolveSkin(s.skin, (world && world.drawn && world.view().id) || null)
}

/** 设置面板点按循环：四套皮肤 → 随世界 → 回到第一套 */
const SKIN_ORDER = [...SKIN_IDS, SKIN_AUTO]

function skinLabel (sk) {
  return sk.auto ? `随世界·${sk.name}` : sk.name
}

/**
 * 应用皮肤：写 CSS 变量（DOM 层）→ 下发 'skin:set'（Phaser 层）。
 * 指纹未变时直接返回（render 每 100ms 调一次，不能每次都写 60+ 个变量）。
 * @param {{silent?:boolean, persistIt?:boolean, force?:boolean}} [o]
 * @returns {object|null} resolveSkin() 结果
 */
function applySkin ({ silent = false, persistIt = false, force = false } = {}) {
  if (!state) return null
  const sk = currentSkin()
  const key = `${sk.id}|${sk.auto ? 1 : 0}`
  if (!force && key === skinKey) return sk
  skinKey = key
  const root = document.documentElement
  for (const [k, v] of Object.entries(sk.vars)) root.style.setProperty(k, v)
  root.dataset.skin = sk.id
  emit('skin:set', { id: sk.id, name: sk.name, accent: sk.accent, palette: sk.palette, slots: sk.slots })
  if (silent) return sk
  pushLog(`皮肤切换：${skinLabel(sk)}。`, 'sys')
  if (persistIt) persist('settings')
  return sk
}

/** 设置面板「皮肤」一行（面板打开时随 1s 心跳刷新） */
function syncSkinUI () {
  if (!state || !dom.tgSkin) return
  const sk = currentSkin()
  dom.tgSkin.textContent = skinLabel(sk)
  dom.tgSkin.classList.toggle('on', sk.id !== 'default' || sk.auto)
  dom.tgSkin.title = `当前：${sk.name}${sk.auto ? '（随世界自动）' : ''}\n${sk.desc}\n点按循环：鎏金 → 朱砂 → 玄墨 → 月白 → 随世界`
}

if (dom.tgSkin) {
  dom.tgSkin.addEventListener('click', () => {
    if (!state) return
    const cur = String(state.settings.skin || 'default')
    const i = SKIN_ORDER.indexOf(cur)
    state.settings.skin = SKIN_ORDER[(i + 1) % SKIN_ORDER.length]
    skinKey = ''                      // 强制重写并重下发（同 id 也可能要换档）
    applySkin({ persistIt: true })
    syncSkinUI()
  })
}

// ── 3.4 动效总档（CSS 支点在 index.html：html.motion-full / html.motion-static）──

/** 当前有效动效档（纯读；只有 'auto' 才跟系统「减弱动态」） */
function motionMode () {
  return resolveMotionMode(state && state.settings.motion, REDUCED_MOTION)
}

/**
 * 应用动效总档。给 <html> 挂/摘两个类，CSS 两处支点据此生效：
 *   · .motion-full   → 让「减弱动态」降级块的作用域 `:root:not(.motion-full)` 失效
 *   · .motion-static → 无条件归零（与系统偏好无关）
 */
function applyMotion ({ silent = false, persistIt = false } = {}) {
  if (!state) return 'full'
  const mode = motionMode()
  const root = document.documentElement
  root.classList.toggle('motion-full', mode === 'full')
  root.classList.toggle('motion-static', mode === 'static')
  if (!silent) pushLog(`动效已切为「${MOTION_NAMES[mode]}」。`, 'sys')
  if (persistIt) persist('settings')
  return mode
}

/** 设置面板「动效」一行（档位按钮 + 系统实测只读值） */
function syncMotionUI () {
  if (!state) return
  const raw = String(state.settings.motion || 'full')
  const mode = motionMode()
  if (dom.vMotion) dom.vMotion.textContent = REDUCED_MOTION ? '系统·减弱' : '系统·标准'
  if (!dom.tgMotion) return
  dom.tgMotion.textContent = raw === 'auto' ? `自动·${MOTION_NAMES[mode]}` : (MOTION_NAMES[raw] || '全开')
  dom.tgMotion.classList.toggle('on', mode === 'full')
  dom.tgMotion.title = `动效：${MOTION_NAMES[raw] || raw}（实际 ${MOTION_NAMES[mode]}）\n`
    + '点按循环：全开 → 自动 → 静态\n全开＝面板转场 / 数值滚动 / 按钮按压全部生效；静态＝一律归零。'
}

if (dom.tgMotion) {
  dom.tgMotion.addEventListener('click', () => {
    if (!state) return
    const cur = String(state.settings.motion || 'full')
    const i = MOTION_SETTINGS.indexOf(cur)
    state.settings.motion = MOTION_SETTINGS[(i + 1) % MOTION_SETTINGS.length]
    applyMotion({ persistIt: true })
    syncMotionUI()
  })
}
// ══ 3.4 UI 动效与主题 装配区结束 ═════════════════════════════════════════

// ══ 3.5 音效与音乐 装配区 ═════════════════════════════════════════════════
// 音色配方单点在 src/data/sfx.js，合成引擎在 src/audio/SfxEngine.js（不碰 DOM）。
// 本区负责四件事：① 懒建音频 + 全站点按音；② 订阅演出/业务口播音效；
//               ③ 打坐环境音随「挂机未暂停 + 窗口可见 + 音效开着」启停；
//               ④ 音效/音乐音量两行的接线（音乐播放器见下方 BGM 区块，3.5 补上音量分级）。
// 边界（§13.1①）：只改表现，不碰任何 state 数值；两个偏好叶子 volSfx / volBgm 归本模块。

/** 音效引擎（构造期无副作用：AudioContext 到首次用户手势才懒建） */
const sfxEngine = new SfxEngine()

/** 音乐音量（BGM 走 <audio> 文件，不归 Web Audio，故音量在这里换算） */
function bgmVolume () {
  const tier = (state && state.settings && state.settings.volBgm) || DEFAULT_TIER
  return gainOfTier('bgm', tier)
}

/** 播一个音效（引擎未就绪 / 音效关 / 节流中 → 静默空转，**绝不抛错**） */
function sfx (id, opts) {
  if (!sfxEngine) return false
  return sfxEngine.play(id, opts)
}

/**
 * 打坐环境音启停：三点同时满足才响 —— 挂机未暂停、灵根已测（真正在吐纳）、窗口可见，
 * 外加音效总开关。窗口被遮挡 / 隐藏到托盘时停，避免后台空耗。
 * 带"上次状态"守卫：主循环每 100ms 调一次，状态没变就什么都不做（否则渐入永远走不完）。
 */
let ambientOn = null
function refreshAmbient () {
  if (!sfxEngine || !state) return
  const visible = typeof document === 'undefined' ? true : !document.hidden
  const on = !state.settings.paused &&
    !!(roots && roots.drawn) &&
    visible &&
    !offlineMode &&
    !!state.settings.sound
  if (on === ambientOn) return
  ambientOn = on
  sfxEngine.setAmbient(on)
}

/**
 * 把 settings 里的音效三件事落到引擎（总开关 / 音量档 / 环境音）。
 * @param {{silent?:boolean, persistIt?:boolean}} [o]
 */
function applyAudio ({ silent = false, persistIt = false } = {}) {
  if (!state) return null
  const s = state.settings || {}
  sfxEngine.setEnabled(!!s.sound)
  sfxEngine.setVolumes({ sfx: s.volSfx || DEFAULT_TIER, bgm: s.volBgm || DEFAULT_TIER })
  if (typeof bgm !== 'undefined' && bgm && bgm.setVolume) bgm.setVolume(bgmVolume())
  refreshAmbient()
  if (persistIt) persist('settings')
  if (!silent) {
    pushLog(`音效已${s.sound ? '开启' : '关闭'}（音量 ${VOLUME_NAMES[s.volSfx || DEFAULT_TIER] || '中'}）。`, 'sys')
  }
  return sfxEngine.status
}

/** 设置面板「音效音量 / 音乐音量」两行（面板打开时随 1s 心跳刷新） */
function syncAudioUI () {
  if (!state) return
  const s = state.settings || {}
  if (dom.tgVolSfx) {
    const t = s.volSfx || DEFAULT_TIER
    dom.tgVolSfx.textContent = VOLUME_NAMES[t] || '中'
    dom.tgVolSfx.classList.toggle('on', t === 'high')
    dom.tgVolSfx.title = `音效音量：${VOLUME_NAMES[t] || t}（实际增益 ${gainOfTier('sfx', t).toFixed(2)}）\n点按循环：低 → 中 → 高`
  }
  if (dom.tgVolBgm) {
    const t = s.volBgm || DEFAULT_TIER
    dom.tgVolBgm.textContent = VOLUME_NAMES[t] || '中'
    dom.tgVolBgm.classList.toggle('on', t === 'high')
    dom.tgVolBgm.title = `音乐音量：${VOLUME_NAMES[t] || t}（实际增益 ${gainOfTier('bgm', t).toFixed(2)}）\n` +
      `点按循环：低 → 中 → 高${s.bgm ? '' : '\n（音乐当前未开 —— 顶栏「乐」键开启 · 右键切曲）'}`
  }
}

if (dom.tgVolSfx) {
  dom.tgVolSfx.addEventListener('click', () => {
    if (!state) return
    state.settings.volSfx = nextTier(state.settings.volSfx)
    applyAudio({ persistIt: true })
    syncAudioUI()
    // 立刻按新音量响一下（throttleMs:0 = 不吃"同一音效最小间隔"）
    sfx('ui_click', { gainScale: 0.9, throttleMs: 0 })
    pushLog(`音效音量：${VOLUME_NAMES[state.settings.volSfx]}。`, 'sys')
  })
}
if (dom.tgVolBgm) {
  dom.tgVolBgm.addEventListener('click', () => {
    if (!state) return
    state.settings.volBgm = nextTier(state.settings.volBgm)
    applyAudio({ persistIt: true })
    syncAudioUI()
    sfx('ui_click', { gainScale: 0.9, throttleMs: 0 })
    pushLog(`音乐音量：${VOLUME_NAMES[state.settings.volBgm]}${state.settings.bgm ? '' : '（音乐未开，顶栏「乐」键开启）'}。`, 'sys')
  })
}

// ── 全站点按音（一个 document 级监听覆盖所有按钮与可点文字，不必逐个按钮改代码）──
// 顺带承担「首次用户手势 unlock AudioContext」的职责（浏览器/Electron 自动播放策略）。
// 用捕获阶段：即使某个按钮自己 stopPropagation，点按音也照响。
const SFX_CLICK_SEL = 'button, .ix, .buff-chip, .ov-close, .tab'
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    if (!sfxEngine.supported) return
    if (!sfxEngine.ready) sfxEngine.unlock()      // 首次手势建图；之后幂等
    const el = e.target && e.target.closest ? e.target.closest(SFX_CLICK_SEL) : null
    if (!el) return
    if (el.disabled) sfx('ui_deny', { gainScale: 0.8 })
    else sfx('ui_click', { gainScale: 0.55 })
  }, true)

  // 窗口隐藏（托盘 / 最小化）→ 停环境音 + 挂起音频线程省电；回来再续
  document.addEventListener('visibilitychange', () => {
    refreshAmbient()
    if (document.hidden) sfxEngine.suspend()
    else if (sfxEngine.enabled) sfxEngine.resume()
  })
}

/**
 * 订阅演出与业务事件口（§13.2③：演出只订阅不回写）。
 * 只覆盖「已有 game.events 事件」的那些；宗门交差 / 秘境召回 / 灵兽破壳 / 成就
 * 没有事件口，改在各自的装配位直接调 sfx()（见相应区块的一行接线）。
 */
function wireSfxEvents () {
  if (!game || !game.events) return
  const bus = game.events
  bus.on('cult:burst', (p) => {
    if (!p || p.kind !== 'breakthrough') return
    sfx(p.success ? 'cult_break_ok' : 'cult_break_fail', { throttleMs: 300 })
  })
  bus.on('cult:tribulation', () => sfx('cult_tribulation', { throttleMs: 600 }))
  bus.on('root:reveal', () => sfx('root_reveal', { throttleMs: 400 }))
}
// ══ 3.5 音效与音乐 装配区结束 ═══════════════════════════════════════════

// ── BGM（设计库 06-BGM 四曲循环；默认关，顶栏「乐」键；右键切曲）────────────
// 播放器归装配层管（系统层不碰 DOM/媒体）；音量走 settings.volBgm（3.5 起分级，mid 档 = 旧值 0.35）。
const BGM_TRACKS = Object.entries(import.meta.glob('../assets/bgm/*.mp3', {
  eager: true, query: '?url', import: 'default'
}))
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([, url]) => url)

const bgmTrackName = (url) => {
  try {
    return decodeURIComponent(url).replace(/^.*[/\\]/, '').replace(/\.mp3$/i, '')
  } catch { return 'BGM' }
}

const bgm = (() => {
  let audio = null
  let idx = 0
  const ensure = () => {
    if (audio) return audio
    audio = new Audio()
    audio.volume = bgmVolume()   // 3.5：音量分级（mid 档 = 3.5 之前写死的 0.35）
    audio.addEventListener('ended', () => {
      if (BGM_TRACKS.length > 1) { idx = (idx + 1) % BGM_TRACKS.length; play() }
      else { audio.currentTime = 0; play() }
    })
    return audio
  }
  const play = () => {
    if (!BGM_TRACKS.length) return
    const a = ensure()
    a.src = BGM_TRACKS[idx]
    a.play().catch(() => { /* 自动播放被拦：等用户下一次点按再续（见 resume 挂钩） */ })
  }
  return {
    play,
    pause: () => { if (audio) audio.pause() },
    next: () => {
      if (!BGM_TRACKS.length) return null
      idx = (idx + 1) % BGM_TRACKS.length
      if (state.settings.bgm) play()
      return bgmTrackName(BGM_TRACKS[idx])
    },
    currentName: () => (BGM_TRACKS.length ? bgmTrackName(BGM_TRACKS[idx]) : null),
    /** 3.5：音量档变更时即时生效（不重建播放器、不断曲） */
    setVolume: (v) => { if (audio) audio.volume = Math.max(0, Math.min(1, Number(v) || 0)) },
    trackCount: BGM_TRACKS.length
  }
})()

// 系统拦自动播放时的兜底：档内开着 BGM，用户首次点按窗口即续播（一次性）
document.addEventListener('pointerdown', function bgmResume () {
  if (state && state.settings.bgm && bgm.trackCount) {
    try { bgm.play() } catch { /* 忽略 */ }
  }
  document.removeEventListener('pointerdown', bgmResume)
})

function applyBgmButton () {
  const on = !!(state && state.settings.bgm)
  dom.btnBgm.classList.toggle('on', on)
  dom.btnBgm.title = on
    ? `背景音乐：播放中（${bgm.currentName() || '—'}）｜点按关闭 · 右键切曲`
    : '背景音乐：已关（点按开启 · 右键切曲）'
}

function setBgm (on, { silent = false, persistIt = true } = {}) {
  if (!state) return
  state.settings.bgm = !!on
  if (on) {
    if (!bgm.trackCount) pushLog('BGM 素材缺失（assets/bgm 为空）。', 'fail')
    else {
      bgm.setVolume(bgmVolume())   // 3.5：开播前按当前音量档设好
      bgm.play()
      if (!silent) pushLog(`BGM 开启：${bgm.currentName()}（共 ${bgm.trackCount} 曲循环）。`, 'sys')
    }
  } else {
    bgm.pause()
    if (!silent) pushLog('BGM 已关闭。', 'sys')
  }
  applyBgmButton()
  if (persistIt) persist('settings')
}

dom.btnBgm.addEventListener('click', () => setBgm(!state.settings.bgm))
dom.btnBgm.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const name = bgm.next()
  if (name) {
    applyBgmButton()
    if (state.settings.bgm) pushLog(`切曲：${name}`, 'sys')
  }
})

// ── 窗口三态交互（顶栏三键 / 设置面板共用同一套动作）─────────────────────
dom.btnTop.addEventListener('click', () => commitWinState({ alwaysOnTop: !(winState.alwaysOnTop !== false) }))
dom.btnThrough.addEventListener('click', () => commitWinState({ clickThrough: !clickThrough }))
dom.btnLock.addEventListener('click', () => commitWinState({ lockPosition: !winState.lockPosition }))
dom.tgTop.addEventListener('click', () => commitWinState({ alwaysOnTop: !(winState.alwaysOnTop !== false) }))
dom.tgThrough.addEventListener('click', () => commitWinState({ clickThrough: !clickThrough }))
dom.tgLock.addEventListener('click', () => commitWinState({ lockPosition: !winState.lockPosition }))
// 穿透热区：点一下立刻恢复鼠标操作（不必去记快捷键）
dom.ctHotspot.addEventListener('click', () => { if (clickThrough) commitWinState({ clickThrough: false }) })

// ── 背包（独立遮罩；入口在突破按钮上方）
//    主人 2026-09-18：右上角「去丹房 / 去行囊」两键删除（快捷条各自有入口）
dom.btnBag.addEventListener('click', toggleBag)
dom.btnBagClose.addEventListener('click', closeBag)

// ── 丹房（独立遮罩；入口在突破按钮上方，主人 2026-09-17：与背包分离）─────
dom.btnAlchemy.addEventListener('click', toggleAlchemy)
dom.btnAlchemyClose.addEventListener('click', closeAlchemy)

// ── 功法（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnTech.addEventListener('click', toggleTech)
dom.btnTechClose.addEventListener('click', closeTech)

// ── 宗门（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnSect.addEventListener('click', toggleSect)
dom.btnSectClose.addEventListener('click', closeSect)

// ── 秘境（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnDungeon.addEventListener('click', toggleDungeon)
dom.btnDungeonClose.addEventListener('click', closeDungeon)

// ── 灵兽（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnBeast.addEventListener('click', toggleBeast)
dom.btnBeastClose.addEventListener('click', closeBeast)

// ── 渡劫（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnTrial.addEventListener('click', toggleTrial)
dom.btnTrialClose.addEventListener('click', closeTrial)

// ── 坊市（独立遮罩；入口在突破按钮上方）─────────────────────────────────
dom.btnMarket.addEventListener('click', toggleMarket)
dom.btnMarketClose.addEventListener('click', closeMarket)

// ── 事件与纪事 / 成就与称号（两册独立遮罩；入口在突破按钮上方）───────────
dom.btnChronicle.addEventListener('click', toggleChronicle)
dom.btnChronicleClose.addEventListener('click', closeChronicle)

dom.btnReveal.addEventListener('click', () => {
  if (bridge) bridge.reveal()
  else pushLog('浏览器模式下没有存档文件夹。', 'info')
})

dom.btnRestore.addEventListener('click', async () => {
  if (!window.confirm('确定要从备份档恢复吗？\n当前进度会被覆盖（原档另存为 save.json.before-restore）。')) return
  const res = await save.restoreBackup()
  if (!res.ok) {
    pushLog(`恢复失败：${res.error || '未知错误'}`, 'fail')
    renderPanel()
    return
  }
  pushLog('已从备份档恢复，正在重载…', 'ok')
  setTimeout(() => window.location.reload(), 500)
})

dom.btnExport2.addEventListener('click', () => { closePanel(); doExport() })
dom.btnImport2.addEventListener('click', () => { closePanel(); doImport() })
dom.btnReset2.addEventListener('click', () => { closePanel(); doReset() })

// Esc：明细浮层 → 背包 → 功法 → 设置面板 → 测灵根遮罩（由内到外逐层收）
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (tipPinned) closeTip()
  else if (dom.bagOverlay.classList.contains('show')) closeBag()
  else if (dom.alchemyOverlay.classList.contains('show')) closeAlchemy()
  else if (dom.marketOverlay.classList.contains('show')) closeMarket()
  else if (dom.sectOverlay.classList.contains('show')) closeSect()
  else if (dom.trialOverlay.classList.contains('show')) closeTrial()
  else if (dom.techOverlay.classList.contains('show')) closeTech()
  else if (dom.dungeonOverlay.classList.contains('show')) closeDungeon()
  else if (dom.beastOverlay.classList.contains('show')) closeBeast()
  else if (dom.chronicleOverlay.classList.contains('show')) closeChronicle()
  else if (dom.achvOverlay && dom.achvOverlay.classList.contains('show')) closeAchv()
  else if (dom.panelOverlay.classList.contains('show')) closePanel()
  else if (dom.overlay.classList.contains('show') && roots && roots.drawn) hideOverlay()
})

if (desktop) {
  desktop.onWindowHidden(() => enterOffline())
  desktop.onWindowShown(() => leaveOffline())
  desktop.onBeforeQuit(() => {
    enterOffline()
    persist('quit')
    desktop.quitReady()
  })
}

window.addEventListener('beforeunload', () => {
  if (!state) return
  if (!offlineMode) save.markOfflineStart(state, Date.now())
  persist('unload')
})

// ── 启动 ──────────────────────────────────────────────────────────────────
async function boot () {
  // ① 读档（文件真源 → localStorage 热备 → 新档）
  state = await save.load()
  world = new WorldSystem(state)   // 2.9 世界卡池：懒建 state.world 子树，先建好供产出/寿元/渡劫注入
  world.ensure()
  roots = new RootSystem(state)
  tech = new TechniqueSystem(state)
  alchemy = new AlchemySystem(state)
  beasts = new BeastSystem(state)   // 2.8 灵兽：懒建 state.beast 子树，先建好供下面两处注入
  // 战力乘区闭包（功法 × 灵兽）：宗门战力校验与秘境战力门槛共用同一口径（2026-09-19）
  sect = new SectSystem(state, tech, powerMulClosure())
  events = new EventSystem(state)
  events.ensure()          // 老档补字段（eventState 结构 / 气运钳位 / 策略档校准）
  dungeon = new DungeonSystem(state, tech, powerMulClosure())
  dungeon.ensure()         // 老档补字段（秘境子树：cleared / stars / dispatch）
  // V3.3.1：秘境残卷 / 首通赠功法经注入的 TechniqueSystem.grant 落袋（见 DungeonSystem._grantTech）
  market = new MarketSystem(state)  // 2.6 坊市：懒建 state.market 子树，无需 ensure（首次打开即 ensureDaily）
  achv = new AchievementSystem(state, { grant: grantAchvReward })  // 2.10：奖励发放经装配层回调落到 resources / inventory
  achv.ensure()            // 老档补字段 + 新档播种纪事 + 凡档称号入袋
  // 2.5：注入 sect 供渡劫准备「宗门援助」报价与扣贡献（CultivationSystem 只调接口，不读它的子树）
  // 2.8：注入 beasts 供渡劫准备「灵兽助战」自动生效（同上，只读报价不碰子树）
  // 2.9：注入 world 供产出/渡劫读世界修正（同上，只读报价不碰子树）
  life = new LifespanSystem(state, world)   // 2.11：先建好，供产出/渡劫读契合乘区（顺天值）
  life.ensureFit()                          // 老档补字段：fit 缺省 50
  life.syncMaxWithRealm(state.player.realm.level) // 老档/异常档：上限以境界为准
  cult = new CultivationSystem(state, roots, tech, sect, beasts, world, life)

  const isNewGame = !state.player.flags.rootDrawn
  // 老档（已测灵根但尚未抽世界）补发基准界「青岚」——世界修正中性，不打断既有进度
  if (!isNewGame && !world.drawn) {
    world.assign('qinglan')
    pushLog(`此界已定：${world.world.name}（基准界 · 世界修正中性）。`, 'sys')
  }

  // ② 首次进入先结算离线收益（可能是"关了电脑一夜"的场景）
  const bootNow = Date.now()
  const bootReport = save.settleOffline(state, bootNow, cult.getEffRate(bootNow).eff)
  cult.lastTickAt = bootNow

  renderLog()
  if (save.lastSource === 'localstorage' && bridge) {
    pushLog('检测到旧版 localStorage 存档，已迁移到文件存档（save.json）。', 'sys')
  }
  if (bootReport.ok) {
    tickLifespan(bootReport.awaySec) // 离线同样流逝（寿元是实时时钟）
    pushLog(`闭关归来：离开 ${fmtDuration(bootReport.awayMs)}${bootReport.capped ? `（超出上限 ${fmtGameDuration(bootReport.capHours * 3600 * 1000)}，按上限结算）` : ''}，修为 +${fmt(bootReport.gainQi)}`, 'offline')
    emitFloat({ text: `闭关归来 +${fmt(bootReport.gainQi)}`, kind: 'offline' }, STARTUP_DELAY)
    emitBurst({ kind: 'offline' }, STARTUP_DELAY)
    showReturnCard(bootReport.awayMs, bootReport.gainQi)
  } else if (bootReport.reason === 'clock-back') {
    pushLog('检测到系统时钟回拨，本次离线收益按 0 结算。', 'fail')
  }

  // 事件（2.3）：启动时对离线时长做一次事件批量结算（绝/仙级入事件簿待抉择）
  if (bootReport.ok) {
    reportOfflineEvents(events.settleOffline(bootReport.awaySec, cult.getEffRate(bootNow).eff, stoneHourly(state.player.realm.level), bootNow))
  }

  // 功法（2.1）：测灵根后赠入门功法；老档（已测灵根但无功法）在此补发
  if (roots.drawn) {
    const g = tech.ensureStarter()
    if (g.granted) pushLog(`宗门执事赠下入门功法「${g.name}」，已入主修槽。`, 'root')
  }

  // 丹药（2.2）：老档站在瓶颈级且身无破境丹 → 补发一枚（新手脚本：首次小瓶颈赠丹）
  {
    const pg = alchemy.ensureBottleneckPill()
    if (pg.granted) pushLog(pg.message, 'root')
  }

  // 宗门授功（V3.3.1）：老档已入宗者，按当前境界补发应得的普通功法
  {
    const grants = (sect && sect.grantTick) ? sect.grantTick() : []
    for (const g of grants) pushLog(`宗门授功：${g.realmName}期当习《${g.name}》，已录入功法册（去「功法」装槽）。`, 'root')
  }

  // 成就与纪事（2.10）：开局先判一次（老档补解锁 + 离线期间的纪事批次在此补齐）
  runAchvCheck(bootNow)

  const startInfo = getLevelInfo(state.player.realm.level)
  pushLog(`问长生 · 开局（${startInfo.displayName}）修为开始自动增长。`, 'sys')
  if (roots.drawn) {
    pushLog(`本档灵根：${roots.displayName}（产出 ×${roots.mods.rateMul.toFixed(2)}）`, 'root')
    emit('root:aura', { color: roots.tier.color }, STARTUP_DELAY)
  }
  emitRealmLook(STARTUP_DELAY)   // 3.1 角色表现：启动按当前境界下发外观（场景自读初值的兜底）
  emitAmbience(STARTUP_DELAY)    // 3.3 氛围系统：启动下发此刻的昼夜/天气视图（之后每秒复算补发）

  await refreshSaveBadge()

  // 设置落档 → 下发窗口三态（置顶 / 鼠标穿透 / 锁定位置）；暂停由 systems 自行读取 settings.paused
  winState.alwaysOnTop = state.settings.alwaysOnTop !== false
  winState.clickThrough = !!state.settings.clickThrough
  winState.lockPosition = !!state.settings.lockPosition
  clickThrough = winState.clickThrough
  ctInteractive = false
  if (desktop && desktop.window && desktop.window.setState) {
    const r = await desktop.window.setState({ ...winState })
    if (r && r.state) Object.assign(winState, r.state)
    clickThrough = !!winState.clickThrough
    // 托盘勾选 / 全局快捷键从外部改动时，回执会推到这里
    if (desktop.window.onStateChanged) desktop.window.onStateChanged(() => { syncWinStateFromMain() })
  }
  applyWinStateToUI()

  // BGM 落档状态生效（默认关；开机即开时若被系统拦自动播放，首次点按窗口续播）
  setBgm(!!state.settings.bgm, { silent: true, persistIt: false })

  // 3.4 皮肤落档生效：先把 CSS 变量铺好（首帧即正确配色），'skin:set' 由事件队列
  // 在场景订阅完成后补发（见 ④ 场景就绪后补发启动期事件）
  applySkin({ silent: true, force: true })

  // 3.4 动效总档落档生效：给 <html> 挂类（index.html 的 RM 降级块按 :not(.motion-full) 让路）
  applyMotion({ silent: true })

  // 3.5 音效落档生效：总开关 / 音量档 / 环境音。
  // ⚠ 此时还没有用户手势，AudioContext 尚未建（浏览器自动播放策略），
  //   真正出声要等主人第一次点按窗口（见 3.5 装配区的 document 级 pointerdown）。
  applyAudio({ silent: true })

  // ③ 启动 Phaser（画布透明，叠在窗体上与桌面融合）
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    transparent: true,
    banner: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: 420,
      height: 320
    },
    render: { antialias: true, roundPixels: false, transparent: true },
    scene: [BootScene, PreloadScene, MainScene],
    callbacks: {
      // postBoot 在任何场景 create 之前触发：把系统挂到 registry，场景可随时取用
      postBoot: (g) => {
        g.registry.set('cultivation', cult)
        g.registry.set('roots', roots)
        g.registry.set('save', save)
        g.registry.set('state', state)
      }
    }
  })

  // 3.5 音效：订阅演出/业务事件口（场景已建，game.events 可用）
  wireSfxEvents()

  // ④ 场景就绪后补发启动期事件（离线飘字 / 灵根光晕色 / 立绘中部可用区）
  setTimeout(() => {
    for (const [name, payload] of pendingEvents) game.events.emit(name, payload)
    pendingEvents.length = 0
    syncMidMetrics()
  }, STARTUP_DELAY)

  // ⑤ 挂机主循环：每 100ms 结算一次（速率即"每秒增加修为"），并刷新面板
  //    注意：测出灵根前不产出（对齐设计库《新手前 30 分钟体验脚本》：先测灵根再打坐）
  setInterval(() => {
    const dt = offlineMode || !state.player.flags.rootDrawn ? 0 : cult.tick(Date.now())
    if (dt > 0) tickLifespan(dt)
    // 自动突破（主人 2026-09-18，默认开）：修为够了自动冲关（含瓶颈）；渡劫不自动
    if (dt > 0 && state.settings.autoBreak !== false) autoBreakTick()
    // 宗门：俸禄随在线时间入账 + 任务板换轮 + **限时任务到点自动交差**（主人 2026-09-19）
    if (sect) {
      const st = sect.tick(Date.now(), dt)
      const claims = (st && st.claims) || []
      for (const c of claims) {
        pushLog(c.message, c.success ? 'ok' : 'fail')
        emitFloat({ text: `自动交差 · 贡献 +${c.contrib}`, kind: 'info' })
      }
      if (claims.length) {
        persist('sect-auto-claim')
        // 3.5 音效：宗门任务到点交差（一批只响一声，不按条数连响）
        if (claims.some((c) => c.success)) sfx('sect_done', { throttleMs: 400 })
      }
    }
    // 功法长期参悟（主人 2026-09-19）：装备中的功法随在线时长自行精进（免费，不耗灵气 / 灵石）
    if (tech && dt > 0) {
      const ups = tech.trainTick(dt)
      for (const u of ups) {
        pushLog(`功法自行精进：《${u.name}》参悟至第 ${u.level} 级（修为 +${(u.pct * 100).toFixed(0)}%，战力 +${(u.combatPct * 100).toFixed(1)}%）。`, 'ok')
      }
      if (ups.length) {
        persist('tech-train')
        if (dom.techOverlay.classList.contains('show')) renderTech()
      }
    }
    // 宗门授功（V3.3.1）：晋入新大境界 → 宗门下发该境界的普通功法（幂等，已发过则空跑）
    if (sect && sect.joined) {
      const sg = sect.grantTick()
      if (sg.length) {
        for (const g of sg) pushLog(`宗门授功：${g.realmName}期当习《${g.name}》，已录入功法册。`, 'root')
        persist('sect-grant')
      }
    }
    if (beasts) {
      beasts.tick(Date.now(), dt)   // 灵兽（2.8）：出战被动产出随在线秒入账（离线不发）
      // 自动成长（V3.5.1）：攒满一级的灵兽在此打日志
      for (const msg of beasts.drainGrew()) pushLog(msg, 'ok')
    }
    // 自动寻蛋（主人 2026-09-18，默认开）：灵鹰空闲即入万兽林，归巢即收蛋
    if (beasts && state.settings.autoEgg !== false) {
      const acts = beasts.autoTick(Date.now())
      for (const a of acts) {
        pushLog(a.message, a.ok ? 'ok' : 'info')
        if (a.ok && a.kind === 'egg') emitFloat({ text: '灵兽蛋入笼', kind: 'info' })
      }
      if (acts.some((a) => a.ok)) persist('beast-auto')
    }
    if (market) market.ensureDaily(Date.now())  // 坊市（2.6）：每日 5 点刷新货品/拍卖（同日幂等）
    // 秘境（2.7）：派遣到期结算（真实时间驱动，离线照算）+ 每周一自动扫荡
    if (dungeon) {
      const dgNow = Date.now()
      for (const r of dungeon.tick(dgNow)) {
        pushLog(r.message, 'ok')
        emitFloat({ text: `分身归来 +${fmt(r.stones)} 灵石`, kind: 'info' })
      }
      const weekly = dungeon.ensureWeekly(dgNow)
      if (weekly) {
        pushLog(weekly.message, 'ok')
        emitFloat({ text: `试炼塔周扫荡 +${fmt(weekly.stones)} 灵石`, kind: 'info' })
      }
    }
    // 事件（2.3）：在线滚动触发 + 恩怨挂账到期兑现（暂停/离线时不触发新事件，挂账照兑）
    if (events) {
      const evNow = Date.now()
      for (const r of events.tick(evNow, cult.getEffRate(evNow).eff, stoneHourly(state.player.realm.level), dt > 0)) {
        pushLog(r.message, r.good ? 'ok' : 'fail')
        // 2.10 计数：因果兑现 / 善恶事件（累计量，近事录会因容量滚动丢旧账，故另记一笔）
        if (achv) achv.note(r.kind === 'repay' ? 'repay' : (r.good ? 'eventGood' : 'eventBad'))
      }
      drainFitDelta()   // 2.11：事件果报（契合 ±N）在此入账顺天值
    }
    // 成就与纪事（2.10）：每秒一判；纪事按真实时间到点汇总一批（离线也照算）
    achvTick = (achvTick + 1) % 10
    if (achvTick === 0) runAchvCheck(Date.now())
    notifyMatDrops()
    render()
    refreshAmbient()   // 3.5：环境音自愈（暂停挂机 / 灵根刚测完 / 窗口可见性变化都会被纠回）
  }, TICK_MS)

  // ⑥ 自动存档（30 秒）—— 关键节点（突破/洗髓/离线）另有即时存档
  setInterval(() => persist('auto'), AUTOSAVE_MS)

  render()
  syncOverlayZone()   // 遮罩落点按日志面板实测矩形写入（避免首帧用默认值闪一下）

  // ⑦ 新档：先抽世界（2.9）→ 再测灵根（灵根未测完不开始挂机产出加成）
  if (isNewGame) {
    setTimeout(() => {
      if (!world.drawn) showWorldOverlay('intro')
      else if (!roots.drawn) showOverlay('intro')
      else hideOverlay()
    }, STARTUP_DELAY)
    pushLog('尚未抽定此界 —— 先观十二界抽签，再测灵根。', 'root')
  } else {
    hideOverlay()
  }

  // 调试入口（正式包无副作用，仅挂在 window 上便于开发期在 DevTools 里查状态）
  window.__wcs = { game, state, cult, roots, tech, alchemy, life, sect, beasts, world, events, dungeon, market, achv, save, audio: sfxEngine }
}

boot().catch((err) => {
  console.error('[启动失败]', err)
  const box = document.getElementById('log')
  if (box) box.textContent = '启动失败：' + (err && err.message)
})
