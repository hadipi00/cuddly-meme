import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { Reveal, RatingStars } from '../components/ui'
import { teachers } from '../data/mock'
import { site } from '../config/site'
import { faNum } from '../utils/format'

export default function Resume() {
 const lead = teachers[0]
 return (
 <>
 <Seo
  title="رزومه و افتخارات"
  description="سابقه، افتخارات و دستاوردهای آکادمی مدرس‌یار — دانلود رزومه رسمی مدرس‌یار."
 />
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb">
 <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} /> <span>رزومه و افتخارات</span>
 </div>
 <h1>رزومه و افتخارات <span className="text-teal">مدرس‌یار</span></h1>
 <p className="muted" style={{ maxWidth: 620 }}>
 یک نگاه کامل به مسیر ما: از شروع در یک کلاس کوچک تا پلتفرمی که هزاران دانشجو را به هدف‌شان رسانده است.
 </p>
 </div>
 </section>

 <section className="section-sm container" style={{ paddingTop: 20 }}>
 <div className="detail-layout">
 {/* ستون اصلی رزومه */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
 <Reveal className="card pad">
 <h3 className="mb16 row g8"><Icon name="user" className="text-teal" /> درباره ما</h3>
 <p className="muted small" style={{ lineHeight: 2.1 }}>
 مدرس‌یار در سال ۱۳۹۶ با یک کلاس کوچک ریاضی در شمال تهران شروع شد. امروز با بیش از {faNum(35)} استاد برتر،
 {faNum(240)} دوره ضبط‌شده و صدها کلاس زنده ماهانه، یکی از کامل‌ترین پلتفرم‌های آموزشی کشور هستیم؛
 جایی که آموزش آنلاین فقط «پخش ویدیو» نیست، بلکه تجربه‌ای کامل است: کلاس زنده تعاملی، جدول هفتگی برنامه‌ریزی،
 پیگیری پیشرفت، آزمون و تمرین، گواهی‌نامه معتبر و حتی تأمین لوازم‌التحریر از مدرس‌مارکت.
 </p>
 </Reveal>

 <Reveal className="card pad">
 <h3 className="mb16 row g8"><Icon name="activity" className="text-teal" /> مهارت‌های کلیدی ما</h3>
 {[
 ['آموزش تعاملی آنلاین', 96], ['طراحی مسیر یادگیری', 92], ['تولید محتوای آموزشی', 90], ['پشتیبانی و همراهی دانشجو', 94],
 ].map(([t, v]) => (
 <div className="skill-row" key={t}>
 <div className="between"><b>{t}</b><span>{faNum(v)}٪</span></div>
 <div className="progress"><i style={{ width: `${v}%` }} /></div>
 </div>
 ))}
 </Reveal>

 <Reveal className="card pad">
 <h3 className="mb16 row g8"><Icon name="calendar" className="text-teal" /> سوابق و مسیر رشد</h3>
 <div className="timeline">
 {[
 ['۱۳۹۶ — شروع داستان', 'آکادمی مدرس', 'اولین کلاس حضوری ریاضیات با ۱۲ دانش‌آموز در یک دفتر کوچک.'],
 ['۱۳۹۸ — ورود به فضای آنلاین', 'پلتفرم اولیه', 'راه‌اندازی سامانه کلاس آنلاین اختصاصی و جذب ۵۰۰ دانشجوی اول.'],
 ['۱۴۰۰ — تولد مدرس‌یار', 'برندسازی و توسعه', 'بازطراحی کامل پلتفرم با پنل دانش‌آموز، مدرس و مدیریت و راه‌اندازی مدرس‌مارکت.'],
 ['۱۴۰۲ — جهش', 'جامعه ۱۰ هزار نفری', 'عبور از مرز ۱۰ هزار دانشجوی فعال و برگزاری هزارمین کلاس زنده.'],
 ['۱۴۰۴ — امروز', 'نسخه حرفه‌ای', 'بازطراحی رابط کاربری، جدول هفتگی هوشمند و گزارش میانگین مطالعه.'],
 ].map(([date, org, desc]) => (
 <div className="tl-item" key={date}>
 <span className="tl-date">{date}</span>
 <h4>{org}</h4>
 <p>{desc}</p>
 </div>
 ))}
 </div>
 </Reveal>

 <Reveal className="card pad">
 <h3 className="mb16 row g8"><Icon name="award" className="text-teal" /> افتخارات و گواهی‌نامه‌ها</h3>
 <div className="grids g2">
 {[
 ['', 'برترین استارتاپ آموزشی جشنواره وب و موبایل ایران — ۱۴۰۲'],
 ['', 'رتبه ۱ رضایت کاربران در نظرسنجی ملی آموزش آنلاین — ۱۴۰۳'],
 ['', 'گواهی ISO 29993 خدمات آموزشی غیررسمی'],
 ['', 'بیش از ۹۸٪ رضایت از کیفیت کلاس‌های زنده'],
 ].map(([e, t]) => (
 <div key={t} className="row g12" style={{ alignItems: 'flex-start' }}>
 <span style={{ fontSize: 26 }}>{e}</span>
 <p className="muted small" style={{ lineHeight: 2 }}>{t}</p>
 </div>
 ))}
 </div>
 </Reveal>
 </div>

 {/* ستون کناری — کارت رزومه بنیان‌گذار */}
 <div className="detail-side">
 <Reveal className="card">
 <div className="pc-top" style={{ border: 'none' }}>
 <div className="pc-banner" style={{ height: 90 }} />
 <div className="pc-body">
 <div className="pc-avatar" style={{ width: 92, height: 92, fontSize: 32 }}>ر‌ک</div>
 <div className="pc-name" style={{ fontSize: 18 }}>{lead.name}</div>
 <div className="pc-role">بنیان‌گذار و مدرس ارشد</div>
 <p className="pc-bio">{lead.bio}</p>
 <div className="row g8 mt16" style={{ justifyContent: 'center' }}>
 <RatingStars value={lead.rating} showNum />
 </div>
 <div className="pc-info">
 <div><Icon name="users" /> {lead.students.toLocaleString('fa-IR')} دانشجو</div>
 <div><Icon name="video" /> {faNum(lead.classesCount)} کلاس برگزارشده</div>
 <div><Icon name="mapPin" /> {site.address}</div>
 <div><Icon name="mail" /> {site.email}</div>
 </div>
 <div className="pc-tags">
 {lead.skills.map(([s]) => <span className="chip" key={s}>{s}</span>)}
 </div>
 </div>
 </div>
 </Reveal>
 <a href="#" className="btn btn-primary btn-block" onClick={(e) => e.preventDefault()}>
 <Icon name="download" /> دانلود PDF رزومه
 </a>
 </div>
 </div>
 </section>
 </>
 )
}
