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
 * 世界专属灵根（V6.2 · 主人 2026-09-21：「开局灵根池根据世界不同也需要扩充一下」）
 * ═══════════════════════════════════════════════════════════════════════════
 * 口径（四条硬规矩）：
 *   ① **不动四档**——`ROOT_TIERS` 的权重（60/28/10/2）与全部既有断言逐位不变；本表是**按界追加**：
 *      抽灵根时把「当前世界」的条目并入池（`RootSystem.tiers`）；**未抽定世界 / 未登记界 → 只走四档**；
 *   ② `rarity` 用独立键 `wr_<worldId>`：存档里 `root.rarity` / `root.id` 是唯一键，**必须全局可回查**
 *      —— 故 `getRootTier()` 会遍历本表，**换界后旧灵根仍查得到**（否则乘区会被打成 ×1）；
 *   ③ `base` ＝ 该条归属的四档档位（'false'｜'true'｜'mutant'｜'heaven'）：硬保底只出 mutant/heaven、
 *      洗髓权重漂移、低值连续清零、「结丹无瓶颈」一律按 `base` 判定（见 RootSystem）；
 *   ④ `weight` 为**在本界池内的基础权重**（与四档并列后归一化，四档原权重一个数不动）。
 * 定位：各界的「本命灵根」——比同档全局条略强（体现该界特色），故按界限量出现（≈10%）。
 * 命名：对外原创名，只保留与原著的气质对应（IP 口径见剧情册 §1.5）。
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const WORLD_ROOTS = {
  qinglan: [{
    rarity: 'wr_qinglan', base: 'true', world: 'qinglan', name: '凡骨灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.20, costMul: 0.98 },
    trait: '凡骨不折，步步为营', color: '#9fb4a8',
    desc: '不显山不露水的筋骨，看着平平无奇，却最耐得住长路。'
  }],
  poxiao: [{
    rarity: 'wr_poxiao', base: 'mutant', world: 'poxiao', name: '逆鳞灵根', weight: 10,
    attrPool: 'mutant', attrCount: [1, 1], mods: { rateMul: 1.55, costMul: 0.94 },
    trait: '逆天而行，一线生机', color: '#c86a6a',
    desc: '生来带着一片逆鳞：天要压它，它偏要往上长一寸。'
  }],
  denghuo: [{
    rarity: 'wr_denghuo', base: 'true', world: 'denghuo', name: '守拙灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.22, costMul: 0.95 },
    trait: '藏锋守拙，后发先至', color: '#ffb37a',
    desc: '看着最不起眼的那种资质——好处是，没人会先来算计你。'
  }],
  qingyun: [{
    rarity: 'wr_qingyun', base: 'mutant', world: 'qingyun', name: '剑骨灵根', weight: 10,
    attrPool: 'mutant', attrCount: [1, 1], mods: { rateMul: 1.60, costMul: 0.93 },
    trait: '剑意入骨，一往无前', color: '#a8d8e8',
    desc: '骨相生得利，天生该握剑，一出手便没有回头的余地。'
  }],
  wangzu: [{
    rarity: 'wr_wangzu', base: 'true', world: 'wangzu', name: '族脉灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.20, costMul: 0.96 },
    trait: '血脉相承，根深叶茂', color: '#b8a878',
    desc: '一族血脉里熬出来的资质，越往后越见厚重。'
  }],
  younuo: [{
    rarity: 'wr_younuo', base: 'mutant', world: 'younuo', name: '诡相灵根', weight: 10,
    attrPool: 'mutant', attrCount: [1, 1], mods: { rateMul: 1.70, costMul: 1.00 },
    trait: '真幻难辨，代价自承', color: '#9a7ad0',
    desc: '看得见两重天地，代价是永远分不清哪一重才算数。'
  }],
  tongtian: [{
    rarity: 'wr_tongtian', base: 'true', world: 'tongtian', name: '续命灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.16, costMul: 0.90 },
    trait: '命长即道，稳守天年', color: '#a8e0a0',
    desc: '不求快，只求久；别人争朝夕，它争的是百年之后还站着。'
  }],
  tiangong: [{
    rarity: 'wr_tiangong', base: 'true', world: 'tiangong', name: '工巧灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.22, costMul: 0.92 },
    trait: '巧思及物，器随心动', color: '#d8c090',
    desc: '手上的活比嘴上的理更灵，器物到了手里都格外顺手。'
  }],
  liumian: [{
    rarity: 'wr_liumian', base: 'mutant', world: 'liumian', name: '谬诞灵根', weight: 10,
    attrPool: 'mutant', attrCount: [1, 1], mods: { rateMul: 1.52, costMul: 0.90 },
    trait: '世事荒诞，偏得其利', color: '#e0a0d0',
    desc: '越是荒唐的地方它越来劲——反正规矩在这儿本来也不太作数。'
  }],
  jiuding: [{
    rarity: 'wr_jiuding', base: 'heaven', world: 'jiuding', name: '鼎镇灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [1, 1], mods: { rateMul: 2.10, costMul: 0.78 },
    trait: '九鼎压身，气运自定', color: '#ffd98a',
    desc: '重器压在身上，反倒把一身资质压得结结实实。'
  }],
  wuyuan: [{
    rarity: 'wr_wuyuan', base: 'heaven', world: 'wuyuan', name: '无缺灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [1, 1], mods: { rateMul: 2.05, costMul: 0.80 },
    trait: '有缺皆补，终归无缺', color: '#e8986a',
    desc: '天生留着一处缺，偏偏就是要一寸一寸把它补圆。'
  }],
  xianghuo: [{
    rarity: 'wr_xianghuo', base: 'true', world: 'xianghuo', name: '香火灵根', weight: 10,
    attrPool: 'wuxing', attrCount: [2, 2], mods: { rateMul: 1.18, costMul: 0.95 },
    trait: '香火相续，愿力自生', color: '#f0c8a0',
    desc: '有人念着，它就有力气；香火越久，根越稳。'
  }]
}

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

