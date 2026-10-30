import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataIcon } from '../utils/icons'
import Icon from './Icon'
import { Avatar } from './ui'
import { Modal } from './Modal'
import { useApp } from '../store/AppContext'
import { faNum } from '../utils/format'
import { req, getToken } from '../services/http'

/**
 * اتاق کلاس زنده — نسخه رله رسانه (بدون WebRTC)
 * ---------------------------------------------------------------------
 * چرا رله؟ WebRTC حتی با TURN رایگان پشت NAT اپراتور موبایل گیر می‌کند و
 * «بی‌صدا» شکست می‌خورد. اینجا صدا/تصویر با MediaRecorder به تکه‌های ۱
 * ثانیه‌ای webm شکسته می‌شود و از همان مسیر HTTP چت عبور می‌کند:
 *   • ارسال:  POST /media/up  (binary)
 *   • دریافت: GET  /media/feeds?cur=…  (polling با کرسر — ۸۰۰ms)
 * نتیجه: اگر چت کار کند، صدا و تصویر هم صددرصد می‌رسد (تاخیر ~۱.۵ ثانیه).
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
    queue: [], alive: true, keepT: null, trimT: null, broken: false, pid: ++FEED_PID,
  }
  const pump = () => {
    if (!p.sb || p.sb.updating || !p.queue.length || !p.alive) return
    const buf = p.queue.shift()
    try {
      p.sb.appendBuffer(buf)
    } catch (e0) {
      /* صف پر/حجم — کمی از عقب پخش‌شده پاک و دوباره صف */
      try {
        const el = p.el
        const b = el?.buffered
        if (b?.length && el.currentTime - b.start(0) > 4) {
          p.sb.remove(b.start(0), el.currentTime - 3)
          p.queue.unshift(buf)
        } else if (e0?.name === 'InvalidStateError') {
          breakStream('append-threw:' + e0.name)
        }
      } catch { /* noop */ }
    }
  }
  /** خود-ترمیمی: خطای decode/اپند → کرسر گیرنده صفر شود تا سرور init تازه بفرستد */
  let lastBreak = 0
  const breakStream = (why) => {
    if (!p.alive || Date.now() - lastBreak < 2500) return
    lastBreak = Date.now()
    p.broken = true
    try { p.onNeedReset?.() } catch { /* noop */ }
  }
  const rebuild = (sess) => {
    p.sess = sess
    p.queue = []
    p.broken = false
    try { p.sb?.abort?.() } catch { /* noop */ }
    p.sb = null
    const MS = getMS()
    if (!MS) return
    const ms = new MS()
    p.ms = ms
    ms.addEventListener('sourceopen', () => {
      if (!p.alive || p.ms !== ms) return
      try {
        p.sb = ms.addSourceBuffer(p.mime)
        try { p.sb.mode = 'segments' } catch { /* noop */ }
        p.sb.addEventListener('updateend', pump)
        p.sb.addEventListener('error', () => breakStream('sb-error')) // خطای دکود → init تازه
        pump()
      } catch { /* noop */ }
    })
    if (p.el) {
      try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
      p.objUrl = URL.createObjectURL(ms)
      p.el.src = p.objUrl
      p.el.play?.().catch(() => {})
    }
  }
  /** تکه تازه — اگر سشن عوض شده بود، خودکار از نو ساخته می‌شود */
  p.push = (sess, b64) => {
    if (!p.alive || !b64) return
    if (p.sess !== sess) rebuild(sess)
    const buf = b64ToBuf(b64)
    p.queue.push(buf)
    pump()
  }
  /** شروع از سر (گپ یا تازه‌وارد) — همیشه MediaSource تازه ساخته می‌شود؛
   *  چون init دوباره می‌آید و افزودن دوباره‌ی init به SourceBuffer قبلی، دکودر را
   *  برای همیشه می‌شکند (باگ «تصویر بعد از یک گپ دیگر نمی‌آید») */
  p.hardReset = (sess) => {
    p.queue = []
    rebuild(sess)
  }
  p.attach = (el) => {
    if (!el || p.el === el || !p.alive) return // پلیر مرده هرگز به عنصر وصل نمی‌شود
    /* عنصر قبلی آزاد شود تا MediaSource بتواند به عنصر تازه وصل شود */
    if (p.el) { try { p.el.removeAttribute('src'); p.el.load?.() } catch { /* noop */ } }
    p.el = el
    if (!p.ms) return
    try { if (p.objUrl) URL.revokeObjectURL(p.objUrl) } catch { /* noop */ }
    p.objUrl = URL.createObjectURL(p.ms)
    el.src = p.objUrl
    el.play?.().catch(() => {})
  }
  p.destroy = () => {
    p.alive = false
    clearInterval(p.keepT)
    clearInterval(p.trimT)
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
   * • عقب‌ماندگی > ۱.۶ ثانیه: جبران با پرش به لبه */
  p.liveEdge = () => {
    const el = p.el
    if (!el || el.readyState < 1 || !p.alive) return
    try {
      const b = el.buffered
      if (!b.length) return
      const end = b.end(b.length - 1)
      if (el.currentTime <= b.start(0) + 0.05 || end - el.currentTime > 1.2) {
        el.currentTime = Math.max(0, end - 0.55)
      }
      if (el.paused) el.play?.().catch(() => {})
    } catch { /* noop */ }
  }
  p.keepT = setInterval(() => p.liveEdge(), 700)
  p.trimT = setInterval(() => {
    const el = p.el
    const sb = p.sb
    if (!el || !sb || sb.updating || !p.alive) return
    try {
      const b = el.buffered
      if (b.length && el.currentTime - b.start(0) > 15) sb.remove(b.start(0), el.currentTime - 8)
    } catch { /* noop */ }
  }, 6000)
  return p
}

