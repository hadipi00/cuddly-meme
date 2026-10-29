import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing, Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import { seedSchedule, liveClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'
import {
 useNow, nextOccurrence, splitDuration, todayIdx, STATUS_LABEL,
} from '../../hooks/useClassStatus'

/* ============================================================
   برنامه هفتگی دانش‌آموز — نسخه بازطراحی‌شده (بدون جدول)
   ------------------------------------------------------------
   ۱) کارت «کلاس بعدی» با شمارش معکوس بزرگ و دکمه ورود هوشمند
   ۲) ریل «کلاس‌های امروز» با تایمر زنده و بج وضعیت
   ۳) برنامه هفته به‌صورت آکاردئون روزانه — موبایل‌دوست، بدون اسکرول افقی
   وضعیت زنده از عمل واقعی مدرس (شروع/پایان کلاس) گرفته می‌شود.
   ============================================================ */

/** ساعت شروع یک جلسه از ایندکس اسلات (ارقام فارسی SLOTS → برای نمایش) */
const slotTime = (slot) => SLOTS[slot] || '—'

export default function SSchedule() {
 const { customClasses, user, toast, liveSessions } = useApp()
 const nav = useNavigate()
 const now = useNow(1000)
 const tIdx = todayIdx()
 const [openDays, setOpenDays] = useState(() => new Set([todayIdx()]))

 // همه جلسات من: پایه + کلاس‌های ساخته‌شده توسط مدرس/مدیر
 const all = useMemo(() => ([
 ...seedSchedule.map((c) => ({ ...c, mine: true })),
 ...customClasses.filter((c) => c.audience !== 'teacher-only').map((c) => ({ ...c, mine: true })),
 ]), [customClasses])

 // اتصال به دیتای کلاس زنده (ساعت/مدت/مدرس)
 const withMeta = useMemo(() => all.map((c) => {
 const live = liveClasses.find((l) => l.id === c.liveId)
 return {
 ...c,
 start: live?.start || slotTime(c.slot),
 dur: live?.dur || 90,
 desc: live?.desc,
 teacher: live?.teacher || c.teacher,
 href: c.liveId ? `/panel/student/live/${c.liveId}` : null,
 }
 }), [all])

 // مرتب‌سازی جلسات هر روز بر اساس زمان شروع
 const byDay = useMemo(() => {
 const map = Array.from({ length: 7 }, () => [])
 withMeta.forEach((c) => map[c.day]?.push(c))
 map.forEach((list) => list.sort((a, b) => (a.start || '').localeCompare(b.start || '', 'en')))
 return map
 }, [withMeta])

 // کلاس‌های در حال برگزاری الان (مدرس شروع کرده) — مهم‌ترین اطلاع برای دانش‌آموز
 const liveNow = useMemo(() => withMeta.filter((c) => {
 const s = liveSessions[c.liveId]
 return s?.startedAt && !s?.ended
 }), [withMeta, liveSessions])

 // جلسات امروز + کلاس بعدی سراسری (به‌جز کلاس‌های زنده فعلی)
 const todayList = byDay[tIdx]
 const upcomingAll = useMemo(() => withMeta
 .filter((c) => c.href && !(liveSessions[c.liveId]?.startedAt && !liveSessions[c.liveId]?.ended))
 .map((c) => ({ ...c, startsAt: nextOccurrence(c.day, c.start) }))
 .sort((a, b) => a.startsAt - b.startsAt), [withMeta, liveSessions])
 const nextCls = upcomingAll[0]
 const nextInfo = nextCls ? splitDuration(nextCls.startsAt.getTime() - now) : null

 const toggleDay = (d) => setOpenDays((prev) => {
 const n = new Set(prev)
 n.has(d) ? n.delete(d) : n.add(d)
 return n
 })

 return (
 <div>
 {/* ---------- بنر کلاس در حال برگزاری (مدرس شروع کرده) ---------- */}
 {liveNow.map((c) => {
 const s = liveSessions[c.liveId]
 const el = Math.max(0, now - s.startedAt)
 return (
 <div key={'live-' + c.liveId} className="card pad mb24" style={{
 background: 'linear-gradient(135deg, rgba(251,113,133,0.16), rgba(251,191,36,0.08))',
 borderColor: 'rgba(251,113,133,0.55)',
 }}>
 <div className="between wrap g16">
 <div className="row g12" style={{ flexWrap: 'wrap' }}>
 <span className="badge b-red live-pulse" style={{ padding: '6px 14px', fontSize: 13 }}>
 <Radio size={13} /> در حال برگزاری
 </span>
 <div>
 <h2 style={{ fontSize: 18 }}>{c.title}</h2>
 <p className="muted small">{c.teacher} — کلاس شروع شده؛ همین حالا وارد شوید!</p>
 </div>
 </div>
 <div className="row g12 wrap">
 <span className="live-timer" style={{ position: 'static', fontSize: 16, padding: '8px 16px' }} dir="ltr">
 {String(Math.floor(el / 3600000)).padStart(2, '0')}:{String(Math.floor((el % 3600000) / 60000)).padStart(2, '0')}:{String(Math.floor((el % 60000) / 1000)).padStart(2, '0')}
 </span>
 <button className="btn btn-danger btn-lg" onClick={() => nav(`/panel/student/live/${c.liveId}`)}>
 <Icon name="video" size={17} /> ورود به کلاس زنده
 </button>
 </div>
 </div>
 </div>
 )
 })}

 {/* ---------- کارت کلاس بعدی ---------- */}
 {nextCls && (
 <div className="card pad mb24" style={{
 background: 'linear-gradient(135deg, rgba(45,212,191,0.14), rgba(167,139,250,0.12))',
 borderColor: 'rgba(45,212,191,0.35)',
 }}>
 <div className="between wrap g16">
 <div style={{ minWidth: 220 }}>
 <span className="kicker"><Icon name="zap" size={13} /> کلاس بعدی شما</span>
 <h2 style={{ fontSize: 19, margin: '4px 0 6px' }}>{nextCls.title}</h2>
 <p className="muted small">
 {DAYS[nextCls.day]} • ساعت {nextCls.start} • {faNum(nextCls.dur)} دقیقه • مدرس: {nextCls.teacher}
 </p>
 </div>
 <div className="row g16 wrap">
 <div className="countdown-box">
 {nextInfo.d > 0 && <span className="cd-cell"><b>{faNum(nextInfo.d)}</b><span>روز</span></span>}
 <span className="cd-cell"><b dir="ltr">{String(nextInfo.h).padStart(2, '0')}</b><span>ساعت</span></span>
 <span className="cd-cell"><b dir="ltr">{String(nextInfo.m).padStart(2, '0')}</b><span>دقیقه</span></span>
 <span className="cd-cell"><b dir="ltr">{String(nextInfo.s).padStart(2, '0')}</b><span>ثانیه</span></span>
 </div>
 <button className="btn btn-primary btn-lg" onClick={() => nav(nextCls.href)}>
 <Icon name="video" size={17} /> ورود به اتاق کلاس
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ---------- کلاس‌های امروز ---------- */}
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}>کلاس‌های امروز — {DAYS[tIdx]}</h2>
 <span className="muted small">وضعیت زنده، تایمر و دکمه ورود — همه یکجا</span>
 </div>
 <span className="badge b-teal"><Icon name="calendar" size={13} /> {faNum(all.length)} جلسه این هفته</span>
 </div>

 {todayList.length === 0 ? (
 <div className="card pad" style={{ textAlign: 'center', padding: 44 }}>
 <Icon name="calendar" size={40} className="text-teal" style={{ opacity: 0.5, margin: '0 auto 12px' }} />
 <b>امروز کلاس زنده نداری</b>
 <p className="muted small mt8">وقت خوبی برای پیشرفت در دوره‌های ضبط‌شده‌ات است!</p>
 <Link to="/panel/student/courses" className="btn btn-soft btn-sm mt16">ادامه دوره‌ها</Link>
 </div>
 ) : (
 <div className="grids g2 mb24">
 {todayList.map((c) => <TodayClassCard key={c.liveId || c.title} cls={c} now={now} onNotify={() => toast('یادآوری ۱۵ دقیقه قبل از شروع کلاس فعال شد')} />)}
 </div>
 )}

 {/* ---------- برنامه هفته (آکاردئون روزها — بدون جدول) ---------- */}
 <div className="between wrap mb16" style={{ marginTop: 34 }}>
 <div>
 <h2 style={{ fontSize: 17 }}>برنامه کامل هفته</h2>
 <span className="muted small">روی هر روز بزنید تا کلاس‌های آن باز شود</span>
 </div>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 {DAYS.map((dayName, d) => {
 const list = byDay[d]
 const isOpen = openDays.has(d)
 const isToday = d === tIdx
 return (
 <div key={d} className="card" style={{
 overflow: 'hidden',
 borderColor: isToday ? 'rgba(45,212,191,0.45)' : undefined,
 background: isToday ? 'linear-gradient(135deg, rgba(45,212,191,0.07), transparent 60%)' : undefined,
 }}>
 <button
 className="between"
 style={{ width: '100%', padding: '15px 20px', textAlign: 'right', gap: 12 }}
 onClick={() => toggleDay(d)}
 aria-expanded={isOpen}
 >
 <span className="row g12" style={{ flexWrap: 'wrap' }}>
 <b style={{ fontSize: 15, color: isToday ? 'var(--teal)' : undefined }}>{dayName}</b>
 {isToday && <span className="badge b-teal">امروز</span>}
 {list.length > 0 && <span className="muted small">{faNum(list.length)} جلسه</span>}
 {/* خلاصه کوچک جلسات روز */}
 {!isOpen && list.slice(0, 2).map((c) => (
 <span key={c.liveId || c.title} className="muted small" style={{ opacity: 0.75 }}>• {c.title}</span>
 ))}
 {list.length > 2 && !isOpen && <span className="muted small">…</span>}
 </span>
 <Icon name="chevronDown" size={17} className={isOpen ? '' : ''} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.25s', color: 'var(--faint)' }} />
 </button>

 {isOpen && (
 <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
 {list.length === 0 ? (
 <p className="muted small" style={{ padding: '8px 8px 4px' }}>این روز جلسه‌ای ثبت نشده است.</p>
 ) : list.map((c) => <WeekClassRow key={c.liveId || c.title} cls={c} now={now} />)}
 </div>
 )}
 </div>
 )
 })}
 </div>

 <div className="card pad mt24">
 <div className="row g12">
 <span className="sc-icon teal" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={19} /></span>
 <div>
 <b className="small">یادآوری خودکار</b>
 <p className="muted small">۱۵ دقیقه قبل از هر کلاس نوتیفیکیشن دریافت می‌کنید؛ به محض اینکه مدرس کلاس را شروع کند، بج «در حال برگزاری» و دکمه ورود همین‌جا فعال می‌شود.</p>
 </div>
 </div>
 </div>
 </div>
 )
}

/* ---------- کارت کلاس امروز — با تایمر زنده ---------- */
function TodayClassCard({ cls, now, onNotify }) {
 const nav = useNavigate()
 const { liveSessions } = useApp()
 const session = cls.liveId ? liveSessions[cls.liveId] : null
 const startsAt = nextOccurrence(cls.day, cls.start)
 const msLeft = startsAt.getTime() - now
 const durMs = (cls.dur || 90) * 60_000

 const live = (session?.startedAt && !session?.ended) || (msLeft <= 0 && msLeft > -durMs)
 const past = msLeft <= -durMs || session?.ended
 const elapsed = session?.startedAt && !session?.ended ? now - session.startedAt : Math.abs(Math.min(0, msLeft))
 const cd = splitDuration(Math.max(0, msLeft))

 return (
 <div className="card pad" style={{
 display: 'flex', flexDirection: 'column', gap: 10,
 borderColor: live ? 'rgba(251,113,133,0.5)' : undefined,
 background: live ? 'linear-gradient(135deg, rgba(251,113,133,0.07), transparent 55%)' : undefined,
 }}>
 <div className="between" style={{ alignItems: 'flex-start' }}>
 <div>
 <b style={{ fontSize: 15.5 }}>{cls.title}</b>
 <p className="muted small mt8">ساعت {cls.start} • {faNum(cls.dur)} دقیقه • {cls.teacher}</p>
 </div>
 {live ? (
 <span className="badge b-red live-pulse" style={{ padding: '5px 12px' }}>
 <Radio size={12} /> در حال برگزاری
 </span>
 ) : past ? (
 <span className="badge b-gray">برگزار شد</span>
 ) : (
 <span className="badge b-teal">شروع تا {cd.d > 0 ? `${faNum(cd.d)} روز و ` : ''}{cd.h > 0 ? `${faNum(cd.h)} ساعت و ` : ''}{faNum(cd.m)} دقیقه دیگر</span>
 )}
 </div>

 {live ? (
 <div className="between wrap g12">
 <span className="live-timer" style={{ position: 'static', fontSize: 17, padding: '8px 16px' }} dir="ltr">
 {String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
 </span>
 {cls.href && (
 <button className="btn btn-danger" onClick={() => nav(cls.href)}>
 <Icon name="video" size={16} /> ورود به کلاس
 </button>
 )}
 </div>
 ) : past ? (
 <div className="row g8">
 {cls.href && <span className="badge b-sky"><Icon name="video" size={12} /> ضبط جلسه منتشر شد</span>}
 {cls.href && <button className="btn btn-ghost btn-sm" onClick={() => nav(cls.href)}>مشاهده ضبط</button>}
 </div>
 ) : (
 <div className="between wrap g12">
 <div className="countdown-box">
 {cd.d > 0 ? (
 <span className="badge b-violet" style={{ padding: '8px 14px' }}>{faNum(cd.d)} روز و {faNum(cd.h)} ساعت دیگر — ساعت {cls.start}</span>
 ) : (
 <>
 <span className="cd-cell" style={{ minWidth: 52 }}><b dir="ltr">{String(cd.h).padStart(2, '0')}</b><span>ساعت</span></span>
 <span className="cd-cell" style={{ minWidth: 52 }}><b dir="ltr">{String(cd.m).padStart(2, '0')}</b><span>دقیقه</span></span>
 <span className="cd-cell" style={{ minWidth: 52 }}><b dir="ltr">{String(cd.s).padStart(2, '0')}</b><span>ثانیه</span></span>
 </>
 )}
 </div>
 {cls.href
 ? <button className="btn btn-ghost btn-sm" onClick={() => nav(cls.href)}><Icon name="eye" size={15} /> اتاق انتظار</button>
 : <button className="btn btn-ghost btn-sm" onClick={onNotify}><BellRing size={15} /> یادآوری</button>}
 </div>
 )}
 </div>
 )
}

/* ---------- ردیف کلاس در برنامه هفته ---------- */
function WeekClassRow({ cls, now }) {
 const nav = useNavigate()
 const { liveSessions } = useApp()
 const session = cls.liveId ? liveSessions[cls.liveId] : null
 const startsAt = nextOccurrence(cls.day, cls.start)
 const msLeft = startsAt.getTime() - now
 const durMs = (cls.dur || 90) * 60_000
 const live = (session?.startedAt && !session?.ended) || (msLeft <= 0 && msLeft > -durMs)
 const past = msLeft <= -durMs || session?.ended

 return (
 <div className="row g12" style={{
 padding: '12px 14px', borderRadius: 14, flexWrap: 'wrap',
 border: '1px solid var(--line2)', background: 'var(--card)',
 borderColor: live ? 'rgba(251,113,133,0.45)' : undefined,
 }}>
 <span className={`avatar ${cls.color || 'cb-teal'}`} style={{ width: 40, height: 40, borderRadius: 12, fontSize: 15 }}>
 <Icon name={cls.liveId ? 'video' : 'book'} size={17} />
 </span>
 <div style={{ flex: 1, minWidth: 150 }}>
 <b className="small">{cls.title}</b>
 <div className="muted small" style={{ fontSize: 12 }}>
 ساعت {cls.start} • {faNum(cls.dur)} دقیقه {cls.teacher && cls.teacher !== '—' ? `• ${cls.teacher}` : ''}
 </div>
 </div>
 {live ? (
 <span className="badge b-red live-pulse" style={{ padding: '4px 11px' }}>
 <Radio size={11} /> زنده
 </span>
 ) : past ? (
 <span className="badge b-gray">تمام شد</span>
 ) : (
 <span className={`badge ${msLeft < 30 * 60_000 ? 'b-amber' : 'b-gray'}`}>{STATUS_LABEL.upcoming}</span>
 )}
 {cls.liveId && (
 <button className={`btn btn-sm ${live ? 'btn-danger' : 'btn-soft'}`} onClick={() => nav(`/panel/student/live/${cls.liveId}`)}>
 <Icon name={live ? 'video' : 'eye'} size={14} /> {live ? 'ورود' : 'مشاهده'}
 </button>
 )}
 </div>
 )
}
