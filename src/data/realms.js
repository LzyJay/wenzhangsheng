/**
 * realms.js —— 72 级境界表 + 全局数值常量（**生成物，禁止手改**）
 * ═══════════════════════════════════════════════════════════════════════════
 * 生成命令：npm run gen:values   （= node scripts/gen_values.mjs）
 * 数值源　：data-source/72级数值表.csv（设计库《72级数值表.csv》原样副本，唯一数值源）
 * 生成时间：2026-09-16 16:45
 * 上游文档：《数值与公式手册》§1.1、《数据模型》§3、《设计增补 v1.1》（寿元）、《挂机修仙游戏设定书》§4
 *
 * 改数值的正确姿势：改 data-source 里的 CSV → 重跑 npm run gen:values → 全表刷新。
 * 直接手改本文件会在下次生成时被覆盖。
 *
 * 节点语义（与 CSV「里程碑」列一致）：breakthrough 描述**离开本级时**要过的关口——
 *   重数 3 / 6 → bottleneck（小瓶颈，破境丹）｜重数 9 → tribulation（渡劫）｜第 72 级 → ascension（飞升）
 *   costQi 仍是"升至该级所需灵气"。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 全局数值参数（与 CSV 的生成公式一致；调参旋钮见《游戏设计文档》§5.9） */
export const FORMULA = {
  costBase: 30, costGrowth: 1.55,     // 突破需求灵气 = floor(30 × 1.55^(L-1))
  rateBase: 1, rateGrowth: 1.30,      // 基准产出 = 1 × 1.30^(L-1)
  powerBase: 35, powerGrowth: 1.40,   // 基准战力 = 35 × 1.40^(L-1)
  levelMax: 72
}

/** 大境界元数据（8 境；寿元为增补 v1.1 统一口径） */
export const REALM_META = [
  { id: 'lianqi', name: '炼气', lifespanYears: 100, flavor: ['引气入体', '周天运转', '气感圆满'] },
  { id: 'zhuji', name: '筑基', lifespanYears: 200, flavor: ['筑就道基', '经脉拓宽', '道基圆满'] },
  { id: 'jindan', name: '金丹', lifespanYears: 600, flavor: ['凝气成丹', '丹火初燃', '金丹圆融'] },
  { id: 'yuanying', name: '元婴', lifespanYears: 1200, flavor: ['破丹化婴', '婴神凝练', '元婴出窍'] },
  { id: 'huashen', name: '化神', lifespanYears: 2500, flavor: ['神念外放', '神游太虚', '神与道合'] },
  { id: 'lianxu', name: '炼虚', lifespanYears: 5000, flavor: ['熔炼虚空', '虚实相生', '虚境圆满'] },
  { id: 'heti', name: '合体', lifespanYears: 10000, flavor: ['法则入体', '天人交感', '合体归一'] },
  { id: 'dacheng', name: '大乘', lifespanYears: 20000, flavor: ['道法大成', '气运加身', '大乘圆满'] }
]

/** 渡劫参数（数值与公式手册 §2.3 / 数据模型 §十一 trialConfig） */
export const TRIBULATION = {
  // 8 个关口的需求系数：F1 炼气→筑基 … F8 大乘九重→飞升
  fk: [1.25, 1.35, 1.45, 1.6, 1.75, 1.9, 2.1, 2.5],
  pBase: { a: 0.35, b: 0.30, clamp: [0.10, 0.90] }, // P_base = clamp(a + b × R_adj)
  prepCap: 0.35,                                     // 准备加成合计上限 +35%
  failBonus: { per: 0.08, cap: 0.32 },               // 垫劫补正：每败 +8%，上限 +32%
  strikes: 3,                                        // 三道天雷
  needPass: 2,                                       // 过二即成
  pity: { fails: 3, fourthPBases: 0.85 },            // 3 连败后第 4 次保底单雷通过率
  qiLossPct: 0.30,                                   // 失败：损失 30% 灵气储备
  daoShang: { id: 'debuff_daoshang', name: '道伤', durationSec: 3600, qiRatePct: -0.30 },
  cure: { stonesBase: 80, stonesGrowth: 1.6 }  // 静养：花灵石清除道伤（§4.2②）
}

/** 渡劫八关口（2.5 完整版；index 对应 fk 下标，gateLevel = 该境第九重） */
export const TRIAL_NODES = [
  { index: 0, gateLevel: 9, fromRealm: '炼气', toRealm: '筑基', name: '初雷劫', desc: '天光初动，一线雷自云隙垂落。此为引路之劫，过则道基可筑。', fk: 1.25, trialReq: 645 },
  { index: 1, gateLevel: 18, fromRealm: '筑基', toRealm: '金丹', name: '丹雷劫', desc: '雷火裹着丹气当头压下，须在金丹将成未成之际护住那一线丹火。', fk: 1.35, trialReq: 14405 },
  { index: 2, gateLevel: 27, fromRealm: '金丹', toRealm: '元婴', name: '婴雷劫', desc: '丹碎婴生，最是凶险；三雷之下，要教那一点元婴安稳落座。', fk: 1.45, trialReq: 319716 },
  { index: 3, gateLevel: 36, fromRealm: '元婴', toRealm: '化神', name: '心魔劫', desc: '雷声不入耳、只入心：此劫先问生平憾事，再降三道惊雷。', fk: 1.6, trialReq: 7289020 },
  { index: 4, gateLevel: 45, fromRealm: '化神', toRealm: '炼虚', name: '虚空劫', desc: '雷霆自虚空缝隙里探出，连影子都要劈碎。', fk: 1.75, trialReq: 164717469 },
  { index: 5, gateLevel: 54, fromRealm: '炼虚', toRealm: '合体', name: '天人劫', desc: '天地同感，劫云如城。这是合体之前最沉的一劫。', fk: 1.9, trialReq: 3694941238 },
  { index: 6, gateLevel: 63, fromRealm: '合体', toRealm: '大乘', name: '大乘劫', desc: '雷海翻涌，须以一身道法大成之姿硬接三道。', fk: 2.1, trialReq: 84377285798 },
  { index: 7, gateLevel: 72, fromRealm: '大乘', toRealm: '仙界', name: '飞升劫', desc: '仙门在云上，最后一劫最狠——过了便羽化，不过便从头再来。', fk: 2.5, trialReq: 2075384582640 }
]

