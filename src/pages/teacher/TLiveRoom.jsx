import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import LiveRoom from '../../components/LiveRoom'
import LivePreJoin from '../../components/LivePreJoin'
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
 const { user, toast, liveSessions, endLive, startLive } = useApp()
 const [active, setActive] = useState(null)
 const [preparing, setPreparing] = useState(null) // کلاسی که در حال آماده‌سازی است
 const [devPrefs, setDevPrefs] = useState(null) // دستگاه‌های انتخابی در صفحهٔ پیش‌تست تجهیزات
 const [myClasses, setMyClasses] = useState(teacherClasses) // fallback: دمو
 const [loaded, setLoaded] = useState(false) // تا کلاس‌های واقعی از سرور نیامده، دمو شروع‌پذیر نیست
 const [authErr, setAuthErr] = useState(false) // [فیکس] خطای احراز هویت ≠ قطعی سرور
 const now = useNow(1000)

 /* کلاس‌های این مدرس از بک‌اند واقعی — [فیکس F8] لیست خالیِ «موفق» دیگر با دمو
    اشتباه گرفته نمی‌شود: پاسخ سرور اومده → همان خالی نمایش داده می‌شود («هنوز
    کلاسی نساخته‌اید»). دمو فقط وقتی می‌ماند که سرور در دسترس نباشد.
    [فیکس باگ «کلاس شروع نمیشود»] خطای 401/403 هرگز نباید به لیست دمو بریزد —
    قبلاً نشست مرده + fallback دمو باعث می‌شد مدرس کلاس‌های قلابی ببیند، دکمهٔ
    شروع با 401 شکست بخورد و گیت «هنوز روی سرور شروع نشده» همیشه بماند */
 useEffect(() => {
 let alive = true
 req('/me/teaching').then((r) => {
 if (!alive) return
 setLoaded(true)
 if (!r.classes) return
 setMyClasses(r.classes.map((c) => ({
 id: c.id, liveId: c.id, title: c.title, day: c.day, start: c.start,
 dur: c.dur, students: c.enrolled, room: c.room, desc: c.desc, icon: c.icon, color: c.color,
 })))
 }).catch((e) => {
 if (!alive) return
 setLoaded(true)
 if (e.serverDown) return // قطعی واقعی شبکه → دمو اشکالی ندارد
 if (e.status === 401 || e.status === 403) { setAuthErr(true); setMyClasses([]) }
 })
 return () => { alive = false }
 }, [])

 if (active) return <LiveRoom variant="teacher" classInfo={active} devPrefs={devPrefs} />

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

 {/* [فیکس] خطای دسترسی — پیام صریح به‌جای کلاس‌های دموی قلابی */}
 {authErr && (
 <div className="card pad mb24" style={{ textAlign: 'center', borderColor: 'rgba(248,113,113,0.5)' }}>
 <b style={{ color: 'var(--red)' }}>خطای دسترسی — نشست شما معتبر نیست</b>
 <p className="muted small mt8">احتمالاً نشست شما منقضی شده است. لطفاً با حساب مدرسِ همان کلاس دوباره وارد شوید.</p>
 <a href="/auth?role=teacher" className="btn btn-primary btn-sm mt16">ورود مجدد</a>
 </div>
 )}

 <div className="grids g2 mb24">
 {!loaded && (
 <div className="card pad" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
 <span className="muted small">در حال دریافت کلاس‌های شما از سرور…</span>
 </div>
 )}
 {loaded && !myClasses.length && !authErr && (
 <div className="card pad" style={{ textAlign: 'center', padding: 40 }}>
 <b>هنوز کلاسی نساخته‌اید</b>
 <p className="muted small mt8">از بخش «کلاس‌های من» یک کلاس هفتگی بسازید تا اینجا برای برگزاری زنده ظاهر شود.</p>
 </div>
 )}
 {loaded && myClasses.map((c) => {
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
 {/* [فیکس F3] دکمهٔ قلابی — قبلاً فقط توست موفقیت جعلی می‌زد */}
 <button className="btn btn-ghost btn-sm" disabled title="این قابلیت به‌زودی فعال می‌شود">
 <Icon name="send" size={15} /> دعوت دانشجوها (به‌زودی)
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

 // صفحهٔ آماده‌سازی — بررسی تجهیزات با پیش‌نمایش زنده (الگوی کاویمو)
 // پیش‌نمایش دوربین + نمایشگر صدای میکروفون + انتخاب دستگاه‌ها + ضبط خودکار
 return (
 <LivePreJoin
   role="teacher"
   classTitle={preparing.title}
   teacher={user?.name}
   onJoin={(p) => {
     /* [فیکس F38] با همین کلیک جلسه واقعاً روی سرور زنده می‌شود (POST /classes/:id/start) */
     startLive(preparing.liveId || preparing.id)
     setDevPrefs(p)
     setActive(preparing)
   }}
   onCancel={() => setPreparing(null)}
   onSkip={(p) => {
     startLive(preparing.liveId || preparing.id)
     setDevPrefs({ ...p, hasVideo: false, hasAudio: false })
     setActive(preparing)
   }}
 />
 )
}
