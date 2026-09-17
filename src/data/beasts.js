/**
 * beasts.js —— 灵兽表（只读配置层）（2.8）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《灵兽兽潮与大比 v1》§1.1~§1.4 +《问长生-开发计划 V2》§四 模块 2.8
 * 范围（首发 MVP）：万兽林寻蛋 + 孵化 + 出战 1 只；被动产出 + 战力加成 + 渡劫助战。
 *       血脉觉醒 / 化形 / 灵兽园扩容 / 待命 50% 被动 / 代采 / 兽潮线 ＝ 版本 2/3，不进本表。
 *
 * 口径：
 *   · 品级（血脉）四档：凡/灵/王/皇 —— 产出系数 ×1.0/×1.2/×1.5/×2.0（设计库 §1.1）
 *   · 万兽林派遣：金丹期解锁（设计库 §1.1「金丹可寻蛋」），每日 1 次、1 小时，
 *     产灵兽蛋一枚（品级 70/22/7/1，设计库 §1.2）
 *   · 孵化：蛋 → 灵兽，4~12h 按品级递增（设计库 §1.2）；妖丹可加速 −1h/枚
 *   · 出战节奏：设计库原文「元婴正式出战」，本 MVP 采开发计划验收口径
 *     「孵出灵兽并生效加成」——金丹寻蛋、孵出即可出战 1 只；元婴起 2 只留版本 2
 *   · 喂养：妖丹 → 等级（1~9 级），每级 +10% 全属性；小概率悟性爆发跳级（设计库 §1.3）
 *   · 出战·产出：0.2h/日 × 品级系数 × 等级系数，上限 0.6h/只（设计库 §1.4）
 *   · 出战·战力：+4%/只（皇品 +8%）（设计库 §1.4）
 *   · 渡劫助战：+7%/只，上限 +14%（单雷通过率，设计库 §1.4；realms.TRIAL_PREPS 已登记）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { gameDayKey } from './gametime.js'

/** 品级（血脉）四档：产出系数 / 战力加成 / 孵化时长（设计库 §1.1、§1.2、§1.4） */
export const GRADES = [
  { id: 'fan',   name: '凡品', coef: 1.0, powerPct: 0.04, hatchHours: 4,  color: '#b9b3a8' },
  { id: 'ling',  name: '灵品', coef: 1.2, powerPct: 0.04, hatchHours: 6,  color: '#e8b96a' },
  { id: 'wang',  name: '王品', coef: 1.5, powerPct: 0.04, hatchHours: 8,  color: '#b98cff' },
  { id: 'huang', name: '皇品', coef: 2.0, powerPct: 0.08, hatchHours: 12, color: '#9fd6ff' }
]

/** 万兽林派遣（设计库 §1.2 获取渠道一；兽潮掉蛋＝版本 2 不进本表） */
export const WANSHOU = {
  unlockRealmIndex: 2,                              // 金丹期可寻蛋（§1.1 节奏）
  hours: 1,                                         // 每次派遣 1 小时
  perDay: 1,                                        // 每轮 1 次（一轮 = 30 游戏天 ≈ 现实 2 小时）
  eggWeights: { fan: 0.70, ling: 0.22, wang: 0.07, huang: 0.01 }   // 品级 70/22/7/1
}

/** 孵化与加速（设计库 §1.2「4~12h，可加速」；加速介质用妖丹，与喂养同源） */
export const HATCH = {
  slots: 1,                                         // 孵化位 1 个（多蛋排队，版本 2 扩容）
  speed: { itemId: 'mat_yaodan', hoursPer: 1 }      // 1 枚妖丹 −1 小时
}

/** 喂养（设计库 §1.3：妖丹 → 等级 1~9，每级 +10% 全属性，小概率悟性爆发跳级） */
export const FEED = {
  itemId: 'mat_yaodan',
  maxLevel: 9,
  levelPct: 0.10,                                   // 每级 +10%（产出/战力的等级系数）
  epiphany: 0.08                                    // 悟性爆发：8% 概率本次连升 2 级
}