/**
 * پلیر جایگزین برای مرورگرهای بدون MediaSource (سافاری iOS قدیمی‌تر از ۱۷٫۱):
 * تکه‌ها جمع و هر ~۳٫۵ ثانیه یک Blob تازه ساخته و پخش می‌شود —
 * تاخیر بیشتر ولی کار می‌کند. حافظه سقف دارد؛ در سقف init تازه از سرور می‌آید.
 */
function createBlobPlayer(fmt) {
  const p = {
    mime: null, fmt, mode: 'blob', el: null, objUrl: null, sess: null, alive: true,
    parts: [], bytes: 0, dirty: false, buildT: null, onNeedReset: null, pid: ++FEED_PID,
  }
  const rebuild = () => {
    if (!p.el || !p.parts.length || !p.alive) return
    try {
      if (p.objUrl) URL.revokeObjectURL(p.objUrl)
      const blob = new Blob(p.parts, { type: p.fmt === 'mp4' ? 'video/mp4' : 'video/webm' })
      p.objUrl = URL.createObjectURL(blob)
      p.el.src = p.objUrl
      p.el.play?.().catch(() => {})
      /* پرش به لبه زنده */
      p.el.addEventListener('loadedmetadata', () => {
        try {
          if (p.el && p.el.duration && isFinite(p.el.duration)) p.el.currentTime = Math.max(0, p.el.duration - 0.4)
          p.el?.play?.().catch(() => {})
        } catch { /* noop */ }
      }, { once: true })
    } catch { /* noop */ }
  }
  p.push = (sess, b64) => {
    if (!p.alive || !b64) return
    if (p.sess !== sess) { p.sess = sess; p.parts = []; p.bytes = 0 }
    const buf = b64ToBuf(b64)
    p.parts.push(buf)
    p.bytes += buf.byteLength
    p.dirty = true
    if (p.bytes > 30 * 1024 * 1024) {
      /* سقف حافظه — کرسر گیرنده صفر شود تا سرور init تازه بفرستد */
      p.parts = []; p.bytes = 0; p.sess = null
      try { p.onNeedReset?.() } catch { /* noop */ }
    }
  }
  p.hardReset = (sess) => { p.sess = null }
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
  }
  p.buildT = setInterval(() => {
    if (p.dirty && p.el && p.alive) { p.dirty = false; rebuild() }
  }, 1800)
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

