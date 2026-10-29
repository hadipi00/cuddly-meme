import { useEffect, useRef, useState } from 'react'
import { DataIcon } from '../utils/icons'
import Icon from './Icon'
import { Avatar } from './ui'
import { Modal } from './Modal'
import { useApp } from '../store/AppContext'
import { faNum } from '../utils/format'
import { req } from '../services/http'

/**
 * اتاق کلاس زنده — نسخه بک‌اند واقعی
 * ---------------------------------------------------------------
 * • تایمر از startedAt سرور (منبع حقیقت) — همه کاربران یک عدد می‌بینند
 * • چت واقعی روی دیتابیس (poll با ?after=id هر ۲.۵ ثانیه)
 * • حاضران واقعی با heartbeat (هر ۸ ثانیه) + دست بلند شده
 * • پایان کلاس توسط مدرس → برای همه (از سرور) جلسه تمام می‌شود
 * • اگر سرور در دسترس نباشد، همان حالت دموی قبلی (بدون کرش)
 * variant: 'teacher' | 'student'
 */
export default function LiveRoom({ variant = 'teacher', classInfo }) {
 const isTeacher = variant === 'teacher'
 const { user, toast, startLive, endLive } = useApp()
 const me = user?.name || (isTeacher ? 'مدرس' : 'دانش‌آموز')
 const classId = classInfo?.liveId || classInfo?.id

 const [mic, setMic] = useState(true)
 const [cam, setCam] = useState(true)
 const [screen, setScreen] = useState(false)
 const [board, setBoard] = useState(false)
 const [recording, setRecording] = useState(false)
 const [hand, setHand] = useState(false)
 const [ended, setEnded] = useState(false)
 const [tab, setTab] = useState('chat')
 const [, setTick] = useState(0) // برای re-render تایمر هر ثانیه

 /* وضعیت زنده از سرور */
 const [live, setLive] = useState(null) // { status, startedAt, participants }
 const liveRef = useRef(null)
 const startedRef = useRef(false)

 /* چت */
 const [messages, setMessages] = useState([])
 const [input, setInput] = useState('')
 const [sending, setSending] = useState(false)
 const chatRef = useRef(null)
 const lastIdRef = useRef(0)

 /* مدرس: شروع جلسه برای همه (فقط یک‌بار) — از طریق سرور */
 useEffect(() => {
 if (isTeacher && classId && !startedRef.current) {
 startedRef.current = true
 startLive(classId)
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /* --- poll وضعیت کلاس + heartbeat + چت --- */
 useEffect(() => {
 if (!classId) return
 let alive = true
 let hbCount = 0

 const poll = async () => {
 try {
 // وضعیت + حاضران (هر poll)
 const st = await req(`/classes/${classId}/state`)
 if (!alive) return
 setLive({ status: st.status, startedAt: st.startedAt, participants: st.participants || [] })
 liveRef.current = st

 // heartbeat هر ۳ poll (~۸ ثانیه) با وضعیت دست
 hbCount++
 if (hbCount % 3 === 0) {
 req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand } }).catch(() => {})
 }

 // پیام‌های جدید
 const r = await req(`/classes/${classId}/messages?after=${lastIdRef.current}`)
 if (!alive || !r.messages?.length) return
 setMessages((m) => {
 const known = new Set(m.filter((x) => x.id != null).map((x) => x.id))
 const fresh = r.messages.filter((x) => !known.has(x.id))
 return fresh.length ? [...m, ...fresh].slice(-80) : m
 })
 lastIdRef.current = Math.max(lastIdRef.current, ...r.messages.map((x) => x.id))
 } catch { /* سرور قطع — حالت دمو */ }
 }

 poll()
 const t = setInterval(poll, 2500)
 return () => { alive = false; clearInterval(t) }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [classId])

 /* دست بلند شده — بلافاصله به سرور */
 useEffect(() => {
 if (!classId || user == null) return
 req(`/classes/${classId}/heartbeat`, { method: 'POST', body: { hand } }).catch(() => {})
 }, [hand]) // eslint-disable-line react-hooks/exhaustive-deps

 /* تایمر محلی هر ثانیه */
 useEffect(() => {
 const t = setInterval(() => setTick((x) => x + 1), 1000)
 return () => clearInterval(t)
 }, [])

 useEffect(() => {
 chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
 }, [messages])

 /* --- محاسبه تایمر: اولویت با startedAt سرور --- */
 const startedAt = live?.startedAt || null
 const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
 const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
 const ss = String(elapsed % 60).padStart(2, '0')

 const participants = live?.participants || []
 const handsUp = participants.filter((p) => p.hand).length

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
 <span className="badge b-red"><i className="live-red-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99 }} /> پخش زنده</span>
 </div>

 <div className="live-grid">
 <div className="live-stage">
 <div className={`live-view ${screen ? 'screen' : 'camera'}`}>
 <span className="live-label"><i className="live-red-dot" /> {screen ? 'اشتراک صفحه فعال' : 'دوربین مدرس'}</span>
 <span className="live-timer" dir="ltr">{mm}:{ss}</span>
 {screen ? (
 <div className="live-screen-mock">
 <Icon name="monitor" />
 <b>صفحه مدرس در حال اشتراک است</b>
 <span>{board ? ' وایت‌برد دیجیتال فعال — درس روی برد نوشته می‌شود' : 'اسلاید درس / محیط کدنویسی'}</span>
 <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
 {[85, 60, 72].map((w, i) => (
 <div key={i} style={{ height: 10, borderRadius: 6, background: 'rgba(148,163,184,0.15)', width: `${w}%` }} />
 ))}
 </div>
 </div>
 ) : (
 <div className="live-tile">
 <Avatar name={classInfo?.teacher || 'مدرس'} color="grad-0" size={110} />
 <b style={{ fontSize: 16 }}>{classInfo?.teacher || 'مدرس'}</b>
 <span className="muted small">در حال تدریس با دوربین</span>
 </div>
 )}
 {/* کاشی خودم */}
 <div style={{ position: 'absolute', bottom: 14, insetInlineEnd: 14, width: 120, aspectRatio: '4/3', borderRadius: 12, border: `1.5px solid ${cam ? 'rgba(45,212,191,.5)' : 'var(--line)'}`, background: 'linear-gradient(160deg,#0d1830,#101f38)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
 <Avatar name={me} size={40} color="grad-3" />
 <span className="muted" style={{ fontSize: 10.5 }}>{me} {!cam && '• دوربین خاموش'}</span>
 </div>
 </div>

 <div className="live-controls">
 <button className={ctl(mic) + (mic ? '' : ' off')} onClick={() => setMic(!mic)}>
 <Icon name="mic" /> <span className="ctl-tip">{mic ? 'قطع میکروفون' : 'وصل میکروفون'}</span>
 </button>
 <button className={ctl(cam) + (cam ? '' : ' off')} onClick={() => setCam(!cam)}>
 <Icon name="camera" /> <span className="ctl-tip">{cam ? 'خاموش کردن دوربین' : 'روشن کردن دوربین'}</span>
 </button>
 {isTeacher && (
 <button className={ctl(screen)} onClick={() => { setScreen(!screen); setBoard(false) }}>
 <Icon name="monitor" /> <span className="ctl-tip">اشتراک صفحه سیستم</span>
 </button>
 )}
 {isTeacher && (
 <button className={ctl(board)} onClick={() => { setBoard(!board); setScreen(true) }}>
 <Icon name="board" /> <span className="ctl-tip">وایت‌برد دیجیتال</span>
 </button>
 )}
 {isTeacher ? (
 <button className={ctl(recording)} onClick={() => { setRecording(!recording); toast(recording ? 'ضبط کلاس متوقف شد' : 'ضبط کلاس شروع شد — برای دانشجوهای غایب منتشر می‌شود', 'info') }}>
 <Icon name="activity" /> <span className="ctl-tip">{recording ? 'توقف ضبط' : 'ضبط کلاس'}</span>
 </button>
 ) : (
 <button className={ctl(hand) + (hand ? ' on' : '')} onClick={() => { setHand(!hand); toast(hand ? 'دست شما پایین آمد' : 'دست شما بالا رفت — مدرس متوجه می‌شود', 'info') }}>
 <Icon name="hand" /> <span className="ctl-tip">{hand ? 'پایین آوردن دست' : 'بلند کردن دست'}</span>
 </button>
 )}
 {isTeacher ? (
 <button className="ctl danger" onClick={() => setEnded(true)}>
 <Icon name="logout" size={19} /> پایان کلاس
 </button>
 ) : (
 <button className="ctl danger" onClick={() => setEnded(true)}>
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
 <span className="small">{p.name}{p.id === user?.id ? ' (شما)' : ''} {roleLabel(p.role) && <span className="badge b-teal" style={{ fontSize: 10, padding: '1px 8px' }}>{roleLabel(p.role)}</span>}{p.hand ? ' ✋' : ''}</span>
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
 <Modal open={ended} title={isTeacher ? 'پایان کلاس' : 'خروج از کلاس'} onClose={() => setEnded(false)}>
 {isTeacher ? (
 <>
 <p className="muted small mb16">خلاصه جلسه برای ثبت در پنل:</p>
 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{mm}:{ss}</b><span className="sc-label">مدت کلاس</span></div>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(participants.length)}</b><span className="sc-label">حاضران</span></div>
 <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(messages.length)}</b><span className="sc-label">پیام گفتگو</span></div>
 </div>
 <div className="modal-actions">
 <button className="btn btn-primary" onClick={() => {
 setEnded(false)
 if (classId) endLive(classId)
 toast('کلاس با موفقیت به پایان رسید — وضعیت برای همه کاربران بروز شد')
 }}>ثبت و پایان</button>
 <button className="btn btn-ghost" onClick={() => setEnded(false)}>بازگشت به کلاس</button>
 </div>
 </>
 ) : (
 <>
 <p className="muted small">از کلاس خارج می‌شوید؟ حضور و غیاب شما ثبت شده است.</p>
 <div className="modal-actions">
 <button className="btn btn-primary" onClick={() => { setEnded(false); toast('از کلاس خارج شدید — حضور شما ثبت شد', 'info') }}>بله، خارج شو</button>
 <button className="btn btn-ghost" onClick={() => setEnded(false)}>بازگشت</button>
 </div>
 </>
 )}
 </Modal>
 </div>
 )
}
