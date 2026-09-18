/**
 * gen_values.mjs —— 由数值源 CSV 生成 src/data/realms.js（72 级境界表 + 全部数值常量）
 * ═══════════════════════════════════════════════════════════════════════════
 * 用法：  node scripts/gen_values.mjs        （或 npm run gen:values）
 * 输入：  data-source/72级数值表.csv          —— 设计库《72级数值表.csv》原样副本，唯一数值源
 * 输出：  src/data/realms.js                  —— 生成物，**禁止手改**（改数值请改 CSV 后重跑）
 *
 * 生成物结构（与《数据模型》§3 字段对齐）：
 *   { level, realm, realmName, stage, displayName,
 *     breakthrough: { type, costQi, pill, trialReq },
 *     output: { qiPerSec }, combat: { power }, pace: { baseSeconds, cumSeconds },
 *     text: { milestone, flavor } }
 *
 * ⚠ 节点语义（与设计库 CSV 的「里程碑」列一致）：
 *   `breakthrough` 描述的是**离开该级时**要过的关口，而不是"怎么升到这一级"——
 *   · 重数 3 / 6  → bottleneck（小瓶颈，消耗破境丹）
 *   · 重数 9      → tribulation（渡劫，渡劫推荐战力取 CSV 的「渡劫推荐战力」列）
 *   · 第 72 级    → ascension（飞升劫，CSV 里程碑写作「圆满·飞升劫节点」）
 *   · 其余        → minor
 *   costQi 仍是"升至该级所需灵气"（CSV 的「突破需求灵气」列），与《数据模型》示例一致。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const CSV = path.join(ROOT, 'data-source', '72级数值表.csv')
const OUT = path.join(ROOT, 'src', 'data', 'realms.js')

// ── 非数值类元数据（标识符与文案，不属于 CSV 的数据列，固化在脚本里）────────
const REALM_IDS = ['lianqi', 'zhuji', 'jindan', 'yuanying', 'huashen', 'lianxu', 'heti', 'dacheng']
// 基础寿元：《设计增补 v1.1》口径（年）
const REALM_LIFESPAN = [100, 200, 600, 1200, 2500, 5000, 10000, 20000]
// 每境三段短文案（升级仪式感）
const REALM_FLAVOR = [
  ['引气入体', '周天运转', '气感圆满'],
  ['筑就道基', '经脉拓宽', '道基圆满'],
  ['凝气成丹', '丹火初燃', '金丹圆融'],
  ['破丹化婴', '婴神凝练', '元婴出窍'],
  ['神念外放', '神游太虚', '神与道合'],
  ['熔炼虚空', '虚实相生', '虚境圆满'],
  ['法则入体', '天人交感', '合体归一'],
  ['道法大成', '气运加身', '大乘圆满']
]
const STAGE_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

// ── 渡劫（2.5 完整版）非数值元数据 ─────────────────────────────────────────
// 8 个关口的需求系数 Fk（《数值与公式手册》§2.3）
const TRIAL_FK = [1.25, 1.35, 1.45, 1.60, 1.75, 1.90, 2.10, 2.50]
// 渡劫准备加成合计上限（《游戏设计文档》§5.3：+35%）
const TRIAL_PREP_CAP = 0.35
// 静养疗伤：花灵石清除道伤（《游戏设计文档》§4.2②；⚖ 可调）
const TRIAL_CURE = { stonesBase: 80, stonesGrowth: 1.60 }
// 8 个关口的劫名与叙事短句（修行文案，不属于 CSV 数据列，固化在脚本里）
const TRIAL_NODE_META = [
  { name: '初雷劫', desc: '天光初动，一线雷自云隙垂落。此为引路之劫，过则道基可筑。' },
  { name: '丹雷劫', desc: '雷火裹着丹气当头压下，须在金丹将成未成之际护住那一线丹火。' },
  { name: '婴雷劫', desc: '丹碎婴生，最是凶险；三雷之下，要教那一点元婴安稳落座。' },
  { name: '心魔劫', desc: '雷声不入耳、只入心：此劫先问生平憾事，再降三道惊雷。' },
  { name: '虚空劫', desc: '雷霆自虚空缝隙里探出，连影子都要劈碎。' },
  { name: '天人劫', desc: '天地同感，劫云如城。这是合体之前最沉的一劫。' },
  { name: '大乘劫', desc: '雷海翻涌，须以一身道法大成之姿硬接三道。' },
  { name: '飞升劫', desc: '仙门在云上，最后一劫最狠——过了便羽化，不过便从头再来。' }
]
// 渡劫准备项（《游戏设计文档》§5.3；合计上限 +35%）
//   kind: consume 服用即消耗 ｜ hold 持有即生效 ｜ stone 花灵石结阵 ｜ system 尚未开放的系统项
const TRIAL_PREPS = [
  // V3.5.9 同槽位升档（原著第三批：九曲灵参接丹方）：囊中有九转护劫丹则 prepare 时优先服高档，
  // 生效加成按 upBonusPct 计——准备项仍一格，护栏合计（prepCap 0.35）与 sum 不变量不动。
  { id: 'hujie', name: '护劫丹', kind: 'consume', itemId: 'pill_hujie', bonusPct: 0.10,
    upItemId: 'pill_hujie2', upName: '九转护劫丹', upBonusPct: 0.15,
    module: null, from: '丹房炼制（灵草 2 · 玄铁 1 · 妖丹 1）',
    note: '事前服下护住心脉：单雷 +10%。服下即化入经脉，不成也不退还。' },
  { id: 'zhenlei', name: '镇雷法宝', kind: 'hold', itemId: 'treasure_zhenlei', bonusPct: 0.08,
    module: null, from: '法宝线（阶段二坊市 / 秘境）',
    note: '悬于头顶引雷入地：单雷 +8%。持有即生效，渡劫不损耗。' },
  { id: 'beast', name: '灵兽助战', kind: 'system', itemId: null, bonusPct: 0.07,
    module: '2.8 灵兽', from: '灵兽出战', note: '出战灵兽替主挡下一线雷威：单雷 +7%。' },
  { id: 'daoxing', name: '道行天赋', kind: 'system', itemId: null, bonusPct: 0.05,
    module: '转世轮回', from: '转世天赋 · 渡劫系', note: '随天赋层级递增，最高 +15%（第二期）。' },
  { id: 'sect', name: '宗门援助', kind: 'contrib', itemId: null, bonusPct: 0.05,
    module: '2.4 宗门', from: '花贡献请同门结阵护法',
    note: '单雷 +5%；贡献随关口水涨船高，职级越高折扣越厚（价码见 TRIAL_AID）。' }
]
// 宗门援助报价（2.5；价码由 SectSystem.trialAid 只读消费，CultivationSystem 不碰他人的子树）
const TRIAL_AID = { contribBase: 200, contribGrowth: 1.45 }

// ── 读 CSV ────────────────────────────────────────────────────────────────
function parseCsv (text) {
  const clean = text.replace(/^\uFEFF/, '')            // 去掉 BOM
  const lines = clean.split(/\r?\n/).filter((l) => l.trim())
  const head = lines[0].split(',').map((s) => s.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row = {}
    head.forEach((h, i) => { row[h] = (cells[i] ?? '').trim() })
    return row
  })
}

const num = (v) => (v === '' || v == null ? null : Number(v))

function build () {
  const raw = parseCsv(fs.readFileSync(CSV, 'utf8'))
  if (raw.length !== 72) throw new Error(`数值源应有 72 行，实际 ${raw.length} 行`)

  const realms = []
  const levels = raw.map((r) => {
    const level = Number(r['编号'])
    const realmName = r['境界']
    const stage = Number(r['重数'])
    const realmIndex = Math.floor((level - 1) / 9)

    if (!realms[realmIndex]) realms[realmIndex] = realmName
    if (realms[realmIndex] !== realmName) {
      throw new Error(`第 ${level} 级的境界「${realmName}」与前文不一致（应为 ${realms[realmIndex]}）`)
    }

    const costQi = num(r['突破需求灵气'])
    const qiPerSec = num(r['基准产出灵气每秒'])
    const power = num(r['基准战力'])
    const trialReq = num(r['渡劫推荐战力'])
    const baseSeconds = num(r['基准时长秒'])
    const cumSeconds = num(r['累计基准时长秒'])
    const milestone = r['里程碑'] || ''

    // 离开本级的关口类型
    let type = 'minor'
    let pill = null
    if (level === 72) type = 'ascension'
    else if (stage === 9) type = 'tribulation'
    else if (stage === 3 || stage === 6) { type = 'bottleneck'; pill = 'pill_pojing' }

    if (type === 'minor' && trialReq != null) throw new Error(`第 ${level} 级非渡劫节点却带渡劫推荐战力`)
    if (type === 'tribulation' && trialReq == null) throw new Error(`第 ${level} 级是渡劫节点但缺渡劫推荐战力`)

    return {
      level,
      realm: REALM_IDS[realmIndex],
      realmName,
      stage,
      displayName: `${realmName}${STAGE_CN[stage - 1]}重`,
      breakthrough: { type, costQi, pill, trialReq },
      output: { qiPerSec },
      combat: { power },
      pace: { baseSeconds, cumSeconds },
      text: {
        milestone,
        flavor: `${realmName}${STAGE_CN[stage - 1]}重 · ${REALM_FLAVOR[realmIndex][Math.floor((stage - 1) / 3)]}`
      }
    }
  })

  if (realms.length !== 8) throw new Error(`应识别出 8 个大境界，实际 ${realms.length}`)
  return { realms, levels }
}

const { realms, levels } = build()

// ── 生成源码 ──────────────────────────────────────────────────────────────
const L = (v) => (v == null ? 'null' : String(v))
const Q = (s) => `'${s}'`

const levelLines = levels.map((l) => `  { level: ${l.level}, realm: ${Q(l.realm)}, realmName: ${Q(l.realmName)}, stage: ${l.stage}, displayName: ${Q(l.displayName)},
    breakthrough: { type: ${Q(l.breakthrough.type)}, costQi: ${L(l.breakthrough.costQi)}, pill: ${l.breakthrough.pill ? Q(l.breakthrough.pill) : 'null'}, trialReq: ${L(l.breakthrough.trialReq)} },
    output: { qiPerSec: ${l.output.qiPerSec} }, combat: { power: ${l.combat.power} },
    pace: { baseSeconds: ${l.pace.baseSeconds}, cumSeconds: ${l.pace.cumSeconds} },
    text: { milestone: ${Q(l.text.milestone)}, flavor: ${Q(l.text.flavor)} } }`).join(',\n')

const realmLines = realms.map((name, i) => `  { id: ${Q(REALM_IDS[i])}, name: ${Q(name)}, lifespanYears: ${REALM_LIFESPAN[i]}, flavor: [${REALM_FLAVOR[i].map(Q).join(', ')}] }`).join(',\n')

// 渡劫八关口：gateLevel = 该境第九重（9 / 18 / … / 72），trialReq 取该级的「渡劫推荐战力」列
const trialNodeLines = TRIAL_NODE_META.map((m, i) => {
  const gate = levels[(i + 1) * 9 - 1]
  const toRealm = i < realms.length - 1 ? realms[i + 1] : '仙界'
  return `  { index: ${i}, gateLevel: ${gate.level}, fromRealm: ${Q(realms[i])}, toRealm: ${Q(toRealm)},`
    + ` name: ${Q(m.name)}, desc: ${Q(m.desc)}, fk: ${TRIAL_FK[i]}, trialReq: ${L(gate.breakthrough.trialReq)} }`
}).join(',\n')

const trialPrepLines = TRIAL_PREPS.map((p) => {
  const pairs = [
    `id: ${Q(p.id)}, name: ${Q(p.name)}, kind: ${Q(p.kind)}`,
    `itemId: ${p.itemId ? Q(p.itemId) : 'null'}, bonusPct: ${p.bonusPct}`
  ]
  // V3.5.9 同槽位升档字段（仅 consume 项按需输出）
  if (p.upItemId) {
    pairs.push(`upItemId: ${Q(p.upItemId)}, upName: ${Q(p.upName || p.name)}, upBonusPct: ${p.upBonusPct}`)
  }
  pairs.push(`module: ${p.module ? Q(p.module) : 'null'}, from: ${Q(p.from)}, note: ${Q(p.note)}`)
  return `  { ${pairs.join(',\n    ')} }`
}).join(',\n')

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)

const out = `/**
 * realms.js —— 72 级境界表 + 全局数值常量（**生成物，禁止手改**）
 * ═══════════════════════════════════════════════════════════════════════════
 * 生成命令：npm run gen:values   （= node scripts/gen_values.mjs）
 * 数值源　：data-source/72级数值表.csv（设计库《72级数值表.csv》原样副本，唯一数值源）
 * 生成时间：${stamp}
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
${realmLines}
]

/** 渡劫参数（数值与公式手册 §2.3 / 数据模型 §十一 trialConfig） */
export const TRIBULATION = {
  // 8 个关口的需求系数：F1 炼气→筑基 … F8 大乘九重→飞升
  fk: [${TRIAL_FK.join(', ')}],
  pBase: { a: 0.35, b: 0.30, clamp: [0.10, 0.90] }, // P_base = clamp(a + b × R_adj)
  prepCap: ${TRIAL_PREP_CAP},                                     // 准备加成合计上限 +35%
  failBonus: { per: 0.08, cap: 0.32 },               // 垫劫补正：每败 +8%，上限 +32%
  strikes: 3,                                        // 三道天雷
  needPass: 2,                                       // 过二即成
  pity: { fails: 3, fourthPBases: 0.85 },            // 3 连败后第 4 次保底单雷通过率
  qiLossPct: 0.30,                                   // 失败：损失 30% 灵气储备
  daoShang: { id: 'debuff_daoshang', name: '道伤', durationSec: 3600, qiRatePct: -0.30 },
  cure: { stonesBase: ${TRIAL_CURE.stonesBase}, stonesGrowth: ${TRIAL_CURE.stonesGrowth} }  // 静养：花灵石清除道伤（§4.2②）
}

