/**
 * items.js —— 物品表（只读配置层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《数据模型》§五 关键物品表 +《修仙世界设定总纲》§4.3 +《挂机修仙游戏设定书》§5
 *
 * 类型：pill 丹药 ｜ material 材料 ｜ treasure 法宝 ｜ talisman 符箓 ｜ fragment 残页碎片
 * unit：计数单位（背包里显示「持有 N 枚/份/件」，避免只给一个孤零零的数字）
 * usable：是否可在背包里直接使用（阶段一只有洗髓丹有实装效果，其余登记为"阶段二开放"）
 * from：产出途径（用于背包里显示"何处可得"，也方便阶段二核对实装进度）
 * ═══════════════════════════════════════════════════════════════════════════
 */

// V7.1 物品库扩容：公用新增段与 12 界专属库分文件存放（本文件只负责汇总与查询，避免 data 层循环 import）
import { COMMON_NEW } from './itemLibrary.js'
import { WORLD_ITEMS, WORLD_ITEM_GROUPS } from './itemLibraryWorld.js'

export const ITEM_TYPE_NAME = {
  pill: '丹药',
  material: '材料',
  treasure: '法宝',
  talisman: '符箓',
  fragment: '残页'
}

export const ITEM_UNIT = {
  pill: '枚',
  material: '份',
  treasure: '件',
  talisman: '张',
  fragment: '页'
}

