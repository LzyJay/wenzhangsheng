/**
 * worldSects.js —— 12 界宗门名册（只读配置层）（V6.12 · 批 G2 宗门扩充）
 * ═══════════════════════════════════════════════════════════════════════════
 * 口径（主人 2026-09-21 拍板）：
 *   · **每界 8 宗**，12 界合计 **96 宗**；宗门**从原著取材**（`origin:'原著'`），
 *     仅青岚界的 `云岚宗` 沿用项目既有设定（`origin:'项目'`，且为该界**默认宗**）。
 *   · **道统沿用既有五系**（`data/sect.js` 的 `DAO_TONG`：剑 / 丹 / 体 / 符 / 法），
 *     **不新增道统档位** —— 故各宗加成口径与既有云岚宗完全同源，零新机制。
 *   · 每宗 **3 本宗门功法**（入门 / 中坚 / 镇派，见批 G3 的 `data/sectTechniques.js`）＋
 *     继承既有各界专属本（`techs` 字段引用 `techniqueLibrary.js` 的 `tech_*`）。
 *   · **顶级专属功法**（`tech_*_10/11/12`）不受境界限制，但门槛为灵根硬要求 ＋ 高贡献兑换。
 *
 * 素材来源（`设计库/01-世界设定/分作品设定摘要集.md` 各作品「C. 宗门/家族/势力」节）：
 *   01 凡人修仙传 L44-48｜02 仙逆 L341-346｜03 我师兄实在太稳健了（素材集缺 C 节，走原著意象）
 *   04 诛仙 L507-511｜05 玄鉴仙族 L589-593｜06 道诡异仙 L226-239｜07 一念永恒 L1006-1010
 *   08 仙工开物 L886-892｜09 谁让他修仙的！ L1087-1091｜10 大乘期才有逆袭系统 L1230-1236
 *   11 我欲封天 L1320-1325｜12 我本无意成仙 L783-790
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 道统五系（与 `sect.js` 的 `DAO_TONG` 同 id）。
 * V6.12 批 G4：`bonus` 是**加成唯一真源**（此前 desc 里写的数值只是展示、未实装）——
 *   系统侧只读不算（SectSystem.daoBonus → 各乘区），不写死数字。
 * 键义：`power` 战力乘区（剑修）；`pill` 丹药产出；`event` 事件收益；`qi` 挂机产出。
 *   ⚠ 体修（秘境判定）与剑修共用 `power`：秘境判定读的就是战力乘区，
 *     而一名玩家同一时刻只可能属一宗 → 两者不会叠加，故合并为同一键。
 */
export const SECT_DAO = {
  sword: { name: '剑修', desc: '战力 +10%', bonus: { power: 0.10 } },
  alchemy: { name: '丹修', desc: '丹药产出 +15%', bonus: { pill: 0.15 } },
  body: { name: '体修', desc: '秘境战力判定 +8%', bonus: { power: 0.08 } },
  talisman: { name: '符修', desc: '事件收益 +10%', bonus: { event: 0.10 } },
  law: { name: '法修', desc: '挂机产出 +8%', bonus: { qi: 0.08 } }
}

/**
 * 12 界宗门名册（每界 8 宗）。
 * 字段：`id`｜`name`｜`worldId`｜`dao`（道统五系之一）｜`align`（正 / 魔 / 中）｜
 *      `intro`（一句话来历）｜`origin`（'原著' | '项目'）｜`techs`（该宗继承的既有专属功法 id）
 *      `defaultForWorld`（该界默认宗，玩家未择宗时归属此宗；每界恰 1 个）
 */
