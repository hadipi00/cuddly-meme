import Icon from './Icon'

export function Modal({ open, title, onClose, children, wide = false }) {
 if (!open) return null
 return (
 <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
 <div className={`modal ${wide ? 'wide' : ''}`}>
 <div className="modal-head">
 <h3>{title}</h3>
 <button className="icon-btn" onClick={onClose} aria-label="بستن"><Icon name="x" size={17} /></button>
 </div>
 {children}
 </div>
 </div>
 )
}

/**
 * مودال فرم عمومی — برای همه CRUD های پنل‌ها استفاده می‌شود.
 * fields: [{key, label, type: 'text'|'number'|'select'|'textarea'|'date', options, full, required}]
 */
export function FormModal({ open, title, fields = [], initial = {}, onSubmit, onClose, submitLabel = 'ذخیره' }) {
 if (!open) return null
 const handleSubmit = (e) => {
 e.preventDefault()
 const data = {}
 fields.forEach((f) => { data[f.key] = e.target.elements[f.key]?.value ?? initial[f.key] ?? '' })
 onSubmit(data)
 }
 return (
 <Modal open={open} title={title} onClose={onClose}>
 <form onSubmit={handleSubmit}>
 <div className="form-grid">
 {fields.map((f) => (
 <div key={f.key} className={`field ${f.full ? 'full' : ''}`}>
 <label>{f.label}</label>
 {f.type === 'select' ? (
 <select name={f.key} className="select" defaultValue={initial[f.key] ?? (f.options?.[0]?.value ?? f.options?.[0])}>
 {(f.options || []).map((o) => typeof o === 'object'
 ? <option key={o.value} value={o.value}>{o.label}</option>
 : <option key={o} value={o}>{o}</option>)}
 </select>
 ) : f.type === 'textarea' ? (
 <textarea name={f.key} className="textarea" defaultValue={initial[f.key]} />
 ) : (
 <input
 name={f.key} className="input" type={f.type || 'text'}
 defaultValue={initial[f.key]} required={f.required !== false}
 placeholder={f.placeholder}
 />
 )}
 </div>
 ))}
 </div>
 <div className="modal-actions">
 <button type="submit" className="btn btn-primary">{submitLabel}</button>
 <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
 </div>
 </form>
 </Modal>
 )
}
