import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import Icon from '../../components/Icon'
import { DataIcon } from '../../utils/icons'
import { liveClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum, toman } from '../../utils/format'
import { useNow, fmtDuration } from '../../hooks/useClassStatus'
import { req } from '../../services/http'

/**
 * «کلاس‌های من» — کلاس‌های زنده‌ای که دانش‌آموز خریده/ثبت‌نام کرده است.
 * با کلیک روی هر کلاس، صفحه جزئیات کامل باز می‌شود:
 * جلسات پیش‌رو، جلسات برگزارشده (ضبط + فایل) و جزوه‌ها.
 */
export default function SMyClasses() {
 const { user, liveSessions } = useApp()
 const now = useNow(1000)
 const [rows, setRows] = useState([])
 const [loading, setLoading] = useState(true)
 const [serverOn, setServerOn] = useState(false)

 useEffect(() => {
 let alive = true
 req('/me/classes').then((r) => {
 if (!alive) return
 setServerOn(true)
 setRows(r.classes || [])
 setLoading(false)
 }).catch(() => {
 // سرور قطع — همان کلاس‌های دمو که سارا در آن‌ها ثبت‌نام است
 if (alive) { setRows(liveClasses.slice(0, 5).map((c) => ({ ...c, iAmIn: true }))); setLoading(false) }
 })
 return () => { alive = false }
 }, [user?.id])

 const liveCount = rows.filter((c) => {
 const s = liveSessions[c.id]
 return s?.startedAt && !s?.ended
 }).length

 if (loading) {
 return <div className="card pad" style={{ textAlign: 'center', padding: 50 }}><span className="muted small">در حال دریافت کلاس‌های شما…</span></div>
 }

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>کلاس‌های من</h2>
 <span className="muted small">
 {faNum(rows.length)} کلاس ثبت‌نام‌شده {serverOn ? '• روی سرور' : '• حالت دمو'} {liveCount > 0 ? `• ${faNum(liveCount)} کلاس زنده` : ''}
 </span>
 </div>
 </div>

 {rows.length === 0 ? (
 <div className="card pad" style={{ textAlign: 'center', padding: 50 }}>
 <div className="sc-icon teal" style={{ width: 60, height: 60, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
 <Icon name="video" size={26} />
 </div>
 <h3>هنوز در کلاسی ثبت‌نام نکرده‌اید</h3>
 <p className="muted small mt8">از صفحه «کلاس‌های آنلاین» کلاس مورد نظرتان را خریده و به جلسات زنده بپیوندید.</p>
 <Link to="/live" className="btn btn-primary btn-sm mt16">مشاهده کلاس‌های آنلاین</Link>
 </div>
 ) : (
 <div className="grids g2">
 {rows.map((c) => {
 const s = liveSessions[c.id]
 const live = s?.startedAt && !s?.ended
 const ended = !!s?.ended || c.status === 'ended'
 return (
 <div className="card pad" key={c.id} style={live ? { borderColor: 'rgba(251,113,133,0.5)' } : undefined}>
 <div className="row g12" style={{ alignItems: 'flex-start' }}>
 <span className={`avatar ${c.color || 'grad-0'}`} style={{ width: 52, height: 52, borderRadius: 14, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <DataIcon name={c.icon} size={24} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <b style={{ fontSize: 14.5, lineHeight: 1.7, display: 'block' }}>{c.title}</b>
 <div className="row g8 wrap mt8">
 <span className="badge b-gray"><Icon name="user" size={11} /> {c.teacherName || 'مدرس‌یار'}</span>
 <span className="badge b-gray">{DAYS[c.day]} • {c.start}</span>
 {live ? (
 <span className="badge b-red live-pulse" style={{ padding: '3px 10px' }}><Radio size={11} /> زنده — {fmtDuration(now - s.startedAt)}</span>
 ) : ended ? (
 <span className="badge b-gray">برگزار شد</span>
 ) : (
 <span className="badge b-teal">زمان‌بندی شده</span>
 )}
 </div>
 </div>
 </div>
 <div className="between wrap mt16 g8">
 {c.price > 0 ? <span className="muted small">{toman(c.price)}</span> : <span className="badge b-green">رایگان</span>}
 <div className="row g8">
 {live && (
 <Link to={`/panel/student/live/${c.id}`} className="btn btn-danger btn-sm">
 <Icon name="video" size={14} /> ورود به کلاس
 </Link>
 )}
 <Link to={`/panel/student/classes/${c.id}`} className="btn btn-primary btn-sm">
 <Icon name="eye" size={14} /> جزئیات کلاس
 </Link>
 </div>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