export const WORLD_SECTS = [
  // ══ 01 · 青岚界（凡人修仙传）════════════════════════════════════════════
  { id: 'sect_ql_yunlan', name: '云岚宗', worldId: 'qinglan', dao: 'sword', align: '正', origin: '项目', defaultForWorld: true,
    intro: '青岚界三宗之一，以剑证道；山门常年云岚不散，故得此名。',
    techs: ['tech_ql_6', 'tech_ql_9'] },
  { id: 'sect_ql_yanyue', name: '掩月宗', worldId: 'qinglan', dao: 'sword', align: '正', origin: '原著',
    intro: '越国七派之首，剑修云集；山门以一片月色为界。',
    techs: ['tech_ql_7', 'tech_ql_8'] },
  { id: 'sect_ql_huangfeng', name: '黄枫谷', worldId: 'qinglan', dao: 'alchemy', align: '正', origin: '原著',
    intro: '谷中黄枫四季不落，丹方与炼器配方都藏在谷底那一层。',
    techs: ['tech_ql_4'] },
  { id: 'sect_ql_lingshou', name: '灵兽山', worldId: 'qinglan', dao: 'body', align: '正', origin: '原著',
    intro: '御兽一脉，山中灵禽走兽皆识人语；真灵血脉只在最深处。',
    techs: ['tech_ql_3', 'tech_ql_11'] },
  { id: 'sect_ql_qixuan', name: '七玄门', worldId: 'qinglan', dao: 'body', align: '中', origin: '原著',
    intro: '江湖门派，五年一收徒；杂役入门的规矩就是从这里传出来的。',
    techs: ['tech_ql_1'] },
  { id: 'sect_ql_luoyun', name: '落云宗', worldId: 'qinglan', dao: 'law', align: '正', origin: '原著',
    intro: '溪国三派之一，与云梦山同占一脉；古碑上的御灵术传了不知多少代。',
    techs: ['tech_ql_2'] },
  { id: 'sect_ql_guiling', name: '鬼灵门', worldId: 'qinglan', dao: 'talisman', align: '魔', origin: '原著',
    intro: '魔道宗门，以血养气、以魂炼符；门中人从不避讳自己走得快。',
    techs: ['tech_ql_5'] },
  { id: 'sect_ql_yinluo', name: '阴罗宗', worldId: 'qinglan', dao: 'body', align: '魔', origin: '原著',
    intro: '魔道顶阶传承之一，托天之力非血肉可承，唯上等灵根可修。',
    techs: ['tech_ql_10', 'tech_ql_12'] },

  // ══ 02 · 破晓星域（仙逆）════════════════════════════════════════════════
  { id: 'sect_px_hengyue', name: '恒岳派', worldId: 'poxiao', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '赵国旧派，元婴不过两手之数；边陲小宗最粗浅的吐纳法，也是起步的那一本。',
    techs: ['tech_px_1', 'tech_px_2'] },
  { id: 'sect_px_xuandao', name: '玄道宗', worldId: 'poxiao', dao: 'law', align: '正', origin: '原著',
    intro: '与恒岳派同域的旧宗，讲的是「先稳住自己，再谈外放」。',
    techs: ['tech_px_4'] },
  { id: 'sect_px_zhanshen', name: '战神殿', worldId: 'poxiao', dao: 'body', align: '正', origin: '原著',
    intro: '以战证道，殿中无坐席，只有一面被撞了两千年的墙。',
    techs: ['tech_px_9'] },
  { id: 'sect_px_daluo', name: '大罗剑宗', worldId: 'poxiao', dao: 'sword', align: '正', origin: '原著',
    intro: '剑修大宗，剑随心动、心随杀动 —— 此界最不缺的就是它。',
    techs: ['tech_px_3'] },
  { id: 'sect_px_dahun', name: '大魂门', worldId: 'poxiao', dao: 'talisman', align: '中', origin: '原著',
    intro: '神识一脉，把魂当书读；读到极处，便成了别人不敢睁的那只眼。',
    techs: ['tech_px_7', 'tech_px_11'] },
  { id: 'sect_px_lianhun', name: '炼魂宗', worldId: 'poxiao', dao: 'talisman', align: '中', origin: '原著',
    intro: '炼魂成器、成幡、成军；收的都是不甘心的魂。',
    techs: ['tech_px_6', 'tech_px_8'] },
  { id: 'sect_px_xiemo', name: '邪魔宗', worldId: 'poxiao', dao: 'body', align: '魔', origin: '原著',
    intro: '魔道大宗，以魔气养身，一路走到黑，也未必是错。',
    techs: ['tech_px_5'] },
  { id: 'sect_px_shiyin', name: '尸阴宗', worldId: 'poxiao', dao: 'law', align: '魔', origin: '原著',
    intro: '夺他人道基为己用；非上等灵根，承受不住这份账。',
    techs: ['tech_px_10', 'tech_px_12'] },

  // ══ 03 · 观云界（我师兄实在太稳健了）════════════════════════════════════
  { id: 'sect_dh_guanyun', name: '观云峰', worldId: 'denghuo', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '本界主峰，山门小得可怜；第一课不授吐纳，只问一句「什么最危险」。',
    techs: ['tech_dh_1', 'tech_dh_5'] },
  { id: 'sect_dh_xiaolu', name: '小炉峰', worldId: 'denghuo', dao: 'alchemy', align: '正', origin: '原著',
    intro: '一炉一灶，丹火不熄；峰上弟子最先学会的是算火候，其次才是算人。',
    techs: ['tech_dh_3'] },
  { id: 'sect_dh_xiaoqiong', name: '小琼峰', worldId: 'denghuo', dao: 'talisman', align: '正', origin: '原著',
    intro: '以纸代人、以偶替身 —— 退路永远要多备一份，这是峰上第一课。',
    techs: ['tech_dh_4'] },
  { id: 'sect_dh_zixiao', name: '紫霄宫', worldId: 'denghuo', dao: 'law', align: '正', origin: '原著',
    intro: '天庭高层道脉，讲的是「不强不弱、不上不下」的持中之道。',
    techs: ['tech_dh_7'] },
  { id: 'sect_dh_yuxu', name: '昆仑玉虚', worldId: 'denghuo', dao: 'sword', align: '正', origin: '原著',
    intro: '道门圣人一脉，剑不出鞘，出鞘必先算清后果。',
    techs: [] },
  { id: 'sect_dh_jiejiao', name: '截教', worldId: 'denghuo', dao: 'body', align: '中', origin: '原著',
    intro: '有教无类，来者不拒；只是这一脉的功法学得快、也还得快。',
    techs: ['tech_dh_12'] },
  { id: 'sect_dh_gongde', name: '功德院', worldId: 'denghuo', dao: 'talisman', align: '正', origin: '原著',
    intro: '管功德簿的地方，善念入账、恶念也入账；债主是天道。',
    techs: ['tech_dh_8'] },
  { id: 'sect_dh_xianghuo', name: '香火院', worldId: 'denghuo', dao: 'alchemy', align: '正', origin: '原著',
    intro: '挂闲职、领俸禄、收愿力；非上等灵根压不住这份气运。',
    techs: ['tech_dh_2', 'tech_dh_6', 'tech_dh_9', 'tech_dh_10', 'tech_dh_11'] },

  // ══ 04 · 青云古界（诛仙）════════════════════════════════════════════════
  { id: 'sect_qy_qingyun', name: '青云门', worldId: 'qingyun', dao: 'sword', align: '正', origin: '原著', defaultForWorld: true,
    intro: '正道三大派之首，七脉并列；先正其心，再正其气。',
    techs: ['tech_qy_1', 'tech_qy_6'] },
  { id: 'sect_qy_tianyin', name: '天音寺', worldId: 'qingyun', dao: 'body', align: '正', origin: '原著',
    intro: '佛门大寺，以慈悲压杀性 —— 此界最难的一课。',
    techs: ['tech_qy_2'] },
  { id: 'sect_qy_fenxiang', name: '焚香谷', worldId: 'qingyun', dao: 'alchemy', align: '正', origin: '原著',
    intro: '以离火照心：照出的，从来不是敌人。',
    techs: ['tech_qy_4', 'tech_qy_5'] },
  { id: 'sect_qy_guiwang', name: '鬼王宗', worldId: 'qingyun', dao: 'law', align: '魔', origin: '原著',
    intro: '魔教四大宗派之首，借天书第二卷崛起；黑纱之下皆是同门。',
    techs: ['tech_qy_10'] },
  { id: 'sect_qy_wandu', name: '万毒门', worldId: 'qingyun', dao: 'alchemy', align: '魔', origin: '原著',
    intro: '南疆毒脉，虫、草、血三者皆可为药，也皆可为兵。',
    techs: [] },
  { id: 'sect_qy_changsheng', name: '长生堂', worldId: 'qingyun', dao: 'law', align: '魔', origin: '原著',
    intro: '魔教四堂之一，堂名取自「长生」，做的却是催命的生意。',
    techs: ['tech_qy_3'] },
  { id: 'sect_qy_hehuan', name: '合欢派', worldId: 'qingyun', dao: 'talisman', align: '魔', origin: '原著',
    intro: '以心相印、以铃定情；铃响一声，两人同心 —— 最不像功法的一门。',
    techs: ['tech_qy_7', 'tech_qy_11'] },
  { id: 'sect_qy_jianzhong', name: '剑冢守脉', worldId: 'qingyun', dao: 'sword', align: '中', origin: '原著',
    intro: '守剑冢的一脉，不问正魔；冢里最凶的那一柄，认的不是最强的人。',
    techs: ['tech_qy_8', 'tech_qy_9', 'tech_qy_12'] },

  // ══ 05 · 望族山河（玄鉴仙族）════════════════════════════════════════════
  { id: 'sect_wz_qingchi', name: '青池宗', worldId: 'wangzu', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '控越国南五郡的大宗，下辖月湖、青穗二峰；鉴子照心，照的都是自家人。',
    techs: ['tech_wz_1', 'tech_wz_8'] },
  { id: 'sect_wz_yetian', name: '谒天门', worldId: 'wangzu', dao: 'talisman', align: '正', origin: '原著',
    intro: '以符种入体、以箓气凝丹；入此门者，从此这一族的运数也入了你的身。',
    techs: ['tech_wz_2', 'tech_wz_3'] },
  { id: 'sect_wz_tangjin', name: '镗金门', worldId: 'wangzu', dao: 'body', align: '正', origin: '原著',
    intro: '金性不坏，故神可长存 —— 这是这一门最贵的东西。',
    techs: ['tech_wz_5', 'tech_wz_12'] },
  { id: 'sect_wz_jinyu', name: '金羽宗', worldId: 'wangzu', dao: 'sword', align: '正', origin: '原著',
    intro: '羽衣剑修一脉，剑上系一根金羽，出剑时先响后至。',
    techs: [] },
  { id: 'sect_wz_xuanyue', name: '玄岳门', worldId: 'wangzu', dao: 'body', align: '正', origin: '原著',
    intro: '开一方洞天，为一家百年留一处退路 —— 门中长老都是这么过来的。',
    techs: ['tech_wz_6'] },
  { id: 'sect_wz_konghai', name: '大倥海寺', worldId: 'wangzu', dao: 'talisman', align: '正', origin: '原著',
    intro: '释教一脉，法师与怜愍同堂；讲的是「族运连着众生运」。',
    techs: ['tech_wz_7'] },
  { id: 'sect_wz_qingchi_mo', name: '青迟魔门', worldId: 'wangzu', dao: 'law', align: '魔', origin: '原著',
    intro: '夺他人元以炼己箓；天灵之资方可承，凡骨修之必反噬。',
    techs: ['tech_wz_10', 'tech_wz_11'] },
  { id: 'sect_wz_yuehua', name: '月华元府', worldId: 'wangzu', dao: 'alchemy', align: '中', origin: '原著',
    intro: '上古越国仙府，与古镜同源；一册传了三十代的笔记，比功法更像家书。',
    techs: ['tech_wz_4', 'tech_wz_9'] },

  // ══ 06 · 幽傩界（道诡异仙）══════════════════════════════════════════════
  { id: 'sect_yn_qingfeng', name: '清风观', worldId: 'younuo', dao: 'alchemy', align: '正', origin: '原著', defaultForWorld: true,
    intro: '本界道观，杂役先辨药、再辨自己；一尊玄鼎烧的是药材，也是寿数。',
    techs: ['tech_yn_1', 'tech_yn_2'] },
  { id: 'sect_yn_zhengde', name: '正德寺', worldId: 'younuo', dao: 'body', align: '正', origin: '原著',
    intro: '佛门古寺，以身为容器；请神上身之前，得先知道自己装得下什么。',
    techs: ['tech_yn_4'] },
  { id: 'sect_yn_zuowang', name: '坐忘道', worldId: 'younuo', dao: 'talisman', align: '中', origin: '原著',
    intro: '真假两条线同时走，走错一步，就分不清哪个是自己。',
    techs: ['tech_yn_5'] },
  { id: 'sect_yn_bailian', name: '白莲教', worldId: 'younuo', dao: 'law', align: '中', origin: '原著',
    intro: '民间教门，教义朴素得可疑；信的人越多，他们的规矩就越硬。',
    techs: [] },
  { id: 'sect_yn_aojing', name: '袄景教', worldId: 'younuo', dao: 'talisman', align: '中', origin: '原著',
    intro: '十字寺下六位大长老，掌的不是经，是「改一次的价钱」。',
    techs: ['tech_yn_7'] },
  { id: 'sect_yn_fajiao', name: '法教', worldId: 'younuo', dao: 'law', align: '中', origin: '原著',
    intro: '大齐境内的教门，专治走火：把烧起来的心火，一寸寸压回去。',
    techs: ['tech_yn_6'] },
  { id: 'sect_yn_minglun', name: '明轮堂', worldId: 'younuo', dao: 'body', align: '魔', origin: '原著',
    intro: '执掌大齐「规矩」的地方，堂中人不讲善恶，只讲轮次。',
    techs: ['tech_yn_10'] },
  { id: 'sect_yn_jiantian', name: '监天司', worldId: 'younuo', dao: 'alchemy', align: '正', origin: '原著',
    intro: '官家衙门，测天象、录诡异；此界最难得的不是修为，是「还认得自己」。',
    techs: ['tech_yn_3', 'tech_yn_8', 'tech_yn_9', 'tech_yn_11', 'tech_yn_12'] },

  // ══ 07 · 通天界（一念永恒）══════════════════════════════════════════════
  { id: 'sect_tt_lingxi', name: '灵溪宗', worldId: 'tongtian', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '本界入门宗，香云山下；灶房那一本被村口少年翻烂了。',
    techs: ['tech_tt_1'] },
  { id: 'sect_tt_xuexi', name: '血溪宗', worldId: 'tongtian', dao: 'body', align: '中', origin: '原著',
    intro: '以血炼体、以战养命；铁身金身金刚骨，一步都省不得。',
    techs: ['tech_tt_2', 'tech_tt_3', 'tech_tt_4'] },
  { id: 'sect_tt_nihe', name: '逆河宗', worldId: 'tongtian', dao: 'law', align: '中', origin: '原著',
    intro: '逆水而行的一脉，百家之气合流归一：走得慢，但走得远。',
    techs: ['tech_tt_6'] },
  { id: 'sect_tt_xuanxi', name: '玄溪宗', worldId: 'tongtian', dao: 'law', align: '正', origin: '原著',
    intro: '与灵溪同源的旧宗，讲魂、也讲疼：魂越炼越亮，也越炼越疼。',
    techs: ['tech_tt_5'] },
  { id: 'sect_tt_danxi', name: '丹溪宗', worldId: 'tongtian', dao: 'alchemy', align: '正', origin: '原著',
    intro: '一溪药香，丹炉终日不冷；祖师留下的规矩是「先尝后炼」。',
    techs: [] },
  { id: 'sect_tt_han', name: '寒宗', worldId: 'tongtian', dao: 'body', align: '正', origin: '原著',
    intro: '身在极北，气机自寒；宗中弟子入门先学「怎么不冻着自己」。',
    techs: [] },
  { id: 'sect_tt_yunlei', name: '九天云雷宗', worldId: 'tongtian', dao: 'sword', align: '正', origin: '原著',
    intro: '雷法一脉，天上有云便是主场；榜上有名之后，修行就不再是一个人的事。',
    techs: ['tech_tt_7'] },
  { id: 'sect_tt_daoji', name: '星空道极宗', worldId: 'tongtian', dao: 'law', align: '正', origin: '原著',
    intro: '跨星空的庞大势宗，以贡献点列袍色；坐上那个位子，才知道它有多冷。',
    techs: ['tech_tt_8', 'tech_tt_9', 'tech_tt_10', 'tech_tt_11', 'tech_tt_12'] },

  // ══ 08 · 天工界（仙工开物）══════════════════════════════════════════════
  { id: 'sect_tg_bukong', name: '不空门', worldId: 'tiangong', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '三宗之一，机关术的根脉；一根丝、十根指头，是入门的第一课。',
    techs: ['tech_tg_1', 'tech_tg_2'] },
  { id: 'sect_tg_zixiao', name: '紫霄阁', worldId: 'tiangong', dao: 'sword', align: '正', origin: '原著',
    intro: '雷法真传，以机引雷：会走路的东西带着千斤火精，全靠它引路。',
    techs: ['tech_tg_6'] },
  { id: 'sect_tg_wanyao', name: '万药门', worldId: 'tiangong', dao: 'alchemy', align: '正', origin: '原著',
    intro: '植修、丹士、医师三类同门共炉；药性比人性好算得多。',
    techs: [] },
  { id: 'sect_tg_taiqing', name: '太清宫', worldId: 'tiangong', dao: 'law', align: '正', origin: '原著',
    intro: '上界道宫，图纸画的全是别人不敢造的东西；地火之宫在它门下。',
    techs: ['tech_tg_8'] },
  { id: 'sect_tg_haoyue', name: '皓月宗', worldId: 'tiangong', dao: 'talisman', align: '正', origin: '原著',
    intro: '以月华为料、以符为刃；钟响一声，万里共闻，消息从此比人快。',
    techs: ['tech_tg_7'] },
  { id: 'sect_tg_shihun', name: '噬魂宗', worldId: 'tiangong', dao: 'body', align: '魔', origin: '原著',
    intro: '魔道大宗，以魂淬器；器成之日，器里住的是谁就说不清了。',
    techs: [] },
  { id: 'sect_tg_ningjia', name: '宁家', worldId: 'tiangong', dao: 'alchemy', align: '中', origin: '原著',
    intro: '匠户世家，主脉支脉共守一炉；苍铁甲身，以机关为肉。',
    techs: ['tech_tg_5'] },
  { id: 'sect_tg_heishi', name: '黑市', worldId: 'tiangong', dao: 'talisman', align: '中', origin: '原著',
    intro: '没有山门的宗门：三教九流共用一个规矩 —— 出货不问来路。',
    techs: ['tech_tg_3', 'tech_tg_4', 'tech_tg_9', 'tech_tg_10', 'tech_tg_11', 'tech_tg_12'] },

  // ══ 09 · 六面囚笼（谁让他修仙的！）══════════════════════════════════════
  { id: 'sect_lm_wendao', name: '问道宗', worldId: 'liumian', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '五大仙门之首，宗主不语道人；照着前人拳法仿出来的一路，管用就行。',
    techs: ['tech_lm_1'] },
  { id: 'sect_lm_xuankong', name: '悬空庙', worldId: 'liumian', dao: 'body', align: '正', origin: '原著',
    intro: '五大仙门中人最少的一门，庙悬在半空，弟子也少得悬。',
    techs: [] },
  { id: 'sect_lm_yuegui', name: '月桂仙宫', worldId: 'liumian', dao: 'alchemy', align: '正', origin: '原著',
    intro: '倚月亮修行；一颗扛牛丹下肚，力气的账先记着。',
    techs: ['tech_lm_2'] },
  { id: 'sect_lm_zhenyu', name: '镇狱宗', worldId: 'liumian', dao: 'talisman', align: '正', origin: '原著',
    intro: '镇压魑魅魍魉；此界传承十有八九是假的，这一门教你认出真的那一分。',
    techs: ['tech_lm_5'] },
  { id: 'sect_lm_wuxing', name: '五行宗', worldId: 'liumian', dao: 'law', align: '正', origin: '原著',
    intro: '信奉五行归一，五家的法门各取一分，合成自己的一门。',
    techs: ['tech_lm_4'] },
  { id: 'sect_lm_tiance', name: '天策宗', worldId: 'liumian', dao: 'talisman', align: '正', origin: '原著',
    intro: '以因果占卜立宗；算得出吉凶，算不出要不要开那一盒。',
    techs: ['tech_lm_6'] },
  { id: 'sect_lm_jiuyou', name: '九幽教', worldId: 'liumian', dao: 'body', align: '魔', origin: '原著',
    intro: '魔道教派，说得越像真的，自己就越要信一半。',
    techs: ['tech_lm_8'] },
  { id: 'sect_lm_buxiu', name: '不朽教', worldId: 'liumian', dao: 'law', align: '魔', origin: '原著',
    intro: '魔道中最新的一支教门，教义是「天庭是我编的」—— 编得很像。',
    techs: ['tech_lm_3', 'tech_lm_7', 'tech_lm_9', 'tech_lm_10', 'tech_lm_11', 'tech_lm_12'] },

  // ══ 10 · 九鼎九州（大乘期才有逆袭系统）══════════════════════════════════
  { id: 'sect_jd_dao', name: '道宗', worldId: 'jiuding', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '九州大宗，州县里最普通的启蒙功法就是从这儿发下去的。',
    techs: ['tech_jd_1', 'tech_jd_2'] },
  { id: 'sect_jd_luban', name: '鲁班宗', worldId: 'jiuding', dao: 'alchemy', align: '正', origin: '原著',
    intro: '机关与炼丹的革新一脉；师门规矩是「先造一个不会坏的，再造一个会坏的」。',
    techs: [] },
  { id: 'sect_jd_lingyao', name: '灵药宗', worldId: 'jiuding', dao: 'alchemy', align: '正', origin: '原著',
    intro: '药圃连着药圃，功德金榜上这一门常年排在前列。',
    techs: ['tech_jd_3'] },
  { id: 'sect_jd_yushou', name: '御兽宗', worldId: 'jiuding', dao: 'body', align: '正', origin: '原著',
    intro: '人兽同修，此界的灵兽比人还认规矩。',
    techs: [] },
  { id: 'sect_jd_lingzhi', name: '灵植宗', worldId: 'jiuding', dao: 'talisman', align: '正', origin: '原著',
    intro: '种的是仙梯残片上还留着的那半句口诀，收的是一整季的气运。',
    techs: ['tech_jd_4'] },
  { id: 'sect_jd_wulei', name: '五雷正法宗', worldId: 'jiuding', dao: 'sword', align: '正', origin: '原著',
    intro: '雷法正统，五位统领的战诀合为一册，讲的是怎么带人。',
    techs: ['tech_jd_6'] },
  { id: 'sect_jd_jiange', name: '剑阁', worldId: 'jiuding', dao: 'sword', align: '正', origin: '原著',
    intro: '九州剑修聚集处；人皇殿里那一册，翻过的人不多，翻完的更少。',
    techs: ['tech_jd_7', 'tech_jd_11'] },
  { id: 'sect_jd_tiansha', name: '天杀阁', worldId: 'jiuding', dao: 'talisman', align: '中', origin: '原著',
    intro: '拿钱办事的楼阁，阁中只记两件事：谁出的价、谁还活着。',
    techs: ['tech_jd_5', 'tech_jd_8', 'tech_jd_9', 'tech_jd_10', 'tech_jd_12'] },

  // ══ 11 · 无缺古界（我欲封天）════════════════════════════════════════════
  { id: 'sect_wy_fushan', name: '负山宗', worldId: 'wuyuan', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '赵国旧宗，曾居四大之首而后没落；走的每一步都算数 —— 慢就是快。',
    techs: ['tech_wy_1', 'tech_wy_2'] },
  { id: 'sect_wy_ziyun', name: '紫运宗', worldId: 'wuyuan', dao: 'alchemy', align: '正', origin: '原著',
    intro: '南域大宗，主持丹拍；以荒龙之血炼丹，丹成有龙吟。',
    techs: ['tech_wy_4'] },
  { id: 'sect_wy_xiaoyao', name: '逍遥宗', worldId: 'wuyuan', dao: 'law', align: '中', origin: '原著',
    intro: '南域宗门，不争第一也不落最后；古玉镇荒，一玉压一域。',
    techs: ['tech_wy_5'] },
  { id: 'sect_wy_fengyao', name: '封妖一脉', worldId: 'wuyuan', dao: 'talisman', align: '正', origin: '原著',
    intro: '封正术与妖封禁法，九道封禁一道一道开 —— 开到最后，才知道封的是什么。',
    techs: ['tech_wy_6'] },
  { id: 'sect_wy_wang', name: '王氏', worldId: 'wuyuan', dao: 'body', align: '正', origin: '原著',
    intro: '有祖地与护道者的古族，族中序列印记代代相传。',
    techs: [] },
  { id: 'sect_wy_fang', name: '方氏', worldId: 'wuyuan', dao: 'sword', align: '正', origin: '原著',
    intro: '南域剑族，族中子弟出师前要在祖地过一夜 —— 独自一人。',
    techs: [] },
  { id: 'sect_wy_meng', name: '孟氏', worldId: 'wuyuan', dao: 'alchemy', align: '正', origin: '原著',
    intro: '以本命丹炉立族的世家，炉在身中、火在命里。',
    techs: ['tech_wy_8'] },
  { id: 'sect_wy_jiuhai', name: '九海神界', worldId: 'wuyuan', dao: 'law', align: '中', origin: '原著',
    intro: '山海之上的最高势力，界主降临则山海共主；赐名点化，山气随名而聚。',
    techs: ['tech_wy_3', 'tech_wy_7', 'tech_wy_9', 'tech_wy_10', 'tech_wy_11', 'tech_wy_12'] },

  // ══ 12 · 人间香火（我本无意成仙）════════════════════════════════════════
  { id: 'sect_xh_fulong', name: '伏龙观', worldId: 'xianghuo', dao: 'law', align: '正', origin: '原著', defaultForWorld: true,
    intro: '山间道观，受天道眷顾；晨钟一响，青芜山上的第一页就翻开了。',
    techs: ['tech_xh_1'] },
  { id: 'sect_xh_fengtian', name: '奉天观', worldId: 'xianghuo', dao: 'talisman', align: '正', origin: '原著',
    intro: '以推演卜算闻名；算得出雨什么时候来，算不出该不该拦。',
    techs: [] },
  { id: 'sect_xh_fuyun', name: '浮云观', worldId: 'xianghuo', dao: 'talisman', align: '正', origin: '原著',
    intro: '画符先画心：心不定，符就不灵；剪一匹纸马，烧了就能跑一夜。',
    techs: ['tech_xh_2', 'tech_xh_3'] },
  { id: 'sect_xh_tianhai', name: '天海寺', worldId: 'xianghuo', dao: 'body', align: '正', origin: '原著',
    intro: '佛门古寺，与道观同山不同院；香火各烧各的，雨落下来是同一场。',
    techs: ['tech_xh_5'] },
  { id: 'sect_xh_taian', name: '泰安寺', worldId: 'xianghuo', dao: 'body', align: '正', origin: '原著',
    intro: '雷法护寺，召得来、也要送得走；寺中僧人多半学过怎么收手。',
    techs: ['tech_xh_4'] },
  { id: 'sect_xh_jinglei', name: '惊雷剑派', worldId: 'xianghuo', dao: 'sword', align: '正', origin: '原著',
    intro: '江湖门派中最像样的一支；民心所向，气运随之。',
    techs: ['tech_xh_6', 'tech_xh_7'] },
  { id: 'sect_xh_jindao', name: '金刀门', worldId: 'xianghuo', dao: 'body', align: '正', origin: '原著',
    intro: '一刀破门的江湖门派；金身由民心铸，一炷香一炷香地凝。',
    techs: ['tech_xh_8'] },
  { id: 'sect_xh_xishan', name: '西山派', worldId: 'xianghuo', dao: 'alchemy', align: '中', origin: '原著',
    intro: '西山之上的散修一脉，二十年走完，一张一张把符箓交出去。',
    techs: ['tech_xh_9', 'tech_xh_10', 'tech_xh_11', 'tech_xh_12'] }
]

