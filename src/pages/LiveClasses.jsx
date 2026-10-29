import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Radio } from 'lucide-react'
import Seo, { ORIGIN, crumbsJsonLd } from '../components/Seo'
import Icon from '../components/Icon'
import SmartImg from '../components/SmartImg'
import { Reveal, RatingStars, Avatar } from '../components/ui'
import { Modal } from '../components/Modal'
import { liveClasses, teachers } from '../data/mock'
import { useApp } from '../store/AppContext'
import { DAYS, faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
import { useNow, nextOccurrence, splitDuration, todayIdx } from '../hooks/useClassStatus'

const dayLabel = (d) => DAYS[d]

export default function LiveClasses() {
 const { addToCart, toast, user } = useApp()
 const nav = useNavigate()
 const now = useNow(1000)
 const tIdx = todayIdx()
 const [day, setDay] = useState('همه')
 const [detail, setDetail] = useState(null)

 // اتصال هر کلاس به وضعیت زنده + زمان شروع بعدی
 const enriched = useMemo(() => liveClasses.map((l) => ({
 ...l,
 startsAt: nextOccurrence(l.day, l.start),
 })), [])

 const list = day === 'همه' ? enriched : enriched.filter((l) => dayLabel(l.day) === day)
 const todayList = enriched.filter((l) => l.day === tIdx)

 const register = (l) => {
 if (l.status === 'full') return
 addToCart({ id: l.id, name: l.title, price: l.price, icon: l.icon, color: l.color, kind: 'live' })
 toast('کلاس به سبد خرید اضافه شد — بعد از خرید در برنامه هفتگی شما قرار می‌گیرد')
 setDetail(null)
 }

 return (
 <>
 <Seo
 title="کلاس‌های آنلاین زنده"
 description="رزرو کلاس‌های آنلاین زنده با اساتید برتر — کلاس‌های تعاملی با ضبط جلسات، تکلیف و گواهی‌نامه — مدرس‌یار."
 path="/live"
 keywords="کلاس آنلاین زنده, کلاس مجازی, رزرو کلاس, کلاس تعاملی, آموزش زنده"
 jsonLd={[
 crumbsJsonLd([['صفحه نخست', '/'], ['کلاس‌های آنلاین', '/live']]),
 {
 '@context': 'https://schema.org',
 '@type': 'ItemList',
 name: 'کلاس‌های آنلاین زنده مدرس‌یار',
 itemListElement: enriched.map((l, i) => {
 const [h, m] = l.start.split(':').map(Number)
 const endMin = h * 60 + m + l.dur
 const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
 return {
 '@type': 'ListItem',
 position: i + 1,
 item: {
 '@type': 'Event',
 name: l.title,
 description: l.desc,
 startDate: `${l.date}T${l.start}:00+03:30`,
 endDate: `${l.date}T${endTime}:00+03:30`,
 eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
 eventStatus: l.status === 'full'
 ? 'https://schema.org/EventSoldOut'
 : 'https://schema.org/EventScheduled',
 location: { '@type': 'VirtualLocation', url: `${ORIGIN}/live` },
 organizer: { '@type': 'Organization', name: 'مدرس‌یار', url: ORIGIN },
 performer: { '@type': 'Person', name: l.teacher },
 offers: {
 '@type': 'Offer',
 price: l.price * 10,
 priceCurrency: 'IRR',
 availability: l.status === 'full' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
 url: `${ORIGIN}/live`,
 },
 },
 }
 }),
 },
 ]}
 />
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb"><Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} /> <span>کلاس‌های آنلاین</span></div>
 <h1>کلاس‌های <span className="text-teal">آنلاین زنده</span></h1>
 <p className="muted">
 تدریس زنده با دوربین و اشتراک صفحه، پرسش‌وپاسخ مستقیم — روی هر کلاس کلیک کنید تا جزئیات کامل،
 برنامه زمانی و فرم ثبت‌نام را ببینید.
 </p>
 </div>
 </section>

 {/* ---------- کلاس‌های امروز با شمارش معکوس ---------- */}
 {todayList.length > 0 && (
 <section className="container" style={{ paddingBottom: 8 }}>
 <div className="between wrap mb16">
 <h2 style={{ fontSize: 17 }}>امروز — {DAYS[tIdx]}</h2>
 <span className="muted small">این کلاس‌ها همین امروز برگزار می‌شوند</span>
 </div>
 <div className="row g12" style={{ flexWrap: 'wrap' }}>
 {todayList.map((l) => {
 const msLeft = l.startsAt.getTime() - now
 const cd = splitDuration(Math.max(0, msLeft))
 return (
 <button
 key={l.id}
 className="card row g12"
 style={{ padding: '12px 18px', flex: '1 1 250px', textAlign: 'right', cursor: 'pointer' }}
 onClick={() => setDetail(l)}
 >
 <span className={`avatar ${l.color}`} style={{ width: 40, height: 40, borderRadius: 12, fontSize: 15 }}>
 <DataIcon name={l.icon} size={18} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <b className="small" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</b>
 <span className="muted" style={{ fontSize: 12 }}>ساعت {l.start} • {l.teacher}</span>
 </div>
 <span className="badge b-violet" dir="ltr">
 {cd.d > 0 ? `${faNum(cd.d)} روز` : `${String(cd.h).padStart(2, '0')}:${String(cd.m).padStart(2, '0')}:${String(cd.s).padStart(2, '0')}`}
 </span>
 </button>
 )
 })}
 </div>
 </section>
 )}

 <section className="section-sm container" style={{ paddingTop: 26 }}>
 <div className="row wrap g8 mb24">
 {['همه', ...DAYS].map((d) => (
 <button key={d} className={`chip ${day === d ? 'on' : ''}`} onClick={() => setDay(d)}>{d}</button>
 ))}
 </div>

 <div className="grids g3">
 {list.map((l, i) => (
 <Reveal key={l.id} delay={(i % 3) * 70}>
 <div
 className="card course-card"
 style={{ height: '100%' }}
 onClick={() => setDetail(l)}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => e.key === 'Enter' && setDetail(l)}
 aria-label={`جزئیات کلاس ${l.title}`}
 >
 <div className={`c-thumb ${l.color}`} style={{ height: 130 }}>
 <SmartImg
 src="/images/courses/live.jpg"
 alt={`${l.title} — کلاس آنلاین زنده با ${l.teacher}`}
 width={672}
 height={260}
 fallback={<span className="c-emoji" style={{ fontSize: 44 }}><DataIcon name={l.icon} size={44} /></span>}
 />
 <span className={`badge c-badge ${l.status === 'full' ? 'b-red' : 'b-green'}`}>
 {l.status === 'full' ? 'تکمیل ظرفیت' : 'در حال ثبت‌نام'}
 </span>
 <span className="badge b-gray c-level">{dayLabel(l.day)} • {l.start}</span>
 </div>
 <div className="c-body" style={{ flex: 1 }}>
 <h3 style={{ fontSize: 15.5 }}>{l.title}</h3>
 <p className="muted small">{l.desc}</p>
 <div className="c-meta">
 <span><Icon name="user" size={14} /> {l.teacher}</span>
 <span><Icon name="clock" size={14} /> {faNum(l.dur)} دقیقه</span>
 </div>
 <div className="progress teal mt8"><i style={{ width: `${(l.enrolled / l.cap) * 100}%` }} /></div>
 <span className="muted small">{faNum(l.enrolled)} از {faNum(l.cap)} نفر</span>
 <div className="c-foot">
 {l.price ? <div className="price-box">{toman(l.price)}</div> : <span className="badge b-green">رایگان</span>}
 <button
 className="btn btn-primary btn-sm"
 disabled={l.status === 'full'}
 onClick={(e) => { e.stopPropagation(); register(l) }}
 >
 {l.status === 'full' ? 'تکمیل شد' : 'ثبت‌نام'}
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

 {/* ---------- مودال جزئیات کلاس ---------- */}
 <Modal open={!!detail} title="جزئیات کلاس زنده" onClose={() => setDetail(null)} wide>
 {detail && (
 <div>
 <div className="row g16 wrap" style={{ alignItems: 'flex-start' }}>
 <div className={`p-thumb ${detail.color}`} style={{ width: 96, height: 96, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <DataIcon name={detail.icon} size={44} />
 </div>
 <div style={{ flex: 1, minWidth: 220 }}>
 <h3 style={{ fontSize: 17, marginBottom: 6 }}>{detail.title}</h3>
 <p className="muted small">{detail.desc}</p>
 <div className="row g8 wrap mt16">
 <span className={`badge ${detail.status === 'full' ? 'b-red' : 'b-green'}`}>
 {detail.status === 'full' ? 'تکمیل ظرفیت' : 'در حال ثبت‌نام'}
 </span>
 <span className="badge b-sky"><Icon name="calendar" size={12} /> {dayLabel(detail.day)}</span>
 <span className="badge b-violet"><Icon name="clock" size={12} /> ساعت {detail.start} • {faNum(detail.dur)} دقیقه</span>
 </div>
 </div>
 </div>

 {(() => {
 const t = teachers.find((x) => x.name === detail.teacher)
 const msLeft = detail.startsAt.getTime() - now
 const cd = splitDuration(Math.max(0, msLeft))
 return (
 <>
 <div className="card pad mt24" style={{ padding: 16 }}>
 <div className="row g12">
 {t ? <Avatar name={t.name} color={t.color} size={46} /> : <Avatar name={detail.teacher} size={46} />}
 <div style={{ flex: 1 }}>
 <b className="small">{detail.teacher}</b>
 <p className="muted small">{t?.role || 'مدرس رسمی آکادمی مدرس‌یار'}</p>
 </div>
 {t && <RatingStars value={t.rating} showNum />}
 </div>
 </div>

 <div className="grids g2 mt24" style={{ gap: 14 }}>
 <div className="card pad" style={{ padding: 16 }}>
 <b className="small">ظرفیت کلاس</b>
 <div className="progress teal mt8" style={{ height: 10 }}><i style={{ width: `${(detail.enrolled / detail.cap) * 100}%` }} /></div>
 <p className="muted small mt8">{faNum(detail.enrolled)} نفر از {faNum(detail.cap)} ظرفیت ثبت‌نام کرده‌اند</p>
 </div>
 <div className="card pad" style={{ padding: 16 }}>
 <b className="small">شروع جلسه بعدی</b>
 <p className="muted small mt8">{DAYS[detail.day]} — ساعت {detail.start}</p>
 {msLeft > 0 && (
 <span className="badge b-amber mt8" dir="ltr">
 {cd.d > 0 ? `${faNum(cd.d)} روز` : `${String(cd.h).padStart(2, '0')}:${String(cd.m).padStart(2, '0')}:${String(cd.s).padStart(2, '0')}`} مانده
 </span>
 )}
 </div>
 </div>

 <div className="card pad mt24" style={{ padding: 16 }}>
 <b className="small">این کلاس شامل:</b>
 <div className="grids g2 mt8" style={{ gap: 8 }}>
 {['حضور در کلاس زنده با چت و پرسش‌وپاسخ', 'دسترسی به ضبط جلسات تا همیشه', 'تکالیف هفتگی با بازخورد مدرس', 'گواهی‌نامه حضور و مشارکت'].map((f) => (
 <span className="row g8 small" key={f}><Icon name="check" size={15} className="text-green" style={{ flexShrink: 0 }} /> {f}</span>
 ))}
 </div>
 </div>

 <div className="between wrap mt24 g12">
 <div>
 {detail.price ? (
 <div className="price-box" style={{ fontSize: 20 }}>{toman(detail.price)}</div>
 ) : <span className="badge b-green" style={{ fontSize: 15, padding: '6px 16px' }}>کاملاً رایگان</span>}
 </div>
 <div className="row g8">
 <button className="btn btn-ghost" onClick={() => { setDetail(null); user ? nav('/panel/student') : nav('/auth') }}>
 {user ? 'پنل من' : 'ورود / ثبت‌نام'}
 </button>
 <button className="btn btn-primary btn-lg" disabled={detail.status === 'full'} onClick={() => register(detail)}>
 {detail.status === 'full' ? 'ظرفیت تکمیل است' : detail.price ? 'ثبت‌نام در کلاس' : 'رزرو رایگان'}
 </button>
 </div>
 </div>
 </>
 )
 })()}
 </div>
 )}
 </Modal>
 </>
 )
}
