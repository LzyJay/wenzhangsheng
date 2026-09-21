/**
 * worldMechanics.js —— 各世界专属机制（只读配置层）（V5.2 首批三界 + V5.2.1 A4a 铺量 · **12 界全实装**）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《设计增补 v1.2》§二 十二世界卡池总表 + §三 世界详情卡（01~12 全 12 张）；
 *       展示口径的 exclusive / friction 一律照抄 src/data/worlds.js 同名字段原文（两处漂移由自测盯）。
 * 归属：设计库**内容批次 2/3（世界篇）**；V5.2 首批三界样板 → A4a 照同一「一界一个参数块」模板铺满余 9 界
 *   （破晓星域 / 观云界 / 幽傩界 / 通天界 / 天工界 / 六面囚笼 / 九鼎九州 / 无缺古界 / 人间香火）——
 *   **只动本文件，面板与世界机制系统零改动**（A4a 自测据此断言）。
 *
 * 设计原则（增补 v1.2 §一.5 平衡护栏）：专属机制**不得绕过 72 级骨架**——只做加速 / 旁路 / 兑换，
 *   不做跳级；产出不发境界，只给灵石与既有材料（法宝成长给战力乘区，走 main.js 接线）。
 *
 * ── 本文件的形状（A4a 铺量模板：新增一界只需在此追加一个块）─────────────────
 *   WORLD_MECHANICS[<worldId>] = {
 *     id, name,                       // 与世界卡池同 id / 同对外名
 *     source,                         // 设计出处（回执与面板脚注都引它）
 *     exclusive, friction,            // 展示文案（照 worlds.js 原文）
 *     acts: [ … ],                    // 面板动作行；一行一个按钮
 *     points?: { <key>: { name, unit } },   // 本界内部计分（族贡 / 剑意…），面板显示名
 *     frictionRule: { … }             // 摩擦项口径：只展示 / 已在别处生效（展示联动）/ 可开关
 *   }
 *   act = {
 *     id, kind, label, note,          // kind: 'grant'（默认）｜'check'（战力校验）｜'refine'（升阶）
 *     cycleDays,                      // 周期（游戏天）；缺省 = MECH.dayGameDays（现实 1 日）
 *     unlockRealm?,                   // 门槛（REALM_META 下标：3 元婴 …）
 *     quota?: { base, perRank },      // 每周期可用次数（职级越高越多）
 *     cost?: { h?, mats?, <point>? }, // 支出：h 当量灵石 / 材料 / 内部计分
 *     gain?: { h?, mats?, <point>? }, // 收入：同上；h 可被 hPerSkillLevel × 剑阶 放大
 *     hPerSkillLevel?,                // 产出微加成：gain.h × (1 + hPerSkillLevel × 剑阶)
 *     needPowerMul?,                  // kind='check'：需求战力 = 该倍数 × 当前境界基准战力
 *     maxLevel?, powerPctPer?, ratePctPer?   // kind='refine'：升阶上限与每阶加成
 *   }
 *   内部计分用「键名 + 数字」自由扩展：cost/gain 里出现的、不属于 h/mats 的键，一律按计分处理。
 *
 * ── 量级口径（开发册 §七 护栏 + §6.3 归因复核报告同口径）────────────────────
 *   · 1 h 当量 = stoneHourly(level) 灵石（data/events.js，与事件 / 秘境 / 灵兽同一把尺）
 *   · 材料按秘境产出率折当量（data/dungeon.js RESOURCE_DUNGEONS.matPerH）：灵草 3 份/h、
 *     玄铁 2 份/h、妖丹 1 份/h、残页 1.2 份/h —— MAT_H 即其倒数
 *   · 轮长统一走 gametime（1 现实分钟 = 1 游戏天）：MECH.dayGameDays = 1440 游戏天 = 现实 1 日
 *   · 静态日产出见 staticDailyH()；结论（L47 静态，派遣线 0.9 h/h ≈ 992 灵石/h）：
 *       V5.2 首批三界：青岚 ≈ 1.71h/日（0.071 h/h ≈ 派遣线 7.9%）· 青云 ≈ 0.33~1.18h/日 ·
 *         望族 ≈ 0.42~1.60h/日（取决于职级与抽成开关）；
 *       V5.2.1 铺量九界（满配静态）：幽傩 3.00 · 无缺（原 武元）2.80 · 六面 2.50 · 通天 2.00 · 天工 2.00 ·
 *         观云 1.80 · 九鼎 1.70 · 破晓 1.63 · 香火 1.23（h/日）。
 *   · 护栏：单界 ≤ MECH.dailyHCap（4 h/日）；12 界里最大者幽傩 3.00 h/日 = 0.125 h/h ≈ 派遣线 13.9%，
 *     **全部远低于招牌线（V5.1 发现的 62~78 倍）**，且同一时刻只有一界机制在生效（世界唯一）。
 *   · ⚠ 支出口径（A3 已定，A4a 沿用）：staticDailyH() 只折 h 与计分支出，**材料支出不计**——
 *     凡以 mats 作耗材的动作（本批只有无缺「炼丹」）静态净额偏乐观，故该动作另收一笔 h 兜底
 *     （真实净额 ≈ 静态 − 1h 妖丹，见回执-A4a §4 对照表）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { stoneHourly } from './events.js'
import { gameDaysToMs, periodKeyOf, msToNextPeriod } from './gametime.js'
import { getLevelInfo } from './realms.js'
import { getWorld } from './worlds.js'
import { getItem } from './items.js'

/** 材料 → 当量 h（倒数即秘境 matPerH；见文件头「量级口径」） */
export const MAT_H = {
  mat_lingcao: 1 / 3,     // 灵药谷 3 份/h
  mat_kuang: 1 / 2,       // 玄铁矿洞 2 份/h
  mat_leicui: 1 / 2,      // V5.2.2 起：青岚小天劫专属产物（雷淬石）。**与玄铁矿同当量**——
                          // 换名不换量，青岚静态日产出逐位不变（仍 1.71 h/日），量级断言原样成立
  mat_yaodan: 1,          // 万兽林 1 份/h
  frag_canjuan: 1 / 1.2   // 古修遗迹 1.2 份/h
}

