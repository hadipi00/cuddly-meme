import { useLocation, Link } from 'react-router-dom'
import { CheckCircle2, Truck, BookOpen, CalendarDays, Home } from 'lucide-react'
import Seo from '../components/Seo'
import { faNum, toman } from '../utils/format'

export default function OrderSuccess() {
  const { state } = useLocation()
  const code = state?.code || 'ORD-7900'
  const total = state?.total || 0
  const ship = state?.ship
  const today = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <section className="container section">
      <Seo title="ثبت سفارش" robots="noindex, nofollow" />
      <div className="card success-card">
        <div className="success-icon"><CheckCircle2 size={40} /></div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>پرداخت با موفقیت انجام شد</h1>
        <p className="muted">سفارش شما با کد پیگیری زیر ثبت شد. فاکتور به ایمیل شما ارسال گردید.</p>
        <div className="card mt24" style={{ padding: '16px 24px', display: 'inline-flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span className="muted small">کد پیگیری</span><b style={{ display: 'block', fontSize: 18 }} dir="ltr">{code}</b></div>
          {total > 0 && <div><span className="muted small">مبلغ</span><b style={{ display: 'block', fontSize: 18 }}>{toman(total)}</b></div>}
          {ship && (
            <div>
              <span className="muted small row g8"><Truck size={13} /> روش ارسال</span>
              <b style={{ display: 'block', fontSize: 15 }}>
                {ship.label}{ship.cost === 0 ? ' — رایگان' : ` (${toman(ship.cost)})`}
              </b>
            </div>
          )}
          <div><span className="muted small">تاریخ</span><b style={{ display: 'block', fontSize: 18 }}>{today}</b></div>
        </div>
        <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/panel/student/courses" className="btn btn-primary"><BookOpen size={16} /> رفتن به دوره‌های من</Link>
          <Link to="/panel/student/schedule" className="btn btn-ghost"><CalendarDays size={16} /> جدول هفتگی من</Link>
          <Link to="/market" className="btn btn-ghost"><Home size={16} /> بازگشت به فروشگاه</Link>
        </div>
        <p className="muted small mt24">
          برای دوره‌های ضبط‌شده، دسترسی فوری در پنل فعال می‌شود • برای کلاس‌های زنده، جلسات در جدول هفتگی شما قرار می‌گیرند.
        </p>
      </div>
    </section>
  )
}
