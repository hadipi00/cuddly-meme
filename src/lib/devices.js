/* =====================================================================
 * ابزارهای دستگاه‌های رسانه — انتخاب/تعویض دوربین، میکروفون و اسپیکر
 * ---------------------------------------------------------------------
 * الگوبرداری از صفحهٔ «بررسی تجهیزات» کاویمو: قبل از ورود به کلاس، کاربر
 * پیش‌نمایش زندهٔ دوربین و اندازهٔ صدای میکروفون را می‌بیند و دستگاه‌های
 * دلخواهش را انتخاب می‌کند. انتخاب‌ها در localStorage ذخیره می‌شوند تا
 * کلاس‌های بعدی همان دوربین/میکروفون به‌صورت پیش‌فرض انتخاب شوند.
 * ===================================================================== */

const PREF_KEY = 'modaresyar:devprefs'

/** آخرین دستگاه‌های انتخابی کاربر (دوربین/میکروفون/اسپیکر/ضبط خودکار) */
export const loadDevPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {} } catch { return {} }
}
export const saveDevPrefs = (p) => {
  try {
    const cur = loadDevPrefs()
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...cur, ...p }))
  } catch { /* حالت خصوصی مرورگر */ }
}

/** فهرست دستگاه‌های رسانه با برچسب — بعد از اجازهٔ مرورگر برچسب‌ها واقعی می‌شوند */
export const listMediaDevices = async () => {
  let ds = []
  try { ds = (await navigator.mediaDevices?.enumerateDevices?.()) || [] } catch { /* noop */ }
  const cams = ds.filter((d) => d.kind === 'videoinput' && d.deviceId)
  const mics = ds.filter((d) => d.kind === 'audioinput' && d.deviceId)
  const spkrs = ds.filter((d) => d.kind === 'audiooutput' && d.deviceId)
  return { cams, mics, spkrs }
}

/**
 * باز کردن دوربین با deviceId دقیق + زنجیرهٔ fallback
 * ترتیب: deviceId دقیق → facingMode → هر دوربین — تا هیچ‌وقت بی‌تصویر نماند
 */
export const openCamera = async ({ deviceId, facing, wantAudio = true, w = 1280, h = 720 }) => {
  const base = { width: { ideal: w }, height: { ideal: h } }
  const tries = []
  if (deviceId) {
    tries.push({ ...base, deviceId: { exact: deviceId } })
    tries.push({ ...base, deviceId })
  }
  if (facing) {
    tries.push({ ...base, facingMode: { exact: facing } })
    tries.push({ ...base, facingMode: facing })
  }
  tries.push(base)
  let lastErr = null
  for (const video of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video,
        audio: wantAudio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      })
    } catch (e) { lastErr = e }
  }
  throw lastErr
}

/** باز کردن فقط میکروفون با deviceId دقیق (+fallback بدون محدودیت) — با AGC
 *  autoGainControl: بلندی صدای مدرس ثابت می‌ماند هرچقدر از میکروفون دور شود */
export const openMic = async ({ deviceId } = {}) => {
  const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  const tries = []
  if (deviceId) tries.push({ audio: { deviceId: { exact: deviceId }, ...AUDIO }, video: false })
  tries.push({ audio: AUDIO, video: false })
  let lastErr = null
  for (const t of tries) {
    try { return await navigator.mediaDevices.getUserMedia(t) } catch (e) { lastErr = e }
  }
  throw lastErr
}

/** تشخیص «دوربین مجازی» (OBS/Camo/DroidCam/Iriun/EpocCam/ManyCam) — راه اتصال
 *  دوربین خارجی به کلاس: صحنهٔ OBS ساخته می‌شود و خروجی Virtual Camera همین‌جا
 *  انتخاب می‌شود؛ تصویر ترکیبی (دوربین+اسلاید) به‌عنوان یک دوربین ارسال می‌شود */
export const isVirtualCam = (label) =>
  /obs|virtual|camo|epoccam|droidcam|iriun|vcam|manycam/i.test(String(label || ''))

/**
 * نمایشگر سطح صدای میکروفون (مثل کاویمو) — AudioContext + AnalyserNode
 * onLevel با عدد ۰..۱ صدا زده می‌شود؛ خروجی: تابع توقف
 */
export const startMicMeter = (stream, onLevel) => {
  let ctx = null
  let raf = 0
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return () => {}
    ctx = new AC()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.frequencyBinCount)
    const tick = () => {
      if (!ctx) return
      try { an.getByteTimeDomainData(buf) } catch { /* noop */ }
      let peak = 0
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128)
      try { onLevel(Math.min(1, peak * 1.6)) } catch { /* noop */ }
      raf = requestAnimationFrame(tick)
    }
    tick()
  } catch { /* بدون نمایشگر صدا ادامه می‌دهیم */ }
  return () => {
    cancelAnimationFrame?.(raf)
    try { ctx?.close?.() } catch { /* noop */ }
    ctx = null
  }
}

/** انتخاب خروجی صدا (اسپیکر) روی یک عنصر ویدیو — فقط کروم‌پایه‌ها؛ بقیه بی‌صدا نادیده */
export const applySink = (el, deviceId) => {
  if (!el || !deviceId) return
  try {
    if (typeof el.sinkId === 'undefined') return // سافاری/فایرفاکس — پشتیبانی ندارد
    if (el.sinkId !== deviceId) el.setSinkId?.(deviceId)?.catch?.(() => {})
  } catch { /* noop */ }
}

/** برچسب کوتاه دستگاه برای منوها — برچسب خالی (قبل از اجازه) با شماره جایگزین می‌شود */
export const devLabel = (d, kind, i) =>
  d.label || `${kind} ${i + 1}` // برچسب فارسی در UI ساخته می‌شود؛ اینجا فقط fallback
