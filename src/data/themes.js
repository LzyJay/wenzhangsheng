/**
 * themes.js —— 3.4 UI 动效与主题：皮肤色板唯一真源（data 层，纯配置 + 纯函数）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / §13.1①）：本文件**禁止 import** systems / Phaser / DOM。
 *
 * 职责：
 *   · 四套皮肤色板（鎏金 / 朱砂 / 玄墨 / 月白）—— 每套给出**同一组语义槽位**的取值；
 *   · 12 世界 → 色系映射（「随世界」档用；**不改 worlds.js**，映射自持于本表）；
 *   · `resolveSkin(setting, worldId)` 纯函数 —— 全项目唯一的「当前该用哪套皮肤」判定点。
 *
 * 数据来源：《问长生-开发计划》§五 3.4「面板转场、数字滚动、按钮反馈；主题皮肤系统」；
 *   设计库《V2 问长生-立绘UI设计》§设计系统「换装扩展｜色板即皮肤」（男修 朱砂/玄墨/鎏金、
 *   女修 月白/水蓝/银灰抽为变量）；配色语义沿用 index.html `:root` 的「颜色语义表」：
 *   一套颜色 = 一个含义，皮肤只换色相与明度，**语义映射一一对应保留**。
 *
 * ⚠ 默认皮肤（default / 鎏金）的每一个数值必须与 index.html 现状**逐位一致**：
 *   `tests/legacy/wcs_cdp2.mjs` 硬断言产出速率 = rgb(232,185,106)、修为数值 = rgb(255,227,168)、
 *   进度条为金色渐变；`tests/V3.3.*-自测.mjs` 另有静态核对。改默认色 = 既有断言全红。
 *
 * 存档：无新子树 —— 皮肤是 `settings.skin`（V2.9 之前即已预留的偏好叶子，本模块接管其取值）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 皮肤 id 列表（顺序即设置面板里的循环顺序；'auto' 不是皮肤，是「随世界」档） */
export const SKIN_IDS = ['default', 'zhu', 'xuan', 'yue']

/** 「随世界」档在 settings.skin 里的取值 */
export const SKIN_AUTO = 'auto'

/**
 * 12 世界 → 四色系（按 worlds.js 里各世界 `color` 的色相就近归类）。
 * 说明：本表是 3.4 自持映射，**不写回 worlds.js**（该文件归 V2.9 所有，§13.1④）。
 *   · 月白（冷蓝）——青绿/青蓝/蓝紫系
 *   · 朱砂（暖橙）——橙红系
 *   · 鎏金（正金）——黄/金黄/黄绿系
 *   · 玄墨（中性紫灰）——紫/灰系
 */
export const WORLD_SKIN = {
  qinglan: 'yue',      // 青岚界 #7fd6a8 青绿
  poxiao: 'yue',       // 破晓星域 #9fb8ff 蓝紫
  denghuo: 'zhu',      // 观云界 #ffb37a 暖橙
  qingyun: 'yue',      // 青云古界 #7fd6c8 青碧
  wangzu: 'default',   // 望族山河 #ffd98a 金黄
  younuo: 'xuan',      // 幽傩界 #c98bff 紫
  tongtian: 'yue',     // 通天界 #9fd6ff 天蓝
  tiangong: 'default', // 天工界 #b8c98b 黄绿
  liumian: 'xuan',     // 六面囚笼 #b9a8c9 灰紫
  jiuding: 'default',  // 九鼎九州 #e8c878 正金
  wuyuan: 'zhu',       // 无缺古界 #e8986a 橘红
  xianghuo: 'xuan'     // 人间香火 #cfc7ba 暖灰
}

/**
 * 语义槽位（每套皮肤都必须给全，键名一致）。
 * 值一律是 **"r,g,b" 三元组字符串**（不带 rgba 前缀）—— 注入 CSS 时：
 *   · `--<槽位>-rgb: r,g,b` 供 `rgba(var(--<槽位>-rgb), a)` 形态使用（本文件替换的主要对象）；
 *   · 需要实色的槽位再由 `varsFor()` 顺带算出十六进制写进 `--<槽位>`（见 SEMANTIC_HEX_VARS）。
 * 这样每个颜色只有**一处真源**，不会出现 hex 与 rgb 三元组对不上的情况。
 */
