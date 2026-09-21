/**
 * itemLibraryWorld.js —— 物品库 · 12 界专属库（V7.1）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / 计划册 §13.1①）：纯配置层（data/），禁 import
 *   systems / ui / DOM / Phaser；本文件**零 import**（连 util 也不依赖），只导出常量。
 *
 * 口径（主人 2026-09-22 拍板）：**每界 32 条**，共 12 × 32 ＝ **384 条**，
 *   「专属库从原著中提取」——命名取自 12 部原著提炼素材与各界命名池，逐条标 `src` 出处。
 *
 * 命名与溯源口径（严格遵守，不得伪溯源）：
 *   · 名称一律用**对外名**，**不得复用原型作品专名**（剧情册 §总论 §1.5 的 IP 口径）；
 *   · `src` 取值只有四类：`命名池`（取自《提炼-剧情发展路线》§三 该界命名池）·
 *     `提炼·丹药` / `提炼·药材` / `提炼·法宝` / `提炼·灵兽`（取自《提炼-数据库素材》对应表）·
 *     `释义性命名`（该界主题下的释义命名，无单条直接出处）；
 *   · 已失效作品（《修真聊天群》《没钱修什么仙？》）**一律不作为来源**——其对应世界已换源为
 *     「观云界」（原型《我师兄实在太稳健了》）与「无缺古界」（原型《我欲封天》）。
 *
 * 类型与品质配比（每界 32 条；V7.3 D10 修正——原注释与实际数据不符，现按实测改）：
 *   丹药 8~9 · 材料 9~10 · 法宝 6 · 符箓 4 · 残页 4
 *   （**观云界 denghuo 与幽傩界 younuo 为「丹药 9 · 材料 9」**，其余 10 界为「丹药 8 · 材料 10」）；
 *   品质配比**逐界略有出入**（以各条 `quality` 字段为准，不再声称 12 界完全一致）——
 *   实测全量汇总：凡 76 · 良 75 · 珍 106 · 绝 92 · 仙 35 ＝ 384。
 *
 * id 口径：`<域>_<界码>_<slug>`（域＝pill/mat/treasure/talisman/frag；界码见下表），
 *   沿用 `techniqueLibrary.js` 的 `tech_<界码>_*` / `sectTechniques.js` 的 `sect_<界码>_*` 先例。
 *
 *   | 世界 | worldId | 界码 | 世界 | worldId | 界码 |
 *   |---|---|---|---|---|---|
 *   | 青岚界 | qinglan | ql | 通天界 | tongtian | tt |
 *   | 破晓星域 | poxiao | px | 天工界 | tiangong | tg |
 *   | 观云界 | denghuo | dh | 六面囚笼 | liumian | lm |
 *   | 青云古界 | qingyun | qy | 九鼎九州 | jiuding | jd |
 *   | 望族山河 | wangzu | wz | 无缺古界 | wuyuan | wy |
 *   | 幽傩界 | younuo | yn | 人间香火 | xianghuo | xh |
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 一行一条：id, name, icon, type, quality, desc, from, src（出处）；第 9 参 unit 覆盖类型默认单位 */
const it = (id, name, icon, type, quality, desc, from, src, unit) => {
  const o = { id, name, icon, type, quality, desc, from, src }
  if (unit) o.unit = unit
  return o
}

/** 按界绑定：本文件每条都带 worldId（与公用库的 `worldId: null` 相对） */
const w = (worldId) => (id, name, icon, type, quality, desc, from, src, unit) =>
  Object.assign(it(id, name, icon, type, quality, desc, from, src, unit), { worldId })

const NOT_YET = '未接产出（本批只入库）'

