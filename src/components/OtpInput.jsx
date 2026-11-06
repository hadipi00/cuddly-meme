import { useEffect, useRef, useState } from 'react'

/**
 * [مهاجرت CRM] کادر ورود کد تأیید پیامکی — شش‌خانه‌ای، شیک و تک:
 *   • فقط رقم (ارقام فارسی هم خودکار لاتین می‌شوند)
 *   • پرش خودکار به خانهٔ بعد / Backspace به خانهٔ قبل
 *   • Paste کل کد در هر خانه → همهٔ خانه‌ها پر و onComplete می‌گیرد
 *   • وقتی کد کامل شد onComplete(code) صدا زده می‌شود — کاربر لازم نیست دکمه بزند
 */
export default function OtpInput({ length = 6, onComplete, disabled = false, autoFocus = true, error = '' }) {
 const [vals, setVals] = useState(() => Array(length).fill(''))
 const refs = useRef([])
 const doneRef = useRef(false)

 /* ریست کامل وقتی کامپوننت عوض می‌شود (مثلاً کد جدید ارسال شد) */
 useEffect(() => { setVals(Array(length).fill('')); doneRef.current = false }, [length])

 useEffect(() => {
   if (autoFocus) setTimeout(() => refs.current[0]?.focus(), 120)
 }, [autoFocus])

 const norm = (s) => String(s || '')
   .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
   .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
   .replace(/\D/g, '')

 const commit = (next) => {
   setVals(next)
   const code = next.join('')
   if (code.length === length && !doneRef.current) {
     doneRef.current = true
     onComplete?.(code)
     refs.current[length - 1]?.blur()
   }
 }

 const setAt = (i, digits) => {
   const next = [...vals]
   /* اگر بیش از یک رقم آمد (typo سریع) پشت‌سرهم پخش می‌کنیم */
   const ds = digits.slice(0, length - i)
   for (let k = 0; k < ds.length; k++) next[i + k] = ds[k]
   const focusIdx = Math.min(i + ds.length, length - 1)
   setTimeout(() => refs.current[focusIdx]?.focus(), 0)
   commit(next)
 }

 const onPaste = (e) => {
   if (disabled) return
   e.preventDefault()
   const digits = norm(e.clipboardData?.getData('text'))
   if (!digits) return
   const next = Array(length).fill('')
   for (let k = 0; k < Math.min(digits.length, length); k++) next[k] = digits[k]
   const focusIdx = Math.min(digits.length, length - 1)
   setTimeout(() => refs.current[focusIdx]?.focus(), 0)
   commit(next)
 }

 /* پاک‌کردن یک خانه (Backspace) — فرصت واردکردن دوبارهٔ کد باز می‌شود */
 const clearAt = (i) => {
   const next = [...vals]
   next[i] = ''
   doneRef.current = false
   setVals(next)
 }

 return (
 <div className={`otp-wrap${error ? ' otp-error' : ''}`} dir="ltr" onPaste={onPaste} data-error={error || undefined}>
   {vals.map((v, i) => (
   <input
     key={i}
     ref={(el) => { refs.current[i] = el }}
     className="otp-box"
     type="text"
     inputMode="numeric"
     autoComplete={i === 0 ? 'one-time-code' : 'off'}
     maxLength={length}
     value={v}
     disabled={disabled}
     aria-label={`رقم ${i + 1} از کد تأیید`}
     onChange={(e) => setAt(i, norm(e.target.value))}
     onKeyDown={(e) => {
       if (e.key === 'Backspace') {
         e.preventDefault()
         if (vals[i]) { clearAt(i); refs.current[i]?.focus() }
         else if (i > 0) { clearAt(i - 1); refs.current[i - 1]?.focus() }
       } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus() }
       else if (e.key === 'ArrowRight' && i < length - 1) { e.preventDefault(); refs.current[i + 1]?.focus() }
     }}
     onFocus={(e) => e.target.select()}
   />
   ))}
 </div>
 )
}
