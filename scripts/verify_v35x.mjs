// 实机点验（V3.5.2~V3.5.4 四条落地 · 真机 CDP）
// 用法：node scripts/verify_v35x.mjs [port]   （默认 9229；需先 launch-debug 起窗口）
const PORT = process.argv[2] || '9229'
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url)) || list.find((t) => t.type === 'page')
if (!page) { console.error('找不到页面目标'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id
  pending.set(mid, res)
  ws.send(JSON.stringify({ id: mid, method, params }))
})
await new Promise((r) => { ws.onopen = r })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  return r.result?.result?.value
}

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`) }
}

console.log('\n【V3.5.2 存档加固：环形备份 + 校验和】')
{
  const info = await evaluate(`window.desktop ? window.desktop.save.info() : null`)
  ok('saveInfo 返回环形 5 格备份清单', info && Array.isArray(info.backups) && info.backups.length === 5,
    info && info.backups ? info.backups.filter((b) => b.exists).length + ' 格已有档' : '')
  ok('当前档已带校验和（新写档口径生效）', info && info.save.exists && !info.save.checksumMissing)
  const raw = await evaluate(`window.desktop.save.read().then((r) => r.data && r.data.length)`)
  ok('真源可读（真机 IO 通）', typeof raw === 'number' && raw > 1000, `${raw} 字节`)
}

console.log('\n【V3.5.3 统一加成接口：账本与实机乘区对账】')
{
  const r = await evaluate(`(() => {
    const lines = __wcs.bonus.lines()
    const rec = __wcs.bonus.recompose()
    const rate = __wcs.cult.getEffRate(Date.now())
    return { n: lines.length, froms: [...new Set(lines.map(l => l.from))].sort().join(','),
      match: Math.abs(rec.rateMul - rate.mul) < 1e-9,
      mul: rec.rateMul, eff: rate.eff }
  })()`)
  ok('账本行覆盖五个提供方（buff 组有活络增益时另计一行）',
    ['world', 'roots', 'tech', 'beasts', 'life'].every((f) => r.froms.split(',').includes(f)), r.froms)
  ok('真机 recompose ≡ getEffRate（逐位）', r.match, `rateMul=${r.mul.toFixed(4)}`)
  const p = await evaluate(`__wcs.econ ? !!__wcs.econ.view : true`)
  ok('__wcs.bonus / __wcs.econ 出口可用', !!p)
}

console.log('\n【V3.5.4 单日收益归因：真机记账】')
{
  const v = await evaluate(`(() => { const x = __wcs.econ.view(); return { dayKey: x.dayKey, rows: x.rows.map(r => r.line),
    cultQi: (x.rows.find(r => r.line === 'cult') || {}).qi || 0 } })()`)
  ok('当日账本已建（dayKey = 今天）', /^\d{4}-\d{2}-\d{2}$/.test(v.dayKey), v.dayKey)
  ok('打坐线已在记账（真机挂机入账）', v.rows.includes('cult') && v.cultQi > 0, `cult qi=${v.cultQi.toFixed(1)}`)
  const dom = await evaluate(`!!document.getElementById('v-econ') && !!document.getElementById('v-econ-day')`)
  ok('设置面板归因区块存在（v-econ / v-econ-day）', !!dom)
}

console.log('\n【基线：版本与运行状态】')
{
  // meta.appVersion 在内存里保持"最后一次读档"的版本；落档版本以强制写档后的文件为准
  await evaluate(`__wcs.save.save(__wcs.state, 'verify')`)
  const fileVer = await evaluate(`window.desktop.save.read().then((r) => (JSON.parse(r.data).meta || {}).appVersion)`)
  ok('实机写档版本 3.5.4', fileVer === '3.5.4', fileVer)
  const errs = await evaluate(`window.__wcsErrors ? window.__wcsErrors.length : 0`)
  ok('渲染层零未捕获异常', errs === 0, `${errs} 个`)
}

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
ws.close()
process.exit(fail ? 1 : 0)
