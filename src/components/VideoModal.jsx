import { useMemo } from 'react'
import { Modal } from './Modal'

/**
 * وب‌ویو پخش ویدیو داخل سایت — دانش‌آموز بدون خروج از مدرس‌یار ویدیوی ضبط‌شده را می‌بیند.
 * ------------------------------------------------------------------
 * • آپارات / یوتیوب / ویمیو → به لینک embed تبدیل و در iframe پخش می‌شود
 * • فایل مستقیم (mp4/webm/…) → پلیر HTML5 داخل مودال
 * • هر لینک دیگری → iframe (اگر سرویس مدنظر embed بدهد پخش می‌شود)
 */
export function toEmbedUrl(url) {
  try {
    const u = new URL(url)
    /* فقط http/https — مانع javascript:/data: و سایر schemeها (باگ امنیتی) */
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const host = u.hostname.replace(/^www\./, '')
    /* آپارات — aparat.com/v/{hash} یا لینک embed */
    if (host.endsWith('aparat.com')) {
      if (u.pathname.includes('/embed/')) return `https://www.aparat.com${u.pathname}`
      const m = u.pathname.match(/\/v\/([^/]+)/) || u.pathname.match(/videohash\/([^/]+)/)
      if (m) return `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame`
    }
    /* یوتیوب — youtu.be/{id} یا youtube.com/watch?v={id} */
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1).split('/')[0]}`
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/').filter(Boolean)[1]
        return `https://www.youtube-nocookie.com/embed/${id}`
      }
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`
    }
    /* ویمیو */
    if (host.endsWith('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`
  } catch { /* لینک نامعتبر — همان لینک خام */ }
  return null
}

const DIRECT_FILE = /\.(mp4|webm|ogv|ogg|m4v|mov)(\?.*)?$/i

export default function VideoModal({ open, title, url, onClose }) {
  /* لینک غیر http(s) هرگز رندر نمی‌شود (ضد XSS از طریق recordingUrl وارده از پنل) */
  const safeUrl = /^https?:\/\//i.test(String(url || '')) ? url : null
  const kind = useMemo(() => {
    if (!safeUrl) return null
    if (DIRECT_FILE.test(safeUrl)) return 'file'
    return toEmbedUrl(safeUrl) ? 'embed' : 'iframe'
  }, [safeUrl])
  const src = useMemo(() => (kind === 'embed' ? toEmbedUrl(safeUrl) : safeUrl), [kind, safeUrl])

  return (
    <Modal open={open} title={title || 'پخش ویدیوی جلسه'} onClose={onClose} wide>
      {open && !safeUrl && (
        <p className="muted small" style={{ textAlign: 'center', padding: 30 }}>لینک ویدیو معتبر نیست — فقط آدرس‌های http/https پخش می‌شوند.</p>
      )}
      {open && kind === 'file' && (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', maxHeight: '68vh', borderRadius: 12, background: '#000' }}
        />
      )}
      {open && kind !== 'file' && src && (
        <iframe
          src={src}
          title={title || 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12, background: '#000' }}
        />
      )}
      <p className="muted small mt8" style={{ textAlign: 'center' }}>
        ویدیو داخل سایت پخش می‌شود — بدون خروج از مدرس‌یار
      </p>
    </Modal>
  )
}
