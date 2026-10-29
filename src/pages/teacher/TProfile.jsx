import { useState } from 'react'
import Icon from '../../components/Icon'
import { Avatar } from '../../components/ui'
import { useApp } from '../../store/AppContext'

export default function TProfile() {
  const { user, toast } = useApp()
  const [skills, setSkills] = useState(['React', 'جاوااسکریپت', 'پایتون', 'Node.js'])
  const [val, setVal] = useState('')

  const addSkill = () => {
    if (val.trim() && !skills.includes(val.trim())) setSkills([...skills, val.trim()])
    setVal('')
  }

  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>پروفایل و رزومه من</h2>
          <span className="muted small">این اطلاعات در صفحه عمومی اساتید نمایش داده می‌شود — اکانت شما توسط مدیریت ایجاد شده است</span>
        </div>
      </div>

      <div className="grids g2" style={{ alignItems: 'start' }}>
        <div className="card pad">
          <div className="row g16 mb24">
            <Avatar name={user?.name || 'رضا کریمی'} size={80} color="grad-0" />
            <div>
              <b style={{ fontSize: 17 }}>{user?.name || 'رضا کریمی'}</b>
              <div className="pc-role">مدرس برنامه‌نویسی — عضو از ۱۳۹۸</div>
              <button className="btn btn-ghost btn-sm mt8" onClick={() => toast('در نسخه دمو تغییر عکس فعال نیست', 'info')}><Icon name="upload" size={14} /> تغییر عکس</button>
            </div>
          </div>
          <div className="field"><label>نام نمایشی</label><input className="input" defaultValue={user?.name || 'رضا کریمی'} /></div>
          <div className="field"><label>عنوان تخصصی</label><input className="input" defaultValue="مدرس برنامه‌نویسی و استاد ارشد آکادمی" /></div>
          <div className="field"><label>بیوگرافی</label>
            <textarea className="textarea" defaultValue="۱۲ سال تجربه تدریس برنامه‌نویسی و معماری نرم‌افزار؛ مدرس بیش از ۸٬۰۰۰ دانشجو در سراسر کشور." />
          </div>
          <button className="btn btn-primary" onClick={() => toast('پروفایل ذخیره شد')}><Icon name="check" size={16} /> ذخیره تغییرات</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card pad">
            <h3 className="mb16" style={{ fontSize: 15 }}>تخصص‌ها (برچسب‌ها)</h3>
            <div className="tag-inputs">
              {skills.map((s) => (
                <span className="tag" key={s}>
                  {s}
                  <button onClick={() => setSkills(skills.filter((x) => x !== s))}><Icon name="x" size={12} /></button>
                </span>
              ))}
              <input placeholder="تخصص جدید + Enter" value={val} onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} />
            </div>
          </div>

          <div className="card pad">
            <h3 className="mb16" style={{ fontSize: 15 }}>تنظیمات کلاس‌ها</h3>
            {[
              ['پذیرش خودکار دانشجوی جدید', 'ثبت‌نام بدون نیاز به تأیید شما', true],
              ['ضبط خودکار همه کلاس‌ها', 'برای دانشجوهای غایب منتشر می‌شود', true],
              ['اطلاع پیامکی قبل از کلاس', '۳۰ دقیقه قبل به شما و دانشجوها', true],
              ['نمایش رزومه در صفحه عمومی', 'پروفایل شما در بخش اساتید دیده شود', true],
            ].map(([t, d, on], i) => (
              <ToggleRow key={t} t={t} d={d} defaultOn={on} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ t, d, defaultOn }) {
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
