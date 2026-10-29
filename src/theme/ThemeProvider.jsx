import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Sun, Moon, Droplets } from 'lucide-react'

/* ============================================================
   سیستم تم مدرس‌یار — سه حالت: dark / light / blu
   - انتخاب کاربر در localStorage ذخیره می‌شود
   - تم قبل از اولین رندر توسط اسکریپت inline در index.html ست می‌شود (بدون فلاش)
   - متاتگ theme-color هم با هر تغییر همگام می‌شود (نوار مرورگر موبایل)
   ============================================================ */

const KEY = 'modaresyar:theme'
const THEMES = [
  { key: 'light', label: 'روشن', meta: '#f3f6fb' },
  { key: 'dark', label: 'تیره', meta: '#070d18' },
  { key: 'blu', label: 'بلو', meta: '#050d24' },
]

function initialTheme() {
  try {
    const t = localStorage.getItem(KEY)
    return THEMES.some((x) => x.key === t) ? t : 'dark'
  } catch { return 'dark' }
}

const Ctx = createContext(null)
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch { /* حالت ناشناس */ }
    const t = THEMES.find((x) => x.key === theme)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t?.meta || '#070d18'))
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------- سوییچر سه‌حالته (ناوبار و پنل‌ها) ---------- */
const ICONS = { light: Sun, dark: Moon, blu: Droplets }

export function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme()
  const cycle = useCallback(() => {
    const i = THEMES.findIndex((t) => t.key === theme)
    setTheme(THEMES[(i + 1) % THEMES.length].key)
  }, [theme, setTheme])
  const Active = ICONS[theme] || Moon

  if (compact) {
    return (
      <button className="icon-btn" onClick={cycle} aria-label="تغییر تم سایت" title={`تم فعلی: ${THEMES.find((t) => t.key === theme)?.label} — کلیک = تم بعدی`}>
        <Active size={19} />
      </button>
    )
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="انتخاب تم سایت">
      {THEMES.map((t) => {
        const I = ICONS[t.key]
        return (
          <button
            key={t.key}
            role="radio"
            aria-checked={theme === t.key}
            className={`tt-btn ${theme === t.key ? 'on' : ''}`}
            onClick={() => setTheme(t.key)}
            title={`تم ${t.label}`}
            aria-label={`تم ${t.label}`}
          >
            <I size={15} />
          </button>
        )
      })}
    </div>
  )
}
