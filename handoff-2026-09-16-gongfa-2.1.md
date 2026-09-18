# Handoff: 问长生 v0.2.0 · 2.1 功法系统收尾 + 后续模块开发

**Written:** 2026-09-16 20:10 (GMT+8) by 小w（前一 AI 会话，因主人要求收尾交接而中断）
**Repo / cwd:** `D:\02 work\小软件\修仙\问长生\`（无 git —— **无版本控制，任何改动前先自行备份**）
**接手方式：** 主人会把本文档指给你。读完先按「开工前必读」核对理解，再动手。

---

## 〇、开工前必读（主人偏好 + 项目铁律，违反会直接返工）

1. **称呼**：主人叫用户「主人」，语气温暖即可，重点是把事做对。
2. **主人永远是对的**：需求无条件先落地；做不到的如实说明 + 立刻给替代路径，不许编。
3. **实测 > 推断**：所有结论要可验证。测试失败必须逐条归因（是产品 bug 还是测试脚本自身错误），不许含糊放过。
4. **交付节奏（主人定的）**：**一次只做一个模块、不并行、不批量**；每轮交付用简短说明（三行左右）等主人验收，再进下一模块。
5. **主人验收前不算完成**：OS 级行为（鼠标穿透、全局快捷键、真实拖拽）CDP 验不了，要明确列出让主人手验。
6. **文档与代码同步**：改了玩法/数值，同步更新 `游戏开发\04-分阶段开发计划\问长生-开发计划.md`，再用 `scripts/md2html.py` 重新生成同名 HTML。

## 一、Goal & acceptance criteria

**总目标**：继续开发 Electron 挂机修仙游戏「问长生」阶段二。**当前任务：把 2.1 功法系统收尾**（代码已写完并逻辑自测全绿，差真机验证 + 文档 + 打包），然后按主人指令推进后续模块（顺序：2.2 丹药 → 2.4 宗门 → 2.3 事件 → 2.5 渡劫 → 2.6 坊市 → 2.7 秘境 → 2.8 灵兽 → 2.11 寿元天道 → 2.10 成就 → 2.9 卡池）。

**2.1 收尾的验收清单（合同，逐项可验证）：**

- [ ] CDP 真机验证 v0.2.0 全绿（见「Verify by running」，重点：功法遮罩打开/槽位渲染/升级扣灵气灵石/装备卸下/与背包遮罩互斥/Esc 逐层收/拖拽区安全断言/零报错）
- [ ] 主人手验通过：升级按钮真扣资源、装备功法后顶栏「+xx/秒」实时变化
- [ ] `问长生-开发计划.md` 更新至 v0.2.0（补功法实装说明 + 2.1 打勾），并用 `scripts/md2html.py` 重新生成 `V2 问长生-开发计划.html`
- [ ] `electron-builder` 打包 0.2.0（portable + setup），旧 0.1.4 exe 清理前**先问主人**
- [ ] 打包版冒烟：启动、托盘图标、`Ctrl+Alt+Q`、`save.json` 的 `meta.appVersion = 0.2.0`、**主人旧档无损**

## 二、Context & current state

### 项目三层结构（重要）
- `D:\02 work\小软件\修仙\` = 设计库（玩法/数值权威源，只读参考）
- `D:\02 work\小软件\修仙\游戏开发\` = 开发文档（`04-分阶段开发计划\问长生-开发计划.md` 是计划权威源）
- `D:\02 work\小软件\修仙\问长生\` = **代码工程**（你在这里干活）

### 本会话已完成（截至交接）

**A. 三处 UI 小修（主人 09-16 晚指令，代码已落地、未经 CDP 验证）：**
1. 寿元行「破境回满」小字提示已删除（`#life-hint` 元素与样式均已移除）
2. 灵石图标黄点改为文字「灵石」（`index.html:838`，`.stone-key`）
3. 背包按钮上移不盖突破按钮，显示为「背包」两字（`index.html:848`，`#btn-bag.q-pill`）

**B. 2.1 功法系统（代码完成 + 逻辑自测 231 项全绿 + vite build 通过）：**

