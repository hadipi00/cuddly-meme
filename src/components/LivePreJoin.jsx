import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { faNum } from '../utils/format'
import { listMediaDevices, openCamera, openMic, startMicMeter, applySink, loadDevPrefs, saveDevPrefs } from '../lib/devices'

/**
 * صفحهٔ بررسی تجهیزات قبل از ورود به کلاس زنده — الگو از کاویمو
 * ---------------------------------------------------------------------
 *  • پیش‌نمایش زندهٔ دوربین (آینه‌ای) + نمایشگر سطح صدای میکروفون
 *  • انتخاب دوربین / میکروفون / اسپیکر با تعویض زندهٔ پیش‌نمایش
 *  • ذخیرهٔ انتخاب‌ها → کلاس بعدی همان دستگاه‌ها به‌صورت پیش‌فرض
 *  • خطاهای دسترسی با راهنمای دقیق (مجوز رد شده، اشغال بودن، نبود دستگاه)
 *  • «ورود بدون دوربین» همیشه در دسترس است
 *
 * onJoin({ camDeviceId, micDeviceId, spkId, facing, autoRec, hasVideo, hasAudio })
 */
export default function LivePreJoin({ role = 'teacher', classTitle, teacher, onJoin, onCancel, onSkip }) {
  const isTeacher = role === 'teacher'
  const prefs = useRef(loadDevPrefs())

  const videoRef = useRef(null)
  const camStreamRef = useRef(null) // ترک ویدیوی پیش‌نمایش
  const micStreamRef = useRef(null) // ترک صدای پیش‌نمایش
  const meterStopRef = useRef(null)

  const [cams, setCams] = useState([])
  const [mics, setMics] = useState([])
  const [spkrs, setSpkrs] = useState([])
  const [camId, setCamId] = useState(prefs.current.cam || '')
  const [micId, setMicId] = useState(prefs.current.mic || '')
  const [spkId, setSpkId] = useState(prefs.current.spk || '')
  const [facing, setFacing] = useState(prefs.current.facing || 'user')
  const [autoRec, setAutoRec] = useState(prefs.current.autoRec !== false)
  const [level, setLevel] = useState(0)
  const [state, setState] = useState('starting') // starting | ok | denied | busy | nodevice | insecure
  const [hasCam, setHasCam] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const [busySwitch, setBusySwitch] = useState(false)
  const [counts, setCounts] = useState({ v: 0, a: 0 })
  const canSink = typeof document !== 'undefined' && !!document.createElement('video')?.setSinkId

  const stopPreview = () => {
    meterStopRef.current?.()
    meterStopRef.current = null
    camStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    camStreamRef.current = null
    micStreamRef.current = null
  }

  const deadRef = useRef(false)

  /* ---------- راه‌اندازی: دوربین + میکروفون (قابل‌فراخوانی برای «تلاش دوباره») ---------- */
  const startAll = async () => {
    if (deadRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) { setState('insecure'); return }
    stopPreview()
    setState('starting')
    try {
      const s = await openCamera({ deviceId: prefs.current.cam || undefined, facing, wantAudio: false })
      if (deadRef.current) { s.getTracks().forEach((t) => t.stop()); return }
      camStreamRef.current = s
      const vt = s.getVideoTracks()[0]
      if (vt) {
        setFacing(vt.getSettings?.().facingMode || facing)
        setCamId(vt.getSettings?.().deviceId || prefs.current.cam || '')
      }
      setHasCam(true)
      setState('ok')
    } catch (e) {
      if (deadRef.current) return
      setHasCam(false)
      const n = e?.name || ''
      setState(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'nodevice' : n === 'NotReadableError' || n === 'TrackStartError' ? 'busy' : 'denied')
    }
    /* میکروفون جدا گرفته می‌شود — اگر دوربین نبود، صدا خودش کار کند */
    try {
      const m = await openMic({ deviceId: prefs.current.mic || undefined })
      if (deadRef.current) { m.getTracks().forEach((t) => t.stop()); return }
      micStreamRef.current = m
      const at = m.getAudioTracks()[0]
      setMicId(at?.getSettings?.().deviceId || prefs.current.mic || '')
      setHasMic(true)
      meterStopRef.current?.()
      meterStopRef.current = startMicMeter(m, (v) => setLevel(v))
    } catch {
      if (!deadRef.current) setHasMic(false)
    }
    /* فهرست دستگاه‌ها — بعد از اجازه، برچسب‌ها واقعی‌اند */
    const { cams: c, mics: m2, spkrs: s2 } = await listMediaDevices()
    if (deadRef.current) return
    setCams(c); setMics(m2); setSpkrs(s2)
    setCounts({ v: c.length, a: m2.length })
  }

  useEffect(() => {
    deadRef.current = false
    startAll()
    const onDevChange = () => { listMediaDevices().then(({ cams: c, mics: m2, spkrs: s2 }) => { if (!deadRef.current) { setCams(c); setMics(m2); setSpkrs(s2) } }) }
    try { navigator.mediaDevices?.addEventListener?.('devicechange', onDevChange) } catch { /* noop */ }
    return () => {
      deadRef.current = true
      stopPreview()
      try { navigator.mediaDevices?.removeEventListener?.('devicechange', onDevChange) } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* اتصال ترک‌ها به عنصر ویدیو + اسپیکر انتخابی */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tracks = [...(camStreamRef.current?.getVideoTracks() || []), ...(micStreamRef.current?.getAudioTracks() || [])]
    if (tracks.length) {
      const ms = new MediaStream(tracks)
      if (v.srcObject !== ms) { v.srcObject = ms; v.play?.().catch(() => {}) }
    } else if (v.srcObject) { v.srcObject = null }
    applySink(v, spkId)
  }, [state, hasCam, hasMic, camId, micId, spkId])

  /* ---------- تعویض زندهٔ دستگاه‌ها ---------- */
  const switchCam = async (id, f) => {
    if (busySwitch) return
    setBusySwitch(true)
    const nextFacing = f || (id ? facing : (facing === 'user' ? 'environment' : 'user'))
    const old = camStreamRef.current
    try {
      const s = await openCamera({ deviceId: id || undefined, facing: id ? undefined : nextFacing, wantAudio: false })
      old?.getTracks().forEach((t) => t.stop())
      camStreamRef.current = s
      const vt = s.getVideoTracks()[0]
      if (vt) {
        setCamId(vt.getSettings?.().deviceId || id || '')
        setFacing(vt.getSettings?.().facingMode || nextFacing)
      }
      setHasCam(true); setState('ok')
    } catch {
      /* نگه داشتن دوربین قبلی — کاربر بی‌تصویر نمی‌ماند */
      if (!old?.getVideoTracks().length) setHasCam(false)
    }
    setBusySwitch(false)
  }
  const switchMic = async (id) => {
    const old = micStreamRef.current
    try {
      const m = await openMic({ deviceId: id || undefined })
      old?.getTracks().forEach((t) => t.stop())
      micStreamRef.current = m
      const at = m.getAudioTracks()[0]
      setMicId(at?.getSettings?.().deviceId || id || '')
      setHasMic(true)
      meterStopRef.current?.()
      meterStopRef.current = startMicMeter(m, (v) => setLevel(v))
    } catch {
      if (!old?.getAudioTracks().length) setHasMic(false)
    }
  }

  const join = () => {
    saveDevPrefs({ cam: camId, mic: micId, spk: spkId, facing, autoRec })
    stopPreview()
    onJoin({ camDeviceId: camId, micDeviceId: micId, spkId, facing, autoRec, hasVideo: hasCam, hasAudio: hasMic })
  }
  const skip = () => {
    saveDevPrefs({ autoRec })
    stopPreview()
    onSkip?.({ autoRec, spkId })
  }

  const errText = {
    denied: 'دسترسی دوربین/میکروفون داده نشد — روی آیکون قفل کنار آدرس سایت بزنید و مجوز را «اجازه دادن» کنید، سپس «تلاش دوباره».',
    busy: 'دوربین/میکروفون توسط برنامهٔ دیگری اشغال است (Zoom/Skype/…) — ببندید و «تلاش دوباره».',
    nodevice: 'هیچ دوربین یا میکروفونی پیدا نشد — اگر از داخل اپ پیام‌رسان باز کرده‌اید، لینک را در Chrome/Safari اصلی باز کنید. می‌توانید بدون دوربین هم وارد شوید.',
    insecure: 'مرورگر فقط در آدرس امن (HTTPS) اجازهٔ دوربین می‌دهد.',
  }

  const sel = (val, set, list, label, icon, kind) => (
    <label className="pj-field">
      <span className="pj-lb"><Icon name={icon} size={14} /> {label}</span>
      <select className="input pj-select" value={val} onChange={(e) => set(e.target.value)} dir="ltr">
        {val && !list.some((d) => d.deviceId === val) && <option value={val}>دستگاه فعلی</option>}
        {list.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>{d.label || `${kind} ${faNum(i + 1)}`}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="pj-overlay">
      <div className="pj-card">
        <div className="pj-head">
          <div>
            <b className="pj-title">بررسی تجهیزات — ورود به کلاس زنده</b>
            <span className="muted small">{classTitle}{teacher ? ` • مدرس: ${teacher}` : ''}</span>
          </div>
          {isTeacher && (
            <button className={`pj-autorec ${autoRec ? 'on' : ''}`} onClick={() => setAutoRec(!autoRec)} title="ضبط خودکار جلسه">
              <Icon name="activity" size={15} /> ضبط خودکار جلسه {autoRec ? 'روشن' : 'خاموش'}
            </button>
          )}
        </div>

        <div className="pj-body">
          <div className={`pj-preview ${state !== 'ok' ? 'err' : ''}`}>
            <video ref={videoRef} autoPlay playsInline muted className="pj-video" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
            {state !== 'ok' && (
              <div className="pj-preview-fallback">
                <div className="sc-icon teal" style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="camera" size={26} />
                </div>
                {state === 'starting' ? (
                  <b className="small">در حال اتصال به دوربین و میکروفون…</b>
                ) : (
                  <>
                    <b className="small" style={{ color: 'var(--red)' }}>{state === 'insecure' ? 'محیط ناامن' : 'دسترسی برقرار نشد'}</b>
                    {errText[state] && <span className="muted small" style={{ maxWidth: 340, lineHeight: 1.9 }}>{errText[state]}</span>}
                    {state !== 'insecure' && (
                      <button className="btn btn-primary btn-sm" onClick={() => startAll()}>
                        <Icon name="refresh" size={14} /> تلاش دوباره
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <span className="pj-mirror-hint">{facing === 'user' ? 'دوربین جلو' : 'دوربین عقب'}</span>
          </div>

          <div className="pj-controls">
            {/* نمایشگر سطح صدا */}
            <div className="pj-meter-wrap">
              <span className="pj-lb"><Icon name="mic" size={14} /> سطح صدای میکروفون {hasMic ? '' : '— خاموش'}</span>
              <div className="pj-meter"><i style={{ width: `${Math.round(level * 100)}%`, opacity: level > 0.02 ? 1 : 0.25 }} /></div>
              <span className="muted" style={{ fontSize: 10.5 }}>
                اگر هنگام حرف زدن نوار سبز بالا می‌رود، صدای شما به کلاس می‌رسد • {faNum(counts.a)} میکروفون / {faNum(counts.v)} دوربین شناسایی شد
              </span>
            </div>

            {sel(camId, (v) => switchCam(v), cams, 'دوربین', 'camera', 'دوربین')}
            <div className="row g8">
              <button className="btn btn-ghost btn-sm" disabled={busySwitch} onClick={() => switchCam('', null)} title="جابه‌جایی دوربین جلو/عقب">
                <Icon name="camFlip" size={14} /> جلو/عقب
              </button>
            </div>
            {sel(micId, (v) => switchMic(v), mics, 'میکروفون', 'mic', 'میکروفون')}
            {canSink && sel(spkId, (v) => setSpkId(v), spkrs, 'خروجی صدا (اسپیکر)', 'volume', 'اسپیکر')}

            <div className="pj-note">
              <Icon name={isTeacher ? 'video' : 'shield'} size={14} />
              <span className="muted small">
                {isTeacher
                  ? 'با «ورود به کلاس»، جلسه برای همهٔ دانش‌آموزان زنده می‌شود؛ دوربین/میکروفون با همین دستگاه‌های انتخابی روشن خواهد شد.'
                  : 'پیش‌نمایش فقط تست است — صدا و تصویر شما فقط بعد از اجازهٔ مدرس به کلاس ارسال می‌شود.'}
              </span>
            </div>

            <div className="row g8 mt8" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" style={{ flex: 1, minWidth: 200 }} onClick={join}>
                <Icon name="play" filled size={16} /> {isTeacher ? 'ورود و شروع کلاس' : 'ورود به کلاس'}
              </button>
              {onCancel && <button className="btn btn-ghost" onClick={onCancel}>انصراف</button>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={skip}>
              ورود بدون دوربین — چت، وایت‌برد و حاضران فعال است
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
