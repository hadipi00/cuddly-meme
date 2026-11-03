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
  /* [فیکس F28] به‌جای بولین، «src خراب‌شده» را نگه می‌داریم تا با تغییر src
     state به‌صورت طبیعی ریست شود — قبلاً failed هرگز پاک نمی‌شد و تصویر
     سالم بعدی هم fallback می‌ماند (دو محصول پشت‌سرهم در مارکت). */
  const [failedFor, setFailedFor] = useState(null)
  if (!src || failedFor === src) return fallback
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={`smart-img ${className}`}
      onError={() => setFailedFor(src)}
      {...rest}
    />
  )
}
