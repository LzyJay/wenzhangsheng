/**
 * storyEndings.js —— 终局演出与转世口径（只读配置层）（V6.7 · 批 E）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《提炼-剧情发展路线》§四 各世界路线卡的「ending」段 + §五 转世口径。
 *
 * 三件事（都在本文件，**不改数值骨架**）：
 *   ① `ENDING_SHOWS` —— 12 界各自的**终局演出**（标题 / 场景旁白 / 收束句 / 继承说明）。
 *      `story.js` 的 `ending.text` 是「设计口径句」（如「同界轮回，熟练度 +3%/世」），
 *      演示给玩家看需要的是**叙事**，故此处另备一层演出文案（两者并存、不互相替代）。
 *   ② `REBIRTH_MODES` —— 两种转世（同界轮回 / 换界转世）的说明文案。
 *   ③ `MASTERY_MUL` —— 各界「转世奖励系数」：默认 1；青云「剑意超脱」= 1.2（friction 写明 +20%）；
 *      无缺「九世凝一身」= 1.5（rebirthHook 写明「继承比例可高于它界」）。
 *      实现方式：先走既有 `WorldSystem.onRebirth()`（+3%/世，口径被 V2.9/V5.3 钉死，**不改**），
 *      再按本系数补足差额（仍封顶 `MASTERY.cap`）——是**加法补足**，不改既有方法语义。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 两种转世方式（面板文案；实际动作见 systems/RebirthSystem.js） */
export const REBIRTH_MODES = [
  {
    id: 'same',
    name: '同界轮回',
    desc: '留在本界重开一世：熟练度 +3%/世（封顶 +15%），纪事、成就、熟练度与跨界资产全部保留。',
    keep: '本界灵根、熟练度、纪事与成就'
  },
  {
    id: 'other',
    name: '换界转世',
    desc: '去另一个界重开：熟练度清零、专属机制状态重置、灵根重抽（纪事与成就仍保留）。',
    keep: '纪事与成就（世界侧全部重来）'
  }
]

/** 各界转世奖励系数（熟练度倍率；默认 1） */
export const MASTERY_MUL = {
  qingyun: 1.2,   // 「剑意超脱」：满级转世奖励 +20%（worlds.js friction）
  wuyuan: 1.5     // 「九世凝一身」：继承比例可高于它界（rebirthHook）
}

/** 12 界终局演出 */
export const ENDING_SHOWS = {
  qinglan: {
    title: '羽化登仙',
    scene: '最后一道雷落下时，你没有回头看山门。云梯从天上垂下来，像当年那卷无人肯要的无名口诀一样朴素。',
    line: '这一世的账，你算得比谁都清楚。',
    inherit: '同界轮回 · 熟练度 +3%/世（封顶 +15%）；前期伪灵根惩罚仍在，故洗髓价值更高。'
  },
  poxiao: {
    title: '踏天',
    scene: '天有九重，你一层一层踏上去。路的尽头没有敌人，只有一个等了很久的人——雪落下来，你终于不必再走。',
    line: '走了数千年，为的就是这一场雪。',
    inherit: '同界轮回 · 熟练度 +3%/世；天逆珠每世重发一枚（渡劫失败免罚一次）。'
  },
  denghuo: {
    title: '终局回山',
    scene: '仗打完了，天还是那个天。你回到那座发育不良的小山头，炉上那锅汤还温着——师妹把它一直煨着，等你回来。',
    line: '这才是长生。',
    inherit: '同界轮回 · 熟练度 +3%/世；产出 ×0.90 不变，山门例课与功德簿照旧。'
  },
  qingyun: {
    title: '剑意超脱',
    scene: '此界无飞升。最后一式过后，剑还在，人已不在。门派把你的剑供在祠堂最高处，牌位上写着两个字：超脱。',
    line: '最笨的那个弟子，把剑留给了所有人。',
    inherit: '同界轮回 · **转世奖励 +20%**（熟练度 +3.6%/世）；剑冢剑阶是跨界资产。'
  },
  wangzu: {
    title: '传承',
    scene: '你把手里的古镜交出去那天，族里最小的那个孩子接住了它。祠堂外的石碑上，你的名字排在祖父后面，往后还会有人接着往上刻。',
    line: '一个人走不完的路，一个姓可以。',
    inherit: '同界轮回 · 熟练度 +3%/世；符种天赋（灵根保底）每世保留。'
  },
  younuo: {
    title: '言出法随',
    scene: '你终于把那句话说出了口。规矩听懂了，世界就照着你说的样子重新长了一遍——代价早付过了，此刻反而轻。',
    line: '这条路是你选的，你认。',
    inherit: '同界轮回 · 熟练度 +3%/世；高收益 ×1.20 与心魔 ×2、寿元 ×1.25 照旧。'
  },
  tongtian: {
    title: '长生花',
    scene: '岁月长河上那两朵花，你摘了一朵。另一朵还开着，开在你没讲完的那个故事里。',
    line: '一念之间，便是永恒。',
    inherit: '同界轮回 · 熟练度 +3%/世；天道档风险自选不变。'
  },
  tiangong: {
    title: '断丝',
    scene: '你扯断了那根丝。台下的木偶们愣住了，然后一个一个，也把手抬了起来。',
    line: '从今往后，剧本自己写。',
    inherit: '同界轮回 · 熟练度 +3%/世；傀儡挂机位按机关坊等级部分保留。'
  },
  liumian: {
    title: '自创新境',
    scene: '你给自己定了一个新境界。榜上还没有这一档，执事殿连夜刻了一块新木牌——从今天起，有人照着你的名字往上爬。',
    line: '规则是人写的，那就再写一条。',
    inherit: '同界轮回 · 熟练度 +3%/世；产出 ×1.10 照旧。'
  },
  jiuding: {
    title: '功德圆满',
    scene: '此界不许飞升。人皇殿前站了一整天，来的人比想象中多——他们不是来送仙人的，是来送一个把路修好了的人。',
    line: '不必飞升，这条路已经通了。',
    inherit: '同界轮回 · 熟练度 +3%/世；功德折扣与熟练度均可继承部分。'
  },
  wuyuan: {
    title: '出世',
    scene: '此界不设飞升。你把自己最强的那一道化成了一方山与海，人人可练。然后你带着人走了——像来时那条河上的一片帆，不留名字。',
    line: '九世凝一身，这一世终于合一。',
    inherit: '同界轮回 · **继承比例高于它界**（熟练度 ×1.5 系数）；每世保留一部分，第九世合一。'
  },
  xianghuo: {
    title: '传承',
    scene: '二十年游历走完，你回到山门。师父不在了，老八哥不在了，那道山门还在。你把符箓一张一张交出去，像当年交到你手上一样。',
    line: '人不在了，香火还在。',
    inherit: '同界轮回 · 熟练度 +3%/世；香火庙宇按既有第二产线规则延续。'
  }
}

