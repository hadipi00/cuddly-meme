import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { sysLogs } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { req } from '../../services/http'
import { site } from '../../config/site'

/* [فیکس F16-d] تنظیمات واقعی — قبلاً «ذخیره» فقط toast جعلی می‌زد و هیچ مقداری
   ذخیره نمی‌شد. حالا: بارگذاری از GET /api/admin/settings + ذخیره PUT.
   بخش عمومی Footer/Contact را واقعاً عوض می‌کند (از /api/settings/public خوانده می‌شود).
   درگاه/پیامک: مقادیر ذخیره‌شده fallback زرین‌پال/ملی‌پیامک‌اند (env اولویت دارد) و
   وضعیت فعلی (payMode/smsConfigured) از سرور نمایش داده می‌شود. */

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

const PAY_MODE_LABEL = {
 mock: 'آزمایشی محلی (بدون مرچنت)',
 sandbox: 'زرین‌پال — Sandbox',
 real: 'زرین‌پال — پرداخت واقعی',
}

export default function ASettings() {
 const { toast } = useApp()
 const [sec, setSec] = useState('general')
 const [s, setS] = useState(null) // مقادیر فرم
 const [meta, setMeta] = useState({ payMode: 'mock', smsConfigured: false })
 const [busy, setBusy] = useState(false)

 useEffect(() => {
 req('/admin/settings').then((r) => {
 setS({
 site_name: r.settings.site_name || site.name,
 site_tagline: r.settings.site_tagline || site.tagline,
 site_phone: r.settings.site_phone || site.phone,
 site_email: r.settings.site_email || site.email,
 site_address: r.settings.site_address || site.address,
 site_working_hours: r.settings.site_working_hours || site.workingHours,
 maintenance_mode: r.settings.maintenance_mode === '1',
 registration_open: r.settings.registration_open !== '',
 zarinpal_merchant: r.settings.zarinpal_merchant || '',
 zarinpal_sandbox: r.settings.zarinpal_sandbox === '1',
 pay_zarinpal_enabled: r.settings.pay_zarinpal_enabled !== '',
 pay_card2card_enabled: r.settings.pay_card2card_enabled !== '',
 c2c_card_number: r.settings.c2c_card_number || '',
 c2c_card_bank: r.settings.c2c_card_bank || '',
 c2c_card_holder: r.settings.c2c_card_holder || '',
 c2c_note: r.settings.c2c_note || '',
 enamad_html: r.settings.enamad_html || '',
 sms_username: r.settings.sms_username || '',
 sms_password: r.settings.sms_password || '',
 sms_from: r.settings.sms_from || '',
 sms_admin: r.settings.sms_admin || '',
 })
 setMeta({ payMode: r.payMode, smsConfigured: r.smsConfigured })
 }).catch((e) => toast(e.message || 'دریافت تنظیمات ناموفق بود', 'error'))
 }, [toast])

 if (!s) return <div className="card pad">در حال بارگذاری تنظیمات…</div>

 const save = async (keys, label) => {
 setBusy(true)
 try {
 const body = {}
 for (const k of keys) {
 const v = s[k]
 body[k] = typeof v === 'boolean' ? (v ? '1' : '') : v
 }
 await req('/admin/settings', { method: 'PUT', body })
 toast(`${label} ذخیره شد`)
 } catch (e) { toast(e.message || 'ذخیره ناموفق بود', 'error') }
 finally { setBusy(false) }
 }

 return (
 <div data-tx-skip>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>تنظیمات سیستم</h2>
 <span className="muted small">پیکربندی واقعی سایت، درگاه پرداخت و پیامک — متصل به دیتابیس</span>
 </div>
 </div>

 <div className="settings-grid">
 <div className="settings-nav">
 {sections.map((sec0) => (
 <button key={sec0.key} className={sec === sec0.key ? 'on' : ''} onClick={() => setSec(sec0.key)}>
 <Icon name={sec0.icon} /> {sec0.label}
 </button>
 ))}
 </div>

 <div>
 {sec === 'general' && (
 <div className="card pad">
 <h3 className="mb16">تنظیمات عمومی سایت</h3>
 <div className="field"><label>نام سایت</label><input className="input" value={s.site_name} onChange={(e) => setS({ ...s, site_name: e.target.value })} /></div>
 <div className="field"><label>شعار (زیر عنوان)</label><input className="input" value={s.site_tagline} onChange={(e) => setS({ ...s, site_tagline: e.target.value })} /></div>
 <div className="field-row">
 <div className="field"><label>تلفن پشتیبانی</label><input className="input" value={s.site_phone} onChange={(e) => setS({ ...s, site_phone: e.target.value })} /></div>
 <div className="field"><label>ایمیل</label><input className="input" dir="ltr" value={s.site_email} onChange={(e) => setS({ ...s, site_email: e.target.value })} /></div>
 </div>
 <div className="field"><label>آدرس دفتر</label><input className="input" value={s.site_address} onChange={(e) => setS({ ...s, site_address: e.target.value })} /></div>
 <div className="field"><label>ساعات کاری</label><input className="input" value={s.site_working_hours} onChange={(e) => setS({ ...s, site_working_hours: e.target.value })} /></div>
 <div className="field"><label>کد نماد اعتماد اینماد (HTML رسمی از پنل enamad.ir — در پاورقی همه صفحات نمایش داده می‌شود)</label>
  <textarea className="input" dir="ltr" rows={3} placeholder={'<a href="https://trustseal.enamad.ir/?id=ID&Code=CODE" target="_blank" referrerpolicy="origin"><img src="https://trustseal.enamad.ir/logo.aspx?id=ID&Code=CODE" alt="اینماد" /></a>'}
   value={s.enamad_html} onChange={(e) => setS({ ...s, enamad_html: e.target.value })} />
  <p className="muted small mt8">پس از ثبت‌نام و تأیید در enamad.ir، از «دریافت کد نماد» کد HTML را عیناً همین‌جا بچسبانید تا به‌جای کاشی جایگاه، نشان واقعی اینماد در فوتر نمایش داده شود. تا آن زمان یک کاشی سفید جایگاه‌نما در فوتر دیده می‌شود.</p>
 </div>
 <div className="toggle-row"><div><b>حالت تعمیر و نگهداری</b><p>در صورت فعال‌سازی، پیام تعمیر در Footer و صفحات عمومی دیده می‌شود</p></div>
 <Toggle on={s.maintenance_mode} onChange={(v) => setS({ ...s, maintenance_mode: v })} /></div>
 <div className="toggle-row"><div><b>فعال‌سازی ثبت‌نام دانشجو</b><p>اجازه ساخت حساب جدید توسط کاربران</p></div>
 <Toggle on={s.registration_open} onChange={(v) => setS({ ...s, registration_open: v })} /></div>
 <button className="btn btn-primary mt16" disabled={busy} onClick={() => save(['site_name', 'site_tagline', 'site_phone', 'site_email', 'site_address', 'site_working_hours', 'maintenance_mode', 'registration_open', 'enamad_html'], 'تنظیمات عمومی')}>
 <Icon name="check" size={16} /> {busy ? 'در حال ذخیره…' : 'ذخیره'}
 </button>
 <p className="muted small mt8">نام/تلفن/ایمیل/آدرس ذخیره‌شده بلافاصله در Footer و صفحه تماس همه کاربران اعمال می‌شود.</p>
 </div>
 )}

 {sec === 'payment' && (
 <div className="card pad">
 <h3 className="mb16">روش‌های پرداخت</h3>
 <div className="badge b-teal mb16" style={{ maxWidth: 300 }}>
 وضعیت فعلی: {PAY_MODE_LABEL[meta.payMode] || meta.payMode}
 </div>

 <div className="toggle-row"><div><b>درگاه زرین‌پال</b><p>پرداخت آنلاین با درگاه بانکی — مرچنت و حالت سندباکس/واقعی در پایین</p></div>
 <Toggle on={s.pay_zarinpal_enabled} onChange={(v) => setS({ ...s, pay_zarinpal_enabled: v })} /></div>
 <div className="toggle-row"><div><b>کارت به کارت</b><p>واریز به کارت سایت (مثلاً رایگان از طریق اپ بله‌پی) + آپلود رسید + تأیید مدیر در پنل مالی</p></div>
 <Toggle on={s.pay_card2card_enabled} onChange={(v) => setS({ ...s, pay_card2card_enabled: v })} /></div>

 <h3 className="mt24 mb16">درگاه زرین‌پال</h3>
 <div className="field"><label>مرچنت‌کد (Merchant ID) — UUID ۳۶ کاراکتری</label>
 <input className="input" dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 value={s.zarinpal_merchant} onChange={(e) => setS({ ...s, zarinpal_merchant: e.target.value })} />
 </div>
 <div className="toggle-row"><div><b>حالت Sandbox</b><p>پرداخت واقعی انجام نمی‌شود — با مرچنت آزمایشی زرین‌پال تست کنید (sandbox.zarinpal.com)</p></div>
 <Toggle on={s.zarinpal_sandbox} onChange={(v) => setS({ ...s, zarinpal_sandbox: v })} /></div>
 <div className="toggle-row"><div><b>کشف خودکار تراکنش‌های معلق</b><p>سوییپ دوره‌ای پرداخت‌های رهاشده — همیشه فعال است (سرورمحور)</p></div>
 <Toggle on onChange={() => {}} /></div>
 <button className="btn btn-primary mt16" disabled={busy} onClick={() => save(['pay_zarinpal_enabled', 'pay_card2card_enabled', 'zarinpal_merchant', 'zarinpal_sandbox'], 'تنظیمات درگاه')}>
 <Icon name="check" size={16} /> {busy ? 'در حال ذخیره…' : 'ذخیرهٔ روش‌ها و درگاه'}
 </button>
 <p className="muted small mt8">
 مرچنت ذخیره‌شده در دیتابیس fallback env است؛ تا وقتی خالی باشد سرور در حالت mock می‌ماند.
 روش غیرفعال‌شده بلافاصله از صفحهٔ تسویهٔ کاربران حذف می‌شود.
 </p>

 <h3 className="mt24 mb16">کارت به کارت — اطلاعات کارت سایت</h3>
 <div className="field-row">
 <div className="field"><label>شماره کارت</label><input className="input" dir="ltr" placeholder="6037-9976-0000-0000"
 value={s.c2c_card_number} onChange={(e) => setS({ ...s, c2c_card_number: e.target.value })} /></div>
 <div className="field"><label>بانک</label><input className="input" placeholder="مثلاً بانک ملی"
 value={s.c2c_card_bank} onChange={(e) => setS({ ...s, c2c_card_bank: e.target.value })} /></div>
 </div>
 <div className="field"><label>به نام (صاحب حساب)</label><input className="input" placeholder="مثلاً مؤسسه آموزشی مدرس‌یار"
 value={s.c2c_card_holder} onChange={(e) => setS({ ...s, c2c_card_holder: e.target.value })} /></div>
 <div className="field"><label>راهنمای نمایش به خریدار</label><input className="input" placeholder="مثلاً: واریز از طریق اپ بله‌پی رایگان است — بعد از واریز رسید را آپلود کنید"
 value={s.c2c_note} onChange={(e) => setS({ ...s, c2c_note: e.target.value })} /></div>
 <button className="btn btn-primary mt16" disabled={busy} onClick={() => save(['c2c_card_number', 'c2c_card_bank', 'c2c_card_holder', 'c2c_note'], 'اطلاعات کارت‌به‌کارت')}>
 <Icon name="check" size={16} /> {busy ? 'در حال ذخیره…' : 'ذخیرهٔ اطلاعات کارت'}
 </button>
 <p className="muted small mt8">این اطلاعات در صفحهٔ تسویه و صفحهٔ رسید کارت‌به‌کارت به خریدار نشان داده می‌شود. رسیدهای آپلودشده در پنل ← مدیریت مالی ← رسیدهای کارت‌به‌کارت تأیید می‌شوند.</p>
 </div>
 )}

 {sec === 'sms' && (
 <div className="card pad">
 <h3 className="mb16">تنظیمات پیامک — ملی پیامک</h3>
 <div className={`badge ${meta.smsConfigured ? 'b-green' : 'b-amber'} mb16`} style={{ maxWidth: 260 }}>
 {meta.smsConfigured ? 'پیامک پیکربندی شده و فعال است' : 'پیکربندی نشده — پیام‌ها فقط لاگ می‌شوند'}
 </div>
 <div className="field-row">
 <div className="field"><label>نام کاربری پنل</label><input className="input" dir="ltr" value={s.sms_username} onChange={(e) => setS({ ...s, sms_username: e.target.value })} /></div>
 <div className="field"><label>شماره فرستنده</label><input className="input" dir="ltr" placeholder="50004001…" value={s.sms_from} onChange={(e) => setS({ ...s, sms_from: e.target.value })} /></div>
 </div>
 <div className="field"><label>کلید API وب‌سرویس</label><input className="input" dir="ltr" type="password" placeholder="در پنل: تنظیمات ← وب‌سرویس"
 value={s.sms_password} onChange={(e) => setS({ ...s, sms_password: e.target.value })} /></div>
 <div className="field"><label>موبایل مدیر (اطلاع‌رسانی سفارش)</label><input className="input" dir="ltr" placeholder="09…" value={s.sms_admin} onChange={(e) => setS({ ...s, sms_admin: e.target.value })} /></div>
 <button className="btn btn-primary mt16" disabled={busy} onClick={() => save(['sms_username', 'sms_password', 'sms_from', 'sms_admin'], 'تنظیمات پیامک')}>
 <Icon name="check" size={16} /> {busy ? 'در حال ذخیره…' : 'ذخیره'}
 </button>
 <p className="muted small mt8">رویدادهای پیامکی (خرید موفق، ثبت‌نام کلاس و…) روی همین پیکربندی کار می‌کنند؛ بدون تنظیم، متن پیام فقط در لاگ سرور ثبت می‌شود.</p>
 </div>
 )}

 {sec === 'roles' && (
 <div className="card pad">
 <h3 className="mb16">ماتریس دسترسی نقش‌ها</h3>
 <div className="dtable-wrap">
 <table className="matrix-table">
 <thead><tr><th>قابلیت</th><th>مدیر</th><th>مدرس</th><th>دانش‌آموز</th></tr></thead>
 <tbody>
 {perms.map(([label, a, t, st]) => (
 <tr key={label}>
 <td className="cell-strong">{label}</td>
 {[a, t, st].map((on, i) => (
 <td key={i}><input type="checkbox" className="matrix-check" defaultChecked={on} disabled={i === 0} /></td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <p className="muted small mt16">دسترسی مدیر همیشه کامل است و قابل تغییر نیست. (این ماتریس نمای وضعیت فعلی کد است)</p>
 </div>
 )}

 {sec === 'logs' && (
 <div className="card pad">
 <div className="between mb16">
 <h3 style={{ fontSize: 15 }}>لاگ رویدادهای سیستم</h3>
 <button className="btn btn-ghost btn-sm" onClick={() => toast('گزارش خطاهای کلاینت در سرور ثبت می‌شود (POST /api/client-errors)', 'info')}><Icon name="download" size={14} /> دانلود کامل</button>
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

function Toggle({ on, onChange }) {
 return (
 <label className="switch">
 <input type="checkbox" checked={!!on} onChange={() => onChange(!on)} />
 <i />
 </label>
 )
}
