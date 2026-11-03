// =====================================================================
// تست کامل خط لوله رله — فرستنده مستقل → سرور → hexdump بایت‌های ذخیره‌شده
//   ۱) صفحه‌ی هدلس: ضبط MediaRecorder(start(1000)) و آپلود مثل startChannel
//   ۲) نود: poll /media/feeds مثل گیرنده + hexdump init و تکه‌ها
//   ۳) صفحه‌ی دوم: پخش همان بایت‌های دریافتی از سرور با MSE (sequence)
// =====================================================================
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const BASE = 'http://localhost:3000'
const CLASS_ID = 'l2'

async function apiLogin(email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const d = await r.json()
  if (d.user) d.user.mustChangePassword = 0
  return d
}

const t = await apiLogin('reza@demo.ir', '12345678')
await fetch(`${BASE}/api/classes/${CLASS_ID}/start`, { method: 'POST', headers: { Authorization: 'Bearer ' + t.token } })

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
const page = await browser.newPage()
page.on('console', (m) => { const x = m.text(); if (x.startsWith('[SND]')) console.log('  ', x) })
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

/* فرستنده — تقلید دقیق startChannel + uploadChunk */
await page.evaluate(async ({ classId, token }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 48_000 })
  let isInit = true
  rec.ondataavailable = async (e) => {
    if (!e.data?.size) return
    const flag = isInit; isInit = false
    const q = `?k=teacher&init=${flag ? 1 : 0}&mic=1&cam=1&screen=0&fmt=webm&cd=vp8,opus`
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`/api/classes/${classId}/media/up${q}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + token }, body: e.data })
        if (res.ok) { console.log('[SND] up ok init=' + flag + ' size=' + e.data.size); return }
        console.log('[SND] up status=' + res.status)
      } catch (er) { console.log('[SND] up err ' + er.message) }
      await sleep(200)
    }
  }
  rec.start(1000)
  window.__rec = rec
}, { classId: CLASS_ID, token: t.token })

await sleep(9000)

/* گیرنده از دید نود — همان درخواستی که مرورگر دانش‌آموز می‌زند */
const s = await apiLogin('sara@demo.ir', '12345678')
const feeds = await (await fetch(`${BASE}/api/classes/${CLASS_ID}/media/feeds?cur=${encodeURIComponent('{}')}`, { headers: { Authorization: 'Bearer ' + s.token } })).json()
const tf = feeds.teacher
console.log('TEACHER FEED: sess=' + tf.sess + ' seq=' + tf.seq + ' reset=' + !!tf.reset + ' fmt=' + tf.fmt + ' cd=' + tf.cd + ' initLen=' + (tf.init ? tf.init.length : 0) + ' chunks=' + tf.chunks.length)
const hex = (b64, n) => { const bin = Buffer.from(b64, 'base64'); return bin.subarray(0, n).toString('hex').match(/.{2}/g).join(' ') }
console.log('init[0..16]:', hex(tf.init, 16))
for (const c of tf.chunks) console.log('chunk seq=' + c.seq + ' bytes=' + Buffer.from(c.b64, 'base64').length + ' [0..8]=' + hex(c.b64, 8))

/* پخش همان داده‌ی سرور در صفحه‌ی دوم — MSE با sequence */
const page2 = await browser.newPage()
page2.on('console', (m) => { const x = m.text(); if (x.startsWith('[RCV]')) console.log('  ', x) })
await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
const r2 = await page2.evaluate(async (payload) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const b64ToBuf = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer }
  const ms = new MediaSource()
  const v = document.createElement('video')
  v.muted = true; v.autoplay = true; v.playsInline = true
  document.body.appendChild(v)
  v.src = URL.createObjectURL(ms)
  let sb = null
  const queue = []
  const pump = () => { if (!sb || sb.updating || !queue.length) return; try { sb.appendBuffer(queue.shift()) } catch (e) { console.log('[RCV] append-throw ' + e.name) } }
  await new Promise((resolve) => {
    ms.addEventListener('sourceopen', () => {
      sb = ms.addSourceBuffer('video/webm;codecs=vp8,opus')
      try { sb.mode = 'sequence' } catch (e) { console.log('[RCV] mode-fail ' + e.name) }
      sb.addEventListener('updateend', pump)
      sb.addEventListener('error', () => console.log('[RCV] SB-ERROR queue=' + queue.length))
      resolve()
    })
  })
  console.log('[RCV] push init ' + payload.init.length)
  queue.push(b64ToBuf(payload.init))
  pump()
  for (const c of payload.chunks) { queue.push(b64ToBuf(c.b64)); pump(); await sleep(300) }
  await sleep(1200)
  const b = v.buffered
  console.log('[RCV] ranges=' + (b.length ? Array.from({ length: b.length }, (_, i) => b.start(i).toFixed(2) + '-' + b.end(i).toFixed(2)).join('|') : 'EMPTY'))
  if (b.length) { v.currentTime = Math.max(0, b.end(b.length - 1) - 0.55); v.play?.().catch(() => {}) }
  await sleep(1500)
  /* RMS صدا — همان تحلیل e2e */
  v.muted = false
  let rms = -1
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    const actx = new AC()
    const src = actx.createMediaElementSource(v)
    const an = actx.createAnalyser()
    an.fftSize = 1024
    src.connect(an)
    const fbuf = new Float32Array(an.fftSize)
    for (let i = 0; i < 10; i++) {
      await sleep(60)
      an.getFloatTimeDomainData(fbuf)
      let s = 0
      for (let k = 0; k < fbuf.length; k++) s += fbuf[k] * fbuf[k]
      rms = Math.max(rms, Math.sqrt(s / fbuf.length))
    }
  } catch (e) { console.log('[RCV] rms-err ' + e.message) }
  console.log('[RCV] RMS=' + rms.toFixed(4))
  console.log('[RCV] cur=' + v.currentTime.toFixed(2) + ' rs=' + v.readyState + ' vw=' + v.videoWidth)
  return { cur: v.currentTime, vw: v.videoWidth, ranges: b.length, rms }
}, tf)
console.log('RECEIVER RESULT cur=' + r2.cur.toFixed(2) + ' vw=' + r2.vw)
await browser.close()