/** 渡劫八关口（2.5 完整版；index 对应 fk 下标，gateLevel = 该境第九重） */
export const TRIAL_NODES = [
${trialNodeLines}
]

/**
 * 渡劫准备项（游戏设计文档 §5.3）
 *   kind: consume 服用即消耗 ｜ hold 持有即生效 ｜ stone 花灵石结阵 ｜ system 尚未开放的系统项
 *   合计加成上限见 TRIBULATION.prepCap（+35%）；MVP 无战力系统，准备项是玩家唯一可主动施加的变量。
 */
export const TRIAL_PREPS = [
${trialPrepLines}
]

/** 宗门援助报价（2.5 渡劫准备项；由 SectSystem.trialAid / payTrialAid 消费） */
export const TRIAL_AID = { contribBase: ${TRIAL_AID.contribBase}, contribGrowth: ${TRIAL_AID.contribGrowth} }

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

/**
 * 突破成功奖励灵石（V5.1 批 1 · 开发册 §4.4 遗留待办 1 收官）
 * ── 旧口径 10×1.12^(L-1) 是"秘境 / 坊市未上线"时的过渡逻辑：L47 单次 ≈ 1836 灵石，
 *    比同期任何内容线都高一个量级，已成"主要来源"。现降为**早期起步补贴**——
 *    只保开局起步，不再随境界指数膨胀；主线灵石改由秘境（含招牌秘境）/ 宗门 / 事件供给。
 *   ⚙ 可调旋钮（**单点**，只改下面这一行）：base 起步底数 / per 每级线性增量 / cap 满级封顶。
 *     实测点：L1=3 · L9=9 · L19=17 · L28=24 · L37=32 · L47=40 · L64=53 · L72=60(封顶)
 *   ⚠ 改这里后必须重跑：npm run gen:values → node scripts/audit_values.mjs
 *     （realms.js 是生成物禁手改；调用点 CultivationSystem.doBreakthrough 签名与调用方式不变）
 */
