import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { Play, AlertCircle } from 'lucide-react'
import Icon from '../components/Icon'
import Seo from '../components/Seo'
import { Brand, Logo } from '../components/ui'
import { ThemeToggle } from '../theme/ThemeProvider'
import { useApp } from '../store/AppContext'

/**
 * صفحه ورود و ثبت‌نام — تجربه ساده و متمرکز برای کاربر.
 * نقش کاربر صرفاً از مسیر مقصد (RouteGuard) تعیین می‌شود و در رابط نمایش داده نمی‌شود.
 */
export default function Auth() {
 const [params] = useSearchParams()
 const [mode, setMode] = useState('login') // login | register
 const { login, register } = useApp()
 const nav = useNavigate()
 const loc = useLocation()

 const [name, setName] = useState('')
 const [email, setEmail] = useState('')
 const [password, setPassword] = useState('')
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')

 // نقش فقط برای حالت آفلاین (fallback) از URL — در رابط نمایش داده نمی‌شود
 const fallbackRole = ['student', 'teacher', 'admin'].includes(params.get('role')) ? params.get('role') : 'student'
 const from = loc.state?.from

 useEffect(() => { document.title = 'ورود و ثبت‌نام | مدرس‌یار' }, [])

 const submit = async (e) => {
 e.preventDefault()
 if (busy) return
 setBusy(true); setError('')
 try {
 const r = mode === 'login'
 ? await login(email.trim(), password, fallbackRole)
 : await register(name.trim(), email.trim(), password)
 if (!r.ok) { setError(r.error || 'ورود ناموفق بود'); setBusy(false); return }
 const role = r.role || fallbackRole
 const target = from && from.startsWith(`/panel/${role}`) ? from : `/panel/${role}`
 nav(target, { replace: true })
 } catch {
 setError('خطای غیرمنتظره — دوباره تلاش کنید')
 setBusy(false)
 }
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
 <p className="muted" style={{ maxWidth: 430 }}>
 کلاس‌های زنده تعاملی، دوره‌های ضبط‌شده با دسترسی مادام‌العمر، برنامه هفتگی هوشمند
 و فروشگاه لوازم‌التحریر — همه یکجا.
 </p>
 <div className="grids g2 mt32" style={{ maxWidth: 460 }}>
 {[
 { icon: 'cap', t: 'کلاس‌های زنده', d: 'دوربین دوطرفه، چت و ضبط جلسات' },
 { icon: 'book', t: 'دوره‌های ضبط‌شده', d: 'دسترسی مادام‌العمر + آپدیت رایگان' },
 { icon: 'calendar', t: 'برنامه هوشمند', d: 'یادآوری کلاس‌ها با تایمر زنده' },
 { icon: 'box', t: 'مدرس‌مارکت', d: 'لوازم‌التحریر با ارسال سریع' },
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
 <div className="between" style={{ marginBottom: 30 }}>
 <b style={{ fontSize: 20 }}>{mode === 'login' ? 'ورود به حساب' : 'ساخت حساب جدید'}</b>
 <div className="row g8">
 <ThemeToggle />
 <Link to="/" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={15} /> سایت</Link>
 </div>
 </div>

 <form onSubmit={submit}>
 {error && (
 <div className="small mb16" style={{ background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.35)', color: 'var(--red, #f43f5e)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
 <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
 </div>
 )}
 {mode === 'register' && (
 <div className="field"><label>نام و نام خانوادگی</label><input className="input" required placeholder="نام کامل شما" value={name} onChange={(e) => setName(e.target.value)} /></div>
 )}
 <div className="field">
 <label>شماره موبایل یا ایمیل</label>
 <input className="input" required placeholder="you@example.com" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
 </div>
 <div className="field"><label>رمز عبور</label><input className="input" type="password" required minLength={6} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
 {mode === 'login' && (
 <div className="between small mb16">
 <label className="row g8 small" style={{ cursor: 'pointer' }}>
 <input type="checkbox" defaultChecked /> مرا به خاطر بسپار
 </label>
 <a href="#" className="text-teal" onClick={(e) => e.preventDefault()}>فراموشی رمز؟</a>
 </div>
 )}
 <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
 {busy ? 'لطفاً صبر کنید…' : (mode === 'login' ? 'ورود به حساب' : 'ثبت‌نام و شروع یادگیری')} {!busy && <Play size={16} />}
 </button>
 </form>

 <div className="demo-note mt24" style={{ marginBottom: 0 }}>
 <Icon name="sparkles" />
 حساب دمو: ایمیل <b dir="ltr">sara@demo.ir</b> و رمز <b dir="ltr">12345678</b> — داده‌ها واقعی روی سرور ذخیره می‌شوند.
 </div>

 <p className="muted small mt16" style={{ textAlign: 'center' }}>
 {mode === 'login' ? 'حساب ندارید؟' : 'قبلاً ثبت‌نام کرده‌اید؟'}{' '}
 <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login') }}>
 {mode === 'login' ? 'ثبت‌نام کنید' : 'وارد شوید'}
 </a>
 </p>

 <p className="muted small mt16" style={{ textAlign: 'center', opacity: 0.7 }}>
 با ورود، <Link to="/resume" className="text-teal">قوانین و شرایط</Link> مدرس‌یار را می‌پذیرید.
 </p>
 </div>
 </div>
 </div>
 )
}