| 文件 | 内容 |
|---|---|
| `src/data/techniques.js` | 17 本功法数据表（tech_yinqi / zaling / changchun / liuhuo / hanquan / liuyun / gengjin / baicao / houtu / qingmu / liyan / hanbing / jingang / zhoutian / bumie / taixu / huntian），品阶 TIER_MAP，槽位定义，`levelCost`（凡品 lv→lv+1 = 30×1.45^(lv-1) 灵气 + 灵石），`maxRatePct` 等 |
| `src/systems/TechniqueSystem.js` | equip / unequip / upgrade / summary / catalog / levelOf / ratePct / unlocked / ensureStarter。规则：**1 级即生效**（加成 = rateAddPctPerLevel × level）；换装自动卸下旧功法；同一功法不能占两槽；槽位解锁 main=开局、side0=金丹、side1=元婴 |
| `src/systems/CultivationSystem.js` | `getEffRate()` 已接入功法乘区：`mul = 灵根 × (1 + Σbuff% + Σ功法%)`，`parts.technique` 可观测；constructor 第三参收 tech 实例 |
| `src/systems/SaveSystem.js` | `:72 player.techniqueSlots = { main: null, side: [null, null] }`；`:83-86 techniques.ownedTechniques = {}`（**等级真源在 ownedTechniques[id].level，装备关系在 player.techniqueSlots**）；APP_VERSION = 0.2.0 |
| `src/main.js` | `:19,23` 导入；`:45 let tech`；`:111 techOverlay`；`:628-630` 渲染循环节流刷新（techTick 每 10 拍）；`:832,:1488` 开局 ensureStarter（初始功法 tech_yinqi）；`:1029-1042` openTech/closeTech（与背包互斥）；`:1056 renderTech`（槽位区 + 目录区）；`:1205-1244` 遮罩内事件委托（data-upgrade / data-equip / data-unequip）；`:1434` Esc 顺序：明细浮层→背包→功法→设置→测灵根；`:1460` 实例化；`:1572 window.__wcs = { game, state, cult, roots, tech, save }` 调试句柄 |
| `index.html` | `:898-912 #tech-overlay`（复用背包遮罩骨架 `.ov`，含 #tech-note 脚注）；样式与 `#bag-overlay` 同族 |
| `package.json` | version = 0.2.0 |

**C. 逻辑自测（全在 `C:\Users\Administrator\AppData\Local\Temp\wcs_*.mjs`，纯 Node 直跑 systems 层）：**
- `wcs_selftest.mjs` 39 项（数值公式）/ `wcs_selftest2.mjs` 47 项（灵根+存档+单位+三态默认）/ `wcs_selftest3.mjs` 44 项 / `wcs_geom.mjs` 20 项（视觉几何）/ `wcs_selftest4.mjs` **81 项（功法，本轮新增）** —— **合计 231 项，2026-09-16 20:05 实测全绿**
- `wcs_cdp.mjs / cdp2 / cdp3` 是 CDP 真机驱动脚本（cdp3 覆盖 v0.1.4 的 62 项含拖拽区安全 9 条；**尚未为 0.2.0 功法 UI 写 CDP 用例**）

**D. 尚未做（= 你要做的）：** CDP 验证 0.2.0、开发计划文档更新、打包、（可选）rebuild 后把 release 里 0.1.4 换 0.2.0。

### 关键设计规则（写代码时别违反）
- **颜色语义铁律**：一套颜色=一个含义（`index.html` `:root` 注释有表）——鎏金=修为/灵石/主序、灵玉=寿元/生机/增益、灵紫=灵根、劫红=劫难/失败、警示橙=减益与阈值、青蓝=系统消息。功法 UI 用的品质色在 `TIER_MAP`。
- **数值源铁律**：`src/data/realms.js` 是生成物（`npm run gen:values` 从 CSV 生成），**禁手改**。
- **节点语义**：`breakthrough` = 离开本级时的关口（三/六重=小瓶颈、九重=渡劫、72 级=飞升）。
- **产出口径**：《数值与公式手册》「加成率加法叠加」；功法满配 ≈ ×7.5，在设定书「功法倍率 1~10」预算内（上限写死在 techniques.js 注释里）。
- **拖拽区铁律（血泪）**：`#mid`/`#topbar` 是 `-webkit-app-region: drag`，浮层必须挂进拖拽区内部标 `no-drag`，且**浮层一开整窗取消拖拽区**（`syncDragRegions()` 维护 `body.no-drag-all`，`render()` 兜底）。CDP `el.click()` 测不出这种 OS 级问题，结构断言在 cdp3 里有样板。
- **分层铁律**：main.js=装配层（唯一同时碰 DOM 与 systems）｜ systems=纯逻辑 ｜ scenes=只演出 ｜ data=纯配置。跨层用 `game.events`。
- **禁 TS**、不加 `"type": "module"`、主进程/preload 强制 CJS。

## 三、Constraints & verification