/** 快速索引 */
const BY_ID = WORLD_SECTS.reduce((acc, s) => {
  acc[s.id] = s
  return acc
}, {})

/** 取某界 8 宗（顺序＝表序，第 1 个即默认宗） */
export function sectsOfWorld (worldId) {
  return WORLD_SECTS.filter((s) => s.worldId === worldId)
}

/** 取单宗；未登记返回 null */
export function getSect (id) {
  return BY_ID[id] || null
}

/**
 * V6.12 批 G4：**老档 sectId 别名映射**。
 *   旧表（`data/sect.js` 的 `SECT.id`）用 `sect_yunlan`，名册用 `sect_ql_yunlan`；
 *   存量存档的 `state.sect.sectId` 仍是旧值 —— 不映射则 `getSect()` 返回 null，
 *   按宗查道统 / 名册 / 传承会静默失效（本批最隐蔽的风险点，自测显式钉住）。
 */
export const LEGACY_SECT_IDS = { sect_yunlan: 'sect_ql_yunlan' }

/** 归一化 sectId（旧值 → 名册 id；未知值原样返回，空值返回 null） */
export function normalizeSectId (id) {
  if (!id || typeof id !== 'string') return null
  return LEGACY_SECT_IDS[id] || id
}

// ═══════════════════════════════════════════════════════════════════════════
// V6.12 批 G5a：**职级名三级表**（主人 2026-09-21 口径：「主体按阵营，然后根据世界和宗门
//   特色可以适当变化，其他职位也一样」）—— 优先级 **宗 > 界 > 阵营基线**。
//   共 8 档，与 `RANKS` 的 8 档、8 大境界一一对应（0 炼气 … 7 大乘）。
//   表里只写**名称**；门槛 / 俸禄 / 槽位 / 折扣等数值一律仍在 `data/sect.js` 的 `RANKS`。
// ═══════════════════════════════════════════════════════════════════════════

