/**
 * signatureTexts.js —— 招牌秘境的**首通文案**（只读配置层）（V6.4 · 批 D2）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《提炼-剧情发展路线》§五 挂载点（`at:'dungeon'`：招牌秘境首通文案，
 *       与本界 `SIGNATURE_ORIGIN` 的三态对齐）＋ §四 各世界路线卡的节点素材。
 *
 * 口径（与批 C 同构）：
 *   · 表结构 `{ <sigId>: '<首通叙事>' }`，**键 = `SIGNATURE_DUNGEONS[].id`**（18 条招牌）；
 *   · **不改 `dungeon.js`**（`name` / `theme` / `source` / `unlockRealm` / `material` / `matPerH` / `desc`
 *     一个数一个字不动）——本表是**叠加**：首通消息在既有「首通{名}（{三态} · 产出 x%）：…」之后追加叙事；
 *   · **三态口径由既有 `signatureStateOf` 承担**（本源洞天 / 游历洞天 / 他界洞天，见 `worlds.js` + `DungeonSystem.sigEntryOf`）：
 *     本表只写「这条招牌本身的味道」，不重复表达三态；
 *   · 每段 15~40 字（§1.3 关键节点演出口径）；对外原创措辞，不复用原型专名。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SIGNATURE_FIRST_TEXTS = {
  sig_tianhe: '星辉垂下来的时候，你下意识先算了算退路——然后才伸手去接。',
  sig_yaochi: '仙桃三千年一熟。你没舍得吃，先把它记进了本子里。',
  sig_minghe: '河面无风，浪却自己起。你数着呼吸，一寸一寸渡了过去。',
  sig_huanyue: '月上中天，石门自开。雾里看剑，你看清的是自己的心。',
  sig_shijian: '洞中一日，外头才一时。你把这份宽裕全用在了打坐上。',
  sig_tianting: '断瓦里还留着仙家气度。你捡起一片，像捡起一段别人的旧梦。',
  sig_hualing: '灵气化了形在廊下走动。你与它擦肩，它回头看了你一眼。',
  sig_qiling: '古人的库房不等人。你开门七日，把能带走的都带走了。',
  sig_xitian: '钟声一响，心魔退散。可惜钟声不常响，你赶紧多待了一会儿。',
  sig_dongxu: '虚空里裂开一线。钻进去的人各说各话，你只管自己那一份。',
  sig_zhongsheng: '秘境里开着集市，人声鼎沸。你混在人堆里，反倒觉得修行落到了实处。',
  sig_yinlv: '风里有人抚琴。你听懂了那一句，道行便长了一分。',
  sig_nixing: '洞壁刻满星辰与因果。出来时你摸了摸自己的脸：还是这张，但命换过了。',
  sig_meichi: '族中长辈闭关的旧宅，灵气三百年不曾散。你在门口站了很久。',
  sig_danuo: '傩面堆了一地。你捡起一张，跳完了那一场——居然没事。',
  sig_shenji: '炉火三百年未熄。傀儡排着队上工，你伸手替它拧紧了一颗松掉的螺丝。',
  sig_yuanshi: '半成形的器与灵排着队等你开口。你叫出第一个名字，它就替你站稳了。',
  sig_wuzhu: '不知哪路神道留下的祠庙，香火未尽。你上了柱香，把这份香火续了下来。'
}

/**
 * 取某条招牌的首通叙事；未登记 / 空值一律返回 ''（调用方回落既有首通消息，不追加）。
 * @param {string} sigId SIGNATURE_DUNGEONS[].id
 */
export function signatureFirstTextOf (sigId) {
  const t = SIGNATURE_FIRST_TEXTS[sigId]
  return typeof t === 'string' ? t : ''
}

export default { SIGNATURE_FIRST_TEXTS, signatureFirstTextOf }
