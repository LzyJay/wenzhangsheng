/**
 * techniqueLibrary.js —— 分界功法库（只读配置层）（V6.11 · 功法库改造 · 批 1 建骨架）
 * ═══════════════════════════════════════════════════════════════════════════
 * 本文件是「多世界功法体系」的**新增量**：
 *   · `tech_world_*` 各界专属库 —— **每界 12 本**（九卷各 1 ＋ 顶级灵根专属 3），12 界合计 **144 本**
 *   · `tech_c*`     公用库增量 —— 按 8 大境界分层 ＋ 顶级灵根专属，补足到**公用库总计 132 本**（含旧表 22 本）
 * 旧表 22 本仍留在 `techniques.js`（id 与数值一字不改），本文件只做**纯数据增量**。
 *
 * 口径（主人 2026-09-21 拍板）：
 *   · **每界实际可用 ＝ 公用 132 ＋ 本界专属 12 ＝ 144 本**（自测显式断言这条）
 *   · 各界专属功法名**直接从原著提取**（原著功法名优先，其次原著意象词）
 *   · 境界门槛**只卡「学」**（`unlockRealm`），装备一律不校验；`rootReq` 为顶级灵根硬门槛
 *   · **数值不越阶**：新条目一律取该阶既有区间内的档位（RATE/COMBAT 见下），
 *     绝不抬高任何一阶的 max/min → 既有档位断言（V2.1 / V3.3.2）与 ×10 总预算稳过。
 *
 * 字段（与旧表同构，仅多三个）：
 *   `worldId`（'common' | 12 界 id）｜`unlockRealm`（0~7 ＝ REALM_META 下标，仅习得门槛）｜
 *   `rootReq`（可选 `{ rarities: [...] }`，顶级灵根硬门槛；`wr_*` 世界专属灵根按其 `base` 归档）
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 每阶数值档位 —— **一律取该阶既有区间的最低档**（对齐 `techniques.js` 旧表）：
 *   凡 0.05 / 0.004｜黄 0.095 / 0.008｜玄 0.16 / 0.014｜地 0.24 / 0.024｜天 0.38 / 0.036
 * 顶级灵根专属本取该阶**上限档**（见 TIER_RATE_TOP），用于「身份感」而非越权。
 */
export const TIER_RATE = { fan: 0.05, huang: 0.095, xuan: 0.16, di: 0.24, tian: 0.38 }
export const TIER_COMBAT = { fan: 0.004, huang: 0.008, xuan: 0.014, di: 0.024, tian: 0.036 }
/** 上限档（＝旧表同阶最高值；顶级专属本专用，仍不越旧表边界） */
export const TIER_RATE_TOP = { fan: 0.06, huang: 0.12, xuan: 0.18, di: 0.26, tian: 0.44 }
export const TIER_COMBAT_TOP = { fan: 0.006, huang: 0.011, xuan: 0.020, di: 0.030, tian: 0.045 }

/** 每阶成本四元组（取旧表同阶中位，growth/stoneGrowth 各阶统一） */
export const TIER_COST = {
  fan: { qiBase: 60, stoneBase: 5, growth: 1.45, stoneGrowth: 1.25 },
  huang: { qiBase: 280, stoneBase: 11, growth: 1.55, stoneGrowth: 1.28 },
  xuan: { qiBase: 1800, stoneBase: 34, growth: 1.65, stoneGrowth: 1.30 },
  di: { qiBase: 10500, stoneBase: 82, growth: 1.75, stoneGrowth: 1.32 },
  tian: { qiBase: 85000, stoneBase: 210, growth: 1.85, stoneGrowth: 1.34 }
}

/** 8 大境界（REALM_META 下标）→ 主阶；与 realms.js 的 8 境一一对应 */
export const REALM_TIER = ['fan', 'huang', 'xuan', 'xuan', 'di', 'di', 'tian', 'tian']

/** 顶级灵根档（硬门槛用）：变异 / 天 / 混沌彩蛋 */
export const TOP_RARITIES = ['mutant', 'heaven', 'hidden']
export const ROOT_REQ_TOP = { rarities: TOP_RARITIES.slice() }

/** 12 界 id（顺序＝worlds.js 卡池顺序，供分界铺量与图鉴分组） */
export const LIB_WORLD_IDS = [
  'qinglan', 'poxiao', 'denghuo', 'qingyun', 'wangzu', 'younuo',
  'tongtian', 'tiangong', 'liumian', 'jiuding', 'wuyuan', 'xianghuo'
]

/**
 * 功法条目工厂（紧凑写法用；**只做字段拼装，不做任何数值计算**）
 * @param {string} id      全表唯一 id
 * @param {string} name    功法名（各界专属：直接从原著提取）
 * @param {string} tier    五阶之一
 * @param {number} grade   1~9
 * @param {number} realm   unlockRealm（0~7；仅习得门槛）
 * @param {string[]} tags  五行/流派标签
 * @param {{type:string,label:string}} source 来源
 * @param {string} desc    描述
 * @param {{worldId?:string, rootReq?:object|null, top?:boolean}} [opt] top=true 取该阶上限档（顶级专属本）
 */
export function mkTech (id, name, tier, grade, realm, tags, source, desc, opt = {}) {
  const top = !!opt.top
  return {
    id,
    name,
    tier,
    grade,
    maxLevel: 9,
    rateAddPctPerLevel: (top ? TIER_RATE_TOP : TIER_RATE)[tier],
    combatAddPctPerLevel: (top ? TIER_COMBAT_TOP : TIER_COMBAT)[tier],
    cost: TIER_COST[tier],
    tags,
    worldId: opt.worldId || 'common',
    unlockRealm: realm,
    rootReq: opt.rootReq || null,
    source,
    desc
  }
}

// ── 各界短工厂（把 worldId 固定进闭包，避免 144 条逐条重复写 worldId）────────
const worldMaker = (wid) => (id, name, tier, grade, realm, tags, source, desc, opt = {}) =>
  mkTech(id, name, tier, grade, realm, tags, source, desc, { ...opt, worldId: wid })
const ql = worldMaker('qinglan')
const px = worldMaker('poxiao')
const dh = worldMaker('denghuo')
const qy = worldMaker('qingyun')
const wz = worldMaker('wangzu')
const yn = worldMaker('younuo')
const tt = worldMaker('tongtian')
const tg = worldMaker('tiangong')
const lm = worldMaker('liumian')
const jd = worldMaker('jiuding')
const wy = worldMaker('wuyuan')
const xh = worldMaker('xianghuo')

