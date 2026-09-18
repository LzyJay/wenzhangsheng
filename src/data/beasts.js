/**
 * beasts.js —— 灵兽表（只读配置层）（2.8）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《灵兽兽潮与大比 v1》§1.1~§1.4 +《问长生-开发计划》§四 模块 2.8
 * 范围（首发 MVP）：万兽林寻蛋 + 孵化 + 出战 1 只；被动产出 + 战力加成 + 渡劫助战。
 *       血脉觉醒 / 化形 / 灵兽园扩容 / 待命 50% 被动 / 代采 / 兽潮线 ＝ 内容批次 2/3，不进本表。
 *
 * 口径：
 *   · 品级（血脉）四档：凡/灵/王/皇 —— 产出系数 ×1.0/×1.2/×1.5/×2.0（设计库 §1.1）
 *   · 万兽林派遣：金丹期解锁（设计库 §1.1「金丹可寻蛋」），每日 1 次、1 小时，
 *     产灵兽蛋一枚（品级 70/22/7/1，设计库 §1.2）
 *   · 孵化：蛋 → 灵兽，4~12h 按品级递增（设计库 §1.2）；妖丹可加速 −1h/枚；
 *     V4.7 主人：孵化位 1 → **2**（金丹解锁第 2 位，原「多蛋排队」口径作废）
 *   · 出战节奏：设计库原文「元婴正式出战」，本 MVP 采开发计划验收口径
 *     「孵出灵兽并生效加成」——金丹寻蛋、孵出即可出战 1 只；
 *     V4.7 主人：出战拆为**主战 1 只 + 辅助（元婴 1 / 合体 2）**，辅助产出与战力按 50% 计
 *   · 喂养：妖丹 → 等级（1~9 级），每级 +10% 全属性；小概率悟性爆发跳级（设计库 §1.3）
 *   · 出战·产出：0.2h/日 × 品级系数 × 等级系数 × 星级系数，上限 0.6h/只 × 星级系数（设计库 §1.4）
 *   · 出战·战力：+4%/只（皇品 +8%）+ 每星 +0.5 个百分点（设计库 §1.4）
 *   · 渡劫助战：+7%（主战）/ 辅助各 +3.5%，上限 +14%（单雷通过率，设计库 §1.4；realms.TRIAL_PREPS 已登记）
 *   · 升星 / 分解（杀鸡取卵）：V4.7 主人 2026-09-18 新增，参数见下方 STAR / DECOMPOSE
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

/** 万兽林派遣（设计库 §1.2 获取渠道一；兽潮掉蛋＝内容批次 2 不进本表） */
export const WANSHOU = {
  unlockRealmIndex: 2,                              // 金丹期可寻蛋（§1.1 节奏）
  hours: 1,                                         // 每次派遣 1 小时
  perDay: 1,                                        // 每轮 1 次（一轮 = 30 游戏天 ≈ 现实 2 小时）
  eggWeights: { fan: 0.70, ling: 0.22, wang: 0.07, huang: 0.01 }   // 品级 70/22/7/1
}

/** 孵化与加速（设计库 §1.2「4~12h，可加速」；加速介质用妖丹，与喂养同源） */
export const HATCH = {
  slots: 1,                                         // 基础 1 个孵化位
  slot2FromRealmIndex: 2,                           // V4.7 主人：金丹（index 2）解锁**第 2 个**孵化位
  speed: { itemId: 'mat_yaodan', hoursPer: 1 }      // 1 枚妖丹 −1 小时
}

/**
 * 升星（V4.7 主人 2026-09-18：「相同灵兽可以用于升星」）
 *   口径：同品级 + 同种类的两只灵兽合二为一（消耗 1 只）→ 星级 +1；上限 5 星。
 *   每星：被动产出 +10%（**该兽的产出上限同步抬高**，否则强兽撞 0.6 上限后星级无感）、战力 +0.5 个百分点。
 *   星级只放大该兽自身，不改品级 / 等级的既有系数（1 星＝与旧档逐位相同）。
 */
export const STAR = {
  maxStar: 5,
  costPets: 1,              // 每升一星消耗同品级同种灵兽 1 只（2 合 1）
  outputPctPerStar: 0.10,   // 每星被动产出 +10%
  powerPctPerStar: 0.005    // 每星战力 +0.5 个百分点
}

/**
 * 分解（杀鸡取卵，V4.7 主人 2026-09-18：「不要的灵兽可以杀鸡取卵」）
 *   口径：随行中（主战 / 辅助）不可分解 —— 先撤下来再动手。
 *   返还：妖丹按品级 凡1/灵1/王2/皇3；灵石按品级基准 × 等级系数（投入过喂养的能多回一点）。
 */
export const DECOMPOSE = {
  yaodan: { fan: 1, ling: 1, wang: 2, huang: 3 },
  stones: { fan: 200, ling: 400, wang: 800, huang: 1600 }
}

