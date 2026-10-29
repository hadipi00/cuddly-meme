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
 * اتاق کلاس زنده واقعی — دوربین، میکروفون، اشتراک صفحه و وایت‌برد واقعی
 * ---------------------------------------------------------------------
 * • دوربین/میکروفون: getUserMedia + مرکز دسترسی (دکمه درخواست، تلاش دوباره، باز کردن در تب جدید)
 * • تعویض دوربین: جابه‌جایی بین دوربین جلو/عقب موبایل و دوربین‌های متعدد دسکتاپ
 * • تمام‌صفحه: Fullscreen API + حالت شبه‌تمام‌صفحه برای iOS
 * • اشتراک صفحه: getDisplayMedia — تصویر صفحه برای بقیه ارسال می‌شود
 * • وایت‌برد: باز/بسته شدن تخته از سرور همگام می‌شود — دانش‌آموز هم تخته مدرس را می‌بیند
 * • تایمر از startedAt سرور • چت و حاضران و دست بلند شده روی دیتابیس
 * variant: 'teacher' | 'student'
 */

const RTC_CFG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    // TURN رایگان برای عبور از NATهای سخت‌گیرانه (موبایل/اپراتور) — اگر در دسترس نبود نادیده گرفته می‌شود
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 2,
}
const WB_W = 1600
const WB_H = 900
const PEN_COLORS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#d97706']
const PEN_SIZES = [3, 6, 12]

