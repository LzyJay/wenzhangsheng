/**
 * achievements.js —— 成就与纪事表（只读配置层）（2.10）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《挂机修仙·世界纪事与成就系统 v1》第一部分（纪事）与第二部分（成就）
 *       +《问长生-开发计划》§四 模块 2.10（约 90 成就 + 三频道纪事 + 称号展示）
 *
 * 边界：纯配置 + 纯函数（getAchievement / shichenOf）。禁止 import systems / Phaser / DOM。
 *
 * 成就口径（设计第二部分）：
 *   · 规模 107 个：境界 18 ｜秘境 19 ｜宗门 25 ｜灵兽 10 ｜事件与因果 12 ｜探索收集 13 ｜隐藏 10
 *     （V6.15：12 界各一条「拜入本界首宗」彩蛋 —— 身份型成就，`need` 为宗门 id 字符串）
 *     （V5.1.3 校正：原注释写「90 个 / 秘境 15」，秘境档后续增至 19 未同步，致测试与说明文案
 *      两处都按 90 写死；现按实际条数回写，并由 tests/V5.1.3-自测.mjs 固化「注释条数 = 实际条数」）
 *   · 成就点 5~80 点/个（V6.12 批 G5a：太上两档续掌门之上递增）；五档阶梯（凡/灵/玄/王/皇）按**累计成就点**发放称号 + 外观碎片 + 少量材料
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

  // ── 秘境（19：15 条既有 + V5.1 招牌秘境 4 条）──────────────────────────
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
  // V5.1 招牌秘境（12 条招牌洞天 · 内容批次 3 世界篇首步）
  { id: 'achv_sigfirst', cat: 'dungeon', name: '入得洞天', desc: '首通一处招牌洞天。', points: 15, metric: 'sigCleared', need: 1 },
  { id: 'achv_sigorigin', cat: 'dungeon', name: '本界洞天', desc: '集齐本界全部本源招牌洞天。', points: 30, metric: 'sigOriginDone', need: 1, chronicle: '本界压箱底的几处洞天，被你一一走遍——界碑上的名字，从此算你一个。' },
  { id: 'achv_sigpoints', cat: 'dungeon', name: '积分为凭', desc: '秘境积分累计到 300。', points: 20, metric: 'sigPoints', need: 300 },
  { id: 'achv_sigweekly', cat: 'dungeon', name: '限时一趟', desc: '探过一次当周限时秘境。', points: 15, metric: 'sigWeeklyDone', need: 1 },

  // ── 宗门（14）─────────────────────────────────────────────────────────
  // ── V6.15：**12 界入宗彩蛋**（身份型成就：拜入本界「首宗」即解锁；换界转散修后需重拜）──
  //   metric='sectId' + need=<宗门 id>（**字符串相等**判定，见 AchievementSystem.evaluate）
  { id: 'achv_yunlan', cat: 'sect', name: '云岚弟子', desc: '拜入青岚界的云岚宗。', points: 10, metric: 'sectId', need: 'sect_ql_yunlan', chronicle: '你在云岚宗的山门前递了名帖 —— 从此有处可回，也有人等你交差。' },
  { id: 'achv_sect_poxiao', cat: 'sect', name: '恒岳门人', desc: '拜入破晓星域的恒岳派。', points: 10, metric: 'sectId', need: 'sect_px_hengyue', chronicle: '边陲小宗的山门矮得可怜。你递上名帖时，守门的老修士多看了你一眼。' },
  { id: 'achv_sect_denghuo', cat: 'sect', name: '观云弟子', desc: '拜入观云界的观云峰。', points: 10, metric: 'sectId', need: 'sect_dh_guanyun', chronicle: '入门第一课不授吐纳，只问一句「什么最危险」。你答完，才算是这里的人。' },
  { id: 'achv_sect_qingyun', cat: 'sect', name: '青云弟子', desc: '拜入青云古界的青云门。', points: 10, metric: 'sectId', need: 'sect_qy_qingyun', chronicle: '青云七峰，晨钟一响满山都是御剑声 —— 你从此也是其中一声。' },
  { id: 'achv_sect_wangzu', cat: 'sect', name: '青池族人', desc: '拜入望族山河的青池宗。', points: 10, metric: 'sectId', need: 'sect_wz_qingchi', chronicle: '族谱上添了你的名字：一笔写下去，往后三十年都在这本册子里。' },
  { id: 'achv_sect_younuo', cat: 'sect', name: '清风道童', desc: '拜入幽傩界的清风观。', points: 10, metric: 'sectId', need: 'sect_yn_qingfeng', chronicle: '药房的门一推开，苦味先扑上来。你在这里学会了先辨药，再辨自己。' },
  { id: 'achv_sect_tongtian', cat: 'sect', name: '灵溪弟子', desc: '拜入通天界的灵溪宗。', points: 10, metric: 'sectId', need: 'sect_tt_lingxi', chronicle: '香云山下的灶房很吵，可那本被翻烂的功法，你就是在这儿读完的。' },
  { id: 'achv_sect_tiangong', cat: 'sect', name: '不空门人', desc: '拜入天工界的不空门。', points: 10, metric: 'sectId', need: 'sect_tg_bukong', chronicle: '第一次结丝，十根指头抖了九根。师父只说了一句：再结一次。' },
  { id: 'achv_sect_liumian', cat: 'sect', name: '问道弟子', desc: '拜入六面囚笼的问道宗。', points: 10, metric: 'sectId', need: 'sect_lm_wendao', chronicle: '宗主不语，弟子只好自己读。你在这里学会的第一件事是：别急着信。' },
  { id: 'achv_sect_jiuding', cat: 'sect', name: '道宗弟子', desc: '拜入九鼎九州的道宗。', points: 10, metric: 'sectId', need: 'sect_jd_dao', chronicle: '州县里发下来的启蒙功法，扉页上印着两个小字：道宗。' },
  { id: 'achv_sect_wuyuan', cat: 'sect', name: '负山门人', desc: '拜入无缺古界的负山宗。', points: 10, metric: 'sectId', need: 'sect_wy_fushan', chronicle: '负山宗早已没落，山门上的匾额掉了漆。你还是把名帖递了进去。' },
  { id: 'achv_sect_xianghuo', cat: 'sect', name: '伏龙道童', desc: '拜入人间香火的伏龙观。', points: 10, metric: 'sectId', need: 'sect_xh_fulong', chronicle: '晨钟一响，青芜山上的第一页就翻开了 —— 观里的猫比你先到。' },
  { id: 'achv_jichen', cat: 'sect', name: '积羽沉舟', desc: '累计贡献 1000。', points: 15, metric: 'totalContrib', need: 1000 },
  { id: 'achv_qinmian', cat: 'sect', name: '门中勤勉', desc: '累计贡献 3000。', points: 20, metric: 'totalContrib', need: 3000 },
  { id: 'achv_gonggai', cat: 'sect', name: '功盖内外', desc: '累计贡献 10000。', points: 30, metric: 'totalContrib', need: 10000 },
  { id: 'achv_zhushi', cat: 'sect', name: '门中柱石', desc: '累计贡献 30000。', points: 40, metric: 'totalContrib', need: 30000 },
  { id: 'achv_neimen', cat: 'sect', name: '内门弟子', desc: '职级晋至内门。', points: 10, metric: 'sectRank', need: 1 },
  { id: 'achv_zhenchuan', cat: 'sect', name: '真传弟子', desc: '职级晋至真传。', points: 20, metric: 'sectRank', need: 2 },
  { id: 'achv_zhishi', cat: 'sect', name: '执事长老', desc: '职级晋至执事长老。', points: 30, metric: 'sectRank', need: 3 },
  { id: 'achv_shouzuo', cat: 'sect', name: '首座', desc: '职级晋至首座。', points: 40, metric: 'sectRank', need: 4 },
  { id: 'achv_zhangmen', cat: 'sect', name: '掌门', desc: '职级晋至掌门。', points: 50, metric: 'sectRank', need: 5, title: '掌门', chronicle: '你把掌门印接在手里——{sect}上下都在看你会把它带去哪里。' },
  // V6.12 批 G5a：职级扩到 8 档，补掌门之上两档（称号随宗而变，成就名取通用档名）
  { id: 'achv_taishang', cat: 'sect', name: '太上长老', desc: '职级晋至太上长老。', points: 60, metric: 'sectRank', need: 6, chronicle: '你退到幕后那天，山门里的规矩换了一版 —— 你写的那一版。' },
  { id: 'achv_zushi', cat: 'sect', name: '太上祖师', desc: '职级晋至太上祖师。', points: 80, metric: 'sectRank', need: 7, chronicle: '后辈提起你时不再说名字，只说「本门祖师」。' },
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
// V6.12 批 G5a：称号池随职级扩到 8 档（掌门之上补太上长老 / 太上祖师）
export const CHRONICLE_SECT_TITLES = ['外门弟子', '内门弟子', '真传', '执事长老', '首座', '掌门', '太上长老', '太上祖师']

/**
 * 纪事模板（text 为事件，note 为一句点评）
 * 占位符：{name} {name2} {place} {place2} {beast} {realm} {title} {you} {n}
 *
 * ── V4.7 主人 2026-09-18 重构（「牛头不对马嘴」根治）────────────────────────
 *   · 每条模板自带 `q`（等级：凡/良/珍/绝/仙，与事件系统同一套口径）；
 *   · 每条模板自带 `choices`（**专属**选项与已决文案）——不再按频道整组套壳，
 *     所以「旧墙刻字」绝不会再配上「出手相帮 · 事主塞来一袋灵石」；
 *   · choices 每项 `tag`（safe / balanced / risky）供自动策略挑（三档对应见 events.STRATEGY_AUTO）；
 *     代价字段沿用 costStones / needItems，收益沿用 stones / items（护栏：只发灵石与材料）。
 */
