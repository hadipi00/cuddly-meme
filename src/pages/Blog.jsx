import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import Icon from '../components/Icon'
import SmartImg from '../components/SmartImg'
import { DataIcon } from '../utils/icons'
import { Reveal } from '../components/ui'
import { blogPosts } from '../data/mock'

export default function Blog() {
 return (
 <>
 <Seo
  title="بلاگ آموزشی"
  description="مقالات روش مطالعه، بهره‌وری، برنامه‌نویسی و آموزش آنلاین — راهنمای یادگیری بهتر در مدرس‌یار."
 />
 <section className="page-hero" >
 <div className="container">
 <div className="breadcrumb"><Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} /> <span>وبلاگ</span></div>
 <h1>وبلاگ <span className="text-teal">مدرس‌یار</span></h1>
 <p className="muted">مقالات آموزشی، تکنیک‌های مطالعه و اخبار آکادمی</p>
 </div>
 </section>
 <section className="section-sm container" style={{ paddingTop: 10 }}>
 <div className="grids g3">
 {blogPosts.map((p, i) => (
 <Reveal key={p.id} delay={(i % 3) * 70}>
 <Link to={`/blog/${p.id}`}>
 <div className="card course-card" style={{ height: '100%' }}>
 <div className={`c-thumb ${p.color}`} style={{ height: 140 }}>
 <SmartImg
  src={`/images/blog/b${p.id.replace('b', '')}.jpg`}
  alt={`${p.title} — بلاگ مدرس‌یار`}
  width={672}
  height={280}
  fallback={<span className="c-emoji" style={{ fontSize: 46 }}><DataIcon name={p.icon} size={46} /></span>}
 />
 <span className="badge b-gray c-level">{p.cat}</span>
 </div>
 <div className="c-body">
 <h3 style={{ fontSize: 15.5 }}>{p.title}</h3>
 <p className="muted small">{p.excerpt}</p>
 <div className="c-meta">
 <span><Icon name="calendar" size={13} /> {p.date}</span>
 <span><Icon name="clock" size={13} /> {p.read} دقیقه مطالعه</span>
 </div>
 </div>
 </div>
 </Link>
 </Reveal>
 ))}
 </div>
 </section>
 </>
 )
}