/**
 * 渡劫准备项（游戏设计文档 §5.3）
 *   kind: consume 服用即消耗 ｜ hold 持有即生效 ｜ stone 花灵石结阵 ｜ system 尚未开放的系统项
 *   合计加成上限见 TRIBULATION.prepCap（+35%）；MVP 无战力系统，准备项是玩家唯一可主动施加的变量。
 */
export const TRIAL_PREPS = [
  { id: 'hujie', name: '护劫丹', kind: 'consume',
    itemId: 'pill_hujie', bonusPct: 0.1,
    module: null, from: '丹房炼制（灵草 2 · 玄铁 1 · 妖丹 1）', note: '事前服下护住心脉：单雷 +10%。服下即化入经脉，不成也不退还。' },
  { id: 'zhenlei', name: '镇雷法宝', kind: 'hold',
    itemId: 'treasure_zhenlei', bonusPct: 0.08,
    module: null, from: '法宝线（阶段二坊市 / 秘境）', note: '悬于头顶引雷入地：单雷 +8%。持有即生效，渡劫不损耗。' },
  { id: 'beast', name: '灵兽助战', kind: 'system',
    itemId: null, bonusPct: 0.07,
    module: '2.8 灵兽', from: '灵兽出战', note: '出战灵兽替主挡下一线雷威：单雷 +7%。' },
  { id: 'daoxing', name: '道行天赋', kind: 'system',
    itemId: null, bonusPct: 0.05,
    module: '转世轮回', from: '转世天赋 · 渡劫系', note: '随天赋层级递增，最高 +15%（第二期）。' },
  { id: 'sect', name: '宗门援助', kind: 'contrib',
    itemId: null, bonusPct: 0.05,
    module: '2.4 宗门', from: '花贡献请同门结阵护法', note: '单雷 +5%；贡献随关口水涨船高，职级越高折扣越厚（价码见 TRIAL_AID）。' }
]

/** 宗门援助报价（2.5 渡劫准备项；由 SectSystem.trialAid / payTrialAid 消费） */
export const TRIAL_AID = { contribBase: 200, contribGrowth: 1.45 }

/**
 * 突破成功率与失败代价（MVP 口径）
 * 设计库原文：小重突破为"确定性成功、不做失败"，挫败感只留在大节点。
 * MVP 按需求改为"小重也有概率 + 失败不降级"的折中口径；阶段二若要改回确定性，只改本表。
 */
export const SUCCESS_RATE = {
  minor: 0.92,       // 普通小重（设计意向：确定性；MVP 折中为高概率）
  bottleneck: 0.70   // ×3 / ×6 重小瓶颈
}

/** 失败结算（qiLossPct = 损失当前灵气储备比例；cooldownSec = 调息冷却） */
export const FAILURE_PLAN = {
  minor:       { qiLossPct: 0.20, cooldownSec: 3 },
  bottleneck:  { qiLossPct: 0.30, cooldownSec: 8 },
  tribulation: { qiLossPct: 0.30, cooldownSec: 120 },
  ascension:   { qiLossPct: 0.30, cooldownSec: 120 }
}

/** 离线收益（游戏设计文档 §5.4） */
export const OFFLINE = {
  effPct: 0.50,        // 起步离线性系数 50%
  capHours: 12,        // 起步上限 12 小时
  minAwaySec: 10       // 低于该时长的隐藏不做结算
}

/** 突破成功奖励灵石（MVP 简化：阶段二接入坊市/秘境后由内容线产出） */
export function breakthroughStoneReward (level) {
  return Math.round(10 * Math.pow(1.12, level - 1))
}

