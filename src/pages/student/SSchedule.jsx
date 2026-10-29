import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { seedSchedule } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'

/**
 * جدول هفتگی دانش‌آموز:
 * کلاس‌های پایه (seedSchedule) + کلاس‌هایی که مدرس/مدیر ساخته‌اند (customClasses) — لحظه‌ای همگام می‌شود.
 */
export default function SSchedule() {
 const { customClasses, user } = useApp()
 const nav = useNavigate()
 const todayIdx = 0 // شنبه به‌عنوان امروزِ دمو
 const all = [...seedSchedule.map((c) => ({ ...c, mine: true })),
 ...customClasses.filter((c) => c.audience !== 'teacher-only').map((c) => ({ ...c, mine: true }))]

 const cell = (day, slot) => all.find((c) => c.day === day && c.slot === slot)

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>جدول هفتگی {user?.name || 'شما'}</h2>
 <span className="muted small">کلاس‌های زنده ثبت‌شده — با کلیک وارد کلاس شوید</span>
 </div>
 <span className="badge b-teal"><Icon name="video" size={13} /> {faNum(all.length)} جلسه این هفته</span>
 </div>

 <div className="schedule-wrap">
 <div className="schedule">
 <div className="sch-head">ساعت</div>
 {DAYS.map((d, i) => (
 <div key={d} className={`sch-head ${i === todayIdx ? 'today' : ''}`}>
 {d}{i === todayIdx && <span className="muted small" style={{ display: 'block', fontSize: 10 }}>امروز</span>}
 </div>
 ))}
 {SLOTS.map((s, si) => (
 <div key={s} style={{ display: 'contents' }}>
 <div className={`sch-slot ${si === SLOTS.length - 1 ? 'sch-row-last' : ''}`}>{s}</div>
 {DAYS.map((d, di) => {
 const c = cell(di, si)
 return (
 <div key={`${di}-${si}`} className={`sch-cell ${si === SLOTS.length - 1 ? 'sch-row-last' : ''}`}>
 {c && (
 <div
 className={`class-block ${c.color || 'cb-teal'}`}
 onClick={() => (c.liveId || c.room ? nav(`/panel/student/live/${c.liveId || c.id}`) : null)}
 >
 <span>{c.title}</span>
 <span className="cb-teacher">{c.teacher}</span>
 {(c.liveId || c.room) && (
 <span className="cb-join"><Icon name="video" size={11} /> ورود به کلاس</span>
 )}
 </div>
 )}
 </div>
 )
 })}
 </div>
 ))}
 </div>
 </div>

 <div className="legend-dots">
 <span><i className="cb-teal" style={{ background: 'rgba(45,212,191,.5)' }} /> برنامه‌نویسی</span>
 <span><i className="cb-amber" style={{ background: 'rgba(251,191,36,.5)' }} /> ریاضی و کنکور</span>
 <span><i className="cb-sky" style={{ background: 'rgba(56,189,248,.5)' }} /> زبان</span>
 <span><i className="cb-violet" style={{ background: 'rgba(167,139,250,.5)' }} /> کسب‌وکار</span>
 <span><i className="cb-pink" style={{ background: 'rgba(244,114,182,.5)' }} /> طراحی</span>
 <span><i className="cb-green" style={{ background: 'rgba(52,211,153,.5)' }} /> خودخوان</span>
 </div>

 <div className="card pad mt24">
 <div className="row g12">
 <span className="sc-icon teal" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={19} /></span>
 <div>
 <b className="small">یادآوری خودکار</b>
 <p className="muted small">۳۰ دقیقه قبل از هر کلاس، پیامک و نوتیفیکیشن دریافت می‌کنید. زمان‌بندی کلاس‌ها توسط مدرس شما انجام می‌شود.</p>
 </div>
 </div>
 </div>
 </div>
 )
}
