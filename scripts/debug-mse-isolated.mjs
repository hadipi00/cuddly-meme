// =====================================================================
// تست ایزوله‌ی خط لوله MSE — بدون سرور، بدون LiveRoom
//   صفحه‌ی هدلس: فیک‌دوربین → MediaRecorder(start(1000)) → تکه‌ها
//   → همان منطق createFeedPlayer (init جدا + کلسترها، sequence mode)
// اگر اینجا هم sb-error بدهد ⇒ مشکل از تکه‌های رکوردر است، نه ماشین حالت LiveRoom
// =====================================================================
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[MSE]') || t.startsWith('[REC]')) console.log('  ', t) })

await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
const result = await page.evaluate(async () => {
  const log = []
  const L = (t) => { log.push(t); console.log('[MSE] ' + t) }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /* ---------- ضبط — دقیقا مثل startChannel در LiveRoom ---------- */
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
  const recMime = 'video/webm;codecs=vp8,opus'
  const rec = new MediaRecorder(stream, { mimeType: recMime, videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 48_000 })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data?.size) { chunks.push(e.data); console.log('[REC] chunk ' + e.data.size) } }
  rec.onerror = (e) => L('rec-error: ' + (e.error?.name || '?'))
  rec.start(1000)
  await new Promise((r) => setTimeout(r, 9000))
  rec.stop()
  await new Promise((r) => { rec.onstop = r })
  L('recorded chunks=' + chunks.length + ' sizes=' + chunks.map((c) => c.size).join(','))

  /* هدر واقعی؟ */
  const u8 = new Uint8Array(await chunks[0].arrayBuffer())
  L('chunk0 magic=' + [u8[0], u8[1], u8[2], u8[3]].map((x) => x.toString(16)).join(' '))

  /* ---------- پخش — همان منطق createFeedPlayer: init جدا، sequence mode ---------- */
  const MS = window.MediaSource
  if (!MS || !MS.isTypeSupported('video/webm;codecs=vp8,opus')) { L('MSE/codec unsupported'); return { log, fail: 'unsupported' } }
  const ms = new MS()
  const v = document.createElement('video')
  v.muted = true
  v.autoplay = true
  v.playsInline = true
  document.body.appendChild(v)
  v.src = URL.createObjectURL(ms)
  let sb = null
  const queue = []
  const pump = () => {
    if (!sb || sb.updating || !queue.length) return
    const buf = queue.shift()
    try { sb.appendBuffer(buf) } catch (e) { L('append-throw: ' + e.name) }
  }
  await new Promise((resolve) => {
    ms.addEventListener('sourceopen', () => {
      sb = ms.addSourceBuffer('video/webm;codecs=vp8,opus')
      try { sb.mode = 'sequence' } catch (e) { L('mode-set-fail: ' + e.name + ' (mode=' + sb.mode + ')') }
      L('sb.mode=' + sb.mode)
      sb.addEventListener('updateend', pump)
      sb.addEventListener('error', () => L('SB-ERROR at queue=' + queue.length))
      /* init = تکه‌ی اول (هدر+کلستر اول) */
      chunks[0].arrayBuffer().then((b) => { queue.push(b); pump() })
      resolve()
    })
  })
  /* بقیه‌ی تکه‌ها با فاصله‌ی واقعی ۱ ثانیه‌ای */
  for (let i = 1; i < chunks.length; i++) {
    const b = await chunks[i].arrayBuffer()
    queue.push(b)
    pump()
    await sleep(1000)
  }
  await sleep(1500)
  const b = v.buffered
  L('buffered ranges=' + (b.length ? Array.from({ length: b.length }, (_, i) => b.start(i).toFixed(2) + '-' + b.end(i).toFixed(2)).join(' | ') : 'EMPTY'))
  L('currentTime=' + v.currentTime.toFixed(2) + ' readyState=' + v.readyState + ' videoWidth=' + v.videoWidth + ' paused=' + v.paused)
  /* پرش به لبه زنده مثل liveEdge */
  if (b.length) { v.currentTime = Math.max(0, b.end(b.length - 1) - 0.55); v.play?.().catch(() => {}) }
  await sleep(2000)
  /* RMS صدا از همان عنصر */
  v.muted = false
  let rms = -1
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    const actx = new AC()
    const src = actx.createMediaElementSource(v)
    const an = actx.createAnalyser()
    an.fftSize = 1024
    src.connect(an)
    const fb = new Float32Array(an.fftSize)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 60))
      an.getFloatTimeDomainData(fb)
      let s = 0
      for (let k = 0; k < fb.length; k++) s += fb[k] * fb[k]
      rms = Math.max(rms, Math.sqrt(s / fb.length))
    }
  } catch (e) { L('rms-err ' + e.message) }
  L('RMS=' + rms.toFixed(4))
  L('after-seek currentTime=' + v.currentTime.toFixed(2) + ' readyState=' + v.readyState)
  return { log, bufferedLen: b.length, cur: v.currentTime, vw: v.videoWidth, rms }
})
console.log('RESULT cur=' + (result.cur || 0).toFixed?.(2) + ' vw=' + result.vw + ' buffered=' + result.bufferedLen)
await browser.close()
