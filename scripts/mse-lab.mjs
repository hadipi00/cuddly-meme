// آزمایش ایزوله: آیا تکه‌های MediaRecorder در MediaSource اپند می‌شوند؟
// (segments در برابر sequence + لاگ خطاهای append)
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')

const main = async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--mute-audio'] })
  const ctx = await browser.newContext()
  await ctx.grantPermissions(['camera', 'microphone'], { origin: 'http://127.0.0.1:3000' })
  const page = await ctx.newPage()
  page.on('console', (m) => console.log('[p]', m.text()))
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })

  const result = await page.evaluate(async () => {
    const log = []
    try {
    // کدام MIME در این مرورگر قابل ضبط است؟
    const cands = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    const mime = cands.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } })
    log.push('recMime=' + mime + ' MR=' + (typeof MediaRecorder) + ' MS=' + (typeof MediaSource))
    // ۱) ضبط ۷ تکه از دوربین فیک
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    let rec
    const tries = [
      ['mime+bits', { mimeType: mime, videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 48_000 }],
      ['mime-only', { mimeType: mime }],
      ['default', undefined],
    ]
    for (const [label, opts] of tries) {
      try { rec = new MediaRecorder(stream, opts); log.push('ctor ok: ' + label); break }
      catch (e) { log.push('ctor fail: ' + label + ' → ' + e.name) }
    }
    if (!rec) throw new Error('no ctor worked')
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    rec.start(800)
    await new Promise((r) => setTimeout(r, 6500))
    rec.stop()
    await new Promise((r) => setTimeout(r, 400))
    log.push(`recorded ${chunks.length} chunks, sizes=${chunks.map((c) => c.size).join(',')}`)

    const trial = async (mode) => {
      const MS = window.MediaSource
      const ms = new MS()
      const v = document.createElement('video')
      v.muted = true
      v.src = URL.createObjectURL(ms)
      v.play().catch(() => {})
      await new Promise((r) => ms.addEventListener('sourceopen', r, { once: true }))
      const mime2 = mime.includes('mp4') ? 'video/mp4' : 'video/webm;codecs=vp8,opus'
      const sb = ms.addSourceBuffer(mime2)
      try { sb.mode = mode } catch (e) { log.push(`${mode}: cannot set mode ${e.message}`) }
      const append = (buf) => new Promise((res) => {
        const onEnd = () => { clean(); res('ok') }
        const onErr = () => { clean(); res('error-event') }
        const clean = () => { sb.removeEventListener('updateend', onEnd); sb.removeEventListener('error', onErr) }
        sb.addEventListener('updateend', onEnd, { once: true })
        sb.addEventListener('error', onErr, { once: true })
        try { sb.appendBuffer(buf) } catch (e) { clean(); res('THROW: ' + e.name) }
      })
      for (let i = 0; i < chunks.length; i++) {
        const ab = await chunks[i].arrayBuffer()
        const r = await append(ab)
        const b = v.buffered
        log.push(`${mode} #${i} → ${r} buffered=${b.length ? b.end(b.length - 1).toFixed(2) : '-'} t=${v.currentTime.toFixed(2)} ready=${v.readyState}`)
        if (r !== 'ok') break
      }
      // ۲ ثانیه پخش
      await new Promise((r) => setTimeout(r, 2000))
      const b = v.buffered
      log.push(`${mode} FINAL: t=${v.currentTime.toFixed(2)} bufferedEnd=${b.length ? b.end(b.length - 1).toFixed(2) : '-'} ready=${v.readyState}`)
      try { ms.endOfStream() } catch { /* noop */ }
    }
    await trial('segments')
    await trial('sequence')
    return log
    } catch (e) { log.push('FATAL: ' + e.name + ' ' + e.message + ' @' + (e.stack||'').split('\n')[1]); return log }
  })
  console.log(result.join('\n'))
  await browser.close()
}
main().catch((e) => { console.error('CRASH', e); process.exit(1) })
