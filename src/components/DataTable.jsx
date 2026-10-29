import { useMemo, useState } from 'react'
import Icon from './Icon'
import { EmptyState } from './ui'
import { faNum } from '../utils/format'

/**
 * جدول داده عمومی با جستجو، فیلتر، صفحه‌بندی و اکشن‌ها.
 * columns: [{key, label, render?}]
 * filters: [{key, label, options, match(row, val)}]
 * actions: (row) => ReactNode
 */
export default function DataTable({
 columns, rows, searchKeys = [], filters = [], pageSize = 8,
 actions, onAdd, addLabel, emptyText = 'موردی یافت نشد.',
}) {
 const [q, setQ] = useState('')
 const [fv, setFv] = useState({})
 const [page, setPage] = useState(1)

 const filtered = useMemo(() => {
 let out = rows || []
 if (q.trim()) {
 const needle = q.trim().toLowerCase()
 out = out.filter((r) =>
 (searchKeys.length ? searchKeys : Object.keys(r)).some((k) =>
 String(r[k] ?? '').toLowerCase().includes(needle)
 )
 )
 }
 filters.forEach((f) => {
 const val = fv[f.key]
 if (val && val !== 'همه') out = out.filter((r) => f.match ? f.match(r, val) : String(r[f.key]) === val)
 })
 return out
 }, [rows, q, fv, filters, searchKeys])

 const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
 const cur = Math.min(page, pages)
 const view = filtered.slice((cur - 1) * pageSize, cur * pageSize)

 return (
 <div>
 <div className="toolbar">
 <div className="search-box">
 <Icon name="search" />
 <input className="input" placeholder="جستجو…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
 </div>
 {filters.map((f) => (
 <select
 key={f.key} className="select" value={fv[f.key] || 'همه'}
 onChange={(e) => { setFv((v) => ({ ...v, [f.key]: e.target.value })); setPage(1) }}
 >
 <option value="همه">{f.label}: همه</option>
 {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
 </select>
 ))}
 <span className="spacer" />
 <span className="muted small">{faNum(filtered.length)} مورد</span>
 {onAdd && (
 <button className="btn btn-primary btn-sm" onClick={onAdd}>
 <Icon name="plus" size={16} /> {addLabel || 'افزودن'}
 </button>
 )}
 </div>

 {view.length === 0 ? (
 <EmptyState text={emptyText} />
 ) : (
 <div className="dtable-wrap">
 <table className="dtable">
 <thead>
 <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
 </thead>
 <tbody>
 {view.map((row, i) => (
 <tr key={row.id ?? i}>
 {columns.map((c) => (
 <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>
 ))}
 {actions && <td><div className="cell-actions">{actions(row)}</div></td>}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {pages > 1 && (
 <div className="pagination">
 <span>صفحه {faNum(cur)} از {faNum(pages)}</span>
 <div className="pages">
 <button disabled={cur === 1} onClick={() => setPage(cur - 1)}><Icon name="chevronRight" size={14} /></button>
 {Array.from({ length: pages }, (_, i) => (
 <button key={i} className={cur === i + 1 ? 'on' : ''} onClick={() => setPage(i + 1)}>
 {faNum(i + 1)}
 </button>
 ))}
 <button disabled={cur === pages} onClick={() => setPage(cur + 1)}><Icon name="chevronLeft" size={14} /></button>
 </div>
 </div>
 )}
 </div>
 )
}
