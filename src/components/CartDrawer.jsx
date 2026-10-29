import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, Minus, Plus, Truck, X, Check, Info } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
import { Button } from './ui/button'

export function CartDrawer({ open, onClose }) {
  const { cart, removeFromCart, updateQty, toast } = useApp()
  const nav = useNavigate()
  const count = cart.reduce((a, i) => a + (i.qty || 1), 0)
  const total = cart.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0)
  const hasMarket = cart.some((i) => i.kind === 'market')

  return (
    <>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`cart-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="cart-head">
          <b className="row g8"><ShoppingCart size={19} /> سبد خرید ({faNum(count)})</b>
          <button className="icon-btn" onClick={onClose} aria-label="بستن"><X size={17} /></button>
        </div>
        <div className="cart-items">
          {cart.length === 0 && (
            <div className="empty">
              <ShoppingCart size={44} />
              <p>سبد خرید شما خالی است</p>
            </div>
          )}
          {cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <span className={`ci-thumb ${item.color || 'grad-2'}`}>
                <DataIcon name={item.icon} size={24} />
              </span>
              <div style={{ flex: 1 }}>
                <h4>{item.name}</h4>
                <div className="row g8" style={{ marginTop: 6 }}>
                  <span className="badge b-gray">
                    {item.kind === 'course' ? 'دوره' : item.kind === 'live' ? 'کلاس زنده' : 'مدرس‌مارکت'}
                  </span>
                  {item.kind === 'market' && (
                    <div className="qty-stepper">
                      <button onClick={() => updateQty(item.id, +1)} disabled={(item.qty || 1) >= (item.maxStock || 99)} aria-label="افزایش"><Plus size={12} /></button>
                      <b>{faNum(item.qty || 1)}</b>
                      <button onClick={() => ((item.qty || 1) <= 1 ? removeFromCart(item.id) : updateQty(item.id, -1))} aria-label="کاهش"><Minus size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="ci-price">{item.price ? toman(item.price * (item.qty || 1)) : 'رایگان'}</div>
                {(item.qty || 1) > 1 && <div className="muted small">{toman(item.price)} × {faNum(item.qty)}</div>}
                <button className="ci-remove" onClick={() => removeFromCart(item.id)} aria-label="حذف">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="cart-foot">
            {hasMarket && (
              <p className="row g8 small muted" style={{ marginBottom: 10 }}>
                <Truck size={14} /> هزینه ارسال در مرحله پرداخت — پیش‌کرایه یا پس‌کرایه
              </p>
            )}
            <div className="cart-total"><span>مبلغ قابل پرداخت</span><b>{toman(total)}</b></div>
            <Button className="w-full" size="lg" onClick={() => { onClose(); nav('/checkout') }}>
              ادامه و پرداخت
            </Button>
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
          {t.type === 'error' ? <X size={15} /> : t.type === 'info' ? <Info size={15} /> : <Check size={15} />}
          {t.msg}
        </div>
      ))}
    </div>
  )
}
