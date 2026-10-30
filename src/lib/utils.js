import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** ادغام هوشمند کلاس‌ها (ابزار استاندارد shadcn/ui) */
export function cn(...inputs) {
 return twMerge(clsx(inputs))
}
