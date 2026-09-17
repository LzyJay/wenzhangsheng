/**
 * gametime.js —— 游戏历（时间换算与文案，只读配置 + 纯函数）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：主人 2026-09-19 口径 —— **现实 1 分钟 = 游戏 1 天**
 *   （即 1 现实小时 = 60 游戏天；1 游戏天 = 1 现实分钟；1 时辰 = 5 现实秒）。
 *
 * 用途：**只做界面文案 + 周期换算** —— 宗门任务板 / 秘境派遣 / 灵兽孵化 / 坊市刷新 /
 *   事件挂账与冷却 / 天机榜冷却 / 纪事与日志时间戳，一律以游戏历呈现。
 *   所有机制（计时、离线结算、每日刷新、周扫荡）仍按现实时间推进，
 *   本表只负责"现实毫秒 ↔ 游戏历"的翻译。
 *
 * 与寿元的关系（2026-09-19 统一）：寿元原先另有专属流速「1 现实秒 = 2 游戏天」，
 *   本次主人口径变更后**两套时钟并为一套** —— 寿元与游戏历同源
 *   （见 lifespan.gameDaysPerRealSecond = 1/60），这样"游戏历过了 100 年"恰好
 *   等于"寿元流逝 100 年"，不会再出现两个打架的时钟。
 *
 * 历法：道历元年 = 现实 2026-01-01（epochMs）；1 年 = 12 月 × 30 天；
 *   1 天 = 12 时辰（子丑寅…亥，与 achievements.shichenOf 同一套名）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const GAME_TIME = {
  /** 换算率：1 现实小时 = 60 游戏天（主人口径：现实 1 分钟 = 游戏 1 天） */
  daysPerRealHour: 60,
  /** 1 游戏天 = 12 时辰 */
  hoursPerDay: 12,
  daysPerMonth: 30,
  monthsPerYear: 12,
  daysPerYear: 360,
  /** 道历元年起点（现实时间） */
  epochMs: Date.UTC(2026, 0, 1, 0, 0, 0),
  shichen: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
}

const HOUR_MS = 3600 * 1000

/** 现实毫秒 → 游戏天数（可为小数；负值按 0 计） */
export function gameDaysForMs (ms) {
  const v = Number(ms)
  if (!Number.isFinite(v) || v <= 0) return 0
  return (v / HOUR_MS) * GAME_TIME.daysPerRealHour
}

/**
 * 游戏天数 → 现实毫秒（周期换算的统一入口）
 * ⚠ 取整到毫秒：1/60、2/12 这类分数除不尽，不取整会留下 ±1e-9 的尾巴，
 *   导致"到点判定"与"门槛比较"在边界上抖动（2026-09-19 自测抓到）。
 */
export function gameDaysToMs (days) {
  const v = Number(days)
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.round((v / GAME_TIME.daysPerRealHour) * HOUR_MS)
}

/** **游戏时辰** → 现实毫秒（宗门任务「巡山两个时辰」等限时活计用） */
export function gameHoursToMs (gameHours) {
  const v = Number(gameHours)
  if (!Number.isFinite(v) || v <= 0) return 0
  return gameDaysToMs(v / GAME_TIME.hoursPerDay)
}

/** 现实毫秒 → 游戏时辰数（展示用） */
export function gameHoursForMs (ms) {
  return gameDaysForMs(ms) * GAME_TIME.hoursPerDay
}

/** 现实毫秒 → 游戏年数 */
export function gameYearsForMs (ms) {
  return gameDaysForMs(ms) / GAME_TIME.daysPerYear
}

/**
 * 现实时长 → 游戏历文案（用于"还差多久""剩余多久"）
 *   不满 1 天 → 「N 时辰」；≤1 月 → 「N 天」；不满 1 年 → 「N 月」；再往上 → 「X.XX 年」
 *   例：现实 2 小时 = 120 游戏天 → 「4.0 月」
 */
export function fmtGameDuration (ms) {
  const days = gameDaysForMs(ms)
  if (days <= 0) return '即刻'
  if (days < 1) return `${Math.max(1, Math.round(days * GAME_TIME.hoursPerDay))} 时辰`
  if (days <= GAME_TIME.daysPerMonth) return `${Math.round(days)} 天`
  if (days < GAME_TIME.daysPerYear) return `${(days / GAME_TIME.daysPerMonth).toFixed(1)} 月`
  return `${(days / GAME_TIME.daysPerYear).toFixed(2)} 年`
}

