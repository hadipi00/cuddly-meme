import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { blogPosts, banners } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function AContent() {
  const { toast } = useApp()
  const [tab, setTab] = useState('blog')
  const [modal, setModal] = useState(null)
  const [posts, setPosts] = useState(blogPosts)
  const [bList, setBList] = useState(banners)

  const save = (d) => {
    if (modal === 'new') {
      setPosts((l) => [{ id: 'b' + Date.now(), date: '1404/09/13', read: 5, emoji: '📝', color: 'grad-2', ...d }, ...l])
      toast('مقاله منتشر شد ✅')
    } else {
      setPosts((l) => l.map((p) => (p.id === modal.id ? { ...p, ...d } : p)))
      toast('مقاله به‌روزرسانی شد')
    }
    setModal(null)
  }

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت محتوا</h2>
          <span className="muted small">مقالات وبلاگ و بنرهای تبلیغاتی سایت</span>
        </div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 22 }}>
        <div className="card stat-card"><b className="sc-val">{faNum(posts.length)}</b><span className="sc-label">مقاله منتشرشده</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(bList.filter((b) => b.active).length)}</b><span className="sc-label">بنر فعال</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(12400)}</b><span className="sc-label">بازدید وبلاگ این ماه</span></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'blog' ? 'on' : ''}`} onClick={() => setTab('blog')}>📝 وبلاگ ({faNum(posts.length)})</button>
        <button className={`tab ${tab === 'banners' ? 'on' : ''}`} onClick={() => setTab('banners')}>🖼️ بنرها ({faNum(bList.length)})</button>
      </div>

      {tab === 'blog' ? (
        <div className="card pad">
          <DataTable
            columns={[
              { key: 'title', label: 'مقاله', render: (r) => (
                <div className="cell-user">
                  <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}>{r.emoji}</span>
                  <span className="cell-strong">{r.title}</span>
                </div>
              ) },
              { key: 'cat', label: 'دسته', render: (r) => <span className="badge b-gray">{r.cat}</span> },
              { key: 'date', label: 'تاریخ' },
              { key: 'read', label: 'زمان مطالعه', render: (r) => <span className="muted small">{faNum(r.read)} دقیقه</span> },
            ]}
            rows={posts}
            searchKeys={['title', 'cat']}
            onAdd={() => setModal('new')}
            addLabel="مقاله جدید"
            actions={(r) => (
              <>
                <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
                <button className="icon-btn" title="حذف" onClick={() => { setPosts((l) => l.filter((p) => p.id !== r.id)); toast('مقاله حذف شد', 'info') }}><Icon name="trash" /></button>
              </>
            )}
          />
        </div>
      ) : (
        <div className="grids g2">
          {bList.map((b) => (
            <div className="card pad" key={b.id}>
              <div className="between mb8" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b className="small">{b.title}</b>
                  <div className="muted small mt8">{b.place}</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={b.active} onChange={() => {
                    setBList((l) => l.map((x) => (x.id === b.id ? { ...x, active: !x.active } : x)))
                    toast(b.active ? 'بنر غیرفعال شد' : 'بنر فعال شد', 'info')
                  }} />
                  <i />
                </label>
              </div>
            </div>
          ))}
          <button className="card pad" style={{ borderStyle: 'dashed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)' }}
            onClick={() => {
              setBList((l) => [...l, { id: 'bn' + Date.now(), title: 'بنر جدید — عنوان نمونه', place: 'صفحه نخست — بالای صفحه', active: false }])
              toast('بنر جدید اضافه شد — برای فعال‌سازی کلید را بزنید')
            }}>
            <Icon name="plus" /> افزودن بنر جدید
          </button>
        </div>
      )}

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'نوشتن مقاله جدید' : 'ویرایش مقاله'}
        onClose={() => setModal(null)}
        onSubmit={save}
        initial={modal && modal !== 'new' ? { title: modal.title, cat: modal.cat } : {}}
        fields={[
          { key: 'title', label: 'عنوان مقاله', full: true },
          { key: 'cat', label: 'دسته', type: 'select', options: ['روش مطالعه', 'برنامه‌نویسی', 'بهره‌وری', 'طراحی', 'مدرس‌مارکت', 'آموزش آنلاین'] },
          { key: 'excerpt', label: 'خلاصه', type: 'textarea', full: true },
        ]}
      />
    </div>
  )
}
