/**
 * roots.js —— 灵根表 + 洗髓保底参数（只读配置层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《挂机修仙游戏设定书》§6 资质与开局（灵根＝开局抽卡）、《数据模型》§四 roots.js
 *
 *   伪灵根（三、四属性） 60%   修炼 ×0.85   突破成本 ×1.15
 *   真灵根（双属性）     28%   修炼 ×1.15   突破成本 ×1.00
 *   变异灵根（雷/冰/风/暗）10%  修炼 ×1.50   突破成本 ×0.95   对应战斗词条加成
 *   天灵根（单属性）      2%   修炼 ×2.00   突破成本 ×0.80   结丹无瓶颈
 *   —— 主人 2026-09-18：把各档**修炼速度差距拉大**（天灵根 ≈ 伪灵根的 2.35 倍，
 *      旧口径仅 1.40 倍），好资质真的"快"，坏资质真的"艰"，洗髓才有意义。
 *
 * 洗髓：消耗"洗髓丹"重掷灵根；连续未出高资质时概率逐步上调（保底递增）。
 * 设计原文强调"免费可得、无任何付费捷径"——全案无商业化，洗髓丹只从游戏内产出。
 * MVP 口径（阶段二改为任务/事件产出，见 XISUI_DROP 注释）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 五行与变异属性 */
export const WUXING = ['jin', 'mu', 'shui', 'huo', 'tu']
export const MUTANT = ['lei', 'bing', 'feng', 'an']

export const ATTR_NAME = {
  jin: '金', mu: '木', shui: '水', huo: '火', tu: '土',
  lei: '雷', bing: '冰', feng: '风', an: '暗'
}

/** 变异灵根的战斗词条（设计库：雷劫 / 冰封 / 风遁 / 暗噬） */
export const MUTANT_TAG = {
  lei: '雷劫（渡劫单雷 +5%）',
  bing: '冰封（受击减速）',
  feng: '风遁（闪避提升）',
  an: '暗噬（掠夺收益提升）'
}

/** 灵根四档（weight = 基础权重，合计 100） */
export const ROOT_TIERS = [
  {
    rarity: 'false',
    name: '伪灵根',
    weight: 60,
    attrPool: 'wuxing',
    attrCount: [3, 4],
    mods: { rateMul: 0.85, costMul: 1.15 },
    trait: '杂而不纯，修行多艰',
    color: '#b9b3a8',
    desc: '三、四属性混杂，灵气驳杂，但有逆天改命之机。'
  },
  {
    rarity: 'true',
    name: '真灵根',
    weight: 28,
    attrPool: 'wuxing',
    attrCount: [2, 2],
    mods: { rateMul: 1.15, costMul: 1.00 },
    trait: '双属相济，根基扎实',
    color: '#7fd6a8',
    desc: '双属性交济，吞吐灵气顺遂，突破略省。'
  },
  {
    rarity: 'mutant',
    name: '变异灵根',
    weight: 10,
    attrPool: 'mutant',
    attrCount: [1, 1],
    mods: { rateMul: 1.50, costMul: 0.95 },
    trait: '异种灵气，天生战体',
    color: '#b98cff',
    desc: '雷/冰/风/暗单属性，天地异种，战力超群。'
  },
  {
    rarity: 'heaven',
    name: '天灵根',
    weight: 2,
    attrPool: 'wuxing',
    attrCount: [1, 1],
    mods: { rateMul: 2.00, costMul: 0.80 },
    trait: '结丹无瓶颈',
    color: '#ffd98a',
    desc: '单属性天纵之资，万年不见其一，结丹一路坦途。'
  }
]

/**
 * 隐藏灵根 · 混沌灵根（V3.5.1 · 主人 2026-09-19 彩蛋级口径）
 *   · **不入洗髓池**：四档基础权重 60/28/10/2 一个数不动；
 *   · 唯一获得途径＝硬保底就绪（累计 15 次未出变异及以上）后的那次必出掷里，
 *     再叠一层 HIDDEN_CHANCE 小概率彩蛋（见下）；
 *   · 平时在灵根浮层里以「？？？」词条展示（名字都遮着），抽中才揭晓。
 */
export const HIDDEN_ROOT = {
  rarity: 'hidden',
  name: '混沌灵根',
  weight: 0,
  attrPool: 'hidden',
  attrCount: [0, 0],
  mods: { rateMul: 2.50, costMul: 0.70 },
  trait: '万法归一，无中生有',
  color: '#8ef0d4',
  desc: '混沌未分，五行不拘。传说中开天辟地前的灵体资质——万中无一，史书只当它是妄言。'
}

/** 彩蛋概率：硬保底就绪后的那次掷里，抽中混沌灵根的机会（独立于四档权重之外） */
export const HIDDEN_CHANCE = 0.03

/**
 * 洗髓保底递增参数
 * step：每重掷一次各档权重的漂移量（伪灵根被压、高资质被抬）
 * maxSteps：漂移封顶次数（之后权重不再变）
 * hardGuaranteeAt：累计这么多次仍未出"变异及以上"→ 下次必出变异或天灵根
 */
export const REROLL_PITY = {
  step: { false: -7, true: 3, mutant: 2.5, heaven: 1.5 },
  maxSteps: 10,
  minWeight: { false: 5 },
  hardGuaranteeAt: 15
}

/**
 * 洗髓丹产出（MVP 口径）
 * 设计库中洗髓丹来源为"任务 / 事件"（阶段二实装）；
 * 阶段一先以「开局赠 5 枚 + 每成功渡过一次天劫 +1」顶替，保证开局体验可玩。
 */
export const XISUI_DROP = {
  itemId: 'pill_xisui',
  initial: 5,
  perTrial: 1
}

/** 测灵根演出节奏（毫秒）——由场景读取，避免把节奏写死在场景里 */
export const DRAW_ANIMATION = {
  spinMs: 1700,
  revealMs: 900
}

/** 按 rarity 取档位定义（含隐藏灵根；未登记返回 null） */
export function getRootTier (rarity) {
  if (rarity === HIDDEN_ROOT.rarity) return HIDDEN_ROOT
  return ROOT_TIERS.find((t) => t.rarity === rarity) || null
}

/** 属性数组 → 中文标签（如 ['lei'] → '雷'；['shui','mu'] → '水木'） */
export function attrsLabel (attrs) {
  if (!Array.isArray(attrs) || !attrs.length) return ''
  return attrs.map((a) => ATTR_NAME[a] || a).join('')
}

export default { ROOT_TIERS, HIDDEN_ROOT, HIDDEN_CHANCE, REROLL_PITY, XISUI_DROP, DRAW_ANIMATION, ATTR_NAME, MUTANT_TAG, getRootTier, attrsLabel }
