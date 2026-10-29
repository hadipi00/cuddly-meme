import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { Logo, Avatar } from './ui'
import { ThemeToggle } from '../theme/ThemeProvider'
import { useApp } from '../store/AppContext'
import Seo from '../components/Seo'
import { notifications } from '../data/mock'

/**
 * شِل مشترک هر سه پنل.
 * nav: [{ group, items: [{to, icon, label, pill}] }]
 */
export default function PanelLayout({ role, roleLabel, nav }) {
 const [open, setOpen] = useState(false) // سایدبار موبایل
 const [notiOpen, setNotiOpen] = useState(false)
 const { user, logout, toast } = useApp()
 const loc = useLocation()
 const nav2 = useNavigate()
 const me = user?.role === role ? user : null
 // دسترسی پنل‌ها توسط RouteGuard در App.jsx کنترل می‌شود
 const notis = notifications[role] || []
 const current = nav.flatMap((g) => g.items).find((i) => loc.pathname.startsWith(i.to))

 return (
 <div className="panel">
 {/* پنل‌ها خصوصی هستند و نباید در گوگل ایندکس شوند */}
 <Seo robots="noindex, nofollow" />
 <aside className={`p-sidebar ${open ? 'open' : ''}`}>
 <div className="p-brand">
 <Logo />
 <div>
 <b>مدرس‌یار</b>
 <span>پنل {roleLabel}</span>
 </div>
 </div>

 {nav.map((group) => (
 <div className="p-group" key={group.group}>
 <div className="p-group-title">{group.group}</div>
 {group.items.map((item) => (
 <NavLink
 key={item.to} to={item.to} end={item.to === `/panel/${role}` || item.end}
 className={() => (loc.pathname.startsWith(item.to) ? 'p-link active' : 'p-link')}
 onClick={() => setOpen(false)}
 >
 <Icon name={item.icon} />
 {item.label}
 {item.pill && <span className="pill">{item.pill}</span>}
 </NavLink>
 ))}
 </div>
 ))}

 <div className="p-foot">
 <button className="p-link" onClick={() => { nav2('/'); toast('به صفحه عمومی برگشتید', 'info') }}>
 <Icon name="home" /> مشاهده سایت
 </button>
 <button className="p-link" onClick={() => { logout(); nav2('/auth'); toast('از حساب خارج شدید', 'info') }}>
 <Icon name="logout" /> خروج از حساب
 </button>
 </div>
 </aside>
 {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

 <div className="p-main">
 <div className="p-topbar">
 <button className="icon-btn hamburger" onClick={() => setOpen(true)} aria-label="منو">
 <Icon name="menu" />
 </button>
 <div>
 <h1>{current?.label || 'پنل کاربری'}</h1>
 <span className="crumb">مدرس‌یار / پنل {roleLabel}</span>
 </div>
 <div className="p-topbar-actions">
 <ThemeToggle compact />
 <div className="noti-wrap">
 <button className="icon-btn" onClick={() => setNotiOpen((v) => !v)} aria-label="اعلان‌ها">
 <Icon name="bell" />
 <span className="bubble">{notis.length}</span>
 </button>
 {notiOpen && (
 <div className="noti-pop">
 <div className="np-head">اعلان‌ها</div>
 {notis.map((n, i) => (
 <div className="np-item" key={i}>
 <Icon name="bell" size={15} style={{ flexShrink: 0, marginTop: 4, color: 'var(--teal)' }} />
 <div><p>{n.text}</p><span className="fd-time">{n.time}</span></div>
 </div>
 ))}
 </div>
 )}
 </div>
 <div className="user-chip">
 <Avatar name={me?.name || ''} size={34} color="grad-0" />
 <div className="uc-txt">
 <span className="uc-name">{me?.name}</span>
 <span className="uc-role">{me?.roleLabel}</span>
 </div>
 </div>
 </div>
 </div>

 <main className="p-content" onClick={() => setNotiOpen(false)}>
 <Outlet />
 </main>
 </div>
 </div>
 )
}

export function StatCard({ icon, color = 'teal', label, value, trend, spark }) {
 return (
 <div className="card stat-card">
 <div className="sc-top">
 <span className={`sc-icon ${color}`}><Icon name={icon} /></span>
 {trend != null && (
 <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>
 <Icon name="arrowUp" size={13} style={trend < 0 ? { transform: 'rotate(180deg)' } : null} />
 {Math.abs(trend).toLocaleString('fa-IR')}٪
 </span>
 )}
 </div>
 <b className="sc-val">{value}</b>
 <span className="sc-label">{label}</span>
 {spark && <div style={{ marginTop: 6 }}>{spark}</div>}
 </div>
 )
}