export const SLOTS = [
  // 修行主序（修为 / 灵石 / 突破 / 进度条）
  'gold', 'goldLight', 'goldDeep', 'goldPale',
  // 生机（寿元 / 增益）
  'jade', 'jadeDeep', 'jadeLight',
  // 灵根
  'violet', 'violetLight',
  // 劫难 / 警示
  'fail', 'failLight', 'failDeep', 'warn', 'warnLight', 'warnDeep',
  // 系统消息 / 世界
  'sys', 'world', 'worldLight',
  // 次要文本
  'ash', 'ashDeep', 'dim', 'dimDeep', 'dimLight', 'text', 'textDim',
  // 暗底族（面板 / 卡片 / 浮层 / 遮罩）
  'bgBlue', 'bgTip', 'bgChip', 'bgVeilHi', 'bgVeilLo', 'bgSunken', 'bgDeep', 'bgCard', 'bgFloat', 'bgCardWarm', 'bgWorld', 'bgDanger'
]

/**
 * 需要同时写「hex 实色变量」的槽位 → CSS 变量名。
 * 只有被 `color:` / `border-color:` / `linear-gradient()` 直接消费的槽位需要实色；
 * 其余只在 `rgba(var(--x-rgb), a)` 里出现，无需 hex。
 */
export const SEMANTIC_HEX_VARS = {
  gold: '--gold',
  goldLight: '--gold-light',
  goldDeep: '--gold-deep',
  goldPale: '--gold-pale',
  jade: '--jade',
  jadeDeep: '--jade-deep',
  jadeLight: '--jade-light',
  violet: '--violet',
  violetLight: '--violet-light',
  fail: '--fail',
  failLight: '--fail-light',
  warn: '--warn',
  warnLight: '--warn-light',
  warnDeep: '--warn-deep',
  sys: '--sys',
  world: '--world',
  worldLight: '--world-light',
  ash: '--ash',
  dim: '--dim',
  dimDeep: '--dim-deep',
  dimLight: '--dim-light',
  text: '--text',
  textDim: '--text-dim'
}

/**
 * 四套皮肤。
 * default 一栏**逐位等于 index.html `:root` 现状**（冻结，勿改）。
 */
