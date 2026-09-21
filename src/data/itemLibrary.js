/**
 * itemLibrary.js —— 物品库 · 公用库新增段（V7.1）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / 计划册 §13.1①）：**纯配置层**（data/），禁 import
 *   systems / ui / DOM / Phaser；本文件**零 import**（连 util 也不依赖），只导出常量。
 *
 * 库结构（主人 2026-09-22 拍板「参照功法库的模式」）：
 *   · **公用库 ＝ 120 条** ＝ 既有基础表 `items.js` 的 **23 条**（位置与语义冻结）＋ 本文件 **97 条**；
 *   · **各界专属库 ＝ 12 界 × 32 ＝ 384 条** → `itemLibraryWorld.js`；
 *   · **全量 `ALL_ITEMS` ＝ 504 条**，由 `items.js` 汇总并建 `ITEM_MAP`（单一真源视图）。
 *   ⚠ **查询函数（byType / byWorld / counts）与合并导出都在 `items.js`**，本文件与
 *     `itemLibraryWorld.js` 只放数据——避免 data 层内部形成循环 import。
 *
 * 条目字段契约（与专属库共用同一形态）：
 *   id          域前缀小写 `pill_ / mat_ / treasure_ / talisman_ / frag_`，**全域唯一**
 *   name        对外名（**不得复用原型作品专名**，剧情册 §总论 IP 口径）
 *   icon        2 字简称（图标铭牌；**同一 type 内不重复**，色板取 `util/quality.js` 真源）
 *   type        `pill | material | treasure | talisman | fragment`
 *   quality     `fan | liang | zhen | jue | xian`（凡 / 良 / 珍 / 绝 / 仙）
 *   unit        可选，覆盖类型默认单位（默认表见 `items.js` 的 `ITEM_UNIT`）
 *   desc        一句话说明（风味 + 用途）
 *   from        产出途径；**本批只入库不接产出**，一律写 `未接产出（本批只入库）`
 *   src         出处：`提炼·丹药` / `提炼·药材` / `提炼·法宝` / `提炼·灵兽` / `命名池` / `释义性命名`
 *   worldId     公用库为 `null`（不写即视为公用）；专属库必带
 *   unlockRealm 可选门槛（境界序号），**仅供后续产出接线使用，本批不判定**
 *
 * 配比：本段 97 条＝丹药 20 · 材料 30 · 法宝 20 · 符箓 14 · 残页 13；
 *   **五类型 × 五品质全覆盖**（每一 type 都含 fan/liang/zhen/jue/xian 五档）。
 *   命名依据＝`设计库\07-原著\提炼-数据库素材\`（`01-丹药` / `03-药材材料` / `06-法宝` / `04-灵兽妖兽`）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 一行一条：id, name, icon, type, quality, desc, from, src（出处）；第 9 参 unit 覆盖类型默认单位 */
const it = (id, name, icon, type, quality, desc, from, src, unit) => {
  const o = { id, name, icon, type, quality, desc, from, src }
  if (unit) o.unit = unit
  return o
}

const NOT_YET = '未接产出（本批只入库）'