/** 现实时间戳对应的游戏历（年月日 + 时辰） */
export function gameClockOf (ts) {
  const realMs = Math.max(0, Number(ts) - GAME_TIME.epochMs)
  const exactDays = (realMs / HOUR_MS) * GAME_TIME.daysPerRealHour
  const totalDays = Math.floor(exactDays)
  const year = Math.floor(totalDays / GAME_TIME.daysPerYear) + 1
  const rest = totalDays % GAME_TIME.daysPerYear
  const month = Math.floor(rest / GAME_TIME.daysPerMonth) + 1
  const day = (rest % GAME_TIME.daysPerMonth) + 1
  const frac = exactDays - totalDays
  const shichen = GAME_TIME.shichen[Math.min(GAME_TIME.hoursPerDay - 1, Math.max(0, Math.floor(frac * GAME_TIME.hoursPerDay)))]
  return { year, month, day, shichen }
}

/** 完整游戏历文案：`道历 11 年 3 月 12 日 · 午时` */
export function fmtGameClock (ts) {
  const c = gameClockOf(ts)
  return `道历 ${c.year} 年 ${c.month} 月 ${c.day} 日 · ${c.shichen}时`
}

/** 紧凑游戏历文案（日志/纪事行首用）：`3/12·午时` */
export function fmtGameStamp (ts) {
  const c = gameClockOf(ts)
  return `${c.month}/${c.day}·${c.shichen}时`
}

/** 游戏历文案（只到日）：`道历 11 年 3 月 12 日` */
export function fmtGameDate (ts) {
  const c = gameClockOf(ts)
  return `道历 ${c.year} 年 ${c.month} 月 ${c.day} 日`
}

// ═════════════════════════════════════════════════════════════════════════════
// 日程刷新周期（主人 2026-09-18 起：刷新一律按游戏历定"日"；
//   2026-09-19 换算率变更后，同一条"日"对应的现实时长同步缩短）
// ═════════════════════════════════════════════════════════════════════════════
// 坊市（含拍卖）/ 万兽林寻蛋共用下面的 REFRESH_DAYS = 30 游戏天（＝现实 30 分钟）；
// 宗门任务板另有自己的周期（7 游戏天＝现实 7 分钟，见 data/sect.js），走
// periodKeyOf / msToNextPeriod 这套通用函数，互不干扰。

/** 通用一轮「日」＝ 30 游戏天（坊市 / 寻蛋） */
export const REFRESH_DAYS = 30

/** 一轮"日"对应的现实毫秒（30 游戏天 ÷ 60 天/时 = 30 分钟） */
export function refreshMs () {
  return gameDaysToMs(REFRESH_DAYS)
}

/** 任意周期键：同一轮内幂等（传周期毫秒） */
export function periodKeyOf (ts, periodMs) {
  const p = Number(periodMs)
  if (!(p > 0)) return '0'
  return String(Math.floor((Number(ts) - GAME_TIME.epochMs) / p))
}

/** 距下一个周期边界还有多久（现实毫秒） */
export function msToNextPeriod (ts, periodMs) {
  const p = Number(periodMs)
  if (!(p > 0)) return 0
  const passed = ((Number(ts) - GAME_TIME.epochMs) % p + p) % p
  return p - passed
}

/** 周期键（宗门任务板 / 坊市 / 寻蛋的"每日"判定用；＝ 30 游戏天一轮） */
export function gameDayKey (ts) {
  return periodKeyOf(ts, refreshMs())
}

/** 刷新周期的文案（面板脚注统一口径）：`每 30 游戏天（约现实 30 分钟）` */
export function fmtRefreshPeriod (days = REFRESH_DAYS) {
  return `每 ${days} 游戏天（约现实 ${fmtRealMinutes(gameDaysToMs(days))}）`
}

/** 现实毫秒 → 紧凑时长文案（分钟/小时；周期脚注专用） */
export function fmtRealMinutes (ms) {
  const min = Math.max(0, Number(ms) || 0) / 60000
  if (min < 1) return `${Math.max(1, Math.round(min * 60))} 秒`
  if (min < 60) return `${Math.round(min)} 分钟`
  const h = min / 60
  return Number.isInteger(h) ? `${h} 小时` : `${h.toFixed(1)} 小时`
}

/** 距下一个刷新点还有多久（现实毫秒） */
export function msToNextRefresh (ts) {
  return msToNextPeriod(ts, refreshMs())
}

export default {
  GAME_TIME, gameDaysForMs, gameDaysToMs, gameHoursToMs, gameHoursForMs, gameYearsForMs, fmtGameDuration,
  gameClockOf, fmtGameClock, fmtGameStamp, fmtGameDate,
  REFRESH_DAYS, refreshMs, gameDayKey, fmtRefreshPeriod, msToNextRefresh, fmtRealMinutes,
  periodKeyOf, msToNextPeriod
}