/** 未登记界（或未抽定）的兜底演出 —— 保证任何情况下都有闭幕词 */
export const ENDING_FALLBACK = {
  title: '一世终了',
  scene: '这一世走完了。山门、故人、旧账，都被时间收进了一卷册子里。',
  line: '合上书，还能再开一世。',
  inherit: '同界轮回 · 熟练度 +3%/世（封顶 +15%）。'
}

/** 取某界的终局演出；未登记 / 空值时返回兜底（不抛错） */
export function endShowOf (worldId) {
  return ENDING_SHOWS[worldId] || ENDING_FALLBACK
}

/**
 * V6.8 批 F：各界「转世特色继承」的**集中口径**（`story.js` 的 `rebirthHook` 在此落成数值）。
 *   `world` = 只有该界才发（null = 任何界都可累积的跨世资产）；
 *   数值写在此处，系统侧只读不算（RebirthSystem 结算、CultivationSystem / DungeonSystem / main.js 消费）。
 */
export const LEGACY = {
  tiannizhu: {
    world: 'poxiao',
    perLife: 1,
    label: '天逆珠',
    desc: '每世重发 1 枚：渡劫失败免罚一次（本界天劫 +10% 摩擦的补偿）。'
  },
  rootFloor: {
    world: 'wangzu',
    rarity: 'true',
    label: '符种',
    desc: '同界轮回起手不低于真灵根 —— 族脉之赐，不必洗髓。'
  },
  gongde: {
    world: null,
    carryPct: 0.35,
    fullAt: 500,
    maxCut: 0.20,
    cap: 500,
    label: '功德',
    desc: '本界功德按 35% 结转跨世；每 500 点折突破成本 −20%（封顶）。'
  },
  puppetSlots: {
    world: 'tiangong',
    max: 2,
    label: '傀儡位',
    desc: '按本界世数保留傀儡挂机位（第 N 世 +N−1，最多 +2）。'
  },
  powerPct: {
    world: 'denghuo',
    value: 0.10,
    label: '藏拙',
    desc: '转世保留 10% 隐性战力 —— 不出头，也不落空。'
  }
}

/** 该界的继承说明行（面板展示用；无特色继承的界返回 []，但通用项「功德」总在内） */
export function legacyLinesOf (worldId) {
  const out = []
  for (const k of Object.keys(LEGACY)) {
    const it = LEGACY[k]
    if (it.world === worldId || it.world === null) out.push({ key: k, label: it.label, desc: it.desc })
  }
  return out
}

/** 取某界的转世奖励系数（默认 1） */
export function masteryMulOf (worldId) {
  const v = MASTERY_MUL[worldId]
  return (typeof v === 'number' && v > 0) ? v : 1
}

export default { REBIRTH_MODES, MASTERY_MUL, ENDING_SHOWS, ENDING_FALLBACK, endShowOf, masteryMulOf }
