import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
 <input
 type={type}
 ref={ref}
 className={cn(
 'flex h-10 w-full rounded-[10px] border border-input bg-[rgba(148,163,184,0.06)] px-3.5 text-[14px] text-foreground placeholder:text-faint transition-colors focus-visible:outline-none focus-visible:border-[var(--teal)] focus-visible:ring-2 focus-visible:ring-[rgba(45,212,191,0.25)] disabled:cursor-not-allowed disabled:opacity-50',
 className
 )}
 {...props}
 />
))
Input.displayName = 'Input'

export { Input }