export const ITEMS = [
  {
    id: 'pill_pojing',
    name: '破境丹',
    icon: '破境',
    type: 'pill',
    quality: 'liang',
    // 写明炼制材料（主人 2026-09-17：「丹药的说明也要写清怎么来的，哪两种材料」）
    desc: '冲关破境之物（修士俗称「筑基丹」）：×3 / ×6 重小瓶颈必需。丹房炼制需灵草 ×3 ＋ 玄铁矿 ×1（成丹率 90%），缺丹时冲关会自动开炉。',
    from: '炼丹 / 首个瓶颈宗门相赠 / 事件',
    usable: false,
    useHint: '小瓶颈冲关时自动消耗 1 枚（2.2 已实装）'
  },
  {
    id: 'pill_hujie',
    name: '护劫丹',
    icon: '护劫',
    type: 'pill',
    quality: 'zhen',
    desc: '渡劫时服下，单道天雷通过率 +10%。九曲灵参炼的「九转护劫丹」为升档：服之 +15%（同一次渡劫只占一格准备位，囊中有它则优先服它）。',
    from: '炼丹 / 秘境',
    usable: false,
    useHint: '渡劫前在「渡劫」面板服下：单雷通过率 +10%（2.5 已实装）'
  },
  {
    id: 'pill_xisui',
    name: '洗髓丹',
    icon: '洗髓',
    type: 'pill',
    quality: 'zhen',
    // 明码标价（主人 2026-09-17 / 09-18 要求）：每档的修炼速度与概率都写清，
    // 并写明"重掷只会变好不会变差"
    desc: '重铸灵根之丹（低品者俗称「洗髓青丹」）。各档修炼速度：伪灵根 ×0.85 ｜ 真灵根 ×1.15 ｜ 变异 ×1.50 ｜ 天灵根 ×2.00；' +
      '基础概率：伪 60% ｜ 真 28% ｜ 变异 10% ｜ 天 2%；硬保底就绪后的那次掷另有 3% 机会揭开隐藏的混沌灵根（×2.50）。' +
      '每洗一次，高资质权重上浮（伪灵根最低压到 5%），连续 15 次未出变异及以上则下一次必出；' +
      '重掷只会把高资质概率往上抬，绝不会把已有的资质改差。',
    from: '开局赠予 / 渡劫成功 / 丹房可炼（灵草 ×2）',
    usable: true,
    useHint: '点击「使用」即刻洗髓重掷（消耗 1 枚，概率只升不降）'
  },
  {
    id: 'pill_yanshou',
    name: '延寿丹',
    icon: '延寿',
    type: 'pill',
    quality: 'zhen',
    desc: '续命之物：+50 年（高品 +500 年）。俗称「益寿丹」。',
    from: '炼丹 / 事件',
    usable: false,
    useHint: '阶段二随炼丹系统实装'
  },
  {
    id: 'treasure_zhenlei',
    name: '镇雷法宝',
    icon: '镇雷',
    type: 'treasure',
    quality: 'zhen',
    desc: '悬于头顶可弱化雷劫：渡劫单雷通过率 +8%。',
    from: '法宝线（坊市 / 秘境）',
    usable: false,
    useHint: '持有即生效：渡劫单雷通过率 +8%，不损耗（2.5 已接线）'
  },
  {
    id: 'mat_lingcao',
    name: '灵草',
    icon: '灵草',
    type: 'material',
    quality: 'fan',
    desc: '炼丹主料，产自灵田与秘境。',
    from: '挂机偶得 / 秘境 / 灵田',
    usable: false
  },
  {
    id: 'mat_kuang',
    name: '玄铁矿',
    icon: '玄铁',
    type: 'material',
    quality: 'fan',
    desc: '炼器与法宝强化材料，亦入丹方。',
    from: '挂机偶得 / 秘境 · 矿脉',
    usable: false
  },
  {
    id: 'mat_yaodan',
    name: '妖丹',
    icon: '妖丹',
    type: 'material',
    quality: 'liang',
    desc: '妖兽内丹，喂养灵兽与炼制高阶丹药皆需。',
    from: '挂机偶得（稀） / 秘境 · 妖兽',
    usable: false
  },
  {
    // V3.3.1 追加：秘境 · 古修遗迹的主题产物（主人：古修遗迹不该再复刻玄铁矿）
    id: 'frag_canjuan',
    name: '功法残页',
    icon: '残页',
    type: 'fragment',
    quality: 'jue',
    desc: '古修遗迹里封存的残卷断页，字迹半蚀。攒够页数可补全一门秘境功法——去「秘境」看残页能换什么。',
    from: '秘境 · 古修遗迹（首通与派遣）',
    usable: false,
    useHint: '秘境「古修遗迹」的派遣产出，越深越易得'
  },
  {
    // 2.10 追加：成就阶梯（凡/灵/玄/王/皇）发放，外观系统实装后可兑换外观
    id: 'frag_waiguan',
    name: '外观碎片',
    icon: '外观',
    type: 'fragment',
    quality: 'zhen',
    desc: '成就阶梯的赏赐。攒够可换一身皮囊——不涨战力，只涨旁人多看你一眼。',
    from: '成就阶梯（2.10）',
    usable: false,
    useHint: '外观系统实装后开放兑换'
  },

  // ═══ V3.5.1 物品资料库扩充（主人 2026-09-19：参考《设计库/07-原著》丰富丹药与材料；
  //     命名与风味取诸子百家式的修仙通名，不搬任何一书原文）═══
  {
    id: 'mat_qinglingcao',
    name: '清灵草',
    icon: '清灵',
    type: 'material',
    quality: 'liang',
    desc: '生于灵田背阴处的低阶灵药，叶背有淡淡清气流转。药性清润不燥，是凝神丹的主料。',
    from: '宗门任务 / 宗门商店 / 秘境 · 灵圃',
    usable: false
  },
  {
    id: 'mat_yaohu',
    name: '妖兽精血',
    icon: '精血',
    type: 'material',
    quality: 'liang',
    desc: '妖兽心头一滴精血，趁气血方刚时取下最宜。炼丹炼体皆用，喂养灵兽时兑一分水也是大补。',
    from: '宗门任务 · 除妖 / 宗门商店 / 秘境 · 妖兽',
    usable: false
  },
  {
    id: 'mat_wannianru',
    name: '千年灵乳',
    icon: '灵乳',
    type: 'material',
    quality: 'zhen',
    desc: '石髓千年凝成的一汪乳白灵液，天地精华所钟。上品丹方的药引，一滴可换一城——可惜保不住，见风即散。',
    from: '秘境深处 / 坊市拍卖 / 宗门商店（贵）',
    usable: false
  },
  {
    id: 'mat_fuzhi',
    name: '灵纹符纸',
    icon: '符纸',
    type: 'material',
    quality: 'fan',
    desc: '符修绘符的底纸，以灵植纤维压制而成，自带一缕天然灵纹。符箓线实装前暂作通货流通。',
    from: '宗门商店 / 坊市',
    usable: false
  },
  {
    // V3.5.7 原著首批入库（出处：《凡人修仙传》九曲灵参，跨书高频）——
    // 绝品材料，登记待丹方扩容接入（同千年灵乳「先入库后接线」的口径）
    id: 'mat_jiuqu',
    name: '九曲灵参',
    icon: '九曲',
    type: 'material',
    quality: 'jue',
    desc: '九曲盘结的千年老参，参香入鼻即醒神。破境类丹方的顶级主料——丹房丹方扩容时接入。',
    from: '坊市拍卖 / 秘境深处',
    usable: false
  },
  {
    // V3.5.7 原著首批入库（出处：《凡人修仙传》降灵符，跨书高频）——符箓线第一张实装符，
    // 走 state.buffs 公共乘区（与凝神丹同机制；可叠加，同符只刷新时长）
    id: 'talisman_jiangling',
    name: '降灵符',
    icon: '降灵',
    type: 'talisman',
    quality: 'liang',
    desc: '符门引灵入体的初阶灵符。符纸一燃，天地灵气应召而来：现实 5 分钟内修为产出 +10%。',
    from: '坊市 · 折扣商店',
    usable: true,
    useHint: '点击「使用」即刻焚符：现实 5 分钟修为产出 +10%（可与凝神丹叠加；再焚只刷新时长）'
  },
  {
    // V3.5.9 原著第三批接线：九曲灵参的丹方落点（mat_jiuqu 由「先入库」转正）——
    // 护劫丹升档，同槽位：渡劫准备时囊中有它则优先服高档（+15%）
    id: 'pill_hujie2',
    name: '九转护劫丹',
    icon: '九转',
    type: 'pill',
    quality: 'jue',
    desc: '以九曲灵参为主料九转炼成的护劫丹上品。渡劫时服下：单道天雷通过率 +15%（普通护劫丹 +10%；同一次渡劫只占一格准备位，囊中有它则优先服它）。',
    from: '丹房炼制（九曲灵参 ×1 ＋ 灵草 ×2 ＋ 妖丹 ×1）/ 坊市拍卖',
    usable: false,
    useHint: '渡劫面板点「备妥」时自动优先服用：单雷 +15%'
  },
  {
    id: 'pill_ningshen',
    name: '凝神丹',
    icon: '凝神',
    type: 'pill',
    quality: 'liang',
    desc: '服之凝神静气、灵台清明：现实 10 分钟内修为产出 +15%。清灵草为主料，丹香清苦，入喉微凉。',
    from: '丹房炼制（清灵草 ×2 ＋ 灵草 ×1）/ 宗门商店 / 坊市',
    usable: true,
    useHint: '点击「使用」即刻服下：现实 10 分钟修为产出 +15%（再服只刷新时长，不叠加）'
  },

  // ═══ V5.6.1 灵兽血脉线物品（C2 后续批：兽潮奖励池 → 血脉觉醒 / 化形）═══
  //   出处：设计库《灵兽兽潮与大比 v1》§1.3（血脉觉醒 / 化形）＋ §1.5「奖励池：
  //   妖丹、灵兽蛋、觉醒石、"兽王精华"——兽潮是灵兽养成的主水源」。
  //   两件都只从兽潮出（大比 §2.3 奖励表已定，本批不加），保证「兽潮是主水源」的口径。
  {
    id: 'mat_juexingshi',
    name: '觉醒石',
    icon: '觉醒',
    type: 'material',
    unit: '枚',
    quality: 'zhen',
    desc: '妖兽血脉里凝出的一点本源，兽潮退去时偶有遗落。以之引动灵兽血脉，' +
      '或可跃入更高一档（凡→灵→王→皇）：成功 25%，每失败一次成率 +10%。' +
      '王品欲登皇品，非「兽王精华」不可。',
    from: '兽潮抵御（前列 3 枚 / 中坚 2 枚 / 参与 1 枚）',
    usable: false,
    useHint: '灵兽面板「觉醒」按钮消耗（V5.6.1 已实装）'
  },
  {
    id: 'mat_shouwangjinghua',
    name: '兽王精华',
    icon: '兽王',
    type: 'material',
    unit: '滴',
    quality: 'jue',
    desc: '兽王陨落时精血所凝的一滴琥珀色精华，唯有击退高波者方可得见。' +
      '王品血脉欲登皇品，非它不可；王品以上灵兽化形，亦需一滴为引。',
    from: '兽潮抵御（前列 12% / 中坚 4%）',
    usable: false,
    useHint: '血脉觉醒（王→皇）与化形的门票：觉醒时成功才扣，化形时一次性扣（V5.6.1 已实装）'
  },

  // ═══ V5.2.2 世界机制 · 雷淬线物品（A4a-补：青岚界「小天劫」考核的专属产物）═══
  //   主人 2026-09-19 拍板（看板「待拍板」A3 §5 项 2 转正）：设计原文「过则得雷淬资源」
  //   本为新增资源，A3 批为不动未认领文件，暂以既有 mat_kuang（玄铁矿）承载；
  //   本批转正为独立材料，青岚小天劫奖励切到它。
  //   ⚠ 当量与玄铁矿**同**（worldMechanics.MAT_H = 1/2，即 2 份/h）——
  //     换名不换量，青岚静态日产出逐位不变（仍 1.71 h/日），故 A3/A4a 的量级断言全部原样成立。
  //   ⚠ 追加在**文件末尾**（不改既有 20 条的索引）：V5.6.1-自测 钉了 ITEMS[17] === 'pill_ningshen'。
  {
    id: 'mat_leicui',
    name: '雷淬石',
    icon: '雷淬',
    type: 'material',
    unit: '枚',
    quality: 'liang',
    desc: '小天劫雷火淬过的石髓，表面凝着细密银纹，触之隐隐发麻。' +
      '炼器时掺入可增其锋锐，也是青岚界「雷淬之礼」的凭证——外人求不来，' +
      '唯有受得住那道雷的人，才拿得到。',
    from: '青岚界 · 小天劫考核（元婴期起每 7 日一次，战力过关者得 ×10）',
    usable: false,
    useHint: '世界机制产出（青岚界「小天劫 · 雷淬考核」）；炼器线扩容后可接入'
  },

  // ═══ V5.3 A4c 世界线 · 换界道具（界镜 / 界游符）═══
  //   出处：《设计增补 v1.2》§一.2「免费重掷 1 次；之后可用『界镜』道具重掷（每日限购 1 次）」
  //        ＋ §一.4「使用『界游符』可换界（熟练度重置），换界后首个轮回获『界游之礼』」。
  //   价格 / 每日限购 / 界游之礼表**不在本文件**：见 data/worldMechanics.js 的 `WORLD_TRAVEL` 参数块。
  //   ⚠ `usable: false` 是**刻意**的：行囊面板（BagPanel）的「使用」是**按 id 硬编码分支**的，
  //     未登记 id 会落到兜底 `H.doReroll()`（灵根重掷流程）→ 误触即换灵根。
  //     故本二件一律不走行囊，改在世界日常面板（WorldPanel）里用（与 V5.6.1 觉醒石 / 兽王精华同法）。
  {
    id: 'treasure_jiejing',
    name: '界镜',
    icon: '界镜',
    type: 'treasure',
    unit: '枚',
    quality: 'zhen',
    desc: '镜面不照人，只照界。持镜闭目一照，再看窗外时，山川灵气已换了另一副脾性。' +
      '界与界之间本来无路，照过的人多了，便有了这条「重掷」的捷径。',
    from: '世界日常面板「兑 界 镜」（每日限购 1 件 · 按 h 当量计灵石）',
    usable: false,
    useHint: '在世界日常面板（顶栏世界徽记 →「进 此 界 · 日 常」）里点「用界镜重掷」'
  },
  {
    id: 'talisman_jieyou',
    name: '界游符',
    icon: '界游',
    type: 'talisman',
    unit: '张',
    quality: 'jue',
    desc: '一道以界为纸、以游为墨的符。焚符者不入轮回，只把此生这一「界」的熟练尽数褪去，' +
      '换一处天地重头再来——换界之后头一个轮回，天地自会补一份「界游之礼」。',
    from: '世界日常面板「兑 界 游 符」（按 h 当量计灵石）',
    usable: false,
    useHint: '在世界日常面板里点「换 界」（熟练度清零；另得一份「界游之礼」）'
  }
]

