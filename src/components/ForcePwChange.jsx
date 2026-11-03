import { useState } from 'react'
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/AppContext'

/**
 * [فیکس B26-UI] گیت اجباری تغییر رمز اولین ورود —
 * اکانت‌های دمو با رمز عمومی («12345678») متولد می‌شوند؛ تا کاربر رمز خودش را
 * نگذاشته، کل اپ زیر این پرده قفل است (هیچ مسیری دور آن نیست — حتی تغییر URL).
 * برای کاربران عادی (پرچم = false) هیچ‌وقت رندر نمی‌شود.
 */
export default function ForcePwChange() {
 const { user, changePassword, logout } = useApp()
 const [current, setCurrent] = useState('')
 const [next, setNext] = useState('')
 const [confirm, setConfirm] = useState('')
 const [show, setShow] = useState(false)
 const [busy, setBusy] = useState(false)
 const [err, setErr] = useState('')

 if (!user || !user.mustChangePassword) return null

 const submit = async (e) => {
 e.preventDefault()
 setErr('')
 if (next.length < 6) { setErr('رمز جدید باید حداقل ۶ کاراکتر باشد'); return }
 if (next !== confirm) { setErr('تکرار رمز جدید مطابقت ندارد'); return }
 if (next === current) { setErr('رمز جدید نباید همان رمز فعلی باشد'); return }
 setBusy(true)
 const r = await changePassword(current, next)
 setBusy(false)
 if (!r.ok) setErr(r.error || 'تغییر رمز ناموفق بود')
 }

 return (
 <div className="force-pw-overlay" role="dialog" aria-modal="true" aria-label="تغییر اجباری رمز عبور">
 <form className="force-pw-card" onSubmit={submit}>
 <span className="force-pw-icon"><KeyRound size={26} /></span>
 <h2>تغییر رمز عبور الزامی است</h2>
 <p className="muted" style={{ lineHeight: 1.9 }}>
 سلام {user.name}! حساب شما با یک رمز عمومی اولیه ساخته شده است.
 برای ادامه و امنیت حساب، همین حالا یک رمز شخصی و مطمئن انتخاب کنید.
 </p>

 <label className="field" style={{ textAlign: 'start' }}>
 <span style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>رمز عبور فعلی</span>
 <div style={{ position: 'relative' }}>
 <input
 className="input"
 type={show ? 'text' : 'password'}
 dir="ltr"
 value={current}
 onChange={(e) => setCurrent(e.target.value)}
 autoComplete="current-password"
 required
 />
 <button type="button" className="icon-btn" style={{ position: 'absolute', insetInlineEnd: 8, top: 6 }}
 onClick={() => setShow((s) => !s)} aria-label="نمایش رمز">
 {show ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 </label>

 <label className="field" style={{ textAlign: 'start' }}>
 <span style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>رمز جدید (حداقل ۶ کاراکتر)</span>
 <input className="input" type="password" dir="ltr" value={next}
 onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={6} />
 </label>

 <label className="field" style={{ textAlign: 'start' }}>
 <span style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>تکرار رمز جدید</span>
 <input className="input" type="password" dir="ltr" value={confirm}
 onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={6} />
 </label>

 {err && <div className="badge b-red" style={{ alignSelf: 'stretch', justifyContent: 'center' }}>{err}</div>}

 <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
 <ShieldCheck size={16} /> {busy ? 'در حال ذخیره…' : 'ثبت رمز جدید و ادامه'}
 </button>
 <button type="button" className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>
 خروج از حساب
 </button>
 </form>
 </div>
 )
}
