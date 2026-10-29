import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Reveal, RatingStars, Avatar } from '../components/ui'
import { teachers } from '../data/mock'
import { faNum } from '../utils/format'

export default function Teachers() {
 const nav = useNavigate()
 const [q, setQ] = useState('')
 const list = teachers.filter((t) => !q.trim() || t.name.includes(q.trim()) || t.role.includes(q.trim()))
 return (
 <>
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>اساتید</span></div>
 <h1>اساتید <span className="text-teal">مدرس‌یار</span></h1>
 <p className="muted">رزومه، تخصص و امتیاز واقعی هر مدرس را قبل از ثبت‌نام ببینید.</p>
 </div>
 </section>

 <section className="section-sm container" style={{ paddingTop: 10 }}>
 <div className="filter-bar">
 <div className="search-box">
 <Icon name="search" />
 <input className="input" placeholder="جستجوی استاد…" value={q} onChange={(e) => setQ(e.target.value)} />
 </div>
 </div>
 <div className="grids g3">
 {list.map((t, i) => (
 <Reveal key={t.id} delay={(i % 3) * 70}>
 <div className="card pad" style={{ height: '100%', textAlign: 'center', cursor: 'pointer' }} onClick={() => nav(`/teachers/${t.id}`)}>
 <Avatar name={t.name} color={t.color} size={86} />
 <h3 style={{ fontSize: 17, margin: '12px 0 2px' }}>{t.name}</h3>
 <div className="pc-role">{t.role}</div>
 <div className="row g12 mt8" style={{ justifyContent: 'center' }}>
 <RatingStars value={t.rating} showNum />
 </div>
 <p className="muted small mt16" style={{ lineHeight: 2 }}>{t.bio}</p>
 <div className="hero-mini-stats mt16" style={{ gap: 24, justifyContent: 'center' }}>
 <div style={{ textAlign: 'center' }}><b style={{ fontSize: 20 }}>{t.students.toLocaleString('fa-IR')}+</b><span>دانشجو</span></div>
 <div style={{ textAlign: 'center' }}><b style={{ fontSize: 20 }}>{faNum(t.classesCount)}</b><span>کلاس</span></div>
 </div>
 <div className="pc-tags">{t.skills.map(([s]) => <span className="chip" key={s}>{s}</span>)}</div>
 </div>
 </Reveal>
 ))}
 </div>
 </section>
 </>
 )
}
