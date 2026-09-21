/**
 * storyRituals.js —— 命运节拍器的**仪式抉择**数据（只读配置层）（V6.6 · 批 B）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《提炼-剧情发展路线》§四 各世界路线卡的「**三个仪式节点**」（每界 3 条，共 36 条）。
 *
 * 口径：
 *   · 条目形状**与 `data/events.js` 的事件完全同构**（`id / cat / quality / name / desc / options[]`），
 *     故可直接走既有事件簿链路：`EventSystem.pushPending(id)` → 面板「关键事件」卡 → `resolvePending()` →
 *     `_resolve()` 结算 → 近事录。**UI 与存档零改动**（这是批 B 选这条路的原因）。
 *   · `quality` 一律 `'jue'`（绝）：绝级超出「稳健 / 均衡」档的自动处置范围 → **玩家亲手抉择**
 *     （仪式节点的意义就在于"这一下是我自己选的"）。
 *   · `effects` 只用既有字段（`qiH / stonesH / luck / fit / buff / repay / gamble / bonus / cause`），
 *     不新增字段；量级控制在 珍~绝 区间（单次 ≤24h 当量），一世 12 次 ≈ 150h，对占比带无影响。
 *   · 每个仪式均由 `StorySystem` 在其**触发卷**推一次（幂等，见 `state.storyState.seen`）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 仪式抉择池（扁平表；`worldId` + `volume` 为触发条件） */