/**
 * ── 物品库三视图（V7.1）────────────────────────────────────────────────────
 *   `ITEMS`        基础表 **23 条**（位置与数值冻结；既有测试的条数 / 索引钉都钉在它身上）
 *   `COMMON_ITEMS` 公用库 **120 条** ＝ 基础表 23 ＋ 公用新增 97（`itemLibrary.js`）
 *   `WORLD_ITEMS`  各界专属库 **384 条** ＝ 12 界 × 32（`itemLibraryWorld.js`，`worldId` 必填）
 *   `ALL_ITEMS`    全量 **504 条** ＝ 公用 ＋ 专属
 * `ITEM_MAP` / `getItem` **走全量**，故丹房 / 宗门商店 / 坊市 / 秘境 / 灵兽 / 世界机制 / 成就
 * 等既有消费点**无需任何改动**即可解析新物品（老档的 `state.inventory.items` 键位不增不减）。
 */
export const COMMON_ITEMS = [...ITEMS, ...COMMON_NEW]
export const ALL_ITEMS = [...COMMON_ITEMS, ...WORLD_ITEMS]

/** id → 物品定义（全量真源视图；id 唯一性由 `V7.1-自测` 兜住） */
export const ITEM_MAP = ALL_ITEMS.reduce((acc, it) => {
  acc[it.id] = it
  return acc
}, {})