/** 阵营基线（正 / 魔 / 中）—— 8 档 */
export const RANK_BASE_BY_ALIGN = {
  正: ['外门弟子', '内门弟子', '真传弟子', '执事长老', '首座', '掌门', '太上长老', '太上祖师'],
  魔: ['外门杂役', '内门魔徒', '真传魔徒', '执法魔使', '魔殿首座', '魔主', '太上魔尊', '太上魔祖'],
  中: ['外门门人', '内门门人', '真传门人', '执事', '首座', '门主', '太上长老', '太上祖师']
}

/**
 * 界级覆盖（按界气质微调若干档；未写的档回落阵营基线）。
 *   键＝档位下标（0~7），值＝该界在此档的称号。
 */
export const RANK_OVERRIDE_BY_WORLD = {
  qinglan: { 5: '掌门', 6: '太上长老', 7: '太上祖师' },
  poxiao: { 5: '宗主', 6: '太上尊主', 7: '踏天者' },
  denghuo: { 5: '峰主', 6: '太上长老', 7: '守拙真人' },
  qingyun: { 5: '掌门', 6: '太上长老', 7: '剑意超脱者' },
  wangzu: { 5: '族正', 6: '族老', 7: '族祖' },
  younuo: { 5: '观主', 6: '大傩', 7: '司命' },
  tongtian: { 5: '宗主', 6: '太上长老', 7: '长生真人' },
  tiangong: { 5: '宗匠', 6: '大匠师', 7: '开物真人' },
  liumian: { 5: '宗主', 6: '太上长老', 7: '自创境者' },
  jiuding: { 5: '殿主', 6: '人皇', 7: '功德金身' },
  wuyuan: { 5: '宗主', 6: '太上长老', 7: '封天真人' },
  xianghuo: { 5: '观主', 6: '老君', 7: '香火金身' }
}

