import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { Reveal } from '../components/ui'
import { ProductCard } from '../components/cards'
import { products, marketCats } from '../data/mock'

export default function Market() {
  const [cat, setCat] = useState('همه')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('پرفروش‌ترین')

  const list = useMemo(() => {
    let out = products
    if (cat !== 'همه') out = out.filter((p) => p.cat === cat)
    if (q.trim()) out = out.filter((p) => p.name.includes(q.trim()))
    if (sort === 'پرفروش‌ترین') out = [...out].sort((a, b) => b.rating - a.rating)
    if (sort === 'ارزان‌ترین') out = [...out].sort((a, b) => a.price - b.price)
    if (sort === 'گران‌ترین') out = [...out].sort((a, b) => b.price - a.price)
    return out
  }, [cat, q, sort])

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>مدرس‌مارکت</span></div>
          <h1>مدرس‌<span className="text-amber">مارکت</span> 🎒</h1>
          <p className="muted">فروشگاه تخصصی لوازم‌التحریر و ابزار یادگیری — ارسال سریع به سراسر کشور، ضمانت اصالت کالا.</p>
        </div>
      </section>

      {/* بنر ویژه */}
      <section className="container" style={{ marginTop: -8 }}>
        <Reveal className="cta-band" style={{ padding: '30px 34px' }}>
          <div className="between wrap">
            <div>
              <h2 style={{ fontSize: 20 }}>پک ویژه مهر — ۱۲ قلم کامل</h2>
              <p className="muted small">۲۷٪ تخفیف + ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان</p>
            </div>
            <span className="badge b-amber" style={{ fontSize: 16, padding: '8px 20px' }}>فقط تا پایان ماه</span>
          </div>
        </Reveal>
      </section>

      <section className="section-sm container">
        <div className="filter-bar">
          <div className="search-box">
            <Icon name="search" />
            <input className="input" placeholder="جستجوی محصول…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }}>
            {['پرفروش‌ترین', 'ارزان‌ترین', 'گران‌ترین'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="row wrap g8 mb24">
          {['همه', ...marketCats].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="empty"><Icon name="box" size={44} /><p>محصولی پیدا نشد.</p></div>
        ) : (
          <div className="grids g4">
            {list.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 50}><ProductCard product={p} /></Reveal>)}
          </div>
        )}
      </section>

      {/* مزایا */}
      <section className="section-sm container">
        <div className="grids g4">
          {[
            { icon: 'truck', t: 'ارسال سریع', d: 'تهران ۲۴ ساعته، شهرستان ۲ تا ۴ روز' },
            { icon: 'shield', t: 'ضمانت اصالت', d: 'تمام کالاها اورجینال و دارای گارانتی' },
            { icon: 'refresh', t: '۷ روز مهلت بازگشت', d: 'بدون قید و شرط، بدون سوال' },
            { icon: 'creditCard', t: 'پرداخت امن', d: 'درگاه‌های معتبر بانکی کشور' },
          ].map((x) => (
            <div className="card pad" key={x.t} style={{ textAlign: 'center' }}>
              <span className="sc-icon amber" style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Icon name={x.icon} size={22} />
              </span>
              <b className="small">{x.t}</b>
              <p className="muted small">{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
