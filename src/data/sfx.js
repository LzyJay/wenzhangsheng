/**
 * sfx.js —— 3.5 音效与音乐：音色参数表 + 音量分级（data 层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / §13.1①）：本文件**禁止 import** systems / Phaser / DOM，
 *       也**不含任何 Web Audio 调用** —— 它只是"配方表"，合成引擎在 src/audio/SfxEngine.js。
 *
 * 职责：
 *   · 十二类音效的**合成配方**（振荡器波形 / 频率包络 / 噪声 / 时长 / 增益 / 低通）；
 *   · 打坐环境音的配方（低频气息 + 极慢调幅，随挂机与窗口可见性启停）；
 *   · 音量三档（低 / 中 / 高）→ 实际增益的映射，音效与音乐各一套。
 *
 * 数据来源：《问长生-开发计划V2》§五 3.5「打坐环境音、突破音、渡劫雷声；音量分级
 *   （1.8a 已交付音效总开关，本模块补内容与音量分级，属扩展非重复）」。
 *   **主人本轮拍板：音效一律程序化合成（Web Audio），零素材、零版权风险**，
 *   与 PreloadScene 的「程序化贴图」同源 —— 因此本表是唯一的"音色真源"，
 *   调音色只改这张表的数字，不碰引擎代码。
 *
 * 口径：
 *   · 天空是"暖金"的：突破 / 灵根 / 成就走正弦与三度叠音（明亮不刺耳），不用锯齿；
 *   · 劫难是"沉"的：失败下坠、雷声走噪声 + 低频轰鸣，与 3.2 的三道雷光同拍；
 *   · UI 音极短极轻（≤150ms、增益 ≤0.32），绝不喧宾夺主；
 *   · 环境音是**唯一常驻**的一路，增益压到 0.05 上下 —— 长挂机时听得见"在呼吸"，
 *     但不至于烦；主人随时可在设置里关掉音效总开关。
 *
 * 存档：无新子树 —— 只有 `settings.volSfx` / `settings.volBgm` 两个偏好叶子。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 音量档（设置面板循环顺序：低 → 中 → 高） */
export const VOLUME_TIERS = ['low', 'mid', 'high']

/** 档位中文名（设置面板与日志共用一份） */
export const VOLUME_NAMES = { low: '低', mid: '中', high: '高' }

/**
 * 档位 → 实际增益。
 * ⚠ 音效的 mid=0.60 是「参考增益」：表里每条配方的 gain 再乘它。
 * ⚠ **音乐的 mid=0.35 必须等于 BGM 播放器 3.5 之前写死的 `audio.volume = 0.35`** ——
 *    这样主人老朋友（老档默认 mid）听到的音量分毫不变，音量分级只是"多给了两头"。
 */
export const VOLUME_GAIN = {
  sfx: { low: 0.28, mid: 0.60, high: 1.00 },
  bgm: { low: 0.18, mid: 0.35, high: 0.62 }
}

/** 兜底档位（脏值一律按 mid，与旧观感一致） */
export const DEFAULT_TIER = 'mid'

/**
 * 音效配方表。
 *
 * 通用字段：
 *   kind      'tone' 单音 | 'arp' 琶音 | 'thunder' 雷声 | 'bell' 钟 + 鼓
 *   wave      振荡器波形（'sine' 最柔，'triangle' 略带齿感，'square' 明亮偏硬）
 *   ms        总时长
 *   gain      该音效的峰值增益（再乘音量档）
 *   attackMs  起振时间（太短会"啪"）
 *   releaseMs 收尾淡出
 *
 * kind='tone'：freq:[f起, f止]（频率包络，相等即定音）；lowpass 可选（Hz）
 * kind='arp' ：notes:[f...] 依次触发，stepMs 步长；bell=true 叠一个二倍频钟声
 * kind='thunder'：ms/gain + rumbleHz 低频轰鸣基频
 * kind='bell'：bellHz 钟音 + drumHz 鼓点（先鼓后钟）
 */
