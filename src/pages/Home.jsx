import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { DataIcon } from '../utils/icons'
import { Reveal, RatingStars } from '../components/ui'
import { CourseCard, ProductCard } from '../components/cards'
import { courses, liveClasses, products, testimonials, faqItems } from '../data/mock'
import { DAYS, faNum } from '../utils/format'
import { site } from '../config/site'
import { useState } from 'react'

function FAQ() {
 const [open, setOpen] = useState(0)
 return (
 <div style={{ maxWidth: 760, margin: '0 auto' }}>
 {faqItems.map((f, i) => (
 <div className="cur-sec" key={i} style={{ marginBottom: 12 }}>
 <button className={`cur-head ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? -1 : i)}>
 {f.q}
 <Icon name="chevronDown" className="chev" />
 </button>
 {open === i && <div style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: 14 }}>{f.a}</div>}
 </div>
 ))}
 </div>
 )
}

export default function Home() {
 const featured = courses.slice(0, 4)
 const lives = liveClasses.slice(0, 3)
 const market = products.slice(0, 4)

 return (
 <>
 {/* ===== هیرو با ظاهر رزومه‌ای ===== */}
 <section className="hero">
 <div className="container hero-grid">
 <div>
 <span className="hero-hello">سلام، خوش آمدید </span>
 <h1>
 ما <span className="grad-text">مدرس‌یار</span> هستیم؛<br />
 جایی که آموزش، <span className="grad-text">حرفه‌ای</span> می‌شود
 </h1>
 <p className="lead">
 پلتفرم جامع کلاس‌های آنلاین زنده، دوره‌های ضبط‌شده و فروشگاه لوازم‌التحریر.
 با اساتید برتر ایران، جدول هفتگی اختصاصی و پشتیبانی واقعی — از انتخاب دوره تا گواهی‌نامه، همه‌چیز یکجا.
 </p>
 <div className="hero-actions">
 <Link to="/courses" className="btn btn-primary btn-lg">
 <Icon name="book" /> مشاهده دوره‌ها
 </Link>
 <Link to="/resume" className="btn btn-ghost btn-lg">
 <Icon name="file" /> دانلود رزومه ما
 </Link>
 <Link to="/auth" className="btn btn-soft btn-lg">
 <Icon name="cap" /> ورود دانش‌آموزان
 </Link>
 </div>
 <div className="hero-mini-stats">
 <div><b>+{faNum(12000)}</b><span>دانشجوی فعال</span></div>
 <div><b>{faNum(240)}</b><span>دوره و کلاس تخصصی</span></div>
 <div><b>{faNum(98)}٪</b><span>رضایت دانشجویان</span></div>
 <div><b>{faNum(12)}</b><span>سال تجربه آموزشی</span></div>
 </div>
 </div>

 {/* کارت رزومه */}
 <div className="profile-card">
 <div className="float-card fc-1">
 <span className="sc-icon teal" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <Icon name="activity" size={19} />
 </span>
 <div><b className="fc-num">۴.۲ ساعت</b><div className="fc-txt">میانگین مطالعه هفتگی<br />دانشجویان فعال</div></div>
 </div>
 <div className="float-card fc-2">
 <span className="sc-icon amber" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <Icon name="star" size={19} filled />
 </span>
 <div><b className="fc-num">۴.۹ از ۵</b><div className="fc-txt">امتیاز رضایت از اساتید</div></div>
 </div>

 <div className="pc-top">
 <div className="pc-banner" />
 <div className="pc-body">
 <div className="pc-avatar">م‌ی</div>
 <div className="pc-name">آکادمی مدرس‌یار</div>
 <div className="pc-role">پلتفرم آموزش آنلاین و مدرس‌مارکت</div>
 <p className="pc-bio">
 ما با گردهم‌آوردن بهترین اساتید کشور، مسیر یادگیری را از «دانلود ویدیو» به «تجربه کلاس واقعی» تغییر داده‌ایم.
 </p>
 <div className="pc-info">
 <div><Icon name="mapPin" /> تهران، ایران — آموزش از سراسر کشور</div>
 <div><Icon name="mail" /> {site.email}</div>
 <div><Icon name="phone" /> {site.phone}</div>
 <div><Icon name="clock" /> {site.workingHours}</div>
 </div>
 <div className="pc-tags">
 {['کلاس زنده', 'دوره ضبط‌شده', 'گواهی‌نامه معتبر', 'جدول هفتگی', 'مدرس‌مارکت', 'پشتیبانی ۲۴/۷'].map((t) => (
 <span className="chip" key={t}>{t}</span>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* ===== نوار آمار ===== */}
 <div className="container">
 <Reveal className="stats-band">
 <div><b>{faNum(12000)}+</b><span>دانشجوی فعال</span></div>
 <div><b>{faNum(240)}</b><span>دوره تخصصی ضبط‌شده</span></div>
 <div><b>{faNum(1500)}+</b><span>کلاس آنلاین برگزارشده</span></div>
 <div><b>{faNum(35)}</b><span>استاد برتر کشور</span></div>
 </Reveal>
 </div>

 {/* ===== خدمات ===== */}
 <section className="section">
 <div className="container">
 <Reveal className="sec-head">
 <span className="kicker"><Icon name="sparkles" size={14} /> خدمات ما</span>
 <h2>هر چیزی که برای یادگیری لازم دارید</h2>
 <p>از کلاس زنده تعاملی تا خرید لوازم‌التحریر، همه در یک پلتفرم یکپارچه</p>
 </Reveal>
 <div className="grids g4">
 {[
 { icon: 'video', color: 'teal', title: 'کلاس‌های آنلاین زنده', text: 'با دوربین و اشتراک صفحه مدرس، پرسش‌وپاسخ مستقیم و حضور و غیاب خودکار.' },
 { icon: 'book', color: 'sky', title: 'دوره‌های ضبط‌شده', text: 'دسترسی مادام‌العمر، تمرین و آزمون، گواهی‌نامه پایان دوره با کد رهگیری.' },
 { icon: 'calendar', color: 'violet', title: 'جدول هفتگی هوشمند', text: 'کلاس‌های پیش‌رو به‌صورت خودکار در برنامه هفتگی شما قرار می‌گیرند.' },
 { icon: 'box', color: 'amber', title: 'مدرس‌مارکت', text: 'فروشگاه تخصصی لوازم‌التحریر با ارسال سریع به سراسر کشور.' },
 ].map((s, i) => (
 <Reveal key={s.title} delay={i * 90}>
 <div className="card pad" style={{ height: '100%' }}>
 <span className={`sc-icon ${s.color}`} style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
 <Icon name={s.icon} size={22} />
 </span>
 <h3 style={{ fontSize: 16.5, marginBottom: 8 }}>{s.title}</h3>
 <p className="muted small">{s.text}</p>
 </div>
 </Reveal>
 ))}
 </div>
 </div>
 </section>

 {/* ===== دوره‌های ویژه ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head right">
 <span className="kicker"><Icon name="book" size={14} /> دوره‌های ضبط‌شده</span>
 <h2>پرطرفدارترین دوره‌های این ماه</h2>
 </Reveal>
 <div className="grids g4">
 {featured.map((c) => <CourseCard key={c.id} course={c} />)}
 </div>
 <div style={{ textAlign: 'center', marginTop: 34 }}>
 <Link to="/courses" className="btn btn-ghost">مشاهده همه دوره‌ها <Icon name="chevronLeft" size={16} /></Link>
 </div>
 </div>
 </section>

 {/* ===== کلاس‌های زنده ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head right">
 <span className="kicker"><Icon name="video" size={14} /> کلاس‌های آنلاین</span>
 <h2>کلاس‌های زنده پیش‌رو</h2>
 </Reveal>
 <div className="grids g3">
 {lives.map((l) => (
 <Reveal key={l.id}>
 <div className="card pad" style={{ height: '100%' }}>
 <div className="between mb16">
 <span className={`badge ${l.status === 'full' ? 'b-red' : 'b-green'}`}>
 <i className="live-red-dot" style={{ width: 7, height: 7, background: l.status === 'full' ? 'var(--red)' : 'var(--green)', borderRadius: 99 }} />
 {l.status === 'full' ? 'تکمیل ظرفیت' : 'در حال ثبت‌نام'}
 </span>
 <span className="muted small">{DAYS[l.day]} • ساعت {l.start}</span>
 </div>
 <h3 style={{ fontSize: 16, marginBottom: 8 }}><DataIcon name={l.icon} size={18} /> {l.title}</h3>
 <p className="muted small mb16">{l.desc}</p>
 <div className="between">
 <span className="muted small"><Icon name="user" size={13} /> {l.teacher}</span>
 {l.price ? (
 <b className="text-teal">{faNum(l.price)} تومان</b>
 ) : <span className="badge b-green">رایگان</span>}
 </div>
 <div className="progress mt16 teal"><i style={{ width: `${(l.enrolled / l.cap) * 100}%` }} /></div>
 <span className="muted small mt8" style={{ display: 'block' }}>
 {faNum(l.enrolled)} از {faNum(l.cap)} نفر ثبت‌نام کرده‌اند
 </span>
 </div>
 </Reveal>
 ))}
 </div>
 <div style={{ textAlign: 'center', marginTop: 34 }}>
 <Link to="/live" className="btn btn-ghost">همه کلاس‌های آنلاین <Icon name="chevronLeft" size={16} /></Link>
 </div>
 </div>
 </section>

 {/* ===== چرا مدرس‌یار ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head">
 <span className="kicker"><Icon name="target" size={14} /> چرا مدرس‌یار؟</span>
 <h2>تجربه‌ای متفاوت از آموزش آنلاین</h2>
 </Reveal>
 <div className="grids g3">
 {[
 { n: '۰۱', t: 'رزومه‌ای شفاف', d: 'رزومه کامل اساتید، سوابق و افتخارات را قبل از ثبت‌نام ببینید و با اطمینان انتخاب کنید.' },
 { n: '۰۲', t: 'کلاس واقعی، نه فقط ویدیو', d: 'مدرس با دوربین و اشتراک صفحه تدریس می‌کند و شما مستقیم سوال می‌پرسید.' },
 { n: '۰۳', t: 'پیگیری پیشرفت', d: 'میانگین مطالعه، پیشرفت دوره و امتیاز تمرین‌ها در پنل شما ثبت می‌شود.' },
 { n: '۰۴', t: 'گواهی‌نامه معتبر', d: 'گواهی پایان دوره با کد یکتا و قابل استعلام برای رزومه و استخدام.' },
 { n: '۰۵', t: 'مدرس‌مارکت یکپارچه', d: 'لوازم‌التحریر موردنیاز دوره‌ها را همان‌جا سفارش دهید.' },
 { n: '۰۶', t: 'پشتیبانی واقعی', d: 'تیکت، چت و تلفن؛ تیم پشتیبانی ما پاسخ‌گوست، نه ربات.' },
 ].map((x, i) => (
 <Reveal key={x.n} delay={i * 70}>
 <div className="card pad" style={{ height: '100%' }}>
 <span className="grad-text" style={{ fontSize: 30, fontWeight: 900, fontFamily: 'inherit', background: 'var(--grad)', WebkitBackgroundClip: 'text', color: 'transparent' }}>{x.n}</span>
 <h3 style={{ fontSize: 16, margin: '8px 0' }}>{x.t}</h3>
 <p className="muted small">{x.d}</p>
 </div>
 </Reveal>
 ))}
 </div>
 </div>
 </section>

 {/* ===== مدرس‌مارکت ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head right">
 <span className="kicker"><Icon name="box" size={14} /> مدرس‌مارکت</span>
 <h2>پرفروش‌های لوازم‌التحریر</h2>
 </Reveal>
 <div className="grids g4">
 {market.map((p) => <ProductCard key={p.id} product={p} />)}
 </div>
 <div style={{ textAlign: 'center', marginTop: 34 }}>
 <Link to="/market" className="btn btn-ghost">ورود به مدرس‌مارکت <Icon name="chevronLeft" size={16} /></Link>
 </div>
 </div>
 </section>

 {/* ===== نظرات ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head">
 <span className="kicker"><Icon name="heart" size={14} /> نظرات دانشجویان</span>
 <h2>آن‌ها که مسیر را با ما رفتند</h2>
 </Reveal>
 <div className="grids g3">
 {testimonials.slice(0, 6).map((t, i) => (
 <Reveal key={t.name} delay={i * 60}>
 <div className="card testimonial-card" style={{ height: '100%' }}>
 <RatingStars value={t.rating} />
 <p className="quote">«{t.quote}»</p>
 <div className="who">
 <span className={`avatar ${t.color}`} style={{ width: 42, height: 42, fontSize: 14 }}>{t.name[0]}</span>
 <div><b>{t.name}</b><span>{t.role}</span></div>
 </div>
 </div>
 </Reveal>
 ))}
 </div>
 </div>
 </section>

 {/* ===== سوالات متداول ===== */}
 <section className="section" style={{ paddingTop: 0 }}>
 <div className="container">
 <Reveal className="sec-head">
 <span className="kicker"><Icon name="chat" size={14} /> سوالات متداول</span>
 <h2>پاسخ سریع به پرسش‌های رایج</h2>
 </Reveal>
 <Reveal><FAQ /></Reveal>
 </div>
 </section>

 {/* ===== CTA ===== */}
 <section className="section-sm">
 <div className="container">
 <Reveal className="cta-band">
 <h2>آماده شروع مسیر یادگیری هستید؟</h2>
 <p>همین حالا ثبت‌نام کنید و اولین کلاس زنده خود را رایگان تجربه کنید.</p>
 <div className="row g12" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
 <Link to="/auth" className="btn btn-primary btn-lg">ثبت‌نام رایگان</Link>
 <Link to="/contact" className="btn btn-ghost btn-lg">مشاوره و تماس با ما</Link>
 </div>
 </Reveal>
 </div>
 </section>
 </>
 )
}
