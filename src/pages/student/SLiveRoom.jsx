import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import LiveRoom from '../../components/LiveRoom'
import Icon from '../../components/Icon'
import { liveClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum } from '../../utils/format'
import { useNow, nextOccurrence, splitDuration, fmtDuration } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

/**
 * ورود دانش‌آموز به کلاس زنده:
 * - اگر مدرس کلاس را شروع کرده باشد → اتاق کلاس با تایمر زنده
 * - اگر هنوز شروع نشده → اتاق انتظار با شمارش معکوس تا شروع کلاس
 * - اگر کلاس تمام شده باشد → کارت خلاصه با ضبط جلسه
 */
export default function SLiveRoom() {
 const { classId } = useParams()
 const nav = useNavigate()
 const { liveSessions, toast } = useApp()
 const now = useNow(1000)
 const [cls, setCls] = useState(() => liveClasses.find((l) => l.id === classId))

 /* اطلاعات کلاس از بک‌اند واقعی (کلاس‌های جدید ساخته‌شده توسط مدرس هم پشتیبانی می‌شود) */
 useEffect(() => {
 let alive = true
 req(`/classes/${classId}`).then((r) => {
 if (!alive || !r.class) return
 const c = r.class
 setCls({
 id: c.id, title: c.title, desc: c.desc, icon: c.icon, color: c.color,
 teacher: c.teacherName, teacherId: c.teacherId, day: c.day, start: c.start,
 dur: c.dur, price: c.price, cap: c.cap, enrolled: c.enrolled, room: c.room,
 })
 }).catch(() => {})
 return () => { alive = false }
 }, [classId])

 if (!cls) {
 return (
 <div className="card pad" style={{ textAlign: 'center', padding: 60 }}>
 <h3>کلاس مورد نظر پیدا نشد</h3>
 <p className="muted small mt8">ممکن است لینک منقضی شده باشد.</p>
 <Link to="/panel/student/schedule" className="btn btn-primary btn-sm mt16">بازگشت به برنامه هفتگی</Link>
 </div>
 )
 }

 const session = liveSessions[cls.id]

 /* جلسه به پایان رسیده */
 if (session?.ended) {
 return (
 <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
 <div className="sc-icon green" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
 <Icon name="check" size={28} />
 </div>
 <h2 style={{ fontSize: 18 }}>جلسه «{cls.title}» به پایان رسید</h2>
 <p className="muted small mt8">
 مدت برگزاری: {fmtDuration(now - session.startedAt)} — ضبط جلسه تا ۲۴ ساعت آینده در بخش «دوره‌های من» منتشر می‌شود.
 </p>
 <div className="row g8 mt24" style={{ justifyContent: 'center' }}>
 <Link to="/panel/student/schedule" className="btn btn-ghost">برنامه هفتگی</Link>
 <Link to="/panel/student/courses" className="btn btn-primary">دوره‌های من</Link>
 </div>
 </div>
 )
 }

 /* زنده — ورود به اتاق کلاس */
 if (session?.startedAt) {
 return <LiveRoom variant="student" classInfo={cls} />
 }

 /* اتاق انتظار — شمارش معکوس تا شروع */
 const startsAt = nextOccurrence(cls.day, cls.start)
 const msLeft = startsAt.getTime() - now
 const { d, h, m, s } = splitDuration(msLeft)
 const soon = msLeft < 30 * 60_000

 return (
 <div className="card pad" style={{ maxWidth: 640, margin: '30px auto', textAlign: 'center' }}>
 <span className={`badge ${soon ? 'b-red' : 'b-teal'}`} style={{ margin: '0 auto 18px', padding: '5px 14px' }}>
 <i className="live-red-dot" style={{ width: 8, height: 8, borderRadius: 99, display: 'inline-block', background: soon ? 'var(--red)' : 'var(--teal)' }} />
 {soon ? 'به‌زودی شروع می‌شود' : 'هنوز شروع نشده'}
 </span>

 <div className={`avatar ${cls.color}`} style={{ width: 84, height: 84, borderRadius: 24, fontSize: 34, margin: '0 auto 16px' }}>
 <Icon name="video" size={34} />
 </div>
 <h2 style={{ fontSize: 20 }}>{cls.title}</h2>
 <p className="muted small mt8">
 مدرس: {cls.teacher} • {DAYS[cls.day]} ساعت {cls.start} • {faNum(cls.dur)} دقیقه
 </p>
 <p className="muted small">{cls.desc}</p>

 <div className="countdown-box" style={{ justifyContent: 'center', margin: '26px 0 8px', flexWrap: 'wrap' }}>
 {d > 0 && <span className="cd-cell"><b>{faNum(d)}</b><span>روز</span></span>}
 <span className="cd-cell"><b dir="ltr">{String(h).padStart(2, '0')}</b><span>ساعت</span></span>
 <span className="cd-cell"><b dir="ltr">{String(m).padStart(2, '0')}</b><span>دقیقه</span></span>
 <span className="cd-cell"><b dir="ltr">{String(s).padStart(2, '0')}</b><span>ثانیه</span></span>
 </div>
 <p className="muted small">تا شروع این جلسه — به محض شروع توسط مدرس، دکمه ورود فعال می‌شود.</p>

 <div className="row g8 mt24" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
 <button className="btn btn-ghost" onClick={() => { toast('یادآوری ۱۵ دقیقه قبل از شروع کلاس برای شما فعال شد') }}>
 <BellRing size={16} /> یادآوری بگذار
 </button>
 <Link to="/panel/student/schedule" className="btn btn-primary">برنامه هفتگی من</Link>
 </div>
 </div>
 )
}