export const BREAKTHROUGH_STONES = { base: 2, per: 0.8, cap: 60 }

/** 突破成功奖励灵石 = min(cap, round(base + per × level))；越界收敛到 1 ~ 正无穷 */
export function breakthroughStoneReward (level) {
  const L = Math.max(1, Math.round(Number(level)) || 1)
  const { base, per, cap } = BREAKTHROUGH_STONES
  return Math.min(cap, Math.round(base + per * L))
}

/** 72 级逐级表（下标 = level - 1） */
export const LEVELS = [
${levelLines}
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
  SUCCESS_RATE, FAILURE_PLAN, OFFLINE, BREAKTHROUGH_STONES,
  getLevelInfo, getRealmMeta, getNextBreakthrough, trialNodeIndex, breakthroughStoneReward
}
`

// ── 落盘与自检（只在直接运行本脚本时执行；被 audit_values.mjs import 时不写盘）──
// V3.5.2 起导出 composeSource()：audit_values.mjs 用同一份组合逻辑比对磁盘上的
// realms.js 是否与 CSV 重生成结果逐位一致（防手改生成物），两边永不漂。
const isDirectRun = (() => {
  try { return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href } catch (_) { return false }
})()

function composeSource () { return out }

if (isDirectRun) {
  fs.writeFileSync(OUT, composeSource(), 'utf8')

  // ── 自检：与公式对齐度 + 节点清单 ─────────────────────────────────────────
  const drift = levels.map((l) => {
    const formulaCost = 30 * Math.pow(1.55, l.level - 1)
    return Math.abs(l.breakthrough.costQi - formulaCost) / formulaCost
  })
  const maxDrift = Math.max(...drift)
  const nodes = levels
    .filter((l) => l.breakthrough.type !== 'minor')
    .map((l) => `${l.displayName}:${l.breakthrough.type}`)

  console.log(`[gen:values] 已生成 ${path.relative(ROOT, OUT)}`)
  console.log(`  源 CSV      ：data-source/72级数值表.csv（${fs.statSync(CSV).size} 字节）`)
  console.log(`  级别数      ：${levels.length}｜大境界：${realms.join('/')}`)
  console.log(`  与公式最大偏差：${(maxDrift * 100).toFixed(2)}%（CSV 为取整后的口径，属预期）`)
  console.log(`  关口清单    ：${nodes.length} 个 → ${nodes.join('  ')}`)
  const trialSum = TRIAL_PREPS.reduce((s, p) => s + p.bonusPct, 0)
  console.log(`  渡劫八关口  ：${TRIAL_NODE_META.map((m, i) => `${i + 1}.${m.name}`).join(' ')}`)
  console.log(`  准备项合计  ：+${(trialSum * 100).toFixed(0)}%（上限 +${(TRIAL_PREP_CAP * 100).toFixed(0)}%）`)
}

export { build, composeSource }
