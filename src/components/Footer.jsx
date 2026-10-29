import { Link } from 'react-router-dom'
import Icon from './Icon'
import { Brand } from './ui'
import { site } from '../config/site'
import { useApp } from '../store/AppContext'

export default function Footer() {
  const { toast } = useApp()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="about-txt">{site.desc}</p>
            <div className="socials">
              {site.socials.map((s) => (
                <button key={s.label} className="icon-btn" onClick={() => toast('این لینک در نسخه دمو فعال نیست', 'info')} aria-label={s.label}>
                  <Icon name={s.icon} size={17} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4>دسترسی سریع</h4>
            <div className="footer-links">
              <Link to="/courses">دوره‌های ضبط‌شده</Link>
              <Link to="/live">کلاس‌های آنلاین</Link>
              <Link to="/market">مدرس‌مارکت</Link>
              <Link to="/teachers">اساتید</Link>
            </div>
          </div>
          <div>
            <h4>پنل‌های کاربری</h4>
            <div className="footer-links">
              <Link to="/auth?role=student">ورود دانش‌آموزان</Link>
              <Link to="/auth?role=teacher">ورود مدرسان</Link>
              <Link to="/auth?role=admin">ورود مدیریت</Link>
              <Link to="/resume">درباره مدرس‌یار</Link>
            </div>
          </div>
          <div>
            <h4>خبرنامه مدرس‌یار</h4>
            <p className="about-txt">جدیدترین دوره‌ها و کدهای تخفیف را دریافت کنید.</p>
            <div className="newsletter">
              <input className="input" placeholder="ایمیل شما…" />
              <button className="btn btn-primary btn-sm" onClick={() => toast('عضویت شما در خبرنامه ثبت شد')}>عضویت</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© ۱۴۰۴ مدرس‌یار — تمام حقوق محفوظ است.</span>
          <span>ساخته‌شده با ❤️ برای جامعه آموزشی ایران</span>
        </div>
      </div>
    </footer>
  )
}
