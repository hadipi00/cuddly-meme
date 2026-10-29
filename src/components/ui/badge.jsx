import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold transition-colors',
 {
 variants: {
 variant: {
 default: 'bg-[rgba(45,212,191,0.14)] text-[var(--teal)] border border-[rgba(45,212,191,0.3)]',
 amber: 'bg-[rgba(251,191,36,0.14)] text-[var(--amber)] border border-[rgba(251,191,36,0.3)]',
 red: 'bg-[rgba(251,113,133,0.14)] text-[var(--red)] border border-[rgba(251,113,133,0.32)]',
 green: 'bg-[rgba(52,211,153,0.14)] text-[var(--green)] border border-[rgba(52,211,153,0.32)]',
 sky: 'bg-[rgba(56,189,248,0.14)] text-[var(--sky)] border border-[rgba(56,189,248,0.32)]',
 violet: 'bg-[rgba(167,139,250,0.14)] text-[var(--violet)] border border-[rgba(167,139,250,0.32)]',
 gray: 'bg-secondary text-muted-foreground border border-border',
 discount: 'bg-[var(--red)] text-white shadow-[0_4px_14px_-4px_rgba(251,113,133,0.6)]',
 },
 },
 defaultVariants: { variant: 'default' },
 }
)

function Badge({ className, variant, ...props }) {
 return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