export const SFX_TABLE = {
  // ── ① UI：点按 / 面板开合（极短，只做"手感"，不做音效秀）──────────────
  ui_click: { kind: 'tone', wave: 'triangle', freq: [880, 700], ms: 70, gain: 0.30, attackMs: 3, releaseMs: 55 },
  ui_open: { kind: 'tone', wave: 'sine', freq: [440, 660], ms: 150, gain: 0.26, attackMs: 6, releaseMs: 110 },
  ui_close: { kind: 'tone', wave: 'sine', freq: [540, 330], ms: 130, gain: 0.22, attackMs: 5, releaseMs: 100 },
  ui_deny: { kind: 'tone', wave: 'square', freq: [220, 165], ms: 130, gain: 0.16, attackMs: 3, releaseMs: 90, lowpass: 900 },

  // ── ② 修行：突破成功 / 失败（3.2 演出段的听觉对位）────────────────────
  // 成功＝上行三度琶音 + 钟鸣泛音（"收势"）；失败＝下坠短音（"沉下去"）
  cult_break_ok: {
    kind: 'arp', wave: 'sine', notes: [523.25, 659.25, 783.99, 1046.5],
    stepMs: 95, ms: 520, gain: 0.34, attackMs: 5, releaseMs: 260, bell: true
  },
  cult_break_fail: {
    kind: 'tone', wave: 'sine', freq: [320, 140], ms: 360, gain: 0.30, attackMs: 4, releaseMs: 240, lowpass: 800
  },

  // ── ③ 渡劫雷声（与 3.2 三道雷光同拍：3×460ms 劈落 + 收势）────────────
  cult_tribulation: {
    kind: 'thunder', ms: 1500, gain: 0.46, attackMs: 2, releaseMs: 900, rumbleHz: 44, lowpass: 420, crackGain: 0.55
  },

  // ── ④ 事件线：灵根揭晓 / 成就称号 / 宗门交差 / 秘境结算 / 灵兽破壳 / 闭关归来 ──
  root_reveal: {
    kind: 'arp', wave: 'sine', notes: [392, 523.25, 659.25, 880],
    stepMs: 85, ms: 420, gain: 0.30, attackMs: 5, releaseMs: 220, bell: true
  },
  achv: {
    kind: 'arp', wave: 'sine', notes: [880, 1174.66, 1567.98],
    stepMs: 105, ms: 340, gain: 0.24, attackMs: 4, releaseMs: 180
  },
  sect_done: {
    kind: 'arp', wave: 'triangle', notes: [659.25, 880], stepMs: 90, ms: 220, gain: 0.22, attackMs: 4, releaseMs: 130
  },
  dungeon_clear: { kind: 'bell', bellHz: 987.77, drumHz: 118, ms: 620, gain: 0.30, attackMs: 3, releaseMs: 380 },
  beast_hatch: {
    kind: 'arp', wave: 'sine', notes: [783.99, 1046.5, 1318.51],
    stepMs: 70, ms: 300, gain: 0.24, attackMs: 3, releaseMs: 170
  },
  offline_back: {
    kind: 'tone', wave: 'sine', freq: [196, 392], ms: 560, gain: 0.26, attackMs: 20, releaseMs: 380
  }
}

/**
 * 打坐环境音配方（常驻一路，随挂机暂停 / 窗口隐藏 / 音效关闭启停）。
 * 两个极低的正弦微微失谐（53/55Hz → 约 2Hz 拍频）叠出"气息"，再叠一层 0.11Hz 的极慢调幅
 * —— 听感上就是随呼吸起伏的低吟，而不是一条死板的长音。
 */
export const AMBIENT = {
  wave: 'sine',
  freq: [55, 53.2],      // 两个频率的拍频 ≈ 1.8Hz（"气息"的起伏）
  lfoHz: 0.11,           // 调幅周期 ≈ 9 秒（比呼吸周期更长、更缓）
  lfoDepth: 0.42,        // 调幅深度（0 = 不动；1 = 全断）
  gain: 0.05,            // 常驻底噪级增益（长挂机不烦）
  attackMs: 2600,        // 淡入（约一个呼吸周期，别一开窗就"嗡"一声）
  releaseMs: 1400        // 淡出
}

/** 音效 id 清单（自测用来核对"十二类齐备"） */
export const SFX_IDS = Object.keys(SFX_TABLE)

/**
 * 取某音量档的实际增益（纯函数；脏档位回 medium）。
 * @param {'sfx'|'bgm'} kind
 * @param {string} tier 'low' | 'mid' | 'high'
 * @returns {number} 0~1
 */
export function gainOfTier (kind, tier) {
  const table = VOLUME_GAIN[kind] || VOLUME_GAIN.sfx
  return table[tier] != null ? table[tier] : table[DEFAULT_TIER]
}

/**
 * 档位循环（设置面板点按用；脏值从 mid 起循环）。
 * @param {string} cur
 * @returns {string} 下一档
 */
export function nextTier (cur) {
  const i = VOLUME_TIERS.indexOf(String(cur))
  return VOLUME_TIERS[(i < 0 ? VOLUME_TIERS.indexOf(DEFAULT_TIER) : i + 1) % VOLUME_TIERS.length]
}