/** 世界归属：公用库 → `null`；专属库 → 该界 worldId */
export function worldOf (item) { return (item && item.worldId) || null }

/** 纯函数：按类型过滤（`type` 省略＝返回全量副本） */
export function libByType (type, list = ALL_ITEMS) {
  return type ? list.filter((x) => x.type === type) : list.slice()
}

/** 纯函数：按世界过滤（`worldId` 省略 / null → 公用库） */
export function libByWorld (worldId, list = ALL_ITEMS) {
  return list.filter((x) => worldOf(x) === (worldId || null))
}

/** 纯函数：库计数（自测与面板脚注共用）· `perWorld` 只统计各界专属库 */
export function libCounts () {
  const perWorld = {}
  for (const x of WORLD_ITEMS) perWorld[x.worldId] = (perWorld[x.worldId] || 0) + 1
  return { total: ALL_ITEMS.length, common: COMMON_ITEMS.length, base: ITEMS.length, perWorld }
}

/** 各界专属库本体与分组（转发 `itemLibraryWorld.js` 的常量，便于展示层与自测一处引用） */
export { WORLD_ITEMS, WORLD_ITEM_GROUPS }

/** 计数器单位：未登记类型回退「份」 */
export function getUnit (item) {
  return (item && item.unit) || ITEM_UNIT[(item && item.type) || 'material'] || ''
}

