import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Reveal } from '../components/ui'
import { liveClasses } from '../data/mock'
import { useApp } from '../store/AppContext'
import { DAYS, faNum, toman } from '../utils/format'

export default function LiveClasses() {
  const { addToCart, toast } = useApp()
  const [day, setDay] = useState('همه')
  const list = day === 'همه' ? liveClasses : liveClasses.filter((l) => DAYS[l.day] === day)

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>کلاس‌های آنلاین</span></div>
          <h1>کلاس‌های <span className="text-teal">آنلاین زنده</span></h1>
          <p className="muted">
            تدریس زنده با دوربین و اشتراک صفحه، پرسش‌وپاسخ مستقیم — بعد از ثبت‌نام، کلاس‌ها در جدول هفتگی پنل شما قرار می‌گیرند.
          </p>
        </div>
      </section>

      <section className="section-sm container" style={{ paddingTop: 10 }}>
        <div className="row wrap g8 mb24">
          {['همه', ...DAYS].map((d) => (
            <button key={d} className={`chip ${day === d ? 'on' : ''}`} onClick={() => setDay(d)}>{d}</button>
          ))}
        </div>

        <div className="grids g3">
          {list.map((l, i) => (
            <Reveal key={l.id} delay={(i % 3) * 70}>
              <div className="card" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className={`c-thumb ${l.color}`} style={{ height: 130 }}>
                  <span className="c-emoji" style={{ fontSize: 44 }}>{l.emoji}</span>
                  <span className={`badge c-badge ${l.status === 'full' ? 'b-red' : 'b-green'}`}>
                    {l.status === 'full' ? 'تکمیل ظرفیت' : 'در حال ثبت‌نام'}
                  </span>
                </div>
                <div className="c-body" style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15.5 }}>{l.title}</h3>
                  <p className="muted small">{l.desc}</p>
                  <div className="c-meta">
                    <span><Icon name="user" size={14} /> {l.teacher}</span>
                    <span><Icon name="calendar" size={14} /> {DAYS[l.day]}</span>
                    <span><Icon name="clock" size={14} /> {l.start} — {faNum(l.dur)} دقیقه</span>
                  </div>
                  <div className="progress teal mt8"><i style={{ width: `${(l.enrolled / l.cap) * 100}%` }} /></div>
                  <span className="muted small">{faNum(l.enrolled)} از {faNum(l.cap)} نفر</span>
                  <div className="c-foot">
                    {l.price ? <div className="price-box">{toman(l.price)}</div> : <span className="badge b-green">رایگان</span>}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={l.status === 'full'}
                      onClick={() => {
                        if (l.status === 'full') return
                        addToCart({ id: l.id, name: l.title, price: l.price, emoji: l.emoji, color: l.color, kind: 'live' })
                        toast('کلاس به سبد خرید اضافه شد — بعد از خرید در جدول هفتگی قرار می‌گیرد')
                      }}
                    >
                      {l.status === 'full' ? 'تکمیل شد' : l.price ? 'ثبت‌نام' : 'رزرو رایگان'}
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="cta-band mt32" style={{ padding: '38px 30px' }}>
          <h2 style={{ fontSize: 20 }}>کلاس زنده چگونه برگزار می‌شود؟</h2>
          <p className="muted small">با سامانه کلاس زنده اختصاصی مدرس‌یار — بدون نصب نرم‌افزار اضافه</p>
          <div className="grids g3" style={{ textAlign: 'right', marginTop: 10 }}>
            {[
              { icon: 'camera', t: 'تصویر زنده مدرس', d: 'کیفیت بالا با قابلیت چرخش بین دوربین و اسلاید' },
              { icon: 'monitor', t: 'اشتراک صفحه', d: 'نمایش کد، اسلاید یا وایت‌برد دیجیتال' },
              { icon: 'chat', t: 'چت و پرسش‌وپاسخ', d: 'سوال بپرسید و همزمان جواب بگیرید' },
            ].map((x) => (
              <div key={x.t} className="row g12" style={{ alignItems: 'flex-start' }}>
                <span className="sc-icon teal" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={x.icon} size={19} />
                </span>
                <div><b className="small">{x.t}</b><p className="muted small">{x.d}</p></div>
              </div>
            ))}
          </div>
          <Link to="/auth" className="btn btn-primary mt16">شروع کنید</Link>
        </div>
      </section>
    </>
  )
}
