import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'

export function CartDrawer({ open, onClose }) {
  const { cart, removeFromCart, toast } = useApp()
  const nav = useNavigate()
  const total = cart.reduce((a, i) => a + (i.price || 0), 0)
  return (
    <>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`cart-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="cart-head">
          <b className="row g8"><Icon name="cart" size={19} /> سبد خرید ({faNum(cart.length)})</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={17} /></button>
        </div>
        <div className="cart-items">
          {cart.length === 0 && (
            <div className="empty">
              <Icon name="cart" size={44} />
              <p>سبد خرید شما خالی است</p>
            </div>
          )}
          {cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <span className={`ci-thumb ${item.color || 'grad-2'}`}>{item.emoji || '🎓'}</span>
              <div style={{ flex: 1 }}>
                <h4>{item.name}</h4>
                <span className="badge b-gray" style={{ marginTop: 4 }}>
                  {item.kind === 'course' ? 'دوره' : item.kind === 'live' ? 'کلاس زنده' : 'مدرس‌مارکت'}
                </span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="ci-price">{item.price ? toman(item.price) : 'رایگان'}</div>
                <button className="ci-remove" onClick={() => removeFromCart(item.id)} aria-label="حذف">
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="cart-foot">
            <div className="cart-total"><span>مبلغ قابل پرداخت</span><b>{toman(total)}</b></div>
            <button className="btn btn-primary btn-block btn-lg" onClick={() => { onClose(); nav('/checkout') }}>
              ادامه و پرداخت <Icon name="chevronLeft" size={17} />
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

export function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <Icon name={t.type === 'error' ? 'x' : t.type === 'info' ? 'bell' : 'check'} />
          {t.msg}
        </div>
      ))}
    </div>
  )
}
