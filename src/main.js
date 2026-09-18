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
import { getLevelInfo, getRealmMeta, getNextBreakthrough, REALM_META, TRIBULATION } from './data/realms.js'
import { DRAW_ANIMATION, XISUI_DROP, REROLL_PITY, ROOT_TIERS, HIDDEN_ROOT, HIDDEN_CHANCE } from './data/roots.js'
import { getItem, getUnit } from './data/items.js'
// 游戏历（主人 2026-09-19 口径：**现实 1 分钟 = 游戏 1 天**）——
// 界面上的**所有时间文案**统一走它；机制仍按现实时间推进（见 data/gametime.js 头注）。
import { fmtGameDuration, fmtGameClock, fmtGameStamp, fmtGameDate, fmtRefreshPeriod, msToNextRefresh, gameClockOf } from './data/gametime.js'
import { TIER_MAP, maxRatePct, maxCombatPct, getTechnique } from './data/techniques.js'
import { stoneHourly, QUALITY_COLOR, QUALITY_NAME, STRATEGY_AUTO, STRATEGY_PREF } from './data/events.js'

/** 选项 tag → 中文（自动策略偏好序在悬停里写清楚，主人问的"三项各管什么"就在这行） */
const OPT_TAG_NAME = { safe: '保底项', balanced: '期望项', risky: '高波动项' }
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
import {
  OVERLAY_ALPHA_LEVELS, resolveOvAlpha, ovAlphaName, nextOvAlpha
} from './data/overlay.js'                            // V4.7 浮层（.ov）透明度档位
import SfxEngine from './audio/SfxEngine.js'          // 3.5 音效与音乐（程序化合成引擎）
import { VOLUME_NAMES, nextTier, gainOfTier, DEFAULT_TIER } from './data/sfx.js'
import { collectBonusLines, recomposeBonus } from './systems/BonusLedger.js' // V3.5.3 统一加成接口（聚合账本，纯逻辑）
import { noteGain, econView } from './systems/EconLedger.js'                 // V3.5.4 单日收益归因台账（纯逻辑，读写 state.econ）
import { createMarketPanel } from './ui/MarketPanel.js'                      // V3.5.5 拆分：坊市面板（src/ui/ 新层）
import { createBeastPanel } from './ui/BeastPanel.js'                       // V3.5.5 拆分：灵兽面板（src/ui/ 新层）
import { createDungeonPanel } from './ui/DungeonPanel.js'                   // V3.5.5 拆分：秘境面板（src/ui/ 新层）
import { createTrialPanel } from './ui/TrialPanel.js'                       // V3.5.6 拆分：渡劫面板（src/ui/ 新层）
import { createTechPanel } from './ui/TechPanel.js'                         // V3.5.6 拆分：功法面板（src/ui/ 新层）
import { createSectPanel } from './ui/SectPanel.js'                         // V3.5.6 拆分：宗门面板（src/ui/ 新层）
import { createBagPanel } from './ui/BagPanel.js'                           // V3.5.6 拆分：行囊面板（src/ui/ 新层）
import { createAlchemyPanel } from './ui/AlchemyPanel.js'                   // V3.5.6 拆分：丹房面板（src/ui/ 新层）
import { pickRenderMs } from './data/powersave.js'                          // P4.4 性能与省电：渲染间隔决策（纯函数）