/* سیاست autoplay موبایل: با اولین لمس کاربر در صفحه، صدای همه استریم‌های در انتظار فعال می‌شود */
const pendingUnmute = new Set()
if (typeof document !== 'undefined' && !pendingUnmute.armed) {
  pendingUnmute.armed = true
  document.addEventListener('pointerdown', () => {
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
    /* بی‌صدا شروع کن — پخش همیشه موفق می‌شود و فریم‌ها می‌آیند */
    v.muted = true
    v.play?.().catch(() => {})
    /* فعال‌سازی صدا با اولین تعامل کاربر در صفحه */
    const unmute = () => {
      const vv = ref.current
      if (!vv) return
      vv.muted = false
      vv.play?.().then(() => { setNeedTap(false); pendingUnmute.delete(unmute) }).catch(() => { vv.muted = true; setNeedTap(true) })
    }
    pendingUnmute.add(unmute)
    setNeedTap(true)
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

 /* ---------- رله رسانه — فرستنده ---------- */
 const outRef = useRef(null) // { rec, kind, stopping }
 const pendingInitRef = useRef(true)
 const upChainRef = useRef(Promise.resolve())
 /* آمار زنده ارسال — برای نوار وضعیت (دانش‌آموز بودن بدون صدا/تصویر باید قابل فهم باشد) */
 const outStatsRef = useRef({ n: 0, bytes: 0, lastOkAt: 0, lastErrAt: 0, errs: 0, lastRebuildAt: 0, recent: [] })

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
 const stageRef = useRef(null)
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
 const liveWbCurRef = useRef({ after: 0, dt: 0, bgr: -1 }) // کرسر polling تخته
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
 const [messages, setMessages] = useState([])
 const [input, setInput] = useState('')
 const [sending, setSending] = useState(false)
 const chatRef = useRef(null)
 const lastIdRef = useRef(0)

 const canSyncBoard = () => Date.now() - boardLocalTsRef.current > 3000
 const canSyncLock = () => Date.now() - lockLocalTsRef.current > 3000

 /* ---------- آغاز/برگزاری مجدد کلاس توسط مدرس ----------
  * کلاسِ ended (جلسه قبل) با ورود مدرس، جلسه‌ی جدید شروع می‌شود — دیگر صفحه «پایان» گیر نمی‌کند */
 useEffect(() => {
   if (!isTeacher || !classId) return
   req(`/classes/${classId}/state`).then((st) => {
     if (st.status === 'live') setLive((l) => ({ ...(l || { participants: [] }), status: 'live', startedAt: st.startedAt }))
     else startLive(classId) // scheduled یا ended → برگزاری جلسه‌ی جدید
   }).catch(() => startLive(classId))
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
     .then((ds) => { devicesRef.current = ds.filter((d) => d.kind === 'videoinput' && d.deviceId) })
     .catch(() => {})
 }

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
   const o = outRef.current
   if (o) { o.stopping = true; try { if (o.rec.state !== 'inactive') o.rec.stop() } catch { /* noop */ } }
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   if (classId) req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {})
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* ---------- فرستنده رله — تکه‌های webm/mp4 به سرور ----------
  * آپلودها زنجیره‌ای‌اند (ترتیب تکه‌ها حیاتی است) و هر تکه ۳ بار تلاش می‌شود؛
  * اگر هر سه شکست خورد، سشن با init تازه از سر شروع می‌شود تا گیرنده‌ها سالم بمانند */
 const uploadChunk = async (kind, blob, isInit, fmt, cd) => {
   if (!classId) return false
   const q = `?k=${kind}&init=${isInit ? 1 : 0}&mic=${micRef.current ? 1 : 0}&cam=${camRef.current ? 1 : 0}&screen=${screenRef.current ? 1 : 0}&fmt=${fmt || 'webm'}&cd=${encodeURIComponent(cd || '')}`
   for (let i = 0; i < 3; i++) {
     /* تایم‌اوت ۵ ثانیه — هیچ درخواستی حق ندارد زنجیره‌ی ارسال را برای همیشه گروگان بگیرد */
     const ac = new AbortController()
     const tid = setTimeout(() => ac.abort(), 5000)
     try {
       const res = await fetch(`/api/classes/${classId}/media/up${q}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${getToken() || ''}` },
         body: blob,
         signal: ac.signal,
       })
       if (res.ok) {
         const st = outStatsRef.current
         const t0 = Date.now()
         st.n += 1
         st.bytes += blob.size || 0
         st.lastOkAt = t0
         st.recent.push([t0, blob.size || 0])
         while (st.recent.length && t0 - st.recent[0][0] > 4000) st.recent.shift() // پنجره ۴ ثانیه‌ای
         return true
       }
       if (res.status === 403) {
         const d = await res.json().catch(() => ({}))
         if (d.noPerm && !isTeacher) { revokeMyMedia(); return false } // اجازه لغو شده
       }
     } catch { /* شبکه — تلاش دوباره */ }
     finally { clearTimeout(tid) }
     await new Promise((r) => setTimeout(r, 300))
   }
   const st = outStatsRef.current
   st.errs += 1
   st.lastErrAt = Date.now()
   return false
 }

 const stopOutgoing = () => {
   const o = outRef.current
   if (!o) return
   outRef.current = null
   o.stopping = true
   try { if (o.rec.state !== 'inactive') o.rec.stop() } catch { /* noop */ }
 }

 const startOutgoing = () => {
   if (!classId || outRef.current) return
   if (!isTeacher && !canSpeakRef.current) return
   const recMime = pickRecMime() // { mime, fmt } — سافاری mp4، بقیه webm
   if (!recMime) return
   const s = localStreamRef.current
   const v = screenRef.current && screenTrackRef.current ? screenTrackRef.current : s?.getVideoTracks()[0]
   const a = s?.getAudioTracks()[0]
   if (!v && !a) return
   /* کدک‌های واقعی داخل استریم — گیرنده SourceBuffer را دقیقاً با همین‌ها می‌سازد
      (وگرنه استریمِ بدون صدا با خطای "misses expected opus track" رد می‌شد) */
   const cd = recMime.fmt === 'mp4'
     ? [...(v ? ['avc1.42E01E'] : []), ...(a ? ['mp4a.40.2'] : [])].join(',')
     : [...(v ? ['vp8'] : []), ...(a ? ['opus'] : [])].join(',')
   let rec
   try {
     rec = new MediaRecorder(new MediaStream([...(v ? [v] : []), ...(a ? [a] : [])]), {
       mimeType: recMime.mime, videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 48_000,
     })
   } catch { return }
   const o = { rec, kind: isTeacher ? 'teacher' : 'student', fmt: recMime.fmt, cd, stopping: false }
   outRef.current = o
   rec.ondataavailable = (e) => {
     if (!e.data?.size || o.stopping || outRef.current !== o) return
     const isInit = pendingInitRef.current
     pendingInitRef.current = false
     const blob = e.data
     upChainRef.current = upChainRef.current.then(() => uploadChunk(o.kind, blob, isInit, o.fmt, o.cd)).then((ok) => {
       if (!ok && outRef.current === o && !o.stopping) {
         /* هرگز تکه‌ی وسط استریم را به‌جای init نمی‌فرستیم — هدر ندارد و دکودر همه
            گیرنده‌ها را برای همیشه می‌شکند. به‌جایش رکوردر واقعاً از نو ساخته می‌شود
            تا تکه‌ی بعدی «هدرِ واقعی» داشته باشد (باگ اصلی مرگ دائمی استریم) */
         const st = outStatsRef.current
         if (Date.now() - st.lastRebuildAt > 2500) {
           st.lastRebuildAt = Date.now()
           stopOutgoing()
           setTimeout(() => { if (!outRef.current) rebuildOutgoing() }, 250)
         }
         /* در فاصله‌ی backoff رکوردر فعلی ادامه می‌دهد — اگر تکه‌ای با هدر کامل برسد
            سرور خودش آن را init واقعی می‌شناسد (خود-ترمیمی سمت سرور) */
       }
     }).catch(() => {})
   }
   rec.onerror = () => { /* ادامه — تکه بعدی */ }
   try { rec.start(500) } catch { /* noop */ } // تکه‌های ۰.۵ ثانیه‌ای → تاخیر کم‌تر
 }

 /** ساخت/بازسازی استریم خروجی — بعد از هر تغییر ترکیب (شروع رسانه، اشتراک صفحه، تعویض دوربین) */
 const rebuildOutgoing = () => {
   pendingInitRef.current = true
   stopOutgoing()
   startOutgoing()
 }

 /** قطع کامل رسانه خودم — لغو اجازه توسط مدرس یا ۴۰۳ سرور */
 const revokeMyMedia = () => {
   stopOutgoing()
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   localStreamRef.current = null
   setLocalStream(null)
   setMic(false)
   setCam(false)
 }

  /* ---------- گیرنده رله — polling استریم‌ها (۸۰۰ms) ----------
  * با «کرسر» فقط تکه‌های تازه می‌آیند؛ اگر گیرنده جا مانده باشد سرور init می‌فرستد
  * و پلیر خودش از نو ساخته می‌شود — هیچ حالتی تصویر را برای همیشه نمی‌شکند */
 useEffect(() => {
   if (!classId || !user?.id) return
   let alive = true
   const players = feedPlayersRef.current
   const cur = { t: null, s: {} }
   let busy = false

   const applyFeed = (key, f) => {
     let p = players.get(key)
     /* اگر قالب/کدک‌های فرستنده عوض شد (webm↔mp4 یا اضافه‌شدن ترک) پلیر از نو ساخته می‌شود */
     if (p && (p.fmt !== (f.fmt || 'webm') || (p.cd || '') !== (f.cd || ''))) { try { p.destroy() } catch { /* noop */ } players.delete(key); p = null }
     if (!p) {
       p = createFeedPlayer(f.fmt || 'webm', f.cd || '')
       p.onNeedReset = () => { if (key === 't') cur.t = null; else delete cur.s[key] } // فقط کرسرِ همین فید صفر شود
       players.set(key, p)
     }
     if (f.reset) p.hardReset(f.sess)
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
       /* pv = شناسه‌ی پلیرِ زنده. اگر پلیر از نو ساخته شود (تعویض قالب/کدک مثل شروع
          اشتراک صفحه، یا re-mount افکت در StrictMode) باید feedInfo عوض شود تا
          re-render اتفاق بیفتد و RelayVideo پلیر تازه را بگیرد. بدون این، پروپ‌ها
          به «پلیرِ مرده» چسبیده می‌مانند، ویدیو هیچ‌وقت src نمی‌گیرد و با اینکه
          تکه‌ها آپند می‌شوند هیچ تصویر و صدایی پخش نمی‌شود (باگ اصلی گزارش کاربر) */
       if (!isTeacher && r.teacher) {
         const lastSeq = applyFeed('t', r.teacher)
         next.t = { sess: r.teacher.sess, mic: r.teacher.mic, cam: r.teacher.cam, screen: r.teacher.screen, fmt: r.teacher.fmt, name: classInfo?.teacher || 'مدرس', color: 'grad-0', pv: players.get('t')?.pid }
         cur.t = { s: r.teacher.sess, q: lastSeq ?? (cur.t?.q || 0) }
       } else if (cur.t) cur.t = null
       for (const sf of r.students || []) {
         const lastSeq = applyFeed(sf.uid, sf)
         next[sf.uid] = { sess: sf.sess, mic: sf.mic, cam: sf.cam, screen: sf.screen, fmt: sf.fmt, name: sf.name || 'هم‌کلاسی', color: 'grad-2', pv: players.get(sf.uid)?.pid }
         cur.s[sf.uid] = { s: sf.sess, q: lastSeq ?? (cur.s[sf.uid]?.q || 0) }
       }
       for (const k of Object.keys(cur.s)) if (!(k in next)) delete cur.s[k]
       for (const k of [...players.keys()]) {
         if (!(k in next)) { try { players.get(k).destroy() } catch { /* noop */ } players.delete(k) }
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
   const token = getToken() || ''
   const es = new EventSource(`/api/classes/${classId}/events?token=${encodeURIComponent(token)}`)
   esRef.current = es

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

   es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data) } catch { return } handleSse(m) }
   return () => { es.close() }
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
       const r = await req(`/classes/${classId}/board/live?after=${cur.after}&dt=${cur.dt}&bgr=${cur.bgr}`, { timeout: 7000 })
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
   stopOutgoing()
   try { req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {}) } catch { /* noop */ }
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   setLocalStream(null)
   setScreen(false)
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [live?.status])

 /* ---------- گیت اجازه مدرس — بدون شروع خودکار رسانه؛ دانش‌آموز خودش میکروفون/دوربین را روشن می‌کند ---------- */
 const participantsPre = live?.participants || []
 const myPartPre = participantsPre.find((p) => p.id === user?.id)
 const canSpeakPre = isTeacher || !!myPartPre?.canSpeak
 canSpeakRef.current = canSpeakPre
 const prevCanSpeakRef = useRef(canSpeakPre)
 useEffect(() => {
   if (!user?.id) return
   if (canSpeakPre && !prevCanSpeakRef.current) {
     // اجازه داده شد — اگر رسانه از قبل باز است رله ادامه می‌یابد؛ وگرنه پنل میکروفون/دوربین نمایش داده می‌شود
     if (localStreamRef.current) { setMediaErr(null); setMediaSkipped(false); rebuildOutgoing() }
   }
   if (!canSpeakPre && prevCanSpeakRef.current && !isTeacher) revokeMyMedia()
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

 /* اجازه فعال‌سازی صدا/تصویر — مدرس همیشه دارد؛ دانش‌آموز فقط با تایید مدرس */
 const myPart = participants.find((p) => p.id === user?.id)
 const myHand = !!myPart?.hand
 const canSpeak = isTeacher || !!myPart?.canSpeak
 const needsApproval = !isTeacher && !canSpeak
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
     setMessages((m) => m.map((x) => (x === optimistic ? { ...r.message, self: true } : x)))
     lastIdRef.current = Math.max(lastIdRef.current, r.message.id)
   } catch (err) {
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

 /* ---------- تعویض دوربین — جلو/عقب موبایل با facingMode دقیق + دوربین‌های دسکتاپ ---------- */
 const switchCam = async () => {
   if (switchingRef.current) return
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return }
   const cur = localStreamRef.current
   if (!cur?.getVideoTracks().length) { startMedia(); return }
   switchingRef.current = true
   const track = cur.getVideoTracks()[0]
   const settings = track.getSettings?.() || {}
   const isTouch = (navigator.maxTouchPoints || 0) > 0
   /* جهت درخواستی — getSettings روی خیلی از گوشی‌ها facingMode برنمی‌گرداند،
      پس جهتِ درخواستی را خودمان نگه می‌داریم تا فلپ واقعی بماند */
   const curFacing = facingRef.current || settings.facingMode || 'user'
   const flip = curFacing === 'environment' ? 'user' : 'environment'
   const base = { width: { ideal: 1280 }, height: { ideal: 720 } }
   const candidates = []
   if (isTouch) {
     candidates.push({ ...base, facingMode: { exact: flip } })
     candidates.push({ ...base, facingMode: flip })
   }
   try {
     /* هر بار لیست تازه گرفته می‌شود — iOS تا بعد از اجازه لیست خالی می‌دهد */
     const ds = ((await navigator.mediaDevices.enumerateDevices()) || []).filter((d) => d.kind === 'videoinput' && d.deviceId)
     devicesRef.current = ds
     if (ds.length > 1) {
       const others = ds.filter((d) => d.deviceId !== settings.deviceId)
       if (others.length) candidates.push({ ...base, deviceId: { exact: others[0].deviceId } })
     }
   } catch { /* noop */ }
   candidates.push({ ...base, facingMode: { ideal: flip } })
   candidates.push(base)

   for (const video of candidates) {
     try {
       const g = await navigator.mediaDevices.getUserMedia({ video, audio: false })
       const nv = g.getVideoTracks()[0]
       if (!nv) { g.getTracks().forEach((t) => t.stop()); continue }
       /* اگر همان دوربین قبلی برگشت و دنبال فلپ بودیم — گزینه بعدی */
       const newId = nv.getSettings?.().deviceId
       if (newId && settings.deviceId && newId === settings.deviceId && !('facingMode' in video)) {
         g.getTracks().forEach((t) => t.stop())
         continue
       }
       const old = localStreamRef.current?.getVideoTracks()[0]
       old?.stop()
       const audio = localStreamRef.current?.getAudioTracks()[0]
       const nextStream = new MediaStream([...(audio ? [audio] : []), nv])
       nv.enabled = camRef.current // وضعیت روشن/خاموش دوربین حفظ شود
       /* جهتِ درخواستی ترجیح دارد — گزارش settings روی برخی گوشی‌ها undefined است */
       const reqFacing = 'facingMode' in video
         ? (typeof video.facingMode === 'string' ? video.facingMode : (video.facingMode?.exact || video.facingMode?.ideal || flip))
         : (nv.getSettings?.().facingMode || curFacing)
       facingRef.current = reqFacing
       localStreamRef.current = nextStream
       setLocalStream(nextStream)
       rebuildOutgoing()
       toast(isTouch ? (facingRef.current === 'environment' ? 'دوربین عقب فعال شد' : 'دوربین جلو فعال شد') : 'دوربین عوض شد', 'success')
       switchingRef.current = false
       return
     } catch { /* گزینه بعدی */ }
   }
   toast('دوربین دیگری روی این دستگاه پیدا نشد', 'info')
   switchingRef.current = false
 }

/* ---------- تمام‌صفحه ---------- */
 const toggleFs = async () => {
   const el = stageRef.current
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
     else { setPseudoFs(true); doc.body.classList.add('fs-lock') } // iOS Safari
   } catch {
     setPseudoFs(true)
     doc.body.classList.add('fs-lock')
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
   const aTrack = localStreamRef.current?.getAudioTracks()[0] || null
   if (!vTrack && !aTrack) { toast('برای ضبط، ابتدا دوربین یا میکروفون را وصل کنید', 'error'); return }
   let mime = ''
   for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']) {
     try { if (MediaRecorder.isTypeSupported?.(m)) { mime = m; break } } catch { /* noop */ }
   }
   try {
     const stream = new MediaStream([...(vTrack ? [vTrack] : []), ...(aTrack ? [aTrack] : [])])
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
       try {
         const url = URL.createObjectURL(blob)
         const a = document.createElement('a')
         const stamp = new Date(recStartRef.current || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-')
         a.href = url
         a.download = `${String(classInfo?.title || 'modaresyar-class').replace(/\s+/g, '-')}-${stamp}.webm`
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

 /* ---------- اشتراک صفحه (مدرس) ---------- */
 const stopScreenShare = () => {
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   screenStreamRef.current = null
   screenRef.current = false
   setScreen(false)
   rebuildOutgoing()
 }
 const toggleScreenShare = async () => {
   if (screen) { stopScreenShare(); return }
   if (!navigator.mediaDevices?.getDisplayMedia) {
     toast(inIframe ? 'اشتراک صفحه داخل قاب پیش‌نمایش ممکن نیست — کلاس را در پنجره جدید باز کنید' : 'مرورگر شما اشتراک صفحه را پشتیبانی نمی‌کند', 'error')
     return
   }
   try {
     const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false })
     const track = s.getVideoTracks()[0]
     screenTrackRef.current = track
     screenStreamRef.current = s
     track.addEventListener('ended', () => stopScreenShare())
     screenRef.current = true
     setScreen(true)
     setBoard(false)
     if (isTeacher) {
       boardLocalTsRef.current = Date.now()
       req(`/classes/${classId}/board/open`, { method: 'POST', body: { open: false } }).catch(() => {})
     }
     rebuildOutgoing()
   } catch (e) {
     if (e?.name === 'NotAllowedError') toast(inIframe ? 'اشتراک صفحه فقط در پنجره کامل کار می‌کند — کلاس را در پنجره جدید باز کنید' : 'اشتراک صفحه لغو شد', 'info')
     else toast('اشتراک صفحه ممکن نشد', 'error')
   }
 }
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
   liveWbCurRef.current.after = 0
   try { await req(`/classes/${classId}/board`, { method: 'DELETE' }) } catch { /* noop */ }
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
 if (classEnded) {
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
       <div className="sc-icon green" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
         <Icon name="check" size={28} />
       </div>
       <h2 style={{ fontSize: 19 }}>جلسه «{classInfo?.title || 'کلاس'}» به پایان رسید</h2>
       <p className="muted small mt8">
         مدت برگزاری: <b dir="ltr">{mm}:{ss}</b> • {faNum(participants.length)} حاضر • {faNum(messages.length)} پیام
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

 /* ---------- چیدمان صحنه ---------- */
 const tFeed = !isTeacher ? feedInfo.t : null           // استریم مدرس (برای دانش‌آموز)
 const sFeeds = Object.entries(feedInfo).filter(([k]) => k !== 't') // استریم دانش‌آموزانِ دارای اجازه
 const watchingBoard = board
 const watchingScreen = isTeacher && screen
 const watchingFeed = !isTeacher && !!tFeed
 const stageBusy = watchingBoard || watchingScreen || watchingFeed

 const feedTile = (key, f, big) => (
   <RelayVideo key={key} player={feedPlayersRef.current.get(key)} name={f.name} color={f.color} camOff={!f.cam} screen={f.screen} big={big} />
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
 const st = outStatsRef.current
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
 <span className="media-chip ok"><i className="dot" /> در حال ارسال {screen ? 'اشتراک صفحه' : 'صدا/تصویر'} به دانش‌آموزان — {faNum(rateKbps)} کیلوبایت/ثانیه • {faNum(st.n)} تکه ✓</span>
 ) : (
 <span className="media-chip warn"><i className="dot" /> ارسال با وقفه افتاده — به‌صورت خودکار از سر گرفته می‌شود…</span>
 )
 ) : (
 <span className="media-chip err"><i className="dot" /> ⛔ هیچ صدا و تصویری برای دانش‌آموزان ارسال نمی‌شود — دوربین یا اشتراک صفحه را روشن کنید (تخته و چت مستقل از این است)</span>
 )
 ) : (
 tFeed ? (
 <span className="media-chip ok"><i className="dot" /> پخش زندهٔ مدرس فعال است ✓ {tFeed.screen ? '(اشتراک صفحه)' : '(صدا/تصویر)'} — برای شنیدن صدا یک بار صفحه را لمس/کلیک کنید</span>
 ) : (
 <span className="media-chip warn"><i className="dot" /> در انتظار پخش زندهٔ مدرس… به‌محض روشن شدن دوربین یا اشتراک صفحه، همین‌جا نمایش داده می‌شود</span>
 )
 )}
 </div>

 <div className={`live-grid ${pseudoFs ? 'fs-grid' : ''}`}>
 <div className="live-stage" ref={stageRef}>
 <div className={`live-view ${watchingBoard ? 'board' : watchingScreen || watchingFeed ? 'screen' : 'camera'}`}>
 <span className="live-label"><i className="live-red-dot" /> {watchingBoard ? 'وایت‌برد مشترک' : watchingScreen ? 'اشتراک صفحه شما' : watchingFeed ? (tFeed.screen ? 'اشتراک صفحه مدرس' : 'ویدیوی زنده مدرس') : 'کلاس زنده'}</span>
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
   <ScreenPreview stream={screenStreamRef.current} />
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

 {/* نوار کاشی‌های تصویری هنگام اشتراک صفحه/تخته/دیدن استریم مدرس — کاشی خودِ دانش‌آموز همیشه هست */}
 {stageBusy && (localStream || !isTeacher || tFeed || sFeeds.length > 0) && (
   <div className="cam-strip">
     {(localStream || !isTeacher) && (
       <div style={{ width: 128, flexShrink: 0 }}>
         <VideoTile stream={localStream} self name={me} camOn={cam} color={user?.color || 'grad-3'} />
       </div>
     )}
     {tFeed && !watchingFeed && feedTile('t', tFeed, false)} /* در نوار فقط وقتی صحنه خودش استریم مدرس را نشان نمی‌دهد — دو ویدیو روی یک پلیر نمی‌جنگند (یکی MediaSource را از دیگری می‌دزدد) */
     {sFeeds.map(([uid, f]) => <div key={uid} style={{ width: 128, flexShrink: 0 }}>{feedTile(uid, f, false)}</div>)}
   </div>
 )}
 </div>

 <div className="live-controls">
 <button className={ctl(mic) + (mic ? '' : ' off')} onClick={toggleMic}>
 <Icon name="mic" /> <span className="ctl-tip">{mic ? 'قطع میکروفون' : 'وصل میکروفون'}</span>
 </button>
 <button className={ctl(cam) + (cam ? '' : ' off')} onClick={toggleCam}>
 <Icon name="camera" /> <span className="ctl-tip">{cam ? 'خاموش کردن دوربین' : 'روشن کردن دوربین'}</span>
 </button>
 <button className={ctl(false)} onClick={switchCam}>
 <Icon name="camFlip" /> <span className="ctl-tip">تعویض دوربین (جلو/عقب)</span>
 </button>
 {isTeacher && (
 <button className={ctl(screen)} onClick={toggleScreenShare}>
 <Icon name="monitor" /> <span className="ctl-tip">{screen ? 'قطع اشتراک صفحه' : 'اشتراک صفحه سیستم'}</span>
 </button>
 )}
 {isTeacher && (
 <button className={ctl(board)} onClick={toggleBoard}>
 <Icon name="board" /> <span className="ctl-tip">{board ? 'بستن وایت‌برد' : 'وایت‌برد دیجیتال'}</span>
 </button>
 )}
 <button className={ctl(fsActive || pseudoFs)} onClick={toggleFs}>
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
   stopOutgoing()
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   req(`/classes/${classId}/media/stop`, { method: 'POST' }).catch(() => {})
   toast('از کلاس خارج شدید — حضور شما ثبت شد', 'info')
 }}>بله، خارج شو</button>
 <button className="btn btn-ghost" onClick={() => setEndedModal(false)}>بازگشت</button>
 </div>
 </>
 )}
 </Modal>
 </div>
 )
}