export const CHRONICLE_TEMPLATES = [
  // ── 本界 ──────────────────────────────────────────────────────────────
  {
    id: 'realm_leidun', ch: 'realm', q: 'liang',
    text: '{name}于雷雨中渡劫成功，晋入{realm}——城中酒肆皆在谈论。',
    note: '茶余饭后的谈资，也是你的前车之鉴。',
    choices: [
      { id: 'ting', tag: 'safe', label: '去酒肆坐坐', hint: '听他渡劫时的取舍', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你在酒肆坐到打烊，把那人渡劫时的取舍听了个七七八八，临走还得了半囊灵草。' },
      { id: 'he', tag: 'risky', label: '备礼登门道贺', hint: '需灵石 80 · 人情往来', good: true, costStones: 80, items: [{ id: 'mat_yaodan', n: 1 }], result: '你备了贺礼登门。那人回赠一枚妖丹，只说"渡劫那日，多谢未曾喧哗"。' }
    ]
  },
  {
    id: 'realm_heke', ch: 'realm', q: 'liang',
    text: '{name}晋入{realm}，门前贺客排到了巷口。',
    note: '热闹是旁人的，路是自己走的。',
    choices: [
      { id: 'qiaoqiao', tag: 'safe', label: '混在人群里看', hint: '瞧个热闹，顺便听门道', good: true, items: [{ id: 'mat_lingcao', n: 1 }], result: '你在人群里站了半日，听见一句话受用：「破境靠的不是灵气，是肯不肯再坐一个时辰。」' },
      { id: 'huifu', tag: 'risky', label: '回洞府多坐一炷香', hint: '不凑热闹，自己用功', good: true, items: [{ id: 'mat_kuang', n: 1 }], result: '你转身回洞府。这一炷香坐得比平日沉，睁眼时铁精已自行剥落了一块。' }
    ]
  },
  {
    id: 'realm_biguan', ch: 'realm', q: 'fan',
    text: '{name}在{place}闭关三载，出关时只带回半卷残页。',
    note: '残页也值钱，就看你识不识货。',
    choices: [
      { id: 'shou', tag: 'balanced', label: '出价收下残页', hint: '需灵石 120 · 赌一赌眼力', good: true, costStones: 120, items: [{ id: 'mat_lingcao', n: 4 }], result: '你把残页收了下来。翻到末页才知是半篇药经——不亏，灵草催生的法子还记在上面。' },
      { id: 'bukan', tag: 'safe', label: '看看便走', hint: '残页多半是坑', good: false, items: [], result: '你没接那半卷残页。半年后听说它被宗门以高价收进了藏经阁。' }
    ]
  },
  {
    id: 'realm_zhengyi', ch: 'realm', q: 'fan',
    text: '{name}与{name2}为{place}的一株灵药起了争执，最后一拍两散。',
    note: '修士的体面，常常败给一株草。',
    choices: [
      { id: 'deng', tag: 'safe', label: '等他们散了再摘', hint: '他们争的是药，你摘的是叶', good: true, items: [{ id: 'mat_lingcao', n: 3 }], result: '你等人散尽了才过去。整株被人分走了，落在地上的叶子倒还归你——够熬三副药。' },
      { id: 'quan', tag: 'balanced', label: '上前劝一句', hint: '顺手做个人情', good: true, stones: 60, items: [], result: '你上前劝了两句。两人到底分了药，临走各塞你三十灵石：「谢你一句话。」' }
    ]
  },
  {
    id: 'realm_yaoshou', ch: 'realm', q: 'liang',
    text: '{place}的{beast}昨夜伤了行人，猎户们正凑钱请人除它。',
    note: '悬赏不高，但顺路。',
    choices: [
      { id: 'jie', tag: 'risky', label: '接下悬赏', hint: '顺路的活，赚个辛苦钱', good: true, stones: 150, items: [], result: '你循着血迹找到了那头畜生。一击毙命，猎户们凑的赏钱当场点清。' },
      { id: 'quanlie', tag: 'safe', label: '教他们设套', hint: '不必亲自下场', good: true, stones: 0, items: [{ id: 'mat_kuang', n: 2 }], result: '你教猎户在涧口布了铁夹。三日后它就伏了诛，猎户们抬来两块铁精道谢。' }
    ]
  },
  {
    id: 'realm_zuohua', ch: 'realm', q: 'fan',
    text: '{name}坐化于{place}的洞府，享寿{years}载；他留下的功法不知花落谁家。',
    note: '旧闻一则：今日之他人，他日之你我。',
    choices: [
      { id: 'saomu', tag: 'safe', label: '去洞府外上一炷香', hint: '不为功法，只为同行一场', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你在洞府外燃了一炷香。风把灰吹到石阶缝里，那里竟还长着一丛他生前种的灵草。' },
      { id: 'xunfa', tag: 'risky', label: '进去碰碰机缘', hint: '功法若在，技高者得', good: true, items: [{ id: 'mat_kuang', n: 2 }], result: '你在洞府里搜了半日，只剩些炼器的边角料——功法早被人取走了，留下满地石屑。' }
    ]
  },
  {
    id: 'realm_poyao', ch: 'realm', q: 'fan',
    text: '{name}散尽家财求一枚破境丹，终究没等来。',
    note: '丹没等到，人也没了。',
    choices: [
      { id: 'jieji', tag: 'safe', label: '替他结个善缘', hint: '修行路上，能扶一把是一把', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你替他垫了药材钱。他没能破境，倒是把你这份情记在了册子上。' },
      { id: 'buwen', tag: 'balanced', label: '不予理会', hint: '各自有各自的劫', good: false, items: [], result: '你没管。再听见这个名字时，是在坊市的一张讣告上。' }
    ]
  },
  {
    id: 'realm_liushui', ch: 'realm', q: 'fan',
    text: '{name}在{place}摆了三日的流水席，说是要收徒。',
    note: '收徒的招牌挂出来，先看有多少人来。',
    choices: [
      { id: 'quchi', tag: 'safe', label: '去坐一坐', hint: '席上人多，消息也多', good: true, items: [{ id: 'mat_lingcao', n: 3 }], result: '你在席上坐了半日，听了几桩别处听不到的事，走时还带了主人给的三份灵草。' },
      { id: 'baoming', tag: 'balanced', label: '打听他收徒的规矩', hint: '探个底细', good: true, stones: 40, items: [], result: '你问明了规矩：不看出身，只看能否三日不眠。你没拜师，倒把这话记了三十年。' }
    ]
  },

  // ── 宗门 ──────────────────────────────────────────────────────────────
  {
    id: 'sect_lingzhi', ch: 'sect', q: 'liang',
    text: '采药弟子{name}在万兽林带回一株三色灵芝，长老破例赏下辟谷丹。',
    note: '运气也是修行的一部分。',
    choices: [
      { id: 'xunlu', tag: 'safe', label: '问他走哪条路', hint: '同一条路，未必只长一株', good: true, items: [{ id: 'mat_lingcao', n: 3 }], result: '他指了条溪谷给你。你循着走了一趟，采回三份品相不差的灵草。' },
      { id: 'heshou', tag: 'balanced', label: '替他向长老请赏', hint: '同门的事，揽了便有人记着', good: true, stones: 80, items: [], result: '你替他把话递到了执事长老跟前。长老多赏了他一份丹药，他转手把谢礼送到了你洞府。' }
    ]
  },
  {
    id: 'sect_jinzhi', ch: 'sect', q: 'liang',
    text: '{name}晋为{title}，同门纷纷来贺。',
    note: '职级高一档，任务板的槽位也宽一档。',
    choices: [
      { id: 'daoxi', tag: 'safe', label: '道一声喜', hint: '同门之间，话不必多', good: true, stones: 50, items: [], result: '你去道了一声喜。他随手塞来五十灵石：「沾个喜气。」' },
      { id: 'qingjiao', tag: 'risky', label: '趁热请教他晋级的门道', hint: '真话只在兴头上', good: true, items: [{ id: 'mat_kuang', n: 2 }], result: '他酒喝到一半，把晋级的关窍讲了七成。临别还塞了两块玄铁：「别四处说。」' }
    ]
  },
  {
    id: 'sect_shuqie', ch: 'sect', q: 'zhen',
    text: '藏经阁一夜之间少了三卷功法，{name}被罚去山门扫阶三月。',
    note: '扫阶三月，倒是把心扫静了。',
    choices: [
      { id: 'songshui', tag: 'safe', label: '去给他送壶水', hint: '落难的时候，看得清人', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你提了壶热茶下山门。他扫到阶尾，抬头说了句：「卷宗不是我拿的。」' },
      { id: 'chajiu', tag: 'risky', label: '私下查一查', hint: '需灵石 100 · 打点看阁的执事', good: true, costStones: 100, items: [{ id: 'mat_kuang', n: 3 }], result: '你花灵石打点了看阁的执事，摸出一条线索。此后阁中少了一桩冤案，你也多了三块好铁。' }
    ]
  },
  {
    id: 'sect_dabi', ch: 'sect', q: 'liang',
    text: '门中大比临近，{name}已连胜七场，赔率悄悄变了。',
    note: '赔率比名册诚实。',
    choices: [
      { id: 'ya', tag: 'risky', label: '押他一场', hint: '需灵石 100 · 赢面不小', good: true, costStones: 100, stones: 220, items: [], result: '你把灵石压了上去。第八场他险胜半招，赌注翻了倍。' },
      { id: 'guan', tag: 'safe', label: '只看不押', hint: '看人比赢钱要紧', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你没押注，只把他的招式记在心里。散场时顺手捡回两份被踩落的灵草。' }
    ]
  },
  {
    id: 'sect_husong', ch: 'sect', q: 'zhen',
    text: '{name}替宗门押送一批玄铁，途中遇上劫道的。',
    note: '这种差事，向来是给"能打的"留的。',
    choices: [
      { id: 'jiuyuan', tag: 'risky', label: '赶去接应', hint: '宗门的东西不能丢', good: true, stones: 120, items: [{ id: 'mat_kuang', n: 3 }], result: '你赶去时他已被围住。两人合力打退了那伙人，玄铁一件没少——宗门照例重赏。' },
      { id: 'baoxin', tag: 'safe', label: '先把消息递回山门', hint: '救人要紧，规矩也要紧', good: true, items: [{ id: 'mat_kuang', n: 1 }], result: '你抢先把消息递回山门。长老带人接应，玄铁保住了大半，你也分到一块。' }
    ]
  },
  {
    id: 'sect_bimen', ch: 'sect', q: 'fan',
    text: '掌门闭门不出已{n}日，山门事务暂由长老议处。',
    note: '越是安静，越是有事。',
    choices: [
      { id: 'jingshou', tag: 'safe', label: '守好自己那份差事', hint: '多事之秋，先稳住', good: true, stones: 60, items: [], result: '你把分内的事做得比平日更干净。月底领例钱时，执事多给了六十灵石，没说缘由。' },
      { id: 'datan', tag: 'balanced', label: '找人打探几句', hint: '山门风向，早知早做准备', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你听了半天风言风语，唯一有用的那句是「掌门在炼一炉旧丹」——顺手还换回两份灵草。' }
    ]
  },
  {
    id: 'sect_waifang', ch: 'sect', q: 'fan',
    text: '{name}自请外放执事，说是要去{place}清静几年。',
    note: '清静是假，躲人是真。',
    choices: [
      { id: 'jiekou', tag: 'safe', label: '托他捎句话', hint: '外放路上，消息最灵', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你托他给{place}的旧识捎了封信。半月后回信到了，还夹着两份当地才有的灵草。' },
      { id: 'tongxing', tag: 'risky', label: '同去{place}走一趟', hint: '需灵石 60 · 外放之地多有异产', good: true, costStones: 60, items: [{ id: 'mat_yaodan', n: 1 }], result: '你随他走了一趟{place}。那地方冷清，妖兽却多，回来时囊里多了一枚妖丹。' }
    ]
  },
  {
    id: 'sect_renwu', ch: 'sect', q: 'fan',
    text: '{name}在任务板前站了半晌，最后接了最不起眼的那件。',
    note: '会挑活的人，走得久。',
    choices: [
      { id: 'xue', tag: 'safe', label: '学他的挑法', hint: '最不起眼的活，往往最少人抢', good: true, stones: 70, items: [], result: '你照他的挑法接了一桩跑腿的活。果然没人抢，交差时执事还给了七十灵石的路费。' },
      { id: 'huan', tag: 'balanced', label: '与他换一桩', hint: '各取所需', good: true, items: [{ id: 'mat_kuang', n: 1 }], result: '你把自己手上那桩换给了他。他谢得实在——一块玄铁直接拍在你手里。' }
    ]
  },

  // ── 天下 ──────────────────────────────────────────────────────────────
  {
    id: 'world_shouchao', ch: 'world', q: 'jue',
    text: '兽潮退去，防线守住了——守军折损三成，兽王已被斩落。',
    note: '守住了就该庆功，哪怕只庆半日。',
    choices: [
      { id: 'shishi', tag: 'risky', label: '去战场捡兽骨', hint: '兽王尸骸未寒，值钱的东西不少', good: true, items: [{ id: 'mat_yaodan', n: 2 }, { id: 'mat_kuang', n: 2 }], result: '你在焦土里翻了整夜，扒出两枚没散尽的妖丹和两块兽骨铁。回来时指尖还在抖。' },
      { id: 'kaola', tag: 'safe', label: '犒劳守军', hint: '需灵石 150 · 活下来的人最该被记得', good: true, costStones: 150, items: [{ id: 'mat_lingcao', n: 4 }], result: '你把灵石换成酒肉送上防线。守军头领把随身的伤药回赠给你——四份灵草，用油纸包得仔细。' }
    ]
  },
  {
    id: 'world_xianfu', ch: 'world', q: 'zhen',
    text: '传闻{place}现了一处仙府遗迹，四方散修都在赶去。',
    note: '赶去的人多，回来的少。',
    choices: [
      { id: 'gan', tag: 'risky', label: '赶去碰机缘', hint: '去晚了连渣都不剩', good: true, items: [{ id: 'mat_kuang', n: 2 }], result: '你赶去时好东西已被卷空，只在断墙下挖出两块矿胚——总比空手回来强。' },
      { id: 'hou', tag: 'safe', label: '在必经之路上等', hint: '不进去，也能捡漏', good: true, items: [{ id: 'mat_lingcao', n: 3 }], result: '你在谷口摆了个茶摊。出来的人急着赶路，随手拿东西换水喝——半日下来你收了三份灵草。' }
    ]
  },
  {
    id: 'world_nanxia', ch: 'world', q: 'zhen',
    text: '{beast}一族自北境南下，沿途三城闭门。',
    note: '城门关得住兽，关不住人心。',
    choices: [
      { id: 'shoucheng', tag: 'risky', label: '上城墙援一手', hint: '城破之后，谁都不好过', good: true, stones: 200, items: [], result: '你在城头守了两夜，第三夜兽群散了。城主散赏，你的那份是整整二百灵石。' },
      { id: 'zhenzai', tag: 'safe', label: '沿路施药收尸', hint: '不图赏钱，图个心安', good: true, items: [{ id: 'mat_yaodan', n: 1 }], result: '你在城外收殓了十几具尸首。有个老猎户把随身妖丹塞给你，说「路上用得着」。' }
    ]
  },
  {
    id: 'world_bang', ch: 'world', q: 'liang',
    text: '天机阁重排天下俊彦榜，{name}的名字第一次上了榜尾。',
    note: '榜尾也是榜。',
    choices: [
      { id: 'xue', tag: 'safe', label: '抄一份榜文回去', hint: '照着他，一步一步来', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你把榜文抄了一份贴在洞府墙上。抄的时候顺手记下几处地名，倒真找出两味灵草。' },
      { id: 'jiemai', tag: 'balanced', label: '去榜单下拜个交情', hint: '榜尾也是榜，人情先到', good: true, stones: 90, items: [], result: '你在榜下等了半日，终于等到他来看榜。一顿酒下来，他给了你九十灵石的「见面礼」。' }
    ]
  },
  {
    id: 'world_fangshi', ch: 'world', q: 'fan',
    text: '{place}的坊市今日贴出告示：高阶功法残页，价高者得。',
    note: '残页的价，向来由最后一个买家定。',
    choices: [
      { id: 'pai', tag: 'risky', label: '出价拍下来', hint: '需灵石 200 · 价高者得', good: true, costStones: 200, stones: 0, items: [{ id: 'mat_yaodan', n: 2 }], result: '你举了三次牌才拿下。翻开一看，残页里夹着两枚妖丹——上一个主人留的私货。' },
      { id: 'deng', tag: 'safe', label: '等流拍再谈', hint: '流拍的东西，能砍价', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你等到流拍。摊主没卖成，倒把压箱底的两份灵草便宜让给了你。' }
    ]
  },
  {
    id: 'world_moxiu', ch: 'world', q: 'jue',
    text: '有魔修在{place}血祭一城，正道诸宗已发出追剿令。',
    note: '追剿令发出得快，人来得慢。',
    choices: [
      { id: 'zhuijiao', tag: 'risky', label: '随追剿队去', hint: '出力就有份赏', good: true, stones: 260, items: [], result: '你把那人堵在了废城里。事后分赏，你的那份是二百六十灵石——沾血的钱，花得也快。' },
      { id: 'jiuhu', tag: 'safe', label: '去接幸存者', hint: '追杀有人做，救人没人做', good: true, items: [{ id: 'mat_yaodan', n: 2 }], result: '你在废墟里背出七个活人。其中一个药童把随身的妖丹全给了你，说「我记不清家的路了」。' }
    ]
  },
  {
    id: 'world_lundao', ch: 'world', q: 'zhen',
    text: '百年一度的{place}论道将于明年开启，各宗已在点兵。',
    note: '点兵点到自家头上，才是真要开始了。',
    choices: [
      { id: 'moming', tag: 'balanced', label: '先报个名', hint: '百年一度，去了不亏', good: true, items: [{ id: 'mat_lingcao', n: 3 }], result: '你把名号报给了执事。回来路上有人塞给你三份灵草：「名额紧，替我说句好话。」' },
      { id: 'bikan', tag: 'safe', label: '闭门用功', hint: '名次虚，修为实', good: true, items: [{ id: 'mat_kuang', n: 2 }], result: '你没报名，把这一年都花在了功上。年底清点，铁精攒了两块，心里也踏实。' }
    ]
  },
  {
    id: 'world_canye', ch: 'world', q: 'liang',
    text: '有散修在{place}拾得一枚无名残页，上面的字无人认得。',
    note: '无人认得，反而最贵。',
    choices: [
      { id: 'shoucan', tag: 'balanced', label: '用东西换来看看', hint: '需玄铁 ×1 · 字不认得，纸认得', good: true, needItems: [{ id: 'mat_kuang', n: 1 }], items: [{ id: 'mat_lingcao', n: 4 }], result: '你用一块玄铁换来了残页。字果然不认得，可纸是灵草浆做的——照方子泡水，催出了四份新草。' },
      { id: 'shan', tag: 'safe', label: '笑一笑走开', hint: '认不得的字，未必是机缘', good: false, items: [], result: '你没接那枚残页。三个月后听说它被天机阁以三倍价钱收走。' }
    ]
  }
]

/**
 * 互动纪事的**概率**（主人 2026-09-18：概率要写明）
 *   · V4.7 起选项不再按频道整组套壳 —— 每条模板自带专属 `choices`（见上），
 *     本表只管「该频道每条消息有多大概率可择」。
 *   · V3.5.1（主人：互动概率往上提 10%）：本界 0.35→0.45 / 宗门 0.30→0.40 / 天下 0.40→0.50。
 *   · 「你」频道 = 自己的里程碑（成就即时插入）：chance 0 —— 自家的事没有待抉择。
 * 自动处置：命中概率且该条等级落在自动策略的处置范围内时，由系统按策略偏好替玩家选
 *   （见 events.STRATEGY_AUTO）；付不起的选项一律留给玩家亲自决断。
 */
export const CHRONICLE_INTERACT = {
  realm: { chance: 0.45 },
  sect: { chance: 0.40 },
  world: { chance: 0.50 },
  you: { chance: 0 }
}

/** 提到「你」的条目（隐藏成就「无名之辈」的来源；ch 用天下/本界）；同样各带等级与专属选项 */
export const CHRONICLE_MENTIONS = [
  {
    id: 'mention_jiusi', ch: 'world', q: 'liang',
    text: '有人在{place}的酒肆里提起你的名字——「{you}，据说是从{place2}出来的。」',
    note: '你没在场，名字先到了。',
    choices: [
      { id: 'xun', tag: 'safe', label: '寻去那家酒肆', hint: '看看是谁在提你', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你寻到那家酒肆，问出提你名字的是个走商。他把路引让给你抄了一份，还塞了两份灵草。' },
      { id: 'buguan', tag: 'balanced', label: '由他们去说', hint: '名字传远了，未必是好事', good: false, items: [], result: '你没理会。往后半年，这个名字在坊间越传越玄，最后连你自己都认不出。' }
    ]
  },
  {
    id: 'mention_bangdan', ch: 'world', q: 'liang',
    text: '天机阁的榜单边角写着一行小字：{you}，{realm}，未详。',
    note: '「未详」二字，有时比排名好听。',
    choices: [
      { id: 'tianji', tag: 'balanced', label: '去天机阁补个籍', hint: '需灵石 100 · 有了籍，好办事', good: true, costStones: 100, items: [{ id: 'mat_kuang', n: 2 }], result: '你在天机阁补了籍。执事顺手给了你两块铁精：「入册的人，往后好打交道。」' },
      { id: 'weixiang', tag: 'safe', label: '就让它是「未详」', hint: '不显名，少麻烦', good: true, items: [{ id: 'mat_lingcao', n: 2 }], result: '你转身走了。「未详」二字替你挡掉不少麻烦，路上顺手采了两份灵草。' }
    ]
  },
  {
    id: 'mention_dadu', ch: 'realm', q: 'fan',
    text: '{name}与人打赌：{you}活不过下一劫。',
    note: '赌注不大，话传得很远。',
    choices: [
      { id: 'dui', tag: 'risky', label: '反押自己一注', hint: '需灵石 100 · 让他们看看', good: true, costStones: 100, stones: 240, items: [], result: '你把灵石押在了自己身上。下一劫你过了——赌注翻倍，那人从此不再开口。' },
      { id: 'yi', tag: 'safe', label: '一笑置之', hint: '嘴上输赢，不值当', good: true, items: [{ id: 'mat_lingcao', n: 1 }], result: '你笑了笑就走。回去的路上多坐了一个时辰，顺手把洞府门前的灵草收了。' }
    ]
  },
  {
    id: 'mention_kezi', ch: 'realm', q: 'fan',
    text: '{place}的旧墙上被人刻了一行字：{you}到此一游。',
    note: '你没刻过，但字是真的。',
    choices: [
      { id: 'mo', tag: 'safe', label: '把字磨掉', hint: '留名容易，留祸也容易', good: true, items: [{ id: 'mat_kuang', n: 1 }], result: '你磨了半日才把那行字抹平。墙根下露出的旧砖竟是铁精烧的，顺手凿下一块。' },
      { id: 'liu', tag: 'balanced', label: '随它留着', hint: '有人想借你的名头', good: true, stones: 50, items: [], result: '你由它留着。数日后真有人循着字找上门来送谢礼——「借名号吓退了一伙蟊贼。」' }
    ]
  }
]

export default {
  ACHV_CATS, ACHV_TIERS, ACHIEVEMENTS, ACHV_MAP, getAchievement, totalAchvPoints,
  CHRONICLE, CHRONICLE_CHANNELS, CHRONICLE_TEMPLATES, CHRONICLE_MENTIONS,
  CHRONICLE_NAMES, CHRONICLE_PLACES, CHRONICLE_BEASTS, CHRONICLE_SECT_TITLES,
  CHRONICLE_INTERACT, shichenOf, ACHV_NO_TITLE
}