const TICK_MS = 100            // 挂机结算间隔（按秒速率连续入账，进度条因此顺滑）
const AUTOSAVE_MS = 30000      // 自动存档间隔（设计口径：30 秒 + 关键节点）
// V3.5.2 渲染节流（对照参考项目提炼）：数值结算仍每 100ms 一拍，DOM 面板刷新降频——
//   render() 是每拍最重的一段（整包 HUD + 浮层 + 各面板查询），250ms 的刷新间隔
//   肉眼无感，长挂（P4.4 的 72h 验收）时 DOM 压力降为 1/2.5。事件触发的 render()
//   调用不节流（改状态处仍即时刷新）。开着的遮罩面板轻刷改为时间驱动（PANEL_MS），
//   不再随 render 拍数缩放。
const RENDER_MS = 250          // 主循环里 DOM 面板刷新的最低间隔（肉眼光滑下限之内）
const PANEL_MS = 1000          // 开着的遮罩面板轻刷节拍（原「每 10 拍 ≈ 1 秒」改时间驱动）
// P4.4 性能与省电：渲染间隔三档（结算拍 TICK_MS 不受影响，挂机产出分毫不变）
const IDLE_AFTER_MS = 120000   // 最后一次用户输入距今超过 2 分钟 → 空闲档
const RENDER_IDLE_MS = 2000    // 空闲档渲染间隔（可见但没人用：省电降帧，面板倒计时仍按 PANEL_MS 跟拍）
const RENDER_HIDDEN_MS = 5000  // 不可见档（藏进托盘）：DOM 刷新纯浪费，5s 兜底；回来时离线结算会即时 render
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
let marketPanel = null   // V3.5.5 拆分：坊市面板实例（boot 创建）
let beastPanel = null    // V3.5.5 拆分：灵兽面板实例（boot 创建）
let dungeonPanel = null  // V3.5.5 拆分：秘境面板实例（boot 创建）
let trialPanel = null    // V3.5.6 拆分：渡劫面板实例（boot 创建）
let techPanel = null     // V3.5.6 拆分：功法面板实例（boot 创建）
let sectPanel = null     // V3.5.6 拆分：宗门面板实例（boot 创建）
let bagPanel = null      // V3.5.6 拆分：行囊面板实例（boot 创建）
let alchemyPanel = null  // V3.5.6 拆分：丹房面板实例（boot 创建）
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
  bubble: el('trial-bubble'),            // V4.7：渡劫交互气泡（原 #confirm-bubble 位置，兼八关口/准备/史册）
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
  tgAutoLaunch: el('tg-autolaunch'),     // P4.2 开机自启
  vRuntime: el('v-runtime'),             // P4.5 当前运行版本
  tgTop: el('tg-top'),
  tgAutoBreak: el('tg-autobreak'),
  tgAutoEgg: el('tg-autoegg'),
  tgAutoHatch: el('tg-autohatch'),       // V4.7 灵兽自动孵化（有空位就入孵、孵满自动破壳）
  tgAutoBrew: el('tg-autobrew'),         // V4.7 丹房自动补货（每种丹常备 1 枚）
  tgAmbience: el('tg-ambience'),         // 3.3 氛围：自动 / 全开 / 静态 / 关闭
  tgWeather: el('tg-weather'),           // 3.3 天气：自动 / 晴 / 雨 / 雪 / 霞
  tgDayphase: el('tg-dayphase'),         // 3.3 昼夜：自动 / 晨 / 昼 / 暮 / 夜
  vAmbienceLoad: el('v-ambience-load'),  // 3.3 负载档展示（自动降载）
  vMotion: el('v-motion'),               // 3.4 系统「减弱动态」实测值（只读展示）
  tgMotion: el('tg-motion'),             // 3.4 动效总档：全开 / 自动 / 静态
  tgOvAlpha: el('tg-ovalpha'),           // V4.7 浮层（.ov）底色透明度：不透明 / 微透 / 半透 / 很透
  tgSkin: el('tg-skin'),                 // 3.4 皮肤：鎏金 / 朱砂 / 玄墨 / 月白 / 随世界
  tgVolSfx: el('tg-vol-sfx'),            // 3.5 音效音量：低 / 中 / 高
  tgVolBgm: el('tg-vol-bgm'),            // 3.5 音乐音量：低 / 中 / 高
  vEconDay: el('v-econ-day'),            // V3.5.4 今日收益归因：日键
  vEcon: el('v-econ'),                   // V3.5.4 今日收益归因：分线净额与占比
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
  tgBrewAuto: el('tg-brew-auto'),         // V4.7 丹房面板内的「自动炼制」直观开关
  brewAutoNote: el('brew-auto-note'),     // V4.7 该行说明
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
  btnTaskStartall: el('btn-task-startall'),       // V4.7 一键接取
  btnTaskAutostart: el('btn-task-autostart'),     // V4.7 自动接取（开关）
  sectAutoNote: el('sect-auto-note'),             // V4.7 自动接取说明行
  // 灵兽（2.8）
  btnBeast: el('btn-beast'),
  beastOverlay: el('beast-overlay'),
  btnBeastClose: el('btn-beast-close'),
  beastInfo: el('beast-info'),
  beastDispatch: el('beast-dispatch'),
  beastEggs: el('beast-eggs'),
  beastHatchMode: el('beast-hatch-mode'),   // V4.7：孵化位数量 + 自动孵化开没开
  beastPark: el('beast-park'),
  beastNote: el('beast-note'),
  // 秘境（2.7）
  btnDungeon: el('btn-dungeon'),
  dungeonOverlay: el('dungeon-overlay'),
  btnDungeonClose: el('btn-dungeon-close'),
  dungeonTower: el('dungeon-tower'),
  dungeonRes: el('dungeon-res'),
  dungeonSig: el('dungeon-sig'),         // V5.1 招牌秘境（12 界洞天 · 首通/周期/周轮换）
  dungeonShop: el('dungeon-shop'),       // V5.1 秘境积分商店
  dungeonDispatch: el('dungeon-dispatch'),
  dungeonNote: el('dungeon-note'),
  // 事件簿（2.3）
  btnTrial: el('btn-trial'),
  // V4.7 主人 2026-09-19：**渡劫面板恢复**为独立遮罩 #trial-overlay（八关口 / 准备 / 静养 / 史册）；
  // #mid 内的 #trial-bubble 回归"角色旁引雷轻提示"（成率 / 已备 / 引雷 / 再等等 / 看八关口）
  trialOverlay: el('trial-overlay'),
  btnTrialClose: el('btn-trial-close'),
  btnTrialGo: el('btn-trial-go'),          // 面板内「前去引雷」
  btnTrialOpen: el('btn-trial-open'),      // 气泡内「看八关口 · 做准备」→ 打开面板
  btnTrialCure: el('btn-trial-cure'),
  trialNode: el('trial-node'),
  trialPreps: el('trial-preps'),
  trialNote: el('trial-note'),
  trialHistoryBody: el('trial-history-body'),   // 战绩史册（V4.7 首次接上 history；面板内折叠区）
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
  // V4.7 主人：撤掉快捷条「成就」键与纪事册抬头「成就与称号 ›」两处按钮 ——
  //   成就册入口只留立绘头顶称号牌（#title-chip）与成就达成提示（#achv-toast）
  achvOverlay: el('achv-overlay'),
  btnAchvClose: el('btn-achv-close'),
  achvTabs: Array.from(document.querySelectorAll('.bag-tab[data-achvtab]')),
  achvNote: el('achv-note'),
  chrFilter: el('chr-filter'),
  chrFilterPills: Array.from(document.querySelectorAll('.chr-pill')),
  evtList: el('evt-list'),        // V4.7：事件近事录单列（消息与事件不再混排）
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
 * 统一加成接口（V3.5.3）：把各提供方 bonusView() 的加成行收拢成一份账本。
 *   ① 这是跨系统加成明细的**唯一汇聚点**（提供方实例由装配层注入，§13.1② 合法通道）；
 *   ② buff 公共乘区归装配层所有，经 buffs 参数入账；
 *   ③ recompose 重算结果必须与 cult.getEffRate / powerBreakdown 逐位一致
 *     （V3.5.3-自测的 recomposition 断言即防漂对账器）——改乘区公式时两处一起改。
 */
function bonusLines (now = Date.now()) {
  return collectBonusLines(
    [
      world && { id: 'world', bonusView: () => world.bonusView() },
      roots && { id: 'roots', bonusView: () => roots.bonusView() },
      tech && { id: 'tech', bonusView: () => tech.bonusView() },
      beasts && { id: 'beasts', bonusView: () => beasts.bonusView() },
      life && { id: 'life', bonusView: () => life.bonusView() }
    ].filter(Boolean),
    state ? state.buffs : [],
    now
  )
}

/** 账本重算（调试出口 / 浮层展示用）：返回 { rateMul, powerMul, … } */
function bonusRecompose (now = Date.now()) {
  return recomposeBonus(bonusLines(now))
}

