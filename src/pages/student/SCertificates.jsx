import Icon from '../../components/Icon'
import { certificates } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function SCertificates() {
 const { toast } = useApp()
 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>گواهی‌نامه‌های من</h2>
 <span className="muted small">مدارک رسمی پایان دوره با کد رهگیری یکتا و قابل استعلام</span>
 </div>
 <span className="badge b-violet">{faNum(certificates.length)} گواهی‌نامه</span>
 </div>

 <div className="grids g3">
 {certificates.map((c) => (
 <div className="card cert-card" key={c.id}>
 <span className="cert-ribbon"><Icon name="award" filled /></span>
 <b style={{ fontSize: 15.5, display: 'block', minHeight: 48 }}>{c.course}</b>
 <div className="muted small mt8" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 <span>تاریخ صدور: {c.date}</span>
 <span>نمره نهایی: {c.grade}</span>
 <span dir="ltr" style={{ textAlign: 'right' }}>کد: {c.code}</span>
 </div>
 <button className="btn btn-soft btn-sm mt16" onClick={() => toast('گواهی‌نامه PDF دانلود شد')}>
 <Icon name="download" size={15} /> دانلود PDF
 </button>
 </div>
 ))}
 </div>

 <div className="card pad mt24">
 <div className="row g12">
 <span className="sc-icon amber" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="award" size={19} /></span>
 <div>
 <b className="small">گواهی‌نامه بعدی نزدیک است!</b>
 <p className="muted small">فقط ۲ درس از «مکالمه انگلیسی روزمره» مانده تا صدور گواهی‌نامه جدید.</p>
 </div>
 </div>
 </div>
 </div>
 )
}