// ═══════════════════════════════════════════════════════════════════════════
// 01 青岚界（原型：凡人修仙传）· 命名池：青岚门｜无名口诀｜掌天瓶·碧液｜升仙擂｜筑基丹｜
//    灵药园｜符箓｜雷淬｜禁地试炼｜万珍楼｜洗髓散｜外门弟子
// ═══════════════════════════════════════════════════════════════════════════
const ql = w('qinglan')
export const W_QL = [
  // — 丹药 8 —
  ql('pill_ql_zhuji', '筑基丹', '筑基', 'pill', 'liang', '冲关筑基的入门丹，丹香里带一丝土腥。', NOT_YET, '提炼·丹药'),
  ql('pill_ql_bigu', '辟谷丹', '辟谷', 'pill', 'fan', '外门弟子常备：服后数日不知饥饿。', NOT_YET, '提炼·丹药'),
  ql('pill_ql_ningling', '凝灵散', '凝灵', 'pill', 'fan', '散剂冲服，聚拢周身散逸灵气。', NOT_YET, '释义性命名'),
  ql('pill_ql_huiling', '还灵丹', '还灵', 'pill', 'zhen', '丹成九转，灵气回涌如潮。', NOT_YET, '释义性命名'),
  ql('pill_ql_qingsui', '青髓丹', '青髓', 'pill', 'zhen', '取灵药园青竹髓炼成，清补兼施。', NOT_YET, '命名池'),
  ql('pill_ql_jinyuan', '进元丹', '进元', 'pill', 'jue', '丹入喉即化，修为涨得悄无声息。', NOT_YET, '释义性命名'),
  ql('pill_ql_qiankun', '乾坤一炁丹', '乾坤', 'pill', 'jue', '一枚丹藏一炁，服之如换新躯。', NOT_YET, '释义性命名'),
  ql('pill_ql_tianling', '天灵丹', '天灵', 'pill', 'xian', '万珍楼百年不出的上品，丹成时有异香绕梁。', NOT_YET, '命名池'),
  // — 材料 10 —
  ql('mat_ql_qingzhu', '青岚竹叶', '青竹', 'material', 'fan', '青岚峰南麓的野竹叶，揉碎有清苦竹香。', NOT_YET, '释义性命名'),
  ql('mat_ql_lingtian', '灵田土', '田土', 'material', 'fan', '灵药园翻地时刮下的浮土，仍带三分灵气。', NOT_YET, '命名池', '捧'),
  ql('mat_ql_hanshui', '寒泉水', '寒泉', 'material', 'fan', '峰顶寒泉，冬夏不冻，丹房用水首选。', NOT_YET, '释义性命名', '泓'),
  ql('mat_ql_biye', '碧液', '碧液', 'material', 'liang', '掌天瓶温养出的一线碧液，催熟灵植最灵。', NOT_YET, '命名池', '滴'),
  ql('mat_ql_leizhu', '雷竹', '雷竹', 'material', 'liang', '雷淬过的老竹，断口处仍隐隐发麻。', NOT_YET, '命名池', '节'),
  ql('mat_ql_shijing', '石精', '石精', 'material', 'liang', '禁地试炼石壁崩落的内核，坚而温润。', NOT_YET, '释义性命名', '块'),
  ql('mat_ql_wumingcao', '无名草', '无名', 'material', 'zhen', '无名口诀里提过一句的草，至今不知其名。', NOT_YET, '命名池', '株'),
  ql('mat_ql_lingyao', '灵药种籽', '药籽', 'material', 'zhen', '灵药园留种，落土即生，十年一熟。', NOT_YET, '命名池', '粒'),
  ql('mat_ql_longxue', '蛟龙残鳞', '龙鳞', 'material', 'jue', '域外蛟龙褪下的残鳞，边缘锋利如刃。', NOT_YET, '提炼·灵兽', '片'),
  ql('mat_ql_xingchen', '星辰砂', '星砂', 'material', 'xian', '升仙擂上落过的一撮星砂，掂着比山还沉。', NOT_YET, '命名池', '撮'),
  // — 法宝 6 —
  ql('treasure_ql_xuanhu', '玄虎环', '玄虎', 'treasure', 'liang', '护身环一圈玄纹，遇袭自鸣。', NOT_YET, '释义性命名'),
  ql('treasure_ql_qingfeng', '青锋匕', '青锋', 'treasure', 'liang', '外门弟子人手一柄的制式短匕。', NOT_YET, '命名池'),
  ql('treasure_ql_wanbao', '万珍宝鉴', '宝鉴', 'treasure', 'zhen', '照物即知其价，万珍楼坐柜之物。', NOT_YET, '命名池'),
  ql('treasure_ql_shengxian', '升仙令', '仙令', 'treasure', 'jue', '升仙擂通关者的身份牌，旧痕斑驳。', NOT_YET, '命名池'),
  ql('treasure_ql_shanhe', '山河袖', '山河', 'treasure', 'jue', '袖中藏一隅山河，可收可放。', NOT_YET, '释义性命名'),
  ql('treasure_ql_biluo', '碧罗伞', '碧罗', 'treasure', 'xian', '伞面推开如碧叶擎天，雷火不侵。', NOT_YET, '释义性命名'),
  // — 符箓 4 —
  ql('talisman_ql_jingxin', '静心符', '静心', 'talisman', 'fan', '外门夜课用的清心符，一贴便静。', NOT_YET, '命名池'),
  ql('talisman_ql_zipao', '紫袍符', '紫袍', 'talisman', 'liang', '焚之如披紫袍，气势陡涨三分。', NOT_YET, '提炼·法宝'),
  ql('talisman_ql_leiqian', '雷签符', '雷签', 'talisman', 'zhen', '签出即引一道细雷，为雷淬做引。', NOT_YET, '命名池'),
  ql('talisman_ql_huazhen', '化真符', '化真', 'talisman', 'jue', '符成真意，可短暂模拟上一境威压。', NOT_YET, '释义性命名'),
  // — 残页 4 —
  ql('frag_ql_wuming', '无名口诀残页', '口诀', 'fragment', 'fan', '只余半句口诀，读来却通体生暖。', NOT_YET, '命名池'),
  ql('frag_ql_dange', '丹方残页', '丹方', 'fragment', 'liang', '缺了主料那一行，其余尚可辨认。', NOT_YET, '命名池'),
  ql('frag_ql_zhenjie', '阵解残页', '阵解', 'fragment', 'zhen', '禁地试炼的破阵思路，画得潦草。', NOT_YET, '命名池'),
  ql('frag_ql_shengtai', '擂台旧谱', '旧谱', 'fragment', 'jue', '升仙擂历届胜者留下的手记。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 02 破晓星域（原型：仙逆）· 命名池：破晓宗｜边陲小宗｜天逆珠｜窃基法｜域外战场｜
//    神识极境｜魔傀替身｜古传送阵｜禁制谱｜炼魂幡｜栖魂林｜踏天阶
// ═══════════════════════════════════════════════════════════════════════════
const px = w('poxiao')
export const W_PX = [
  px('pill_px_ningji', '凝基丹', '凝基', 'pill', 'liang', '边陲小宗压箱底的凝基丹，丹色如夜。', NOT_YET, '提炼·丹药'),
  px('pill_px_ading', '星辉散', '星辉', 'pill', 'fan', '星域夜露调成的散剂，服之目清。', NOT_YET, '释义性命名'),
  px('pill_px_suigu', '碎骨丹', '碎骨', 'pill', 'fan', '疗骨丹的粗制品，苦得皱眉。', NOT_YET, '提炼·丹药'),
  px('pill_px_zhenshi', '镇识丹', '镇识', 'pill', 'zhen', '神识躁动时服一枚，如冷水浇头。', NOT_YET, '命名池'),
  px('pill_px_duotian', '夺天丹', '夺天', 'pill', 'zhen', '窃基法改炼出的旁门丹，成率极低。', NOT_YET, '命名池'),
  px('pill_px_lianhun', '炼魂丹', '炼魂', 'pill', 'jue', '一炉只出一枚，魂火淬过的青黑。', NOT_YET, '命名池'),
  px('pill_px_nitian', '逆天丹', '逆天', 'pill', 'jue', '天逆珠旁温养出的异丹，触手微凉。', NOT_YET, '命名池'),
  px('pill_px_taotian', '踏天丹', '踏天', 'pill', 'xian', '踏天阶全数走尽者，才配服这一枚。', NOT_YET, '命名池'),
  px('mat_px_xingsha', '陨星砂', '陨砂', 'material', 'fan', '域外战场随处可拾，锋利扎手。', NOT_YET, '命名池', '撮'),
  px('mat_px_pojing', '破镜石', '破镜', 'material', 'fan', '镜面碎处最坚，磨得一手血。', NOT_YET, '释义性命名', '块'),
  px('mat_px_lianhunshi', '炼魂石', '魂石', 'material', 'liang', '炼魂幡炼剩的边角，仍摄人。', NOT_YET, '命名池', '块'),
  px('mat_px_bianchui', '边陲铁', '边铁', 'material', 'liang', '边陲小宗境内所产，粗粝耐磨。', NOT_YET, '命名池', '块'),
  px('mat_px_shenshi', '神识晶', '识晶', 'material', 'zhen', '神识极境凝聚成晶，握久头痛。', NOT_YET, '命名池', '枚'),
  px('mat_px_shuoying', '摄魂萤', '魂萤', 'material', 'zhen', '栖魂林里成群浮动，捉之即灭。', NOT_YET, '命名池', '只'),
  px('mat_px_zhuanzhen', '传送阵残砖', '阵砖', 'material', 'zhen', '古传送阵崩落的一块，纹路尚全。', NOT_YET, '命名池', '块'),
  px('mat_px_bushi', '不蚀木', '不蚀', 'material', 'jue', '禁制谱记过一页：此木千年不腐。', NOT_YET, '命名池', '段'),
  px('mat_px_tianni', '天逆珠屑', '逆屑', 'material', 'xian', '天逆珠打磨时落下的一线碎屑。', NOT_YET, '命名池', '撮'),
  px('mat_px_qihunyu', '栖魂雨', '魂雨', 'material', 'fan', '栖魂林落过的雨，接在碗里会自己晃。', NOT_YET, '命名池', '碗'),
  px('treasure_px_pojing', '破晓镜', '晓镜', 'treasure', 'liang', '镜背刻一轮初日，照人心境。', NOT_YET, '释义性命名'),
  px('treasure_px_mokui', '魔傀替身', '魔傀', 'treasure', 'zhen', '代主受死一次的傀儡，面容模糊。', NOT_YET, '命名池'),
  px('treasure_px_lianhunfan', '炼魂幡', '魂幡', 'treasure', 'zhen', '幡动风起，林中虫鸣俱寂。', NOT_YET, '命名池'),
  px('treasure_px_jinzhipu', '禁制谱', '禁谱', 'treasure', 'jue', '一门禁制的全本，字迹是血写的。', NOT_YET, '命名池'),
  px('treasure_px_yuwai', '域外战旗', '战旗', 'treasure', 'jue', '边陲小宗战旗残幅，弹之有声。', NOT_YET, '命名池'),
  px('treasure_px_shenshi', '神识极境珠', '识境', 'treasure', 'xian', '珠中自成一界，照见神识尽头。', NOT_YET, '命名池'),
  px('talisman_px_duolei', '引星符', '引星', 'talisman', 'fan', '夜里焚之，星光如水倾下。', NOT_YET, '释义性命名'),
  px('talisman_px_zhizhen', '滞神符', '滞神', 'talisman', 'liang', '符光一罩，对手神识迟滞一息。', NOT_YET, '命名池'),
  px('talisman_px_qianghun', '锢魂符', '锢魂', 'talisman', 'zhen', '锢住一缕残魂，不让它散。', NOT_YET, '命名池'),
  px('talisman_px_potian', '破天符', '破天', 'talisman', 'jue', '符起处天幕裂开一线，转瞬即合。', NOT_YET, '命名池'),
  px('frag_px_qieji', '窃基法残卷', '窃基', 'fragment', 'fan', '旁门夺基之术，缺了起手一式。', NOT_YET, '命名池'),
  px('frag_px_zhuanzhen', '传送阵图', '阵图', 'fragment', 'liang', '半张阵图，另一半随古阵沉了。', NOT_YET, '命名池'),
  px('frag_px_shenshi', '神识手记', '识记', 'fragment', 'zhen', '前人探神识极境的零散笔记。', NOT_YET, '命名池'),
  px('frag_px_tati', '踏天阶石录', '阶录', 'fragment', 'jue', '每一阶石上刻过一句话，抄录者添了批注。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 03 观云界（原型：我师兄实在太稳健了）· 命名池：观云峰｜小炉峰｜入门审核｜替身纸偶｜
//    底牌簿｜退路预案｜功德簿｜天庭闲职｜河神土地｜香火愿力｜天道债券｜均势之道
//    ⚠ 本界**前身「灯火人间」及《修真聊天群》原型已失效**，一律不引旧表条目。
// ═══════════════════════════════════════════════════════════════════════════
const dh = w('denghuo')
export const W_DH = [
  dh('pill_dh_anwen', '安神丹', '安神', 'pill', 'fan', '观云峰夜课常备，服之安睡不做梦。', NOT_YET, '释义性命名'),
  dh('pill_dh_butian', '补天丹', '补天', 'pill', 'fan', '师父说：补的不是天，是你算漏的那一步。', NOT_YET, '提炼·丹药'),
  dh('pill_dh_miany', '免役丹', '免役', 'pill', 'liang', '服后可推掉一场差役，理由自洽。', NOT_YET, '释义性命名'),
  dh('pill_dh_dingxin', '定心丹', '定心', 'pill', 'liang', '临阵不乱，靠的从来是这枚丹。', NOT_YET, '释义性命名'),
  dh('pill_dh_gongde', '功德丹', '德丹', 'pill', 'zhen', '功德簿上记满一页，才换得这一枚。', NOT_YET, '命名池'),
  dh('pill_dh_tuilu', '退路丹', '退路', 'pill', 'zhen', '吞下便知还有几步可退，心里踏实。', NOT_YET, '命名池'),
  dh('pill_dh_dunshi', '遁世丹', '遁世', 'pill', 'jue', '服之如人间蒸发，三月无人寻得。', NOT_YET, '释义性命名'),
  dh('pill_dh_junshi', '均势丹', '均势', 'pill', 'jue', '不增不减，只把你与对手拉到同一线。', NOT_YET, '命名池'),
  dh('pill_dh_xiantian', '仙庭赐丹', '赐丹', 'pill', 'xian', '天庭闲职的体面：赐丹一枚，不必谢恩。', NOT_YET, '命名池'),
  dh('mat_dh_luzhu', '小炉峰炉灰', '炉灰', 'material', 'fan', '小炉峰倒了三十年的炉灰，肥力极好。', NOT_YET, '命名池', '捧'),
  dh('mat_dh_luoye', '观云落叶', '落叶', 'material', 'fan', '观云峰落叶扫之不尽，可入符纸。', NOT_YET, '命名池', '捧'),
  dh('mat_dh_dipai', '底牌簿抄本', '底牌', 'material', 'liang', '抄一份底牌簿，比多修三年管用。', NOT_YET, '命名池', '册'),
  dh('mat_dh_xianghuo', '香火愿力', '愿力', 'material', 'liang', '河神土地攒下的愿力，摸着温手。', NOT_YET, '命名池', '缕'),
  dh('mat_dh_zhaiquan', '天道债券', '债券', 'material', 'zhen', '与天借的一笔，利息写得极小。', NOT_YET, '命名池', '纸'),
  dh('mat_dh_yuanci', '均势原瓷', '原瓷', 'material', 'zhen', '瓷面不偏不倚，是均势之道的器。', NOT_YET, '命名池', '片'),
  dh('mat_dh_heqi', '河神水印', '水印', 'material', 'zhen', '河神盖章的一枚水印，可渡一次急流。', NOT_YET, '命名池', '枚'),
  dh('mat_dh_yunshi', '云根石', '云石', 'material', 'jue', '观云峰下云生的根，轻得能浮。', NOT_YET, '释义性命名', '块'),
  dh('mat_dh_xianzhi', '闲职印绶', '印绶', 'material', 'xian', '天庭闲职的印绶，压得住场面。', NOT_YET, '命名池', '方'),
  dh('treasure_dh_tishen', '替身纸偶', '纸偶', 'treasure', 'liang', '多备一份退路：可替一次「没算到」。', NOT_YET, '命名池'),
  dh('treasure_dh_gongdebu', '功德簿', '功德', 'treasure', 'zhen', '摊开便知谁欠了谁的账。', NOT_YET, '命名池'),
  dh('treasure_dh_tuilu', '退路图册', '退路', 'treasure', 'zhen', '三十七条退路，条条画得清楚。', NOT_YET, '命名池'),
  dh('treasure_dh_yunzhong', '云中伞', '云伞', 'treasure', 'jue', '撑开便在云里，谁也叫不应你。', NOT_YET, '释义性命名'),
  dh('treasure_dh_pingheng', '平衡尺', '衡尺', 'treasure', 'jue', '量得出两方力气差多少，分毫不差。', NOT_YET, '命名池'),
  dh('treasure_dh_yunchen', '观云盘', '云盘', 'treasure', 'xian', '一盘观尽十二界云的走向。', NOT_YET, '命名池'),
  dh('talisman_dh_zhaiming', '挡灾符', '挡灾', 'talisman', 'fan', '一符挡一灾，灾小符小。', NOT_YET, '释义性命名'),
  dh('talisman_dh_huanzhi', '换职符', '换职', 'talisman', 'liang', '焚之可调一次闲职，换个清静。', NOT_YET, '命名池'),
  dh('talisman_dh_xingshi', '醒神符', '醒神', 'talisman', 'zhen', '贴在额上，专治「算漏一件事」。', NOT_YET, '释义性命名'),
  dh('talisman_dh_junshi', '均势符', '均势', 'talisman', 'jue', '符光过处，两边力气被抹平一半。', NOT_YET, '命名池'),
  dh('frag_dh_rumen', '入门审核录', '审核', 'fragment', 'fan', '第一问：什么最危险？答者名字都在。', NOT_YET, '命名池'),
  dh('frag_dh_yuan', '退路预案稿', '预案', 'fragment', 'liang', '推演到第七遍才写下的那三条。', NOT_YET, '命名池'),
  dh('frag_dh_gongde', '功德簿残页', '功页', 'fragment', 'zhen', '撕去的那一页，正是关键。', NOT_YET, '命名池'),
  dh('frag_dh_junshi', '均势之道注', '均注', 'fragment', 'jue', '批注者只写了四个字：不妨再算。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 04 青云古界（原型：诛仙）· 命名池：云嶂门｜苍竹峰｜翠竹峰｜玉清境｜赤铁棍｜玉书四卷｜
//    同心铃｜离火鉴｜剑冢｜正魔大战｜七峰会武｜剑意超脱
// ═══════════════════════════════════════════════════════════════════════════
const qy = w('qingyun')
export const W_QY = [
  qy('pill_qy_ningjian', '凝剑丹', '凝剑', 'pill', 'liang', '丹入喉如含剑锋，气机转锐。', NOT_YET, '命名池'),
  qy('pill_qy_qingxin', '清心丹', '清心', 'pill', 'fan', '苍竹峰夜修必服，压住心头浮火。', NOT_YET, '释义性命名'),
  qy('pill_qy_guyuan', '固元丹', '固元', 'pill', 'fan', '云嶂门入门配给，固本不伤。', NOT_YET, '提炼·丹药'),
  qy('pill_qy_yuqing', '玉清丹', '玉清', 'pill', 'zhen', '玉清境边采的药炼成，入口清冽。', NOT_YET, '命名池'),
  qy('pill_qy_chitang', '赤铁丹', '赤铁', 'pill', 'zhen', '赤铁棍锈屑入丹，炼体者最爱。', NOT_YET, '命名池'),
  qy('pill_qy_jianxin', '剑心丹', '剑心', 'pill', 'jue', '服之则剑意不散，人剑俱静。', NOT_YET, '命名池'),
  qy('pill_qy_zuimo', '诛魔丹', '诛魔', 'pill', 'jue', '正魔大战中炼出的军用丹，杀气未褪。', NOT_YET, '命名池'),
  qy('pill_qy_chaotuo', '超脱丹', '超脱', 'pill', 'xian', '剑意超脱者才炼得出的丹，无味无色。', NOT_YET, '命名池'),
  qy('mat_qy_cangzhu', '苍竹心', '竹心', 'material', 'fan', '苍竹峰老竹的中心一节，韧如筋。', NOT_YET, '命名池', '节'),
  qy('mat_qy_cuizhu', '翠竹露', '竹露', 'material', 'fan', '翠竹峰晨露，日出即散。', NOT_YET, '命名池', '滴'),
  qy('mat_qy_chiie', '赤铁矿砂', '赤砂', 'material', 'liang', '赤铁棍同源的矿砂，色如凝血。', NOT_YET, '命名池', '捧'),
  qy('mat_qy_yushu', '玉书页', '玉书', 'material', 'liang', '玉书四卷脱落的活页，字会自己挪。', NOT_YET, '命名池', '页'),
  qy('mat_qy_tongxin', '同心铃芯', '铃芯', 'material', 'zhen', '同心铃不响时取出的芯，余音三日。', NOT_YET, '命名池', '枚'),
  qy('mat_qy_lihuo', '离火精', '离火', 'material', 'zhen', '离火鉴背面收的一缕火，装进玉瓶才稳。', NOT_YET, '命名池', '缕'),
  qy('mat_qy_jianyishi', '剑意石', '剑石', 'material', 'zhen', '剑冢里被剑意洗过千年的石头。', NOT_YET, '命名池', '块'),
  qy('mat_qy_zhengmoxue', '正魔战血土', '战土', 'material', 'jue', '正魔大战打过的那片土，雨冲不淡。', NOT_YET, '命名池', '捧'),
  qy('mat_qy_qifengmu', '七峰会武木', '会武', 'material', 'jue', '会武擂台的立柱残木，指印重叠。', NOT_YET, '命名池', '段'),
  qy('mat_qy_jianzhong', '剑冢铁英', '铁英', 'material', 'xian', '剑冢最深处析出的铁英，一触伤手。', NOT_YET, '命名池', '块'),
  qy('treasure_qy_chitiegum', '赤铁棍', '铁棍', 'treasure', 'liang', '云嶂门制式长棍，重而不钝。', NOT_YET, '命名池'),
  qy('treasure_qy_yushu', '玉书四卷', '玉书', 'treasure', 'zhen', '四卷同参，可补全一门剑诀。', NOT_YET, '命名池'),
  qy('treasure_qy_tongxinling', '同心铃', '同铃', 'treasure', 'zhen', '铃响一处，另一处自知。', NOT_YET, '命名池'),
  qy('treasure_qy_lihuojian', '离火鉴', '火鉴', 'treasure', 'jue', '鉴面照出心火，火旺者不敢多看。', NOT_YET, '命名池'),
  qy('treasure_qy_jianzhongjian', '剑冢故剑', '故剑', 'treasure', 'jue', '剑冢里唯一一柄还认主的剑。', NOT_YET, '命名池'),
  qy('treasure_qy_chaotuo', '超脱剑匣', '剑匣', 'treasure', 'xian', '剑匣无剑，开匣者自提剑意。', NOT_YET, '命名池'),
  qy('talisman_qy_zhuxie', '诛邪符', '诛邪', 'talisman', 'fan', '云嶂门年节分发，家家贴一张。', NOT_YET, '释义性命名'),
  qy('talisman_qy_gujian', '固剑符', '固剑', 'talisman', 'liang', '剑意将散时贴上，可保三日不坠。', NOT_YET, '命名池'),
  qy('talisman_qy_zhenmo', '镇魔符', '镇魔', 'talisman', 'zhen', '正魔大战遗符，贴处寸草不生。', NOT_YET, '命名池'),
  qy('talisman_qy_jianyi', '剑意符', '剑意', 'talisman', 'jue', '符中封一道剑意，出手即到。', NOT_YET, '命名池'),
  qy('frag_qy_jianpu', '剑谱残页', '剑谱', 'fragment', 'fan', '只剩起手三式，后续被撕走了。', NOT_YET, '命名池'),
  qy('frag_qy_yuqing', '玉清境注', '玉注', 'fragment', 'liang', '前人过玉清境时写下的批注。', NOT_YET, '命名池'),
  qy('frag_qy_zhengmo', '正魔战录', '战录', 'fragment', 'zhen', '记到第三天就断了笔。', NOT_YET, '命名池'),
  qy('frag_qy_chaotuo', '超脱篇', '超脱', 'fragment', 'jue', '通篇只说一件事：剑不在手里。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 05 望族山河（原型：玄鉴仙族）· 命名池：古镜｜符种｜宗子｜箓丹｜仙基｜金性｜洞天之境｜
//    族事堂｜族谱｜祠堂｜族贡｜供奉三成
// ═══════════════════════════════════════════════════════════════════════════
const wz = w('wangzu')
export const W_WZ = [
  wz('pill_wz_fuzhong', '符种丹', '符种', 'pill', 'liang', '符种入体时配服的引丹，微苦。', NOT_YET, '命名池'),
  wz('pill_wz_zongzi', '宗子丹', '宗子', 'pill', 'fan', '宗子开蒙必服，取「先立其心」之意。', NOT_YET, '命名池'),
  wz('pill_wz_ludan', '箓丹', '箓丹', 'pill', 'fan', '族中限量配给，一年不过三枚。', NOT_YET, '命名池'),
  wz('pill_wz_bigu', '辟谷散', '辟散', 'pill', 'fan', '族学月考期间靠它省下三餐。', NOT_YET, '释义性命名'),
  wz('pill_wz_xianji', '仙基丹', '仙基', 'pill', 'zhen', '铸仙基前一日服下，稳过夜。', NOT_YET, '命名池'),
  wz('pill_wz_jinxing', '金性丹', '金性', 'pill', 'zhen', '金性初凝者忌用，族老反复叮嘱。', NOT_YET, '命名池'),
  wz('pill_wz_dongtian', '洞天丹', '洞天', 'pill', 'jue', '洞天之境的门票，只给族里最稳的那个。', NOT_YET, '命名池'),
  wz('pill_wz_zuji', '族祭丹', '族祭', 'pill', 'jue', '祠堂大祭才开炉，香灰里滚过一遍。', NOT_YET, '命名池'),
  wz('mat_wz_gujing', '古镜粉末', '古镜', 'material', 'fan', '古镜碎了，粉留着，镜身还在族祠。', NOT_YET, '命名池', '撮'),
  wz('mat_wz_zupu', '族谱纸', '族谱', 'material', 'fan', '族谱用的老纸，虫不蛀。', NOT_YET, '命名池', '页'),
  wz('mat_wz_zuci', '祠堂香灰', '祠灰', 'material', 'liang', '祠堂积年的香灰，说是能镇邪。', NOT_YET, '命名池', '捧'),
  wz('mat_wz_zugong', '族贡帛', '族贡', 'material', 'liang', '族贡上缴时的凭证帛，按职级分色。', NOT_YET, '命名池', '匹'),
  wz('mat_wz_gongfeng', '供奉契', '供奉', 'material', 'zhen', '供奉三成的契书，字迹是族老的。', NOT_YET, '命名池', '纸'),
  wz('mat_wz_fuzhongzi', '符种残壳', '种壳', 'material', 'zhen', '符种离体后留下的壳，硬如铁。', NOT_YET, '命名池', '枚'),
  wz('mat_wz_jingxin', '镜心砂', '镜砂', 'material', 'zhen', '古镜镜心磨出的细砂，照之见影。', NOT_YET, '命名池', '撮'),
  wz('mat_wz_yuehua', '月华霜', '月霜', 'material', 'jue', '镜面牵月华凝的霜，日出前须收。', NOT_YET, '释义性命名', '撮'),
  wz('mat_wz_zuyun', '族运丝', '运丝', 'material', 'jue', '抽一缕族运纺成的丝，断了族里要出人。', NOT_YET, '命名池', '缕'),
  wz('mat_wz_jinxing', '金性髓', '金髓', 'material', 'xian', '金性最深处的一线髓，族中至宝。', NOT_YET, '命名池', '滴'),
  wz('treasure_wz_gujing', '青铜旧镜', '旧镜', 'treasure', 'liang', '镜背铜锈成纹，照人略显旧相。', NOT_YET, '命名池'),
  wz('treasure_wz_ludanlu', '箓丹炉', '箓炉', 'treasure', 'zhen', '族中箓丹专用的小炉，炉腹刻族徽。', NOT_YET, '命名池'),
  wz('treasure_wz_zupai', '族事堂牌', '族牌', 'treasure', 'zhen', '持牌可入族事堂议事，位次看牌色。', NOT_YET, '命名池'),
  wz('treasure_wz_dongtian', '洞天印', '洞印', 'treasure', 'jue', '一印可开一隅洞天，只容一人。', NOT_YET, '命名池'),
  wz('treasure_wz_fuzhongj', '符种母种', '母种', 'treasure', 'jue', '一代只出一枚母种，族老争了三天。', NOT_YET, '命名池'),
  wz('treasure_wz_jingxin', '古镜镜心', '镜心', 'treasure', 'xian', '镜心一面，照得出这一族的运数。', NOT_YET, '命名池'),
  wz('talisman_wz_baojia', '保甲符', '保甲', 'talisman', 'fan', '族中子弟外出必带，保一时平安。', NOT_YET, '释义性命名'),
  wz('talisman_wz_shouyun', '守运符', '守运', 'talisman', 'liang', '贴于门楣，族运不散。', NOT_YET, '命名池'),
  wz('talisman_wz_duzhi', '镀枝符', '镀枝', 'talisman', 'zhen', '给族人镀一层护枝，出门不遭风。', NOT_YET, '释义性命名'),
  wz('talisman_wz_huanling', '换灵符', '换灵', 'talisman', 'jue', '族里秘传，可暂借族中长辈一分灵压。', NOT_YET, '命名池'),
  wz('frag_wz_zupu', '族谱残页', '族页', 'fragment', 'fan', '记着三代前的一桩旧事。', NOT_YET, '命名池'),
  wz('frag_wz_zhongfa', '符种授法', '授法', 'fragment', 'liang', '授符种当日的仪注，抄得工整。', NOT_YET, '命名池'),
  wz('frag_wz_dongtian', '洞天记', '洞记', 'fragment', 'zhen', '进过洞天的人各写一段，说法不一。', NOT_YET, '命名池'),
  wz('frag_wz_jinxing', '金性篇', '金篇', 'fragment', 'jue', '只论金性如何不坏，不论如何得。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 06 幽傩界（原型：道诡异仙）· 命名池：药房｜药引｜丹方｜玄鼎｜阳寿｜真性｜走火｜请神｜
//    真幻｜秘闻｜执命｜言出
// ═══════════════════════════════════════════════════════════════════════════
const yn = w('younuo')
export const W_YN = [
  yn('pill_yn_yaoyin', '药引丹', '药引', 'pill', 'liang', '药房配伍之始：无引则药不灵。', NOT_YET, '命名池'),
  yn('pill_yn_zhenxing', '真性丹', '真性', 'pill', 'fan', '守住一分真性，就不算走火。', NOT_YET, '命名池'),
  yn('pill_yn_yangshou', '阳寿丹', '阳寿', 'pill', 'fan', '借来的阳寿也记在账上，只是不写利息。', NOT_YET, '命名池'),
  yn('pill_yn_anhun', '安魂丹', '安魂', 'pill', 'fan', '请神之后服一枚，把借来的魂还回去。', NOT_YET, '释义性命名'),
  yn('pill_yn_zouhuo', '走火丹', '走火', 'pill', 'zhen', '明知会走火，仍有人抢着吃。', NOT_YET, '命名池'),
  yn('pill_yn_qingshen', '请神丹', '请神', 'pill', 'zhen', '服下便听得见「那一位」的呼吸。', NOT_YET, '命名池'),
  yn('pill_yn_zhiming', '执命丹', '执命', 'pill', 'jue', '执命者持之，命由己不由天。', NOT_YET, '命名池'),
  yn('pill_yn_yanchu', '言出丹', '言出', 'pill', 'jue', '言出法随，代价是此后少言。', NOT_YET, '命名池'),
  yn('pill_yn_xuanding', '玄鼎丹', '玄鼎', 'pill', 'xian', '玄鼎开炉一次，只此一枚。', NOT_YET, '命名池'),
  yn('mat_yn_yaozha', '药房药渣', '药渣', 'material', 'fan', '药房倒掉的渣，虫蚁不敢近。', NOT_YET, '命名池', '捧'),
  yn('mat_yn_danfang', '丹方残纸', '方纸', 'material', 'fan', '丹方写在黄纸上，字会淡。', NOT_YET, '命名池', '张'),
  yn('mat_yn_zhenhuan', '真幻尘', '幻尘', 'material', 'liang', '真幻交界落下的尘，一吹两边都散。', NOT_YET, '命名池', '撮'),
  yn('mat_yn_miwen', '秘闻笔录', '秘闻', 'material', 'liang', '记着一条不该被记下的秘闻。', NOT_YET, '命名池', '册'),
  yn('mat_yn_huizhu', '灰烛泪', '烛泪', 'material', 'zhen', '灰烛烧尽后的泪，凝而不散。', NOT_YET, '释义性命名', '滴'),
  yn('mat_yn_gumu', '古木心', '木心', 'material', 'zhen', '药房梁上拆下的古木心，隐隐跳。', NOT_YET, '释义性命名', '段'),
  yn('mat_yn_xuanding', '玄鼎炉渣', '鼎渣', 'material', 'zhen', '玄鼎炼剩的渣，冷了就硬。', NOT_YET, '命名池', '块'),
  yn('mat_yn_zhiming', '执命绳', '命绳', 'material', 'jue', '牵过命的绳，一头还空着。', NOT_YET, '命名池', '段'),
  yn('mat_yn_zhenshen', '真神骨屑', '神骨', 'material', 'xian', '请神请来的那一缕，落了屑。', NOT_YET, '命名池', '撮'),
  yn('treasure_yn_yaofangpai', '药房令', '药令', 'treasure', 'liang', '持令可开药房三层，第四层看运气。', NOT_YET, '命名池'),
  yn('treasure_yn_zhenji', '真性镜', '真镜', 'treasure', 'zhen', '照出的是真性，不是脸。', NOT_YET, '命名池'),
  yn('treasure_yn_qingshenq', '请神旗', '神旗', 'treasure', 'zhen', '旗一展，四邻皆静，只闻风。', NOT_YET, '命名池'),
  yn('treasure_yn_hundeng', '魂灯', '魂灯', 'treasure', 'jue', '灯灭之前，人都还算活着。', NOT_YET, '释义性命名'),
  yn('treasure_yn_zhenhuanpan', '真幻盘', '幻盘', 'treasure', 'jue', '盘上两针，一指针，一针幻。', NOT_YET, '命名池'),
  yn('treasure_yn_xuandingtan', '玄鼎', '玄鼎', 'treasure', 'xian', '鼎身无纹，只看得出用了很久。', NOT_YET, '命名池'),
  yn('talisman_yn_zhenyan', '真言符', '真言', 'talisman', 'fan', '说一句真话，符就亮一分。', NOT_YET, '释义性命名'),
  yn('talisman_yn_quhui', '驱秽符', '驱秽', 'talisman', 'liang', '屋角贴一张，夜里少些动静。', NOT_YET, '释义性命名'),
  yn('talisman_yn_huanshen', '换神符', '换神', 'talisman', 'zhen', '请来的那位不满意，可换一位。', NOT_YET, '命名池'),
  yn('talisman_yn_yanchu', '言出符', '言出', 'talisman', 'jue', '符上无字，因字已被说尽。', NOT_YET, '命名池'),
  yn('frag_yn_yaofang', '药房总录', '房录', 'fragment', 'fan', '药房出入的账，缺了三年。', NOT_YET, '命名池'),
  yn('frag_yn_zhiminglu', '执命录', '命录', 'fragment', 'liang', '记着谁执过命，谁被执了命。', NOT_YET, '命名池'),
  yn('frag_yn_zhenhuan', '真幻辨', '幻辨', 'fragment', 'zhen', '一页只写五字：先信，再疑。', NOT_YET, '命名池'),
  yn('frag_yn_yanchu', '言出戒', '言戒', 'fragment', 'jue', '末页被舔掉了角，像是故意的。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 07 通天界（原型：一念永恒）· 命名池：通天宗｜灶房｜长生功｜铁身·金身·金刚骨｜天道突破｜
//    合流宗｜炼魂试炼｜星墟道榜｜冥主位｜尊位劫｜岁月长河｜长生花
// ═══════════════════════════════════════════════════════════════════════════
const tt = w('tongtian')
export const W_TT = [
  tt('pill_tt_lianshen', '炼身丹', '炼身', 'pill', 'liang', '铁身入门先炼皮，这丹是打底用的。', NOT_YET, '命名池'),
  tt('pill_tt_changtian', '长生丹', '长生', 'pill', 'fan', '通天宗灶房日日开炉，弟子人人有份。', NOT_YET, '命名池'),
  tt('pill_tt_guyao', '固药丹', '固药', 'pill', 'fan', '灶房熬药剩下的凝膏，搓成丸。', NOT_YET, '命名池'),
  tt('pill_tt_jinshen', '金身丹', '金刚', 'pill', 'zhen', '金身未成者忌服，服之皮肉发烫。', NOT_YET, '命名池'),
  tt('pill_tt_zaohua', '造化丹', '天造', 'pill', 'zhen', '天道突破前服一枚，只求不亏。', NOT_YET, '提炼·丹药'),
  tt('pill_tt_ok', '合流丹', '合流', 'pill', 'jue', '合流宗秘制：两脉合一，只成一次。', NOT_YET, '命名池'),
  tt('pill_tt_mingzhu', '冥主丹', '冥主', 'pill', 'jue', '冥主位空着，先备一枚丹。', NOT_YET, '命名池'),
  tt('pill_tt_suiyue', '岁月丹', '岁月', 'pill', 'xian', '服之如过百年，镜中人却未老。', NOT_YET, '命名池'),
  tt('mat_tt_zaotang', '灶房炭', '灶炭', 'material', 'fan', '灶房烧了百年的炭，火性绵长。', NOT_YET, '命名池', '捧'),
  tt('mat_tt_tieshen', '铁身锈', '铁锈', 'material', 'fan', '铁身修士脱落的一层锈皮，硬得扎手。', NOT_YET, '命名池', '片'),
  tt('mat_tt_jingang', '金刚骨屑', '金骨', 'material', 'liang', '金刚骨淬炼时落下的碎屑。', NOT_YET, '命名池', '撮'),
  tt('mat_tt_changshenghua', '长生花', '生花', 'material', 'liang', '一开十二年，谢了不落。', NOT_YET, '命名池', '朵'),
  tt('mat_tt_lianhunhui', '炼魂灰', '魂灰', 'material', 'zhen', '炼魂试炼烧剩的灰，遇水不散。', NOT_YET, '命名池', '捧'),
  tt('mat_tt_xingxu', '星墟砂', '墟砂', 'material', 'zhen', '星墟道榜台下积的砂，踩着发凉。', NOT_YET, '命名池', '撮'),
  tt('mat_tt_zunwei', '尊位印泥', '印泥', 'material', 'zhen', '尊位劫后留下的印泥，抹不净。', NOT_YET, '命名池', '盒'),
  tt('mat_tt_suiyue', '岁月长河水', '岁水', 'material', 'jue', '长河里的一瓢，捧在手里就少了半瓢。', NOT_YET, '命名池', '瓢'),
  tt('mat_tt_tongtian', '通天木', '天木', 'material', 'jue', '宗内那株老木落下的枝，直指天。', NOT_YET, '命名池', '段'),
  tt('mat_tt_minghe', '冥河寒石', '冥石', 'material', 'xian', '冥主位旁的一块寒石，百年不化。', NOT_YET, '命名池', '块'),
  tt('treasure_tt_tieshenjia', '铁身甲', '铁甲', 'treasure', 'liang', '穿久了会与皮肉长在一起。', NOT_YET, '命名池'),
  tt('treasure_tt_zaoding', '灶房鼎', '灶鼎', 'treasure', 'zhen', '灶房的公用鼎，谁都能用，谁都不认。', NOT_YET, '命名池'),
  tt('treasure_tt_daobang', '星墟道榜牌', '道牌', 'treasure', 'zhen', '上榜者的牌，名次刻在背面。', NOT_YET, '命名池'),
  tt('treasure_tt_mingzhuwei', '冥主位牌', '冥位', 'treasure', 'jue', '牌上无字，坐上才显名。', NOT_YET, '命名池'),
  tt('treasure_tt_heliu', '合流双鱼佩', '双鱼', 'treasure', 'jue', '两鱼相衔，取「两脉归一处」之意。', NOT_YET, '命名池'),
  tt('treasure_tt_changsheng', '长生盏', '生盏', 'treasure', 'xian', '盏中常满，谁也不知道是谁添的。', NOT_YET, '命名池'),
  tt('talisman_tt_gushen', '固身符', '固身', 'talisman', 'fan', '贴于胸口，铁身不易崩。', NOT_YET, '释义性命名'),
  tt('talisman_tt_zaowang', '灶王符', '灶王', 'talisman', 'liang', '灶房年节贴一张，图个灶火不熄。', NOT_YET, '命名池'),
  tt('talisman_tt_tiandao', '天道符', '天道', 'talisman', 'zhen', '符上写着一行小字：此约可悔。', NOT_YET, '命名池'),
  tt('talisman_tt_zunwei', '尊位符', '尊符', 'talisman', 'jue', '符成则劫至，从无例外。', NOT_YET, '命名池'),
  tt('frag_tt_changsheng', '长生功残卷', '生卷', 'fragment', 'fan', '开篇只讲如何把一口气拉长。', NOT_YET, '命名池'),
  tt('frag_tt_jingang', '金刚骨谱', '骨谱', 'fragment', 'liang', '画着骨节的走向，笔笔用力。', NOT_YET, '命名池'),
  tt('frag_tt_heliu', '合流宗志', '流志', 'fragment', 'zhen', '合流一脉的兴衰，写到一半停了。', NOT_YET, '命名池'),
  tt('frag_tt_zunwei', '尊位劫记', '劫记', 'fragment', 'jue', '渡劫者只留一句：别回头看。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 08 天工界（原型：仙工开物）· 命名池：赤柿城｜机关坊｜悬丝术｜人命悬丝｜爆炎猴｜机关猴｜
//    苍铁甲｜黑市｜白手兴坊｜三丹田｜传讯钟｜熔岩宫
// ═══════════════════════════════════════════════════════════════════════════
const tg = w('tiangong')
export const W_TG = [
  tg('pill_tg_tiaoxi', '调息丹', '调息', 'pill', 'liang', '三丹田同调专用，服后气息如常。', NOT_YET, '命名池'),
  tg('pill_tg_jixie', '机屑丹', '机屑', 'pill', 'fan', '机关坊的边角料炼的，管饱不管用。', NOT_YET, '命名池'),
  tg('pill_tg_huoyan', '火延丹', '火延', 'pill', 'fan', '炉温不足时服一枚，硬撑一炉。', NOT_YET, '命名池'),
  tg('pill_tg_gangjin', '钢筋丹', '钢筋', 'pill', 'zhen', '筋骨如钢，代价是手指不太灵。', NOT_YET, '命名池'),
  tg('pill_tg_xuansi', '悬丝丹', '悬丝', 'pill', 'zhen', '服之则指尖稳如悬丝，可走细活。', NOT_YET, '命名池'),
  tg('pill_tg_renming', '人命丹', '人命', 'pill', 'jue', '黑市流出，说明书上写着「一命一丹」。', NOT_YET, '命名池'),
  tg('pill_tg_tongtian', '通天炉丹', '炉丹', 'pill', 'jue', '熔岩宫炉底凝出的丹，烫手。', NOT_YET, '命名池'),
  tg('pill_tg_baishou', '白手丹', '白手', 'pill', 'xian', '白手兴坊者留的最后一枚，未开封。', NOT_YET, '命名池'),
  tg('mat_tg_chitieshi', '赤铁石', '赤石', 'material', 'fan', '赤柿城地基下的红石，越烧越硬。', NOT_YET, '命名池', '块'),
  tg('mat_tg_jiguanjian', '机关件', '机件', 'material', 'fan', '拆下来的标准件，规格统一。', NOT_YET, '命名池', '枚'),
  tg('mat_tg_xuansi', '悬丝', '悬丝', 'material', 'liang', '细过发丝，拉得动百斤。', NOT_YET, '命名池', '股'),
  tg('mat_tg_cangtie', '苍铁锭', '苍铁', 'material', 'liang', '苍铁甲同源的锭，敲之声沉。', NOT_YET, '命名池', '块'),
  tg('mat_tg_baoyanlei', '爆炎雷', '炎雷', 'material', 'zhen', '摔在地上就炸，工坊里禁携。', NOT_YET, '命名池', '枚'),
  tg('mat_tg_yanjiang', '熔岩浆', '岩浆', 'material', 'zhen', '熔岩宫取的一罐，罐是特制的。', NOT_YET, '命名池', '罐'),
  tg('mat_tg_chuanxunzhong', '传讯钟芯', '钟芯', 'material', 'zhen', '换下来的钟芯，余响还在。', NOT_YET, '命名池', '枚'),
  tg('mat_tg_heitie', '黑市铁券', '铁券', 'material', 'jue', '黑市通用的铁券，认券不认人。', NOT_YET, '命名池', '张'),
  tg('mat_tg_santian', '三丹田砂', '三田', 'material', 'jue', '三丹田共炼时垫底的砂，会发热。', NOT_YET, '命名池', '捧'),
  tg('mat_tg_xianjin', '仙工精金', '精金', 'material', 'xian', '一块能自己找平的金属，罕见。', NOT_YET, '命名池', '块'),
  tg('treasure_tg_jiguanshou', '机关手', '机手', 'treasure', 'liang', '多一对替下来的手，闲时可拆。', NOT_YET, '命名池'),
  tg('treasure_tg_cangtiejia', '苍铁甲', '苍甲', 'treasure', 'zhen', '甲面会随光变色，坊里最高规格。', NOT_YET, '命名池'),
  tg('treasure_tg_chuanxunz', '传讯钟', '讯钟', 'treasure', 'zhen', '两钟成对，一敲一响。', NOT_YET, '命名池'),
  tg('treasure_tg_santiantai', '三丹田台', '机台', 'treasure', 'jue', '三丹田轮转的机台，昼夜不停。', NOT_YET, '命名池'),
  tg('treasure_tg_jiguanhou', '机关猴', '机猴', 'treasure', 'jue', '能学会三件事，第四件学不会。', NOT_YET, '命名池'),
  tg('treasure_tg_lava', '熔岩宫钥', '岩钥', 'treasure', 'xian', '钥身微红，插进去时会叹气。', NOT_YET, '命名池'),
  tg('talisman_tg_jiguantu', '机关图符', '机图', 'talisman', 'fan', '一贴便显出一张装配图。', NOT_YET, '命名池'),
  tg('talisman_tg_gangjin', '钢筋符', '钢符', 'talisman', 'liang', '贴上可硬撑一次重击。', NOT_YET, '命名池'),
  tg('talisman_tg_baoyan', '爆炎符', '爆符', 'talisman', 'zhen', '撕开即炸，用前先数三下。', NOT_YET, '命名池'),
  tg('talisman_tg_baisou', '白手符', '手符', 'talisman', 'jue', '白手起家的第一张符，糊得很糙。', NOT_YET, '命名池'),
  tg('frag_tg_gongfanglu', '工坊录', '坊录', 'fragment', 'fan', '一册工坊流水，字是刻的。', NOT_YET, '命名池'),
  tg('frag_tg_xuansishu', '悬丝术残篇', '丝篇', 'fragment', 'liang', '讲的是如何把力分到看不见处。', NOT_YET, '命名池'),
  tg('frag_tg_jiguanshu', '机关术总目', '机目', 'fragment', 'zhen', '总目在，正文散在十二坊。', NOT_YET, '命名池'),
  tg('frag_tg_santian', '三丹田论', '田论', 'fragment', 'jue', '论到第三丹田就换了一只手写。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 09 六面囚笼（原型：大乘期才有逆袭系统）· 命名池：五大仙门｜执事殿｜贡献点｜兑换榜｜豆腐｜
//    仿生拳｜扛牛丹｜天劫盲盒｜假传承｜神棍｜代练仙友｜自创新境
// ═══════════════════════════════════════════════════════════════════════════
const lm = w('liumian')
export const W_LM = [
  lm('pill_lm_kangniu', '扛牛丹', '扛牛', 'pill', 'liang', '名字粗，药效却实在：力气多三分。', NOT_YET, '命名池'),
  lm('pill_lm_doufu', '豆腐丹', '豆腐', 'pill', 'fan', '执事殿食堂的佐餐丹，吃着像豆腐。', NOT_YET, '命名池'),
  lm('pill_lm_qingxin', '清心丸', '清丸', 'pill', 'fan', '兑换榜最便宜的那一档。', NOT_YET, '释义性命名'),
  lm('pill_lm_fangsheng', '仿生丹', '仿生', 'pill', 'zhen', '仿生拳炼体配套，服后骨节作响。', NOT_YET, '命名池'),
  lm('pill_lm_zhizhen', '志真丹', '志真', 'pill', 'zhen', '神棍卖的，据说能「照见真心」。', NOT_YET, '命名池'),
  lm('pill_lm_dailian', '代练丹', '代练', 'pill', 'jue', '吞下可替人挂机一日，工钱另算。', NOT_YET, '命名池'),
  lm('pill_lm_potian', '破笼丹', '破笼', 'pill', 'jue', '一笼六面，服之可出——大概。', NOT_YET, '释义性命名'),
  lm('pill_lm_xinjing', '新境丹', '新境', 'pill', 'xian', '自创新境者留下的第一枚丹，无方无谱。', NOT_YET, '命名池'),
  lm('mat_lm_gongxiandian', '贡献点石', '贡石', 'material', 'fan', '兑换榜计数用的石片，攒够可兑。', NOT_YET, '命名池', '枚'),
  lm('mat_lm_mianshi', '六面面石', '面石', 'material', 'fan', '六面囚笼剥落的一片，摸不出正反。', NOT_YET, '释义性命名', '片'),
  lm('mat_lm_zhishidian', '执事殿印泥', '殿泥', 'material', 'liang', '盖印处剩的泥，红了三百年。', NOT_YET, '命名池', '盒'),
  lm('mat_lm_tianeidan', '天劫盲盒盒片', '盲盒', 'material', 'liang', '盲盒拆剩的盒片，还能拼回去。', NOT_YET, '命名池', '片'),
  lm('mat_lm_jiachuancan', '假传承残简', '假简', 'material', 'zhen', '写着上乘功法，练到第三页才发现是假的。', NOT_YET, '命名池', '片'),
  lm('mat_lm_shengun', '神棍幡布', '幡布', 'material', 'zhen', '神棍收摊时落下的幡布，字迹能擦掉。', NOT_YET, '命名池', '块'),
  lm('mat_lm_dailiansu', '代练契', '练契', 'material', 'zhen', '写着「代练一日，亏损自担」。', NOT_YET, '命名池', '张'),
  lm('mat_lm_wudamenpai', '五大仙门牌', '门牌', 'material', 'jue', '五门共用的通行牌，认牌不认宗。', NOT_YET, '命名池', '枚'),
  lm('mat_lm_zichuang', '自创境砂', '创砂', 'material', 'jue', '新境初开时的浮砂，会自己排列。', NOT_YET, '命名池', '撮'),
  lm('mat_lm_polong', '破笼铁屑', '笼屑', 'material', 'xian', '笼子破过一次，屑是那次落的。', NOT_YET, '释义性命名', '撮'),
  lm('treasure_lm_fangshengquan', '仿生拳套', '拳套', 'treasure', 'liang', '关节处有细齿，握拳会轻响。', NOT_YET, '命名池'),
  lm('treasure_lm_duihuanbang', '兑换榜令', '榜令', 'treasure', 'zhen', '持令可查自己攒了多少。', NOT_YET, '命名池'),
  lm('treasure_lm_jiachuanyu', '假传承玉简', '假简', 'treasure', 'zhen', '玉质不假，内容是假的。', NOT_YET, '命名池'),
  lm('treasure_lm_liumianding', '六面钉', '面钉', 'treasure', 'jue', '钉住六面之一，其余五面便松。', NOT_YET, '释义性命名'),
  lm('treasure_lm_dailianjing', '代练镜', '练镜', 'treasure', 'jue', '镜里那个你在替你修行，工钱照收。', NOT_YET, '命名池'),
  lm('treasure_lm_xinjingmen', '新境门枢', '境枢', 'treasure', 'xian', '谁也没见过它转，但它在转。', NOT_YET, '命名池'),
  lm('talisman_lm_duihuan', '兑换符', '兑换', 'talisman', 'fan', '一符兑一份，童叟无欺（大概）。', NOT_YET, '命名池'),
  lm('talisman_lm_shizhen', '识真符', '识真', 'talisman', 'liang', '贴着假传承一照，纸就发黄。', NOT_YET, '命名池'),
  lm('talisman_lm_dunwei', '遁位符', '遁位', 'talisman', 'zhen', '从这一面遁到那一面，不问路。', NOT_YET, '释义性命名'),
  lm('talisman_lm_pojia', '破假符', '破假', 'talisman', 'jue', '符落则假者现形，现形的多半跑了。', NOT_YET, '命名池'),
  lm('frag_lm_zhishilu', '执事殿录', '殿录', 'fragment', 'fan', '记着谁欠了贡献点，谁又赖了。', NOT_YET, '命名池'),
  lm('frag_lm_duihuanbiao', '兑换榜旧表', '旧表', 'fragment', 'liang', '上一版兑换比例，比现在厚道。', NOT_YET, '命名池'),
  lm('frag_lm_fangsheng', '仿生拳谱', '拳谱', 'fragment', 'zhen', '图画得极细，看不清的那一页被撕了。', NOT_YET, '命名池'),
  lm('frag_lm_zichuang', '自创新境稿', '境稿', 'fragment', 'jue', '通篇划改，最后一行写着「再来」。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 10 九鼎九州（原型：一念永恒 · 人皇功德线）· 命名池：九州｜州县｜人皇殿｜功德金榜｜
//    仙梯残片｜善行录｜修行总纲｜继任者｜五统领｜仙界方位｜重炼｜功德圆满
// ═══════════════════════════════════════════════════════════════════════════
const jd = w('jiuding')
export const W_JD = [
  jd('pill_jd_shanxing', '善行丹', '善行', 'pill', 'liang', '每做一件善事，丹色深一分。', NOT_YET, '命名池'),
  jd('pill_jd_jiuzhou', '九州丹', '九州', 'pill', 'fan', '州县同方，颗粒粗些，胜在管饱。', NOT_YET, '命名池'),
  jd('pill_jd_renhuang', '人皇丹', '人皇', 'pill', 'fan', '人皇殿分发的赈济丹，只给有功者。', NOT_YET, '命名池'),
  jd('pill_jd_gongde', '功德丹', '功德', 'pill', 'zhen', '功德金榜上排到名字，才领得到。', NOT_YET, '命名池'),
  jd('pill_jd_zonggang', '总纲丹', '总纲', 'pill', 'zhen', '修行总纲里提过，未列配方。', NOT_YET, '命名池'),
  jd('pill_jd_jiren', '继任丹', '继任', 'pill', 'jue', '继任者上任前一夜服下，据说可稳心。', NOT_YET, '命名池'),
  jd('pill_jd_chonglian', '重炼丹', '重炼', 'pill', 'jue', '重炼之物，服后旧伤翻一遍再合。', NOT_YET, '命名池'),
  jd('pill_jd_yuanman', '圆满丹', '圆满', 'pill', 'xian', '功德圆满者才开的最后一炉。', NOT_YET, '命名池'),
  jd('mat_jd_zhouqi', '州县土', '州土', 'material', 'fan', '九州九色土，这一捧是其中一色。', NOT_YET, '命名池', '捧'),
  jd('mat_jd_jinbang', '功德金屑', '金屑', 'material', 'fan', '金榜刻字时落下的一线金屑。', NOT_YET, '命名池', '撮'),
  jd('mat_jd_shanxinglu', '善行笔录纸', '录纸', 'material', 'liang', '记善行的特制纸，写满便不吸墨。', NOT_YET, '命名池', '页'),
  jd('mat_jd_wutling', '五统领令铁', '令铁', 'material', 'liang', '五统领的令铁残片，能合上。', NOT_YET, '命名池', '片'),
  jd('mat_jd_xianni', '仙界方位泥', '仙泥', 'material', 'zhen', '指仙界方位的泥，永远朝同一个方向。', NOT_YET, '命名池', '捧'),
  jd('mat_jd_xiantai', '仙梯残片', '梯残', 'material', 'zhen', '仙梯断了，残片还在往上长。', NOT_YET, '命名池', '片'),
  jd('mat_jd_shengxing', '圣行砂', '圣砂', 'material', 'zhen', '善行积到一定处，砂自己会发光。', NOT_YET, '释义性命名', '撮'),
  jd('mat_jd_jiuding', '九鼎铜锈', '鼎锈', 'material', 'jue', '九鼎上的铜锈，刮下来是九种色。', NOT_YET, '释义性命名', '片'),
  jd('mat_jd_renhuangyu', '人皇血玉', '血玉', 'material', 'jue', '殿中旧物，玉里似有血色一线。', NOT_YET, '命名池', '块'),
  jd('mat_jd_yuanman', '圆满舍利', '舍利', 'material', 'xian', '圆满之后留下的那一颗，温而不烫。', NOT_YET, '命名池', '颗'),
  jd('treasure_jd_jiudingyi', '九鼎仪', '鼎仪', 'treasure', 'liang', '举仪可聚一州之力，只聚一时。', NOT_YET, '命名池'),
  jd('treasure_jd_jinbangpai', '功德金榜牌', '榜牌', 'treasure', 'zhen', '牌上名次会自己变，不必去查。', NOT_YET, '命名池'),
  jd('treasure_jd_zonggangjuan', '修行总纲卷', '总纲', 'treasure', 'zhen', '纲领一卷，细目在九册里。', NOT_YET, '命名池'),
  jd('treasure_jd_wutling', '五统领印', '统印', 'treasure', 'jue', '印在则军令行，印失则各州自守。', NOT_YET, '命名池'),
  jd('treasure_jd_jirenling', '继任令', '继令', 'treasure', 'jue', '令上名字是空着的，等人来填。', NOT_YET, '命名池'),
  jd('treasure_jd_xianjiepan', '仙界方位盘', '方位', 'treasure', 'xian', '盘针永远指着同一个方向，从不动摇。', NOT_YET, '命名池'),
  jd('talisman_jd_shanxing', '善行符', '善符', 'talisman', 'fan', '做一件小事，符上多一点。', NOT_YET, '命名池'),
  jd('talisman_jd_zhoufu', '镇州符', '镇州', 'talisman', 'liang', '贴于州门，可保一岁安宁。', NOT_YET, '命名池'),
  jd('talisman_jd_gongde', '功德符', '功符', 'talisman', 'zhen', '焚之可将一件善事记入金榜。', NOT_YET, '命名池'),
  jd('talisman_jd_chonglian', '重炼符', '重符', 'talisman', 'jue', '符起则炉火重燃，旧器再塑。', NOT_YET, '命名池'),
  jd('frag_jd_shanxinglu', '善行录残卷', '录卷', 'fragment', 'fan', '只余后半，前半随人去了。', NOT_YET, '命名池'),
  jd('frag_jd_zhouzhi', '州志残页', '州志', 'fragment', 'liang', '记着一州之地三年的雨。', NOT_YET, '命名池'),
  jd('frag_jd_wutling', '五统领手札', '统札', 'fragment', 'zhen', '五人的字各不相同，口径倒是齐的。', NOT_YET, '命名池'),
  jd('frag_jd_yuanman', '圆满篇', '圆篇', 'fragment', 'jue', '末页只画了一个圈，圈得极圆。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 11 无缺古界（原型：我欲封天）· 命名池：负山宗｜青铜旧鉴｜云泽县｜大岷山｜有缺／无暇／无缺三档｜
//    道源真经｜荒龙丹｜镇荒古玉｜九道封禁｜赐名术｜本命丹炉｜寒原荒帝｜凌霄古桥｜厚积薄发｜
//    重溟九洲｜第九海疆｜出世
//    ⚠ 本界**前身「没钱修什么仙？」及 086 源文件已失效**，一律不引旧表条目。
// ═══════════════════════════════════════════════════════════════════════════
const wy = w('wuyuan')
export const W_WY = [
  wy('pill_wy_huanglong', '荒龙丹', '荒龙', 'pill', 'liang', '荒龙血炼的丹，入口有铁腥味。', NOT_YET, '命名池'),
  wy('pill_wy_fushan', '负山丹', '负山', 'pill', 'fan', '负山宗入门丹：先学会背，再学会走。', NOT_YET, '命名池'),
  wy('pill_wy_youque', '有缺丹', '有缺', 'pill', 'fan', '刻意留一缺，故补得进东西。', NOT_YET, '命名池'),
  wy('pill_wy_wuxia', '无暇丹', '无暇', 'pill', 'zhen', '无暇者不必补，服之只求稳。', NOT_YET, '命名池'),
  wy('pill_wy_wuque', '无缺丹', '无缺', 'pill', 'zhen', '丹成无缺，所以谁也舍不得吃。', NOT_YET, '命名池'),
  wy('pill_wy_daoyuan', '道源丹', '道源', 'pill', 'jue', '道源真经开篇那一页上提过。', NOT_YET, '命名池'),
  wy('pill_wy_hanhuang', '寒原丹', '寒原', 'pill', 'jue', '寒原荒帝遗留的暖丹，一炉一枚。', NOT_YET, '命名池'),
  wy('pill_wy_chushi', '出世丹', '出世', 'pill', 'xian', '服之则尘缘了断，从此不回头。', NOT_YET, '命名池'),
  wy('mat_wy_tongjian', '青铜旧鉴屑', '鉴屑', 'material', 'fan', '旧鉴脱落的一层铜绿，微涩。', NOT_YET, '命名池', '撮'),
  wy('mat_wy_yunze', '云泽县稻', '泽稻', 'material', 'fan', '县中水田收的稻，粒小味甘。', NOT_YET, '命名池', '捧'),
  wy('mat_wy_damingshan', '大岷山石', '岷石', 'material', 'liang', '山石沉重，历来用作压书之物。', NOT_YET, '命名池', '块'),
  wy('mat_wy_zhenhuangyu', '镇荒古玉屑', '荒玉', 'material', 'liang', '古玉打磨的边角，仍镇得住荒气。', NOT_YET, '命名池', '撮'),
  wy('mat_wy_jiudaofeng', '九道封禁符铁', '封铁', 'material', 'zhen', '九道封禁的旧铁，刻痕深可见底。', NOT_YET, '命名池', '块'),
  wy('mat_wy_benmingding', '本命丹炉渣', '炉渣', 'material', 'zhen', '本命炉炼过的渣，带一线本命气。', NOT_YET, '命名池', '块'),
  wy('mat_wy_lingxiao', '凌霄桥石', '桥石', 'material', 'zhen', '凌霄古桥换下的一块，踩过万人。', NOT_YET, '命名池', '块'),
  wy('mat_wy_zhongming', '重溟海水', '溟水', 'material', 'jue', '第九海疆的海水，装瓶会变淡。', NOT_YET, '命名池', '瓶'),
  wy('mat_wy_houji', '厚积砂', '积砂', 'material', 'jue', '一层压一层积了百年，掰不开。', NOT_YET, '命名池', '捧'),
  wy('mat_wy_chushi', '出世尘', '世尘', 'material', 'xian', '人离开后落下的尘，拢起来极少。', NOT_YET, '命名池', '撮'),
  wy('treasure_wy_benminglu', '本命丹炉', '命炉', 'treasure', 'liang', '炉随人走，人走炉不凉。', NOT_YET, '命名池'),
  wy('treasure_wy_tongjian', '青铜旧鉴', '旧鉴', 'treasure', 'zhen', '鉴面模糊，照见的都是旧事。', NOT_YET, '命名池'),
  wy('treasure_wy_zhenhuang', '镇荒古玉', '荒玉', 'treasure', 'zhen', '荒气近身半尺，便自行退去。', NOT_YET, '命名池'),
  wy('treasure_wy_jiudao', '九道封禁牌', '封牌', 'treasure', 'jue', '九牌合一可开一禁，缺一不开。', NOT_YET, '命名池'),
  wy('treasure_wy_lingxiaoqiao', '凌霄古桥枢', '桥枢', 'treasure', 'jue', '桥不常开，枢轴却年年上油。', NOT_YET, '命名池'),
  wy('treasure_wy_chushimen', '出世门钥', '世钥', 'treasure', 'xian', '钥齿奇特，插进去只转半圈。', NOT_YET, '命名池'),
  wy('talisman_wy_songming', '赐名符', '赐名', 'talisman', 'fan', '符上留白，等一个名字落笔。', NOT_YET, '命名池'),
  wy('talisman_wy_wuque', '无缺符', '无缺', 'talisman', 'liang', '贴上去便不多不少，恰如此数。', NOT_YET, '命名池'),
  wy('talisman_wy_fengjin', '封禁符', '封符', 'talisman', 'zhen', '一道符封一隙，九道封一境。', NOT_YET, '命名池'),
  wy('talisman_wy_chushi', '出世符', '世符', 'talisman', 'jue', '焚符者自此与旧界两清。', NOT_YET, '命名池'),
  wy('frag_wy_daoyuan', '道源真经残卷', '道卷', 'fragment', 'fan', '开篇讲的是「先承认自己有缺」。', NOT_YET, '命名池'),
  wy('frag_wy_fushan', '负山宗门规', '门规', 'fragment', 'liang', '第一条：走得慢的等一等。', NOT_YET, '命名池'),
  wy('frag_wy_jiudao', '九道封禁图', '封图', 'fragment', 'zhen', '图画九道，第八道被人抹了。', NOT_YET, '命名池'),
  wy('frag_wy_chushilu', '出世录', '世录', 'fragment', 'jue', '记着每个离开的人最后说的一句话。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 12 人间香火（原型：我本无意成仙）· 命名池：青芜山｜山间道观｜猫神｜符箓｜纸马｜雷法｜
//    香火｜金身｜民心｜城隍｜鬼市｜祈雨｜游历碑
// ═══════════════════════════════════════════════════════════════════════════
const xh = w('xianghuo')
export const W_XH = [
  xh('pill_xh_qingwu', '青芜丹', '青芜', 'pill', 'liang', '青芜山采的青芜草炼的，气味清苦。', NOT_YET, '命名池'),
  xh('pill_xh_maoshen', '猫神丹', '猫神', 'pill', 'fan', '道观里那位爱吃鱼的神，也吃丹。', NOT_YET, '命名池'),
  xh('pill_xh_minxin', '民心丹', '民心', 'pill', 'fan', '民心所向时服一枚，格外顺气。', NOT_YET, '命名池'),
  xh('pill_xh_jinshen', '金身丹', '金身', 'pill', 'zhen', '金身初成者服下，皮肤会浮一层薄光。', NOT_YET, '命名池'),
  xh('pill_xh_qiyu', '祈雨丹', '祈雨', 'pill', 'zhen', '服之则三日之内必有一场雨。', NOT_YET, '命名池'),
  xh('pill_xh_chenghuang', '城隍丹', '城隍', 'pill', 'jue', '城隍上任前服，管一城之事。', NOT_YET, '命名池'),
  xh('pill_xh_xianghuo', '香火丹', '香火', 'pill', 'jue', '一炉香火烧到尽处，才凝得一枚。', NOT_YET, '命名池'),
  xh('pill_xh_chuancheng', '传承丹', '传承', 'pill', 'xian', '老道临终前留的那一枚，一直没吃。', NOT_YET, '命名池'),
  xh('mat_xh_zhima', '纸马', '纸马', 'material', 'fan', '扎得粗糙的纸马，烧了才有用。', NOT_YET, '命名池', '只'),
  xh('mat_xh_xianghui', '香灰', '香灰', 'material', 'fan', '道观香炉积的灰，干了发白。', NOT_YET, '命名池', '捧'),
  xh('mat_xh_leifu', '雷符纸', '雷纸', 'material', 'liang', '雷法专用符纸，摸上去微麻。', NOT_YET, '命名池', '张'),
  xh('mat_xh_youzhi', '青芜油纸', '油纸', 'material', 'liang', '山中油纸，雨打不烂。', NOT_YET, '命名池', '张'),
  xh('mat_xh_guishi', '鬼市铜钱', '市钱', 'material', 'zhen', '鬼市通用的旧铜钱，一面无字。', NOT_YET, '命名池', '枚'),
  xh('mat_xh_jinshenqi', '金身漆', '身漆', 'material', 'zhen', '给金身上漆的料，一年只开一坛。', NOT_YET, '命名池', '罐'),
  xh('mat_xh_youli', '游历碑砂', '碑砂', 'material', 'zhen', '游历碑磨下的砂，字迹一擦就淡。', NOT_YET, '命名池', '撮'),
  xh('mat_xh_yulei', '引雷木', '引木', 'material', 'jue', '立在山顶的老木，被雷劈过七次。', NOT_YET, '命名池', '段'),
  xh('mat_xh_chengxi', '城隍印泥', '隍泥', 'material', 'jue', '盖城隍印的泥，干了还是红的。', NOT_YET, '命名池', '盒'),
  xh('mat_xh_yuanshen', '愿身砂', '愿砂', 'material', 'xian', '万民许愿处落下的砂，一把就够重。', NOT_YET, '命名池', '撮'),
  xh('treasure_xh_maoshenxiang', '猫神像', '神像', 'treasure', 'liang', '像不大，尾巴翘着，谁也搬不动。', NOT_YET, '命名池'),
  xh('treasure_xh_zhimaDeng', '纸马灯', '马灯', 'treasure', 'zhen', '灯芯是纸捻的，烧得极慢。', NOT_YET, '命名池'),
  xh('treasure_xh_chenghuangyin', '城隍印', '隍印', 'treasure', 'zhen', '印落则判词定，从不改字。', NOT_YET, '命名池'),
  xh('treasure_xh_guishideng', '鬼市灯', '市灯', 'treasure', 'jue', '灯下交易不问来路，灯灭各自散。', NOT_YET, '命名池'),
  xh('treasure_xh_youliBei', '游历碑', '游碑', 'treasure', 'jue', '碑上刻着一句话：此处可留名。', NOT_YET, '命名池'),
  xh('treasure_xh_jinshentai', '金身台', '身台', 'treasure', 'xian', '台上香火不断，一坐就是百年。', NOT_YET, '命名池'),
  xh('talisman_xh_qingxin', '清心符', '清心', 'talisman', 'fan', '道观入门符，描三遍才成形。', NOT_YET, '命名池'),
  xh('talisman_xh_leifa', '雷法符', '雷法', 'talisman', 'liang', '符成时指甲会麻一下。', NOT_YET, '命名池'),
  xh('talisman_xh_baomin', '保民符', '保民', 'talisman', 'zhen', '一张保一户，闹年时最紧俏。', NOT_YET, '命名池'),
  xh('talisman_xh_chaodu', '超度符', '超度', 'talisman', 'jue', '符焚于野，纸灰朝同一方向飘。', NOT_YET, '命名池'),
  xh('frag_xh_daoGuanlu', '道观录', '观录', 'fragment', 'fan', '记香火收支的一册，字很密。', NOT_YET, '命名池'),
  xh('frag_xh_leifa', '雷法残篇', '雷篇', 'fragment', 'liang', '画的是雷路，最后一笔是断的。', NOT_YET, '命名池'),
  xh('frag_xh_minxinji', '民心记', '民记', 'fragment', 'zhen', '记着一场大雨与一句承诺。', NOT_YET, '命名池'),
  xh('frag_xh_chuancheng', '传承篇', '承篇', 'fragment', 'jue', '只写一句：香火断时，你还在。', NOT_YET, '命名池')
]

// ═══════════════════════════════════════════════════════════════════════════
// 汇总导出：12 界专属库（12 × 32 ＝ **384 条**）· 顺序＝世界卡池顺序
// ═══════════════════════════════════════════════════════════════════════════
export const WORLD_ITEMS = [
  ...W_QL, ...W_PX, ...W_DH, ...W_QY, ...W_WZ, ...W_YN,
  ...W_TT, ...W_TG, ...W_LM, ...W_JD, ...W_WY, ...W_XH
]

/** 按界分组（自测与后续「各界物品」展示用） */
export const WORLD_ITEM_GROUPS = {
  qinglan: W_QL, poxiao: W_PX, denghuo: W_DH, qingyun: W_QY, wangzu: W_WZ, younuo: W_YN,
  tongtian: W_TT, tiangong: W_TG, liumian: W_LM, jiuding: W_JD, wuyuan: W_WY, xianghuo: W_XH
}

