/**
 * achievements.js —— 成就与纪事表（只读配置层）（2.10）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《挂机修仙·世界纪事与成就系统 v1》第一部分（纪事）与第二部分（成就）
 *       +《问长生-开发计划 V2》§四 模块 2.10（约 90 成就 + 三频道纪事 + 称号展示）
 *
 * 边界：纯配置 + 纯函数（getAchievement / shichenOf）。禁止 import systems / Phaser / DOM。
 *
 * 成就口径（设计第二部分）：
 *   · 规模 90 个：境界 18 ｜秘境 15 ｜宗门 12 ｜灵兽 10 ｜事件与因果 12 ｜探索收集 13 ｜隐藏 10
 *   · 成就点 5~50 点/个；五档阶梯（凡/灵/玄/王/皇）按**累计成就点**发放称号 + 外观碎片 + 少量材料
 *   · 硬护栏：不发境界直通型奖励；称号纯展示（不影响任何数值），同时只可佩戴 1 个
 *   · 判定：metric 达到 need 即解锁（>=）；metric 由装配层 main.js 现算快照传入（跨模块只走装配层）
 *   · 隐藏成就：未解锁时名字显示「???」、只给 hint 暗示（设计："由社区自然求解"）
 *
 * 纪事口径（设计第一部分）：
 *   · 三频道 +「你」频道：本界 / 宗门 / 天下 / 你（玩家里程碑）
 *   · 条目＝时间戳（时辰）｜主体｜事件｜一句点评（note）
 *   · 频率：定时汇总一批（batchMs）；重点事件（成就里程碑）即时插入
 *   · 文案用占位符 {name} {name2} {place} {place2} {beast} {realm} {title} {you} {n}，由系统层取词池填充
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 成就分类（顺序即成就墙展示顺序） */
export const ACHV_CATS = [
  { id: 'realm', name: '境界' },
  { id: 'dungeon', name: '秘境' },
  { id: 'sect', name: '宗门' },
  { id: 'beast', name: '灵兽' },
  { id: 'event', name: '事件与因果' },
  { id: 'collect', name: '探索收集' },
  { id: 'hidden', name: '隐藏' }
]

/** 未佩戴称号时的占位（与 SaveSystem 默认道号同源） */
export const ACHV_NO_TITLE = ''

/**
 * 五档阶梯（按累计成就点；设计"每档发放称号＋外观碎片＋少量材料"）
 * 阈值口径：全成就满点 ≈2150，皇档 1300 ≈ 六成内容量（长期线，不逼白嫖）
 */
export const ACHV_TIERS = [
  { idx: 0, id: 'fan', name: '凡', need: 0, title: '初入道途', shards: 0, mats: [] },
  { idx: 1, id: 'ling', name: '灵', need: 150, title: '灵心初启', shards: 2, mats: [{ id: 'mat_lingcao', n: 3 }] },
  { idx: 2, id: 'xuan', name: '玄', need: 400, title: '玄机客', shards: 4, mats: [{ id: 'mat_kuang', n: 3 }] },
  { idx: 3, id: 'wang', name: '王', need: 800, title: '一方尊', shards: 6, mats: [{ id: 'mat_yaodan', n: 3 }] },
  { idx: 4, id: 'huang', name: '皇', need: 1300, title: '皇者无名', shards: 10, mats: [{ id: 'mat_yaodan', n: 5 }, { id: 'mat_kuang', n: 5 }] }
]

/**
 * 成就表（90 条）
 * 字段：id ｜ cat ｜ name ｜ desc ｜ points ｜ metric ｜ need
 *       title?（解锁即得称号）｜ reward?（{stones} / {items}）｜ chronicle?（解锁时插入「你」频道的纪事文案）
 *       hint?（隐藏成就未解锁时展示的暗示）
 */
