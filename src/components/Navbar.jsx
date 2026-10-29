import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { Brand } from './ui'
import { useApp } from '../store/AppContext'
import { faNum } from '../utils/format'

const links = [
  { to: '/', label: 'صفحه نخست' },
  { to: '/resume', label: 'رزومه و افتخارات' },
  { to: '/courses', label: 'دوره‌های ضبط‌شده' },
  { to: '/live', label: 'کلاس‌های آنلاین' },
  { to: '/teachers', label: 'اساتید' },
  { to: '/market', label: 'مدرس‌مارکت' },
  { to: '/blog', label: 'وبلاگ' },
  { to: '/contact', label: 'تماس' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const { cart, user } = useApp()
  const nav = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : '' }, [menu])

  return (
    <>
      <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="container nav-inner">
          <Link to="/"><Brand /></Link>
          <nav className="nav-links">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-cta">
            <button className="icon-btn" onClick={() => nav('/checkout', { state: { openCart: true } })} aria-label="سبد خرید">
              <Icon name="cart" />
              {cart.length > 0 && <span className="bubble">{faNum(cart.length)}</span>}
            </button>
            <Link to="/auth" className="btn btn-primary btn-sm">
              <Icon name="user" size={16} />
              <span className="hide-m">{user ? `پنل ${user.roleLabel}` : 'ورود / ثبت‌نام'}</span>
            </Link>
            <button className="icon-btn hamburger" onClick={() => setMenu(true)} aria-label="منو">
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${menu ? 'open' : ''}`}>
        <button className="icon-btn close-btn" onClick={() => setMenu(false)}><Icon name="x" /></button>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setMenu(false)}
            className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/auth" className="btn btn-primary" onClick={() => setMenu(false)} style={{ marginTop: 14 }}>
          ورود / ثبت‌نام
        </NavLink>
      </div>
    </>
  )
}