export const STORY_RITUAL_EVENTS = [
  // ══ 01 · 青岚界 ══════════════════════════════════════════════════════
  {
    id: 'story_ql_1', worldId: 'qinglan', volume: 1, cat: 'jiyuan', quality: 'jue', name: '开瓶',
    desc: '月夜，床头那只旧瓶的瓶口凝出一点碧光，聚成一滴碧液。',
    options: [
      { id: 'a', label: '滴进灵田', strategy: 'balanced', hint: '催熟一季药苗，长势喜人（+12h 当量）。', effects: { qiH: 12 } },
      { id: 'b', label: '先留着，等更缺的时候', strategy: 'safe', hint: '好钢用在刃上（气运 +3；因果「一滴碧液」已记）。', effects: { luck: 3, cause: { name: '一滴碧液', val: 1 } } }
    ]
  },
  {
    id: 'story_ql_2', worldId: 'qinglan', volume: 2, cat: 'jiyuan', quality: 'jue', name: '擂台夺丹',
    desc: '升仙擂开，七台并立，两两胜进。台下的算盘声比台上还响。',
    options: [
      { id: 'a', label: '一路藏拙，最后发力', strategy: 'risky', hint: '五成夺丹（+20h），五成止步台中（无所得）。', effects: { gamble: { p: 0.5, win: { qiH: 20 }, lose: {} } } },
      { id: 'b', label: '稳扎稳打，争个中游', strategy: 'safe', hint: '不显山露水，拿一份稳妥份例（+8h）。', effects: { qiH: 8 } },
      { id: 'c', label: '干脆弃赛', strategy: 'balanced', hint: '省下力气，人情却记下了（+4h、契合 +3）。', effects: { qiH: 4, fit: 3 } }
    ]
  },
  {
    id: 'story_ql_5', worldId: 'qinglan', volume: 5, cat: 'jiyuan', quality: 'jue', name: '禁地破禁',
    desc: '禁地五年一开，只放低阶弟子进去，五日即闭。长辈在门外破禁。',
    options: [
      { id: 'a', label: '往深处去', strategy: 'risky', hint: '四成半夺得上药（+28h），否则空手且带伤（−6h）。', effects: { gamble: { p: 0.45, win: { qiH: 28 }, lose: { qiH: -6 } } } },
      { id: 'b', label: '在外围捡漏', strategy: 'balanced', hint: '别人不要的，你收着也够用（+10h）。', effects: { qiH: 10 } },
      { id: 'c', label: '守在门口接应同门', strategy: 'safe', hint: '不出手，只出力（+4h、契合 +4）。', effects: { qiH: 4, fit: 4 } }
    ]
  },

  // ══ 02 · 破晓星域 ════════════════════════════════════════════════════
  {
    id: 'story_px_1', worldId: 'poxiao', volume: 1, cat: 'jiyuan', quality: 'jue', name: '坠崖',
    desc: '你落选了，连记名弟子的名分都没有。崖口的风很大。',
    options: [
      { id: 'a', label: '纵身跃下', strategy: 'risky', hint: '四成让山门记住你的名字（+20h；因果「以死明志」已记），否则重伤（−8h）。', effects: { gamble: { p: 0.4, win: { qiH: 20, cause: { name: '以死明志', val: 1 } }, lose: { qiH: -8 } } } },
      { id: 'b', label: '走到崖边，还是停住了', strategy: 'safe', hint: '活着才有下一次机会（+4h）。', effects: { qiH: 4 } }
    ]
  },
  {
    id: 'story_px_2', worldId: 'poxiao', volume: 2, cat: 'jiyuan', quality: 'jue', name: '夺基之议',
    desc: '有人告诉你，道基不必自己修——可以从别人身上夺。代价写在脸上。',
    options: [
      { id: 'a', label: '夺他一场', strategy: 'risky', hint: '六成一步登阶（+24h），四成被反噬一口（−10h）。', effects: { gamble: { p: 0.6, win: { qiH: 24 }, lose: { qiH: -10 } } } },
      { id: 'b', label: '自己修，慢就慢', strategy: 'safe', hint: '根基是自己的，谁也夺不走（+8h、契合 +3）。', effects: { qiH: 8, fit: 3 } }
    ]
  },
  {
    id: 'story_px_9', worldId: 'poxiao', volume: 9, cat: 'jiyuan', quality: 'jue', name: '踏天',
    desc: '天有九重，你一层一层踏上去。最后一层上，有人在等。',
    options: [
      { id: 'a', label: '踏到最后一级', strategy: 'balanced', hint: '走完这条路（+24h；因果「踏天阶」已记）。', effects: { qiH: 24, cause: { name: '踏天阶', val: 1 } } },
      { id: 'b', label: '就在第八重停下', strategy: 'safe', hint: '有些事认了，心里反而静（+12h、气运 +3）。', effects: { qiH: 12, luck: 3 } }
    ]
  },

  // ══ 03 · 观云界 ════════════════════════════════════════════════════
  {
    id: 'story_dh_1', worldId: 'denghuo', volume: 1, cat: 'jiyuan', quality: 'jue', name: '入门审核',
    desc: '师父领你上山第一天，不教吐纳，先问一句：什么最危险？',
    options: [
      { id: 'a', label: '答「人心最险」', strategy: 'balanced', hint: '师父点头，把《底牌簿》抄本给了你（+8h、契合 +3）。', effects: { qiH: 8, fit: 3 } },
      { id: 'b', label: '答「天劫最险」', strategy: 'safe', hint: '师父摇头，却记你答得实在（+4h、气运 +2）。', effects: { qiH: 4, luck: 2 } }
    ]
  },
  {
    id: 'story_dh_5', worldId: 'denghuo', volume: 5, cat: 'jiyuan', quality: 'jue', name: '助师渡劫',
    desc: '师父要渡劫了。你算好的那几套方案，摊在桌上。',
    options: [
      { id: 'a', label: '先呈第一套', strategy: 'balanced', hint: '稳妥起见，一套一套来（+12h、契合 +4）。', effects: { qiH: 12, fit: 4 } },
      { id: 'b', label: '两套预案一并呈上', strategy: 'risky', hint: '算得越全越耗神（本期 −2h），师父全数采纳（+20h、契合 +6）。', effects: { qiH: 18, fit: 6 } },
      { id: 'c', label: '不掺和，师父自有分寸', strategy: 'safe', hint: '这也是规矩（气运 −1）。', effects: { luck: -1 } }
    ]
  },
  {
    id: 'story_dh_9', worldId: 'denghuo', volume: 9, cat: 'jiyuan', quality: 'jue', name: '终局回山',
    desc: '仗打完了，天还是那个天。你回到那座发育不良的小山头。',
    options: [
      { id: 'a', label: '把预案留给师妹', strategy: 'balanced', hint: '她往后要走的路，你替她算过了（+12h、契合 +5）。', effects: { qiH: 12, fit: 5 } },
      { id: 'b', label: '把预案烧了', strategy: 'risky', hint: '到此为止，不必再算（+24h）。', effects: { qiH: 24 } }
    ]
  },

  // ══ 04 · 青云古界 ════════════════════════════════════════════════════
  {
    id: 'story_qy_3', worldId: 'qingyun', volume: 3, cat: 'jiyuan', quality: 'jue', name: '会武抽签',
    desc: '六十四人抽签，六轮对决。你抽到的签并不好。',
    options: [
      { id: 'a', label: '一站上台就不下来', strategy: 'risky', hint: '五成走满六轮（+24h），否则止步前四（+4h）。', effects: { gamble: { p: 0.5, win: { qiH: 24 }, lose: { qiH: 4 } } } },
      { id: 'b', label: '稳到前四即可', strategy: 'balanced', hint: '全门都记住了你的名字（+12h）。', effects: { qiH: 12 } },
      { id: 'c', label: '第二轮就认输', strategy: 'safe', hint: '你另有打算（+4h、气运 +2）。', effects: { qiH: 4, luck: 2 } }
    ]
  },
  {
    id: 'story_qy_4', worldId: 'qingyun', volume: 4, cat: 'jiyuan', quality: 'jue', name: '滴血洞得天书',
    desc: '深渊之下有座洞府，进去的人没几个回来。',
    options: [
      { id: 'a', label: '往洞底去', strategy: 'risky', hint: '五成得那半卷玉书（+28h；因果「玉书半卷」已记），否则带伤退出（−6h）。', effects: { gamble: { p: 0.5, win: { qiH: 28, cause: { name: '玉书半卷', val: 1 } }, lose: { qiH: -6 } } } },
      { id: 'b', label: '取了铜铃就退', strategy: 'balanced', hint: '传承是别人的，牵挂是你自己的（+10h、契合 +3）。', effects: { qiH: 10, fit: 3 } }
    ]
  },
  {
    id: 'story_qy_9', worldId: 'qingyun', volume: 9, cat: 'jiyuan', quality: 'jue', name: '剑阵对巨鼎',
    desc: '此界无飞升。最后一式过后，剑还在，人已不在。',
    options: [
      { id: 'a', label: '出最后一剑', strategy: 'balanced', hint: '门派会把你的剑供起来（+24h；因果「剑意超脱」已记）。', effects: { qiH: 24, cause: { name: '剑意超脱', val: 1 } } },
      { id: 'b', label: '收剑入鞘', strategy: 'safe', hint: '把剑留给自己（+12h、契合 +5）。', effects: { qiH: 12, fit: 5 } }
    ]
  },

  // ══ 05 · 望族山河 ════════════════════════════════════════════════════
  {
    id: 'story_wz_2', worldId: 'wangzu', volume: 2, cat: 'jiyuan', quality: 'jue', name: '授符种',
    desc: '玄珠符种一代只出一枚。族老争了三天，最后念到你的名字。',
    options: [
      { id: 'a', label: '授给最争气的那个', strategy: 'balanced', hint: '族运为先（+16h、契合 +3）。', effects: { qiH: 16, fit: 3 } },
      { id: 'b', label: '授给最需要的那一个', strategy: 'safe', hint: '有人一辈子就差这一口气（+8h、气运 +4、契合 +5）。', effects: { qiH: 8, luck: 4, fit: 5 } }
    ]
  },
  {
    id: 'story_wz_3', worldId: 'wangzu', volume: 3, cat: 'jiyuan', quality: 'jue', name: '服箓丹',
    desc: '祭萃夺元得来的箓气炼成一枚箓丹。一大境界只可服食一枚。',
    options: [
      { id: 'a', label: '自己服下', strategy: 'balanced', hint: '这一关障立破（+20h）。', effects: { qiH: 20 } },
      { id: 'b', label: '留给族中最小的那个', strategy: 'safe', hint: '他还有很长的路（+10h、契合 +6）。', effects: { qiH: 10, fit: 6 } }
    ]
  },
  {
    id: 'story_wz_4', worldId: 'wangzu', volume: 4, cat: 'jiyuan', quality: 'jue', name: '立祠开府',
    desc: '积蓄两百载，族里终于能立祠堂、开族府了。',
    options: [
      { id: 'a', label: '倾族力立祠', strategy: 'balanced', hint: '读书的出仕，习武的将兵（+24h；因果「族府初立」已记）。', effects: { qiH: 24, cause: { name: '族府初立', val: 1 } } },
      { id: 'b', label: '缓一缓，先保库存', strategy: 'safe', hint: '不急这一年（+10h、气运 +2）。', effects: { qiH: 10, luck: 2 } }
    ]
  },

  // ══ 06 · 幽傩界 ══════════════════════════════════════════════════════
  {
    id: 'story_yn_4', worldId: 'younuo', volume: 4, cat: 'jiyuan', quality: 'jue', name: '起乩请神',
    desc: '你学会借别人的神：请上身，力量是你的，代价也是你的。',
    options: [
      { id: 'a', label: '请上身', strategy: 'risky', hint: '五成借来大力（+24h），否则被反噬（−8h）。', effects: { gamble: { p: 0.5, win: { qiH: 24 }, lose: { qiH: -8 } } } },
      { id: 'b', label: '只借一缕', strategy: 'safe', hint: '够用就好，别让它占了身子（+8h）。', effects: { qiH: 8 } }
    ]
  },
  {
    id: 'story_yn_6', worldId: 'younuo', volume: 6, cat: 'jiyuan', quality: 'jue', name: '登阶献祭',
    desc: '往上一步，需要一样不可逆的东西。',
    options: [
      { id: 'a', label: '献出去', strategy: 'balanced', hint: '一步登阶（+24h）。', effects: { qiH: 24 } },
      { id: 'b', label: '不献，一层层爬', strategy: 'safe', hint: '慢，但身子还是自己的（+8h、气运 +2）。', effects: { qiH: 8, luck: 2 } }
    ]
  },
  {
    id: 'story_yn_9', worldId: 'younuo', volume: 9, cat: 'jiyuan', quality: 'jue', name: '言出法随',
    desc: '此界的规矩是可以被说出来的。你说你是什么，你便是什么。',
    options: [
      { id: 'a', label: '把话说出口', strategy: 'balanced', hint: '宣称即成立（+24h；因果「言出」已记）。', effects: { qiH: 24, cause: { name: '言出', val: 1 } } },
      { id: 'b', label: '不说，认下这条命', strategy: 'safe', hint: '有些话说了就回不去（+10h、契合 +4）。', effects: { qiH: 10, fit: 4 } }
    ]
  },

  // ══ 07 · 通天界 ══════════════════════════════════════════════════════
  {
    id: 'story_tt_1', worldId: 'tongtian', volume: 1, cat: 'jiyuan', quality: 'jue', name: '点香引仙',
    desc: '你点了十三次香，雷就响了十三回。全村人都在看着你。',
    options: [
      { id: 'a', label: '再点一次', strategy: 'risky', hint: '五成引出仙师（+20h），否则淋一场雨（无所得）。', effects: { gamble: { p: 0.5, win: { qiH: 20 }, lose: {} } } },
      { id: 'b', label: '不点了，收拾行李', strategy: 'safe', hint: '该上山了（+6h、气运 +2）。', effects: { qiH: 6, luck: 2 } }
    ]
  },
  {
    id: 'story_tt_2', worldId: 'tongtian', volume: 2, cat: 'jiyuan', quality: 'jue', name: '天道筑基',
    desc: '突破有三档：稳的、标准的、赌的。你得挑一个。',
    options: [
      { id: 'a', label: '选天道档', strategy: 'risky', hint: '四成天地为你改一次规矩（+28h），否则多赔一成家底（−6h）。', effects: { gamble: { p: 0.4, win: { qiH: 28 }, lose: { qiH: -6 } } } },
      { id: 'b', label: '选地道标准档', strategy: 'balanced', hint: '按部就班（+12h）。', effects: { qiH: 12 } },
      { id: 'c', label: '选凡道稳档', strategy: 'safe', hint: '稳是稳，就是慢（+6h、气运 +2）。', effects: { qiH: 6, luck: 2 } }
    ]
  },
  {
    id: 'story_tt_9', worldId: 'tongtian', volume: 9, cat: 'jiyuan', quality: 'jue', name: '长生花',
    desc: '岁月长河上有两朵花。你只能摘一朵。',
    options: [
      { id: 'a', label: '摘下那一朵', strategy: 'balanced', hint: '这一念便成了永恒（+24h；因果「一念永恒」已记）。', effects: { qiH: 24, cause: { name: '一念永恒', val: 1 } } },
      { id: 'b', label: '留给没讲完的那个人', strategy: 'safe', hint: '花还开着（+12h、契合 +6）。', effects: { qiH: 12, fit: 6 } }
    ]
  },

  // ══ 08 · 天工界 ══════════════════════════════════════════════════════
  {
    id: 'story_tg_3', worldId: 'tiangong', volume: 3, cat: 'jiyuan', quality: 'jue', name: '炸仙宫',
    desc: '你造了个会自己走路的东西，让它带着千斤火精贴着仙宫。',
    options: [
      { id: 'a', label: '现在就引爆', strategy: 'balanced', hint: '门槛被硬生生砸下来一截（+24h；因果「传法钟」已记）。', effects: { qiH: 24, cause: { name: '传法钟', val: 1 } } },
      { id: 'b', label: '再等等，先算准角度', strategy: 'safe', hint: '一次到位，不必返工（+14h、气运 +2）。', effects: { qiH: 14, luck: 2 } }
    ]
  },
  {
    id: 'story_tg_4', worldId: 'tiangong', volume: 4, cat: 'jiyuan', quality: 'jue', name: '悬丝拼装',
    desc: '你的魂不在身上，在一根丝上。没头的时候先找头。',
    options: [
      { id: 'a', label: '把丝也种进别人身上', strategy: 'balanced', hint: '从此看得见人心（+16h、契合 +3）。', effects: { qiH: 16, fit: 3 } },
      { id: 'b', label: '只修自己', strategy: 'safe', hint: '自己的身体最要紧（+10h）。', effects: { qiH: 10 } }
    ]
  },
  {
    id: 'story_tg_9', worldId: 'tiangong', volume: 9, cat: 'jiyuan', quality: 'jue', name: '断丝',
    desc: '有人告诉你，你这一生早被安排好了，你只是台上的木偶。',
    options: [
      { id: 'a', label: '扯断那根丝', strategy: 'balanced', hint: '从今往后，剧本自己写（+24h；因果「不做木偶」已记）。', effects: { qiH: 24, cause: { name: '不做木偶', val: 1 } } },
      { id: 'b', label: '装作没听见', strategy: 'safe', hint: '木偶也有木偶的活法（+10h、气运 +3）。', effects: { qiH: 10, luck: 3 } }
    ]
  },

  // ══ 09 · 六面囚笼 ════════════════════════════════════════════════════
  {
    id: 'story_lm_1', worldId: 'liumian', volume: 1, cat: 'jiyuan', quality: 'jue', name: '测灵根',
    desc: '测灵根那天，长老们看着你的结果，客气得反常。',
    options: [
      { id: 'a', label: '接下「老实人」的名头', strategy: 'safe', hint: '这名声往后有用（+6h、气运 +3）。', effects: { qiH: 6, luck: 3 } },
      { id: 'b', label: '当场把话说明白', strategy: 'balanced', hint: '长老们脸色变了，好处却给了（+14h）。', effects: { qiH: 14 } }
    ]
  },
  {
    id: 'story_lm_3', worldId: 'liumian', volume: 3, cat: 'jiyuan', quality: 'jue', name: '宗主一日体验游',
    desc: '执事殿的兑换榜什么都敢写：贡献点、灵液，甚至「当一天宗主」。',
    options: [
      { id: 'a', label: '换「当一天宗主」', strategy: 'balanced', hint: '过足了瘾，还顺手办了件事（+18h；因果「当过一天宗主」已记）。', effects: { qiH: 18, cause: { name: '当过一天宗主', val: 1 } } },
      { id: 'b', label: '换两样最实在的', strategy: 'safe', hint: '灵液与材料，落袋为安（+12h）。', effects: { qiH: 12 } }
    ]
  },
  {
    id: 'story_lm_9', worldId: 'liumian', volume: 9, cat: 'jiyuan', quality: 'jue', name: '自创新境界',
    desc: '此界的境界是被人定的，所以也能被人改。',
    options: [
      { id: 'a', label: '给自己定一个新境界', strategy: 'balanced', hint: '从今天起，有人照着你的名字往上爬（+24h；因果「自创新境」已记）。', effects: { qiH: 24, cause: { name: '自创新境', val: 1 } } },
      { id: 'b', label: '沿用旧境，别惹麻烦', strategy: 'safe', hint: '不折腾也是一种活法（+12h、气运 +3）。', effects: { qiH: 12, luck: 3 } }
    ]
  },

  // ══ 10 · 九鼎九州 ════════════════════════════════════════════════════
  {
    id: 'story_jd_1', worldId: 'jiuding', volume: 1, cat: 'jiyuan', quality: 'jue', name: '迟到的新手礼包',
    desc: '你从州县起步，接的第一件事不是修行，是替人跑一趟腿。',
    options: [
      { id: 'a', label: '认真收下这份差事', strategy: 'balanced', hint: '事不大，人认住了（+8h、契合 +3）。', effects: { qiH: 8, fit: 3 } },
      { id: 'b', label: '转手让给更缺的人', strategy: 'safe', hint: '功德先记你名下（+6h、气运 +4）。', effects: { qiH: 6, luck: 4 } }
    ]
  },
  {
    id: 'story_jd_5', worldId: 'jiuding', volume: 5, cat: 'jiyuan', quality: 'jue', name: '重画九州',
    desc: '你把九州的地图重画了一遍，垄断了百年的东西就摆在桌上。',
    options: [
      { id: 'a', label: '公开出去', strategy: 'balanced', hint: '改变世界的门槛，可以只是一张图（+24h；因果「重画九州」已记）。', effects: { qiH: 24, cause: { name: '重画九州', val: 1 } } },
      { id: 'b', label: '只在小范围传', strategy: 'safe', hint: '稳妥些，也够用（+12h、气运 +2）。', effects: { qiH: 12, luck: 2 } }
    ]
  },
  {
    id: 'story_jd_9', worldId: 'jiuding', volume: 9, cat: 'jiyuan', quality: 'jue', name: '人皇殿欢迎会',
    desc: '此界不许飞升。你在人皇殿前站了一整天。',
    options: [
      { id: 'a', label: '赴这一场', strategy: 'balanced', hint: '来的人比想象中多（+16h、契合 +8）。', effects: { qiH: 16, fit: 8 } },
      { id: 'b', label: '不去，远远看着', strategy: 'safe', hint: '看着就好（+12h、气运 +4）。', effects: { qiH: 12, luck: 4 } }
    ]
  },

  // ══ 11 · 无缺古界 ════════════════════════════════════════════════════
  {
    id: 'story_wy_1', worldId: 'wuyuan', volume: 1, cat: 'jiyuan', quality: 'jue', name: '满阁宝光里的那面旧鉴',
    desc: '别人冲着满阁的宝光去抢法宝，你挑了一面连标价都没有的旧鉴。',
    options: [
      { id: 'a', label: '就收下这面旧鉴', strategy: 'balanced', hint: '最不起眼的那件，陪到最后的往往就是它（+10h；因果「青铜旧鉴」已记）。', effects: { qiH: 10, cause: { name: '青铜旧鉴', val: 1 } } },
      { id: 'b', label: '换一件亮眼的', strategy: 'safe', hint: '眼下确实好用（+14h）。', effects: { qiH: 14 } }
    ]
  },
  {
    id: 'story_wy_2', worldId: 'wuyuan', volume: 2, cat: 'jiyuan', quality: 'jue', name: '一刀无缺',
    desc: '你才第一次听说：同样一个境界，也分走没走满。',
    options: [
      { id: 'a', label: '老老实实走满', strategy: 'balanced', hint: '宁慢一档，不留缺口（+16h；因果「无暇·走满」已记）。', effects: { qiH: 16, cause: { name: '无暇·走满', val: 1 } } },
      { id: 'b', label: '再压一档，赌「无缺」', strategy: 'risky', hint: '五成走到那几百年不见一次的一档（+28h），五成白攒一场（−2h）。', effects: { gamble: { p: 0.5, win: { qiH: 28 }, lose: { qiH: -2 } } } },
      { id: 'c', label: '先过关再说', strategy: 'safe', hint: '缺口以后补（+8h）。', effects: { qiH: 8 } }
    ]
  },
  {
    id: 'story_wy_9', worldId: 'wuyuan', volume: 9, cat: 'jiyuan', quality: 'jue', name: '给那片海起个名字',
    desc: '你把自己最强的那一道，化成了一整片海和天。',
    options: [
      { id: 'a', label: '起个名字，留给后来人', strategy: 'balanced', hint: '人人可练（+24h；因果「一方天地」已记）。', effects: { qiH: 24, cause: { name: '一方天地', val: 1 } } },
      { id: 'b', label: '不留名，安静离开', strategy: 'safe', hint: '像来时那条河上的一片帆（+12h、契合 +6）。', effects: { qiH: 12, fit: 6 } }
    ]
  },

  // ══ 12 · 人间香火 ════════════════════════════════════════════════════
  {
    id: 'story_xh_1', worldId: 'xianghuo', volume: 1, cat: 'jiyuan', quality: 'jue', name: '一笑出门去',
    desc: '师父让你下山走二十年，不为成仙，只为看看。',
    options: [
      { id: 'a', label: '带上那只猫', strategy: 'balanced', hint: '一猫一包袱符，路上有个伴（+10h；因果「三花同行」已记）。', effects: { qiH: 10, cause: { name: '三花同行', val: 1 } } },
      { id: 'b', label: '把猫留在观里', strategy: 'safe', hint: '山门冷清，总要留个活物（+6h、气运 +4、契合 +3）。', effects: { qiH: 6, luck: 4, fit: 3 } }
    ]
  },
  {
    id: 'story_xh_5', worldId: 'xianghuo', volume: 5, cat: 'jiyuan', quality: 'jue', name: '神像皆碎',
    desc: '一夜之间，天下的神像都碎了。香火在谁手里，谁就是神。',
    options: [
      { id: 'a', label: '接下这份民心', strategy: 'balanced', hint: '金身由民心铸（+24h；因果「金身」已记）。', effects: { qiH: 24, cause: { name: '金身', val: 1 } } },
      { id: 'b', label: '退到幕后', strategy: 'safe', hint: '站得越高摔得越重（+10h、气运 +3）。', effects: { qiH: 10, luck: 3 } }
    ]
  },
  {
    id: 'story_xh_9', worldId: 'xianghuo', volume: 9, cat: 'jiyuan', quality: 'jue', name: '传承的交替',
    desc: '二十年满，你回到观里。故人一个一个送别过，山门还是那道山门。',
    options: [
      { id: 'a', label: '接下传承', strategy: 'balanced', hint: '像当年交到师父手上一样（+16h、契合 +8）。', effects: { qiH: 16, fit: 8 } },
      { id: 'b', label: '让给师弟', strategy: 'safe', hint: '他比你更适合守这座山（+10h、气运 +5）。', effects: { qiH: 10, luck: 5 } }
    ]
  }
]

/** 按世界 id + 卷号的索引（`StorySystem` 每次跨卷只查一次） */
export const STORY_RITUALS = (() => {
  const out = {}
  for (const e of STORY_RITUAL_EVENTS) {
    if (!out[e.worldId]) out[e.worldId] = []
    out[e.worldId].push(e)
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.volume - b.volume)
  return out
})()

/** 按事件 id 反查（供 EventSystem.getEvent 兜底；未登记返回 null） */
export function storyEventById (id) {
  if (typeof id !== 'string' || !id) return null
  return STORY_RITUAL_EVENTS.find((e) => e.id === id) || null
}

/** 取某界某卷的仪式抉择；该卷无仪式（或未登记界）返回 null */
export function ritualOf (worldId, volume) {
  const list = STORY_RITUALS[worldId]
  if (!Array.isArray(list)) return null
  return list.find((e) => e.volume === volume) || null
}

/** 该界的仪式所在卷号（升序），供调试与自测 */
export function ritualVolumesOf (worldId) {
  const list = STORY_RITUALS[worldId]
  return Array.isArray(list) ? list.map((e) => e.volume) : []
}

export default { STORY_RITUAL_EVENTS, STORY_RITUALS, storyEventById, ritualOf, ritualVolumesOf }
