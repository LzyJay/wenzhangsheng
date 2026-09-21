/**
 * sectTechniques.js —— 宗门功法库（只读配置层）（V6.12 · 批 G3）
 * ═══════════════════════════════════════════════════════════════════════════
 * 口径（主人 2026-09-21 拍板）：
 *   · **每宗 3 本**（入门 / 中坚 / 镇派，分布三个境界段），12 界 × 8 宗 × 3 ＝ **288 本**。
 *   · 道统一律沿用既有五系（剑 / 丹 / 体 / 符 / 法），**tag 只用既有体系**
 *     （`wuxing` 与变异 `lei/bing/feng/an` 作主修；`sword/alchemy/body` 作辅修）——
 *     不新增 tag，故 `slotKindsOf` / 槽位 / 面板全链路零改动。
 *   · 数值一律取该阶**既有最低档**（`techniqueLibrary.TIER_RATE`）→ 不抬高任何一阶的 max/min。
 *   · 与各界专属本同构（`worldId` 指向该宗所在界），但 `type:'sect'` 标明来源为宗门传承。
 *
 * 与 `techniqueLibrary.js` 的关系：两者都是**纯增量**，由 `techniques.js` 统一合并；
 *   本文件只 import `mkTech` 与宗门表，**不反向依赖**（data→data 单向）。
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { mkTech } from './techniqueLibrary.js'
import { getSect } from './worldSects.js'

/** 三本的档位名（入门 / 中坚 / 镇派） */
export const SECT_TECH_LEVELS = ['入门', '中坚', '镇派']

/**
 * 宗门功法工厂（紧凑写法）。
 * `n`：1 入门 / 2 中坚 / 3 镇派；三本的境界段固定为 0 / 2 / 5（覆盖前中后三段）。
 */
function st (sectId, n, name, tier, grade, tag, desc) {
  const sect = getSect(sectId)
  const realm = [0, 2, 5][n - 1]
  const id = `tech_${sectId.replace(/^sect_/, '')}_${n}`
  return mkTech(
    id, name, tier, grade, realm, [tag],
    { type: 'sect', label: `${sect.name} · ${SECT_TECH_LEVELS[n - 1]}` },
    desc,
    { worldId: sect.worldId }
  )
}