export const SKINS = {
  default: {
    id: 'default',
    name: '鎏金',
    desc: '原初色板：暗底鎏金，修仙主序的默认面目。',
    accent: '#e8b96a',
    slots: {
      gold: '232,185,106', goldLight: '255,227,168', goldDeep: '201,143,60', goldPale: '240,220,180',
      jade: '127,214,168', jadeDeep: '79,158,119', jadeLight: '191,235,212',
      violet: '185,140,255', violetLight: '220,201,255',
      fail: '255,143,125', failLight: '255,185,166', failDeep: '255,120,90',
      warn: '255,174,140', warnLight: '255,215,196', warnDeep: '176,85,63',
      sys: '159,214,255', world: '159,182,255', worldLight: '207,224,255',
      ash: '185,179,168', ashDeep: '150,145,140', dim: '143,135,124', dimDeep: '127,122,115',
      dimLight: '207,199,186', text: '239,233,221', textDim: '164,156,146',
      bgBlue: '18,15,24', bgTip: '20,16,27', bgChip: '24,19,30', bgVeilHi: '30,24,44', bgVeilLo: '10,8,14',
      bgSunken: '38,34,46', bgDeep: '8,6,12', bgCard: '34,28,38', bgFloat: '28,22,34', bgCardWarm: '34,27,15',
      bgWorld: '24,28,44', bgDanger: '46,24,26'
    },
    raw: { '--plate': 'rgba(18, 15, 24, 0.66)' },
    // ⚠ 蒲团原值冻结：默认皮肤下蒲团贴图必须与 3.1 现状逐位一致（其它皮肤由 cushionColors 推导）
    cushion: { lo: '#14100c', mid: '#221a12', hi: '#2b2115', line: '#e8b96a', line2: '#c99a4e' }
  },

  zhu: {
    id: 'zhu',
    name: '朱砂',
    desc: '朱砂符箓：暖褐底上的一抹砂红，锐利而炽烈。',
    accent: '#e8794a',
    slots: {
      gold: '232,121,74', goldLight: '255,180,138', goldDeep: '168,69,31', goldPale: '246,214,186',
      jade: '111,202,160', jadeDeep: '63,138,102', jadeLight: '180,230,205',
      violet: '199,156,255', violetLight: '228,210,255',
      fail: '255,127,106', failLight: '255,178,158', failDeep: '255,106,74',
      warn: '255,192,138', warnLight: '255,224,184', warnDeep: '160,74,48',
      sys: '159,214,255', world: '169,168,255', worldLight: '214,214,255',
      ash: '192,182,174', ashDeep: '152,138,130', dim: '154,141,132', dimDeep: '138,128,120',
      dimLight: '212,203,194', text: '242,231,226', textDim: '172,158,152',
      bgBlue: '26,14,12', bgTip: '28,16,14', bgChip: '32,18,16', bgVeilHi: '38,24,20', bgVeilLo: '16,10,8',
      bgSunken: '48,34,30', bgDeep: '14,8,6', bgCard: '44,28,26', bgFloat: '36,22,20', bgCardWarm: '42,30,16',
      bgWorld: '26,28,46', bgDanger: '56,26,22'
    },
    raw: { '--plate': 'rgba(26, 14, 12, 0.66)' }
  },

  xuan: {
    id: 'xuan',
    name: '玄墨',
    desc: '玄墨素笺：近乎无色的墨底，冷银勾勒，最是沉静。',
    accent: '#a8a4b8',
    slots: {
      gold: '168,164,184', goldLight: '221,216,230', goldDeep: '110,106,122', goldPale: '226,222,234',
      jade: '127,214,168', jadeDeep: '79,158,119', jadeLight: '191,235,212',
      violet: '176,166,216', violetLight: '213,207,232',
      fail: '255,143,125', failLight: '255,185,166', failDeep: '255,120,90',
      warn: '255,174,140', warnLight: '255,215,196', warnDeep: '176,85,63',
      sys: '168,208,255', world: '143,162,240', worldLight: '194,205,255',
      ash: '179,179,189', ashDeep: '146,146,156', dim: '138,138,149', dimDeep: '123,123,134',
      dimLight: '200,200,210', text: '232,233,240', textDim: '160,163,176',
      bgBlue: '14,14,20', bgTip: '16,16,22', bgChip: '18,18,24', bgVeilHi: '24,24,32', bgVeilLo: '8,8,12',
      bgSunken: '32,32,40', bgDeep: '6,6,10', bgCard: '30,30,38', bgFloat: '24,24,30', bgCardWarm: '30,29,20',
      bgWorld: '20,24,40', bgDanger: '44,28,34'
    },
    raw: { '--plate': 'rgba(14, 14, 20, 0.66)' }
  },

  yue: {
    id: 'yue',
    name: '月白',
    desc: '月白水蓝：冷调青蓝，如一泓月色浸过的水。',
    accent: '#cbdceb',
    slots: {
      gold: '203,220,235', goldLight: '255,255,255', goldDeep: '147,174,197', goldPale: '232,240,248',
      jade: '127,214,200', jadeDeep: '74,154,142', jadeLight: '185,234,217',
      violet: '169,183,232', violetLight: '207,216,240',
      fail: '255,156,138', failLight: '255,192,176', failDeep: '255,138,114',
      warn: '255,190,156', warnLight: '255,220,200', warnDeep: '170,92,70',
      sys: '169,205,245', world: '159,182,255', worldLight: '207,224,255',
      ash: '184,194,204', ashDeep: '146,156,168', dim: '141,153,164', dimDeep: '125,137,148',
      dimLight: '204,212,220', text: '238,243,249', textDim: '159,170,182',
      bgBlue: '20,26,34', bgTip: '22,28,36', bgChip: '24,30,40', bgVeilHi: '30,38,52', bgVeilLo: '10,14,20',
      bgSunken: '40,46,56', bgDeep: '8,12,18', bgCard: '36,42,52', bgFloat: '30,36,44', bgCardWarm: '34,40,24',
      bgWorld: '24,28,44', bgDanger: '50,32,38'
    },
    raw: { '--plate': 'rgba(20, 26, 34, 0.66)' }
  }
}

/** rgb 三元组 → `#rrggbb`（纯函数；供需要实色的槽位使用） */
export function rgbToHex (triple) {
  const [r, g, b] = String(triple).split(',').map((v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0))))
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * 一套皮肤 → 可直接写进 `document.documentElement.style` 的 CSS 变量表。
 * 每个槽位产出两条：`--<槽位>-rgb`（三元组）与（若在 SEMANTIC_HEX_VARS 里）`--<槽位>`（hex 实色）。
 * @param {object} skin SKINS 里的一项
 * @returns {Record<string, string>}
 */
export function varsFor (skin) {
  const out = {}
  if (!skin || !skin.slots) return out
  for (const slot of SLOTS) {
    const triple = skin.slots[slot]
    if (!triple) continue
    out[`--${camelToKebab(slot)}-rgb`] = triple
    const hexVar = SEMANTIC_HEX_VARS[slot]
    if (hexVar) out[hexVar] = rgbToHex(triple)
  }
  for (const [k, v] of Object.entries(skin.raw || {})) out[k] = v
  return out
}

