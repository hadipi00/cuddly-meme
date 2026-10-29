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
  const kind = useMemo(() => {
    if (!url) return null
    if (DIRECT_FILE.test(url)) return 'file'
    return toEmbedUrl(url) ? 'embed' : 'iframe'
  }, [url])
  const src = useMemo(() => (kind === 'embed' ? toEmbedUrl(url) : url), [kind, url])

  return (
    <Modal open={open} title={title || 'پخش ویدیوی جلسه'} onClose={onClose} wide>
      {open && kind === 'file' && (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', maxHeight: '68vh', borderRadius: 12, background: '#000' }}
        />
      )}
      {open && kind !== 'file' && (
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
