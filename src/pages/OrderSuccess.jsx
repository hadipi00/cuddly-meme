import { useEffect } from 'react'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Truck, BookOpen, CalendarDays, Home, RefreshCw } from 'lucide-react'
import Seo from '../components/Seo'
import { useApp } from '../store/AppContext'
import { toman } from '../utils/format'

/* دلیل‌های شکست بازگشت از درگاه — کدهای callback سرور (/api/pay/zarinpal/callback) */
const FAIL_REASONS = {
  canceled: 'پرداخت در درگاه لغو شد یا ناموفق بود. اگر مبلغی کسر شده باشد، حداکثر تا ۷۲ ساعت به‌صورت خودکار برمی‌گردد.',
  verify: 'تأیید پرداخت نزد درگاه انجام نشد. اگر مبلغی کسر شده باشد، حداکثر تا ۷۲ ساعت برمی‌گردد.',
  expired: 'مهلت این پرداخت منقضی شده است — لطفاً دوباره تلاش کنید.',
  unknown: 'اطلاعات بازگشت از درگاه معتبر نیست.',
}

export default function OrderSuccess() {
  const { state } = useLocation()
  const [sp] = useSearchParams()
  const { clearCart, user } = useApp()
  const today = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })

  /* خواندن نتیجه از کوئری بازگشت درگاه (status/code/ref/total) یا state قدیمی مسیر مستقیم */
  const qStatus = sp.get('status')
  const code = sp.get('code') || state?.code || ''
  const ref = sp.get('ref') || ''
  const total = Number(sp.get('total') ?? state?.total ?? 0) || 0
  const ship = state?.ship
  const failed = qStatus === 'failed'
  const ok = qStatus === 'ok' || (!qStatus && !!code)
  /* [فیکس F31] وضعیتِ ناشناختهٔ بازگشت دیگر «پرداخت موفق» رندر نمی‌شود */
  const unknownStatus = !!code && !failed && !ok

  /* سبد خرید فقط بعد از تأیید موفق بازگشت از درگاه خالی می‌شود
     (تا اگر پرداخت ناموفق بود، کاربر سبد را از دست ندهد و دوباره تلاش کند) */
  useEffect(() => {
    if (qStatus === 'ok') clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ورود مستقیم به این صفحه بدون سفارش — «پرداخت موفق» جعلی نشان نمی‌دهیم */
  if (!code) {
    return (
      <section className="container section">
        <Seo title="ثبت سفارش" robots="noindex, nofollow" />
        <div className="card success-card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>سفارشی برای نمایش پیدا نشد</h1>
          <p className="muted">اگر تازه خریدی انجام داده‌اید، از همان صفحه سفارش به اینجا هدایت شده‌اید؛ در غیر این صورت می‌توانید از فروشگاه شروع کنید.</p>
          <div className="row g8 mt24" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/market" className="btn btn-primary">مدرس‌مارکت</Link>
            <Link to="/courses" className="btn btn-ghost">دوره‌های آموزشی</Link>
            <Link to="/" className="btn btn-ghost">صفحه نخست</Link>
          </div>
        </div>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="container section">
        <Seo title="نتیجه پرداخت" robots="noindex, nofollow" />
        <div className="card success-card" style={{ textAlign: 'center' }}>
          <div className="success-icon" style={{ background: 'var(--red-soft, #fee2e2)', color: '#dc2626' }}><XCircle size={40} /></div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>پرداخت انجام نشد</h1>
          <p className="muted" style={{ maxWidth: 480, margin: '0 auto', lineHeight: 2 }}>
            {FAIL_REASONS[sp.get('reason')] || 'پرداخت با موفقیت به پایان نرسید.'}
          </p>
          {code && (
            <p className="muted small mt16">کد پیگیری سفارش: <b dir="ltr">{code}</b></p>
          )}
          <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/checkout" className="btn btn-primary"><RefreshCw size={15} /> تلاش دوباره</Link>
            <Link to="/courses" className="btn btn-ghost"><Home size={15} /> بازگشت به فروشگاه</Link>
          </div>
        </div>
      </section>
    )
  }

  if (unknownStatus) {
    return (
      <section className="container section">
        <Seo title="نتیجه پرداخت" robots="noindex, nofollow" />
        <div className="card success-card" style={{ textAlign: 'center' }}>
          <div className="success-icon" style={{ background: '#fef3c7', color: '#d97706' }}><RefreshCw size={40} /></div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>وضعیت پرداخت نامشخص است</h1>
          <p className="muted" style={{ maxWidth: 480, margin: '0 auto', lineHeight: 2 }}>
            نتیجهٔ تأیید این پرداخت هنوز به‌صورت قطعی ثبت نشده. وضعیت سفارش را در «سفارش‌های من» پیگیری کنید؛
            اگر مبلغ کسر شده باشد و سفارش ثبت نشده باشد، مبلغ به‌صورت خودکار برمی‌گردد.
          </p>
          <p className="muted small mt16">کد پیگیری سفارش: <b dir="ltr">{code}</b></p>
          <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={user?.role === 'teacher' ? '/panel/teacher/earnings' : '/panel/student/orders'} className="btn btn-primary">سفارش‌های من</Link>
            <Link to="/contact" className="btn btn-ghost">تماس با پشتیبانی</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="container section">
      <Seo title="ثبت سفارش" robots="noindex, nofollow" />
      <div className="card success-card">
        <div className="success-icon"><CheckCircle2 size={40} /></div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>پرداخت با موفقیت انجام شد</h1>
        <p className="muted">سفارش شما با کد پیگیری زیر ثبت شد. فاکتور به ایمیل شما ارسال گردید{qStatus === 'ok' ? ' و پیامک تأیید برای شما ارسال شد' : ''}.</p>
        <div className="card mt24" style={{ padding: '16px 24px', display: 'inline-flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span className="muted small">کد پیگیری</span><b style={{ display: 'block', fontSize: 18 }} dir="ltr">{code}</b></div>
          {ref && <div><span className="muted small">شماره مرجع بانکی</span><b style={{ display: 'block', fontSize: 18 }} dir="ltr">{ref}</b></div>}
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
        {/* [فیکس F31] CTAها بر اساس نقش کاربر — قبلاً هاردکد به پنل دانش‌آموز بود
            و خریدارِ مدرس به گارد پنل می‌خورد */}
        <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'teacher' ? (
            <Link to="/panel/teacher/classes" className="btn btn-primary"><BookOpen size={16} /> کلاس‌های من</Link>
          ) : user?.role === 'admin' ? (
            <Link to="/panel/admin" className="btn btn-primary"><BookOpen size={16} /> پنل مدیریت</Link>
          ) : (
            <Link to="/panel/student/courses" className="btn btn-primary"><BookOpen size={16} /> رفتن به دوره‌های من</Link>
          )}
          {(!user || user.role === 'student') && (
            <Link to="/panel/student/schedule" className="btn btn-ghost"><CalendarDays size={16} /> جدول هفتگی من</Link>
          )}
          <Link to="/market" className="btn btn-ghost"><Home size={16} /> بازگشت به فروشگاه</Link>
        </div>
        <p className="muted small mt24">
          برای دوره‌های ضبط‌شده، دسترسی فوری در پنل فعال می‌شود • برای کلاس‌های زنده، جلسات در جدول هفتگی شما قرار می‌گیرند.
        </p>
      </div>
    </section>
  )
}