/** 全局旋钮（只改这一处） */
export const MECH = {
  dayGameDays: 1440,        // 「现实 1 日」＝ 1440 游戏天（1 现实分钟 = 1 游戏天）
  weekGameDays: 10080,      // 「现实 7 日」（青岚小天劫，照增补 §三 01「每隔 7 天」）
  /**
   * 内部计分折率：1 h 当量灵石 ↔ 15 点。**只对「可花灵石买到 / 可换回灵石」的计分生效**
   * （望族族贡：纳贡 2h 买 30 点、兑换 30 点换 2.4h）——只用于量级核算，不参与真实结算。
   * 纯成长型计分（青云剑意：只进不出、无灵石购买路径）不入估值，避免把"进度"算成"财富"。
   */
  pointPerH: 15,
  /** 单界机制静态日产出护栏（当量 h/日）；12 界一律按此断言（L47 派遣线 0.9h/h = 21.6h/日） */
  // V7.3（主人 2026-09-22 拍板 D1/D6）：单界静态日产出上限 **4 → 10 当量 h/日**
  //   —— 先实现功能、后做平衡（§七 占比收紧与数值收口留待统一平衡轮）
  dailyHCap: 10
}

/** 望族山河 · 家族职权（增补 §三 05「外门→内门→族正院→族长：职权越高，抽成越低、福利越多」） */
export const WANGZU_RANKS = [
  { idx: 0, id: 'waimen', name: '外门', donated: 0, rate: 0.10 },
  { idx: 1, id: 'neimen', name: '内门', donated: 60, rate: 0.08 },
  { idx: 2, id: 'zuzhengyuan', name: '族正院', donated: 200, rate: 0.06 },
  { idx: 3, id: 'zuzhang', name: '族长', donated: 500, rate: 0.04 }
]

/** 职级门槛折扣（抽成「上缴」档的家族权益：升职更快） */
export const RANK_DISCOUNT_ON = 0.9

/**
 * 十二界的专属机制参数（12 界全实装：V5.2 首批 3 界 + V5.2.1 A4a 铺量 9 界）
 * ⚙ 所有数值旋钮都在这里；WorldMechanicSystem 不另立数值。
 * ⚠ 九界铺量只用「已登记的口径」：kind ∈ grant / check / donate / exchange（**不用 refine**——
 *   升阶型战力微加成 currently 只接线了青云「剑冢」，见 WorldMechanicSystem.powerPct）；
 *   摩擦项一律 kind:'mark'（只登记展示，**不新增可开关项**——加开关要动系统分支，越出本文件认领面）。
 */