/**
 * 宗级覆盖（按宗门特色；最高优先级）。只列**确需专名**的宗，其余回落界级 / 阵营基线。
 */
export const RANK_OVERRIDE_BY_SECT = {
  sect_qy_qingyun: { 5: '掌门', 6: '太上长老', 7: '诛仙执剑人' },
  sect_qy_guiwang: { 5: '宗主', 6: '太上鬼王', 7: '幽冥魔祖' },
  sect_qy_tianyin: { 5: '方丈', 6: '首座长老', 7: '如来金身' },
  sect_ql_yunlan: { 5: '掌门', 6: '太上长老', 7: '云岚祖师' },
  sect_px_hengyue: { 5: '掌门', 6: '太上长老', 7: '恒岳问天者' },
  sect_px_daluo: { 5: '剑主', 6: '太上剑尊', 7: '大罗剑祖' },
  sect_tt_daoji: { 5: '袍首', 6: '太上执袍', 7: '道极真人' },
  sect_tg_bukong: { 5: '宗匠', 6: '悬丝大宗师', 7: '不空开物者' },
  sect_wz_qingchi: { 5: '族正', 6: '太上族老', 7: '青池族祖' },
  sect_jd_dao: { 5: '宗主', 6: '太上道尊', 7: '道宗祖师' },
  sect_jd_jiange: { 5: '阁主', 6: '太上剑主', 7: '九州剑祖' },
  sect_xh_fulong: { 5: '观主', 6: '老君', 7: '伏龙真君' },
  sect_dh_guanyun: { 5: '峰主', 6: '太上长老', 7: '观云祖师' },
  sect_wy_fushan: { 5: '宗主', 6: '太上长老', 7: '负山道祖' }
}

