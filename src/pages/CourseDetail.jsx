import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Seo, { ORIGIN } from '../components/Seo'
import Icon from '../components/Icon'
import { DataIcon } from '../utils/icons'
import { RatingStars, Reveal, Avatar } from '../components/ui'
import { CourseCard } from '../components/cards'
import { courses, teachers, testimonials } from '../data/mock'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'

export default function CourseDetail() {
 const { id } = useParams()
 const nav = useNavigate()
 const { addToCart, toast, wishlist, toggleWish } = useApp()
 const course = courses.find((c) => c.id === Number(id))
 const [openSec, setOpenSec] = useState(0)

 if (!course) return <div className="container section"><div className="empty"><p>دوره یافت نشد.</p></div></div>

 const teacher = teachers.find((t) => t.id === course.teacherId)
 const related = courses.filter((c) => c.id !== course.id && c.cat === course.cat).slice(0, 3)
 const wished = wishlist.some((w) => w.id === course.id)

 return (
 <>
 <Seo
  title={course.title}
  description={course.desc}
  path={`/courses/${course.id}`}
  jsonLd={{
   '@context': 'https://schema.org',
   '@type': 'Course',
   name: course.title,
   description: course.desc,
   provider: { '@type': 'Organization', name: 'مدرس‌یار', sameAs: `${ORIGIN}/` },
   aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: course.rating,
    ratingCount: course.students,
    bestRating: 5,
    worstRating: 1,
   },
   offers: {
    '@type': 'Offer',
    price: course.price * 10,
    priceCurrency: 'IRR',
    availability: 'https://schema.org/InStock',
    url: `${ORIGIN}/courses/${course.id}`,
   },
  }}
 />
 <section className="page-hero" style={{ paddingBottom: 24 }}>
 <div className="container">
 <div className="breadcrumb">
 <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} />
 <Link to="/courses">دوره‌ها</Link> <Icon name="chevronLeft" size={13} /> <span>{course.title}</span>
 </div>
 </div>
 </section>

 <section className="container section-sm" style={{ paddingTop: 0 }}>
 <div className="detail-layout">
 <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
 <Reveal className={`card c-thumb ${course.color}`} style={{ height: 300, borderRadius: 22 }}>
 <span className="c-emoji" style={{ fontSize: 84 }}><DataIcon name={course.icon} size={84} /></span>
 {course.badge && <span className="badge b-amber c-badge">{course.badge}</span>}
 </Reveal>

 <Reveal>
 <span className="kicker">{course.cat}</span>
 <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', lineHeight: 1.5 }}>{course.title}</h1>
 <div className="row wrap g16 mt16">
 <RatingStars value={course.rating} showNum />
 <span className="muted small">({faNum(course.students.toLocaleString('fa-IR'))} دانشجو)</span>
 <span className="badge b-gray"><Icon name="clock" size={13} /> {faNum(course.hours)} ساعت</span>
 <span className="badge b-gray"><Icon name="play" size={13} /> {faNum(course.lessonsCount)} درس</span>
 <span className="badge b-sky"><Icon name="activity" size={13} /> {course.level}</span>
 </div>
 <p className="muted mt16" style={{ lineHeight: 2.1 }}>{course.desc}</p>
 </Reveal>

 <Reveal className="card pad">
 <h3 className="mb16">این دوره چه چیزهایی دارد؟</h3>
 <div className="grids g2">
 {course.features.map((f) => (
 <span key={f} className="row g8 small muted" style={{ alignItems: 'flex-start' }}>
 <Icon name="check" size={16} className="text-green" style={{ marginTop: 5, flexShrink: 0 }} /> {f}
 </span>
 ))}
 </div>
 </Reveal>

 {/* سرفصل‌ها */}
 <Reveal>
 <h3 className="mb16">سرفصل‌های دوره</h3>
 <div className="curriculum">
 {course.curriculum.map((sec, i) => (
 <div className="cur-sec" key={i}>
 <button className={`cur-head ${openSec === i ? 'open' : ''}`} onClick={() => setOpenSec(openSec === i ? -1 : i)}>
 <span>{sec.title} <span className="muted small">({faNum(sec.lessons.length)} درس)</span></span>
 <Icon name="chevronDown" className="chev" />
 </button>
 {openSec === i && (
 <div className="cur-lessons">
 {sec.lessons.map(([t, dur]) => (
 <div className="cur-lesson" key={t}>
 <Icon name="play" filled /> <span>{t}</span>
 <span className="dur">{dur}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </Reveal>

 {/* مدرس */}
 {teacher && (
 <Reveal className="card pad">
 <h3 className="mb16">مدرس دوره</h3>
 <div className="row g16" style={{ alignItems: 'flex-start' }}>
 <Avatar name={teacher.name} color={teacher.color} size={72} />
 <div>
 <b style={{ fontSize: 16 }}>{teacher.name}</b>
 <div className="pc-role">{teacher.role}</div>
 <p className="muted small" style={{ lineHeight: 2 }}>{teacher.bio}</p>
 <Link to={`/teachers/${teacher.id}`} className="btn btn-ghost btn-sm mt16">مشاهده رزومه کامل مدرس</Link>
 </div>
 </div>
 </Reveal>
 )}

 {/* نظرات */}
 <Reveal className="card pad">
 <h3 className="mb16">نظرات دانشجویان</h3>
 {testimonials.slice(0, 3).map((t) => (
 <div className="testimonial-card" key={t.name} style={{ boxShadow: 'none', background: 'transparent', padding: '14px 0', borderBottom: '1px solid var(--line2)' }}>
 <RatingStars value={t.rating} />
 <p className="quote">«{t.quote}»</p>
 <div className="who"><b>{t.name}</b><span>{t.role}</span></div>
 </div>
 ))}
 </Reveal>
 </div>

 {/* کارت خرید */}
 <div className="detail-side">
 <div className="card buy-card">
 <div className="price-big">
 {course.price === 0 ? 'رایگان' : toman(course.price)}
 {course.oldPrice && <span className="old">{faNum(course.oldPrice)} تومان</span>}
 </div>
 <div className="buy-feats">
 <span><Icon name="check" /> دسترسی مادام‌العمر</span>
 <span><Icon name="check" /> گواهی‌نامه معتبر پایان دوره</span>
 <span><Icon name="check" /> پشتیبانی مستقیم مدرس</span>
 <span><Icon name="check" /> ضمانت بازگشت ۷ روزه وجه</span>
 </div>
 <button className="btn btn-primary btn-block btn-lg" onClick={() => {
 addToCart({ id: course.id, name: course.title, price: course.price, icon: course.icon, color: course.color, kind: 'course' })
 toast('دوره به سبد خرید اضافه شد')
 nav('/checkout')
 }}>
 <Icon name="cart" /> ثبت‌نام در دوره
 </button>
 <button className="btn btn-ghost btn-block mt8" onClick={() => {
 addToCart({ id: course.id, name: course.title, price: course.price, icon: course.icon, color: course.color, kind: 'course' })
 toast('به سبد خرید اضافه شد — می‌توانید خریدهای دیگر را هم اضافه کنید', 'info')
 }}>
 <Icon name="plus" /> افزودن به سبد خرید
 </button>
 <button className="btn btn-soft btn-block mt8" onClick={() => toggleWish({ id: course.id, name: course.title, icon: course.icon, color: course.color, price: course.price, kind: 'course' })}>
 <Icon name="heart" filled={wished} /> {wished ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
 </button>
 </div>

 <div className="card pad">
 <h4 className="mb16" style={{ fontSize: 14 }}>این دوره برای کیست؟</h4>
 {['علاقه‌مندان به یادگیری از صفر', 'افرادی که به دنبال شغل و درآمد هستند', 'دانشجویانی که پایه قوی می‌خواهند'].map((x) => (
 <span key={x} className="row g8 small muted mb8"><Icon name="check" size={15} className="text-teal" /> {x}</span>
 ))}
 </div>
 </div>
 </div>
 </section>

 {related.length > 0 && (
 <section className="section-sm container">
 <h3 className="mb24">دوره‌های مرتبط</h3>
 <div className="grids g3">
 {related.map((c) => <CourseCard key={c.id} course={c} />)}
 </div>
 </section>
 )}
 </>
 )
}
