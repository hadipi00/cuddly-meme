import Icon from '../../components/Icon'
import { DataIcon } from '../../utils/icons'
import { EmptyState } from '../../components/ui'
import { useApp } from '../../store/AppContext'
import { useNavigate } from 'react-router-dom'
import { faNum, toman } from '../../utils/format'

export default function SWishlist() {
 const { wishlist, toggleWish, addToCart, toast } = useApp()
 const nav = useNavigate()
 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>علاقه‌مندی‌های من</h2>
 <span className="muted small">دوره‌ها و محصولاتی که برای بعد ذخیره کرده‌اید</span>
 </div>
 <span className="badge b-pink">{faNum(wishlist.length)} مورد</span>
 </div>

 {wishlist.length === 0 ? (
 <div className="card" style={{ padding: 40 }}>
 <EmptyState icon="heart" text="لیست علاقه‌مندی خالی است — با آیکون قلب روی کارت دوره‌ها اضافه کنید." />
 <div style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={() => nav('/courses')}>مشاهده دوره‌ها</button></div>
 </div>
 ) : (
 <div className="grids g3">
 {wishlist.map((w) => (
 <div className="card pad" key={w.id}>
 <div className="row g12" style={{ alignItems: 'flex-start' }}>
 <span className={`avatar ${w.color || 'grad-2'}`} style={{ width: 52, height: 52, borderRadius: 13, fontSize: 26 }}><DataIcon name={w.icon} size={26} /></span>
 <div style={{ flex: 1 }}>
 <b className="small" style={{ lineHeight: 1.8 }}>{w.name}</b>
 <div className="muted small">{w.price ? toman(w.price) : 'رایگان'}</div>
 </div>
 <button className="wish-btn on" onClick={() => toggleWish(w)}><Icon name="heart" filled /></button>
 </div>
 <button className="btn btn-primary btn-sm btn-block mt16" onClick={() => {
 addToCart({ id: w.id, name: w.name, price: w.price, icon: w.icon, color: w.color, kind: w.kind })
 toast('به سبد خرید اضافه شد')
 }}>
 <Icon name="cart" size={15} /> انتقال به سبد خرید
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