/** 取物品定义；未登记的 id 返回一个兜底对象（老档/新道具不至于崩） */
export function getItem (id) {
  return ITEM_MAP[id] || { id, name: id, type: 'material', quality: 'fan', desc: '未登记物品', from: '—', usable: false }
}

/** 五类型分栏顺序（行囊网格与自测共用；键序与 ITEM_TYPE_NAME 一致 · V7.1） */
export const ITEM_TYPE_ORDER = ['pill', 'material', 'treasure', 'talisman', 'fragment']

/**
 * 可在行囊内直接使用的物品（**唯一真源** · V7.1 使用白名单）。
 * 值＝行为键，由行囊面板映射到具体执行函数；**未登记者一律不渲染「使用」键**。
 * ⚠ 这是对旧实现的硬修：旧「使用」键按 id 硬编码且**兜底回落 `H.doReroll()`（灵根重掷）**，
 *   物品库扩容到 504 条后，未登记物品一旦被点到就会把灵根洗掉——
 *   改为白名单后，结构上不可能再落到兜底（`BagPanel` 已删除该分支）。
 */
export const USE_ACTIONS = {
  pill_xisui: 'reroll-root',           // 洗髓丹：洗髓重掷（经 helpers 回调触发）
  pill_ningshen: 'buff-ningshen',      // 凝神丹：现实 10 分钟修为产出 +15%
  talisman_jiangling: 'buff-jiangling' // 降灵符：现实 5 分钟修为产出 +10%
}

export default { ITEMS, ITEM_MAP, ITEM_TYPE_NAME, ITEM_UNIT, getItem, getUnit }