/** 公用库新增段（97 条）· worldId 一律视为 null（公用） */
export const COMMON_NEW = [
  // ── 丹药 20（五档齐全）────────────────────────────────────────────────
  it('pill_peiyuan', '培元丹', '培元', 'pill', 'fan', '最基础的回气丹，散修人手一囊。', NOT_YET, '提炼·丹药'),
  it('pill_jiedu', '解毒丹', '解毒', 'pill', 'fan', '山野行走必备，解寻常草木之毒。', NOT_YET, '提炼·丹药'),
  it('pill_dingyan', '定颜丹', '定颜', 'pill', 'fan', '驻颜不老的趣味丹，修行无用却人人想求。', NOT_YET, '提炼·丹药'),
  it('pill_sheyuan', '蛇元丹', '蛇元', 'pill', 'fan', '取阴木之性，服之气息偏冷。', NOT_YET, '提炼·丹药'),
  it('pill_shengyuan', '升元丹', '升元', 'pill', 'liang', '短时提振修为进项，丹香微甜。', NOT_YET, '提炼·丹药'),
  it('pill_liaoshang', '疗伤丹', '疗伤', 'pill', 'liang', '疗伤低配版，皮肉之伤半日可愈。', NOT_YET, '提炼·丹药'),
  it('pill_qixue', '气血丹', '气血', 'pill', 'liang', '炼体辅修专用：气血一时翻涌。', NOT_YET, '提炼·丹药'),
  it('pill_bishui', '壁水丹', '壁水', 'pill', 'liang', '水属性词条丹，服之周身微润。', NOT_YET, '提炼·丹药'),
  it('pill_haiyuan', '海元丹', '海元', 'pill', 'zhen', '长时版修为丹，宜闭关前服。', NOT_YET, '提炼·丹药'),
  it('pill_ziqi', '紫气升灵丹', '紫气', 'pill', 'zhen', '紫气东来之势，笼罩一室。', NOT_YET, '提炼·丹药'),
  it('pill_dahuan', '大还丹', '大还', 'pill', 'zhen', '疗伤上品，重伤亦可续一线生机。', NOT_YET, '提炼·丹药'),
  it('pill_bingpo', '冰魄丹', '冰魄', 'pill', 'zhen', '冰属性词条丹，丹心一点寒。', NOT_YET, '提炼·丹药'),
  it('pill_zhihuan', '致幻丹', '致幻', 'pill', 'zhen', '宗门取事时用的旁门丹，慎服。', NOT_YET, '提炼·丹药'),
  it('pill_wudi', '无敌丹', '无敌', 'pill', 'zhen', '短时战力爆发，药劲一过便虚。', NOT_YET, '提炼·丹药'),
  it('pill_wangqing', '忘情丹', '忘情', 'pill', 'zhen', '心魔起时服下，一时忘却前尘。', NOT_YET, '提炼·丹药'),
  it('pill_yuanying', '元婴丹', '元婴', 'pill', 'zhen', '大境界冲关专用：结丹入元婴。', NOT_YET, '提炼·丹药'),
  it('pill_zaohua', '造化丹', '造化', 'pill', 'jue', '重掷一次机缘，成败由天。', NOT_YET, '提炼·丹药'),
  it('pill_juhun', '聚魂丹', '聚魂', 'pill', 'jue', '元神将散时服，可收回半数。', NOT_YET, '提炼·丹药'),
  it('pill_busixue', '不死血丹', '不死', 'pill', 'jue', '渡劫保命之物：一雷之厄可免。', NOT_YET, '提炼·丹药'),
  it('pill_jiuzhuanxian', '九转仙丹', '九仙', 'pill', 'xian', '传说中的顶配丹，九转方成，一生难见一枚。', NOT_YET, '提炼·丹药'),
  // ── 材料 30 ──────────────────────────────────────────────────────────
  it('mat_xuanshen', '玄参', '玄参', 'material', 'fan', '寻常药铺就有，胜在药性平正。', NOT_YET, '提炼·药材', '株'),
  it('mat_kuzhu', '苦竹根', '苦根', 'material', 'fan', '味极苦，丹房用水煎三遍才入方。', NOT_YET, '提炼·药材', '段'),
  it('mat_yinsha', '阴煞气', '阴煞', 'material', 'fan', '阴地汇集的一缕气，盛在瓷瓶里。', NOT_YET, '释义性命名', '缕'),
  it('mat_yanghe', '阳和露', '阳和', 'material', 'fan', '向阳石上凝的露，日出前须取。', NOT_YET, '释义性命名', '滴'),
  it('mat_wugenshui', '无根水', '根水', 'material', 'fan', '高空落下的无根水，不沾地。', NOT_YET, '提炼·药材', '瓢'),
  it('mat_chiyang', '赤阳草', '赤阳', 'material', 'liang', '烈日照不枯的草，性热。', NOT_YET, '提炼·药材', '株'),
  it('mat_hanxing', '寒星砂', '寒星', 'material', 'liang', '陨铁里的细砂，握着发冷。', NOT_YET, '提炼·药材', '撮'),
  it('mat_dilong', '地龙骨', '地龙', 'material', 'liang', '地脉深处挖出的骨状结核。', NOT_YET, '提炼·药材', '段'),
  it('mat_yuehua', '月华露', '月露', 'material', 'liang', '月下盛露，满月之夜最纯。', NOT_YET, '提炼·药材', '滴'),
  it('mat_huojing', '火晶', '火晶', 'material', 'liang', '火脉边缘长的红晶，入炉助燃。', NOT_YET, '提炼·药材', '枚'),
  it('mat_baigu', '白虎骨', '虎骨', 'material', 'liang', '白毛虎的腿骨，沉重有韧。', NOT_YET, '提炼·灵兽', '段'),
  it('mat_zhuguo', '朱果', '朱果', 'material', 'liang', '山阴朱果，一年一熟，甜中带涩。', NOT_YET, '提炼·药材', '枚'),
  it('mat_youlan', '幽兰草', '幽兰', 'material', 'liang', '幽谷里的兰草，开花时无人见。', NOT_YET, '提炼·药材', '株'),
  it('mat_luoxing', '落星铁', '落星', 'material', 'liang', '陨星残块炼出的铁，不易锈。', NOT_YET, '提炼·药材', '块'),
  it('mat_zifu', '紫府藤', '紫府', 'material', 'zhen', '缠在古木上的藤，断面有星纹。', NOT_YET, '提炼·药材', '段'),
  it('mat_wuse', '五色石', '五色', 'material', 'zhen', '五色纹交错的石头，补天传说里的样子。', NOT_YET, '提炼·药材', '块'),
  it('mat_bingsui', '玄冰髓', '冰髓', 'material', 'zhen', '万年玄冰最里的一线髓，见热即成水。', NOT_YET, '提炼·药材', '滴'),
  it('mat_jimu', '雷击木', '击木', 'material', 'zhen', '被雷劈过而未断的老木，取中段用。', NOT_YET, '提炼·药材', '段'),
  it('mat_jiaojin', '青蛟筋', '蛟筋', 'material', 'zhen', '青蛟的背筋，弹之如弦。', NOT_YET, '提炼·灵兽', '段'),
  it('mat_guijia', '玄龟甲', '龟甲', 'material', 'zhen', '玄龟脱下的甲片，可占可炼。', NOT_YET, '提炼·灵兽', '片'),
  it('mat_qianjisi', '千机丝', '机丝', 'material', 'zhen', '千机织就的丝，缠不牢也剪不断。', NOT_YET, '释义性命名', '股'),
  it('mat_shizhongyu', '石中玉', '中玉', 'material', 'zhen', '剖石得玉，外层石壳仍带灵气。', NOT_YET, '提炼·药材', '块'),
  it('mat_longxian', '龙涎香', '龙涎', 'material', 'jue', '传说中的香料，一滴可镇一室浊气。', NOT_YET, '提炼·药材', '滴'),
  it('mat_xuesui', '血玉髓', '血髓', 'material', 'jue', '血玉剖开的髓，色如凝脂。', NOT_YET, '提炼·药材', '滴'),
  it('mat_jiuyoutie', '九幽铁', '幽铁', 'material', 'jue', '自九幽采出的铁，阴寒透骨。', NOT_YET, '提炼·药材', '块'),
  it('mat_tianleijing', '天雷精', '雷精', 'material', 'jue', '天雷劈落处凝出的一线精粹，极不稳。', NOT_YET, '提炼·药材', '缕'),
  it('mat_taisui', '太岁肉', '太岁', 'material', 'jue', '土中太岁割下的一块，割处会自愈。', NOT_YET, '提炼·药材', '块'),
  it('mat_xingsui', '星髓', '星髓', 'material', 'xian', '星核中取出的一线髓，轻得能浮在掌心。', NOT_YET, '提炼·药材', '滴'),
  it('mat_hunyuan', '混元石', '混元', 'material', 'xian', '未分五行的一块石，可炼亦可通。', NOT_YET, '提炼·药材', '块'),
  it('mat_lingxijiao', '灵犀角', '犀角', 'material', 'xian', '灵犀的角，相触即通意。', NOT_YET, '提炼·灵兽', '只'),
  // ── 法宝 20 ──────────────────────────────────────────────────────────
  it('treasure_yinsuo', '白银梭', '银梭', 'treasure', 'fan', '会自己飞回的梭子，入门法宝。', NOT_YET, '提炼·法宝'),
  it('treasure_xingshenyu', '醒神玉', '神玉', 'treasure', 'fan', '贴额清凉，久用便离不开。', NOT_YET, '提炼·法宝'),
  it('treasure_yinlingdi', '引灵笛', '灵笛', 'treasure', 'fan', '笛声过处，散逸灵气稍稍聚拢。', NOT_YET, '提炼·法宝'),
  it('treasure_xueyuhulu', '血玉葫芦', '玉芦', 'treasure', 'fan', '葫芦里存着一线血脉之力。', NOT_YET, '提炼·法宝'),
  it('treasure_xuantiejian', '玄铁剑', '玄剑', 'treasure', 'liang', '玄铁制式剑，开口锋利而不脆。', NOT_YET, '提炼·法宝'),
  it('treasure_zhenhunling', '镇魂铃', '魂铃', 'treasure', 'liang', '铃响三声，心神自定。', NOT_YET, '提炼·法宝'),
  it('treasure_yinyanghuan', '阴阳环', '阳环', 'treasure', 'liang', '双环相扣，一阴一阳，不离不弃。', NOT_YET, '提炼·法宝'),
  it('treasure_tayunxue', '踏云靴', '云靴', 'treasure', 'liang', '穿上身轻三分，落地无声。', NOT_YET, '提炼·法宝'),
  it('treasure_fulingsuo', '缚灵索', '灵索', 'treasure', 'liang', '索出如蛇，专缚活物。', NOT_YET, '提炼·法宝'),
  it('treasure_qingyuhulu', '青玉葫芦', '玉葫', 'treasure', 'zhen', '葫芦内自成一囊，可纳百物。', NOT_YET, '提炼·法宝'),
  it('treasure_baguajing', '八卦镜', '八卦', 'treasure', 'zhen', '镜背八卦转动，可定方位。', NOT_YET, '提炼·法宝'),
  it('treasure_zijinbo', '紫金钵', '金钵', 'treasure', 'zhen', '钵口微收，收纳之物从不外泄。', NOT_YET, '提炼·法宝'),
  it('treasure_huolinjia', '火鳞甲', '鳞甲', 'treasure', 'zhen', '火鳞叠成的甲，遇火更坚。', NOT_YET, '提炼·法宝'),
  it('treasure_wuxingzhu', '五行珠', '五珠', 'treasure', 'jue', '一珠藏五行，轮转不休。', NOT_YET, '提炼·法宝'),
  it('treasure_hunyuanSan', '混元伞', '元伞', 'treasure', 'jue', '伞开则风雨不入，亦不散。', NOT_YET, '提炼·法宝'),
  it('treasure_jiugongpan', '九宫盘', '宫盘', 'treasure', 'jue', '九宫轮转，推演步步。', NOT_YET, '提炼·法宝'),
  it('treasure_wanhunfan', '万魂幡', '万魂', 'treasure', 'jue', '幡上无一字，却重得压手。', NOT_YET, '提炼·法宝'),
  it('treasure_taixuding', '太虚鼎', '虚鼎', 'treasure', 'xian', '鼎内有虚，装得下比自身大的东西。', NOT_YET, '提炼·法宝'),
  it('treasure_wuxiangzhu', '无相珠', '相珠', 'treasure', 'xian', '珠无定相，观者所见各不相同。', NOT_YET, '提炼·法宝'),
  it('treasure_jingtianjing', '鉴天镜', '天镜', 'treasure', 'xian', '照天象、断吉凶，百年只开一次镜面。', NOT_YET, '提炼·法宝'),
  // ── 符箓 14 ──────────────────────────────────────────────────────────
  it('talisman_yinqi', '引气符', '引气', 'talisman', 'fan', '入门第一符：把灵气引进体内。', NOT_YET, '提炼·法宝'),
  it('talisman_jingshen', '净身符', '净身', 'talisman', 'fan', '焚之涤去一身尘晦，衣也干净些。', NOT_YET, '释义性命名'),
  it('talisman_guiyuan', '归元符', '归元', 'talisman', 'fan', '散功之后用它收拢残气。', NOT_YET, '释义性命名'),
  it('talisman_huoqiu', '火球符', '火球', 'talisman', 'liang', '最实在的攻击符，砸过去就是一团火。', NOT_YET, '提炼·法宝'),
  it('talisman_tudun', '土遁符', '土遁', 'talisman', 'liang', '入土半尺，走十里不出声。', NOT_YET, '提炼·法宝'),
  it('talisman_chuanyin', '传音符', '传音', 'talisman', 'liang', '一符一句，说完即焚。', NOT_YET, '提炼·法宝'),
  it('talisman_yinni', '隐匿符', '隐匿', 'talisman', 'liang', '气息与影子一并抹去，只留一刻钟。', NOT_YET, '提炼·法宝'),
  it('talisman_wuxing', '五行符', '五符', 'talisman', 'liang', '按五行分五色，用错色便不灵。', NOT_YET, '提炼·法宝'),
  it('talisman_jinzhao', '金光罩符', '金罩', 'talisman', 'zhen', '罩起一层金光，能挡三击。', NOT_YET, '提炼·法宝'),
  it('talisman_kuilei', '傀儡符', '傀儡', 'talisman', 'zhen', '贴于纸人，可代走几步、代说一句。', NOT_YET, '提炼·法宝'),
  it('talisman_pozhang', '破障符', '破障', 'talisman', 'zhen', '禁制前一贴，路自开一线。', NOT_YET, '提炼·法宝'),
  it('talisman_tisi', '替死符', '替死', 'talisman', 'jue', '一符一命，用过便成灰。', NOT_YET, '提炼·法宝'),
  it('talisman_zhaohun', '招魂符', '招魂', 'talisman', 'jue', '魂散三日内可招，过期不候。', NOT_YET, '提炼·法宝'),
  it('talisman_tiangang', '天罡符', '天罡', 'talisman', 'xian', '三十六道罡气归一符，纸上无纹自显。', NOT_YET, '提炼·法宝'),
  // ── 残页 13 ──────────────────────────────────────────────────────────
  it('frag_yinqi', '引气篇', '引篇', 'fragment', 'fan', '讲引气入体的第一课，字大行疏。', NOT_YET, '释义性命名'),
  it('frag_liti', '炼体篇', '体篇', 'fragment', 'fan', '画着人形与骨节，注了「勿急」。', NOT_YET, '释义性命名'),
  it('frag_danyao', '丹药篇', '药篇', 'fragment', 'liang', '记着十七张丹方，可用的只有三张。', NOT_YET, '释义性命名'),
  it('frag_zhendao', '阵道篇', '阵篇', 'fragment', 'liang', '起手三笔最重要，恰巧都还在。', NOT_YET, '释义性命名'),
  it('frag_fudao', '符道篇', '符篇', 'fragment', 'liang', '讲符纸、符墨与「心要静」。', NOT_YET, '释义性命名'),
  it('frag_yushou', '御兽篇', '兽篇', 'fragment', 'zhen', '记着与灵兽立约的仪注。', NOT_YET, '释义性命名'),
  it('frag_feijian', '飞剑篇', '剑篇', 'fragment', 'zhen', '通篇只论一件事：剑要认得人。', NOT_YET, '释义性命名'),
  it('frag_dunfa', '遁法篇', '遁篇', 'fragment', 'zhen', '遁法的要紧处，是选对方向。', NOT_YET, '释义性命名'),
  it('frag_xinfa', '心法篇', '心篇', 'fragment', 'jue', '无招无式，只教如何守住一心。', NOT_YET, '释义性命名'),
  it('frag_tiandi', '天地篇', '天篇', 'fragment', 'jue', '开篇一句：人小，天也小。', NOT_YET, '释义性命名'),
  it('frag_zaohua', '造化篇', '化篇', 'fragment', 'jue', '残缺最重的一卷，只剩半张图。', NOT_YET, '释义性命名'),
  it('frag_dadao', '大道篇', '道篇', 'fragment', 'xian', '通篇无字，摸上去却有纹理。', NOT_YET, '释义性命名'),
  it('frag_wuzi', '无字残页', '无字', 'fragment', 'xian', '空白一页，久看会浮出极浅的痕。', NOT_YET, '释义性命名')
]

export default { COMMON_NEW }
