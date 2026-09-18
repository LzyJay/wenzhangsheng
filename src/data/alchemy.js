/**
 * alchemy.js —— 丹方表 + 炼丹材料掉落（只读配置层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《修仙世界设定总纲》§4.3（丹方分品 / 成丹率概念）+《数据模型》§五 关键物品表
 *       + 开发计划 模块 2.2（材料 → 丹药「简化配方」——设计库未给具体丹方数值，
 *       本表为计划授权的首版简化口径，标 ⚖ 的数字可调，不动结构）。
 *
 * 丹方四则：
 *   · inputs   材料需求（id 对齐 items.js；数量 ×n）
 *   · rate     成丹率（总纲 §4.3「成丹率」概念的 MVP 落地：凡 95% / 良 90% / 珍 80%）
 *   · 失败不白烧：返还一半材料（向下取整）——避免 MVP 阶段挫败感过强（⚖ 可改为全损）
 *   · 丹药用途对齐设定书 §5：破境（×3/×6 重必需）/ 洗髓（重掷灵根）/ 护劫（渡劫 +10%）/ 延寿（+50 年）
 *
 * 材料来源（MVP）：挂机打坐时偶得（天地灵气凝出草木矿晶），离线不掉落；
 *   2.4 宗门 / 2.7 秘境实装正经产线后复核本表（⚖ 掉落率可调）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 丹方表（id 前缀 recipe_，对应产出 pill_*） */
export const RECIPES = [
  {
    id: 'recipe_pojing', pillId: 'pill_pojing', name: '破境丹', quality: 'liang',
    rate: 0.90,
    inputs: [
      { id: 'mat_lingcao', n: 3 },
      { id: 'mat_kuang', n: 1 }
    ],
    desc: '冲关破境之物：×3 / ×6 重小瓶颈冲关时消耗。'
  },
  {
    id: 'recipe_xisui', pillId: 'pill_xisui', name: '洗髓丹', quality: 'fan',
    rate: 0.95,
    inputs: [
      { id: 'mat_lingcao', n: 2 }
    ],
    desc: '重铸灵根之丹：服下重掷灵根（保底递增）。'
  },
  {
    id: 'recipe_hujie', pillId: 'pill_hujie', name: '护劫丹', quality: 'zhen',
    rate: 0.80,
    inputs: [
      { id: 'mat_lingcao', n: 2 },
      { id: 'mat_kuang', n: 1 },
      { id: 'mat_yaodan', n: 1 }
    ],
    desc: '渡劫护身：单道天雷通过率 +10%（2.5 渡劫完整版接入）。'
  },
  {
    id: 'recipe_yanshou', pillId: 'pill_yanshou', name: '延寿丹', quality: 'zhen',
    rate: 0.80,
    inputs: [
      { id: 'mat_lingcao', n: 4 },
      { id: 'mat_yaodan', n: 1 }
    ],
    desc: '续命之物：服下 +50 年（2.11 寿元线实装服丹入口）。'
  },
  {
    // V3.5.1 追加（主人：丹药资料库丰富）：清灵草线的新丹方，良品成丹率
    id: 'recipe_ningshen', pillId: 'pill_ningshen', name: '凝神丹', quality: 'liang',
    rate: 0.90,
    inputs: [
      { id: 'mat_qinglingcao', n: 2 },
      { id: 'mat_lingcao', n: 1 }
    ],
    desc: '凝神静气：服下后现实 10 分钟修为产出 +15%（不叠加，只刷新时长）。'
  },
  {
    // V3.5.9 原著第三批（主人批准）：九曲灵参接丹方——护劫丹升档，绝品成丹率 0.70
    // 渡劫面板 prepare('hujie') 时囊中有九转护劫丹则优先服高档（+15%），同槽位不破 prepCap 护栏
    id: 'recipe_hujie2', pillId: 'pill_hujie2', name: '九转护劫丹', quality: 'jue',
    rate: 0.70,
    inputs: [
      { id: 'mat_jiuqu', n: 1 },
      { id: 'mat_lingcao', n: 2 },
      { id: 'mat_yaodan', n: 1 }
    ],
    desc: '护劫丹升档：渡劫服下单雷 +15%（囊中有它则优先于普通护劫丹服用，同一格准备位）。'
  }
]

export const RECIPE_MAP = RECIPES.reduce((acc, r) => {
  acc[r.id] = r
  return acc
}, {})

/** 品阶 → 成丹率（总纲「丹方分品」的 MVP 换算） */
export const QUALITY_RATE = { fan: 0.95, liang: 0.90, zhen: 0.80, jue: 0.70, xian: 0.60 }

/** 品阶名（对齐数据模型通用枚举）—— 唯一词表已迁 src/util/quality.js（全站统一短名「凡 / 良 / 珍 / 绝 / 仙」，
 *  原「凡品」式全名词表删除，避免同一套 5 档出现两种档名；成丹率 QUALITY_RATE 仍属本域平衡数值，留在此处）。 */

/** 挂机材料掉落（每秒概率；离线不掉落；⚖ 数值可调） */
export const MAT_DROPS = {
  mat_lingcao: { perSec: 0.009 },   // 灵草：期望 ≈ 1 份 / 1.9 分钟
  mat_kuang: { perSec: 0.0035 },    // 玄铁矿：期望 ≈ 1 份 / 4.8 分钟
  mat_yaodan: { perSec: 0.0012 }    // 妖丹：期望 ≈ 1 枚 / 13.9 分钟
}

/** 取丹方；未登记返回 null */
export function getRecipe (id) {
  return RECIPE_MAP[id] || null
}

/** 炼一炉的期望耗时参考（分钟）——用于平衡核对与面板提示 */
export function expectedMinutes (r) {
  let slowest = 0
  for (const i of r.inputs) {
    const drop = MAT_DROPS[i.id]
    if (!drop) continue
    slowest = Math.max(slowest, (i.n / drop.perSec) / 60)
  }
  return Math.round(slowest * 10) / 10
}

export default { RECIPES, RECIPE_MAP, QUALITY_RATE, MAT_DROPS, getRecipe, expectedMinutes }
