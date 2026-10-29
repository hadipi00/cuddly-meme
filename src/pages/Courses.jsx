import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { Reveal } from '../components/ui'
import { CourseCard } from '../components/cards'
import { courses, courseCats } from '../data/mock'

export default function Courses() {
 const [cat, setCat] = useState('همه')
 const [q, setQ] = useState('')
 const [sort, setSort] = useState('محبوب‌ترین')

 const list = useMemo(() => {
 let out = courses
 if (cat !== 'همه') out = out.filter((c) => c.cat === cat)
 if (q.trim()) out = out.filter((c) => c.title.includes(q.trim()) || c.teacher.includes(q.trim()))
 if (sort === 'محبوب‌ترین') out = [...out].sort((a, b) => b.students - a.students)
 if (sort === 'ارزان‌ترین') out = [...out].sort((a, b) => a.price - b.price)
 if (sort === 'گران‌ترین') out = [...out].sort((a, b) => b.price - a.price)
 if (sort === 'بالاترین امتیاز') out = [...out].sort((a, b) => b.rating - a.rating)
 return out
 }, [cat, q, sort])

 return (
 <>
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>دوره‌های ضبط‌شده</span></div>
 <h1>دوره‌های <span className="text-teal">ضبط‌شده</span></h1>
 <p className="muted">دسترسی مادام‌العمر، تمرین و آزمون، گواهی‌نامه پایان دوره — یادگیری با سرعت خودتان.</p>
 </div>
 </section>

 <section className="section-sm container" style={{ paddingTop: 10 }}>
 <div className="filter-bar">
 <div className="search-box">
 <Icon name="search" />
 <input className="input" placeholder="جستجو در دوره‌ها…" value={q} onChange={(e) => setQ(e.target.value)} />
 </div>
 <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }}>
 {['محبوب‌ترین', 'ارزان‌ترین', 'گران‌ترین', 'بالاترین امتیاز'].map((s) => <option key={s}>{s}</option>)}
 </select>
 </div>

 <div className="row wrap g8 mb24">
 {['همه', ...courseCats].map((c) => (
 <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
 ))}
 </div>

 {list.length === 0 ? (
 <div className="empty"><Icon name="search" size={44} /><p>دوره‌ای با این مشخصات پیدا نشد.</p></div>
 ) : (
 <div className="grids g4">
 {list.map((c, i) => <Reveal key={c.id} delay={(i % 4) * 60}><CourseCard course={c} /></Reveal>)}
 </div>
 )}
 </section>
 </>
 )
}
