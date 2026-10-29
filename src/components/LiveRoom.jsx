import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { Avatar } from './ui'
import { Modal } from './Modal'
import { useApp } from '../store/AppContext'
import { faNum } from '../utils/format'

const fakeChat = [
  { name: 'سارا محمدی', text: 'سلام استاد، صدا واضحه 👌' },
  { name: 'امیرحسین', text: 'میشه اسلاید قبل رو دوباره نشون بدید؟' },
  { name: 'یلدا قاسمی', text: 'کد sample روی مخزن گیت هم میذارید؟' },
  { name: 'آرش بهرامی', text: 'کیفیت تصویر عالیه 🔥' },
  { name: 'درسا نیک‌پی', text: 'تکلیف فصل ۳ تا کیه؟' },
]

const participantsSeed = [
  { name: 'سارا محمدی', mic: true, cam: true },
  { name: 'امیرحسین طباطبایی', mic: false, cam: true },
  { name: 'یلدا قاسمی', mic: false, cam: false },
  { name: 'آرش بهرامی', mic: true, cam: false },
  { name: 'درسا نیک‌پی', mic: false, cam: true },
  { name: 'کیان توکلی', mic: false, cam: false },
]

/**
 * اتاق کلاس زنده — نمای مدرس (camera/screen/record) و نمای دانش‌آموز (مشاهده + دست).
 * variant: 'teacher' | 'student'
 */
export default function LiveRoom({ variant = 'teacher', classInfo }) {
  const isTeacher = variant === 'teacher'
  const { user, toast } = useApp()
  const me = user?.name || (isTeacher ? 'مدرس' : 'دانش‌آموز')

  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [screen, setScreen] = useState(false)
  const [board, setBoard] = useState(false)
  const [recording, setRecording] = useState(false)
  const [hand, setHand] = useState(false)
  const [ended, setEnded] = useState(false)
  const [tab, setTab] = useState('chat')
  const [elapsed, setElapsed] = useState(0)
  const [messages, setMessages] = useState(fakeChat.slice(0, 3))
  const [input, setInput] = useState('')
  const chatRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    const c = setInterval(() => {
      setMessages((m) => [...m.slice(-30), fakeChat[Math.floor(Math.random() * fakeChat.length)]])
    }, 9000)
    return () => { clearInterval(t); clearInterval(c) }
  }, [])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const send = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    setMessages((m) => [...m, { name: `${me} (شما)`, text: input.trim(), self: true }])
    setInput('')
  }

  const ctl = (on) => `ctl ${on ? 'on' : ''}`

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <h2 style={{ fontSize: 17 }}>{classInfo?.emoji || '🎥'} {classInfo?.title || 'کلاس آنلاین زنده'}</h2>
          <span className="muted small">
            {classInfo?.teacher || 'مدرس‌یار'} • {classInfo?.dur || 90} دقیقه • {faNum(participantsSeed.length + 12)} نفر حاضر
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
                <span>{board ? '🧑‍🏫 وایت‌برد دیجیتال فعال — درس روی برد نوشته می‌شود' : 'اسلاید درس / محیط کدنویسی'}</span>
                <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {[85, 60, 72].map((w, i) => (
                    <div key={i} style={{ height: 10, borderRadius: 6, background: 'rgba(148,163,184,0.15)', width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="live-tile">
                <Avatar name={classInfo?.teacher || 'رضا کریمی'} color="grad-0" size={110} />
                <b style={{ fontSize: 16 }}>{classInfo?.teacher || 'رضا کریمی'}</b>
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
              <button className={ctl(hand)} onClick={() => { setHand(!hand); toast(hand ? 'دست شما پایین آمد' : '✋ دست شما بالا رفت — مدرس متوجه می‌شود', 'info') }}>
                <Icon name="hand" /> <span className="ctl-tip">بلند کردن دست</span>
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
              <button className={`tab-btn ${tab === 'chat' ? 'on' : ''}`} onClick={() => setTab('chat')}>💬 گفتگو</button>
              <button className={`tab-btn ${tab === 'parts' ? 'on' : ''}`} onClick={() => setTab('parts')}>👥 حاضران ({faNum(participantsSeed.length + 12)})</button>
            </div>
            {tab === 'chat' ? (
              <>
                <div className="chat-body" ref={chatRef}>
                  {messages.map((m, i) => (
                    <div className={`chat-msg ${m.self ? 'self' : ''}`} key={i}><b>{m.name}:</b> {m.text}</div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={send}>
                  <input className="input" placeholder="پیام خود را بنویسید…" value={input} onChange={(e) => setInput(e.target.value)} />
                  <button className="btn btn-primary btn-sm"><Icon name="send" size={16} /></button>
                </form>
              </>
            ) : (
              <div className="part-list">
                {participantsSeed.map((p) => (
                  <div className="part-row" key={p.name}>
                    <Avatar name={p.name} size={32} color="grad-1" />
                    <span className="small">{p.name}</span>
                    <div className="pr-icons">
                      <Icon name="mic" className={p.mic ? '' : 'muted-off'} size={15} />
                      <Icon name="camera" className={p.cam ? '' : 'muted-off'} size={15} />
                    </div>
                  </div>
                ))}
                <div className="part-row">
                  <Avatar name={me} size={32} color="grad-3" />
                  <span className="small">{me} (شما)</span>
                  <div className="pr-icons">
                    <Icon name="mic" className={mic ? '' : 'muted-off'} size={15} />
                    <Icon name="camera" className={cam ? '' : 'muted-off'} size={15} />
                  </div>
                </div>
                <div className="part-row muted small" style={{ justifyContent: 'center' }}>و {faNum(11)} نفر دیگر…</div>
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
              <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(18)}</b><span className="sc-label">میانگین حضور</span></div>
              <div className="card stat-card" style={{ padding: 14 }}><b className="sc-val">{faNum(messages.length)}</b><span className="sc-label">پیام گفتگو</span></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setEnded(false); toast('کلاس با موفقیت به پایان رسید — ضبط در پنل ذخیره شد') }}>ثبت و پایان</button>
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