/** 72 级逐级表（下标 = level - 1） */
export const LEVELS = [
  { level: 1, realm: 'lianqi', realmName: '炼气', stage: 1, displayName: '炼气一重',
    breakthrough: { type: 'minor', costQi: 30, pill: null, trialReq: null },
    output: { qiPerSec: 1 }, combat: { power: 35 },
    pace: { baseSeconds: 30, cumSeconds: 30 },
    text: { milestone: '', flavor: '炼气一重 · 引气入体' } },
  { level: 2, realm: 'lianqi', realmName: '炼气', stage: 2, displayName: '炼气二重',
    breakthrough: { type: 'minor', costQi: 46, pill: null, trialReq: null },
    output: { qiPerSec: 1.3 }, combat: { power: 49 },
    pace: { baseSeconds: 35.4, cumSeconds: 65.4 },
    text: { milestone: '', flavor: '炼气二重 · 引气入体' } },
  { level: 3, realm: 'lianqi', realmName: '炼气', stage: 3, displayName: '炼气三重',
    breakthrough: { type: 'bottleneck', costQi: 72, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 1.69 }, combat: { power: 68 },
    pace: { baseSeconds: 42.6, cumSeconds: 108 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '炼气三重 · 引气入体' } },
  { level: 4, realm: 'lianqi', realmName: '炼气', stage: 4, displayName: '炼气四重',
    breakthrough: { type: 'minor', costQi: 111, pill: null, trialReq: null },
    output: { qiPerSec: 2.2 }, combat: { power: 96 },
    pace: { baseSeconds: 50.5, cumSeconds: 158.5 },
    text: { milestone: '', flavor: '炼气四重 · 周天运转' } },
  { level: 5, realm: 'lianqi', realmName: '炼气', stage: 5, displayName: '炼气五重',
    breakthrough: { type: 'minor', costQi: 173, pill: null, trialReq: null },
    output: { qiPerSec: 2.86 }, combat: { power: 134 },
    pace: { baseSeconds: 60.6, cumSeconds: 219.1 },
    text: { milestone: '', flavor: '炼气五重 · 周天运转' } },
  { level: 6, realm: 'lianqi', realmName: '炼气', stage: 6, displayName: '炼气六重',
    breakthrough: { type: 'bottleneck', costQi: 268, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 3.71 }, combat: { power: 188 },
    pace: { baseSeconds: 72.2, cumSeconds: 291.3 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '炼气六重 · 周天运转' } },
  { level: 7, realm: 'lianqi', realmName: '炼气', stage: 7, displayName: '炼气七重',
    breakthrough: { type: 'minor', costQi: 416, pill: null, trialReq: null },
    output: { qiPerSec: 4.83 }, combat: { power: 263 },
    pace: { baseSeconds: 86.2, cumSeconds: 377.4 },
    text: { milestone: '', flavor: '炼气七重 · 气感圆满' } },
  { level: 8, realm: 'lianqi', realmName: '炼气', stage: 8, displayName: '炼气八重',
    breakthrough: { type: 'minor', costQi: 644, pill: null, trialReq: null },
    output: { qiPerSec: 6.27 }, combat: { power: 368 },
    pace: { baseSeconds: 102.6, cumSeconds: 480.1 },
    text: { milestone: '', flavor: '炼气八重 · 气感圆满' } },
  { level: 9, realm: 'lianqi', realmName: '炼气', stage: 9, displayName: '炼气九重',
    breakthrough: { type: 'tribulation', costQi: 999, pill: null, trialReq: 645 },
    output: { qiPerSec: 8.16 }, combat: { power: 516 },
    pace: { baseSeconds: 122.5, cumSeconds: 602.5 },
    text: { milestone: '圆满·渡劫节点（成功晋筑基）', flavor: '炼气九重 · 气感圆满' } },
  { level: 10, realm: 'zhuji', realmName: '筑基', stage: 1, displayName: '筑基一重',
    breakthrough: { type: 'minor', costQi: 1549, pill: null, trialReq: null },
    output: { qiPerSec: 10.6 }, combat: { power: 723 },
    pace: { baseSeconds: 146.1, cumSeconds: 748.6 },
    text: { milestone: '', flavor: '筑基一重 · 筑就道基' } },
  { level: 11, realm: 'zhuji', realmName: '筑基', stage: 2, displayName: '筑基二重',
    breakthrough: { type: 'minor', costQi: 2401, pill: null, trialReq: null },
    output: { qiPerSec: 13.79 }, combat: { power: 1012 },
    pace: { baseSeconds: 174.2, cumSeconds: 922.8 },
    text: { milestone: '', flavor: '筑基二重 · 筑就道基' } },
  { level: 12, realm: 'zhuji', realmName: '筑基', stage: 3, displayName: '筑基三重',
    breakthrough: { type: 'bottleneck', costQi: 3721, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 17.92 }, combat: { power: 1417 },
    pace: { baseSeconds: 207.6, cumSeconds: 1130.4 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '筑基三重 · 筑就道基' } },
  { level: 13, realm: 'zhuji', realmName: '筑基', stage: 4, displayName: '筑基四重',
    breakthrough: { type: 'minor', costQi: 5769, pill: null, trialReq: null },
    output: { qiPerSec: 23.3 }, combat: { power: 1984 },
    pace: { baseSeconds: 247.6, cumSeconds: 1378 },
    text: { milestone: '', flavor: '筑基四重 · 经脉拓宽' } },
  { level: 14, realm: 'zhuji', realmName: '筑基', stage: 5, displayName: '筑基五重',
    breakthrough: { type: 'minor', costQi: 8941, pill: null, trialReq: null },
    output: { qiPerSec: 30.29 }, combat: { power: 2778 },
    pace: { baseSeconds: 295.2, cumSeconds: 1673.2 },
    text: { milestone: '', flavor: '筑基五重 · 经脉拓宽' } },
  { level: 15, realm: 'zhuji', realmName: '筑基', stage: 6, displayName: '筑基六重',
    breakthrough: { type: 'bottleneck', costQi: 13860, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 39.37 }, combat: { power: 3889 },
    pace: { baseSeconds: 352, cumSeconds: 2025.2 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '筑基六重 · 经脉拓宽' } },
  { level: 16, realm: 'zhuji', realmName: '筑基', stage: 7, displayName: '筑基七重',
    breakthrough: { type: 'minor', costQi: 21483, pill: null, trialReq: null },
    output: { qiPerSec: 51.19 }, combat: { power: 5444 },
    pace: { baseSeconds: 419.7, cumSeconds: 2444.9 },
    text: { milestone: '', flavor: '筑基七重 · 道基圆满' } },
  { level: 17, realm: 'zhuji', realmName: '筑基', stage: 8, displayName: '筑基八重',
    breakthrough: { type: 'minor', costQi: 33298, pill: null, trialReq: null },
    output: { qiPerSec: 66.54 }, combat: { power: 7622 },
    pace: { baseSeconds: 500.4, cumSeconds: 2945.4 },
    text: { milestone: '', flavor: '筑基八重 · 道基圆满' } },
  { level: 18, realm: 'zhuji', realmName: '筑基', stage: 9, displayName: '筑基九重',
    breakthrough: { type: 'tribulation', costQi: 51613, pill: null, trialReq: 14405 },
    output: { qiPerSec: 86.5 }, combat: { power: 10671 },
    pace: { baseSeconds: 596.7, cumSeconds: 3542 },
    text: { milestone: '圆满·渡劫节点（成功晋金丹）', flavor: '筑基九重 · 道基圆满' } },
  { level: 19, realm: 'jindan', realmName: '金丹', stage: 1, displayName: '金丹一重',
    breakthrough: { type: 'minor', costQi: 80000, pill: null, trialReq: null },
    output: { qiPerSec: 112.46 }, combat: { power: 14940 },
    pace: { baseSeconds: 711.4, cumSeconds: 4253.4 },
    text: { milestone: '', flavor: '金丹一重 · 凝气成丹' } },
  { level: 20, realm: 'jindan', realmName: '金丹', stage: 2, displayName: '金丹二重',
    breakthrough: { type: 'minor', costQi: 124000, pill: null, trialReq: null },
    output: { qiPerSec: 146.19 }, combat: { power: 20917 },
    pace: { baseSeconds: 848.2, cumSeconds: 5101.6 },
    text: { milestone: '', flavor: '金丹二重 · 凝气成丹' } },
  { level: 21, realm: 'jindan', realmName: '金丹', stage: 3, displayName: '金丹三重',
    breakthrough: { type: 'bottleneck', costQi: 192200, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 190.05 }, combat: { power: 29283 },
    pace: { baseSeconds: 1011.3, cumSeconds: 6112.9 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '金丹三重 · 凝气成丹' } },
  { level: 22, realm: 'jindan', realmName: '金丹', stage: 4, displayName: '金丹四重',
    breakthrough: { type: 'minor', costQi: 297911, pill: null, trialReq: null },
    output: { qiPerSec: 247.06 }, combat: { power: 40997 },
    pace: { baseSeconds: 1205.8, cumSeconds: 7318.7 },
    text: { milestone: '', flavor: '金丹四重 · 丹火初燃' } },
  { level: 23, realm: 'jindan', realmName: '金丹', stage: 5, displayName: '金丹五重',
    breakthrough: { type: 'minor', costQi: 461762, pill: null, trialReq: null },
    output: { qiPerSec: 321.18 }, combat: { power: 57396 },
    pace: { baseSeconds: 1437.7, cumSeconds: 8756.4 },
    text: { milestone: '', flavor: '金丹五重 · 丹火初燃' } },
  { level: 24, realm: 'jindan', realmName: '金丹', stage: 6, displayName: '金丹六重',
    breakthrough: { type: 'bottleneck', costQi: 715731, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 417.54 }, combat: { power: 80354 },
    pace: { baseSeconds: 1714.2, cumSeconds: 10470.6 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '金丹六重 · 丹火初燃' } },
  { level: 25, realm: 'jindan', realmName: '金丹', stage: 7, displayName: '金丹七重',
    breakthrough: { type: 'minor', costQi: 1109384, pill: null, trialReq: null },
    output: { qiPerSec: 542.8 }, combat: { power: 112496 },
    pace: { baseSeconds: 2043.8, cumSeconds: 12514.4 },
    text: { milestone: '', flavor: '金丹七重 · 金丹圆融' } },
  { level: 26, realm: 'jindan', realmName: '金丹', stage: 8, displayName: '金丹八重',
    breakthrough: { type: 'minor', costQi: 1719545, pill: null, trialReq: null },
    output: { qiPerSec: 705.64 }, combat: { power: 157495 },
    pace: { baseSeconds: 2436.9, cumSeconds: 14951.2 },
    text: { milestone: '', flavor: '金丹八重 · 金丹圆融' } },
  { level: 27, realm: 'jindan', realmName: '金丹', stage: 9, displayName: '金丹九重',
    breakthrough: { type: 'tribulation', costQi: 2665295, pill: null, trialReq: 319716 },
    output: { qiPerSec: 917.33 }, combat: { power: 220494 },
    pace: { baseSeconds: 2905.5, cumSeconds: 17856.7 },
    text: { milestone: '圆满·渡劫节点（成功晋元婴）', flavor: '金丹九重 · 金丹圆融' } },
  { level: 28, realm: 'yuanying', realmName: '元婴', stage: 1, displayName: '元婴一重',
    breakthrough: { type: 'minor', costQi: 4131208, pill: null, trialReq: null },
    output: { qiPerSec: 1192.53 }, combat: { power: 308691 },
    pace: { baseSeconds: 3464.2, cumSeconds: 21321 },
    text: { milestone: '', flavor: '元婴一重 · 破丹化婴' } },
  { level: 29, realm: 'yuanying', realmName: '元婴', stage: 2, displayName: '元婴二重',
    breakthrough: { type: 'minor', costQi: 6403373, pill: null, trialReq: null },
    output: { qiPerSec: 1550.29 }, combat: { power: 432168 },
    pace: { baseSeconds: 4130.4, cumSeconds: 25451.4 },
    text: { milestone: '', flavor: '元婴二重 · 破丹化婴' } },
  { level: 30, realm: 'yuanying', realmName: '元婴', stage: 3, displayName: '元婴三重',
    breakthrough: { type: 'bottleneck', costQi: 9925228, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 2015.38 }, combat: { power: 605035 },
    pace: { baseSeconds: 4924.7, cumSeconds: 30376.1 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '元婴三重 · 破丹化婴' } },
  { level: 31, realm: 'yuanying', realmName: '元婴', stage: 4, displayName: '元婴四重',
    breakthrough: { type: 'minor', costQi: 15384103, pill: null, trialReq: null },
    output: { qiPerSec: 2620 }, combat: { power: 847050 },
    pace: { baseSeconds: 5871.8, cumSeconds: 36247.9 },
    text: { milestone: '', flavor: '元婴四重 · 婴神凝练' } },
  { level: 32, realm: 'yuanying', realmName: '元婴', stage: 5, displayName: '元婴五重',
    breakthrough: { type: 'minor', costQi: 23845360, pill: null, trialReq: null },
    output: { qiPerSec: 3405.99 }, combat: { power: 1185870 },
    pace: { baseSeconds: 7001, cumSeconds: 43248.9 },
    text: { milestone: '', flavor: '元婴五重 · 婴神凝练' } },
  { level: 33, realm: 'yuanying', realmName: '元婴', stage: 6, displayName: '元婴六重',
    breakthrough: { type: 'bottleneck', costQi: 36960309, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 4427.79 }, combat: { power: 1660218 },
    pace: { baseSeconds: 8347.3, cumSeconds: 51596.3 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '元婴六重 · 婴神凝练' } },
  { level: 34, realm: 'yuanying', realmName: '元婴', stage: 7, displayName: '元婴七重',
    breakthrough: { type: 'minor', costQi: 57288479, pill: null, trialReq: null },
    output: { qiPerSec: 5756.13 }, combat: { power: 2324305 },
    pace: { baseSeconds: 9952.6, cumSeconds: 61548.9 },
    text: { milestone: '', flavor: '元婴七重 · 元婴出窍' } },
  { level: 35, realm: 'yuanying', realmName: '元婴', stage: 8, displayName: '元婴八重',
    breakthrough: { type: 'minor', costQi: 88797142, pill: null, trialReq: null },
    output: { qiPerSec: 7482.97 }, combat: { power: 3254027 },
    pace: { baseSeconds: 11866.6, cumSeconds: 73415.4 },
    text: { milestone: '', flavor: '元婴八重 · 元婴出窍' } },
  { level: 36, realm: 'yuanying', realmName: '元婴', stage: 9, displayName: '元婴九重',
    breakthrough: { type: 'tribulation', costQi: 137635571, pill: null, trialReq: 7289020 },
    output: { qiPerSec: 9727.86 }, combat: { power: 4555638 },
    pace: { baseSeconds: 14148.6, cumSeconds: 87564 },
    text: { milestone: '圆满·渡劫节点（成功晋化神）', flavor: '元婴九重 · 元婴出窍' } },
  { level: 37, realm: 'huashen', realmName: '化神', stage: 1, displayName: '化神一重',
    breakthrough: { type: 'minor', costQi: 213335135, pill: null, trialReq: null },
    output: { qiPerSec: 12646.22 }, combat: { power: 6377894 },
    pace: { baseSeconds: 16869.5, cumSeconds: 104433.5 },
    text: { milestone: '', flavor: '化神一重 · 神念外放' } },
  { level: 38, realm: 'huashen', realmName: '化神', stage: 2, displayName: '化神二重',
    breakthrough: { type: 'minor', costQi: 330669460, pill: null, trialReq: null },
    output: { qiPerSec: 16440.08 }, combat: { power: 8929052 },
    pace: { baseSeconds: 20113.6, cumSeconds: 124547.1 },
    text: { milestone: '', flavor: '化神二重 · 神念外放' } },
  { level: 39, realm: 'huashen', realmName: '化神', stage: 3, displayName: '化神三重',
    breakthrough: { type: 'bottleneck', costQi: 512537664, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 21372.11 }, combat: { power: 12500673 },
    pace: { baseSeconds: 23981.6, cumSeconds: 148528.7 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '化神三重 · 神念外放' } },
  { level: 40, realm: 'huashen', realmName: '化神', stage: 4, displayName: '化神四重',
    breakthrough: { type: 'minor', costQi: 794433379, pill: null, trialReq: null },
    output: { qiPerSec: 27783.74 }, combat: { power: 17500942 },
    pace: { baseSeconds: 28593.5, cumSeconds: 177122.2 },
    text: { milestone: '', flavor: '化神四重 · 神游太虚' } },
  { level: 41, realm: 'huashen', realmName: '化神', stage: 5, displayName: '化神五重',
    breakthrough: { type: 'minor', costQi: 1231371737, pill: null, trialReq: null },
    output: { qiPerSec: 36118.86 }, combat: { power: 24501319 },
    pace: { baseSeconds: 34092.2, cumSeconds: 211214.4 },
    text: { milestone: '', flavor: '化神五重 · 神游太虚' } },
  { level: 42, realm: 'huashen', realmName: '化神', stage: 6, displayName: '化神六重',
    breakthrough: { type: 'bottleneck', costQi: 1908626193, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 46954.52 }, combat: { power: 34301847 },
    pace: { baseSeconds: 40648.4, cumSeconds: 251862.8 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '化神六重 · 神游太虚' } },
  { level: 43, realm: 'huashen', realmName: '化神', stage: 7, displayName: '化神七重',
    breakthrough: { type: 'minor', costQi: 2958370600, pill: null, trialReq: null },
    output: { qiPerSec: 61040.88 }, combat: { power: 48022585 },
    pace: { baseSeconds: 48465.4, cumSeconds: 300328.2 },
    text: { milestone: '', flavor: '化神七重 · 神与道合' } },
  { level: 44, realm: 'huashen', realmName: '化神', stage: 8, displayName: '化神八重',
    breakthrough: { type: 'minor', costQi: 4585474430, pill: null, trialReq: null },
    output: { qiPerSec: 79353.15 }, combat: { power: 67231620 },
    pace: { baseSeconds: 57785.7, cumSeconds: 358113.9 },
    text: { milestone: '', flavor: '化神八重 · 神与道合' } },
  { level: 45, realm: 'huashen', realmName: '化神', stage: 9, displayName: '化神九重',
    breakthrough: { type: 'tribulation', costQi: 7107485366, pill: null, trialReq: 164717469 },
    output: { qiPerSec: 103159.09 }, combat: { power: 94124268 },
    pace: { baseSeconds: 68898.3, cumSeconds: 427012.2 },
    text: { milestone: '圆满·渡劫节点（成功晋炼虚）', flavor: '化神九重 · 神与道合' } },
  { level: 46, realm: 'lianxu', realmName: '炼虚', stage: 1, displayName: '炼虚一重',
    breakthrough: { type: 'minor', costQi: 11016602318, pill: null, trialReq: null },
    output: { qiPerSec: 134106.82 }, combat: { power: 131773975 },
    pace: { baseSeconds: 82148, cumSeconds: 509160.1 },
    text: { milestone: '', flavor: '炼虚一重 · 熔炼虚空' } },
  { level: 47, realm: 'lianxu', realmName: '炼虚', stage: 2, displayName: '炼虚二重',
    breakthrough: { type: 'minor', costQi: 17075733593, pill: null, trialReq: null },
    output: { qiPerSec: 174338.86 }, combat: { power: 184483566 },
    pace: { baseSeconds: 97945.7, cumSeconds: 607105.8 },
    text: { milestone: '', flavor: '炼虚二重 · 熔炼虚空' } },
  { level: 48, realm: 'lianxu', realmName: '炼虚', stage: 3, displayName: '炼虚三重',
    breakthrough: { type: 'bottleneck', costQi: 26467387069, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 226640.52 }, combat: { power: 258276992 },
    pace: { baseSeconds: 116781.4, cumSeconds: 723887.1 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '炼虚三重 · 熔炼虚空' } },
  { level: 49, realm: 'lianxu', realmName: '炼虚', stage: 4, displayName: '炼虚四重',
    breakthrough: { type: 'minor', costQi: 41024449958, pill: null, trialReq: null },
    output: { qiPerSec: 294632.68 }, combat: { power: 361587789 },
    pace: { baseSeconds: 139239.3, cumSeconds: 863126.4 },
    text: { milestone: '', flavor: '炼虚四重 · 虚实相生' } },
  { level: 50, realm: 'lianxu', realmName: '炼虚', stage: 5, displayName: '炼虚五重',
    breakthrough: { type: 'minor', costQi: 63587897435, pill: null, trialReq: null },
    output: { qiPerSec: 383022.48 }, combat: { power: 506222905 },
    pace: { baseSeconds: 166016.1, cumSeconds: 1029142.5 },
    text: { milestone: '', flavor: '炼虚五重 · 虚实相生' } },
  { level: 51, realm: 'lianxu', realmName: '炼虚', stage: 6, displayName: '炼虚六重',
    breakthrough: { type: 'bottleneck', costQi: 98561241024, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 497929.22 }, combat: { power: 708712068 },
    pace: { baseSeconds: 197942.3, cumSeconds: 1227084.8 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '炼虚六重 · 虚实相生' } },
  { level: 52, realm: 'lianxu', realmName: '炼虚', stage: 7, displayName: '炼虚七重',
    breakthrough: { type: 'minor', costQi: 152769923588, pill: null, trialReq: null },
    output: { qiPerSec: 647307.99 }, combat: { power: 992196895 },
    pace: { baseSeconds: 236008.1, cumSeconds: 1463092.9 },
    text: { milestone: '', flavor: '炼虚七重 · 虚境圆满' } },
  { level: 53, realm: 'lianxu', realmName: '炼虚', stage: 8, displayName: '炼虚八重',
    breakthrough: { type: 'minor', costQi: 236793381562, pill: null, trialReq: null },
    output: { qiPerSec: 841500.39 }, combat: { power: 1389075654 },
    pace: { baseSeconds: 281394.3, cumSeconds: 1744487.2 },
    text: { milestone: '', flavor: '炼虚八重 · 虚境圆满' } },
  { level: 54, realm: 'lianxu', realmName: '炼虚', stage: 9, displayName: '炼虚九重',
    breakthrough: { type: 'tribulation', costQi: 367029741421, pill: null, trialReq: 3694941238 },
    output: { qiPerSec: 1093950.5 }, combat: { power: 1944705915 },
    pace: { baseSeconds: 335508.5, cumSeconds: 2079995.7 },
    text: { milestone: '圆满·渡劫节点（成功晋合体）', flavor: '炼虚九重 · 虚境圆满' } },
  { level: 55, realm: 'heti', realmName: '合体', stage: 1, displayName: '合体一重',
    breakthrough: { type: 'minor', costQi: 568896099203, pill: null, trialReq: null },
    output: { qiPerSec: 1422135.65 }, combat: { power: 2722588281 },
    pace: { baseSeconds: 400029.4, cumSeconds: 2480025.1 },
    text: { milestone: '', flavor: '合体一重 · 法则入体' } },
  { level: 56, realm: 'heti', realmName: '合体', stage: 2, displayName: '合体二重',
    breakthrough: { type: 'minor', costQi: 881788953765, pill: null, trialReq: null },
    output: { qiPerSec: 1848776.35 }, combat: { power: 3811623594 },
    pace: { baseSeconds: 476958.2, cumSeconds: 2956983.3 },
    text: { milestone: '', flavor: '合体二重 · 法则入体' } },
  { level: 57, realm: 'heti', realmName: '合体', stage: 3, displayName: '合体三重',
    breakthrough: { type: 'bottleneck', costQi: 1366772878336, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 2403409.25 }, combat: { power: 5336273032 },
    pace: { baseSeconds: 568680.9, cumSeconds: 3525664.2 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '合体三重 · 法则入体' } },
  { level: 58, realm: 'heti', realmName: '合体', stage: 4, displayName: '合体四重',
    breakthrough: { type: 'minor', costQi: 2118497961421, pill: null, trialReq: null },
    output: { qiPerSec: 3124432.03 }, combat: { power: 7470782245 },
    pace: { baseSeconds: 678042.6, cumSeconds: 4203706.7 },
    text: { milestone: '', flavor: '合体四重 · 天人交感' } },
  { level: 59, realm: 'heti', realmName: '合体', stage: 5, displayName: '合体五重',
    breakthrough: { type: 'minor', costQi: 3283671840203, pill: null, trialReq: null },
    output: { qiPerSec: 4061761.64 }, combat: { power: 10459095143 },
    pace: { baseSeconds: 808435.4, cumSeconds: 5012142.1 },
    text: { milestone: '', flavor: '合体五重 · 天人交感' } },
  { level: 60, realm: 'heti', realmName: '合体', stage: 6, displayName: '合体六重',
    breakthrough: { type: 'bottleneck', costQi: 5089691352314, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 5280290.13 }, combat: { power: 14642733201 },
    pace: { baseSeconds: 963903.7, cumSeconds: 5976045.9 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '合体六重 · 天人交感' } },
  { level: 61, realm: 'heti', realmName: '合体', stage: 7, displayName: '合体七重',
    breakthrough: { type: 'minor', costQi: 7889021596087, pill: null, trialReq: null },
    output: { qiPerSec: 6864377.17 }, combat: { power: 20499826481 },
    pace: { baseSeconds: 1149269.8, cumSeconds: 7125315.7 },
    text: { milestone: '', flavor: '合体七重 · 合体归一' } },
  { level: 62, realm: 'heti', realmName: '合体', stage: 8, displayName: '合体八重',
    breakthrough: { type: 'minor', costQi: 12227983473936, pill: null, trialReq: null },
    output: { qiPerSec: 8923690.32 }, combat: { power: 28699757074 },
    pace: { baseSeconds: 1370283.3, cumSeconds: 8495598.9 },
    text: { milestone: '', flavor: '合体八重 · 合体归一' } },
  { level: 63, realm: 'heti', realmName: '合体', stage: 9, displayName: '合体九重',
    breakthrough: { type: 'tribulation', costQi: 18953374384601, pill: null, trialReq: 84377285798 },
    output: { qiPerSec: 11600797.42 }, combat: { power: 40179659904 },
    pace: { baseSeconds: 1633799.3, cumSeconds: 10129398.2 },
    text: { milestone: '圆满·渡劫节点（成功晋大乘）', flavor: '合体九重 · 合体归一' } },
  { level: 64, realm: 'dacheng', realmName: '大乘', stage: 1, displayName: '大乘一重',
    breakthrough: { type: 'minor', costQi: 29377730296132, pill: null, trialReq: null },
    output: { qiPerSec: 15081036.65 }, combat: { power: 56251523866 },
    pace: { baseSeconds: 1947991.4, cumSeconds: 12077389.7 },
    text: { milestone: '', flavor: '大乘一重 · 道法大成' } },
  { level: 65, realm: 'dacheng', realmName: '大乘', stage: 2, displayName: '大乘二重',
    breakthrough: { type: 'minor', costQi: 45535481959004, pill: null, trialReq: null },
    output: { qiPerSec: 19605347.64 }, combat: { power: 78752133413 },
    pace: { baseSeconds: 2322605.2, cumSeconds: 14399994.8 },
    text: { milestone: '', flavor: '大乘二重 · 道法大成' } },
  { level: 66, realm: 'dacheng', realmName: '大乘', stage: 3, displayName: '大乘三重',
    breakthrough: { type: 'bottleneck', costQi: 70579997036457, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 25486951.94 }, combat: { power: 110252986778 },
    pace: { baseSeconds: 2769260, cumSeconds: 17169254.9 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '大乘三重 · 道法大成' } },
  { level: 67, realm: 'dacheng', realmName: '大乘', stage: 4, displayName: '大乘四重',
    breakthrough: { type: 'minor', costQi: 109398995406508, pill: null, trialReq: null },
    output: { qiPerSec: 33133037.52 }, combat: { power: 154354181489 },
    pace: { baseSeconds: 3301810, cumSeconds: 20471064.9 },
    text: { milestone: '', flavor: '大乘四重 · 气运加身' } },
  { level: 68, realm: 'dacheng', realmName: '大乘', stage: 5, displayName: '大乘五重',
    breakthrough: { type: 'minor', costQi: 169568442880088, pill: null, trialReq: null },
    output: { qiPerSec: 43072948.77 }, combat: { power: 216095854085 },
    pace: { baseSeconds: 3936773.5, cumSeconds: 24407838.4 },
    text: { milestone: '', flavor: '大乘五重 · 气运加身' } },
  { level: 69, realm: 'dacheng', realmName: '大乘', stage: 6, displayName: '大乘六重',
    breakthrough: { type: 'bottleneck', costQi: 262831086464136, pill: 'pill_pojing', trialReq: null },
    output: { qiPerSec: 55994833.4 }, combat: { power: 302534195720 },
    pace: { baseSeconds: 4693845.3, cumSeconds: 29101683.7 },
    text: { milestone: '小瓶颈（破境丹）', flavor: '大乘六重 · 气运加身' } },
  { level: 70, realm: 'dacheng', realmName: '大乘', stage: 7, displayName: '大乘七重',
    breakthrough: { type: 'minor', costQi: 407388184019412, pill: null, trialReq: null },
    output: { qiPerSec: 72793283.42 }, combat: { power: 423547874008 },
    pace: { baseSeconds: 5596507.9, cumSeconds: 34698191.6 },
    text: { milestone: '', flavor: '大乘七重 · 大乘圆满' } },
  { level: 71, realm: 'dacheng', realmName: '大乘', stage: 8, displayName: '大乘八重',
    breakthrough: { type: 'minor', costQi: 631451685230088, pill: null, trialReq: null },
    output: { qiPerSec: 94631268.45 }, combat: { power: 592967023611 },
    pace: { baseSeconds: 6672759.4, cumSeconds: 41370951 },
    text: { milestone: '', flavor: '大乘八重 · 大乘圆满' } },
  { level: 72, realm: 'dacheng', realmName: '大乘', stage: 9, displayName: '大乘九重',
    breakthrough: { type: 'ascension', costQi: 978750112106637, pill: null, trialReq: 2075384582640 },
    output: { qiPerSec: 123020648.99 }, combat: { power: 830153833056 },
    pace: { baseSeconds: 7955982.4, cumSeconds: 49326933.3 },
    text: { milestone: '圆满·飞升劫节点', flavor: '大乘九重 · 大乘圆满' } }
]

