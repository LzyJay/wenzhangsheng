/**
 * forge.js —— 炼器配方表（V7.3 · 主人 2026-09-22 定案「材料有用途」）
 * ═══════════════════════════════════════════════════════════════════════════
 * 口径（与 alchemy.js 的 RECIPES 同构，便于共用配方视图范式）：
 *   · 结构逐字对齐：`{ id, treasureId, name, quality, rate, inputs:[{id,n}], desc }`
 *     （炼丹用 `pillId`，炼器用 `treasureId`，其余字段同名同义 → 面板可复用同一套渲染）
 *   · **产出＝法宝**（`type: 'treasure'`）：与「丹药 : 丹房」对应，法宝的产线是炼器坊。
 *   · 成器率按品质档（`FORGE_QUALITY_RATE`）：越珍贵越难成，失败**返还一半材料**（与炼炉同口径）。
 *   · 材料全部取**已在库**的条目（基础 23 条 ＋ V7.1 公用库新增），**不新增任何物品**。
 *   · ⚠ 诚实口径：本批炼出的法宝是**藏品**（入囊计数 + 图鉴），除既有 `treasure_zhenlei`
 *     （渡劫单雷 +8%，V6 已接线）与 `treasure_jiejing`（界镜，世界重掷）之外，
 *     **其余法宝暂无战斗/收益效果** —— 效果接线属后续批次，此处不虚标。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 五档成器率（品质越高越难成；凡档近乎必成，绝仙档要攒料） */
export const FORGE_QUALITY_RATE = { fan: 0.95, liang: 0.90, zhen: 0.80, jue: 0.70, xian: 0.60 }

/** 炼器炉的「一炉」上限：同一次开炉只出一件（与丹房一炉一枚同口径） */
export const FORGE_PER_RUN = 1

export const FORGE_RECIPES = [
  {
    id: 'forge_yinsuo',
    treasureId: 'treasure_yinsuo',
    name: '白银梭',
    quality: 'fan',
    rate: FORGE_QUALITY_RATE.fan,
    inputs: [{ id: 'mat_kuang', n: 2 }],
    desc: '最简单的器：两块玄铁炼成一只梭子，出手快，也最不挑料。'
  },
  {
    id: 'forge_xingshenyu',
    treasureId: 'treasure_xingshenyu',
    name: '醒神玉',
    quality: 'fan',
    rate: FORGE_QUALITY_RATE.fan,
    inputs: [{ id: 'mat_lingcao', n: 3 }, { id: 'mat_xuanshen', n: 1 }],
    desc: '灵草汁液淬过的玉，佩之静心 —— 玄参是这一炉的药引。'
  },
  {
    id: 'forge_xuantiejian',
    treasureId: 'treasure_xuantiejian',
    name: '玄铁剑',
    quality: 'liang',
    rate: FORGE_QUALITY_RATE.liang,
    inputs: [{ id: 'mat_kuang', n: 4 }, { id: 'mat_chiyang', n: 1 }],
    desc: '四块玄铁反复折叠，赤阳草引火 —— 剑成之日，炉边三尺皆红。'
  },
  {
    id: 'forge_zhenhunling',
    treasureId: 'treasure_zhenhunling',
    name: '镇魂铃',
    quality: 'liang',
    rate: FORGE_QUALITY_RATE.liang,
    inputs: [{ id: 'mat_yaodan', n: 2 }, { id: 'mat_kuzhu', n: 2 }],
    desc: '以妖丹为心、苦竹根作铃舌 —— 铃响一声，邪祟退散。'
  },
  {
    id: 'forge_zhenlei',
    treasureId: 'treasure_zhenlei',
    name: '镇雷法宝',
    quality: 'zhen',
    rate: FORGE_QUALITY_RATE.zhen,
    inputs: [{ id: 'mat_leicui', n: 3 }, { id: 'mat_kuang', n: 2 }],
    desc: '雷淬石入炉，取其雷性封进玄铁 —— 持有即生效：渡劫单雷通过率 +8%（V6 已接线）。'
  },
  {
    id: 'forge_qingyuhulu',
    treasureId: 'treasure_qingyuhulu',
    name: '青玉葫芦',
    quality: 'zhen',
    rate: FORGE_QUALITY_RATE.zhen,
    inputs: [{ id: 'mat_qinglingcao', n: 2 }, { id: 'mat_zifu', n: 1 }],
    desc: '清灵草与紫府藤同炼 —— 葫芦嘴一封，灵气跑不出去。'
  },
  {
    id: 'forge_jiejing',
    treasureId: 'treasure_jiejing',
    name: '界镜',
    quality: 'zhen',
    rate: FORGE_QUALITY_RATE.jue,
    inputs: [{ id: 'mat_leicui', n: 5 }, { id: 'mat_xuesui', n: 1 }],
    desc: '五份雷淬石熔作镜胚，一滴血玉髓点睛 —— 镜成可照当界，换个活法（成器率按绝档）。'
  }
]

/** 取配方；未登记返回 null */
export function getForgeRecipe (id) {
  return FORGE_RECIPES.find((r) => r.id === id) || null
}

/** 按产出的法宝反查配方（自动炼制 / 面板标注用）；无配方返回 null */
export function recipeOfTreasure (treasureId) {
  return FORGE_RECIPES.find((r) => r.treasureId === treasureId) || null
}

export default { FORGE_RECIPES, FORGE_QUALITY_RATE, FORGE_PER_RUN, getForgeRecipe, recipeOfTreasure }