export const SECT_TECHS = [
  // ══ 01 · 青岚界 ═════════════════════════════════════════════════════════
  st('sect_ql_yunlan', 1, '云岚引气篇', 'fan', 1, 'wuxing', '云岚宗入门第一课：云岚不散，气就不散。'),
  st('sect_ql_yunlan', 2, '云岚剑典', 'xuan', 4, 'sword', '以云为鞘、以岚为锋；一剑出去，山间雾气先动。'),
  st('sect_ql_yunlan', 3, '斩灵剑意', 'tian', 7, 'sword', '飞升之前的最后一剑，斩的从来不是人。'),
  st('sect_ql_yanyue', 1, '月色吐纳法', 'fan', 2, 'wuxing', '对月吐纳，气随月盈亏；掩月弟子的第一本。'),
  st('sect_ql_yanyue', 2, '掩月剑经', 'xuan', 5, 'sword', '剑走偏锋、势藏于阴；挡得住第一剑，未必挡得住第二剑。'),
  st('sect_ql_yanyue', 3, '月华斩灵篇', 'tian', 8, 'sword', '月华落处，剑已在；越国七派之首的立派之本。'),
  st('sect_ql_huangfeng', 1, '黄枫采药篇', 'fan', 2, 'alchemy', '认药、采药、晾药——黄枫谷的入门第一步不在炉边。'),
  st('sect_ql_huangfeng', 2, '枫露炼丹章', 'xuan', 4, 'alchemy', '以枫露为引，丹成时药香里带一丝甜。'),
  st('sect_ql_huangfeng', 3, '九转黄枫丹经', 'tian', 8, 'alchemy', '一转一色，九转之后枫叶落在炉盖上都成丹。'),
  st('sect_ql_lingshou', 1, '驯兽入门篇', 'fan', 3, 'body', '灵兽山第一课：先让一头野兽愿意听你把话说完。'),
  st('sect_ql_lingshou', 2, '灵兽合体诀', 'xuan', 5, 'body', '人兽同息：它的力气走你的经脉，你的疼它替你记一半。'),
  st('sect_ql_lingshou', 3, '万兽朝宗诀', 'tian', 9, 'body', '山中禽兽一齐回头的那一日，便是此诀大成。'),
  st('sect_ql_qixuan', 1, '七玄炼体诀', 'fan', 3, 'body', '江湖门派的粗浅功夫：先能挨打，再谈别的。'),
  st('sect_ql_qixuan', 2, '玄门硬功篇', 'huang', 6, 'body', '五年一收徒，收进来的先扎三年马步 —— 本篇就是那三年。'),
  st('sect_ql_qixuan', 3, '七玄不败身', 'di', 7, 'body', '江湖上没人记得它输过 —— 因为用它的都不出手。'),
  st('sect_ql_luoyun', 1, '落云吐纳法', 'fan', 2, 'wuxing', '溪国三派最平常的入门法：气落如云，不争高低。'),
  st('sect_ql_luoyun', 2, '云梦洞天经', 'xuan', 4, 'wuxing', '云梦山深处那一眼灵泉的用法，都写在这一经里。'),
  st('sect_ql_luoyun', 3, '落云归元章', 'tian', 7, 'wuxing', '云落归山、气落归元；此章讲的是「收」。'),
  st('sect_ql_guiling', 1, '鬼灵引魂术', 'fan', 3, 'an', '鬼灵门入门：先把魂叫出来，再谈怎么收回去。'),
  st('sect_ql_guiling', 2, '血符炼魄篇', 'xuan', 5, 'an', '以血画符、以符炼魄；符成之日指尖总是凉的。'),
  st('sect_ql_guiling', 3, '鬼灵夺魂符经', 'tian', 8, 'an', '魔道符修的根本大法：一符出手，先夺其魂。'),
  st('sect_ql_yinluo', 1, '阴罗淬骨诀', 'fan', 3, 'body', '魔道入门：以阴气淬骨，冷是冷，是真的硬。'),
  st('sect_ql_yinluo', 2, '罗刹炼身章', 'xuan', 6, 'body', '炼到皮肉如甲、骨如寒铁；同门之间互称「罗刹」。'),
  st('sect_ql_yinluo', 3, '阴罗托天经', 'tian', 9, 'body', '托天之力非血肉可承 —— 唯变异以上灵根可修。'),

  // ══ 02 · 破晓星域 ═══════════════════════════════════════════════════════
  st('sect_px_hengyue', 1, '恒岳吐纳篇', 'fan', 1, 'wuxing', '边陲小宗最粗浅的一本，也是边陲少年起步的那一本。'),
  st('sect_px_hengyue', 2, '恒岳古碑经', 'xuan', 4, 'wuxing', '碑上字迹被风磨了千年，剩下的半句才是真的。'),
  st('sect_px_hengyue', 3, '恒岳问天章', 'tian', 7, 'wuxing', '恒岳派压箱底的一章：不问道，只问一句「凭什么」。'),
  st('sect_px_xuandao', 1, '定神入道篇', 'fan', 2, 'wuxing', '玄道宗入门：先稳住自己，再谈外放。'),
  st('sect_px_xuandao', 2, '玄道凝识经', 'xuan', 5, 'wuxing', '神识凝而不散，方能照见别人看不见的那一层。'),
  st('sect_px_xuandao', 3, '玄道极境章', 'tian', 8, 'wuxing', '神识推到尽头，这一章的下一页是空的 —— 留给自己写。'),
  st('sect_px_zhanshen', 1, '战殿筑基功', 'fan', 3, 'body', '战神殿的入门法：不坐、不卧，站着修。'),
  st('sect_px_zhanshen', 2, '战神炼血篇', 'xuan', 5, 'body', '以战为火、以血为炉；殿中那面墙就是这么撞出来的。'),
  st('sect_px_zhanshen', 3, '战神殿不坏身', 'tian', 9, 'body', '两千年来只成过三人；三人皆未退过一步。'),
  st('sect_px_daluo', 1, '起手一剑诀', 'fan', 1, 'sword', '大罗剑宗入门：一柄木剑、一式起手，别的都不教。'),
  st('sect_px_daluo', 2, '大罗剑典', 'xuan', 4, 'sword', '剑随心动、心随杀动 —— 此界最不缺的就是它。'),
  st('sect_px_daluo', 3, '大罗剑域章', 'tian', 8, 'sword', '剑落成域：进了这一域，天与地都由剑说了算。'),
  st('sect_px_dahun', 1, '收魂入门篇', 'fan', 2, 'an', '大魂门入门：收的都是不甘心的魂。'),
  st('sect_px_dahun', 2, '魂灯炼神章', 'xuan', 5, 'an', '一盏魂灯照识海：灯亮则神清，灯灭则魂散。'),
  st('sect_px_dahun', 3, '大魂归元经', 'tian', 8, 'an', '神识一脉的顶阶法：把别人的执念，炼成自己的力气。'),
  st('sect_px_lianhun', 1, '炼魂初解', 'fan', 3, 'an', '炼魂宗入门：魂越炼越亮，也越炼越疼。'),
  st('sect_px_lianhun', 2, '炼魂化幡篇', 'xuan', 5, 'an', '幡面展开，收进来的都是没说完的话。'),
  st('sect_px_lianhun', 3, '万魂归一诀', 'tian', 9, 'an', '满幡执念归于一念 —— 那一念，还是不是你的？'),
  st('sect_px_xiemo', 1, '魔息入体篇', 'fan', 2, 'an', '邪魔宗入门：以魔气养身，一路走到黑，也未必是错。'),
  st('sect_px_xiemo', 2, '邪魔炼体章', 'xuan', 5, 'an', '魔气淬体，痛是常态；熬过三冬便算入门。'),
  st('sect_px_xiemo', 3, '邪魔真身经', 'tian', 8, 'an', '魔道身法极致：现真身之时，天地都要让三分。'),
  st('sect_px_shiyin', 1, '夺基入门法', 'fan', 3, 'an', '尸阴宗入门：夺他人道基为己用，先从最浅的一层学起。'),
  st('sect_px_shiyin', 2, '尸阴炼魄经', 'xuan', 5, 'an', '炼魄如炼器：火候到了，魄自然听话。'),
  st('sect_px_shiyin', 3, '尸阴夺元章', 'tian', 9, 'an', '非上等灵根承受不住这一章 —— 这也是它的门槛所在。'),

  // ══ 03 · 观云界 ═════════════════════════════════════════════════════════
  st('sect_dh_guanyun', 1, '观云问危诀', 'fan', 1, 'wuxing', '观云峰第一课不授吐纳，只问一句：什么最危险。'),
  st('sect_dh_guanyun', 2, '观云守静经', 'xuan', 4, 'wuxing', '云在动，人不动；不是不动手，是谋定再动。'),
  st('sect_dh_guanyun', 3, '观云不动章', 'tian', 8, 'wuxing', '修到最后一页才知道：这一章的功夫全在「不」。'),
  st('sect_dh_xiaolu', 1, '小炉候火篇', 'fan', 2, 'alchemy', '峰上弟子最先学会的不是炼丹，是算火候。'),
  st('sect_dh_xiaolu', 2, '丹火长明经', 'xuan', 4, 'alchemy', '一炉不熄三百年：火在，人就还在。'),
  st('sect_dh_xiaolu', 3, '小炉不熄章', 'tian', 8, 'alchemy', '把小炉封了那一夜，全峰都闻到了丹香。'),
  st('sect_dh_xiaoqiong', 1, '纸偶入门篇', 'fan', 2, 'wuxing', '以纸代人 —— 退路永远要多备一份，这是峰上第一课。'),
  st('sect_dh_xiaoqiong', 2, '替身纸偶经', 'xuan', 5, 'wuxing', '一纸一偶一替身：替得了灾，替不了命。'),
  st('sect_dh_xiaoqiong', 3, '小琼化形章', 'tian', 8, 'wuxing', '纸人替得多了，得先记住哪个是自己。'),
  st('sect_dh_zixiao', 1, '持中养气诀', 'fan', 1, 'wuxing', '不强不弱、不上不下 —— 此界最难的功夫叫「刚刚好」。'),
  st('sect_dh_zixiao', 2, '紫霄均势经', 'xuan', 4, 'wuxing', '把两边都扶稳，自己站中间；看着最闲，其实最累。'),
  st('sect_dh_zixiao', 3, '紫霄守中章', 'tian', 8, 'wuxing', '守中不是不选，是选了之后还能退回来。'),
  st('sect_dh_yuxu', 1, '玉虚养锋诀', 'fan', 2, 'sword', '剑不出鞘，出鞘必先算清后果。'),
  st('sect_dh_yuxu', 2, '昆仑剑诀', 'xuan', 5, 'sword', '昆仑玉虚一脉的剑理：锋在鞘中养，越养越冷。'),
  st('sect_dh_yuxu', 3, '玉虚不鸣章', 'tian', 9, 'sword', '一鸣之后便再无第二声 —— 所以圣人从不肯轻易鸣。'),
  st('sect_dh_jiejiao', 1, '有教无类篇', 'fan', 3, 'body', '截教入门：来者不拒，学得快，也还得快。'),
  st('sect_dh_jiejiao', 2, '截教炼身经', 'xuan', 5, 'body', '身为一截，取用无穷；只是取的时候要问一句够不够。'),
  st('sect_dh_jiejiao', 3, '截教万法章', 'tian', 9, 'body', '万法皆可截，唯因果截不断。'),
  st('sect_dh_gongde', 1, '功德记账诀', 'fan', 2, 'wuxing', '功德簿管两样：善念入账，恶念也入账。'),
  st('sect_dh_gongde', 2, '功德偿还经', 'xuan', 5, 'wuxing', '把天道当债主：先借后还，账要算清。'),
  st('sect_dh_gongde', 3, '功德圆满章', 'tian', 8, 'wuxing', '债清了的那一天，簿子自己合上。'),
  st('sect_dh_xianghuo', 1, '愿力聚形诀', 'fan', 2, 'wuxing', '收在他们心里，也收在你身上 —— 愿力聚而成形。'),
  st('sect_dh_xianghuo', 2, '香火长明章', 'xuan', 5, 'wuxing', '一炷香续一炷香，续的是别人的念想，也是自己的路。'),
  st('sect_dh_xianghuo', 3, '香火不断章', 'tian', 8, 'wuxing', '香火断的那一日，才是这一门真正的终局。'),

  // ══ 04 · 青云古界 ═══════════════════════════════════════════════════════
  st('sect_qy_qingyun', 1, '青云引气篇', 'fan', 1, 'wuxing', '青云门入门道法：先正其心，再正其气。'),
  st('sect_qy_qingyun', 2, '青云剑典', 'xuan', 4, 'sword', '七脉共修的一典，剑上带着各自山头的脾气。'),
  st('sect_qy_qingyun', 3, '七脉合剑章', 'tian', 9, 'sword', '七脉剑意合于一处，青云山便再无第二座。'),
  st('sect_qy_tianyin', 1, '般若养生篇', 'fan', 2, 'body', '天音寺入门：以慈悲压杀性 —— 此界最难的一课。'),
  st('sect_qy_tianyin', 2, '天音禅唱经', 'xuan', 5, 'body', '一声佛号一层壁；唱到万声，身如金铁。'),
  st('sect_qy_tianyin', 3, '大梵般若身', 'tian', 8, 'body', '佛门炼体的顶阶法：身不坏，心也不能坏。'),
  st('sect_qy_fenxiang', 1, '焚香采火篇', 'fan', 2, 'huo', '焚香谷入门：先学会从一炷香里取火。'),
  st('sect_qy_fenxiang', 2, '离火焚丹篇', 'xuan', 5, 'huo', '以离火照心：照出的，从来不是敌人。'),
  st('sect_qy_fenxiang', 3, '焚香九转章', 'tian', 8, 'huo', '九转香火薪尽而丹成 —— 谷中长老也只见过两次。'),
  st('sect_qy_guiwang', 1, '鬼王引魂诀', 'fan', 2, 'an', '鬼王宗入门：黑纱之下皆是同门，魂也算。'),
  st('sect_qy_guiwang', 2, '天书残卷经', 'xuan', 5, 'an', '借天书第二卷崛起的那一门：残卷上的字会换位置。'),
  st('sect_qy_guiwang', 3, '鬼王噬魂章', 'tian', 9, 'an', '魔教四宗之首的立派之本：连天书都要让它三分。'),
  st('sect_qy_wandu', 1, '万毒采虫篇', 'fan', 2, 'alchemy', '南疆毒脉入门：虫、草、血三者皆可为药，也皆可为兵。'),
  st('sect_qy_wandu', 2, '毒经炼体篇', 'xuan', 5, 'alchemy', '以毒淬体：痛过三冬，百毒不侵。'),
  st('sect_qy_wandu', 3, '万毒归一诀', 'tian', 8, 'alchemy', '万毒归于一炉，炉盖揭开是药还是祸，全看用的人。'),
  st('sect_qy_changsheng', 1, '长生吐纳章', 'fan', 2, 'wuxing', '长生堂入门：堂名取自「长生」，做的却是催命的生意。'),
  st('sect_qy_changsheng', 2, '长生续命经', 'xuan', 5, 'wuxing', '续得了别人的命，续不了自己的 —— 这一经后半卷是空的。'),
  st('sect_qy_changsheng', 3, '长生夺命章', 'tian', 8, 'wuxing', '堂中长老从不亲自动手：此章便是他们的手。'),
  st('sect_qy_hehuan', 1, '同心感应篇', 'fan', 2, 'wuxing', '合欢派入门：铃响一声，两人同心。'),
  st('sect_qy_hehuan', 2, '合欢铃经', 'xuan', 5, 'wuxing', '以心相印、以铃定情 —— 此界最不像功法的一门。'),
  st('sect_qy_hehuan', 3, '同心定情章', 'tian', 8, 'wuxing', '铃在人在：这一章修到最后，最怕的是铃不响了。'),
  st('sect_qy_jianzhong', 1, '守冢观剑篇', 'fan', 2, 'sword', '剑冢守脉入门：先看剑，不碰剑。'),
  st('sect_qy_jianzhong', 2, '剑冢认主经', 'xuan', 5, 'sword', '冢里最凶的那一柄，认的不是最强的人。'),
  st('sect_qy_jianzhong', 3, '诛仙引剑章', 'tian', 9, 'sword', '不问正魔，只问剑肯不肯跟你走。'),

  // ══ 05 · 望族山河 ═══════════════════════════════════════════════════════
  st('sect_wz_qingchi', 1, '青池养气诀', 'fan', 1, 'wuxing', '青池宗入门：清池映气，浊了自己先看见。'),
  st('sect_wz_qingchi', 2, '青池箓气经', 'xuan', 4, 'wuxing', '箓气凝而不散，丹成之日，族里要开祠堂。'),
  st('sect_wz_qingchi', 3, '青池照心章', 'tian', 8, 'wuxing', '以池为鉴：照出来的，是这一族百年的账。'),
  st('sect_wz_yetian', 1, '谒天植符诀', 'fan', 2, 'wuxing', '谒天门入门：以符种入体，从此族运也入了你的身。'),
  st('sect_wz_yetian', 2, '谒天谒祖经', 'xuan', 5, 'wuxing', '拜天之前先拜祖：族规比雷法还硬。'),
  st('sect_wz_yetian', 3, '谒天开府章', 'tian', 8, 'wuxing', '开一方洞天，为一家百年留一处退路。'),
  st('sect_wz_tangjin', 1, '镗金淬骨篇', 'fan', 3, 'body', '镗金门入门：金气淬骨，冷是冷，是真的硬。'),
  st('sect_wz_tangjin', 2, '镗金炼性经', 'xuan', 5, 'body', '金性不坏，故神可长存 —— 这是这一门最贵的东西。'),
  st('sect_wz_tangjin', 3, '镗金不坏章', 'tian', 9, 'body', '炼到身如金铁，方敢在本族祠堂里站一夜。'),
  st('sect_wz_jinyu', 1, '金羽养剑篇', 'fan', 2, 'sword', '金羽宗入门：剑上系一根金羽，出剑先响后至。'),
  st('sect_wz_jinyu', 2, '金羽剑经', 'xuan', 5, 'sword', '羽落处即是剑落处；同门比试听声便知胜负。'),
  st('sect_wz_jinyu', 3, '金羽落羽章', 'tian', 8, 'sword', '一生只落一次羽 —— 落羽之时，剑已归鞘。'),
  st('sect_wz_xuanyue', 1, '玄岳立身篇', 'fan', 3, 'body', '玄岳门入门：身子站不稳，洞天也立不住。'),
  st('sect_wz_xuanyue', 2, '玄岳洞天经', 'xuan', 5, 'body', '开洞天如立门户：门开在哪里，退路就在哪里。'),
  st('sect_wz_xuanyue', 3, '玄岳镇族章', 'tian', 9, 'body', '镇族一脉的顶阶法：身在山在，山在人还在。'),
  st('sect_wz_konghai', 1, '倥海禅定篇', 'fan', 2, 'wuxing', '大倥海寺入门：法师与怜愍同堂，坐的是同一张蒲团。'),
  st('sect_wz_konghai', 2, '大倥海藏经', 'xuan', 5, 'wuxing', '寺中藏经阁不收功法的名字，只收修它的年份。'),
  st('sect_wz_konghai', 3, '倥海普度章', 'tian', 8, 'wuxing', '族运连着众生运 —— 这一章讲的是怎么不辜负。'),
  st('sect_wz_qingchi_mo', 1, '青迟夺元诀', 'fan', 3, 'an', '青迟魔门入门：夺他人元，先从最浅的一层学起。'),
  st('sect_wz_qingchi_mo', 2, '魔门炼箓经', 'xuan', 5, 'an', '以夺来的元炼己箓：箓成之日，债也记上了。'),
  st('sect_wz_qingchi_mo', 3, '青迟夺道章', 'tian', 9, 'an', '天灵之资方可承，凡骨修之必反噬 —— 门规第一条。'),
  st('sect_wz_yuehua', 1, '月华养鉴篇', 'fan', 2, 'alchemy', '月华元府入门：先养一面鉴，再谈养自己。'),
  st('sect_wz_yuehua', 2, '元府炼箓经', 'xuan', 5, 'alchemy', '上古越国仙府的残页，字迹淡得快要没有了。'),
  st('sect_wz_yuehua', 3, '月华开府章', 'tian', 8, 'alchemy', '一册传了三十代的笔记，比功法更像家书。'),

  // ══ 06 · 幽傩界 ═════════════════════════════════════════════════════════
  st('sect_yn_qingfeng', 1, '清风辨药篇', 'fan', 1, 'alchemy', '清风观入门：药房杂役先辨药，再辨自己。'),
  st('sect_yn_qingfeng', 2, '清风玄鼎经', 'xuan', 4, 'alchemy', '一尊玄鼎、一篇丹方 —— 烧的是药材，也是寿数。'),
  st('sect_yn_qingfeng', 3, '清风长生章', 'tian', 8, 'alchemy', '观中秘传：长生二字，从来都是借来的。'),
  st('sect_yn_zhengde', 1, '正德禅身篇', 'fan', 2, 'body', '正德寺入门：以身为容器，先要知道自己装得下什么。'),
  st('sect_yn_zhengde', 2, '请神入体经', 'xuan', 5, 'body', '力量是真的，代价也是 —— 这一经只教一次。'),
  st('sect_yn_zhengde', 3, '正德金身章', 'tian', 8, 'body', '请来的神走时，得把门关好。'),
  st('sect_yn_zuowang', 1, '坐忘吐纳篇', 'fan', 2, 'wuxing', '坐忘道入门：真假两条线同时走，先从一条走稳。'),
  st('sect_yn_zuowang', 2, '真假双行经', 'xuan', 5, 'wuxing', '走错一步，就分不清哪个是自己。'),
  st('sect_yn_zuowang', 3, '坐忘乱真章', 'tian', 9, 'wuxing', '此界最难的不是修成，是修成之后还认得自己。'),
  st('sect_yn_bailian', 1, '白莲净心诀', 'fan', 2, 'wuxing', '白莲教入门：教义朴素得可疑，信的人越多规矩越硬。'),
  st('sect_yn_bailian', 2, '白莲教义经', 'xuan', 5, 'wuxing', '一卷教义读了三十年，最后一页仍是空白。'),
  st('sect_yn_bailian', 3, '白莲开坛章', 'tian', 8, 'wuxing', '开坛那一日，来的人比想象中多得多。'),
  st('sect_yn_aojing', 1, '袄景祭符篇', 'fan', 2, 'an', '袄景教入门：十字寺下六位大长老，掌的不是经，是价钱。'),
  st('sect_yn_aojing', 2, '十字寺秘经', 'xuan', 5, 'an', '寺中最深的一间屋子，只在夜里开门。'),
  st('sect_yn_aojing', 3, '袄景改命章', 'tian', 9, 'an', '命是可以改的 —— 改一次，要还一笔。'),
  st('sect_yn_fajiao', 1, '法教压火诀', 'fan', 2, 'huo', '法教入门：把烧起来的心火，一寸寸压回去。'),
  st('sect_yn_fajiao', 2, '法教定火经', 'xuan', 5, 'huo', '走火不可怕，怕的是不知道自己走了火。'),
  st('sect_yn_fajiao', 3, '法教归元章', 'tian', 8, 'huo', '此界最稳的一门，也是最少人修到头的一门。'),
  st('sect_yn_minglun', 1, '明轮守规篇', 'fan', 3, 'body', '明轮堂入门：堂中人不讲善恶，只讲轮次。'),
  st('sect_yn_minglun', 2, '明轮轮次经', 'xuan', 5, 'body', '规矩只有一条：轮到你了，就得往下走。'),
  st('sect_yn_minglun', 3, '明轮转轮章', 'tian', 9, 'body', '转轮一脉的顶阶法：把自己也当成一转。'),
  st('sect_yn_jiantian', 1, '监天录象篇', 'fan', 2, 'alchemy', '监天司入门：测天象、录诡异，笔比符更管用。'),
  st('sect_yn_jiantian', 2, '监天观星经', 'xuan', 5, 'alchemy', '星象乱的那一夜，司里所有人都没睡。'),
  st('sect_yn_jiantian', 3, '监天定命章', 'tian', 8, 'alchemy', '此界最难得的不是修为，是「还认得自己」。'),

  // ══ 07 · 通天界 ═════════════════════════════════════════════════════════
  st('sect_tt_lingxi', 1, '灵溪吐纳法', 'fan', 1, 'wuxing', '灵溪宗入门：香云山下最平常的一本。'),
  st('sect_tt_lingxi', 2, '灵溪归元经', 'xuan', 4, 'wuxing', '溪水归元、气归丹田；灵溪的规矩是「先慢后快」。'),
  st('sect_tt_lingxi', 3, '灵溪长生章', 'tian', 8, 'wuxing', '祖师留下的话只有八个字：慢一点，走得远些。'),
  st('sect_tt_xuexi', 1, '血溪炼体篇', 'fan', 3, 'body', '血溪宗入门：以血炼体、以战养命，一步都省不得。'),
  st('sect_tt_xuexi', 2, '血溪淬体经', 'xuan', 5, 'body', '铁身、金身、金刚骨 —— 这一经里全有，只看熬不熬得住。'),
  st('sect_tt_xuexi', 3, '血溪不灭章', 'tian', 9, 'body', '断的若是别人，此法便算大成。'),
  st('sect_tt_nihe', 1, '逆河行气诀', 'fan', 2, 'shui', '逆河宗入门：逆水而行，走得慢，但走得远。'),
  st('sect_tt_nihe', 2, '逆河归流经', 'xuan', 5, 'shui', '百家之气合流归一：此经讲的是怎么不散。'),
  st('sect_tt_nihe', 3, '逆河倒流章', 'tian', 8, 'shui', '水能倒流的那一日，此界的天也翻了一遍。'),
  st('sect_tt_xuanxi', 1, '玄溪炼魂篇', 'fan', 2, 'wuxing', '玄溪宗入门：魂越炼越亮，也越炼越疼。'),
  st('sect_tt_xuanxi', 2, '玄溪守魂经', 'xuan', 5, 'wuxing', '炼魂试炼的通关法，就写在第一页。'),
  st('sect_tt_xuanxi', 3, '玄溪亮魂章', 'tian', 8, 'wuxing', '魂亮到极致时，连自己都看不进去。'),
  st('sect_tt_danxi', 1, '丹溪尝药篇', 'fan', 2, 'alchemy', '丹溪宗入门：先尝后炼，祖师留下的规矩。'),
  st('sect_tt_danxi', 2, '丹溪炼炉经', 'xuan', 5, 'alchemy', '一溪药香，丹炉终日不冷。'),
  st('sect_tt_danxi', 3, '丹溪百草章', 'tian', 8, 'alchemy', '百草入炉、炉火自明；此章只传掌炉人。'),
  st('sect_tt_han', 1, '寒宗御寒篇', 'fan', 3, 'bing', '寒宗入门：入门先学「怎么不冻着自己」。'),
  st('sect_tt_han', 2, '寒宗凝冰经', 'xuan', 5, 'bing', '身在极北，气机自寒；心要更冷一点。'),
  st('sect_tt_han', 3, '寒宗极北章', 'tian', 9, 'bing', '修到极致，呼出的气便是霜。'),
  st('sect_tt_yunlei', 1, '云雷引气篇', 'fan', 2, 'lei', '九天云雷宗入门：天上有云便是主场。'),
  st('sect_tt_yunlei', 2, '九天雷剑经', 'xuan', 5, 'lei', '引雷入剑，出剑带雷；此宗弟子最爱阴天。'),
  st('sect_tt_yunlei', 3, '云雷断天章', 'tian', 9, 'lei', '雷落之处天要裂一道缝 —— 此章从不轻用。'),
  st('sect_tt_daoji', 1, '道极点星诀', 'fan', 2, 'wuxing', '星空道极宗入门：以贡献点列袍色，赤袍是起点。'),
  st('sect_tt_daoji', 2, '星空道榜经', 'xuan', 5, 'wuxing', '榜上有名之后，修行就不再是一个人的事。'),
  st('sect_tt_daoji', 3, '道极归位章', 'tian', 9, 'wuxing', '坐上那个位子，才知道它有多冷。'),

  // ══ 08 · 天工界 ═════════════════════════════════════════════════════════
  st('sect_tg_bukong', 1, '不空结丝篇', 'fan', 1, 'wuxing', '不空门入门：一根丝、十根指头 —— 机关术的第一次结丝。'),
  st('sect_tg_bukong', 2, '不空机关经', 'xuan', 4, 'wuxing', '机关吐纳代己身吐纳：省力，也更费心。'),
  st('sect_tg_bukong', 3, '不空造物章', 'tian', 8, 'wuxing', '造得出会走路的东西，才算摸到造物的门。'),
  st('sect_tg_zixiao', 1, '紫霄引雷篇', 'fan', 2, 'lei', '紫霄阁入门：以机引雷，先学会怎么不炸着自己。'),
  st('sect_tg_zixiao', 2, '紫霄雷机经', 'xuan', 5, 'lei', '会走路的东西带着千斤火精，全靠这一经引路。'),
  st('sect_tg_zixiao', 3, '紫霄轰天章', 'tian', 9, 'lei', '轰天之雷只放一次，放完就得算清账。'),
  st('sect_tg_wanyao', 1, '万药植修篇', 'fan', 2, 'alchemy', '万药门入门：植修、丹士、医师三类同门共炉。'),
  st('sect_tg_wanyao', 2, '万药炉火经', 'xuan', 5, 'alchemy', '药性比人性好算得多 —— 门中人都这么讲。'),
  st('sect_tg_wanyao', 3, '万药成丹章', 'tian', 8, 'alchemy', '一炉成药，药香能飘过整条火柿仙城。'),
  st('sect_tg_taiqing', 1, '太清绘器诀', 'fan', 2, 'wuxing', '太清宫入门：先画得出，才造得出。'),
  st('sect_tg_taiqing', 2, '太清地火经', 'xuan', 5, 'huo', '地火之宫里的图纸，画的全是别人不敢造的东西。'),
  st('sect_tg_taiqing', 3, '太清无极章', 'tian', 9, 'wuxing', '无极者，无不可造，亦无不可拆。'),
  st('sect_tg_haoyue', 1, '皓月引华篇', 'fan', 2, 'wuxing', '皓月宗入门：以月华为料，以符为刃。'),
  st('sect_tg_haoyue', 2, '皓月传讯经', 'xuan', 5, 'wuxing', '钟响一声，万里共闻；从此消息比人快。'),
  st('sect_tg_haoyue', 3, '皓月万里章', 'tian', 8, 'wuxing', '月照之处皆可传讯 —— 此宗立宗之本。'),
  st('sect_tg_shihun', 1, '噬魂淬器篇', 'fan', 3, 'an', '噬魂宗入门：以魂淬器，先从最低的那一口炉开始。'),
  st('sect_tg_shihun', 2, '噬魂炼器经', 'xuan', 5, 'an', '器成之日，器里住的是谁就说不清了。'),
  st('sect_tg_shihun', 3, '噬魂器灵章', 'tian', 9, 'an', '魔道器修的顶阶法：器有灵，灵认主，主未必是人。'),
  st('sect_tg_ningjia', 1, '宁家匠火篇', 'fan', 2, 'alchemy', '宁家入门：主脉支脉共守一炉，火不分家。'),
  st('sect_tg_ningjia', 2, '宁家机关经', 'xuan', 5, 'alchemy', '以苍铁为骨、以机关为肉 —— 甲身就是这么炼的。'),
  st('sect_tg_ningjia', 3, '宁家传炉章', 'tian', 8, 'alchemy', '传炉之日，家老要在炉边站一整夜。'),
  st('sect_tg_heishi', 1, '黑市眼力篇', 'fan', 2, 'wuxing', '黑市入门：出货不问来路，但要认得出真假。'),
  st('sect_tg_heishi', 2, '黑市规矩经', 'xuan', 5, 'wuxing', '三教九流共用一个规矩，破了规矩的人从此不出现。'),
  st('sect_tg_heishi', 3, '黑市不问章', 'tian', 8, 'wuxing', '此界最像宗门的一门，恰恰是那个没有山门的。'),

  // ══ 09 · 六面囚笼 ═══════════════════════════════════════════════════════
  st('sect_lm_wendao', 1, '问道仿拳篇', 'fan', 1, 'body', '问道宗入门：照着前人拳法仿出来的一路，管用就行。'),
  st('sect_lm_wendao', 2, '问道不语经', 'xuan', 4, 'wuxing', '宗主不语道人从不讲法，弟子们只好自己读这一经。'),
  st('sect_lm_wendao', 3, '问道自问章', 'tian', 8, 'wuxing', '问到最后，问的都是自己。'),
  st('sect_lm_xuankong', 1, '悬空打坐篇', 'fan', 2, 'body', '悬空庙入门：庙悬在半空，弟子也少得悬。'),
  st('sect_lm_xuankong', 2, '悬空禅身经', 'xuan', 5, 'body', '坐得住的人，掉不下去。'),
  st('sect_lm_xuankong', 3, '悬空不坠章', 'tian', 8, 'body', '此庙立宗千年，只成过七人。'),
  st('sect_lm_yuegui', 1, '月桂采华篇', 'fan', 2, 'alchemy', '月桂仙宫入门：倚月亮修行，先学会抬头。'),
  st('sect_lm_yuegui', 2, '月桂炼丹经', 'xuan', 5, 'alchemy', '一颗扛牛丹下肚，力气的账先记着。'),
  st('sect_lm_yuegui', 3, '月桂广寒章', 'tian', 8, 'alchemy', '广寒二字，写的是丹药，也写的是这一宫。'),
  st('sect_lm_zhenyu', 1, '镇狱封印篇', 'fan', 2, 'wuxing', '镇狱宗入门：此界传承十有八九是假的，先学认真的那一分。'),
  st('sect_lm_zhenyu', 2, '镇狱锁魂经', 'xuan', 5, 'wuxing', '锁得住魑魅魍魉，锁不锁得住自己两说。'),
  st('sect_lm_zhenyu', 3, '镇狱千锁章', 'tian', 9, 'wuxing', '狱门一开，此宗弟子从不多问一句。'),
  st('sect_lm_wuxing', 1, '五行归一诀', 'fan', 2, 'wuxing', '五行宗入门：五家的法门各取一分。'),
  st('sect_lm_wuxing', 2, '五行合流经', 'xuan', 5, 'wuxing', '五行归一，便是五家都不认你。'),
  st('sect_lm_wuxing', 3, '五行大衍章', 'tian', 8, 'wuxing', '五归一、一归五：此章只有一句话。'),
  st('sect_lm_tiance', 1, '天策卜算篇', 'fan', 2, 'wuxing', '天策宗入门：算得出吉凶，算不出要不要开那一盒。'),
  st('sect_lm_tiance', 2, '天策因果经', 'xuan', 5, 'wuxing', '占卜一脉的本经：算得越准，越不敢算自己。'),
  st('sect_lm_tiance', 3, '天策断机章', 'tian', 9, 'wuxing', '断得了一线天机，断不了「万一」。'),
  st('sect_lm_jiuyou', 1, '九幽炼体篇', 'fan', 3, 'an', '九幽教入门：入教第一课是怎么把话说圆。'),
  st('sect_lm_jiuyou', 2, '九幽惑心经', 'xuan', 5, 'an', '说得越像真的，自己就越要信一半。'),
  st('sect_lm_jiuyou', 3, '九幽惑众章', 'tian', 8, 'an', '魔道教派的看家本事：让听的人自己往前走。'),
  st('sect_lm_buxiu', 1, '不朽编天篇', 'fan', 2, 'wuxing', '不朽教入门：教义是「天庭是我编的」—— 编得很像。'),
  st('sect_lm_buxiu', 2, '不朽造势经', 'xuan', 5, 'wuxing', '声势也是修行：信的人多了，气自然就厚。'),
  st('sect_lm_buxiu', 3, '不朽立教章', 'tian', 9, 'wuxing', '此教最新，也最像真的。'),

  // ══ 10 · 九鼎九州 ═══════════════════════════════════════════════════════
  st('sect_jd_dao', 1, '道宗启蒙诀', 'fan', 1, 'wuxing', '道宗入门：州县里最普通的一本启蒙功法，谁家孩子都翻过。'),
  st('sect_jd_dao', 2, '道宗循序经', 'xuan', 4, 'wuxing', '不取巧、不走偏，一步一个脚印 —— 此经只讲这一句。'),
  st('sect_jd_dao', 3, '道宗大成章', 'tian', 8, 'wuxing', '大成之日，榜上那一笔是该划的。'),
  st('sect_jd_luban', 1, '鲁班造物篇', 'fan', 2, 'alchemy', '鲁班宗入门：先造一个不会坏的，再造一个会坏的。'),
  st('sect_jd_luban', 2, '鲁班机关经', 'xuan', 5, 'alchemy', '机关与炼丹的革新一脉，图纸从来不怕被人看。'),
  st('sect_jd_luban', 3, '鲁班开物章', 'tian', 8, 'alchemy', '开物一脉的顶阶法：造得出，也修得好。'),
  st('sect_jd_lingyao', 1, '灵药培植篇', 'fan', 2, 'alchemy', '灵药宗入门：药圃连着药圃，功德也从这里起。'),
  st('sect_jd_lingyao', 2, '灵药丹经', 'xuan', 5, 'alchemy', '此宗的丹经上不写药方，只写年份。'),
  st('sect_jd_lingyao', 3, '灵药济世章', 'tian', 8, 'alchemy', '功德金榜上这一门常年排在前列。'),
  st('sect_jd_yushou', 1, '御兽同心篇', 'fan', 3, 'body', '御兽宗入门：此界的灵兽比人还认规矩。'),
  st('sect_jd_yushou', 2, '御兽合体经', 'xuan', 5, 'body', '人兽同息：它的力气走你的经脉。'),
  st('sect_jd_yushou', 3, '御兽万灵章', 'tian', 9, 'body', '万灵俯首的那一日，此宗弟子只是坐着。'),
  st('sect_jd_lingzhi', 1, '灵植催芽篇', 'fan', 2, 'wuxing', '灵植宗入门：种的是气运，收的是一整季。'),
  st('sect_jd_lingzhi', 2, '灵植气运经', 'xuan', 5, 'wuxing', '仙梯残片上还留着半句口诀，就在这一经开头。'),
  st('sect_jd_lingzhi', 3, '灵植丰年章', 'tian', 8, 'wuxing', '丰年一至，九州的灵气都要厚上一分。'),
  st('sect_jd_wulei', 1, '五雷引气篇', 'fan', 2, 'lei', '五雷正法宗入门：雷法正统，先学会挨自己一击。'),
  st('sect_jd_wulei', 2, '五雷正法经', 'xuan', 5, 'lei', '五位统领的战诀合为一册，讲的是怎么带人。'),
  st('sect_jd_wulei', 3, '五雷诛邪章', 'tian', 9, 'lei', '诛邪之雷只落一次：落错了，也认。'),
  st('sect_jd_jiange', 1, '剑阁藏锋篇', 'fan', 2, 'sword', '剑阁入门：人皇殿里那一册，翻过的人不多。'),
  st('sect_jd_jiange', 2, '剑阁问剑经', 'xuan', 5, 'sword', '阁中比剑不比胜负，只比谁的剑问得更深。'),
  st('sect_jd_jiange', 3, '剑阁镇岳章', 'tian', 9, 'sword', '九州的剑都归此处，此处的剑不归任何人。'),
  st('sect_jd_tiansha', 1, '天杀潜行篇', 'fan', 2, 'wuxing', '天杀阁入门：阁中只记两件事 —— 谁出的价、谁还活着。'),
  st('sect_jd_tiansha', 2, '天杀定价经', 'xuan', 5, 'wuxing', '定价的不是人，是这一经里的规矩。'),
  st('sect_jd_tiansha', 3, '天杀收官章', 'tian', 8, 'wuxing', '收官之后，阁里连名字都不会留。'),

  // ══ 11 · 无缺古界 ═══════════════════════════════════════════════════════
  st('sect_wy_fushan', 1, '负山负重诀', 'fan', 1, 'wuxing', '负山宗入门：走的每一步都算数 —— 慢就是快。'),
  st('sect_wy_fushan', 2, '负山行远经', 'xuan', 4, 'wuxing', '背一座山走一万里，中途不能卸。'),
  st('sect_wy_fushan', 3, '负山不坠章', 'tian', 8, 'wuxing', '曾居四大之首而后没落，靠的就是这一章。'),
  st('sect_wy_ziyun', 1, '紫运采药篇', 'fan', 2, 'alchemy', '紫运宗入门：南域丹拍的规矩，先从采药学起。'),
  st('sect_wy_ziyun', 2, '紫运丹拍经', 'xuan', 5, 'alchemy', '丹拍之上，价高者得；价低者得道一声「下次」。'),
  st('sect_wy_ziyun', 3, '紫运龙吟章', 'tian', 8, 'alchemy', '以荒龙之血炼丹，丹成有龙吟。'),
  st('sect_wy_xiaoyao', 1, '逍遥行气篇', 'fan', 2, 'wuxing', '逍遥宗入门：不争第一也不落最后。'),
  st('sect_wy_xiaoyao', 2, '逍遥古玉经', 'xuan', 5, 'wuxing', '古玉镇荒：一玉压一域。'),
  st('sect_wy_xiaoyao', 3, '逍遥镇荒章', 'tian', 8, 'wuxing', '镇荒一脉的顶阶法：镇的是荒，也是心。'),
  st('sect_wy_fengyao', 1, '封妖入门篇', 'fan', 2, 'wuxing', '封妖一脉入门：封正术与妖封禁法，先学第一道。'),
  st('sect_wy_fengyao', 2, '封正术经', 'xuan', 5, 'wuxing', '一术封正：封的意思是让该在哪儿的东西待在哪儿。'),
  st('sect_wy_fengyao', 3, '九道封禁章', 'tian', 9, 'wuxing', '九道封禁一道一道开 —— 开到最后，才知道封的是什么。'),
  st('sect_wy_wang', 1, '王氏护道篇', 'fan', 3, 'body', '王氏入门：有祖地与护道者的古族，族规比山高。'),
  st('sect_wy_wang', 2, '王氏序列经', 'xuan', 5, 'body', '族中序列印记代代相传，你的那一笔在第几行，早定好了。'),
  st('sect_wy_wang', 3, '王氏祖地章', 'tian', 9, 'body', '祖地一开，全族的战意一齐压下来。'),
  st('sect_wy_fang', 1, '方氏子弟篇', 'fan', 2, 'sword', '方氏入门：出师前要在祖地过一夜 —— 独自一人。'),
  st('sect_wy_fang', 2, '方氏过夜经', 'xuan', 5, 'sword', '那一夜之后，剑就是自己的了。'),
  st('sect_wy_fang', 3, '方氏剑族章', 'tian', 8, 'sword', '南域剑族的立族之本：一剑不出，出了就不留余地。'),
  st('sect_wy_meng', 1, '孟氏本命篇', 'fan', 2, 'alchemy', '孟氏入门：炉在身中、火在命里。'),
  st('sect_wy_meng', 2, '孟氏丹炉经', 'xuan', 5, 'alchemy', '以本命丹炉立族：炉毁则人亡，炉全则族兴。'),
  st('sect_wy_meng', 3, '孟氏命火章', 'tian', 8, 'alchemy', '命火一旺，满族皆暖。'),
  st('sect_wy_jiuhai', 1, '九海观山诀', 'fan', 2, 'wuxing', '九海神界入门：观山不是看山，是看山的气。'),
  st('sect_wy_jiuhai', 2, '九海点化经', 'xuan', 5, 'wuxing', '给一方无名之地起个名字，山气随名而聚。'),
  st('sect_wy_jiuhai', 3, '九海共主章', 'tian', 9, 'wuxing', '界主降临则山海共主 —— 此章只等那个人。'),

  // ══ 12 · 人间香火 ═══════════════════════════════════════════════════════
  st('sect_xh_fulong', 1, '伏龙吐纳篇', 'fan', 1, 'wuxing', '伏龙观入门：晨钟一响，青芜山上的第一页就翻开了。'),
  st('sect_xh_fulong', 2, '伏龙晨钟经', 'xuan', 4, 'wuxing', '一声钟一层气：观中弟子听钟不数数，数的是自己的呼吸。'),
  st('sect_xh_fulong', 3, '伏龙镇观章', 'tian', 8, 'wuxing', '受天道眷顾的一观，压箱底的一章从不轻出。'),
  st('sect_xh_fengtian', 1, '奉天卜算篇', 'fan', 2, 'wuxing', '奉天观入门：算得出雨什么时候来，算不出该不该拦。'),
  st('sect_xh_fengtian', 2, '奉天推演经', 'xuan', 5, 'wuxing', '推演一脉的本经：推得越远，越不敢改动一点。'),
  st('sect_xh_fengtian', 3, '奉天知机章', 'tian', 8, 'wuxing', '知机者不卜：此章只有两页，第二页是空的。'),
  st('sect_xh_fuyun', 1, '浮云画符篇', 'fan', 2, 'wuxing', '浮云观入门：画符先画心 —— 心不定，符就不灵。'),
  st('sect_xh_fuyun', 2, '浮云纸马经', 'xuan', 5, 'wuxing', '剪一匹纸马，烧了就能跑一夜 —— 只是跑不远。'),
  st('sect_xh_fuyun', 3, '浮云神行章', 'tian', 8, 'wuxing', '符走万里，人还在观里喝茶。'),
  st('sect_xh_tianhai', 1, '天海禅定篇', 'fan', 2, 'body', '天海寺入门：与道观同山不同院，香火各烧各的。'),
  st('sect_xh_tianhai', 2, '天海祈雨经', 'xuan', 5, 'shui', '城里人求你降雨，城隍求你别乱降。'),
  st('sect_xh_tianhai', 3, '天海慈悲章', 'tian', 8, 'body', '雨落下来是同一场 —— 此章讲的是这件事。'),
  st('sect_xh_taian', 1, '泰安雷法篇', 'fan', 2, 'lei', '泰安寺入门：召得来，也要送得走。'),
  st('sect_xh_taian', 2, '泰安收手经', 'xuan', 5, 'lei', '寺中僧人多半学过怎么收手 —— 这一经就是那门课。'),
  st('sect_xh_taian', 3, '泰安镇寺章', 'tian', 8, 'lei', '雷法是护寺的，不是扬名的：寺中祖训第一条。'),
  st('sect_xh_jinglei', 1, '惊雷起手篇', 'fan', 2, 'sword', '惊雷剑派入门：江湖门派中最像样的一支。'),
  st('sect_xh_jinglei', 2, '惊雷民心经', 'xuan', 5, 'sword', '民心所向，气运随之 —— 此经讲的是怎么不辜负。'),
  st('sect_xh_jinglei', 3, '惊雷剑派章', 'tian', 8, 'sword', '一派出剑，满城闻雷。'),
  st('sect_xh_jindao', 1, '金刀劈门篇', 'fan', 3, 'body', '金刀门入门：一刀破门，从此门不必再修。'),
  st('sect_xh_jindao', 2, '金刀铸身经', 'xuan', 5, 'body', '金身由民心铸：一炷香一炷香地凝。'),
  st('sect_xh_jindao', 3, '金刀立门章', 'tian', 9, 'body', '门中弟子从不拜神：他们拜的是自己的刀。'),
  st('sect_xh_xishan', 1, '西山散修篇', 'fan', 2, 'alchemy', '西山派入门：散修一脉，二十年走完，一张一张把符箓交出去。'),
  st('sect_xh_xishan', 2, '西山符箓经', 'xuan', 5, 'alchemy', '鬼市里的规矩比人间还多，这一经记了七成。'),
  st('sect_xh_xishan', 3, '西山交符章', 'tian', 8, 'alchemy', '交符之日不留名 —— 此派千年家风。')
]

// 说明（批 G3）：本表含 12 界 × 8 宗 × 3 ＝ 288 条宗门功法。

/**
 * V6.12 批 G4：取某宗的宗门功法（3 本）。
 * ⚠ 精确到 `_数字` 结尾 —— `sect_wz_qingchi` 与 `sect_wz_qingchi_mo` 前缀互相包含，
 *   用 `startsWith` 会把「青迟魔门」的功法算进「青池宗」。
 */
export function sectTechsOf (sectId) {
  const p = `tech_${String(sectId || '').replace(/^sect_/, '')}_`
  const re = new RegExp(`^${p}\\d+$`)
  return SECT_TECHS.filter((t) => re.test(t.id))
}

export default { SECT_TECHS, SECT_TECH_LEVELS }
