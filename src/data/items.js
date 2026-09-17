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
    type: 'pill',
    quality: 'liang',
    // 写明炼制材料（主人 2026-09-17：「丹药的说明也要写清怎么来的，哪两种材料」）
    desc: '冲关破境之物：×3 / ×6 重小瓶颈必需。丹房炼制需灵草 ×3 ＋ 玄铁矿 ×1（成丹率 90%），缺丹时冲关会自动开炉。',
    from: '炼丹 / 首个瓶颈宗门相赠 / 事件',
    usable: false,
    useHint: '小瓶颈冲关时自动消耗 1 枚（2.2 已实装）'
  },
  {
    id: 'pill_hujie',
    name: '护劫丹',
    type: 'pill',
    quality: 'zhen',
    desc: '渡劫时服下，单道天雷通过率 +10%（高级 +15%）。',
    from: '炼丹 / 秘境',
    usable: false,
    useHint: '渡劫前在「渡劫」面板服下：单雷通过率 +10%（2.5 已实装）'
  },
  {
    id: 'pill_xisui',
    name: '洗髓丹',
    type: 'pill',
    quality: 'zhen',
    // 明码标价（主人 2026-09-17 / 09-18 要求）：每档的修炼速度与概率都写清，
    // 并写明"重掷只会变好不会变差"
    desc: '重铸灵根之丹。各档修炼速度：伪灵根 ×0.85 ｜ 真灵根 ×1.15 ｜ 变异 ×1.50 ｜ 天灵根 ×2.00；' +
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
    type: 'pill',
    quality: 'zhen',
    desc: '续命之物：+50 年（高品 +500 年）。',
    from: '炼丹 / 事件',
    usable: false,
    useHint: '阶段二随炼丹系统实装'
  },
  {
    id: 'treasure_zhenlei',
    name: '镇雷法宝',
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
    type: 'material',
    quality: 'fan',
    desc: '炼丹主料，产自灵田与秘境。',
    from: '挂机偶得 / 秘境 / 灵田',
    usable: false
  },
  {
    id: 'mat_kuang',
    name: '玄铁矿',
    type: 'material',
    quality: 'fan',
    desc: '炼器与法宝强化材料，亦入丹方。',
    from: '挂机偶得 / 秘境 · 矿脉',
    usable: false
  },
  {
    id: 'mat_yaodan',
    name: '妖丹',
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
    type: 'material',
    quality: 'liang',
    desc: '生于灵田背阴处的低阶灵药，叶背有淡淡清气流转。药性清润不燥，是凝神丹的主料。',
    from: '宗门任务 / 宗门商店 / 秘境 · 灵圃',
    usable: false
  },
  {
    id: 'mat_yaohu',
    name: '妖兽精血',
    type: 'material',
    quality: 'liang',
    desc: '妖兽心头一滴精血，趁气血方刚时取下最宜。炼丹炼体皆用，喂养灵兽时兑一分水也是大补。',
    from: '宗门任务 · 除妖 / 宗门商店 / 秘境 · 妖兽',
    usable: false
  },
  {
    id: 'mat_wannianru',
    name: '千年灵乳',
    type: 'material',
    quality: 'zhen',
    desc: '石髓千年凝成的一汪乳白灵液，天地精华所钟。上品丹方的药引，一滴可换一城——可惜保不住，见风即散。',
    from: '秘境深处 / 坊市拍卖 / 宗门商店（贵）',
    usable: false
  },
  {
    id: 'mat_fuzhi',
    name: '灵纹符纸',
    type: 'material',
    quality: 'fan',
    desc: '符修绘符的底纸，以灵植纤维压制而成，自带一缕天然灵纹。符箓线实装前暂作通货流通。',
    from: '宗门商店 / 坊市',
    usable: false
  },
  {
    id: 'pill_ningshen',
    name: '凝神丹',
    type: 'pill',
    quality: 'liang',
    desc: '服之凝神静气、灵台清明：现实 10 分钟内修为产出 +15%。清灵草为主料，丹香清苦，入喉微凉。',
    from: '丹房炼制（清灵草 ×2 ＋ 灵草 ×1）/ 宗门商店 / 坊市',
    usable: true,
    useHint: '点击「使用」即刻服下：现实 10 分钟修为产出 +15%（再服只刷新时长，不叠加）'
  }
]

/** id → 物品定义 */
export const ITEM_MAP = ITEMS.reduce((acc, it) => {
  acc[it.id] = it
  return acc
}, {})

/** 计数器单位：未登记类型回退「份」 */
export function getUnit (item) {
  return (item && item.unit) || ITEM_UNIT[(item && item.type) || 'material'] || ''
}

/** 取物品定义；未登记的 id 返回一个兜底对象（老档/新道具不至于崩） */
export function getItem (id) {
  return ITEM_MAP[id] || { id, name: id, type: 'material', quality: 'fan', desc: '未登记物品', from: '—', usable: false }
}

export default { ITEMS, ITEM_MAP, ITEM_TYPE_NAME, ITEM_UNIT, getItem, getUnit }
