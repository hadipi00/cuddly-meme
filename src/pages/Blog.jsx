import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Reveal } from '../components/ui'
import { blogPosts } from '../data/mock'

export default function Blog() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>وبلاگ</span></div>
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
                    <span className="c-emoji" style={{ fontSize: 46 }}>{p.emoji}</span>
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
