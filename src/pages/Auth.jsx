import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import Icon from '../components/Icon'
import Seo from '../components/Seo'
import OtpInput from '../components/OtpInput'
import { Brand, Logo } from '../components/ui'
import { ThemeToggle } from '../theme/ThemeProvider'
import { useApp } from '../store/AppContext'

/**
 * [مهاجرت CRM] صفحه احراز هویت مدرس‌یار — سه جریان شماره‌محور + ورود کلاسیک:
 *
 * ورود (دو روش):
 *   ۱) نام‌کاربری/ایمیل/موبایل + رمز — مرورگر با autocomplete رمز را در «مدیریت رمزها»
 *      ذخیره می‌کند تا دفعات بعد با یک کلیک پر شود
 *   ۲) شماره موبایل → کد پیامکی (اگر شماره ثبت‌نام شده باشد)
 *
 * ثبت‌نام (ویزارد سه‌مرحله‌ای):
 *   ۱) شماره موبایل  ۲) کد تأیید شیکِ شش‌خانه‌ای  ۳) نام + نام‌خانوادگی + نام‌کاربری + رمز
 *   (مرحلهٔ ۳ در یک <form> واقعی است → مرورگر نام‌کاربری و رمز را خودکار ذخیره می‌کند)
 *
 * بازیابی رمز: شماره → کد پیامکی → رمز جدید + ورود خودکار
 */
