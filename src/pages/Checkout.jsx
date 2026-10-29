import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { EmptyState } from '../components/ui'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'

export default function Checkout() {
  const { cart, placeOrder, toast } = useApp()
  const nav = useNavigate()
  const [method, setMethod] = useState('زرین‌پال')
  const [coupon, setCoupon] = useState('')
  const [discount, setDiscount] = useState(0)
  const total = cart.reduce((a, i) => a + (i.price || 0), 0)
  const finalTotal = Math.max(0, total - discount)

  const checkCoupon = () => {
    if (coupon.trim().toUpperCase() === 'YALDA30') {
      setDiscount(Math.round(total * 0.3))
      toast('کد تخفیف ۳۰٪ اعمال شد! 🎉')
    } else if (coupon.trim().toUpperCase() === 'WELCOME') {
      setDiscount(Math.round(total * 0.15))
      toast('کد خوش‌آمدگویی ۱۵٪ اعمال شد')
    } else {
      setDiscount(0)
      toast('کد تخفیف نامعتبر است', 'error')
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (cart.length === 0) return
    const code = placeOrder({ items: cart.map((c) => c.name).join('، '), total: finalTotal, status: 'pending' })
    nav('/order-success', { state: { code, total: finalTotal } })
  }

  return (
    <>
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
              <button className="btn btn-primary" onClick={() => nav('/courses')}>مشاهده دوره‌ها</button>
            </div>
          </div>
        ) : (
          <form className="checkout-grid" onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card pad">
                <h3 className="mb16">📌 اطلاعات خریدار</h3>
                <div className="field-row">
                  <div className="field"><label>نام و نام خانوادگی</label><input className="input" required placeholder="مثلاً سارا محمدی" /></div>
                  <div className="field"><label>شماره موبایل</label><input className="input" required placeholder="۰۹۱۲…" /></div>
                </div>
                <div className="field"><label>ایمیل (ارسال لینک دوره‌ها)</label><input className="input" type="email" required placeholder="you@example.com" /></div>
                <div className="field"><label>آدرس پستی (برای سفارش‌های مدرس‌مارکت)</label><input className="input" placeholder="آدرس کامل…" /></div>
              </div>

              <div className="card pad">
                <h3 className="mb16">💳 روش پرداخت</h3>
                <div className="pay-methods">
                  {['زرین‌پال', 'درگاه ملت', 'کیف پول مدرس‌یار', 'کارت به کارت'].map((m) => (
                    <div key={m} className={`pay-method ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}>
                      <Icon name="creditCard" size={18} /> {m}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card pad">
                <h3 className="mb16">🛒 اقلام سفارش</h3>
                {cart.map((i) => (
                  <div className="order-line" key={i.id}>
                    <span className={`avatar ${i.color || 'grad-2'}`} style={{ width: 46, height: 46, borderRadius: 12, fontSize: 22 }}>{i.emoji || '🎓'}</span>
                    <div style={{ flex: 1 }}>
                      <b className="small">{i.name}</b>
                      <div className="muted small">{i.kind === 'course' ? 'دوره ضبط‌شده' : i.kind === 'live' ? 'کلاس آنلاین زنده' : 'مدرس‌مارکت'}</div>
                    </div>
                    <b className="small">{i.price ? toman(i.price) : 'رایگان'}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="card pad" style={{ position: 'sticky', top: 90, height: 'fit-content' }}>
              <h3 className="mb16">خلاصه پرداخت</h3>
              <div className="row g8 mb16">
                <input className="input" placeholder="کد تخفیف (YALDA30)" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                <button type="button" className="btn btn-soft" onClick={checkCoupon}>اعمال</button>
              </div>
              <div className="between mb8 small">
                <span className="muted">مبلغ اقلام</span><b>{toman(total)}</b>
              </div>
              {discount > 0 && (
                <div className="between mb8 small text-green">
                  <span>تخفیف کد</span><b>− {toman(discount)}</b>
                </div>
              )}
              <div className="between mb8 small">
                <span className="muted">مالیات بر ارزش افزوده</span><b>معاف</b>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line2)', margin: '14px 0' }} />
              <div className="between">
                <span>مبلغ نهایی</span><b style={{ fontSize: 19, color: 'var(--teal)' }}>{toman(finalTotal)}</b>
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg mt24">
                <Icon name="creditCard" /> پرداخت {toman(finalTotal)}
              </button>
              <p className="muted small mt16" style={{ lineHeight: 2 }}>
                🔒 پرداخت از طریق درگاه امن بانکی انجام می‌شود. اطلاعات کارت شما نزد ما ذخیره نمی‌گردد.
              </p>
            </div>
          </form>
        )}
      </section>
    </>
  )
}
