import { useParams, Link } from 'react-router-dom'
import Seo, { ORIGIN, crumbsJsonLd } from '../components/Seo'
import Icon from '../components/Icon'
import { DataIcon } from '../utils/icons'
import { Reveal, RatingStars, Avatar } from '../components/ui'
import { CourseCard } from '../components/cards'
import { teachers, courses, liveClasses } from '../data/mock'
import { DAYS, faNum } from '../utils/format'

export default function TeacherProfile() {
 const { id } = useParams()
 const t = teachers.find((x) => x.id === id)
 if (!t) return <div className="container section"><div className="empty"><p>مدرس یافت نشد.</p></div></div>
 const myCourses = courses.filter((c) => c.teacherId === id)
 const myLives = liveClasses.filter((l) => l.teacherId === id)

 return (
 <>
 {t && (
  <Seo
   title={t.name}
   description={t.bio}
   path={`/teachers/${t.id}`}
   keywords={`${t.name}, ${t.role}, مدرس, رزرو کلاس`}
   jsonLd={[
    crumbsJsonLd([['صفحه نخست', '/'], ['اساتید', '/teachers'], [t.name, `/teachers/${t.id}`]]),
    {
     '@context': 'https://schema.org',
     '@type': 'Person',
     name: t.name,
     description: t.bio,
     jobTitle: t.role,
     image: `${ORIGIN}/og-cover.jpg`,
     worksFor: { '@type': 'Organization', name: 'مدرس‌یار', url: ORIGIN },
     knowsAbout: (t.skills || []).map((s) => s[0]),
    },
   ]}
  />
 )}
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb">
 <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} />
 <Link to="/teachers">اساتید</Link> <Icon name="chevronLeft" size={13} /> <span>{t.name}</span>
 </div>
 </div>
 </section>

 <section className="container section-sm" style={{ paddingTop: 0 }}>
 <div className="detail-layout">
 <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
 <Reveal className="card pad">
 <div className="row g16" style={{ alignItems: 'flex-start' }}>
 <Avatar name={t.name} color={t.color} size={96} />
 <div style={{ flex: 1 }}>
 <h1 style={{ fontSize: 24 }}>{t.name}</h1>
 <div className="pc-role">{t.role}</div>
 <div className="row g16 wrap">
 <RatingStars value={t.rating} showNum />
 <span className="badge b-gray">عضویت از {t.joined}</span>
 </div>
 <p className="muted mt16" style={{ lineHeight: 2.1 }}>{t.bio}</p>
 </div>
 </div>
 <div className="stats-band mt24" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
 <div><b>{t.students.toLocaleString('fa-IR')}+</b><span>دانشجو</span></div>
 <div><b>{faNum(t.classesCount)}</b><span>کلاس برگزارشده</span></div>
 <div><b>{myCourses.length.toLocaleString('fa-IR')}</b><span>دوره فعال</span></div>
 </div>
 </Reveal>

 <Reveal className="card pad">
 <h3 className="mb16">تخصص‌ها</h3>
 {t.skills.map(([s, v]) => (
 <div className="skill-row" key={s}>
 <div className="between"><b>{s}</b><span>{faNum(v)}٪</span></div>
 <div className="progress"><i style={{ width: `${v}%` }} /></div>
 </div>
 ))}
 </Reveal>

 {myCourses.length > 0 && (
 <Reveal>
 <h3 className="mb16">دوره‌های این مدرس</h3>
 <div className="grids g3">{myCourses.map((c) => <CourseCard key={c.id} course={c} />)}</div>
 </Reveal>
 )}

 {myLives.length > 0 && (
 <Reveal>
 <h3 className="mb16">کلاس‌های زنده پیش‌رو</h3>
 <div className="grids g2">
 {myLives.map((l) => (
 <div className="card pad" key={l.id}>
 <div className="between mb8">
 <b className="small"><DataIcon name={l.icon} size={14} /> {l.title}</b>
 <span className={`badge ${l.status === 'full' ? 'b-red' : 'b-green'}`}>{l.status === 'full' ? 'تکمیل' : 'باز'}</span>
 </div>
 <span className="muted small">{DAYS[l.day]} — ساعت {l.start}</span>
 </div>
 ))}
 </div>
 </Reveal>
 )}
 </div>

 <div className="detail-side">
 <div className="card pad">
 <h4 className="mb16" style={{ fontSize: 15 }}>اطلاعات تماس آموزشی</h4>
 <div className="pc-info">
 <div><Icon name="clock" /> جلسات رفع اشکال: پنجشنبه‌ها</div>
 <div><Icon name="chat" /> پاسخ به تیکت: حداکثر ۲۴ ساعت</div>
 <div><Icon name="video" /> کلاس‌ها: سامانه زنده مدرس‌یار</div>
 </div>
 <Link to="/auth" className="btn btn-primary btn-block mt16"><Icon name="cap" /> ثبت‌نام در کلاس‌ها</Link>
 </div>
 </div>
 </div>
 </section>
 </>
 )
}
