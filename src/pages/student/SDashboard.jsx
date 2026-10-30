import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import { DataIcon } from '../../utils/icons'
import { StatCard } from '../../components/PanelLayout'
import { Spark } from '../../components/Charts'
import { studyLogs, myCourses, courses, assignments, seedSchedule, liveClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, faDate, DAYS } from '../../utils/format'
import { useNow, nextOccurrence, splitDuration, todayIdx } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

export default function SDashboard() {
 const { user, liveSessions } = useApp()
 const now = useNow(1000)
 const tIdx = todayIdx()
 const [myLive, setMyLive] = useState(null) // کلاس‌های واقعی ثبت‌نام‌شده

 /* کلاس‌های زنده ثبت‌نام‌شده از سرور — در قطعی سرور همان دمو */
 useEffect(() => {
 let alive = true
 req('/me/classes').then((r) => {
 if (!alive) return
 setMyLive(r.classes.map((c) => ({
 id: c.id, liveId: c.id, title: c.title, day: c.day, start: c.start, dur: c.dur,
 teacher: c.teacherName || 'مدرس', color: c.color, desc: c.desc,
 })))
 }).catch(() => {})
 return () => { alive = false }
 }, [user?.id])

 const totalMin = studyLogs.reduce((a, d) => a + d.minutes, 0)
 const dueSoon = assignments.filter((a) => a.status === 'todo').slice(0, 3)

 // کلاس‌های امروز: از سرور (واقعی) یا دمو
 const scheduleSrc = myLive || seedSchedule
 const todayClasses = scheduleSrc
 .filter((c) => c.day === tIdx && c.liveId)
 .map((c) => ({ ...c, ...liveClasses.find((l) => l.id === c.liveId) }))
 .filter((c) => c.id)

 const liveNow = todayClasses.filter((c) => {
 const s = liveSessions[c.id]
 if (s?.startedAt && !s?.ended) return true
 const startsAt = nextOccurrence(c.day, c.start)
 const msLeft = startsAt.getTime() - now
 return msLeft <= 0 && msLeft > -(c.dur || 90) * 60_000
 })

 const next = todayClasses
 .map((c) => ({ ...c, startsAt: nextOccurrence(c.day, c.start) }))
 .filter((c) => c.startsAt.getTime() > now)
 .sort((a, b) => a.startsAt - b.startsAt)[0]
 const nextCd = next ? splitDuration(next.startsAt.getTime() - now) : null

 return (
 <div>
 {/* ---------- خوش‌آمد + وضعیت امروز ---------- */}
 <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(167,139,250,0.12))' }}>
 <div className="between wrap g16">
 <div>
 <h2 style={{ fontSize: 20 }}>سلام {user?.name || 'سارا'} عزیز</h2>
 <p className="muted small mt8">
 {liveNow.length > 0
 ? <>الان <b className="text-red">{faNum(liveNow.length)} کلاس زنده</b> داری — دیر نکن!</>
 : next
 ? <>کلاس بعدی‌ات «{next.title}» {DAYS[tIdx]} ساعت {next.start} است — {nextCd.h > 0 ? `${faNum(nextCd.h)} ساعت و ` : ''}{faNum(nextCd.m)} دقیقه دیگر.</>
 : <>امروز کلاس زنده نداری — روز خوبی برای پیشرفت در دوره‌هاست!</>}
 {' '}و {faNum(dueSoon.length)} تمرین سررسید نزدیک داری.
 </p>
 </div>
 <Link to="/panel/student/schedule" className="btn btn-primary">برنامه هفتگی من <Icon name="calendar" size={16} /></Link>
 </div>

 {/* ریل کلاس‌های امروز با وضعیت زنده */}
 {todayClasses.length > 0 && (
 <div className="row g12 mt24" style={{ flexWrap: 'wrap' }}>
 {todayClasses.map((c) => {
 const s = liveSessions[c.id]
 const startsAt = nextOccurrence(c.day, c.start)
 const msLeft = startsAt.getTime() - now
 const isLive = (s?.startedAt && !s?.ended) || (msLeft <= 0 && msLeft > -(c.dur || 90) * 60_000)
 return (
 <Link key={c.id} to={`/panel/student/live/${c.id}`} className="row g12" style={{
 padding: '10px 16px', borderRadius: 14, border: '1px solid var(--line2)', background: 'var(--card)',
 borderColor: isLive ? 'rgba(251,113,133,0.5)' : undefined, flex: '1 1 240px',
 }}>
 <span className={`avatar ${c.color}`} style={{ width: 38, height: 38, borderRadius: 11, fontSize: 16 }}>
 <Icon name="video" size={16} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <b className="small" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</b>
 <span className="muted" style={{ fontSize: 12 }}>ساعت {c.start} • {c.teacher}</span>
 </div>
 {isLive
 ? <span className="badge b-red live-pulse"><Radio size={11} /> زنده</span>
 : <span className="badge b-teal">{faNum(c.dur)}′</span>}
 </Link>
 )
 })}
 </div>
 )}
 </div>

 <div className="stat-cards">
 <StatCard icon="book" color="teal" label="دوره‌های در حال یادگیری" value={faNum(myCourses.filter((c) => c.progress < 100).length)} trend={12} />
 <StatCard icon="calendar" color="violet" label="کلاس زنده این هفته" value={faNum((myLive || seedSchedule).filter((c) => c.liveId).length)} trend={0} />
 <StatCard icon="clock" color="amber" label="مطالعه این ماه" value={`${faNum(Math.round(totalMin / 60))} ساعت`} trend={8}
 spark={<Spark points={studyLogs.map((d) => d.minutes)} color="#fbbf24" />} />
 <StatCard icon="check" color="green" label="میانگین نمره تمرین‌ها" value={`${faNum(19.2)}`} trend={3} />
 </div>

 <div className="chart-grid">
 {/* ادامه یادگیری */}
 <div className="card chart-card">
 <h3>ادامه یادگیری</h3>
 <div className="chart-sub">از همان جلسه قبلی ادامه بده</div>
 {myCourses.slice(0, 3).map((mc) => {
 const c = courses.find((x) => x.id === mc.courseId)
 return (
 <Link to={`/panel/student/player/${c.id}`} key={mc.courseId} className="row g12" style={{ padding: '12px 0', borderBottom: '1px solid var(--line2)' }}>
 <span className={`avatar ${c.color}`} style={{ width: 46, height: 46, borderRadius: 12, fontSize: 22 }}><DataIcon name={c.icon} size={22} /></span>
 <div style={{ flex: 1 }}>
 <b className="small">{c.title}</b>
 <div className="row g8 mt8">
 <div className="progress" style={{ flex: 1 }}><i style={{ width: `${mc.progress}%` }} /></div>
 <span className="muted small">{faNum(mc.progress)}٪</span>
 </div>
 <span className="muted small">آخرین درس: {mc.lastLesson} • {faDate(mc.lastSeen)}</span>
 </div>
 <button className="btn btn-soft btn-sm"><Icon name="play" size={14} /> ادامه</button>
 </Link>
 )
 })}
 </div>

 {/* کارهای نزدیک */}
 <div className="card chart-card">
 <h3>سررسیدهای نزدیک</h3>
 <div className="chart-sub">تمرین‌هایی که باید تحویل بدهی</div>
 <div className="feed">
 {dueSoon.map((a) => (
 <div className="feed-item" key={a.id}>
 <span className="fd-icon" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--red)' }}><Icon name="file" size={16} /></span>
 <div>
 <p><b>{a.title}</b></p>
 <span className="muted small">{a.course}</span>
 <div className="fd-time">مهلت: {faDate(a.due)}</div>
 </div>
 </div>
 ))}
 <Link to="/panel/student/assignments" className="btn btn-ghost btn-sm mt16 btn-block">همه تمرین‌ها</Link>
 </div>
 </div>
 </div>

 <div className="grids g3">
 {[
 { icon: 'calendar', t: 'برنامه هفتگی', d: 'کلاس‌های زنده با تایمر و یادآوری', to: '/panel/student/schedule', color: 'teal' },
 { icon: 'activity', t: 'میانگین مطالعه', d: 'نمودار دقیق روند مطالعه ۳۰ روز', to: '/panel/student/study', color: 'amber' },
 { icon: 'award', t: 'گواهی‌نامه‌ها', d: 'مدارک پایان دوره با کد رهگیری', to: '/panel/student/certificates', color: 'violet' },
 ].map((x) => (
 <Link key={x.t} to={x.to}>
 <div className="card pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
 <span className={`sc-icon ${x.color}`} style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <Icon name={x.icon} size={20} />
 </span>
 <div><b className="small">{x.t}</b><p className="muted small">{x.d}</p></div>
 <Icon name="chevronLeft" size={18} style={{ marginInlineStart: 'auto', color: 'var(--faint)' }} />
 </div>
 </Link>
 ))}
 </div>
 </div>
 )
}