export const WORLD_MECHANICS = {
  // ══ 01 · 青岚界（《凡人修仙传》）════════════════════════════════════════
  qinglan: {
    id: 'qinglan',
    name: '青岚界',
    source: '《设计增补 v1.2》§二 总表 #1 · §三 详情卡 01',
    exclusive: '元婴后定期「小天劫」考核（过则得雷淬资源）；「掌天瓶」催熟灵田',
    friction: '伪灵根突破成本 +10%（洗髓价值更高）',
    acts: [
      {
        id: 'qinglan_ripening',
        kind: 'grant',
        label: '掌天瓶 · 催熟灵田',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 01：「掌天瓶道具线（花灵石催熟灵田下一季产出）」——灵石 → 灵草 的偏利兑换
        cost: { h: 3 },
        gain: { mats: [{ id: 'mat_lingcao', n: 12 }] },
        note: '花灵石引地脉灵气，催熟灵田下一季：一次入库一季灵草（约合 4h 当量）。'
      },
      {
        id: 'qinglan_small_trial',
        kind: 'check',
        label: '小天劫 · 雷淬考核',
        unlockRealm: 3,                       // 元婴（增补 §三 01「元婴期起」）
        cycleDays: MECH.weekGameDays,         // 「每隔 7 天」（增补 §三 01 原文，按现实日读）
        needPowerMul: 1.15,                   // 战力校验：需求 = 1.15 × 当前境界基准战力
        gain: { mats: [{ id: 'mat_leicui', n: 10 }] },   // V5.2.2（A4a-补）：由 mat_kuang 转正为专属材料「雷淬石」
        note: '元婴期起每 7 日一次小考：战力过关者受雷淬之礼（雷淬石 ×10），不过则本轮空过。'
      }
    ],
    frictionRule: {
      kind: 'rootCost',
      rarity: 'false',
      label: '伪灵根突破成本 +10%',
      note: '已在突破报价生效（WorldSystem.rootCostMul → worlds.js rootCost）——机制侧只做展示联动，不重复收费。'
    }
  },

  // ══ 04 · 青云古界（《诛仙》）════════════════════════════════════════════
  qingyun: {
    id: 'qingyun',
    name: '青云古界',
    source: '《设计增补 v1.2》§二 总表 #4 · §三 详情卡 04',
    exclusive: '「剑冢」法宝成长线；周期「正魔大战」事件',
    friction: '无飞升——终局改为「剑意超脱」（满级转世奖励 +20%）',
    // 剑意＝纯成长型计分（只进不出、无灵石购买路径）→ 不给 hPer，不参与量级估值
    points: { jianYi: { name: '剑意', unit: '缕' } },
    acts: [
      {
        id: 'qingyun_insight',
        kind: 'grant',
        label: '剑冢 · 参悟剑意',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 04：「收集剑意解锁法宝成长线」——参悟本身也偶有所得（灵石折算）
        gain: { jianYi: 10, h: 1, hPerSkillLevel: 0.02 },
        note: '在剑冢中听剑、看剑、忘剑：得剑意，偶有所悟折作灵石（每阶法宝 +2%）。'
      },
      {
        id: 'qingyun_refine',
        kind: 'refine',
        label: '剑冢 · 祭炼法宝',
        cycleDays: 3 * MECH.dayGameDays,   // 攒够 30 缕剑意（参悟 10 缕/日）→ 每 3 日可祭炼一次
        cost: { jianYi: 30, h: 2 },
        maxLevel: 9,
        powerPctPer: 0.005,   // 战力微加成 +0.5%/阶（走 main.js 战力乘区接线）
        ratePctPer: 0.02,     // 产出微加成：剑冢线自身产出 +2%/阶
        note: '以剑意祭炼本命法宝：每阶战力 +0.5%、剑冢产出 +2%，九阶封顶。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '无飞升 · 终局「剑意超脱」',
      note: '已实装（V6.7 批 E ＋ V6.8 批 F）：转世走 RebirthSystem；本界熟练度按 ×1.2 结算（+3.6%/世，封顶仍 15%）——对齐「满级转世奖励 +20%」。'
    }
  },

  // ══ 05 · 望族山河（《玄鉴仙族》）════════════════════════════════════════
  wangzu: {
    id: 'wangzu',
    name: '望族山河',
    source: '《设计增补 v1.2》§二 总表 #5 · §三 详情卡 05',
    exclusive: '家族职权（族贡换资源）；「符种天赋」开局灵根保底真灵根',
    friction: '族贡抽成 10%（资源上缴换家族权益）',
    // hPer：可折当量 h 的计分（族贡可花灵石买入、也可换回灵石 → 参与量级估值）
    points: { tribute: { name: '族贡', unit: '点', hPer: 1 / MECH.pointPerH } },
    acts: [
      {
        id: 'wangzu_tribute',
        kind: 'donate',
        label: '族贡 · 纳贡',
        cycleDays: MECH.dayGameDays,
        quota: { base: 1, perRank: 1 },       // 每现实日 1 + 职级序 次
        cost: { h: 2 },
        gain: { tribute: 30 },
        note: '以灵石上缴族库换族贡（1h 当量 ↔ 15 族贡）；职级越高，每日纳贡额度越大。'
      },
      {
        id: 'wangzu_exchange',
        kind: 'exchange',
        label: '家族职权 · 兑换',
        cycleDays: MECH.dayGameDays,
        quota: { base: 1, perRank: 1 },
        cost: { tribute: 30 },
        gain: { h: 2.4 },                     // 族贡支取族中资源：+20% 折让
        note: '以族贡支取族中资源（+20% 折让）；抽成开则按职级上缴该笔产出，上缴额回流族贡。'
      }
    ],
    ranks: WANGZU_RANKS,
    frictionRule: {
      kind: 'tribute',
      toggle: true,
      defaultOn: true,
      label: '族贡抽成',
      note: '「上缴」＝按职级抽成（外门 10% / 内门 8% / 族正院 6% / 族长 4%），上缴额按 15 族贡/h 回流、职级门槛 −10%；' +
        '「免缴」＝全额到手，但无回流、无门槛折扣。'
    }
  },

  // ══ 02 · 破晓星域（《仙逆》）════════════════════════════════════════════
  poxiao: {
    id: 'poxiao',
    name: '破晓星域',
    source: '《设计增补 v1.2》§二 总表 #2 · §三 详情卡 02',
    exclusive: '因果事件链密度 ×1.5；「天逆珠」渡劫失败免罚一次（每世 1 枚）',
    friction: '天劫需求战力 +10%',
    acts: [
      {
        id: 'poxiao_nitian',
        kind: 'grant',
        label: '逆天 · 夺机缘',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 02：「逆天」选项收益 +10% —— 以「一线灵石推演因果、逆天取之」承载
        cost: { h: 1 },
        gain: { h: 2.2 },
        note: '推演因果、逆天取之：以一线灵石作引，得厚报（「逆天」收益 +10% 的机制侧承载）。'
      },
      {
        id: 'poxiao_tiannizhu',
        kind: 'check',
        label: '天逆珠 · 凝炼',
        cycleDays: MECH.weekGameDays,        // 「每世 1 枚」（增补 §三 02）→ 本轮按现实 7 日一轮
        needPowerMul: 1.05,
        gain: { h: 3 },
        note: '战力校验：过则凝出一枚「天逆珠」（每世 1 枚）。免罚**已接线**（V6.8 批 F）：破晓界渡劫失败时由 state.legacy.tiannizhu 免罚一次（跳过修为损失与道伤，连败计数照记）。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '天劫需求战力 +10%',
      note: '已由世界修正生效（worlds.js trialMul 1.10 → WorldSystem.trialMul → CultivationSystem.getTrialChance 需求战力 ×1.10）；机制侧只做登记展示，不重复加成。'
    }
  },

  // ══ 03 · 观云界（《我师兄实在太稳健了》）════════════════════════════
  //   原型换源（2026-09-21）：只改 label / note / exclusive / friction 的措辞，
  //   **id / kind / 成本 / 收益 / 周期 / quota 一律不动**（照无缺古界换源先例）。
  denghuo: {
    id: 'denghuo',
    name: '观云界',
    source: '《设计增补 v1.2》§二 总表 #3 · §三 详情卡 03（原型口径已换源，见剧情册 §1.6）',
    exclusive: '「山门例课」稳定灵石补差（日常任务 ×2）；「功德簿」灵石兑灵气',
    friction: '基础产出最低（×0.90），依赖例课与功德补差',
    acts: [
      {
        id: 'denghuo_renwuban',
        kind: 'grant',
        label: '山门 · 例课',
        cycleDays: MECH.dayGameDays,
        quota: { base: 2, perRank: 0 },       // 「日常任务 ×2」（增补 §三 03）
        gain: { h: 0.6 },
        note: '山门例课每日两趟（设计「日常任务 ×2」的机制侧承载）：稳定的灵石补差，正好抵此界 ×0.90 的低产出。'
      },
      {
        id: 'denghuo_lingqifei',
        kind: 'exchange',
        label: '功德簿 · 兑灵气',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 03：「1 灵石 = 10 分钟产出」——按折让口径只给小偏利，不做绕骨架的加速
        cost: { h: 1.2 },
        gain: { h: 1.8 },
        note: '以功德簿的记功折算，即时引灵气入体（原「灵气费」的机制侧承载，id 与成本收益不动）：按折让口径只给小偏利，不做绕 72 级骨架的加速。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '基础产出最低（×0.90），依赖例课与功德补差',
      note: '已在世界修正生效（worlds.js rateMul 0.90 → WorldSystem.rateMul 进产出乘区）；机制侧只做登记展示——本界机制本身就是「例课补差」。'
    }
  },

  // ══ 06 · 幽傩界（《道诡异仙》）══════════════════════════════════════════
  younuo: {
    id: 'younuo',
    name: '幽傩界',
    source: '《设计增补 v1.2》§二 总表 #6 · §三 详情卡 06',
    exclusive: '诡异资源（炼器强化 +15%）；「真幻双线」最高档事件',
    friction: '心魔事件 ×2；寿元流速 1s = 2.5 天',
    acts: [
      {
        id: 'younuo_zhenhuan',
        kind: 'check',
        label: '真幻双线 · 入幻',
        cycleDays: MECH.dayGameDays,
        needPowerMul: 1.25,                   // 全游最高档收益 → 门槛也最高（增补 §三 06「高难高收益」）
        gain: { h: 2 },
        note: '此界最高档机缘（「真幻双线」）：战力过关才接得住；不过则本轮空过、冷却照走。'
      },
      {
        id: 'younuo_guicai',
        kind: 'grant',
        label: '诡异资源 · 采撷',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 06「诡异资源（炼器强化 +15%）」——**最终口径**以既有妖丹承载「诡异残料」，
        //   不再新开材料（避免动 items.js 与既有材料表；「+15%」由下方「诡异炼器」动作体现）
        cost: { h: 1 },
        gain: { mats: [{ id: 'mat_yaodan', n: 2 }] },
        note: '采撷诡异材料（以妖丹承载「炼器强化专用料」）：付一线灵石换两份妖丹。'
      },
      {
        id: 'younuo_lianqi',
        kind: 'exchange',
        label: '诡异炼器 · 出炉',
        cycleDays: MECH.dayGameDays,
        // V6.10 批 H：「炼器强化 +15%」落地 —— 两份诡异残料入炉出一件器物，价比常规高 **+14%**。
        //   ⚠ 净额刻意压在 +0.2h/日：幽傩静态值原为 3.00h/日、护栏线 3.24h/日（派遣线 15%），
        //     留足余量才不越带（V5.2.1「九界最强仍 ≤ 派遣线 15%」）。
        cost: { h: 1.4, mats: [{ id: 'mat_yaodan', n: 2 }] },
        gain: { h: 1.6 },
        note: '以诡异残料炼器（增补 §三 06「炼器强化 +15%」）：两份妖丹入炉出一件器物，价比常规高一成四 —— 此界的器物认主，也认胆量。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '心魔事件 ×2 · 寿元流速 1s = 2.5 天',
      note: '心魔密度**已接线**（V6.9 批 G）：data/worldEvents.js 的 younuo 档把灾劫类权重 ×2、恩怨类 ×1.5（EventSystem._sampleEvent 取值）；寿元流速已生效（worlds.js lifespanMul 1.25 → WorldSystem.lifespanDays → LifespanSystem）。'
    }
  },

  // ══ 07 · 通天界（《一念永恒》）══════════════════════════════════════════
  tongtian: {
    id: 'tongtian',
    name: '通天界',
    source: '《设计增补 v1.2》§二 总表 #7 · §三 详情卡 07',
    exclusive: '「突破三档」每次大境界可选：凡道稳 / 地道标准 / 天道赌',
    friction: '天道档失败率较高（自选风险）',
    acts: [
      {
        id: 'tongtian_gudao',
        kind: 'grant',
        label: '凡道 · 稳步讲价',
        cycleDays: MECH.dayGameDays,
        gain: { h: 0.6 },
        note: '设计「凡道（成本 +5%，稳）」：不赌，每轮稳收一份天道讲价的补贴。'
      },
      {
        id: 'tongtian_tiandao',
        kind: 'grant',
        label: '天道 · 赌一把',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 07「天道：45% 省 20% 成本 + 额外奖励 / 55% 成本 +10%」
        cost: { h: 1.6 },
        gain: { h: 1.2 },
        // V6.10 批 H：真随机档位落地 —— 45% 讲成价（额外 +4h，且**下次突破成本 −20%**）/ 55% 失手（下次 +10%）
        //   期望口径：1.2 ＋ 0.45×4 ＝ 3.0h ＝ 旧「确定 3h」（**静态值守恒**，护栏带不动）
        gamble: { p: 0.45, gain: { h: 4 } },
        priceMul: { hit: 0.8, miss: 1.1 },
        note: '设计「天道」档（赌）：四成半讲成价（额外 +4h，且下次突破成本 −20%），失手则下次 +10% —— 账要后算，愿赌服输。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '天道档失败率较高（自选风险）',
      note: '属自选风险档（突破 / 渡劫链侧）；机制侧只做登记展示，不额外加罚。'
    }
  },

  // ══ 08 · 天工界（《仙工开物》）══════════════════════════════════════════
  tiangong: {
    id: 'tiangong',
    name: '天工界',
    source: '《设计增补 v1.2》§二 总表 #8 · §三 详情卡 08',
    exclusive: '「机关坊」产线（傀儡自动挂机，最多 +2 位）；三丹田三修',
    friction: '前期解锁慢（工艺门槛），中后期反超',
    acts: [
      {
        id: 'tiangong_jiguan',
        kind: 'grant',
        label: '机关坊 · 傀儡代工',
        unlockRealm: 2,                       // 金丹期起：增补 §三 08「前期解锁慢（工艺门槛）」的门槛承载
        cycleDays: MECH.dayGameDays,
        gain: { h: 1.2 },
        note: '立起机关坊、傀儡自动挂机代工（设计「最多 +2 位」）：金丹期起每日一炉产出。'
      },
      {
        id: 'tiangong_sanxiu',
        kind: 'grant',
        label: '三丹田 · 轮修',
        cycleDays: MECH.dayGameDays,
        cost: { h: 0.4 },                     // 三修先苦（前期投入）
        gain: { h: 1.2 },                     // 再甜
        note: '神海 / 气海 / 精海轮修（设计「三丹田三修」）：先付一点投入，再收产出——先苦后甜曲线的机制侧承载。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '前期解锁慢（工艺门槛），中后期反超',
      note: '机制侧以「机关坊需金丹期起」承载门槛：前期无此产线 → 偏低；金丹后叠加傀儡位 → 反超。'
    }
  },

  // ══ 09 · 六面囚笼（《谁让他修仙的！》）══════════════════════════════════
  liumian: {
    id: 'liumian',
    name: '六面囚笼',
    source: '《设计增补 v1.2》§二 总表 #9 · §三 详情卡 09',
    exclusive: '「天劫盲盒」随机爆改；假传承骗术（看破得高额灵石）',
    friction: '「神棍」事件诱惑错误选择（损失带微弱回本）',
    acts: [
      {
        id: 'liumian_manghe',
        kind: 'grant',
        label: '天劫盲盒 · 开盒',
        cycleDays: MECH.dayGameDays,
        // 增补 §三 09：「20% 强化天劫 + 额外奖励 / 30% 弱化天劫」
        cost: { h: 0.8 },
        gain: { h: 1.0 },
        // V6.10 批 H：真随机爆改 —— 五成开出好货（额外 +1.6h）；期望 1.0 ＋ 0.5×1.6 ＝ 1.8h ＝ 旧固定值
        gamble: { p: 0.5, gain: { h: 1.6 } },
        note: '开一盒，天道随便改：五成开出好货（额外 +1.6h），五成只余盒底一层灰 —— 期望与旧固定值同，风险自担。'
      },
      {
        id: 'liumian_kanchuan',
        kind: 'check',
        label: '假传承 · 看破',
        cycleDays: MECH.dayGameDays,
        needPowerMul: 1.15,
        gain: { h: 1.5 },
        note: '看破假传承骗局得高额灵石（增补 §三 09）：战力过关才认得破绽；不过则本轮空过。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '「神棍」事件诱惑错误选择（损失带微弱回本）',
      note: '属事件池侧的诱惑选项（损失带微弱回本）；机制侧只做登记展示。'
    }
  },

  // ══ 10 · 九鼎九州（《大乘期才有逆袭系统》）══════════════════════════════
  jiuding: {
    id: 'jiuding',
    name: '九鼎九州',
    source: '《设计增补 v1.2》§二 总表 #10 · §三 详情卡 10',
    exclusive: '功德系统（善行换突破折扣，最高 −20%）；人皇殿任务网',
    friction: '飞升禁用至末期（终局以「功德圆满」替代）',
    // 功德＝纯成长型计分（只进不出、无灵石购买路径；换的是突破折扣而非灵石）→ 不给 hPer，不入估值
    points: { gongde: { name: '功德', unit: '点' } },
    acts: [
      {
        id: 'jiuding_shanxing',
        kind: 'grant',
        label: '善行 · 积功德',
        cycleDays: MECH.dayGameDays,
        gain: { h: 0.5, gongde: 10 },
        note: '行善积德（设计「善行产功德」）：功德产出于此。突破折扣**已接线**（V6.8 批 F：经转世按 35% 结转，每 500 点 −20% 封顶）；「心魔规避」以「功德 · 静心」换气运承载（V6.10 批 H）。'
      },
      {
        id: 'jiuding_renhuangdian',
        kind: 'grant',
        label: '人皇殿 · 领任务',
        cycleDays: MECH.dayGameDays,
        gain: { h: 1.2, gongde: 5 },
        note: '人皇殿任务网（设计「奖励规范化」）：每日一趟，灵石与功德同收。'
      },
      {
        id: 'jiuding_jingxin',
        kind: 'exchange',
        label: '功德 · 静心',
        cycleDays: MECH.dayGameDays,
        // V6.10 批 H：功德「心魔规避」落点 —— 以气运承载（气运是唯一真源：越高则机缘越密、凶险越少）
        cost: { gongde: 30 },
        gain: { luck: 5 },
        note: '以功德静心（设计「心魔规避」）：30 点功德换气运 +5 —— 行善的人，心魔也要掂量一下。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '飞升禁用至末期（终局以「功德圆满」替代）',
      note: '已实装（V6.7 批 E ＋ V6.8 批 F）：转世走 RebirthSystem；本界功德按 35% 结转跨世，每 500 点折突破成本 −20%（CultivationSystem.gongdeCostMul）。'
    }
  },

  // ══ 11 · 无缺古界（《我欲封天》）══════════════════════════════════════
  //   11 号换源（原型改用《我欲封天》，原《没钱修什么仙？》文件已删）：id / 成本 / 收益 / 周期**一律不动**，
  //   只换对外名与文案口径，**数值零改动**。

  wuyuan: {
    id: 'wuyuan',
    name: '无缺古界',
    source: '《设计增补 v1.2》§二 总表 #11 · §三 详情卡 11（2026-09-20 换源同步）',
    exclusive: '无缺三档（有缺／无暇／无缺，走满额外收益）；赐名点化（第二产线）',
    friction: '境界细分更密（同一境亦有品相，小瓶颈 +20%）',
    acts: [
      {
        // ⚠ id 锁定（存档 / 万事系统键位，2026-09-20 换源）：只改 label / note（技炼公会炼丹 → 丹阁·炼丹），
        //   id / cost / gain / cycleDays **一律不动**，禁止按旧名回改 id。
        id: 'wuyuan_shenglian',
        kind: 'grant',
        label: '丹阁 · 炼丹',
        cycleDays: MECH.dayGameDays,
        // 换源 §11：「赐名点化第二产线」以丹道承载（本命丹炉）——本批以「妖丹入炉、出货换灵石」落地
        // ⚠ staticDailyH() 的支出口径只折 h 与计分（材料支出不计，A3 已定）→ 故实物耗材之外再收一笔 h，
        //   静态量级才不虚高（真实净额 ≈ 静态净额 − 1h 妖丹，回执-A4a §4 有对照）
        cost: { h: 0.5, mats: [{ id: 'mat_yaodan', n: 1 }] },
        gain: { h: 2.2 },
        note: '守着本命丹炉开炉炼丹：以一粒妖丹入炉，成丹自用或出货换灵石（另付半份引火灵石）。'
      },
      {
        // ⚠ 同上：id 锁定不动；label / note 为换源后新文案（倒卖 → 赐名·点化随行），成本 / 收益 / 周期零改动。
        id: 'wuyuan_daomai',
        kind: 'exchange',
        label: '赐名 · 点化随行',
        cycleDays: MECH.dayGameDays,
        cost: { h: 1.5 },
        gain: { h: 2.6 },
        note: '给器物与灵物一一赐名，使其成形听用；使唤得顺手的留下，用不上的折价换灵石。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '境界细分更密（同一境亦有品相，小瓶颈 +20%）',
      note: '属境界 / 突破链侧（三档品相与走满加成）；机制侧只做登记展示。'
    }
  },

  // ══ 12 · 人间香火（《我本无意成仙》）════════════════════════════════════
  xianghuo: {
    id: 'xianghuo',
    name: '人间香火',
    source: '《设计增补 v1.2》§二 总表 #12 · §三 详情卡 12',
    exclusive: '「香火庙宇」第二产线（建庙收香火，可换延寿与气运）',
    friction: '寿元流速 1s = 3 天（长生最难的世界）',
    // 香火＝纯成长型计分（只进不出、无灵石购买路径；换的是延寿 / 气运）→ 不给 hPer，不入估值
    points: { xianghuo: { name: '香火', unit: '缕' } },
    acts: [
      {
        id: 'xianghuo_jianmiao',
        kind: 'grant',
        label: '香火庙宇 · 收香火',
        cycleDays: MECH.dayGameDays,
        gain: { h: 0.8, xianghuo: 12 },
        note: '建庙收香火（设计「第二产线」）：每日香火入账 —— 可换**延寿**（「香火 · 续命」）与**气运**（「香火 · 祈气运」），兑换链已落地（V6.10 批 H）。'
      },
      {
        id: 'xianghuo_qiyun',
        kind: 'grant',
        label: '香火 · 祈气运',
        cycleDays: MECH.weekGameDays,
        cost: { xianghuo: 60 },
        // V6.10 批 H：兑换链落地 —— 香火真换**气运**（原先只折灵石）。
        //   ⚠ 保留 h:3：香火静态日产出与 A4a 基线**逐位守恒**（气运是叠加收益，不从灵石里扣）。
        gain: { luck: 3, h: 3 },
        note: '以香火祈气运（增补 §三 12）：七日一祈，气运 +3 —— 民心所向，天机也随之偏你一分（气运越高，机缘越密）。'
      },
      {
        id: 'xianghuo_xuming',
        kind: 'exchange',
        label: '香火 · 续命',
        cycleDays: MECH.weekGameDays,
        // V6.10 批 H：兑换链落地 —— 香火真换**寿元**（「可换延寿」，封顶本境上限）
        cost: { xianghuo: 40 },
        gain: { years: 5 },
        note: '以庙中香火续命（增补 §三 12「可换延寿」）：40 点香火换 5 年寿元（封顶本境上限）—— 此界 1 秒走 3 天，香火就是命。'
      }
    ],
    frictionRule: {
      kind: 'mark',
      label: '寿元流速 1s = 3 天（长生最难的世界）',
      note: '已生效（worlds.js lifespanMul 1.5 → WorldSystem.lifespanDays → LifespanSystem）；「天道不许长生」为生存线压力，机制侧只做登记展示。'
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// V5.3 A4c · 换界道具（界镜 / 界游符）——世界篇内容批次 2
//   来源：《设计增补 v1.2》§一.2「免费重掷 1 次；之后可用『界镜』道具重掷（每日限购 1 次）」
//        ＋ §一.4「使用『界游符』可换界（熟练度重置），换界后首个轮回获『界游之礼』（随机小机缘一次）」。
//   口径：
//     · 「每日」按**世界域既有读法**（A3 拍板项 3：1 现实日 = 1440 游戏天 = MECH.dayGameDays）；
//       与坊市「日」（30 游戏天）刻意不同源 —— 免得把「每日限购」摊成每 30 分钟一件。
//     · 换界**原子**：worldId ＋ 熟练度（masteryPct = 0 / runsInWorld = 1）＋ 专属机制两叶
//       （specialState / frictionState）一起切；招牌首通记录（dungeonState.sig）是跨界资产，**不动**。
//     · 产出不发境界：界游之礼只给灵石（h 当量）或既有材料（MAT_H 折当量），单次期望 ≈ 1.5 h 当量。
//     · 界镜与界游符**都是随机换界**（`rerollWorldIndex` 排除当前界等概率）→ 无「定向跳到高产出界」的套利。
// ═════════════════════════════════════════════════════════════════════════════
export const WORLD_TRAVEL = {
  mirrorItem: 'treasure_jiejing',        // 界镜（items.js）
  talismanItem: 'talisman_jieyou',       // 界游符（items.js）
  /** 界镜：4 h 当量/件 · **每日限购 1 件**（设计原文） */
  mirror: { priceH: 4, dailyLimit: 1 },
  /** 界游符：10 h 当量/件 · 不限购（dailyLimit 0 ＝ 不限；价格即闸门 —— 换界是随机换，无定向套利） */
  talisman: { priceH: 10, dailyLimit: 0 },
  /** 「界游之礼」＝换界后首个轮回的小机缘（增补 §一.4）；权重和必须为 1 */
  gift: {
    rolls: [
      { p: 0.5, kind: 'stones', h: 2 },                    // 灵石 2h 当量
      { p: 0.3, kind: 'mats', id: 'mat_lingcao', n: 3 },   // 灵草 ×3（＝1h 当量）
      { p: 0.2, kind: 'mats', id: 'mat_yaodan', n: 1 }     // 妖丹 ×1（＝1h 当量）
    ]
  }
}

// ── 纯函数（数据层，供 system / 面板 / 自测共用）────────────────────────────

/** 本界是否有已实装机制（V5.2.1 起 12 界全 true；未登记 id 返回 false） */
export function hasMechanics (worldId) {
  return !!WORLD_MECHANICS[worldId]
}

/** 本界机制块；未实装返回 null */
export function mechanicsOf (worldId) {
  return WORLD_MECHANICS[worldId] || null
}

/** 本界全部动作 */
export function actsOf (worldId) {
  const b = mechanicsOf(worldId)
  return b ? b.acts.slice() : []
}

/** 取某动作定义 */
export function getAct (worldId, actId) {
  return actsOf(worldId).find((a) => a.id === actId) || null
}

/** 动作周期（毫秒；缺省 = 现实 1 日） */
export function cycleMsOf (act) {
  const d = (act && act.cycleDays) || MECH.dayGameDays
  return gameDaysToMs(d)
}

/** 动作周期键（与坊市 / 兽潮同一把尺：gametime.periodKeyOf） */
export function cycleKeyOf (act, now) {
  return periodKeyOf(now, cycleMsOf(act))
}

/** 距下一周期边界（毫秒） */
export function cycleMsToNext (act, now) {
  return msToNextPeriod(now, cycleMsOf(act))
}

/** 当量 h → 灵石（与事件 / 秘境 / 灵兽同口径） */
export function stonesOfH (h, level) {
  const v = Number(h) || 0
  return Math.max(0, Math.round(stoneHourly(level) * v))
}

/** V5.3 A4c：换界道具定价（h 当量 → 灵石；与事件 / 秘境同一把尺）；kind: 'mirror' | 'talisman' */
export function travelPriceStones (kind, level) {
  const spec = WORLD_TRAVEL[kind]
  return spec ? stonesOfH(spec.priceH, level) : 0
}

/** V5.3 A4c：「每日限购」的日键（世界域读法：1 现实日 = MECH.dayGameDays 游戏天） */
export function travelDayKey (now) {
  return periodKeyOf(now, gameDaysToMs(MECH.dayGameDays))
}

/** V5.3 A4c：抽一次「界游之礼」（random 注入便于自测；返回 rolls 条目副本） */
export function rollTravelGift (r = Math.random()) {
  let acc = 0
  for (const it of WORLD_TRAVEL.gift.rolls) {
    acc += it.p
    if (r < acc) return Object.assign({}, it)
  }
  return Object.assign({}, WORLD_TRAVEL.gift.rolls[WORLD_TRAVEL.gift.rolls.length - 1])
}

/** V5.3 A4c：「界游之礼」折当量 h（量级口径 / 回执用） */
export function travelGiftH (g) {
  if (!g) return 0
  return g.kind === 'mats' ? matsHOf([{ id: g.id, n: g.n }]) : (Number(g.h) || 0)
}

/** 材料清单 → 当量 h */
export function matsHOf (mats) {
  let h = 0
  for (const m of Array.isArray(mats) ? mats : []) {
    if (!m) continue
    h += (MAT_H[m.id] || 0) * (Number(m.n) || 0)
  }
  return h
}

/** 本界内部计分键名表（cost / gain 里非 h / mats 的数值键＝计分） */
export function pointKeysOf (act) {
  const keys = []
  for (const side of [act && act.cost, act && act.gain]) {
    if (!side) continue
    for (const k of Object.keys(side)) {
      // V6.10 批 H：years（寿元）/ luck（气运）是**实物收益**，不是界内计分 —— 不参与计分折算与写入
      if (k === 'h' || k === 'mats' || k === 'years' || k === 'luck') continue
      if (typeof side[k] === 'number' && !keys.includes(k)) keys.push(k)
    }
  }
  return keys
}

/** 计分展示名（族贡 / 剑意…）；未登记回退键名 */
export function pointNameOf (block, key) {
  const p = block && block.points && block.points[key]
  return (p && p.name) || key
}

/** 动作可用次数上限（每周期）；无 quota 字段 = 不限次（只受周期约束） */
export function quotaOf (act, rankIdx) {
  if (!act || !act.quota) return null
  const base = Number(act.quota.base) || 0
  const per = Number(act.quota.perRank) || 0
  return base + per * Math.max(0, Math.round(rankIdx) || 0)
}

/** 职级门槛（抽成「上缴」档 ×0.9 → 升职更快） */
export function rankThresholdsOf (block, tributeOn = true) {
  const ranks = (block && block.ranks) || WANGZU_RANKS
  const mul = tributeOn ? RANK_DISCOUNT_ON : 1
  return ranks.map((r) => Math.round(r.donated * mul))
}

/** 由「累计纳贡」定职级（返回 WANGZU_RANKS 条目；未登记世界返回 null） */
export function rankOf (block, donated, tributeOn = true) {
  const ranks = (block && block.ranks) || null
  if (!ranks) return null
  const th = rankThresholdsOf(block, tributeOn)
  const d = Math.max(0, Number(donated) || 0)
  let hit = ranks[0]
  for (let i = 0; i < ranks.length; i++) if (d >= th[i]) hit = ranks[i]
  return hit
}

/** 抽成率（按职级；关闭抽成时返回 0） */
export function tributeRateOf (block, rankIdx, tributeOn = true) {
  if (!tributeOn) return 0
  const ranks = (block && block.ranks) || WANGZU_RANKS
  const i = Math.min(Math.max(Math.round(rankIdx) || 0, 0), ranks.length - 1)
  return ranks[i].rate
}

/** kind='check' 的需求战力（缺省 1.15 × 当前境界基准战力） */
export function needPowerOf (act, level) {
  const base = getLevelInfo(level).combat.power
  return Math.round(base * ((act && act.needPowerMul) || 1.15))
}

/** 材料清单 → 面板文案（`灵草 ×12`） */
export function matsTextOf (mats) {
  return (Array.isArray(mats) ? mats : [])
    .map((m) => (m && m.n > 0 ? `${getItem(m.id).name} ×${m.n}` : ''))
    .filter(Boolean)
    .join(' · ')
}

/** 内部计分折当量 h（仅登记了 hPer 的计分参与估值；未登记 → 0＝不折价） */
export function pointHPerOf (block, key) {
  const p = block && block.points && block.points[key]
  const v = p && p.hPer
  return Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * 静态日产出（当量 h/日）——**核算口径**，供回执量级预估与自测断言（不参与真实结算）
 *   单动作净 = 收入（gain.h × 剑阶系数 + 材料折当量 + 计分折当量）− 支出（h + 计分折当量）
 *   日化 = 净 × 每周期可用次数 × (1440 / cycleDays)
 * ⚙ 抽成（望族）刻意**不计入**：灵石扣减与族贡回流等值，静态净额不变（短期灵石少、长期升职快）。
 * @param {string} worldId
 * @param {{level?:number, rankIdx?:number, skillLevel?:number, tributeOn?:boolean}} ctx
 * @returns {{h:number, rows:Array<{id:string, netH:number, uses:number, dayH:number}>}}
 */
export function staticDailyH (worldId, ctx = {}) {
  const block = mechanicsOf(worldId)
  if (!block) return { h: 0, rows: [] }
  const rankIdx = Number.isFinite(ctx.rankIdx) ? ctx.rankIdx : 0
  const skill = Math.max(0, Number(ctx.skillLevel) || 0)
  const per = MECH.dayGameDays
  const rows = []
  let total = 0

  for (const act of block.acts) {
    // 升阶型动作封顶后不再消耗（满阶后只有收入没有支出）——否则会低估满配稳态
    if (act.kind === 'refine' && skill >= (act.maxLevel || 0)) continue
    const cyc = (act.cycleDays || per)
    const q = quotaOf(act, rankIdx)
    const uses = (q == null ? 1 : q) * (per / cyc)
    const keys = pointKeysOf(act)
    let gainH = 0
    if (act.gain) {
      gainH += (Number(act.gain.h) || 0) * (1 + (Number(act.gain.hPerSkillLevel) || 0) * skill)
      gainH += matsHOf(act.gain.mats)
      for (const k of keys) gainH += (Number(act.gain[k]) || 0) * pointHPerOf(block, k)
    }
    // V6.10 批 H：真随机档位（通天「天道」/ 六面「天劫盲盒」）——静态口径按**期望**计入。
    //   否则「确定收益拆成 确定 ＋ 随机」会让静态净额凭空缩水，护栏会误判。
    if (act.gamble && act.gamble.gain) {
      const mul = 1 + (Number(act.gain && act.gain.hPerSkillLevel) || 0) * skill
      gainH += (Number(act.gamble.p) || 0) * (Number(act.gamble.gain.h) || 0) * mul
    }
    let costH = (act.cost && Number(act.cost.h)) || 0
    if (act.cost) {
      for (const k of keys) costH += (Number(act.cost[k]) || 0) * pointHPerOf(block, k)
    }
    const net = gainH - costH
    rows.push({ id: act.id, netH: net, uses, dayH: net * uses })
    total += net * uses
  }
  return { h: total, rows }
}

/** 静态日产出上限（满职级 / 满阶 / 关抽成的最坏情况；A4a 铺量护栏断言用） */
export function staticDailyHCap (worldId, ctx = {}) {
  const block = mechanicsOf(worldId)
  if (!block) return 0
  const ranks = block.ranks ? block.ranks.length - 1 : 0
  let cap = 0
  for (const rankIdx of [0, ranks]) {
    for (const tributeOn of [true, false]) {
      for (const skillLevel of [0, 9]) {
        cap = Math.max(cap, staticDailyH(worldId, Object.assign({}, ctx, { rankIdx, tributeOn, skillLevel })).h)
      }
    }
  }
  return cap
}

/** 世界定义（展示用：颜色 / 标签），未登记返回 null */
export function worldMetaOf (worldId) {
  return getWorld(worldId)
}

export default {
  MAT_H, MECH, WANGZU_RANKS, RANK_DISCOUNT_ON, WORLD_MECHANICS, WORLD_TRAVEL,
  travelPriceStones, travelDayKey, rollTravelGift, travelGiftH,
  hasMechanics, mechanicsOf, actsOf, getAct,
  cycleMsOf, cycleKeyOf, cycleMsToNext,
  stonesOfH, matsHOf, matsTextOf, pointKeysOf, pointNameOf, pointHPerOf,
  quotaOf, rankThresholdsOf, rankOf, tributeRateOf, needPowerOf,
  staticDailyH, staticDailyHCap, worldMetaOf
}
