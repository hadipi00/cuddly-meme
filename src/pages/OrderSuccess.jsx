import { useLocation, Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { faNum, toman } from '../utils/format'

export default function OrderSuccess() {
  const { state } = useLocation()
  const code = state?.code || 'ORD-7900'
  const total = state?.total || 0
  return (
    <section className="container section">
      <div className="card success-card">
        <div className="success-icon"><Icon name="check" /></div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>پرداخت با موفقیت انجام شد 🎉</h1>
        <p className="muted">سفارش شما با کد پیگیری زیر ثبت شد. فاکتور به ایمیل شما ارسال گردید.</p>
        <div className="card mt24" style={{ padding: '16px 24px', display: 'inline-flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span className="muted small">کد پیگیری</span><b style={{ display: 'block', fontSize: 18 }} dir="ltr">{code}</b></div>
          {total > 0 && <div><span className="muted small">مبلغ</span><b style={{ display: 'block', fontSize: 18 }}>{toman(total)}</b></div>}
          <div><span className="muted small">تاریخ</span><b style={{ display: 'block', fontSize: 18 }}>۱۳ آذر ۱۴۰۴</b></div>
        </div>
        <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/panel/student/courses" className="btn btn-primary"><Icon name="book" /> رفتن به دوره‌های من</Link>
          <Link to="/panel/student/schedule" className="btn btn-ghost"><Icon name="calendar" /> جدول هفتگی من</Link>
          <Link to="/" className="btn btn-ghost">بازگشت به صفحه نخست</Link>
        </div>
        <p className="muted small mt24">
          برای دوره‌های ضبط‌شده، دسترسی فوری در پنل فعال می‌شود • برای کلاس‌های زنده، جلسات در جدول هفتگی شما قرار می‌گیرند.
        </p>
      </div>
    </section>
  )
}