/** 最高级数（大乘九重） */
export const LEVEL_MAX = FORMULA.levelMax

/** 飞升节点（大乘九重圆满 → 飞升仙界，二期内容） */
export const ASCENSION = {
  type: 'ascension',
  label: '飞升',
  targetName: '仙界（二期内容）',
  trialReq: LEVELS[LEVEL_MAX - 1].breakthrough.trialReq
}

/** 取某一级的境界信息（越界自动收敛到 1 ~ 72） */
export function getLevelInfo (level) {
  const idx = Math.min(Math.max(Math.round(level) || 1, 1), LEVEL_MAX) - 1
  return LEVELS[idx]
}

/** 取大境界元数据 */
export function getRealmMeta (realmIndex) {
  return REALM_META[Math.min(Math.max(realmIndex | 0, 0), REALM_META.length - 1)]
}

/**
 * 取"从 level 级往上突破"的完整方案（UI 与逻辑共用）
 * 关口类型/破境丹/渡劫需求战力取自**本级**的 breakthrough（离开本级时面对什么），
 * 灵气成本取**目标级**的 costQi（升至该级所需）。
 */
export function getNextBreakthrough (level) {
  const from = getLevelInfo(level)
  const node = from.breakthrough

  if (level >= LEVEL_MAX) {
    return {
      type: ASCENSION.type,
      label: '飞升',
      fromLevel: LEVEL_MAX,
      fromName: from.displayName,
      targetLevel: null,
      targetName: ASCENSION.targetName,
      costQi: node.costQi * 10,          // 飞升参悟所需（MVP 仅作展示与门槛）
      pill: null,
      trialReq: node.trialReq
    }
  }

  const target = LEVELS[level]           // 升到 level + 1
  const isTrial = node.type === 'tribulation'
  return {
    type: node.type,
    label: isTrial ? '渡劫' : (node.type === 'bottleneck' ? '破境' : '突破'),
    fromLevel: level,
    fromName: from.displayName,
    targetLevel: target.level,
    targetName: target.displayName,
    costQi: target.breakthrough.costQi,
    pill: node.pill,
    trialReq: node.trialReq
  }
}

/** 本级所处的关口序号（0 起，对应 fk 下标）；非渡劫节点返回 -1 */
export function trialNodeIndex (level) {
  if (level >= LEVEL_MAX) return TRIBULATION.fk.length - 1
  const stage = ((level - 1) % 9) + 1
  if (stage !== 9) return -1
  return Math.floor((level - 1) / 9)
}

export default {
  FORMULA, REALM_META, LEVELS, LEVEL_MAX, ASCENSION, TRIBULATION, TRIAL_NODES, TRIAL_PREPS, TRIAL_AID,
  SUCCESS_RATE, FAILURE_PLAN, OFFLINE,
  getLevelInfo, getRealmMeta, getNextBreakthrough, trialNodeIndex, breakthroughStoneReward
}
