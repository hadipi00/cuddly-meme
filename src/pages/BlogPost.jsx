import { useParams, Link } from 'react-router-dom'
import { DataIcon } from '../utils/icons'
import Icon from '../components/Icon'
import { blogPosts } from '../data/mock'
import { useApp } from '../store/AppContext'

export default function BlogPost() {
 const { id } = useParams()
 const post = blogPosts.find((p) => p.id === id)
 const { toast } = useApp()
 if (!post) return <div className="container section"><div className="empty"><p>مقاله یافت نشد.</p></div></div>

 return (
 <>
 <section className="page-hero" style={{ paddingBottom: 16 }}>
 <div className="container">
 <div className="breadcrumb">
 <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} />
 <Link to="/blog">وبلاگ</Link> <Icon name="chevronLeft" size={13} /> <span>{post.title}</span>
 </div>
 </div>
 </section>

 <article className="container" style={{ maxWidth: 820 }}>
 <div className={`card p-thumb ${post.color}`} style={{ height: 260, borderRadius: 22 }}>
 <span className="p-emoji" style={{ fontSize: 84 }}><DataIcon name={post.icon} size={84} /></span>
 </div>
 <span className="kicker mt24">{post.cat}</span>
 <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', marginBlock: '10px 8px' }}>{post.title}</h1>
 <div className="row g16 muted small mb24">
 <span><Icon name="calendar" size={14} /> {post.date}</span>
 <span><Icon name="clock" size={14} /> {post.read} دقیقه مطالعه</span>
 </div>
 <div className="card pad" style={{ lineHeight: 2.3 }}>
 <p className="muted">{post.excerpt}</p>
 <p className="mt16">یادگیری مؤثر هیچ‌وقت اتفاقی رخ نمی‌دهد؛ نتیجه‌ی روش درست، تمرین مداوم و محیط مناسب است. در مدرس‌یار ما سال‌هاست روی همین سه ضلع کار می‌کنیم و مشاهدات ما از هزاران دانشجو نشان می‌دهد که کوچک‌ترین تغییرات، بزرگ‌ترین نتایج را می‌سازند.</p>
 <h3 className="mt24 mb16">۱. از خواندن منفعل به بازیابی فعال</h3>
 <p className="muted">به‌جای خواندن چندباره متن، کتاب را ببندید و سعی کنید مطلب را از حافظه بازسازی کنید. این تکنیک که «بازیابی فعال» نام دارد، طبق پژوهش‌ها تا دو برابر مؤثرتر از مرور معمولی است.</p>
 <h3 className="mt24 mb16">۲. فاصله‌گذاری در مرور</h3>
 <p className="muted">مرور را در بازه‌های افزایشی انجام دهید: فردا، سه روز بعد، یک هفته بعد و یک ماه بعد. جدول هفتگی پنل دانش‌آموزی مدرس‌یار دقیقاً برای همین طراحی شده است.</p>
 <h3 className="mt24 mb16">۳. تمرین در شرایط واقعی</h3>
 <p className="muted">اگر هدف قبولی در آزمون است، خود را در همان شرایط بسنجید؛ با زمان‌سنج، بدون جزوه و با برگه پاسخ. کلاس‌های آزمونک هفتگی ما همین کار را انجام می‌دهند.</p>
 <blockquote style={{ borderInlineStart: '3px solid var(--teal)', paddingInlineStart: 16, marginBlock: 24, color: 'var(--text)', fontWeight: 700 }}>
 «نظم کوچکِ هر روز، از پشتکار بزرگِ بعضی روزها قدرتمندتر است.»
 </blockquote>
 <p className="muted">در پایان، یادتان باشد ابزار هم مهم است: یک دفتر خوب و یک خودنویس راحت، انگیزه مطالعه را واقعاً بالا می‌برد. پیشنهاد ما؟ سری به <Link to="/market" className="text-teal">مدرس‌مارکت</Link> بزنید!</p>
 </div>
 <button className="btn btn-ghost mt24" onClick={() => toast('امکان اشتراک‌گذاری در نسخه دمو فعال نیست', 'info')}>
 <Icon name="send" /> اشتراک‌گذاری مقاله
 </button>
 </article>
 </>
 )
}
