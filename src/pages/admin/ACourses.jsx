import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { courses, courseCats } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

export default function ACourses() {
  const { toast } = useApp()
  const [tab, setTab] = useState('courses')
  const [modal, setModal] = useState(null)
  const [list, setList] = useState(courses)
  const [cats, setCats] = useState(courseCats)

  const save = (data) => {
    if (modal === 'new') {
      setList([{ id: Date.now(), rating: 5, students: 0, hours: Number(data.hours) || 10, lessonsCount: Number(data.lessonsCount) || 20, emoji: '📘', color: 'grad-0', level: data.level, type: 'recorded', curriculum: [], features: [], status: 'published', ...data }, ...list])
      toast('دوره جدید ثبت و منتشر شد ✅')
    } else {
      setList((l) => l.map((c) => (c.id === modal.id ? { ...c, ...data } : c)))
      toast('دوره به‌روزرسانی شد')
    }
    setModal(null)
  }

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت دوره‌ها</h2>
          <span className="muted small">ثبت، ویرایش و انتشار دوره‌های ضبط‌شده + مدیریت دسته‌بندی‌ها</span>
        </div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
        <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">دوره ثبت‌شده</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, c) => a + c.students, 0).toLocaleString('fa-IR'))}</b><span className="sc-label">کل ثبت‌نام‌ها</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(cats.length)}</b><span className="sc-label">دسته‌بندی</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(3)}</b><span className="sc-label">در صف بازبینی</span></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'courses' ? 'on' : ''}`} onClick={() => setTab('courses')}>📚 دوره‌ها ({faNum(list.length)})</button>
        <button className={`tab ${tab === 'cats' ? 'on' : ''}`} onClick={() => setTab('cats')}>🏷️ دسته‌بندی‌ها ({faNum(cats.length)})</button>
      </div>

      {tab === 'courses' ? (
        <div className="card pad">
          <DataTable
            columns={[
              { key: 'title', label: 'دوره', render: (r) => (
                <div className="cell-user">
                  <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}>{r.emoji}</span>
                  <div><span className="cell-strong">{r.title.slice(0, 42)}{r.title.length > 42 ? '…' : ''}</span><span className="muted small" style={{ display: 'block' }}>{r.teacher}</span></div>
                </div>
              ) },
              { key: 'cat', label: 'دسته', render: (r) => <span className="badge b-gray">{r.cat}</span> },
              { key: 'price', label: 'قیمت', render: (r) => r.price ? toman(r.price) : <span className="badge b-green">رایگان</span> },
              { key: 'students', label: 'دانشجو', render: (r) => faNum(r.students?.toLocaleString?.('fa-IR') || r.students) },
              { key: 'rating', label: 'امتیاز', render: (r) => <span className="badge b-amber"><Icon name="star" size={12} filled /> {faNum(r.rating)}</span> },
              { key: 'status', label: 'وضعیت', render: () => <span className="status-dot green"><i />منتشر شده</span> },
            ]}
            rows={list}
            searchKeys={['title', 'teacher', 'cat']}
            filters={[{ key: 'cat', label: 'دسته', options: cats }]}
            onAdd={() => setModal('new')}
            addLabel="دوره جدید"
            actions={(r) => (
              <>
                <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
                <button className="icon-btn" title="مدیریت سرفصل‌ها" onClick={() => toast('ویرایش سرفصل‌ها در نسخه دمو محدود است', 'info')}><Icon name="list" /></button>
                <button className="icon-btn" title="لغو انتشار" onClick={() => toast(`انتشار «${r.title.slice(0, 20)}…» لغو شد`, 'info')}><Icon name="eye" /></button>
                <button className="icon-btn" title="حذف" onClick={() => { setList((l) => l.filter((c) => c.id !== r.id)); toast('دوره حذف شد', 'info') }}><Icon name="trash" /></button>
              </>
            )}
          />
        </div>
      ) : (
        <div className="card pad">
          <h3 className="mb16" style={{ fontSize: 15 }}>دسته‌بندی‌های فروشگاه</h3>
          <div className="row wrap g8 mb24">
            {cats.map((c) => (
              <span className="chip on" key={c}>
                {c} <span className="muted small">({faNum(list.filter((x) => x.cat === c).length)})</span>
                <button onClick={() => { setCats(cats.filter((x) => x !== c)); toast(`دسته «${c}» حذف شد`, 'info') }} style={{ display: 'inline-flex', marginRight: 4 }}>
                  <Icon name="x" size={13} />
                </button>
              </span>
            ))}
          </div>
          <div className="row g8">
            <input className="input" style={{ maxWidth: 300 }} placeholder="نام دسته جدید…" id="newcat" />
            <button className="btn btn-primary btn-sm" onClick={() => {
              const v = document.getElementById('newcat').value.trim()
              if (v && !cats.includes(v)) { setCats([...cats, v]); toast('دسته اضافه شد') ; document.getElementById('newcat').value = '' }
            }}><Icon name="plus" size={14} /> افزودن</button>
          </div>
        </div>
      )}

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'ثبت دوره جدید' : 'ویرایش دوره'}
        onClose={() => setModal(null)}
        onSubmit={save}
        initial={modal && modal !== 'new' ? { title: modal.title, cat: modal.cat, teacher: modal.teacher, price: String(modal.price), hours: String(modal.hours), lessonsCount: String(modal.lessonsCount), level: modal.level } : {}}
        fields={[
          { key: 'title', label: 'عنوان دوره', full: true },
          { key: 'cat', label: 'دسته‌بندی', type: 'select', options: cats },
          { key: 'teacher', label: 'مدرس', type: 'select', options: ['رضا کریمی', 'مریم احمدی', 'علی نادری', 'حسین موسوی', 'نگار رستمی'] },
          { key: 'level', label: 'سطح', type: 'select', options: ['مقدماتی', 'متوسط', 'پیشرفته', 'مقدماتی تا پیشرفته', 'کنکور'] },
          { key: 'price', label: 'قیمت (تومان)', type: 'number' },
          { key: 'hours', label: 'ساعت آموزش', type: 'number' },
          { key: 'lessonsCount', label: 'تعداد درس', type: 'number' },
          { key: 'desc', label: 'توضیحات', type: 'textarea', full: true, required: false },
        ]}
      />
    </div>
  )
}
