import { Link } from 'react-router-dom'

/** صفحه ۴۰۴ — برای هر آدرس ناشناخته (در کل سایت) */
export default function NotFound() {
  return (
    <section className="nf-wrap container">
      <div>
        <div className="kicker"><span>خطای مسیر</span></div>
        <div className="nf-code" aria-hidden="true">۴۰۴</div>
        <h1 style={{ fontSize: 'clamp(22px, 3vw, 32px)', margin: '10px 0 12px' }}>
          صفحه‌ای که دنبالش بودید پیدا نشد!
        </h1>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 30px', lineHeight: 2 }}>
          ممکن است این آدرس جابه‌جا شده یا حذف شده باشد.
          اشکالی ندارد — از دکمه‌های زیر به مسیر درست برمی‌گردید.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">بازگشت به خانه</Link>
          <Link to="/courses" className="btn btn-soft">مشاهده دوره‌ها</Link>
          <Link to="/market" className="btn btn-ghost">مدرس‌مارکت</Link>
        </div>
      </div>
    </section>
  )
}
