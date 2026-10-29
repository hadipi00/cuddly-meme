import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BellRing, CreditCard, ShieldCheck, Video } from 'lucide-react'
import LiveRoom from '../../components/LiveRoom'
import Icon from '../../components/Icon'
import { liveClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum, toman } from '../../utils/format'
import { useNow, nextOccurrence, splitDuration, fmtDuration } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

/**
 * ورود دانش‌آموز به کلاس زنده — با گیت خرید:
 * - اگر کلاس را نخریده باشد → صفحه خرید (پرداخت و ثبت‌نام)
 * - اگر مدرس کلاس را شروع کرده باشد → اتاق کلاس با تایمر زنده
 * - اگر هنوز شروع نشده → اتاق انتظار با شمارش معکوس
 * - اگر کلاس تمام شده باشد → کارت خلاصه
 */
export default function SLiveRoom() {
 const { classId } = useParams()
 const nav = useNavigate()
 const { liveSessions, toast, user } = useApp()
 const now = useNow(1000)
 const [cls, setCls] = useState(() => liveClasses.find((l) => l.id === classId) || null)
 const [missing, setMissing] = useState(false)
 const [buying, setBuying] = useState(false)

 /* اطلاعات کلاس از بک‌اند واقعی — شامل وضعیت ثبت‌نام (iAmIn) */
 useEffect(() => {
   let alive = true
   req(`/classes/${classId}`).then((r) => {
     if (!alive || !r.class) return
     const c = r.class
     setCls({
       id: c.id, title: c.title, desc: c.desc, icon: c.icon, color: c.color,
       teacher: c.teacherName, teacherId: c.teacherId, day: c.day, start: c.start,
       dur: c.dur, price: c.price, cap: c.cap, enrolled: c.enrolled, room: c.room,
       iAmIn: c.iAmIn, isMine: c.isMine,
     })
   }).catch((e) => { if (!e.serverDown && alive) setMissing(true) })
   return () => { alive = false }
 }, [classId])

 /* خرید / ثبت‌نام کلاس */
 const buy = async () => {
   if (!user) { nav('/auth'); return }
   if (buying) return
   setBuying(true)
   try {
     const r = await req(`/classes/${classId}/purchase`, { method: 'POST' })
     setCls((c) => ({ ...c, iAmIn: true, enrolled: r.enrolled || c.enrolled }))
     if (r.order) toast(`پرداخت با موفقیت انجام شد — کد سفارش ${r.order.code}`)
     else toast('ثبت‌نام شما در کلاس انجام شد')
   } catch (e) {
     if (!e.serverDown) toast(e.message || 'خرید ناموفق بود', 'error')
   }
   setBuying(false)
 }

 if (missing) {
   return (
     <div className="card pad" style={{ textAlign: 'center', padding: 60 }}>
       <h3>کلاس مورد نظر پیدا نشد</h3>
       <p className="muted small mt8">ممکن است لینک منقضی شده باشد یا کلاس حذف شده است.</p>
       <Link to="/panel/student/schedule" className="btn btn-primary btn-sm mt16">بازگشت به برنامه هفتگی</Link>
     </div>
   )
 }
 if (!cls) {
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center', padding: 60 }}>
       <span className="muted small">در حال دریافت اطلاعات کلاس…</span>
     </div>
   )
 }

 const canEnter = cls.iAmIn || cls.isMine

 /* ---------- گیت خرید: فقط خریدار/ثبت‌نام‌شده وارد می‌شود ---------- */
 if (!canEnter) {
   const features = [
     'حضور در کلاس زنده با دوربین و صدای واقعی',
     'چت زنده و پرسش‌وپاسخ مستقیم با مدرس',
     'وایت‌برد مشترک و اشتراک صفحه مدرس',
     'ثبت خودکار حضور و غیاب شما',
   ]
   return (
     <div className="card pad" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
       <div className={`avatar ${cls.color || 'grad-0'}`} style={{ width: 84, height: 84, borderRadius: 24, fontSize: 34, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <Icon name="video" size={34} />
       </div>
       <h2 style={{ fontSize: 20 }}>{cls.title}</h2>
       <p className="muted small mt8">
         مدرس: {cls.teacher} • {DAYS[cls.day]} ساعت {cls.start} • {faNum(cls.dur)} دقیقه
       </p>
       <p className="muted small">{cls.desc}</p>

       <div className="card pad mt24" style={{ padding: 16, textAlign: 'right' }}>
         <b className="small">این کلاس شامل:</b>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
           {features.map((f) => (
             <span className="row g8 small" key={f}><Icon name="check" size={15} className="text-green" style={{ flexShrink: 0 }} /> {f}</span>
           ))}
         </div>
       </div>

       <div className="between wrap mt24 g12">
         <div>
           {cls.price ? (
             <div className="price-box" style={{ fontSize: 20 }}>{toman(cls.price)}</div>
           ) : <span className="badge b-green" style={{ fontSize: 15, padding: '6px 16px' }}>این کلاس رایگان است</span>}
         </div>
         <button className="btn btn-primary btn-lg" disabled={buying} onClick={buy}>
           {buying ? 'در حال پردازش…' : cls.price ? (<><CreditCard size={17} /> پرداخت و ثبت‌نام</>) : 'ثبت‌نام رایگان'}
         </button>
       </div>
       <p className="muted small mt16" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
         <ShieldCheck size={14} /> برای ورود به اتاق کلاس باید در آن ثبت‌نام کنید — پس از خرید، کلاس در برنامه هفتگی شما قرار می‌گیرد.
       </p>
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

     <div className={`avatar ${cls.color}`} style={{ width: 84, height: 84, borderRadius: 24, fontSize: 34, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
       <Icon name="video" size={34} />
     </div>
     <h2 style={{ fontSize: 20 }}>{cls.title}</h2>
     <p className="muted small mt8">
       مدرس: {cls.teacher} • {DAYS[cls.day]} ساعت {cls.start} • {faNum(cls.dur)} دقیقه
     </p>
     <p className="muted small">{cls.desc}</p>
     <div className="row g8 mt8" style={{ justifyContent: 'center' }}>
       <span className="badge b-teal"><Icon name="check" size={12} /> ثبت‌نام شده</span>
       <span className="badge b-sky"><Video size={12} /> دسترسی به اتاق کلاس</span>
     </div>

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
