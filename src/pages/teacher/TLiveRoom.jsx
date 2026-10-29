import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import LiveRoom from '../../components/LiveRoom'
import { teacherClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum } from '../../utils/format'
import { useNow, fmtDuration } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

/**
 * برگزاری کلاس زنده — نمای مدرس.
 * با «ورود به کلاس زنده»، جلسه برای همه دانش‌آموزان آن کلاس به‌صورت زنده فعال می‌شود
 * (بج «در حال برگزاری» + تایمر + دکمه ورود در برنامه هفتگی و داشبورد آن‌ها ظاهر می‌شود).
 */
export default function TLiveRoom() {
 const { toast, liveSessions, endLive } = useApp()
 const [active, setActive] = useState(null)
 const [preparing, setPreparing] = useState(null) // کلاسی که در حال آماده‌سازی است
 const [myClasses, setMyClasses] = useState(teacherClasses) // fallback: دمو
 const now = useNow(1000)

 /* چک واقعی تجهیزات (getUserMedia) برای صفحه آماده‌سازی — بالای early-returnها */
 const [devCheck, setDevCheck] = useState(null) // {mic, cam} | 'denied'
 useEffect(() => {
   if (!preparing) return
   let stream
   setDevCheck(null)
   navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
     .then((s) => {
       stream = s
       setDevCheck({ mic: s.getAudioTracks().length > 0, cam: s.getVideoTracks().length > 0 })
     })
     .catch(() => setDevCheck('denied'))
   return () => stream?.getTracks().forEach((t) => t.stop())
 }, [preparing])

 /* کلاس‌های این مدرس از بک‌اند واقعی — در قطعی سرور همان دموی قبلی */
 useEffect(() => {
 let alive = true
 req('/me/teaching').then((r) => {
 if (!alive || !r.classes?.length) return
 setMyClasses(r.classes.map((c) => ({
 id: c.id, liveId: c.id, title: c.title, day: c.day, start: c.start,
 dur: c.dur, students: c.enrolled, room: c.room, desc: c.desc, icon: c.icon, color: c.color,
 })))
 }).catch(() => {})
 return () => { alive = false }
 }, [])

 if (active) return <LiveRoom variant="teacher" classInfo={active} />

 const isLive = (c) => {
 const s = liveSessions[c.liveId]
 return s?.startedAt && !s?.ended
 }

 if (!preparing) {
 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>برگزاری کلاس زنده</h2>
 <span className="muted small">یک کلاس را برای شروع انتخاب کنید — با دوربین، اشتراک صفحه و وایت‌برد</span>
 </div>
 </div>

 <div className="grids g2 mb24">
 {myClasses.map((c) => {
 const live = isLive(c)
 const elapsed = live ? now - liveSessions[c.liveId].startedAt : 0
 return (
 <div className="card pad" key={c.id} style={live ? { borderColor: 'rgba(251,113,133,0.5)' } : undefined}>
 <div className="between mb8">
 <b className="small">{c.title}</b>
 {live ? (
 <span className="badge b-red live-pulse" style={{ padding: '4px 12px' }}>
 <Radio size={12} /> زنده — {fmtDuration(elapsed)}
 </span>
 ) : (
 <span className="badge b-teal"><Icon name="users" size={12} /> {faNum(c.students)} نفر</span>
 )}
 </div>
 <div className="muted small mb16">{DAYS[c.day]} • ساعت {c.start} • {faNum(c.dur)} دقیقه</div>
 <div className="row g8">
 {live ? (
 <>
 <button className="btn btn-danger btn-sm" onClick={() => setActive(c)}>
 <Icon name="video" size={15} /> ادامه کلاس
 </button>
 <button className="btn btn-ghost btn-sm" onClick={() => { endLive(c.liveId); toast('کلاس پایان یافت — ضبط برای دانشجوها منتشر می‌شود', 'info') }}>
 پایان جلسه
 </button>
 </>
 ) : (
 <>
 <button className="btn btn-primary btn-sm" onClick={() => setPreparing(c)}>
 <Icon name="video" size={15} /> آماده‌سازی و شروع
 </button>
 <button className="btn btn-ghost btn-sm" onClick={() => toast('پیامک دعوت به کلاس برای دانشجوها ارسال شد')}>
 <Icon name="send" size={15} /> دعوت دانشجوها
 </button>
 </>
 )}
 </div>
 </div>
 )
 })}
 </div>

 <div className="card pad">
 <h3 className="mb16">امکانات سامانه کلاس زنده مدرس‌یار</h3>
 <div className="grids g3">
 {[
 { icon: 'camera', t: 'دوربین و میکروفون HD', d: 'تدریس چهره‌به‌چهره با کیفیت بالا' },
 { icon: 'monitor', t: 'اشتراک صفحه سیستم', d: 'نمایش کد، اسلاید یا هر برنامه دیگر' },
 { icon: 'board', t: 'وایت‌برد دیجیتال', d: 'نوشتن و رسم روی برد مشترک' },
 { icon: 'activity', t: 'ضبط خودکار کلاس', d: 'برای دانشجوهای غایب منتشر می‌شود' },
 { icon: 'chat', t: 'چت زنده و پرسش‌وپاسخ', d: 'دانشجوها همزمان سوال می‌پرسند' },
 { icon: 'hand', t: 'دست بلند کردن', d: 'مدیریت نوبت‌دهی صحبت دانشجوها' },
 ].map((x) => (
 <div className="row g12" key={x.t} style={{ alignItems: 'flex-start' }}>
 <span className="sc-icon violet" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <Icon name={x.icon} size={18} />
 </span>
 <div><b className="small">{x.t}</b><p className="muted small">{x.d}</p></div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )
 }

 // صفحه آماده‌سازی (چک واقعی تجهیزات با getUserMedia)
 const devBadge = (label, ok, pending) => (
   <div className="toggle-row" key={label}><b>{label}</b><span className={`badge ${pending ? 'b-gray' : ok ? 'b-green' : 'b-red'}`}>{pending ? 'در حال بررسی…' : ok ? '✓ آماده' : '✗ یافت نشد / دسترسی داده نشد'}</span></div>
 )

 return (
 <div className="card pad" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
 <div className="sc-icon teal" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
 <Icon name="video" size={30} />
 </div>
 <h2 style={{ fontSize: 19, marginBottom: 6 }}>آماده‌سازی کلاس زنده</h2>
 <p className="muted small mb24">{preparing.title} — تجهیزات خود را بررسی کنید و سپس کلاس را شروع کنید</p>
 <div style={{ textAlign: 'right' }}>
 {devBadge('میکروفون', devCheck?.mic, devCheck === null)}
 {devBadge('دوربین', devCheck?.cam, devCheck === null)}
 {devBadge('اشتراک صفحه', true, false)}
 </div>
 {devCheck === 'denied' && (
   <p className="muted small mt12" style={{ color: 'var(--red)' }}>
   دسترسی دوربین/میکروفون داده نشد — از تنظیمات مرورگر مجوز بدهید (می‌توانید بدون دوربین هم کلاس را برگزار کنید).
   </p>
 )}
 <p className="muted small mt16" style={{ background: 'var(--card)', border: '1px dashed var(--line)', borderRadius: 10, padding: '10px 14px' }}>
 با زدن دکمه زیر، جلسه برای {faNum(preparing.students)} دانشجوی این کلاس زنده می‌شود و دکمه ورود در پنل آن‌ها فعال خواهد شد.
 </p>
 <div className="row g12 mt24" style={{ justifyContent: 'center' }}>
 <button className="btn btn-primary btn-lg" onClick={() => setActive(preparing)}>
 <Icon name="play" filled size={17} /> شروع کلاس زنده
 </button>
 <button className="btn btn-ghost" onClick={() => setPreparing(null)}>انصراف</button>
 </div>
 </div>
 )
}
