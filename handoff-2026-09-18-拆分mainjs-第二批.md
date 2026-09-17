# 交接文档：拆分 main.js 第二批（V3.5.6 进行中）→ 下一会话续做

> 交接时间：2026-09-18 · 交接原因：会话上下文接近上限
> 前一份交接：`handoff-2026-09-16-gongfa-2.1.md`（历史，功法 2.1 收尾；其环境坑与铁律仍有效）

---

## 〇、一句话现状

**「问长生」已完成 V3.5.2~V3.5.5 四个工程加固增量（已提交、已实机点验），正在做 V3.5.6「拆分 main.js 第二批」——8 个面板已全部迁入 `src/ui/`，main.js 从 5334 行降到 3822 行，回归最后一次全绿（1547 项）在最后三处小修之前；尚有 1 处确定的裸引用待修、版本号未升、文档未回写、实机未点验、代码未提交。**

---

## 一、关键路径与角色

| 路径 | 角色 |
|---|---|
| `D:\02 work\小软件\修仙\问长生\` | **git 仓库根**（本会话新建，main 分支） |
| `D:\02 work\小软件\修仙\游戏开发\04-分阶段开发计划\问长生-开发计划V2.md` | **开发计划册（进度唯一权威）**。⚠ 在 git 仓库**外**，文档改动不进 git status；回写义务见其 §十「四件套」 |
| `src/main.js` | 装配层（唯一同时碰 DOM 与 systems；现 3822 行） |
| `src/ui/*Panel.js` | **V3.5.5 新建的面板 UI 层**（共 8 个，见下） |
| `src/systems/` | 纯逻辑层（禁 DOM/Phaser/横向 import）——**本任务不动** |
| `tests/wcs_regress.mjs` | 全量回归入口（当前 29 份自测） |
| `tests/V2整合版-CDP烟测.mjs` | 实机 CDP 烟测（40 项） |
| `scripts/verify_v35x.mjs` | 四条落地（V3.5.2~V3.5.4）实机点验脚本（11 项） |

### src/ui 层规约（已写入各面板头注 + 计划册 §13.3）
- 只碰**本面板自己**的 DOM（dom 引用经 ctx 注入）；
- **禁止 import systems**——system 实例与装配层工具一律经 `create<域>Panel(ctx)` 注入（依赖单向指向装配层）；`state` 在 boot 后引用稳定（重置走整页 reload），可直接捕获；
- **纯数据层 `data/` 可 import**（如 `getItem`、`TIER_MAP`、`TRIBULATION`）；
- 业务规则仍在 systems + data，面板只做「读系统 → 渲染 → 把点击交回系统」。

---

## 二、Git 状态

已提交 7 笔（HEAD = `7a62234`）：

```
7a62234 fix(V3.5.5): 二次实机点验抓到并修复三个面板拆分运行时 bug
e8274a3 feat(V3.5.5): 拆分 main.js 第一批——坊市/灵兽/秘境三面板迁 src/ui/ + BonusLedger 契约修订
549486a fix(V3.5.4): 真机点验抓到 BonusLedger pct 合并口径错误——契约修订为 mul 独立折叠
81a8dec feat(V3.5.4): 单日收益归因台账——EconLedger + 八归因点 + 设置面板视图
e7b7c99 feat(V3.5.3): 统一加成接口——BonusLedger + 五提供方 bonusView + recomposition 对账
6228a19 feat(V3.5.2): 工程加固——存档环形备份+校验和 / 数值对账防手改 / 渲染节流
441dea6 chore: 基线提交（V3.5.1 现状入库）
```

**未提交（= V3.5.6 第二批拆分的全部产物）**：
- 新增 5 个面板：`src/ui/TrialPanel.js`(渡劫232行) / `TechPanel.js`(功法263) / `SectPanel.js`(宗门335) / `BagPanel.js`(行囊140) / `AlchemyPanel.js`(丹房165)
- 修改 `src/main.js`（五区块改薄委托 + boot 注入五面板实例；4761 → **3822 行**）
- 修改 3 份测试的断言扫描范围：`tests/V3.2.2-自测.mjs`、`V3.3.2-自测.mjs`、`V3.5.1-自测.mjs`（迁移代码改扫面板文件）

---

## 三、本会话已完成的事（按序）

1. **V3.5.2 存档加固**：环形备份（`.bak`→`.bak.5`，10 分钟轮转）+ FNV-1a 校验和 + 读档自愈；`scripts/audit_values.mjs` 数值对账（CSV↔realms.js 防手改）；渲染节流（`RENDER_MS=250`/`PANEL_MS=1000`）。
2. **V3.5.3 统一加成接口**：`src/systems/BonusLedger.js` + 五提供方 `bonusView()`（世界/灵根/功法/灵兽/契合）；修为浮层补「世界倍率」行。
3. **V3.5.4 归因台账**：`src/systems/EconLedger.js`（`state.econ` 子树）+ 八归因点（主循环五段快照差值 + doBreakthrough + 两处离线）+ 设置面板「今日收益归因」区块。
4. **两轮实机点验**（WMI 脱离沙箱起 Electron + CDP 9229）：烟测 40/40、四条断言 11/11；**抓到 5 个真 bug 并已修**——①BonusLedger pct 合并口径错（契约修订为每行 `mul`=组内折叠因子、重算=Π(mul)）②③两处 helpers 漏传 `onPress` ④漏 import `getTechnique` ⑤`fmtHoursLeft` 未注入 + BagPanel 裸 `state`。主人存档每轮按 SHA256 还原。
5. **V3.5.5 第一批拆分**（已提交）：坊市/灵兽/秘境三面板迁 `src/ui/`。
6. **V3.5.6 第二批拆分（进行中）**：渡劫/功法/宗门/行囊/丹房五面板已迁出并接线；期间两次切割跨度误删了事件/纪事区块，均靠 `git checkout -- src/main.js` 恢复后用**带长度断言的锚点切割**重做成功（教训见 §六）。

---

## 四、立即要做的（按序，做完即可提交 V3.5.6）

1. **修最后一个确定裸引用**：`src/ui/TechPanel.js:246` 的 `emit('cult:burst', …)` → `H.emit(...)`（helpers 已注入 `emit`）。
2. **核一处疑似误报**：审计报 SectPanel 有裸 `min(`，但 grep `(^|[^.\w'\"])min\(` 无结果——大概率是审计脚本正则误报；跑 `node --check src/ui/SectPanel.js` + 构建 + 实机即可证实。
3. **审计脚本自身有 bug**（如复用需先修）：`tools` 里那段一次性审计脚本解析 import 时只取了**第一个** import 行，多 import 面板会假报 `getItem/getRealmMeta` 等；本会话未把它入库（临时脚本，用完即弃）。
4. `node --check src/ui/*.js` 全过 → `npm run build`（三产物）→ `node tests/wcs_regress.mjs`（**基线 1547 项 / 29 份全绿**；最后三处小修后还没重跑过）。
5. **版本号 3.5.5 → 3.5.6 共 8 处**：`package.json`、`src/systems/SaveSystem.js` 的 `APP_VERSION`（连同注释）、六份自测的版本断言（V3.5 / V3.5.1 / V3.5.2 / V3.5.3 / V3.5.4-自测，各一处 `=== '3.5.5'`）+ **`scripts/verify_v35x.mjs` 里的 `fileVer === '3.5.5'`（两处，含标签文案）**——这个最容易漏。
6. **计划册回写**（`游戏开发/04-分阶段开发计划/问长生-开发计划V2.md`，四件套）：基线总表（版本/行数）、§4.3 验证一览加 V3.5.6 行、§12.2b 版本日志加 V3.5.6 行、§8 工程结构 `src/ui/` 行更新为 8 面板、§13.4⑤ 公共区登记（第二批五面板 + 断言范围同步）。
7. `git add -A && git commit`（消息风格照 `e8274a3`）。
8. **实机点验**（§五的仪式）：预期可能再抓运行时接线 bug（第一批就是这么抓的）——重点点开渡劫/功法/宗门/行囊/丹房五个面板逐个走查（烟测会自动开合全部遮罩）；修完复验全绿再收尾。

之后可选的下一批：纪事/成就面板（2.10 区块，main.js 现存最大块，约 600 行）→ 设置面板。main.js 剩余大头还有 HUD/浮层（TIP_BUILDERS）、主循环、启动时序。

---

## 五、环境与命令（本会话实证过）

```bash
export PATH="/c/Program Files/nodejs:$PATH"        # Git Bash 下必须（node 24.19，本会话装的）
cd "/d/02 work/小软件/修仙/问长生"

node tests/wcs_regress.mjs                          # 全量回归（期望 1547 全绿）
npm run build                                       # vite 三产物（node 24 下无 html-proxy 坑）

# 实机（沙箱内 start/cmd 均会被作业对象回收，必须 WMI 创建）：
SAVE="$APPDATA/问长生/save.json"
cp "$SAVE" "$TEMP/save.backup3.json" && sha256sum "$SAVE"   # 点验前备份留哈希
wmic process call create '"D:\02 work\小软件\修仙\问长生\node_modules\electron\dist\electron.exe" "D:\02 work\小软件\修仙\问长生" --remote-debugging-port=9229'
sleep 10 && curl -s http://127.0.0.1:9229/json/version      # 确认 CDP 活了
node tests/V2整合版-CDP烟测.mjs                      # 期望 40/40
node scripts/verify_v35x.mjs 9229                    # 期望 11/11（版本断言先改成 3.5.6）
# 改代码后刷新实机窗口：Page.reload({ignoreCache:true}) 后等 ~9s 再断言
taskkill //IM electron.exe //F                       # 收尾关窗
cp "$TEMP/save.backup3.json" "$APPDATA/问长生/save.json"    # 按哈希还原主人存档
rm -f "$APPDATA/问长生/save.bak."*                          # 清掉点验产生的环形测试格
```

- **主人存档 SHA256（点验前后必须一致）**：`19e1ec27e4acc918130ab079b924e2a250fe7acdf1157132c872a976e23e8c00`
- 主人手动启动用 `scripts\launch.cmd`（等价 npm start）；CDP 版 `scripts\launch-debug.cmd`。

---

## 六、硬规矩与血泪教训（违者返工）

1. **一切以计划册为准**：分层铁律（§八/§13.1）、`__wcs` 键登记（§13.2⑥）、公共区动前登记（§13.4⑤）、交付四件套回写（§十）、「交付必可运行·实机点验」（§十 第 6 条）。
2. **span 切割必须带长度断言**：`s.find(START)` → `s.find(END, START)` 之间先 `assert 行数在预期区间` 再删。本会话两次因为薄委托单行 `function renderX () { if (panel) … }` 恰好匹配 START 锚点，把中间几百行事件/纪事代码整段删掉——**START 锚点必须带函数体首行**（如 `function renderBag () {\n  if (!state) return`）。
3. **静态断言的扫描范围要跟着面板迁移走**：既有自测大量 grep `main.js` 找落点（`onPress(dom.xxx)`、`sfx('…')`、文案字面量），面板迁出后这些断言要改成扫 `src/ui/<域>Panel.js` 或「main+ui 合并口径」。回归红了先看是不是这类**口径过期**，不是功能回归（§14.2 项 10 惯例）。
4. **逻辑回归测不到运行时接线**（漏传 helper/漏 import 在回归里是绿的）——**实机 CDP 点验是硬必要**，且要点开每个迁移过的面板。
5. 面板内**裸标识符审计**清单化：每次迁完跑一遍「收集 `(?<![.\w$'"])标识符\(` 减去 (本文件定义 ∪ import 名 ∪ ctx 注入 ∪ 全局)」的差集，逐个消灭。
6. 版本号两处同步 + 六份自测断言 + verify 脚本，**升版一次改 8 处**。
7. Electron 在自动化沙箱里**只有 WMI 创建能活**；每次点验前备份存档、结束后按 SHA256 还原（§13.4③ 存档安全）。

---

## 七、验证基线（当前应达到的数字）

| 项 | 基线 |
|---|---|
| 全量回归 | 1547 项 / 29 份 / 0 失败 |
| CDP 烟测 | 40/40（09-18 实跑过；断言已同步到当前口径） |
| 四条落地实机断言 | 11/11（`scripts/verify_v35x.mjs`） |
| `vite build` | 三产物通过（node 24 可用） |
| main.js 行数 | 3822（起点 5334；第一批后 4761） |
| 代码版本 | 当前树内仍为 3.5.5，**待升 3.5.6** |

---

## 八、V3.5.6 完成后的候选方向（供主人拍板）

1. 继续拆：纪事/成就面板（2.10 区块 ~600 行）→ 设置面板 → TIP_BUILDERS 浮层族。
2. §4.4 待办 1：灵石来源复核（用归因台账 `breakthrough` 线的实测数据删过渡逻辑）。
3. §4.4 待办 2/3：事件占比口径定稿 + 护栏首次全线校验（挂满 ≥1 自然日读归因视图）。
4. 阶段四 P4.2~P4.6（开机自启 / DPI / 72h 长挂 / 版本信息 / 发布清单）。

*——交接人：V3.5.2~V3.5.6 会话（2026-09-18）*