export const ACHIEVEMENTS = [
  // ── 境界（18）─────────────────────────────────────────────────────────
  { id: 'achv_yinqi', cat: 'realm', name: '引气入体', desc: '第一次把灵气吸进体内。', points: 5, metric: 'level', need: 2 },
  { id: 'achv_qiyuan', cat: 'realm', name: '气感圆满', desc: '炼气九重，周天自转。', points: 10, metric: 'level', need: 9, chronicle: '你把最后一缕灵气收回丹田——从今往后，你不再是个凡人。' },
  { id: 'achv_daoji', cat: 'realm', name: '道基初筑', desc: '晋入筑基，道基落定。', points: 15, metric: 'realmIndex', need: 1, chronicle: '你筑就道基，第一次在青岚界的修士名册上有了自己的位置。' },
  { id: 'achv_jindan', cat: 'realm', name: '金丹既凝', desc: '晋入金丹，丹火初燃。', points: 20, metric: 'realmIndex', need: 2, chronicle: '你丹田内那一丸金丹落定，云岚宗的执事亲自登门道贺。' },
  { id: 'achv_yuanying', cat: 'realm', name: '婴神初成', desc: '晋入元婴，婴神凝练。', points: 25, metric: 'realmIndex', need: 3, chronicle: '你破丹化婴，当夜青岚界落了一场不合时令的春雨。' },
  { id: 'achv_huashen', cat: 'realm', name: '神游太虚', desc: '晋入化神，神念外放。', points: 30, metric: 'realmIndex', need: 4, chronicle: '你的神念第一次离体百里，回来时顺手记住了三座城的名字。' },
  { id: 'achv_lianxu', cat: 'realm', name: '熔炼虚空', desc: '晋入炼虚，虚实相生。', points: 35, metric: 'realmIndex', need: 5 },
  { id: 'achv_heti', cat: 'realm', name: '天人交感', desc: '晋入合体，法则入体。', points: 40, metric: 'realmIndex', need: 6 },
  { id: 'achv_dacheng', cat: 'realm', name: '道法大成', desc: '晋入大乘，气运加身。', points: 45, metric: 'realmIndex', need: 7 },
  { id: 'achv_feisheng', cat: 'realm', name: '羽化登仙', desc: '渡过飞升劫，仙门在云上。', points: 50, metric: 'ascended', need: 1, title: '真仙', chronicle: '你渡尽八道天关，仙门在云上为你开了一线——青岚界的纪事从此多了一页。' },
  { id: 'achv_pojing10', cat: 'realm', name: '十次破境', desc: '累计突破 10 次。', points: 10, metric: 'breakthroughs', need: 10 },
  { id: 'achv_pojing50', cat: 'realm', name: '五十次破境', desc: '累计突破 50 次。', points: 25, metric: 'breakthroughs', need: 50 },
  { id: 'achv_pojingren', cat: 'realm', name: '破境之人', desc: '完成首次渡劫（设计表：点 20＋称号「破境」）。', points: 20, metric: 'trialPasses', need: 1, title: '破境', chronicle: '你第一次在天雷底下站住了——雷声散时，你听见自己心跳如鼓。' },
  { id: 'achv_leixia10', cat: 'realm', name: '雷下十连', desc: '渡劫 10 次不败（设计表：点 50＋外观碎片）。', points: 50, metric: 'trialStreak', need: 10, reward: { items: [{ id: 'frag_waiguan', n: 3 }] }, chronicle: '十道天关、十次不败——有人在纪事里写下：「此人已不可用常理度之。」' },
  { id: 'achv_baierbunai', cat: 'realm', name: '败而不馁', desc: '渡劫失败 5 次仍然在修。', points: 15, metric: 'trialFails', need: 5 },
  { id: 'achv_jingyang', cat: 'realm', name: '静养之道', desc: '花灵石静养疗伤一次。', points: 10, metric: 'cures', need: 1 },
  { id: 'achv_shoubi', cat: 'realm', name: '寿比南山', desc: '余寿达到 500 年。', points: 15, metric: 'lifespanRemain', need: 500 },
  { id: 'achv_tuna', cat: 'realm', name: '吐纳如潮', desc: '有效产出达到 100 灵气/秒。', points: 15, metric: 'qiRate', need: 100 },

  // ── 秘境（15）─────────────────────────────────────────────────────────
  { id: 'achv_chudeng', cat: 'dungeon', name: '初登塔', desc: '试炼塔通过第 1 层。', points: 5, metric: 'towerFloor', need: 1 },
  { id: 'achv_tashi', cat: 'dungeon', name: '塔上十层', desc: '试炼塔通过第 10 层。', points: 10, metric: 'towerFloor', need: 10 },
  { id: 'achv_tashang25', cat: 'dungeon', name: '塔上二十五', desc: '试炼塔通过第 25 层。', points: 20, metric: 'towerFloor', need: 25 },
  { id: 'achv_tashang40', cat: 'dungeon', name: '塔上四十', desc: '试炼塔通过第 40 层。', points: 30, metric: 'towerFloor', need: 40 },
  { id: 'achv_tashang50', cat: 'dungeon', name: '塔上五十', desc: '试炼塔 50 层（设计表：点 40＋材料）。', points: 40, metric: 'towerFloor', need: 50, reward: { items: [{ id: 'mat_yaodan', n: 3 }] }, chronicle: '你首次踏足试炼塔第 50 层——塔灵低语了一句："来人，你慢了。"' },
  { id: 'achv_tading', cat: 'dungeon', name: '登临绝顶', desc: '试炼塔通关第 60 层。', points: 50, metric: 'towerFloor', need: 60, title: '塔顶客', chronicle: '试炼塔尽头的门为你开了一条缝——塔灵这一次没说话。' },
  { id: 'achv_chutan', cat: 'dungeon', name: '初探秘境', desc: '通过 1 处资源秘境。', points: 10, metric: 'resCleared', need: 1 },
  { id: 'achv_sanjing', cat: 'dungeon', name: '三境皆通', desc: '通过 3 处资源秘境。', points: 20, metric: 'resCleared', need: 3 },
  { id: 'achv_mijingjin', cat: 'dungeon', name: '秘境尽览', desc: '通过全部 4 处资源秘境。', points: 30, metric: 'resCleared', need: 4 },
  { id: 'achv_shenjue', cat: 'dungeon', name: '深掘者', desc: '资源秘境累计 8 星。', points: 20, metric: 'resStars', need: 8 },
  { id: 'achv_xingman', cat: 'dungeon', name: '星满四境', desc: '资源秘境累计 12 星。', points: 25, metric: 'resStars', need: 12 },
  { id: 'achv_fenshen1', cat: 'dungeon', name: '分身初遣', desc: '解锁第 1 个分身派遣槽。', points: 10, metric: 'dispatchSlots', need: 1 },
  { id: 'achv_fenshen3', cat: 'dungeon', name: '三身并用', desc: '解锁 3 个分身派遣槽。', points: 20, metric: 'dispatchSlots', need: 3 },
  { id: 'achv_fenshen5', cat: 'dungeon', name: '五身同遣', desc: '解锁 5 个分身派遣槽（满）。', points: 30, metric: 'dispatchSlots', need: 5 },
  { id: 'achv_mijingchangzhu', cat: 'dungeon', name: '秘境常驻', desc: '同时在派 3 支分身。', points: 15, metric: 'dispatchRunning', need: 3 },

  // ── 宗门（12）─────────────────────────────────────────────────────────
  { id: 'achv_yunlan', cat: 'sect', name: '云岚弟子', desc: '拜入云岚宗。', points: 10, metric: 'joined', need: 1, chronicle: '你在云岚宗的山门前递了名帖——从此有处可回，也有人等你交差。' },
  { id: 'achv_jichen', cat: 'sect', name: '积羽沉舟', desc: '累计贡献 1000。', points: 15, metric: 'totalContrib', need: 1000 },
  { id: 'achv_qinmian', cat: 'sect', name: '门中勤勉', desc: '累计贡献 3000。', points: 20, metric: 'totalContrib', need: 3000 },
  { id: 'achv_gonggai', cat: 'sect', name: '功盖内外', desc: '累计贡献 10000。', points: 30, metric: 'totalContrib', need: 10000 },
  { id: 'achv_zhushi', cat: 'sect', name: '门中柱石', desc: '累计贡献 30000。', points: 40, metric: 'totalContrib', need: 30000 },
  { id: 'achv_neimen', cat: 'sect', name: '内门弟子', desc: '职级晋至内门。', points: 10, metric: 'sectRank', need: 1 },
  { id: 'achv_zhenchuan', cat: 'sect', name: '真传弟子', desc: '职级晋至真传。', points: 20, metric: 'sectRank', need: 2 },
  { id: 'achv_zhishi', cat: 'sect', name: '执事长老', desc: '职级晋至执事长老。', points: 30, metric: 'sectRank', need: 3 },
  { id: 'achv_shouzuo', cat: 'sect', name: '首座', desc: '职级晋至首座。', points: 40, metric: 'sectRank', need: 4 },
  { id: 'achv_zhangmen', cat: 'sect', name: '掌门', desc: '职级晋至掌门（六档之顶）。', points: 50, metric: 'sectRank', need: 5, title: '掌门', chronicle: '你把掌门印接在手里——云岚宗上下都在看你会把它带去哪里。' },
  { id: 'achv_tongmen', cat: 'sect', name: '同门之谊', desc: '向宗门请过一次结阵护法。', points: 15, metric: 'sectAid', need: 1 },
  { id: 'achv_jigu', cat: 'sect', name: '积谷防饥', desc: '手上攒着 500 贡献未花。', points: 15, metric: 'contrib', need: 500 },

  // ── 灵兽（10）─────────────────────────────────────────────────────────
  { id: 'achv_xundan', cat: 'beast', name: '寻蛋者', desc: '派灵鹰去万兽林寻过一次蛋。', points: 10, metric: 'beastDispatched', need: 1 },
  { id: 'achv_chufu', cat: 'beast', name: '初孵成兽', desc: '孵出第一只灵兽。', points: 15, metric: 'pets', need: 1, chronicle: '蛋壳裂开的那声脆响，你后来在很多年里都还记得。' },
  { id: 'achv_sanshou', cat: 'beast', name: '三兽同栏', desc: '灵兽园中有 3 只灵兽。', points: 20, metric: 'pets', need: 3 },
  { id: 'achv_manyuan', cat: 'beast', name: '灵兽满园', desc: '灵兽园 6 格尽满。', points: 30, metric: 'pets', need: 6 },
  { id: 'achv_wangpin', cat: 'beast', name: '王品在握', desc: '孵出 1 只王品灵兽。', points: 25, metric: 'petsWang', need: 1 },
  { id: 'achv_baishou', cat: 'beast', name: '百兽之主', desc: '拥有 2 只王品及以上灵兽（设计表：点 50）。', points: 40, metric: 'petsWang', need: 2, title: '御兽' },
  { id: 'achv_huangpin', cat: 'beast', name: '皇品降世', desc: '孵出 1 只皇品灵兽。', points: 30, metric: 'petsHuang', need: 1 },
  { id: 'achv_xunyang', cat: 'beast', name: '驯养有道', desc: '有灵兽养到 5 级。', points: 20, metric: 'petMaxLevel', need: 5 },
  { id: 'achv_jiujie', cat: 'beast', name: '灵兽九阶', desc: '有灵兽养到 9 级（满）。', points: 35, metric: 'petMaxLevel', need: 9 },
  { id: 'achv_chusui', cat: 'beast', name: '随行护法', desc: '有灵兽正在出战。', points: 10, metric: 'petActive', need: 1 },

  // ── 事件与因果（12）───────────────────────────────────────────────────
  { id: 'achv_chuyu', cat: 'event', name: '初遇机缘', desc: '遇上第一起随机事件。', points: 5, metric: 'events', need: 1 },
  { id: 'achv_jianwen', cat: 'event', name: '见闻渐广', desc: '累计遇上 30 起事件。', points: 20, metric: 'events', need: 30 },
  { id: 'achv_yuejin', cat: 'event', name: '阅尽千帆', desc: '累计遇上 100 起事件（设计表：点 50）。', points: 50, metric: 'events', need: 100 },
  { id: 'achv_jiren', cat: 'event', name: '吉人天相', desc: '近事录里攒下 20 条不吃亏的抉择。', points: 20, metric: 'goodEvents', need: 20 },
  { id: 'achv_huobudan', cat: 'event', name: '祸不单行', desc: '近事录里攒下 20 条吃了亏的抉择。', points: 20, metric: 'badEvents', need: 20 },
  { id: 'achv_qinduan', cat: 'event', name: '亲断乾坤', desc: '亲手决断 5 起绝/仙级事件。', points: 15, metric: 'pendResolve', need: 5 },
  { id: 'achv_yuanqi', cat: 'event', name: '缘起缘灭', desc: '结下 10 条因果（设计表：点 40）。', points: 40, metric: 'causes', need: 10 },
  { id: 'achv_yinguo30', cat: 'event', name: '因果满箧', desc: '结下 20 条因果。', points: 30, metric: 'causes', need: 20 },
  { id: 'achv_yinuo', cat: 'event', name: '一诺千金', desc: '宿缘挂账兑现 5 次。', points: 35, metric: 'repays', need: 5 },
  { id: 'achv_qiyun80', cat: 'event', name: '气运冲天', desc: '气运达到 80。', points: 20, metric: 'luck', need: 80 },
  { id: 'achv_tianming', cat: 'event', name: '天命所钟', desc: '气运达到 95。', points: 30, metric: 'luck', need: 95 },
  { id: 'achv_jinshiying', cat: 'event', name: '近事盈册', desc: '近事录攒满 40 条。', points: 20, metric: 'book', need: 40 },

  // ── 探索收集（13）─────────────────────────────────────────────────────
  { id: 'achv_qianjin', cat: 'collect', name: '千金在手', desc: '持有灵石 1 万。', points: 15, metric: 'stones', need: 10000 },
  { id: 'achv_fujia', cat: 'collect', name: '富甲一方', desc: '持有灵石 100 万。', points: 30, metric: 'stones', need: 1000000 },
  { id: 'achv_lingcao50', cat: 'collect', name: '灵草盈筐', desc: '持有灵草 50 份。', points: 10, metric: 'matLingcao', need: 50 },
  { id: 'achv_kuang50', cat: 'collect', name: '玄铁满室', desc: '持有玄铁矿 50 份。', points: 10, metric: 'matKuang', need: 50 },
  { id: 'achv_yaodan20', cat: 'collect', name: '妖丹成串', desc: '持有妖丹 20 枚。', points: 15, metric: 'matYaodan', need: 20 },
  { id: 'achv_nangzhong', cat: 'collect', name: '囊中百物', desc: '行囊物品合计 100 件。', points: 20, metric: 'itemsTotal', need: 100 },
  { id: 'achv_gongfa3', cat: 'collect', name: '功法三卷', desc: '习得 3 部功法。', points: 10, metric: 'techOwned', need: 3 },
  { id: 'achv_xuefu', cat: 'collect', name: '学富五车', desc: '习得 8 部功法。', points: 25, metric: 'techOwned', need: 8 },
  { id: 'achv_gongfa9', cat: 'collect', name: '功法圆满', desc: '有部功法升到 9 级。', points: 30, metric: 'techMaxLevel', need: 9 },
  { id: 'achv_dancheng10', cat: 'collect', name: '丹成十炉', desc: '炼丹成功 10 次。', points: 15, metric: 'brews', need: 10 },
  { id: 'achv_dandao', cat: 'collect', name: '丹道小成', desc: '炼丹成功 50 次。', points: 30, metric: 'brews', need: 50 },
  { id: 'achv_fabao', cat: 'collect', name: '法宝在握', desc: '持有镇雷法宝。', points: 20, metric: 'zhenlei', need: 1 },
  { id: 'achv_hujie5', cat: 'collect', name: '护劫在囊', desc: '持有护劫丹 5 枚。', points: 15, metric: 'pillHujie', need: 5 },

  // ── 隐藏（10）：未解锁只给 hint，不剧透条件 ────────────────────────────
  { id: 'achv_wuming', cat: 'hidden', name: '无名之辈', desc: '在别人的纪事里被提起过三次。', points: 30, metric: 'chronicleMentions', need: 3, title: '无名', hint: '名字从纪事的纸缝里漏出去三次——修士之间，最值钱的从来不是灵石。' },
  { id: 'achv_yeban', cat: 'hidden', name: '夜半无人', desc: '子时还在打坐。', points: 20, metric: 'nightSessions', need: 1, hint: '万籁俱寂的那一两个时辰里，灵气最听话。' },
  { id: 'achv_changye', cat: 'hidden', name: '长夜闭关', desc: '一次闭关离开八小时以上。', points: 20, metric: 'longOffline', need: 1, hint: '走的人不必招呼，回来的人自有说法。' },
  { id: 'achv_baieryong', cat: 'hidden', name: '败而后勇', desc: '渡劫失手之后，下一次便过了。', points: 25, metric: 'failThenPass', need: 1, hint: '雷劈下来的第二回，你比第一回更知道它往哪儿落。' },
  { id: 'achv_qianfan', cat: 'hidden', name: '千帆过尽', desc: '纪事攒够 100 条。', points: 25, metric: 'chronicleCount', need: 100, hint: '看得久了，天下事都像旧闻。' },
  { id: 'achv_bowen', cat: 'hidden', name: '博闻强记', desc: '解锁 30 个成就。', points: 30, metric: 'unlockedCount', need: 30, hint: '成就墙上亮起的格子，也是一种道行。' },
  { id: 'achv_mingdong', cat: 'hidden', name: '名动一方', desc: '身上攒着 5 个称号。', points: 20, metric: 'titlesOwned', need: 5, hint: '称号不涨一丝战力，但旁人会先报你的名。' },
  { id: 'achv_changming', cat: 'hidden', name: '长明不熄', desc: '累计在线修行 24 小时。', points: 30, metric: 'playtimeSec', need: 86400, hint: '灯芯烧得久了，连影子都认得你。' },
  { id: 'achv_fuweng', cat: 'hidden', name: '富埒王侯', desc: '持有灵石 500 万。', points: 35, metric: 'stones', need: 5000000, hint: '灵石多到一定程度，就只是个数字了。' },
  { id: 'achv_shiquan', cat: 'hidden', name: '十全', desc: '解锁 60 个成就。', points: 40, metric: 'unlockedCount', need: 60, hint: '十全从没有十全，但走到这一步的人不多。' }
]

