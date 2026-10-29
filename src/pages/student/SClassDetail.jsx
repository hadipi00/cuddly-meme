import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import VideoModal from '../../components/VideoModal'
import { DataIcon } from '../../utils/icons'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum, faDate, toman } from '../../utils/format'
import { useNow, fmtDuration, nextOccurrence } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

/** مدت ثانیه‌ای جلسه → «۵:۳۴» یا «۰:۴۵:۱۲» */
const durFmt = (sec) => {
 const s = Math.max(0, Number(sec) || 0)
 const h = Math.floor(s / 3600)
 const m = Math.floor((s % 3600) / 60)
 const ss = s % 60
 const mm = String(m).padStart(2, '0')
 const s2 = String(ss).padStart(2, '0')
 return h ? `${h}:${mm}:${s2}` : `${m}:${s2}`
}

/**
 * جزئیات کامل یک کلاس خریداری‌شده — پنل دانش‌آموز:
 *  • جلسات پیش‌رو (بر اساس برنامه هفتگی کلاس)
 *  • جلسات برگزارشده — ویدیوی ضبط‌شده (وب‌ویو داخل سایت) + فایل‌های ضمیمه
 *  • فایل‌ها و جزوه‌های کلاس که مدرس می‌گذارد
 */
export default function SClassDetail() {
 const { classId } = useParams()
 const { liveSessions } = useApp()
 const now = useNow(1000)
 const [data, setData] = useState(null) // { class, sessions, materials, canManage }
 const [state, setState] = useState('loading') // loading | ok | missing | forbidden
 const [video, setVideo] = useState(null) // { title, url }

 const load = () => {
 req(`/classes/${classId}/detail`).then((r) => {
 setData(r)
 setState('ok')
 }).catch((e) => {
 if (e.serverDown) { setState('missing'); return }
 setState(e.status === 403 ? 'forbidden' : 'missing')
 })
 }
 useEffect(load, [classId])

 if (state === 'loading') {
 return <div className="card pad" style={{ textAlign: 'center', padding: 50 }}><span className="muted small">در حال دریافت جزئیات کلاس…</span></div>
 }

 if (state === 'forbidden') {
 return (
 <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center', padding: 50 }}>
 <div className="sc-icon violet" style={{ width: 60, height: 60, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
 <Icon name="lock" size={26} />
 </div>
 <h3>این کلاس برای شما باز نیست</h3>
 <p className="muted small mt8">برای دیدن جزئیات، ضبط جلسات و فایل‌ها باید در کلاس ثبت‌نام (خرید) کنید.</p>
 <Link to={`/panel/student/live/${classId}`} className="btn btn-primary btn-sm mt16">مشاهده و خرید کلاس</Link>
 </div>
 )
 }

 if (state !== 'ok' || !data?.class) {
 return (
 <div className="card pad" style={{ textAlign: 'center', padding: 50 }}>
 <h3>کلاس پیدا نشد</h3>
 <Link to="/panel/student/classes" className="btn btn-ghost btn-sm mt16">بازگشت به کلاس‌های من</Link>
 </div>
 )
 }

 const c = data.class
 const live = liveSessions[c.id]?.startedAt && !liveSessions[c.id]?.ended
 const classLevelMaterials = (data.materials || []).filter((m) => !m.sessionId)

 /* جلسات پیش‌رو — ۴ جلسه بعدی برنامه هفتگی */
 const upcoming = []
 let cursor = nextOccurrence(c.day, c.start)
 for (let i = 0; i < 4; i++) {
 const d = new Date(cursor)
 d.setDate(d.getDate() + i * 7)
 upcoming.push(d)
 }
 const msToFirst = upcoming[0]?.getTime() - now

 const sessionMaterials = (sid) => (data.materials || []).filter((m) => m.sessionId === sid)

 return (
 <div>
 <Link to="/panel/student/classes" className="muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
 <Icon name="chevronRight" size={14} /> بازگشت به کلاس‌های من
 </Link>

 {/* ---------- هدر کلاس ---------- */}
 <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.08), rgba(56,189,248,0.08))' }}>
 <div className="row g16" style={{ alignItems: 'flex-start' }}>
 <span className={`avatar ${c.color || 'grad-0'}`} style={{ width: 64, height: 64, borderRadius: 18, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <DataIcon name={c.icon} size={28} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div className="between wrap g8">
 <b style={{ fontSize: 17 }}>{c.title}</b>
 {live ? (
 <span className="badge b-red live-pulse" style={{ padding: '5px 14px' }}><Radio size={12} /> در حال برگزاری</span>
 ) : c.status === 'ended' ? (
 <span className="badge b-gray">آخرین جلسه برگزار شد</span>
 ) : (
 <span className="badge b-teal">زمان‌بندی شده</span>
 )}
 </div>
 <p className="muted small mt8">{c.desc}</p>
 <div className="row g8 wrap mt8">
 <span className="badge b-gray"><Icon name="user" size={11} /> {c.teacherName || 'مدرس‌یار'}</span>
 <span className="badge b-gray"><Icon name="calendar" size={11} /> {DAYS[c.day]} ساعت {c.start}</span>
 <span className="badge b-gray"><Icon name="clock" size={11} /> {faNum(c.dur)} دقیقه</span>
 <span className="badge b-gray"><Icon name="users" size={11} /> {faNum(c.enrolled)} نفر</span>
 {c.price > 0 && <span className="badge b-sky">{toman(c.price)}</span>}
 </div>
 </div>
 </div>
 <div className="row g8 mt16 wrap">
 {live ? (
 <Link to={`/panel/student/live/${c.id}`} className="btn btn-danger">
 <Radio size={15} /> ورود به کلاس زنده
 </Link>
 ) : (
 <span className="badge b-gray" style={{ padding: '8px 14px' }}>
 کلاس به‌محض شروع توسط مدرس، از همین‌جا و برنامه هفتگی باز می‌شود
 </span>
 )}
 </div>
 </div>

 <div className="grids g2">
 {/* ---------- ستون راست: جلسات ---------- */}
 <div>
 {/* جلسات پیش‌رو */}
 <div className="card pad mb24">
 <h3 className="mb16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="calendar" size={17} /> جلسات پیش‌رو</h3>
 {msToFirst > 0 && (
 <p className="muted small mb12">اولین جلسه: <b>{fmtDuration(msToFirst)}</b> دیگر</p>
 )}
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 {upcoming.map((d, i) => (
 <div className="row g12 between" key={i} style={{ background: 'var(--bg, rgba(127,127,127,0.06))', borderRadius: 12, padding: '10px 14px' }}>
 <span className="row g8"><Icon name="clock" size={15} /> <b className="small">{faDate(d)}</b></span>
 <span className="muted small">{DAYS[c.day]} • ساعت {c.start} • {faNum(c.dur)} دقیقه</span>
 </div>
 ))}
 </div>
 </div>

 {/* جلسات برگزارشده */}
 <div className="card pad">
 <h3 className="mb16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="play" size={16} /> جلسات برگزارشده</h3>
 {(data.sessions || []).length === 0 ? (
 <p className="muted small" style={{ textAlign: 'center', padding: 18 }}>
 هنوز جلسه‌ای برگزار نشده — به‌محض پایان هر جلسه، ضبط کلاس و فایل‌هایش همین‌جا منتشر می‌شود.
 </p>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 {data.sessions.map((s) => {
 const mats = sessionMaterials(s.id)
 return (
 <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
 <div className="between wrap g8">
 <b className="small">جلسه {faDate(s.startedAt)}</b>
 <span className="badge b-gray" dir="ltr"><Icon name="clock" size={11} /> {durFmt(s.dur)}</span>
 </div>
 <div className="row g8 wrap mt12">
 {s.recordingUrl ? (
 <button className="btn btn-primary btn-sm" onClick={() => setVideo({ title: `ضبط جلسه ${faDate(s.startedAt)}`, url: s.recordingUrl })}>
 <Icon name="play" filled size={13} /> تماشای ضبط جلسه
 </button>
 ) : (
 <span className="badge b-gray"><Icon name="video" size={11} /> ضبط این جلسه هنوز منتشر نشده</span>
 )}
 {mats.map((m) => (
 <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
 <Icon name="download" size={13} /> {m.title}
 </a>
 ))}
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 </div>

 {/* ---------- ستون چپ: فایل‌ها و جزوه‌ها ---------- */}
 <div>
 <div className="card pad">
 <h3 className="mb16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="file" size={16} /> فایل‌ها و جزوه‌ها</h3>
 <p className="muted small mb16">جزوه‌ها و فایل‌های خامی که مدرس برای این کلاس می‌گذارد — با کلیک دانلود یا باز می‌شوند.</p>
 {classLevelMaterials.length === 0 ? (
 <p className="muted small" style={{ textAlign: 'center', padding: 18, border: '1px dashed var(--line)', borderRadius: 12 }}>
 هنوز فایلی برای این کلاس گذاشته نشده است.
 </p>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 {classLevelMaterials.map((m) => (
 <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
 className="row g12 between" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', textDecoration: 'none' }}>
 <span className="row g8" style={{ minWidth: 0 }}>
 <span className="sc-icon teal" style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <Icon name="file" size={15} />
 </span>
 <b className="small" style={{ overflowWrap: 'anywhere' }}>{m.title}</b>
 </span>
 <Icon name="download" size={15} />
 </a>
 ))}
 </div>
 )}
 </div>

 <div className="card pad mt24" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(56,189,248,0.08))' }}>
 <b className="small">چطور ضبط جلسات را ببینم؟</b>
 <p className="muted small mt8" style={{ lineHeight: 1.9 }}>
 به‌محض پایان هر جلسه، ویدیوی ضبط‌شده در بخش «جلسات برگزارشده» همین صفحه قرار می‌گیرد؛
 روی «تماشای ضبط جلسه» بزنید تا ویدیو داخل همان سایت (وب‌ویو) پخش شود و به سایت دیگری منتقل نشوید.
 فایل‌های ضمیمه هر جلسه هم زیر همان جلسه قابل دانلود است.
 </p>
 </div>
 </div>
 </div>

 <VideoModal open={!!video} title={video?.title} url={video?.url} onClose={() => setVideo(null)} />
 </div>
 )
}
