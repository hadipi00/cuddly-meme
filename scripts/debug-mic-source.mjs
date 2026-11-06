// آیا فیک‌دِوایس در هدلس اصلاً تُن تولید می‌کند؟ RMS مستقیم از ترک میکروفون
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
const page = await browser.newPage()
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
const rms = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  const src = ctx.createMediaStreamSource(s)
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  src.connect(an)
  const buf = new Float32Array(an.fftSize)
  let peak = 0
  for (let i = 0; i < 20; i++) {
    await sleep(100)
    an.getFloatTimeDomainData(buf)
    let sum = 0
    for (let k = 0; k < buf.length; k++) sum += buf[k] * buf[k]
    peak = Math.max(peak, Math.sqrt(sum / buf.length))
  }
  return { peak, tracks: s.getAudioTracks().length, label: s.getAudioTracks()[0]?.label || '' }
})
console.log('MIC-SOURCE RMS:', JSON.stringify(rms))
await browser.close()
