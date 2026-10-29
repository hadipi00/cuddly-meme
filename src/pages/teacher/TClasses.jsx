import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { teacherClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'

/**
 * کلاس‌های پیش‌رو مدرس:
 * مدرس جلسات جدید تعریف می‌کند → بلافاصله در جدول هفتگی دانش‌آموزهایش نمایش داده می‌شود.
 */
export default function TClasses() {
  const { customClasses, addClass, updateClass, removeClass, toast } = useApp()
  const [modal, setModal] = useState(null) // 'new' | row
  const rows = [...customClasses.map((c) => ({ ...c, source: 'تعریف‌شده توسط من' })), ...teacherClasses.map((c) => ({ ...c, source: 'سامانه' }))]

  const save = (data) => {
    const payload = {
      title: data.title, day: Number(data.day), slot: Number(data.slot),
      start: SLOTS[Number(data.slot)], dur: Number(data.dur) || 60,
      teacher: 'من', room: 'room-new', color: 'cb-teal',
    }
    if (modal === 'new') {
      addClass(payload)
      toast('کلاس جدید ثبت شد — در جدول هفتگی دانشجوهایتان نمایش داده می‌شود ✅')
    } else {
      updateClass(modal.id, payload)
      toast('کلاس به‌روزرسانی شد')
    }
    setModal(null)
  }

  return (
    <div>
      <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.1), rgba(56,189,248,0.1))' }}>
        <div className="row g12" style={{ alignItems: 'flex-start' }}>
          <span className="sc-icon teal" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="calendar" size={20} />
          </span>
          <div>
            <b>تعریف کلاس‌های پیش‌رو برای مشتری‌های شما</b>
            <p className="muted small">
              هر کلاسی که اینجا تعریف کنید، به‌صورت خودکار در جدول هفتگی دانشجوهایتان ظاهر می‌شود
              و لینک ورود به کلاس زنده برایشان فعال خواهد بود.
            </p>
          </div>
        </div>
      </div>

      <div className="card pad">
        <DataTable
          columns={[
            { key: 'title', label: 'عنوان کلاس', render: (r) => <span className="cell-strong">{r.title}</span> },
            { key: 'day', label: 'روز هفته', render: (r) => DAYS[r.day] },
            { key: 'start', label: 'ساعت شروع' },
            { key: 'dur', label: 'مدت (دقیقه)', render: (r) => faNum(r.dur) },
            { key: 'students', label: 'دانشجو', render: (r) => faNum(r.students ?? 18) },
            { key: 'source', label: 'منبع', render: (r) => <span className={`badge ${r.source === 'سامانه' ? 'b-gray' : 'b-teal'}`}>{r.source}</span> },
          ]}
          rows={rows}
          searchKeys={['title']}
          filters={[{ key: 'day', label: 'روز', options: DAYS, match: (r, v) => DAYS[r.day] === v }]}
          onAdd={() => setModal('new')}
          addLabel="کلاس جدید"
          actions={(row) => (
            <>
              {row.source === 'تعریف‌شده توسط من' ? (
                <>
                  <button className="icon-btn" title="ویرایش" onClick={() => setModal(row)}><Icon name="edit" /></button>
                  <button className="icon-btn" title="حذف" onClick={() => { removeClass(row.id); toast('کلاس حذف شد و از جدول دانشجوها پاک شد', 'info') }}><Icon name="trash" /></button>
                </>
              ) : null}
              <button className="icon-btn" title="شروع کلاس زنده" onClick={() => toast('برای شروع، از منوی «کلاس زنده — برگزاری» استفاده کنید', 'info')}><Icon name="video" /></button>
            </>
          )}
        />
      </div>

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'تعریف کلاس پیش‌رو جدید' : 'ویرایش کلاس'}
        onClose={() => setModal(null)}
        onSubmit={save}
        initial={modal && modal !== 'new' ? { title: modal.title, day: String(modal.day), slot: String(modal.slot), dur: modal.dur } : {}}
        submitLabel={modal === 'new' ? 'ثبت کلاس در جدول هفتگی' : 'ذخیره تغییرات'}
        fields={[
          { key: 'title', label: 'عنوان کلاس', full: true, placeholder: 'مثلاً کارگاه React — هوک‌های پیشرفته' },
          { key: 'day', label: 'روز هفته', type: 'select', options: DAYS.map((d, i) => ({ value: String(i), label: d })) },
          { key: 'slot', label: 'ساعت شروع', type: 'select', options: SLOTS.map((s, i) => ({ value: String(i), label: s })) },
          { key: 'dur', label: 'مدت (دقیقه)', type: 'number' },
          { key: 'cap', label: 'ظرفیت', type: 'number', required: false },
        ]}
      />
    </div>
  )
}