/** camelCase → kebab-case（'goldLight' → 'gold-light'、'bgVeilHi' → 'bg-veil-hi'） */
export function camelToKebab (s) {
  return String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 皮肤查表（带兜底：未知 id 一律回默认鎏金，避免老档脏值导致界面无皮肤）。
 * @param {string} id
 */
export function getSkin (id) {
  return SKINS[id] || SKINS.default
}

/**
 * 「随世界」档：世界 id → 皮肤 id（未知世界回默认）。
 * @param {string|null} worldId
 */
export function skinOfWorld (worldId) {
  return getSkin(WORLD_SKIN[worldId] || '').id
}

/**
 * 全项目唯一的「当前该用哪套皮肤」判定点（纯函数）。
 *   · 'auto'（随世界）→ 按当前世界取色系；未抽世界时回默认；
 *   · 四套皮肤 id 之一 → 直接采用；
 *   · 其它（脏值 / 缺省）→ 默认鎏金。
 * @param {string} setting state.settings.skin
 * @param {string|null} worldId state.world && state.world.id（未抽世界传 null/'')
 * @returns {{id:string, name:string, desc:string, accent:string, auto:boolean,
 *            palette:{hue:number, sat:number, light:number},
 *            slots:Record<string,string>, vars:Record<string,string>, resolved:Record<string,string>}}
 */
export function resolveSkin (setting, worldId) {
  const s = String(setting || 'default')
  const auto = s === SKIN_AUTO
  const id = auto ? skinOfWorld(worldId) : (SKINS[s] ? s : 'default')
  const skin = SKINS[id]
  const vars = varsFor(skin)
  return {
    id,
    name: skin.name,
    desc: skin.desc,
    accent: skin.accent,
    auto,
    palette: accentPalette(id),
    slots: { ...skin.slots },
    vars,
    resolved: vars   // 兼容别名（旧调用点/自测按 resolved 读）
  }
}

// ── 颜色工具（纯函数；仅本文件与 appearance.js 使用）──────────────────────────

/** `#rrggbb` → `{h:0~360, s:0~1, l:0~1}`；非法输入回黑色 */
export function hexToHsl (hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return { h: 0, s: 0, l: 0 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s, l }
}

/** `{h,s,l}` → `#rrggbb`（h 单位度，自动归一；s/l 钳到 0~1） */
export function hslToHex ({ h = 0, s = 0, l = 0 } = {}) {
  const hh = ((Number(h) % 360) + 360) % 360
  const ss = Math.max(0, Math.min(1, Number(s) || 0))
  const ll = Math.max(0, Math.min(1, Number(l) || 0))
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2
  const seg = Math.floor(hh / 60) % 6
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg]
  const to255 = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)))
  return '#' + rgb.map((v) => to255(v).toString(16).padStart(2, '0')).join('')
}

/**
 * 皮肤的「主色相 / 饱和度」—— 境界圆光与法袍阶梯的换色依据（appearance.js 消费）。
 * 饱和度按 0.7 折减后钳在 [0.10, 0.42]：既避开近灰（玄墨）导致整片死白，
 * 也避免高饱和（朱砂）把圆光染成刺眼的纯橙。
 * @param {string} skinId
 */
export function accentPalette (skinId) {
  const skin = getSkin(skinId)
  const { h, s, l } = hexToHsl(skin.accent)
  return { hue: h, sat: Math.max(0.10, Math.min(0.42, s * 0.7)), light: l }
}

/**
 * 蒲团贴图 key（PreloadScene 生成、MainScene 换用；两处必须同源，故集中在此）。
 * 默认皮肤沿用 3.1 的 `tex_cushion`，其余皮肤 `tex_cushion_<id>`。
 * @param {string} skinId
 */
export function cushionTexKey (skinId) {
  const id = getSkin(skinId).id
  return id === 'default' ? 'tex_cushion' : `tex_cushion_${id}`
}

/**
 * 蒲团贴图配色（PreloadScene 消费）：垫体三层由暗底族取，金线由主色族取。
 * 默认皮肤走 `skin.cushion`（原值冻结，保证 3.1 观感与截图逐位不变）；
 * 其余皮肤按本套暗底 + 主色推导 —— 这样玄墨/月白下的蒲团不会露出暖褐。
 * @param {string} skinId
 * @returns {{lo:string, mid:string, hi:string, line:string, line2:string}} 全部 `#rrggbb`
 */
export function cushionColors (skinId) {
  const skin = getSkin(skinId)
  if (skin.cushion) return { ...skin.cushion }
  const rgb = (k) => skin.slots[k].split(',').map(Number)
  const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
  const deep = rgb('bgDeep')
  const blue = rgb('bgBlue')
  const card = rgb('bgCard')
  const gold = rgb('gold')
  const goldDeep = rgb('goldDeep')
  return {
    lo: toHex(mix(deep, blue, 0.45)),
    mid: toHex(mix(blue, card, 0.28)),
    hi: toHex(mix(blue, card, 0.55)),
    line: toHex(gold),
    line2: toHex(goldDeep)
  }
}
