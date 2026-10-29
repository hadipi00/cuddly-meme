import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { sysLogs } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { site } from '../../config/site'

const sections = [
  { key: 'general', icon: 'settings', label: 'عمومی' },
  { key: 'payment', icon: 'creditCard', label: 'درگاه پرداخت' },
  { key: 'sms', icon: 'send', label: 'پیامک' },
  { key: 'roles', icon: 'shield', label: 'نقش‌ها و دسترسی' },
  { key: 'logs', icon: 'activity', label: 'لاگ سیستم' },
]

const perms = [
  ['مدیریت دوره‌ها', true, false, false],
  ['مدیریت کلاس زنده', true, true, false],
  ['برگزاری کلاس زنده', true, true, false],
  ['ورود به کلاس زنده', true, true, true],
  ['مدیریت محصولات فروشگاه', true, false, false],
  ['ثبت سفارش فروشگاه', true, true, true],
  ['مشاهده گزارش مالی کل', true, false, false],
  ['مشاهده درآمد خود', true, true, false],
  ['تأیید نظرات', true, false, false],
  ['ارسال تیکت پشتیبانی', true, true, true],
  ['ساخت اکانت مدرس', true, false, false],
  ['مدیریت کدهای تخفیف', true, false, false],
]

export default function ASettings() {
  const { toast } = useApp()
  const [sec, setSec] = useState('general')

  const save = () => toast('تنظیمات ذخیره شد ✅')

  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>تنظیمات سیستم</h2>
          <span className="muted small">پیکربندی سایت، درگاه پرداخت، پیامک، دسترسی‌ها و لاگ رویدادها</span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-nav">
          {sections.map((s) => (
            <button key={s.key} className={sec === s.key ? 'on' : ''} onClick={() => setSec(s.key)}>
              <Icon name={s.icon} /> {s.label}
            </button>
          ))}
        </div>

        <div>
          {sec === 'general' && (
            <div className="card pad">
              <h3 className="mb16">تنظیمات عمومی سایت</h3>
              <div className="field"><label>نام سایت</label><input className="input" defaultValue={site.name} /></div>
              <div className="field-row">
                <div className="field"><label>تلفن پشتیبانی</label><input className="input" defaultValue={site.phone} /></div>
                <div className="field"><label>ایمیل</label><input className="input" defaultValue={site.email} /></div>
              </div>
              <div className="field"><label>آدرس دفتر</label><input className="input" defaultValue={site.address} /></div>
              <div className="field"><label>ساعات کاری</label><input className="input" defaultValue={site.workingHours} /></div>
              <div className="toggle-row"><div><b>حالت تعمیر و نگهداری</b><p>در صورت فعال‌سازی، سایت عمومی برای کاربران عادی بسته می‌شود</p></div>
                <Toggle id="mnt" /></div>
              <div className="toggle-row"><div><b>فعال‌سازی ثبت‌نام دانشجو</b><p>اجازه ساخت حساب جدید توسط کاربران</p></div>
                <Toggle id="reg" defaultOn /></div>
              <button className="btn btn-primary mt16" onClick={save}><Icon name="check" size={16} /> ذخیره</button>
            </div>
          )}

          {sec === 'payment' && (
            <div className="card pad">
              <h3 className="mb16">درگاه‌های پرداخت</h3>
              <div className="field-row">
                <div className="field"><label>درگاه اصلی</label>
                  <select className="select" defaultValue="زرین‌پال"><option>زرین‌پال</option><option>درگاه ملت</option><option>درگاه سامان</option><option>آیدی‌پی</option></select>
                </div>
                <div className="field"><label>واحد پول</label><select className="select"><option>تومان</option><option>ریال</option></select></div>
              </div>
              <div className="field"><label>مرچنت‌کد (Merchant ID)</label><input className="input" dir="ltr" defaultValue="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
              <div className="field"><label>کلید API درگاه دوم</label><input className="input" dir="ltr" placeholder="در صورت داشتن درگاه پشتیبان" /></div>
              <div className="toggle-row"><div><b>حالت تست (Sandbox)</b><p>پرداخت واقعی انجام نمی‌شود — برای تست فرانت</p></div><Toggle id="sb" defaultOn /></div>
              <div className="toggle-row"><div><b>کشف خودکار تراکنش‌های معلق</b><p>بررسی دوره‌ای پرداخت‌های نیمه‌کاره هر ۱۰ دقیقه</p></div><Toggle id="au" defaultOn /></div>
              <button className="btn btn-primary mt16" onClick={save}><Icon name="check" size={16} /> ذخیره</button>
            </div>
          )}

          {sec === 'sms' && (
            <div className="card pad">
              <h3 className="mb16">تنظیمات پیامک</h3>
              <div className="field-row">
                <div className="field"><label>سرویس‌دهنده</label>
                  <select className="select"><option>کاوه‌نگار</option><option>ملی پیامک</option><option>پیامک آسان</option></select>
                </div>
                <div className="field"><label>شماره فرستنده</label><input className="input" dir="ltr" defaultValue="50004001234567" /></div>
              </div>
              <div className="field"><label>کلید API</label><input className="input" dir="ltr" defaultValue="••••••••••••••••" /></div>
              <h4 className="mb16 mt16" style={{ fontSize: 14 }}>رویدادهای ارسال پیامک</h4>
              {[
                ['ثبت‌نام موفق', 'خوش‌آمد + کد فعال‌سازی'],
                ['یادآوری کلاس زنده', '۳۰ دقیقه قبل از شروع با لینک ورود'],
                ['تأیید سفارش مدرس‌مارکت', 'کد سفارش + کد رهگیری پست'],
                ['صدور گواهی‌نامه', 'لینک دانلود گواهی'],
              ].map(([t, d], i) => <ToggleRow key={t} t={t} d={d} defaultOn={i !== 3} />)}
              <button className="btn btn-primary mt16" onClick={save}><Icon name="check" size={16} /> ذخیره</button>
            </div>
          )}

          {sec === 'roles' && (
            <div className="card pad">
              <h3 className="mb16">ماتریس دسترسی نقش‌ها</h3>
              <div className="dtable-wrap">
                <table className="matrix-table">
                  <thead><tr><th>قابلیت</th><th>مدیر</th><th>مدرس</th><th>دانش‌آموز</th></tr></thead>
                  <tbody>
                    {perms.map(([label, a, t, s]) => (
                      <tr key={label}>
                        <td className="cell-strong">{label}</td>
                        {[a, t, s].map((on, i) => (
                          <td key={i}><input type="checkbox" className="matrix-check" defaultChecked={on} disabled={i === 0} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small mt16">دسترسی مدیر همیشه کامل است و قابل تغییر نیست.</p>
              <button className="btn btn-primary mt8" onClick={save}><Icon name="check" size={16} /> ذخیره دسترسی‌ها</button>
            </div>
          )}

          {sec === 'logs' && (
            <div className="card pad">
              <div className="between mb16">
                <h3 style={{ fontSize: 15 }}>لاگ رویدادهای سیستم</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => toast('فایل لاگ کامل دانلود شد (دمو)')}><Icon name="download" size={14} /> دانلود کامل</button>
              </div>
              <DataTable
                columns={[
                  { key: 'date', label: 'زمان' },
                  { key: 'action', label: 'رویداد', render: (r) => <span className="cell-strong">{r.action}</span> },
                  { key: 'user', label: 'کاربر' },
                  { key: 'ip', label: 'IP', render: (r) => <span className="muted small" dir="ltr">{r.ip}</span> },
                  { key: 'level', label: 'سطح', render: (r) => (
                    r.level === 'error' ? <span className="badge b-red">خطا</span>
                      : r.level === 'warn' ? <span className="badge b-amber">هشدار</span>
                        : r.level === 'success' ? <span className="badge b-green">موفق</span>
                          : <span className="badge b-gray">اطلاع</span>
                  ) },
                ]}
                rows={sysLogs}
                searchKeys={['action', 'user', 'ip']}
                pageSize={6}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Toggle({ id, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <label className="switch">
      <input type="checkbox" checked={on} onChange={() => setOn(!on)} />
      <i />
    </label>
  )
}

function ToggleRow({ t, d, defaultOn = true }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="toggle-row">
      <div><b>{t}</b><p>{d}</p></div>
      <label className="switch">
        <input type="checkbox" checked={on} onChange={() => setOn(!on)} />
        <i />
      </label>
    </div>
  )
}