const REMEMBER_KEY = 'my_remember_id' // نام‌کاربری برای پرکردن خودکار — رمز هرگز ذخیره نمی‌شود
const normDigits = (s) => String(s || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
const isValidPhone = (s) => /^09\d{9}$/.test(normDigits(s).trim())
const faPhone = (s) => normDigits(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

const TITLES = {
 'login-password': 'ورود به حساب',
 'login-otp-phone': 'ورود با شماره موبایل',
 'login-otp-code': 'کد تأیید را وارد کنید',
 'register-phone': 'ساخت حساب جدید',
 'register-code': 'تأیید شماره موبایل',
 'register-profile': 'مشخصات حساب شما',
 'forgot-phone': 'بازیابی رمز عبور',
 'forgot-code': 'تأیید شماره موبایل',
 'forgot-new': 'انتخاب رمز جدید',
}

export default function Auth() {
 const [params] = useSearchParams()
 const { login, requestOtp, verifyOtpLogin, checkRegisterOtp, completeRegister, verifyResetOtp, resetPassword, user, toast } = useApp()
 const nav = useNavigate()
 const loc = useLocation()

 /* کاربرِ واردشده دیگر نباید به صفحه ورود برسد — هدایت به پنل خودش */
 useEffect(() => { if (user) nav(`/panel/${user.role}`, { replace: true }) }, [user])

 const initMode = ['register', 'forgot'].includes(params.get('mode')) ? params.get('mode')
   /* مسیرهای مستقیم /register و /forgot-password هم همین صفحه را باز می‌کنند */
   : loc.pathname === '/register' ? 'register'
   : loc.pathname === '/forgot-password' ? 'forgot'
   : 'login'
 const [mode, setMode] = useState(initMode)
 const [step, setStep] = useState(1) // ۱..۳ برای ویزاردها؛ ورود با رمز = مرحلهٔ ۱
 const [loginMethod, setLoginMethod] = useState('password') // password | otp

 /* فیلدهای مشترک */
 const [phone, setPhone] = useState('')
 const [devCode, setDevCode] = useState('') // فقط حالت دمو (بدون پنل پیامک)
 const [regToken, setRegToken] = useState('')
 const [resetToken, setResetToken] = useState('')
 const [otpKey, setOtpKey] = useState(0) // برای ریست کادر کد بعد از خطا/ارسال مجدد
 const [resendIn, setResendIn] = useState(0)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [okMsg, setOkMsg] = useState('')

 /* فیلدهای ورود با رمز */
 const [id, setId] = useState(() => { try { return localStorage.getItem(REMEMBER_KEY) || '' } catch { return '' } })
 const [password, setPassword] = useState('')
 const [remember, setRemember] = useState(() => { try { return !!localStorage.getItem(REMEMBER_KEY) } catch { return false } })

 /* فیلدهای ثبت‌نام مرحلهٔ ۳ */
 const [firstName, setFirstName] = useState('')
 const [lastName, setLastName] = useState('')
 const [username, setUsername] = useState('')
 const [newPw, setNewPw] = useState('')
 const [newPw2, setNewPw2] = useState('')

 // نقش فقط برای حالت آفلاین (fallback) از URL — در رابط نمایش داده نمی‌شود
 const fallbackRole = ['student', 'teacher', 'admin'].includes(params.get('role')) ? params.get('role') : 'student'
 const from = loc.state?.from

 useEffect(() => {
   const titleKey = mode === 'login'
     ? (loginMethod === 'otp' ? (step >= 2 ? 'login-otp-code' : 'login-otp-phone') : 'login-password')
     : `${mode}-${step === 1 ? 'phone' : step === 2 ? 'code' : mode === 'register' ? 'profile' : 'new'}`
   document.title = `${TITLES[titleKey] || 'ورود و ثبت‌نام'} | مدرس‌یار`
 }, [mode, loginMethod, step])

 /* شمارش معکوس ارسال مجدد کد */
 useEffect(() => {
   if (resendIn <= 0) return
   const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
   return () => clearInterval(t)
 }, [resendIn])

 const finish = (role) => {
   const target = from && from.startsWith(`/panel/${role}`) ? from : `/panel/${role}`
   nav(target, { replace: true })
 }

 const resetFlow = (m, stepN = 1) => {
   setMode(m); setStep(stepN); setError(''); setOkMsg(''); setDevCode(''); setBusy(false); setOtpKey((k) => k + 1)
 }

 /* ---------- ارسال کد تأیید (ورود / ثبت‌نام / بازیابی) ---------- */
 const sendCode = async (purpose) => {
   if (busy) return
   if (!isValidPhone(phone)) { setError('شماره موبایل معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return }
   setBusy(true); setError('')
   const r = await requestOtp(normDigits(phone).trim(), purpose)
   setBusy(false)
   if (!r.ok) {
     setError(r.error || 'ارسال کد ناموفق بود')
     if (r.wait) setResendIn(r.wait)
     /* [فیکس F39] چک ثبت‌نام «قبل از ارسال کد» — درخواست کاربر:
        • ورود با شمارهٔ ثبت‌نام‌نشده → نه پیامکی می‌رود نه کدی ساخته می‌شود؛
          خودکار به جریان ثبت‌نام می‌رویم (شماره حفظ می‌شود).
        • ثبت‌نام با شمارهٔ قبلاً ثبت‌شده → خودکار به ورود پیامکی با ارسال کد. */
     if (r.notRegistered && purpose !== 'register') {
       toast('این شماره ثبت‌نام نشده — ثبت‌نام را ادامه دهید', 'info')
       setMode('register'); setStep(1)
     } else if (r.alreadyRegistered && purpose === 'register') {
       toast('این شماره قبلاً ثبت شده — کد ورود برایتان ارسال شد', 'info')
       setMode('login'); setLoginMethod('otp')
       sendCode('login')
     }
     return
   }
   setDevCode(r.devCode || '')
   setOtpKey((k) => k + 1)
   setResendIn(60)
   setOkMsg(r.sent ? '' : 'حالت آزمایشی پیامک — کد را همین‌جا می‌بینید')
   setStep(2)
 }

 const resendCode = () => {
   if (resendIn > 0) return
   const purpose = mode === 'login' ? 'login' : mode === 'register' ? 'register' : 'reset'
   sendCode(purpose)
 }

 /* ---------- ورود با کد پیامکی ---------- */
 const onLoginCode = async (code) => {
   setError(''); setBusy(true)
   const r = await verifyOtpLogin(normDigits(phone).trim(), code)
   setBusy(false)
   if (!r.ok) {
     setOtpKey((k) => k + 1)
     setError(r.error || 'کد نامعتبر است')
     if (r.notRegistered) setOkMsg('با این شماره هنوز حساب نساخته‌اید — همین شماره را در ثبت‌نام بدهید')
     return
   }
   finish(r.role || fallbackRole)
 }

 /* ---------- ثبت‌نام: تأیید کد → مرحلهٔ مشخصات ---------- */
 const onRegisterCode = async (code) => {
   setError(''); setBusy(true)
   const r = await checkRegisterOtp(normDigits(phone).trim(), code)
   setBusy(false)
   if (!r.ok) {
     setOtpKey((k) => k + 1)
     setError(r.error || 'کد نامعتبر است')
     /* شماره‌ای که ثبت‌نام‌شده است → بدون دردسر به جریان ورود پیامکی می‌رویم */
     if (r.alreadyRegistered) {
       setMode('login'); setLoginMethod('otp'); setStep(2)
       toast('این شماره قبلاً ثبت شده — کد ورود برایتان ارسال شد')
       sendCode('login')
     }
     return
   }
   setRegToken(r.regToken)
   setStep(3)
 }

 /* ---------- ثبت‌نام: ساخت حساب (فرم واقعی → مرورگر رمز را ذخیره می‌کند) ---------- */
 const submitProfile = async (e) => {
   e.preventDefault()
   if (busy) return
   if (!firstName.trim() || !lastName.trim()) { setError('نام و نام خانوادگی را کامل وارد کنید'); return }
   const un = username.trim().toLowerCase()
   if (!/^[a-z0-9_.]{3,30}$/.test(un)) { setError('نام کاربری فقط حروف انگلیسی، عدد، نقطه و زیرخط — بین ۳ تا ۳۰ کاراکتر'); return }
   if (newPw.length < 6) { setError('رمز عبور باید حداقل ۶ کاراکتر باشد'); return }
   if (newPw !== newPw2) { setError('تکرار رمز عبور با رمز یکسان نیست'); return }
   setBusy(true); setError('')
   const r = await completeRegister({ regToken, firstName: firstName.trim(), lastName: lastName.trim(), username: un, password: newPw })
   setBusy(false)
   if (!r.ok) { setError(r.error || 'ساخت حساب ناموفق بود'); return }
   finish(r.role || 'student')
 }

 /* ---------- ورود با رمز ---------- */
 const submitPassword = async (e) => {
   e.preventDefault()
   if (busy) return
   const v = id.trim()
   const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
   const isPhone = isValidPhone(v)
   const isUser = /^[a-z0-9_.]{3,30}$/.test(v.toLowerCase())
   if (!v || (!isEmail && !isPhone && !isUser)) {
     setError('نام کاربری، ایمیل یا شماره موبایل معتبر وارد کنید')
     return
   }
   if (!password) { setError('رمز عبور را وارد کنید'); return }
   /* [ذخیرهٔ اعتبارنامه] نام‌کاربری برای پرکردن خودکار بعدی ذخیره می‌شود (رمز هرگز!) */
   try { if (remember && v) localStorage.setItem(REMEMBER_KEY, v); else localStorage.removeItem(REMEMBER_KEY) } catch { /* ignore */ }
   setBusy(true); setError('')
   const r = await login(v, password, fallbackRole)
   if (!r.ok) { setError(r.error || 'ورود ناموفق بود'); setBusy(false); return }
   finish(r.role || fallbackRole)
 }

 /* ---------- بازیابی رمز ---------- */
 const onForgotCode = async (code) => {
   setError(''); setBusy(true)
   const r = await verifyResetOtp(normDigits(phone).trim(), code)
   setBusy(false)
   if (!r.ok) {
     setOtpKey((k) => k + 1)
     setError(r.error || 'کد نامعتبر است')
     if (r.notRegistered) setError('کاربری با این شماره پیدا نشد — ابتدا حساب بسازید')
     return
   }
   setResetToken(r.resetToken)
   setStep(3)
 }

 const submitNewPassword = async (e) => {
   e.preventDefault()
   if (busy) return
   if (newPw.length < 6) { setError('رمز عبور باید حداقل ۶ کاراکتر باشد'); return }
   if (newPw !== newPw2) { setError('تکرار رمز عبور با رمز یکسان نیست'); return }
   if (newPw === '12345678') { setError('این رمز عمومی دمو است — رمز دیگری انتخاب کنید'); return }
   setBusy(true); setError('')
   const r = await resetPassword(resetToken, newPw)
   setBusy(false)
   if (!r.ok) { setError(r.error || 'تغییر رمز ناموفق بود'); return }
   finish(r.role || 'student')
 }

 /* ---------- اجزای رابط ---------- */
 const ErrBox = ({ children }) => (
   <div className="small mb16" style={{ background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.35)', color: 'var(--red, #f43f5e)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
     <AlertCircle size={16} style={{ flexShrink: 0 }} /> {children}
   </div>
 )
 const OkBox = ({ children }) => (
   <div className="small mb16" style={{ background: 'rgba(45,212,191,.09)', border: '1px solid rgba(45,212,191,.35)', color: 'var(--teal)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
     <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {children}
   </div>
 )

 const backBtn = null // (رزرو — دکمه‌های بازگشت داخل هر مرحله ساخته می‌شوند)

 /* --- کد پیامکی مشترک بین سه جریان --- */
 const otpStep = (onComplete, purpose) => (
 <>
   {devCode && <div className="devcode-note">حالت آزمایشی پیامک — کد شما: <b dir="ltr">{devCode}</b></div>}
   <p className="muted small" style={{ textAlign: 'center' }}>
     کد ۶رقمی به شماره <b dir="ltr">{faPhone(phone)}</b> ارسال شد {purpose === 'login' ? '— این شماره قبلاً ثبت‌نام کرده' : ''}
   </p>
   <OtpInput key={otpKey} onComplete={onComplete} disabled={busy} autoFocus error={error} />
   <div className="otp-hint">کد را که وارد کنید به‌صورت خودکار تأیید می‌شود — نیازی به دکمه نیست</div>
   {error && <ErrBox>{error}</ErrBox>}
   <div className="between" style={{ marginTop: 6 }}>
     <button type="button" className="btn btn-ghost btn-sm" onClick={() => { resetFlow(mode === 'login' ? 'login' : mode, 1) }}>
       <Icon name="chevronRight" size={15} /> اصلاح شماره
     </button>
     <button type="button" className="btn btn-ghost btn-sm" disabled={resendIn > 0 || busy} onClick={resendCode}>
       {resendIn > 0 ? `ارسال مجدد کد (${faNum(resendIn)})` : 'ارسال مجدد کد'}
     </button>
   </div>
 </>
 )

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
 { icon: 'phone', t: 'ورود سریع با پیامک', d: 'فقط شماره موبایل و یک کد ۶رقمی' },
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
 <div className="between" style={{ marginBottom: 26 }}>
 <b style={{ fontSize: 20 }}>{TITLES[mode === 'login' ? (loginMethod === 'otp' ? (step >= 2 ? 'login-otp-code' : 'login-otp-phone') : 'login-password') : `${mode}-${step === 1 ? 'phone' : step === 2 ? 'code' : mode === 'register' ? 'profile' : 'new'}`]}</b>
 <div className="row g8">
 <ThemeToggle />
 <Link to="/" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={15} /> سایت</Link>
 </div>
 </div>

 {mode === 'login' && (
 <>
   {step === 1 && loginMethod === 'password' && (
   <form onSubmit={submitPassword}>
     {error && <ErrBox>{error}</ErrBox>}
     <div className="method-tabs">
       <button type="button" className="method-tab on"><Icon name="lock" size={16} /> ورود با رمز</button>
       <button type="button" className="method-tab" onClick={() => { setLoginMethod('otp'); setError('') }}><Icon name="phone" size={16} /> کد پیامکی</button>
     </div>
     <div className="field">
       <label>نام کاربری، ایمیل یا شماره موبایل</label>
       <input className="input" required placeholder="نام کاربری یا 09…" autoComplete="username" dir="ltr" value={id} onChange={(e) => setId(e.target.value)} />
     </div>
     <div className="field">
       <label>رمز عبور</label>
       <input className="input" type="password" required placeholder="••••••••" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
     </div>
     <div className="between small mb16">
       <label className="row g8 small" style={{ cursor: 'pointer' }}>
         <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> مرا به خاطر بسپار
       </label>
       {/* [فیکس F31 → CRM] فراموشی رمز دیگر لینک مرده نیست — جریان واقعی بازیابی با کد پیامکی */}
       <a href="#" className="text-teal" onClick={(e) => { e.preventDefault(); resetFlow('forgot') }}>فراموشی رمز؟</a>
     </div>
     <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
       {busy ? 'لطفاً صبر کنید…' : 'ورود به حساب'} {!busy && <Play size={16} />}
     </button>
     <p className="muted small mt16" style={{ textAlign: 'center' }}>
       حساب ندارید؟ <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); resetFlow('register') }}>ثبت‌نام با شماره موبایل</a>
     </p>
   </form>
   )}

   {step === 1 && loginMethod === 'otp' && (
   <>
     <div className="method-tabs">
       <button type="button" className="method-tab" onClick={() => { setLoginMethod('password'); setError('') }}><Icon name="lock" size={16} /> ورود با رمز</button>
       <button type="button" className="method-tab on"><Icon name="phone" size={16} /> کد پیامکی</button>
     </div>
     {error && <ErrBox>{error}</ErrBox>}
     <form onSubmit={(e) => { e.preventDefault(); sendCode('login') }}>
       <div className="field">
         <label>شماره موبایل (قبلاً ثبت‌نام کرده)</label>
         <input className="input" required placeholder="09xxxxxxxxx" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
       </div>
       <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
         {busy ? 'در حال ارسال…' : 'دریافت کد تأیید'} {!busy && <Icon name="send" size={16} />}
       </button>
     </form>
     <p className="muted small mt16" style={{ textAlign: 'center' }}>
       با این شماره حساب نساخته‌اید؟ <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); setPhone(phone); resetFlow('register') }}>ثبت‌نام کنید</a>
     </p>
   </>
   )}

   {step === 2 && loginMethod === 'otp' && otpStep(onLoginCode, 'login')}
 </>
 )}

 {mode === 'register' && (
 <>
   <div className="step-dots">
     {[1, 2, 3].map((n) => <div key={n} className={`step-dot${step === n || (step > n) ? ' on' : ''}`} />)}
   </div>
   {step === 1 && (
   <>
     {error && <ErrBox>{error}</ErrBox>}
     <p className="muted small mb16" style={{ textAlign: 'center' }}>فقط شماره موبایل لازم است — بقیهٔ مشخصات بعد از تأیید کد از شما می‌پرسیم</p>
     <form onSubmit={(e) => { e.preventDefault(); sendCode('register') }}>
       <div className="field">
         <label>شماره موبایل</label>
         <input className="input" required placeholder="09xxxxxxxxx" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
       </div>
       <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
         {busy ? 'در حال ارسال…' : 'ادامه — دریافت کد'} {!busy && <Icon name="chevronLeft" size={16} />}
       </button>
     </form>
     <p className="muted small mt16" style={{ textAlign: 'center' }}>
       قبلاً ثبت‌نام کرده‌اید؟ <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); resetFlow('login') }}>وارد شوید</a>
     </p>
   </>
   )}
   {step === 2 && otpStep(onRegisterCode, 'register')}
   {step === 3 && (
   /* [ذخیرهٔ اعتبارنامه] فرم واقعی + autocomplete → مرورگر نام‌کاربری و رمز را
      در «مدیریت رمزها» ذخیره می‌کند تا ورودهای بعدی با یک کلیک پر شوند */
   <form onSubmit={submitProfile}>
     {error && <ErrBox>{error}</ErrBox>}
     {okMsg && <OkBox>{okMsg}</OkBox>}
     <div className="grids g2" style={{ gap: 12 }}>
       <div className="field">
         <label>نام</label>
         <input className="input" required placeholder="مثلاً سارا" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
       </div>
       <div className="field">
         <label>نام خانوادگی</label>
         <input className="input" required placeholder="مثلاً محمدی" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
       </div>
     </div>
     <div className="field">
       <label>نام کاربری (برای ورود با رمز)</label>
       <input className="input" required placeholder="sara_m" autoComplete="username" dir="ltr" minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} />
       <span className="muted small">حروف انگلیسی، عدد، نقطه یا زیرخط — ۳ تا ۳۰ کاراکتر</span>
     </div>
     <div className="field">
       <label>رمز عبور</label>
       <input className="input" type="password" required minLength={6} placeholder="حداقل ۶ کاراکتر" autoComplete="new-password" dir="ltr" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
     </div>
     <div className="field">
       <label>تکرار رمز عبور</label>
       <input className="input" type="password" required minLength={6} placeholder="همان رمز بالا" autoComplete="new-password" dir="ltr" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
     </div>
     <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
       {busy ? 'در حال ساخت حساب…' : 'ساخت حساب و شروع یادگیری'} {!busy && <Play size={16} />}
     </button>
   </form>
   )}
 </>
 )}

 {mode === 'forgot' && (
 <>
   <div className="step-dots">
     {[1, 2, 3].map((n) => <div key={n} className={`step-dot${step >= n ? ' on' : ''}`} />)}
   </div>
   {step === 1 && (
   <>
     {error && <ErrBox>{error}</ErrBox>}
     <p className="muted small mb16" style={{ textAlign: 'center' }}>شماره‌ای که با آن ثبت‌نام کرده‌اید را بدهید — کد تأیید برایتان می‌فرستیم</p>
     <form onSubmit={(e) => { e.preventDefault(); sendCode('reset') }}>
       <div className="field">
         <label>شماره موبایل</label>
         <input className="input" required placeholder="09xxxxxxxxx" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
       </div>
       <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
         {busy ? 'در حال ارسال…' : 'دریافت کد تأیید'} {!busy && <Icon name="send" size={16} />}
       </button>
     </form>
     <p className="muted small mt16" style={{ textAlign: 'center' }}>
       رمز را به یاد آوردید؟ <a href="#" className="text-teal bold" onClick={(e) => { e.preventDefault(); resetFlow('login') }}>وارد شوید</a>
     </p>
   </>
   )}
   {step === 2 && otpStep(onForgotCode, 'reset')}
   {step === 3 && (
   <form onSubmit={submitNewPassword}>
     {error && <ErrBox>{error}</ErrBox>}
     {okMsg && <OkBox>{okMsg}</OkBox>}
     <div className="field">
       <label>رمز جدید</label>
       <input className="input" type="password" required minLength={6} placeholder="حداقل ۶ کاراکتر" autoComplete="new-password" dir="ltr" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
     </div>
     <div className="field">
       <label>تکرار رمز جدید</label>
       <input className="input" type="password" required minLength={6} placeholder="همان رمز بالا" autoComplete="new-password" dir="ltr" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
     </div>
     <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
       {busy ? 'در حال تغییر رمز…' : 'ذخیره رمز و ورود'} {!busy && <CheckCircle2 size={16} />}
     </button>
   </form>
   )}
 </>
 )}

 <div className="demo-note mt24" style={{ marginBottom: 0 }}>
 <Icon name="sparkles" />
 حساب دمو: نام‌کاربری <b dir="ltr">sara</b> و رمز <b dir="ltr">12345678</b> — یا ورود پیامکی با شماره <b dir="ltr">09120000002</b>
 </div>

 <p className="muted small mt16" style={{ textAlign: 'center', opacity: 0.7 }}>
 با ورود، <Link to="/resume" className="text-teal">قوانین و شرایط</Link> مدرس‌یار را می‌پذیرید.
 </p>
 </div>
 </div>
 </div>
 )
}