/**
 * 按 rarity 取档位定义（四档 / 隐藏 / **世界专属**；未登记返回 null）。
 * V6.2：世界专属条**扫全表**——换界后旧灵根仍能回查（存档里 rarity 是唯一键，
 *   查不到会让 RootSystem.mods 回落 ×1，等于抹掉玩家已抽到的资质）。
 */
export function getRootTier (rarity) {
  if (rarity === HIDDEN_ROOT.rarity) return HIDDEN_ROOT
  const hit = ROOT_TIERS.find((t) => t.rarity === rarity)
  if (hit) return hit
  for (const list of Object.values(WORLD_ROOTS)) {
    const w = list.find((t) => t.rarity === rarity)
    if (w) return w
  }
  return null
}

/**
 * V6.11：灵根档的**基准档**（归档到 伪/真/变异/天/混沌 五档）。
 *   四档与混沌本身即基准；**世界专属灵根按其 `base` 归档** —— 顶级灵根专属功法的硬门槛判定要用它。
 * @returns {string|null} 'false' | 'true' | 'mutant' | 'heaven' | 'hidden' | null
 */
export function rootBaseOf (rarity) {
  if (!rarity || typeof rarity !== 'string') return null
  if (rarity === 'false' || rarity === 'true' || rarity === 'mutant' ||
      rarity === 'heaven' || rarity === HIDDEN_ROOT.rarity) return rarity
  const t = getRootTier(rarity)
  return (t && t.base) || null
}

/** 属性数组 → 中文标签（如 ['lei'] → '雷'；['shui','mu'] → '水木'） */
export function attrsLabel (attrs) {
  if (!Array.isArray(attrs) || !attrs.length) return ''
  return attrs.map((a) => ATTR_NAME[a] || a).join('')
}

export default { ROOT_TIERS, WORLD_ROOTS, HIDDEN_ROOT, HIDDEN_CHANCE, REROLL_PITY, XISUI_DROP, DRAW_ANIMATION, ATTR_NAME, MUTANT_TAG, getRootTier, attrsLabel }
