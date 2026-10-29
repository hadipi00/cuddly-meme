import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'

/**
 * محافظ دسترسی به پنل‌ها.
 * اگر کاربر با نقش درست وارد نشده باشد، به صفحه ورود هدایت می‌شود
 * و مسیر مقصد در state.from ذخیره می‌شود تا بعد از ورود، همان‌جا برگردد.
 */
export function RouteGuard({ role, children }) {
  const { user } = useApp()
  const loc = useLocation()
  const allowed = user?.role === role

  if (!allowed) {
    return (
      <Navigate
        to={`/auth?role=${role}`}
        replace
        state={{ from: loc.pathname, needRole: role }}
      />
    )
  }
  return children
}
