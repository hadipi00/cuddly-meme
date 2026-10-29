import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { Avatar } from '../../components/ui'
import { students, teachers } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

const stBadge = { active: ['فعال', 'b-green'], inactive: ['غیرفعال', 'b-gray'], vip: ['ویژه 👑', 'b-violet'], banned: ['مسدود', 'b-red'] }

export default function AUsers({ kind }) {
  const { toast } = useApp()
  const [modal, setModal] = useState(null)
  const [list, setList] = useState(kind === 'teacher' ? teachers : students)

  const add = (data) => {
    setList([{ id: Date.now(), joined: '1404/09/13', courses: 0, spent: 0, status: 'active', ...data }, ...list])
    setModal(null)
    toast(kind === 'teacher' ? 'اکانت مدرس ساخته شد و مشخصات ورود برایش پیامک شد ✅' : 'دانشجوی جدید ثبت شد')
  }

  if (kind === 'teacher') {
    return (
      <div>
        <div className="between wrap mb24">
          <div>
            <h2 style={{ fontSize: 17 }}>مدیریت مدرسان</h2>
            <span className="muted small">اکانت مدرسان فقط از همین‌جا ساخته می‌شود — مدرس‌ها خودشان ثبت‌نام نمی‌کنند</span>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> ساخت اکانت مدرس</button>
        </div>

        <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 22 }}>
          <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">مدرس فعال</span></div>
          <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, t) => a + t.students, 0).toLocaleString('fa-IR'))}</b><span className="sc-label">مجموع دانشجوهای مدرسان</span></div>
          <div className="card stat-card"><b className="sc-val">۴.۸</b><span className="sc-label">میانگین امتیاز مدرسان</span></div>
        </div>

        <div className="card pad">
          <DataTable
            columns={[
              { key: 'name', label: 'مدرس', render: (r) => (
                <div className="cell-user"><Avatar name={r.name} size={34} color={r.color || 'grad-0'} /><div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }}>{r.role}</span></div></div>
              ) },
              { key: 'joined', label: 'عضویت' },
              { key: 'students', label: 'دانشجو', render: (r) => faNum(r.students?.toLocaleString?.('fa-IR') || r.students) },
              { key: 'classesCount', label: 'کلاس‌ها', render: (r) => faNum(r.classesCount || 0) },
              { key: 'rating', label: 'امتیاز', render: (r) => <span className="badge b-amber"><Icon name="star" size={12} filled /> {faNum(r.rating)}</span> },
              { key: 'status', label: 'وضعیت', render: (r) => <span className="status-dot green"><i />فعال</span> },
            ]}
            rows={list}
            searchKeys={['name', 'role']}
            actions={(r) => (
              <>
                <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
                <button className="icon-btn" title="بازنشانی رمز" onClick={() => toast(`رمز جدید برای ${r.name} پیامک شد`)}><Icon name="refresh" /></button>
                <button className="icon-btn" title="غیرفعال‌سازی" onClick={() => toast(`حساب ${r.name} غیرفعال شد`, 'info')}><Icon name="x" /></button>
              </>
            )}
          />
        </div>

        <FormModal
          open={!!modal}
          title={modal === 'new' ? 'ساخت اکانت مدرس جدید' : `ویرایش ${modal?.name}`}
          onClose={() => setModal(null)}
          onSubmit={add}
          submitLabel={modal === 'new' ? 'ساخت اکانت و ارسال مشخصات' : 'ذخیره'}
          initial={modal && modal !== 'new' ? { name: modal.name, role: modal.role, phone: '', email: '', commission: '۷۰' } : { commission: '۷۰' }}
          fields={[
            { key: 'name', label: 'نام و نام خانوادگی', full: true, placeholder: 'مثلاً علی رضایی' },
            { key: 'role', label: 'عنوان تخصصی', full: true, placeholder: 'مثلاً مدرس هوش مصنوعی' },
            { key: 'phone', label: 'شماره موبایل', placeholder: '۰۹۱۲…' },
            { key: 'email', label: 'ایمیل', placeholder: 'teacher@example.com' },
            { key: 'username', label: 'نام کاربری', placeholder: 'a.rezaei' },
            { key: 'pass', label: 'رمز عبور اولیه', placeholder: 'حداقل ۸ کاراکتر' },
            { key: 'commission', label: 'سهم مدرس از فروش (٪)', type: 'select', options: ['۶۰', '۶۵', '۷۰', '۷۵', '۸۰'] },
            { key: 'bio', label: 'بیوگرافی کوتاه', type: 'textarea', required: false },
          ]}
        />
      </div>
    )
  }

  // ---- دانشجوها ----
  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت دانشجوها</h2>
          <span className="muted small">مشاهده، ویرایش و مدیریت دسترسی دانشجوها</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> افزودن دانشجو</button>
      </div>

      <div className="stat-cards" style={{ marginBottom: 22 }}>
        <div className="card stat-card"><b className="sc-val">{faNum(list.length + 11990)}</b><span className="sc-label">کل دانشجوها</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(list.filter((s) => s.status === 'active').length + 8210)}</b><span className="sc-label">فعال این ماه</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(list.filter((s) => s.status === 'vip').length + 143)}</b><span className="sc-label">مشتریان ویژه 👑</span></div>
        <div className="card stat-card"><b className="sc-val">{toman(list.reduce((a, s) => a + s.spent, 0) + 184000000)}</b><span className="sc-label">مجموع خرید دانشجوها</span></div>
      </div>

      <div className="card pad">
        <DataTable
          columns={[
            { key: 'name', label: 'دانشجو', render: (r) => (
              <div className="cell-user"><Avatar name={r.name} size={34} color="grad-2" /><div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }} dir="ltr">{r.email}</span></div></div>
            ) },
            { key: 'phone', label: 'موبایل' },
            { key: 'joined', label: 'عضویت' },
            { key: 'courses', label: 'دوره‌ها', render: (r) => faNum(r.courses) },
            { key: 'spent', label: 'مجموع خرید', render: (r) => toman(r.spent) },
            { key: 'status', label: 'وضعیت', render: (r) => {
              const [label, cls] = stBadge[r.status] || stBadge.active
              return <span className={`badge ${cls}`}>{label}</span>
            } },
          ]}
          rows={list}
          searchKeys={['name', 'email', 'phone']}
          filters={[{ key: 'status', label: 'وضعیت', options: ['فعال', 'غیرفعال', 'ویژه', 'مسدود'], match: (r, v) => (stBadge[r.status]?.[0] || 'فعال') === v }]}
          actions={(r) => (
            <>
              <button className="icon-btn" title="پروفایل" onClick={() => toast(`پروفایل ${r.name} — نسخه دمو`, 'info')}><Icon name="eye" /></button>
              <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
              <button className="icon-btn" title={r.status === 'banned' ? 'رفع مسدودی' : 'مسدودسازی'} onClick={() => {
                setList((l) => l.map((s) => (s.id === r.id ? { ...s, status: s.status === 'banned' ? 'active' : 'banned' } : s)))
                toast(r.status === 'banned' ? 'مسدودیت برداشته شد' : 'کاربر مسدود شد', 'info')
              }}><Icon name="shield" /></button>
            </>
          )}
        />
      </div>

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'افزودن دانشجوی جدید' : `ویرایش ${modal?.name}`}
        onClose={() => setModal(null)}
        onSubmit={add}
        initial={modal && modal !== 'new' ? { name: modal.name, phone: modal.phone, email: modal.email } : {}}
        fields={[
          { key: 'name', label: 'نام و نام خانوادگی', full: true },
          { key: 'phone', label: 'موبایل' },
          { key: 'email', label: 'ایمیل' },
          { key: 'pass', label: 'رمز اولیه', required: false },
        ]}
      />
    </div>
  )
}
