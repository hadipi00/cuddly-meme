// دو-بخشی: (الف) فایل ضبط‌شده صدا دارد؟ blob مستقیم  (ب) MSE همان فایل
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[T]')) console.log('  ', t) })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const L = (t) => console.log('[T] ' + t)
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 48_000 })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
  rec.start(1000)
  await sleep(6000)
  rec.stop()
  await new Promise((r) => { rec.onstop = r })
  L('chunks=' + chunks.length)

  const rmsOf = async (srcEl) => {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    const src = ctx.createMediaElementSource(srcEl)
    const an = ctx.createAnalyser()
    an.fftSize = 1024
    src.connect(an)
    const fb = new Float32Array(an.fftSize)
    let peak = 0
    for (let i = 0; i < 14; i++) {
      await sleep(60)
      an.getFloatTimeDomainData(fb)
      let s = 0
      for (let k = 0; k < fb.length; k++) s += fb[k] * fb[k]
      peak = Math.max(peak, Math.sqrt(s / fb.length))
    }
    return peak
  }

  /* (الف) blob مستقیم — آیا فایل ضبط‌شده صدا دارد؟ */
  const blob = new Blob(chunks, { type: 'video/webm' })
  const url = URL.createObjectURL(blob)
  const v1 = document.createElement('video')
  v1.muted = false
  v1.playsInline = true
  v1.src = url
  document.body.appendChild(v1)
  await v1.play().catch((e) => L('play1-err ' + e.message))
  await sleep(700)
  /* پرش به انتها که صدای وسط فایل پخش شود */
  try { if (isFinite(v1.duration)) v1.currentTime = Math.max(0, v1.duration - 2.5) } catch { /* noop */ }
  await sleep(300)
  const rmsDirect = await rmsOf(v1)
  L('RMS-direct-blob=' + rmsDirect.toFixed(4) + ' dur=' + (isFinite(v1.duration) ? v1.duration.toFixed(2) : 'Inf'))

  /* (ب) همان تکه‌ها از مسیر MSE */
  const ms = new MediaSource()
  const v2 = document.createElement('video')
  v2.muted = false
  v2.playsInline = true
  document.body.appendChild(v2)
  v2.src = URL.createObjectURL(ms)
  let sb = null
  const q = []
  const pump = () => { if (!sb || sb.updating || !q.length) return; try { sb.appendBuffer(q.shift()) } catch (e) { L('append-throw ' + e.name) } }
  await new Promise((resolve) => {
    ms.addEventListener('sourceopen', () => {
      sb = ms.addSourceBuffer('video/webm;codecs=vp8,opus')
      try { sb.mode = 'sequence' } catch { /* noop */ }
      sb.addEventListener('updateend', pump)
      resolve()
    })
  })
  for (const c of chunks) { q.push(await c.arrayBuffer()); pump(); await sleep(120) }
  await sleep(1000)
  const b = v2.buffered
  if (b.length) { v2.currentTime = Math.max(0, b.end(b.length - 1) - 2.5); v2.play?.().catch(() => {}) }
  await sleep(500)
  const rmsMse = await rmsOf(v2)
  L('RMS-mse=' + rmsMse.toFixed(4))
  return { rmsDirect, rmsMse }
})
console.log('FINAL direct=' + res.rmsDirect.toFixed(4) + ' mse=' + res.rmsMse.toFixed(4))
await browser.close()
