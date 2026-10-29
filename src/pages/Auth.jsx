import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import Icon from '../components/Icon'
import Seo from '../components/Seo'
import { Brand } from '../components/ui'
import { useApp } from '../store/AppContext'

const roles = [
 { key: 'student', label: 'دانش‌آموز', icon: 'cap', panel: '/panel/student' },
 { key: 'teacher', label: 'مدرس', icon: 'video', panel: '/panel/teacher' },
 { key: 'admin', label: 'مدیریت', icon: 'shield', panel: '/panel/admin' },
]

export default function Auth() {
 const [params] = useSearchParams()
 const [role, setRole] = useState(params.get('role') || 'student')
 const [mode, setMode] = useState('login') // login | register
 const { login } = useApp()
 const nav = useNavigate()
 const loc = useLocation()

 // اگر RouteGuard کاربر را برای ورود به پنل فرستاده، بعد از ورود به همان مسیر برمی‌گردیم
 const from = loc.state?.from

 useEffect(() => {
 if (params.get('role')) setRole(params.get('role'))
 }, [params])

 const active = roles.find((r) => r.key === role)
 const isTeacher = role === 'teacher'

 const submit = (e) => {
 e.preventDefault()
 login(role)
 // فقط اگر مسیر ذخیره‌شده متعلق به همین نقش باشد، به آن برمی‌گردیم
 const target = from && from.startsWith(`/panel/${role}`) ? from : active.panel
 nav(target)
 }

 return (
 <div className="auth-wrap">
 <Seo title="ورود و ثبت‌نام" robots="noindex, nofollow" />
 {/* سمت بصری */}
 <div className="auth-visual">
 <div style={{ position: 'relative', zIndex: 1 }}>
 <Brand />
 <h1 style={{ fontSize: 'clamp(26px,3vw,40px)', margin: '30px 0 14px', lineHeight: 1.5 }}>
 یادگیری حرفه‌ای،<br />از <span className="text-teal">مدرس‌یار</span> شروع می‌شود
 </h1>
 <p className="muted" style={{ maxWidth: 420 }}>
 کلاس‌های زنده تعاملی، دوره‌های ضبط‌شده با دسترسی مادام‌العمر، جدول هفتگی هوشمند
 و فروشگاه لوازم‌التحریر — همه یکجا.
 </p>
 <div className="grids g2 mt32" style={{ maxWidth: 460 }}>
 {[
 { icon: 'cap', t: 'پنل دانش‌آموز', d: 'جدول هفتگی، دوره‌ها، آمار مطالعه' },
 { icon: 'video', t: 'پنل مدرس', d: 'برگزاری کلاس زنده، تکالیف، درآمد' },
 { icon: 'shield', t: 'پنل مدیریت', d: 'کنترل کامل سایت و فروشگاه' },
 { icon: 'box', t: 'مدرس‌مارکت', d: 'خرید لوازم‌التحریر آموزشی' },
 ].map((x) => (
 <div className="card pad" key={x.t} style={{ padding: 16 }}>
 <Icon name={x.icon} size={22} className="text-teal" />
 <b className="small" style={{ display: 'block', marginTop: 8 }}>{x.t}</b>
 <span className="muted small">{x.d}</span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* سمت فرم */}
 <div className="auth-form-side">
 <div className="auth-card">
 <div className="between mb24" style={{ marginBottom: 30 }}>
 <b style={{ fontSize: 20 }}>{mode === 'login' ? 'ورود به حساب' : 'ساخت حساب جدید'}</b>
 <Link to="/" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={15} /> سایت</Link>
 </div>

 <div className="role-tabs">
 {roles.map((r) => (
 <button key={r.key} className={`role-tab ${role === r.key ? 'on' : ''}`} onClick={() => setRole(r.key)}>
 <Icon name={r.icon} /> {r.label}
 </button>
 ))}
 </div>

 {isTeacher && (
 <div className="demo-note">
 <Icon name="shield" />
 اکانت‌های مدرسان فقط توسط مدیریت ساخته می‌شود. اگر مدرس هستید، نام کاربری دریافتی از پشتیبانی را وارد کنید.
 </div>
 )}

 <form onSubmit={submit}>
 {mode === 'register' && !isTeacher && (
 <div className="field"><label>نام و نام خانوادگی</label><input className="input" required placeholder="نام کامل شما" /></div>
 )}
 {mode === 'register' && (
 <div className="field"><label>شماره موبایل</label><input className="input" required placeholder="۰۹۱۲…" /></div>
 )}
 <div className="field">
 <label>{isTeacher ? 'نام کاربری / کد مدرس' : 'شماره موبایل یا ایمیل'}</label>
 <input className="input" required placeholder={isTeacher ? 'teacher-code' : 'you@example.com'} />
 </div>
 <div className="field"><label>رمز عبور</label><input className="input" type="password" required placeholder="••••••••" /></div>
 {mode === 'login' && (
 <div className="between small mb16">
 <label className="row g8 small" style={{ cursor: 'pointer' }}>
 <input type="checkbox" defaultChecked style={{ accentColor: '#2dd4bf' }} /> مرا به خاطر بسپار
 </label>
 <a href="#" className="text-teal" onClick={(e) => e.preventDefault()}>فراموشی رمز؟</a>
 </div>
 )}
 <button className="btn btn-primary btn-block btn-lg">
 {mode === 'login' ? `ورود به پنل ${active.label}` : 'ثبت‌نام و شروع'} <Icon name="chevronLeft" size={17} />
 </button>
 </form>

 <div className="demo-note mt24" style={{ marginBottom: 0 }}>
 <Icon name="sparkles" />
 نسخه دمو: با هر اطلاعات دلخواه وارد شوید — پنل {active.label} نمایش داده می‌شود.
 </div>

 <p className="muted small mt16" style={{ textAlign: 'center' }}>
 {mode === 'login' ? 'حساب ندارید؟' : 'قبلاً ثبت‌نام کرده‌اید؟'}{' '}
 <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login') }}>
 {mode === 'login' ? 'ثبت‌نام کنید' : 'وارد شوید'}
 </a>
 </p>
 </div>
 </div>
 </div>
 )
}
