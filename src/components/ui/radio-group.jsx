import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { CircleCheck } from 'lucide-react'
import { cn } from '../../lib/utils'

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => (
 <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2.5', className)} {...props} />
))
RadioGroup.displayName = 'RadioGroup'

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => (
 <RadioGroupPrimitive.Item ref={ref} className={cn('peer hidden', className)} {...props} />
))
RadioGroupItem.displayName = 'RadioGroupItem'

/**
 * کارت انتخابی (برای روش ارسال و ...)
 * حالت انتخاب‌شده به‌صورت خودکار از گروه رادیو خوانده می‌شود.
 */
const RadioCard = React.forwardRef(({ className, children, ...props }, ref) => (
 <RadioGroupPrimitive.Item
 ref={ref}
 className={cn(
 'group relative flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border border-border bg-[rgba(148,163,184,0.04)] p-4 pe-10 text-start transition-all outline-none',
 'hover:border-[rgba(148,163,184,0.42)]',
 'data-[state=checked]:border-[var(--teal)] data-[state=checked]:bg-[rgba(45,212,191,0.07)] data-[state=checked]:shadow-[0_10px_28px_-14px_rgba(45,212,191,0.45)]',
 className
 )}
 {...props}
 >
 {children}
 <CircleCheck
 size={20}
 className="absolute left-3 top-3 hidden text-[var(--teal)] group-data-[state=checked]:block"
 />
 </RadioGroupPrimitive.Item>
))
RadioCard.displayName = 'RadioCard'

export { RadioGroup, RadioGroupItem, RadioCard }
