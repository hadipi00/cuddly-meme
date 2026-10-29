import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { liveClasses, teachers } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'

/**
 * مدیریت کلاس‌های زنده:
 * هر جلسه‌ای که اینجا ثبت شود، بلافاصله در جدول هفتگی دانشجوها ظاهر می‌شود.
 */
export default function AClasses() {
  const { customClasses, addClass, removeClass, toast } = useApp()
  const [modal, setModal] = useState(null)

  const rows = [
    ...liveClasses.map((l) => ({ ...l, source: 'سامانه', statusLabel: l.status === 'full' ? 'تکمیل ظرفیت' : l.status === 'filling' ? 'در حال ثبت‌نام' : 'باز' })),
    ...customClasses.map((c) => ({ ...c, teacher: 'تعریف مدیریت', enrolled: 18, cap: 30, source: 'مدیریت', statusLabel: 'باز' })),
  ]

  const save = (d) => {
    addClass({
      title: d.title, day: Number(d.day), slot: Number(d.slot), start: SLOTS[Number(d.slot)],
      dur: Number(d.dur) || 90, teacher: d.teacher, color: 'cb-violet', room: 'room-adm',
    })
    setModal(null)
    toast('جلسه زنده ثبت شد و در جدول هفتگی دانشجوها قرار گرفت ✅')
  }

  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت کلاس‌های زنده</h2>
          <span className="muted small">زمان‌بندی جلسات آنلاین — ثبت جلسه جدید = اضافه شدن به جدول هفتگی دانشجوها</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> زمان‌بندی جلسه جدید</button>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
        <div className="card stat-card"><b className="sc-val">{faNum(rows.length)}</b><span className="sc-label">جلسات فعال</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(rows.reduce((a, r) => a + (r.enrolled || 0), 0))}</b><span className="sc-label">مجموع ثبت‌نام‌ها</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(2)}</b><span className="sc-label">جلسه تکمیل ظرفیت</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(3)}</b><span className="sc-label">کلاس رایگان</span></div>
      </div>

      <div className="card pad">
        <DataTable
          columns={[
            { key: 'title', label: 'کلاس', render: (r) => (
              <div className="cell-user">
                <span className={`avatar ${r.color || 'grad-1'}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}>{r.emoji || '🎥'}</span>
                <span className="cell-strong">{r.title}</span>
              </div>
            ) },
            { key: 'teacher', label: 'مدرس' },
            { key: 'day', label: 'روز', render: (r) => DAYS[r.day] },
            { key: 'start', label: 'ساعت' },
            { key: 'enrolled', label: 'ظرفیت', render: (r) => <span className="muted small">{faNum(r.enrolled)} / {faNum(r.cap)}</span> },
            { key: 'statusLabel', label: 'وضعیت', render: (r) => (
              <span className={`badge ${r.statusLabel === 'تکمیل ظرفیت' ? 'b-red' : r.statusLabel === 'در حال ثبت‌نام' ? 'b-amber' : 'b-green'}`}>{r.statusLabel}</span>
            ) },
          ]}
          rows={rows}
          searchKeys={['title', 'teacher']}
          filters={[
            { key: 'day', label: 'روز', options: DAYS, match: (r, v) => DAYS[r.day] === v },
            { key: 'teacher', label: 'مدرس', options: teachers.map((t) => t.name) },
          ]}
          actions={(r) => (
            <>
              {r.source === 'مدیریت' && (
                <button className="icon-btn" title="حذف جلسه" onClick={() => { removeClass(r.id); toast('جلسه حذف و از جدول هفتگی دانشجوها پاک شد', 'info') }}>
                  <Icon name="trash" />
                </button>
              )}
              <button className="icon-btn" title="یادآوری به دانشجوها" onClick={() => toast('پیامک یادآوری به همه ثبت‌نامی‌ها ارسال شد')}>
                <Icon name="send" />
              </button>
              <button className="icon-btn" title="بازیابی ضبط جلسه" onClick={() => toast('فایل ضبط جلسه دانلود شد', 'info')}>
                <Icon name="download" />
              </button>
            </>
          )}
        />
      </div>

      <FormModal
        open={!!modal}
        title="زمان‌بندی جلسه زنده جدید"
        onClose={() => setModal(null)}
        onSubmit={save}
        submitLabel="ثبت در جدول هفتگی"
        fields={[
          { key: 'title', label: 'عنوان جلسه', full: true, placeholder: 'مثلاً مرور جامع فصل ۴ — ریاضی' },
          { key: 'teacher', label: 'مدرس', type: 'select', options: teachers.map((t) => t.name) },
          { key: 'day', label: 'روز هفته', type: 'select', options: DAYS.map((d, i) => ({ value: String(i), label: d })) },
          { key: 'slot', label: 'ساعت شروع', type: 'select', options: SLOTS.map((s, i) => ({ value: String(i), label: s })) },
          { key: 'dur', label: 'مدت (دقیقه)', type: 'number' },
          { key: 'cap', label: 'ظرفیت', type: 'number', required: false },
        ]}
      />
    </div>
  )
}
