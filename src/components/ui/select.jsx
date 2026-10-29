import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
 <SelectPrimitive.Trigger
 ref={ref}
 className={cn(
 'flex h-10 items-center justify-between gap-2 rounded-[10px] border border-input bg-[rgba(148,163,184,0.06)] px-3.5 text-[13.5px] font-semibold text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(45,212,191,0.3)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 cursor-pointer',
 className
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
 <ChevronDown size={16} className="opacity-60" />
 </SelectPrimitive.Icon>
 </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => (
 <SelectPrimitive.Portal>
 <SelectPrimitive.Content
 ref={ref}
 position={position}
 className={cn(
 'relative z-[999] max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-[0_24px_60px_-12px_rgba(2,8,23,0.9)]',
 position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
 className
 )}
 {...props}
 >
 <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
 <ChevronUp size={14} className="opacity-60" />
 </SelectPrimitive.ScrollUpButton>
 <SelectPrimitive.Viewport
 className={cn('p-1.5', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}
 >
 {children}
 </SelectPrimitive.Viewport>
 <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
 <ChevronDown size={14} className="opacity-60" />
 </SelectPrimitive.ScrollDownButton>
 </SelectPrimitive.Content>
 </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
 <SelectPrimitive.Label ref={ref} className={cn('px-2 py-1.5 text-[12px] text-muted-foreground', className)} {...props} />
))
SelectLabel.displayName = 'SelectLabel'

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
 <SelectPrimitive.Item
 ref={ref}
 className={cn(
 'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 ps-8 pe-2.5 text-[13.5px] font-semibold outline-none focus:bg-[rgba(45,212,191,0.12)] focus:text-[var(--teal)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
 className
 )}
 {...props}
 >
 <span className="absolute start-2 flex h-4 w-4 items-center justify-center">
 <SelectPrimitive.ItemIndicator>
 <Check size={14} className="text-[var(--teal)]" />
 </SelectPrimitive.ItemIndicator>
 </span>
 <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
 </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
 <SelectPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
))
SelectSeparator.displayName = 'SelectSeparator'

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator }
