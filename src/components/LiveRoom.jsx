import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DataIcon } from '../utils/icons'
import Icon from './Icon'
import { Avatar } from './ui'
import { Modal } from './Modal'
import { useApp } from '../store/AppContext'
import { faNum } from '../utils/format'
import { req, getToken } from '../services/http'

/**
 * اتاق کلاس زنده — رله رسانه با «دو کانال مستقل» (بدون WebRTC)
 * ---------------------------------------------------------------------
 * چرا رله؟ WebRTC حتی با TURN رایگان پشت NAT اپراتور موبایل گیر می‌کند و
 * «بی‌صدا» شکست می‌خورد. اینجا صدا/تصویر با MediaRecorder به تکه‌های ۰٫۵
 * ثانیه‌ای webm شکسته می‌شود و از همان مسیر HTTP چت عبور می‌کند:
 *   • ارسال:  POST /media/up  (binary) — دو کانال: دوربین + اشتراک صفحه
 *   • دریافت: GET  /media/feeds?cur=…  (polling با کرسر — ۴۵۰ms)
 *
 * [بازسازی F36] چه چیزهایی عوض شد:
 *   • اشتراک صفحه فید مستقل دارد (k=teacher&screen=1) — دوربین موازی ادامه
 *     دارد؛ دانش‌آموز هم‌زمان تخته/صفحه را بزرگ و مدرس را در نوار پایین می‌بیند
 *   • بیت‌ریت تطبیقی: اینترنت ضعیف → کیفیت پله‌پله پایین می‌آید تا تاخیر
 *     زنده رشد نکند (قبلاً صف آپلود عقب می‌ماند و تصویر چندثانیه‌ای عقب می‌افتاد)
 *   • تمام‌صفحه واقعی کل اتاق (صحنه + چت + کنترل‌ها) + fallback شبه‌فول‌اسکرین
 *     با کلاس pseudo-fs — قبلاً آن کلاس هرگز ست نمی‌شد و فول‌اسکرین عملاً کار نمی‌کرد
 *
 * قواعد مهم:
 *   • صدا/تصویر مدرس → همه • صدا/تصویر دانش‌آموز → فقط با اجازه مدرس
 *     (گیت سمت سرور: بدون can_speak، آپلود ۴۰۳ می‌خورد)
 *   • دکمه میکروفون/دوربین فقط track.enabled را عوض می‌کند — رله قطع نمی‌شود
 *   • تعویض دوربین با facingMode دقیق (جلو/عقب موبایل) + fallback چندمرحله‌ای
 *   • وایت‌برد: علاوه بر SSE، polling مستقل دارد → حتی با پروکسی بافر لایو است
 *   • پس‌زمینه تخته: عکس یا صفحه‌ای از PDF + نوشتن روی آن
 * variant: 'teacher' | 'student'
 */

const WB_W = 1600
const WB_H = 900
const PEN_COLORS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#d97706']
const PEN_SIZES = [3, 6, 12]

/* ================= ابزارهای رله رسانه ================= */

let FEED_PID = 0 // شناسه یکتای هر پلیر — برای تشخیص تعویض پلیر در state

const b64ToBuf = (b64) => {
  const bin = atob(b64)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u.buffer
}

/** MediaSource یا ManagedMediaSource (iOS ۱۷+) — برای پخش تکه‌ها */
const getMS = () => {
  if (window.MediaSource) return window.MediaSource
  if (window.ManagedMediaSource) return window.ManagedMediaSource
  return null
}

/** بهترین MIME پخش برای قالب استریم فرستنده (webm در کروم، mp4 در سافاری)
 *  روی مرورگرهای بدون MediaSource (iOS قدیمی) null می‌شود → پلیر جایگزین بلابی */
const SRC_CONTAINERS = { webm: 'video/webm', mp4: 'video/mp4' }
/* فال‌بک فقط داخل «همان قالبِ» فرستنده مجاز است — استریم webm هرگز نباید با
 * MIME mp4 پخش شود (سافاری MIME mp4 را «پشتیبانی‌شده» اعلام می‌کند ولی بایت‌های
 * webm را رد می‌کند → اپند شکست → پخش برای همیشه می‌میرد) */
const SRC_FALLBACKS = {
  webm: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'],
  mp4: ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4'],
}
const pickSrcMime = (fmt, cd) => {
  const MS = getMS()
  if (!MS) return null
  const cont = SRC_CONTAINERS[fmt] || 'video/webm'
  const list = []
  /* کدک‌های واقعی فرستنده اول — ترکیب ترک‌ها ممکن است فقط ویدیو یا فقط صدا باشد */
  if (cd) list.push(`${cont};codecs=${cd}`)
  list.push(cont, ...(SRC_FALLBACKS[fmt === 'mp4' ? 'mp4' : 'webm']))
  for (const m of list) {
    try { if (MS.isTypeSupported(m)) return m } catch { /* noop */ }
  }
  return null // این مرورگر قالبِ واقعی فرستنده را نمی‌پخشد → پلیر بلابی
}

/** بهترین MIME ضبط (MediaRecorder) + قالب آن — سافاری فقط mp4 ضبط می‌کند */
const REC_MIMES = [
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
  ['video/mp4', 'mp4'],
]
const pickRecMime = () => {
  if (!window.MediaRecorder) return null
  for (const [m, fmt] of REC_MIMES) {
    try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, fmt } } catch { /* noop */ }
  }
  return null
}

/**
 * پلیر یک استریم رله‌شده — تکه‌ها به ترتیب در MediaSource می‌ریزند،
 * پخش روی «لبه زنده» نگه داشته می‌شود و حافظه تمیز می‌شود.
 * attach ایدمپوتنت است (تغییر وضعیت دوربین دیگر ویدیو را سیاه نمی‌کند) و
 * قبل از اتصال به عنصر تازه، عنصر قبلی آزاد می‌شود (جابه‌جایی صحنه↔نوار).
 */
function createFeedPlayer(fmt, cd) {
  const mime = pickSrcMime(fmt, cd)
  if (!mime) return createBlobPlayer(fmt)
  const p = {
    mime, fmt, cd, el: null, objUrl: null, ms: null, sb: null, sess: null,
    queue: [], alive: true, keepT: null, broken: false, pid: ++FEED_PID, lastRebuildAt: 0,
    sbFails: 0, rebuilds: 0, recovers: 0, pendingRebuild: false, mode: 'mse',
    firstPushAt: 0, lastPushAt: 0,
  }
  /* [دیباگ F37-e] لاگ سبک برای تشخیص گیرکردن پلیر در مرورگر واقعی */
  const dbg = (ev, extra = '') => {
    try {
      const w = typeof window !== 'undefined' ? window : null
      if (!w) return
      ;(w.__liveLog = w.__liveLog || [])
      w.__liveLog.push(`${p.pid}|${ev}${extra ? '|' + extra : ''}`)
      if (w.__liveLog.length > 3000) w.__liveLog.splice(0, w.__liveLog.length - 3000)
    } catch { /* noop */ }
  }
  dbg('create', `mime=${mime}`)

  let lastBreak = 0
  let lastRecoverAt = 0
  let lastBufEnd = -1
  let lastBufChangeAt = Date.now()

  /* ================= [فیکس F37-e] قانون طلایی اتصال =================
   * هر MediaSource در تمام عمرش فقط به «یک» عنصر ویدیو بسته می‌شود.
   * اتصال دوباره‌ی یک MS جداشده به عنصر دوم در کروم، پایپ‌لاین را می‌شکند
   * (sourceopen شلیک می‌شود ولی append بعدی decode-error می‌دهد — باگ
   * «پلیر بعد از تعویض صحنه/جابه‌جایی برای همیشه می‌میرد»؛ ریشه‌ی
   * شکنندگی MSE هنگام اتصال). پس:
   *   • rebuild → فقط یک MS «باز» می‌سازد و pid تازه می‌دهد (→ tile با
   *     عنصر ویدیوی نو remount می‌شود؛ کلید tile شامل pv است)
   *   • bind → تنها جای el.src است و فقط وقتی MS هنوز باز است */

  const bind = () => {
    if (!p.alive || !p.el || !p.ms || p.objUrl) return
    try {
      p.objUrl = URL.createObjectURL(p.ms)
      p.el.src = p.objUrl
      p.el.play?.().catch(() => {})
      dbg('bind', `rs=${p.el.readyState}`)
    } catch { /* noop */ }
  }

  /** خودترمیمی سطح ۱ — خطای decode/اپند → SourceBuffer تازه روی «همان» MS و عنصر:
   *  ارزان، بدون remount و بدون پارگی پخش. اگر MS دیگر open نبود یا
   *  addSourceBuffer شکست خورد → سطح ۲ (breakStream → rebuild کامل) */
  const softRecover = (why) => {
    if (!p.alive || p.mode === 'blob') return
    const t = Date.now()
    if (t - lastRecoverAt < 2500) return
    lastRecoverAt = t
    p.recovers += 1
    dbg('soft-recover', `${why} n=${p.recovers}`)
    p.queue = []
    try { p.sb?.abort?.() } catch { /* noop */ }
    try { if (p.ms && p.sb) p.ms.removeSourceBuffer(p.sb) } catch { /* noop */ }
    p.sb = null
    if (p.ms && p.ms.readyState === 'open') {
      try {
        p.sb = p.ms.addSourceBuffer(p.mime)
        try { p.sb.mode = 'sequence' } catch { /* noop */ } // گپ تایم‌استمپ هرگز sb-error نمی‌دهد
        p.sb.addEventListener('updateend', pump)
        p.sb.addEventListener('error', () => softRecover('sb-error'))
        p.broken = false
        /* کرسر همین فید صفر → سرور در poll بعدی init + تکه‌های تازه می‌فرستد */
        try { p.onNeedReset?.() } catch { /* noop */ }
        return
      } catch (e1) {
        dbg('soft-fail', e1?.name || '?')
        p.sb = null
      }
    }
    breakStream('soft-failed:' + why)
  }

  /** خودترمیمی سطح ۲ — کرسر گیرنده صفر → سرور init تازه → rebuild کامل با عنصر نو */
  const breakStream = (why) => {
    dbg('break', why)
    if (!p.alive || Date.now() - lastBreak < 2500) return
    lastBreak = Date.now()
    p.broken = true
    try { p.onNeedReset?.() } catch { /* noop */ }
  }

  const rebuild = (sess) => {
    /* ضد توفان — rebuild همگام زنجیره‌ای ممنوع؛ حداقل ۷۰۰ms فاصله
       (هم‌اندازه‌ی تکه‌ها). اگر زودتر خواسته شود، برای push بعدی صف می‌شود */
    if (Date.now() - (p.lastRebuildAt || 0) < 700) { p.pendingRebuild = true; return }
    /* [فیکس F37-e] شمارنده با هر «پیشرفت واقعی بافر» صفر می‌شود (نگهبان) —
       پس این آستانه فقط برای زنجیره‌ی ترمیم‌های بی‌نتیجه است، نه عمر پلیر */
    if (p.rebuilds > 3) { fallbackToBlob('too-many-rebuilds'); return }
    dbg('rebuild', `sess=${sess} hasEl=${!!p.el} msWas=${p.ms?.readyState} n=${p.rebuilds + 1}`)
    p.rebuilds += 1
    p.sess = sess
    p.queue = []
    p.broken = false
    p.pendingRebuild = false
    p.lastRebuildAt = Date.now()
    /* تخلیه‌ی کامل منابع MediaSource قبلی — هیچ MS بازی نشت نمی‌کند */
    try { p.sb?.abort?.() } catch { /* noop */ }
    p.sb = null
    try { if (p.ms && p.ms.readyState === 'open') p.ms.endOfStream?.() } catch { /* noop */ }
    p.ms = null
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
    p.objUrl = null
    /* [فیکس F37-e] pid تازه → feedInfo.pv عوض → کلید tile عوض → RelayVideo با
       «عنصر ویدیوی نو» mount می‌شود و attach، MS نو را به همان عنصر نو می‌بندد */
    p.pid = ++FEED_PID
    const MS = getMS()
    if (!MS) return
    const ms = new MS()
    p.ms = ms
    ms.addEventListener('sourceopen', () => {
      if (!p.alive || p.ms !== ms) return
      if (p.sb) return // کروم در شرایط خاص sourceopen را دوباره شلیک می‌کند
      dbg('sourceopen')
      try {
        p.sb = ms.addSourceBuffer(p.mime)
        try { p.sb.mode = 'sequence' } catch { /* noop */ }
        p.sb.addEventListener('updateend', pump)
        p.sb.addEventListener('error', () => softRecover('sb-error'))
        pump()
      } catch (e) {
        dbg('sb-add-throw', e?.name || '?')
        p.sbFails += 1
        p.sb = null
        if (p.sbFails >= 2) fallbackToBlob('addsourcebuffer-fails') // فال‌بک سریع — تعویق فقط فریز طولانی‌تر می‌سازد
      }
    })
    /* [فیکس F37-e] اتصال عمداً اینجا انجام نمی‌شود — فقط attach/keepT می‌بندد */
  }

  /* ================= فال‌بک نهایی — پلیر Blob =================
   * اگر MSE در این مرورگر/موقعیت مدام شکست بخورد (QuotaExceeded مزمن و …)،
   * کلاس هرگز نباید بمیرد: همان شیء پلیر به پلیر Blob تبدیل می‌شود —
   * هدر + ۱۲ تکه‌ی آخر هر ~۳ ثانیه یک Blob تازه پخش می‌شود (تاخیر بیشتر ولی کار می‌کند) */
  const fallbackToBlob = (why) => {
    if (p.mode === 'blob') return
    dbg('fallback-blob', why)
    clearInterval(p.keepT)
    try { p.sb?.abort?.() } catch { /* noop */ }
    try { if (p.ms && p.ms.readyState === 'open') p.ms.endOfStream?.() } catch { /* noop */ }
    p.sb = null
    p.ms = null
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
    p.objUrl = null
    const bp = createBlobPlayer(fmt)
    /* [فیکس F37-d] پلیر Blob «نمای» (facade) می‌شود — delegate به bp؛ pid تازه →
     * feedInfo عوض می‌شود → RelayVideo دوباره attach می‌کند */
    bp.el = p.el
    p.mode = 'blob'
    p.pid = bp.pid
    p.broken = false // پرچم شکستگی MSE نباید پلیر Blob را هم گرسنه کند
    p.push = (...a) => bp.push(...a)
    p.hardReset = (...a) => bp.hardReset(...a)
    p.attach = (...a) => bp.attach(...a)
    p.liveEdge = () => {}
    p.destroy = () => { p.alive = false; bp.destroy() }
    try { p.onNeedReset?.() } catch { /* noop */ } // کرسر صفر → سرور init تازه بفرستد
  }

  const pump = () => {
    if (!p.sb || p.sb.updating || !p.queue.length || !p.alive || p.mode === 'blob') return
    const buf = p.queue.shift()
    try {
      p.sb.appendBuffer(buf)
    } catch (e0) {
      dbg('append-throw', e0?.name || '?')
      /* [فیکس F37-e] ترمیم با sb.remove اینجا ممنوع — remove روی SourceBuffer در
       * حالت sequence با webm در کروم معیوب است و خودش decode-error بعدی می‌سازد
       * (مرگ ~۲۵ ثانیه‌ای پلیر در تست واقعی: اولین trim → اولین sb-error).
       * کروم پشتِ currentTime را خودش auto-evict می‌کند؛ اینجا فقط ترمیم ساختاری */
      p.queue.unshift(buf)
      softRecover('append-throw:' + (e0?.name || '?'))
    }
  }
  /** تکه تازه — اگر سشن عوض شده بود، خودکار از نو ساخته می‌شود */
  p.push = (sess, b64) => {
    if (!p.alive || !b64) return
    const t0 = Date.now()
    if (!p.firstPushAt) p.firstPushAt = t0
    p.lastPushAt = t0
    /* فشار صف — گیرنده‌ی عقب‌مانده (شبکه‌ی کند) قربانی حافظه نشود */
    if (p.queue.length > 40) {
      dbg('queue-overflow')
      p.queue = []
      p.broken = true
      try { p.onNeedReset?.() } catch { /* noop */ }
      return
    }
    if (p.sess !== sess) { dbg('sess-change', `${p.sess}→${sess}`); rebuild(sess) }
    else if (p.pendingRebuild && t0 - (p.lastRebuildAt || 0) >= 700) rebuild(sess)
    const buf = b64ToBuf(b64)
    p.queue.push(buf)
    pump()
  }
  /** شروع از سر (گپ یا تازه‌وارد) — همیشه MediaSource تازه ساخته می‌شود؛
   *  چون init دوباره می‌آید و افزودن دوباره‌ی init به SourceBuffer قبلی، دکودر را
   *  برای همیشه می‌شکند (باگ «تصویر بعد از یک گپ دیگر نمی‌آید»)
   *  [فیکس F37-d] اما اگر «همین سشن» هنوز سالم در حال پخش است، هاردریست ممنوع —
   *  هر reset تکراری سرور (پس از هر breakStream) یک rebuild تازه می‌ساخت و
   *  حلقه‌ی مرگ rebuild/reset می‌ساخت. خروجی false یعنی «ریست لازم نبود» */
  p.hardReset = (sess) => {
    /* fresh = rebuild همین چند صدهزارم ثانیه پیش انجام شده و sourceopen هنوز در راه است */
    const fresh = Date.now() - (p.lastRebuildAt || 0) < 1200
    if (p.sess === sess && (p.sb || fresh) && !p.broken) {
      dbg('hardReset-skip', `sess=${sess} sb=${!!p.sb} fresh=${fresh}`)
      return false
    }
    p.queue = []
    rebuild(sess)
    return true
  }
  /* [فیکس F37-e] attach — قانون یک‌MS-یک‌عنصر:
   *  • عنصر تازه از React (بعد از هر remount) می‌آید؛ MS بازی به عنصر دوم
   *    بسته نمی‌شود — یا MS هنوز باز است (bind) یا MS تازه ساخته می‌شود */
  p.attach = (el) => {
    if (!el || p.el === el || !p.alive) return
    dbg('attach', `hadEl=${!!p.el} ms=${p.ms ? p.ms.readyState : 'null'} bound=${p.objUrl ? 1 : 0}`)
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    p.el = el
    if (!p.ms) return // اولین push هنوز نیامده — bind در keepT بعد از اولین rebuild
    if (p.objUrl) {
      /* MS قبلاً به عنصر دیگری بسته بوده — MS تازه لازم است؛ سرور تا ~۱ ثانیه
         init + تکه‌های تازه می‌فرستد (پارگی ~۱ ثانیه‌ای فقط هنگام جابه‌جایی صحنه↔نوار) */
      try { p.onNeedReset?.() } catch { /* noop */ }
      rebuild(p.sess)
      return
    }
    bind()
    /* [فیکس F37-e] محافظ گیرکردن اتصال — عنصر تازه تا ۲ ثانیه دیتا نگرفت →
     * MS از نو ساخته می‌شود (نه اتصال دوباره‌ی همان MS) */
    setTimeout(() => {
      try {
        if (p.alive && p.mode !== 'blob' && p.el === el && el.readyState < 1 && p.objUrl) {
          dbg('attach-stall')
          p.objUrl = null
          try { p.onNeedReset?.() } catch { /* noop */ }
          rebuild(p.sess)
        }
      } catch { /* noop */ }
    }, 2000)
  }
  p.destroy = () => {
    p.alive = false
    clearInterval(p.keepT)
    try { p.sb?.abort?.() } catch { /* noop */ }
    try { if (p.ms && p.ms.readyState === 'open') p.ms.endOfStream?.() } catch { /* noop */ }
    try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    p.el = null
    p.sb = null
    p.ms = null
    p.queue = []
  }
  /* نگه‌داشتن پخش روی «لبه زنده» — تاخیر هدف ≈۱ ثانیه
   * • تازه‌وارد: از انتهای بافر شروع کن (پخش قدیمی‌ها از ابتدای سشن ممنوع)
   * • عقب‌ماندگی > ۱.۲ ثانیه: جبران با پرش به لبه */
  p.liveEdge = () => {
    const el = p.el
    if (!el || el.readyState < 1 || !p.alive) return
    try {
      const b = el.buffered
      if (!b.length) return
      const end = b.end(b.length - 1)
      /* [دیباگ] قفل‌شدن پمپ با صف پُر — قلب گیرکردن پلیر */
      if (p.sb && !p.sb.updating && p.queue.length) dbg('pump-stall', `q=${p.queue.length} end=${end.toFixed(2)} cur=${el.currentTime.toFixed(2)} ms=${p.ms?.readyState}`)
      if (el.currentTime <= b.start(0) + 0.05 || end - el.currentTime > 1.2) {
        dbg('seek', `to=${Math.max(0, end - 0.55).toFixed(2)} start=${b.start(0).toFixed(2)} end=${end.toFixed(2)} cur=${el.currentTime.toFixed(2)} rs=${el.readyState}`)
        el.currentTime = Math.max(0, end - 0.55)
      }
      if (el.paused) el.play?.().catch(() => {})
    } catch { /* noop */ }
  }
  /* [فیکس F37-e] چشم‌به‌راه پیشرفت — دو نگهبان در یک تایمر:
   *  ۱) تازه‌واردِ بی‌دکود: pushes می‌رسند ولی حتی یک فریم دکود نشده (end<0)
   *     → بعد از ۸ ثانیه فال‌بک Blob (شکنندگی MSE هنگام join هرگز فریز ابدی نمی‌شود)
   *  ۲) رکود بافر: بافر ۶ ثانیه رشد نکرده → فال‌بک Blob
   *  و هر پیشرفت واقعی، بودجه‌ی ترمیم (rebuilds/recovers/sbFails) را صفر می‌کند */
  const watchdog = () => {
    if (!p.alive || p.mode === 'blob') return
    try {
      const el = p.el
      const b = el?.buffered
      const end = b?.length ? b.end(b.length - 1) : -1
      if (end !== lastBufEnd) {
        if (end > lastBufEnd) { p.rebuilds = 0; p.recovers = 0; p.sbFails = 0 }
        lastBufEnd = end
        lastBufChangeAt = Date.now()
        return
      }
      const t = Date.now()
      if (end < 0) {
        if (p.firstPushAt && t - p.firstPushAt > 8000 && t - p.lastPushAt < 12000) fallbackToBlob('no-decode-since-join')
        return
      }
      if (t - lastBufChangeAt > 6000 && t - (p.lastRebuildAt || 0) > 6000 && t - lastRecoverAt > 6000) fallbackToBlob('buffered-stalled')
    } catch { /* noop */ }
  }
  p.keepT = setInterval(() => {
    bind() // [فیکس F37-e] پل مسیر «rebuild قبل از attach» — اتصال تنها وقتی MS هنوز باز است
    p.liveEdge()
    watchdog()
  }, 700)
  return p
}

/**
 * پلیر جایگزین برای مرورگرهای بدون MediaSource (سافاری iOS قدیمی‌تر از ۱۷٫۱)
 * و فال‌بک نهایی MSE: [فیکس F37-e] «لگ ذاتی Blob» ریشه‌اش این بود که «همه‌ی»
 * تکه‌ها از ابتدای سشن جمع می‌شدند (تا سقف ۳۰MB) و هر بار کل آن Blob از نو
 * ساخته و از سر پخش می‌شد — هرچه کلاس طولانی‌تر، rebuild سنگین‌تر و پرش به
 * لبه‌ی زنده دیرتر. حالا:
 *   • هدر (init) جدا نگه داشته می‌شود و هر Blob = هدر + فقط ۱۲ تکه‌ی آخر (~۱۲ ثانیه)
 *   • حافظه ثابت می‌ماند؛ rebuild همیشه سبک و سریع است
 *   • بعد از هر rebuild پرش به لبه‌ی زنده → تاخیر مؤثر ≈۰٫۵-۳ ثانیه
 */
function createBlobPlayer(fmt) {
  const p = {
    mime: null, fmt, mode: 'blob', el: null, objUrl: null, sess: null, alive: true,
    initBuf: null, parts: [], bytes: 0, dirty: false, buildT: null, onNeedReset: null, pid: ++FEED_PID,
  }
  const MAX_PARTS = 12 // پنجره‌ی سرگردان ~۱۲ ثانیه‌ای (تکه‌های ~۱ ثانیه‌ای)
  /** هدر واقعی؟ webm → جادوی EBML • mp4 → باکس ftyp در آفست ۴ */
  const looksHdr = (buf) => {
    if (!buf || buf.byteLength < 12) return false
    const u = new Uint8Array(buf)
    if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return true
    return String.fromCharCode(u[4], u[5], u[6], u[7]) === 'ftyp'
  }
  const rebuild = () => {
    if (!p.el || !p.parts.length || !p.alive) return
    if (!p.initBuf) return // بدون هدر هیچ — Blob ناقص هرگز پخش نمی‌شود
    try {
      if (p.objUrl) URL.revokeObjectURL(p.objUrl)
      const blob = new Blob([p.initBuf, ...p.parts], { type: p.fmt === 'mp4' ? 'video/mp4' : 'video/webm' })
      p.objUrl = URL.createObjectURL(blob)
      p.el.src = p.objUrl
      p.el.play?.().catch(() => {})
      /* پرش به لبه زنده — webm ضبط‌شده duration=Infinity دارد؛
       * پرش فقط با buffered.end درست کار می‌کند (duration قابل اعتماد نیست) */
      p.el.addEventListener('loadedmetadata', () => {
        try {
          const el = p.el
          if (!el) return
          const b = el.buffered
          if (el.duration && isFinite(el.duration) && el.duration > 1) el.currentTime = Math.max(0, el.duration - 0.4)
          else if (b.length) el.currentTime = Math.max(0, b.end(b.length - 1) - 0.4)
          el.play?.().catch(() => {})
        } catch { /* noop */ }
      }, { once: true })
      /* اگر loadedmetadata به‌خاطر Infinity دیر بماند، با اولین دیتا بپر */
      p.el.addEventListener('loadeddata', () => {
        try {
          const el = p.el
          if (!el || el.currentTime > 1) return
          const b = el.buffered
          if (b.length && b.end(b.length - 1) > 2) el.currentTime = Math.max(0, b.end(b.length - 1) - 0.4)
        } catch { /* noop */ }
      }, { once: true })
    } catch { /* noop */ }
  }
  p.push = (sess, b64) => {
    if (!p.alive || !b64) return
    const buf = b64ToBuf(b64)
    if (looksHdr(buf)) {
      /* هدر تازه (شروع سشن جدید فرستنده) — پنجره از نو */
      p.initBuf = buf
      if (p.sess !== sess) { p.sess = sess; p.parts = []; p.bytes = 0 }
      p.dirty = true
      return
    }
    if (p.sess !== sess) { p.sess = sess; p.parts = []; p.bytes = 0 }
    p.parts.push(buf)
    p.bytes += buf.byteLength
    while (p.parts.length > MAX_PARTS) p.parts.shift() // [فیکس F37-e] پنجره‌ی سرگردان — حافظه ثابت
    p.dirty = true
  }
  p.hardReset = (sess) => {
    /* [فیکس F37-d] true = «ریست واقعی شد» — وگرنه applyFeed دسته‌ی init+تکه‌های
     * reset را دور می‌ریزد و پلیر Blob گرسنه می‌ماند */
    p.sess = null
    p.parts = []
    p.bytes = 0
    p.initBuf = null
    p.dirty = true
    return true
  }
  p.attach = (el) => {
    if (!el || p.el === el || !p.alive) return
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    p.el = el
    p.dirty = true
  }
  p.destroy = () => {
    p.alive = false
    clearInterval(p.buildT)
    try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    p.el = null
    p.parts = []
    p.initBuf = null
  }
  p.buildT = setInterval(() => {
    if (p.dirty && p.el && p.alive) { p.dirty = false; rebuild() }
  }, 3000)
  return p
}

/** تیکر مبتنی بر Web Worker — setInterval در تب مخفی به‌شدت throttle می‌شود
 *  (پولینگ رسانه می‌میرد و تصویر دانش‌آموز پس از سوییچ تب فریز می‌شود)؛
 *  تایمر داخل Worker از این throttle معاف است و همیشه دقیق تیک می‌زند */
function createTicker(ms, fn) {
  let w = null
  try {
    const src = 'let id=null;onmessage=(e)=>{if(e.data.cmd==="start"){clearInterval(id);id=setInterval(()=>postMessage(1),e.data.ms)}}'
    w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
    w.onmessage = () => { try { fn() } catch { /* noop */ } }
    w.postMessage({ cmd: 'start', ms })
  } catch { /* Worker نبود — fallback به setInterval معمولی */
    w = null
    const id = setInterval(fn, ms)
    return { stop: () => clearInterval(id) }
  }
  return { stop: () => { try { w.terminate() } catch { /* noop */ } } }
}

/** ویدیوی یک شرکت‌کننده با استریم محلی — ویدیو همیشه mount می‌ماند؛
 *  خاموشی دوربین فقط یک لایه روی تصویر می‌گذارد (تا srcObject با باز/بستن از دست نرود) */
function VideoTile({ stream, self, name, camOn, color, big }) {
  const ref = useRef(null)
  const hasVid = !!stream && stream.getVideoTracks().length > 0
  useEffect(() => {
    const v = ref.current
    if (v && stream) {
      if (v.srcObject !== stream) v.srcObject = stream
      v.play?.().catch(() => {})
    }
  }, [stream, camOn])
  return (
    <div className={`cam-tile ${big ? 'big' : ''} ${self ? 'self' : ''}`}>
      {stream && hasVid ? (
        <>
          <video ref={ref} autoPlay playsInline muted={!!self} style={camOn === false ? { visibility: 'hidden' } : undefined} />
          {camOn === false && <div className="cam-off cam-off-ov"><Avatar name={name || '؟'} color={color || 'grad-1'} size={big ? 64 : 34} /></div>}
        </>
      ) : (
        <div className="cam-off"><Avatar name={name || '؟'} color={color || 'grad-1'} size={big ? 64 : 34} /></div>
      )}
      <span className="ct-name">{name}{self ? ' (شما)' : ''}</span>
      {stream && !hasVid ? null : camOn === false && <span className="ct-off"><Icon name="camera" size={11} /> خاموش</span>}
    </div>
  )
}

/** پیش‌نمایش اشتراک صفحه خودم */
function ScreenPreview({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (v && stream) { v.srcObject = stream; v.play?.().catch(() => {}) }
  }, [stream])
  if (!stream) {
    return <div className="live-screen-mock"><Icon name="monitor" /><b>صفحه در حال اشتراک است</b></div>
  }
  return <video ref={ref} autoPlay playsInline muted className="wb-canvas" style={{ background: '#000', objectFit: 'contain' }} />
}

/* سیاست autoplay موبایل: با اولین لمس کاربر در صفحه، صدای همه استریم‌های در انتظار فعال می‌شود.
 * [فیکس F37-e] پرچم userInteracted — بعد از اولین تعامل، تازه‌واردان (remount پس از
 * هر rebuild پلیر) مستقیم با صدا پخش می‌شوند؛ کاربر نباید بعد از هر ترمیم دوباره بزند */
let userInteracted = false
const pendingUnmute = new Set()
if (typeof document !== 'undefined' && !pendingUnmute.armed) {
  pendingUnmute.armed = true
  document.addEventListener('pointerdown', () => {
    userInteracted = true
    for (const fn of [...pendingUnmute]) { try { fn() } catch { /* noop */ } }
  }, { passive: true })
}

/** ویدیوی یک استریمِ رله‌شده (مدرس یا هم‌کلاسی):
 *  ۱) همیشه ابتدا «بی‌صدا» پخش می‌شود — autoplay بی‌صدا در همه مرورگرها مجاز است،
 *     پس تصویر مدرس قطعاً نمایش داده می‌شود (باگ اصلی «هیچی برای دانش‌آموز نمی‌آمد»)
 *  ۲) صدا با اولین لمس/کلیک کاربر فعال می‌شود (سیاست autoplay مرورگرها)
 *  ۳) پلیر یا MSE است یا بلابی (پشتیبانی همه مرورگرها از جمله iOS قدیمی) */
function RelayVideo({ player, name, color, camOff, screen, big }) {
  const ref = useRef(null)
  const [needTap, setNeedTap] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v || !player || !player.alive) return // پلیر مرده → منتظر پلیر تازه از polling
    player.attach(v)
    /* فعال‌سازی صدا: اگر کاربر قبلاً تعامل کرده مستقیم وصل می‌شود؛
     * وگرنه بی‌صدا شروع کن (autoplay بی‌صدا همیشه مجاز است) تا اولین لمس */
    const unmute = () => {
      const vv = ref.current
      if (!vv) return
      vv.muted = false
      vv.play?.().then(() => { setNeedTap(false); pendingUnmute.delete(unmute) }).catch(() => { vv.muted = true; setNeedTap(true) })
    }
    if (userInteracted) unmute()
    else {
      v.muted = true
      v.play?.().catch(() => {})
      pendingUnmute.add(unmute)
      setNeedTap(true)
    }
    return () => { pendingUnmute.delete(unmute) }
  }, [player, camOff])
  const unmuteNow = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    setNeedTap(false)
    v.play?.().catch(() => { v.muted = true; setNeedTap(true) })
  }
  return (
    <div className={`cam-tile ${big ? 'big' : ''}`}>
      {player ? (
        <>
          <video ref={ref} autoPlay playsInline style={{ ...(screen ? { objectFit: 'contain' } : null), ...(camOff ? { visibility: 'hidden' } : null) }} />
          {camOff && <div className="cam-off cam-off-ov"><Avatar name={name || '؟'} color={color || 'grad-1'} size={big ? 64 : 34} /></div>}
        </>
      ) : (
        <div className="cam-off"><Avatar name={name || '؟'} color={color || 'grad-1'} size={big ? 64 : 34} /></div>
      )}
      <span className="ct-name">{screen ? 'اشتراک صفحه — ' : ''}{name}</span>
      {!camOff && needTap && (
        <button className="tap-unmute" onClick={unmuteNow}>🔊 کلیک برای فعال شدن صدا</button>
      )}
    </div>
  )
}

function PermissionCard({ state, permBusy, diag, onRequest, onSkip, inIframe, onOpenTab, onGoHttps, needsApproval, handSent }) {
  const dv = diag?.videoCount ?? 0
  const da = diag?.audioCount ?? 0
  const errName = diag?.lastError || ''
  const seesDevices = dv + da > 0
  return (
    <div className="perm-overlay">
      <div className="perm-card">
        <div className="perm-ico"><Icon name="camera" size={30} /></div>
        <b style={{ fontSize: 15.5 }}>فعال‌سازی دوربین و میکروفون</b>

        {needsApproval ? (
          <>
            <p className="muted small" style={{ lineHeight: 1.9 }}>
              برای روشن کردن دوربین و میکروفون باید <b>مدرس اجازه بدهد</b> — بدون اجازه، صدا و تصویر شما برای کلاس ارسال نمی‌شود.
            </p>
            {handSent ? (
              <p className="small" style={{ color: '#d97706', lineHeight: 1.9, textAlign: 'center' }}>
                ✋ درخواست شما برای مدرس ارسال شد — به‌محض تایید، دوربین و میکروفون به‌صورت خودکار فعال می‌شود.
              </p>
            ) : (
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onRequest}>
                <Icon name="hand" size={17} /> درخواست اجازه از مدرس (بلند کردن دست)
              </button>
            )}
          </>
        ) : (
          <>
            {state === 'idle' && (
              <p className="muted small" style={{ lineHeight: 1.9 }}>
                برای گفتگوی تصویری زنده، روی دکمه زیر بزنید؛ پنجره‌ای از مرورگر باز می‌شود —
                <b> «اجازه دادن / Allow» </b> را انتخاب کنید.
              </p>
            )}

            {state === 'denied' && (
              <p className="small" style={{ color: 'var(--red)', lineHeight: 1.9, textAlign: 'right' }}>
                {inIframe
                  ? 'سایت داخل قاب پیش‌نمایش است و مرورگر اجازه دوربین در قاب را نمی‌دهد — با دکمه زیر کلاس را در پنجره کامل باز کنید.'
                  : 'دسترسی رد شده است. روی آیکون قفل/کلید کنار آدرس سایت بزنید، دوربین و میکروفون را روی «اجازه دادن» بگذارید و دوباره تلاش کنید.'}
              </p>
            )}

            {state === 'busy' && (
              <p className="small" style={{ color: 'var(--red)', lineHeight: 1.9, textAlign: 'right' }}>
                دوربین/میکروفون توسط برنامه دیگری اشغال شده است — Zoom، Skype، Teams یا هر برنامه دیگری که از دوربین استفاده می‌کند را ببندید و دوباره تلاش کنید.
              </p>
            )}

            {state === 'nodevice' && (
              <>
                <p className="small" style={{ color: 'var(--red)', lineHeight: 1.9, textAlign: 'right' }}>
                  {seesDevices
                    ? 'مرورگر دستگاه‌هایی را می‌بیند ولی اجازه استفاده از آن‌ها را نمی‌دهد — معمولاً تنظیمات حریم خصوصی سیستم‌عامل یا اشغال بودن دستگاه است.'
                    : 'مرورگر روی این دستگاه هیچ دوربین یا میکروفونی پیدا نکرد. این موارد را بررسی کنید:'}
                </p>
                <ul className="small" style={{ textAlign: 'right', lineHeight: 2.1, paddingInlineStart: 20, margin: '4px 0 10px', color: 'var(--text-2)' }}>
                  <li>اگر از داخل اپ پیام‌رسان (تلگرام، اینستاگرام…) باز کرده‌اید، لینک را در <b>Chrome</b> یا <b>Safari</b> اصلی باز کنید.</li>
                  <li>ویندوز: <b dir="ltr">Settings → Privacy & security → Camera / Microphone</b> را برای مرورگر روشن کنید.</li>
                  <li>وب‌کم خارجی را بررسی کنید و برنامه‌های دیگر (Zoom/Skype) را ببندید.</li>
                  <li>دستگاه شما واقعاً دوربین ندارد؟ کلاس را بدون دوربین ادامه دهید — چت و تخته فعال است.</li>
                </ul>
              </>
            )}

            {state === 'insecure' && (
              <p className="small" style={{ color: 'var(--red)', lineHeight: 1.9 }}>
                مرورگر فقط در آدرس امن (HTTPS) اجازه دوربین می‌دهد. با دکمه زیر به آدرس امن بروید.
              </p>
            )}

            {state === 'insecure' ? (
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onGoHttps}>
                <Icon name="maximize" size={17} /> رفتن به آدرس امن (HTTPS)
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={permBusy} onClick={onRequest}>
                {permBusy ? 'در حال انتظار برای پاسخ مرورگر…' : (
                  <><Icon name="video" size={17} /> {state === 'idle' ? 'درخواست دسترسی دوربین و میکروفون' : 'تلاش دوباره'}</>
                )}
              </button>
            )}

            {errName ? (
              <span className="muted" style={{ fontSize: 10.5 }}>
                کد خطا: <b dir="ltr">{errName}</b> • دوربین‌های شناسایی‌شده: {faNum(dv)} • میکروفون‌ها: {faNum(da)}
              </span>
            ) : null}
          </>
        )}

        {inIframe && state !== 'denied' && (
          <>
            <p className="muted small" style={{ lineHeight: 1.9 }}>
              اگر پنجره اجازه باز نشد، سایت داخل قاب پیش‌نمایش است — کلاس را در پنجره جداگانه باز کنید:
            </p>
            <button className="btn btn-ghost btn-sm" onClick={onOpenTab}>
              <Icon name="maximize" size={15} /> باز کردن کلاس در پنجره جدید
            </button>
          </>
        )}

        {onSkip && state !== 'insecure' && (
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={onSkip}>
            ادامه بدون دوربین — چت، وایت‌برد و حاضران فعال است
          </button>
        )}
      </div>
    </div>
  )
}