/**
 * 取某宗（或某界 / 阵营）的 8 档职级名。
 * 优先级：**宗级覆盖 > 界级覆盖 > 阵营基线**；任一层缺档则逐级回落。
 * @param {string|null} sectId 宗门 id（可为老档别名）
 * @param {string} [align]     阵营兜底（'正'|'魔'|'中'）；省略时从宗门自身取
 * @returns {string[]} 长度恒为 8
 */
export function rankTitlesOf (sectId = null, align = null) {
  const sid = normalizeSectId(sectId)
  const sect = sid ? getSect(sid) : null
  const a = align || (sect && sect.align) || '正'
  const base = RANK_BASE_BY_ALIGN[a] || RANK_BASE_BY_ALIGN['正']
  const byWorld = (sect && RANK_OVERRIDE_BY_WORLD[sect.worldId]) || {}
  const bySect = (sid && RANK_OVERRIDE_BY_SECT[sid]) || {}
  return base.map((n, i) => bySect[i] || byWorld[i] || n)
}

/** 取某宗第 idx 档的称号（越界回落阵营基线；供单点查询） */
export function rankTitleOf (sectId, idx, align = null) {
  const list = rankTitlesOf(sectId, align)
  const i = Math.max(0, Math.min(list.length - 1, idx | 0))
  return list[i]
}

/** 该界的默认宗（玩家未择宗时的归属；每界恰 1 个，兜底取该界第 1 宗） */
export function defaultSectOf (worldId) {
  const list = sectsOfWorld(worldId)
  return list.find((s) => s.defaultForWorld) || list[0] || null
}

/** 反查：某本既有专属功法归属哪一宗（未归类返回 null） */
export function sectOfTech (techId) {
  return WORLD_SECTS.find((s) => (s.techs || []).includes(techId)) || null
}

/** 每界宗门数校验用（自测断言 12 界 × 8 宗） */
export function sectCountByWorld () {
  const out = {}
  for (const s of WORLD_SECTS) out[s.worldId] = (out[s.worldId] || 0) + 1
  return out
}

export default {
  WORLD_SECTS, SECT_DAO,
  sectsOfWorld, getSect, defaultSectOf, sectOfTech, sectCountByWorld
}
