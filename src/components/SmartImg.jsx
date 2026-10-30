import { useState } from 'react'

/* ============================================================
   SmartImg — <img> استاندارد و سازگار با سئو
   ------------------------------------------------------------
   - alt اجباری (سئوی تصویر گوگل)
   - width/height → جلوگیری از CLS (هسته وب حیاتی)
   - loading=lazy + decoding=async → سرعت بارگذاری اولیه
   - اگر فایل عکس به هر دلیلی لود نشود، به‌جایش fallback
     (گرادیان + آیکون فعلی سایت) نمایش داده می‌شود تا هیچ‌وقت
     کادر شکسته دیده نشود.
   ============================================================ */
export default function SmartImg({
  src,
  alt,
  width = 672,
  height = 384,
  className = '',
  fallback = null,
  loading = 'lazy',
  ...rest
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return fallback
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={`smart-img ${className}`}
      onError={() => setFailed(true)}
      {...rest}
    />
  )
}