export default function LiveRoom({ variant = 'teacher', classInfo }) {
 const isTeacher = variant === 'teacher'
 const { user, toast, startLive, endLive } = useApp()
 const nav = useNavigate()
 const me = user?.name || (isTeacher ? 'مدرس' : 'دانش‌آموز')
 const classId = classInfo?.liveId || classInfo?.id
 const userIdRef = useRef(null)
 userIdRef.current = user?.id

 /* ---------- کنترل‌های رسانه ---------- */
 const [mic, setMic] = useState(isTeacher)
 const [cam, setCam] = useState(isTeacher)
 const [screen, setScreen] = useState(false)
 const [board, setBoard] = useState(false)
 const [recording, setRecording] = useState(false)
 const [recSecs, setRecSecs] = useState(0)
 const [hand, setHand] = useState(false)
 const [endedModal, setEndedModal] = useState(false)
 const [tab, setTab] = useState('chat')
 const [, setTick] = useState(0)

 const micRef = useRef(true); micRef.current = mic
 const camRef = useRef(true); camRef.current = cam
 const screenRef = useRef(false); screenRef.current = screen
 const localStreamRef = useRef(null)
 const screenTrackRef = useRef(null)
 const screenStreamRef = useRef(null)
 const [localStream, setLocalStream] = useState(null)
 const [mediaErr, setMediaErr] = useState(null) // 'denied' | 'nodevice' | 'busy' | 'insecure'
 const [permBusy, setPermBusy] = useState(false)
 const [mediaDiag, setMediaDiag] = useState({ videoCount: 0, audioCount: 0, lastError: null })
 const [mediaSkipped, setMediaSkipped] = useState(false)
 const canSpeakRef = useRef(false) // اجازه فعال صدا/تصویر (مدرس همیشه true)
 const switchingRef = useRef(false)
 const facingRef = useRef('user')
 const devicesRef = useRef([])
 /* [فیکس F37-b] لیست دوربین‌ها به‌صورت state — برای «انتخابگر دوربین» در نوار کنترل */
 const [camDevices, setCamDevices] = useState([])
 const [camDeviceId, setCamDeviceId] = useState('')
 const camDeviceIdRef = useRef('')

 /* ---------- رله رسانه — فرستنده (دو کانال مستقل: دوربین + صفحه) ---------- */
 /* [فیکس F36-c] کانال‌ها: cam = دوربین+میکروفون، scr = اشتراک صفحه (+صدای تب).
  * هر کانال رکوردر، زنجیره آپلود، init و آمار خودش را دارد؛ روشن/خاموشی یکی
  * هیچ تاثیری روی دیگری ندارد (قبلاً صفحه جای دوربین را می‌گرفت و رکوردر
  * مدام از نو ساخته می‌شد → وقفه و شکستگی برای گیرنده‌ها) */
 const mkCh = (screen) => ({
   screen, rec: null, stopping: false, init: true, chain: Promise.resolve(),
   fmt: 'webm', cd: '', micOn: true, brIdx: 0, lat: [], good: 0, lastBrAt: 0, lastRebuildAt: 0,
   stats: { n: 0, bytes: 0, lastOkAt: 0, lastErrAt: 0, errs: 0, recent: [] },
 })
 const camChRef = useRef(mkCh(false))
 const scrChRef = useRef(mkCh(true))
 /* آمار زنده ارسال کانال دوربین — برای نوار وضعیت */
 const outStatsRef = camChRef // سازگاری نام قدیمی

 /* ---------- رله رسانه — گیرنده ---------- */
 const feedPlayersRef = useRef(new Map()) // key 't' | uid → FeedPlayer
 const [feedInfo, setFeedInfo] = useState({}) // key → { sess, mic, cam, screen, name, color }
 const esRef = useRef(null) // EventSource — برای بستن تمیز

 /* ضبط واقعی کلاس (MediaRecorder) */
 const recRef = useRef(null)
 const recChunksRef = useRef([])
 const recSourceRef = useRef(null)
 const recStartRef = useRef(0)

 /* تعویض دوربین + تمام‌صفحه */
 const [fsActive, setFsActive] = useState(false)
 const [pseudoFs, setPseudoFs] = useState(false)
 const roomRef = useRef(null)
 const [inIframe] = useState(() => { try { return window.self !== window.top } catch { return true } })
 /* دوربین/میکروفون/اشتراک صفحه فقط در «بافت امن» (HTTPS یا localhost) کار می‌کند —
  * رایج‌ترین علت واقعی «هیچی برای دانش‌آموز نمی‌آید» همین است؛ پس صریح اعلام می‌شود */
 const [secure] = useState(() => typeof window === 'undefined' || window.isSecureContext !== false)

 /* ---------- وایت‌برد ---------- */
 const [strokes, setStrokes] = useState([])
 const [boardLocked, setBoardLocked] = useState(false)
 const [wbColor, setWbColor] = useState(PEN_COLORS[0])
 const [wbSize, setWbSize] = useState(PEN_SIZES[1])
 const [wbTool, setWbTool] = useState('pen')
 const canvasRef = useRef(null)
 const drawingRef = useRef(null)
 const strokesRef = useRef([])
 const boardLocalTsRef = useRef(0) // جلوگیری از دوئل با echo سرور بعد از تغییر محلی
 const lockLocalTsRef = useRef(0)
 const liveWbCurRef = useRef({ after: 0, dt: 0, bgr: -1, clr: null }) // کرسر polling تخته (clr: نسخه پاک‌سازی — null = هنوز همگام نشده)
 strokesRef.current = strokes

 /* پس‌زمینه تخته (عکس/PDF) + رسم زنده (draft) بقیه */
 const [boardBg, setBoardBg] = useState(null)
 const bgImgRef = useRef(null)
 const draftsRef = useRef(new Map()) // userId → stroke در حال رسم دیگران (ذخیره نمی‌شود)
 const lastDraftSentRef = useRef(0)
 const bgInputRef = useRef(null)
 const pdfInputRef = useRef(null)
 const pdfDocRef = useRef(null)
 const [pdfPages, setPdfPages] = useState(0)
 const [pdfPage, setPdfPage] = useState(1)

 /* ---------- وضعیت زنده + چت ---------- */
 const [live, setLive] = useState(null)
 const [stateChecked, setStateChecked] = useState(false) // [فیکس F38] وضعیت اولیهٔ سرور خوانده شد؟
 const [authDenied, setAuthDenied] = useState(false) // [فیکس] 401/403 در خواندن وضعیت = نشست مرده ≠ «کلاس شروع نشده»
 const [messages, setMessages] = useState([])
 const [input, setInput] = useState('')
 const [sending, setSending] = useState(false)
 const chatRef = useRef(null)
 const lastIdRef = useRef(0)

 const canSyncBoard = () => Date.now() - boardLocalTsRef.current > 3000
 const canSyncLock = () => Date.now() - lockLocalTsRef.current > 3000

 /* ---------- همگام‌سازی وضعیت اولیه برای مدرس ----------
  * [فیکس B7] شروع جلسهٔ جدید فقط با اکشن صریح کاربر (دکمهٔ «برگزاری جلسه جدید»
  * در صفحهٔ پایان) — قبلاً صرفِ باز کردن صفحهٔ اتاق حتی برای کلاسِ ended بلافاصله
  * startLive می‌زد (mutation در render!) و حتی در خطای شبکه هم session جعلی می‌ساخت */
 useEffect(() => {
   if (!isTeacher || !classId) return
   /* [فیکس F38] وضعیت واقعی سرور همان اول خوانده می‌شود — قبلاً فقط 'live' هندل
      می‌شد؛ کلاسِ ended در ۲.۵ ثانیهٔ اولِ ورود، اتاقِ زندهٔ قلابی نشان می‌داد */
   let alive = true
   req(`/classes/${classId}/state`).then((st) => {
     if (!alive) return
     if (st.status === 'live') setLive((l) => ({ ...(l || { participants: [] }), status: 'live', startedAt: st.startedAt }))
     else if (st.status === 'ended') setLive((l) => ({ ...(l || { participants: [] }), status: 'ended', startedAt: st.startedAt, endedAt: st.endedAt }))
     setStateChecked(true)
   }).catch((e) => {
     if (!alive) return
     /* [فیکس باگ «کلاس شروع نمیشود»] خطای احراز هویت هرگز نباید گیت «شروع کلاس»
        نشان دهد — قبلاً با نشست مرده، این گیت همیشه می‌ماند و مدرس فکر می‌کرد
        کلاس شروع شده در حالی که POST /start هرگز موفق نشده بود */
     if (e.status === 401 || e.status === 403) setAuthDenied(true)
     setStateChecked(true)
   })
   return () => { alive = false }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 /* دسته‌بندی دقیق خطای رسانه + عیب‌یابی محیط (تعداد دستگاه‌هایی که مرورگر می‌بیند) */
 const classifyMediaErr = (e) => {
   const n = e?.name || ''
   if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return 'nodevice'
   if (n === 'NotReadableError' || n === 'TrackStartError') return 'busy'
   return 'denied' // NotAllowedError | SecurityError | … — OverconstrainedError عمداً اینجا نیست
 }
 const collectMediaDiag = async (err) => {
   const d = { videoCount: 0, audioCount: 0, lastError: err?.name || null }
   try {
     const ds = (await navigator.mediaDevices?.enumerateDevices?.()) || []
     d.videoCount = ds.filter((x) => x.kind === 'videoinput').length
     d.audioCount = ds.filter((x) => x.kind === 'audioinput').length
   } catch { /* noop */ }
   setMediaDiag(d)
 }

 /** گرفتن دوربین با facingMode دقیق (جلو/عقب موبایل) + زنجیره fallback
  *  دوربین دقیق → facingMode عادی → هر دوربینی — تا هیچ‌وقت «پیدا نشدن» دروغ نگوید */
 const gumVideo = async (facing, wantAudio = true) => {
   const base = { width: { ideal: 1280 }, height: { ideal: 720 } }
   const tries = []
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
         audio: wantAudio ? { echoCancellation: true, noiseSuppression: true } : false,
       })
     } catch (e) { lastErr = e }
   }
   throw lastErr
 }

 const rememberDevices = () => {
   navigator.mediaDevices.enumerateDevices()
     .then((ds) => {
       const cams = ds.filter((d) => d.kind === 'videoinput' && d.deviceId)
       devicesRef.current = cams
       setCamDevices(cams) // [فیکس F37-b] انتخابگر دوربین نیاز به state دارد، نه فقط ref
       const st = localStreamRef.current?.getVideoTracks()[0]?.getSettings?.()
       if (st?.deviceId) { camDeviceIdRef.current = st.deviceId; setCamDeviceId(st.deviceId) }
     })
     .catch(() => {})
 }

 /* [فیکس F37-b] اتصال/جدا شدن دوربین جدید (مثلاً وبکم USB) → لیست تازه شود */
 useEffect(() => {
   const h = () => rememberDevices()
   try { navigator.mediaDevices?.addEventListener?.('devicechange', h) } catch { /* noop */ }
   return () => { try { navigator.mediaDevices?.removeEventListener?.('devicechange', h) } catch { /* noop */ } }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* ---------- درخواست/قطع رسانه محلی ---------- */
 const startMedia = async () => {
   if (permBusy) return
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return } // گیت اجازه مدرس
   setMediaSkipped(false)
   if (!navigator.mediaDevices?.getUserMedia) { setMediaErr('insecure'); return }
   setPermBusy(true)
   try {
     const s = await gumVideo(facingRef.current)
     localStreamRef.current?.getTracks().forEach((t) => t.stop())
     const vt = s.getVideoTracks()[0]
     if (vt) { facingRef.current = vt.getSettings?.().facingMode || facingRef.current; vt.enabled = camRef.current }
     const at = s.getAudioTracks()[0]
     if (at) at.enabled = micRef.current
     localStreamRef.current = s
     setLocalStream(s)
     setMediaErr(null)
     setMediaDiag({ videoCount: s.getVideoTracks().length, audioCount: s.getAudioTracks().length, lastError: null })
     rebuildOutgoing()
     rememberDevices()
   } catch (e) {
     setMediaErr(classifyMediaErr(e))
     collectMediaDiag(e)
   }
   setPermBusy(false)
 }

 /* تلاش خودکار اول — فقط برای مدرس؛ دانش‌آموز باید اول از مدرس اجازه بگیرد */
 useEffect(() => {
   let cancelled = false
   if (!isTeacher) return
   if (!navigator.mediaDevices?.getUserMedia) { setMediaErr('insecure'); return }
   navigator.mediaDevices.getUserMedia({
     video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
     audio: { echoCancellation: true, noiseSuppression: true },
   }).then((s) => {
     if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
     const vt = s.getVideoTracks()[0]
     if (vt) facingRef.current = vt.getSettings?.().facingMode || 'user'
     localStreamRef.current = s
     setLocalStream(s)
     setMediaErr(null)
     rebuildOutgoing()
     rememberDevices()
   }).catch(async (e) => {
     if (cancelled) return
     setMediaErr(classifyMediaErr(e))
     await collectMediaDiag(e)
   })
   /* مجوز ذخیره‌شده مرورگر — اگر قبلاً رد شده همان اول راهنمای درست نمایش داده شود */
   try {
     navigator.permissions?.query?.({ name: 'camera' })
       .then((p) => { if (!cancelled && p.state === 'denied') setMediaErr((cur) => cur || 'denied') })
       .catch(() => {})
   } catch { /* noop */ }
   return () => { cancelled = true }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* پاک‌سازی نهایی هنگام بستن کلاس — رله و رسانه‌ها قطع و سرور مطلع می‌شود */
 useEffect(() => () => {
   stopChannel(camChRef.current)
   stopChannel(scrChRef.current)
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   if (classId) req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {})
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* ---------- فرستنده رله — پله‌های بیت‌ریت تطبیقی [فیکس F36-d] ----------
  * اگر آپلود تکه‌ها کند باشد (میانگین > ۱٫۱۵ ثانیه)، یک پله کیفیت پایین آمده و
  * رکوردر با بیت‌ریت کمتر از نو ساخته می‌شود؛ با شبکه سریع‌تر بعد از ~۱۵ تکهٔ
  * سریع، یک پله بالا می‌رود. سقف تغییر: هر ۹ ثانیه یک بار (ضد نوسان) */
 const BR_STEPS = [1_100_000, 800_000, 560_000, 400_000, 280_000]
 const SCREEN_BR_STEPS = [900_000, 650_000, 450_000, 300_000, 220_000]

 const uploadChunk = async (blob, isInit, fmt, cd, ch) => {
   if (!classId) return false
   const k = isTeacher ? 'teacher' : 'student'
   const q = `?k=${k}&init=${isInit ? 1 : 0}&mic=${ch.micOn ? 1 : 0}&cam=${camRef.current && !ch.screen ? 1 : 0}&screen=${ch.screen ? 1 : 0}&fmt=${fmt || 'webm'}&cd=${encodeURIComponent(cd || '')}`
   for (let i = 0; i < 3; i++) {
     /* تایم‌اوت ۵ ثانیه — هیچ درخواستی حق ندارد زنجیره‌ی ارسال را برای همیشه گروگان بگیرد */
     const ac = new AbortController()
     const tid = setTimeout(() => ac.abort(), 5000)
     const t0 = Date.now()
     try {
       const res = await fetch(`/api/classes/${classId}/media/up${q}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${getToken() || ''}` },
         body: blob,
         signal: ac.signal,
       })
       if (res.ok) {
         const st = ch.stats
         st.n += 1
         st.bytes += blob.size || 0
         st.lastOkAt = Date.now()
         st.recent.push([st.lastOkAt, blob.size || 0])
         while (st.recent.length && st.lastOkAt - st.recent[0][0] > 4000) st.recent.shift() // پنجره ۴ ثانیه‌ای
         ch.lat.push(Date.now() - t0) // زمان رفت‌وبرگشت آپلود — ورودی بیت‌ریت تطبیقی
         if (ch.lat.length > 4) ch.lat.shift()
         return true
       }
       if (res.status === 403) {
         const d = await res.json().catch(() => ({}))
         if (d.noPerm && !isTeacher && !ch.screen) { revokeMyMedia(); return false } // اجازه لغو شده
       }
     } catch { /* شبکه — تلاش دوباره */ }
     finally { clearTimeout(tid) }
     await new Promise((r) => setTimeout(r, 200))
   }
   const st = ch.stats
   st.errs += 1
   st.lastErrAt = Date.now()
   return false
 }

 /** تنظیم بیت‌ریت بر اساس تاخیر واقعی آپلود */
 const adaptBitrate = (ch) => {
   if (!ch.lat.length) return
   const avg = ch.lat.reduce((a, b) => a + b, 0) / ch.lat.length
   const t = Date.now()
   if (t - ch.lastBrAt < 9000) return
   const steps = ch.screen ? SCREEN_BR_STEPS : BR_STEPS
   if (avg > 1150 && ch.brIdx < steps.length - 1) {
     ch.brIdx += 1
     ch.lastBrAt = t
     ch.lat = []
     ch.good = 0
     restartChannel(ch)
   } else if (avg < 420 && ch.brIdx > 0) {
     ch.good += 1
     if (ch.good >= 15) {
       ch.brIdx -= 1
       ch.lastBrAt = t
       ch.lat = []
       ch.good = 0
       restartChannel(ch)
     }
   } else if (avg >= 420) ch.good = 0
 }

 const stopChannel = (ch) => {
   const rec = ch.rec
   if (!rec) return
   ch.rec = null
   ch.stopping = true
   try { if (rec.state !== 'inactive') rec.stop() } catch { /* noop */ }
 }

 const restartChannel = (ch) => {
   ch.init = true
   stopChannel(ch)
   setTimeout(() => { if (!ch.rec) startChannel(ch) }, 250)
 }

 /** وصل کردن رویدادهای رکوردر به زنجیره آپلود کانال */
 const wireRecorder = (ch, rec) => {
   rec.ondataavailable = (e) => {
     if (!e.data?.size || ch.stopping || ch.rec !== rec) return
     const isInit = ch.init
     ch.init = false
     const blob = e.data
     ch.chain = ch.chain.then(() => uploadChunk(blob, isInit, ch.fmt, ch.cd, ch)).then((ok) => {
       if (!ok && ch.rec === rec && !ch.stopping) {
         /* هرگز تکه‌ی وسط استریم را به‌جای init نمی‌فرستیم — رکوردر واقعاً از نو
            ساخته می‌شود تا تکه‌ی بعدی «هدرِ واقعی» داشته باشد (خود-ترمیمی) */
         const t = Date.now()
         if (t - ch.lastRebuildAt > 2500) {
           ch.lastRebuildAt = t
           restartChannel(ch)
         }
       }
       adaptBitrate(ch)
     }).catch(() => {})
   }
   rec.onerror = () => { /* ادامه — تکه بعدی */ }
 }

 /** ساخت/بازسازی استریم خروجی دوربین+میکروفون — بعد از هر تغییر ترکیب */
 const rebuildOutgoing = () => {
   const ch = camChRef.current
   ch.init = true
   stopChannel(ch)
   startChannel(ch)
 }

 const startChannel = (ch) => {
   if (!classId || ch.rec) return
   const recMime = pickRecMime() // { mime, fmt } — سافاری mp4، بقیه webm
   if (!recMime) return
   let tracks, micOn
   if (ch.screen) {
     /* کانال اشتراک صفحه — فقط مدرس؛ + صدای تب اگر مرورگر داده باشد */
     if (!isTeacher) return
     const v = screenTrackRef.current
     if (!v) return
     const sa = screenStreamRef.current?.getAudioTracks?.()[0] || null
     tracks = [v, ...(sa ? [sa] : [])]
     micOn = !!sa
   } else {
     if (!isTeacher && !canSpeakRef.current) return
     const s = localStreamRef.current
     const v = s?.getVideoTracks()[0]
     const a = s?.getAudioTracks()[0]
     if (!v && !a) return
     tracks = [...(v ? [v] : []), ...(a ? [a] : [])]
     micOn = !!a && micRef.current
   }
   const v = ch.screen ? tracks[0] : localStreamRef.current?.getVideoTracks()[0]
   const hasA = tracks.some((t) => t.kind === 'audio')
   /* کدک‌های واقعی داخل استریم — گیرنده SourceBuffer را دقیقاً با همین‌ها می‌سازد
      (وگرنه استریمِ بدون صدا با خطای "misses expected opus track" رد می‌شد) */
   const cd = recMime.fmt === 'mp4'
     ? [...(v ? ['avc1.42E01E'] : []), ...(hasA ? ['mp4a.40.2'] : [])].join(',')
     : [...(v ? ['vp8'] : []), ...(hasA ? ['opus'] : [])].join(',')
   let rec
   try {
     rec = new MediaRecorder(new MediaStream(tracks), {
       mimeType: recMime.mime,
       videoBitsPerSecond: (ch.screen ? SCREEN_BR_STEPS : BR_STEPS)[ch.brIdx],
       audioBitsPerSecond: 48_000,
     })
   } catch { return }
   ch.rec = rec
   ch.stopping = false
   ch.fmt = recMime.fmt
   ch.cd = cd
   ch.micOn = micOn
   wireRecorder(ch, rec)
   try { rec.start(1000) } catch { /* noop */ } // [فیکس F37-d] تکه‌های ۱ ثانیه‌ای — تکه‌های ۰٫۵s کروم خروجی webm شکننده می‌دهد که MSE مرتباً رد می‌کند
 }

 /** قطع کامل رسانه خودم — لغو اجازه توسط مدرس یا ۴۰۳ سرور */
 const revokeMyMedia = () => {
   stopChannel(camChRef.current)
   stopChannel(scrChRef.current)
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   localStreamRef.current = null
   setLocalStream(null)
   setMic(false)
   setCam(false)
 }

  /* ---------- گیرنده رله — polling استریم‌ها (۴۵۰ms) ----------
  * با «کرسر» فقط تکه‌های تازه می‌آیند؛ اگر گیرنده جا مانده باشد سرور init می‌فرستد
  * و پلیر خودش از نو ساخته می‌شود — هیچ حالتی تصویر را برای همیشه نمی‌شکند */
 useEffect(() => {
   if (!classId || !user?.id) return
   let alive = true
   const players = feedPlayersRef.current
   const cur = { t: null, ts: null, s: {} }
   const lastSeen = new Map() // [فیکس F37-d] key → آخرین زمان دیده‌شدن فید
   let busy = false

   const applyFeed = (key, f) => {
     let p = players.get(key)
     /* اگر قالب/کدک‌های فرستنده عوض شد (webm↔mp4 یا اضافه‌شدن ترک) پلیر از نو ساخته می‌شود
      * [فیکس F37-d] اما پلیری که به فال‌بک Blob رفته هرگز به MSE برگردانده نمی‌شود —
      * بعد از fallback، cd/fmt روی پلیر ست نمی‌ماند و بازسازی شرطی، فال‌بک را خنثی می‌کرد */
     if (p && p.mode !== 'blob' && (p.fmt !== (f.fmt || 'webm') || (p.cd || '') !== (f.cd || ''))) { try { p.destroy() } catch { /* noop */ } players.delete(key); p = null }
     if (!p) {
       p = createFeedPlayer(f.fmt || 'webm', f.cd || '')
       p.onNeedReset = () => { if (key === 't' || key === 'ts') cur[key] = null; else delete cur.s[key] } // فقط کرسرِ همین فید صفر شود
       players.set(key, p)
     }
     const resetApplied = f.reset ? p.hardReset(f.sess) : false
     /* [فیکس F37-d] اگر هاردریست «لازم نبود» (همان سشنِ سالم)، دسته‌ی init+تکه‌های
        تکراری نباید push شود — افزودن دوباره‌ی init به SourceBuffer زنده دکودر را می‌شکند
        و همان تکه‌ها هم قبلاً پخش شده‌اند. فقط دسته‌ی بعد از ریستِ واقعی push می‌شود */
     try { window.__liveLog?.push(`applyFeed|${key}|reset=${f.reset ? 1 : 0}|applied=${resetApplied ? 1 : 0}|broken=${p.broken ? 1 : 0}|sess=${f.sess}`) } catch { /* noop */ }
     if (f.reset && !resetApplied) {
       return f.chunks.length ? f.chunks[f.chunks.length - 1].seq : null
     }
     /* [فیکس F37-d] باگ ریشه‌ای کرسر: breakStream کرسر را صفر می‌کرد ولی «همین poll»
        بلافاصله بعد از applyFeed کرسر را دوباره q=lastSeq می‌کرد → صفر شدن هیچ‌وقت
        به poll بعد نمی‌رسید → سرور هیچ‌وقت reset+init نمی‌فرستاد → SourceBuffer
        شکسته برای همیشه می‌ماند و تصویر فریز می‌شد. حالا پلیرِ شکسته کرسر null
        برمی‌گرداند تا سرور قطعاً reset+init بفرستد و خودترمیمی کامل شود */
     if (p.broken) { try { window.__liveLog?.push(`applyFeed|${key}|BROKEN-cursor-null`) } catch { /* noop */ } return null }
     if (f.init) p.push(f.sess, f.init)
     for (const c of f.chunks) p.push(f.sess, c.b64)
     /* کرسر فقط تا «آخرین تکه‌ی واقعاً تحویل‌شده» جلو می‌رود — نه seq سرور؛
        وگرنه تکه‌های بریده‌شده برای همیشه گم می‌شوند */
     return f.chunks.length ? f.chunks[f.chunks.length - 1].seq : null
   }

   const loop = async () => {
     if (!alive || busy) return
     busy = true
     try {
       const r = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify(cur))}`, { timeout: 7000 })
       const next = {}
       const nowMs = Date.now()
       /* [فیکس F37-d] آخرین زمان دیده‌شدن هر فید — پلیر تا ۱۵ ثانیه بعد از آخرین دیده‌شدن
          زنده نگه داشته می‌شود؛ رکود لحظه‌ای فرستنده دیگر پلیر را نمی‌کشد */
       const touch = (k) => { lastSeen.set(k, nowMs) }
       /* pv = شناسه‌ی پلیرِ زنده. اگر پلیر از نو ساخته شود (تعویض قالب/کدک مثل شروع
          اشتراک صفحه، یا re-mount افکت در StrictMode) باید feedInfo عوض شود تا
          re-render اتفاق بیفتد و RelayVideo پلیر تازه را بگیرد. بدون این، پروپ‌ها
          به «پلیرِ مرده» چسبیده می‌مانند، ویدیو هیچ‌وقت src نمی‌گیرد و با اینکه
          تکه‌ها آپند می‌شوند هیچ تصویر و صدایی پخش نمی‌شود (باگ اصلی گزارش کاربر) */
       /* [فیکس F36-e] فیدِ خودِ مدرس هرگز پخش نمی‌شود ولی قبلاً کرسرش هم جلو نمی‌رفت →
         سرور در هر poll (هر ۴۵۰ms) init + ۶ تکهٔ آخر را base64 برای خود مدرس
         می‌فرستاد (~۰٫۸ مگابایت/ثانیه هدررفت پهنای باند که عامل بزرگی در «کندی» بود).
         حالا فقط کرسر جلو می‌رود و پاسخ به چند صد بایت می‌رسد */
      if (isTeacher) {
        if (r.teacher) cur.t = { s: r.teacher.sess, q: r.teacher.seq }
        if (r.teacherScreen) cur.ts = { s: r.teacherScreen.sess, q: r.teacherScreen.seq }
      } else if (r.teacher) {
        touch('t')
        const lastSeq = applyFeed('t', r.teacher)
        next.t = { sess: r.teacher.sess, mic: r.teacher.mic, cam: r.teacher.cam, screen: r.teacher.screen, fmt: r.teacher.fmt, name: classInfo?.teacher || 'مدرس', color: 'grad-0', pv: players.get('t')?.pid }
        /* [فیکس F37-d] پلیر شکسته → کرسر «واقعاً» صفر شود — قبلاً fallback به
           cur.t?.q قدیمی بود و سرور هیچ‌وقت reset نمی‌فرستاد → پلیر مرده می‌ماند
           [فیکس F37-e] پاسخ بدون تکه‌ی جدید (n:0) دیگر کرسر را صفر نمی‌کند —
           قبلاً «q: lastSeq ?? 0» هر poll بی‌تکه را به q=0 تبدیل می‌کرد → سرور
           stale می‌دید و بی‌نهایت reset+init می‌فرستاد (طوفان reset و داده‌ی تکراری) */
        cur.t = players.get('t')?.broken ? null : { s: r.teacher.sess, q: lastSeq != null ? lastSeq : (cur.t?.q ?? 0) }
      }
      /* [فیکس F37-d] مرگ لحظه‌ای فید (رکود ضبط فرستنده) — کرسر نگه داشته می‌شود؛
       * sess خودش حافظ‌ی ریست است: اگر فرستنده واقعاً از نو شروع کرده باشد sess++
       * می‌شود و سرور reset می‌فرستد. صفر کردن کرسر اینجا هر رکود ~۵-۹ ثانیه‌ای را
       * به «ریست کامل + rebuild» تبدیل می‌کرد (چرخه‌ی بی‌پایان برای دانش‌آموز) */
       /* [فیکس F36-c] فید مستقل اشتراک صفحه مدرس — موازی با دوربین (کلید 'ts') */
       if (!isTeacher && r.teacherScreen) {
         touch('ts')
         const lastSeq2 = applyFeed('ts', r.teacherScreen)
         next.ts = { sess: r.teacherScreen.sess, mic: r.teacherScreen.mic, cam: false, screen: true, fmt: r.teacherScreen.fmt, name: classInfo?.teacher || 'مدرس', color: 'grad-0', pv: players.get('ts')?.pid }
         /* [فیکس F37-e] حفظ کرسر در پاسخ‌های بی‌تکه — مثل فید دوربین */
         cur.ts = players.get('ts')?.broken ? null : { s: r.teacherScreen.sess, q: lastSeq2 != null ? lastSeq2 : (cur.ts?.q ?? 0) }
       }
       for (const sf of r.students || []) {
         touch(sf.uid)
         const lastSeq = applyFeed(sf.uid, sf)
         next[sf.uid] = { sess: sf.sess, mic: sf.mic, cam: sf.cam, screen: sf.screen, fmt: sf.fmt, name: sf.name || 'هم‌کلاسی', color: 'grad-2', pv: players.get(sf.uid)?.pid }
         /* [فیکس F37-e] حفظ کرسر در پاسخ‌های بی‌تکه — مثل فید دوربین */
         cur.s[sf.uid] = players.get(sf.uid)?.broken ? null : { s: sf.sess, q: lastSeq != null ? lastSeq : (cur.s[sf.uid]?.q ?? 0) }
       }
       for (const k of Object.keys(cur.s)) if (!(k in next) && nowMs - (lastSeen.get(k) || 0) > 15_000) delete cur.s[k]
       /* [فیکس F37-d] پلیر فقط بعد از ۱۵ ثانیه غیبت کامل فید کشته می‌شود — نه با هر
          رکود لحظه‌ای فرستنده (قبلاً هر رکود → destroy → reset → rebuild چرخه‌ی بی‌پایان) */
       for (const k of [...players.keys()]) {
         if (!(k in next) && nowMs - (lastSeen.get(k) || 0) > 15_000) { try { players.get(k).destroy() } catch { /* noop */ } players.delete(k) }
       }
       setFeedInfo((prev) => (feedsEq(prev, next) ? prev : next))
     } catch { /* شبکه — دوباره */ }
     finally { busy = false }
   }
   loop()
   const ticker = createTicker(450, loop)
   return () => {
     alive = false
     ticker.stop()
     for (const [k, p] of players) { try { p.destroy() } catch { /* noop */ } }
     players.clear()
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId, user?.id, isTeacher])

 const feedsEq = (a, b) => {
   const ka = Object.keys(a)
   const kb = Object.keys(b)
   if (ka.length !== kb.length) return false
   for (const k of ka) {
     const x = a[k]
     const y = b[k]
     if (!y || x.sess !== y.sess || x.mic !== y.mic || x.cam !== y.cam || x.screen !== y.screen || x.name !== y.name || x.pv !== y.pv) return false
   }
   return true
 }

 /* ---------- SSE: رویدادهای لحظه‌ای (شتاب‌دهنده — همه‌چیز با polling هم پوشش داده شده) ---------- */
 useEffect(() => {
   if (!classId) return
   let cancelled = false
   let es = null

   const handleSse = (msg) => {
     switch (msg.type) {
       case 'live':
         setLive((l) => ({ ...(l || { participants: [] }), status: 'live', startedAt: msg.startedAt }))
         toast('کلاس شروع شد', 'success')
         break
       case 'ended':
         setLive((l) => ({ ...(l || { participants: [] }), status: 'ended', endedAt: msg.endedAt }))
         break
       case 'board-open':
         if (!isTeacher && canSyncBoard()) setBoard(!!msg.open)
         break
       case 'board-lock':
         if (canSyncLock()) setBoardLocked(!!msg.locked)
         break
       case 'message': {
         const m2 = msg.message
         setMessages((list) => (m2?.id != null && list.some((x) => x.id === m2.id)) ? list : [...list, m2].slice(-80))
         if (m2?.id != null) lastIdRef.current = Math.max(lastIdRef.current, m2.id)
         break
       }
       case 'board':
         if (msg.stroke) {
           draftsRef.current.delete(msg.stroke.userId) // رسم زنده همان نفر تمام شده است
           setStrokes((list) => (msg.stroke.id != null && list.some((s) => s.id === msg.stroke.id)) ? list : [...list, msg.stroke])
           if (msg.stroke.id != null) liveWbCurRef.current.after = Math.max(liveWbCurRef.current.after, msg.stroke.id)
         }
         break
       case 'board-clear': {
         /* پاک‌سازی تخته باید برای «همه» اعمال شود — قبلاً این رویداد هندل نمی‌شد و
            تخته‌ی پاک‌شده‌ی مدرس برای دانش‌آموزها برای همیشه باقی می‌ماند */
         setStrokes([])
         draftsRef.current.clear()
         liveWbCurRef.current.after = 0
         if (typeof msg.rev === 'number') liveWbCurRef.current.clr = msg.rev
         redrawBoard()
         break
       }
       case 'board-draft':
         if (msg.userId && msg.userId !== userIdRef.current && msg.stroke) {
           draftsRef.current.set(msg.userId, { ...msg.stroke, userId: msg.userId, ts: Date.now() })
           redrawBoard()
         }
         break
       case 'board-bg':
         if (msg.img === null) loadBg(null)
         else if (msg.img) loadBg(msg.img)
         break
       case 'perm': {
         const cs = !!msg.canSpeak
         setLive((l) => ({ ...(l || { participants: [] }), participants: (l?.participants || []).map((p) => (p.id === msg.userId ? { ...p, canSpeak: cs, hand: false } : p)) }))
         if (!isTeacher && msg.userId === userIdRef.current) {
           if (cs) { setHand(false); toast('مدرس اجازه داد ✅ — دکمه‌های میکروفون و دوربین در پایین صفحه فعال شد', 'success') }
           else toast('مدرس دسترسی صدا/تصویر شما را لغو کرد', 'info')
         }
         break
       }
       default: break
     }
   }

   /* [فیکس B8] توکن کامل JWT دیگر در query string نمی‌رود — تیکت ۲ دقیقه‌ای
      مخصوص SSE (app.get('/api/sse-ticket')) گرفته و استفاده می‌شود؛ EventSource
      هدر نمی‌فرستد پس توکن ده‌ساله در URL/log/history باقی نمی‌ماند */
   const openEs = async () => {
     let qs = ''
     try { const t = await req('/sse-ticket'); if (t?.st) qs = `st=${encodeURIComponent(t.st)}` } catch { /* fallback */ }
     if (!qs) { const token = getToken() || ''; qs = `token=${encodeURIComponent(token)}` }
     if (cancelled) return
     es = new EventSource(`/api/classes/${classId}/events?${qs}`)
     esRef.current = es
     es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data) } catch { return } handleSse(m) }
     /* [فیکس F6] خطای SSE بی‌پاسخ نبود — اگر سرور ۴۰۱/۴۰۳ می‌داد (حذف عضویت/توکن
        باطل) مرورگر بی‌پایان reconnect می‌زد. با یک probe جدا بررسی می‌شود؛ در رد
        شدن، اتصال بسته و کاربر به صفحهٔ کلاس‌ها هدایت می‌شود */
     es.onerror = async () => {
       if (cancelled) return
       try {
         await req(`/classes/${classId}/state`, { timeout: 5000 })
         /* سرور پاسخ داد → قطعی موقت؛ EventSource خودش دوباره وصل می‌شود */
       } catch (e) {
         if (e.status === 401 || e.status === 403) {
           cancelled = true
           try { es.close() } catch { /* noop */ }
           toast('دسترسی شما به این کلاس پایان یافت', 'error')
           nav(isTeacher ? '/panel/teacher/classes' : '/panel/student/schedule')
         }
       }
     }
   }
   openEs()
   return () => { cancelled = true; try { es?.close() } catch { /* noop */ } }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 /* ---------- poll وضعیت کلاس + heartbeat + چت (پایدار در کنار SSE) ---------- */
 useEffect(() => {
   if (!classId) return
   let alive = true
   let hbCount = 0
   let busy2 = false
   const poll = async () => {
     if (!alive || busy2) return
     busy2 = true
     try {
       const st = await req(`/classes/${classId}/state`, { timeout: 7000 })
       if (!alive) return
       setLive({ status: st.status, startedAt: st.startedAt, participants: st.participants || [] })
       if (!isTeacher && st.boardOpen != null && canSyncBoard()) setBoard(!!st.boardOpen)
       hbCount++
       if (hbCount % 3 === 0) {
         req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand: handRef.current } }).catch(() => {})
       }
       const r = await req(`/classes/${classId}/messages?after=${lastIdRef.current}`)
       if (!alive || !r.messages?.length) return
       setMessages((m) => {
         const known = new Set(m.filter((x) => x.id != null).map((x) => x.id))
         const fresh = r.messages.filter((x) => !known.has(x.id))
         return fresh.length ? [...m, ...fresh].slice(-80) : m
       })
       lastIdRef.current = Math.max(lastIdRef.current, ...r.messages.map((x) => x.id))
     } catch { /* سرور قطع — حالت محلی */ }
     finally { busy2 = false }
   }
   poll()
   const ticker2 = createTicker(2500, poll)
   return () => { alive = false; ticker2.stop() }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 const handRef = useRef(false); handRef.current = hand

 /* دست بلند شده — بلافاصله به سرور */
 useEffect(() => {
   if (!classId || !user) return
   req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand } }).catch(() => {})
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [hand])

 /* ---------- وایت‌برد زنده — polling مستقل از SSE (۶۵۰ms وقتی باز است) ---------- */
 useEffect(() => {
   if (!classId || !user?.id) return
   let alive = true
   const cur = liveWbCurRef.current
   let busy3 = false
   const tick = async () => {
     if (!alive || busy3) return
     busy3 = true
     try {
       const r = await req(`/classes/${classId}/board/live?after=${cur.after}&dt=${cur.dt}&bgr=${cur.bgr}&clr=${cur.clr ?? -1}`, { timeout: 7000 })
       /* تشخیص پاک‌سازی از مسیر polling (وقتی SSE بافر/قطع است):
          اولین پاسخ فقط همگام می‌شود؛ تغییر نسخه بعدی یعنی تخته پاک شده */
       if (typeof r.clearRev === 'number') {
         if (cur.clr === null) cur.clr = r.clearRev
         else if (r.clearRev !== cur.clr) {
           cur.clr = r.clearRev
           setStrokes([])
           draftsRef.current.clear()
           cur.after = 0
           redrawBoard()
         }
       }
       if (r.strokes?.length) {
         setStrokes((list) => {
           const known = new Set(list.filter((s) => s.id != null).map((s) => s.id))
           const fresh = r.strokes.filter((s) => !known.has(s.id))
           return fresh.length ? [...list, ...fresh] : list
         })
         cur.after = Math.max(cur.after, ...r.strokes.map((s) => s.id))
       }
       if (r.drafts?.length) {
         for (const d of r.drafts) {
           if (d.userId === userIdRef.current) continue
           draftsRef.current.set(d.userId, { ...d, ts: Date.now() })
         }
         redrawBoard()
       }
       if (!isTeacher && canSyncBoard()) setBoard(!!r.open)
       if (canSyncLock()) setBoardLocked(!!r.locked)
       if (typeof r.bgRev === 'number' && r.bgRev !== cur.bgr) {
         cur.bgr = r.bgRev
         if (r.bg !== undefined) loadBg(r.bg || null)
       }
       cur.dt = r.serverTime || Date.now()
     } catch { /* شبکه */ }
     finally { busy3 = false }
   }
   tick()
   const ticker3 = createTicker(board ? 650 : 2200, tick)
   return () => { alive = false; ticker3.stop() }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId, user?.id, isTeacher, board])

 /* تایمر محلی هر ثانیه */
 useEffect(() => {
   const t = setInterval(() => setTick((x) => x + 1), 1000)
   return () => clearInterval(t)
 }, [])

 useEffect(() => {
   chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
 }, [messages])

 /* پایان کلاس از سمت سرور → قطع رله و رسانه‌ها و ثبت ضبط */
 useEffect(() => {
   if (live?.status !== 'ended') return
   stopChannel(camChRef.current)
   stopChannel(scrChRef.current)
   try { req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {}) } catch { /* noop */ }
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   setLocalStream(null)
   setScreen(false)
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [live?.status])

 /* ---------- گیت اجازه مدرس — بدون شروع خودکار رسانه؛ دانش‌آموز خودش میکروفون/دوربین را روشن می‌کند ----------
    [فیکس F9] ادمین سوپروایزر است (همه‌جا دسترسی کامل دارد: RouteGuard، canControl سرور)
    ولی اینجا مثل دانش‌آموز بدون اجازه بود — حالا مثل مدرس همیشه مجاز است */
 const isAdminUser = user?.role === 'admin'
 const participantsPre = live?.participants || []
 const myPartPre = participantsPre.find((p) => p.id === user?.id)
 const canSpeakPre = isTeacher || isAdminUser || !!myPartPre?.canSpeak
 canSpeakRef.current = canSpeakPre
 const prevCanSpeakRef = useRef(canSpeakPre)
 useEffect(() => {
   if (!user?.id) return
   if (canSpeakPre && !prevCanSpeakRef.current) {
     // اجازه داده شد — اگر رسانه از قبل باز است رله ادامه می‌یابد؛ وگرنه پنل میکروفون/دوربین نمایش داده می‌شود
     if (localStreamRef.current) { setMediaErr(null); setMediaSkipped(false); rebuildOutgoing() }
   }
   if (!canSpeakPre && prevCanSpeakRef.current && !isTeacher && !isAdminUser) revokeMyMedia()
   prevCanSpeakRef.current = canSpeakPre
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [canSpeakPre, user?.id])

 /* تُست لحظه بلند شدن دست دانش‌آموز برای مدرس — بدون نگاه کردن به تب حاضران */
 const prevHandsRef = useRef(new Set())
 useEffect(() => {
   if (!isTeacher) return
   const cur = new Set()
   for (const p of participantsPre) {
     if (p.role !== 'student' || !p.hand) continue
     cur.add(p.id)
     if (!prevHandsRef.current.has(p.id)) toast(`✋ ${p.name} دست خود را بالا کرد — از تب «حاضران» اجازه دهید`, 'info')
   }
   prevHandsRef.current = cur
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [participantsPre])

 /* ---------- محاسبه تایمر ---------- */
 const startedAt = live?.startedAt || null
 const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
 const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
 const ss = String(elapsed % 60).padStart(2, '0')

 const participants = live?.participants || []
 const handsUp = participants.filter((p) => p.hand).length
 const classEnded = live?.status === 'ended'

 /* [فیکس F4] با پایان کلاس، وضعیت UI میکروفون/دوربین ریست می‌شود — قبلاً ترک‌ها
    stop و استریم null می‌شد ولی setMic/setCam زده نمی‌شد؛ اگر مدرس «برگزاری جلسه
    جدید» می‌زد، دکمه‌ها روشن نشان داده می‌شدند در حالی که استریمی وجود نداشت */
 useEffect(() => {
   if (!classEnded) return
   setMic(false)
   setCam(false)
   try { revokeMyMedia() } catch { /* noop */ }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classEnded])

 /* اجازه فعال‌سازی صدا/تصویر — مدرس و ادمین همیشه دارند؛ دانش‌آموز فقط با تایید مدرس [فیکس F9] */
 const myPart = participants.find((p) => p.id === user?.id)
 const myHand = !!myPart?.hand
 const canSpeak = isTeacher || isAdminUser || !!myPart?.canSpeak
 const needsApproval = !isTeacher && !isAdminUser && !canSpeak
 canSpeakRef.current = canSpeak

 /** مدرس: دادن/لغو اجازه صدا/تصویر به یک دانش‌آموز */
 const grantPerm = async (userId, allow) => {
   try {
     const r = await req(`/classes/${classId}/permit`, { method: 'POST', body: { userId, allow } })
     if (r.participants) setLive((l) => ({ ...(l || { participants: [] }), participants: r.participants }))
     toast(allow ? 'اجازه داده شد — دانش‌آموز حالا میکروفون/دوربین خود را روشن می‌کند' : 'اجازه لغو شد', 'success')
   } catch (e) { if (!e.serverDown) toast(e.message || 'عملیات ناموفق بود', 'error') }
 }

  const send = async (e) => {
   e.preventDefault()
   const body = input.trim()
   if (!body || sending) return
   setSending(true)
   const optimistic = { id: 'tmp-' + Date.now(), name: `${me} (شما)`, body, role: user?.role || 'student', self: true, created_at: Date.now() }
   setMessages((m) => [...m, optimistic])
   setInput('')
   try {
     const r = await req(`/classes/${classId}/messages`, { method: 'POST', body: { body } })
     lastIdRef.current = Math.max(lastIdRef.current, r.message.id)
     /* اگر SSE زودتر از پاسخ POST پیام واقعی را آورده بود، فقط پیام موقت حذف می‌شود —
        قبلاً جایگزینی کور باعث «دوبار نمایش دادن پیام» می‌شد */
     setMessages((m) => (m.some((x) => x.id === r.message?.id)
       ? m.filter((x) => x !== optimistic)
       : m.map((x) => (x === optimistic ? { ...r.message, self: true } : x))))
   } catch (err) {
     /* پیام موقت حذف و متن بازگردانده می‌شود — قبلاً پیامِ ناموفق همیشه در چت می‌ماند */
     setMessages((m) => m.filter((x) => x !== optimistic))
     setInput((cur) => (cur ? cur : body))
     if (!err.serverDown) toast(err.message || 'ارسال پیام ناموفق بود', 'error')
   }
   setSending(false)
 }

 /* ---------- عملیات رسانه ---------- */

 /* درخواست اجازه صدا/تصویر از مدرس — فقط با کلیک خود دانش‌آموز (دست بلند کردن)؛
    ورود به کلاس هیچ‌وقت خودکار دست را بلند نمی‌کند */
 const requestSpeakPermission = () => {
   if (isTeacher || canSpeakRef.current) return
   if (!handRef.current) {
     setHand(true)
     req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand: true } }).catch(() => {})
     toast('✋ دست شما بالا رفت — به‌محض اجازه مدرس، دکمه‌های میکروفون و دوربین همین‌جا فعال می‌شود', 'info')
   } else {
     toast('درخواست شما در انتظار تایید مدرس است…', 'info')
   }
 }

 /** میکروفون — فقط enabled عوض می‌شود (رله هرگز قطع نمی‌شود)؛ اگر ترک نیست فقط همان گرفته می‌شود */
 const toggleMic = async () => {
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return }
   const s = localStreamRef.current
   if (!s?.getAudioTracks().length) {
     try {
       const g = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
       const at = g.getAudioTracks()[0]
       at.enabled = true
       if (localStreamRef.current) localStreamRef.current.addTrack(at)
       else { localStreamRef.current = g; setLocalStream(g) }
       setMic(true)
       setMediaErr(null)
       setMediaSkipped(false)
       setMediaDiag({ videoCount: 0, audioCount: 1, lastError: null })
       rebuildOutgoing()
       toast('میکروفون وصل شد', 'success')
     } catch (err) {
       setMediaErr(classifyMediaErr(err))
       collectMediaDiag(err)
       setMediaSkipped(false)
     }
     return
   }
   const at = s.getAudioTracks()[0]
   const v = !at.enabled
   at.enabled = v
   setMic(v)
   toast(v ? 'میکروفون وصل شد' : 'میکروفون قطع شد', v ? 'success' : 'info')
 }

 /** دوربین — فقط enabled عوض می‌شود؛ اگر ترک نیست فقط دوربین گرفته می‌شود (با facingMode درست) */
 const toggleCam = async () => {
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return }
   const s = localStreamRef.current
   if (!s?.getVideoTracks().length) {
     try {
       const g = await gumVideo(facingRef.current, false)
       const vt = g.getVideoTracks()[0]
       vt.enabled = true
       facingRef.current = vt.getSettings?.().facingMode || facingRef.current
       if (localStreamRef.current) localStreamRef.current.addTrack(vt)
       else { localStreamRef.current = g; setLocalStream(g) }
       setCam(true)
       setMediaErr(null)
       setMediaSkipped(false)
       setMediaDiag({ videoCount: 1, audioCount: 0, lastError: null })
       rebuildOutgoing()
       rememberDevices()
       toast('دوربین روشن شد', 'success')
     } catch (err) {
       setMediaErr(classifyMediaErr(err))
       collectMediaDiag(err)
       setMediaSkipped(false)
     }
     return
   }
   const vt = s.getVideoTracks()[0]
   const v = !vt.enabled
   vt.enabled = v
   setCam(v)
 }

 /* ---------- تعویض دوربین [فیکس F37-b] — بازنویسی کامل ----------
  * باگ گزارش کاربر: «چرخش دوربین درست کار نمی‌کند». ریشه:
  * ۱) روی دسکتاپِ تک‌دوربین، محدودیت facingMode:{ideal} همان وبکم قبلی را برمی‌گرداند
  *    ولی شرط ردِ «همان دوربین» فقط وقتی اجرا می‌شد که محدودیت facingMode «نداشته باشد»
  *    → همان دوربین دوباره باز می‌شد، استریم ری‌بیلد می‌شد و پیام قلابی «دوربین عوض شد» می‌آمد.
  * ۲) سافاری deviceId را در getSettings نمی‌دهد → مقایسه deviceId همیشه بی‌اثر بود.
  * حالا:
  *  • تشخیص «همان دوربین» با deviceId یا label (هر کدام که در دسترس باشد)
  *  • تناقض facingMode (پرسیدیم عقب، جلو داد) هم رد می‌شود
  *  • explicitId: انتخاب مستقیم از «انتخابگر دوربین»
  *  • اگر واقعاً دوربین دیگری نیست → پیام صادقانه، بدون ری‌بیلد استریم */
 const switchCam = async (explicitId) => {
   if (switchingRef.current) return
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return }
   const cur = localStreamRef.current
   if (!cur?.getVideoTracks().length) { startMedia(); return }
   switchingRef.current = true
   const track = cur.getVideoTracks()[0]
   const settings = track.getSettings?.() || {}
   const isTouch = (navigator.maxTouchPoints || 0) > 0
   /* شناسه/برچسب دوربین فعلی — سافاری deviceId نمی‌دهد ولی label بعد از اجازه دارد */
   const curId = explicitId ? '' : (camDeviceIdRef.current || settings.deviceId || '')
   const curLabel = explicitId ? '' : (track.label || '')
   const curFacing = facingRef.current || settings.facingMode || 'user'
   const flip = curFacing === 'environment' ? 'user' : 'environment'
   const base = { width: { ideal: 1280 }, height: { ideal: 720 } }
   const candidates = []
   if (explicitId) {
     /* انتخاب مستقیم از لیست انتخابگر */
     candidates.push({ ...base, deviceId: { exact: explicitId } })
   } else {
     if (isTouch) {
       candidates.push({ ...base, facingMode: { exact: flip } })
       candidates.push({ ...base, facingMode: flip })
     }
     try {
       /* هر بار لیست تازه گرفته می‌شود — iOS تا بعد از اجازه لیست خالی می‌دهد */
       const ds = ((await navigator.mediaDevices.enumerateDevices()) || []).filter((d) => d.kind === 'videoinput' && d.deviceId)
       devicesRef.current = ds
       setCamDevices(ds)
       /* همه دوربین‌های «دیگر» به ترتیب — نه فقط اولی (با ۳ دوربین هم هر سه در دسترس‌اند) */
       for (const d of ds) {
         if (d.deviceId && d.deviceId !== curId) candidates.push({ ...base, deviceId: { exact: d.deviceId } })
       }
     } catch { /* noop */ }
     candidates.push({ ...base, facingMode: { ideal: flip } })
   }

   /** آیا این ترک جدید عملاً همان دوربین قبلی است؟ (deviceId یا label) */
   const sameCam = (nv) => {
     const s = nv.getSettings?.() || {}
     if (s.deviceId && curId && s.deviceId === curId) return true
     if (nv.label && curLabel && nv.label === curLabel) return true
     return false
   }

   for (const video of candidates) {
     try {
       const g = await navigator.mediaDevices.getUserMedia({ video, audio: false })
       const nv = g.getVideoTracks()[0]
       if (!nv) { g.getTracks().forEach((t) => t.stop()); continue }
       /* [فیکس F37-b] اگر همان دوربین قبلی برگشت — بدون توجه به نوع محدودیت —
          «تغییر قلابی» ممنوع؛ گزینه بعدی امتحان می‌شود */
       if (sameCam(nv)) { g.getTracks().forEach((t) => t.stop()); continue }
       /* تناقض facingMode: دقیق «عقب» خواستیم ولی ترک گزارش «جلو» می‌دهد */
       const wantF = video.facingMode
       const gotF = nv.getSettings?.().facingMode
       if (wantF && typeof wantF === 'object' && wantF.exact && gotF && gotF !== wantF.exact) {
         g.getTracks().forEach((t) => t.stop()); continue
       }
       const old = localStreamRef.current?.getVideoTracks()[0]
       const audio = localStreamRef.current?.getAudioTracks()[0]
       old?.stop()
       const nextStream = new MediaStream([...(audio ? [audio] : []), nv])
       nv.enabled = camRef.current // وضعیت روشن/خاموش دوربین حفظ شود
       /* جهتِ درخواستی ترجیح دارد — گزارش settings روی برخی گوشی‌ها undefined است */
       facingRef.current = nv.getSettings?.().facingMode || ('facingMode' in video
         ? (typeof video.facingMode === 'string' ? video.facingMode : (video.facingMode?.exact || video.facingMode?.ideal || flip))
         : curFacing)
       camDeviceIdRef.current = nv.getSettings?.().deviceId || ''
       setCamDeviceId(camDeviceIdRef.current)
       localStreamRef.current = nextStream
       setLocalStream(nextStream)
       rebuildOutgoing()
       rememberDevices()
       toast(isTouch ? (facingRef.current === 'environment' ? 'دوربین عقب فعال شد' : 'دوربین جلو فعال شد') : 'دوربین عوض شد', 'success')
       switchingRef.current = false
       return
     } catch { /* گزینه بعدی */ }
   }
   /* هیچ دوربین دیگری واقعاً پیدا نشد — صادقانه بگو، استریم را به‌هم نزن */
   toast(camDevices.length > 1 ? 'تغییر به آن دوربین ممکن نشد — از انتخابگر دوربین استفاده کنید' : 'دوربین دیگری روی این دستگاه پیدا نشد', 'info')
   switchingRef.current = false
 }

/* ---------- تمام‌صفحه [فیکس F36-b] ----------
 * کل اتاق (صحنه + چت + کنترل‌ها) تمام‌صفحه می‌شود — نه فقط صحنه.
 * [باگ اصلی] در حالت fallback (قاب iframe بدون allow=fullscreen / iOS) کلاس
 * pseudo-fs در CSS وجود داشت ولی هرگز به عنصر ست نمی‌شد → کاربر «فول‌اسکرین»
 * می‌زد و عملاً هیچ اتفاقی نمی‌افتاد. حالا کلاس روی همان live-grid ست می‌شود */
 const toggleFs = async () => {
   const el = roomRef.current
   if (!el) return
   const doc = document
   const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement)
   if (isFs || pseudoFs || doc.body.classList.contains('fs-lock')) {
     try { if (doc.exitFullscreen) await doc.exitFullscreen(); else doc.webkitExitFullscreen?.() } catch { /* noop */ }
     setPseudoFs(false)
     doc.body.classList.remove('fs-lock')
     return
   }
   try {
     if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
     else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
     else throw new Error('fullscreen-unsupported') // iOS Safari روی div پشتیبانی ندارد
   } catch {
     /* شبه‌فول‌اسکرین: پوشاندن کل نوار با position:fixed — همه‌جا کار می‌کند */
     setPseudoFs(true)
     doc.body.classList.add('fs-lock')
     toast('مرورگر اجازه تمام‌صفحه واقعی نداد — حالت تمام‌صفحه داخلی فعال شد (Esc = خروج)', 'info')
   }
 }
 useEffect(() => {
   const h = () => setFsActive(!!(document.fullscreenElement || document.webkitFullscreenElement))
   document.addEventListener('fullscreenchange', h)
   document.addEventListener('webkitfullscreenchange', h)
   return () => {
     document.removeEventListener('fullscreenchange', h)
     document.removeEventListener('webkitfullscreenchange', h)
     document.body.classList.remove('fs-lock')
   }
 }, [])
 /* خروج از شبه‌فول‌اسکرین با Esc */
 useEffect(() => {
   if (!pseudoFs) return
   const h = (e) => { if (e.key === 'Escape') { setPseudoFs(false); document.body.classList.remove('fs-lock') } }
   window.addEventListener('keydown', h)
   return () => window.removeEventListener('keydown', h)
 }, [pseudoFs])

 const goHttps = () => {
   try {
     const u = new URL(window.location.href)
     if (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)) {
       u.protocol = 'https:'
       window.location.href = u.toString()
     }
   } catch { /* noop */ }
 }
 const openNewTab = () => { try { window.open(window.location.href, '_blank') } catch { /* noop */ } }

 /** ادامه کلاس بدون دوربین — کارت بسته می‌شود؛ با دکمه دوربین در نوار کنترل دوباره فعال می‌شود */
 const skipMedia = () => {
   setMediaSkipped(true)
   setMediaErr(null)
   toast('کلاس بدون دوربین ادامه پیدا می‌کند — چت، وایت‌برد و حاضران فعال است', 'info')
 }

 /* ---------- ضبط واقعی کلاس (MediaRecorder) ----------
  * تصویر (اشتراک صفحه اگر فعال باشد، وگرنه دوربین) + صدای میکروفون ضبط می‌شود؛
  * در پایان، فایل ویدیو روی دستگاه مدرس دانلود می‌شود. */
 const stopRecording = () => {
   const rec = recRef.current
   if (rec && rec.state !== 'inactive') { try { rec.stop() } catch { /* noop */ } }
   else setRecording(false)
 }

 const startRecording = () => {
   if (recording) return
   if (!window.MediaRecorder) { toast('مرورگر شما از ضبط ویدیو پشتیبانی نمی‌کند — از کروم استفاده کنید', 'error'); return }
   const vTrack = screenTrackRef.current || localStreamRef.current?.getVideoTracks()[0] || null
   /* صدای صفحه (وقتی اشتراک صفحه با صدای تب است) + میکروفون — هر دو ضبط می‌شوند [فیکس F36-c] */
   const aTracks = [
     ...(screenStreamRef.current?.getAudioTracks?.() || []),
     ...(localStreamRef.current?.getAudioTracks() || []),
   ]
   const aTrack = aTracks[0] || null
   if (!vTrack && !aTrack) { toast('برای ضبط، ابتدا دوربین یا میکروفون را وصل کنید', 'error'); return }
   let mime = ''
   for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']) {
     try { if (MediaRecorder.isTypeSupported?.(m)) { mime = m; break } } catch { /* noop */ }
   }
   try {
     const stream = new MediaStream([...(vTrack ? [vTrack] : []), ...aTracks])
     const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1_500_000 } : undefined)
     recChunksRef.current = []
     rec.ondataavailable = (e) => { if (e.data?.size) recChunksRef.current.push(e.data) }
     rec.onstop = () => {
       recSourceRef.current?.removeEventListener?.('ended', stopRecording)
       recSourceRef.current = null
       recRef.current = null
       const type = recChunksRef.current[0]?.type || 'video/webm'
       const blob = new Blob(recChunksRef.current, { type })
       recChunksRef.current = []
       const ext = type.includes('mp4') ? 'mp4' : 'webm' // سافاری mp4 ضبط می‌کند — پسوند درست
       try {
         const url = URL.createObjectURL(blob)
         const a = document.createElement('a')
         const stamp = new Date(recStartRef.current || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-')
         a.href = url
         a.download = `${String(classInfo?.title || 'modaresyar-class').replace(/\s+/g, '-')}-${stamp}.${ext}`
         document.body.appendChild(a)
         a.click()
         a.remove()
         setTimeout(() => URL.revokeObjectURL(url), 120_000)
       } catch { /* noop */ }
       setRecording(false)
       toast('فایل ضبط دانلود شد — لینک مستقیم آن را در «مدیریت کلاس» برای دانش‌آموزها ثبت کنید', 'info')
     }
     rec.onerror = () => { setRecording(false); toast('ضبط با خطا متوقف شد', 'error') }
     rec.start(2000)
     recRef.current = rec
     recSourceRef.current = vTrack
     recStartRef.current = Date.now()
     setRecSecs(0)
     setRecording(true)
     if (vTrack) vTrack.addEventListener('ended', stopRecording)
     toast('ضبط شروع شد — فایل ویدیو روی همین دستگاه شما ذخیره می‌شود', 'info')
   } catch { toast('شروع ضبط ممکن نشد', 'error') }
 }

 /* تایمر ضبط */
 useEffect(() => {
   if (!recording) return
   const t = setInterval(() => setRecSecs((s) => s + 1), 1000)
   return () => clearInterval(t)
 }, [recording])

 /* ---------- اشتراک صفحه (مدرس) — فید مستقل [فیکس F36-c] ----------
  * قبلاً تصویر صفحه جای ترک دوربین را در «همان یک رکوردر» می‌گرفت؛ نتیجه:
  * هر روشن/خاموشی = رکوردر نو = سشن نو = ری‌بیلد همه گیرنده‌ها + وقفه در صدا.
  * حالا کانال صفحه (scr) جدا از کانال دوربین (cam) اجرا می‌شود؛ دوربین ادامه
  * دارد و دانش‌آموز هم‌زمان صفحه را بزرگ و مدرس را در نوار پایین می‌بیند */
 const stopScreenShare = () => {
   stopChannel(scrChRef.current)
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   screenStreamRef.current = null
   screenRef.current = false
   setScreen(false)
   /* فید صفحه سرور هم بسته شود — تا «اشتراک صفحه» تا ۹ ثانیه معلق نماند */
   if (classId) req(`/classes/${classId}/media/stop?k=screen`, { method: 'POST' }).catch(() => {})
 }
 const startScreenShare = async () => {
   if (!isTeacher) return
   if (!navigator.mediaDevices?.getDisplayMedia) {
     toast(inIframe ? 'اشتراک صفحه داخل قاب پیش‌نمایش ممکن نیست — کلاس را در پنجره جدید باز کنید' : 'مرورگر شما اشتراک صفحه را پشتیبانی نمی‌کند', 'error')
     return
   }
   const gdm = (audio) => navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 12, max: 15 } }, audio })
   let s = null
   try {
     /* اول با صدای تب تلاش می‌شود (ویدیوی آموزشی صدا داشته باشد)؛ رد شدن کاربر
        → همان‌جا تمام؛ خطای فنی صدا → بدون صدا دوباره */
     try { s = await gdm(true) }
     catch (e1) {
       if (e1?.name === 'NotAllowedError') throw e1
       s = await gdm(false)
     }
   } catch (e) {
     if (e?.name === 'NotAllowedError') toast(inIframe ? 'اشتراک صفحه فقط در پنجره کامل کار می‌کند — کلاس را در پنجره جدید باز کنید' : 'اشتراک صفحه لغو شد', 'info')
     else toast('اشتراک صفحه ممکن نشد', 'error')
     return
   }
   const track = s.getVideoTracks()[0]
   if (!track) { toast('اشتراک صفحه ممکن نشد', 'error'); return }
   screenTrackRef.current = track
   screenStreamRef.current = s
   track.addEventListener('ended', () => stopScreenShare())
   screenRef.current = true
   setScreen(true)
   setBoard(false)
   if (classId) {
     boardLocalTsRef.current = Date.now()
     req(`/classes/${classId}/board/open`, { method: 'POST', body: { open: false } }).catch(() => {})
   }
   scrChRef.current.init = true
   startChannel(scrChRef.current)
   toast('اشتراک صفحه شروع شد — دانش‌آموزان صفحه شما را تمام‌عرض می‌بینند', 'success')
 }
 const toggleScreenShare = () => { if (screen) stopScreenShare(); else startScreenShare() }
 const toggleBoard = async () => {
   const next = !board
   setBoard(next)
   boardLocalTsRef.current = Date.now()
   if (next) stopScreenShare()
   if (isTeacher) {
     try { await req(`/classes/${classId}/board/open`, { method: 'POST', body: { open: next } }) }
     catch (e) {
       if (!e.serverDown) { setBoard(!next); toast(e.message || 'تغییر وضعیت تخته ناموفق بود', 'error') }
     }
   }
 }
 const toggleBoardLock = async () => {
   const next = !boardLocked
   setBoardLocked(next)
   lockLocalTsRef.current = Date.now()
   try { await req(`/classes/${classId}/board/lock`, { method: 'POST', body: { locked: next } }) }
   catch (e) { if (!e.serverDown) { setBoardLocked(!next); toast(e.message || 'عملیات ناموفق بود', 'error') } }
 }
 const clearBoard = async () => {
   setStrokes([])
   draftsRef.current.clear()
   liveWbCurRef.current.after = 0
   try {
     const r = await req(`/classes/${classId}/board`, { method: 'DELETE' })
     if (typeof r?.rev === 'number') liveWbCurRef.current.clr = r.rev
   } catch { /* noop */ }
   redrawBoard()
 }
 const endClassNow = () => {
   setEndedModal(false)
   if (isTeacher && recording) stopRecording() // فایل ضبط قبل از پایان، ذخیره شود
   endLive(classId)
 }
 /** برگزاری جلسه جدید برای کلاسی که قبلاً تمام شده */
 const restartClass = () => {
   setLive({ status: 'live', startedAt: Date.now(), participants: participants })
   startLive(classId)
 }
 /* [فیکس F38] شروع از گیتِ «کلاس هنوز شروع نشده» — آپدیت خوش‌بینانه + POST به سرور؛
    اگر POST شکست بخورد poll وضعیت (هر ۲.۵ثانیه) دوباره به گیت برمی‌گرداند */
 const beginClass = () => {
   setLive((l) => ({ ...(l || { participants: [] }), status: 'live', startedAt: Date.now() }))
   startLive(classId)
 }

  /* ---------- رسم وایت‌برد ---------- */
 const drawStroke = (ctx, s) => {
   const pts = s.points || []
   if (!pts.length) return
   ctx.save()
   ctx.globalCompositeOperation = s.tool === 'erase' ? 'destination-out' : 'source-over'
   ctx.strokeStyle = s.color || '#0f172a'
   ctx.lineWidth = s.tool === 'erase' ? (s.size || 4) * 4 : (s.size || 4)
   ctx.lineCap = 'round'
   ctx.lineJoin = 'round'
   ctx.beginPath()
   if (pts.length === 1) {
     const [x, y] = pts[0]
     ctx.arc(x * WB_W, y * WB_H, ctx.lineWidth / 2, 0, Math.PI * 2)
     ctx.fillStyle = s.color || '#0f172a'
     if (s.tool !== 'erase') ctx.fill()
   } else {
     ctx.moveTo(pts[0][0] * WB_W, pts[0][1] * WB_H)
     for (let i = 1; i < pts.length - 1; i++) {
       const xc = (pts[i][0] + pts[i + 1][0]) / 2 * WB_W
       const yc = (pts[i][1] + pts[i + 1][1]) / 2 * WB_H
       ctx.quadraticCurveTo(pts[i][0] * WB_W, pts[i][1] * WB_H, xc, yc)
     }
     const last = pts[pts.length - 1]
     ctx.lineTo(last[0] * WB_W, last[1] * WB_H)
     ctx.stroke()
   }
   ctx.restore()
 }
 const redrawBoard = () => {
   const cv = canvasRef.current
   if (!cv) return
   const ctx = cv.getContext('2d')
   ctx.clearRect(0, 0, WB_W, WB_H)
   /* پس‌زمینه عکس/PDF — fit داخل قاب تخته */
   const img = bgImgRef.current
   if (img && img.complete && img.naturalWidth) {
     const r = Math.min(WB_W / img.naturalWidth, WB_H / img.naturalHeight)
     const w = img.naturalWidth * r, h = img.naturalHeight * r
     ctx.drawImage(img, (WB_W - w) / 2, (WB_H - h) / 2, w, h)
   }
   for (const s of strokesRef.current) drawStroke(ctx, s)
   /* قلم زنده دیگران (draft) — تا ۲.۵ ثانیه اعتبار دارد */
   const t = Date.now()
   for (const [uid, d] of draftsRef.current) {
     if (t - d.ts > 2500) { draftsRef.current.delete(uid); continue }
     drawStroke(ctx, d)
   }
 }

 const loadBg = (dataUrl) => {
   if (!dataUrl) { bgImgRef.current = null; setBoardBg(null); redrawBoard(); return }
   const img = new Image()
   img.onload = () => redrawBoard()
   img.src = dataUrl
   bgImgRef.current = img
   setBoardBg(dataUrl)
 }

 /* ---------- عکس / PDF روی تخته (فقط مدرس) ---------- */
 const sendBg = async (dataUrl) => {
   try {
     await req(`/classes/${classId}/board/bg`, { method: 'POST', body: { img: dataUrl } })
     liveWbCurRef.current.bgr = -1 // polling دوباره bg تازه را می‌گیرد
     loadBg(dataUrl)
     toast('تصویر روی تخته نمایش داده شد — می‌توانید رویش بکشید', 'success')
   } catch (e) { if (!e.serverDown) toast(e.message || 'ارسال تصویر ناموفق بود', 'error') }
 }
 const onBgFile = (file) => {
   if (!file || !isTeacher) return
   if (!file.type.startsWith('image/')) { toast('فقط فایل عکس (JPG/PNG/WebP)', 'error'); return }
   if (file.size > 8 * 1024 * 1024) { toast('حجم عکس باید کمتر از ۸ مگابایت باشد', 'error'); return }
   const rd = new FileReader()
   rd.onload = () => { if (typeof rd.result === 'string') sendBg(rd.result) }
   rd.readAsDataURL(file)
 }
 const renderPdfPage = async (n) => {
   const doc = pdfDocRef.current
   if (!doc) return
   const page = await doc.getPage(Math.min(doc.numPages, Math.max(1, n)))
   const vp1 = page.getViewport({ scale: 1 })
   const scale = Math.min(2, Math.min(1600 / vp1.width, 900 / vp1.height) * 1.6) // کیفیت بالا برای شارپ بودن
   const vp = page.getViewport({ scale })
   const cv = document.createElement('canvas')
   cv.width = Math.round(vp.width); cv.height = Math.round(vp.height)
   await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
   await sendBg(cv.toDataURL('image/jpeg', 0.82))
 }
 const onPdfFile = async (file) => {
   if (!file || !isTeacher) return
   if (file.size > 25 * 1024 * 1024) { toast('حجم PDF باید کمتر از ۲۵ مگابایت باشد', 'error'); return }
   toast('در حال آماده‌سازی PDF…', 'info')
   try {
     const pdfjs = await import('pdfjs-dist')
     const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
     pdfjs.GlobalWorkerOptions.workerSrc = worker.default
     const buf = await file.arrayBuffer()
     const doc = await pdfjs.getDocument({ data: buf }).promise
     pdfDocRef.current = doc
     setPdfPages(doc.numPages)
     setPdfPage(1)
     await renderPdfPage(1)
   } catch { toast('باز کردن PDF ممکن نشد', 'error') }
 }
 const gotoPdfPage = async (n) => {
   if (!pdfDocRef.current) return
   const nn = Math.min(pdfPages, Math.max(1, n))
   setPdfPage(nn)
   try { await renderPdfPage(nn) } catch { /* noop */ }
 }
 const clearBoardBg = async () => {
   pdfDocRef.current = null; setPdfPages(0); setPdfPage(1)
   try { await req(`/classes/${classId}/board/bg`, { method: 'DELETE' }); liveWbCurRef.current.bgr = -1; loadBg(null) } catch { /* noop */ }
 }
 useEffect(() => { redrawBoard() }, [strokes, board, boardBg])

 const boardPoint = (e) => {
   const rect = canvasRef.current.getBoundingClientRect()
   return [Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))]
 }
 const onWbDown = (e) => {
   if ((boardLocked && !isTeacher) || !user) return
   e.preventDefault()
   const p = boardPoint(e)
   drawingRef.current = { color: wbColor, size: wbSize, tool: wbTool, points: [p] }
   try { canvasRef.current.setPointerCapture(e.pointerId) } catch { /* noop */ }
 }
 const onWbMove = (e) => {
   const cur = drawingRef.current
   if (!cur) return
   const p = boardPoint(e)
   const last = cur.points[cur.points.length - 1]
   if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.0025) return
   cur.points.push(p)
   // ترسیم زنده‌ی همین قطعه
   const ctx = canvasRef.current?.getContext('2d')
   if (ctx) {
     ctx.save()
     ctx.globalCompositeOperation = cur.tool === 'erase' ? 'destination-out' : 'source-over'
     ctx.strokeStyle = cur.color
     ctx.lineWidth = cur.tool === 'erase' ? cur.size * 4 : cur.size
     ctx.lineCap = 'round'
     ctx.beginPath()
     ctx.moveTo(last[0] * WB_W, last[1] * WB_H)
     ctx.lineTo(p[0] * WB_W, p[1] * WB_H)
     ctx.stroke()
     ctx.restore()
   }
   /* رله رسم زنده به بقیه (هر ۹۰ms) — بدون ذخیره روی سرور */
   if (Date.now() - lastDraftSentRef.current > 90) {
     lastDraftSentRef.current = Date.now()
     req(`/classes/${classId}/board/draft`, { method: 'POST', body: { color: cur.color, size: cur.size, tool: cur.tool, points: cur.points.slice(-600) } }).catch(() => {})
   }
 }
 const onWbUp = async () => {
   const cur = drawingRef.current
   drawingRef.current = null
   if (!cur) return
   let points = cur.points
   if (points.length === 1) points = [points[0], [points[0][0] + 0.0015, points[0][1] + 0.0015]]
   try {
     const r = await req(`/classes/${classId}/board`, { method: 'POST', body: { color: cur.color, size: cur.size, tool: cur.tool, points } })
     if (r.stroke) {
       setStrokes((list) => (list.some((s) => s.id === r.stroke.id)) ? list : [...list, r.stroke])
       if (r.stroke.id != null) liveWbCurRef.current.after = Math.max(liveWbCurRef.current.after, r.stroke.id)
     }
     redrawBoard()
   } catch (e) {
     if (!e.serverDown) toast(e.message || 'ثبت روی تخته ناموفق بود', 'error')
     redrawBoard()
   }
 }

 /* ---------- صفحه پایان کلاس (هر دو نقش) ---------- */
 const endedDur = live?.endedAt && startedAt ? Math.max(0, Math.floor((live.endedAt - startedAt) / 1000)) : elapsed
 const endMm = String(Math.floor(endedDur / 60)).padStart(2, '0')
 const endSs = String(endedDur % 60).padStart(2, '0')
 if (classEnded) {
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
       <div className="sc-icon green" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
         <Icon name="check" size={28} />
       </div>
       <h2 style={{ fontSize: 19 }}>جلسه «{classInfo?.title || 'کلاس'}» به پایان رسید</h2>
       <p className="muted small mt8">
         مدت برگزاری: <b dir="ltr">{endMm}:{endSs}</b> • {faNum(participants.length)} حاضر • {faNum(messages.length)} پیام
         {isTeacher ? ' — ضبط جلسه برای دانشجوهای غایب منتشر می‌شود.' : ' — حضور شما ثبت شد.'}
       </p>
       <div className="row g8 mt24" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
         {isTeacher ? (
           <>
             <button className="btn btn-primary" onClick={restartClass}><Icon name="play" filled size={15} /> برگزاری جلسه جدید</button>
             <Link to="/panel/teacher/classes" className="btn btn-ghost">کلاس‌های من</Link>
             {classId && <Link to={`/panel/teacher/classes/${classId}`} className="btn btn-ghost">مدیریت کلاس و ضبط‌ها</Link>}
           </>
         ) : (
           <>
             <Link to="/panel/student/schedule" className="btn btn-ghost">برنامه هفتگی</Link>
             {classId && <Link to={`/panel/student/classes/${classId}`} className="btn btn-primary">جزئیات کلاس و ضبط‌ها</Link>}
           </>
         )}
       </div>
     </div>
   )
 }

 /* ---------- [فیکس] نشست مرده → پیام صریح، نه گیت گمراه‌کنندهٔ «شروع کلاس» ---------- */
 if (authDenied) {
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
       <div className="sc-icon" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'rgba(248,113,113,0.14)', color: 'var(--red)' }}>
         <Icon name="lock" size={28} />
       </div>
       <h2 style={{ fontSize: 19, marginBottom: 6 }}>دسترسی به این کلاس ممکن نیست</h2>
       <p className="muted small mb16">نشست شما منقضی شده یا اجازهٔ مدیریت این کلاس را ندارید — لطفاً با حساب مدرسِ همان کلاس دوباره وارد شوید.</p>
       <div className="row g12" style={{ justifyContent: 'center' }}>
         <a href="/auth?role=teacher" className="btn btn-primary">ورود مجدد</a>
         <Link to="/panel/teacher/live" className="btn btn-ghost">بازگشت</Link>
       </div>
     </div>
   )
 }

 /* ---------- [فیکس F38] گیت شروع کلاس — فقط مدرس ----------
  * اگر سرور کلاس را «scheduled» می‌داند، اتاق نباید شبیه جلسهٔ زنده رندر شود.
  * قبلاً معلم اتاق را می‌دید (با تایمر ۰۰:۰۰ و بج قرمز) در حالی که POST /start
  * هرگز ارسال نشده بود → دانش‌آموز برای همیشه روی «زمان‌بندی شده» می‌ماند. */
 if (isTeacher && stateChecked && !classEnded && live?.status !== 'live') {
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
       <div className="sc-icon teal" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
         <Icon name="video" size={30} />
       </div>
       <h2 style={{ fontSize: 19, marginBottom: 6 }}>آمادهٔ برگزاری «{classInfo?.title || 'کلاس'}»</h2>
       <p className="muted small mb16">این جلسه هنوز روی سرور شروع نشده است — با زدن دکمهٔ زیر، کلاس برای همهٔ دانش‌آموزانِ ثبت‌نام‌شده زنده می‌شود و دکمهٔ ورود در پنل آن‌ها فعال خواهد شد.</p>
       <div className="row g12" style={{ justifyContent: 'center' }}>
         <button className="btn btn-primary btn-lg" onClick={beginClass}>
           <Icon name="play" filled size={17} /> شروع کلاس زنده
         </button>
         <Link to="/panel/teacher/live" className="btn btn-ghost">بازگشت</Link>
       </div>
       <p className="muted small mt16">پس از شروع، دوربین/میکروفون و اشتراک صفحه را از نوار پایین اتاق روشن کنید.</p>
     </div>
   )
 }

 /* ---------- چیدمان صحنه ---------- */
 const tsFeed = !isTeacher ? feedInfo.ts : null          // فید اشتراک صفحهٔ مدرس [F36-c]
 const tFeed = !isTeacher ? feedInfo.t : null           // استریم دوربین/صدای مدرس (برای دانش‌آموز)
 const sFeeds = Object.entries(feedInfo).filter(([k]) => k !== 't' && k !== 'ts') // استریم دانش‌آموزانِ دارای اجازه
 const watchingBoard = board
 const watchingScreen = isTeacher ? screen : !!tsFeed
 const watchingFeed = !isTeacher && !watchingScreen && !!tFeed
 const stageBusy = watchingBoard || watchingScreen || watchingFeed

 /* [فیکس F37-a] باگ بحرانی «دانش‌آموز صفحه را نمی‌بیند»: سرور برای فید اشتراک
  * صفحه همیشه cam=false می‌فرستد (چون ترک دوربین ندارد) و camOff=!cam همیشه
  * true می‌شد → ویدیو با visibility:hidden مخفی و زیر آواتار پوشاننده دفن می‌شد.
  * فید صفحه هرگز نباید با گیت «دوربین خاموش» مخفی شود — آن گیت فقط برای فید دوربین معنا دارد
  * [فیکس F37-e] کلید tile شامل pv (pid پلیر) است — بعد از هر rebuild پلیر،
  * RelayVideo با «عنصر ویدیوی کاملاً تازه» remount می‌شود (قانون یک‌MS-یک‌عنصر:
  * MediaSource بازی هرگز به عنصر دوم وصل نمی‌شود؛ پایپ‌لاین تمیز = بدون sb-error) */
 const feedTile = (key, f, big) => (
   <RelayVideo key={`${key}:${f.pv ?? 0}`} player={feedPlayersRef.current.get(key)} name={f.name} color={f.color} camOff={!f.cam && !f.screen} screen={f.screen} big={big} />
 )

 /* کاشی‌های حالت عادی: رسانه خودم + استریم دانش‌آموزان (برای مدرس) یا استریم بقیه (برای دانش‌آموز) */
 const allTiles = [
   ...(localStream || !isTeacher ? [{ key: 'me', self: true, name: me, stream: localStream, camOn: cam, color: user?.color || 'grad-3' }] : []),
   ...sFeeds.map(([uid, f]) => ({ key: uid, relay: true, f })),
 ]
 const canDraw = user && (!boardLocked || isTeacher)

 const ctl = (on) => `ctl ${on ? 'on' : ''}`
 const roleLabel = (r) => (r === 'teacher' ? 'مدرس' : r === 'admin' ? 'مدیر' : '')

 /* ---------- نوار وضعیت زندهٔ رسانه (هر ثانیه با تیک بازمحاسبه می‌شود) ---------- */
 const st = camChRef.current.stats
 const nowMs = Date.now()
 const outFresh = st.lastOkAt > 0 && nowMs - st.lastOkAt < 3000
 const sendingMedia = isTeacher && !!(localStream || screen)
 const rateKbps = Math.round(st.recent.reduce((a, x) => a + x[1], 0) / 4 / 1024)
 const httpsUrl = (() => { try { const u = new URL(window.location.href); if (u.protocol === 'http:') u.protocol = 'https:'; return u.toString() } catch { return '' } })()

 return (
 <div>
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}><DataIcon name={classInfo?.icon} size={19} /> {classInfo?.title || 'کلاس آنلاین زنده'}</h2>
 <span className="muted small">
 {classInfo?.teacher || 'مدرس‌یار'} • {classInfo?.dur || 90} دقیقه • {faNum(participants.length)} نفر حاضر
 </span>
 </div>
 <span className="row g8" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
 {recording && (
   <span className="badge b-red live-pulse" style={{ padding: '5px 12px' }} dir="ltr">
   ● REC {String(Math.floor(recSecs / 60)).padStart(2, '0')}:{String(recSecs % 60).padStart(2, '0')}
   </span>
 )}
 <span className="badge b-red"><i className="live-red-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99 }} /> پخش زنده</span>
 </span>
 </div>

 {!secure && (
 <div className="insecure-banner">
 <span>⚠️ دوربین، میکروفون و اشتراک صفحه <b>فقط در آدرس امن (HTTPS)</b> کار می‌کند — لطفاً با این آدرس وارد شوید:</span>
 {httpsUrl && <code>{httpsUrl}</code>}
 </div>
 )}
 <div className="media-status">
 {isTeacher ? (
 sendingMedia ? (
 outFresh ? (
 <span className="media-chip ok"><i className="dot" /> در حال ارسال {screen && localStream ? 'صفحه + دوربین' : screen ? 'اشتراک صفحه' : 'صدا/تصویر'} به دانش‌آموزان — {faNum(rateKbps)} کیلوبایت/ثانیه • {faNum(st.n)} تکه ✓</span>
 ) : (
 <span className="media-chip warn"><i className="dot" /> ارسال با وقفه افتاده — به‌صورت خودکار از سر گرفته می‌شود…</span>
 )
 ) : (
 <span className="media-chip err"><i className="dot" /> ⛔ هیچ صدا و تصویری برای دانش‌آموزان ارسال نمی‌شود — دوربین یا اشتراک صفحه را روشن کنید (تخته و چت مستقل از این است)</span>
 )
 ) : (
 tsFeed ? (
 <span className="media-chip ok"><i className="dot" /> اشتراک صفحهٔ مدرس فعال است ✓{tFeed ? ' — دوربین مدرس در نوار پایین' : ''} — برای شنیدن صدا یک بار صفحه را لمس/کلیک کنید</span>
 ) : tFeed ? (
 <span className="media-chip ok"><i className="dot" /> پخش زندهٔ مدرس فعال است ✓ (صدا/تصویر) — برای شنیدن صدا یک بار صفحه را لمس/کلیک کنید</span>
 ) : (
 <span className="media-chip warn"><i className="dot" /> در انتظار پخش زندهٔ مدرس… به‌محض روشن شدن دوربین یا اشتراک صفحه، همین‌جا نمایش داده می‌شود</span>
 )
 )}
 </div>

 <div className={`live-grid ${pseudoFs ? 'pseudo-fs' : ''}`} ref={roomRef}>
 <div className="live-stage">
 <div className={`live-view ${watchingBoard ? 'board' : watchingScreen || watchingFeed ? 'screen' : 'camera'}`}>
 <span className="live-label"><i className="live-red-dot" /> {watchingBoard ? 'وایت‌برد مشترک' : watchingScreen ? (isTeacher ? 'اشتراک صفحه شما' : 'اشتراک صفحه مدرس') : watchingFeed ? 'ویدیوی زنده مدرس' : 'کلاس زنده'}</span>
 <span className="live-timer" dir="ltr">{mm}:{ss}</span>

 {/* چیپ دست‌های بالا — فقط مدرس؛ کلیک = رفتن به تب حاضران */}
 {isTeacher && handsUp > 0 && (
   <button className="hand-chip" onClick={() => setTab('parts')}>✋ {faNum(handsUp)} دانش‌آموز دست بالا کرده — مشاهده</button>
 )}

 {watchingBoard ? (
   <div className="wb-wrap">
     {isTeacher && (
       <div className="wb-toolbar" dir="rtl">
         <button className={`wb-tool ${wbTool === 'pen' ? 'on' : ''}`} title="قلم" onClick={() => setWbTool('pen')}><Icon name="edit" size={15} /></button>
         <button className={`wb-tool ${wbTool === 'erase' ? 'on' : ''}`} title="پاک‌کن" onClick={() => setWbTool('erase')}><Icon name="eraser" size={15} /></button>
         <span className="wb-sep" />
         {PEN_COLORS.map((c) => (
           <button key={c} className={`wb-dot ${wbColor === c && wbTool === 'pen' ? 'on' : ''}`} style={{ background: c }} onClick={() => { setWbColor(c); setWbTool('pen') }} />
         ))}
         <span className="wb-sep" />
         {PEN_SIZES.map((s) => (
           <button key={s} className={`wb-size ${wbSize === s ? 'on' : ''}`} onClick={() => setWbSize(s)}><i style={{ width: s + 3, height: s + 3 }} /></button>
         ))}
         <span className="wb-sep" />
         {/* عکس / PDF روی تخته — فقط مدرس */}
         <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { onBgFile(e.target.files?.[0]); e.target.value = '' }} />
         <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => { onPdfFile(e.target.files?.[0]); e.target.value = '' }} />
         <button className="wb-tool" title="باز کردن عکس روی تخته و نوشتن روی آن" onClick={() => bgInputRef.current?.click()}><Icon name="image" size={15} /></button>
         <button className="wb-tool" title="باز کردن PDF روی تخته و نوشتن روی آن" onClick={() => pdfInputRef.current?.click()}><Icon name="file" size={15} /></button>
         {pdfPages > 1 && (
           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} dir="ltr">
             <button className="wb-tool" title="صفحه قبل" onClick={() => gotoPdfPage(pdfPage - 1)} disabled={pdfPage <= 1} style={{ opacity: pdfPage <= 1 ? 0.4 : 1 }}>‹</button>
             <b style={{ fontSize: 11, minWidth: 34, textAlign: 'center' }}>{faNum(pdfPage)}/{faNum(pdfPages)}</b>
             <button className="wb-tool" title="صفحه بعد" onClick={() => gotoPdfPage(pdfPage + 1)} disabled={pdfPage >= pdfPages} style={{ opacity: pdfPage >= pdfPages ? 0.4 : 1 }}>›</button>
           </span>
         )}
         {boardBg && (
           <button className="wb-tool danger" title="برداشتن عکس/PDF از تخته" onClick={clearBoardBg}><Icon name="x" size={15} /></button>
         )}
         <span className="wb-sep" />
         {isTeacher && (
           <>
             <button className="wb-tool" title={boardLocked ? 'باز کردن تخته برای دانش‌آموزان' : 'قفل کردن تخته'} onClick={toggleBoardLock}><Icon name={boardLocked ? 'lock' : 'unlock'} size={15} /></button>
             <button className="wb-tool danger" title="پاک کردن همه" onClick={clearBoard}><Icon name="trash" size={15} /></button>
           </>
         )}
       </div>
     )}
     {!isTeacher && boardLocked && <div className="wb-locknote">تخته توسط مدرس قفل است — فقط مشاهده</div>}
     {!isTeacher && !boardLocked && <div className="wb-locknote">تخته باز است — می‌توانید بنویسید ✍️</div>}
     <canvas
       ref={canvasRef}
       width={WB_W}
       height={WB_H}
       className="wb-canvas"
       style={{ cursor: canDraw ? 'crosshair' : 'default', touchAction: 'none' }}
       onPointerDown={canDraw ? onWbDown : undefined}
       onPointerMove={canDraw ? onWbMove : undefined}
       onPointerUp={canDraw ? onWbUp : undefined}
       onPointerLeave={canDraw ? onWbUp : undefined}
     />
   </div>
 ) : watchingScreen ? (
   isTeacher
     ? <ScreenPreview stream={screenStreamRef.current} />
     : tsFeed && feedTile('ts', tsFeed, true)
 ) : watchingFeed ? (
   feedTile('t', tFeed, true)
 ) : (
   <div className="cam-grid">
     {allTiles.length ? allTiles.map((t) => (
       t.relay
         ? feedTile(t.key, t.f, allTiles.length <= 2)
         : <VideoTile key={t.key} stream={t.stream} self={t.self} name={t.name} camOn={t.camOn} color={t.color} big={allTiles.length <= 2} />
     )) : (
       <div className="live-tile">
         <Avatar name={classInfo?.teacher || 'مدرس'} color="grad-0" size={110} />
         <b style={{ fontSize: 16 }}>{classInfo?.teacher || 'مدرس'}</b>
         <span className="muted small" style={{ maxWidth: 320, textAlign: 'center', lineHeight: 1.9 }}>
           {isTeacher
             ? 'دوربین خود را روشن کنید تا دانش‌آموزان شما را ببینند'
             : 'در انتظار پخش زنده مدرس… به‌محض روشن شدن دوربین یا اشتراک صفحه یا تخته، همین‌جا نمایش داده می‌شود'}
         </span>
       </div>
     )}
   </div>
 )}

 {/* کارت دسترسی دوربین — فقط برای مدرس؛ دانش‌آموز مستقیم وارد حالت تماشا می‌شود
     (مثل اسکای‌روم: اول تماشا، بعد در صورت نیاز دست بلند کردن) */}
 {isTeacher && !localStream && !mediaSkipped && !stageBusy && (
   <PermissionCard
     state={mediaErr || 'idle'}
     permBusy={permBusy}
     diag={mediaDiag}
     onRequest={startMedia}
     onSkip={skipMedia}
     inIframe={inIframe}
     onOpenTab={openNewTab}
     onGoHttps={goHttps}
     needsApproval={false}
     handSent={false}
   />
 )}

 {/* در حال دیدن استریم مدرس ولی بدون اجازه صحبت — نوار باریک درخواست (فقط با کلیک خود دانش‌آموز) */}
 {!isTeacher && needsApproval && stageBusy && !mediaSkipped && (
   <div className="speak-req-bar">
     {(myHand || hand) ? (
       <span className="small" style={{ color: '#d97706' }}>✋ درخواست شما برای مدرس ارسال شد — منتظر تایید…</span>
     ) : (
       <button className="btn btn-primary btn-sm" onClick={requestSpeakPermission}>
         <Icon name="hand" size={14} /> سوال دارم — بلند کردن دست برای گفتگو
       </button>
     )}
   </div>
 )}

 {/* پنل گفتگوی دانش‌آموز — بعد از اجازه مدرس، دکمه‌های میکروفون/دوربین در جای خودشان
     (مثل اسکای‌روم/میت: انتخاب می‌کنید چه چیزی روشن شود؛ قاب اصلی برای مدرس می‌ماند) */}
 {!isTeacher && canSpeak && (!mic || !cam) && (
   <div className="speak-panel">
     <span className="sp-hint"><Icon name="hand" size={13} /> مدرس اجازه گفتن داد</span>
     {!mic && <button className="btn btn-primary btn-sm" onClick={toggleMic}><Icon name="mic" size={14} /> روشن کردن میکروفون</button>}
     {!cam && <button className="btn btn-ghost btn-sm" onClick={toggleCam}><Icon name="camera" size={14} /> روشن کردن دوربین</button>}
   </div>
 )}

 {/* بعد از «ادامه بدون دوربین» — دکمه کوچک فعال‌سازی مجدد گوشه صحنه */}
 {mediaSkipped && !localStream && (
   <button
     className="btn btn-ghost btn-sm"
     style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, zIndex: 6, background: 'var(--card)', boxShadow: 'var(--shadow-1)' }}
     onClick={startMedia}
   >
     <Icon name="camera" size={14} /> فعال‌سازی دوربین و میکروفون
   </button>
 )}

 {/* نوار کاشی‌های تصویری هنگام اشتراک صفحه/تخته/دیدن استریم مدرس — کاشی خودِ دانش‌آموز همیشه هست.
     هر کاشی فقط وقتی در نوار می‌آید که صحنه خودش آن را نشان نمی‌دهد — دو ویدیو روی یک پلیر
     نمی‌جنگند (یکی MediaSource را از دیگری می‌دزدد) */}
 {stageBusy && (localStream || !isTeacher || tFeed || tsFeed || sFeeds.length > 0) && (
   <div className="cam-strip">
     {(localStream || !isTeacher) && (
       <div style={{ width: 128, flexShrink: 0 }}>
         <VideoTile stream={localStream} self name={me} camOn={cam} color={user?.color || 'grad-3'} />
       </div>
     )}
     {tFeed && !watchingFeed && feedTile('t', tFeed, false)}
     {tsFeed && !watchingScreen && feedTile('ts', tsFeed, false)}
     {sFeeds.map(([uid, f]) => <div key={uid} style={{ width: 128, flexShrink: 0 }}>{feedTile(uid, f, false)}</div>)}
   </div>
 )}
 </div>

 <div className="live-controls">
 <button className={ctl(mic) + (mic ? '' : ' off')} onClick={toggleMic} aria-pressed={!mic}>
 <Icon name="mic" /> <span className="ctl-tip">{mic ? 'قطع میکروفون' : 'وصل میکروفون'}</span>
 </button>
 <button className={ctl(cam) + (cam ? '' : ' off')} onClick={toggleCam} aria-pressed={!cam}>
 <Icon name="camera" /> <span className="ctl-tip">{cam ? 'خاموش کردن دوربین' : 'روشن کردن دوربین'}</span>
 </button>
 {/* [فیکس F37-b] onClick بدون آرگومان — رویداد موس نباید به‌جای explicitId برود */}
 <button className={ctl(false)} onClick={() => switchCam()}>
 <Icon name="camFlip" /> <span className="ctl-tip">تعویض دوربین (جلو/عقب)</span>
 </button>
 {camDevices.length > 1 && (
 <select
   className="ctl-select"
   value={camDeviceId}
   onChange={(e) => { if (e.target.value) switchCam(e.target.value) }}
   onMouseDown={(e) => { if (!isTeacher && !canSpeakRef.current) { e.preventDefault(); requestSpeakPermission() } }}
   aria-label="انتخاب دوربین"
   dir="ltr"
 >
   {!camDeviceId && <option value="" disabled>دوربین</option>}
   {camDevices.map((d) => (
     <option key={d.deviceId} value={d.deviceId}>{d.label || `دوربین ${d.deviceId.slice(0, 6)}`}</option>
   ))}
 </select>
 )}
 {isTeacher && (
 <button className={ctl(screen)} onClick={toggleScreenShare} aria-pressed={screen}>
 <Icon name="monitor" /> <span className="ctl-tip">{screen ? 'قطع اشتراک صفحه' : 'اشتراک صفحه سیستم'}</span>
 </button>
 )}
 {isTeacher && (
 <button className={ctl(board)} onClick={toggleBoard} aria-pressed={board}>
 <Icon name="board" /> <span className="ctl-tip">{board ? 'بستن وایت‌برد' : 'وایت‌برد دیجیتال'}</span>
 </button>
 )}
 <button className={ctl(fsActive || pseudoFs)} onClick={toggleFs} aria-pressed={fsActive || pseudoFs}>
 <Icon name={fsActive || pseudoFs ? 'minimize' : 'maximize'} /> <span className="ctl-tip">{fsActive || pseudoFs ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'}</span>
 </button>
 {isTeacher ? (
 <button className={ctl(recording)} onClick={() => (recording ? stopRecording() : startRecording())}>
 <Icon name="activity" /> <span className="ctl-tip">{recording ? 'توقف و ذخیره ضبط' : 'ضبط کلاس'}</span>
 </button>
 ) : (
 <button className={ctl(hand) + (hand ? ' on' : '')} onClick={() => { setHand(!hand); toast(hand ? 'دست شما پایین آمد' : 'دست شما بالا رفت — مدرس متوجه می‌شود', 'info') }}>
 <Icon name="hand" /> <span className="ctl-tip">{hand ? 'پایین آوردن دست' : 'بلند کردن دست'}</span>
 </button>
 )}
 {isTeacher ? (
 <button className="ctl danger" onClick={() => setEndedModal(true)}>
 <Icon name="logout" size={19} /> پایان کلاس
 </button>
 ) : (
 <button className="ctl danger" onClick={() => setEndedModal(true)}>
 <Icon name="logout" size={19} /> خروج از کلاس
 </button>
 )}
 </div>
 </div>

 <div className="live-side">
 <div className="card" style={{ flex: 1 }}>
 <div className="side-tabs">
 <button className={`tab-btn ${tab === 'chat' ? 'on' : ''}`} onClick={() => setTab('chat')}> گفتگو</button>
 <button className={`tab-btn ${tab === 'parts' ? 'on' : ''}`} onClick={() => setTab('parts')}>
 حاضران ({faNum(participants.length)}){handsUp > 0 ? ` • ✋${faNum(handsUp)}` : ''}
 </button>
 </div>
 {tab === 'chat' ? (
 <>
 <div className="chat-body" ref={chatRef}>
 {messages.length === 0 && (
 <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>اولین پیام را شما بنویسید…</div>
 )}
 {messages.map((m) => (
 <div className={`chat-msg ${m.self ? 'self' : ''}`} key={m.id}>
 <b>{m.role === 'teacher' ? '👨‍🏫 ' : ''}{m.name}{m.self ? ' (شما)' : ''}:</b> {m.body}
 </div>
 ))}
 </div>
 <form className="chat-input" onSubmit={send}>
 <input className="input" placeholder="پیام خود را بنویسید…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} />
 <button className="btn btn-primary btn-sm" disabled={sending}><Icon name="send" size={16} /></button>
 </form>
 </>
 ) : (
 <div className="part-list">
 {participants.length === 0 && (
 <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>هنوز کسی متصل نشده…</div>
 )}
 {participants.map((p) => (
 <div className="part-row" key={p.id}>
 <Avatar name={p.name} size={32} color={p.color || 'grad-1'} />
 <span className="small">{p.name}{p.id === user?.id ? ' (شما)' : ''} {roleLabel(p.role) && <span className="badge b-teal" style={{ fontSize: 10, padding: '1px 8px' }}>{roleLabel(p.role)}</span>}{p.hand ? ' ✋' : ''}{p.canSpeak && p.role === 'student' ? <span className="badge b-green" style={{ fontSize: 10, padding: '1px 8px', marginInlineStart: 4 }}>اجازه داده شده</span> : ''}</span>
 {isTeacher && p.role === 'student' && p.id !== user?.id && (
   p.canSpeak ? (
     <button className="btn btn-ghost btn-sm" style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0 }} onClick={() => grantPerm(p.id, false)}>لغو اجازه</button>
   ) : p.hand ? (
     <button className="btn btn-primary btn-sm" style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0 }} onClick={() => grantPerm(p.id, true)}>✋ اجازه دادن</button>
   ) : null
 )}
 <div className="pr-icons">
 <Icon name="mic" className={p.id === user?.id ? (mic ? '' : 'muted-off') : ''} size={15} />
 <Icon name="camera" className={p.id === user?.id ? (cam ? '' : 'muted-off') : ''} size={15} />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* پایان کلاس */}
 <Modal open={endedModal} title={isTeacher ? 'پایان کلاس' : 'خروج از کلاس'} onClose={() => setEndedModal(false)}>
 {isTeacher ? (
 <>
 <p className="muted small mb16">خلاصه جلسه برای ثبت در پنل:</p>
 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{mm}:{ss}</b><span className="sc-label">مدت کلاس</span></div>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(participants.length)}</b><span className="sc-label">حاضران</span></div>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(messages.length)}</b><span className="sc-label">پیام گفتگو</span></div>
 </div>
 <div className="modal-actions">
 <button className="btn btn-primary" onClick={endClassNow}>ثبت و پایان</button>
 <button className="btn btn-ghost" onClick={() => setEndedModal(false)}>بازگشت به کلاس</button>
 </div>
 </>
 ) : (
 <>
 <p className="muted small">از کلاس خارج می‌شوید؟ حضور و غیاب شما ثبت شده است.</p>
 <div className="modal-actions">
 <button className="btn btn-primary" onClick={() => {
   setEndedModal(false)
   stopChannel(camChRef.current)
   stopChannel(scrChRef.current)
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {})
   toast('از کلاس خارج شدید — حضور شما ثبت شد', 'info')
   /* خروج واقعی از اتاق — قبلاً کاربر بعد از «خارج شو» در همان اتاق می‌ماند */
   nav(`/panel/student/classes/${classId}`)
 }}>بله، خارج شو</button>
 <button className="btn btn-ghost" onClick={() => setEndedModal(false)}>بازگشت</button>
 </div>
 </>
 )}
 </Modal>
 </div>
 )
}