/** id → 成就定义 */
export const ACHV_MAP = ACHIEVEMENTS.reduce((acc, a) => {
  acc[a.id] = a
  return acc
}, {})

/** 取成就定义；未登记返回 null */
export function getAchievement (id) {
  return ACHV_MAP[id] || null
}

/** 全成就满点（阶梯阈值校验用） */
export function totalAchvPoints () {
  return ACHIEVEMENTS.reduce((s, a) => s + (a.points | 0), 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// 世界纪事
// ═══════════════════════════════════════════════════════════════════════════

/** 频道（设计"三频道"＋"你"＝玩家里程碑） */
export const CHRONICLE_CHANNELS = [
  { id: 'you', name: '你' },
  { id: 'realm', name: '本界' },
  { id: 'sect', name: '宗门' },
  { id: 'world', name: '天下' }
]

/**
 * 纪事节奏与容量
 * batchMs：设计口径「每现实小时汇总一批」；单机一轮内要让主人看见滚动，MVP 取半（30 分钟）。
 *          想改回设计原值，把这一行的 30 改成 60 即可（改这一处，别处无依赖）。
 */
export const CHRONICLE = {
  batchMs: 30 * 60 * 1000,
  perBatch: [3, 5],          // 每批条数（随机区间）
  seedCount: 8,              // 新档先铺一段"昨日旧闻"，面板不至空
  seedSpreadMs: 90 * 60 * 1000, // 播种条目的时间跨度（往前铺）
  archiveMax: 200,           // 按季归档的容量上限（超出丢最旧）
  mentionChance: 0.18,       // 每条消息"提到你"的概率（隐藏成就「无名之辈」的来源）
  // 互动概率按频道分别定义，见 CHRONICLE_INTERACT（主人 2026-09-18：概率要写明）
  shichen: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
}

/** 时辰：子时 23:00–01:00，其余每两小时一个 */
export function shichenOf (ts) {
  const h = new Date(ts).getHours()
  return CHRONICLE.shichen[Math.floor(((h + 1) % 24) / 2)]
}

// ── 取词池（系统层随机取用，保证同一批不重名）──────────────────────────────
export const CHRONICLE_NAMES = [
  '墨客卿', '石铁柱', '小铃铛', '苏怀瑾', '陆云舟', '柳三娘', '沈砚之', '顾长风',
  '白疏影', '燕归来', '秦无咎', '楚寒衣', '姜望舒', '谢观棋', '简不知', '江逐月',
  '牧青野', '温行衣', '司徒南', '公孙冶', '独孤樵', '许清都', '阮红药', '裴剑一'
]
export const CHRONICLE_PLACES = [
  '万兽林', '乱石岭', '云落渡', '苍梧山', '断魂崖', '青萝谷', '落霞镇', '白沙集',
  '寒潭寺', '千机城', '蜃楼海', '幽篁里'
]
export const CHRONICLE_BEASTS = [
  '啸月狼', '铁背苍熊', '赤瞳狐', '背甲玄龟', '雷纹豹', '三眼灵狈', '青翼蛇', '吞云兽'
]
export const CHRONICLE_SECT_TITLES = ['外门弟子', '内门弟子', '真传', '执事长老', '首座', '掌门']

/**
 * 纪事模板（text 为事件，note 为一句点评）
 * 占位符：{name} {name2} {place} {place2} {beast} {realm} {title} {you} {n}
 */
export const CHRONICLE_TEMPLATES = [
  // 本界
  { ch: 'realm', text: '{name}于雷雨中渡劫成功，晋入{realm}——城中酒肆皆在谈论。', note: '茶余饭后的谈资，也是你的前车之鉴。' },
  { ch: 'realm', text: '{name}晋入{realm}，门前贺客排到了巷口。', note: '热闹是旁人的，路是自己走的。' },
  { ch: 'realm', text: '{name}在{place}闭关三载，出关时只带回半卷残页。', note: '残页也值钱，就看你识不识货。' },
  { ch: 'realm', text: '{name}与{name2}为{place}的一株灵药起了争执，最后一拍两散。', note: '修士的体面，常常败给一株草。' },
  { ch: 'realm', text: '{place}的{beast}昨夜伤了行人，猎户们正凑钱请人除它。', note: '悬赏不高，但顺路。' },
  { ch: 'realm', text: '{name}坐化于{place}的洞府，享寿{years}载；他留下的功法不知花落谁家。', note: '旧闻一则：今日之他人，他日之你我。' },
  { ch: 'realm', text: '{name}散尽家财求一枚破境丹，终究没等来。', note: '丹没等到，人也没了。' },
  { ch: 'realm', text: '{name}在{place}摆了三日的流水席，说是要收徒。', note: '收徒的招牌挂出来，先看有多少人来。' },

  // 宗门
  { ch: 'sect', text: '采药弟子{name}在万兽林带回一株三色灵芝，长老破例赏下辟谷丹。', note: '运气也是修行的一部分。' },
  { ch: 'sect', text: '{name}晋为{title}，同门纷纷来贺。', note: '职级高一档，任务板的槽位也宽一档。' },
  { ch: 'sect', text: '藏经阁一夜之间少了三卷功法，{name}被罚去山门扫阶三月。', note: '扫阶三月，倒是把心扫静了。' },
  { ch: 'sect', text: '门中大比临近，{name}已连胜七场，赔率悄悄变了。', note: '赔率比名册诚实。' },
  { ch: 'sect', text: '{name}替宗门押送一批玄铁，途中遇上劫道的。', note: '这种差事，向来是给"能打的"留的。' },
  { ch: 'sect', text: '掌门闭门不出已{n}日，山门事务暂由长老议处。', note: '越是安静，越是有事。' },
  { ch: 'sect', text: '{name}自请外放执事，说是要去{place}清静几年。', note: '清静是假，躲人是真。' },
  { ch: 'sect', text: '{name}在任务板前站了半晌，最后接了最不起眼的那件。', note: '会挑活的人，走得久。' },

  // 天下
  { ch: 'world', text: '兽潮退去，防线守住了——守军折损三成，兽王已被斩落。', note: '守住了就该庆功，哪怕只庆半日。' },
  { ch: 'world', text: '传闻{place}现了一处仙府遗迹，四方散修都在赶去。', note: '赶去的人多，回来的少。' },
  { ch: 'world', text: '{beast}一族自北境南下，沿途三城闭门。', note: '城门关得住兽，关不住人心。' },
  { ch: 'world', text: '天机阁重排天下俊彦榜，{name}的名字第一次上了榜尾。', note: '榜尾也是榜。' },
  { ch: 'world', text: '{place}的坊市今日贴出告示：高阶功法残页，价高者得。', note: '残页的价，向来由最后一个买家定。' },
  { ch: 'world', text: '有魔修在{place}血祭一城，正道诸宗已发出追剿令。', note: '追剿令发出得快，人来得慢。' },
  { ch: 'world', text: '百年一度的{place}论道将于明年开启，各宗已在点兵。', note: '点兵点到自家头上，才是真要开始了。' },
  { ch: 'world', text: '有散修在{place}拾得一枚无名残页，上面的字无人认得。', note: '无人认得，反而最贵。' }
]

/**
 * 互动纪事（主人 2026-09-17 / 09-18：**所有消息类型都可以互动**，
 * 但只按概率出现，且概率要写明 —— 不是每条都摆一堆按钮）
 *
 * 结构：频道 → { chance：该频道每条消息"可择"的概率，sets：可挂的选项组 }
 *   · V3.5.1（主人：纪事整体互动概率往上提 10%）——本界 0.35→0.45 / 宗门 0.30→0.40 / 天下 0.40→0.50。
 *   · 正文仍是该频道的随机新闻（本界 / 宗门 / 天下），命中概率的消息才多挂一组选项；
 *   · 选项写成"通用反应"，配任何一条同频道的新闻都读得通；
 *     选定即结算并落一句结果（结果同样通用），一条消息只可择一次。
 *   · 「你」频道 = 你自己的里程碑（成就即时插入）：chance 0 —— 自家的事没有待抉择。
 * 字段：costStones 需先备足灵石（不足则置灰）；needItems 需先有料；
 *       stones / items 为所得；good 决定日志配色（同事件系统口径）。
 * 护栏：只发灵石与材料，不发境界、不直接加成就点。
 */
export const CHRONICLE_INTERACT = {
  realm: {
    chance: 0.45,
    sets: [
      { options: [
        { id: 'go', label: '前往一探', hint: '循着消息赶去看看', good: true, stones: 0, items: [{ id: 'mat_lingcao', n: 2 }], result: '你循着消息赶了过去，只捡回几株灵草——聊胜于无，也算没白跑。' },
        { id: 'stay', label: '守在洞府', hint: '不凑这个热闹', good: false, stones: 0, items: [], result: '你按下不动。这桩事在坊间又传了几日，随后被新的传闻盖了过去。' }
      ] },
      { options: [
        { id: 'help', label: '出手相帮', hint: '顺手一桩人情', good: true, stones: 120, items: [], result: '你出手了。事主千恩万谢，塞来一袋灵石。' },
        { id: 'ignore', label: '事不关己', hint: '修行要紧', good: false, stones: 0, items: [], result: '你没管。青岚界这类事天天都有，多一件不多。' }
      ] }
    ]
  },
  sect: {
    chance: 0.40,
    sets: [
      { options: [
        { id: 'take', label: '接下这桩差事', hint: '同门的事，揽了便有人记着', good: true, stones: 0, items: [{ id: 'mat_kuang', n: 1 }], result: '你把差事揽了下来。回来时师兄弟塞给你一块玄铁，说是"顺手捡的"。' },
        { id: 'later', label: '推给旁人', hint: '自家修行要紧', good: false, stones: 0, items: [], result: '你把话头绕开了。差事落在别人肩上，山门里也没人多说一句。' }
      ] },
      { options: [
        { id: 'gift', label: '送他两份灵草', hint: '需灵草 ×2 · 同门情面是要还的', good: true, needItems: [{ id: 'mat_lingcao', n: 2 }], stones: 60, items: [], result: '你把灵草塞了过去。半月后他还来六十灵石，连装草的玉盒也一并送了。' },
        { id: 'silent', label: '当作没听见', hint: '各家自扫门前雪', good: false, stones: 0, items: [], result: '你装作没听见。对方没开口，只是把手里的空药囊捏得更紧了。' }
      ] }
    ]
  },
  world: {
    chance: 0.50,
    sets: [
      { options: [
        { id: 'join', label: '赶去凑个机缘', hint: '去碰碰运气', good: true, stones: 0, items: [{ id: 'mat_kuang', n: 2 }], result: '你赶去时好位置早被人占了，只在圈外扒了半日，捡回两块矿胚。' },
        { id: 'mind', label: '闭门不理', hint: '天下事与我何干', good: false, stones: 0, items: [], result: '你没动身。后来听人说，去的人里三成没回来。' }
      ] },
      { options: [
        { id: 'aid', label: '出手相助', hint: '斩妖护民，自有其报', good: true, stones: 0, items: [{ id: 'mat_yaodan', n: 1 }], result: '你出手斩了那头畜生。事主把随身妖丹塞给你，说命比丹贵。' },
        { id: 'watch', label: '静观其变', hint: '符光灭了，与你无关', good: false, stones: 0, items: [], result: '你没有动身。第四夜符光灭了，纪事里再没提起这件事。' }
      ] },
      { options: [
        { id: 'donate', label: '捐 100 灵石', hint: '需灵石 100 · 沿岸村落会记着这份情', good: true, costStones: 100, stones: 0, items: [{ id: 'mat_lingcao', n: 3 }], result: '你把灵石留在堤上。村老硬塞给你三份晒好的灵草，说是"不白拿人的"。' },
        { id: 'pass', label: '无暇顾及', hint: '修行事大', good: false, stones: 0, items: [], result: '你从堤上走过。修堤的人抬头看了你一眼，又低头去搬石头。' }
      ] }
    ]
  },
  you: { chance: 0, sets: [] }
}

/** 提到「你」的条目（隐藏成就「无名之辈」的来源；ch 用天下/本界） */
export const CHRONICLE_MENTIONS = [
  { ch: 'world', text: '有人在{place}的酒肆里提起你的名字——「{you}，据说是从{place2}出来的。」', note: '你没在场，名字先到了。' },
  { ch: 'world', text: '天机阁的榜单边角写着一行小字：{you}，{realm}，未详。', note: '「未详」二字，有时比排名好听。' },
  { ch: 'realm', text: '{name}与人打赌：{you}活不过下一劫。', note: '赌注不大，话传得很远。' },
  { ch: 'realm', text: '{place}的旧墙上被人刻了一行字：{you}到此一游。', note: '你没刻过，但字是真的。' }
]

export default {
  ACHV_CATS, ACHV_TIERS, ACHIEVEMENTS, ACHV_MAP, getAchievement, totalAchvPoints,
  CHRONICLE, CHRONICLE_CHANNELS, CHRONICLE_TEMPLATES, CHRONICLE_MENTIONS,
  CHRONICLE_NAMES, CHRONICLE_PLACES, CHRONICLE_BEASTS, CHRONICLE_SECT_TITLES,
  CHRONICLE_INTERACT, shichenOf, ACHV_NO_TITLE
}
