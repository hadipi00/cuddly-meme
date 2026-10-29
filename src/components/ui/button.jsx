import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[14px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]',
 {
 variants: {
 variant: {
 default:
 'bg-primary text-primary-foreground shadow-[0_10px_28px_-10px_rgba(45,212,191,0.55)] hover:brightness-110',
 secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
 soft: 'bg-[rgba(45,212,191,0.12)] text-[var(--teal)] hover:bg-[rgba(45,212,191,0.22)]',
 outline: 'border border-border bg-transparent text-foreground hover:bg-secondary',
 ghost: 'text-foreground hover:bg-secondary',
 destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
 },
 size: {
 default: 'h-10 px-5',
 sm: 'h-8 px-3.5 text-[13px] rounded-lg',
 lg: 'h-12 px-7 text-[15px] rounded-xl',
 icon: 'h-9 w-9',
 },
 },
 defaultVariants: { variant: 'default', size: 'default' },
 }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
 const Comp = asChild ? Slot : 'button'
 return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
