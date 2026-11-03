import { Link } from 'react-router-dom'
import { useState } from 'react'
import Icon from './Icon'
import { Brand } from './ui'
import { site } from '../config/site'
import { useApp } from '../store/AppContext'
import { req } from '../services/http'
import { useSiteSettings, pick } from '../services/siteSettings'

export default function Footer() {
 const { toast } = useApp()
 /* [فیکس F16-d] اطلاعات تماس/حالت تعمیر از تنظیمات پنل ادمین — قبلاً فقط مقادیر ثابت باندل */
 const pub = useSiteSettings()
 /* [فیکس F31] خبرنامه به endpoint واقعی /api/newsletter وصل شد — قبلاً فقط
    توست موفقیت جعلی می‌زد و هیچ ثبت‌نشده‌ای در سرور رخ نمی‌داد */
 const [nlEmail, setNlEmail] = useState('')
 const [nlBusy, setNlBusy] = useState(false)

 const subscribe = async () => {
  if (nlBusy) return
  setNlBusy(true)
  try {
   const r = await req('/newsletter', { method: 'POST', body: { email: nlEmail } })
   toast(r.message || 'عضویت شما در خبرنامه ثبت شد')
   setNlEmail('')
  } catch (err) {
   toast(err.message || 'ثبت خبرنامه ناموفق بود — بعداً تلاش کنید', 'error')
  } finally {
   setNlBusy(false)
  }
 }
 return (
 <footer className="footer">
 <div className="container">
 <div className="footer-grid">
 <div>
 <Brand />
 <p className="about-txt">{site.desc}</p>
 <div className="socials">
 {site.socials.map((s) => (
 <button key={s.label} className="icon-btn" onClick={() => toast('این لینک در نسخه دمو فعال نیست', 'info')} aria-label={s.label}>
 <Icon name={s.icon} size={17} />
 </button>
 ))}
 </div>
 </div>
 <div>
 <h4>دسترسی سریع</h4>
 <div className="footer-links">
 <Link to="/courses">دوره‌های ضبط‌شده</Link>
 <Link to="/live">کلاس‌های آنلاین</Link>
 <Link to="/market">مدرس‌مارکت</Link>
 <Link to="/teachers">اساتید</Link>
 </div>
 </div>
 <div>
 <h4>پنل کاربری</h4>
 <div className="footer-links">
 <Link to="/auth">ورود / ثبت‌نام</Link>
 <Link to="/panel/student">پنل یادگیری من</Link>
 <Link to="/resume">درباره مدرس‌یار</Link>
 <Link to="/contact">فرصت‌های همکاری</Link>
 </div>
 </div>
 <div>
 <h4>خبرنامه مدرس‌یار</h4>
 <p className="about-txt">جدیدترین دوره‌ها و کدهای تخفیف را دریافت کنید.</p>
 <div className="newsletter">
 <input className="input" placeholder="ایمیل شما…" type="email" dir="ltr" value={nlEmail} onChange={(e) => setNlEmail(e.target.value)} />
 <button className="btn btn-primary btn-sm" onClick={subscribe} disabled={nlBusy}>{nlBusy ? '…' : 'عضویت'}</button>
 </div>
 </div>
 </div>
 <div className="footer-bottom">
 <span>© ۱۴۰۴ {pick(pub.site?.name, site.name)} — تمام حقوق محفوظ است.</span>
 <span className="muted small" style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
 {pub.maintenance && <span className="badge b-amber">حالت تعمیر و نگهداری فعال است</span>}
 {pick(pub.site?.phone, site.phone) && <span dir="ltr">{pick(pub.site?.phone, site.phone)}</span>}
 {pick(pub.site?.email, site.email) && <span dir="ltr">{pick(pub.site?.email, site.email)}</span>}
 </span>
 <span>ساخته‌شده با برای جامعه آموزشی ایران</span>
 </div>
 </div>
 </footer>
 )
}