/** 分界功法库（批 2 铺公用库增量、批 3 铺 12 界专属库；本批先留空表保证链路可回归） */
export const LIBRARY_TECHS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 一、公用库增量 110 本（＝ 8 大境界 × 13 本 ＋ 顶级灵根专属 6 本）
  //     与旧表 22 本合计＝公用库 132 本；**命名走通用修仙意象**（不绑原著，专属库才从原著提取）
  //     每境 13 本构成：主修五行 5 ＋ 辅修流派 3 ＋ 变异属性 3 ＋ 通用 2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 境 0 · 炼气（凡阶）─────────────────────────────────────────────────
  mkTech('tech_c0_jin', '引气金章', 'fan', 1, 0, ['jin'], { type: 'library', label: '分界藏经 · 炼气卷' }, '以金行肃气入体，气机初凝而锋。金灵根者起手最顺。'),
  mkTech('tech_c0_mu', '引气木章', 'fan', 2, 0, ['mu'], { type: 'library', label: '分界藏经 · 炼气卷' }, '木行生机最柔，引气不伤经脉。木灵根者久坐不倦。'),
  mkTech('tech_c0_shui', '引气水章', 'fan', 3, 0, ['shui'], { type: 'library', label: '分界藏经 · 炼气卷' }, '水行润下，气随水行而绵长。水灵根者入门最稳。'),
  mkTech('tech_c0_huo', '引气火章', 'fan', 4, 0, ['huo'], { type: 'library', label: '分界藏经 · 炼气卷' }, '火行炽烈，引气快而躁。火灵根者进境最速，亦需克己。'),
  mkTech('tech_c0_tu', '引气土章', 'fan', 5, 0, ['tu'], { type: 'library', label: '分界藏经 · 炼气卷' }, '土行厚重，气沉丹田不易散。土灵根者根基最固。'),
  mkTech('tech_c0_body', '血气导引篇', 'fan', 6, 0, ['body'], { type: 'library', label: '分界藏经 · 炼气卷' }, '以血气导引灵气，先壮其身再修其气（炼体辅修）。'),
  mkTech('tech_c0_sword', '初握剑诀', 'fan', 6, 0, ['sword'], { type: 'library', label: '分界藏经 · 炼气卷' }, '一柄木剑、一式起手，剑修的第一次握剑（剑道辅修）。'),
  mkTech('tech_c0_alchemy', '采药小录', 'fan', 7, 0, ['alchemy'], { type: 'library', label: '分界藏经 · 炼气卷' }, '认药、采药、晾药——丹修的第一步不在炉边（丹道辅修）。'),
  mkTech('tech_c0_lei', '引雷小术', 'fan', 8, 0, ['lei'], { type: 'library', label: '分界藏经 · 炼气卷' }, '雷属变异灵根专修的小术，引一线天雷入体淬气。', { top: false }),
  mkTech('tech_c0_bing', '凝露引', 'fan', 8, 0, ['bing'], { type: 'library', label: '分界藏经 · 炼气卷' }, '冰属变异灵根入门：以晨露凝气，寒意自生。'),
  mkTech('tech_c0_feng', '听风口诀', 'fan', 9, 0, ['feng'], { type: 'library', label: '分界藏经 · 炼气卷' }, '风属变异灵根入门：闻风而知气向，行气如风穿林。'),
  mkTech('tech_c0_wx1', '导引归元诀', 'fan', 3, 0, ['wuxing'], { type: 'library', label: '分界藏经 · 炼气卷' }, '不挑灵根的导引法，气行十二周天而自归丹田。'),
  mkTech('tech_c0_wx2', '静坐养气法', 'fan', 5, 0, ['wuxing'], { type: 'library', label: '分界藏经 · 炼气卷' }, '不求快、只求稳：坐得住的人，路才走得长。'),

  // ── 境 1 · 筑基（黄阶）─────────────────────────────────────────────────
  mkTech('tech_c1_jin', '金液筑基诀', 'huang', 1, 1, ['jin'], { type: 'library', label: '分界藏经 · 筑基卷' }, '以金液固基，道基如铁。金灵根者筑基最坚。'),
  mkTech('tech_c1_mu', '木灵固元篇', 'huang', 2, 1, ['mu'], { type: 'library', label: '分界藏经 · 筑基卷' }, '木行生生不息，故筑基可续可长。'),
  mkTech('tech_c1_shui', '水润筑基经', 'huang', 3, 1, ['shui'], { type: 'library', label: '分界藏经 · 筑基卷' }, '以水润基，经脉不燥。水灵根者筑基如春溪过石。'),
  mkTech('tech_c1_huo', '火炼道基法', 'huang', 4, 1, ['huo'], { type: 'library', label: '分界藏经 · 筑基卷' }, '以火炼基，去芜存菁。火灵根者一步一焰。'),
  mkTech('tech_c1_tu', '土载筑基章', 'huang', 5, 1, ['tu'], { type: 'library', label: '分界藏经 · 筑基卷' }, '厚土载物，故筑基最稳。土灵根者不惧反复。'),
  mkTech('tech_c1_body', '铁骨筑基功', 'huang', 6, 1, ['body'], { type: 'library', label: '分界藏经 · 筑基卷' }, '先练皮肉筋骨，再论道基深浅（炼体辅修）。'),
  mkTech('tech_c1_sword', '剑基淬锋录', 'huang', 6, 1, ['sword'], { type: 'library', label: '分界藏经 · 筑基卷' }, '以剑气淬道基，基成则剑成（剑道辅修）。'),
  mkTech('tech_c1_alchemy', '丹基百草篇', 'huang', 7, 1, ['alchemy'], { type: 'library', label: '分界藏经 · 筑基卷' }, '以百草识性养基，药香即道基之味（丹道辅修）。'),
  mkTech('tech_c1_lei', '雷淬道基诀', 'huang', 8, 1, ['lei'], { type: 'library', label: '分界藏经 · 筑基卷' }, '雷属变异灵根筑基：借雷淬基，一次比一次硬。'),
  mkTech('tech_c1_bing', '冰心筑基章', 'huang', 8, 1, ['bing'], { type: 'library', label: '分界藏经 · 筑基卷' }, '冰属变异灵根筑基：心静则基凝。'),
  mkTech('tech_c1_feng', '御风筑基篇', 'huang', 9, 1, ['feng'], { type: 'library', label: '分界藏经 · 筑基卷' }, '风属变异灵根筑基：气行无碍，基随气升。'),
  mkTech('tech_c1_wx1', '固本培元经', 'huang', 3, 1, ['wuxing'], { type: 'library', label: '分界藏经 · 筑基卷' }, '不挑灵根的固本之法，反复夯实而不求速成。'),
  mkTech('tech_c1_wx2', '筑基真解', 'huang', 5, 1, ['wuxing'], { type: 'library', label: '分界藏经 · 筑基卷' }, '前人筑基手记辑成，处处是弯路，也处处是捷径。'),

  // ── 境 2 · 金丹（玄阶）─────────────────────────────────────────────────
  mkTech('tech_c2_jin', '庚金结丹篇', 'xuan', 1, 2, ['jin'], { type: 'library', label: '分界藏经 · 金丹卷' }, '金行结丹，丹成而锐。金灵根者丹气最利。'),
  mkTech('tech_c2_mu', '青木凝丹诀', 'xuan', 2, 2, ['mu'], { type: 'library', label: '分界藏经 · 金丹卷' }, '木行凝丹，丹中自含生机。'),
  mkTech('tech_c2_shui', '玄水结丹经', 'xuan', 3, 2, ['shui'], { type: 'library', label: '分界藏经 · 金丹卷' }, '水行结丹，丹如明珠含露。'),
  mkTech('tech_c2_huo', '离火结丹章', 'xuan', 4, 2, ['huo'], { type: 'library', label: '分界藏经 · 金丹卷' }, '火行结丹，丹火自燃不熄。'),
  mkTech('tech_c2_tu', '厚土凝丹法', 'xuan', 5, 2, ['tu'], { type: 'library', label: '分界藏经 · 金丹卷' }, '土行凝丹，丹沉如岳，稳不可撼。'),
  mkTech('tech_c2_body', '金刚丹体篇', 'xuan', 6, 2, ['body'], { type: 'library', label: '分界藏经 · 金丹卷' }, '丹与体同炼，丹成则体如金石（炼体辅修）。'),
  mkTech('tech_c2_sword', '丹剑同炉诀', 'xuan', 6, 2, ['sword'], { type: 'library', label: '分界藏经 · 金丹卷' }, '丹在炉中，剑在手中，两者同成一炉（剑道辅修）。'),
  mkTech('tech_c2_alchemy', '丹火百炼经', 'xuan', 7, 2, ['alchemy'], { type: 'library', label: '分界藏经 · 金丹卷' }, '百炼丹火，炼的是药，也是心境（丹道辅修）。'),
  mkTech('tech_c2_lei', '紫雷结丹篇', 'xuan', 8, 2, ['lei'], { type: 'library', label: '分界藏经 · 金丹卷' }, '雷属变异灵根结丹：丹成之日，必有雷声。'),
  mkTech('tech_c2_bing', '寒玉凝丹章', 'xuan', 8, 2, ['bing'], { type: 'library', label: '分界藏经 · 金丹卷' }, '冰属变异灵根结丹：丹如寒玉，触之生凉。'),
  mkTech('tech_c2_feng', '风罡结丹诀', 'xuan', 9, 2, ['feng'], { type: 'library', label: '分界藏经 · 金丹卷' }, '风属变异灵根结丹：罡风绕丹，丹随罡转。'),
  mkTech('tech_c2_wx1', '金丹圆融经', 'xuan', 3, 2, ['wuxing'], { type: 'library', label: '分界藏经 · 金丹卷' }, '不挑灵根的结丹总纲，讲的是「圆」字。'),
  mkTech('tech_c2_wx2', '金液还丹篇', 'xuan', 5, 2, ['wuxing'], { type: 'library', label: '分界藏经 · 金丹卷' }, '金液还丹、返本归元，丹道与气道的交界处。'),

  // ── 境 3 · 元婴（玄阶）─────────────────────────────────────────────────
  mkTech('tech_c3_jin', '庚金育婴篇', 'xuan', 1, 3, ['jin'], { type: 'library', label: '分界藏经 · 元婴卷' }, '金行育婴，婴成而锋锐。'),
  mkTech('tech_c3_mu', '青木养婴诀', 'xuan', 2, 3, ['mu'], { type: 'library', label: '分界藏经 · 元婴卷' }, '木行养婴，婴与草木同长。'),
  mkTech('tech_c3_shui', '玄水润婴经', 'xuan', 3, 3, ['shui'], { type: 'library', label: '分界藏经 · 元婴卷' }, '水行润婴，婴在温养中成形。'),
  mkTech('tech_c3_huo', '离火锻婴章', 'xuan', 4, 3, ['huo'], { type: 'library', label: '分界藏经 · 元婴卷' }, '火行锻婴，一次火一次凝。'),
  mkTech('tech_c3_tu', '厚土安婴法', 'xuan', 5, 3, ['tu'], { type: 'library', label: '分界藏经 · 元婴卷' }, '土行安婴，婴坐丹田如坐山。'),
  mkTech('tech_c3_body', '婴体双修篇', 'xuan', 6, 3, ['body'], { type: 'library', label: '分界藏经 · 元婴卷' }, '婴壮体、体养婴，两条腿走路（炼体辅修）。'),
  mkTech('tech_c3_sword', '剑婴同修诀', 'xuan', 6, 3, ['sword'], { type: 'library', label: '分界藏经 · 元婴卷' }, '婴持剑、剑护婴，出窍时可御剑（剑道辅修）。'),
  mkTech('tech_c3_alchemy', '婴火炼丹经', 'xuan', 7, 3, ['alchemy'], { type: 'library', label: '分界藏经 · 元婴卷' }, '以婴火炼丹，火候精微到分毫不差（丹道辅修）。'),
  mkTech('tech_c3_lei', '雷婴淬魂篇', 'xuan', 8, 3, ['lei'], { type: 'library', label: '分界藏经 · 元婴卷' }, '雷属变异灵根育婴：借雷淬魂，婴魂不散。'),
  mkTech('tech_c3_bing', '冰婴清心章', 'xuan', 8, 3, ['bing'], { type: 'library', label: '分界藏经 · 元婴卷' }, '冰属变异灵根育婴：婴心清净，最不易走火。'),
  mkTech('tech_c3_feng', '风婴游虚诀', 'xuan', 9, 3, ['feng'], { type: 'library', label: '分界藏经 · 元婴卷' }, '风属变异灵根育婴：婴随风游，出窍千里。'),
  mkTech('tech_c3_wx1', '婴神凝练经', 'xuan', 3, 3, ['wuxing'], { type: 'library', label: '分界藏经 · 元婴卷' }, '不挑灵根的元婴总纲：凝得住，才养得久。'),
  mkTech('tech_c3_wx2', '元婴出窍篇', 'xuan', 5, 3, ['wuxing'], { type: 'library', label: '分界藏经 · 元婴卷' }, '出窍之法慎之又慎，前人笔记里写满了教训。'),

  // ── 境 4 · 化神（地阶）─────────────────────────────────────────────────
  mkTech('tech_c4_jin', '庚金炼神章', 'di', 1, 4, ['jin'], { type: 'library', label: '分界藏经 · 化神卷' }, '金行炼神，神识如刀。'),
  mkTech('tech_c4_mu', '青木养神篇', 'di', 2, 4, ['mu'], { type: 'library', label: '分界藏经 · 化神卷' }, '木行养神，神识绵长不绝。'),
  mkTech('tech_c4_shui', '玄水润神诀', 'di', 3, 4, ['shui'], { type: 'library', label: '分界藏经 · 化神卷' }, '水行润神，神如深潭不惊。'),
  mkTech('tech_c4_huo', '离火淬神章', 'di', 4, 4, ['huo'], { type: 'library', label: '分界藏经 · 化神卷' }, '火行淬神，去的是杂念。'),
  mkTech('tech_c4_tu', '厚土固神法', 'di', 5, 4, ['tu'], { type: 'library', label: '分界藏经 · 化神卷' }, '土行固神，神念不动如山。'),
  mkTech('tech_c4_body', '神体同炼篇', 'di', 6, 4, ['body'], { type: 'library', label: '分界藏经 · 化神卷' }, '神识与肉身同炼，两者互为炉鼎（炼体辅修）。'),
  mkTech('tech_c4_sword', '神剑合一诀', 'di', 6, 4, ['sword'], { type: 'library', label: '分界藏经 · 化神卷' }, '神即剑、剑即神，斩的是心障（剑道辅修）。'),
  mkTech('tech_c4_alchemy', '神火炼丹章', 'di', 7, 4, ['alchemy'], { type: 'library', label: '分界藏经 · 化神卷' }, '以神识控火，丹成于念动之间（丹道辅修）。'),
  mkTech('tech_c4_lei', '紫雷炼神篇', 'di', 8, 4, ['lei'], { type: 'library', label: '分界藏经 · 化神卷' }, '雷属变异灵根炼神：雷过而神愈清。'),
  mkTech('tech_c4_bing', '冰心化神章', 'di', 8, 4, ['bing'], { type: 'library', label: '分界藏经 · 化神卷' }, '冰属变异灵根化神：心冷则神定。'),
  mkTech('tech_c4_feng', '风神游太虚', 'di', 9, 4, ['feng'], { type: 'library', label: '分界藏经 · 化神卷' }, '风属变异灵根化神：神随风行，一瞬千里。'),
  mkTech('tech_c4_wx1', '神念外放经', 'di', 3, 4, ['wuxing'], { type: 'library', label: '分界藏经 · 化神卷' }, '不挑灵根的化神总纲：神念出体的第一步。'),
  mkTech('tech_c4_wx2', '化神真解', 'di', 5, 4, ['wuxing'], { type: 'library', label: '分界藏经 · 化神卷' }, '化神一境的通行解法，字字都是前人踩过的坑。'),

  // ── 境 5 · 炼虚（地阶）─────────────────────────────────────────────────
  mkTech('tech_c5_jin', '庚金炼虚章', 'di', 1, 5, ['jin'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '金行入虚，虚中生锋。'),
  mkTech('tech_c5_mu', '青木入虚篇', 'di', 2, 5, ['mu'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '木行入虚，虚境里也能生根。'),
  mkTech('tech_c5_shui', '玄水虚境诀', 'di', 3, 5, ['shui'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '水行入虚，虚实之间如水如渊。'),
  mkTech('tech_c5_huo', '离火焚虚章', 'di', 4, 5, ['huo'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '火行入虚，烧的是虚妄。'),
  mkTech('tech_c5_tu', '厚土载虚法', 'di', 5, 5, ['tu'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '土行入虚，以实载虚而不倾。'),
  mkTech('tech_c5_body', '虚体炼形篇', 'di', 6, 5, ['body'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '虚境之中重炼其身，此为体修的中段（炼体辅修）。'),
  mkTech('tech_c5_sword', '虚剑斩空诀', 'di', 6, 5, ['sword'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '一剑斩空，空处亦有剑痕（剑道辅修）。'),
  mkTech('tech_c5_alchemy', '虚火炼丹章', 'di', 7, 5, ['alchemy'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '虚火无形，炼丹却比实火更准（丹道辅修）。'),
  mkTech('tech_c5_lei', '紫雷破虚篇', 'di', 8, 5, ['lei'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '雷属变异灵根炼虚：一雷破开虚障。'),
  mkTech('tech_c5_bing', '冰封虚境章', 'di', 8, 5, ['bing'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '冰属变异灵根炼虚：冻住这一线虚空。'),
  mkTech('tech_c5_feng', '风穿虚隙诀', 'di', 9, 5, ['feng'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '风属变异灵根炼虚：风过虚隙，来去无痕。'),
  mkTech('tech_c5_wx1', '虚实相生经', 'di', 3, 5, ['wuxing'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '不挑灵根的炼虚总纲：虚从实来，实向虚去。'),
  mkTech('tech_c5_wx2', '炼虚真解', 'di', 5, 5, ['wuxing'], { type: 'library', label: '分界藏经 · 炼虚卷' }, '炼虚一境的通行解法，重在「不迷」。'),

  // ── 境 6 · 合体（天阶）─────────────────────────────────────────────────
  mkTech('tech_c6_jin', '庚金合道章', 'tian', 1, 6, ['jin'], { type: 'library', label: '分界藏经 · 合体卷' }, '金行合道，道中有锋。'),
  mkTech('tech_c6_mu', '青木合真篇', 'tian', 2, 6, ['mu'], { type: 'library', label: '分界藏经 · 合体卷' }, '木行合真，一道生机合于天地。'),
  mkTech('tech_c6_shui', '玄水合元诀', 'tian', 3, 6, ['shui'], { type: 'library', label: '分界藏经 · 合体卷' }, '水行合元，元起如潮。'),
  mkTech('tech_c6_huo', '离火合天章', 'tian', 4, 6, ['huo'], { type: 'library', label: '分界藏经 · 合体卷' }, '火行合天，天火入怀。'),
  mkTech('tech_c6_tu', '厚土合德法', 'tian', 5, 6, ['tu'], { type: 'library', label: '分界藏经 · 合体卷' }, '土行合德，德厚方能载道。'),
  mkTech('tech_c6_body', '体合天地篇', 'tian', 6, 6, ['body'], { type: 'library', label: '分界藏经 · 合体卷' }, '肉身与天地相合，此为体修的上段（炼体辅修）。'),
  mkTech('tech_c6_sword', '剑合天人诀', 'tian', 6, 6, ['sword'], { type: 'library', label: '分界藏经 · 合体卷' }, '剑与天人相合，出剑即是天意（剑道辅修）。'),
  mkTech('tech_c6_alchemy', '丹合造化章', 'tian', 7, 6, ['alchemy'], { type: 'library', label: '分界藏经 · 合体卷' }, '一炉之丹合于造化，此为丹修的上段（丹道辅修）。'),
  mkTech('tech_c6_lei', '紫雷合真篇', 'tian', 8, 6, ['lei'], { type: 'library', label: '分界藏经 · 合体卷' }, '雷属变异灵根合体：雷与人合，人即是雷。'),
  mkTech('tech_c6_bing', '冰合玄冥章', 'tian', 8, 6, ['bing'], { type: 'library', label: '分界藏经 · 合体卷' }, '冰属变异灵根合体：与玄冥同息。'),
  mkTech('tech_c6_feng', '风合八荒诀', 'tian', 9, 6, ['feng'], { type: 'library', label: '分界藏经 · 合体卷' }, '风属变异灵根合体：八荒之风，皆由我起。'),
  mkTech('tech_c6_wx1', '天人交感经', 'tian', 3, 6, ['wuxing'], { type: 'library', label: '分界藏经 · 合体卷' }, '不挑灵根的合体总纲：天人交感，法理入体。'),
  mkTech('tech_c6_wx2', '合体真解', 'tian', 5, 6, ['wuxing'], { type: 'library', label: '分界藏经 · 合体卷' }, '合体一境的通行解法，成败都在「合」字上。'),

  // ── 境 7 · 大乘（天阶）─────────────────────────────────────────────────
  mkTech('tech_c7_jin', '庚金大乘章', 'tian', 1, 7, ['jin'], { type: 'library', label: '分界藏经 · 大乘卷' }, '金行大乘，锋意已归于圆满。'),
  mkTech('tech_c7_mu', '青木长生篇', 'tian', 2, 7, ['mu'], { type: 'library', label: '分界藏经 · 大乘卷' }, '木行大乘，回归到最初那句「长生」。'),
  mkTech('tech_c7_shui', '玄水大乘诀', 'tian', 3, 7, ['shui'], { type: 'library', label: '分界藏经 · 大乘卷' }, '水行大乘，万流归海而不争。'),
  mkTech('tech_c7_huo', '离火大乘章', 'tian', 4, 7, ['huo'], { type: 'library', label: '分界藏经 · 大乘卷' }, '火行大乘，焰归于温。'),
  mkTech('tech_c7_tu', '厚土大乘法', 'tian', 5, 7, ['tu'], { type: 'library', label: '分界藏经 · 大乘卷' }, '土行大乘，德厚而道自载。'),
  mkTech('tech_c7_body', '大乘金身篇', 'tian', 6, 7, ['body'], { type: 'library', label: '分界藏经 · 大乘卷' }, '体修至此，皮肉筋骨皆已非血肉（炼体辅修）。'),
  mkTech('tech_c7_sword', '大乘剑典', 'tian', 6, 7, ['sword'], { type: 'library', label: '分界藏经 · 大乘卷' }, '一部没有招式只有心法的剑典（剑道辅修）。'),
  mkTech('tech_c7_alchemy', '大乘丹章', 'tian', 7, 7, ['alchemy'], { type: 'library', label: '分界藏经 · 大乘卷' }, '丹修至此，一炉丹可活一方水土（丹道辅修）。'),
  mkTech('tech_c7_lei', '紫雷大乘篇', 'tian', 8, 7, ['lei'], { type: 'library', label: '分界藏经 · 大乘卷' }, '雷属变异灵根大乘：此身已是雷的一部分。'),
  mkTech('tech_c7_bing', '冰封大乘章', 'tian', 8, 7, ['bing'], { type: 'library', label: '分界藏经 · 大乘卷' }, '冰属变异灵根大乘：一动即是千里冰封。'),
  mkTech('tech_c7_feng', '风御大乘诀', 'tian', 9, 7, ['feng'], { type: 'library', label: '分界藏经 · 大乘卷' }, '风属变异灵根大乘：御风者不再逆风。'),
  mkTech('tech_c7_wx1', '大乘圆满经', 'tian', 3, 7, ['wuxing'], { type: 'library', label: '分界藏经 · 大乘卷' }, '不挑灵根的大乘总纲：圆满不是终点，是门槛。'),
  mkTech('tech_c7_wx2', '混元大乘篇', 'tian', 5, 7, ['wuxing'], { type: 'library', label: '分界藏经 · 大乘卷' }, '混元一气，万法归一 —— 飞升前的最后一篇。'),

  // ── 顶级灵根专属 6 本（硬门槛：`rootReq` 逐级收窄）──────────────────────
  mkTech('tech_ct_lei', '紫霄神雷诀', 'di', 9, 4, ['lei'], { type: 'library', label: '分界藏经 · 紫霄遗刻' },
    '紫霄一门只传雷属变异灵根：雷自九天来，不借外力。', { top: true, rootReq: ROOT_REQ_TOP }),
  mkTech('tech_ct_bing', '九天玄冰经', 'di', 9, 4, ['bing'], { type: 'library', label: '分界藏经 · 玄冰古窟' },
    '九天玄冰只认冰属变异灵根，寒潭深处千年一开。', { top: true, rootReq: ROOT_REQ_TOP }),
  mkTech('tech_ct_tian1', '天灵化神圣章', 'tian', 8, 5, ['wuxing'], { type: 'library', label: '分界藏经 · 天灵阁' },
    '天灵根者专属：化神境起，神念自通天地，无需外求。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  mkTech('tech_ct_tian2', '天灵无极真解', 'tian', 9, 6, ['wuxing'], { type: 'library', label: '分界藏经 · 天灵阁' },
    '天灵根者专属：无极者，无不可及之处。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  mkTech('tech_ct_hun1', '混沌归元篇', 'tian', 9, 6, ['wuxing'], { type: 'library', label: '分界藏经 · 无字残卷' },
    '混沌灵根专属：归元者，万法归我而非我归万法。', { top: true, rootReq: { rarities: ['hidden'] } }),
  mkTech('tech_ct_hun2', '混沌开天章', 'tian', 9, 7, ['wuxing'], { type: 'library', label: '分界藏经 · 无字残卷' },
    '混沌灵根专属：开天一句，此后再无此文。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ═══════════════════════════════════════════════════════════════════════════
  // 二、各界专属库 144 本（12 界 × 每界 12 本）
  //   命名口径：**直接从原著提取**（原著功法名优先，其次原著意象词）—— 主人 2026-09-21 拍板
  //   结构：九卷各 1 本（序号 1~9，境界＝该卷大境）＋ 顶级灵根专属 3 本（序号 10~12，硬门槛）
  //   门槛：10 → 变异及以上｜11 → 天灵根及以上｜12 → 仅混沌彩蛋
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 01 · 青岚界（原著《凡人修仙传》）────────────────────────────────────
  ql('tech_ql_1', '大衍诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '青岚 · 无名口诀' }, '一部残缺的推演之法：算得越多，越知道自己算得不够。'),
  ql('tech_ql_2', '御灵术', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '青岚 · 灵圃古碑' }, '以气御物、以神御灵，木石皆可听令。'),
  ql('tech_ql_3', '明王诀', 'xuan', 3, 2, ['body'], { type: 'world', label: '青岚 · 雷淬池' }, '金身明王之道：以雷淬体，皮肉之下自有光明。'),
  ql('tech_ql_4', '察灵术', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '青岚 · 万珍楼' }, '灵觉外放，辨药、辨宝、辨人心。'),
  ql('tech_ql_5', '血煞功', 'di', 5, 4, ['an'], { type: 'world', label: '青岚 · 禁地残卷' }, '魔道功法：以血养气，进境极快，代价写在每一页上。'),
  ql('tech_ql_6', '化劫大法', 'di', 6, 5, ['wuxing'], { type: 'world', label: '青岚 · 渡劫台' }, '专为渡劫准备的功法：劫来之前，先算好退路。'),
  ql('tech_ql_7', '大罗天经', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '青岚 · 天南遗刻' }, '大罗天之上有经，此地所见，只是残篇。'),
  ql('tech_ql_8', '元磁神功', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '青岚 · 掌天遗泽' }, '元磁之力束万物，修成者一念可镇一山。'),
  ql('tech_ql_9', '玄天斩灵剑诀', 'tian', 9, 7, ['sword'], { type: 'world', label: '青岚 · 飞升台' }, '飞升之前的最后一剑，斩的是旧我。'),
  ql('tech_ql_10', '托天魔功', 'di', 9, 0, ['an'], { type: 'world', label: '青岚 · 魔道秘传' }, '顶级灵根专属：托天之力非血肉可承，唯变异以上可修。', { top: true, rootReq: ROOT_REQ_TOP }),
  ql('tech_ql_11', '天鹏血脉诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '青岚 · 真灵遗种' }, '顶级灵根专属：真灵血脉只认上等灵根。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  ql('tech_ql_12', '惊蛰十二变', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '青岚 · 无字残卷' }, '混沌灵根专属：十二变之数，一变一世界。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 02 · 破晓星域（原著《仙逆》）────────────────────────────────────────
  px('tech_px_1', '墨云诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '破晓 · 边陲小宗' }, '边陲小宗最粗浅的吐纳法，却也是起步的那一本。'),
  px('tech_px_2', '古神诀', 'huang', 2, 1, ['body'], { type: 'world', label: '破晓 · 域外战场' }, '以身为炉、以战为火 —— 古神之道从挨打开始。'),
  px('tech_px_3', '杀戮剑典', 'xuan', 3, 2, ['sword'], { type: 'world', label: '破晓 · 域外战场' }, '杀意入剑、剑随心动 —— 此界最不缺的就是它。'),
  px('tech_px_4', '定神术', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '破晓 · 栖魂林' }, '神识极境的第一课：先稳住自己，再谈外放。'),
  px('tech_px_5', '千魔功', 'di', 5, 4, ['an'], { type: 'world', label: '破晓 · 魔道传承' }, '以魔气养身，一路走到黑，也未必是错。'),
  px('tech_px_6', '太素诀', 'di', 6, 5, ['wuxing'], { type: 'world', label: '破晓 · 古传送阵' }, '太素者，未分之始。修者回到源头，再走一遍。'),
  px('tech_px_7', '烛龙诀', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '破晓 · 烛龙遗骸' }, '烛龙睁眼为昼、闭眼为夜 —— 修的是别人不敢睁的那只眼。'),
  px('tech_px_8', '禁制谱', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '破晓 · 禁制谱' }, '一部讲「怎么把东西锁住」的书，锁的也包括自己。'),
  px('tech_px_9', '踏天诀', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '破晓 · 踏天阶' }, '天有九重，踏到最后一层，便不必再踏。'),
  px('tech_px_10', '窃基法', 'di', 9, 0, ['an'], { type: 'world', label: '破晓 · 魔傀秘传' }, '顶级灵根专属：夺他人道基为己用，非上等灵根承受不住。', { top: true, rootReq: ROOT_REQ_TOP }),
  px('tech_px_11', '神识极境篇', 'di', 9, 0, ['wuxing'], { type: 'world', label: '破晓 · 神识极境' }, '顶级灵根专属：神识推到尽头，唯天灵与混沌可及。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  px('tech_px_12', '逆命珠诀', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '破晓 · 天逆珠' }, '混沌灵根专属：逆的是天，也是命。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 03 · 观云界（原著《我师兄实在太稳健了》）──────────────────────────
  dh('tech_dh_1', '观云吐纳诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '观云 · 小炉峰' }, '小炉峰上最不起眼的那本，却是入门第一课。'),
  dh('tech_dh_2', '问危入道篇', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '观云 · 入门审核' }, '师父先问「什么最危险」，再让你翻开这一篇。'),
  dh('tech_dh_3', '功德金章', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '观云 · 功德簿' }, '以功德养气，气随善念而厚。'),
  dh('tech_dh_4', '替身纸偶术', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '观云 · 底牌簿' }, '以纸代人、以偶替身 —— 退路永远要多备一份。'),
  dh('tech_dh_5', '藏拙守静经', 'di', 5, 4, ['wuxing'], { type: 'world', label: '观云 · 底牌簿' }, '藏拙不是懦弱，是把牌留到该亮的那一刻。'),
  dh('tech_dh_6', '留余备患经', 'di', 6, 5, ['wuxing'], { type: 'world', label: '观云 · 退路预案' }, '一册写满「万一」的书：每条退路都标着代价。'),
  dh('tech_dh_7', '持中守均经', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '观云 · 持中守均经' }, '不强不弱、不上不下 —— 此界最难的功夫叫「刚刚好」。'),
  dh('tech_dh_8', '借天偿道章', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '观云 · 天道债券' }, '把天道当债主：先借后还，账要算清。'),
  dh('tech_dh_9', '香火愿力经', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '观云 · 香火愿力' }, '愿力聚而成形：收在他们心里，也收在你身上。'),
  dh('tech_dh_10', '挂印领俸诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '观云 · 天庭闲职' }, '顶级灵根专属：挂个闲职、领份俸禄，非上等灵根压不住这份气运。', { top: true, rootReq: ROOT_REQ_TOP }),
  dh('tech_dh_11', '山水神印诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '观云 · 河神土地' }, '顶级灵根专属：一方水土一方神，天灵之资方可两兼。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  dh('tech_dh_12', '太清道法', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '观云 · 无字残卷' }, '混沌灵根专属：太清一脉，只认混沌之资。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 04 · 青云古界（原著《诛仙》）────────────────────────────────────────
  qy('tech_qy_1', '太极玄清道', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '青云 · 云嶂门' }, '青云门入门道法：先正其心，再正其气。'),
  qy('tech_qy_2', '大梵般若', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '青云 · 天音遗篇' }, '佛门般若，以慈悲压杀性 —— 此界最难的一课。'),
  qy('tech_qy_3', '玉书残卷', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '青云 · 滴血洞' }, '半卷玉书，字字都不是给人看的。'),
  qy('tech_qy_4', '赤焰焚天诀', 'xuan', 4, 3, ['huo'], { type: 'world', label: '青云 · 赤铁棍' }, '以赤铁为引、以烈焰为笔，写的是杀伐。'),
  qy('tech_qy_5', '离火鉴心经', 'di', 5, 4, ['huo'], { type: 'world', label: '青云 · 离火鉴' }, '以离火照心：照出的，从来不是敌人。'),
  qy('tech_qy_6', '苍竹剑意', 'di', 6, 5, ['sword'], { type: 'world', label: '青云 · 苍竹峰' }, '苍竹峰上千年竹，剑意就在竹叶声里。'),
  qy('tech_qy_7', '同心铃诀', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '青云 · 同心铃' }, '铃响一声，两人同心 —— 此界最不像功法的一门功法。'),
  qy('tech_qy_8', '诛仙剑诀', 'tian', 8, 7, ['sword'], { type: 'world', label: '青云 · 剑冢' }, '剑冢里最凶的一柄，认的不是最强的人。'),
  qy('tech_qy_9', '剑意超脱章', 'tian', 9, 7, ['sword'], { type: 'world', label: '青云 · 超脱' }, '此界无飞升：最后一式过后，剑还在，人已不在。'),
  qy('tech_qy_10', '玉清境真解', 'di', 9, 0, ['wuxing'], { type: 'world', label: '青云 · 玉清境' }, '顶级灵根专属：玉清之境，非上等灵根不得入。', { top: true, rootReq: ROOT_REQ_TOP }),
  qy('tech_qy_11', '嗜血珠诀', 'di', 9, 0, ['an'], { type: 'world', label: '青云 · 嗜血珠' }, '顶级灵根专属：珠子认主也认血，天灵之资方能镇之。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  qy('tech_qy_12', '诛仙剑阵图', 'tian', 9, 0, ['sword'], { type: 'world', label: '青云 · 无字残卷' }, '混沌灵根专属：阵图无字，全凭一心推演。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 05 · 望族山河（原著《玄鉴仙族》）────────────────────────────────────
  wz('tech_wz_1', '玄鉴养气诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '望族 · 古镜' }, '一部照着古镜修行的入门法：镜里镜外都是自己。'),
  wz('tech_wz_2', '符种初植篇', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '望族 · 符种' }, '以符种入体，从此这一族的运数也入了你的身。'),
  wz('tech_wz_3', '箓气凝丹经', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '望族 · 箓丹' }, '箓气凝而不散，丹成之日，族里要开祠堂。'),
  wz('tech_wz_4', '仙基铸就章', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '望族 · 仙基' }, '仙基一铸，往后每一代都要在族谱上添一笔。'),
  wz('tech_wz_5', '金性炼神诀', 'di', 5, 4, ['wuxing'], { type: 'world', label: '望族 · 金性' }, '金性不坏，故神可长存 —— 这是这一族最贵的东西。'),
  wz('tech_wz_6', '洞天开辟篇', 'di', 6, 5, ['wuxing'], { type: 'world', label: '望族 · 洞天之境' }, '开一方洞天，为一家百年留一处退路。'),
  wz('tech_wz_7', '族运共修经', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '望族 · 族事堂' }, '一人之运连着全族之运：修得越深，越不敢乱走一步。'),
  wz('tech_wz_8', '承道继统诀', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '望族 · 宗子' }, '宗子承道之日，族老要在祠堂外站上一夜。'),
  wz('tech_wz_9', '传承守心诀', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '望族 · 祠堂' }, '一册传了三十代的笔记，比功法更像家书。'),
  wz('tech_wz_10', '古镜照心篇', 'di', 9, 0, ['wuxing'], { type: 'world', label: '望族 · 古镜' }, '顶级灵根专属：古镜只照上等灵根的心。', { top: true, rootReq: ROOT_REQ_TOP }),
  wz('tech_wz_11', '夺元炼箓诀', 'di', 9, 0, ['an'], { type: 'world', label: '望族 · 祭萃夺元' }, '顶级灵根专属：夺他人元以炼己箓，天灵之资方可承。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  wz('tech_wz_12', '金性不灭章', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '望族 · 无字残卷' }, '混沌灵根专属：金性不灭，前提是先有那一分混沌。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 06 · 幽傩界（原著《道诡异仙》）──────────────────────────────────────
  yn('tech_yn_1', '药引吐纳法', 'fan', 1, 0, ['alchemy'], { type: 'world', label: '幽傩 · 药房' }, '药房杂役的入门法：先辨药，再辨自己。'),
  yn('tech_yn_2', '玄鼎炼丹篇', 'huang', 2, 1, ['alchemy'], { type: 'world', label: '幽傩 · 玄鼎' }, '一尊玄鼎、一篇丹方 —— 烧的是药材，也是寿数。'),
  yn('tech_yn_3', '阳寿换取诀', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '幽傩 · 阳寿' }, '此界最直白的一门功法：拿寿元换修为，童叟无欺。'),
  yn('tech_yn_4', '请神上身术', 'xuan', 4, 3, ['an'], { type: 'world', label: '幽傩 · 请神' }, '以身为容器，请外来的神住进来 —— 力量是真的，代价也是。'),
  yn('tech_yn_5', '真幻双行经', 'di', 5, 4, ['an'], { type: 'world', label: '幽傩 · 真幻' }, '真假两条线同时走，走错一步，就分不清哪个是自己。'),
  yn('tech_yn_6', '走火炼心章', 'di', 6, 5, ['huo'], { type: 'world', label: '幽傩 · 走火' }, '专治走火：把烧起来的心火，一寸寸压回去。'),
  yn('tech_yn_7', '执命改运诀', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '幽傩 · 执命' }, '命是可以改的 —— 改一次，要还一笔。'),
  yn('tech_yn_8', '真性不昧经', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '幽傩 · 真性' }, '此界最难得的不是修为，是「还认得自己」。'),
  yn('tech_yn_9', '言出法随章', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '幽傩 · 言出' }, '你说你是什么，你便是什么 —— 此书无字，只待开口。'),
  yn('tech_yn_10', '傩面化身诀', 'di', 9, 0, ['an'], { type: 'world', label: '幽傩 · 傩面' }, '顶级灵根专属：戴上傩面就换一个人，非上等灵根换不回来。', { top: true, rootReq: ROOT_REQ_TOP }),
  yn('tech_yn_11', '秘闻窥真录', 'di', 9, 0, ['wuxing'], { type: 'world', label: '幽傩 · 秘闻' }, '顶级灵根专属：窥真者，要有一双看得住的眼睛。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  yn('tech_yn_12', '执命改天章', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '幽傩 · 无字残卷' }, '混沌灵根专属：改天是要还的，混沌之资才能把这笔账压住。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 07 · 通天界（原著《一念永恒》）──────────────────────────────────────
  tt('tech_tt_1', '长生功', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '通天 · 灶房' }, '通天宗最普通的一本 —— 村口少年翻烂了的那一本。'),
  tt('tech_tt_2', '铁身诀', 'huang', 2, 1, ['body'], { type: 'world', label: '通天 · 炼体堂' }, '铁身、金身、金刚骨的第一步：先让自己挨得住。'),
  tt('tech_tt_3', '金身诀', 'xuan', 3, 2, ['body'], { type: 'world', label: '通天 · 炼体堂' }, '铁身之后是金身，皮肉之下已见金光。'),
  tt('tech_tt_4', '金刚骨', 'xuan', 4, 3, ['body'], { type: 'world', label: '通天 · 炼体堂' }, '炼到骨头里：此后再挨打，断的就不是自己。'),
  tt('tech_tt_5', '通天炼魂经', 'di', 5, 4, ['wuxing'], { type: 'world', label: '通天 · 炼魂试炼' }, '炼魂试炼的通关法：魂越炼越亮，也越炼越疼。'),
  tt('tech_tt_6', '合流归元诀', 'di', 6, 5, ['wuxing'], { type: 'world', label: '通天 · 合流宗' }, '百家之气合流归一 —— 走得慢，但走得远。'),
  tt('tech_tt_7', '道榜留名诀', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '通天 · 星墟道榜' }, '榜上有名之后，修行就不再是一个人的事。'),
  tt('tech_tt_8', '冥主尊位经', 'tian', 8, 7, ['an'], { type: 'world', label: '通天 · 冥主位' }, '坐上那个位子，才知道它有多冷。'),
  tt('tech_tt_9', '岁月长河章', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '通天 · 岁月长河' }, '长河之上还有两朵花，你只能摘一朵。'),
  tt('tech_tt_10', '天道突破诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '通天 · 天道档' }, '顶级灵根专属：赌天道的那一档，非上等灵根赌不起。', { top: true, rootReq: ROOT_REQ_TOP }),
  tt('tech_tt_11', '通天宗秘传', 'di', 9, 0, ['wuxing'], { type: 'world', label: '通天 · 通天宗' }, '顶级灵根专属：宗门压箱底的那一本，天灵之资才配翻。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  tt('tech_tt_12', '一念永恒篇', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '通天 · 无字残卷' }, '混沌灵根专属：一念之间，便是永恒。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 08 · 天工界（原著《仙工开物》）──────────────────────────────────────
  tg('tech_tg_1', '悬丝入指诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '天工 · 机关坊' }, '一根丝、十根指头 —— 机关术的第一次结丝。'),
  tg('tech_tg_2', '三丹田诀', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '天工 · 三丹田' }, '神海、气海、精海三修：先苦，后甜。'),
  tg('tech_tg_3', '机关炼气法', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '天工 · 机关坊' }, '以机关吐纳代己身吐纳：省力，也更费心。'),
  tg('tech_tg_4', '人命悬丝术', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '天工 · 人命悬丝' }, '丝的一端在自己手上，另一端在别人命里。'),
  tg('tech_tg_5', '苍铁甲身诀', 'di', 5, 4, ['body'], { type: 'world', label: '天工 · 苍铁甲' }, '以苍铁为骨、以机关为肉（炼体辅修）。'),
  tg('tech_tg_6', '爆炎机关章', 'di', 6, 5, ['huo'], { type: 'world', label: '天工 · 爆炎猴' }, '会走路的东西带着千斤火精 —— 此章专讲怎么让它走对路。'),
  tg('tech_tg_7', '传讯万里经', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '天工 · 传讯钟' }, '钟响一声，万里共闻；从此消息比人快。'),
  tg('tech_tg_8', '地火铸器章', 'tian', 8, 7, ['huo'], { type: 'world', label: '天工 · 熔岩宫' }, '地火之宫里的图纸，画的全是别人不敢造的东西。'),
  tg('tech_tg_9', '断丝自主诀', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '天工 · 断丝' }, '把丝扯断，从此剧本自己写。'),
  tg('tech_tg_10', '神机天工篇', 'di', 9, 0, ['wuxing'], { type: 'world', label: '天工 · 神机' }, '顶级灵根专属：机关入神，非上等灵根掌不住。', { top: true, rootReq: ROOT_REQ_TOP }),
  tg('tech_tg_11', '悬丝傀儡术', 'di', 9, 0, ['an'], { type: 'world', label: '天工 · 悬丝傀儡' }, '顶级灵根专属：操傀儡者先要不被操 —— 天灵之资方可。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  tg('tech_tg_12', '开物造化章', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '天工 · 无字残卷' }, '混沌灵根专属：无中生有，混沌之资才有那个「无」。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 09 · 六面囚笼（原著《谁让他修仙的！》）──────────────────────────────
  lm('tech_lm_1', '仿生拳', 'fan', 1, 0, ['body'], { type: 'world', label: '六面 · 执事殿' }, '照着前人拳法仿出来的一路拳：不像不要紧，管用就行。'),
  lm('tech_lm_2', '扛牛丹诀', 'huang', 2, 1, ['alchemy'], { type: 'world', label: '六面 · 兑换榜' }, '一颗扛牛丹下肚，力气的账先记着。'),
  lm('tech_lm_3', '兑榜换道诀', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '六面 · 兑换榜' }, '贡献点换什么最值？这一篇讲的是算账。'),
  lm('tech_lm_4', '五大仙门经', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '六面 · 五大仙门' }, '五家的法门各取一分，合成自己的一门。'),
  lm('tech_lm_5', '辨伪识真诀', 'di', 5, 4, ['wuxing'], { type: 'world', label: '六面 · 假传承' }, '此界传承十有八九是假的 —— 这一篇教你认出真的那一分。'),
  lm('tech_lm_6', '开劫盲盒章', 'di', 6, 5, ['wuxing'], { type: 'world', label: '六面 · 天劫盲盒' }, '开一盒，天道随便改 —— 改了就要认。'),
  lm('tech_lm_7', '代练仙友诀', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '六面 · 代练仙友' }, '修行也能代练 —— 只是最后那一步，谁也替不了。'),
  lm('tech_lm_8', '神棍惑心术', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '六面 · 神棍' }, '说得越像真的，自己就越要信一半。'),
  lm('tech_lm_9', '自辟新境篇', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '六面 · 自创新境' }, '榜上还没有这一档，那就刻一块新木牌。'),
  lm('tech_lm_10', '执事殿秘典', 'di', 9, 0, ['wuxing'], { type: 'world', label: '六面 · 执事殿' }, '顶级灵根专属：执事殿压箱底的秘典，非上等灵根翻不开。', { top: true, rootReq: ROOT_REQ_TOP }),
  lm('tech_lm_11', '六面壁经', 'di', 9, 0, ['wuxing'], { type: 'world', label: '六面 · 六面壁' }, '顶级灵根专属：六面墙上六种规矩，天灵之资才敢挑最短的那条。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  lm('tech_lm_12', '无中生有章', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '六面 · 无字残卷' }, '混沌灵根专属：无中生有 —— 前提是你先有那个「无」。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 10 · 九鼎九州（原著《大乘期才有逆袭系统》）──────────────────────────
  jd('tech_jd_1', '州县启蒙诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '九鼎 · 州县' }, '州县里最普通的一本启蒙功法，谁家孩子都翻过。'),
  jd('tech_jd_2', '善行养气篇', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '九鼎 · 善行养气篇' }, '记的是善行，养的是气 —— 功德金榜上早晚有你一笔。'),
  jd('tech_jd_3', '功德金榜诀', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '九鼎 · 功德金榜' }, '功德入气、气随名显：榜上有名，修行自然快一分。'),
  jd('tech_jd_4', '仙梯残片经', 'xuan', 4, 3, ['wuxing'], { type: 'world', label: '九鼎 · 仙梯残片' }, '仙梯断了，残片上还留着半句口诀。'),
  jd('tech_jd_5', '大道循序经', 'di', 5, 4, ['wuxing'], { type: 'world', label: '九鼎 · 大道循序经' }, '此界大道循序经：不取巧、不走偏，一步一个脚印。'),
  jd('tech_jd_6', '五统领战诀', 'di', 6, 5, ['wuxing'], { type: 'world', label: '九鼎 · 五统领' }, '五位统领的战法合为一册，讲的是怎么带人。'),
  jd('tech_jd_7', '人皇殿真章', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '九鼎 · 人皇殿' }, '人皇殿里那一册，翻过的人不多，翻完的更少。'),
  jd('tech_jd_8', '重炼九鼎章', 'tian', 8, 7, ['wuxing'], { type: 'world', label: '九鼎 · 重炼' }, '九鼎重炼之日，九州的气机都跟着转了一遍。'),
  jd('tech_jd_9', '功德圆满经', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '九鼎 · 功德圆满' }, '此界不许飞升：路修好了，人就不必走。'),
  jd('tech_jd_10', '仙界引路诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '九鼎 · 仙界方位' }, '顶级灵根专属：那张图，只有上等灵根看得全。', { top: true, rootReq: ROOT_REQ_TOP }),
  jd('tech_jd_11', '继任承道章', 'di', 9, 0, ['wuxing'], { type: 'world', label: '九鼎 · 继任者' }, '顶级灵根专属：继任者要接得住这一界的气运 —— 天灵之资方可。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  jd('tech_jd_12', '开天九鼎诀', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '九鼎 · 无字残卷' }, '混沌灵根专属：九鼎开天，混沌之资才承得住这一份重。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 11 · 无缺古界（原著《我欲封天》）────────────────────────────────────
  wy('tech_wy_1', '负山养气诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '无缺 · 负山宗' }, '负山宗的入门法：走的每一步都算数 —— 慢就是快。'),
  wy('tech_wy_2', '云泽县学篇', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '无缺 · 云泽县' }, '县学里教的那一篇：字字朴素，句句不肯将就。'),
  wy('tech_wy_3', '道源真经', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '无缺 · 道源真经' }, '一境一境走满：有缺的地方，早晚要补。'),
  wy('tech_wy_4', '荒龙丹诀', 'xuan', 4, 3, ['alchemy'], { type: 'world', label: '无缺 · 荒龙丹' }, '以荒龙之血炼丹，丹成有龙吟。'),
  wy('tech_wy_5', '镇荒古玉章', 'di', 5, 4, ['wuxing'], { type: 'world', label: '无缺 · 镇荒古玉' }, '古玉镇荒：一玉压一域。'),
  wy('tech_wy_6', '九道封禁篇', 'di', 6, 5, ['wuxing'], { type: 'world', label: '无缺 · 九道封禁' }, '九道封禁一道一道开 —— 开到最后，才知道封的是什么。'),
  wy('tech_wy_7', '赐名点化术', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '无缺 · 赐名术' }, '给一方无名之地起个名字，山气随名而聚。'),
  wy('tech_wy_8', '本命丹炉经', 'tian', 8, 7, ['alchemy'], { type: 'world', label: '无缺 · 本命丹炉' }, '本命丹炉：炉在身中，火在命里。'),
  wy('tech_wy_9', '封天出世章', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '无缺 · 出世' }, '此界不设飞升：化一方山海留下，人人可练。'),
  wy('tech_wy_10', '无缺走满诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '无缺 · 无缺三档' }, '顶级灵根专属：非要走满不可的那一档，唯上等灵根撑得住。', { top: true, rootReq: ROOT_REQ_TOP }),
  wy('tech_wy_11', '旧鉴照心诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '无缺 · 青铜旧鉴' }, '顶级灵根专属：最不起眼的那件旧鉴，天灵之资才照得出真章。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  wy('tech_wy_12', '九世凝一篇', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '无缺 · 无字残卷' }, '混沌灵根专属：九世凝一身 —— 混沌之资才担得起这份厚积。', { top: true, rootReq: { rarities: ['hidden'] } }),

  // ── 12 · 人间香火（原著《我本无意成仙》）────────────────────────────────
  xh('tech_xh_1', '青芜吐纳诀', 'fan', 1, 0, ['wuxing'], { type: 'world', label: '香火 · 青芜山' }, '青芜山道观里最早的一本，跟着晨钟翻开了第一页。'),
  xh('tech_xh_2', '道观符箓篇', 'huang', 2, 1, ['wuxing'], { type: 'world', label: '香火 · 山间道观' }, '画符先画心：心不定，符就不灵。'),
  xh('tech_xh_3', '纸马神行术', 'xuan', 3, 2, ['wuxing'], { type: 'world', label: '香火 · 纸马' }, '剪一匹纸马，烧了就能跑一夜 —— 只是跑不远。'),
  xh('tech_xh_4', '雷法真解', 'xuan', 4, 3, ['lei'], { type: 'world', label: '香火 · 雷法' }, '道观雷法：召得来，也要送得走。'),
  xh('tech_xh_5', '城隍祈雨经', 'di', 5, 4, ['shui'], { type: 'world', label: '香火 · 祈雨' }, '城里人求你降雨，城隍求你别乱降。'),
  xh('tech_xh_6', '鬼市潜行诀', 'di', 6, 5, ['an'], { type: 'world', label: '香火 · 鬼市' }, '鬼市里的规矩比人间还多，这一册记了七成。'),
  xh('tech_xh_7', '民心所向章', 'tian', 7, 6, ['wuxing'], { type: 'world', label: '香火 · 民心' }, '民心所向，气运随之 —— 此章讲的是怎么不辜负。'),
  xh('tech_xh_8', '金身铸就篇', 'tian', 8, 7, ['body'], { type: 'world', label: '香火 · 金身' }, '金身由民心铸：一炷香一炷香地凝。'),
  xh('tech_xh_9', '香火绵延经', 'tian', 9, 7, ['wuxing'], { type: 'world', label: '香火 · 传承' }, '二十年走完，一张一张把符箓交出去。'),
  xh('tech_xh_10', '猫神通灵诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '香火 · 猫神' }, '顶级灵根专属：猫神认人，也认资质 —— 非上等灵根它不理。', { top: true, rootReq: ROOT_REQ_TOP }),
  xh('tech_xh_11', '万里游历诀', 'di', 9, 0, ['wuxing'], { type: 'world', label: '香火 · 游历碑' }, '顶级灵根专属：游历碑上刻的分寸，天灵之资才读得懂。', { top: true, rootReq: { rarities: ['heaven', 'hidden'] } }),
  xh('tech_xh_12', '无意成仙章', 'tian', 9, 0, ['wuxing'], { type: 'world', label: '香火 · 无字残卷' }, '混沌灵根专属：本无意成仙 —— 偏偏只有混沌之资读得通。', { top: true, rootReq: { rarities: ['hidden'] } })
]

export default { LIBRARY_TECHS, mkTech, TIER_RATE, TIER_COMBAT, TIER_RATE_TOP, TIER_COMBAT_TOP, TIER_COST, REALM_TIER, TOP_RARITIES, ROOT_REQ_TOP, LIB_WORLD_IDS }
