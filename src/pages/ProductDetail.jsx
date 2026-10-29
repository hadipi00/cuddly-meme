import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Reveal, RatingStars } from '../components/ui'
import { ProductCard } from '../components/cards'
import { products } from '../data/mock'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'

export default function ProductDetail() {
  const { id } = useParams()
  const { addToCart, toast } = useApp()
  const product = products.find((p) => p.id === id)
  const [qty, setQty] = useState(1)
  if (!product) return <div className="container section"><div className="empty"><p>محصول یافت نشد.</p></div></div>
  const related = products.filter((p) => p.id !== product.id && p.cat === product.cat).slice(0, 4)

  return (
    <>
      <section className="page-hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} />
            <Link to="/market">مدرس‌مارکت</Link> <Icon name="chevronLeft" size={13} /> <span>{product.name}</span>
          </div>
        </div>
      </section>

      <section className="container section-sm" style={{ paddingTop: 0 }}>
        <div className="detail-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <Reveal className={`card p-thumb ${product.color}`} style={{ height: 340, borderRadius: 22 }}>
              <span className="p-emoji" style={{ fontSize: 110 }}>{product.emoji}</span>
            </Reveal>
            <Reveal className="card pad">
              <h3 className="mb16">مشخصات محصول</h3>
              <table className="dtable" style={{ minWidth: 'auto' }}>
                <tbody>
                  {[
                    ['دسته‌بندی', product.cat],
                    ['امتیاز کاربران', `${product.rating.toLocaleString('fa-IR')} از ۵`],
                    ['موجودی انبار', product.stock > 0 ? `${faNum(product.stock)} عدد` : 'ناموجود'],
                    ['گارانتی', '۷ روز ضمانت بازگشت'],
                    ['ارسال', 'تهران ۲۴ ساعته — شهرستان ۲ تا ۴ روز کاری'],
                  ].map(([k, v]) => (
                    <tr key={k}><td className="muted" style={{ width: 160 }}>{k}</td><td className="cell-strong">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>

          <div className="detail-side">
            <div className="card buy-card">
              <span className="badge b-gray mb8">{product.cat}</span>
              <h2 style={{ fontSize: 19, lineHeight: 1.7 }}>{product.name}</h2>
              <div className="row g12 mt8"><RatingStars value={product.rating} showNum /></div>
              <div className="price-big mt16" style={{ color: 'var(--amber)' }}>
                {toman(product.price)}
                {product.oldPrice && <span className="old">{faNum(product.oldPrice)} تومان</span>}
              </div>

              <div className="row g12 mt16">
                <span className="muted small">تعداد:</span>
                <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
                  <button className="icon-btn" style={{ border: 'none' }} onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <b style={{ minWidth: 36, textAlign: 'center' }}>{faNum(qty)}</b>
                  <button className="icon-btn" style={{ border: 'none' }} onClick={() => setQty(Math.min(product.stock, qty + 1))}>+</button>
                </div>
                <span className={`badge ${product.stock < 20 ? 'b-red' : 'b-green'}`}>
                  {product.stock < 20 ? 'موجودی محدود' : 'موجود در انبار'}
                </span>
              </div>

              <button className="btn btn-primary btn-block btn-lg mt16" onClick={() => {
                addToCart({ id: `${product.id}x${qty}`, name: `${product.name} × ${qty} عدد`, price: product.price * qty, emoji: product.emoji, color: product.color, kind: 'market' })
                toast('به سبد خرید اضافه شد')
              }}>
                <Icon name="cart" /> افزودن به سبد خرید
              </button>
              <div className="buy-feats">
                <span><Icon name="truck" /> ارسال رایگان بالای ۵۰۰ هزار تومان</span>
                <span><Icon name="shield" /> ضمانت اصالت و سلامت فیزیکی</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-sm container">
          <h3 className="mb24">محصولات مشابه</h3>
          <div className="grids g4">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </>
  )
}
