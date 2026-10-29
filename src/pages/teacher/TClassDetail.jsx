import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import VideoModal from '../../components/VideoModal'
import { DataIcon } from '../../utils/icons'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum, faDate } from '../../utils/format'
import { req } from '../../services/http'

const durFmt = (sec) => {
 const s = Math.max(0, Number(sec) || 0)
 const h = Math.floor(s / 3600)
 const m = Math.floor((s % 3600) / 60)
 const ss = String(s % 60).padStart(2, '0')
 return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * مدیریت کلاس (نمای مدرس) — ثبت لینک مستقیم ضبط جلسات + فایل‌ها و جزوه‌ها:
 *  ۱) در کلاس زنده دکمه «ضبط کلاس» فایل ویدیو را روی دستگاه مدرس ذخیره می‌کند
 *  ۲) مدرس فایل را در سرویس خودش (آپارات/دُرایو/…) آپلود و لینک مستقیم می‌گیرد
 *  ۳) لینک را در همین صفحه برای جلسه مربوطه ثبت می‌کند تا دانش‌آموز داخل سایت ببیند
 */
export default function TClassDetail() {
 const { classId } = useParams()
 const { toast } = useApp()
 const [data, setData] = useState(null)
 const [state, setState] = useState('loading')
 const [video, setVideo] = useState(null)
 const [recDraft, setRecDraft] = useState({}) // sessionId → url
 const [savingRec, setSavingRec] = useState(null)
 const [mat, setMat] = useState({ title: '', url: '', sessionId: '' })
 const [savingMat, setSavingMat] = useState(false)

 const load = () => {
 req(`/classes/${classId}/detail`).then((r) => {
 setData(r)
 setState('ok')
 }).catch((e) => setState(e.status === 403 ? 'forbidden' : 'missing'))
 }
 useEffect(load, [classId])

 if (state === 'loading') {
 return <div className="card pad" style={{ textAlign: 'center', padding: 50 }}><span className="muted small">در حال دریافت اطلاعات کلاس…</span></div>
 }

 if (state !== 'ok' || !data?.class) {
 return (
 <div className="card pad" style={{ textAlign: 'center', padding: 50 }}>
 <h3>کلاس پیدا نشد یا به آن دسترسی ندارید</h3>
 <Link to="/panel/teacher/classes" className="btn btn-ghost btn-sm mt16">بازگشت به کلاس‌های من</Link>
 </div>
 )
 }

 const c = data.class
 const sessions = data.sessions || []
 const materials = data.materials || []

 const saveRecording = async (sid) => {
 const url = (recDraft[sid] ?? '').trim()
 if (!url) { toast('لینک مستقیم ویدیو را وارد کنید', 'error'); return }
 setSavingRec(sid)
 try {
 await req(`/classes/${classId}/sessions/${sid}/recording`, { method: 'POST', body: { url } })
 toast('لینک ضبط جلسه ثبت شد — دانش‌آموزها از بخش «جلسات برگزارشده» می‌بینند')
 setRecDraft((d) => ({ ...d, [sid]: '' }))
 load()
 } catch (e) {
 if (!e.serverDown) toast(e.message || 'ثبت لینک ناموفق بود', 'error')
 }
 setSavingRec(null)
 }

 const addMaterial = async (e) => {
 e.preventDefault()
 if (savingMat) return
 setSavingMat(true)
 try {
 await req(`/classes/${classId}/materials`, {
 method: 'POST',
 body: { title: mat.title, url: mat.url, sessionId: mat.sessionId || null },
 })
 toast('فایل برای کلاس ثبت شد')
 setMat({ title: '', url: '', sessionId: '' })
 load()
 } catch (e2) {
 if (!e2.serverDown) toast(e2.message || 'افزودن فایل ناموفق بود', 'error')
 }
 setSavingMat(false)
 }

 const removeMaterial = async (m) => {
 try {
 await req(`/classes/${classId}/materials/${m.id}`, { method: 'DELETE' })
 toast('فایل حذف شد', 'info')
 load()
 } catch (e) {
 if (!e.serverDown) toast(e.message || 'حذف ناموفق بود', 'error')
 }
 }

 return (
 <div>
 <Link to="/panel/teacher/classes" className="muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
 <Icon name="chevronRight" size={14} /> بازگشت به کلاس‌های من
 </Link>

 {/* ---------- هدر کلاس ---------- */}
 <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.08), rgba(56,189,248,0.08))' }}>
 <div className="row g16" style={{ alignItems: 'flex-start' }}>
 <span className={`avatar ${c.color || 'grad-0'}`} style={{ width: 64, height: 64, borderRadius: 18, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <DataIcon name={c.icon} size={28} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <b style={{ fontSize: 17 }}>{c.title}</b>
 <p className="muted small mt8">{c.desc}</p>
 <div className="row g8 wrap mt8">
 <span className="badge b-gray">{DAYS[c.day]} ساعت {c.start}</span>
 <span className="badge b-gray"><Icon name="clock" size={11} /> {faNum(c.dur)} دقیقه</span>
 <span className="badge b-gray"><Icon name="users" size={11} /> {faNum(c.enrolled)} دانش‌آموز</span>
 </div>
 </div>
 </div>
 <div className="row g8 mt16 wrap">
 <Link to="/panel/teacher/live" className="btn btn-primary btn-sm"><Icon name="video" size={14} /> برگزاری کلاس زنده</Link>
 <span className="muted small" style={{ alignSelf: 'center' }}>برای ضبط، داخل کلاس زنده دکمه «ضبط کلاس» را بزنید — فایل روی دستگاه شما دانلود می‌شود.</span>
 </div>
 </div>

 <div className="grids g2">
 {/* ---------- جلسات برگزارشده + ثبت لینک ضبط ---------- */}
 <div className="card pad">
 <h3 className="mb8"><Icon name="play" size={16} /> جلسات برگزارشده — لینک ضبط</h3>
 <p className="muted small mb16">
 فایل ضبط‌شده را در سرویس خودتان (مثلاً آپارات با لینک مستقیم <b dir="ltr">aparat.com/v/xxxx</b>) آپلود کنید و
 لینک را اینجا ثبت کنید؛ دانش‌آموز ویدیو را داخل سایت و به‌صورت وب‌ویو می‌بیند.
 </p>
 {sessions.length === 0 ? (
 <p className="muted small" style={{ textAlign: 'center', padding: 18, border: '1px dashed var(--line)', borderRadius: 12 }}>
 هنوز جلسه‌ای پایان یافته است — بعد از اولین برگزاری، اینجا برای ثبت ضبط ظاهر می‌شود.
 </p>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 {sessions.map((s) => (
 <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
 <div className="between wrap g8">
 <b className="small">جلسه {faDate(s.startedAt)}</b>
 <span className="badge b-gray" dir="ltr"><Icon name="clock" size={11} /> {durFmt(s.dur)}</span>
 </div>
 {s.recordingUrl ? (
 <div className="row g8 wrap mt12">
 <button className="btn btn-primary btn-sm" onClick={() => setVideo({ title: `ضبط جلسه ${faDate(s.startedAt)}`, url: s.recordingUrl })}>
 <Icon name="play" filled size={13} /> پیش‌نمایش ضبط
 </button>
 <span className="muted small" dir="ltr" style={{ alignSelf: 'center', maxWidth: '100%', overflowWrap: 'anywhere' }}>{s.recordingUrl}</span>
 </div>
 ) : (
 <span className="badge b-gray mt12" style={{ display: 'inline-flex', marginTop: 10 }}><Icon name="video" size={11} /> لینک ضبط ثبت نشده</span>
 )}
 <div className="row g8 mt12 wrap">
 <input
 className="input"
 style={{ flex: 1, minWidth: 200 }}
 dir="ltr"
 placeholder="https://www.aparat.com/v/xxxxx"
 value={recDraft[s.id] ?? ''}
 onChange={(e) => setRecDraft((d) => ({ ...d, [s.id]: e.target.value }))}
 onKeyDown={(e) => { if (e.key === 'Enter') saveRecording(s.id) }}
 />
 <button className="btn btn-primary btn-sm" disabled={savingRec === s.id} onClick={() => saveRecording(s.id)}>
 <Icon name="check" size={14} /> {savingRec === s.id ? 'در حال ثبت…' : (s.recordingUrl ? 'به‌روزرسانی لینک' : 'ثبت لینک ضبط')}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* ---------- فایل‌ها و جزوه‌ها ---------- */}
 <div className="card pad">
 <h3 className="mb8"><Icon name="file" size={16} /> فایل‌های خام و جزوه‌ها</h3>
 <p className="muted small mb16">لینک فایل (PDF، عکس، جزوه و…) را برای دانش‌آموزها منتشر کنید — می‌توانید فایل را به کل کلاس یا فقط به یک جلسه خاص وصل کنید.</p>

 <form onSubmit={addMaterial} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
 <input className="input" placeholder="عنوان فایل — مثلاً جزوه جلسه اول: هوک‌های پایه"
 value={mat.title} onChange={(e) => setMat((m) => ({ ...m, title: e.target.value }))} required />
 <input className="input" dir="ltr" placeholder="https://example.com/jozwhe.pdf"
 value={mat.url} onChange={(e) => setMat((m) => ({ ...m, url: e.target.value }))} required />
 <select className="select" value={mat.sessionId} onChange={(e) => setMat((m) => ({ ...m, sessionId: e.target.value }))}>
 <option value="">پیوست به: کل کلاس (برای همه جلسات)</option>
 {sessions.map((s) => (
 <option key={s.id} value={s.id}>پیوست به: جلسه {faDate(s.startedAt)}</option>
 ))}
 </select>
 <button className="btn btn-primary btn-sm" disabled={savingMat} type="submit">
 <Icon name="plus" size={14} /> {savingMat ? 'در حال ثبت…' : 'انتشار فایل برای دانش‌آموزها'}
 </button>
 </form>

 {materials.length === 0 ? (
 <p className="muted small" style={{ textAlign: 'center', padding: 14, border: '1px dashed var(--line)', borderRadius: 12 }}>هنوز فایلی منتشر نشده است.</p>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {materials.map((m) => (
 <div key={m.id} className="row g8 between" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px' }}>
 <span className="row g8" style={{ minWidth: 0, flex: 1 }}>
 <Icon name="file" size={14} style={{ flexShrink: 0, color: 'var(--teal)' }} />
 <span className="small" style={{ overflowWrap: 'anywhere' }}>
 <b>{m.title}</b>
 <span className="muted"> — {m.sessionId ? `پیوست جلسه #${faNum(m.sessionId)}` : 'کل کلاس'}</span>
 </span>
 </span>
 <span className="row g4" style={{ flexShrink: 0 }}>
 <button className="icon-btn" title="باز کردن لینک" onClick={() => window.open(m.url, '_blank', 'noopener')}><Icon name="eye" size={15} /></button>
 <button className="icon-btn" title="حذف" onClick={() => removeMaterial(m)}><Icon name="trash" size={15} /></button>
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <VideoModal open={!!video} title={video?.title} url={video?.url} onClose={() => setVideo(null)} />
 </div>
 )
}