/** ویدیوی یک شرکت‌کننده — srcObject با useEffect ست می‌شود */
function VideoTile({ stream, self, name, camOn, color, big }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (v && stream) {
      if (v.srcObject !== stream) v.srcObject = stream
      v.play?.().catch(() => {})
    }
  }, [stream])
  return (
    <div className={`cam-tile ${big ? 'big' : ''} ${self ? 'self' : ''}`}>
      {stream && camOn !== false ? (
        <video ref={ref} autoPlay playsInline muted={!!self} />
      ) : (
        <div className="cam-off"><Avatar name={name || '؟'} color={color || 'grad-1'} size={big ? 64 : 34} /></div>
      )}
      <span className="ct-name">{name}{self ? ' (شما)' : ''}</span>
      {!camOn && <span className="ct-off"><Icon name="camera" size={11} /> خاموش</span>}
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

/** کارت عیب‌یابی و درخواست دسترسی دوربین/میکروفون — وسط صحنه کلاس
 *  state: 'idle' | 'denied' | 'nodevice' | 'busy' | 'insecure'
 *  diag: { videoCount, audioCount, lastError } — گزارش واقعی مرورگر برای عیب‌یابی */
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
                ✋ درخواست شما برای مدرس ارسال شد — به‌محض تایید، دکمه‌های دوربین و میکروفون فعال می‌شوند.
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

 /* ---------- کنترل‌های رسانه ---------- */
 const [mic, setMic] = useState(true)
 const [cam, setCam] = useState(true)
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
 const deviceIdxRef = useRef(0)
 const devicesRef = useRef([])

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

 /* ---------- WebRTC mesh ---------- */
 const myPeerIdRef = useRef('p' + Math.random().toString(36).slice(2, 10))
 const pcsRef = useRef(new Map()) // peerId → { pc, senders, polite, makingOffer, ignoreOffer }
 const esRef = useRef(null)
 const [peersList, setPeersList] = useState([]) // [{ peer, name, role, color, stream, mic, cam, screen }]

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

 const signal = (to, kind, data) => {
   req(`/classes/${classId}/signal`, { method: 'POST', body: { from: myPeerIdRef.current, to, kind, data } }).catch(() => {})
 }
 const canSyncBoard = () => Date.now() - boardLocalTsRef.current > 3000

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

 /* ---------- میکروفون و دوربین واقعی — با مرکز دسترسی ---------- */
 const attachAll = () => {
   const s = localStreamRef.current
   const a = s?.getAudioTracks()[0]
   const v = s?.getVideoTracks()[0]
   for (const { senders } of pcsRef.current.values()) {
     if (a) senders.audio.replaceTrack(a).catch(() => {})
     if (v && !screenTrackRef.current) senders.video.replaceTrack(v).catch(() => {})
   }
 }

 /* دسته‌بندی دقیق خطای رسانه + عیب‌یابی محیط (تعداد دستگاه‌هایی که مرورگر می‌بیند) */
 const classifyMediaErr = (e) => {
   const n = e?.name || ''
   if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'nodevice'
   if (n === 'NotReadableError' || n === 'TrackStartError') return 'busy'
   return 'denied' // NotAllowedError | SecurityError | PermissionDeniedError | …
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

 const startMedia = async () => {
   if (permBusy) return
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return } // گیت اجازه مدرس
   setMediaSkipped(false)
   if (!navigator.mediaDevices?.getUserMedia) {
     setMediaErr('insecure')
     return
   }
   setPermBusy(true)
   try {
     const video = {
       facingMode: facingRef.current === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
       width: { ideal: 1280 }, height: { ideal: 720 },
     }
     const s = await navigator.mediaDevices.getUserMedia({
       video, audio: { echoCancellation: true, noiseSuppression: true },
     })
     localStreamRef.current?.getTracks().forEach((t) => t.stop())
     localStreamRef.current = s
     setLocalStream(s)
     setMediaErr(null)
     setMediaDiag({ videoCount: 1, audioCount: s.getAudioTracks().length, lastError: null })
     attachAll()
     navigator.mediaDevices.enumerateDevices()
       .then((ds) => { devicesRef.current = ds.filter((d) => d.kind === 'videoinput' && d.deviceId) })
       .catch(() => {})
   } catch (e) {
     setMediaErr(classifyMediaErr(e))
     collectMediaDiag(e)
   }
   setPermBusy(false)
 }

 /* تلاش خودکار اول — فقط برای مدرس؛ دانش‌آموز باید اول از مدرس اجازه بگیرد */
 useEffect(() => {
   let cancelled = false
   if (!isTeacher) return // دانش‌آموز: بدون اجازه مدرس رسانه‌ای باز نمی‌شود
   if (!navigator.mediaDevices?.getUserMedia) { setMediaErr('insecure'); return }
   navigator.mediaDevices.getUserMedia({
     video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
     audio: { echoCancellation: true, noiseSuppression: true },
   }).then((s) => {
     if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
     localStreamRef.current = s
     setLocalStream(s)
     setMediaErr(null)
     attachAll()
     navigator.mediaDevices.enumerateDevices()
       .then((ds) => { devicesRef.current = ds.filter((d) => d.kind === 'videoinput' && d.deviceId) })
       .catch(() => {})
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
   return () => {
     cancelled = true
     localStreamRef.current?.getTracks().forEach((t) => t.stop())
     screenTrackRef.current?.stop()
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* ---------- تعویض دوربین (جلو/عقب موبایل یا دوربین‌های دسکتاپ) ---------- */
 const switchCam = async () => {
   if (switchingRef.current) return
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return }
   if (!localStreamRef.current) { startMedia(); return }
   switchingRef.current = true
   let ok = false
   try {
     let ds = devicesRef.current
     if (!ds.length) {
       ds = ((await navigator.mediaDevices.enumerateDevices()) || []).filter((d) => d.kind === 'videoinput' && d.deviceId)
       devicesRef.current = ds
     }
     const next = async (constraints) => {
       const s = await navigator.mediaDevices.getUserMedia(constraints)
       const newV = s.getVideoTracks()[0]
       if (!newV) { s.getTracks().forEach((t) => t.stop()); throw new Error('novideo') }
       const oldV = localStreamRef.current?.getVideoTracks()[0]
       oldV?.stop()
       const audio = localStreamRef.current?.getAudioTracks()[0]
       const nextStream = new MediaStream(audio ? [audio, newV] : [newV])
       localStreamRef.current = nextStream
       setLocalStream(nextStream)
       if (!screenTrackRef.current) {
         for (const { senders } of pcsRef.current.values()) senders.video.replaceTrack(newV).catch(() => {})
       }
     }
     if (ds.length > 1) {
       deviceIdxRef.current = (deviceIdxRef.current + 1) % ds.length
       await next({ video: { deviceId: { exact: ds[deviceIdxRef.current].deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
       ok = true
       toast('دوربین عوض شد', 'success')
     } else {
       // موبایل: فلَپ بین دوربین جلو و عقب
       const flip = facingRef.current === 'user' ? 'environment' : 'user'
       facingRef.current = flip
       try {
         await next({ video: { facingMode: { exact: flip }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
         ok = true
         toast(flip === 'environment' ? 'دوربین عقب فعال شد' : 'دوربین جلو فعال شد', 'success')
       } catch {
         try {
           await next({ video: { facingMode: { ideal: flip }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
           ok = true
           toast('دوربین عوض شد', 'success')
         } catch { /* دوربین دیگری نیست */ }
       }
     }
   } catch { /* خطا — پیام زیر */ }
   if (!ok) toast('دوربین دیگری روی این دستگاه پیدا نشد', 'info')
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

 /** درخواست اجازه صدا/تصویر از مدرس — دست بلند کردن + ثبت روی سرور */
 const requestSpeakPermission = () => {
   if (isTeacher || canSpeakRef.current) return
   if (!handRef.current) {
     setHand(true)
     req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand: true } }).catch(() => {})
   }
   toast('درخواست شما برای مدرس ارسال شد ✋ — تا اجازه ندهد دوربین/میکروفون باز نمی‌شود', 'info')
 }

 /* ---------- ضبط واقعی کلاس (MediaRecorder) ----------
  * تصویر (اشتراک صفحه اگر فعال باشد، وگرنه دوربین) + صدای میکروفون ضبط می‌شود؛
  * در پایان، فایل ویدیو روی دستگاه مدرس دانلود می‌شود تا لینک مستقیم آن را
  * در «مدیریت کلاس → جلسات برگزارشده» برای دانش‌آموزها ثبت کند. */
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

 /* قطع ضبط هنگام بستن صفحه/کلاس — فایل ذخیره‌شده از دست نمی‌رود */
 useEffect(() => () => {
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
 }, [])

 /* ---------- SSE: رویدادهای لحظه‌ای (WebRTC + تخته + چت + وضعیت) ---------- */
 useEffect(() => {
   if (!classId) return
   const token = getToken() || ''
   const es = new EventSource(`/api/classes/${classId}/events?peer=${myPeerIdRef.current}&token=${encodeURIComponent(token)}`)
   esRef.current = es

   const ensurePc = (peerId) => {
     let entry = pcsRef.current.get(peerId)
     if (entry) return entry
     const pc = new RTCPeerConnection(RTC_CFG)
     const at = pc.addTransceiver('audio', { direction: 'sendrecv' })
     const vt = pc.addTransceiver('video', { direction: 'sendrecv' })
     entry = { pc, senders: { audio: at.sender, video: vt.sender }, polite: myPeerIdRef.current < peerId, makingOffer: false, ignoreOffer: false, pendingIce: [] }
     pcsRef.current.set(peerId, entry)

     const s = localStreamRef.current
     const a = s?.getAudioTracks()[0]
     const v = s?.getVideoTracks()[0]
     if (a) at.sender.replaceTrack(a).catch(() => {})
     if (v && !screenTrackRef.current) vt.sender.replaceTrack(v).catch(() => {})
     if (screenTrackRef.current) vt.sender.replaceTrack(screenTrackRef.current).catch(() => {})

     pc.onicecandidate = (ev) => { if (ev.candidate) signal(peerId, 'ice', ev.candidate.toJSON()) }
     pc.ontrack = (ev) => {
       const stream = ev.streams[0] || new MediaStream([ev.track])
       // اگر متای peer هنوز در لیست نیست، همین‌جا اضافه شود وگرنه استریم گم می‌شود
       setPeersList((list) => list.some((p) => p.peer === peerId)
         ? list.map((p) => (p.peer === peerId ? { ...p, stream } : p))
         : [...list, { peer: peerId, name: 'هم‌کلاسی', mic: true, cam: true, screen: false, stream }])
     }
     pc.onconnectionstatechange = () => {
       if (pc.connectionState === 'failed') { try { pc.restartIce() } catch { /* noop */ } }
     }
     return entry
   }

   const addPeerMeta = (m) => setPeersList((list) =>
     list.some((x) => x.peer === m.peer)
       ? list.map((x) => (x.peer === m.peer ? { ...x, ...m, stream: x.stream } : x))
       : [...list, { mic: true, cam: true, screen: false, stream: null, ...m }]
   )

   const makeOffer = async (peerId) => {
     const entry = ensurePc(peerId)
     try {
       entry.makingOffer = true
       await entry.pc.setLocalDescription()
       signal(peerId, 'offer', entry.pc.localDescription)
     } catch { /* noop */ } finally { entry.makingOffer = false }
   }

   const handleSignal = async (m) => {
     if (m.kind === 'state') {
       addPeerMeta({ peer: m.from, ...(m.data || {}) })
       return
     }
     // متای peer باید قبل از ساخت/استفاده از PC در لیست باشد — وگرنه ontrack استریم را گم می‌کند
     setPeersList((list) => list.some((x) => x.peer === m.from) ? list : [...list, { peer: m.from, name: m.name || 'هم‌کلاسی', mic: true, cam: true, screen: false, stream: null }])
     const entry = ensurePc(m.from)
     const pc = entry.pc
     try {
       if (m.kind === 'offer') {
         const collision = entry.makingOffer || pc.signalingState !== 'stable'
         entry.ignoreOffer = !entry.polite && collision
         if (entry.ignoreOffer) return
         if (collision) await pc.setLocalDescription({ type: 'rollback' })
         await pc.setRemoteDescription(m.data)
         for (const c of entry.pendingIce.splice(0)) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
         await pc.setLocalDescription()
         signal(m.from, 'answer', pc.localDescription)
       } else if (m.kind === 'answer') {
         if (pc.signalingState === 'have-local-offer') {
           await pc.setRemoteDescription(m.data)
           for (const c of entry.pendingIce.splice(0)) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
         }
       } else if (m.kind === 'ice' && m.data) {
         if (!pc.remoteDescription) { entry.pendingIce.push(m.data); return } // قبل از SDP ریموت — صف می‌شود
         try { await pc.addIceCandidate(m.data) } catch { /* بعد از ignore طبیعی است */ }
       }
     } catch { /* اتصال ناپایدار — ignore */ }
   }

   const handleSse = (msg) => {
     switch (msg.type) {
       case 'peers':
         (msg.peers || []).forEach((p) => { addPeerMeta(p); makeOffer(p.peer) })
         break
       case 'peer-join':
         if (msg.peer && msg.peer !== myPeerIdRef.current) addPeerMeta(msg)
         break
       case 'peer-leave': {
         const e = pcsRef.current.get(msg.peer)
         if (e) { try { e.pc.close() } catch { /* noop */ } pcsRef.current.delete(msg.peer) }
         setPeersList((list) => list.filter((p) => p.peer !== msg.peer))
         break
       }
       case 'signal': handleSignal(msg); break
       case 'live':
         setLive((l) => ({ ...(l || { participants: [] }), status: 'live', startedAt: msg.startedAt }))
         toast('کلاس شروع شد', 'success')
         break
       case 'ended':
         setLive((l) => ({ ...(l || { participants: [] }), status: 'ended', endedAt: msg.endedAt }))
         break
       case 'board-open':
         if (canSyncBoard()) setBoard(!!msg.open)
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
         }
         break
       case 'board-draft':
         if (msg.userId && msg.userId !== user?.id && msg.stroke) {
           draftsRef.current.set(msg.userId, { ...msg.stroke, uid: msg.userId, ts: Date.now() })
           redrawBoard()
         }
         break
       case 'board-bg':
         if (msg.img === null) loadBg(null)
         else if (msg.img) loadBg(msg.img)
         break
       case 'board-clear': setStrokes([]); break
       case 'board-lock': setBoardLocked(!!msg.locked); break
       case 'perm': {
         const cs = !!msg.canSpeak
         setLive((l) => ({ ...(l || { participants: [] }), participants: (l?.participants || []).map((p) => (p.id === msg.userId ? { ...p, canSpeak: cs, hand: false } : p)) }))
         if (!isTeacher && msg.userId === user?.id) {
           if (cs) toast('مدرس اجازه داد — حالا دکمه دوربین/میکروفون را بزنید ✅', 'success')
           else {
             toast('مدرس دسترسی صدا/تصویر شما را لغو کرد', 'info')
             localStreamRef.current?.getTracks().forEach((t) => t.stop())
             localStreamRef.current = null
             setLocalStream(null)
             setMic(false); setCam(false)
           }
         }
         break
       }
       default: break
     }
   }

   es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data) } catch { return } handleSse(m) }

   return () => {
     es.close()
     for (const { pc } of pcsRef.current.values()) { try { pc.close() } catch { /* noop */ } }
     pcsRef.current.clear()
     setPeersList([])
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 /* ---------- poll وضعیت کلاس + heartbeat + چت (پایدار در کنار SSE) ---------- */
 useEffect(() => {
   if (!classId) return
   let alive = true
   let hbCount = 0
   const poll = async () => {
     try {
       const st = await req(`/classes/${classId}/state`)
       if (!alive) return
       setLive({ status: st.status, startedAt: st.startedAt, participants: st.participants || [] })
       if (st.boardOpen != null && canSyncBoard()) setBoard(!!st.boardOpen)
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
   }
   poll()
   const t = setInterval(poll, 2500)
   return () => { alive = false; clearInterval(t) }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 const handRef = useRef(false); handRef.current = hand

 /* دست بلند شده — بلافاصله به سرور */
 useEffect(() => {
   if (!classId || !user) return
   req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand } }).catch(() => {})
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [hand])

 /* ---------- تخته: بارگذاری اولیه ---------- */
 useEffect(() => {
   if (!classId || !user) return
   req(`/classes/${classId}/board`).then((r) => {
     setStrokes(r.strokes || [])
     setBoardLocked(!!r.locked)
     loadBg(r.bg || null)
   }).catch(() => {})
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId, user?.id])

 /* تایمر محلی هر ثانیه */
 useEffect(() => {
   const t = setInterval(() => setTick((x) => x + 1), 1000)
   return () => clearInterval(t)
 }, [])

 useEffect(() => {
   chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
 }, [messages])

 /* پایان کلاس از سمت سرور → خاموش کردن رسانه‌ها و قطع ضبط */
 useEffect(() => {
   if (live?.status !== 'ended') return
   try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* noop */ }
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   setLocalStream(null)
   setScreen(false)
 }, [live?.status])

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
     toast(allow ? 'اجازه داده شد — دانش‌آموز می‌تواند دوربین و میکروفون را روشن کند' : 'اجازه لغو شد', 'success')
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
 const broadcastState = () => signal('*', 'state', { mic: micRef.current, cam: camRef.current, screen: screenRef.current })

 const toggleMic = () => {
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return } // بدون اجازه مدرس نه
   if (!localStreamRef.current?.getAudioTracks().length) { startMedia(); return }
   const v = !mic
   setMic(v)
   localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = v })
   broadcastState()
 }
 const toggleCam = () => {
   if (!isTeacher && !canSpeakRef.current) { requestSpeakPermission(); return } // بدون اجازه مدرس نه
   if (!localStreamRef.current?.getVideoTracks().length) { startMedia(); return }
   const v = !cam
   setCam(v)
   localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = v })
   broadcastState()
 }
 const stopScreenShare = () => {
   screenTrackRef.current?.stop()
   screenTrackRef.current = null
   screenStreamRef.current = null
   const camTrack = localStreamRef.current?.getVideoTracks()[0]
   for (const { senders } of pcsRef.current.values()) senders.video.replaceTrack(camTrack || null).catch(() => {})
   screenRef.current = false
   setScreen(false)
   broadcastState()
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
     for (const { senders } of pcsRef.current.values()) senders.video.replaceTrack(track).catch(() => {})
     screenRef.current = true
     setScreen(true)
     setBoard(false)
     if (isTeacher) {
       boardLocalTsRef.current = Date.now()
       req(`/classes/${classId}/board/open`, { method: 'POST', body: { open: false } }).catch(() => {})
     }
     broadcastState()
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
   try { await req(`/classes/${classId}/board/lock`, { method: 'POST', body: { locked: next } }) }
   catch (e) { if (!e.serverDown) { setBoardLocked(!next); toast(e.message || 'عملیات ناموفق بود', 'error') } }
 }
 const clearBoard = async () => {
   setStrokes([])
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
   try { await req(`/classes/${classId}/board/bg`, { method: 'DELETE' }); loadBg(null) } catch { /* noop */ }
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
     if (r.stroke) setStrokes((list) => (list.some((s) => s.id === r.stroke.id)) ? list : [...list, r.stroke])
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
 const anyoneScreening = peersList.some((p) => p.screen)
 const remoteVideos = peersList.filter((p) => p.stream)
 const showVideosGrid = !board && !screen && !anyoneScreening
 const allTiles = [
   ...(localStream ? [{ peer: 'me', name: me, stream: localStream, self: true, camOn: cam, color: user?.color || 'grad-3' }] : []),
   ...peersList.map((p) => ({ peer: p.peer, name: p.name || 'هم‌کلاسی', stream: p.stream, self: false, camOn: p.cam, color: p.color })),
 ]
 const canDraw = user && (!boardLocked || isTeacher)

 const ctl = (on) => `ctl ${on ? 'on' : ''}`
 const roleLabel = (r) => (r === 'teacher' ? 'مدرس' : r === 'admin' ? 'مدیر' : '')

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

 <div className={`live-grid ${pseudoFs ? 'fs-grid' : ''}`}>
 <div className="live-stage" ref={stageRef}>
 <div className={`live-view ${board ? 'board' : screen || anyoneScreening ? 'screen' : 'camera'}`}>
 <span className="live-label"><i className="live-red-dot" /> {board ? 'وایت‌برد مشترک' : screen ? 'اشتراک صفحه شما' : anyoneScreening ? 'اشتراک صفحه مدرس' : 'کلاس زنده'}</span>
 <span className="live-timer" dir="ltr">{mm}:{ss}</span>

 {board ? (
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
 ) : screen ? (
   <ScreenPreview stream={screenStreamRef.current} />
 ) : anyoneScreening ? (
   <div className="cam-grid">
     {remoteVideos.length ? remoteVideos.map((p) => (
       <VideoTile key={p.peer} stream={p.stream} name={p.name} camOn color={p.color} big />
     )) : (
       <div className="live-tile"><Avatar name={classInfo?.teacher || 'مدرس'} color="grad-0" size={110} /><b style={{ fontSize: 16 }}>{classInfo?.teacher || 'مدرس'}</b><span className="muted small">در حال اشتراک صفحه…</span></div>
     )}
   </div>
 ) : (
   <div className="cam-grid">
     {allTiles.length ? allTiles.map((t) => (
       <VideoTile key={t.peer} stream={t.stream} self={t.self} name={t.name} camOn={t.camOn} color={t.color} big={allTiles.length <= 2} />
     )) : (
       <div className="live-tile">
         <Avatar name={classInfo?.teacher || 'مدرس'} color="grad-0" size={110} />
         <b style={{ fontSize: 16 }}>{classInfo?.teacher || 'مدرس'}</b>
         <span className="muted small">در حال اتصال…</span>
       </div>
     )}
   </div>
 )}

 {/* مرکز دسترسی دوربین — فقط وقتی رسانه‌ای نداریم و در حال دیدن تخته/صفحه نیستیم */}
 {!localStream && !mediaSkipped && !board && !screen && !anyoneScreening && (
   <PermissionCard
     state={mediaErr || 'idle'}
     permBusy={permBusy}
     diag={mediaDiag}
     onRequest={needsApproval ? requestSpeakPermission : startMedia}
     onSkip={skipMedia}
     inIframe={inIframe}
     onOpenTab={openNewTab}
     onGoHttps={goHttps}
     needsApproval={needsApproval}
     handSent={myHand || hand}
   />
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

 {/* نوار کاشی‌های تصویری هنگام اشتراک صفحه/تخته */}
 {(board || screen || anyoneScreening) && allTiles.length > 0 && (
   <div className="cam-strip">
     {allTiles.map((t) => (
       <div key={t.peer} style={{ width: 128, flexShrink: 0 }}>
         <VideoTile stream={t.stream} self={t.self} name={t.name} camOn={t.camOn} color={t.color} />
       </div>
     ))}
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
   localStreamRef.current?.getTracks().forEach((t) => t.stop())
   screenTrackRef.current?.stop()
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
