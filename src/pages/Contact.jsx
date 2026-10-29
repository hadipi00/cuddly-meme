import { useState } from 'react'
import Icon from '../components/Icon'
import { Reveal } from '../components/ui'
import { site } from '../config/site'
import { useApp } from '../store/AppContext'
import { api } from '../services/api'

export default function Contact() {
 const { toast } = useApp()
 const [sending, setSending] = useState(false)
 const [sent, setSent] = useState(false)

 const submit = async (e) => {
 e.preventDefault()
 setSending(true)
 await api.submitContact(Object.fromEntries(new FormData(e.target)))
 setSending(false)
 setSent(true)
 toast('پیام شما با موفقیت ارسال شد')
 e.target.reset()
 }

 return (
 <>
 <section className="page-hero">
 <div className="container">
 <div className="breadcrumb"><a href="#/">صفحه نخست</a> <Icon name="chevronLeft" size={13} /> <span>تماس با ما</span></div>
 <h1>در <span className="text-teal">تماس</span> باشیم</h1>
 <p className="muted">برای مشاوره انتخاب دوره، همکاری به‌عنوان مدرس یا هر سوال دیگر — پیام بگذارید.</p>
 </div>
 </section>

 <section className="section-sm container" style={{ paddingTop: 10, paddingBottom: 80 }}>
 <div className="contact-grid">
 <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
 <Reveal className="card pad">
 <h3 className="mb16">اطلاعات تماس</h3>
 {[
 { icon: 'phone', t: 'تلفن پشتیبانی', d: site.phone },
 { icon: 'mail', t: 'ایمیل', d: site.email },
 { icon: 'mapPin', t: 'آدرس', d: site.address },
 { icon: 'clock', t: 'ساعات پاسخگویی', d: site.workingHours },
 ].map((x) => (
 <div className="info-tile mb16" key={x.t}>
 <span className="it-icon"><Icon name={x.icon} /></span>
 <div><b>{x.t}</b><p>{x.d}</p></div>
 </div>
 ))}
 </Reveal>
 <Reveal className="map-placeholder">
 <Icon name="mapPin" size={34} />
 <b>نقشه موقعیت آکادمی مدرس‌یار</b>
 <span>در نسخه نهایی، نقشه تعاملی گوگل اینجا قرار می‌گیرد</span>
 </Reveal>
 <Reveal className="card pad">
 <h3 className="mb16" style={{ fontSize: 15 }}>می‌خواهید مدرس شوید؟</h3>
 <p className="muted small" style={{ lineHeight: 2 }}>
 اکانت مدرسان فقط توسط تیم مدیریت ساخته می‌شود. رزومه و نمونه‌کار خود را برای ایمیل ما ارسال کنید؛
 ظرف ۳ روز کاری با شما تماس می‌گیریم.
 </p>
 </Reveal>
 </div>

 <Reveal className="card pad">
 {sent && (
 <div className="demo-banner" style={{ marginBottom: 18 }}>
 <Icon name="check" /> پیام شما ثبت شد؛ به‌زودی پاسخ می‌دهیم.
 </div>
 )}
 <h3 className="mb16">فرم تماس</h3>
 <form onSubmit={submit}>
 <div className="field-row">
 <div className="field"><label>نام و نام خانوادگی</label><input className="input" name="name" required placeholder="نام شما" /></div>
 <div className="field"><label>شماره تماس</label><input className="input" name="phone" required placeholder="۰۹۱۲…" /></div>
 </div>
 <div className="field">
 <label>موضوع</label>
 <select className="select" name="subject">
 {['مشاوره انتخاب دوره', 'همکاری به‌عنوان مدرس', 'پشتیبانی سفارش مدرس‌مارکت', 'سایر موارد'].map((s) => <option key={s}>{s}</option>)}
 </select>
 </div>
 <div className="field"><label>متن پیام</label><textarea className="textarea" name="msg" required placeholder="پیام خود را بنویسید…" /></div>
 <button className="btn btn-primary btn-lg" disabled={sending}>
 {sending ? 'در حال ارسال…' : <><Icon name="send" /> ارسال پیام</>}
 </button>
 </form>
 </Reveal>
 </div>
 </section>
 </>
 )
}
