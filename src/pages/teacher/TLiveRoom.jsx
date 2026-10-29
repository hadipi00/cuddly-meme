import { useState } from 'react'
import Icon from '../../components/Icon'
import LiveRoom from '../../components/LiveRoom'
import { teacherClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum } from '../../utils/format'

export default function TLiveRoom() {
 const { toast } = useApp()
 const [active, setActive] = useState(null)
 const [preparing, setPreparing] = useState(false)

 if (active) return <LiveRoom variant="teacher" classInfo={active} />

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
 {teacherClasses.map((c) => (
 <div className="card pad" key={c.id}>
 <div className="between mb8">
 <b className="small">{c.title}</b>
 <span className="badge b-teal"><Icon name="users" size={12} /> {faNum(c.students)} نفر</span>
 </div>
 <div className="muted small mb16">{DAYS[c.day]} • ساعت {c.start} • {faNum(c.dur)} دقیقه</div>
 <div className="row g8">
 <button className="btn btn-primary btn-sm" onClick={() => setPreparing(true)}>
 <Icon name="video" size={15} /> آماده‌سازی و شروع
 </button>
 <button className="btn btn-ghost btn-sm" onClick={() => toast('پیامک دعوت به کلاس برای دانشجوها ارسال شد')}>
 <Icon name="send" size={15} /> دعوت دانشجوها
 </button>
 </div>
 </div>
 ))}
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

 // صفحه آماده‌سازی (چک تجهیزات)
 return (
 <div className="card pad" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
 <div className="sc-icon teal" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
 <Icon name="video" size={30} />
 </div>
 <h2 style={{ fontSize: 19, marginBottom: 6 }}>آماده‌سازی کلاس زنده</h2>
 <p className="muted small mb24">تجهیزات خود را بررسی کنید و سپس وارد کلاس شوید</p>
 <div style={{ textAlign: 'right' }}>
 {[
 ['میکروفون', ' متصل — کیفیت خوب'],
 ['دوربین', ' متصل — 720p'],
 ['اشتراک صفحه', ' مجاز'],
 ['سرعت اینترنت', ' عالی (۲۴ مگابیت)'],
 ].map(([k, v]) => (
 <div className="toggle-row" key={k}><b>{k}</b><span className="badge b-green">{v}</span></div>
 ))}
 </div>
 <div className="row g12 mt24" style={{ justifyContent: 'center' }}>
 <button className="btn btn-primary btn-lg" onClick={() => setActive(teacherClasses[0])}>
 <Icon name="play" filled size={17} /> ورود به کلاس زنده
 </button>
 <button className="btn btn-ghost" onClick={() => setPreparing(false)}>انصراف</button>
 </div>
 </div>
 )
}
