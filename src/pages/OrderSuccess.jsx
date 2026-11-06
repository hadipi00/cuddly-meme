import { useEffect, useState } from 'react'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Truck, BookOpen, CalendarDays, Home, RefreshCw, Upload, Clock, Copy } from 'lucide-react'
import Seo from '../components/Seo'
import { useApp } from '../store/AppContext'
import { req } from '../services/http'
import { toman } from '../utils/format'

/* دلیل‌های شکست بازگشت از درگاه — کدهای callback سرور (/api/pay/zarinpal/callback) */
const FAIL_REASONS = {
  canceled: 'پرداخت در درگاه لغو شد یا ناموفق بود. اگر مبلغی کسر شده باشد، حداکثر تا ۷۲ ساعت به‌صورت خودکار برمی‌گردد.',
  verify: 'تأیید پرداخت نزد درگاه انجام نشد. اگر مبلغی کسر شده باشد، حداکثر تا ۷۲ ساعت برمی‌گردد.',
  expired: 'مهلت این پرداخت منقضی شده است — لطفاً دوباره تلاش کنید.',
  unknown: 'اطلاعات بازگشت از درگاه معتبر نیست.',
}

const C2C_STATUS = {
  pending: ['منتظر رسید پرداخت شما', 'b-amber'],
  review: ['رسید ثبت شد — در انتظار تأیید مدیر (معمولاً کمتر از ۲۴ ساعت)', 'b-sky'],
  paid: ['تأیید شد — سفارش شما فعال است', 'b-green'],
  rejected: ['رسید رد شد — لطفاً دوباره سفارش ثبت کنید یا با پشتیبانی تماس بگیرید', 'b-red'],
  expired: ['مهلت رسیدگذاری این سفارش (۲۴ ساعت) تمام شد — دوباره اقدام کنید', 'b-red'],
  failed: ['این سفارش ناموفق بود — دوباره اقدام کنید', 'b-red'],
}

/* نمای کارت‌به‌کارت — سفارش pending ثبت شده؛ کاربر رسید آپلود می‌کند و مدیر تأیید می‌کند */
function C2cPanel({ code, total }) {
  const { toast } = useApp()
  const [st, setSt] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => { req(`/pay/card2card/status/${code}`).then(setSt).catch(() => setSt({ status: 'unknown' })) }
  useEffect(() => {
    load()
    req('/pay/config').then(setCfg).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const pick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 4 * 1024 * 1024) { toast('حجم تصویر باید کمتر از ۴ مگابایت باشد', 'error'); return }
    const rd = new FileReader()
    rd.onload = () => setImg(String(rd.result))
    rd.readAsDataURL(f)
  }

  const upload = async () => {
    if (!img || busy) return
    setBusy(true)
    try {
      await req(`/pay/card2card/${code}/receipt`, { method: 'POST', body: { image: img } })
      toast('رسید ثبت شد — در انتظار تأیید مدیر')
      setImg(null)
      load()
    } catch (e) {
      toast(e.message || 'آپلود رسید ناموفق بود', 'error')
    } finally { setBusy(false) }
  }

  const status = st?.status || 'pending'
  const [label, cls] = C2C_STATUS[status] || C2C_STATUS.pending
  const canUpload = ['pending', 'review'].includes(status)
  const card = cfg?.card

  return (
    <section className="container section">
      <Seo title="سفارش کارت‌به‌کارت" robots="noindex, nofollow" />
      <div className="card success-card">
        <div className="success-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Upload size={38} /></div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>سفارش شما ثبت شد — پرداخت کارت‌به‌کارت</h1>
        <p className="muted">مبلغ را به کارت زیر کارت‌به‌کارت واریز کنید (از طریق اپ بله‌پی رایگان است)، سپس تصویر رسید را آپلود کنید تا مدیر سفارش را فعال کند.</p>
        <div className="card mt24" style={{ padding: '16px 24px', display: 'inline-flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span className="muted small">کد پیگیری</span><b style={{ display: 'block', fontSize: 18 }} dir="ltr">{code}</b></div>
          <div><span className="muted small">مبلغ واریزی</span><b style={{ display: 'block', fontSize: 18 }}>{toman(st?.amount || total)}</b></div>
        </div>
        {card && (
          <div className="card mt16" style={{ padding: 16, maxWidth: 460, marginInline: 'auto', border: '1px dashed var(--line2)', textAlign: 'right' }}>
            {card.number ? (
              <div className="row g8 items-center" style={{ justifyContent: 'center' }}>
                <b style={{ fontSize: 19, letterSpacing: 1 }} dir="ltr">{card.number}</b>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(card.number.replace(/-/g, '')); toast('شماره کارت کپی شد') }}>
                  <Copy size={14} /> کپی
                </button>
              </div>
            ) : (
              <p className="muted small">شماره کارت هنوز تنظیم نشده — با پشتیبانی هماهنگ کنید.</p>
            )}
            <div className="muted small mt8" style={{ lineHeight: 2 }}>
              {card.bank && <>بانک: <b>{card.bank}</b> — </>}
              {card.holder && <>به نام: <b>{card.holder}</b></>}
            </div>
            {card.note && <p className="muted small mt8" style={{ lineHeight: 2 }}>💡 {card.note}</p>}
          </div>
        )}
        <div className="mt24">
          <span className={`badge ${cls}`} style={{ fontSize: 13 }}><Clock size={13} style={{ verticalAlign: '-2px' }} /> {label}</span>
        </div>
        {canUpload && (
          <div className="card mt24" style={{ padding: 20, maxWidth: 520, marginInline: 'auto', textAlign: 'right' }}>
            <b className="small">تصویر رسید (JPG/PNG/WebP — حداکثر ۴ مگابایت)</b>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="input mt8" onChange={pick} />
            {img && (
              <div className="mt12">
                <img src={img} alt="پیش‌نمایش رسید" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10, border: '1px solid var(--line2)' }} />
              </div>
            )}
            <button className="btn btn-primary w-full mt16" disabled={!img || busy} onClick={upload}>
              <Upload size={16} /> {busy ? 'در حال ارسال…' : st?.hasReceipt ? 'ارسال دوبارهٔ رسید' : 'ارسال رسید'}
            </button>
            {st?.hasReceipt && <p className="muted small mt8">رسید قبلی ثبت شده — در صورت نیاز می‌توانید نسخهٔ واضح‌تری بفرستید.</p>}
          </div>
        )}
        <div className="row g12 mt32" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={15} /> بروزرسانی وضعیت</button>
          <Link to={user?.role === 'teacher' ? '/panel/teacher/earnings' : '/panel/student/orders'} className="btn btn-primary">سفارش‌های من</Link>
        </div>
      </div>
    </section>
  )
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
  const c2c = qStatus === 'c2c'
  /* [فیکس F31] وضعیتِ ناشناختهٔ بازگشت دیگر «پرداخت موفق» جعلی رندر نمی‌شود */
  const unknownStatus = !!code && !failed && !ok && !c2c

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

  if (c2c) {
    return <C2cPanel code={code} total={total} />
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