/**
 * 自动成长（V3.5.1 · 主人：出战久了也会自动成长，在灵兽园里会缓慢成长）
 *   · 出战：每 `activeSecPerPoint` 现实秒攒 1 点成长（600 秒＝10 分钟）；
 *   · 园中待命：每 `parkSecPerPoint` 现实秒 1 点（1800 秒＝30 分钟，出战的三倍慢）；
 *   · 每攒满 `expPerLevel` 点自行 +1 级（与喂养共享 9 级封顶与 +10%/级 系数）；
 *   · 只按**在线秒**累积（离线不发，同被动产出口径）——喂养妖丹仍是"快的那条路"。
 */
export const GROWTH = { activeSecPerPoint: 600, parkSecPerPoint: 1800, expPerLevel: 12 }

/** 出战产出与栏位（设计库 §1.4；待命 50% 被动＝版本 2） */
export const OUTPUT = { baseHours: 0.2, capHours: 0.6 }
export const PARK_CAP = 6                           // 灵兽园 6 格（出战 1 + 待命 5）

/** 渡劫助战（设计库 §1.4：+7%/只，上限 +14%＝元婴起 2 只的版本 2 口径） */
export const TRIAL_BEAST = { pctPer: 0.07, cap: 0.14 }

/** 种类池（roll 品级后在同档种类里随机；id 带 beast_ 域前缀） */
export const SPECIES = [
  { id: 'beast_qingyuque',  grade: 'fan',   name: '青羽雀', desc: '山门外最常见的灵雀，胜在亲近人。' },
  { id: 'beast_huiyanshu',  grade: 'fan',   name: '灰岩鼠', desc: '打洞一绝，偶尔能叼回点零碎矿渣。' },
  { id: 'beast_chiyanhu',   grade: 'ling',  name: '赤焰狐', desc: '尾尖一点火苗，入夜便烧得通红。' },
  { id: 'beast_bishuijiao', grade: 'ling',  name: '碧水蛟', desc: '水缸里孵出的蛟苗，怕是要占一方灵潭。' },
  { id: 'beast_shuangyuelang', grade: 'wang', name: '霜月狼', desc: '对月长嗥时，霜华随声而落。' },
  { id: 'beast_leilinmang', grade: 'wang',  name: '雷鳞蟒', desc: '鳞缝里游走细雷，蜕下的皮是炼器好料。' },
  { id: 'beast_moyukilin',  grade: 'huang', name: '墨玉麒麟', desc: '通体如墨玉，踏云无痕。灵兽园有它坐镇，妖邪辟易。' },
  { id: 'beast_jinchidapeng', grade: 'huang', name: '金翅大鹏', desc: '双翅一振便是三千里云路。' }
]

/**
 * 「每日」周期键（主人 2026-09-18 口径变更）：＝ **30 游戏天**（≈现实 2 小时），
 * 与宗门任务板 / 坊市同口径；改周期只改 gametime.REFRESH_DAYS。
 */
export function dayKey (ts) {
  return gameDayKey(ts)
}

/** 取品级定义；未登记 id 回退凡品（老档不至于崩） */
export function getGrade (id) {
  return GRADES.find((g) => g.id === id) || GRADES[0]
}

/** 取种类定义；未登记 id 返回 null（孵化记录损坏时按匿名灵兽处理） */
export function getSpecies (id) {
  return SPECIES.find((x) => x.id === id) || null
}

/** 按权重 roll 品级（eggWeights 顺序即 GRADES 顺序） */
export function rollGrade (r = Math.random()) {
  let acc = 0
  for (const g of GRADES) {
    acc += WANSHOU.eggWeights[g.id]
    if (r < acc) return g.id
  }
  return GRADES[GRADES.length - 1].id
}

/** 品级池内的种类 id 列表 */
export function speciesOfGrade (gradeId) {
  return SPECIES.filter((x) => x.grade === gradeId)
}

export default { GRADES, WANSHOU, HATCH, FEED, GROWTH, OUTPUT, PARK_CAP, TRIAL_BEAST, SPECIES, dayKey, getGrade, getSpecies, rollGrade, speciesOfGrade }
