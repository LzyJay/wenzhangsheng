/**
 * audit_values.mjs —— 数值对账：CSV ↔ src/data/realms.js（V3.5.2 工程加固）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界：横切脚本（§13.3），只读不写；复用 gen_values.mjs 的同一份组合逻辑
 *       （composeSource），对账双方永不漂——不存在"第二份口径"。
 *
 * 防的是什么：realms.js 是生成物、**禁止手改**（§13.4④ 红线）。此前唯一防线
 *       是"下次生成时被覆盖"，手改后到覆盖前是静默窗口期。本脚本把该红线变成
 *       可随时执行 / 可入回归的自动检查：CSV 重生成结果应与磁盘文件**逐位一致**。
 *
 * 用法：node scripts/audit_values.mjs   → 一致退出 0；不一致列出首个差异行、退出 1。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { composeSource } from './gen_values.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(ROOT, 'src', 'data', 'realms.js')

/** 归一化：生成时间戳是唯一必然逐次不同的行，对账前两边都遮掉 */
function normalize (text) {
  return text.replace(/^ \* 生成时间：.*$/m, ' * 生成时间：<审计时遮蔽>')
}

/**
 * 对账：CSV 组合出的期望源码 ↔ 磁盘上的 realms.js
 * @returns {{ ok: boolean, reason?: string, diffLine?: number, expectedBytes: number, actualBytes: number }}
 */
export function auditValues () {
  const expected = normalize(composeSource())
  let actual = null
  try {
    actual = normalize(fs.readFileSync(OUT, 'utf8'))
  } catch (err) {
    return { ok: false, reason: `读不到生成物：${err && err.message}`, expectedBytes: expected.length, actualBytes: 0 }
  }
  if (actual === expected) return { ok: true, expectedBytes: expected.length, actualBytes: actual.length }

  // 找出第一个差异行，给人工核对定位（文本级逐行比对）
  const a = expected.split(/\r?\n/)
  const b = actual.split(/\r?\n/)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return {
        ok: false,
        reason: 'realms.js 与 CSV 重生成结果不一致（疑似手改，或忘了 npm run gen:values）',
        diffLine: i + 1,
        detail: `期望：${(a[i] || '').trim().slice(0, 120)}\n实际：${(b[i] || '').trim().slice(0, 120)}`,
        expectedBytes: expected.length,
        actualBytes: actual.length
      }
    }
  }
  return { ok: false, reason: '行数不一致', expectedBytes: expected.length, actualBytes: actual.length }
}

// 直接运行：node scripts/audit_values.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = auditValues()
  if (r.ok) {
    console.log(`[audit:values] ✅ 一致：realms.js（${r.actualBytes} 字节）与 CSV 重生成结果逐位相同`)
  } else {
    console.error(`[audit:values] ❌ ${r.reason}`)
    if (r.diffLine != null) console.error(`  首个差异在第 ${r.diffLine} 行：\n  ${r.detail}`)
    console.error('  处置：git checkout src/data/realms.js 撤销手改，或改 CSV 后重跑 npm run gen:values')
    process.exit(1)
  }
}
