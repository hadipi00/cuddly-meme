import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CreditCard, ShoppingCart, User, Lock, Truck, PackageCheck, Wallet, Bike, MapPin,
} from 'lucide-react'
import { EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import { req } from '../services/http'
import Seo from '../components/Seo'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
import { Button } from '../components/ui/button'
import { RadioGroup, RadioCard } from '../components/ui/radio-group'

/* روش‌های ارسال — فقط برای اقلام مدرس‌مارکت */
const SHIP_METHODS = [
  {
    key: 'prepaid', label: 'پست پیش‌کرایه', I: PackageCheck,
    desc: 'هزینه ارسال همراه سفارش پرداخت می‌شود — رایگان برای خرید بالای ۱ میلیون تومان',
    cost: 49000, freeOver: 1000000,
  },
  {
    key: 'postpaid', label: 'پس‌کرایه', I: Truck,
    desc: 'هزینه ارسال هنگام دریافت کالا، به مأمور پست پرداخت می‌شود',
    cost: 69000, freeOver: null,
  },
  {
    key: 'express', label: 'پیک فوری تهران', I: Bike,
    desc: 'تحویل همان روز برای سفارش‌های داخل تهران (سفارش تا ساعت ۱۴)',
    cost: 89000, freeOver: null,
  },
]

/* روش‌های پرداخت — زرین‌پال تنها درگاه فعال (سایرها به‌زودی) */
const PAY_METHODS = [
  { key: 'زرین‌پال', soon: false },
  { key: 'درگاه ملت', soon: true },
  { key: 'کیف پول مدرس‌یار', soon: true },
  { key: 'کارت به کارت', soon: true },
]

export default function Checkout() {
  const { cart, toast, user, clearCart } = useApp()
  const nav = useNavigate()
  const [method, setMethod] = useState('زرین‌پال')
  const [coupon, setCoupon] = useState('')
  const [couponLabel, setCouponLabel] = useState('')
  const [discount, setDiscount] = useState(0)
  const [shipKey, setShipKey] = useState('prepaid')
  const [paying, setPaying] = useState(false)
  /* وضعیت درگاه از سرور (mock/sandbox/real) — برای نمایش حالت آزمایشی */
  const [payConfig, setPayConfig] = useState(null)
  useEffect(() => { req('/pay/config').then(setPayConfig).catch(() => {}) }, [])

  const subtotal = cart.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0)
  const marketSub = cart.filter((i) => i.kind === 'market').reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0)
  const count = cart.reduce((a, i) => a + (i.qty || 1), 0)
  const hasMarket = marketSub > 0
  const ship = SHIP_METHODS.find((s) => s.key === shipKey)
  const shipCost = !hasMarket ? 0 : (ship.freeOver && marketSub >= ship.freeOver ? 0 : ship.cost)
  const finalTotal = Math.max(0, subtotal - discount) + shipCost

  /* کد تخفیف فقط سرور — قبلاً YALDA30/WELCOME هاردکد فرانت بودند و هر کسی
     با دستکاری جاوااسکریپت به خودش تخفیف می‌داد؛ حالا اعتبار/مقدار از جدول coupons */
  const checkCoupon = async () => {
    if (!coupon.trim()) { setDiscount(0); setCouponLabel(''); return }
    try {
      const r = await req('/coupons/check', { method: 'POST', body: { code: coupon.trim(), subtotal } })
      setDiscount(r.discount || 0)
      setCouponLabel(r.label || '')
      toast(`کد تخفیف ${r.label} اعمال شد`)
    } catch (e) {
      setDiscount(0)
      setCouponLabel('')
      if (!e.serverDown) toast(e.message || 'کد تخفیف نامعتبر است', 'error')
      else toast('سرور در دسترس نیست — بررسی کد تخفیف ممکن نیست', 'error')
    }
  }

  /* پرداخت واقعی — سبد پولی: ریدایرکت به درگاه زرین‌پال (بازگشت با callback و
     تأیید سمت سرور) • سبد رایگان: ثبت مستقیم. سبد خرید تا بازگشت موفق از
     درگاه پاک نمی‌شود — صفحهٔ بازگشت (/order-success) خالی‌اش می‌کند */
  const submit = async (e) => {
    e.preventDefault()
    if (cart.length === 0 || paying) return
    if (!user) {
      toast('برای ثبت سفارش ابتدا وارد حساب شوید', 'error')
      nav('/auth')
      return
    }
    if (method !== 'زرین‌پال' && finalTotal > 0) {
      toast('فعلاً فقط درگاه زرین‌پال فعال است', 'error')
      return
    }
    setPaying(true)
    try {
      const fd = Object.fromEntries(new FormData(e.target))
      const body = {
        items: cart.map((c) => ({ id: c.id, kind: c.kind, qty: c.qty || 1 })),
        coupon: coupon.trim() || undefined,
        shipKey,
        contact: { name: fd.name, phone: fd.phone, email: fd.email, address: fd.address },
      }
      if (finalTotal === 0) {
        const r = await req('/checkout', { method: 'POST', body })
        clearCart()
        nav('/order-success', { state: { code: r.code, total: 0 } })
      } else {
        const r = await req('/pay/zarinpal/start', { method: 'POST', body })
        window.location.assign(r.redirectUrl)
        return // صفحه به درگاه می‌رود
      }
    } catch (err) {
      if (err.status === 401) {
        toast('برای پرداخت ابتدا وارد حساب شوید', 'error')
        nav('/auth')
      } else if (!err.serverDown) {
        toast(err.message || 'ثبت سفارش ناموفق بود', 'error')
      } else {
        toast('سرور در دسترس نیست — پرداخت در حالت آفلاین ممکن نیست', 'error')
      }
    }
    setPaying(false)
  }

  return (
    <>
      <Seo title="تسویه حساب" robots="noindex, nofollow" />
      <section className="page-hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <h1>تسویه <span className="text-teal">حساب</span></h1>
        </div>
      </section>

      <section className="container section-sm" style={{ paddingTop: 0, paddingBottom: 80 }}>
        {cart.length === 0 ? (
          <div className="card" style={{ padding: 40 }}>
            <EmptyState icon="cart" text="سبد خرید شما خالی است — اول یک دوره یا محصول اضافه کنید." />
            <div style={{ textAlign: 'center' }}>
              <Button onClick={() => nav('/courses')}>مشاهده دوره‌ها</Button>
            </div>
          </div>
        ) : (
          <form className="checkout-grid" onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card pad">
                <h3 className="mb16 row g8" style={{ fontSize: 15 }}><User size={17} className="text-teal" /> اطلاعات خریدار</h3>
                <div className="field-row">
                  <div className="field"><label>نام و نام خانوادگی</label><input className="input" required placeholder="مثلاً سارا محمدی" /></div>
                  <div className="field"><label>شماره موبایل</label><input className="input" required placeholder="۰۹۱۲…" /></div>
                </div>
                <div className="field"><label>ایمیل (ارسال لینک دوره‌ها)</label><input className="input" type="email" required placeholder="you@example.com" /></div>
                {hasMarket && (
                  <div className="field">
                    <label className="row g8"><MapPin size={13} /> آدرس پستی (برای سفارش مدرس‌مارکت)</label>
                    <input className="input" required placeholder="استان، شهر، خیابان، پلاک و کد پستی…" />
                  </div>
                )}
              </div>

              {/* روش ارسال — فقط وقتی کالای فیزیکی در سبد هست */}
              {hasMarket && (
                <div className="card pad">
                  <h3 className="mb16 row g8" style={{ fontSize: 15 }}><Truck size={17} className="text-teal" /> روش ارسال</h3>
                  <RadioGroup value={shipKey} onValueChange={setShipKey}>
                    {SHIP_METHODS.map((s) => {
                      const free = s.freeOver && marketSub >= s.freeOver
                      return (
                        <RadioCard key={s.key} value={s.key}>
                          <div className="row g8 items-center">
                            <s.I size={18} className="text-teal" />
                            <b className="small">{s.label}</b>
                            <span className="small" style={{ marginInlineStart: 'auto', fontWeight: 700, color: free ? 'var(--green)' : 'var(--text)' }}>
                              {free ? 'رایگان' : toman(s.cost)}
                            </span>
                          </div>
                          <span className="muted small">{s.desc}</span>
                        </RadioCard>
                      )
                    })}
                  </RadioGroup>
                  <p className="muted small mt8" style={{ lineHeight: 2 }}>
                    سبد شما شامل {toman(marketSub)} کالای فیزیکی است — ارسال دوره‌ها و کلاس‌ها آنی و برخط است.
                  </p>
                </div>
              )}

              <div className="card pad">
                <h3 className="mb16 row g8" style={{ fontSize: 15 }}><CreditCard size={17} className="text-teal" /> روش پرداخت</h3>
                <div className="pay-methods">
                  {PAY_METHODS.map((m) => (
                    <div
                      key={m.key}
                      className={`pay-method ${method === m.key ? 'on' : ''} ${m.soon ? 'soon' : ''}`}
                      onClick={() => !m.soon && setMethod(m.key)}
                      style={m.soon ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                      aria-pressed={method === m.key}
                      role="button"
                    >
                      <Wallet size={17} /> {m.key}
                      {m.soon && <span className="muted" style={{ fontSize: 11, marginInlineStart: 'auto' }}>به‌زودی</span>}
                    </div>
                  ))}
                </div>
                {payConfig?.mode === 'mock' && (
                  <p className="muted small mt8" style={{ lineHeight: 1.9 }}>
                    درگاه در حالت آزمایشی است (بدون پول واقعی) — برای اتصال به زرین‌پال، مرچنت‌کد را در تنظیمات سرور وارد کنید.
                  </p>
                )}
              </div>

              <div className="card pad">
                <h3 className="mb16 row g8" style={{ fontSize: 15 }}><ShoppingCart size={17} className="text-teal" /> اقلام سفارش ({faNum(count)} قلم)</h3>
                {cart.map((i) => (
                  <div className="order-line" key={i.id}>
                    <span className={`avatar ${i.color || 'grad-2'}`} style={{ width: 46, height: 46, borderRadius: 12 }}>
                      <DataIcon name={i.icon} size={22} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <b className="small">{i.name}</b>
                      <div className="muted small">
                        {i.kind === 'course' ? 'دوره ضبط‌شده' : i.kind === 'live' ? 'کلاس آنلاین زنده' : 'مدرس‌مارکت'}
                        {(i.qty || 1) > 1 && ` — ${faNum(i.qty)} عدد`}
                      </div>
                    </div>
                    <b className="small">{i.price ? toman(i.price * (i.qty || 1)) : 'رایگان'}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="card pad" style={{ position: 'sticky', top: 90, height: 'fit-content' }}>
              <h3 className="mb16">خلاصه پرداخت</h3>
              <div className="row g8 mb16">
                <input className="input" placeholder="کد تخفیف (YALDA30)" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                <Button type="button" variant="soft" onClick={checkCoupon}>اعمال</Button>
              </div>
              <div className="between mb8 small">
                <span className="muted">مبلغ اقلام</span><b>{toman(subtotal)}</b>
              </div>
              {discount > 0 && (
                <div className="between mb8 small text-green">
                  <span>تخفیف کد {couponLabel && `(${couponLabel})`}</span><b>− {toman(discount)}</b>
                </div>
              )}
              {hasMarket && (
                <div className="between mb8 small">
                  <span className="muted row g8">هزینه ارسال ({ship.label})</span>
                  <b className={shipCost === 0 ? 'text-green' : ''}>{shipCost === 0 ? 'رایگان' : toman(shipCost)}</b>
                </div>
              )}
              <div className="between mb8 small">
                <span className="muted">مالیات بر ارزش افزوده</span><b>معاف</b>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line2)', margin: '14px 0' }} />
              <div className="between">
                <span>مبلغ نهایی</span><b style={{ fontSize: 19, color: 'var(--teal)' }}>{toman(finalTotal)}</b>
              </div>
              <Button type="submit" className="w-full mt24" size="lg" disabled={paying}>
                <CreditCard size={18} /> {paying ? 'در حال ثبت پرداخت…' : `پرداخت ${toman(finalTotal)}`}
              </Button>
              <p className="muted small mt16 row g8" style={{ lineHeight: 2 }}>
                <Lock size={14} /> پرداخت از طریق درگاه امن بانکی انجام می‌شود. اطلاعات کارت شما نزد ما ذخیره نمی‌گردد.
              </p>
            </div>
          </form>
        )}
      </section>
    </>
  )
}