// ── V3.5.4 单日收益归因（§七 护栏校验工具；账本见 systems/EconLedger.js）──────
// 记账方式＝**段间快照差值**：主循环里各产线结算段前后拍 resources 快照，差值即该线
// 净入账。不改任何 system（§13.1②），负净额（事件代价 / 突破失败扣修为）照记——
// 归因要的是事实，不是好看。
function snapRes () {
  return { q: state.resources.qi, s: state.resources.stones }
}
function noteRes (line, a, b) {
  const qi = b.q - a.q
  const stones = b.s - a.s
  if (qi || stones) noteGain(state, line, { qi, stones }, Date.now())
}
/** 今日归因视图（设置面板「今日收益归因」用） */
function econToday () {
  return econView(state, Date.now())
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
      `<span class="t-note">同界轮回熟练度每世 +3%（封顶 +15%）；界游符可换界（内容批次 2）。</span>`
  },

  /** 修为：产出乘区拆解 + 还差多久（限时增益的明细也在这里，不再占顶栏小牌） */
  qi () {
    const now = Date.now()
    const preview = cult.getBreakthroughPreview(now)
    const rate = cult.getEffRate(now)
    const finite = Number.isFinite(preview.need)
    const missing = finite ? Math.max(0, preview.need - state.resources.qi) : 0
    // V3.5.3 统一加成接口：世界乘区从账本行取（此前修为浮层看不到世界的贡献）
    const worldLine = bonusLines(now).find((l) => l.from === 'world')
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
      (worldLine ? tipRow('世界倍率', `×${worldLine.mul.toFixed(2)}（${worldLine.label}）`, 'violet') : '') +
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
  if (dom.techOverlay.classList.contains('show') && now - lastTechRender >= PANEL_MS) {
    lastTechRender = now
    renderTech()
  }
  // 宗门面板同理：任务倒计时与"换不换得起"每 ~1 秒跟一拍
  if (dom.sectOverlay.classList.contains('show') && now - lastSectRender >= PANEL_MS) {
    lastSectRender = now
    renderSect()
  }
  // 秘境面板同理：派遣倒计时每 ~1 秒跟一拍
  if (dom.dungeonOverlay.classList.contains('show') && now - lastDungeonRender >= PANEL_MS) {
    lastDungeonRender = now
    renderDungeon()
  }
  // 灵兽面板同理：派遣/孵化倒计时每 ~1 秒跟一拍
  if (dom.beastOverlay.classList.contains('show') && now - lastBeastRender >= PANEL_MS) {
    lastBeastRender = now
    renderBeast()
  }
  // 坊市（2.6）：每日刷新由 ensureDaily 幂等处理；面板开着时每 ~1 秒轻刷一次
  if (dom.marketOverlay.classList.contains('show') && now - lastMarketRender >= PANEL_MS) {
    lastMarketRender = now
    renderMarket()
  }
  // 渡劫（2.5）：面板或引雷气泡任一开着，成率与可备状态每 ~1 秒跟一拍
  if ((dom.trialOverlay.classList.contains('show') || dom.bubble.classList.contains('show')) &&
      now - lastTrialRender >= PANEL_MS) {
    lastTrialRender = now
    renderTrial()
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
    if (pend > 0) marks.push(`${pend} 起事件超出自动档、待抉择`)
    dom.btnChronicle.classList.toggle('attn', marks.length > 0)
    dom.btnChronicle.title = marks.length
      ? `纪事：${marks.join(' · ')}`
      : '纪事（超出自动档的须亲断 · 消息按等级着色）'
  }
  if (dom.chronicleOverlay.classList.contains('show') && now - lastChrRender >= PANEL_MS) {
    lastChrRender = now
    renderChronicle()
  }
  if (dom.achvOverlay && dom.achvOverlay.classList.contains('show') && now - lastAchvPaneRender >= PANEL_MS) {
    lastAchvPaneRender = now
    renderAchv()
  }
  // 丹房：面板开着时每 ~1 秒轻刷一次（材料到手后按钮应自己点亮）
  if (dom.alchemyOverlay && dom.alchemyOverlay.classList.contains('show') && now - lastAlchemyRender >= PANEL_MS) {
    lastAlchemyRender = now
    renderAlchemy()
  }
  // 设置面板开着时归因视图每秒跟拍（V3.5.4）
  if (dom.panelOverlay.classList.contains('show') && now - lastEconSync >= PANEL_MS) {
    lastEconSync = now
    syncEconUI()
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
    noteGain(state, 'offline', { qi: report.gainQi })   // V3.5.4 归因：离线折算单列，不稀释在线打坐占比
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
  // V4.7 主人：气泡＝完整渡劫面板（八关口 / 准备 / 战绩史册），弹出前先画全一遍
  renderTrial()
  dom.bubbleRate.textContent = `${(preview.probability * 100).toFixed(1)}%`
  renderBubblePrep(preview)   // 2.5：这一眼要看得见"自己备了什么"
  dom.bubble.classList.add('show')
  dom.btnTrial.classList.add('on')
  syncDragRegions()
}

function hideBubble () {
  dom.bubble.classList.remove('show')
  dom.btnTrial.classList.remove('on')
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
  const _ec = snapRes()   // V3.5.4 归因：突破段净额（成功灵石奖励 / 失败扣修为）记 breakthrough 线
  const result = cult.attemptBreakthrough(Date.now())
  noteRes('breakthrough', _ec, snapRes())

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
let restockFailLogged = false   // 丹房自动补炼"本串失败"是否已报过（V4.7 批 1；成功即重置）

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
// 双宿主（V4.7 主人 2026-09-19：面板恢复）：
//   · #trial-overlay（独立 .ov）＝面板本体：八关口全览 / 准备加成 / 静养疗伤 / 前去引雷 / 战绩史册；
//   · #trial-bubble（#mid 内、非 .ov）＝角色旁引雷轻提示：成率 / 已备 / 引雷 / 再等等 / 看八关口。
// 本区块只做「读系统 → 渲染 → 把点击交回系统」，不藏任何规则。

// V3.5.6 拆分：渡劫面板本体迁至 src/ui/TrialPanel.js；只留「薄委托」。

function openTrial () { if (trialPanel) trialPanel.open() }
function closeTrial () { if (trialPanel) trialPanel.close() }
function toggleTrial () { if (trialPanel) trialPanel.toggle() }
function renderTrial () { if (trialPanel) trialPanel.render() }
function renderBubblePrep (preview) { if (trialPanel) trialPanel.renderBubblePrep(preview) }

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
    bubble: hideBubble,        // V4.7：引雷气泡不是 .ov，但开面板时也该让位（同一件事不必两处占屏）

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
// V3.5.6 拆分：行囊 / 丹房面板本体迁至 src/ui/BagPanel.js / AlchemyPanel.js；只留「薄委托」。

function openBag () { if (bagPanel) bagPanel.open() }
function closeBag () { if (bagPanel) bagPanel.close() }
function toggleBag () { if (bagPanel) bagPanel.toggle() }
function renderBag () { if (bagPanel) bagPanel.render() }

function openAlchemy () { if (alchemyPanel) alchemyPanel.open() }
function closeAlchemy () { if (alchemyPanel) alchemyPanel.close() }
function toggleAlchemy () { if (alchemyPanel) alchemyPanel.toggle() }
function renderAlchemy () { if (alchemyPanel) alchemyPanel.render() }

let lastAlchemyRender = 0 // 丹房面板轻刷节拍（V3.5.2：时间驱动；拆分后声明回归装配层）

// ── 功法面板（2.1）：主修 / 辅修 · 装备 · 升级 ────────────────────────────

// ── 功法面板（2.1）：主修 / 辅修 · 装备 · 升级 ────────────────────────────

// V3.5.6 拆分：功法面板本体迁至 src/ui/TechPanel.js；只留「薄委托」。

function openTech () { if (techPanel) techPanel.open() }
function closeTech () { if (techPanel) techPanel.close() }
function toggleTech () { if (techPanel) techPanel.toggle() }
function renderTech () { if (techPanel) techPanel.render() }

let lastTechRender = 0   // 功法面板轻刷节拍（V3.5.2：时间驱动；拆分后声明回归装配层）

// ── 宗门面板（2.4）：V3.5.6 拆分——本体迁至 src/ui/SectPanel.js；只留「薄委托」。

function openSect () { if (sectPanel) sectPanel.open() }
function closeSect () { if (sectPanel) sectPanel.close() }
function toggleSect () { if (sectPanel) sectPanel.toggle() }
function renderSect () { if (sectPanel) sectPanel.render() }

let lastSectRender = 0   // 宗门面板轻刷节拍（V3.5.2：时间驱动；拆分后声明回归装配层）

// 剩余时长文案：一律走游戏历（主人 2026-09-17：界面时间用游戏时间，不用现实时分）
const fmtHoursLeft = (ms) => fmtGameDuration(ms)

// ══ 2.7 秘境 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）═════════
// 接线内容：秘境遮罩（#dungeon-overlay）· 试炼塔挑战 · 资源秘境首通/派遣 ·
//           分身召回 · 主循环到期结算（真实时间驱动，离线照算）· 周扫荡

// V3.5.5 拆分：面板本体迁至 src/ui/DungeonPanel.js，本区块只留「薄委托」；实例在 boot 创建。

let lastDungeonRender = 0 // 秘境面板轻刷节拍（V3.5.2：时间驱动，倒计时跟拍）

function openDungeon () { if (dungeonPanel) dungeonPanel.open() }
function closeDungeon () { if (dungeonPanel) dungeonPanel.close() }
function toggleDungeon () { if (dungeonPanel) dungeonPanel.toggle() }
function renderDungeon () { if (dungeonPanel) dungeonPanel.render() }

// ══ 2.8 灵兽 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）═══════
// 接线内容：灵兽遮罩（#beast-overlay）· 万兽林派遣 · 孵化（妖丹催孵）·
//           灵兽园喂养/出战 · 主循环被动产出随秒入账（离线不发）
// 渡劫助战 / 宗门战力加成不在此接：经 boot 注入由 CultivationSystem / SectSystem 自取。

// V3.5.5 拆分：面板本体迁至 src/ui/BeastPanel.js，本区块只留「薄委托」；实例在 boot 创建。
// 渡劫助战 / 宗门战力加成不在此接：经 boot 注入由 CultivationSystem / SectSystem 自取。

let lastBeastRender = 0 // 灵兽面板轻刷节拍（V3.5.2：时间驱动，倒计时跟拍）

function openBeast () { if (beastPanel) beastPanel.open() }
function closeBeast () { if (beastPanel) beastPanel.close() }
function toggleBeast () { if (beastPanel) beastPanel.toggle() }
function renderBeast () { if (beastPanel) beastPanel.render() }



// ══ 2.3 事件气运 装配区（V3.3.1：事件簿已并入「纪事与事件」一册）═════════════
// 宿主：原 #event-overlay 撤销，节点迁入 #chronicle-overlay 的「事件」页（#event-page）。
// 接线内容：自动策略切换 · 待抉择手选 · 在线滚动触发（主循环）· 离线批量结算 · 待抉择角标。
// 产出换算：events.tick/settleOffline 需要的"有效产出/灵石时薪"在此现算传入
//          （13.1②：System 间不横向 import，经装配层中转）。

let lastTrialRender = 0 // 渡劫面板轻刷节拍（V3.5.2：时间驱动）

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
  // V4.7 主人：三档各自能自动处置到哪个等级，直接写进悬停（与纪事消息同一套口径）
  for (const b of dom.stratPills) {
    b.classList.toggle('on', b.dataset.strategy === v.strategy)
    const autoLabel = STRATEGY_AUTO[b.dataset.strategy] && STRATEGY_AUTO[b.dataset.strategy].label
    const tag = (STRATEGY_PREF[b.dataset.strategy] || [])[0]
    if (autoLabel) {
      b.title = `${b.textContent}：自动处置「${autoLabel}」` +
        (tag ? ` · 偏好${OPT_TAG_NAME[tag] || tag}` : '') +
        `\n超出该范围的条目一律置顶，等你亲自决断`
    }
  }

  // 关键事件（V4.7 · 主人：不再固定"绝/仙"，而是**超出自动策略处置范围**的才在此等亲断）
  if (!v.pending.length) {
    dom.eventPending.innerHTML =
      `<div class="bag-empty">无事待断 · 当前「${v.strategyName}」自动处置 ${v.strategyAutoLabel}，` +
      `超出该范围的才会在此等你亲断</div>`
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
// V3.5.5 拆分：面板本体（开合 / 页签 / 渲染 / 动作委托 / 页签监听）迁至 src/ui/MarketPanel.js，
// 本区块只留「薄委托」（既有调用点全部不变）；面板实例在 boot 的 systems 就绪后创建。
// 口径不变：买/卖/拍只搬动「灵石」与「道具」，不产修为、不晋境界（§七 占比护栏）。

let lastMarketRender = 0 // 坊市面板轻刷节拍（V3.5.2：时间驱动；主循环用）

function openMarket () { if (marketPanel) marketPanel.open() }
function closeMarket () { if (marketPanel) marketPanel.close() }
function toggleMarket () { if (marketPanel) marketPanel.toggle() }
function renderMarket () { if (marketPanel) marketPanel.render() }

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
let lastLoopRender = 0  // V3.5.2 渲染节流：主循环上次 render 的时刻（事件触发的 render 不受此限）
let lastEconSync = 0    // V3.5.4 设置面板归因视图的轻刷节拍
let lastChrRender = 0    // 「事件与纪事」面板轻刷节拍（V3.5.2：时间驱动）
let lastAchvPaneRender = 0 // 「成就与称号」面板轻刷节拍（V3.5.2：时间驱动）
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
  if (dom.btnAchv) dom.btnAchv.classList.add('on')   // V4.7：快捷条「成就」键已撤，仅可能由外部注入
  syncDragRegions()
}

function closeAchv () {
  ovHide(dom.achvOverlay)
  if (dom.btnAchv) dom.btnAchv.classList.remove('on')
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
    // 招牌秘境（V5.1）：首通数 / 本源集齐 / 积分 / 当周限时 —— 由系统现算快照
    ...dungeon.signatureStats(now),
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
 * 「纪事」整页渲染（V4.7 主人 2026-09-18 重构：消息与事件**分区**、按等级划分、待决断置顶）
 *   版面自上而下：气运 / 策略行 → 频道筛选 → 关键事件（超出自动档的，须亲断）
 *   → 消息流（四频道，按等级着色，待你决断的置顶）→ 事件近事录（单列一区）
 *   成就与称号在独立遮罩（#achv-overlay，入口＝人物头顶称号牌，见 renderAchv）
 */
function renderChronicle () {
  if (!state || !achv) return
  for (const b of dom.chrFilterPills) b.classList.toggle('on', b.dataset.chrfilter === chrFilter)
  renderEvents()          // 关键事件（超出自动策略处置范围的，待亲断）
  renderChronicleList()   // 消息流 + 事件近事录（两区分离）
  if (dom.chrNote) {
    dom.chrNote.textContent =
      `一册纪事，分两区：上面是「消息」（你 / 本界 / 宗门 / 天下四频道，逐条标等级 凡/良/珍/绝/仙 并着色），` +
      `下面单列「事件近事录」（你自己遭遇过、已结算的事件）。时间按游戏历显示。` +
      `自动策略当前为「${events ? events.view().strategyName : ''}」，自动处置到 ${achv.strategyAutoLabel}：` +
      `范围内的消息与事件由系统按偏好替你选定并落档；超出范围的（含待你出手的互动）一律置顶，不决不走、角标常亮。` +
      `互动概率按频道：` + achv.interactChances.map((c) => `${c.name} ${Math.round(c.chance * 100)}%`).join(' ｜ ') +
      `（「你」频道是你自己的里程碑，无待抉择）。成就与称号在另一册（点人物头顶的称号牌进入）。`
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

/** 已结算事件 → 事件近事录一行（单列区：#evt-list；品质色标事件名） */
function buildEvtRow (b) {
  const item = document.createElement('div')
  item.className = 'chr-item chr-evt'
  const l1 = document.createElement('div')
  l1.className = 'chr-line1'
  const qName = QUALITY_NAME[b.q] || ''
  l1.textContent = `${fmtGameClock(b.at)} · 事件${qName ? ` · ${qName}级` : ''}${b.auto ? ' · 自动处置' : ''}`
  const tx = document.createElement('div')
  tx.className = 'chr-text'
  tx.textContent = `【${b.name}】${b.opt ? b.opt + '——' : ''}${b.text}`
  tx.style.color = QUALITY_COLOR[b.q] || (b.good ? 'var(--gold)' : 'var(--warn)')
  item.append(l1, tx)
  return item
}

/** 一条纪事消息 → 一行（等级着色 + 待决断角标 + 专属选项/已决结果） */
function buildChrRow (e) {
  const item = document.createElement('div')
  item.className = 'chr-item chr-' + e.ch + (e.interactive ? ' chr-act' : '') + (e.pending ? ' chr-pending' : '')

  const l1 = document.createElement('div')
  l1.className = 'chr-line1'
  // 时间戳＝游戏历（主人 2026-09-17：纪事时间也用游戏时间）；V4.7 起附等级
  l1.textContent = `${fmtGameClock(e.at)} · ${e.chName} · ${e.qName}级`
  l1.style.color = e.qColor || ''
  if (e.pending) {
    const tag = document.createElement('span')
    tag.className = 'chr-pendtag'
    tag.textContent = '待你决断'
    l1.appendChild(tag)
  }
  item.appendChild(l1)

  const tx = document.createElement('div')
  tx.className = 'chr-text'
  tx.textContent = e.text
  tx.style.color = QUALITY_COLOR[e.q] || ''
  item.appendChild(tx)

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
      done.className = 'chr-result' + (e.options.some((o) => o.id === e.resolved && !o.good) ? ' gap' : '')
      done.textContent = `（已决${e.auto ? ' · 自动策略代选' : ''}）${e.result || '此事已了。'}`
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
  return item
}

/**
 * 纪事流两区（V4.7 主人：**消息与事件分开**，不再混排）
 *   ① 消息流 #chr-list：四频道消息，按等级着色；**待决断的置顶**，其余按时间倒序；
 *   ② 事件近事录 #evt-list：已结算事件单列一区（自动策略处置过的也在此可回看）。
 */
function renderChronicleList () {
  const view = achv.chronicleView(chrFilter, 80)
  const pend = view.filter((e) => e.pending)
  const rest = view.filter((e) => !e.pending)
  const list = pend.concat(rest)      // 待你决断的放最上（主人 2026-09-18）
  if (!list.length) {
    dom.chrList.innerHTML = '<div class="bag-empty">此处尚无消息 —— 每过一阵，天下自会有新的传闻传来。</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of list) frag.appendChild(buildChrRow(e))
    dom.chrList.replaceChildren(frag)
  }
  // ② 事件近事录（单列；与消息不再同列）
  if (!dom.evtList) return
  const book = events ? events.view().book.slice(0, 15) : []
  if (!book.length) {
    dom.evtList.innerHTML = '<div class="bag-empty">尚无遭遇记录 —— 遇上事件后会在此留档（含自动策略替你结算的）。</div>'
    return
  }
  const f2 = document.createDocumentFragment()
  for (const b of book) f2.appendChild(buildEvtRow(b))
  dom.evtList.replaceChildren(f2)
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
// V4.7 主人：成就册入口只留「称号牌点按」（上面）+「成就达成提示点按」两处 ——
//   快捷条「成就」键与纪事册抬头「成就与称号 ›」已撤（旧 id 若被外部还原，仍可开）
if (dom.btnAchv) dom.btnAchv.addEventListener('click', toggleAchv)
if (dom.btnAchvClose) dom.btnAchvClose.addEventListener('click', closeAchv)

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

// V3.5.4 今日收益归因视图（设置面板；账本见 systems/EconLedger.js）
const ECON_LABELS = { cult: '打坐', offline: '离线', sect: '宗门', dungeon: '秘境', beast: '灵兽', event: '事件', breakthrough: '突破奖', other: '其他' }
function syncEconUI () {
  if (!state || !dom.vEcon) return
  const v = econToday()
  if (dom.vEconDay) dom.vEconDay.textContent = `${v.dayKey} · 已记 ${fmtRealSpan(v.spanMs)}`
  const name = (l) => ECON_LABELS[l] || l
  const list = (key, pctKey, unit) => v.rows
    .filter((r) => r[key])
    .map((r) => `${name(r.line)} ${r[key] > 0 ? '+' : '−'}${fmt(Math.abs(r[key]))}${unit}（${Math.round(r[pctKey] * 100)}%）`)
    .join(' ｜ ')
  const qiLine = list('qi', 'qiPct', '')
  const stoneLine = list('stones', 'stonesPct', '')
  dom.vEcon.innerHTML =
    `修为：${qiLine || '今日尚无入账'}<br />` +
    (stoneLine ? `灵石：${stoneLine}` : '') +
    (v.totals.qi < 0 ? '<br /><span style="color:var(--warn)">⚠ 修为净额为负（失败 / 代价超过产出，属异常信号）</span>' : '')
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
  if (dom.tgAutoHatch) setToggle(dom.tgAutoHatch, s.autoHatch !== false)
  setToggle(dom.tgAutoBrew, s.autoBrew !== false)
  dom.tgAvatar.textContent = s.avatar === 'female' ? '女修' : '男修'
  dom.tgAvatar.classList.toggle('on', s.avatar === 'female')
  applyWinStateToUI()
  syncAmbienceUI()   // 3.3 氛围：总档 / 天气 / 昼夜 / 负载档四行
  syncSkinUI()       // 3.4 皮肤：色板名与循环顺序
  syncMotionUI()     // 3.4 动效：总档与系统实测值
  syncOvAlphaUI()    // V4.7 浮层透明度：不透明 / 微透 / 半透 / 很透
  syncAudioUI()      // 3.5 音效：音量两行
  syncEconUI()       // V3.5.4 今日收益归因
  syncAutoLaunchUI() // P4.2 开机自启：浏览器模式置灰
  if (dom.vRuntime) {
    const dv = (desktop && desktop.versions) || {}
    dom.vRuntime.textContent = `v${APP_VERSION}` + (dv.electron ? ` · Electron ${dv.electron}` : ' · 浏览器模式')
  }

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

// ── 界面事件绑定 ──────────────────────────────────────────────────────────
dom.btn.addEventListener('click', onBreakthrough)
dom.btnStrike.addEventListener('click', doBreakthrough)
dom.btnWait.addEventListener('click', () => {
  hideBubble()
  pushLog('先稳一手：再等等。', 'info')
})
dom.returnCard.addEventListener('click', () => hideReturnCard())

// 坊市页签监听已随面板迁入 src/ui/MarketPanel.js（V3.5.5）
// 丹房：炼制 / 自动炼制（事件委托：面板每次重绘，避免丢监听）

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

// 自动孵化（V4.7 主人 2026-09-19，默认开）：有待孵的蛋、且孵化位有空即自动入孵，孵满自动破壳收兽
if (dom.tgAutoHatch) {
  dom.tgAutoHatch.addEventListener('click', () => {
    const next = state.settings.autoHatch === false
    state.settings.autoHatch = next
    setToggle(dom.tgAutoHatch, next)
    pushLog(next
      ? '已开启自动孵化：有空孵位就自动入孵、孵满自动破壳收兽（灵兽园满或孵位满时自动停下等你腾位）。'
      : '已关闭自动孵化：入孵与破壳都改由你手动点。', 'sys')
    persist('settings')
  })
}

// 丹房自动炼制（V4.7 主人 2026-09-18，默认开）：开启后每种丹常备 1 枚，用掉自动补
dom.tgAutoBrew.addEventListener('click', () => {
  const next = state.settings.autoBrew === false
  state.settings.autoBrew = next
  setToggle(dom.tgAutoBrew, next)
  pushLog(next
    ? '已开启丹房自动炼制：每种丹常备 1 枚，用掉就自动开炉补上（材料不足则等有料再补）。'
    : '已关闭丹房自动炼制：丹药不再自动补货，需要时去丹房手动开炉。', 'sys')
  persist('settings')
})

// ═══════════════════════════════════════════════════════════════════════════
// ══ 阶段四 · 桌面常驻优化 装配区（P4.2 自启与托盘增强 / P4.4 空闲降帧）══════
// ═══════════════════════════════════════════════════════════════════════════

// ── P4.2 开机自启：settings.autoLaunch 是唯一真源，主进程只负责落到系统登录项 ──
// 浏览器开发模式没有 desktop 桥，开关置灰（syncAutoLaunchUI 在 renderPanel 里跟拍）。
function syncAutoLaunchUI () {
  if (!dom.tgAutoLaunch) return
  const off = !(desktop && desktop.app && desktop.app.setAutoLaunch)
  dom.tgAutoLaunch.disabled = off
  if (off) dom.tgAutoLaunch.title = '浏览器开发模式不支持开机自启（桌面端才可用）'
}
dom.tgAutoLaunch.addEventListener('click', async () => {
  const next = state.settings.autoLaunch !== true
  state.settings.autoLaunch = next
  setToggle(dom.tgAutoLaunch, next)
  if (desktop && desktop.app && desktop.app.setAutoLaunch) {
    const res = await desktop.app.setAutoLaunch(next)
    if (res && res.ok) pushLog(next ? '已开启开机自启：随系统登录常驻托盘。' : '已关闭开机自启。', 'sys')
    else pushLog(`开机自启写入失败：${(res && res.error) || '未知错误'}`, 'fail')
  }
  persist('settings-autolaunch')
})

// ── P4.2 托盘 tooltip 增强：显示「境界 + 产出/秒」（每 2 秒跟拍一次，只改文字不改图标）──
const TRAY_STATUS_MS = 2000
let lastTrayStatus = 0
function trayStatusText () {
  if (!state || !cult) return ''
  const drawn = !!(roots && roots.drawn)
  const rate = drawn ? cult.getEffRate(Date.now()).eff : 0
  const info = getLevelInfo(state.player.realm.level)
  return `问长生 · ${info.displayName} · ${drawn ? '+' + fmtRate(rate) + '/秒' : '待测灵根'}（双击显示/隐藏）`
}
function updateTrayStatus (now = Date.now()) {
  if (now - lastTrayStatus < TRAY_STATUS_MS) return
  lastTrayStatus = now
  if (desktop && desktop.tray && desktop.tray.setStatus) desktop.tray.setStatus(trayStatusText())
}

// ── P4.4 空闲降帧：最后一次用户输入距今超过 IDLE_AFTER_MS 即进省电档 ──
// 主进程已关 backgroundThrottling（计时照跑、产出不变）；窗口藏进托盘时
// document.hidden 为真，DOM 刷新再降一档（对不可见窗口是纯浪费）。
let lastInputAt = Date.now()
let lastInputStamp = 0
function noteInput () {
  const now = Date.now()
  if (now - lastInputStamp < 1000) return   // pointermove 高频，1 秒记一次足够
  lastInputStamp = now
  lastInputAt = now
}
window.addEventListener('pointerdown', noteInput, { passive: true })
window.addEventListener('pointermove', noteInput, { passive: true })
window.addEventListener('keydown', noteInput, true)
window.addEventListener('wheel', noteInput, { passive: true })

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

// ── V4.7 浮层透明度（主人 2026-09-18）：.ov 底色与背景模糊按 --ov-alpha 取值 ────
// 动机：.ov 遮罩只盖住修行日志那一块（既定口径），于是丹方 / 宗门 / 纪事天然压在日志之上；
//       调低底色不透明度即可一边开炉一边看日志（模糊同步减弱，否则字仍被糊掉）。
// 边界：只写 <html> 上的一个运行期变量 + 一个偏好叶子（settings.ovAlpha）；档位表在 data/overlay.js。

/** 应用浮层透明度（运行期变量，不入存档语义） */
function applyOvAlpha ({ silent = false, persistIt = false } = {}) {
  if (!state) return 1
  const id = state.settings.ovAlpha
  const alpha = resolveOvAlpha(id)
  document.documentElement.style.setProperty('--ov-alpha', String(alpha))
  if (!silent) {
    pushLog(`浮层透明度：${ovAlphaName(id)}（${Math.round(alpha * 100)}%），丹方 / 宗门 / 纪事等面板的底色。`, 'sys')
  }
  if (persistIt) persist('settings')
  return alpha
}

/** 设置面板「浮层透明度」一行（点按循环四档） */
function syncOvAlphaUI () {
  if (!state || !dom.tgOvAlpha) return
  const id = state.settings.ovAlpha
  const alpha = resolveOvAlpha(id)
  dom.tgOvAlpha.textContent = ovAlphaName(id)
  dom.tgOvAlpha.classList.toggle('on', alpha < 1)
  dom.tgOvAlpha.title = `浮层（丹方 / 宗门 / 纪事…）底色不透明度：${ovAlphaName(id)}（${Math.round(alpha * 100)}%）\n`
    + `点按循环：${OVERLAY_ALPHA_LEVELS.map((l) => l.name).join(' → ')}\n`
    + '调低即可让底下的修行日志透出来（背景模糊同步减弱）。'
}

if (dom.tgOvAlpha) {
  dom.tgOvAlpha.addEventListener('click', () => {
    if (!state) return
    state.settings.ovAlpha = nextOvAlpha(state.settings.ovAlpha)
    applyOvAlpha({ persistIt: true })
    syncOvAlphaUI()
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
if (dom.btnTrialGo) dom.btnTrialGo.addEventListener('click', doBreakthrough)          // 面板内「前去引雷」
if (dom.btnTrialOpen) {
  // 气泡 → 面板：先把气泡收掉（同一件事不必两处同时占屏），再开面板
  dom.btnTrialOpen.addEventListener('click', () => { hideBubble(); openTrial() })
}

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
  else if (dom.trialOverlay.classList.contains('show')) closeTrial()   // V4.7：渡劫面板（遮罩）
  else if (dom.bubble.classList.contains('show')) hideBubble()          // 引雷气泡（非 .ov，另收）
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
  beasts.ensure()                   // V4.7：老档补字段（辅助位名单 assistUids / 星级 star / 成长计数 exp·gf）
  // 战力乘区闭包（功法 × 灵兽）：宗门战力校验与秘境战力门槛共用同一口径（2026-09-19）
  sect = new SectSystem(state, tech, powerMulClosure())
  events = new EventSystem(state)
  events.ensure()          // 老档补字段（eventState 结构 / 气运钳位 / 策略档校准）
  dungeon = new DungeonSystem(state, tech, powerMulClosure())
  dungeon.ensure()         // 老档补字段（秘境子树：cleared / stars / dispatch）
  // V3.3.1：秘境残卷 / 首通赠功法经注入的 TechniqueSystem.grant 落袋（见 DungeonSystem._grantTech）
  market = new MarketSystem(state)  // 2.6 坊市：懒建 state.market 子树，无需 ensure（首次打开即 ensureDaily）
  // V3.5.5 拆分：坊市面板（src/ui/MarketPanel.js）——依赖注入（state/system 取 getter 防捕获旧引用）
  marketPanel = createMarketPanel({
    state: () => state,
    system: () => market,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, emitFloat, fmtRefreshPeriod, onPress }
  })
  // V3.5.6 拆分：渡劫面板（src/ui/TrialPanel.js）
  trialPanel = createTrialPanel({
    state,
    // V4.7 批 0：系统一律以 getter 注入——本面板建在 cult 实例化之前（见下方 cult = new CultivationSystem），
    // 直传实例会被捕获成 null，面板静默全空（实测 bug：渡劫面板八关口/准备/说明三块永远空）
    cult: () => cult,
    alchemy: () => alchemy,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, fmt, fmtDuration, render: () => render(), onBreakthrough }
  })
  // V3.5.6 拆分：功法面板（src/ui/TechPanel.js）
  techPanel = createTechPanel({
    state,
    tech,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, fmt, fmtRefreshPeriod, fmtRealSpan, onPress, emit }
  })
  // V3.5.6 拆分：宗门面板（src/ui/SectPanel.js）
  sectPanel = createSectPanel({
    state,
    sect,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, emitBurst, emitFloat, fmt, fmtGameDuration, fmtRefreshPeriod, msToNextRefresh, fmtHoursLeft, fmtRealSpan, gameClockOf, fmtGameStamp }
  })
  // V3.5.6 拆分：行囊面板（src/ui/BagPanel.js）
  bagPanel = createBagPanel({
    state,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, render: () => render(), doReroll, rootBusy: () => rootBusy }
  })
  // V3.5.6 拆分：丹房面板（src/ui/AlchemyPanel.js）
  alchemyPanel = createAlchemyPanel({
    state,
    // V4.7 批 0：同上，getter 注入（本面板也建在 cult 实例化之前）
    alchemy: () => alchemy,
    cult: () => cult,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, emitFloat, fmt, fmtGameDuration, fmtRefreshPeriod, onPress, render: () => render(), renderBag: () => renderBag() }
  })
  // V3.5.5 拆分：灵兽面板（src/ui/BeastPanel.js）
  beastPanel = createBeastPanel({
    state: () => state,
    system: () => beasts,
    dom,
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, emitFloat, emitBurst, sfx, fmt, fmtGameDuration, fmtRefreshPeriod, msToNextRefresh, onPress }
  })
  // V3.5.5 拆分：秘境面板（src/ui/DungeonPanel.js）
  dungeonPanel = createDungeonPanel({
    state: () => state,
    system: () => dungeon,
    dom,
    // V5.1：面板里点出来的招牌秘境 / 积分商店收益，也要落进 §七 归因的 dungeon 线
    //   （主循环的段间快照只覆盖自动结算，点出来的这一份由面板回传）
    helpers: { closeTip, closeAllOverlays, ovShow, ovHide, syncDragRegions, pushLog, persist, emitFloat, emitBurst, sfx, fmt, fmtGameDuration, fmtRefreshPeriod, fmtHoursLeft, onPress, noteDungeon: (gain) => noteGain(state, 'dungeon', gain) }
  })
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
    noteGain(state, 'offline', { qi: bootReport.gainQi })   // V3.5.4 归因：开机补结算同入离线线
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

  // V4.7 浮层透明度落档生效（写 <html> 上的 --ov-alpha，index.html 的 .ov 按它取值）
  applyOvAlpha({ silent: true })

  // 3.5 音效落档生效：总开关 / 音量档 / 环境音。
  // ⚠ 此时还没有用户手势，AudioContext 尚未建（浏览器自动播放策略），
  //   真正出声要等主人第一次点按窗口（见 3.5 装配区的 document 级 pointerdown）。
  applyAudio({ silent: true })

  // P4.2 开机自启落档生效：以档内设置为准写一次系统登录项
  // （主人手工在系统里改过自启项时，启动会被纠回档口径；浏览器模式无桥跳过）
  if (desktop && desktop.app && desktop.app.setAutoLaunch) {
    desktop.app.setAutoLaunch(state.settings.autoLaunch === true).catch(() => {})
  }

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
    // V3.5.4 归因·打坐段：只圈 cult.tick 本身（自动突破的灵石/扣修为在 doBreakthrough 段记）
    const _qa = snapRes()
    const dt = offlineMode || !state.player.flags.rootDrawn ? 0 : cult.tick(Date.now())
    noteRes('cult', _qa, snapRes())
    if (dt > 0) tickLifespan(dt)
    // 自动突破（主人 2026-09-18，默认开）：修为够了自动冲关（含瓶颈）；渡劫不自动
    if (dt > 0 && state.settings.autoBreak !== false) autoBreakTick()
    // 宗门：俸禄随在线时间入账 + 任务板换轮 + **限时任务到点自动交差**（主人 2026-09-19）
    if (sect) {
      const _sa = snapRes()
      const st = sect.tick(Date.now(), dt)
      noteRes('sect', _sa, snapRes())
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
      // 自动接取（V4.7 主人 2026-09-18：任务板一刷新就自动接下；交差仍由上面「到点自动交差」负责）
      // 内部 1.5s 节流：只在真有活可接时才有动作与日志（一刷新报一条，不刷屏）
      if (state.settings.autoSect !== false) {
        const as = sect.autoStartTick(Date.now())
        if (as) {
          const inst = as.instant > 0 ? `，其中 ${as.instant} 件战力达标当场办妥（贡献 +${as.contrib}）` : ''
          pushLog(`【宗门·自动】接下 ${as.started} 件活儿${inst}。`, as.instant > 0 ? 'ok' : 'info')
          persist('sect-auto-accept')
        }
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
      const _va = snapRes()
      beasts.tick(Date.now(), dt)   // 灵兽（2.8）：出战被动产出随在线秒入账（离线不发）
      noteRes('beast', _va, snapRes())
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
    // 自动孵化（V4.7 主人 2026-09-19，默认开）：孵位有空即入孵、孵满自动破壳收兽
    //   —— 园满 / 孵位满 / 没蛋时不做事（不报错不刷屏），只在真正有动作时打日志
    if (beasts && state.settings.autoHatch !== false) {
      const acts = beasts.autoHatchTick(Date.now())
      for (const a of acts) {
        pushLog(a.message, a.ok ? 'ok' : 'info')
        if (a.ok && a.kind === 'hatch') emitFloat({ text: '破壳 · 灵兽入园', kind: 'ok' })
      }
      if (acts.some((a) => a.ok)) persist('beast-auto-hatch')
    }
    // 丹房自动补货（V4.7 主人 2026-09-18：丹房自动炼制改成开关）——开关开启时每种丹常备 1 枚，
    // 库存见底且材料够就自动开炉补上；限流在 AlchemySystem.restockTick 内（3s 一次、每拍 1 种、单次最多 3 炉）
    if (alchemy && state.settings.autoBrew !== false) {
      const rs = alchemy.restockTick(Date.now())
      if (rs && rs.attempts > 0) {
        // 未成丹会 3 秒一补 —— 只报「首次失败」防刷屏（成功了再重置，下次失败还会报）
        if (rs.success) {
          pushLog(rs.message, 'ok')
          // 多炉才铺开细节（单炉时汇总行已说清，不再重复一行）
          if (rs.details.length > 1) for (const d of rs.details) pushLog(d, 'info')
          restockFailLogged = false
          persist('alchemy-restock')
        } else if (!restockFailLogged) {
          pushLog(rs.message, 'fail')
          restockFailLogged = true
        }
      }
    }
    if (market) market.ensureDaily(Date.now())  // 坊市（2.6）：每日 5 点刷新货品/拍卖（同日幂等）
    // 秘境（2.7）：派遣到期结算（真实时间驱动，离线照算）+ 每周一自动扫荡
    if (dungeon) {
      const _da = snapRes()
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
      noteRes('dungeon', _da, snapRes())
    }
    // 事件（2.3）：在线滚动触发 + 恩怨挂账到期兑现（暂停/离线时不触发新事件，挂账照兑）
    if (events) {
      const _ea = snapRes()
      const evNow = Date.now()
      for (const r of events.tick(evNow, cult.getEffRate(evNow).eff, stoneHourly(state.player.realm.level), dt > 0)) {
        pushLog(r.message, r.good ? 'ok' : 'fail')
        // 2.10 计数：因果兑现 / 善恶事件（累计量，近事录会因容量滚动丢旧账，故另记一笔）
        if (achv) achv.note(r.kind === 'repay' ? 'repay' : (r.good ? 'eventGood' : 'eventBad'))
      }
      drainFitDelta()   // 2.11：事件果报（契合 ±N）在此入账顺天值
      noteRes('event', _ea, snapRes())
    }
    // 成就与纪事（2.10）：每秒一判；纪事按真实时间到点汇总一批（离线也照算）
    achvTick = (achvTick + 1) % 10
    if (achvTick === 0) runAchvCheck(Date.now())
    notifyMatDrops()
    // V3.5.2 渲染节流：结算每拍照跑，render 最低间隔 RENDER_MS（事件触发处仍即时）。
    // P4.4 性能与省电：间隔档随「可见性 / 空闲」变化——可见且活跃 → RENDER_MS（250ms），
    // 空闲 ≥ IDLE_AFTER_MS → RENDER_IDLE_MS（2s），藏进托盘 → RENDER_HIDDEN_MS（5s）。
    const loopNow = Date.now()
    if (loopNow - lastLoopRender >= pickRenderMs({
      visible: !document.hidden, idleMs: loopNow - lastInputAt,
      base: RENDER_MS, idle: RENDER_IDLE_MS, hidden: RENDER_HIDDEN_MS, idleAfterMs: IDLE_AFTER_MS
    })) { lastLoopRender = loopNow; render() }
    updateTrayStatus(loopNow)   // P4.2：托盘 tooltip「境界 + 产出/秒」2 秒一拍
    refreshAmbient()   // 3.5：环境音自愈（暂停挂机 / 灵根刚测完 / 窗口可见性变化都会被纠回）
  }, TICK_MS)

  // ⑥ 自动存档（30 秒）—— 关键节点（突破/洗髓/离线）另有即时存档
  setInterval(() => persist('auto'), AUTOSAVE_MS)

  render()
  updateTrayStatus()  // P4.2：托盘 tooltip 首拍（主循环里每 2 秒自愈跟拍）
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
  window.__wcs = { game, state, cult, roots, tech, alchemy, life, sect, beasts, world, events, dungeon, market, achv, save, audio: sfxEngine, bonus: { lines: bonusLines, recompose: bonusRecompose }, econ: { view: econToday, note: (line, gain) => noteGain(state, line, gain) } }
}

boot().catch((err) => {
  console.error('[启动失败]', err)
  const box = document.getElementById('log')
  if (box) box.textContent = '启动失败：' + (err && err.message)
})
