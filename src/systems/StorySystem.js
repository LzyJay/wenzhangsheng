/**
 * StorySystem.js —— 命运节拍器（纯逻辑层）（V6.6 · 批 B）
 * ═══════════════════════════════════════════════════════════════════════════
 * 职责：**玩家跨大境界时，推一条本界专属的「卷首纪事」，仪式卷再附一次有后果的抉择**。
 *   这是「原著感」的结构性来源——一世 9 次卷首 ＋ 每界 3 次仪式（剧情册 §五 挂载点口径）。
 *
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM、**禁止 import 任何 system**；
 *   只读写 state。数据全部来自：
 *     · `src/data/story.js`        —— 卷↔大境映射、卷名、阶段句、开场白、节点（批 A 已备）
 *     · `src/data/storyRituals.js` —— 每界 3 条仪式抉择（与 events.js 的事件条目同构）
 *
 * 存档：**另起一叶** `state.storyState`（懒建兜底、零迁移；**不动** `state.world.specialState`
 *   ——那是世界专属机制的地盘，两边互不覆盖）：
 *   ```js
 *   state.storyState = {
 *     volume: 3,                        // 上次所处卷（0 = 尚未初始化）
 *     seen: { 'qinglan:3': true },      // 已推过的「界:卷」（幂等：回退档 / GM 改级都不重复推）
 *     log: [{ at, worldId, volume, ritual }]   // 推递留痕（自查与调试）
 *   }
 *   ```
 *
 * 跨模块接线（13.1②：一律由 main.js 中转，本文件不 import 任何 system）：
 *   main.js 主循环每拍调 `story.tick()` → 拿到 beat 后分两路落地：
 *     · 卷首叙事 → `achv.push({ ch:'world', q:'zhen', text, note })`（进纪事流，可回看）
 *     · 仪式抉择 → `events.pushPending(beat.ritual.id)`（进事件簿「待抉择」，**UI 零改动**）
 *
 * ⚠ 跨卷检测**必须用卷号 diff**，不能只看 `CultivationSystem` 的 `realmChanged`
 *   （后者是 `level % 9 === 1`，漏掉 71 → 72 这一次跨卷）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  volumeOfLevel, volumeMeta, routeOf, volumeOfWorld,
  volumeNameOf, realmLineOf
} from '../data/story.js'
import { ritualOf } from '../data/storyRituals.js'

class StorySystem {
  /** @param {object} state 存档状态树 */
  constructor (state) {
    this.state = state
  }

  /** 懒建 storyState（老档兜底，零迁移） */
  get ss () {
    const s = this.state
    if (!s.storyState || typeof s.storyState !== 'object') s.storyState = {}
    const ss = s.storyState
    if (typeof ss.volume !== 'number' || !Number.isFinite(ss.volume)) ss.volume = 0
    if (!ss.seen || typeof ss.seen !== 'object') ss.seen = {}
    if (!Array.isArray(ss.log)) ss.log = []
    return ss
  }

  ensure () {
    void this.ss
    return this
  }

  /** 当前世界 id（只读直读、**不经懒建**，照 DungeonSystem.worldId 惯例） */
  get worldId () {
    const w = this.state.world
    return (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : ''
  }

  /** 当前等级 */
  get level () {
    const p = this.state.player
    const lv = p && p.realm ? p.realm.level : 1
    return Number.isFinite(lv) ? lv : 1
  }

  /** 当前所处卷（1~9） */
  get volume () {
    return volumeOfLevel(this.level)
  }

  /** 该「界:卷」是否已推过 */
  seenOf (worldId, volume) {
    return !!this.ss.seen[`${worldId}:${volume}`]
  }

  /**
   * 节拍（每拍调用、幂等）。返回 beat 或 null。
   *   · 首次调用（volume===0）：把当前卷记为基准并**推该卷**——新档即「第 1 卷 · 开瓶」的开场演出；
   *     老档（已高等级）则推其**当前卷**，不追补历史卷（补一串旧纪事反而出戏）。
   *   · 之后只在**卷号变大**时推一次：回退档 / GM 改级 / 同级都不重复推，且每「界:卷」终身只推一次。
   * @returns {null|{worldId,volume,realm,name,realmLine,prologue,note,title,ritual,text,message}}
   */
  tick (now = Date.now()) {
    const ss = this.ss
    const wid = this.worldId
    if (!wid) return null                        // 未抽定世界 → 剧情不启动（不污染通用档）
    const vol = this.volume
    const first = ss.volume === 0
    if (!first && vol <= ss.volume) return null
    ss.volume = vol
    const key = `${wid}:${vol}`
    if (ss.seen[key]) return null                // 幂等
    ss.seen[key] = true
    const beat = this._pack(wid, vol)
    ss.log.push({ at: now, worldId: wid, volume: vol, ritual: beat.ritual ? beat.ritual.id : '' })
    if (ss.log.length > 48) ss.log = ss.log.slice(-48)
    return beat
  }

  /** 打包一条「卷首演出」（该卷若有仪式，则附 ritual 供 main.js 推入事件簿） */
  _pack (wid, vol) {
    const meta = volumeMeta(vol)
    const route = routeOf(wid)
    const v = volumeOfWorld(wid, vol)
    const name = volumeNameOf(wid, vol) || `第${vol}卷`
    const line = v ? v.realmLine : realmLineOf(wid, this.level)
    const prologue = v ? v.prologue : ''
    const beat0 = v && Array.isArray(v.beats) && v.beats.length ? v.beats[0] : null
    const ritual = ritualOf(wid, vol)
    return {
      worldId: wid,
      volume: vol,
      realm: meta ? meta.realm : '',
      name,
      realmLine: line,
      prologue,
      note: beat0 ? `节点：${beat0.title}` : '',
      title: `${route ? route.title : '本界'} · 第${vol}卷「${name}」`,
      ritual: ritual ? { id: ritual.id, name: ritual.name, desc: ritual.desc } : null,
      text: prologue || (beat0 ? beat0.text : ''),
      message: `【${route ? route.title : '本界'}】第${vol}卷「${name}」${line ? '· ' + line : ''}`
    }
  }

  /** 视图（面板 / 调试用：当前卷、阶段句、进度留痕） */
  view () {
    const ss = this.ss
    const wid = this.worldId
    const vol = this.volume
    const meta = volumeMeta(vol)
    const route = routeOf(wid)
    const r = ritualOf(wid, vol)
    return {
      worldId: wid,
      routeTitle: route ? route.title : '',
      volume: vol,
      name: volumeNameOf(wid, vol),
      realm: meta ? meta.realm : '',
      realmLine: realmLineOf(wid, meta ? meta.from : this.level),
      ritual: r ? { id: r.id, name: r.name } : null,
      seenCount: Object.keys(ss.seen).filter((k) => k.startsWith(wid + ':')).length,
      log: ss.log.slice(-6)
    }
  }
}

export default StorySystem
