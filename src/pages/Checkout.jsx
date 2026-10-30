import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, ShoppingCart, User, Lock, Truck, PackageCheck, Wallet, Bike, MapPin,
} from 'lucide-react'
import { EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
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

export default function Checkout() {
  const { cart, placeOrder, toast } = useApp()
  const nav = useNavigate()
  const [method, setMethod] = useState('زرین‌پال')
  const [coupon, setCoupon] = useState('')
  const [discount, setDiscount] = useState(0)
  const [shipKey, setShipKey] = useState('prepaid')

  const subtotal = cart.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0)
  const marketSub = cart.filter((i) => i.kind === 'market').reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0)
  const count = cart.reduce((a, i) => a + (i.qty || 1), 0)
  const hasMarket = marketSub > 0
  const ship = SHIP_METHODS.find((s) => s.key === shipKey)
  const shipCost = !hasMarket ? 0 : (ship.freeOver && marketSub >= ship.freeOver ? 0 : ship.cost)
  const finalTotal = Math.max(0, subtotal - discount) + shipCost

  const checkCoupon = () => {
    if (coupon.trim().toUpperCase() === 'YALDA30') {
      setDiscount(Math.round(subtotal * 0.3))
      toast('کد تخفیف ۳۰٪ اعمال شد')
    } else if (coupon.trim().toUpperCase() === 'WELCOME') {
      setDiscount(Math.round(subtotal * 0.15))
      toast('کد خوش‌آمدگویی ۱۵٪ اعمال شد')
    } else {
      setDiscount(0)
      toast('کد تخفیف نامعتبر است', 'error')
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (cart.length === 0) return
    const code = placeOrder({
      items: cart.map((c) => `${c.name} × ${faNum(c.qty || 1)}`).join('، '),
      total: finalTotal,
      status: 'pending',
      shipping: hasMarket ? { method: ship.label, cost: shipCost } : null,
    })
    nav('/order-success', { state: { code, total: finalTotal, ship: hasMarket ? { label: ship.label, cost: shipCost } : null } })
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
                  {['زرین‌پال', 'درگاه ملت', 'کیف پول مدرس‌یار', 'کارت به کارت'].map((m) => (
                    <div key={m} className={`pay-method ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}>
                      <Wallet size={17} /> {m}
                    </div>
                  ))}
                </div>
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
                  <span>تخفیف کد</span><b>− {toman(discount)}</b>
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
              <Button type="submit" className="w-full mt24" size="lg">
                <CreditCard size={18} /> پرداخت {toman(finalTotal)}
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