/**
 * 主战 + 辅助（V4.7 主人 2026-09-18：「出战灵兽设置主战和辅助灵兽」）
 *   · 主战 1 只：全额产出 / 战力 / 渡劫助战；
 *   · 辅助位随境界解锁：元婴（index 3）1 位、合体（index 6）2 位，产出与战力按 `mul` 计；
 *   · 渡劫助战：主战 0.07 + 辅助各 0.035，合计仍受 TRIAL_BEAST.cap = 0.14 封顶。
 */
export const ASSIST = {
  mul: 0.5,
  slotsByRealm: [
    { from: 3, slots: 1 },   // 元婴：第 1 个辅助位
    { from: 6, slots: 2 }    // 合体：第 2 个辅助位
  ]
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

/** 出战产出与栏位（设计库 §1.4；待命 50% 被动＝内容批次 2） */
export const OUTPUT = { baseHours: 0.2, capHours: 0.6 }
export const PARK_CAP = 6                           // 灵兽园 6 格（出战 1 + 待命 5）

/** 渡劫助战（设计库 §1.4：+7%/只，上限 +14%＝元婴起 2 只的内容批次 2 口径） */
export const TRIAL_BEAST = { pctPer: 0.07, cap: 0.14 }

/** 种类池（roll 品级后在同档种类里随机；id 带 beast_ 域前缀）
 *  V3.5.8 原著第二批扩容（出处：《设计库/07-原著/提炼-数据库素材/04-灵兽妖兽》）：
 *    黑魔鼠←《没钱修什么仙？》｜血玉蜘蛛/火蟾兽/冰凤←《凡人修仙传》｜
 *    炎雷兽←《没钱修什么仙？》｜幽冥兽←《仙逆》｜地火炎龙←《没钱修什么仙？》
 *  数值零改动——种类只定「名字与风味」，产出/战力/渡劫仍由品级 GRADES 决定。
 */
export const SPECIES = [
  { id: 'beast_qingyuque',  grade: 'fan',   name: '青羽雀', desc: '山门外最常见的灵雀，胜在亲近人。' },
  { id: 'beast_huiyanshu',  grade: 'fan',   name: '灰岩鼠', desc: '打洞一绝，偶尔能叼回点零碎矿渣。' },
  { id: 'beast_heimoshu',   grade: 'fan',   name: '黑魔鼠', desc: '通体墨黑、昼伏夜出，远祖据说沾过一丝魔血，惯会刨藏灵物的地窖。' },
  { id: 'beast_chiyanhu',   grade: 'ling',  name: '赤焰狐', desc: '尾尖一点火苗，入夜便烧得通红。' },
  { id: 'beast_bishuijiao', grade: 'ling',  name: '碧水蛟', desc: '水缸里孵出的蛟苗，怕是要占一方灵潭。' },
  { id: 'beast_xueyuzhizhu', grade: 'ling', name: '血玉蜘蛛', desc: '甲壳莹白如玉、纹路似血丝，结出的网能凝灵气成露。' },
  { id: 'beast_huoshanshou', grade: 'ling', name: '火蟾兽', desc: '肚皮一鼓便喷火星，蹲在丹炉边最是暖脚。' },
  { id: 'beast_shuangyuelang', grade: 'wang', name: '霜月狼', desc: '对月长嗥时，霜华随声而落。' },
  { id: 'beast_leilinmang', grade: 'wang',  name: '雷鳞蟒', desc: '鳞缝里游走细雷，蜕下的皮是炼器好料。' },
  { id: 'beast_bingfeng',   grade: 'wang',  name: '冰凤', desc: '尾羽垂着冰绡，长鸣一声，满园落霜。' },
  { id: 'beast_yanleishou', grade: 'wang',  name: '炎雷兽', desc: '奔跑时蹄下生雷、鬃毛带火，渡劫时随行最是提气。' },
  { id: 'beast_youmingshou', grade: 'wang', name: '幽冥兽', desc: '影子里养出来的凶物，白日慵懒，入夜护主极凶。' },
  { id: 'beast_moyukilin',  grade: 'huang', name: '墨玉麒麟', desc: '通体如墨玉，踏云无痕。灵兽园有它坐镇，妖邪辟易。' },
  { id: 'beast_jinchidapeng', grade: 'huang', name: '金翅大鹏', desc: '双翅一振便是三千里云路。' },
  { id: 'beast_dihuoyanlong', grade: 'huang', name: '地火炎龙', desc: '自地火肺脉里孵出的真龙苗，一声龙吟，地火倒卷。' }
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

export default { GRADES, WANSHOU, HATCH, STAR, DECOMPOSE, ASSIST, FEED, GROWTH, OUTPUT, PARK_CAP, TRIAL_BEAST, SPECIES, dayKey, getGrade, getSpecies, rollGrade, speciesOfGrade }