**Must not：**
- 不许动主人存档真源 `%APPDATA%\问长生\save.json`（测试时新建 state 对象，别写盘）
- 不许并行做多个模块、不许把 0.1.4 exe 静默删除（先问主人）
- 不许改 `修仙\` 设计库与 `游戏开发\` 里历史文档的内容（计划文档只允许「版本增量」式追加）
- 破坏性操作（删文件、覆盖、退出进程）必须先向主人显式确认

**本机环境坑（必看，否则命令直接失败）：**
- Bash 预置 `ELECTRON_RUN_AS_NODE=1` → 启动 Electron 必须 `env -u ELECTRON_RUN_AS_NODE`
- vite/npm/build 受 safe-delete 钩子干扰 → 必须加 `env -u CODEBUDDY_SAFE_DELETE_SANDBOX -u CODEBUDDY_SAFE_DELETE_REPORT_PATH`
- electron-builder 必设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 和 `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`
- 杀进程用 `MSYS_NO_PATHCONV=1 taskkill /F /IM electron.exe`（或 `问长生.exe`）；打包版进程名叫 `问长生.exe`
- node 用托管版：`export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:$PATH"`

**Verify by running（全部实测过）：**

```bash
# ① 逻辑自测（231 项，应全绿）
export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:$PATH"
cd "C:/Users/Administrator/AppData/Local/Temp"
for f in wcs_selftest.mjs wcs_selftest2.mjs wcs_selftest3.mjs wcs_geom.mjs wcs_selftest4.mjs; do
  node "$f" 2>&1 | grep -a -E "通过 |❌"
done

# ② 构建（应 ✓ built）
cd "D:/02 work/小软件/修仙/问长生"
env -u CODEBUDDY_SAFE_DELETE_SANDBOX -u CODEBUDDY_SAFE_DELETE_REPORT_PATH npx vite build

# ③ 启动应用（CDP 验证用；主人屏幕上会出现 420×320 小窗）
env -u ELECTRON_RUN_AS_NODE -u CODEBUDDY_SAFE_DELETE_SANDBOX ./node_modules/electron/dist/electron.exe . --remote-debugging-port=9222
# 然后 Node WebSocket 连 http://127.0.0.1:9222/json 驱动（参考 Temp 里 wcs_cdp3.mjs 的写法；
# CDP 方法论与坑见技能 C:\Users\Administrator\.workbuddy\skills\electron-ui-headless-verify\SKILL.md）

# ④ 打包（收尾时执行）
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
cd "D:/02 work/小软件/修仙/问长生"
env -u ELECTRON_RUN_AS_NODE -u CODEBUDDY_SAFE_DELETE_SANDBOX -u CODEBUDDY_SAFE_DELETE_REPORT_PATH npx electron-builder --win --x64

# ⑤ 打包版冒烟：跑 release/win-unpacked/问长生.exe，读 %APPDATA%\问长生\save.json
#    核对 meta.appVersion=0.2.0、主人旧档数据（筑基五重/洗髓丹等）未被清掉
```

## 四、Suggested plan（建议，非命令；读完代码后可自行调整）

1. **先跑 ①② 确认基线全绿**（交接时的状态）。
2. **写 `wcs_cdp4.mjs`**（抄 cdp3 骨架）覆盖 v0.2.0：三处 UI 小修断言（无 #life-hint、灵石为文字、背包按钮为「背包」文本且不遮突破按钮）+ 功法遮罩全流程（打开→17 本目录渲染→升级按钮→装备/卸下→槽位解锁文案→与背包互斥→Esc 顺序→拖拽区安全→零报错）。注意：升级会扣资源，用 `window.__wcs` 直接构造或测完把 state 还原（勿写盘）。
3. 全绿后向主人汇报（简短），请主人手验：升级扣费、装备后 `+xx/秒` 变化、背包键不挡突破按钮。
4. 更新 `问长生-开发计划.md`（v0.2.0 增量 + 2.1 打勾 + 版本日志行），`python scripts/md2html.py <md> <html>` 重新生成 HTML（python 用 `C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe`）。
5. 打包 0.2.0 + 冒烟（见 ④⑤）。
6. 问主人是否清掉 release 里 0.1.4 旧 exe。
7. 主人验收后 → 等主人指令进 2.2 丹药系统（**不要自作主张开新模块**）。

## 五、风险与已知事项

- 上一轮曾出现过 **1 次未复现的偶发**（v0.1.4 时背包首次打开失败，连跑 6 次不再出现）——如实记录在案，若 CDP 中再遇到要追查而非略过。
- 会话曾因 429 限流中断一次（主人说「继续」后接上），无遗留损坏；交接前已复核全部自测与构建。
- `Temp` 目录里的测试脚本没有备份，**建议接手后立刻把 `wcs_*.mjs` 拷一份进项目**（如 `D:\02 work\小软件\修仙\问长生\tests\`），机器清 Temp 就没了。
- 主人长期项目记忆在 `C:\Users\Administrator\WorkBuddy\Try\.workbuddy\memory\MEMORY.md`（含更全的项目铁律），可交叉阅读，但以本文档 + 设计库文档为准。
