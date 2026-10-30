import { useState, useMemo } from 'react'
import { DataIcon } from '../../utils/icons'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { blogPosts, banners } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'
import { req } from '../../services/http'
import { loadOverrides } from '../../services/textOverrides'

export default function AContent() {
 const { toast } = useApp()
 const [tab, setTab] = useState('blog')
 const [modal, setModal] = useState(null)
 const [posts, setPosts] = useState(blogPosts)
 const [bList, setBList] = useState(banners)

 /* ---------- تب ویرایش متون سایت ---------- */
 const [q, setQ] = useState('')
 const [searching, setSearching] = useState(false)
 const [results, setResults] = useState(null) // null = هنوز جستجویی انجام نشده
 const [meta, setMeta] = useState(null) // {total, files}
 const [ovList, setOvList] = useState([])
 const [editing, setEditing] = useState(null) // {find, value}
 const [busy, setBusy] = useState(false)

 const ovMap = useMemo(() => new Map(ovList.map((o) => [o.find, o])), [ovList])

 const loadOv = async () => {
 try {
 const r = await req('/content/overrides')
 setOvList(r.overrides || [])
 } catch { /* noop */ }
 }

 const doSearch = async () => {
 const query = q.trim()
 if (query.length < 2) { toast('حداقل ۲ حرف وارد کنید', 'info'); return }
 setSearching(true)
 try {
 const r = await req(`/content/texts?q=${encodeURIComponent(query)}`)
 setResults(r.results || [])
 setMeta({ total: r.total, files: r.files })
 loadOv()
 if (!(r.results || []).length) toast('موردی پیدا نشد — عبارت کوتاه‌تری امتحان کنید', 'info')
 } catch (e) {
 toast(e.message || 'خطای جستجو', 'error')
 } finally { setSearching(false) }
 }

 const applyOverride = async (find, replace) => {
 setBusy(true)
 try {
 await req('/content/overrides', { method: 'POST', body: { find, replace } })
 await loadOverrides() // اعمال زنده روی کل سایت همین حالا
 await loadOv()
 setResults((l) => l && l.map((it) => (it.text === find ? it : it)))
 toast(replace ? 'متن در کل سایت عوض شد ✅' : 'متن از کل سایت حذف شد', 'ok')
 setEditing(null)
 } catch (e) {
 toast(e.message || 'خطا در ذخیره', 'error')
 } finally { setBusy(false) }
 }

 const restoreOriginal = async (id) => {
 setBusy(true)
 try {
 await req(`/content/overrides/${id}`, { method: 'DELETE' })
 await loadOverrides()
 await loadOv()
 toast('متن اصلی بازگردانده شد', 'info')
 } catch (e) {
 toast(e.message || 'خطا', 'error')
 } finally { setBusy(false) }
 }

 const save = (d) => {
 if (modal === 'new') {
 setPosts((l) => [{ id: 'b' + Date.now(), date: '1404/09/13', read: 5, icon: 'filetext', color: 'grad-2', ...d }, ...l])
 toast('مقاله منتشر شد ')
 } else {
 setPosts((l) => l.map((p) => (p.id === modal.id ? { ...p, ...d } : p)))
 toast('مقاله به‌روزرسانی شد')
 }
 setModal(null)
 }

 return (
 /* data-tx-skip → لایه جایگزینی متون، خودِ این صفحه را دست نمی‌زند
    وگرنه متن اصلی داخل فیلدهای ویرایش هم عوض می‌شد! */
 <div data-tx-skip>
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت محتوا</h2>
 <span className="muted small">مقالات وبلاگ، بنرها و ویرایش متون کل سایت</span>
 </div>
 </div>

 <div className="tabs">
 <button className={`tab ${tab === 'blog' ? 'on' : ''}`} onClick={() => setTab('blog')}> وبلاگ ({faNum(posts.length)})</button>
 <button className={`tab ${tab === 'banners' ? 'on' : ''}`} onClick={() => setTab('banners')}> بنرها ({faNum(bList.length)})</button>
 <button className={`tab ${tab === 'texts' ? 'on' : ''}`} onClick={() => { setTab('texts'); loadOv() }}> 🔎 ویرایش متون سایت</button>
 </div>

 {tab === 'blog' && (
 <div className="card pad">
 <DataTable
 columns={[
 { key: 'title', label: 'مقاله', render: (r) => (
 <div className="cell-user">
 <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}><DataIcon name={r.icon} size={18} /></span>
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
 )}

 {tab === 'banners' && (
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

 {tab === 'texts' && (
 <div>
 <div className="card pad mb16">
 <b className="small">🔎 جستجو و ویرایش متون سایت</b>
 <p className="muted small mt8" style={{ lineHeight: 1.9 }}>
 یک کلمه یا عبارت جستجو کنید — همه‌جای سایت که این متن دیده می‌شود لیست می‌شود (با نام صفحه).
 بعد می‌توانید آن را در کل سایت <b>عوض</b> کنید یا کلاً <b>حذف</b> کنید؛ تغییر بلافاصله روی همه‌ی صفحات اعمال می‌شود.
 مثلاً عدد «۴.۲ ساعت میانگین مطالعه» صفحه اصلی از همین‌جا قابل تغییر است.
 </p>
 <div className="row g8 mt16" style={{ flexWrap: 'wrap' }}>
 <input
 className="input"
 style={{ flex: 1, minWidth: 220 }}
 placeholder="مثلاً: میانگین مطالعه یا ۴.۲ ساعت…"
 value={q}
 onChange={(e) => setQ(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && doSearch()}
 />
 <button className="btn btn-sm" onClick={doSearch} disabled={searching}>
 <Icon name="search" size={15} /> {searching ? 'در حال جستجو…' : 'جستجو در سایت'}
 </button>
 </div>
 {meta && <div className="muted small mt8">ایندکس: {faNum(meta.total)} متن از {faNum(meta.files)} فایل فرانت</div>}
 </div>

 {results !== null && (
 <div className="card pad">
 <b className="small">{results.length ? `نتایج (${faNum(results.length)})` : 'نتیجه‌ای یافت نشد'}</b>
 <div className="mt16">
 {results.map((r) => {
 const ov = ovMap.get(r.text)
 return (
 <div className="tx-item" key={r.text}>
 <div className="tx-head">
 <b className="tx-text">{r.text}</b>
 {ov && <span className="badge b-green">→ {ov.replace === '' ? '(حذف‌شده از سایت)' : ov.replace}</span>}
 </div>
 <div className="tx-pages">
 {r.pages.slice(0, 4).map((p) => <span className="badge b-gray" key={p}>{p}</span>)}
 {r.pages.length > 4 && <span className="badge b-gray">+{faNum(r.pages.length - 4)} صفحه دیگر</span>}
 </div>
 <div className="row g8 tx-actions">
 {!ov && (
 <>
 <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ find: r.text, value: r.text })} disabled={busy}>
 <Icon name="edit" size={14} /> تغییر متن
 </button>
 <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => applyOverride(r.text, '')} disabled={busy}>
 <Icon name="trash" size={14} /> حذف از سایت
 </button>
 </>
 )}
 {ov && (
 <button className="btn btn-ghost btn-sm" onClick={() => restoreOriginal(ov.id)} disabled={busy}>
 <Icon name="refresh" size={14} /> بازگردانی متن اصلی
 </button>
 )}
 </div>
 {editing?.find === r.text && (
 <div className="tx-editor row g8" style={{ flexWrap: 'wrap' }}>
 <input
 className="input"
 style={{ flex: 1, minWidth: 220 }}
 value={editing.value}
 autoFocus
 placeholder="متن جدید (خالی = حذف)"
 onChange={(e) => setEditing({ ...editing, value: e.target.value })}
 onKeyDown={(e) => e.key === 'Enter' && applyOverride(r.text, editing.value)}
 />
 <button className="btn btn-sm" onClick={() => applyOverride(r.text, editing.value)} disabled={busy}>ذخیره</button>
 <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>انصراف</button>
 </div>
 )}
 </div>
 )
 })}
 </div>
 </div>
 )}

 {ovList.length > 0 && (
 <div className="card pad mt16">
 <b className="small">جایگزینی‌های فعال ({faNum(ovList.length)})</b>
 <div className="mt16">
 {ovList.map((o) => (
 <div className="tx-item" key={o.id}>
 <div className="tx-head">
 <b className="tx-text" style={{ textDecoration: o.replace === '' ? 'line-through' : 'none' }}>{o.find}</b>
 <span className="badge b-teal">→ {o.replace === '' ? '(حذف‌شده)' : o.replace}</span>
 </div>
 <div className="tx-actions">
 <button className="btn btn-ghost btn-sm" onClick={() => restoreOriginal(o.id)} disabled={busy}>
 <Icon name="trash" size={14} /> بازگردانی
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
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
